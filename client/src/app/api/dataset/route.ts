import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });
        }

        const { data: items, error } = await supabaseAdmin
            .from('poz_dataset')
            .select('*')
            .order('code', { ascending: true })
            .limit(1000); // Limit for performance

        if (error) throw error;

        const formattedItems = items?.map((item: any) => ({
            id: item.id?.toString(),
            code: item.code,
            description: item.description,
            unit: item.unit,
            unitPrice: item.unit_price
        })) || [];

        return NextResponse.json({ items: formattedItems, count: formattedItems.length });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
