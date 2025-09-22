const express = require('express');
const router = express.Router();
const { addProduct, deleteProduct } = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');

// POST /api/products - Add a new product (protected)
router.post('/addproduct', protect, addProduct);

// DELETE /api/products/:id - Delete a product by ID (protected)
router.delete('/:id', protect, deleteProduct);

module.exports = router;
