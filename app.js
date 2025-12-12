// app.js (Testing)
require('dotenv').config(); // Πρέπει να έχετε το .env και εδώ
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const errorHandler = require("./middleware/errorHandler");

// ΝΕΑ ΠΡΟΣΘΗΚΗ: Καλεί τη σύνδεση με τη βάση δεδομένων
const connectDB = require('./config/db');
connectDB(); 

// -------------------------------------------------------------------------
// ΠΡΟΣΘΗΚΗ: Λογική Mock Data (Απαραίτητη αν το toiletsController τη χρησιμοποιεί)
const mockData = require('./data/mockData'); // Υποθέτοντας ότι υπάρχει αυτό το αρχείο

// Ελέγχουμε αν το περιβάλλον είναι 'test' ή αν δεν έχει οριστεί MONGODB_URI.
// Αν και το connectDB() είναι πλέον πάνω, το toiletsController.js χρειάζεται
// το global.MOCK για το fallback.
if (!process.env.MONGODB_URI || process.env.NODE_ENV === 'test') {
    global.MOCK = mockData;
}
// -------------------------------------------------------------------------

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ----------------------------------------------------
// !!! ΠΡΟΣΘΗΚΗ ΤΟΥ ΑΡΧΙΚΟΥ ROUTE ΓΙΑ ΤΟ ΒΑΣΙΚΟ PATH !!!
// ----------------------------------------------------
app.get("/", (req, res) => {
  res.send("Emergensh!t API is running");
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/toilets", require("./routes/toilets"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/search", require("./routes/search"));
app.use("/api/admin", require("./routes/admin"));

app.use(errorHandler);

module.exports = app;