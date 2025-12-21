const Database = require('./server/node_modules/better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'server/database.sqlite');
console.log('Opening DB at:', dbPath);
const db = new Database(dbPath);

try {
    console.log('Checking for phone column in users table...');
    const tableInfo = db.pragma('table_info(users)');
    const phoneExists = tableInfo.some(col => col.name === 'phone');

    if (!phoneExists) {
        console.log('Adding phone column...');
        db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
        console.log('SUCCESS: phone column added.');
    } else {
        console.log('INFO: phone column already exists.');
    }

} catch (error) {
    console.error('ERROR:', error);
}
