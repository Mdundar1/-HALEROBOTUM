const Database = require('./server/node_modules/better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'server/database.sqlite');
console.log('Opening DB at:', dbPath);
const db = new Database(dbPath);

try {
    console.log('Checking for billing columns in users table...');
    const tableInfo = db.pragma('table_info(users)');

    const columns = [
        { name: 'company_name', type: 'TEXT' },
        { name: 'tax_office', type: 'TEXT' },
        { name: 'tax_number', type: 'TEXT' },
        { name: 'billing_address', type: 'TEXT' }
    ];

    columns.forEach(col => {
        const exists = tableInfo.some(c => c.name === col.name);
        if (!exists) {
            console.log(`Adding ${col.name} column...`);
            db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
        } else {
            console.log(`INFO: ${col.name} column already exists.`);
        }
    });

    console.log('SUCCESS: Billing columns check/add completed.');

} catch (error) {
    console.error('ERROR:', error);
}
