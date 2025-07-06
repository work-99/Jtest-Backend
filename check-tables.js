const pool = require('./dist/config/db');

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('Available tables:');
    result.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    // Check if embeddings table exists
    const embeddingsResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'embeddings'
      );
    `);
    
    console.log('\nEmbeddings table exists:', embeddingsResult.rows[0].exists);
    
  } catch (error) {
    console.error('Error checking tables:', error);
  } finally {
    await pool.end();
  }
}

checkTables(); 