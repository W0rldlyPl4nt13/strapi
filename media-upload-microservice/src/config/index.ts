import { config } from 'dotenv';

config();

export const CONFIG = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'file:./media.db',
  
  // Upload settings
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  ALLOWED_TYPES: process.env.ALLOWED_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'application/pdf',
    'text/plain',
    'application/json'
  ],
  
  // Storage provider
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local',
  
  // Local storage
  LOCAL_STORAGE_PATH: process.env.LOCAL_STORAGE_PATH || './uploads',
  
  // AWS S3
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  AWS_S3_REGION: process.env.AWS_S3_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_S3_ENDPOINT: process.env.AWS_S3_ENDPOINT,
  
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  
  // Image processing
  IMAGE_QUALITY: parseInt(process.env.IMAGE_QUALITY || '80'),
  IMAGE_PROGRESSIVE: process.env.IMAGE_PROGRESSIVE === 'true',
  GENERATE_THUMBNAILS: process.env.GENERATE_THUMBNAILS !== 'false',
  RESPONSIVE_BREAKPOINTS: process.env.RESPONSIVE_BREAKPOINTS?.split(',').map(Number) || [480, 768, 1024, 1920],
  
  // Security
  ENABLE_CORS: process.env.ENABLE_CORS !== 'false',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  ENABLE_HELMET: process.env.ENABLE_HELMET !== 'false',
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};
