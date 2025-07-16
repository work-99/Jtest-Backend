import { searchContacts } from './src/services/hubspot.service';
import { getUserInstructions } from './src/services/ai.service';
import { GmailService } from './src/services/gmail.service';
import pool from './src/config/db';

async function testContactPollerDebug() {
  try {
    console.log('=== Testing Contact Poller Debug ===\n');
    
    // Test for user 5 specifically
    const userId = "5";
    console.log(`Testing contact poller for user ${userId}...`);
    
    // Step 1: Get contacts for user 4
    console.log('\n--- Step 1: Getting Contacts for User 4 ---');
    const contacts = await searchContacts(userId, '');
    console.log(`Found ${contacts.length} contacts for user ${userId}`);
    
    if (contacts.length > 0) {
      // Sort contacts by creation date
      const sortedContacts = contacts.sort((a, b) => {
        const dateA = new Date(a.properties?.createdate || 0);
        const dateB = new Date(b.properties?.createdate || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      const latestContact = sortedContacts[0];
      console.log(`Latest contact: ${latestContact.id} (${latestContact.properties?.email})`);
      console.log(`Created: ${latestContact.properties?.createdate}`);
      
      // Step 2: Check if it's new
      const contactCreatedAt = new Date(latestContact.properties?.createdate || 0);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const isNew = contactCreatedAt > oneHourAgo;
      
      console.log(`Is new (created in last hour): ${isNew}`);
      
      if (isNew) {
        // Step 3: Get instructions
        console.log('\n--- Step 2: Getting Instructions ---');
        const instructions = await getUserInstructions(userId);
        console.log(`Found ${instructions.length} instructions for user ${userId}:`);
        instructions.forEach((instruction, index) => {
          console.log(`  ${index + 1}. ${instruction}`);
        });
        
        // Step 4: Check instruction matching
        const hasThankYou = instructions.some(instr => {
          const lowerInstr = instr.toLowerCase();
          return (
            (lowerInstr.includes('create a contact') || lowerInstr.includes('new contact')) &&
            (lowerInstr.includes('send') || lowerInstr.includes('email')) &&
            (lowerInstr.includes('thank') || lowerInstr.includes('client'))
          );
        });
        
        console.log(`\nHas thank you instruction: ${hasThankYou}`);
        
        if (hasThankYou && latestContact.properties?.email) {
          console.log(`\n--- Step 3: Would Send Thank You Email ---`);
          console.log(`From user: ${userId}`);
          console.log(`To: ${latestContact.properties.email}`);
          console.log(`Subject: Thank you for being a client!`);
          console.log(`Body: Dear ${latestContact.properties.firstname || 'there'},...`);
          
          // Step 5: Check Gmail credentials for this user
          console.log('\n--- Step 4: Checking Gmail Credentials ---');
          const gmailResult = await pool.query(
            'SELECT user_id FROM user_credentials WHERE user_id = $1 AND service = $2',
            [userId, 'google']
          );
          
          if (gmailResult.rows.length > 0) {
            console.log(`✅ User ${userId} has Gmail credentials`);
            
            // Step 6: Test sending email (but don't actually send)
            console.log('\n--- Step 5: Testing Email Sending (Dry Run) ---');
            console.log(`Would send email using GmailService.sendEmail(${userId}, {...})`);
            console.log(`This should send from user ${userId}'s Gmail account`);
            
          } else {
            console.log(`❌ User ${userId} has NO Gmail credentials`);
            console.log('This would cause an error when trying to send email');
          }
        }
      }
    }
    
    // Step 7: Check if any other users might be sending emails
    console.log('\n--- Step 6: Checking Other Users ---');
    const allGmailUsers = await pool.query(
      'SELECT user_id FROM user_credentials WHERE service = $1 ORDER BY user_id',
      ['google']
    );
    
    console.log(`Users with Gmail credentials:`);
    allGmailUsers.rows.forEach(row => {
      console.log(`  User ${row.user_id}`);
    });
    
    console.log('\n--- Analysis ---');
    console.log('The contact poller should only send emails from the user who owns the contact.');
    console.log('If user 5 is sending emails for user 4\'s contacts, there might be:');
    console.log('1. A bug in the contact poller logic');
    console.log('2. A race condition between users');
    console.log('3. An issue with the Gmail service');
    console.log('4. The contact poller running for the wrong user');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testContactPollerDebug().catch(console.error); 