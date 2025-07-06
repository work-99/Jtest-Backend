// utils/constants.ts
import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT || 3001;
export const NODE_ENV = process.env.NODE_ENV || 'development';

// Database constants (Render PostgreSQL)
export const DB_CONFIG = {
  host: process.env.DB_HOST || 'dpg-d1kkh4je5dus73emq3o0-a.oregon-postgres.render.com',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'jtest_db',
  user: process.env.DB_USER || 'jtest_db_user',
  password: process.env.DB_PASSWORD || '6nBRHGo5wSxNSDqkDPAFjpctqt6ZtpAA',
  ssl: {
    rejectUnauthorized: false,
    mode: 'prefer'
  }
};

// JWT constants
export const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
export const JWT_EXPIRES_IN = '7d';

// OAuth constants
export const GOOGLE_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback',
};

export const HUBSPOT_CONFIG = {
  clientId: process.env.HUBSPOT_CLIENT_ID || '',
  clientSecret: process.env.HUBSPOT_CLIENT_SECRET || '',
  callbackUrl: process.env.HUBSPOT_CALLBACK_URL || 'http://localhost:3001/auth/hubspot/callback',
};

// API constants
export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// OpenAI constants
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Rate limiting
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX_REQUESTS = 100; // requests per window 