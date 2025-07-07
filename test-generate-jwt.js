const pool = require('./src/config/db').default || require('./src/config/db');
const jwt = require('jsonwebtoken');

(async () => {
  try {
    const { rows } = await pool.query('SELECT id, email, role FROM users LIMIT 1');
    if (!rows.length) {
      console.error('No users found in the database.');
      process.exit(1);
    }
    const user = rows[0];
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      secret,
      { expiresIn: '7d' }
    );
    console.log('User:', user);
    console.log('JWT Token:', token);
    process.exit(0);
  } catch (err) {
    console.error('Error generating JWT:', err);
    process.exit(1);
  }
})(); 