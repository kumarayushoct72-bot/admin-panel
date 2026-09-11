const mongoose = require('mongoose');
const Admin = require('../model/admin');

// MongoDB connection URI
const uri = process.env.MONGODB_URI || 'mongodb+srv://himanshuraj0706_db_user:1Jwbxl5ldf0jj9Is@cluster0.w2mxd79.mongodb.net/?appName=Cluster0hhbb';

// Connect to MongoDB using Mongoose
async function connectToDatabase() {
  try {
    if (uri.includes('@cluster.mongodb.net')) {
      throw new Error('MONGODB_URI is still using the placeholder cluster.mongodb.net host.');
    }

    await mongoose.connect(uri);
    console.log('Connected successfully to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    throw error;
  }
}

async function addAdmin(name, email, password, picture, bio) {
  try {
    // Create a new admin document
    const newAdmin = new Admin({
      name: name,
      email: email,
      password: password,
      picture: picture,
      bio: bio
    });

    // Save the new admin document to the database
    await newAdmin.save();
    console.log('Admin saved successfully');
  } catch (err) {
    console.error('Error saving admin:', err);
    throw err; // Propagate the error
  }
}



module.exports = { connectToDatabase, addAdmin };

 