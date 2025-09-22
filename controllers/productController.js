const Product = require('../models/Product');

// Add a new product
const addProduct = async (req, res) => {
  try {
    const { name, description, price } = req.body;

    // Basic validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Valid product name is required' });
    }

    if (!price || typeof price !== 'number' || price < 0) {
      return res.status(400).json({ message: 'Valid price is required and must be non-negative' });
    }

    // Create product
    const product = await Product.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      price,
      user: req.user._id
    });

    res.status(201).json({
      message: 'Product added successfully',
      product: {
        _id: product._id,
        name: product.name,
        description: product.description,
        price: product.price,
        user: product.user,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }
    });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ message: 'Server error while adding product' });
  }
};

// Delete a product
const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    // Find the product
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if the user owns the product
    if (product.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }

    // Delete the product
    await Product.findByIdAndDelete(productId);

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    res.status(500).json({ message: 'Server error while deleting product' });
  }
};

module.exports = {
  addProduct,
  deleteProduct
};
