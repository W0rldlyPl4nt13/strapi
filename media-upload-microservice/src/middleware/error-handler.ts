import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@/types';
import { Logger } from '@/utils/logger';

const logger = new Logger('ErrorHandler');

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Multer errors
  if (error.message.includes('File too large')) {
    return res.status(413).json({
      success: false,
      error: 'File size exceeds maximum limit'
    } as ApiResponse);
  }

  if (error.message.includes('Unexpected field')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid file field name'
    } as ApiResponse);
  }

  if (error.message.includes('Too many files')) {
    return res.status(400).json({
      success: false,
      error: 'Too many files uploaded'
    } as ApiResponse);
  }

  // Validation errors
  if (error.message.includes('validation') || error.message.includes('required')) {
    return res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }

  // Database errors
  if (error.message.includes('Unique constraint')) {
    return res.status(409).json({
      success: false,
      error: 'Resource already exists'
    } as ApiResponse);
  }

  if (error.message.includes('Record not found')) {
    return res.status(404).json({
      success: false,
      error: 'Resource not found'
    } as ApiResponse);
  }

  // Storage provider errors
  if (error.message.includes('AWS') || error.message.includes('S3')) {
    return res.status(503).json({
      success: false,
      error: 'Storage service unavailable'
    } as ApiResponse);
  }

  if (error.message.includes('Cloudinary')) {
    return res.status(503).json({
      success: false,
      error: 'Image processing service unavailable'
    } as ApiResponse);
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  } as ApiResponse);
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  } as ApiResponse);
};
