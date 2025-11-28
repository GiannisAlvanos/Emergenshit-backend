// controllers/adminController.js
const MOCK = global.MOCK;

exports.pendingToilets = async (req, res, next) => {
  try {
    if (process.env.MONGODB_URI) {
      // TODO: implement pending fetch from DB
      return res.json({ success:true, data: [] });
    }
    const pending = MOCK.toilets.filter(t => !t.isActive);
    res.json({ success:true, data: pending });
  } catch (err) { next(err); }
};

exports.approve = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (process.env.MONGODB_URI) {
      // TODO: update db
      return res.json({ success:true, message:'Approved (db)' });
    }
    const idx = MOCK.toilets.findIndex(t => t.toiletId === id);
    if (idx === -1) return res.status(404).json({ success:false, message:'Not found' });
    MOCK.toilets[idx].isActive = true;
    MOCK.toilets[idx].updatedAt = new Date().toISOString();
    // simulate notification (in real app push/email)
    res.json({ success:true, message:'Approved and user notified', data: MOCK.toilets[idx] });
  } catch (err) { next(err); }
};

exports.reject = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { reason } = req.body;
    if (process.env.MONGODB_URI) {
      // TODO
      return res.json({ success:true, message:'Rejected (db)' });
    }
    const idx = MOCK.toilets.findIndex(t => t.toiletId === id);
    if (idx === -1) return res.status(404).json({ success:false, message:'Not found' });
    // Remove or flag as rejected
    MOCK.toilets.splice(idx,1);
    // In real app, notify user with reason
    res.json({ success:true, message:'Rejected and user notified', reason });
  } catch (err) { next(err); }
};
