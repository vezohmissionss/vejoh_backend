const cron = require("node-cron");
const Driver = require("../models/driver");

// Schedule the job to run every hour
cron.schedule("0 * * * *", async () => {
  try {
    // Find drivers under review for more than 24 hours
    const drivers = await Driver.find({
      verificationStatus: "under_review",
      updatedAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 24 hours ago
    });

    for (const driver of drivers) {
      driver.verificationStatus = "approved";
      await driver.save();
      console.log(`Driver ${driver._id} auto-approved`);
    }
  } catch (error) {
    console.error("Cron job error:", error);
  }
});

console.log("Auto-approve cron job running...");
