const Blog = require('../models/Blog');
const User = require('../models/User');

// Create new blog
const createBlog = async (req, res) => {
  try {
    const { title, content, description, tags, status } = req.body;
    const authorId = req.user._id;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        message: 'Title and content are required'
      });
    }

    // Handle tags - convert string to array if needed
    let tagsArray = [];
    if (tags) {
      if (typeof tags === 'string') {
        // If tags come as comma-separated string
        tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      } else if (Array.isArray(tags)) {
        tagsArray = tags;
      }
    }

    // Handle thumbnail upload
    let thumbnailPath = null;
    if (req.file) {
      thumbnailPath = `/uploads/blogs/${req.file.filename}`;
    }

    // Create blog
    const blog = await Blog.create({
      title,
      content,
      description: description || '',
      thumbnail: thumbnailPath,
      author: authorId,
      tags: tagsArray,
      status: status || 'draft'
    });

    // Populate author details
    await blog.populate('author', 'username surname email avatar');

    res.status(201).json({
      message: 'Blog created successfully',
      blog: {
        _id: blog._id,
        title: blog.title,
        content: blog.content,
        description: blog.description,
        thumbnail: blog.thumbnail,
        author: blog.author,
        tags: blog.tags,
        status: blog.status,
        views: blog.views,
        likes: blog.likes,
        comments: blog.comments,
        createdAt: blog.createdAt,
        updatedAt: blog.updatedAt
      }
    });
  } catch (error) {
    console.error('Create blog error:', error);
    res.status(500).json({ message: 'Internal server error' });
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
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (author) filter.author = author;

    // Add search functionality
    if (search) {
      filter.$text = { $search: search };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const blogs = await Blog.find(filter)
      .populate('author', 'username surname email avatar')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Blog.countDocuments(filter);

    res.json({
      blogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalBlogs: total,
        hasNextPage: parseInt(page) * parseInt(limit) < total,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get blogs error:', error);
    res.status(500).json({ message: 'Internal server error' });
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
    const { title, content, description, tags, status } = req.body;
    const userId = req.user._id;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    // Check if user is the author
    if (blog.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this blog' });
    }

    // Handle tags
    let tagsArray = blog.tags;
    if (tags !== undefined) {
      if (typeof tags === 'string') {
        tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      } else if (Array.isArray(tags)) {
        tagsArray = tags;
      }
    }

    // Handle thumbnail upload
    let thumbnailPath = blog.thumbnail;
    if (req.file) {
      thumbnailPath = `/uploads/blogs/${req.file.filename}`;
    }

    // Update fields
    blog.title = title !== undefined ? title : blog.title;
    blog.content = content !== undefined ? content : blog.content;
    blog.description = description !== undefined ? description : blog.description;
    blog.thumbnail = thumbnailPath;
    blog.tags = tagsArray;
    blog.status = status !== undefined ? status : blog.status;

    await blog.save();
    await blog.populate('author', 'username surname email avatar');

    res.json({
      message: 'Blog updated successfully',
      blog: {
        _id: blog._id,
        title: blog.title,
        content: blog.content,
        description: blog.description,
        thumbnail: blog.thumbnail,
        author: blog.author,
        tags: blog.tags,
        status: blog.status,
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
