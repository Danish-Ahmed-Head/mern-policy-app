const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);
const dbName = 'policyDB';

router.get('/history', async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('promptHistory');
    
    const query = { username: req.query.username };
    if (req.query.positionId) {
      query.positionId = req.query.positionId;
    }
    
    const history = await collection
      .find(query)
      .sort({ queryDate: -1 })
      .limit(50)
      .toArray();
      
    res.json(history);
  } catch (err) {
    console.error('Error fetching chat history:', err);
    res.status(500).json({ message: 'Error fetching chat history' });
  } finally {
    await client.close();
  }
});

router.post('/save', async (req, res) => {
  try {
    const { userQuery, botResponse, sessionId, positionId, normalizedPositionId, experience, username } = req.body;
    
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('promptHistory');
    
    await collection.insertOne({
      userQuery,
      botResponse,
      sessionId,
      positionId,
      normalizedPositionId,
      experience,
      username,
      queryDate: new Date(),
    });
    
    res.status(200).json({ message: 'Chat saved successfully' });
  } catch (err) {
    console.error('Error saving chat:', err);
    res.status(500).json({ message: 'Error saving chat' });
  } finally {
    await client.close();
  }
});

router.delete('/delete', async (req, res) => {
  try {
    const { username, query, date } = req.body;
    
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('promptHistory');
    
    await collection.deleteOne({ 
      username, 
      userQuery: query, 
      queryDate: new Date(date) 
    });
    
    res.status(200).json({ message: 'Chat deleted successfully' });
  } catch (err) {
    console.error('Error deleting chat:', err);
    res.status(500).json({ message: 'Error deleting chat' });
  } finally {
    await client.close();
  }
});

router.get('/health-policies', async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('health_policies');
    
    const query = { status: "Active" };
    if (req.query.positionId) {
      query.positionId = req.query.positionId;
    }
    if (req.query.experience) {
      query.ExperienceRange = req.query.experience;
    }
    
    const policies = await collection.find(query).toArray();
    res.json(policies);
  } catch (err) {
    console.error('Error fetching health policies:', err);
    res.status(500).json({ message: 'Error fetching health policies' });
  } finally {
    await client.close();
  }
});

module.exports = router;