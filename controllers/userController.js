const User = require('../models/User');

// Get users by role (players or coaches)
const getUsersByRole = async (req, res) => {
  try {
    const { role, isActive, searchText, page = 1, limit = 10 } = req.query;

    // Validate role
    if (!role || !['player', 'coach', 'parent'].includes(role.toLowerCase())) {
      return res.status(400).json({ message: 'Invalid or missing role. Must be player, coach or parent' });
    }

    // Build query
    const query = {
      userRole: new RegExp(`^${role}$`, "i") // case-insensitive match
    };

    // Apply isActive filter only if explicitly passed
    if (isActive !== undefined) {
      query.isActive = isActive == 'true';
    }

    // Add search functionality
    if (searchText) {
      // Split search text by spaces to handle full names
      const searchWords = searchText.trim().split(/\s+/);

      // Create search conditions for each word
      const searchConditions = [];

      searchWords.forEach(word => {
        const wordRegex = new RegExp(word, 'i');
        searchConditions.push(
          { username: { $regex: wordRegex } },
          { surname: { $regex: wordRegex } },
          { email: { $regex: wordRegex } }
        );
      });

      // Add search conditions to query
      if (searchConditions.length > 0) {
        query.$or = searchConditions;
      }
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Fields to return
    const fields = [
      '_id',
      'username',
      'surname',
      'email',
      'userRole',
      'isVerified',
      'isActive',
      'countryCode',
      'mobileNumber',
      'avatar',
      'dateOfBirth',
      'gender',
      'createdAt'
    ];

    // Fetch users
    const users = await User.find(query)
      .select(fields.join(' '))
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Total count for pagination
    const totalUsers = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalUsers / limitNum),
          totalUsers,
          hasNext: pageNum * limitNum < totalUsers,
          hasPrev: pageNum > 1
        }
      }
    });
  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete user (only coaches and admins can delete)
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user; // From auth middleware

    // Check if current user is coach or admin
    if (!currentUser || !['coach', 'admin'].includes(currentUser.userRole.toLowerCase())) {
      return res.status(403).json({
        message: 'Access denied. Only coaches and admins can delete users.'
      });
    }

    // Find the user to delete
    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent users from deleting themselves
    if (currentUser._id.toString() === userId) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: `User ${userToDelete.username} ${userToDelete.surname} deleted successfully`
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getUsersByRole,
  deleteUser
};
