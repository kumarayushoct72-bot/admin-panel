const mongoose = require('mongoose');

// Define the admin schema
const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Admin'
  },
  email: {
    type: String,
    unique: true,
    sparse: true
  },
  mobile: {
    type: String,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    required: false
  },
  picture: {
    type: String, // Assuming picture will be stored as a URL
    required: false // Not required, adjust as needed
  },
  bio: {
    type: String,
    required: false // Not required, adjust as needed
  },
  lastLoginAt: Date,
  lastLoginLocation: {
    latitude: Number,
    longitude: Number,
    accuracy: Number
  },
  loginHistory: [{
    loggedInAt: { type: Date, default: Date.now },
    location: {
      latitude: Number,
      longitude: Number,
      accuracy: Number
    },
    ipAddress: String,
    userAgent: String
  }]
});

// Create a model based on the schema
const Admin = mongoose.model('Admin', adminSchema);

// Export the model to use it in other parts of the application
module.exports = Admin;
