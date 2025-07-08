import fs from 'fs';
import path from 'path';
import fse from 'fs-extra';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v2 as cloudinary } from 'cloudinary';
import { UploadableFile, StorageProvider } from '@/types';
import { CONFIG } from '@/config';
import { Logger } from '@/utils/logger';

export class LocalStorageProvider implements StorageProvider {
  name = 'local';
  private logger: Logger;

  constructor() {
    this.logger = new Logger('LocalStorageProvider');
    this.ensureUploadDir();
  }

  private ensureUploadDir() {
    fse.ensureDirSync(CONFIG.LOCAL_STORAGE_PATH);
  }

  private getFilePath(file: UploadableFile): string {
    return path.join(CONFIG.LOCAL_STORAGE_PATH, file.folderPath || '', `${file.hash}${file.ext}`);
  }

  async upload(file: UploadableFile): Promise<void> {
    if (!file.filepath) {
      throw new Error('File path is required for upload');
    }

    const destPath = this.getFilePath(file);
    const destDir = path.dirname(destPath);

    await fse.ensureDir(destDir);
    await fse.copy(file.filepath, destPath);

    file.url = `/files/${file.folderPath || ''}/${file.hash}${file.ext}`.replace(/\/+/g, '/');
    file.provider_metadata = { path: destPath };

    this.logger.info('File uploaded to local storage', { filename: file.name, path: destPath });
  }

  async delete(file: UploadableFile): Promise<void> {
    const filePath = this.getFilePath(file);
    
    try {
      await fse.remove(filePath);
      this.logger.info('File deleted from local storage', { filename: file.name, path: filePath });
    } catch (error) {
      this.logger.error('Failed to delete file from local storage', { filename: file.name, error });
      throw error;
    }
  }

  async checkFileSize(file: UploadableFile): Promise<void> {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      throw new Error(`File size ${file.size} exceeds maximum allowed size ${CONFIG.MAX_FILE_SIZE}`);
    }
  }
}

export class S3StorageProvider implements StorageProvider {
  name = 'aws-s3';
  private client: S3Client;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('S3StorageProvider');
    this.client = new S3Client({
      region: CONFIG.AWS_S3_REGION,
      credentials: {
        accessKeyId: CONFIG.AWS_ACCESS_KEY_ID!,
        secretAccessKey: CONFIG.AWS_SECRET_ACCESS_KEY!
      },
      endpoint: CONFIG.AWS_S3_ENDPOINT
    });
  }

  private getS3Key(file: UploadableFile): string {
    return `${file.folderPath || ''}/${file.hash}${file.ext}`.replace(/^\//, '');
  }

  async upload(file: UploadableFile): Promise<void> {
    if (!file.filepath) {
      throw new Error('File path is required for upload');
    }

    const key = this.getS3Key(file);
    const fileStream = fs.createReadStream(file.filepath);

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: CONFIG.AWS_S3_BUCKET!,
        Key: key,
        Body: fileStream,
        ContentType: file.mime,
        Metadata: {
          originalName: file.name,
          hash: file.hash
        }
      }
    });

    try {
      const result = await upload.done();
      file.url = result.Location || `https://${CONFIG.AWS_S3_BUCKET}.s3.${CONFIG.AWS_S3_REGION}.amazonaws.com/${key}`;
      file.provider_metadata = { 
        bucket: CONFIG.AWS_S3_BUCKET,
        key,
        etag: result.ETag
      };

      this.logger.info('File uploaded to S3', { filename: file.name, key, bucket: CONFIG.AWS_S3_BUCKET });
    } catch (error) {
      this.logger.error('Failed to upload file to S3', { filename: file.name, error });
      throw error;
    }
  }

  async delete(file: UploadableFile): Promise<void> {
    const key = this.getS3Key(file);

    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: CONFIG.AWS_S3_BUCKET!,
        Key: key
      }));

      this.logger.info('File deleted from S3', { filename: file.name, key });
    } catch (error) {
      this.logger.error('Failed to delete file from S3', { filename: file.name, error });
      throw error;
    }
  }

  async getSignedUrl(file: UploadableFile, options: { expiresIn?: number } = {}): Promise<string> {
    const key = this.getS3Key(file);
    const command = new GetObjectCommand({
      Bucket: CONFIG.AWS_S3_BUCKET!,
      Key: key
    });

    return await getSignedUrl(this.client, command, { 
      expiresIn: options.expiresIn || 3600 
    });
  }

  async checkFileSize(file: UploadableFile): Promise<void> {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      throw new Error(`File size ${file.size} exceeds maximum allowed size ${CONFIG.MAX_FILE_SIZE}`);
    }
  }
}

export class CloudinaryStorageProvider implements StorageProvider {
  name = 'cloudinary';
  private logger: Logger;

  constructor() {
    this.logger = new Logger('CloudinaryStorageProvider');
    cloudinary.config({
      cloud_name: CONFIG.CLOUDINARY_CLOUD_NAME,
      api_key: CONFIG.CLOUDINARY_API_KEY,
      api_secret: CONFIG.CLOUDINARY_API_SECRET
    });
  }

  private getPublicId(file: UploadableFile): string {
    return `${file.folderPath || ''}/${file.hash}`.replace(/^\//, '');
  }

  async upload(file: UploadableFile): Promise<void> {
    if (!file.filepath) {
      throw new Error('File path is required for upload');
    }

    const publicId = this.getPublicId(file);
    const options: any = {
      public_id: publicId,
      resource_type: 'auto',
      folder: file.folderPath?.replace(/^\//, '') || undefined
    };

    try {
      const result = await cloudinary.uploader.upload(file.filepath, options);
      
      file.url = result.secure_url;
      file.provider_metadata = {
        public_id: result.public_id,
        resource_type: result.resource_type,
        format: result.format,
        version: result.version
      };

      this.logger.info('File uploaded to Cloudinary', { 
        filename: file.name, 
        public_id: result.public_id,
        url: result.secure_url
      });
    } catch (error) {
      this.logger.error('Failed to upload file to Cloudinary', { filename: file.name, error });
      throw error;
    }
  }

  async delete(file: UploadableFile): Promise<void> {
    const publicId = this.getPublicId(file);

    try {
      await cloudinary.uploader.destroy(publicId);
      this.logger.info('File deleted from Cloudinary', { filename: file.name, public_id: publicId });
    } catch (error) {
      this.logger.error('Failed to delete file from Cloudinary', { filename: file.name, error });
      throw error;
    }
  }

  async checkFileSize(file: UploadableFile): Promise<void> {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      throw new Error(`File size ${file.size} exceeds maximum allowed size ${CONFIG.MAX_FILE_SIZE}`);
    }
  }
}

export class StorageProviderService {
  private provider: StorageProvider;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('StorageProviderService');
    this.provider = this.createProvider();
  }

  private createProvider(): StorageProvider {
    switch (CONFIG.STORAGE_PROVIDER) {
      case 'aws-s3':
        if (!CONFIG.AWS_S3_BUCKET || !CONFIG.AWS_ACCESS_KEY_ID || !CONFIG.AWS_SECRET_ACCESS_KEY) {
          throw new Error('AWS S3 configuration is incomplete');
        }
        return new S3StorageProvider();
      
      case 'cloudinary':
        if (!CONFIG.CLOUDINARY_CLOUD_NAME || !CONFIG.CLOUDINARY_API_KEY || !CONFIG.CLOUDINARY_API_SECRET) {
          throw new Error('Cloudinary configuration is incomplete');
        }
        return new CloudinaryStorageProvider();
      
      case 'local':
      default:
        return new LocalStorageProvider();
    }
  }

  async upload(file: UploadableFile): Promise<void> {
    await this.provider.upload(file);
  }

  async delete(file: UploadableFile): Promise<void> {
    await this.provider.delete(file);
  }

  async checkFileSize(file: UploadableFile, options?: any): Promise<void> {
    if (this.provider.checkFileSize) {
      await this.provider.checkFileSize(file, options);
    }
  }

  async getSignedUrl(file: UploadableFile, options?: any): Promise<string> {
    if (this.provider.getSignedUrl) {
      return await this.provider.getSignedUrl(file, options);
    }
    throw new Error('Signed URLs are not supported by the current storage provider');
  }

  getProviderName(): string {
    return this.provider.name;
  }
}
