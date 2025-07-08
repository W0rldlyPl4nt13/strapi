import { Router } from 'express';
import uploadRoutes from './upload';
import fileRoutes from './files';
import folderRoutes from './folders';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Media Upload Microservice is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
router.use('/upload', uploadRoutes);
router.use('/files', fileRoutes);
router.use('/folders', folderRoutes);

export default router;
