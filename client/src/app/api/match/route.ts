import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// --- Matching Logic Helpers (Ported) ---

interface PozItem {
    id: string;
    code: string;
    description: string;
    unit: string | null;
    unit_price: number | null;
}

function extractTechnicalSpecs(text: string): string[] {
    const specs: string[] = [];
    const t = text.toLowerCase();
    const calcRegex = /\(\s*\d+(?:[.,]\d+)?\s*[xX*]\s*\d+(?:[.,]\d+)?\s*\)\s*=\s*\d+(?:[.,]\d+)?/g;
    const calcs = t.match(calcRegex);
    if (calcs) specs.push(...calcs);
    const dimRegex = /\b\d+(?:[.,]\d+)?\s*[xX*]\s*\d+(?:[.,]\d+)?\b/g;
    const dims = t.match(dimRegex);
    if (dims) specs.push(...dims);
    const unitRegex = /\b\d+(?:[.,]\d+)?\s*(?:mm2|mm|cm|m|Ø|kg|ton|kw|kva|a|v)\b/g;
    const units = t.match(unitRegex);
    if (units) specs.push(...units);
    return specs;
}

function fuzzyMatch(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    if (s1 === s2) return 100;
    if (s1.includes(s2) || s2.includes(s1)) return 80;
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    let matches = 0;
    for (const w1 of words1) {
        for (const w2 of words2) {
            if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) {
                matches++;
                break;
            }
        }
    }
    return (matches / Math.max(words1.length, words2.length)) * 100;
}

export async function POST(request: Request) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // Fetch Dataset from Supabase
        // Note: For production with large datasets, using pgvector or full-text search is better.
        // For now, fetching all (assuming moderate size) to keep logic identical.
        const { data: dataset, error } = await supabaseAdmin
            .from('poz_dataset')
            .select('*');

        if (error || !dataset || dataset.length === 0) {
            return NextResponse.json({ error: 'No dataset available. Please upload POZ items via Admin.' }, { status: 400 });
        }

        const fileContent = await file.text();
        const lines = fileContent.split('\n').filter(l => l.trim().length > 5);

        const results = lines.map((rawLine, index) => {
            let bestMatch: any = null;
            let bestScore = 0;
            const codeMatch = rawLine.match(/(\d{1,2}\.\d{3}\.\d{3,4})/);
            const inputSpecs = extractTechnicalSpecs(rawLine);

            for (const item of dataset) {
                if (!item.description || item.description.length < 3) continue;

                let score = 0;
                if (codeMatch && item.code === codeMatch[1]) {
                    score = 100;
                } else {
                    score = fuzzyMatch(rawLine, item.description);
                    if (inputSpecs.length > 0) {
                        const itemSpecs = extractTechnicalSpecs(item.description);
                        let specMatches = 0;
                        let specConflicts = 0;
                        let calcMatch = false;

                        for (const spec of inputSpecs) {
                            const cleanSpec = spec.replace(/\s+/g, '');
                            const found = itemSpecs.some(s => s.replace(/\s+/g, '') === cleanSpec);
                            if (found) {
                                specMatches++;
                                if (spec.includes('=')) calcMatch = true;
                            } else if (itemSpecs.length > 0) {
                                specConflicts++;
                            }
                        }

                        if (calcMatch) score += 50;
                        else if (specMatches > 0 && specMatches === inputSpecs.length) score += 30;
                        else if (specConflicts > 0) score -= 50;
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = item;
                }
            }

            const qtyMatch = rawLine.match(/(\d+[\.,]?\d*)\s*(m[23]|kg|ton|adet|ad)/i);
            const quantity = qtyMatch ? parseFloat(qtyMatch[1].replace(',', '.')) : 1;

            return {
                index: index + 1,
                rawLine,
                matchedPoz: bestScore > 60 ? {
                    code: bestMatch.code,
                    description: bestMatch.description,
                    unit: bestMatch.unit,
                    unitPrice: bestMatch.unit_price || 0
                } : null,
                matchScore: bestScore,
                quantity,
                totalPrice: bestMatch && bestScore > 60 ? (bestMatch.unit_price || 0) * quantity : 0,
            };
        });

        const totalCost = results.reduce((sum, r) => sum + r.totalPrice, 0);

        return NextResponse.json({
            success: true,
            results,
            summary: {
                totalItems: results.length,
                matchedItems: results.filter(r => r.matchedPoz).length,
                unmatchedItems: results.filter(r => !r.matchedPoz).length,
                totalCost,
            },
        });

    } catch (error: any) {
        console.error('Matching error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
