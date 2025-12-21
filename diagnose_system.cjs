const Database = require('./server/node_modules/better-sqlite3');
const path = require('path');

async function diagnose() {
    console.log('--- DIAGNOSTIC START ---');

    // 1. Check Database
    try {
        const dbPath = path.join(__dirname, 'server/database.sqlite');
        console.log(`Checking DB at: ${dbPath}`);
        const db = new Database(dbPath);

        // List Tables
        const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all();
        console.log('Tables found:', tables.map(t => t.name));

        // Check Users
        const users = db.prepare("SELECT * FROM users").all();
        console.log('Users count:', users.length);
        if (users.length > 0) {
            console.log('Admin user exists:', users.some(u => u.email === 'admin@ihalerobotum.com'));
        }

        // Check Poz Dataset
        try {
            const count = db.prepare("SELECT COUNT(*) as count FROM poz_dataset").get();
            console.log('Poz Dataset count:', count.count);
        } catch (e) {
            console.error('Poz Dataset Error:', e.message);
        }

    } catch (e) {
        console.error('DATABASE ERROR:', e);
    }

    // 2. Test Login API
    console.log('\n--- TESTING LOGIN API ---');
    try {
        const response = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@ihalerobotum.com', password: 'admin' })
        });

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Response Body:', text);
        try {
            const json = JSON.parse(text);
            console.log('Parsed JSON:', json);
        } catch (e) {
            console.log('Response is NOT JSON');
        }

    } catch (e) {
        console.error('API FETCH ERROR:', e.message);
    }
    console.log('--- DIAGNOSTIC END ---');
}

diagnose();
