import cors from 'cors';
import { CONFIG } from '@/config';

const corsOptions = {
  origin: CONFIG.CORS_ORIGIN === '*' ? true : CONFIG.CORS_ORIGIN.split(','),
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

export const corsMiddleware = cors(corsOptions);
