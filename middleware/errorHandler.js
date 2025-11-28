// middleware/errorHandler.js
module.exports = (err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ success:false, error: err.message || 'Server Error' });
};
