"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hubspot_service_1 = require("./src/services/hubspot.service");
// List of test queries
const testQueries = [
    'Asa hi',
    'hi Asa',
    'Asahi',
    'Asa',
    'hi',
    'Asa hi Smith',
    'Please contact Asa hi for me',
    'Maria',
    'Brian Halligan',
    'emailmaria@hubspot.com'
];
// Replace with a valid userId from your database
const testUserId = '354026458355';
async function testContactMatching() {
    for (const query of testQueries) {
        const contacts = await (0, hubspot_service_1.searchContacts)(testUserId, query);
        if (contacts && contacts.length > 0) {
            console.log(`Query: "${query}" => Found:`, contacts.map(c => ({
                id: c.id,
                firstname: c.properties?.firstname,
                lastname: c.properties?.lastname,
                email: c.properties?.email
            })));
        }
        else {
            console.log(`Query: "${query}" => No contacts found.`);
        }
    }
}
testContactMatching().catch(console.error);
