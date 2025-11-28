// controllers/reviewsController.js
const { v4: uuid } = require('uuid');
const Review = require('../models/Review');
const Toilet = require('../models/Toilet');

const MOCK = global.MOCK;

const recomputeToiletAggregates = (toiletId) => {
  if (!MOCK) return;
  const toilet = MOCK.toilets.find(t => t.toiletId === toiletId);
  if (!toilet) return;
  const reviews = MOCK.reviews.filter(r => r.toiletId === toiletId && !r.isDeleted);
  if (reviews.length === 0) {
    toilet.averageRating = 0;
    toilet.cleanlinessRating = 0;
    toilet.layoutRating = 0;
    toilet.spaciousnessRating = 0;
    toilet.amenitiesRating = 0;
    toilet.reviewCount = 0;
    return;
  }
  const agg = { cleanliness:0, layout:0, spaciousness:0, amenities:0, overall:0 };
  reviews.forEach(r => {
    agg.cleanliness += (r.cleanlinessRating || 0);
    agg.layout += (r.layoutRating || 0);
    agg.spaciousness += (r.spaciousnessRating || 0);
    agg.amenities += (r.amenitiesRating || 0);
    agg.overall += (r.overallRating || 0);
  });
  toilet.cleanlinessRating = +(agg.cleanliness / reviews.length).toFixed(2);
  toilet.layoutRating = +(agg.layout / reviews.length).toFixed(2);
  toilet.spaciousnessRating = +(agg.spaciousness / reviews.length).toFixed(2);
  toilet.amenitiesRating = +(agg.amenities / reviews.length).toFixed(2);
  toilet.averageRating = +(agg.overall / reviews.length).toFixed(2);
  toilet.reviewCount = reviews.length;
  toilet.updatedAt = new Date().toISOString();
};

exports.create = async (req, res, next) => {
  try {
    const { toiletId, overallRating, cleanlinessRating, layoutRating, spaciousnessRating, amenitiesRating, comment, photos } = req.body;
    if (!toiletId || overallRating == null) return res.status(400).json({ success:false, message:'toiletId and overallRating required' });

    // prevent duplicate rating by same user on same toilet
    if (process.env.MONGODB_URI) {
      const existing = await Review.findOne({ toiletId, userId: req.user.userId, isDeleted: false });
      if (existing) return res.status(409).json({ success:false, message:'You have already rated this toilet' });
      const review = await Review.create({ reviewId: uuid(), toiletId, userId: req.user.userId, overallRating, cleanlinessRating, layoutRating, spaciousnessRating, amenitiesRating, comment, photos });
      // TODO: recompute aggregates for toilet in db
      return res.status(201).json({ success:true, data: review });
    }

    const existing = MOCK.reviews.find(r => r.toiletId === toiletId && r.userId === req.user.userId && !r.isDeleted);
    if (existing) return res.status(409).json({ success:false, message:'You have already rated this toilet' });

    const review = {
      reviewId: uuid(),
      toiletId,
      userId: req.user.userId,
      overallRating,
      cleanlinessRating,
      layoutRating,
      spaciousnessRating,
      amenitiesRating,
      comment: comment || '',
      photos: photos || [],
      likes: 0,
      dislikes: 0,
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false
    };
    MOCK.reviews.push(review);
    recomputeToiletAggregates(toiletId);
    res.status(201).json({ success:true, data: review });
  } catch (err) { next(err); }
};

exports.listByToilet = async (req, res, next) => {
  try {
    const toiletId = req.params.toiletId;
    if (process.env.MONGODB_URI) {
      const reviews = await Review.find({ toiletId, isDeleted: false }).limit(200);
      return res.json({ success:true, data: reviews });
    }
    const list = MOCK.reviews.filter(r => r.toiletId === toiletId && !r.isDeleted);
    res.json({ success:true, data: list });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const id = req.params.id;
    const payload = req.body;
    if (process.env.MONGODB_URI) {
      const review = await Review.findOne({ reviewId: id });
      if (!review) return res.status(404).json({ success:false, message:'Not found' });
      if (review.userId !== req.user.userId && req.user.role !== 'ADMIN') return res.status(403).json({ success:false, message:'Forbidden' });
      Object.assign(review, payload, { updatedAt: new Date() });
      await review.save();
      return res.json({ success:true, data: review });
    }
    const idx = MOCK.reviews.findIndex(r => r.reviewId === id);
    if (idx === -1) return res.status(404).json({ success:false, message:'Not found' });
    const review = MOCK.reviews[idx];
    if (review.userId !== req.user.userId && req.user.role !== 'ADMIN') return res.status(403).json({ success:false, message:'Forbidden' });
    MOCK.reviews[idx] = { ...review, ...payload, updatedAt: new Date().toISOString() };
    recomputeToiletAggregates(MOCK.reviews[idx].toiletId);
    res.json({ success:true, data: MOCK.reviews[idx] });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (process.env.MONGODB_URI) {
      const review = await Review.findOne({ reviewId: id });
      if (!review) return res.status(404).json({ success:false, message:'Not found' });
      if (review.userId !== req.user.userId && req.user.role !== 'ADMIN') return res.status(403).json({ success:false, message:'Forbidden' });
      review.isDeleted = true;
      await review.save();
      return res.json({ success:true, message:'Deleted' });
    }
    const idx = MOCK.reviews.findIndex(r => r.reviewId === id);
    if (idx === -1) return res.status(404).json({ success:false, message:'Not found' });
    const review = MOCK.reviews[idx];
    if (review.userId !== req.user.userId && req.user.role !== 'ADMIN') return res.status(403).json({ success:false, message:'Forbidden' });
    MOCK.reviews[idx].isDeleted = true;
    recomputeToiletAggregates(MOCK.reviews[idx].toiletId);
    res.json({ success:true, message:'Deleted' });
  } catch (err) { next(err); }
};
// -----------------------------------------------
// LIKE / DISLIKE
// -----------------------------------------------
exports.like = async (req, res, next) => {
  try {
    const reviewId = req.params.id;
    const userId = req.user.userId;

    if (process.env.MONGODB_URI) {
      const rev = await Review.findOne({ reviewId, isDeleted: false });
      if (!rev) return res.status(404).json({ success: false, message: "Not found" });

      // ensure arrays
      rev.likedBy = rev.likedBy || [];
      rev.dislikedBy = rev.dislikedBy || [];

      // remove possible dislike
      rev.dislikedBy = rev.dislikedBy.filter(u => u !== userId);

      // add like only if not already liked
      if (!rev.likedBy.includes(userId)) {
        rev.likedBy.push(userId);
      }

      rev.likes = rev.likedBy.length;
      rev.dislikes = rev.dislikedBy.length;

      await rev.save();
      return res.json({ success: true, data: rev });
    }

    // MOCK MODE
    const rev = MOCK.reviews.find(r => r.reviewId === reviewId && !r.isDeleted);
    if (!rev) return res.status(404).json({ success:false, message:'Not found' });

    rev.likedBy = rev.likedBy || [];
    rev.dislikedBy = rev.dislikedBy || [];

    rev.dislikedBy = rev.dislikedBy.filter(u => u !== userId);

    if (!rev.likedBy.includes(userId)) {
      rev.likedBy.push(userId);
    }

    rev.likes = rev.likedBy.length;
    rev.dislikes = rev.dislikedBy.length;
    rev.updatedAt = new Date().toISOString();

    return res.json({ success:true, data: rev });

  } catch (err) { next(err); }
};


exports.dislike = async (req, res, next) => {
  try {
    const reviewId = req.params.id;
    const userId = req.user.userId;

    if (process.env.MONGODB_URI) {
      const rev = await Review.findOne({ reviewId, isDeleted: false });
      if (!rev) return res.status(404).json({ success: false, message: "Not found" });

      rev.likedBy = rev.likedBy || [];
      rev.dislikedBy = rev.dislikedBy || [];

      // remove like if exists
      rev.likedBy = rev.likedBy.filter(u => u !== userId);

      // add dislike
      if (!rev.dislikedBy.includes(userId)) {
        rev.dislikedBy.push(userId);
      }

      rev.likes = rev.likedBy.length;
      rev.dislikes = rev.dislikedBy.length;

      await rev.save();
      return res.json({ success: true, data: rev });
    }

    // MOCK MODE
    const rev = MOCK.reviews.find(r => r.reviewId === reviewId && !r.isDeleted);
    if (!rev) return res.status(404).json({ success:false, message:'Not found' });

    rev.likedBy = rev.likedBy || [];
    rev.dislikedBy = rev.dislikedBy || [];

    rev.likedBy = rev.likedBy.filter(u => u !== userId);

    if (!rev.dislikedBy.includes(userId)) {
      rev.dislikedBy.push(userId);
    }

    rev.likes = rev.likedBy.length;
    rev.dislikes = rev.dislikedBy.length;
    rev.updatedAt = new Date().toISOString();

    return res.json({ success:true, data: rev });

  } catch (err) { next(err); }
};
