const express = require('express');
const router = express.Router();
const { getUsersByRole, deleteUser } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// User management routes
router.get('/allUser', protect, getUsersByRole);
router.delete('/delete/:userId', protect, deleteUser);

module.exports = router;
