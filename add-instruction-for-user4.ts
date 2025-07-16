import pool from './src/config/db';

async function addInstructionForUser4() {
  try {
    console.log('=== Adding Missing Instruction for User 4 ===\n');
    
    const instruction = "When someone emails me that is not in Hubspot, please create a contact in Hubspot with a note about the email.";
    
    // Check if instruction already exists
    const existingResult = await pool.query(
      'SELECT * FROM user_instructions WHERE user_id = $1 AND instruction = $2',
      ['4', instruction]
    );
    
    if (existingResult.rows.length > 0) {
      console.log('✅ Instruction already exists for user 4');
      return;
    }
    
    // Add the instruction
    await pool.query(
      'INSERT INTO user_instructions (user_id, instruction) VALUES ($1, $2)',
      ['4', instruction]
    );
    
    console.log('✅ Successfully added instruction for user 4:');
    console.log(`"${instruction}"`);
    
    // Verify it was added
    const verifyResult = await pool.query(
      'SELECT instruction FROM user_instructions WHERE user_id = $1 ORDER BY created_at DESC',
      ['4']
    );
    
    console.log('\n--- Current Instructions for User 4 ---');
    verifyResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.instruction}`);
    });
    
  } catch (error) {
    console.error('❌ Error adding instruction:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
addInstructionForUser4().catch(console.error); 