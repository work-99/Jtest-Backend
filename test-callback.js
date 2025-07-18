"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const google_service_1 = require("./src/services/google.service");
const user_model_1 = require("./src/modules/user.model");
const google_service_2 = require("./src/services/google.service");
async function testCallback() {
    try {
        console.log('=== Testing Google OAuth Callback ===');
        // Test authorization code (this is a sample, you'll need to replace with a real one)
        const testCode = '4/0AVMBsJiLtDG33R7uX4u4RXuNqSAzg6qkFNqHx5rjcvfCqfh-rDImEBu9CIYGu_XAGdl9TA';
        console.log('1. Testing token exchange...');
        const tokens = await (0, google_service_1.getGoogleTokens)(testCode);
        console.log('✅ Tokens received:', {
            hasAccessToken: !!tokens.access_token,
            hasRefreshToken: !!tokens.refresh_token,
            expiryDate: tokens.expiry_date
        });
        console.log('\n2. Testing user data extraction...');
        const userData = await (0, google_service_1.getUserData)(tokens);
        console.log('✅ User data:', userData);
        console.log('\n3. Testing user lookup/creation...');
        let user = await user_model_1.UserModel.findByEmail(userData.email);
        if (!user) {
            console.log('Creating new user...');
            const createUserData = {
                email: userData.email,
                name: userData.name || userData.email,
                avatar: userData.picture,
                provider: 'google',
                provider_id: userData.sub || userData.email
            };
            user = await user_model_1.UserModel.create(createUserData);
            console.log('✅ New user created:', user);
        }
        else {
            console.log('✅ Existing user found:', user);
        }
        console.log('\n4. Testing credential saving...');
        await (0, google_service_2.saveGoogleCredentials)(user.id.toString(), tokens);
        console.log('✅ Credentials saved successfully');
        console.log('\n🎉 All callback steps completed successfully!');
    }
    catch (error) {
        console.error('❌ Error in callback test:', error);
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
    }
}
testCallback();
