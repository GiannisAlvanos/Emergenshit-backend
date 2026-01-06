/* eslint no-unused-vars: "error" */

// Emergenshit-backend/app.js (ή app.js του testing)

require('dotenv').config(); // Πρέπει να υπάρχει για να διαβάζει το .env
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const errorHandler = require("./middleware/errorHandler");

// ΝΕΑ ΠΡΟΣΘΗΚΗ: Καλεί τη σύνδεση με τη βάση δεδομένων
const connectDB = require('./config/db');

// --- ΠΡΟΣΘΗΚΗ: Imports για τα Routes ---
const authRoutes = require('./routes/auth');
const toiletsRoutes = require('./routes/toilets');
const reviewsRoutes = require('./routes/reviews');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');
// ----------------------------------------

// *** ΚΡΙΣΙΜΗ ΑΛΛΑΓΗ: Συνδέουμε τη βάση δεδομένων μόνο αν ΔΕΝ είναι περιβάλλον test ***
if (process.env.NODE_ENV !== 'test') {
    connectDB();
}

// -------------------------------------------------------------------------
// ΠΡΟΣΘΗΚΗ: Λογική Mock Data
const mockData = require('./data/mockData'); 

// Θέτουμε το global.MOCK αν το NODE_ENV είναι test ή αν δεν υπάρχει MONGODB_URI
if (!process.env.MONGODB_URI || process.env.NODE_ENV === 'test') {
    global.MOCK = mockData;
}
// -------------------------------------------------------------------------

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.send("Emergensh!t API is running");
});

// --- ΧΡΗΣΗ ΤΩΝ IMPORTS ---
app.use('/api/auth', authRoutes);
app.use('/api/toilets', toiletsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
// -------------------------

app.use(errorHandler);

module.exports = app;
