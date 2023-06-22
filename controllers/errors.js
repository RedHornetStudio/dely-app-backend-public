const multer = require("multer");

exports.badRoute = (req, res, next) => {
  res.sendStatus(400);
};

exports.multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.json({ status: "FAILED", errors: [{ msg: 'Image size is to big' }] });
      return;
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      res.json({ status: "FAILED", errors: [{ msg: 'Invalid image type' }] });
      return;
    }
  }
  next(err);
};

exports.errorHandler = (err, req, res, next) => {
  console.log(err);
  res.json({ status: "FAILED", errors: [{ msg: err.message }] });
};