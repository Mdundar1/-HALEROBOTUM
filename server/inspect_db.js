const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Inspecting:', dbPath);

db.serialize(() => {
    // Schema of subscription_plans
    db.all("PRAGMA table_info(subscription_plans)", (err, columns) => {
        if (err) console.error(err);
        else console.log('Plan Schema:', columns);
    });

    // Content of subscription_plans
    db.all("SELECT * FROM subscription_plans", (err, rows) => {
        if (err) console.error(err);
        else console.log('All Plans:', rows);
    });
});

// Wait a bit before closing to allow async callbacks
setTimeout(() => db.close(), 1000);
