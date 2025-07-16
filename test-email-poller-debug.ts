import { GmailService } from './src/services/gmail.service';
import { searchContacts } from './src/services/hubspot.service';
import { processProactiveEvent, getUserInstructions } from './src/services/ai.service';
import pool from './src/config/db';

async function debugEmailPoller() {
  try {
    console.log('=== Debugging Email Poller for User 4 ===\n');
    
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
    
    // Get recent emails for user 4
    console.log('\n--- Checking Recent Emails ---');
    try {
      const emails = await GmailService.listEmails(Number(userId), 3);
      console.log(`Found ${emails.length} recent emails`);
      
      emails.forEach((email, index) => {
        console.log(`${index + 1}. From: ${email.from}, Subject: ${email.subject}, Date: ${email.date}, ID: ${email.id}`);
        
        // Extract email address from Gmail format
        const emailMatch = email.from.match(/<(.+?)>/);
        const emailAddress = emailMatch ? emailMatch[1] : email.from;
        console.log(`   Extracted email: ${emailAddress}`);
        
        if (emailAddress === 'aki98747@proton.me') {
          console.log(`   ✅ Found aki98747@proton.me email!`);
        }
      });
      
      const akiEmail = emails.find(e => {
        const emailMatch = e.from.match(/<(.+?)>/);
        const emailAddress = emailMatch ? emailMatch[1] : e.from;
        return emailAddress === 'aki98747@proton.me';
      });
      
      if (akiEmail) {
        console.log('\n✅ Found email from aki98747@proton.me:');
        console.log(`- Subject: ${akiEmail.subject}`);
        console.log(`- Date: ${akiEmail.date}`);
        console.log(`- ID: ${akiEmail.id}`);
        
        // Check if this contact exists in HubSpot
        console.log('\n--- Checking if contact exists in HubSpot ---');
        const contacts = await searchContacts(userId, 'aki98747@proton.me');
        const akiContact = contacts.find(c => c.properties?.email === 'aki98747@proton.me');
        
        if (akiContact) {
          console.log('✅ Contact already exists in HubSpot:');
          console.log(`- ID: ${akiContact.id}`);
          console.log(`- Created: ${akiContact.properties?.createdate}`);
        } else {
          console.log('❌ Contact not found in HubSpot - should be created');
          
          // Test the email poller logic manually
          console.log('\n--- Testing Email Poller Logic Manually ---');
          const emailMatch = akiEmail.from.match(/<(.+?)>/);
          const emailAddress = emailMatch ? emailMatch[1] : akiEmail.from;
          
          console.log(`Email from: ${akiEmail.from}`);
          console.log(`Extracted email: ${emailAddress}`);
          
                     const foundContacts = await searchContacts(userId, emailAddress);
           const isInHubSpot = foundContacts.some(
             (c: any) => c.properties?.email?.toLowerCase() === emailAddress.toLowerCase()
           );
          
          console.log(`Is in HubSpot: ${isInHubSpot}`);
          
          if (!isInHubSpot) {
            console.log('✅ Should trigger contact creation');
            
            // Get user instructions
            const instructions = await getUserInstructions(userId);
            console.log('User instructions:', instructions);
            
            // Test proactive event processing
            const eventData = {
              from: emailAddress,
              subject: akiEmail.subject,
              body: akiEmail.body,
              date: akiEmail.date
            };
            
            console.log('Event data:', eventData);
            
            try {
              const result = await processProactiveEvent(userId, 'new_email', eventData, instructions);
              console.log('Proactive event result:', result);
            } catch (error) {
              console.log('❌ Error in proactive event processing:', error);
            }
          }
        }
      } else {
        console.log('❌ No recent email found from aki98747@proton.me');
      }
      
    } catch (error) {
      console.log('❌ Error checking emails:', error);
      return;
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugEmailPoller().catch(console.error); 