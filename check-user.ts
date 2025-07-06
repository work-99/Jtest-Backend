import pool from './src/config/db';

async function checkAndCreateUser() {
  try {
    console.log('Checking for user: vergiegpham@gmail.com');
    
    // Check if user exists
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      ['vergiegpham@gmail.com']
    );
    
    if (rows.length > 0) {
      console.log('✅ User found:', rows[0]);
    } else {
      console.log('❌ User not found. Creating...');
      
      // Create the user with proper ID handling
      const { rows: newUser } = await pool.query(
        'INSERT INTO users (email, name, role) VALUES ($1, $2, $3) RETURNING *',
        ['vergiegpham@gmail.com', 'Vergie G Pham', 'user']
      );
      
      console.log('✅ User created:', newUser[0]);
    }
    
    // Get the user ID
    const { rows: userRows } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['vergiegpham@gmail.com']
    );
    
    if (userRows.length === 0) {
      console.log('❌ Could not find user after creation');
      return;
    }
    
    const userId = userRows[0].id;
    console.log(`User ID: ${userId}`);
    
    // Check for Google credentials
    const { rows: credentials } = await pool.query(
      'SELECT * FROM user_credentials WHERE user_id = $1 AND service = $2',
      [userId, 'google']
    );
    
    if (credentials.length > 0) {
      console.log('✅ Google credentials found:', {
        hasAccessToken: !!credentials[0].access_token,
        hasRefreshToken: !!credentials[0].refresh_token,
        expiryDate: credentials[0].expiry_date
      });
    } else {
      console.log('❌ No Google credentials found for this user');
      console.log('\nTo set up Google OAuth for this user:');
      console.log('1. Make sure your .env file has the correct Google OAuth credentials');
      console.log('2. Start the backend server: npm run dev');
      console.log('3. Visit: http://localhost:3001/api/auth/google');
      console.log('4. Complete the OAuth flow with vergiegpham@gmail.com');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAndCreateUser(); 