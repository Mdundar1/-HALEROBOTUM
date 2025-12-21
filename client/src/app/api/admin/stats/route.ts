import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        const res = await fetch('http://localhost:3001/api/admin/stats', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader || ''
            }
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json({ error: 'Backend connection failed' }, { status: 500 });
    }
}
