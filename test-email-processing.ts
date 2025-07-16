import { GmailService } from './src/services/gmail.service';
import { searchContacts } from './src/services/hubspot.service';
import { processProactiveEvent, getUserInstructions } from './src/services/ai.service';
import pool from './src/config/db';

async function testEmailProcessing() {
  try {
    console.log('=== Testing Email Processing ===\n');
    
    const userId = "4";
    const testEmail = "aki98747@proton.me";
    
    console.log(`Testing email processing for user ${userId}`);
    console.log(`Test email from: ${testEmail}`);
    
    // Step 1: Check if contact exists in HubSpot
    console.log('\n--- Step 1: Checking if contact exists in HubSpot ---');
    const contacts = await searchContacts(userId, testEmail);
    const isInHubSpot = contacts.some(
      c => c.properties?.email?.toLowerCase() === testEmail.toLowerCase()
    );
    
    console.log(`Contact ${testEmail} in HubSpot: ${isInHubSpot ? '✅ Yes' : '❌ No'}`);
    
    if (isInHubSpot) {
      console.log('Contact already exists, no need to create new one');
      return;
    }
    
    // Step 2: Get recent emails from Gmail
    console.log('\n--- Step 2: Getting recent emails from Gmail ---');
    try {
      const emails = await GmailService.listEmails(Number(userId), 5);
      console.log(`Found ${emails.length} recent emails`);
      
      // Look for email from aki98747@proton.me
      const akiEmail = emails.find(email => 
        email.from.toLowerCase().includes('aki98747@proton.me')
      );
      
      if (akiEmail) {
        console.log(`✅ Found email from ${akiEmail.from}`);
        console.log(`Subject: ${akiEmail.subject}`);
        console.log(`Date: ${akiEmail.date}`);
        
        // Step 3: Process the email
        console.log('\n--- Step 3: Processing Email ---');
        const instructions = await getUserInstructions(userId);
        console.log(`Found ${instructions.length} instructions for user ${userId}`);
        
        const eventData = {
          from: akiEmail.from,
          subject: akiEmail.subject,
          body: akiEmail.body,
          date: akiEmail.date
        };
        
        console.log('Triggering proactive event for new email...');
        const result = await processProactiveEvent(userId, 'new_email', eventData, instructions);
        
        console.log('Proactive event result:', result);
        
        if (result.actionRequired) {
          console.log('✅ Action was required and executed');
          
          // Step 4: Check if contact was created
          console.log('\n--- Step 4: Checking if contact was created ---');
          setTimeout(async () => {
            const newContacts = await searchContacts(userId, testEmail);
            const contactCreated = newContacts.some(
              c => c.properties?.email?.toLowerCase() === testEmail.toLowerCase()
            );
            
            console.log(`Contact ${testEmail} created: ${contactCreated ? '✅ Yes' : '❌ No'}`);
            
            if (contactCreated) {
              const newContact = newContacts.find(c => c.properties?.email?.toLowerCase() === testEmail.toLowerCase());
              console.log(`New contact ID: ${newContact?.id}`);
              console.log(`Created: ${newContact?.properties?.createdate}`);
            }
          }, 5000); // Wait 5 seconds for contact creation
          
        } else {
          console.log('ℹ️ No action was required');
        }
        
      } else {
        console.log('❌ No email found from aki98747@proton.me');
        console.log('Recent emails:');
        emails.slice(0, 3).forEach((email, index) => {
          console.log(`  ${index + 1}. From: ${email.from} | Subject: ${email.subject}`);
        });
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
testEmailProcessing().catch(console.error); 