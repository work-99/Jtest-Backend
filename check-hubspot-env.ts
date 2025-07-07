import dotenv from 'dotenv';
dotenv.config();

console.log('=== HubSpot Environment Variables Debug ===');
console.log('HUBSPOT_CLIENT_ID:', process.env.HUBSPOT_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('HUBSPOT_CLIENT_SECRET:', process.env.HUBSPOT_CLIENT_SECRET ? 'SET' : 'NOT SET');
console.log('HUBSPOT_REDIRECT_URI:', process.env.HUBSPOT_REDIRECT_URI ? 'SET' : 'NOT SET');

if (!process.env.HUBSPOT_CLIENT_ID || !process.env.HUBSPOT_CLIENT_SECRET || !process.env.HUBSPOT_REDIRECT_URI) {
  console.log('\n❌ Missing required HubSpot environment variables');
  console.log('Please add the following to your .env file:');
  console.log('HUBSPOT_CLIENT_ID=your_hubspot_client_id');
  console.log('HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret');
  console.log('HUBSPOT_REDIRECT_URI=http://localhost:3001/api/integrations/hubspot/callback');
} else {
  console.log('\n✅ All HubSpot environment variables are set');
  
  // Test the auth URL generation
  try {
    const params = new URLSearchParams({
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      redirect_uri: process.env.HUBSPOT_REDIRECT_URI!,
      scope: 'crm.objects.contacts.read crm.objects.contacts.write crm.schemas.contacts.read crm.objects.companies.read crm.objects.deals.read oauth',
      response_type: 'code',
    });
    const authUrl = `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
    console.log('\n✅ HubSpot OAuth URL generated successfully');
    console.log('URL length:', authUrl.length);
    console.log('URL contains redirect_uri:', authUrl.includes('redirect_uri'));
    console.log('First 100 chars:', authUrl.substring(0, 100));
  } catch (error) {
    console.log('\n❌ Error generating HubSpot OAuth URL:', error);
  }
} 