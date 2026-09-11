const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const twilio = require('twilio');
const { OAuth2Client } = require('google-auth-library');
const Admin = require('../model/admin');
//const authenticateToken = require('../middleware/auth'); // Ensure this path is correct
const authenticateToken = require('../middleware/auth'); // Ensure this path is correct
const upload = require('../middleware/upload'); // Adjust path as needed

const jwtSecret = process.env.JWT_SECRET || "4715aed3c946f7b0a38e6b534a9583628d84e96d10fbc04700770d572af3dce43625dd";
const otpStore = new Map();
const otpLifetimeMs = 5 * 60 * 1000;
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

async function verifyGoogleToken(idToken) {
  if (!googleClient) {
    throw new Error('Google login is not configured. Set GOOGLE_CLIENT_ID in your .env file.');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    throw new Error('Google account email not available.');
  }

  return {
    email: payload.email,
    name: payload.name || payload.given_name || 'Google User',
    picture: payload.picture || '',
    emailVerified: payload.email_verified === true
  };
}

function getSmsClient() {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();

  if (!/^AC[a-zA-Z0-9]{32}$/.test(accountSid) || !authToken || /^(real_|your_|replace|enter)/i.test(authToken)) {
    return null;
  }

  return twilio(accountSid, authToken);
}

async function sendOtpSms(mobile, otp) {
  const client = getSmsClient();
  const from = String(process.env.TWILIO_PHONE_NUMBER || '').trim();
  const messagingServiceSid = String(process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim();

  if (!client || (!from && !messagingServiceSid)) {
    throw new Error('Twilio is not configured. Add a real TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and sender number to .env.');
  }

  if (!messagingServiceSid && !/^\+[1-9]\d{7,14}$/.test(from)) {
    throw new Error('TWILIO_PHONE_NUMBER must be a valid E.164 number, such as +14155552671.');
  }

  if (messagingServiceSid && !/^MG[a-zA-Z0-9]{32}$/.test(messagingServiceSid)) {
    throw new Error('TWILIO_MESSAGING_SERVICE_SID must be a valid MG... SID.');
  }

  const message = {
    body: `Your Makeup Wala admin OTP is ${otp}. It expires in 5 minutes.`,
    to: `+91${mobile}`
  };

  if (messagingServiceSid) {
    message.messagingServiceSid = messagingServiceSid;
  } else {
    message.from = from;
  }

  await client.messages.create(message);
}

function isSmsConfigured() {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  const from = String(process.env.TWILIO_PHONE_NUMBER || '').trim();
  const messagingServiceSid = String(process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim();

  return /^AC[a-zA-Z0-9]{32}$/.test(accountSid)
    && authToken
    && !/^(real_|your_|replace|enter)/i.test(authToken)
    && (messagingServiceSid || /^\+[1-9]\d{7,14}$/.test(from));
}

function normalizeMobile(mobile) {
  return String(mobile || '').replace(/\D/g, '').slice(-10);
}

function isValidMobile(mobile) {
  return /^[6-9]\d{9}$/.test(mobile);
}

function isConfiguredAdmin(mobile) {
  const configuredAdmin = String(process.env.ADMIN_PHONE || '').trim();
  const isPlaceholder = !configuredAdmin || /^(your|replace|enter).*number/i.test(configuredAdmin);

  if (isPlaceholder) {
    return true;
  }

  return normalizeMobile(configuredAdmin) === mobile;
}

// Display login form
router.get('/', (req, res) => {
    res.render('home'); // Assuming login.ejs is in your views folder
});


router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
  
    try {
      // Check if email already exists in the database
      const existingAdmin = await Admin.findOne({ email: email });
      if (existingAdmin) {
        return res.render('register', { errorMessage: 'Email already exists' });
      }
  
      // Validate the password
      const passwordRegex = /^(?=.[a-z])(?=.[A-Z]).{6,}$/;
      if (!passwordRegex.test(password)) {
        return res.render('register', { errorMessage: 'Password must be at least 6 characters long and contain at least one uppercase and one lowercase letter' });
      }
  
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Create a new admin document
      const newAdmin = new Admin({
        name: name,
        email: email,
        password: hashedPassword
      });
  
      // Save the new admin document to the database
      await newAdmin.save();
      console.log('Admin registered successfully');
  
      // Redirect to a success page or login page
      res.redirect('/login');
    } catch (error) {
      console.error('Error registering admin:', error);
      res.render('register', { errorMessage: 'Server error' });
    }
  });
  
// Display registration form
router.get('/register', (req, res) => {
    res.render('register'); // Assuming register.ejs is in your views folder
});


// Display login form
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'front-end', 'login.html'));
});

router.post('/api/auth/request-otp', async (req, res) => {
  const mobile = normalizeMobile(req.body.mobile);

  if (!isValidMobile(mobile)) {
    return res.status(400).json({ message: 'Enter a valid 10-digit mobile number.' });
  }

  if (!isConfiguredAdmin(mobile)) {
    return res.status(403).json({ message: 'This number is not authorized for the admin panel.' });
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'MongoDB is not connected. Check the MongoDB URI and network access.' });
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    otpStore.set(mobile, { otp, expiresAt: Date.now() + otpLifetimeMs, attempts: 0 });

    if (isSmsConfigured()) {
      await sendOtpSms(mobile, otp);
      return res.json({ message: 'OTP sent to your mobile number.' });
    }

    if (process.env.NODE_ENV === 'production') {
      otpStore.delete(mobile);
      return res.status(503).json({ message: 'SMS provider is not configured.' });
    }

    return res.json({ message: 'Development OTP generated.', otp });
  } catch (error) {
    console.error('Error requesting admin OTP:', error);
    const message = process.env.NODE_ENV === 'production'
      ? 'Could not send OTP. Please try again.'
      : error.message;
    return res.status(503).json({ message });
  }
});

router.post('/api/auth/verify-otp', async (req, res) => {
  const mobile = normalizeMobile(req.body.mobile);
  const otp = String(req.body.otp || '').trim();
  const pending = otpStore.get(mobile);

  if (!isValidMobile(mobile) || !pending || Date.now() > pending.expiresAt) {
    otpStore.delete(mobile);
    return res.status(401).json({ message: 'OTP expired or not requested.' });
  }

  pending.attempts += 1;
  if (pending.attempts > 5) {
    otpStore.delete(mobile);
    return res.status(429).json({ message: 'Too many attempts. Request a new OTP.' });
  }

  if (otp !== pending.otp) {
    return res.status(401).json({ message: 'Incorrect OTP.' });
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'MongoDB is not connected. Check the MongoDB URI and network access.' });
    }

    const rawLocation = req.body.location;
    const location = rawLocation && {
      latitude: Number(rawLocation.latitude),
      longitude: Number(rawLocation.longitude),
      accuracy: Number(rawLocation.accuracy)
    };
    const hasLocation = location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
    const loginRecord = {
      loggedInAt: new Date(),
      ...(hasLocation ? { location } : {}),
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    };
    const update = {
      $set: {
        mobile,
        lastLoginAt: loginRecord.loggedInAt,
        ...(hasLocation ? { lastLoginLocation: location } : {})
      },
      $push: { loginHistory: loginRecord },
      $setOnInsert: { name: 'Admin' }
    };
    const admin = await Admin.findOneAndUpdate(
      { mobile },
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    otpStore.delete(mobile);
    const token = jwt.sign(
      { admin: { id: admin._id.toString(), mobile: admin.mobile } },
      jwtSecret,
      { expiresIn: '8h' }
    );
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 });
    return res.json({ message: 'Login successful.', redirect: '/' });
  } catch (error) {
    console.error('Error saving OTP login:', error);
    const message = process.env.NODE_ENV === 'production'
      ? 'Could not save login data.'
      : `Could not save login data: ${error.message}`;
    return res.status(503).json({ message });
  }
});

router.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body || {};

  if (!credential) {
    return res.status(400).json({ message: 'Google credential is required.' });
  }

  try {
    const googleUser = await verifyGoogleToken(credential);

    if (!googleUser.emailVerified) {
      return res.status(401).json({ message: 'Google email is not verified.' });
    }

    const admin = await Admin.findOneAndUpdate(
      { email: googleUser.email },
      {
        $set: {
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          lastLoginAt: new Date()
        },
        $setOnInsert: { password: undefined }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    const token = jwt.sign(
      { admin: { id: admin._id.toString(), email: admin.email, name: admin.name } },
      jwtSecret,
      { expiresIn: '8h' }
    );

    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 });
    return res.json({ message: 'Google login successful.', redirect: '/' });
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(401).json({
      message: process.env.NODE_ENV === 'production'
        ? 'Google login failed.'
        : error.message
    });
  }
});

router.get('/dashboard', authenticateToken, (req, res) => {
  res.render('dashboard', { admin: req.admin });
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).lean();
    return res.render('profile', { admin });
  } catch (error) {
    console.error('Error loading profile:', error);
    return res.status(500).send('Could not load profile.');
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

module.exports = router;

