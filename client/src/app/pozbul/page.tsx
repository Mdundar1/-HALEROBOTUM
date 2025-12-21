'use client';

import { useState, useEffect, useMemo } from 'react';
import Navigation from '../../components/Navigation';

interface PozItem {
    id?: string;
    code: string;
    description: string;
    unit: string;
    unitPrice: number;
}

const normalizeText = (s: string): string => {
    return s
        .toLowerCase()
        .replace(/ø/g, 'o')
        .replace(/([a-zçğıöşü])(\d)/gi, '$1 $2') // Split letter-number (c25 -> c 25)
        .replace(/(\d)([a-zçğıöşü])/gi, '$1 $2') // Split number-letter (25c -> 25 c)
        .replace(/[^\wşğüçöı\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

// Enhanced fuzzy matching with prioritization for exact matches and position
const fuzzyMatchDescription = (searchQuery: string, targetText: string): number => {
    const query = normalizeText(searchQuery);
    const target = normalizeText(targetText);

    // Exact match - highest priority
    if (target === query) return 1000;

    // Direct substring match - high priority
    if (target.includes(query)) {
        // Bonus if it starts with the query
        if (target.startsWith(query)) return 950;
        return 900;
    }

    // Word-based matching with improved scoring
    const queryWords = query.split(/\s+/).filter(w => w.length >= 1);
    const targetWords = target.split(/\s+/);

    if (queryWords.length === 0) return 0;

    let totalScore = 0;
    let exactMatches = 0;
    let consecutiveMatches = 0;
    let lastMatchIndex = -1;

    for (const qWord of queryWords) {
        let bestWordScore = 0;
        let currentMatchIndex = -1;

        for (let i = 0; i < targetWords.length; i++) {
            const tWord = targetWords[i];

            if (tWord === qWord) {
                // Exact word match - highest priority
                bestWordScore = 100;
                exactMatches++;
                currentMatchIndex = i;
                break;
            } else if (tWord.startsWith(qWord) && tWord.length <= qWord.length + 3) {
                // Word starts with query and is similar length (e.g., "beton" matches "betonarme")
                bestWordScore = Math.max(bestWordScore, 85);
                if (currentMatchIndex === -1) currentMatchIndex = i;
            } else if (qWord.length >= 3 && tWord.startsWith(qWord)) {
                // Longer prefix match
                bestWordScore = Math.max(bestWordScore, 75);
                if (currentMatchIndex === -1) currentMatchIndex = i;
            } else if (tWord.includes(qWord) && qWord.length >= 3) {
                // Query is substring of word
                const position = tWord.indexOf(qWord);
                const positionPenalty = position > 0 ? 0.8 : 1;
                bestWordScore = Math.max(bestWordScore, 40 * positionPenalty);
            } else if (qWord.includes(tWord) && tWord.length >= 2) {
                // Word is substring of query
                bestWordScore = Math.max(bestWordScore, 60);
            }
        }

        // Check for consecutive matches
        if (currentMatchIndex !== -1 && lastMatchIndex !== -1 && currentMatchIndex === lastMatchIndex + 1) {
            consecutiveMatches++;
        }
        if (currentMatchIndex !== -1) {
            lastMatchIndex = currentMatchIndex;
        }

        totalScore += bestWordScore;
    }

    // Calculate match ratio
    const avgScore = totalScore / queryWords.length;
    const exactMatchRatio = exactMatches / queryWords.length;

    // Bonuses
    const exactBonus = exactMatchRatio * 500;
    const consecutiveBonus = consecutiveMatches * 50;

    // Position bonus: higher score if the first query word appears early in the target
    const firstWordIndex = targetWords.findIndex(w => w.startsWith(queryWords[0]));
    const positionScore = firstWordIndex !== -1 ? Math.max(0, 100 - (firstWordIndex * 5)) : 0;

    return avgScore + exactBonus + consecutiveBonus + positionScore;
};

// Score for code matching
const matchCode = (searchQuery: string, code: string): number => {
    const query = normalizeText(searchQuery);
    const target = normalizeText(code); // Normalize code too (remove dots etc if needed, but keeping dots is usually good for codes)
    // Actually, for codes, we might want to strip dots for flexible matching
    const cleanQuery = query.replace(/\./g, '');
    const cleanTarget = target.replace(/\./g, '');

    if (cleanTarget === cleanQuery) return 2000; // Absolute priority for exact code
    if (cleanTarget.startsWith(cleanQuery)) return 1500; // High priority for code prefix
    if (cleanTarget.includes(cleanQuery)) return 1000; // Good priority for code substring

    return 0;
};

export default function PozBulPage() {
    const [dataset, setDataset] = useState<PozItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('token');
        fetch('/api/dataset', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => setDataset(data.items || []))
            .catch(err => console.error('Dataset yüklenemedi:', err));
    }, []);

    const filteredResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        if (dataset.length === 0) return [];

        // Unified search logic
        const scoredResults = dataset
            .map(item => {
                const descriptionScore = fuzzyMatchDescription(searchQuery, item.description);
                const codeScore = matchCode(searchQuery, item.code);

                // Take the best score
                return {
                    item,
                    score: Math.max(descriptionScore, codeScore)
                };
            });

        // Handle empty results
        if (scoredResults.length === 0) return [];

        // Adaptive Thresholding
        const maxScore = Math.max(...scoredResults.map(r => r.score));

        // Handle case where maxScore is -Infinity or 0
        if (!isFinite(maxScore) || maxScore === 0) return [];

        let dynamicThreshold = 60; // Default low threshold

        if (maxScore > 2000) {
            // Exact code match found (Score > 2000)
            dynamicThreshold = 1500;
        } else if (maxScore > 900) {
            // Very strong description match (Score > 900)
            // Be extremely strict: only show items that are almost as good as the best one
            // This filters out "C 20/25" when "C 25/30" is found (which scores much higher)
            dynamicThreshold = maxScore * 0.95;
        } else if (maxScore > 500) {
            // Decent match found
            dynamicThreshold = maxScore * 0.8;
        }

        const filtered = scoredResults
            .filter(result => result.score > dynamicThreshold)
            .sort((a, b) => b.score - a.score);

        // Strict duplicate removal
        const seenCodes = new Set<string>();
        const seenDescriptions = new Set<string>();

        const uniqueResults = filtered.filter(result => {
            const normalizedCode = result.item.code.trim();
            const normalizedDesc = normalizeText(result.item.description);

            // Filter out if code already seen
            if (seenCodes.has(normalizedCode)) return false;

            // Filter out if exact description already seen
            if (seenDescriptions.has(normalizedDesc)) return false;

            seenCodes.add(normalizedCode);
            seenDescriptions.add(normalizedDesc);
            return true;
        });

        return uniqueResults.slice(0, 100).map(r => r.item);
    }, [dataset, searchQuery]);


    return (
        <div className="min-h-screen bg-slate-50 font-sans pt-28 pb-12">
            <Navigation />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                {/* Header */}
                <div className="mb-10 text-center">
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">Poz Arama Motoru</h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Binlerce poz ve tanım arasında yapay zeka destekli anlık arama yapın.
                    </p>
                </div>

                {/* Search Card */}
                <div className="card p-0 mb-8 max-w-3xl mx-auto shadow-xl shadow-indigo-900/5 bg-white rounded-2xl overflow-hidden border border-slate-200 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                            <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Poz no (örn: 15.150) veya tanım (örn: c25 beton) yazın..."
                            className="w-full pl-16 pr-6 py-5 text-lg text-slate-900 placeholder:text-slate-400 border-none outline-none bg-transparent"
                            autoFocus
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-4 text-slate-400 hover:text-slate-600 px-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats */}
                {searchQuery.trim() && (
                    <div className="text-center mb-8">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-sm font-medium border border-slate-200">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            {filteredResults.length.toLocaleString()} sonuç bulundu
                        </span>
                    </div>
                )}

                {/* Results Table */}
                {searchQuery.trim() && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="p-4 font-bold text-xs text-slate-500 uppercase tracking-wider" style={{ width: '140px' }}>Poz No</th>
                                        <th className="p-4 font-bold text-xs text-slate-500 uppercase tracking-wider">Tanım</th>
                                        <th className="p-4 font-bold text-xs text-slate-500 uppercase tracking-wider text-center" style={{ width: '100px' }}>Birim</th>
                                        <th className="p-4 font-bold text-xs text-slate-500 uppercase tracking-wider text-right" style={{ width: '140px' }}>Birim Fiyat</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredResults.length > 0 ? (
                                        filteredResults.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                                                <td className="p-4 font-mono text-indigo-600 font-bold text-sm bg-slate-50/30 group-hover:bg-transparent transition-colors">
                                                    {item.code}
                                                </td>
                                                <td className="p-4 text-sm text-slate-700 font-medium leading-relaxed">
                                                    {item.description}
                                                </td>
                                                <td className="p-4 text-slate-500 text-sm text-center font-medium bg-slate-50/30 group-hover:bg-transparent transition-colors">
                                                    {item.unit}
                                                </td>
                                                <td className="p-4 text-right font-bold text-slate-900 text-sm font-mono bg-slate-50/30 group-hover:bg-transparent transition-colors">
                                                    {item.unitPrice != null && !isNaN(item.unitPrice)
                                                        ? `₺${item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
                                                        : '-'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="p-16 text-center">
                                                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                                    </svg>
                                                </div>
                                                <h3 className="text-lg font-bold text-slate-900 mb-1">Sonuç Bulunamadı</h3>
                                                <p className="text-slate-500">
                                                    "{searchQuery}" araması için herhangi bir kayıt eşleşmedi.
                                                </p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {!searchQuery.trim() && (
                    <div className="grid md:grid-cols-3 gap-6 mt-12 opacity-80">
                        <div className="text-center p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
                            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4 text-indigo-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">Akıllı Arama</h3>
                            <p className="text-sm text-slate-500">Poz numarası veya tanım parçalarıyla arama yapabilirsiniz.</p>
                        </div>
                        <div className="text-center p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4 text-blue-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">Anlık Sonuç</h3>
                            <p className="text-sm text-slate-500">Binlerce veri arasından milisaniyeler içinde sonuç alın.</p>
                        </div>
                        <div className="text-center p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
                            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-4 text-amber-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">Güncel Fiyatlar</h3>
                            <p className="text-sm text-slate-500">En güncel birim fiyatları görüntüleyin.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
