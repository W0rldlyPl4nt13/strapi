import { Router, Request, Response } from 'express';
import { UploadService } from '@/services/upload';
import { ValidationService } from '@/services/validation';
import { ApiResponse } from '@/types';

const router = Router();
const uploadService = new UploadService();
const validationService = new ValidationService();

// Get all files with pagination and filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const options = {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      sort: req.query.sort as string,
      filters: req.query.filters ? JSON.parse(req.query.filters as string) : undefined
    };

    validationService.validatePaginationOptions(options);

    const result = await uploadService.getFiles(options);

    res.json({
      success: true,
      data: result,
      message: 'Files retrieved successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

// Get single file by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      } as ApiResponse);
    }

    const file = await uploadService.getFile(id);

    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: file,
      message: 'File retrieved successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

// Update file metadata
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      } as ApiResponse);
    }

    validationService.validateFileInfo(updates);

    const updatedFile = await uploadService.updateFile(id, updates);

    if (!updatedFile) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: updatedFile,
      message: 'File updated successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

// Delete file
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      } as ApiResponse);
    }

    const deleted = await uploadService.deleteFile(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      } as ApiResponse);
    }

    res.json({
      success: true,
      message: 'File deleted successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

// Bulk delete files
router.delete('/', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'File IDs array is required'
      } as ApiResponse);
    }

    const results = await Promise.allSettled(
      ids.map(id => uploadService.deleteFile(id))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    res.json({
      success: true,
      data: {
        successful,
        failed,
        total: ids.length
      },
      message: `Bulk delete completed: ${successful} successful, ${failed} failed`
    } as ApiResponse);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

export default router;
