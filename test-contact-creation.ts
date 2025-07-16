import { createContact, addContactNote, searchContacts } from './src/services/hubspot.service';
import pool from './src/config/db';

async function testContactCreation() {
  try {
    console.log('=== Testing Contact Creation ===\n');
    
    const userId = "4";
    const testEmail = "aki98747@proton.me";
    const testName = "Aki Test";
    
    console.log(`Testing contact creation for user ${userId}`);
    console.log(`Email: ${testEmail}`);
    console.log(`Name: ${testName}`);
    
    // Test 1: Check if contact already exists
    console.log('\n--- Test 1: Checking if contact exists ---');
    const existingContacts = await searchContacts(userId, testEmail);
    const contactExists = existingContacts.some(
      c => c.properties?.email?.toLowerCase() === testEmail.toLowerCase()
    );
    
    if (contactExists) {
      console.log('✅ Contact already exists');
      const contact = existingContacts.find(c => c.properties?.email?.toLowerCase() === testEmail.toLowerCase());
      console.log(`Contact ID: ${contact?.id}`);
      console.log(`Created: ${contact?.properties?.createdate}`);
      return;
    }
    
    console.log('❌ Contact does not exist, creating...');
    
    // Test 2: Create contact
    console.log('\n--- Test 2: Creating Contact ---');
    try {
      const [firstName, ...lastNameParts] = testName.split(' ');
      const lastName = lastNameParts.join(' ');
      
      console.log(`First Name: ${firstName}`);
      console.log(`Last Name: ${lastName}`);
      
      const contact = await createContact(userId, {
        email: testEmail,
        firstname: firstName,
        lastname: lastName,
        phone: undefined
      });
      
      console.log('✅ Contact created successfully!');
      console.log(`Contact ID: ${contact.id}`);
      console.log(`Created: ${contact.properties?.createdate}`);
      
      // Test 3: Add note
      console.log('\n--- Test 3: Adding Note ---');
      const note = `Contact created automatically from email received on ${new Date().toISOString()}. Email subject: "Test"`;
      
      await addContactNote(userId, contact.id, note);
      console.log('✅ Note added successfully');
      
      // Test 4: Verify contact was created
      console.log('\n--- Test 4: Verifying Contact ---');
      const verifyContacts = await searchContacts(userId, testEmail);
      const newContact = verifyContacts.find(c => c.properties?.email?.toLowerCase() === testEmail.toLowerCase());
      
      if (newContact) {
        console.log('✅ Contact verified in search results');
        console.log(`ID: ${newContact.id}`);
        console.log(`Name: ${newContact.properties?.firstname} ${newContact.properties?.lastname}`);
        console.log(`Email: ${newContact.properties?.email}`);
        console.log(`Created: ${newContact.properties?.createdate}`);
      } else {
        console.log('❌ Contact not found in search results');
      }
      
    } catch (error) {
      console.error('❌ Error creating contact:', error);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testContactCreation().catch(console.error); 