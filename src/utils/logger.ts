// utils/logger.ts
import winston from 'winston';
import pool from '../config/db';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({ filename: 'logs/all.log' }),
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

// Database logging functions
export const logToDatabase = async (
  level: string,
  message: string,
  metadata: any = {},
  userId?: number
) => {
  try {
    await pool.query(
      `INSERT INTO application_logs (level, message, metadata, user_id, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [level, message, JSON.stringify(metadata), userId]
    );
  } catch (error) {
    console.error('Failed to log to database:', error);
  }
};

// Enhanced logging functions with database storage
export const logError = async (message: string, error?: Error, metadata?: any, userId?: number) => {
  const logData = {
    message,
    error: error?.message,
    stack: error?.stack,
    ...metadata
  };
  
  logger.error(message, logData);
  await logToDatabase('error', message, logData, userId);
};

export const logWarn = async (message: string, metadata?: any, userId?: number) => {
  logger.warn(message, metadata);
  await logToDatabase('warn', message, metadata, userId);
};

export const logInfo = async (message: string, metadata?: any, userId?: number) => {
  logger.info(message, metadata);
  await logToDatabase('info', message, metadata, userId);
};

export const logDebug = async (message: string, metadata?: any, userId?: number) => {
  logger.debug(message, metadata);
  await logToDatabase('debug', message, metadata, userId);
};

// Specialized logging for AI operations
export const logAIInteraction = async (
  userId: number,
  input: string,
  output: string,
  metadata?: any
) => {
  const logData = {
    input: input.substring(0, 500), // Truncate long inputs
    output: output.substring(0, 500), // Truncate long outputs
    ...metadata
  };
  
  await logToDatabase('info', 'AI Interaction', logData, userId);
};

// Logging for task operations
export const logTaskOperation = async (
  userId: number,
  taskId: number,
  operation: string,
  status: string,
  metadata?: any
) => {
  const logData = {
    taskId,
    operation,
    status,
    ...metadata
  };
  
  await logToDatabase('info', `Task ${operation}`, logData, userId);
};

// Logging for webhook operations
export const logWebhookEvent = async (
  source: string,
  eventType: string,
  userId?: number,
  metadata?: any
) => {
  const logData = {
    source,
    eventType,
    ...metadata
  };
  
  await logToDatabase('info', `Webhook: ${source} ${eventType}`, logData, userId);
};

// Logging for proactive agent triggers
export const logProactiveTrigger = async (
  userId: number,
  triggerType: string,
  tasksCreated: number,
  metadata?: any
) => {
  const logData = {
    triggerType,
    tasksCreated,
    ...metadata
  };
  
  await logToDatabase('info', `Proactive Agent Triggered`, logData, userId);
};

// Performance logging
export const logPerformance = async (
  operation: string,
  duration: number,
  userId?: number,
  metadata?: any
) => {
  const logData = {
    operation,
    duration,
    ...metadata
  };
  
  if (duration > 5000) { // Log slow operations as warnings
    await logToDatabase('warn', `Slow operation: ${operation}`, logData, userId);
  } else {
    await logToDatabase('debug', `Performance: ${operation}`, logData, userId);
  }
};

// Security logging
export const logSecurityEvent = async (
  eventType: string,
  userId?: number,
  ip?: string,
  metadata?: any
) => {
  const logData = {
    eventType,
    ip,
    ...metadata
  };
  
  await logToDatabase('warn', `Security Event: ${eventType}`, logData, userId);
};

// Get logs from database
export const getLogs = async (
  userId?: number,
  level?: string,
  limit: number = 100,
  offset: number = 0
) => {
  let query = 'SELECT * FROM application_logs WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;
  
  if (userId) {
    query += ` AND user_id = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  }
  
  if (level) {
    query += ` AND level = $${paramIndex}`;
    params.push(level);
    paramIndex++;
  }
  
  query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);
  
  const result = await pool.query(query, params);
  return result.rows;
};

// Clean up old logs
export const cleanupOldLogs = async (daysOld: number = 30) => {
  try {
    await pool.query(
      'DELETE FROM application_logs WHERE created_at < NOW() - INTERVAL $1 days',
      [daysOld]
    );
    logger.info(`Cleaned up logs older than ${daysOld} days`);
  } catch (error) {
    logger.error('Failed to cleanup old logs:', error);
  }
};

// Export the main logger instance
export default logger;