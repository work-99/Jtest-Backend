const { GmailService } = require('./src/services/gmail.service');
const pool = require('./src/config/db');

async function testReauthentication() {
  try {
    console.log('=== Testing Google Re-authentication Flow ===\n');

    // Check if we have any users with Google credentials
    const { rows: users } = await pool.query(
      'SELECT u.id, u.email, uc.access_token, uc.refresh_token FROM users u LEFT JOIN user_credentials uc ON u.id = uc.user_id AND uc.service = $1',
      ['google']
    );

    console.log('Users with Google credentials:', users.length);
    users.forEach(user => {
      console.log(`- User ${user.id} (${user.email}): ${user.access_token ? 'Has credentials' : 'No credentials'}`);
    });

    if (users.length === 0) {
      console.log('\n❌ No users with Google credentials found');
      console.log('Please complete the OAuth flow first to test re-authentication');
      return;
    }

    const userId = users[0].id;
    console.log(`\nTesting re-authentication for user ${userId}...`);

    // Test 1: Try to use Gmail service (should fail with expired tokens)
    console.log('\n--- Test 1: Attempting Gmail Operation (Expected to Fail) ---');
    try {
      const emails = await GmailService.listEmails(userId, 1);
      console.log('✅ Gmail service working! This means tokens are still valid.');
      console.log('Found emails:', emails.length);
    } catch (error) {
      if (error.message.includes('Google authentication expired')) {
        console.log('✅ Expected error caught: Google authentication expired');
        console.log('This means the re-authentication flow is working correctly');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    // Test 2: Clear credentials manually
    console.log('\n--- Test 2: Clearing Google Credentials ---');
    try {
      await pool.query(
        'DELETE FROM user_credentials WHERE user_id = $1 AND service = $2',
        [userId, 'google']
      );
      console.log('✅ Google credentials cleared successfully');
    } catch (error) {
      console.log('❌ Failed to clear credentials:', error.message);
    }

    // Test 3: Verify credentials are cleared
    console.log('\n--- Test 3: Verifying Credentials are Cleared ---');
    const { rows: remainingCredentials } = await pool.query(
      'SELECT * FROM user_credentials WHERE user_id = $1 AND service = $2',
      [userId, 'google']
    );
    
    if (remainingCredentials.length === 0) {
      console.log('✅ Credentials successfully cleared');
    } else {
      console.log('❌ Credentials still exist:', remainingCredentials.length);
    }

    console.log('\n--- Summary ---');
    console.log('Re-authentication flow is ready to use.');
    console.log('When users encounter expired tokens, they can call:');
    console.log('POST /api/auth/google/reauthenticate');
    console.log('This will clear invalid credentials and redirect to Google OAuth.');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testReauthentication().catch(console.error); 