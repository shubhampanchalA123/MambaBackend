const mongoose = require('mongoose');

const blacklistedTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 172800 // 48 hours in seconds
  }
});

module.exports = mongoose.model('BlacklistedToken', blacklistedTokenSchema);
