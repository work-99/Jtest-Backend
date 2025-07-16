import { toolRegistry } from './src/services/tool-registry.service';
import { searchContacts } from './src/services/hubspot.service';
import pool from './src/config/db';

async function testManualContactCreation() {
  try {
    console.log('=== Testing Manual Contact Creation ===\n');
    
    const userId = '4';
    const email = 'aki98747@proton.me';
    
    // Check if contact already exists
    console.log('--- Checking if contact exists ---');
    const existingContacts = await searchContacts(userId, email);
    const existingContact = existingContacts.find(c => c.properties?.email === email);
    
    if (existingContact) {
      console.log('✅ Contact already exists:');
      console.log(`- ID: ${existingContact.id}`);
      console.log(`- Created: ${existingContact.properties?.createdate}`);
      console.log(`- Name: ${existingContact.properties?.firstname} ${existingContact.properties?.lastname}`);
      return;
    }
    
    console.log('❌ Contact not found - creating new contact');
    
    // Test contact creation with different name formats
    const testCases = [
      {
        name: 'Aki Test',
        note: 'Contact created from email: Test5'
      },
      {
        name: 'aki98747',
        note: 'Contact created from email: Test5'
      },
      {
        name: 'Aki',
        note: 'Contact created from email: Test5'
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n--- Testing with name: "${testCase.name}" ---`);
      
      try {
        const result = await toolRegistry.executeTool('create_hubspot_contact', userId, {
          email: email,
          name: testCase.name,
          note: testCase.note
        });
        
        console.log('✅ Contact creation result:', result);
        
        // Verify contact was created
        const newContacts = await searchContacts(userId, email);
        const newContact = newContacts.find(c => c.properties?.email === email);
        
        if (newContact) {
          console.log('✅ Contact verified in HubSpot:');
          console.log(`- ID: ${newContact.id}`);
          console.log(`- Created: ${newContact.properties?.createdate}`);
          console.log(`- Name: ${newContact.properties?.firstname} ${newContact.properties?.lastname}`);
          console.log(`- Email: ${newContact.properties?.email}`);
          return; // Success, exit
        } else {
          console.log('❌ Contact not found after creation');
        }
        
      } catch (error) {
        console.log('❌ Contact creation failed:', error);
      }
    }
    
    console.log('\n❌ All contact creation attempts failed');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testManualContactCreation().catch(console.error); 