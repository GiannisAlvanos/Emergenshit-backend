const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const errorHandler = require("./middleware/errorHandler");

// ******************************************************
// Αφαιρέθηκε η γραμμή require("dotenv").config();
// για να μην φορτώνεται κατά τις δοκιμές.
// Θα πρέπει να φορτωθεί στο server.js ή στο index.js!
// ******************************************************

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/toilets", require("./routes/toilets"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/search", require("./routes/search"));
app.use("/api/admin", require("./routes/admin"));

app.use(errorHandler);

module.exports = app;