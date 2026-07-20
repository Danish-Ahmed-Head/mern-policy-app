// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const authRoutes = require('./routes/auth').router; // Use .router
const policyRoutes = require('./routes/policy');

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/policyDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Nodemailer Setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Chat Routes
app.get('/api/chat/history', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const history = await mongoose.connection.db.collection('promptHistory')
      .find({ username })
      .sort({ queryDate: -1 })
      .limit(50)
      .toArray();
    res.status(200).json(history);
  } catch (err) {
    console.error('Error fetching chat history:', err);
    res.status(500).json({ error: 'Error fetching chat history' });
  }
});

app.post('/api/chat/save', async (req, res) => {
  try {
    const { userQuery, botResponse, sessionId, positionId, experience, username } = req.body;
    if (!userQuery || !botResponse || !sessionId || !positionId || !username) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const result = await mongoose.connection.db.collection('promptHistory').insertOne({
      userQuery,
      botResponse,
      sessionId,
      positionId,
      experience,
      username,
      queryDate: new Date()
    });
    console.log('Chat saved:', result.insertedId);
    res.status(200).json({ message: 'Chat saved', insertedId: result.insertedId });
  } catch (err) {
    console.error('Error saving chat:', err);
    res.status(500).json({ error: 'Error saving chat' });
  }
});

app.delete('/api/chat/delete', async (req, res) => {
  try {
    const { username, query, date } = req.body;
    if (!username || !query || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const result = await mongoose.connection.db.collection('promptHistory').deleteOne({
      username,
      userQuery: query,
      queryDate: new Date(date)
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    res.status(200).json({ message: 'Chat deleted' });
  } catch (err) {
    console.error('Error deleting chat:', err);
    res.status(500).json({ error: 'Error deleting chat' });
  }
});

// Auth and Policy Routes
app.use('/api/auth', authRoutes);
app.use('/api/policy', policyRoutes);

// Start Server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));