// config/db.js (Δεν είναι απαραίτητο, αλλά κάνει το Mongoose πιο ασφαλές)
const mongoose = require("mongoose");

const connectDB = async () => {
    // Ελέγχουμε αν υπάρχει ήδη σύνδεση.
    if (mongoose.connection.readyState === 1) { 
        console.log("✅ MongoDB already connected.");
        return;
    }
    
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.error("❌ Database connection failed", err);
        process.exit(1);
    }
};

module.exports = connectDB;