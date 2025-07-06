"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldLogs = exports.getLogs = exports.logSecurityEvent = exports.logPerformance = exports.logProactiveTrigger = exports.logWebhookEvent = exports.logTaskOperation = exports.logAIInteraction = exports.logDebug = exports.logInfo = exports.logWarn = exports.logError = exports.logToDatabase = void 0;
// utils/logger.ts
const winston_1 = __importDefault(require("winston"));
const db_1 = __importDefault(require("../config/db"));
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
winston_1.default.addColors(colors);
// Define which level to log based on environment
const level = () => {
    const env = process.env.NODE_ENV || 'development';
    const isDevelopment = env === 'development';
    return isDevelopment ? 'debug' : 'warn';
};
// Define format for logs
const format = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`));
// Define transports
const transports = [
    new winston_1.default.transports.Console(),
    new winston_1.default.transports.File({
        filename: 'logs/error.log',
        level: 'error',
    }),
    new winston_1.default.transports.File({ filename: 'logs/all.log' }),
];
// Create the logger
const logger = winston_1.default.createLogger({
    level: level(),
    levels,
    format,
    transports,
});
// Database logging functions
const logToDatabase = async (level, message, metadata = {}, userId) => {
    try {
        await db_1.default.query(`INSERT INTO application_logs (level, message, metadata, user_id, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, [level, message, JSON.stringify(metadata), userId]);
    }
    catch (error) {
        console.error('Failed to log to database:', error);
    }
};
exports.logToDatabase = logToDatabase;
// Enhanced logging functions with database storage
const logError = async (message, error, metadata, userId) => {
    const logData = {
        message,
        error: error?.message,
        stack: error?.stack,
        ...metadata
    };
    logger.error(message, logData);
    await (0, exports.logToDatabase)('error', message, logData, userId);
};
exports.logError = logError;
const logWarn = async (message, metadata, userId) => {
    logger.warn(message, metadata);
    await (0, exports.logToDatabase)('warn', message, metadata, userId);
};
exports.logWarn = logWarn;
const logInfo = async (message, metadata, userId) => {
    logger.info(message, metadata);
    await (0, exports.logToDatabase)('info', message, metadata, userId);
};
exports.logInfo = logInfo;
const logDebug = async (message, metadata, userId) => {
    logger.debug(message, metadata);
    await (0, exports.logToDatabase)('debug', message, metadata, userId);
};
exports.logDebug = logDebug;
// Specialized logging for AI operations
const logAIInteraction = async (userId, input, output, metadata) => {
    const logData = {
        input: input.substring(0, 500), // Truncate long inputs
        output: output.substring(0, 500), // Truncate long outputs
        ...metadata
    };
    await (0, exports.logToDatabase)('info', 'AI Interaction', logData, userId);
};
exports.logAIInteraction = logAIInteraction;
// Logging for task operations
const logTaskOperation = async (userId, taskId, operation, status, metadata) => {
    const logData = {
        taskId,
        operation,
        status,
        ...metadata
    };
    await (0, exports.logToDatabase)('info', `Task ${operation}`, logData, userId);
};
exports.logTaskOperation = logTaskOperation;
// Logging for webhook operations
const logWebhookEvent = async (source, eventType, userId, metadata) => {
    const logData = {
        source,
        eventType,
        ...metadata
    };
    await (0, exports.logToDatabase)('info', `Webhook: ${source} ${eventType}`, logData, userId);
};
exports.logWebhookEvent = logWebhookEvent;
// Logging for proactive agent triggers
const logProactiveTrigger = async (userId, triggerType, tasksCreated, metadata) => {
    const logData = {
        triggerType,
        tasksCreated,
        ...metadata
    };
    await (0, exports.logToDatabase)('info', `Proactive Agent Triggered`, logData, userId);
};
exports.logProactiveTrigger = logProactiveTrigger;
// Performance logging
const logPerformance = async (operation, duration, userId, metadata) => {
    const logData = {
        operation,
        duration,
        ...metadata
    };
    if (duration > 5000) { // Log slow operations as warnings
        await (0, exports.logToDatabase)('warn', `Slow operation: ${operation}`, logData, userId);
    }
    else {
        await (0, exports.logToDatabase)('debug', `Performance: ${operation}`, logData, userId);
    }
};
exports.logPerformance = logPerformance;
// Security logging
const logSecurityEvent = async (eventType, userId, ip, metadata) => {
    const logData = {
        eventType,
        ip,
        ...metadata
    };
    await (0, exports.logToDatabase)('warn', `Security Event: ${eventType}`, logData, userId);
};
exports.logSecurityEvent = logSecurityEvent;
// Get logs from database
const getLogs = async (userId, level, limit = 100, offset = 0) => {
    let query = 'SELECT * FROM application_logs WHERE 1=1';
    const params = [];
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
    const result = await db_1.default.query(query, params);
    return result.rows;
};
exports.getLogs = getLogs;
// Clean up old logs
const cleanupOldLogs = async (daysOld = 30) => {
    try {
        await db_1.default.query('DELETE FROM application_logs WHERE created_at < NOW() - INTERVAL $1 days', [daysOld]);
        logger.info(`Cleaned up logs older than ${daysOld} days`);
    }
    catch (error) {
        logger.error('Failed to cleanup old logs:', error);
    }
};
exports.cleanupOldLogs = cleanupOldLogs;
// Export the main logger instance
exports.default = logger;
