require("dotenv").config();
const mongoose = require("mongoose");
const app = require("./app");

const PORT = process.env.PORT || 4000;

let server;

const startServer = async () => {
  try {
    // ✅ Ensure Mongo is connected before listening
    if (process.env.MONGODB_URI) {
      await mongoose.connection.asPromise();
      console.log("✅ MongoDB connected");
    }

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Server startup failed:", err);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, server };
