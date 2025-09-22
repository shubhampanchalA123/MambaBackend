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
    const { username, surname, email, password, userRole, countryCode, mobileNumber, avatar } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate OTP
    const otp = otpGenerator.generate(6, {
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
      avatar
    });

    res.status(201).json({
      message: 'OTP sent to your email. Please verify to complete registration.',
      email: user.email,
      userId: user._id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find the OTP
    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Check if OTP is expired
    if (Date.now() > otpRecord.createdAt.getTime() + 5 * 60 * 1000) {
      await OTP.deleteOne({ email });
      return res.status(400).json({ message: 'OTP has expired' });
    }

    // Update user as verified
    await User.findOneAndUpdate({ email }, { isVerified: true });

    // Delete used OTP
    await OTP.deleteOne({ email });

    // Get user and generate token
    const user = await User.findOne({ email });
    const token = generateToken(user._id);

    res.json({
      message: 'Email verified successfully',
      token,
      user: {
        _id: user._id,
        username: user.username,
        surname: user.surname,
        email: user.email,
        role: user.role,
        userType: user.userType,
        isVerified: user.isVerified,
        countryCode: user.countryCode,
        mobileNumber: user.mobileNumber,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Resend OTP
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'User already verified' });
    }

    // Generate new OTP
    const otp = otpGenerator.generate(6, {
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

    res.json({ message: 'New OTP sent to your email' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Login user
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(400).json({ message: 'Please verify your email first' });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        username: user.username,
        surname: user.surname,
        email: user.email,
        role: user.role,
        userType: user.userType,
        isVerified: user.isVerified,
        countryCode: user.countryCode,
        mobileNumber: user.mobileNumber,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Forgot Password - Send OTP for password reset
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found with this email address' });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(400).json({ message: 'Please verify your email first' });
    }

    // Generate OTP for password reset
    const otp = otpGenerator.generate(6, {
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

    res.json({
      message: 'Password reset OTP sent to your email',
      email: user.email
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Reset Password - Verify OTP and update password
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Validate input
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Find the OTP
    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Check if OTP is for password reset
    if (otpRecord.purpose !== 'password_reset') {
      return res.status(400).json({ message: 'Invalid OTP for password reset' });
    }

    // Check if OTP is expired (5 minutes)
    if (Date.now() > otpRecord.createdAt.getTime() + 5 * 60 * 1000) {
      await OTP.deleteOne({ email });
      return res.status(400).json({ message: 'OTP has expired' });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update password
    user.password = newPassword; // The pre-save hook will hash it
    await user.save();

    // Delete used OTP
    await OTP.deleteOne({ email });

    // Generate new token
    const token = generateToken(user._id);

    res.json({
      message: 'Password reset successful',
      token,
      user: {
        _id: user._id,
        username: user.username,
        surname: user.surname,
        email: user.email,
        role: user.role,
        userType: user.userType,
        isVerified: user.isVerified,
        countryCode: user.countryCode,
        mobileNumber: user.mobileNumber,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        _id: user._id,
        username: user.username,
        surname: user.surname,
        email: user.email,
        role: user.role,
        userType: user.userType,
        isVerified: user.isVerified,
        countryCode: user.countryCode,
        mobileNumber: user.mobileNumber,
        avatar: user.avatar || null, // Ensure avatar is always included, even if null
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
  resetPassword,
  getUserProfile,
  logoutUser
};
