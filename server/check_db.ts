
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new Database(dbPath);

const plans = db.prepare('SELECT * FROM subscription_plans').all();
const users = db.prepare('SELECT * FROM users').all();

console.log('--- PLANS ---');
console.table(plans);
console.log('--- USERS ---');
console.table(users);
