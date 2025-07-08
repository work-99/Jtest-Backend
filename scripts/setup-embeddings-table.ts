import pool from '../src/config/db';

async function setupEmbeddingsTable() {
  try {
    console.log('Setting up embeddings table with pgvector...');
    
    // Enable pgvector extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✓ pgvector extension enabled');
    
    // Create unified embeddings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        embedding vector(1536),
        metadata JSONB,
        source VARCHAR(50) NOT NULL, -- 'email', 'contact', 'conversation'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ embeddings table created');
    
    // Create indexes for better performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_embeddings_user_id ON embeddings(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON embeddings(created_at);');
    
    // Create vector similarity search index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_vector 
      ON embeddings USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = 100);
    `);
    console.log('✓ vector similarity index created');
    
    // Create function to update updated_at timestamp
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    
    // Create trigger for updated_at
    await pool.query(`
      DROP TRIGGER IF EXISTS update_embeddings_updated_at ON embeddings;
      CREATE TRIGGER update_embeddings_updated_at
        BEFORE UPDATE ON embeddings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✓ triggers created');
    
    console.log('✓ Embeddings table setup complete!');
    
  } catch (error) {
    console.error('Error setting up embeddings table:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

setupEmbeddingsTable().catch(console.error); 