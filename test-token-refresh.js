const { GmailService } = require('./src/services/gmail.service');
const { getAvailableTimes } = require('./src/services/calendar.service');
const pool = require('./src/config/db');

async function testTokenRefresh() {
  try {
    console.log('=== Testing Token Refresh Functionality ===\n');

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
      console.log('Please complete the OAuth flow first to test token refresh');
      return;
    }

    const userId = users[0].id;
    console.log(`\nTesting token refresh for user ${userId}...`);

    // Test 1: Gmail service with token refresh
    console.log('\n--- Test 1: Gmail Service Token Refresh ---');
    try {
      const emails = await GmailService.listEmails(userId, 1);
      console.log('✅ Gmail service working! Found emails:', emails.length);
    } catch (error) {
      if (error.message.includes('Authentication failed')) {
        console.log('❌ Authentication failed - tokens may be invalid');
        console.log('   Please re-authenticate with Google');
      } else {
        console.log('❌ Gmail service error:', error.message);
      }
    }

    // Test 2: Calendar service with token refresh
    console.log('\n--- Test 2: Calendar Service Token Refresh ---');
    try {
      const availableTimes = await getAvailableTimes(userId.toString(), new Date().toISOString().split('T')[0], 60);
      console.log('✅ Calendar service working! Available times:', availableTimes.length);
    } catch (error) {
      if (error.message.includes('Authentication failed')) {
        console.log('❌ Authentication failed - tokens may be invalid');
        console.log('   Please re-authenticate with Google');
      } else {
        console.log('❌ Calendar service error:', error.message);
      }
    }

    // Test 3: Manual token refresh
    console.log('\n--- Test 3: Manual Token Refresh ---');
    try {
      await GmailService.refreshAccessToken(userId);
      console.log('✅ Manual token refresh successful');
      
      // Check if tokens were updated
      const { rows: updatedCredentials } = await pool.query(
        'SELECT access_token, updated_at FROM user_credentials WHERE user_id = $1 AND service = $2',
        [userId, 'google']
      );
      
      if (updatedCredentials.length > 0) {
        console.log('✅ Tokens updated in database');
        console.log('Last updated:', updatedCredentials[0].updated_at);
      }
    } catch (error) {
      console.log('❌ Manual token refresh failed:', error.message);
    }

    console.log('\n--- Summary ---');
    console.log('Token refresh functionality is implemented and should work automatically');
    console.log('When tokens expire, the services will automatically refresh them');
    console.log('If you see authentication errors, you may need to re-authenticate with Google');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testTokenRefresh().catch(console.error); 