import { searchContacts } from './src/services/hubspot.service';
import { getUserInstructions } from './src/services/ai.service';
import { GmailService } from './src/services/gmail.service';
import pool from './src/config/db';

async function debugDuplicateEmails() {
  try {
    console.log('=== Debugging Duplicate Thank You Emails ===\n');
    
    // Check user 4's contacts
    console.log('--- Checking User 4 Contacts ---');
    const user4Contacts = await searchContacts('4', '');
    const akiContact = user4Contacts.find(c => c.properties?.email === 'aki98747@proton.me');
    
    if (akiContact) {
      console.log(`Found contact: ${akiContact.id}`);
      console.log(`Created: ${akiContact.properties?.createdate}`);
      console.log(`Email: ${akiContact.properties?.email}`);
      console.log(`Name: ${akiContact.properties?.firstname} ${akiContact.properties?.lastname}`);
    } else {
      console.log('Contact not found for user 4');
    }
    
    // Check user 5's contacts
    console.log('\n--- Checking User 5 Contacts ---');
    const user5Contacts = await searchContacts('5', '');
    const akiContact5 = user5Contacts.find(c => c.properties?.email === 'aki98747@proton.me');
    
    if (akiContact5) {
      console.log(`Found contact: ${akiContact5.id}`);
      console.log(`Created: ${akiContact5.properties?.createdate}`);
      console.log(`Email: ${akiContact5.properties?.email}`);
      console.log(`Name: ${akiContact5.properties?.firstname} ${akiContact5.properties?.lastname}`);
    } else {
      console.log('Contact not found for user 5');
    }
    
    // Check user 4's instructions
    console.log('\n--- Checking User 4 Instructions ---');
    const user4Instructions = await getUserInstructions('4');
    console.log('Instructions:', user4Instructions);
    
    // Check user 5's instructions
    console.log('\n--- Checking User 5 Instructions ---');
    const user5Instructions = await getUserInstructions('5');
    console.log('Instructions:', user5Instructions);
    
    // Check recent emails sent by user 4
    console.log('\n--- Checking User 4 Recent Emails ---');
    try {
      const user4Emails = await GmailService.listEmails(4, 10);
      console.log(`Found ${user4Emails.length} recent emails`);
      
      const thankYouEmails = user4Emails.filter(e => 
        e.subject?.toLowerCase().includes('thank') || 
        e.body?.toLowerCase().includes('thank')
      );
      
      console.log(`Found ${thankYouEmails.length} thank you emails:`);
      thankYouEmails.forEach(e => {
        console.log(`- To: ${e.to}, Subject: ${e.subject}, Date: ${e.date}`);
      });
    } catch (error) {
      console.log('Error checking user 4 emails:', error);
    }
    
    // Check recent emails sent by user 5
    console.log('\n--- Checking User 5 Recent Emails ---');
    try {
      const user5Emails = await GmailService.listEmails(5, 10);
      console.log(`Found ${user5Emails.length} recent emails`);
      
      const thankYouEmails = user5Emails.filter(e => 
        e.subject?.toLowerCase().includes('thank') || 
        e.body?.toLowerCase().includes('thank')
      );
      
      console.log(`Found ${thankYouEmails.length} thank you emails:`);
      thankYouEmails.forEach(e => {
        console.log(`- To: ${e.to}, Subject: ${e.subject}, Date: ${e.date}`);
      });
    } catch (error) {
      console.log('Error checking user 5 emails:', error);
    }
    
    // Check contact poller state
    console.log('\n--- Checking Contact Poller State ---');
    const { rows } = await pool.query(
      "SELECT * FROM user_credentials WHERE service = 'hubspot' AND user_id IN ('4', '5')"
    );
    console.log('HubSpot credentials:', rows);
    
    console.log('\n=== Analysis ===');
    if (akiContact && akiContact5) {
      console.log('❌ BOTH users have the same contact - this explains the duplicate emails!');
      console.log('The contact poller for both users is detecting the same contact and sending thank you emails.');
    } else if (akiContact) {
      console.log('✅ Only user 4 has the contact');
    } else if (akiContact5) {
      console.log('✅ Only user 5 has the contact');
    } else {
      console.log('❌ Neither user has the contact');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugDuplicateEmails().catch(console.error); 