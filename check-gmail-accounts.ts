import pool from './src/config/db';

async function checkGmailAccounts() {
  try {
    console.log('=== Checking Gmail Account Associations ===\n');
    
    // First, let's see what columns exist in the user_credentials table
    console.log('=== Database Schema Check ===\n');
    
    const { rows: columns } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_credentials' 
      ORDER BY ordinal_position
    `);
    
    console.log('user_credentials table columns:');
    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    console.log('');
    
    // Get all users with Gmail credentials
    const { rows: gmailUsers } = await pool.query(
      "SELECT user_id, access_token, refresh_token, expires_at FROM user_credentials WHERE service = 'google' ORDER BY user_id"
    );
    
    console.log(`Found ${gmailUsers.length} users with Gmail credentials:\n`);
    
    for (const user of gmailUsers) {
      console.log(`User ID: ${user.user_id}`);
      console.log(`  Has access token: ${user.access_token ? 'Yes' : 'No'}`);
      console.log(`  Has refresh token: ${user.refresh_token ? 'Yes' : 'No'}`);
      console.log(`  Expires at: ${user.expires_at}`);
      console.log('');
    }
    
    // Also check HubSpot users for comparison
    console.log('=== HubSpot Account Associations ===\n');
    
    const { rows: hubspotUsers } = await pool.query(
      "SELECT user_id, access_token, refresh_token, expires_at FROM user_credentials WHERE service = 'hubspot' ORDER BY user_id"
    );
    
    console.log(`Found ${hubspotUsers.length} users with HubSpot credentials:\n`);
    
    for (const user of hubspotUsers) {
      console.log(`User ID: ${user.user_id}`);
      console.log(`  Has access token: ${user.access_token ? 'Yes' : 'No'}`);
      console.log(`  Has refresh token: ${user.refresh_token ? 'Yes' : 'No'}`);
      console.log(`  Expires at: ${user.expires_at}`);
      console.log('');
    }
    
    // Check if there are any users with both Gmail and HubSpot
    console.log('=== Users with Both Gmail and HubSpot ===\n');
    
    const { rows: bothUsers } = await pool.query(`
      SELECT DISTINCT g.user_id
      FROM user_credentials g
      JOIN user_credentials h ON g.user_id = h.user_id
      WHERE g.service = 'google' AND h.service = 'hubspot'
      ORDER BY g.user_id
    `);
    
    console.log(`Found ${bothUsers.length} users with both Gmail and HubSpot:`);
    bothUsers.forEach(user => {
      console.log(`  User ID: ${user.user_id}`);
    });
    console.log('');
    
    // Check if there's a pattern - maybe user 5 is the only one with Gmail credentials
    console.log('=== Gmail Credentials Analysis ===\n');
    
    if (gmailUsers.length === 1) {
      console.log('⚠️  Only one user has Gmail credentials!');
      console.log(`This means all emails are being sent from user ${gmailUsers[0].user_id}`);
      console.log('This could explain why user 5 is sending emails for user 4\'s contacts.');
    } else {
      console.log(`✅ Multiple users (${gmailUsers.length}) have Gmail credentials`);
    }
    
  } catch (error) {
    console.error('Error checking accounts:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkGmailAccounts().catch(console.error); 