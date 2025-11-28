// controllers/searchController.js
const MOCK = global.MOCK;

const metersBetween = (lat1, lon1, lat2, lon2) => {
  function toRad(v){ return v * Math.PI/180; }
  const R = 6371000;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2)) * Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

exports.nearby = async (req, res, next) => {
  try {
    const { lat, lng, radius = 500 } = req.query;
    if (!lat || !lng) return res.status(400).json({ success:false, message:'lat & lng required' });
    if (process.env.MONGODB_URI) {
      // For brevity, return all and let frontend filter (or implement geoNear)
      const toilets = await require('../models/Toilet').find({ isActive: true }).limit(200);
      return res.json({ success:true, data: toilets });
    }
    const list = MOCK.toilets
      .filter(t => t.isActive)
      .map(t => ({ toilet: t, distance: metersBetween(Number(lat), Number(lng), t.location.lat, t.location.lng) }))
      .filter(x => x.distance <= Number(radius))
      .sort((a,b) => a.distance - b.distance)
      .map(x => x.toilet);
    res.json({ success:true, data: list });
  } catch (err) { next(err); }
};
