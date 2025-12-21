const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const { randomUUID } = require('crypto');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

async function setupAdmin() {
    const email = 'admin@ihalerobotum.com';
    const password = 'admin'; // Simple password for testing
    const name = 'Admin User';

    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user exists
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (user) {
        // Update password
        db.prepare('UPDATE users SET password = ? WHERE email = ?').run(hashedPassword, email);
        console.log(`Admin user ${email} updated with new password.`);
    } else {
        // Create user
        const id = randomUUID();
        db.prepare('INSERT INTO users (id, email, password, name, email_verified) VALUES (?, ?, ?, ?, 1)').run(id, email, hashedPassword, name);
        console.log(`Admin user ${email} created.`);
    }
}

setupAdmin();
