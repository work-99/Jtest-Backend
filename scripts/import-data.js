"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const data_import_service_1 = require("../src/services/data-import.service");
async function importData() {
    const userId = process.argv[2];
    if (!userId) {
        console.error('Please provide a user ID as an argument');
        console.log('Usage: npm run import-data <userId>');
        process.exit(1);
    }
    try {
        console.log(`Starting data import for user ${userId}...`);
        // Import all data
        await data_import_service_1.DataImportService.importAllData(parseInt(userId), 1000);
        // Show import statistics
        const stats = await data_import_service_1.DataImportService.getImportStats(parseInt(userId));
        console.log('\nImport Statistics:');
        stats.forEach((stat) => {
            console.log(`${stat.source}: ${stat.count} records`);
            console.log(`  Oldest: ${stat.oldest_record}`);
            console.log(`  Newest: ${stat.newest_record}`);
        });
        console.log('\n✓ Data import completed successfully!');
        console.log('\nYou can now ask questions like:');
        console.log('- "Who mentioned their kid plays baseball?"');
        console.log('- "Why did Greg say he wanted to sell AAPL stock?"');
        console.log('- "What did Sarah say about the meeting?"');
    }
    catch (error) {
        console.error('Error importing data:', error);
        process.exit(1);
    }
}
importData().catch(console.error);
