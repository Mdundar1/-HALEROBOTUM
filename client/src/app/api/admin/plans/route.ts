import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        const res = await fetch('http://localhost:3001/api/admin/plans', {
            headers: { 'Authorization': authHeader || '' }
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        return NextResponse.json({ error: 'Backend error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        const body = await request.json();
        const res = await fetch('http://localhost:3001/api/admin/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader || '' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        return NextResponse.json({ error: 'Backend error' }, { status: 500 });
    }
}
