const multer = require('multer');
const path = require('path');

// Configure storage for blog images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/blogs/'); // Store in uploads/blogs/ directory
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'blog-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure multer for blog uploads
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for blog images
  },
  fileFilter: fileFilter
});

// Export single file upload middleware for blog thumbnail
module.exports = upload;
