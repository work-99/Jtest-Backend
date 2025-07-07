import dotenv from 'dotenv';
import { processMessage } from './src/services/ai.service';

dotenv.config();

async function testAppointmentScheduling() {
  console.log('=== Testing Appointment Scheduling ===\n');
  
  const testUserId = '1'; // Use the test user
  const testMessage = 'Schedule an appointment with Sara Smith';
  
  console.log(`Testing message: "${testMessage}"`);
  console.log('User ID:', testUserId);
  console.log('\n--- Processing Message ---');
  
  try {
    const result = await processMessage(testUserId, testMessage);
    
    console.log('\n--- Result ---');
    console.log('Response:', result.text);
    
    // Check if result has actionRequired property
    if ('actionRequired' in result && result.actionRequired) {
      console.log('\n--- Action Required ---');
      console.log('Action Required:', result.actionRequired);
      if ('data' in result && result.data) {
        console.log('Data:', JSON.stringify(result.data, null, 2));
      }
    }
    
    console.log('\n✅ Appointment scheduling test completed');
    
  } catch (error) {
    console.error('\n❌ Error during appointment scheduling test:', error);
  }
}

// Run the test
testAppointmentScheduling().catch(console.error); 