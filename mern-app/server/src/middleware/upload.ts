import multer from 'multer';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

/**
 * Memory storage for file uploads.
 * Files are buffered in memory, then uploaded to storage service.
 * This avoids disk I/O for temp files and simplifies the pipeline.
 */
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});

/**
 * Middleware for single file upload with field name 'file'.
 */
export const uploadSingle = upload.single('file');

/**
 * Middleware for multiple file uploads (max 5).
 */
export const uploadMultiple = upload.array('files', 5);