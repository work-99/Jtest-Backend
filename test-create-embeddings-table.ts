import pool from './src/config/db';

async function createEmbeddingsTable() {
  try {
    // Create the embeddings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        embedding vector(1536),
        metadata JSONB,
        source VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_user_id ON embeddings(user_id);
      CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source);
    `);
    
    // Create vector similarity search index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_vector 
      ON embeddings USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = 100);
    `);
    
    console.log('Embeddings table created successfully!');
    
  } catch (error) {
    console.error('Error creating embeddings table:', error);
  } finally {
    await pool.end();
  }
}

createEmbeddingsTable(); 