import { searchContacts } from './src/services/hubspot.service';
import pool from './src/config/db';

async function verifyContact() {
  try {
    console.log('=== Verifying Contact Creation ===\n');
    
    const userId = '4';
    const email = 'aki98747@proton.me';
    
    // Check if contact exists
    console.log('--- Checking Contact Status ---');
    const contacts = await searchContacts(userId, email);
    const contact = contacts.find(c => c.properties?.email === email);
    
    if (contact) {
      console.log('✅ Contact exists in HubSpot:');
      console.log(`- ID: ${contact.id}`);
      console.log(`- Created: ${contact.properties?.createdate}`);
      console.log(`- Name: ${contact.properties?.firstname} ${contact.properties?.lastname}`);
      console.log(`- Email: ${contact.properties?.email}`);
      
      // Check if thank you email was sent
      console.log('\n--- Checking Thank You Email Status ---');
      const { rows } = await pool.query(
        'SELECT * FROM thank_you_emails WHERE user_id = $1 AND contact_id = $2',
        [userId, contact.id]
      );
      
      if (rows.length > 0) {
        console.log('✅ Thank you email was sent:');
        console.log(`- Sent at: ${rows[0].sent_at}`);
      } else {
        console.log('❌ Thank you email not found in tracking table');
      }
      
    } else {
      console.log('❌ Contact not found in HubSpot');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

verifyContact().catch(console.error); 