// config/db.ts
import { Pool } from 'pg';
import logger from '../utils/logger';
import { DB_CONFIG } from '../utils/constants';

const pool = new Pool(DB_CONFIG);

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