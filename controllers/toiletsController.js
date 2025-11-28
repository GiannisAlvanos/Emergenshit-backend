// controllers/toiletsController.js
const { v4: uuid } = require('uuid');
const Toilet = require('../models/Toilet');
const Review = require('../models/Review');

const MOCK = global.MOCK;

const calculateAggregates = (toiletId) => {
  // recompute ratings from reviews in mock
  const reviews = (MOCK ? MOCK.reviews : null) ? MOCK.reviews.filter(r => r.toiletId === toiletId && !r.isDeleted) : [];
  if (reviews.length === 0) return null;
  const agg = { reviewCount: reviews.length, cleanlinessRating:0, layoutRating:0, spaciousnessRating:0, amenitiesRating:0, averageRating:0 };
  reviews.forEach(r => {
    agg.cleanlinessRating += (r.cleanlinessRating || 0);
    agg.layoutRating += (r.layoutRating || 0);
    agg.spaciousnessRating += (r.spaciousnessRating || 0);
    agg.amenitiesRating += (r.amenitiesRating || 0);
    agg.averageRating += (r.overallRating || 0);
  });
  agg.cleanlinessRating /= reviews.length;
  agg.layoutRating /= reviews.length;
  agg.spaciousnessRating /= reviews.length;
  agg.amenitiesRating /= reviews.length;
  agg.averageRating /= reviews.length;
  return agg;
};

exports.list = async (req, res, next) => {
  try {
    // support filters: lat,lng,radius,minRating,amenities,sort
    const { lat, lng, radius, minRating, amenities, sort } = req.query;

    if (process.env.MONGODB_URI) {
      // simple implementation for Mongo: return all (frontend can handle geospatial)
      let q = {};
      if (minRating) q.averageRating = { $gte: Number(minRating) };
      const list = await Toilet.find(q).limit(200);
      return res.json({ success:true, data: list });
    }

    let list = MOCK.toilets.filter(t => t.isActive);
    if (minRating) list = list.filter(t => (t.averageRating || 0) >= Number(minRating));
    if (amenities) {
      const wanted = Array.isArray(amenities) ? amenities : amenities.split(',');
      list = list.filter(t => wanted.every(a => t.amenities && t.amenities.includes(a)));
    }
    // sort
    if (sort === 'high_to_low') list = list.sort((a,b) => (b.averageRating||0) - (a.averageRating||0));
    if (sort === 'low_to_high') list = list.sort((a,b) => (a.averageRating||0) - (b.averageRating||0));
    res.json({ success:true, data: list });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (process.env.MONGODB_URI) {
      const t = await Toilet.findOne({ toiletId: id });
      if (!t) return res.status(404).json({ success:false, message:'Not found' });
      const reviews = await Review.find({ toiletId: id, isDeleted: false });
      return res.json({ success:true, data: { toilet: t, reviews } });
    }
    const toilet = MOCK.toilets.find(t => t.toiletId === id);
    if (!toilet) return res.status(404).json({ success:false, message:'Not found' });
    const reviews = MOCK.reviews.filter(r => r.toiletId === id && !r.isDeleted);
    res.json({ success:true, data: { toilet, reviews } });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const payload = req.body;
    if (!payload || !payload.name || !payload.location || !payload.location.lat || !payload.location.lng) {
      return res.status(400).json({ success:false, message:'name and location required' });
    }
    // duplicate detection: if exists within ~20m (approx threshold) in mock
    const thresholdMeters = 20;
    const metersBetween = (lat1, lon1, lat2, lon2) => {
      // haversine
      function toRad(v){ return v * Math.PI/180; }
      const R = 6371000;
      const dLat = toRad(lat2-lat1);
      const dLon = toRad(lon2-lon1);
      const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2)) * Math.sin(dLon/2)*Math.sin(dLon/2);
      const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    if (process.env.MONGODB_URI) {
      // TODO: implement geo query / duplicate check
      const newToilet = await Toilet.create({...payload, toiletId: uuid(), createdBy: req.user.userId});
      return res.status(201).json({ success:true, data: newToilet });
    }

    const exists = MOCK.toilets.find(t => {
      const dist = metersBetween(t.location.lat, t.location.lng, payload.location.lat, payload.location.lng);
      return dist <= thresholdMeters;
    });
    if (exists) {
      return res.status(409).json({ success:false, message:'A similar toilet is already listed. Would you like to review it instead?', existing: exists });
    }

    const newToilet = {
      toiletId: uuid(),
      name: payload.name,
      location: payload.location,
      description: payload.description || '',
      photos: payload.photos || [],
      averageRating: 0,
      cleanlinessRating: 0,
      layoutRating: 0,
      spaciousnessRating: 0,
      amenitiesRating: 0,
      reviewCount: 0,
      amenities: payload.amenities || [],
      wheelchairAccessible: !!payload.wheelchairAccessible,
      isActive: false, // new submissions require admin approval per user story
      createdBy: req.user.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    MOCK.toilets.push(newToilet);
    res.status(201).json({ success:true, data: newToilet, message:'Your toilet is successfully added! Pending admin approval.'});
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const id = req.params.id;
    const payload = req.body;
    if (process.env.MONGODB_URI) {
      const t = await Toilet.findOneAndUpdate({ toiletId: id }, payload, { new: true });
      return res.json({ success:true, data: t });
    }
    const idx = MOCK.toilets.findIndex(t => t.toiletId === id);
    if (idx === -1) return res.status(404).json({ success:false, message:'Not found' });
    const toilet = MOCK.toilets[idx];
    // only creator or admin can update
    if (req.user.userId !== toilet.createdBy && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success:false, message:'Forbidden' });
    }
    MOCK.toilets[idx] = { ...toilet, ...payload, updatedAt: new Date().toISOString() };
    res.json({ success:true, data: MOCK.toilets[idx] });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (process.env.MONGODB_URI) {
      await Toilet.updateOne({ toiletId: id }, { isActive: false });
      return res.json({ success:true, message:'Deactivated' });
    }
    const idx = MOCK.toilets.findIndex(t => t.toiletId === id);
    if (idx === -1) return res.status(404).json({ success:false, message:'Not found' });
    // only admin or creator
    if (req.user.userId !== MOCK.toilets[idx].createdBy && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success:false, message:'Forbidden' });
    }
    MOCK.toilets[idx].isActive = false;
    res.json({ success:true, message:'Deactivated' });
  } catch (err) { next(err); }
};
