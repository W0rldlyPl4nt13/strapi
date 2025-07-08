import express from 'express';
import helmet from 'helmet';
import path from 'path';
import fse from 'fs-extra';
import { CONFIG } from '@/config';
import { corsMiddleware } from '@/middleware/cors';
import { errorHandler, notFoundHandler } from '@/middleware/error-handler';
import { DatabaseService } from '@/services/database';
import { Logger } from '@/utils/logger';
import routes from '@/routes';

const app = express();
const logger = new Logger('App');

// Ensure required directories exist
async function ensureDirectories() {
  await fse.ensureDir(CONFIG.UPLOAD_DIR);
  await fse.ensureDir(CONFIG.LOCAL_STORAGE_PATH);
  await fse.ensureDir('logs');
}

// Initialize database
async function initializeDatabase() {
  const db = new DatabaseService();
  await db.connect();
  return db;
}

// Configure middleware
if (CONFIG.ENABLE_HELMET) {
  app.use(helmet());
}

if (CONFIG.ENABLE_CORS) {
  app.use(corsMiddleware);
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for local storage
app.use('/files', express.static(CONFIG.LOCAL_STORAGE_PATH));

// API routes
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await ensureDirectories();
    await initializeDatabase();

    const server = app.listen(CONFIG.PORT, () => {
      logger.info(`Media Upload Microservice started`, {
        port: CONFIG.PORT,
        environment: CONFIG.NODE_ENV,
        storageProvider: CONFIG.STORAGE_PROVIDER,
        maxFileSize: CONFIG.MAX_FILE_SIZE
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();
