import pool from './src/config/db';

async function addInstructionForUser4() {
  try {
    const userId = '4';
    const instruction = "When someone emails me that is not in Hubspot, please create a contact in Hubspot.";
    
    await pool.query(
      'INSERT INTO user_instructions (user_id, instruction) VALUES ($1, $2)',
      [userId, instruction]
    );
    
    console.log('Instruction added for user 4:', instruction);
  } catch (error) {
    console.error('Error adding instruction:', error);
  } finally {
    await pool.end();
  }
}

addInstructionForUser4().catch(console.error); 