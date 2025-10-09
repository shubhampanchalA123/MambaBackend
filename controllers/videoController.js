const Video = require('../models/Video');
const User = require('../models/User');
const { videoDuration } = require("@numairawan/video-duration");

const path = require('path');

// Helper function to format duration in seconds to readable format
const formatDuration = (seconds) => {
  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    if (remainingSeconds === 0) {
      return `${minutes} min`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')} min`;
    }
  }
};

// Create new video
const createVideo = async (req, res) => {
  try {
    const { title, description } = req.body;
    const authorId = req.user._id;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Video file is required'
      });
    }

    // Handle video upload
    const videoPath = `/uploads/videos/${req.file.filename}`;

    // Get video duration
    const fullVideoPath = path.join(__dirname, '..', 'uploads', 'videos', req.file.filename);
    console.log('Full video path:', fullVideoPath);
    let duration = 0;
    try {
      const durationData = await videoDuration(fullVideoPath);

      duration = durationData.seconds || 0;
      console.log('Extracted video duration:', duration);
    } catch (error) {
      console.error('Error getting video duration:', error);
      // Continue without duration if extraction fails
    }

    // Create video
    const video = await Video.create({
      title,
      description: description || '',
      video: videoPath,
      duration,
      author: authorId
    });

    // Populate author details
    await video.populate('author', 'username surname email avatar');

    res.status(201).json({
      success: true,
      message: 'Video created successfully',
      video: {
        _id: video._id,
        title: video.title,
        description: video.description,
        video: video.video,
        duration: video.duration,
        author: video.author,
        views: video.views,
        likes: video.likes,
        comments: video.comments,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt
      }
    });
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all videos with pagination and filters
const getVideos = async (req, res) => {
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
        { description: { $regex: search, $options: 'i' } }
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

    // Fetch videos
    const videos = await Video.find(filter)
      .populate('author', 'username surname email avatar')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('title description video duration author createdAt updatedAt')
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

    // Add timeAgo field and format duration, remove duration field
    const videosWithTime = videos.map(video => {
      const { duration, ...videoWithoutDuration } = video;
      return {
        ...videoWithoutDuration,
        time: getTimeAgo(video.createdAt),
        formattedDuration: formatDuration(duration)
      };
    });

    // Get total count for pagination
    const total = await Video.countDocuments(filter);

    // Prepare pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const currentPage = parseInt(page);

    // Send success response
    return res.status(200).json({
      success: true,
      message: 'Videos fetched successfully',
      data: {
        videos: videosWithTime,
        pagination: {
          currentPage,
          totalPages,
          totalVideos: total,
          limit: parseInt(limit),
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1
        }
      }
    });

  } catch (error) {
    console.error('Get videos error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch videos',
      error: error.message
    });
  }
};

module.exports = {
  createVideo,
  getVideos
};