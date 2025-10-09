const User = require('../models/User');
const OTP = require('../models/OTP');
const BlacklistedToken = require('../models/BlacklistedToken');
const jwt = require('jsonwebtoken');
const otpGenerator = require('otp-generator');
const { sendOTPEmail, sendPasswordResetEmail } = require('../utils/mailer');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '48h',
  });
};

// Register new user (with OTP)
const registerUser = async (req, res) => {
  try {
    const { username, surname, email, password, userRole, countryCode, mobileNumber, avatar, dateOfBirth, gender } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      if (userExists.isVerified) {
        return res.status(400).json({
          statusCode: 400,
          success: false,
          message: 'User already exists',
          data: null
        });
      } else {
        // Delete unverified user and any existing OTP
        await User.deleteOne({ email });
        await OTP.deleteMany({ email });
      }
    }

    // Generate OTP
    const otp = otpGenerator.generate(4, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false
    });

    // Save OTP to database
    await OTP.create({ email, otp });

    // Send OTP email
    await sendOTPEmail(email, otp);

    // Create user but mark as unverified
    const user = await User.create({
      username,
      surname,
      email,
      password,
      userRole,
      isVerified: false,
      countryCode,
      mobileNumber,
      avatar,
      dateOfBirth,
      gender
    });

    return res.status(201).json({
      statusCode: 201,
      success: true,
      message: 'OTP sent to your email. Please verify to complete registration.',
      data: {
        userId: user._id,
        email: user.email
      }
    });
  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};
 

// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find the OTP
    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Invalid OTP',
        data: null
      });
    }

    // Check if OTP is expired
    if (Date.now() > otpRecord.createdAt.getTime() + 5 * 60 * 1000) {
      await OTP.deleteOne({ email });
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'OTP has expired',
        data: null
      });
    }

    // Update user as verified
    await User.findOneAndUpdate({ email }, { isVerified: true });

    // Delete used OTP
    await OTP.deleteOne({ email });

    // Get user and generate token
    const user = await User.findOne({ email });
    const token = generateToken(user._id);

    return res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Email verified successfully',
      data: {
        token,
        user: {
          _id: user._id,
          username: user.username,
          surname: user.surname,
          email: user.email,
          userRole: user.userRole,
          isVerified: user.isVerified,
          isActive: user.isActive,
          countryCode: user.countryCode,
          mobileNumber: user.mobileNumber,
          avatar: user.avatar,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'OTP verification failed',
      error: error.message
    });
  }
};


// Resend OTP
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'User not found',
        data: null
      });
    }

    // if (user.isVerified) {
    //   return res.status(400).json({
    //     statusCode: 400,
    //     success: false,
    //     message: 'User already verified',
    //     data: null
    //   });
    // }

    // Generate new OTP
    const otp = otpGenerator.generate(4, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false
    });

    // Delete old OTP and save new one
    await OTP.deleteMany({ email });
    await OTP.create({ email, otp });

    // Send new OTP email
    await sendOTPEmail(email, otp);

    return res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'New OTP sent to your email',
      data: {
        email: user.email
      }
    });
  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Failed to resend OTP',
      error: error.message
    });
  }
};

 
// Login user
const loginUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Invalid email or password',
        data: null
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Please verify your email first',
        data: null
      });
    }

    // Check if role matches
    if (user.userRole !== role) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Invalid role for this user',
        data: null
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Invalid email or password',
        data: null
      });
    }

    // Generate token
    const token = generateToken(user._id);

    return res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          _id: user._id,
          username: user.username,
          surname: user.surname,
          email: user.email,
          userRole: user.userRole,
          isVerified: user.isVerified,
          isActive: user.isActive,
          countryCode: user.countryCode,
          mobileNumber: user.mobileNumber,
          avatar: user.avatar,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};


// Forgot Password - Send OTP for password reset
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'User not found with this email address',
        data: null
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Please verify your email first',
        data: null
      });
    }

    // Generate OTP for password reset
    const otp = otpGenerator.generate(4, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false
    });

    // Delete any existing OTP for this email and save new one
    await OTP.deleteMany({ email });
    await OTP.create({
      email,
      otp,
      purpose: 'password_reset' // Mark this OTP for password reset
    });

    // Send password reset email
    await sendPasswordResetEmail(email, otp);

    return res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Password reset OTP sent to your email',
      data: {
        email: user.email
      }
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


// Verify Password Reset OTP (without deleting it)
const verifyPasswordResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find the OTP
    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Invalid OTP',
        data: null
      });
    }

    // Check if OTP is for password reset
    if (otpRecord.purpose !== 'password_reset') {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Invalid OTP for password reset',
        data: null
      });
    }

    // Check if OTP is expired (5 minutes)
    if (Date.now() > otpRecord.createdAt.getTime() + 5 * 60 * 1000) {
      await OTP.deleteOne({ email });
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'OTP has expired',
        data: null
      });
    }

    return res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'OTP verified successfully',
      data: {
        email: email
      }
    });
  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'OTP verification failed',
      error: error.message
    });
  }
};

// Reset Password - Verify OTP and update password
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Validate input
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Password must be at least 6 characters long',
        data: null
      });
    }

    // Find the OTP
    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Invalid OTP',
        data: null
      });
    }

    // Check if OTP is for password reset
    if (otpRecord.purpose !== 'password_reset') {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Invalid OTP for password reset',
        data: null
      });
    }

    // Check if OTP is expired (5 minutes)
    if (Date.now() > otpRecord.createdAt.getTime() + 5 * 60 * 1000) {
      await OTP.deleteOne({ email });
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'OTP has expired',
        data: null
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'User not found',
        data: null
      });
    }

    // Update password
    user.password = newPassword; // pre-save hook will hash
    await user.save();

    // Delete used OTP
    await OTP.deleteOne({ email });

    // Generate new token
    const token = generateToken(user._id);

    return res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Password reset successful',
      data: {
        token,
        user: {
          _id: user._id,
          username: user.username,
          surname: user.surname,
          email: user.email,
          userRole: user.userRole,
          isVerified: user.isVerified,
          countryCode: user.countryCode,
          mobileNumber: user.mobileNumber,
          avatar: user.avatar,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender
        }
      }
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        surname: user.surname,
        email: user.email,
        userRole: user.userRole,
        isVerified: user.isVerified,
        isActive: user.isActive,
        countryCode: user.countryCode,
        mobileNumber: user.mobileNumber,
        avatar: user.avatar || null,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { username, surname, countryCode, mobileNumber, dateOfBirth } = req.body;

    // Find the user first
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Mobile number validation
    if (mobileNumber && !/^\d{10}$/.test(mobileNumber)) {
      return res.status(400).json({ success: false, message: 'Mobile number must be 10 digits' });
    }

    // Country code validation
    if (countryCode && !/^\+\d{1,4}$/.test(countryCode)) {
      return res.status(400).json({ success: false, message: 'Country code must be in format +XX (e.g., +91, +1)' });
    }

    // Prepare update fields - ONLY allowed fields
    const updateFields = {};
    if (username !== undefined) updateFields.username = username;
    if (surname !== undefined) updateFields.surname = surname;
    if (countryCode !== undefined) updateFields.countryCode = countryCode;
    if (mobileNumber !== undefined) updateFields.mobileNumber = mobileNumber;
    if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth;

    // Avatar update (optional - agar chahiye to rakho, nahi to remove kar do)
    if (req.file) {
      updateFields.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(userId, updateFields, {
      new: true,
      runValidators: true
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        surname: updatedUser.surname,
        email: updatedUser.email,
        userRole: updatedUser.userRole,
        isVerified: updatedUser.isVerified,
        isActive: updatedUser.isActive,
        countryCode: updatedUser.countryCode,
        mobileNumber: updatedUser.mobileNumber,
        avatar: updatedUser.avatar || null,
        dateOfBirth: updatedUser.dateOfBirth,
        gender: updatedUser.gender,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


const logoutUser = async (req, res) => {
  try {
    const token = req.token; // token extracted in authMiddleware

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Add token to blacklist
    const blacklistedToken = new BlacklistedToken({ token });
    await blacklistedToken.save();
    res.json({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during logout' });
  }
};





module.exports = {
  registerUser,
  verifyOTP,
  resendOTP,
  loginUser,
  forgotPassword,
  verifyPasswordResetOTP,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  logoutUser
};
