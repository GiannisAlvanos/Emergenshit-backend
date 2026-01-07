require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 4000;

let server;

// Αυτός ο έλεγχος διασφαλίζει ότι ο διακομιστής ξεκινά μόνο όταν το αρχείο
// εκτελείται απευθείας (π.χ. 'npm start' ή 'node server.js')
// και όχι όταν γίνεται require() από ένα test runner.
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
  });
}

// Εξάγουμε το app και το server. Αυτό δίνει τη δυνατότητα
// σε άλλα αρχεία (όπως τα tests) να έχουν πρόσβαση στο app
// χωρίς να ξεκινάει ο server αυτόματα, και μας επιτρέπει να τον κλείσουμε
// ρητά, αν χρειαστεί.
module.exports = { app, server };