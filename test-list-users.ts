import pool from './src/config/db';

async function listUsers() {
  try {
    const result = await pool.query('SELECT id, email, name, role FROM users ORDER BY id');
    console.log('Users:');
    result.rows.forEach(row => {
      console.log(row);
    });
  } catch (error) {
    console.error('Error listing users:', error);
  } finally {
    await pool.end();
  }
}

listUsers(); 