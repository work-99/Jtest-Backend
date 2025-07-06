import pool from './src/config/db';

async function insertMockUser() {
  try {
    // Insert user with id=1 if not exists
    await pool.query(`
      INSERT INTO users (id, email, name, role, provider, provider_id)
      VALUES (1, 'test@example.com', 'Test User', 'user', 'mock', 'mock-1')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Mock user inserted (or already exists).');
  } catch (error) {
    console.error('Error inserting mock user:', error);
  } finally {
    await pool.end();
  }
}

insertMockUser(); 