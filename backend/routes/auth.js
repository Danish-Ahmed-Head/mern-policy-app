// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  try {
    const payload = jwt.verify(token, 'your_jwt_secret');
    req.user = payload;
    next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await mongoose.connection.db.collection('users').findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Incorrect username or password' });
    }
    if (password !== user.password) {
      return res.status(401).json({ message: 'Incorrect username or password' });
    }
    const token = jwt.sign(
      { username: user.username, role: user.role, positionId: user.positionId },
      'your_jwt_secret',
      { expiresIn: '1h' }
    );
    res.json({
      token,
      username: user.username,
      role: user.role,
      positionId: user.positionId,
      position: user.position,
      experience: user.experience,
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/forgot', async (req, res) => {
  const { name, username, issue } = req.body;
  try {
    await mongoose.connection.db.collection('forgotRequests').insertOne({
      name,
      username,
      issue,
      requestDate: new Date(),
    });
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'Forgot Password Request',
      text: `Forgot password request from ${name} (${username}): ${issue}`,
    };
    await transporter.sendMail(mailOptions);
    res.json({ message: 'Forgot password request submitted' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = { router, authenticateToken };