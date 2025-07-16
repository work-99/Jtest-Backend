import { GmailService } from './src/services/gmail.service';
import { searchContacts } from './src/services/hubspot.service';
import { processProactiveEvent, getUserInstructions } from './src/services/ai.service';
import pool from './src/config/db';

async function debugEmailProcessing() {
  try {
    console.log('=== Debugging Email Processing for User 4 ===\n');
    
    const userId = '4';
    
    // Check if user 4 has Gmail credentials
    console.log('--- Checking Gmail Credentials ---');
    const { rows } = await pool.query(
      "SELECT * FROM user_credentials WHERE user_id = $1 AND service = 'google'",
      [userId]
    );
    
    if (rows.length === 0) {
      console.log('❌ User 4 has no Gmail credentials');
      return;
    }
    
    console.log('✅ User 4 has Gmail credentials');
    console.log('Token expires at:', rows[0].expires_at);
    
    // Get recent emails for user 4
    console.log('\n--- Checking Recent Emails ---');
    try {
      const emails = await GmailService.listEmails(Number(userId), 5);
      console.log(`Found ${emails.length} recent emails`);
      
      const akiEmail = emails.find(e => e.from === 'aki98747@proton.me');
      if (akiEmail) {
        console.log('✅ Found email from aki98747@proton.me:');
        console.log(`- Subject: ${akiEmail.subject}`);
        console.log(`- Date: ${akiEmail.date}`);
        console.log(`- ID: ${akiEmail.id}`);
      } else {
        console.log('❌ No email found from aki98747@proton.me');
        console.log('Recent emails:');
        emails.forEach(e => {
          console.log(`- From: ${e.from}, Subject: ${e.subject}, Date: ${e.date}`);
        });
      }
    } catch (error) {
      console.log('❌ Error checking emails:', error);
      return;
    }
    
    // Check if aki98747@proton.me is already in HubSpot
    console.log('\n--- Checking HubSpot Contacts ---');
    const contacts = await searchContacts(userId, 'aki98747@proton.me');
    const akiContact = contacts.find(c => c.properties?.email === 'aki98747@proton.me');
    
    if (akiContact) {
      console.log('✅ Contact already exists in HubSpot:');
      console.log(`- ID: ${akiContact.id}`);
      console.log(`- Created: ${akiContact.properties?.createdate}`);
      console.log(`- Name: ${akiContact.properties?.firstname} ${akiContact.properties?.lastname}`);
    } else {
      console.log('❌ Contact not found in HubSpot');
    }
    
    // Check user 4's instructions
    console.log('\n--- Checking User Instructions ---');
    const instructions = await getUserInstructions(userId);
    console.log('Instructions:', instructions);
    
    // Test the proactive event processing
    console.log('\n--- Testing Proactive Event Processing ---');
    const eventData = {
      from: 'aki98747@proton.me',
      subject: 'Test email',
      body: 'This is a test email',
      date: new Date().toISOString()
    };
    
    try {
      const result = await processProactiveEvent(userId, 'new_email', eventData, instructions);
      console.log('Proactive event result:', result);
    } catch (error) {
      console.log('❌ Error in proactive event processing:', error);
    }
    
    // Check email poller state
    console.log('\n--- Checking Email Poller State ---');
    const { rows: emailRows } = await pool.query(
      "SELECT * FROM user_credentials WHERE service = 'google' AND user_id = $1",
      [userId]
    );
    console.log('Gmail credentials:', emailRows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugEmailProcessing().catch(console.error); 