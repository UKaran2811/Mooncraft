const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!require('fs').existsSync(UPLOAD_DIR)) {
  require('fs').mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(12).toString('hex');
    cb(null, `${name}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only jpg, jpeg, png, webp, gif files are allowed'));
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/image', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5MB)' : err.message });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.json({
      success: true,
      url: `${baseUrl}/uploads/${req.file.filename}`,
      message: 'Image uploaded',
    });
  });
});

module.exports = router;
