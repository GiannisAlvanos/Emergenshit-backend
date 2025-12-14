// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const User = require('../models/User');

// Η δήλωση 'const MOCK = global.MOCK;' αφαιρέθηκε από εδώ

const signToken = (user) => {
  return jwt.sign(
    { userId: user.userId, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Hash only if not hashed already (important for tests)
async function ensureHash(password) {
  if (!password.startsWith("$2")) {
    return await bcrypt.hash(password, 10);
  }
  return password;
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success:false, message:'name,email,password required' });
    }

    const hashedPassword = await ensureHash(password);

    if (process.env.MONGODB_URI) {
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ success:false, message:'Email exists' });

      const user = await User.create({
        userId: uuid(),
        name,
        email,
        passwordHash: hashedPassword,
        role: "USER"
      });

      const token = signToken(user);
      // ΕΔΩ Η ΑΛΛΑΓΗ: Επιστροφή του user
      return res.status(201).json({ success:true, token, user }); 
    }

    // MOCK MODE
    const MOCK = global.MOCK;
    if (!MOCK || !MOCK.users) return res.status(500).json({ success:false, error:'MOCK data not available' });

    const found = MOCK.users.find(u => u.email === email);
    if (found) return res.status(400).json({ success:false, message:'Email exists' });

    const user = {
      userId: uuid(),
      name,
      email,
      passwordHash: hashedPassword,
      role: "USER",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    MOCK.users.push(user);
    const token = signToken(user);
    // ΕΔΩ Η ΑΛΛΑΓΗ: Επιστροφή του user
    return res.status(201).json({ success:true, token, user }); 

  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success:false, message:'email,password required' });

    if (process.env.MONGODB_URI) {
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ success:false, message:'Invalid credentials' });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ success:false, message:'Invalid credentials' });

      const token = signToken(user);
      // ΕΔΩ Η ΑΛΛΑΓΗ: Επιστροφή του user
      return res.status(200).json({ success:true, token, user }); 
    }

    // MOCK MODE
    const MOCK = global.MOCK;
    if (!MOCK || !MOCK.users) return res.status(500).json({ success:false, error:'MOCK data not available' });

    const user = MOCK.users.find(u => u.email === email);
    if (!user) return res.status(401).json({ success:false, message:'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ success:false, message:'Invalid credentials' });

    const token = signToken(user);
    // ΕΔΩ Η ΑΛΛΑΓΗ: Επιστροφή του user
    return res.status(200).json({ success:true, token, user }); 

  } catch (err) {
    next(err);
  }
};