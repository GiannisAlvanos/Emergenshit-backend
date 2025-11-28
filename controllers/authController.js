// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const User = require('../models/User');

const MOCK = global.MOCK;

const signToken = (user) => {
  return jwt.sign({ userId: user.userId, email: user.email, role: user.role }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success:false, message:'name,email,password required' });

    // If using Mongo
    if (process.env.MONGODB_URI) {
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ success:false, message:'Email exists' });
      const hash = await bcrypt.hash(password, 10);
      const user = await User.create({ userId: uuid(), name, email, passwordHash: hash });
      const token = signToken(user);
      return res.json({ success:true, data: { token, user } });
    }

    // mock flow
    const found = MOCK.users.find(u => u.email === email);
    if (found) return res.status(400).json({ success:false, message:'Email exists' });
    const hash = await bcrypt.hash(password, 10);
    const user = {
      userId: uuid(), name, email, passwordHash: hash, role: 'USER', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isActive: true
    };
    MOCK.users.push(user);
    const token = signToken(user);
    res.json({ success:true, data: { token, user } });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success:false, message:'email,password required' });

    if (process.env.MONGODB_URI) {
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ success:false, message:'Invalid credentials' });
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ success:false, message:'Invalid credentials' });
      const token = signToken(user);
      return res.json({ success:true, data: { token, user } });
    }

    const user = MOCK.users.find(u => u.email === email);
    if (!user) return res.status(401).json({ success:false, message:'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ success:false, message:'Invalid credentials' });
    const token = signToken(user);
    res.json({ success:true, data: { token, user } });
  } catch (err) { next(err); }
};
