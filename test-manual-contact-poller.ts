import { searchContacts } from './src/services/hubspot.service';
import { getUserInstructions } from './src/services/ai.service';
import pool from './src/config/db';

async function testManualContactPoller() {
  try {
    console.log('=== Manual Contact Poller Test ===\n');
    
    // Test for user 4 specifically
    const userId = "4";
    console.log(`Testing contact poller for user ${userId}...`);
    
    // Get contacts
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
      
      // Check if it's new
      const contactCreatedAt = new Date(latestContact.properties?.createdate || 0);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const isNew = contactCreatedAt > oneHourAgo;
      
      console.log(`Is new (created in last hour): ${isNew}`);
      
      if (isNew) {
        // Get instructions
        const instructions = await getUserInstructions(userId);
        console.log(`Found ${instructions.length} instructions for user ${userId}`);
        
        // Check instruction matching
        const hasThankYou = instructions.some(instr => {
          const lowerInstr = instr.toLowerCase();
          return (
            (lowerInstr.includes('create a contact') || lowerInstr.includes('new contact')) &&
            (lowerInstr.includes('send') || lowerInstr.includes('email')) &&
            (lowerInstr.includes('thank') || lowerInstr.includes('client'))
          );
        });
        
        console.log(`Has thank you instruction: ${hasThankYou}`);
        
        if (hasThankYou && latestContact.properties?.email) {
          console.log(`Would send thank you email to ${latestContact.properties.email} from user ${userId}`);
          
          // Check Gmail credentials
          const gmailResult = await pool.query(
            'SELECT user_id FROM user_credentials WHERE user_id = $1 AND service = $2',
            [userId, 'google']
          );
          
          if (gmailResult.rows.length > 0) {
            console.log(`✅ User ${userId} has Gmail credentials`);
          } else {
            console.log(`❌ User ${userId} has NO Gmail credentials`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testManualContactPoller().catch(console.error); 