"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./src/config/db"));
async function checkTables() {
    try {
        const result = await db_1.default.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
        console.log('Available tables:');
        result.rows.forEach((row) => {
            console.log(`- ${row.table_name}`);
        });
        // Check if embeddings table exists
        const embeddingsResult = await db_1.default.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'embeddings'
      );
    `);
        console.log('\nEmbeddings table exists:', embeddingsResult.rows[0].exists);
    }
    catch (error) {
        console.error('Error checking tables:', error);
    }
    finally {
        await db_1.default.end();
    }
}
checkTables();
