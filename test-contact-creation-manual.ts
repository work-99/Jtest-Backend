import { createContact, addContactNote } from './src/services/hubspot.service';
import pool from './src/config/db';

async function testContactCreationManual() {
  try {
    console.log('=== Manual Contact Creation Test ===\n');
    
    const userId = "4";
    const testEmail = "aki98747@proton.me";
    const testName = "Aki Test";
    
    console.log(`Creating contact for user ${userId}`);
    console.log(`Email: ${testEmail}`);
    console.log(`Name: ${testName}`);
    
    try {
      // Create contact
      console.log('\n--- Creating Contact ---');
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
      
      // Add note
      console.log('\n--- Adding Note ---');
      const note = `Contact created automatically from email received on ${new Date().toISOString()}. Email subject: "test2"`;
      
      await addContactNote(userId, contact.id, note);
      console.log('✅ Note added successfully');
      
      console.log('\n✅ Contact creation completed successfully!');
      
    } catch (error) {
      console.error('❌ Error creating contact:', error);
      
      // Check if it's a specific error
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testContactCreationManual().catch(console.error); 