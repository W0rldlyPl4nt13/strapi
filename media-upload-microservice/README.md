# Media Upload Microservice

A standalone media upload microservice extracted from Strapi, providing robust file upload, processing, and storage capabilities.

## Features

- **Multiple Storage Providers**: Local filesystem, AWS S3, and Cloudinary support
- **Image Processing**: Automatic optimization, resizing, and format conversion using Sharp
- **File Validation**: Comprehensive file type, size, and security validation
- **Folder Management**: Hierarchical folder structure for organized storage
- **Responsive Images**: Automatic generation of multiple image sizes
- **REST API**: Complete REST API for file management
- **Database Integration**: PostgreSQL with Prisma ORM
- **Docker Support**: Production-ready Docker configuration

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (or use Docker Compose)
- Optional: AWS S3 or Cloudinary account for cloud storage

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd media-upload-microservice

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env file with your configuration
# At minimum, configure DATABASE_URL

# Run database migrations
npx prisma migrate dev

# Start the development server
npm run dev
```

### Docker Deployment

```bash
# Start with Docker Compose (includes PostgreSQL)
docker-compose up -d

# Or build and run manually
docker build -t media-upload-service .
docker run -p 3000:3000 media-upload-service
```

## API Endpoints

### Upload Files

```bash
# Upload single file
curl -X POST http://localhost:3000/api/upload \
  -F "file=@image.jpg" \
  -F "fileInfo={\"alternativeText\":\"My image\"}"

# Upload multiple files
curl -X POST http://localhost:3000/api/upload/multiple \
  -F "files=@image1.jpg" \
  -F "files=@image2.jpg"
```

### File Management

```bash
# Get all files
GET /api/files?page=1&limit=20&sort=createdAt:desc

# Get single file
GET /api/files/:id

# Update file metadata
PUT /api/files/:id
{
  "name": "New name",
  "alternativeText": "Updated alt text"
}

# Delete file
DELETE /api/files/:id

# Bulk delete
DELETE /api/files
{
  "ids": ["file1", "file2"]
}
```

### Folder Management

```bash
# Get all folders
GET /api/folders

# Create folder
POST /api/folders
{
  "name": "My Folder",
  "parent": "parent-folder-id"
}

# Delete folder
DELETE /api/folders/:id
```

## Configuration

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/media_upload

# Storage Provider
STORAGE_PROVIDER=local  # local, aws-s3, cloudinary

# AWS S3 (if using S3)
AWS_S3_BUCKET=your-bucket
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Cloudinary (if using Cloudinary)
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# File Upload Limits
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_TYPES=image/jpeg,image/png,image/gif

# Image Processing
IMAGE_QUALITY=80
GENERATE_THUMBNAILS=true
RESPONSIVE_BREAKPOINTS=480,768,1024,1920
```

### Storage Providers

#### Local Storage
Default provider that stores files on the local filesystem.

#### AWS S3
Stores files in Amazon S3 buckets with support for:
- Multipart uploads
- Pre-signed URLs
- Automatic public URL generation

#### Cloudinary
Cloud-based image and video processing with:
- Automatic optimization
- On-the-fly transformations
- CDN delivery

## Image Processing

The service automatically processes uploaded images:

- **Optimization**: Reduces file size while maintaining quality
- **Format Conversion**: Supports JPEG, PNG, WebP, AVIF
- **Responsive Images**: Generates multiple sizes for different breakpoints
- **Thumbnails**: Creates small preview images
- **Metadata Extraction**: Extracts EXIF data and dimensions

## API Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation completed successfully"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Database Schema

The service uses PostgreSQL with two main tables:

### Files Table
- `id`: Unique identifier
- `name`: Original filename
- `alternativeText`: Alt text for images
- `caption`: Image caption
- `folder`: Folder ID
- `hash`: Unique hash for file identification
- `ext`: File extension
- `mime`: MIME type
- `size`: File size in bytes
- `url`: Public URL
- `provider`: Storage provider name
- `width/height`: Image dimensions
- `formats`: JSON with responsive image data

### Folders Table
- `id`: Unique identifier
- `name`: Folder name
- `path`: Full folder path
- `parent`: Parent folder ID

## Security Features

- File type validation
- File size limits
- Filename sanitization
- CORS configuration
- Helmet.js security headers
- Input validation with Joi

## Monitoring

The service includes:
- Health check endpoint: `GET /api/health`
- Structured logging with Winston
- Docker health checks
- Graceful shutdown handling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License
