"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const fs_1 = require("fs");
const path_1 = require("path");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Database configuration for Render.com
// const dbConfig = {
//   user: process.env.DB_USER || 'jtest_db_user',
//   host: process.env.DB_HOST || 'dpg-d1kkh4je5dus73emq3o0-a.oregon-postgres.render.com',
//   database: process.env.DB_NAME || 'jtest_db',
//   password: process.env.DB_PASSWORD || '6nBRHGo5wSxNSDqkDPAFjpctqt6ZtpAA',
//   port: Number(process.env.DB_PORT) || 5432,
//   ssl: {
//     rejectUnauthorized: false
//   }
// };
const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'jtest_db',
    password: process.env.DB_PASSWORD || '1',
    port: Number(process.env.DB_PORT) || 5432,
    ssl: {
        rejectUnauthorized: false
    }
};
const pool = new pg_1.Pool(dbConfig);
const setupDatabase = async () => {
    try {
        console.log('Connecting to PostgreSQL database...');
        // Test connection
        const client = await pool.connect();
        console.log('✅ Connected to database successfully');
        // Enable pgvector extension
        console.log('Enabling pgvector extension...');
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
        console.log('✅ pgvector extension enabled');
        // Read and execute schema
        console.log('Reading database schema...');
        const schemaPath = (0, path_1.join)(__dirname, '..', 'dbschema.txt');
        const schema = (0, fs_1.readFileSync)(schemaPath, 'utf8');
        // Split schema into individual statements
        const statements = schema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        console.log(`Executing ${statements.length} schema statements...`);
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.trim()) {
                try {
                    await client.query(statement);
                    console.log(`✅ Statement ${i + 1} executed successfully`);
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    console.error(`❌ Error executing statement ${i + 1}:`, errorMessage);
                    console.error('Statement:', statement);
                }
            }
        }
        console.log('✅ Database schema setup completed!');
        // Verify tables were created
        const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
        const tablesResult = await client.query(tablesQuery);
        console.log('\n📋 Created tables:');
        tablesResult.rows.forEach((row) => {
            console.log(`  - ${row.table_name}`);
        });
        client.release();
        await pool.end();
    }
    catch (error) {
        console.error('❌ Database setup failed:', error);
        process.exit(1);
    }
};
// Run the setup
setupDatabase();
