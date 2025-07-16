import pool from './src/config/db';

async function setupThankYouTracking() {
  try {
    console.log('=== Setting up Thank You Email Tracking ===\n');
    
    // Create table to track sent thank you emails
    await pool.query(`
      CREATE TABLE IF NOT EXISTS thank_you_emails (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        contact_id VARCHAR(255) NOT NULL,
        email_address VARCHAR(255) NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, contact_id)
      )
    `);
    
    console.log('✅ Thank you email tracking table created/verified');
    
    // Create index for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_thank_you_emails_user_email 
      ON thank_you_emails(user_id, email_address)
    `);
    
    console.log('✅ Index created for thank you email tracking');
    
    // Check if there are any existing records
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM thank_you_emails');
    console.log(`📊 Current thank you email records: ${rows[0].count}`);
    
  } catch (error) {
    console.error('Error setting up thank you tracking:', error);
  } finally {
    await pool.end();
  }
}

setupThankYouTracking().catch(console.error); 