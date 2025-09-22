const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['verification', 'password_reset'],
    default: 'verification'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 // 5 minutes me automatically delete ho jayega
  }
});

module.exports = mongoose.model('OTP', OTPSchema);
