import os from 'os';
import path from 'path';
import fs from 'fs';
import fse from 'fs-extra';
import _ from 'lodash';
import { extension } from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import { UploadableFile, FileInfo, ProcessingOptions, ValidationOptions } from '@/types';
import { CONFIG } from '@/config';
import { ImageProcessingService } from './image-processing';
import { StorageProviderService } from './storage-provider';
import { ValidationService } from './validation';
import { DatabaseService } from './database';
import { Logger } from '@/utils/logger';

export class UploadService {
  private imageProcessing: ImageProcessingService;
  private storageProvider: StorageProviderService;
  private validation: ValidationService;
  private database: DatabaseService;
  private logger: Logger;

  constructor() {
    this.imageProcessing = new ImageProcessingService();
    this.storageProvider = new StorageProviderService();
    this.validation = new ValidationService();
    this.database = new DatabaseService();
    this.logger = new Logger('UploadService');
  }

  private filenameReservedRegex(): RegExp {
    // eslint-disable-next-line no-control-regex
    return /[<>:"/\\|?*\u0000-\u001F]/g;
  }

  private windowsReservedNameRegex(): RegExp {
    return /^(con|prn|aux|nul|com\d|lpt\d)$/i;
  }

  private isValidFilename(filename: string): boolean {
    if (!filename || filename.length > 255) {
      return false;
    }
    if (this.filenameReservedRegex().test(filename) || this.windowsReservedNameRegex().test(filename)) {
      return false;
    }
    if (filename === '.' || filename === '..') {
      return false;
    }
    return true;
  }

  private async createTmpWorkingDirectory(): Promise<string> {
    return await fse.mkdtemp(path.join(os.tmpdir(), 'media-upload-'));
  }

  private generateFileHash(basename: string): string {
    return `${basename}_${uuidv4().replace(/-/g, '')}`;
  }

  private async formatFileInfo(
    file: Express.Multer.File,
    fileInfo: Partial<FileInfo> = {},
    options: { folder?: string; tmpWorkingDirectory?: string } = {}
  ): Promise<Omit<UploadableFile, 'id' | 'createdAt' | 'updatedAt'>> {
    const { originalname: filename, mimetype: type, size } = file;

    if (!this.isValidFilename(filename)) {
      throw new Error('File name contains invalid characters');
    }

    let ext = path.extname(filename);
    if (!ext) {
      ext = `.${extension(type)}`;
    }
    
    const usedName = (fileInfo.name || filename).normalize();
    const basename = path.basename(usedName, ext);
    const hash = this.generateFileHash(basename);

    const entity: Omit<UploadableFile, 'id' | 'createdAt' | 'updatedAt'> = {
      name: usedName,
      alternativeText: fileInfo.alternativeText,
      caption: fileInfo.caption,
      folder: fileInfo.folder || options.folder,
      folderPath: await this.getFolderPath(fileInfo.folder || options.folder),
      hash,
      ext,
      mime: type,
      size,
      provider: CONFIG.STORAGE_PROVIDER,
      tmpWorkingDirectory: options.tmpWorkingDirectory,
      filepath: file.path
    };

    // Handle image-specific properties
    if (type.startsWith('image/')) {
      try {
        const metadata = await this.imageProcessing.getMetadata(entity);
        entity.width = metadata.width;
        entity.height = metadata.height;
      } catch (error) {
        this.logger.warn('Failed to extract image metadata', { error, filename });
      }
    }

    return entity;
  }

  private async getFolderPath(folderId?: string): Promise<string> {
    if (!folderId) return '/';
    
    try {
      const folder = await this.database.getFolder(folderId);
      return folder?.path || '/';
    } catch (error) {
      this.logger.warn('Failed to get folder path', { folderId, error });
      return '/';
    }
  }

  async uploadFiles(
    files: Express.Multer.File[],
    fileInfo: Partial<FileInfo> = {},
    options: {
      folder?: string;
      processingOptions?: ProcessingOptions;
      validationOptions?: ValidationOptions;
    } = {}
  ): Promise<UploadableFile[]> {
    const tmpWorkingDirectory = await this.createTmpWorkingDirectory();
    const uploadedFiles: UploadableFile[] = [];

    try {
      for (const file of files) {
        // Validate file
        await this.validation.validateFile(file, options.validationOptions);

        // Format file info
        const fileEntity = await this.formatFileInfo(file, fileInfo, {
          folder: options.folder,
          tmpWorkingDirectory
        });

        // Process image if needed
        if (fileEntity.mime.startsWith('image/')) {
          const processedFile = await this.imageProcessing.processImage(
            fileEntity,
            options.processingOptions
          );
          Object.assign(fileEntity, processedFile);
        }

        // Upload to storage provider
        await this.storageProvider.upload(fileEntity);

        // Save to database
        const savedFile = await this.database.saveFile(fileEntity);
        uploadedFiles.push(savedFile);

        this.logger.info('File uploaded successfully', { 
          filename: fileEntity.name,
          size: fileEntity.size,
          provider: fileEntity.provider
        });
      }

      return uploadedFiles;
    } catch (error) {
      this.logger.error('Upload failed', { error, files: files.map(f => f.originalname) });
      throw error;
    } finally {
      // Clean up temporary directory
      if (tmpWorkingDirectory) {
        await fse.remove(tmpWorkingDirectory).catch(err => {
          this.logger.warn('Failed to clean up tmp directory', { tmpWorkingDirectory, error: err });
        });
      }
    }
  }

  async getFiles(options: {
    page?: number;
    limit?: number;
    sort?: string;
    filters?: Record<string, any>;
  } = {}): Promise<{ files: UploadableFile[]; total: number; page: number; limit: number }> {
    return await this.database.getFiles(options);
  }

  async getFile(id: string): Promise<UploadableFile | null> {
    return await this.database.getFile(id);
  }

  async deleteFile(id: string): Promise<boolean> {
    const file = await this.database.getFile(id);
    if (!file) {
      throw new Error('File not found');
    }

    try {
      // Delete from storage provider
      await this.storageProvider.delete(file);
      
      // Delete from database
      await this.database.deleteFile(id);
      
      this.logger.info('File deleted successfully', { id, filename: file.name });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete file', { id, error });
      throw error;
    }
  }

  async updateFile(id: string, updates: Partial<FileInfo>): Promise<UploadableFile | null> {
    const file = await this.database.getFile(id);
    if (!file) {
      throw new Error('File not found');
    }

    const updatedFile = await this.database.updateFile(id, updates);
    this.logger.info('File updated successfully', { id, updates });
    
    return updatedFile;
  }

  async createFolder(name: string, parent?: string): Promise<{ id: string; name: string; path: string }> {
    const folder = await this.database.createFolder(name, parent);
    this.logger.info('Folder created successfully', { name, parent, id: folder.id });
    return folder;
  }

  async getFolders(): Promise<Array<{ id: string; name: string; path: string; parent?: string }>> {
    return await this.database.getFolders();
  }

  async deleteFolder(id: string): Promise<boolean> {
    const deleted = await this.database.deleteFolder(id);
    if (deleted) {
      this.logger.info('Folder deleted successfully', { id });
    }
    return deleted;
  }
}
