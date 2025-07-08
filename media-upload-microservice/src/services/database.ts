import { PrismaClient } from '@prisma/client';
import { UploadableFile, FileInfo, FileFolder } from '@/types';
import { Logger } from '@/utils/logger';

export class DatabaseService {
  private prisma: PrismaClient;
  private logger: Logger;

  constructor() {
    this.prisma = new PrismaClient();
    this.logger = new Logger('DatabaseService');
  }

  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.logger.info('Database connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to database', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    this.logger.info('Database disconnected');
  }

  async saveFile(file: Omit<UploadableFile, 'id' | 'createdAt' | 'updatedAt'>): Promise<UploadableFile> {
    try {
      const savedFile = await this.prisma.file.create({
        data: {
          name: file.name,
          alternativeText: file.alternativeText,
          caption: file.caption,
          folder: file.folder,
          folderPath: file.folderPath,
          hash: file.hash,
          ext: file.ext,
          mime: file.mime,
          size: file.size,
          url: file.url,
          previewUrl: file.previewUrl,
          provider: file.provider,
          provider_metadata: file.provider_metadata ? JSON.stringify(file.provider_metadata) : null,
          width: file.width,
          height: file.height,
          formats: file.formats ? JSON.stringify(file.formats) : null
        }
      });

      return this.mapFileFromDb(savedFile);
    } catch (error) {
      this.logger.error('Failed to save file to database', { filename: file.name, error });
      throw error;
    }
  }

  async getFile(id: string): Promise<UploadableFile | null> {
    try {
      const file = await this.prisma.file.findUnique({
        where: { id }
      });

      return file ? this.mapFileFromDb(file) : null;
    } catch (error) {
      this.logger.error('Failed to get file from database', { id, error });
      throw error;
    }
  }

  async getFiles(options: {
    page?: number;
    limit?: number;
    sort?: string;
    filters?: Record<string, any>;
  } = {}): Promise<{ files: UploadableFile[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    try {
      const where = this.buildWhereClause(options.filters);
      const orderBy = this.buildOrderByClause(options.sort);

      const [files, total] = await Promise.all([
        this.prisma.file.findMany({
          where,
          orderBy,
          skip,
          take: limit
        }),
        this.prisma.file.count({ where })
      ]);

      return {
        files: files.map(file => this.mapFileFromDb(file)),
        total,
        page,
        limit
      };
    } catch (error) {
      this.logger.error('Failed to get files from database', { options, error });
      throw error;
    }
  }

  async updateFile(id: string, updates: Partial<FileInfo>): Promise<UploadableFile | null> {
    try {
      const file = await this.prisma.file.update({
        where: { id },
        data: {
          name: updates.name,
          alternativeText: updates.alternativeText,
          caption: updates.caption,
          folder: updates.folder,
          updatedAt: new Date()
        }
      });

      return this.mapFileFromDb(file);
    } catch (error) {
      this.logger.error('Failed to update file in database', { id, updates, error });
      throw error;
    }
  }

  async deleteFile(id: string): Promise<boolean> {
    try {
      await this.prisma.file.delete({
        where: { id }
      });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete file from database', { id, error });
      throw error;
    }
  }

  async createFolder(name: string, parent?: string): Promise<FileFolder> {
    try {
      const parentFolder = parent ? await this.getFolder(parent) : null;
      const path = parentFolder ? `${parentFolder.path}/${name}` : `/${name}`;

      const folder = await this.prisma.folder.create({
        data: {
          name,
          path,
          parent
        }
      });

      return {
        id: folder.id,
        name: folder.name,
        path: folder.path,
        parent: folder.parent || undefined,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt
      };
    } catch (error) {
      this.logger.error('Failed to create folder in database', { name, parent, error });
      throw error;
    }
  }

  async getFolder(id: string): Promise<FileFolder | null> {
    try {
      const folder = await this.prisma.folder.findUnique({
        where: { id }
      });

      return folder ? {
        id: folder.id,
        name: folder.name,
        path: folder.path,
        parent: folder.parent || undefined,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt
      } : null;
    } catch (error) {
      this.logger.error('Failed to get folder from database', { id, error });
      throw error;
    }
  }

  async getFolders(): Promise<FileFolder[]> {
    try {
      const folders = await this.prisma.folder.findMany({
        orderBy: { path: 'asc' }
      });

      return folders.map(folder => ({
        id: folder.id,
        name: folder.name,
        path: folder.path,
        parent: folder.parent || undefined,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt
      }));
    } catch (error) {
      this.logger.error('Failed to get folders from database', { error });
      throw error;
    }
  }

  async deleteFolder(id: string): Promise<boolean> {
    try {
      // Check if folder has files
      const filesCount = await this.prisma.file.count({
        where: { folder: id }
      });

      if (filesCount > 0) {
        throw new Error('Cannot delete folder that contains files');
      }

      // Check if folder has subfolders
      const subFoldersCount = await this.prisma.folder.count({
        where: { parent: id }
      });

      if (subFoldersCount > 0) {
        throw new Error('Cannot delete folder that contains subfolders');
      }

      await this.prisma.folder.delete({
        where: { id }
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to delete folder from database', { id, error });
      throw error;
    }
  }

  private mapFileFromDb(file: any): UploadableFile {
    return {
      id: file.id,
      name: file.name,
      alternativeText: file.alternativeText,
      caption: file.caption,
      folder: file.folder,
      folderPath: file.folderPath,
      hash: file.hash,
      ext: file.ext,
      mime: file.mime,
      size: file.size,
      url: file.url,
      previewUrl: file.previewUrl,
      provider: file.provider,
      provider_metadata: file.provider_metadata ? JSON.parse(file.provider_metadata) : undefined,
      width: file.width,
      height: file.height,
      formats: file.formats ? JSON.parse(file.formats) : undefined,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt
    };
  }

  private buildWhereClause(filters?: Record<string, any>): any {
    if (!filters) return {};

    const where: any = {};

    if (filters.name) {
      where.name = { contains: filters.name, mode: 'insensitive' };
    }

    if (filters.mime) {
      where.mime = { contains: filters.mime };
    }

    if (filters.folder) {
      where.folder = filters.folder;
    }

    if (filters.provider) {
      where.provider = filters.provider;
    }

    if (filters.minSize) {
      where.size = { ...where.size, gte: filters.minSize };
    }

    if (filters.maxSize) {
      where.size = { ...where.size, lte: filters.maxSize };
    }

    return where;
  }

  private buildOrderByClause(sort?: string): any {
    if (!sort) return { createdAt: 'desc' };

    const [field, direction] = sort.split(':');
    const validFields = ['name', 'size', 'createdAt', 'updatedAt', 'mime'];
    const validDirections = ['asc', 'desc'];

    if (!validFields.includes(field) || !validDirections.includes(direction)) {
      return { createdAt: 'desc' };
    }

    return { [field]: direction };
  }
}
