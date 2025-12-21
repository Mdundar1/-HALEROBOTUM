import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ADMIN_EMAILS = ['admin@ihalerobotum.com', 'info@ihalerobotum.com', 'sigorta.mucahitdunder@gmail.com'];

function verifyAdmin(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;
    try {
        const token = authHeader.split(' ')[1];
        const user: any = jwt.verify(token, JWT_SECRET);
        if (!ADMIN_EMAILS.includes(user.email)) return null;
        return user;
    } catch {
        return null;
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        if (!verifyAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        if (!supabaseAdmin) throw new Error('DB connection failed');

        const { code, description, unit, unitPrice } = await request.json();

        const { error } = await supabaseAdmin
            .from('poz_dataset')
            .update({
                code,
                description,
                unit,
                unit_price: unitPrice
            })
            .eq('id', params.id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        if (!verifyAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        if (!supabaseAdmin) throw new Error('DB connection failed');

        const { error } = await supabaseAdmin
            .from('poz_dataset')
            .delete()
            .eq('id', params.id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
