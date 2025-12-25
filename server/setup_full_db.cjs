const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log('Setting up full database schema...');

// Users
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        phone TEXT,
        company TEXT,
        email_verified INTEGER DEFAULT 0,
        verified_at TEXT,
        company_name TEXT,
        tax_office TEXT,
        tax_number TEXT,
        billing_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Projects
db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        total_cost REAL,
        tender_registration_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
`);

// Project Items
db.exec(`
    CREATE TABLE IF NOT EXISTS project_items (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        raw_line TEXT,
        unit TEXT,
        matched_poz_code TEXT,
        matched_poz_description TEXT,
        matched_poz_unit TEXT,
        matched_poz_unit_price REAL,
        quantity REAL,
        total_price REAL,
        match_score REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
`);

// Subscriptions
db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        plan_id TEXT,
        status TEXT,
        starts_at TEXT,
        ends_at TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(plan_id) REFERENCES subscription_plans(id)
    )
`);

// Verification Codes
db.exec(`
    CREATE TABLE IF NOT EXISTS verification_codes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
`);

// Poz Items
db.exec(`
    CREATE TABLE IF NOT EXISTS poz_items (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        description TEXT,
        unit TEXT,
        unit_price REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

console.log('Database schema setup complete.');
