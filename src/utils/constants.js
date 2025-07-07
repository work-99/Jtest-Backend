"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RATE_LIMIT_MAX_REQUESTS = exports.RATE_LIMIT_WINDOW_MS = exports.OPENAI_API_KEY = exports.FRONTEND_URL = exports.API_BASE_URL = exports.HUBSPOT_CONFIG = exports.GOOGLE_CONFIG = exports.JWT_EXPIRES_IN = exports.JWT_SECRET = exports.DB_CONFIG = exports.NODE_ENV = exports.PORT = void 0;
// utils/constants.ts
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.PORT = process.env.PORT || 3001;
exports.NODE_ENV = process.env.NODE_ENV || 'development';
// Database constants (Render PostgreSQL)
exports.DB_CONFIG = {
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
exports.JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
exports.JWT_EXPIRES_IN = '7d';
// OAuth constants
exports.GOOGLE_CONFIG = {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback',
};
exports.HUBSPOT_CONFIG = {
    clientId: process.env.HUBSPOT_CLIENT_ID || '',
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET || '',
    callbackUrl: process.env.HUBSPOT_CALLBACK_URL || 'http://localhost:3001/auth/hubspot/callback',
};
// API constants
exports.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
exports.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
// OpenAI constants
exports.OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
// Rate limiting
exports.RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
exports.RATE_LIMIT_MAX_REQUESTS = 100; // requests per window 
