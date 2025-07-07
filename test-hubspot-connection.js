const axios = require('axios');

async function testHubSpotConnection() {
  try {
    console.log('Testing HubSpot connection...');
    
    // Test the status endpoint
    const response = await axios.get('http://localhost:3001/api/integrations/hubspot/status', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzUxODQ2MjQwLCJleHAiOjE3NTI0NTEwNDB9.nPxIkp6MN4XqKi_9Bg-1RSkO0a4hCtkGojmrb6JgOyg'
      }
    });
    
    console.log('HubSpot Status Response:', response.data);
    
    if (response.data.connected) {
      console.log('✅ HubSpot is connected!');
      
      // Try to fetch contacts
      try {
        const contactsResponse = await axios.get('http://localhost:3001/api/integrations/hubspot/contacts', {
          headers: {
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzUxODQ2MjQwLCJleHAiOjE3NTI0NTEwNDB9.nPxIkp6MN4XqKi_9Bg-1RSkO0a4hCtkGojmrb6JgOyg'
          }
        });
        console.log('✅ Contacts fetched successfully:', contactsResponse.data.length, 'contacts');
      } catch (contactsError) {
        console.log('❌ Failed to fetch contacts:', contactsError.response?.data || contactsError.message);
      }
    } else {
      console.log('❌ HubSpot is not connected');
      
      // Get auth URL
      try {
        const authResponse = await axios.get('http://localhost:3001/api/integrations/hubspot/auth-url', {
          headers: {
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzUxODQ2MjQwLCJleHAiOjE3NTI0NTEwNDB9.nPxIkp6MN4XqKi_9Bg-1RSkO0a4hCtkGojmrb6JgOyg'
          }
        });
        console.log('🔗 Auth URL:', authResponse.data.url);
        console.log('🔗 Scope in URL:', new URL(authResponse.data.url).searchParams.get('scope'));
      } catch (authError) {
        console.log('❌ Failed to get auth URL:', authError.response?.data || authError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing HubSpot connection:');
    console.error('Error message:', error.message);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
  }
}

testHubSpotConnection(); 