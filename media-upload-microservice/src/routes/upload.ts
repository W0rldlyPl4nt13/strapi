import { Router, Request, Response } from 'express';
import multer from 'multer';
import { UploadService } from '@/services/upload';
import { ValidationService } from '@/services/validation';
import { ApiResponse } from '@/types';
import { CONFIG } from '@/config';

const router = Router();
const uploadService = new UploadService();
const validationService = new ValidationService();

// Configure multer for file uploads
const upload = multer({
  dest: CONFIG.UPLOAD_DIR,
  limits: {
    fileSize: CONFIG.MAX_FILE_SIZE,
    files: 10 // Maximum 10 files per request
  },
  fileFilter: (req, file, cb) => {
    if (CONFIG.ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  }
});

// Upload single file
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      } as ApiResponse);
    }

    const fileInfo = req.body.fileInfo ? JSON.parse(req.body.fileInfo) : {};
    validationService.validateFileInfo(fileInfo);

    const processingOptions = req.body.processingOptions ? JSON.parse(req.body.processingOptions) : {};
    const validationOptions = req.body.validationOptions ? JSON.parse(req.body.validationOptions) : {};

    const uploadedFiles = await uploadService.uploadFiles(
      [req.file],
      fileInfo,
      {
        folder: req.body.folder,
        processingOptions,
        validationOptions
      }
    );

    res.json({
      success: true,
      data: uploadedFiles[0],
      message: 'File uploaded successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

// Upload multiple files
router.post('/multiple', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files provided'
      } as ApiResponse);
    }

    const fileInfo = req.body.fileInfo ? JSON.parse(req.body.fileInfo) : {};
    validationService.validateFileInfo(fileInfo);

    const processingOptions = req.body.processingOptions ? JSON.parse(req.body.processingOptions) : {};
    const validationOptions = req.body.validationOptions ? JSON.parse(req.body.validationOptions) : {};

    const uploadedFiles = await uploadService.uploadFiles(
      req.files,
      fileInfo,
      {
        folder: req.body.folder,
        processingOptions,
        validationOptions
      }
    );

    res.json({
      success: true,
      data: uploadedFiles,
      message: `${uploadedFiles.length} files uploaded successfully`
    } as ApiResponse);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

// Upload with URL
router.post('/url', async (req: Request, res: Response) => {
  try {
    const { url, fileInfo = {}, processingOptions = {}, validationOptions = {} } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      } as ApiResponse);
    }

    validationService.validateFileInfo(fileInfo);

    // This would require implementing URL download functionality
    // For now, return not implemented
    res.status(501).json({
      success: false,
      error: 'URL upload not implemented yet'
    } as ApiResponse);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

export default router;
