// middleware/auth.js
const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ success:false, message: 'No token' });
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ success:false, message:'Invalid token' });
  }
};

const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success:false, message:'No user' });
  if (req.user.role !== role && req.user.role !== 'ADMIN') return res.status(403).json({ success:false, message:'Forbidden' });
  next();
};

module.exports = { auth, requireRole };
