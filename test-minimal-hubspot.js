const axios = require('axios');

async function testMinimalHubSpot() {
  try {
    console.log('Testing minimal HubSpot scopes...');
    
    const response = await axios.get('http://localhost:3001/api/integrations/hubspot/auth-url', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzUxODQ2MjQwLCJleHAiOjE3NTI0NTEwNDB9.nPxIkp6MN4XqKi_9Bg-1RSkO0a4hCtkGojmrb6JgOyg'
      }
    });
    
    console.log('✅ Auth URL generated successfully');
    console.log('Auth URL:', response.data.url);
    console.log('URL contains minimal scope:', response.data.url.includes('crm.objects.contacts.read'));
    console.log('URL length:', response.data.url.length);
    
    // Test if the URL is properly formatted
    const url = new URL(response.data.url);
    console.log('Scope parameter:', url.searchParams.get('scope'));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testMinimalHubSpot(); 