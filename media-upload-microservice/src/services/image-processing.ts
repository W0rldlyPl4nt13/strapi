import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { UploadableFile, ProcessingOptions } from '@/types';
import { CONFIG } from '@/config';
import { Logger } from '@/utils/logger';

export class ImageProcessingService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ImageProcessingService');
  }

  private readonly FORMATS_TO_RESIZE = ['jpeg', 'png', 'webp', 'tiff', 'gif'];
  private readonly FORMATS_TO_PROCESS = ['jpeg', 'png', 'webp', 'tiff', 'svg', 'gif', 'avif'];
  private readonly FORMATS_TO_OPTIMIZE = ['jpeg', 'png', 'webp', 'tiff', 'avif'];

  private isOptimizableFormat(format: string | undefined): format is 'jpeg' | 'png' | 'webp' | 'tiff' | 'avif' {
    return format !== undefined && this.FORMATS_TO_OPTIMIZE.includes(format);
  }

  private isResizableFormat(format: string | undefined): boolean {
    return format !== undefined && this.FORMATS_TO_RESIZE.includes(format);
  }

  private async writeStreamToFile(stream: NodeJS.ReadWriteStream, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      
      stream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
      
      stream.pipe(writeStream);
    });
  }

  async getMetadata(file: UploadableFile): Promise<sharp.Metadata> {
    if (!file.filepath) {
      throw new Error('File path is required for metadata extraction');
    }

    try {
      return await sharp(file.filepath).metadata();
    } catch (error) {
      this.logger.error('Failed to extract metadata', { filepath: file.filepath, error });
      throw new Error('Failed to extract image metadata');
    }
  }

  async optimizeImage(
    file: UploadableFile,
    options: {
      quality?: number;
      progressive?: boolean;
      format?: string;
    } = {}
  ): Promise<{ buffer: Buffer; info: sharp.OutputInfo }> {
    if (!file.filepath) {
      throw new Error('File path is required for optimization');
    }

    const quality = options.quality || CONFIG.IMAGE_QUALITY;
    const progressive = options.progressive ?? CONFIG.IMAGE_PROGRESSIVE;
    const format = options.format || file.ext.replace('.', '');

    let transformer = sharp(file.filepath);

    if (this.isOptimizableFormat(format)) {
      switch (format) {
        case 'jpeg':
          transformer = transformer.jpeg({ quality, progressive });
          break;
        case 'png':
          transformer = transformer.png({ quality, progressive });
          break;
        case 'webp':
          transformer = transformer.webp({ quality });
          break;
        case 'tiff':
          transformer = transformer.tiff({ quality });
          break;
        case 'avif':
          transformer = transformer.avif({ quality });
          break;
      }
    }

    const { data: buffer, info } = await transformer.toBuffer({ resolveWithObject: true });
    return { buffer, info };
  }

  async resizeImage(
    file: UploadableFile,
    options: {
      width?: number;
      height?: number;
      fit?: keyof sharp.FitEnum;
      withoutEnlargement?: boolean;
    }
  ): Promise<{ buffer: Buffer; info: sharp.OutputInfo }> {
    if (!file.filepath) {
      throw new Error('File path is required for resizing');
    }

    const resizeOptions: sharp.ResizeOptions = {
      width: options.width,
      height: options.height,
      fit: options.fit || 'cover',
      withoutEnlargement: options.withoutEnlargement ?? true
    };

    const { data: buffer, info } = await sharp(file.filepath)
      .resize(resizeOptions)
      .toBuffer({ resolveWithObject: true });

    return { buffer, info };
  }

  async generateThumbnail(
    file: UploadableFile,
    size: number = 150
  ): Promise<{ buffer: Buffer; info: sharp.OutputInfo }> {
    return await this.resizeImage(file, {
      width: size,
      height: size,
      fit: 'cover'
    });
  }

  async generateResponsiveImages(
    file: UploadableFile,
    breakpoints: number[] = CONFIG.RESPONSIVE_BREAKPOINTS
  ): Promise<Record<string, { buffer: Buffer; info: sharp.OutputInfo }>> {
    const responsive: Record<string, { buffer: Buffer; info: sharp.OutputInfo }> = {};

    for (const breakpoint of breakpoints) {
      try {
        const result = await this.resizeImage(file, {
          width: breakpoint,
          withoutEnlargement: true
        });
        responsive[`w${breakpoint}`] = result;
      } catch (error) {
        this.logger.warn('Failed to generate responsive image', { 
          breakpoint, 
          filename: file.name, 
          error 
        });
      }
    }

    return responsive;
  }

  async processImage(
    file: UploadableFile,
    options: ProcessingOptions = {}
  ): Promise<Partial<UploadableFile>> {
    if (!file.mime.startsWith('image/')) {
      return {};
    }

    const format = file.ext.replace('.', '');
    if (!this.FORMATS_TO_PROCESS.includes(format)) {
      this.logger.info('Skipping processing for unsupported format', { format, filename: file.name });
      return {};
    }

    const result: Partial<UploadableFile> = {
      formats: {}
    };

    try {
      // Generate thumbnail
      if (CONFIG.GENERATE_THUMBNAILS) {
        const thumbnail = await this.generateThumbnail(file);
        result.formats!.thumbnail = {
          name: `thumbnail_${file.name}`,
          hash: `thumbnail_${file.hash}`,
          ext: file.ext,
          mime: file.mime,
          width: thumbnail.info.width,
          height: thumbnail.info.height,
          size: thumbnail.info.size
        };
      }

      // Generate responsive images
      if (options.responsive !== false) {
        const breakpoints = options.breakpoints || CONFIG.RESPONSIVE_BREAKPOINTS;
        const responsiveImages = await this.generateResponsiveImages(file, breakpoints);
        
        for (const [key, image] of Object.entries(responsiveImages)) {
          result.formats![key] = {
            name: `${key}_${file.name}`,
            hash: `${key}_${file.hash}`,
            ext: file.ext,
            mime: file.mime,
            width: image.info.width,
            height: image.info.height,
            size: image.info.size
          };
        }
      }

      // Optimize main image
      if (this.isOptimizableFormat(format)) {
        const optimized = await this.optimizeImage(file, {
          quality: options.quality,
          progressive: options.progressive
        });
        
        // Update file size if optimization reduced it
        if (optimized.info.size < file.size) {
          result.size = optimized.info.size;
        }
      }

      this.logger.info('Image processed successfully', { 
        filename: file.name,
        formats: Object.keys(result.formats || {}),
        originalSize: file.size,
        optimizedSize: result.size
      });

      return result;
    } catch (error) {
      this.logger.error('Image processing failed', { 
        filename: file.name,
        error 
      });
      throw new Error(`Image processing failed: ${error.message}`);
    }
  }

  async convertFormat(
    file: UploadableFile,
    targetFormat: 'jpeg' | 'png' | 'webp' | 'avif'
  ): Promise<{ buffer: Buffer; info: sharp.OutputInfo }> {
    if (!file.filepath) {
      throw new Error('File path is required for format conversion');
    }

    let transformer = sharp(file.filepath);

    switch (targetFormat) {
      case 'jpeg':
        transformer = transformer.jpeg({ quality: CONFIG.IMAGE_QUALITY });
        break;
      case 'png':
        transformer = transformer.png();
        break;
      case 'webp':
        transformer = transformer.webp({ quality: CONFIG.IMAGE_QUALITY });
        break;
      case 'avif':
        transformer = transformer.avif({ quality: CONFIG.IMAGE_QUALITY });
        break;
    }

    const { data: buffer, info } = await transformer.toBuffer({ resolveWithObject: true });
    return { buffer, info };
  }
}
