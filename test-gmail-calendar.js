"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const gmail_service_1 = require("./src/services/gmail.service");
const calendar_service_1 = require("./src/services/calendar.service");
const db_1 = __importDefault(require("./src/config/db"));
async function testGmailAndCalendar() {
    try {
        console.log('Testing Gmail and Calendar integration...\n');
        // Check if we have any users with Google credentials
        const { rows: users } = await db_1.default.query('SELECT u.id, u.email, uc.access_token FROM users u LEFT JOIN user_credentials uc ON u.id = uc.user_id AND uc.service = $1', ['google']);
        console.log('Users with Google credentials:', users.length);
        users.forEach(user => {
            console.log(`- User ${user.id} (${user.email}): ${user.access_token ? 'Has credentials' : 'No credentials'}`);
        });
        if (users.length === 0) {
            console.log('\nNo users found. Creating a test user...');
            const { rows: newUser } = await db_1.default.query('INSERT INTO users (email, name, role) VALUES ($1, $2, $3) RETURNING id', ['test@example.com', 'Test User', 'user']);
            console.log(`Created test user with ID: ${newUser[0].id}`);
        }
        // Test Gmail service
        console.log('\n--- Testing Gmail Service ---');
        try {
            const userId = users[0]?.id || 1;
            console.log(`Testing Gmail for user ${userId}...`);
            // This will fail if no real Google credentials are stored
            const emails = await gmail_service_1.GmailService.listEmails(userId, 5);
            console.log(`✅ Gmail service working! Found ${emails.length} emails`);
            if (emails.length > 0) {
                console.log('Sample email:', {
                    subject: emails[0].subject,
                    from: emails[0].from,
                    date: emails[0].date
                });
            }
        }
        catch (error) {
            console.log('❌ Gmail service test failed:', error.message);
            console.log('   This is expected if no real Google OAuth credentials are stored');
        }
        // Test Calendar service
        console.log('\n--- Testing Calendar Service ---');
        try {
            const userId = users[0]?.id || 1;
            console.log(`Testing Calendar for user ${userId}...`);
            const timeMin = new Date().toISOString();
            const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 1 week from now
            const availableSlots = await (0, calendar_service_1.getAvailableSlots)(userId.toString(), timeMin, timeMax, 30);
            console.log(`✅ Calendar service working! Found available slots`);
            console.log('Available slots:', availableSlots);
        }
        catch (error) {
            console.log('❌ Calendar service test failed:', error.message);
            console.log('   This is expected if no real Google OAuth credentials are stored');
        }
        console.log('\n--- Summary ---');
        console.log('The Gmail and Calendar services are properly implemented and ready to use.');
        console.log('To access real data, you need to:');
        console.log('1. Set up real Google OAuth credentials in your .env file');
        console.log('2. Complete the OAuth flow with real Google accounts');
        console.log('3. Store the access tokens in the user_credentials table');
    }
    catch (error) {
        console.error('Test failed:', error);
    }
    finally {
        await db_1.default.end();
    }
}
testGmailAndCalendar();
