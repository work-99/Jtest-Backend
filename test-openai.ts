import OpenAI from 'openai';

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testOpenAI() {
  try {
    console.log('Testing OpenAI API with gpt-4o-mini...');
    
    // Test with a simple completion
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'Hello, this is a test message.' }
      ],
      max_tokens: 50
    });
    
    console.log('OpenAI API test successful!');
    console.log('Response:', response.choices[0].message.content);
    
  } catch (error) {
    console.error('OpenAI API test failed:');
    console.error('Error:', error);
    console.error('Error message:', (error as any).message);
    console.error('Error status:', (error as any).status);
  }
}

testOpenAI(); 