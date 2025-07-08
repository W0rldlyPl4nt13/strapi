import { ValidationOptions } from '@/types';
import { CONFIG } from '@/config';
import { Logger } from '@/utils/logger';

export class ValidationService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ValidationService');
  }

  async validateFile(file: Express.Multer.File, options: ValidationOptions = {}): Promise<void> {
    const {
      maxFileSize = CONFIG.MAX_FILE_SIZE,
      allowedTypes = CONFIG.ALLOWED_TYPES,
      allowedExtensions,
      maxWidth,
      maxHeight
    } = options;

    // Check file size
    if (file.size > maxFileSize) {
      throw new Error(`File size ${file.size} exceeds maximum allowed size ${maxFileSize}`);
    }

    // Check MIME type
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }

    // Check file extension
    if (allowedExtensions) {
      const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        throw new Error(`File extension ${fileExtension} is not allowed`);
      }
    }

    // Additional image validation
    if (file.mimetype.startsWith('image/')) {
      await this.validateImage(file, { maxWidth, maxHeight });
    }

    this.logger.info('File validation passed', { 
      filename: file.originalname,
      size: file.size,
      type: file.mimetype
    });
  }

  private async validateImage(
    file: Express.Multer.File, 
    options: { maxWidth?: number; maxHeight?: number }
  ): Promise<void> {
    if (!options.maxWidth && !options.maxHeight) {
      return;
    }

    try {
      const sharp = require('sharp');
      const metadata = await sharp(file.path).metadata();

      if (options.maxWidth && metadata.width && metadata.width > options.maxWidth) {
        throw new Error(`Image width ${metadata.width} exceeds maximum allowed width ${options.maxWidth}`);
      }

      if (options.maxHeight && metadata.height && metadata.height > options.maxHeight) {
        throw new Error(`Image height ${metadata.height} exceeds maximum allowed height ${options.maxHeight}`);
      }
    } catch (error) {
      if (error.message.includes('exceeds maximum')) {
        throw error;
      }
      this.logger.warn('Failed to validate image dimensions', { filename: file.originalname, error });
    }
  }

  validateFileInfo(fileInfo: any): void {
    if (fileInfo.name && typeof fileInfo.name !== 'string') {
      throw new Error('File name must be a string');
    }

    if (fileInfo.alternativeText && typeof fileInfo.alternativeText !== 'string') {
      throw new Error('Alternative text must be a string');
    }

    if (fileInfo.caption && typeof fileInfo.caption !== 'string') {
      throw new Error('Caption must be a string');
    }

    if (fileInfo.folder && typeof fileInfo.folder !== 'string') {
      throw new Error('Folder must be a string');
    }

    // Validate length limits
    if (fileInfo.name && fileInfo.name.length > 255) {
      throw new Error('File name cannot exceed 255 characters');
    }

    if (fileInfo.alternativeText && fileInfo.alternativeText.length > 500) {
      throw new Error('Alternative text cannot exceed 500 characters');
    }

    if (fileInfo.caption && fileInfo.caption.length > 1000) {
      throw new Error('Caption cannot exceed 1000 characters');
    }
  }

  validatePaginationOptions(options: any): void {
    if (options.page !== undefined) {
      const page = Number(options.page);
      if (isNaN(page) || page < 1) {
        throw new Error('Page must be a positive number');
      }
    }

    if (options.limit !== undefined) {
      const limit = Number(options.limit);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new Error('Limit must be a number between 1 and 100');
      }
    }

    if (options.sort !== undefined && typeof options.sort !== 'string') {
      throw new Error('Sort must be a string');
    }
  }

  validateFolderName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('Folder name is required and must be a string');
    }

    if (name.length > 100) {
      throw new Error('Folder name cannot exceed 100 characters');
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\u0000-\u001F]/;
    if (invalidChars.test(name)) {
      throw new Error('Folder name contains invalid characters');
    }

    // Check for reserved names
    const reservedNames = ['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'];
    if (reservedNames.includes(name.toLowerCase())) {
      throw new Error('Folder name cannot be a reserved system name');
    }
  }
}
