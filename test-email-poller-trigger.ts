import { GmailService } from './src/services/gmail.service';
import { searchContacts } from './src/services/hubspot.service';
import { processProactiveEvent, getUserInstructions } from './src/services/ai.service';
import pool from './src/config/db';

async function testEmailPollerTrigger() {
  try {
    console.log('=== Testing Email Poller Trigger ===\n');
    
    const userId = '4';
    const targetEmailId = '198125e771567d52'; // The Test5 email ID
    
    // Get the specific email
    console.log('--- Getting Specific Email ---');
    const emails = await GmailService.listEmails(Number(userId), 5);
    const targetEmail = emails.find(e => e.id === targetEmailId);
    
    if (!targetEmail) {
      console.log('❌ Target email not found');
      return;
    }
    
    console.log('✅ Found target email:');
    console.log(`- From: ${targetEmail.from}`);
    console.log(`- Subject: ${targetEmail.subject}`);
    console.log(`- Date: ${targetEmail.date}`);
    console.log(`- ID: ${targetEmail.id}`);
    
    // Extract email address
    const emailMatch = targetEmail.from.match(/<(.+?)>/);
    const emailAddress = emailMatch ? emailMatch[1] : targetEmail.from;
    console.log(`- Extracted email: ${emailAddress}`);
    
    // Check if contact exists
    console.log('\n--- Checking Contact Status ---');
    const contacts = await searchContacts(userId, emailAddress);
    const existingContact = contacts.find(c => c.properties?.email === emailAddress);
    
    if (existingContact) {
      console.log('✅ Contact already exists:');
      console.log(`- ID: ${existingContact.id}`);
      console.log(`- Created: ${existingContact.properties?.createdate}`);
      console.log(`- Name: ${existingContact.properties?.firstname} ${existingContact.properties?.lastname}`);
    } else {
      console.log('❌ Contact not found - should be created');
      
      // Simulate email poller logic
      console.log('\n--- Simulating Email Poller Logic ---');
      const isInHubSpot = contacts.some(
        c => c.properties?.email?.toLowerCase() === emailAddress.toLowerCase()
      );
      
      console.log(`Is in HubSpot: ${isInHubSpot}`);
      
      if (!isInHubSpot) {
        console.log('✅ Should trigger contact creation');
        
        // Get user instructions
        const instructions = await getUserInstructions(userId);
        console.log('User instructions:', instructions);
        
        // Create event data
        const eventData = {
          from: emailAddress,
          subject: targetEmail.subject,
          body: targetEmail.body,
          date: targetEmail.date
        };
        
        console.log('Event data:', eventData);
        
        // Process proactive event
        try {
          console.log('\n--- Processing Proactive Event ---');
          const result = await processProactiveEvent(userId, 'new_email', eventData, instructions);
          console.log('Proactive event result:', result);
          
          // Check if contact was created
          console.log('\n--- Checking if Contact was Created ---');
          const newContacts = await searchContacts(userId, emailAddress);
          const newContact = newContacts.find(c => c.properties?.email === emailAddress);
          
          if (newContact) {
            console.log('✅ Contact created successfully:');
            console.log(`- ID: ${newContact.id}`);
            console.log(`- Created: ${newContact.properties?.createdate}`);
            console.log(`- Name: ${newContact.properties?.firstname} ${newContact.properties?.lastname}`);
          } else {
            console.log('❌ Contact not created');
          }
          
        } catch (error) {
          console.log('❌ Error in proactive event processing:', error);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testEmailPollerTrigger().catch(console.error); 