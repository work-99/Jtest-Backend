"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = __importDefault(require("openai"));
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });
const openai = new openai_1.default({
    apiKey: "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"
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
    }
    catch (error) {
        console.error('OpenAI API test failed:');
        console.error('Error:', error);
        console.error('Error message:', error.message);
        console.error('Error status:', error.status);
    }
}
testOpenAI();
