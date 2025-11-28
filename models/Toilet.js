// models/Toilet.js
const mongoose = require('mongoose');

const GeoSchema = new mongoose.Schema({
  lat: Number,
  lng: Number
}, { _id: false });

const PhotoSchema = new mongoose.Schema({
  id: String,
  url: String,
  caption: String
}, { _id: false });

const ToiletSchema = new mongoose.Schema({
  toiletId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: GeoSchema, required: true },
  description: { type: String },
  photos: [PhotoSchema],
  averageRating: { type: Number, default: 0 },
  cleanlinessRating: { type: Number, default: 0 },
  layoutRating: { type: Number, default: 0 },
  spaciousnessRating: { type: Number, default: 0 },
  amenitiesRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  amenities: [String],
  wheelchairAccessible: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Toilet || mongoose.model('Toilet', ToiletSchema);
