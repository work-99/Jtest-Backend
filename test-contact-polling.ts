import { searchContacts } from './src/services/hubspot.service';
import { getUserInstructions } from './src/services/ai.service';
import pool from './src/config/db';

async function testContactPolling() {
  try {
    console.log('=== Testing Contact Polling Functionality ===\n');

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

    const userId = "4";
    console.log(`\nTesting with user ${userId}...`);

    // Test 1: Get contacts
    console.log('\n--- Test 1: Getting Contacts ---');
    try {
      const contacts = await searchContacts(userId, '');
      console.log(`✅ Found ${contacts.length} contacts`);
      
      if (contacts.length > 0) {
        // Sort by creation date
        const sortedContacts = contacts.sort((a, b) => {
          const dateA = new Date(a.properties?.createdate || 0);
          const dateB = new Date(b.properties?.createdate || 0);
          return dateB.getTime() - dateA.getTime();
        });
        
        const latestContact = sortedContacts[0];
        console.log('Latest contact:');
        console.log(`- ID: ${latestContact.id}`);
        console.log(`- Name: ${latestContact.properties?.firstname || ''} ${latestContact.properties?.lastname || ''}`);
        console.log(`- Email: ${latestContact.properties?.email || 'N/A'}`);
        console.log(`- Created: ${latestContact.properties?.createdate || 'N/A'}`);
        
        // Check if it's new (created in last 5 minutes)
        const contactCreatedAt = new Date(latestContact.properties?.createdate || 0);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const isNew = contactCreatedAt > fiveMinutesAgo;
        
        console.log(`- Is new (created in last 5 minutes): ${isNew}`);
      }
    } catch (error) {
      console.log('❌ Error getting contacts:', error);
    }

    // Test 2: Get instructions
    console.log('\n--- Test 2: Getting Instructions ---');
    try {
      const instructions = await getUserInstructions(userId);
      console.log(`✅ Found ${instructions.length} instructions:`);
      
      instructions.forEach((instruction, index) => {
        console.log(`${index + 1}. ${instruction}`);
      });
      
      // Test instruction matching
      const hasThankYou = instructions.some(instr => {
        const lowerInstr = instr.toLowerCase();
        return (
          (lowerInstr.includes('create a contact') || lowerInstr.includes('new contact')) &&
          (lowerInstr.includes('send') || lowerInstr.includes('email')) &&
          (lowerInstr.includes('thank') || lowerInstr.includes('client'))
        );
      });
      
      console.log(`\nHas thank you instruction: ${hasThankYou}`);
      
    } catch (error) {
      console.log('❌ Error getting instructions:', error);
    }

    // Test 3: Check ongoing_instructions table directly
    console.log('\n--- Test 3: Checking Database Directly ---');
    try {
      const { rows: dbInstructions } = await pool.query(
        'SELECT * FROM ongoing_instructions WHERE user_id = $1 AND is_active = true',
        [userId]
      );
      
      console.log(`✅ Found ${dbInstructions.length} active instructions in database:`);
      dbInstructions.forEach((instruction, index) => {
        console.log(`${index + 1}. ${instruction.instruction}`);
      });
      
    } catch (error) {
      console.log('❌ Error checking database:', error);
    }

    console.log('\n--- Summary ---');
    console.log('Contact polling should now work with:');
    console.log('1. Better contact detection (sorted by creation date)');
    console.log('2. More flexible instruction matching');
    console.log('3. Detailed logging for debugging');
    console.log('4. Proactive agent integration');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testContactPolling().catch(console.error); 