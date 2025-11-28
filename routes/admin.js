const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const Toilet = require("../models/Toilet");

// Only admin allowed
function adminOnly(req, res, next) {
  if (req.user.role !== "admin" && req.user.role !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Admins only" });
  }
  next();
}

// GET pending toilets
router.get("/pending", auth, adminOnly, async (req, res) => {
  const list = await Toilet.find({ isActive: false });
  res.json({ success: true, data: list });
});

// APPROVE
router.put("/approve/:id", auth, adminOnly, async (req, res) => {
  await Toilet.updateOne({ toiletId: req.params.id }, { isActive: true });
  res.json({ success: true, message: "Approved" });
});

// REJECT
router.put("/reject/:id", auth, adminOnly, async (req, res) => {
  await Toilet.updateOne({ toiletId: req.params.id }, { isActive: false });
  res.json({ success: true, message: "Rejected" });
});

module.exports = router;
