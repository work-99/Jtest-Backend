import { GmailService } from './src/services/gmail.service';
import { searchContacts } from './src/services/hubspot.service';
import { processProactiveEvent, getUserInstructions } from './src/services/ai.service';
import pool from './src/config/db';

async function testEmailTrigger() {
  try {
    console.log('=== Testing Email Trigger for Contact Creation ===\n');
    
    const userId = "4";
    console.log(`Testing with user ${userId}...`);
    
    // Test 1: Check if user 4 has Gmail credentials
    console.log('\n--- Test 1: Checking Gmail Credentials ---');
    const gmailResult = await pool.query(
      'SELECT * FROM user_credentials WHERE user_id = $1 AND service = $2',
      [userId, 'google']
    );
    
    if (gmailResult.rows.length === 0) {
      console.log('❌ User 4 has no Gmail credentials');
      return;
    }
    
    console.log('✅ User 4 has Gmail credentials');
    
    // Test 2: Get recent emails
    console.log('\n--- Test 2: Getting Recent Emails ---');
    try {
      const emails = await GmailService.listEmails(Number(userId), 5);
      console.log(`✅ Found ${emails.length} recent emails`);
      
      if (emails.length > 0) {
        console.log('\nRecent emails:');
        emails.forEach((email, index) => {
          console.log(`${index + 1}. From: ${email.from} | Subject: ${email.subject} | Date: ${email.date}`);
        });
        
        // Test 3: Check if any recent emails are from unknown contacts
        console.log('\n--- Test 3: Checking for Unknown Contacts ---');
        for (const email of emails) {
          const contacts = await searchContacts(userId, email.from);
          const isInHubSpot = contacts.some(
            c => c.properties?.email?.toLowerCase() === email.from.toLowerCase()
          );
          
          console.log(`Email from ${email.from}: ${isInHubSpot ? '✅ In HubSpot' : '❌ NOT in HubSpot'}`);
          
          if (!isInHubSpot) {
            console.log(`\n🎯 Found unknown contact: ${email.from}`);
            console.log('This should trigger contact creation...');
            
            // Test 4: Simulate the email processing
            console.log('\n--- Test 4: Simulating Email Processing ---');
            const instructions = await getUserInstructions(userId);
            console.log(`Found ${instructions.length} instructions for user ${userId}`);
            
            const eventData = {
              from: email.from,
              subject: email.subject,
              body: email.body,
              date: email.date
            };
            
            console.log('Triggering proactive event for new email...');
            const result = await processProactiveEvent(userId, 'new_email', eventData, instructions);
            
            console.log('Proactive event result:', result);
            
            if (result.actionRequired) {
              console.log('✅ Action was required and executed');
            } else {
              console.log('ℹ️ No action was required');
            }
            
            break; // Only process the first unknown contact
          }
        }
      }
      
    } catch (error) {
      console.log('❌ Error getting emails:', error);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testEmailTrigger().catch(console.error); 