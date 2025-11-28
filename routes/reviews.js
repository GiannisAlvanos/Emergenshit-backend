// routes/reviews.js
const express = require('express');
const router = express.Router();
const reviewsController = require('../controllers/reviewsController');
const { auth } = require('../middleware/auth');

router.post('/', auth, reviewsController.create);
router.get('/toilet/:toiletId', reviewsController.listByToilet);
router.put('/:id', auth, reviewsController.update);
router.delete('/:id', auth, reviewsController.remove);
router.post('/:id/like', auth, reviewsController.like);
router.post('/:id/dislike', auth, reviewsController.dislike);


module.exports = router;
