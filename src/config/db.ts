// config/db.ts
import { Pool } from 'pg';
import { logger } from '../utils/logger';

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});

// Enable pgvector extension
const setupVectorExtension = async () => {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    logger.info('pgvector extension enabled');
  } catch (error) {
    logger.error('Failed to enable pgvector extension:', error);
  }
};

export const connectDB = async () => {
  try {
    await pool.connect();
    await setupVectorExtension();
    logger.info('PostgreSQL connected');
  } catch (error) {
    logger.error('PostgreSQL connection error:', error);
    process.exit(1);
  }
};

export default pool;