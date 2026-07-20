const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },  // Plain text as per request
  role: { type: String, enum: ['Admin', 'Employee'], required: true },
  position: String,
  positionId: String,
  experience: String,
  email: String,
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('User', userSchema);