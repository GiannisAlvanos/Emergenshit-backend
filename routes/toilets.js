// routes/toilets.js
const express = require('express');
const router = express.Router();
const toiletsController = require('../controllers/toiletsController');
const { auth } = require('../middleware/auth');

router.get('/', toiletsController.list);
router.get('/:id', toiletsController.getById);
router.post('/', auth, toiletsController.create); // authenticated
router.put('/:id', auth, toiletsController.update);
router.delete('/:id', auth, toiletsController.remove);

module.exports = router;
