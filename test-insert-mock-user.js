"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./src/config/db"));
async function insertMockUser() {
    try {
        // Insert user with id=1 if not exists
        await db_1.default.query(`
      INSERT INTO users (id, email, name, role, provider, provider_id)
      VALUES (1, 'test@example.com', 'Test User', 'user', 'mock', 'mock-1')
      ON CONFLICT (id) DO NOTHING;
    `);
        console.log('Mock user inserted (or already exists).');
    }
    catch (error) {
        console.error('Error inserting mock user:', error);
    }
    finally {
        await db_1.default.end();
    }
}
insertMockUser();
