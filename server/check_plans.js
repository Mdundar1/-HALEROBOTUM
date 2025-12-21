const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
console.log('Opening DB:', dbPath);
const db = new Database(dbPath);

const plans = db.prepare('SELECT id, name, tier, duration_months FROM subscription_plans').all();
console.table(plans);
