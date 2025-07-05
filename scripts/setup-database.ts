import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface TableRow {
  table_name: string;
}

// Database configuration for Render.com
const dbConfig = {
  user: process.env.DB_USER || 'jtest_db_user',
  host: process.env.DB_HOST || 'dpg-d1kkh4je5dus73emq3o0-a.oregon-postgres.render.com',
  database: process.env.DB_NAME || 'jtest_db',
  password: process.env.DB_PASSWORD || '6nBRHGo5wSxNSDqkDPAFjpctqt6ZtpAA',
  port: Number(process.env.DB_PORT) || 5432,
  ssl: {
    rejectUnauthorized: false
  }
};

const pool = new Pool(dbConfig);

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
    const schemaPath = join(__dirname, '..', 'dbschema.txt');
    const schema = readFileSync(schemaPath, 'utf8');
    
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
        } catch (error) {
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
    tablesResult.rows.forEach((row: TableRow) => {
      console.log(`  - ${row.table_name}`);
    });
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
};

// Run the setup
setupDatabase(); 