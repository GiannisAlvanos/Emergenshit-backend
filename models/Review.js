// models/Review.js
const mongoose = require('mongoose');

const PhotoSchema = new mongoose.Schema({
  id: String,
  url: String,
  caption: String
}, { _id: false });

const ReplySchema = new mongoose.Schema({
  id: String,
  userId: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const ReviewSchema = new mongoose.Schema({
  reviewId: { type: String, required: true, unique: true },
  toiletId: { type: String, required: true },
  userId: { type: String, required: true },
  overallRating: { type: Number, required: true },
  cleanlinessRating: Number,
  layoutRating: Number,
  spaciousnessRating: Number,
  amenitiesRating: Number,
  comment: String,
  photos: [PhotoSchema],
  likes: { type: Number, default: 0 },
  dislikes: { type: Number, default: 0 },
  replies: [ReplySchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false }
});

module.exports = mongoose.models.Review || mongoose.model('Review', ReviewSchema);
