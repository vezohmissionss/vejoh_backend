const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const cron = require('node-cron');
const Driver = require('../models/driver'); 

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('MongoDB connected for cron job');

  cron.schedule('*/1 * * * *', async () => { // every 1 minute for testing
    try {
      const drivers = await Driver.find({
        verificationStatus: 'under_review',
        updatedAt: { $lte: new Date(Date.now() - 1 * 60 * 1000) } // 1 minute ago
      });

      for (const driver of drivers) {
        driver.verificationStatus = 'approved';
        await driver.save();
        console.log(`Driver ${driver._id} auto-approved`);
      }
    } catch (error) {
      console.error('Cron job error:', error);
    }
  });

  console.log('Auto-approve cron job scheduled.');
})
.catch(err => console.error('MongoDB connection error:', err));
