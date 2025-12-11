const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const errorHandler = require("./middleware/errorHandler");

// ... (άλλα require)

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