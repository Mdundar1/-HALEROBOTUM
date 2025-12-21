import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

const dbPath = path.resolve(__dirname, '../database.sqlite');
const dbExists = fs.existsSync(dbPath);

let db: sqlite3.Database | null = null;

if (dbExists) {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening SQLite database:', err.message);
        } else {
            console.log('Connected to SQLite database.');
        }
    });
} else {
    console.warn('SQLite database file not found at:', dbPath);
}

export const querySqlite = (sql: string, params: any[] = []): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        if (!db) {
            return resolve([]);
        }
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

export default db;
