const multer = require('multer');

const imageStorage = multer.memoryStorage();

const shopImageFileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true)
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE'), false)
  }
};

exports.saveImageToMemory = multer({ storage: imageStorage, fileFilter: shopImageFileFilter, limits: { fileSize: 10485760 } });