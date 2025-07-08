import { Router, Request, Response } from 'express';
import { UploadService } from '@/services/upload';
import { ValidationService } from '@/services/validation';
import { ApiResponse } from '@/types';

const router = Router();
const uploadService = new UploadService();
const validationService = new ValidationService();

// Get all folders
router.get('/', async (req: Request, res: Response) => {
  try {
    const folders = await uploadService.getFolders();

    res.json({
      success: true,
      data: folders,
      message: 'Folders retrieved successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

// Create new folder
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, parent } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Folder name is required'
      } as ApiResponse);
    }

    validationService.validateFolderName(name);

    const folder = await uploadService.createFolder(name, parent);

    res.status(201).json({
      success: true,
      data: folder,
      message: 'Folder created successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

// Delete folder
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Folder ID is required'
      } as ApiResponse);
    }

    const deleted = await uploadService.deleteFolder(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found'
      } as ApiResponse);
    }

    res.json({
      success: true,
      message: 'Folder deleted successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

export default router;
