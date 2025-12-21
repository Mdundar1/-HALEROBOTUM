import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyToken(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;
    try {
        const token = authHeader.split(' ')[1];
        return jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    } catch {
        return null;
    }
}

export async function GET(request: Request) {
    try {
        const user = verifyToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!supabaseAdmin) throw new Error('DB connection failed');

        const { data: profile, error } = await supabaseAdmin
            .from('users')
            .select('id, email, name, phone, created_at')
            .eq('id', user.id)
            .single();

        if (error) throw error;
        return NextResponse.json(profile);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const user = verifyToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!supabaseAdmin) throw new Error('DB connection failed');

        const { name, phone, password } = await request.json();

        const updates: any = { name, phone };

        if (password) {
            const bcrypt = require('bcryptjs'); // Lazy load
            updates.password = await bcrypt.hash(password, 10);
        }

        const { error } = await supabaseAdmin
            .from('users')
            .update(updates)
            .eq('id', user.id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
