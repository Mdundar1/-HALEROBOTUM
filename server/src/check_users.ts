import { querySqlite } from './sqlite';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

async function checkUsers() {
    try {
        console.log('Checking users in SQLite...');
        try {
            const users = await querySqlite('SELECT * FROM users');
            console.log(`Found ${users.length} users.`);
            if (users.length > 0) {
                console.log('First user email:', users[0].email);
            } else {
                console.log('No users found. Creating default admin...');

                const hashedPassword = await bcrypt.hash('admin123', 10);
                const userId = randomUUID();
                const now = new Date().toISOString();

                // Need to enable foreign keys or simple insert?
                await querySqlite(`
                    INSERT INTO users (id, email, password, name, email_verified, created_at)
                    VALUES (?, ?, ?, ?, 1, ?)
                `, [userId, 'admin@ihalerobotum.com', hashedPassword, 'Admin User', now]);

                console.log('Default admin created: admin@ihalerobotum.com / admin123');

                // Check if pkan exists
                const plans = await querySqlite(`SELECT * FROM subscription_plans WHERE id = 'pro-plan'`);
                if (plans.length === 0) {
                    await querySqlite(`
                        INSERT INTO subscription_plans (id, name, price, duration_months, is_active)
                        VALUES (?, ?, ?, ?, ?)
                    `, ['pro-plan', 'Pro Plan', 1000, 12, 1]);
                }

                await querySqlite(`
                    INSERT INTO subscriptions (id, user_id, plan_id, status, ends_at)
                    VALUES (?, ?, ?, ?, ?)
                `, [randomUUID(), userId, 'pro-plan', 'active', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()]);
                console.log('Admin subscription created.');
            }
        } catch (e: any) {
            if (e.message.includes('no such table')) {
                console.log('Tables do not exist! Running schema...');
                const fs = require('fs');
                const path = require('path');
                // This is a bit hacky, normally we'd parse the SQL file properly
                // But since we are debugging, let's just warn for now.
                console.error('SQLite tables not initialized. Please restart the server, the init logic might be missing.');
            }
            throw e;
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

checkUsers();
