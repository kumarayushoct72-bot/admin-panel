require('dotenv').config();
const express = require('express');
require('dotenv').config();
const { connectToDatabase } = require('./data/database');
const routes = require('./routes/routes'); // Import your routes
const cookieParser = require('cookie-parser'); // Add cookie-parser
const path = require('path');

const app = express();
 
// Connect to MongoDB
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'front-end')));

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

//  Middleware to parse incoming request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.use(cookieParser()); // Use cookie-parser middleware

// Routes
 app.use('/', routes); // Mount your routes

// Start the server
async function startServer() {
  try {
    await connectToDatabase();
  } catch (error) {
    console.error('MongoDB unavailable. Starting server without database:', error.message);
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Application startup failed:', error.message);
});