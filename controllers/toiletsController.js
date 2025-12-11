// controllers/toiletsController.js
const { v4: uuid } = require('uuid'); // Σωστή εισαγωγή: Απευθείας από το πακέτο uuid
const Toilet = require('../models/Toilet');
const Review = require('../models/Review');

// ----------------------------------------------------
// Mongoose Aggregation Logic (Shared Helper)
// ----------------------------------------------------
/**
 * Ενημερώνει τα aggregated ratings (μέσος όρος, πλήθος κριτικών) στο Toilet document
 * με βάση όλες τις ενεργές κριτικές στη Mongoose DB.
 * Αυτή η συνάρτηση χρησιμοποιείται επίσης και στον reviewsController.
 */
const updateMongooseAggregates = async (toiletId) => {
    try {
        const stats = await Review.aggregate([
            { $match: { toiletId: toiletId, isDeleted: false } },
            { $group: {
                _id: '$toiletId',
                reviewCount: { $sum: 1 },
                avgOverall: { $avg: '$overallRating' },
                avgClean: { $avg: '$cleanlinessRating' },
                avgLayout: { $avg: '$layoutRating' },
                avgSpacious: { $avg: '$spaciousnessRating' },
                avgAmenities: { $avg: '$amenitiesRating' },
            }}
        ]);
    
        if (stats.length > 0) {
            const s = stats[0];
            // Ενημέρωση του Toilet document με τα νέα στοιχεία
            await Toilet.updateOne(
                { toiletId: toiletId },
                {
                    reviewCount: s.reviewCount,
                    averageRating: parseFloat(s.avgOverall.toFixed(2)),
                    cleanlinessRating: parseFloat(s.avgClean.toFixed(2)),
                    layoutRating: parseFloat(s.avgLayout.toFixed(2)),
                    spaciousnessRating: parseFloat(s.avgSpacious.toFixed(2)),
                    amenitiesRating: parseFloat(s.avgAmenities.toFixed(2)),
                    updatedAt: new Date()
                }
            );
        } else {
            // Επαναφορά σε 0 αν δεν υπάρχουν κριτικές
            await Toilet.updateOne(
                { toiletId: toiletId },
                {
                    reviewCount: 0, averageRating: 0, cleanlinessRating: 0, layoutRating: 0,
                    spaciousnessRating: 0, amenitiesRating: 0, updatedAt: new Date()
                }
            );
        }
    } catch (error) {
        console.error('Error updating Mongoose Aggregates:', error);
        // Μην πετάξεις το error, απλά καταγράφησέ το για να συνεχίσει η κύρια λειτουργία
    }
};

// ----------------------------------------------------
// Mock Aggregation Logic (Διατηρείται μόνο για το Mock Mode)
// ----------------------------------------------------
/**
 * Υπολογίζει τα aggregated ratings για το Mock Mode.
 * (Αυτός ο κώδικας πρέπει να παραμείνει για να περάσει το Mock Mode tests)
 */
const calculateAggregates = (toiletId) => {
  // ΑΣΦΑΛΗΣ ΠΡΟΣΒΑΣΗ ΣΤΟ MOCK
  const MOCK = global.MOCK;
  if (!MOCK || !MOCK.reviews) return null;
    
  const reviews = MOCK.reviews.filter(r => r.toiletId === toiletId && !r.isDeleted);
    
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

// ----------------------------------------------------
// Controller Functions
// ----------------------------------------------------
exports.list = async (req, res, next) => {
  try {
    // support filters: lat,lng,radius,minRating,amenities,sort
    const { lat, lng, radius, minRating, amenities, sort } = req.query;

    if (process.env.MONGODB_URI) {
      // Mongoose Mode
      let q = { isActive: true };
      if (minRating) q.averageRating = { $gte: Number(minRating) };
      
      // ✅ START Geospatial Filtering Logic (For Coverage)
      if (lat && lng && radius) {
          const center = [Number(lng), Number(lat)];
          // Radius converted to radians (Earth radius approx 6371 km)
          const maxDistance = Number(radius) / 6371; 
          q.location = {
              $geoWithin: {
                  $centerSphere: [center, maxDistance]
              }
          };
      }
      // END Geospatial Filtering Logic
      
      let list = Toilet.find(q);

      if (sort === 'high_to_low') {
        list = list.sort('-averageRating');
      } else if (sort === 'low_to_high') {
        list = list.sort('averageRating');
      }

      const toilets = await list.limit(200);
      return res.json({ success:true, data: toilets });
    }

    // MOCK MODE
    const MOCK = global.MOCK;
    if (!MOCK || !MOCK.toilets) return res.status(500).json({ success:false, error:'MOCK data not available' });

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
    
    // MOCK MODE
    const MOCK = global.MOCK;
    if (!MOCK || !MOCK.toilets || !MOCK.reviews) return res.status(500).json({ success:false, error:'MOCK data not available' });

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
    
    // duplicate detection logic setup (used in mock mode only)
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

    // MOCK MODE
    const MOCK = global.MOCK;
    if (!MOCK || !MOCK.toilets) return res.status(500).json({ success:false, error:'MOCK data not available' });
    
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
      // 1. Βρες την τουαλέτα
      const t = await Toilet.findOne({ toiletId: id });
      if (!t) return res.status(404).json({ success:false, message:'Not found' });

      // 2. Έλεγχος Δικαιωμάτων
      if (req.user.userId !== t.createdBy && req.user.role !== 'ADMIN') {
        return res.status(403).json({ success:false, message:'Forbidden' });
      }

      // 3. Εκτέλεση του Update
      // Αποκλεισμός πεδίων που ενημερώνονται μόνο μέσω Reviews ή Admin Approve/Reject.
      const allowedUpdates = Object.keys(payload).filter(key => 
          !['averageRating', 'cleanlinessRating', 'reviewCount', 'updatedAt'].includes(key)
      );

      const updatePayload = allowedUpdates.reduce((obj, key) => {
          obj[key] = payload[key];
          return obj;
      }, {});

      const updated = await Toilet.findOneAndUpdate({ toiletId: id }, updatePayload, { new: true });
      return res.json({ success:true, data: updated });
    }
    
    // MOCK MODE
    const MOCK = global.MOCK;
    if (!MOCK || !MOCK.toilets) return res.status(500).json({ success:false, error:'MOCK data not available' });

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
      // 1. Βρες την τουαλέτα
      const t = await Toilet.findOne({ toiletId: id });
      if (!t) return res.status(404).json({ success:false, message:'Not found' }); 

      // 2. Έλεγχος Δικαιωμάτων
      if (req.user.userId !== t.createdBy && req.user.role !== 'ADMIN') {
        return res.status(403).json({ success:false, message:'Forbidden' });
      }
      
      // 3. Εκτέλεση του Update (Deactivate)
      await Toilet.updateOne({ toiletId: id }, { isActive: false });
      
      // 4. Ενημέρωση Aggregates: Σημαδεύουμε τις κριτικές ως διαγραμμένες
      await Review.updateMany({ toiletId: id }, { isDeleted: true });
      // Επαναϋπολογισμός των aggregated ratings (που θα γίνουν 0)
      await updateMongooseAggregates(id); 
      
      return res.json({ success:true, message:'Deactivated' });
    }

    // MOCK MODE
    const MOCK = global.MOCK;
    if (!MOCK || !MOCK.toilets) return res.status(500).json({ success:false, error:'MOCK data not available' });
    
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