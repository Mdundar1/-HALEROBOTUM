import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });
        }

        const data = await request.json();
        const items = data.items;

        if (!Array.isArray(items)) {
            return NextResponse.json({ error: 'Array expected in "items"' }, { status: 400 });
        }

        // Batch insert (Supabase limit is usually high, but let's chunk it if needed. 
        // For simplicity, we try direct insert first).
        const toInsert = items.map((item: any) => ({
            code: item.code,
            description: item.description,
            unit: item.unit,
            unit_price: item.unitPrice || item.unit_price || 0
        }));

        const { data: inserted, error } = await supabaseAdmin
            .from('poz_dataset')
            .upsert(toInsert, { onConflict: 'code' }) // Upsert based on unique code
            .select();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            addedCount: inserted?.length || 0,
            message: `${inserted?.length} kayıt başarıyla eklendi/güncellendi.`
        });

    } catch (error: any) {
        console.error('Upload dataset error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
