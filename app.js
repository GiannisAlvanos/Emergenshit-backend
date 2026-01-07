/* eslint no-unused-vars: "error" */
require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const errorHandler = require("./middleware/errorHandler");

const connectDB = require("./config/db");

// Routes
const authRoutes = require("./routes/auth");
const toiletsRoutes = require("./routes/toilets");
const reviewsRoutes = require("./routes/reviews");
const searchRoutes = require("./routes/search");
const adminRoutes = require("./routes/admin");

const app = express();

// --------------------------------------------------
// ✅ CONNECT TO DB IF URI EXISTS (CI SAFE)
if (process.env.MONGODB_URI) {
  connectDB();
}

// --------------------------------------------------
// ✅ USE MOCK DATA ONLY IF DB IS NOT AVAILABLE
const mockData = require("./data/mockData");

if (!process.env.MONGODB_URI) {
  console.warn("⚠️ Running in MOCK mode");
  global.MOCK = mockData;
}

// --------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ✅ HEALTH CHECK (NO AUTH, NO DB QUERY)
app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

app.get("/", (req, res) => {
  res.send("Emergensh!t API is running");
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/toilets", toiletsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/admin", adminRoutes);

app.use(errorHandler);

module.exports = app;
