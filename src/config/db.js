"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
// config/db.ts
const pg_1 = require("pg");
const logger_1 = __importDefault(require("../utils/logger"));
const constants_1 = require("../utils/constants");
const pool = new pg_1.Pool(constants_1.DB_CONFIG);
// Enable pgvector extension
const setupVectorExtension = async () => {
    try {
        await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
        logger_1.default.info('pgvector extension enabled');
    }
    catch (error) {
        logger_1.default.error('Failed to enable pgvector extension:', error);
    }
};
const connectDB = async () => {
    try {
        await pool.connect();
        await setupVectorExtension();
        logger_1.default.info('PostgreSQL connected');
    }
    catch (error) {
        logger_1.default.error('PostgreSQL connection error:', error);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
exports.default = pool;
