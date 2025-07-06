"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./src/config/db"));
async function listUsers() {
    try {
        const result = await db_1.default.query('SELECT id, email, name, role FROM users ORDER BY id');
        console.log('Users:');
        result.rows.forEach(row => {
            console.log(row);
        });
    }
    catch (error) {
        console.error('Error listing users:', error);
    }
    finally {
        await db_1.default.end();
    }
}
listUsers();
