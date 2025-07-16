import pool from './src/config/db';

async function checkContactTracking() {
  try {
    console.log('=== Checking Contact Tracking Database ===\n');
    
    // Check all thank you email records
    console.log('--- All Thank You Email Records ---');
    const { rows } = await pool.query(
      'SELECT * FROM thank_you_emails ORDER BY sent_at DESC'
    );
    
    console.log(`Found ${rows.length} thank you email records:`);
    rows.forEach((row, index) => {
      console.log(`${index + 1}. User: ${row.user_id}, Contact: ${row.contact_id}, Email: ${row.email_address}, Sent: ${row.sent_at}`);
    });
    
    // Check specifically for aki98747@proton.me
    console.log('\n--- Checking for aki98747@proton.me ---');
    const { rows: akiRows } = await pool.query(
      'SELECT * FROM thank_you_emails WHERE email_address = $1',
      ['aki98747@proton.me']
    );
    
    if (akiRows.length > 0) {
      console.log(`✅ Found ${akiRows.length} record(s) for aki98747@proton.me:`);
      akiRows.forEach((row, index) => {
        console.log(`${index + 1}. User: ${row.user_id}, Contact ID: ${row.contact_id}, Sent: ${row.sent_at}`);
      });
    } else {
      console.log('❌ No records found for aki98747@proton.me');
    }
    
    // Check user 4 specifically
    console.log('\n--- Checking User 4 Records ---');
    const { rows: user4Rows } = await pool.query(
      'SELECT * FROM thank_you_emails WHERE user_id = $1 ORDER BY sent_at DESC',
      ['4']
    );
    
    if (user4Rows.length > 0) {
      console.log(`✅ User 4 has ${user4Rows.length} thank you email record(s):`);
      user4Rows.forEach((row, index) => {
        console.log(`${index + 1}. Contact ID: ${row.contact_id}, Email: ${row.email_address}, Sent: ${row.sent_at}`);
      });
    } else {
      console.log('❌ User 4 has no thank you email records');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkContactTracking().catch(console.error); 