const express = require('express');
const router = express.Router();
const {
  createVideo,
  getVideos
} = require('../controllers/videoController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/videoUpload');

// Public routes
router.get('/', getVideos);

// Protected routes
router.post('/', protect, upload.single('video'), createVideo);

module.exports = router;
