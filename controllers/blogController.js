const Blog = require('../models/Blog');
const User = require('../models/User');

// Create new blog
const createBlog = async (req, res) => {
  try {
    const { title, description } = req.body;
    const authorId = req.user._id;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false, // ✅ Added
        message: 'Title is required'
      });
    }

    // Handle thumbnail upload
    let thumbnailPath = null;
    if (req.file) {
      thumbnailPath = `/uploads/blogs/${req.file.filename}`;
    }

    // Create blog
    const blog = await Blog.create({
      title,
      description: description || '',
      thumbnail: thumbnailPath,
      author: authorId
    });

    // Populate author details
    await blog.populate('author', 'username surname email avatar');

    res.status(201).json({
      success: true, // ✅ Added
      message: 'Blog created successfully',
      blog: {
        _id: blog._id,
        title: blog.title,
        description: blog.description,
        thumbnail: blog.thumbnail,
        author: blog.author,
        views: blog.views,
        likes: blog.likes,
        comments: blog.comments,
        createdAt: blog.createdAt,
        updatedAt: blog.updatedAt
      }
    });
  } catch (error) {
    console.error('Create blog error:', error);
    res.status(500).json({ 
      success: false, // ✅ Added
      message: 'Internal server error' 
    });
  }
};

// Get all blogs with pagination and filters
const getBlogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      author,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      tags
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (author) filter.author = author;

    // Add tags filter
    if (tags) {
      const tagsArray = tags.split(',').map(tag => tag.trim());
      filter.tags = { $in: tagsArray };
    }

    // Add search functionality
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    // Add date range filter
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      filter.createdAt = {
        $gte: start,
        $lte: end
      };
    } else if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(startDate);
      end.setHours(23, 59, 59, 999);
      
      filter.createdAt = {
        $gte: start,
        $lte: end
      };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Fetch blogs
    const blogs = await Blog.find(filter)
      .populate('author', 'username surname email avatar')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('title description content thumbnail author createdAt updatedAt')
      .lean();

    // Helper function to calculate time ago
    const getTimeAgo = (date) => {
      const now = new Date();
      const createdDate = new Date(date);
      const diffInMs = now - createdDate;
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      const diffInWeeks = Math.floor(diffInDays / 7);
      const diffInMonths = Math.floor(diffInDays / 30);
      const diffInYears = Math.floor(diffInDays / 365);

      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes} Min`;
      if (diffInHours < 24) return `${diffInHours} Hour${diffInHours > 1 ? 's' : ''}`;
      if (diffInDays < 7) return `${diffInDays} Day${diffInDays > 1 ? 's' : ''}`;
      if (diffInWeeks < 4) return `${diffInWeeks} Week${diffInWeeks > 1 ? 's' : ''}`;
      if (diffInMonths < 12) return `${diffInMonths} Month${diffInMonths > 1 ? 's' : ''}`;
      return `${diffInYears} Year${diffInYears > 1 ? 's' : ''}`;
    };

    // Add timeAgo field to each blog
    const blogsWithTime = blogs.map(blog => ({
      ...blog,
      time: getTimeAgo(blog.createdAt)
    }));

    // Get total count for pagination
    const total = await Blog.countDocuments(filter);

    // Prepare pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const currentPage = parseInt(page);

    // Send success response
    return res.status(200).json({
      success: true,
      message: 'Blogs fetched successfully',
      data: {
        blogs: blogsWithTime,
        pagination: {
          currentPage,
          totalPages,
          totalBlogs: total,
          limit: parseInt(limit),
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1
        }
      }
    });

  } catch (error) {
    console.error('Get blogs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch blogs',
      error: error.message
    });
  }
};
// Get single blog by ID
const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id)
      .populate('author', 'username surname email avatar')
      .populate('likes.user', 'username avatar')
      .populate('comments.user', 'username avatar');

    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    // Increment views
    blog.views += 1;
    await blog.save();

    res.json({ blog });
  } catch (error) {
    console.error('Get blog by ID error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update blog
const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const userId = req.user._id;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    // Check if user is the author
    if (blog.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this blog' });
    }

    // Handle thumbnail upload
    let thumbnailPath = blog.thumbnail;
    if (req.file) {
      thumbnailPath = `/uploads/blogs/${req.file.filename}`;
    }

    // Update fields
    blog.title = title !== undefined ? title : blog.title;
    blog.description = description !== undefined ? description : blog.description;
    blog.thumbnail = thumbnailPath;

    await blog.save();
    await blog.populate('author', 'username surname email avatar');

    res.json({
      message: 'Blog updated successfully',
      blog: {
        _id: blog._id,
        title: blog.title,
        description: blog.description,
        thumbnail: blog.thumbnail,
        author: blog.author,
        views: blog.views,
        likes: blog.likes,
        comments: blog.comments,
        createdAt: blog.createdAt,
        updatedAt: blog.updatedAt
      }
    });
  } catch (error) {
    console.error('Update blog error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete blog
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    // Check if user is the author
    if (blog.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this blog' });
    }

    await Blog.findByIdAndDelete(id);

    res.json({ message: 'Blog deleted successfully' });
  } catch (error) {
    console.error('Delete blog error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Like/Unlike blog
const toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    const existingLike = blog.likes.find(like => like.user.toString() === userId.toString());

    if (existingLike) {
      // Unlike
      blog.likes = blog.likes.filter(like => like.user.toString() !== userId.toString());
    } else {
      // Like
      blog.likes.push({ user: userId });
    }

    await blog.save();

    res.json({
      message: existingLike ? 'Blog unliked' : 'Blog liked',
      likesCount: blog.likes.length
    });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Add comment to blog
const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    blog.comments.push({
      user: userId,
      content
    });

    await blog.save();
    await blog.populate('comments.user', 'username avatar');

    res.status(201).json({
      message: 'Comment added successfully',
      comment: blog.comments[blog.comments.length - 1]
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get user's blogs
const getUserBlogs = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, status } = req.query;

    const filter = { author: userId };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const blogs = await Blog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Blog.countDocuments(filter);

    res.json({
      blogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalBlogs: total
      }
    });
  } catch (error) {
    console.error('Get user blogs error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  createBlog,
  getBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  toggleLike,
  addComment,
  getUserBlogs
};
