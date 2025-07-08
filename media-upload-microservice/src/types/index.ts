export interface FileInfo {
  name?: string;
  alternativeText?: string;
  caption?: string;
  folder?: string;
}

export interface UploadableFile {
  id?: string;
  name: string;
  alternativeText?: string;
  caption?: string;
  folder?: string;
  folderPath?: string;
  hash: string;
  ext: string;
  mime: string;
  size: number;
  url?: string;
  previewUrl?: string;
  provider: string;
  provider_metadata?: Record<string, any>;
  tmpWorkingDirectory?: string;
  filepath?: string;
  width?: number;
  height?: number;
  formats?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StorageProvider {
  name: string;
  upload(file: UploadableFile): Promise<void>;
  delete(file: UploadableFile): Promise<void>;
  checkFileSize?(file: UploadableFile, options?: any): Promise<void>;
  getSignedUrl?(file: UploadableFile, options?: any): Promise<string>;
}

export interface ProcessingOptions {
  quality?: number;
  progressive?: boolean;
  responsive?: boolean;
  breakpoints?: number[];
  formats?: string[];
}

export interface ValidationOptions {
  maxFileSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  maxWidth?: number;
  maxHeight?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: string;
  filters?: Record<string, any>;
}

export interface FileFolder {
  id: string;
  name: string;
  path: string;
  parent?: string;
  children?: FileFolder[];
  createdAt: Date;
  updatedAt: Date;
}
