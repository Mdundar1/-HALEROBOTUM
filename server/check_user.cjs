const Database = require('better-sqlite3');
const path = require('path');

// Check the file in server directory
const dbPath = path.join(__dirname, 'database.sqlite');
console.log(`Checking DB at: ${dbPath}`);

try {
    const db = new Database(dbPath, { readonly: true });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@ihalerobotum.com');
    if (user) {
        console.log('User FOUND in DB:');
        console.log(user);
    } else {
        console.log('User NOT FOUND in DB.');
        const allUsers = db.prepare('SELECT * FROM users').all();
        console.log(`Total users in DB: ${allUsers.length}`);
        allUsers.forEach(u => console.log(` - ${u.email}`));
    }
} catch (error) {
    console.error('Error opening DB:', error.message);
}
