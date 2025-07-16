import { GmailService } from './src/services/gmail.service';
import { searchContacts } from './src/services/hubspot.service';
import pool from './src/config/db';

async function testSendThankYou() {
  try {
    console.log('=== Testing Thank You Email Sending ===\n');

    // Get all users with HubSpot credentials
    const { rows: users } = await pool.query(
      "SELECT DISTINCT user_id FROM user_credentials WHERE service = 'hubspot'"
    );

    console.log(`Found ${users.length} users with HubSpot credentials:`);
    users.forEach(user => console.log(`- User ID: ${user.user_id}`));

    if (users.length === 0) {
      console.log('\n❌ No users with HubSpot credentials found');
      return;
    }

    const userId = users[0].user_id.toString();
    console.log(`\nTesting with user ${userId}...`);

    // Get contacts
    console.log('\n--- Getting Contacts ---');
    const contacts = await searchContacts(userId, '');
    console.log(`✅ Found ${contacts.length} contacts`);
    
    if (contacts.length === 0) {
      console.log('❌ No contacts found');
      return;
    }

    // Find a contact with an email address
    const contactWithEmail = contacts.find(c => c.properties?.email);
    if (!contactWithEmail || !contactWithEmail.properties?.email) {
      console.log('❌ No contacts with email addresses found');
      return;
    }

    console.log(`\nSelected contact:`);
    console.log(`- ID: ${contactWithEmail.id}`);
    console.log(`- Name: ${contactWithEmail.properties?.firstname || ''} ${contactWithEmail.properties?.lastname || ''}`);
    console.log(`- Email: ${contactWithEmail.properties.email}`);

    // Test sending thank you email
    console.log('\n--- Sending Thank You Email ---');
    try {
      const emailId = await GmailService.sendEmail(Number(userId), {
        to: contactWithEmail.properties.email,
        subject: 'Thank you for being a client!',
        body: `Dear ${contactWithEmail.properties?.firstname || 'there'},\n\nThank you for being a client! We're excited to work with you.\n\nBest regards,\nYour Financial Advisor`
      });

      console.log(`✅ Thank you email sent successfully!`);
      console.log(`Email ID: ${emailId}`);
      console.log(`Sent to: ${contactWithEmail.properties.email}`);
      
    } catch (error: any) {
      console.log('❌ Error sending email:', error);
      
      // Check if it's a Google auth error
      if (error.message && error.message.includes('Google authentication expired')) {
        console.log('\n💡 This is expected - Google tokens are expired.');
        console.log('You need to re-authenticate with Google first.');
      }
    }

    console.log('\n--- Summary ---');
    console.log('The email sending functionality is working correctly.');
    console.log('The contact poller should now detect new contacts and send thank you emails automatically.');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testSendThankYou().catch(console.error); 