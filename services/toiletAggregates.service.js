// services/toiletAggregates.service.js
const Review = require('../models/Review');
const Toilet = require('../models/Toilet');

/**
 * Recomputes and updates aggregated ratings for a toilet (MongoDB mode only)
 */
const updateMongooseAggregates = async (toiletId) => {
  try {
    const stats = await Review.aggregate([
      { $match: { toiletId, isDeleted: false } },
      {
        $group: {
          _id: '$toiletId',
          reviewCount: { $sum: 1 },
          avgOverall: { $avg: '$overallRating' },
          avgClean: { $avg: '$cleanlinessRating' },
          avgLayout: { $avg: '$layoutRating' },
          avgSpacious: { $avg: '$spaciousnessRating' },
          avgAmenities: { $avg: '$amenitiesRating' },
        }
      }
    ]);

    const payload = stats.length > 0
      ? {
          reviewCount: stats[0].reviewCount,
          averageRating: +stats[0].avgOverall.toFixed(2),
          cleanlinessRating: +stats[0].avgClean.toFixed(2),
          layoutRating: +stats[0].avgLayout.toFixed(2),
          spaciousnessRating: +stats[0].avgSpacious.toFixed(2),
          amenitiesRating: +stats[0].avgAmenities.toFixed(2),
          updatedAt: new Date()
        }
      : {
          reviewCount: 0,
          averageRating: 0,
          cleanlinessRating: 0,
          layoutRating: 0,
          spaciousnessRating: 0,
          amenitiesRating: 0,
          updatedAt: new Date()
        };

    await Toilet.updateOne({ toiletId }, payload);

  } catch (error) {
    console.error('Error updating Mongoose Aggregates:', error);
  }
};

module.exports = {
  updateMongooseAggregates
};
