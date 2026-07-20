// routes/policy.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticateToken } = require('./auth');

router.use(authenticateToken);

router.get('/collections', async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections
      .map(col => col.name)
      .filter(name => name !== 'users' && name !== 'promptHistory');
    res.json(collectionNames);
  } catch (err) {
    console.error('Error fetching collections:', err);
    res.status(500).json({ message: 'Error fetching collections' });
  }
});

router.get('/collection/:collectionId', async (req, res) => {
  try {
    const data = await mongoose.connection.db.collection(req.params.collectionId)
      .find({})
      .toArray();
    res.json(data);
  } catch (err) {
    console.error('Error fetching collection data:', err);
    res.status(500).json({ message: 'Error fetching collection data' });
  }
});

router.post('/collection/:collectionId', async (req, res) => {
  try {
    const { data } = req.body;
    const { action } = req.query;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ message: 'Invalid data format' });
    }
    const collection = mongoose.connection.db.collection(req.params.collectionId);
    if (action === 'create') {
      await collection.insertMany(data);
      res.json({ message: `Collection ${req.params.collectionId} created successfully` });
    } else if (action === 'update') {
      await collection.deleteMany({});
      await collection.insertMany(data);
      res.json({ message: `Collection ${req.params.collectionId} updated successfully` });
    } else {
      res.status(400).json({ message: 'Invalid action' });
    }
  } catch (err) {
    console.error('Error processing collection:', err);
    res.status(500).json({ message: 'Error processing collection' });
  }
});

router.get('/health-policies', async (req, res) => {
  try {
    const query = { status: "Active" };
    if (req.query.positionId) {
      query.positionId = req.query.positionId;
    }
    if (req.query.experience) {
      query.ExperienceRange = req.query.experience;
    }
    const policies = await mongoose.connection.db.collection('health_policies')
      .find(query)
      .toArray();
    res.json(policies);
  } catch (err) {
    console.error('Error fetching health policies:', err);
    res.status(500).json({ message: 'Error fetching health policies' });
  }
});

module.exports = router;