import { searchContacts } from './src/services/hubspot.service';
import pool from './src/config/db';

async function checkAllHubSpotAccounts() {
  try {
    console.log('=== Checking All HubSpot Accounts ===\n');
    
    // Get all users with HubSpot credentials
    const { rows } = await pool.query(
      "SELECT user_id FROM user_credentials WHERE service = 'hubspot' ORDER BY user_id"
    );
    
    console.log(`Found ${rows.length} users with HubSpot credentials: ${rows.map(r => r.user_id).join(', ')}`);
    
    const email = 'aki98747@proton.me';
    
    for (const row of rows) {
      const userId = row.user_id;
      console.log(`\n--- Checking User ${userId} ---`);
      
      try {
        const contacts = await searchContacts(userId, email);
        const contact = contacts.find(c => c.properties?.email === email);
        
        if (contact) {
          console.log(`✅ Contact found for user ${userId}:`);
          console.log(`- ID: ${contact.id}`);
          console.log(`- Created: ${contact.properties?.createdate}`);
          console.log(`- Name: ${contact.properties?.firstname} ${contact.properties?.lastname}`);
          console.log(`- Email: ${contact.properties?.email}`);
        } else {
          console.log(`❌ Contact not found for user ${userId}`);
          console.log(`Total contacts for user ${userId}: ${contacts.length}`);
          
          // Show first few contacts to verify search is working
          if (contacts.length > 0) {
            console.log('Sample contacts:');
            contacts.slice(0, 3).forEach(c => {
              console.log(`- ${c.properties?.firstname} ${c.properties?.lastname} (${c.properties?.email})`);
            });
          }
        }
      } catch (error) {
        console.log(`❌ Error checking user ${userId}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAllHubSpotAccounts().catch(console.error); 