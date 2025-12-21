const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log('Checking users table schema...');
const columns = db.pragma('table_info(users)');
console.log('Columns:', columns.map(c => c.name));

const hasEmailVerified = columns.some(c => c.name === 'email_verified');

if (!hasEmailVerified) {
    console.log('Adding email_verified column...');
    db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0');
    db.exec('ALTER TABLE users ADD COLUMN verified_at DATETIME');
}

console.log('Checking subscriptions table...');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='subscriptions'").get();

if (!tables) {
    console.log('Subscriptions table missing (initSchema might not have run on existing DB). You might need to run the app once.');
}

console.log('Schema check complete.');
