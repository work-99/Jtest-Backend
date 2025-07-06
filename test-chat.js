const https = require('https');
const http = require('http');

const data = JSON.stringify({
  message: "Schedule an appointment with Sara smith"
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/chat/message',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': 'Bearer mock-token'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Response:', responseData);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end(); 