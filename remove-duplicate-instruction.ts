import pool from './src/config/db';

async function removeDuplicateInstructions() {
  try {
    console.log('=== Removing Duplicate Instructions ===\n');
    
    // Get all instructions for user 4
    const { rows } = await pool.query(
      'SELECT id, instruction, created_at FROM user_instructions WHERE user_id = $1 ORDER BY created_at DESC',
      ['4']
    );
    
    console.log('Current instructions for user 4:');
    rows.forEach((row, index) => {
      console.log(`${index + 1}. [${row.id}] ${row.instruction}`);
    });
    
    // Find duplicates
    const seen = new Set();
    const duplicates = [];
    
    for (const row of rows) {
      const key = row.instruction.toLowerCase().trim();
      if (seen.has(key)) {
        duplicates.push(row);
      } else {
        seen.add(key);
      }
    }
    
    if (duplicates.length > 0) {
      console.log(`\nFound ${duplicates.length} duplicate instructions:`);
      duplicates.forEach(row => {
        console.log(`- [${row.id}] ${row.instruction}`);
      });
      
      // Remove duplicates (keep the oldest one)
      for (const duplicate of duplicates) {
        console.log(`\nRemoving duplicate instruction [${duplicate.id}]: ${duplicate.instruction}`);
        await pool.query('DELETE FROM user_instructions WHERE id = $1', [duplicate.id]);
      }
      
      console.log('\n✅ Duplicate instructions removed successfully!');
    } else {
      console.log('\n✅ No duplicate instructions found.');
    }
    
    // Show final state
    const { rows: finalRows } = await pool.query(
      'SELECT id, instruction, created_at FROM user_instructions WHERE user_id = $1 ORDER BY created_at DESC',
      ['4']
    );
    
    console.log('\nFinal instructions for user 4:');
    finalRows.forEach((row, index) => {
      console.log(`${index + 1}. [${row.id}] ${row.instruction}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

removeDuplicateInstructions().catch(console.error); 