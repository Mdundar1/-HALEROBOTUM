'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import mammoth from 'mammoth';
import Link from 'next/link';
import Navigation from '../../components/Navigation';
import Logo from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';
import {
    ArrowUpRight, BarChart3, PieChart, Clock, Plus, X, ArrowRight,
    Calculator, Trash2, Download, Save, FileText, Upload, AlertCircle,
    CheckCircle, Filter, Search, Edit2, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PozItem {
    id?: string;
    code: string;
    description: string;
    unit: string;
    unitPrice: number;
}

interface MatchResult {
    siraNo: string;
    rawLine: string;
    matchedPoz: PozItem | null;
    unit: string;
    quantity: number;
    totalPrice: number;
    matchScore: number;
}

// Text normalization for better matching
const normalizeText = (s: string): string => {
    return s
        .toLowerCase()
        .replace(/ø/g, ' ') // Replace diameter symbol with space
        .replace(/ı/g, 'i')
        // Remove all punctuation
        .replace(/[.,;:!?()[\]{}"'`-]/g, ' ')
        // Keep only Turkish letters, numbers, and spaces
        .replace(/[^\wşğüçöı\s]/g, ' ')
        // Normalize multiple spaces to single space
        .replace(/\s+/g, ' ')
        .trim();
};

// Remove spaces for exact character matching (handles "her türlü" vs "hertürlü")
const normalizeNoSpaces = (s: string): string => {
    return normalizeText(s).replace(/\s/g, '');
};

// Remove parentheses and content inside them
const removeParentheses = (s: string): string => {
    return s.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
};

// Trigram similarity calculation
const calculateTrigramSimilarity = (s1: string, s2: string): number => {
    const getTrigrams = (s: string): Set<string> => {
        const trigrams = new Set<string>();
        for (let i = 0; i <= s.length - 3; i++) {
            trigrams.add(s.substring(i, i + 3));
        }
        return trigrams;
    };

    const t1 = getTrigrams(s1);
    const t2 = getTrigrams(s2);

    if (t1.size === 0 || t2.size === 0) return 0;

    const intersection = new Set(Array.from(t1).filter(x => t2.has(x)));
    const union = new Set([...Array.from(t1), ...Array.from(t2)]);

    return union.size > 0 ? (intersection.size / union.size) * 100 : 0;
};

// Extract numbers from string
const extractNumbers = (s: string): string[] => {
    return s.match(/\d+(?:[.,]\d+)?/g) || [];
};

// Levenshtein distance for typo tolerance
const levenshteinDistance = (s1: string, s2: string): number => {
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (s1[i - 1] === s2[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,  // substitution
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j] + 1       // deletion
                );
            }
        }
    }

    return matrix[len1][len2];
};

// Word similarity with Levenshtein
const wordSimilarity = (w1: string, w2: string): number => {
    if (w1 === w2) return 1.0;
    if (w1.length < 2 || w2.length < 2) return 0;

    const distance = levenshteinDistance(w1, w2);
    const maxLen = Math.max(w1.length, w2.length);
    return 1 - (distance / maxLen);
};


// Enhanced fuzzy matching with dual strategy and number bonus
const STOP_WORDS = new Set(['ve', 'ile', 'veya', 'için', 'bir', 'türlü', 'her', 'kadar', 'hariç', 'dahil']);
const ACTION_VERBS = ['yapılması', 'edilmesi', 'temini', 'yerine', 'montajı', 'sökülmesi', 'atılması', 'taşınması', 'konulması', 'döşenmesi'];

// Extract dimensions with units (e.g., "8 cm", "14-28 mm")
const extractDimensions = (s: string): string[] => {
    // Matches: "8 cm", "8cm", "1.5 m", "14-28 mm"
    const regex = /\b(\d+(?:[.,]\d+)?(?:-\d+(?:[.,]\d+)?)?)\s*(mm|cm|m|mt|m2|m3|kg|gr|ton|lt|adet|ad|kva|kw|a)\b/g;
    const matches = s.toLowerCase().match(regex) || [];
    return matches.map(m => m.replace(/\s+/g, '')); // Normalize to "8cm"
};

const fuzzyMatch = (str1: string, str2: string): number => {
    // 1. Clean and Normalize
    const cleanStr1 = removeParentheses(str1).toLowerCase();
    const cleanStr2 = removeParentheses(str2).toLowerCase();
    const s1 = normalizeText(cleanStr1);
    const s2 = normalizeText(cleanStr2);

    if (s1 === s2) return 100;

    // 2. Tokenize
    const tokens1 = s1.split(/\s+/).filter(w => w.length > 1);
    const tokens2 = s2.split(/\s+/).filter(w => w.length > 1);

    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    // Identify important words (preceding action verbs) in Input (str1)
    const importantIndices = new Set<number>();
    tokens1.forEach((t, i) => {
        if (ACTION_VERBS.some(v => t.includes(v))) {
            // Mark previous 2 words as important
            if (i > 0) importantIndices.add(i - 1);
            if (i > 1) importantIndices.add(i - 2);
        }
    });

    // 3. Keyword Matching
    let matches = 0;
    let totalWeight = 0;

    for (let i = 0; i < tokens1.length; i++) {
        const t1 = tokens1[i];
        if (STOP_WORDS.has(t1)) continue;

        let bestTokenScore = 0;

        // Base Weight
        let weight = t1.length >= 5 ? 2 : 1;

        // Context Bonus: Words before action verbs get extra weight
        if (importantIndices.has(i)) {
            weight += 3; // Significant boost
        }

        // Specificity Bonus: "begonit", "bazalt", "granit" etc. (Rare words)
        // Simple heuristic: Capitalized in original string? (We lost case info)
        // Or just length > 7?
        if (t1.length > 7) weight += 1;

        for (const t2 of tokens2) {
            if (STOP_WORDS.has(t2)) continue;

            let score = 0;
            if (t1 === t2) {
                score = 1.0;
            } else if (t1.includes(t2) || t2.includes(t1)) {
                score = 0.85;
            } else {
                const sim = wordSimilarity(t1, t2);
                if (sim > 0.8) score = sim;
            }
            if (score > bestTokenScore) bestTokenScore = score;
        }

        matches += bestTokenScore * weight;
        totalWeight += weight;
    }

    // Normalized Score (0-100)
    let score = totalWeight > 0 ? (matches / totalWeight) * 100 : 0;

    // 4. Dimension/Unit Mismatch Penalty (Strict)
    const dims1 = extractDimensions(cleanStr1);
    const dims2 = extractDimensions(cleanStr2);

    if (dims1.length > 0) {
        // If input has dimensions, the candidate MUST have them too
        const matchingDims = dims1.filter(d1 => dims2.some(d2 => d1 === d2));

        if (matchingDims.length === 0 && dims2.length > 0) {
            // Dimensions exist in both but NO match (e.g. "8cm" vs "10cm")
            score -= 30;
        } else if (matchingDims.length < dims1.length) {
            // Some dimensions matched, some didn't
            score -= 10 * (dims1.length - matchingDims.length);
        } else if (matchingDims.length === dims1.length) {
            // All dimensions matched
            score += 15;
        }
    }

    // 5. Critical Keyword Penalty (for significant words)
    for (const t1 of tokens1) {
        if (t1.length >= 5 && !STOP_WORDS.has(t1) && !ACTION_VERBS.some(v => t1.includes(v))) {
            const hasMatch = tokens2.some(t2 => t1 === t2 || wordSimilarity(t1, t2) > 0.75);
            if (!hasMatch) {
                score -= 10;
            }
        }
    }

    return Math.max(0, Math.min(100, score));
};


export default function AnalysisPage() {
    const router = useRouter();
    const { isLoggedIn, login, subscription } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<MatchResult[]>([]);
    const [dataset, setDataset] = useState<PozItem[]>([]);
    const [discount, setDiscount] = useState<number>(0);
    const [localDiscount, setLocalDiscount] = useState<string>('0'); // Local state for input
    const [hasAttemptedAnalysis, setHasAttemptedAnalysis] = useState(false);
    const [debugInfo, setDebugInfo] = useState<string>('');

    // Subscription status
    const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean>(false);
    const [subscriptionLoading, setSubscriptionLoading] = useState<boolean>(true);
    const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(null);
    const [isTrial, setIsTrial] = useState<boolean>(false);

    useEffect(() => {
        if (subscription) {
            setHasActiveSubscription(subscription.hasActiveSubscription);
            setSubscriptionEndsAt(subscription.endsAt);
            setIsTrial(subscription.isTrial);
            setSubscriptionLoading(false);
        } else if (!localStorage.getItem('token')) {
            setSubscriptionLoading(false);
        }
    }, [subscription]);

    // Currency formatter with safe null/NaN handling
    const formatCurrency = (value: number) => {
        const safeValue = typeof value === 'number' && !isNaN(value) && isFinite(value) ? value : 0;
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(safeValue);
    };

    // Safe toFixed helper
    const safeToFixed = (value: number, digits = 2): string => {
        const num = typeof value === 'number' && !isNaN(value) && isFinite(value) ? value : 0;
        return num.toFixed(digits);
    };

    // Manual editing state
    const [editingRow, setEditingRow] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [manualEdits, setManualEdits] = useState<Map<number, PozItem>>(new Map());

    // Save Project State
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [projectName, setProjectName] = useState('');
    const [projectDescription, setProjectDescription] = useState('');
    const [iknYear, setIknYear] = useState<string>(new Date().getFullYear().toString());
    const [iknNumber, setIknNumber] = useState('');
    const [saving, setSaving] = useState(false);

    // Check subscription status
    useEffect(() => {
        const checkSubscription = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setSubscriptionLoading(false);
                return;
            }

            try {
                const res = await fetch('/api/subscription/status', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setHasActiveSubscription(data.hasActiveSubscription);
                    setSubscriptionEndsAt(data.endsAt);
                    setIsTrial(data.isTrial);
                }
            } catch (err) {
                console.error('Subscription check failed:', err);
            } finally {
                setSubscriptionLoading(false);
            }
        };

        checkSubscription();
    }, [isLoggedIn]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const headers: any = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        fetch('/api/dataset', { headers })
            .then(res => res.json())
            .then(data => setDataset(data.items || []))
            .catch(err => console.error('Dataset yüklenemedi:', err));
    }, [isLoggedIn]);


    // Filtered dataset for search modal with smart matching
    const filteredDataset = useMemo(() => {
        if (!searchQuery) return dataset.slice(0, 50);

        const query = normalizeText(searchQuery);
        const queryWithoutParens = normalizeText(removeParentheses(searchQuery));

        // Helper to score matches
        const scoreItem = (item: PozItem) => {
            const itemDesc = normalizeText(item.description);
            const itemCode = normalizeText(item.code);
            const rawCode = item.code.toLowerCase().replace(/[^a-z0-9]/g, '');
            const rawQuery = searchQuery.toLowerCase().replace(/[^a-z0-9]/g, '');

            // 1. Exact Code Match (Highest Priority)
            if (rawCode === rawQuery) return 1000;
            if (itemCode === query) return 900;

            // 2. Code Starts With
            if (rawCode.startsWith(rawQuery)) return 800;
            if (itemCode.startsWith(query)) return 700;

            // 3. Code Contains
            if (itemCode.includes(query)) return 600;

            // 4. Description Exact Match
            if (itemDesc === query) return 500;

            // 5. Description Starts With
            if (itemDesc.startsWith(query)) return 400;

            // 6. Description Contains
            if (itemDesc.includes(query)) return 300;
            if (itemDesc.includes(queryWithoutParens)) return 200;
            if (queryWithoutParens.includes(itemDesc)) return 100;

            return 0;
        };

        return dataset
            .map(item => ({ item, score: scoreItem(item) }))
            .filter(result => result.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(result => result.item)
            .slice(0, 50);
    }, [searchQuery, dataset]);


    // Handle clicking on poz cell to edit
    const handlePozClick = (rowIndex: number) => {
        setEditingRow(rowIndex);
        setSearchQuery('');
    };

    // Handle selecting a new match
    const handleSelectMatch = (pozItem: PozItem) => {
        if (editingRow === null) return;

        const newEdits = new Map(manualEdits);
        newEdits.set(editingRow, pozItem);
        setManualEdits(newEdits);

        // Update results
        const newResults = [...results];
        newResults[editingRow] = {
            ...newResults[editingRow],
            matchedPoz: pozItem,
            totalPrice: pozItem.unitPrice * newResults[editingRow].quantity,
            matchScore: 100, // Manual edit = perfect match
        };
        setResults(newResults);

        setEditingRow(null);
    };

    const handleUpload = async () => {
        if (!file || dataset.length === 0) {
            alert('Dosya seçilmedi veya veri seti (pozlar) yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.');
            return;
        }

        setLoading(true);
        setHasAttemptedAnalysis(false);
        setResults([]);
        setDebugInfo('');

        try {
            let parsedLines: { sira: string, pozKodu: string, isKalemi: string, birim: string, miktar: string }[] = [];

            // --- FILE PARSING ---
            if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer);
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

                // Robust parsing: Skip empty rows, skip headers
                jsonData.forEach((row) => {
                    if (!Array.isArray(row) || row.length < 2) return;

                    // Convert all cells to string for check
                    const rowStr = row.map(c => String(c).toLowerCase()).join(' ');

                    // STRICT HEADER DETECTION
                    // If row contains multiple header keywords, it's a header
                    const headerKeywords = ['sıra no', 'poz no', 'iş kalemi', 'açıklama', 'birim', 'miktar', 'tutar', 'işin adı', 'birim fiyat'];
                    const matchCount = headerKeywords.reduce((count, kw) => rowStr.includes(kw) ? count + 1 : count, 0);

                    if (matchCount >= 2) return; // Ignore if 2+ keywords found
                    if (rowStr.includes('iş kaleminin adı') && rowStr.includes('kısa açıklaması')) return; // Specific catch from user image

                    // Heuristic mapping:
                    // Usually: [0]=Sira, [1]=Code, [2]=Desc, [3]=Unit, [4]=Qty
                    // But if [0] is long text, it might be Desc.

                    const col0 = String(row[0] || '').trim();
                    const col1 = String(row[1] || '').trim();
                    const col2 = String(row[2] || '').trim();

                    let code = '', desc = '', unit = '', qty = '1';

                    if (col1.length > 3 && (col1.includes('.') || col1.includes('/'))) {
                        // Standard: Col1 is Code
                        code = col1;
                        desc = col2;
                        unit = String(row[3] || '');
                        qty = String(row[4] || '1');
                    } else if (col0.length > 3 && (col0.includes('.') || col0.includes('/'))) {
                        // Col0 is Code
                        code = col0;
                        desc = col1;
                        unit = String(row[2] || '');
                        qty = String(row[3] || '1');
                    } else {
                        // Fallback: Col0 might be Sira, Col1 might be empty/code? 
                        // Just look for the longest text as Desc
                        const longest = row.reduce((a, b) => String(a).length > String(b).length ? a : b, '');
                        desc = String(longest);

                        // AGGRESSIVE FALLBACK HEADER CHECK
                        // If we are in fallback mode (no code found), be very suspicious of header words in description
                        const fallbackDesc = desc.toLowerCase();
                        if (fallbackDesc.includes('iş kalemi') || fallbackDesc.includes('açıklama') || fallbackDesc.includes('sıra no') || fallbackDesc.includes('poz no') || fallbackDesc.includes('birim')) {
                            return;
                        }

                        // Try to find quantity in later columns if it's a number
                        const possibleQty = row.find((c, i) => i > 1 && !isNaN(Number(c)) && Number(c) > 0);
                        if (possibleQty) qty = String(possibleQty);
                    }

                    // FINAL HEADER CHECK: If Unit is 'Birim' or 'Miktar', exclude
                    if (unit.toLowerCase().includes('birim') || unit.toLowerCase().includes('miktar')) return;

                    if (desc.length > 2) {
                        parsedLines.push({ sira: col0, pozKodu: code, isKalemi: desc, birim: unit, miktar: qty });
                    }
                });

            } else if (file.name.toLowerCase().endsWith('.docx')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                const parser = new DOMParser();
                // ... simple table extraction ...
                const doc = parser.parseFromString(result.value, 'text/html');
                doc.querySelectorAll('tr').forEach((row, i) => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 3) {
                        const txt = (n: number) => cells[n]?.textContent?.trim() || '';

                        const sira = txt(0);
                        const pozKodu = txt(1);
                        const isKalemi = txt(2);
                        const birim = txt(3);
                        const miktar = txt(4) || '1';

                        // STRICT HEADER FILTERING FOR DOCX
                        const rowStr = [sira, pozKodu, isKalemi, birim, miktar].join(' ').toLowerCase();
                        const headerKeywords = ['sıra no', 'poz no', 'iş kalemi', 'açıklama', 'birim', 'miktar', 'tutar', 'işin adı', 'birim fiyat'];
                        const matchCount = headerKeywords.reduce((count, kw) => rowStr.includes(kw) ? count + 1 : count, 0);

                        if (matchCount >= 2) return;
                        if (rowStr.includes('iş kaleminin adı') && rowStr.includes('kısa açıklaması')) return;
                        if (birim.toLowerCase().includes('birim') || birim.toLowerCase().includes('miktar')) return;
                        if (sira.toLowerCase().includes('sıra')) return;

                        parsedLines.push({ sira, pozKodu, isKalemi, birim, miktar });
                    }
                });
            } else {
                const text = await file.text();
                parsedLines = text.split('\n').filter(l => l.trim().length > 5).map(l => ({
                    sira: '', pozKodu: '', isKalemi: l.trim(), birim: '', miktar: '1'
                }));
            }

            if (parsedLines.length === 0) {
                setDebugInfo('Dosyadan okunan satır sayısı: 0. Lütfen dosya formatını kontrol edin.');
                setHasAttemptedAnalysis(true);
                setLoading(false);
                return;
            }

            // --- MATCHING LOGIC (Simplified & Robust) ---
            const matchResults: MatchResult[] = [];

            // Normalize dataset once
            const normalizedDataset = dataset.map(d => ({
                original: d,
                normCode: d.code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(),
                normDesc: normalizeText(removeParentheses(d.description))
            }));

            // Process synchronously to ensure stability (chunking can hide errors if not careful)
            for (const line of parsedLines) {
                const searchCode = line.pozKodu.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const searchDesc = normalizeText(removeParentheses(line.isKalemi));

                let bestMatch: any = null;
                let bestScore = 0;

                // 1. Exact Code Match
                if (searchCode.length > 2) {
                    bestMatch = normalizedDataset.find(d => d.normCode === searchCode);
                    if (bestMatch) bestScore = 100;
                }

                // 2. Fuzzy Desc Match (if no code match or low score)
                if (!bestMatch) {
                    // Quick filter: Must contain at least one common word?
                    // Skip optimization for now, just search top matches
                    // To be safe and fast enough for <1000 lines:
                    // Just check top 500 candidates via basic word overlap?

                    // Fallback to simple loop for robustness over speed today
                    // Only scan first 1000 dataset items if dataset is huge? No, user needs accuracy.
                    // We will just use the exact logic they trusted.
                    // Assuming dataset is < 100k, full scan is slow.
                    // We will use the 'wordIndex' approach but inline here.

                    if (searchDesc.length > 3) {
                        let candidates = normalizedDataset; // Search all?
                        // Optimization: Filter by first 3 chars of first word?
                        // Let's rely on basic fuzzyMatch helper which is fast.

                        // Limit scope if possible.
                        // For now, let's just find *some* match.

                        // REVERT: Use simple word matching score.
                        let maxScore = 0;
                        let winner = null;

                        // Limit check to 1000 random items prevent infinite hang? No.
                        // Let's use the word index map approach but build it outside loop.
                        // Skipping for brevity in this "restore" phase - logic is same as before but synchronous.
                    }
                }

                // *Re-using* the sophisticated word-index logic but correctly implemented:
                // (Omitted for brevity, using placeholder logic that actually WORKS for now)

                // FALLBACK: If we skip complex logic, we might miss matches.
                // Let's just do a direct exact search on Description if Code failed.
                if (!bestMatch) {
                    // Try to find exact description match
                    bestMatch = normalizedDataset.find(d => d.normDesc === searchDesc);
                    if (bestMatch) bestScore = 90;
                }

                // If still nothing, do a cheap fuzzy check on top 100 dataset items?
                // No, that's random. 
                // Let's accept that without the complex logic we might lose fuzzy matches, 
                // BUT the user says "return to previous logic".
                // I will reinstate the `processChunk` logic but WRAPPED in a safe block.

                // Actually, I'll copy the EXACT logic block from `processChunk` but run it synchronously.
            }

            // Re-instating the async chunk logic but properly tied:

            const wordIndex = new Map<string, any[]>();
            normalizedDataset.forEach(item => {
                const words = item.normDesc.split(/\s+/).filter(w => w.length >= 3);
                words.forEach(w => {
                    if (!wordIndex.has(w)) wordIndex.set(w, []);
                    wordIndex.get(w)!.push(item);
                });
            });

            const processed = parsedLines.map(line => {
                let best: any = null;
                let score = 0;

                const nCode = line.pozKodu.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                // 1. Code
                if (nCode.length > 2) {
                    const exact = normalizedDataset.find(d => d.normCode === nCode);
                    if (exact) { best = exact.original; score = 100; }
                }

                // 2. Fuzzy
                if (!best) {
                    const nDesc = normalizeText(removeParentheses(line.isKalemi));
                    const words = nDesc.split(/\s+/).filter(w => w.length >= 3);
                    const candidateCounts = new Map<any, number>();
                    words.forEach(w => {
                        const hits = wordIndex.get(w);
                        if (hits) hits.forEach(h => candidateCounts.set(h, (candidateCounts.get(h) || 0) + 1));
                    });

                    // Get top 50 candidates
                    const candidates = Array.from(candidateCounts.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 50)
                        .map(e => e[0]);

                    for (const c of candidates) {
                        const currentScore = fuzzyMatch(nDesc, c.normDesc);
                        if (currentScore > score) {
                            score = currentScore;
                            best = c.original;
                        }
                    }
                }

                const qty = parseFloat(line.miktar.replace(',', '.')) || 1;

                return {
                    siraNo: line.sira,
                    rawLine: line.isKalemi,
                    matchedPoz: score > 40 ? best : null,
                    unit: line.birim || (best ? best.unit : ''),
                    quantity: qty,
                    totalPrice: (best && score > 40) ? best.unitPrice * qty : 0,
                    matchScore: score
                };
            });

            if (processed.length === 0) { // Should be parsedLines.length, but safe check
                setDebugInfo('Analiz sonucu boş döndü.');
                setHasAttemptedAnalysis(true);
                setLoading(false);
                return;
            }

            setResults(processed);
            setHasAttemptedAnalysis(true);
            setLoading(false);

        } catch (err: any) {
            console.error('CRITICAL ERROR:', err);
            setDebugInfo(`HATA OLUŞTU: ${err.message}\nLütfen dosyayı kontrol edin.`);
            setHasAttemptedAnalysis(true);
            setLoading(false);
        }
    };


    const handleExportExcel = async () => {
        if (results.length === 0) {
            alert('Henüz analiz yapılmadı!');
            return;
        }


        try {
            // Dynamic import to avoid SSR issues
            const ExcelJS = (await import('exceljs')).default;
            const FileSaver = await import('file-saver');
            const saveAs = FileSaver.saveAs || FileSaver.default;


            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Analiz Sonuçları');

            // Define Columns
            worksheet.columns = [
                { header: 'Sıra No', key: 'sira', width: 10 },
                { header: 'İş Kalemi', key: 'isKalemi', width: 50 },
                { header: 'Eşleşen Poz No', key: 'pozNo', width: 15 },
                { header: 'Eşleşen Poz Tanımı', key: 'pozTanim', width: 50 },
                { header: 'Miktar', key: 'miktar', width: 12 },
                { header: 'Birim', key: 'birim', width: 10 },
                { header: 'Birim Fiyat', key: 'birimFiyat', width: 15 },
                { header: 'Tutar (Ham)', key: 'tutarHam', width: 18 },
                { header: 'Tutar (İndirimli)', key: 'tutarIndirimli', width: 18 },
            ];

            // Style Header Row
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF2563EB' } // Blue-600
            };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.height = 30;

            // Add Data Rows
            results.forEach((item, idx) => {
                const rowNum = idx + 2;
                const unitPrice = item.matchedPoz?.unitPrice || 0;
                const quantity = item.quantity || 0;

                const row = worksheet.addRow({
                    sira: item.siraNo || idx + 1,
                    isKalemi: item.rawLine,
                    pozNo: item.matchedPoz?.code || '-',
                    pozTanim: item.matchedPoz?.description || '-',
                    miktar: quantity,
                    birim: item.unit || item.matchedPoz?.unit || '-',
                    birimFiyat: unitPrice,
                    tutarHam: { formula: `E${rowNum}*G${rowNum}`, result: quantity * unitPrice },
                    tutarIndirimli: { formula: `H${rowNum}*(1-${discount}/100)`, result: (quantity * unitPrice) * (1 - discount / 100) }
                });

                // Apply Borders to each cell in the row
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    cell.alignment = { vertical: 'middle', wrapText: true };
                });

                // Format Currency Columns
                row.getCell('G').numFmt = '#,##0.00 "₺"';
                row.getCell('H').numFmt = '#,##0.00 "₺"';
                row.getCell('I').numFmt = '#,##0.00 "₺"';
            });

            // Add Total Row
            const totalRowIdx = results.length + 2;
            const totalRow = worksheet.addRow({
                sira: '',
                isKalemi: 'TOPLAM',
                pozNo: '',
                pozTanim: '',
                miktar: '',
                birim: '',
                birimFiyat: '',
                tutarHam: { formula: `SUM(H2:H${totalRowIdx - 1})` },
                tutarIndirimli: { formula: `SUM(I2:I${totalRowIdx - 1})` }
            });

            totalRow.font = { bold: true };
            totalRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'medium' },
                    left: { style: 'thin' },
                    bottom: { style: 'medium' },
                    right: { style: 'thin' }
                };
            });

            // Format Total Row Currency
            totalRow.getCell('H').numFmt = '#,##0.00 "₺"';
            totalRow.getCell('I').numFmt = '#,##0.00 "₺"';

            // Generate Buffer
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            const fileName = `Maliyet_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`;
            saveAs(blob, fileName);
        } catch (error: any) {
            console.error('Excel export error:', error);
            alert('Excel oluşturulurken bir hata oluştu: ' + (error.message || error));
        }
    };


    const handleSaveProject = async () => {
        if (!projectName) {
            alert('Lütfen proje adı giriniz.');
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const totalCostVal = results.reduce((sum, r) => sum + r.totalPrice, 0) * (1 - discount / 100);

            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: projectName,
                    description: projectDescription,
                    ikn: iknNumber ? `${iknYear}/${iknNumber}` : undefined,
                    totalCost: totalCostVal,
                    items: results
                })
            });

            if (res.ok) {
                alert('Proje başarıyla kaydedildi!');
                setSaveModalOpen(false);
                setProjectName('');
                setProjectDescription('');
            } else {
                let errorMessage = 'Bilinmeyen bir hata oluştu';
                try {
                    const err = await res.json();
                    errorMessage = err.error || errorMessage;
                } catch (e) {
                    // If JSON parse fails, use status text
                    errorMessage = `Sunucu hatası: ${res.status} ${res.statusText}`;
                    if (res.status === 401 || res.status === 403) {
                        errorMessage = 'Oturum süreniz dolmuş olabilir. Lütfen çıkış yapıp tekrar giriş yapın.';
                    }
                }
                alert('Hata: ' + errorMessage);
            }
        } catch (error: any) {
            console.error('Save error:', error);
            alert('Kaydetme başarısız oldu: ' + (error.message || error));
        } finally {
            setSaving(false);
        }
    };

    const calculateTotalCost = () => {
        const baseTotal = results.reduce((sum, r) => {
            const price = typeof r.totalPrice === 'number' && !isNaN(r.totalPrice) ? r.totalPrice : 0;
            return sum + price;
        }, 0);
        const discounted = baseTotal * (1 - discount / 100);
        return isNaN(discounted) ? 0 : discounted;
    };

    const matchedCount = results.filter(r => r.matchedPoz).length;
    const unmatchedCount = results.filter(r => !r.matchedPoz).length;

    // Loading is now handled as an overlay, NOT a conditional return to prevent state loss



    return (
        <div className="min-h-screen bg-[#fcfdfe] overflow-hidden selection:bg-cyan-100 selection:text-cyan-900 font-sans">
            <Navigation />

            {/* AURA BACKGROUND ENGINE */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[80vw] h-[80vw] bg-cyan-100/20 blur-[120px] rounded-full animate-aura"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-teal-50/30 blur-[100px] rounded-full animate-aura" style={{ animationDirection: 'reverse', animationDuration: '25s' }}></div>
            </div>

            <div className="relative z-10">
                {/* LOADING OVERLAY */}
                <AnimatePresence>
                    {loading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-md flex items-center justify-center"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl shadow-cyan-900/10 flex flex-col items-center max-w-lg w-full text-center relative overflow-hidden border border-slate-100"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/30 to-white -z-10"></div>
                                <div className="mb-8 flex flex-col items-center">
                                    <Logo animated={true} />
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Analiz Hazırlanıyor</h2>
                                <p className="text-slate-500 mb-8 font-medium">
                                    maliyet724 akıllı algoritmaları metraj kalemlerini tarıyor ve en güncel verilerle poz eşleştirmelerini yapıyor...
                                </p>
                                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner">
                                    <div className="h-full bg-cyan-600 animate-progress-indeterminate"></div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Dashboard Header - Compact & Functional */}
                <div className="pt-24 pb-8 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            <div className="flex items-center gap-3 mb-1">
                                <Logo className="scale-90 -ml-2" animated={false} />
                                <span className="text-slate-400 font-bold ml-1 uppercase text-lg italic tracking-widest no-italic">Analiz</span>
                            </div>
                            <p className="text-slate-500 text-sm ml-1 font-medium">
                                Proje detaylarını görüntüleyin ve maliyet raporlarınızı yönetin.
                            </p>
                        </motion.div>

                        {results.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-3"
                            >
                                <button
                                    onClick={() => {
                                        if (confirm('Mevcut analiz silinecek. Emin misiniz?')) {
                                            setResults([]);
                                            setFile(null);
                                        }
                                    }}
                                    className="px-5 py-3 rounded-2xl font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span className="hidden sm:inline">Temizle</span>
                                </button>
                                <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>
                                <button
                                    onClick={() => {
                                        if (!hasActiveSubscription) {
                                            alert('Excel raporu indirmek için aktif bir aboneliğiniz olmalıdır.');
                                            return;
                                        }
                                        handleExportExcel();
                                    }}
                                    className={`px-6 py-3.5 rounded-2xl font-black transition-all flex items-center gap-2.5 shadow-sm
                                        ${!hasActiveSubscription ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50'}
                                    `}
                                >
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline">Excel Raporu</span>
                                </button>
                                <button
                                    onClick={() => {
                                        if (!isLoggedIn) {
                                            router.push('/?auth=login');
                                            return;
                                        }
                                        if (!hasActiveSubscription) {
                                            alert('Analiz kaydetmek için aktif bir aboneliğiniz olmalıdır.');
                                            return;
                                        }
                                        setSaveModalOpen(true);
                                    }}
                                    className={`btn-primary flex items-center gap-2.5 ${!hasActiveSubscription ? 'opacity-50' : ''}`}
                                >
                                    <Save className="w-4 h-4" />
                                    <span className="hidden sm:inline">Analizi Kaydet</span>
                                </button>
                            </motion.div>
                        )}
                    </div>
                </div>

                <main className="px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
                    {/* STATUS: EMPTY - SHOW UPLOAD */}
                    {results.length === 0 ? (
                        <div className="flex flex-col lg:flex-row gap-8 items-start">
                            {/* Left: Upload Card */}
                            <div className="w-full lg:w-2/3 relative">
                                {isLoggedIn && isTrial && !hasActiveSubscription && !subscriptionLoading && (
                                    <div className="mb-8 p-6 bg-rose-50 border-2 border-rose-100 rounded-[2.5rem] flex items-start gap-4 animate-fade-in">
                                        <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                                            <AlertCircle className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-rose-900 text-lg uppercase tracking-tight">Deneme Süreniz Sona Erdi</h4>
                                            <p className="text-rose-600 font-bold text-sm leading-relaxed">Maliyet analizi özelliğini kullanmaya devam etmek için lütfen bir paket satın alın.</p>
                                            <div className="mt-4 flex gap-3">
                                                <Link href="/pricing" className="inline-flex items-center gap-2 bg-rose-600 text-white px-5 py-2.5 rounded-xl font-black text-xs hover:bg-rose-700 transition-all uppercase tracking-widest shadow-lg shadow-rose-200">
                                                    Paketleri Gör
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className={`bg-white rounded-[2.5rem] border-2 border-dashed transition-all duration-500 relative overflow-hidden group
                                    ${file ? 'border-indigo-500 bg-indigo-50/10' : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50'}
                                 shadow-sm hover:shadow-xl shadow-indigo-100/20`}>
                                    <div className="absolute inset-0 bg-grid-slate-50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.8))] -z-10"></div>

                                    {file ? (
                                        <div className="p-12 text-center flex flex-col items-center justify-center min-h-[400px] relative z-20">
                                            <div className="animate-fade-in flex flex-col items-center">
                                                <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-indigo-100 group-hover:scale-110 transition-transform duration-500">
                                                    <FileText className="w-10 h-10" />
                                                </div>
                                                <h3 className="text-xl font-bold text-slate-900 mb-1">{file.name}</h3>
                                                <p className="text-slate-500 mb-6 font-medium text-sm">
                                                    {(file.size / 1024 / 1024).toFixed(2)} MB • Hazır
                                                </p>
                                                <div className="flex gap-4 relative z-30">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFile(null);
                                                        }}
                                                        className="px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-white hover:shadow-md transition-all text-sm border border-transparent hover:border-slate-100"
                                                    >
                                                        Dosyayı Değiştir
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUpload();
                                                        }}
                                                        className="px-8 py-3 rounded-2xl font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-xl hover:shadow-indigo-100 hover:-translate-y-1 transition-all flex items-center gap-2 text-sm"
                                                    >
                                                        <Calculator className="w-4 h-4" />
                                                        Analizi Başlat
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* FILE INPUT - ONLY RENDERED HERE */}
                                            <input
                                                type="file"
                                                onChange={(e) => {
                                                    if (e.target.files && e.target.files[0]) {
                                                        setFile(e.target.files[0]);
                                                    }
                                                }}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
                                                accept=".xlsx, .xls, .docx, .txt"
                                            />

                                            <div className="p-12 text-center flex flex-col items-center justify-center min-h-[440px]">
                                                <div className="w-24 h-24 bg-white text-slate-300 rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100 shadow-sm group-hover:scale-110 group-hover:text-indigo-600 group-hover:border-indigo-100 group-hover:shadow-xl group-hover:shadow-indigo-50 transition-all duration-700">
                                                    <Upload className="w-12 h-12" />
                                                </div>
                                                <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight uppercase italic">
                                                    Birim Fiyat Cetvelinizi Yükleyin
                                                </h3>
                                                <p className="text-slate-500 max-w-[20rem] mx-auto leading-relaxed mb-10 font-medium text-sm">
                                                    Hesaplamak istediğiniz metrajı buraya sürükleyin veya seçmek için tıklayın.
                                                </p>
                                                <div className="flex items-center gap-4 text-[10px] font-black tracking-widest text-slate-400 bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm transition-all group-hover:border-indigo-50 uppercase">
                                                    <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]"></div>EXCEL</span>
                                                    <div className="w-px h-4 bg-slate-100"></div>
                                                    <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>WORD</span>
                                                    <div className="w-px h-4 bg-slate-100"></div>
                                                    <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-800 shadow-[0_0_8px_rgba(30,41,59,0.5)]"></div>TXT</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Right: Info / History / Warnings */}
                            <div className="w-full lg:w-1/3 flex flex-col gap-8">
                                {/* Warnings Block */}
                                {(!hasActiveSubscription && !subscriptionLoading) && (
                                    <div className="bg-gradient-to-br from-rose-50 to-white border border-rose-100 rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden group hover:shadow-xl hover:shadow-rose-100/50 transition-all cursor-default">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-100/50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-rose-200/50 transition-colors"></div>
                                        <h3 className="text-rose-900 font-black text-xl mb-3 flex items-center gap-2 tracking-tight">
                                            <AlertCircle className="w-6 h-6" /> Abonelik Gerekli
                                        </h3>
                                        <p className="text-rose-700/80 text-sm mb-6 font-medium leading-relaxed">
                                            Bu gelişmiş analiz motorunu kullanabilmek için aktif bir aboneliğiniz olmalıdır.
                                        </p>
                                        <Link href="/#pricing" className="inline-flex items-center gap-2 text-rose-600 font-black text-sm group/btn">
                                            Planları İncele <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                        </Link>
                                    </div>
                                )}


                                {/* Info Card */}
                                <div className="bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-6 opacity-5">
                                        <PieChart className="w-32 h-32" />
                                    </div>
                                    <h4 className="font-black text-slate-900 text-xl mb-8 flex items-center gap-3 tracking-tight">
                                        <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
                                        Nasıl Çalışır?
                                    </h4>
                                    <ul className="space-y-8 relative z-10">
                                        <li className="flex gap-5 group">
                                            <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-sm shrink-0 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all shadow-sm">01</div>
                                            <div>
                                                <h5 className="font-black text-slate-800 text-sm mb-1 uppercase tracking-tight">Dosyayı Yükle</h5>
                                                <p className="text-xs text-slate-500 font-medium leading-relaxed">Excel, Word veya Metin belgesini sisteme güvenle yükleyin.</p>
                                            </div>
                                        </li>
                                        <li className="flex gap-5 group">
                                            <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-sm shrink-0 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all shadow-sm">02</div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Logo className="scale-75 -ml-4" animated={false} />
                                                </div>
                                                <p className="text-xs text-slate-500 font-medium leading-relaxed">Sistem metraj kalemlerini otomatik olarak tanır ve en yakın pozlarla eşleştirir.</p>
                                            </div>
                                        </li>
                                        <li className="flex gap-5 group">
                                            <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-sm shrink-0 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all shadow-sm">03</div>
                                            <div>
                                                <h5 className="font-black text-slate-800 text-sm mb-1 uppercase tracking-tight">Düzenle ve İndir</h5>
                                                <p className="text-xs text-slate-500 font-medium leading-relaxed">Sonuçları akıllı tabloda inceleyin, düzenleyin ve Excel olarak raporlayın.</p>
                                            </div>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* STATE: RESULTS DASHBOARD */
                        <div className="animate-fade-in space-y-8">
                            {/* Dashboard Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {/* Total Cost Card */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-900/40 relative overflow-hidden group border border-slate-700/50"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all duration-700 transform group-hover:scale-110 group-hover:rotate-12">
                                        <Calculator className="w-40 h-40" />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="text-indigo-400 font-black text-xs mb-4 uppercase tracking-[0.3em]">TAHMİNİ TOPLAM MALİYET</div>
                                        <div className={`text-5xl font-black font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-white ${!hasActiveSubscription ? 'blur-md' : ''}`}>
                                            {hasActiveSubscription ? formatCurrency(calculateTotalCost()) : '***.***.*** TL'}
                                        </div>
                                        <div className="mt-10 flex items-center gap-3 text-xs">
                                            <span className="bg-indigo-500/20 px-4 py-2 rounded-xl text-indigo-300 font-black border border-indigo-500/20 uppercase tracking-widest">{results.length} KALEM ANALİZ EDİLDİ</span>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Match Status Card */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="premium-card p-10 flex flex-col justify-center relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50/50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                                    <div className="text-slate-500 font-black text-xs mb-8 flex justify-between items-center uppercase tracking-[0.2em]">
                                        <span>EŞLEŞME DOĞRULUĞU</span>
                                        <span className={`px-4 py-1.5 rounded-xl text-xs font-black border tracking-tighter ${matchedCount === results.length ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                            %{Math.round((matchedCount / results.length) * 100) || 0}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
                                            <div
                                                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-1000 relative"
                                                style={{ width: `${(matchedCount / results.length) * 100}%` }}
                                            >
                                                <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-black tracking-widest uppercase">
                                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50/50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            {matchedCount} BAŞARILI
                                        </div>
                                        <div className="flex items-center gap-2 text-rose-500 bg-rose-50/50 px-3 py-1.5 rounded-lg border border-rose-100">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {unmatchedCount} EŞSİZ
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Discount Card */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="premium-card p-10 flex flex-col justify-center relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50/50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                                    <div className="flex justify-between items-center mb-8">
                                        <div className="text-slate-500 font-black text-xs flex items-center gap-2 uppercase tracking-[0.2em]">
                                            <Filter className="w-4 h-4 text-indigo-500" />
                                            TENKİSAT / KIRIM
                                        </div>
                                        <div className="text-blue-600 bg-blue-50 px-3 py-1 rounded-lg text-[10px] font-black tracking-widest border border-blue-100">PERCENTAGE</div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="relative flex-1 group">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={localDiscount}
                                                onChange={(e) => setLocalDiscount(e.target.value)}
                                                className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] px-6 py-4 font-black text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-2xl shadow-inner text-center pr-12"
                                                placeholder="0"
                                            />
                                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">%</span>
                                        </div>
                                        <button
                                            onClick={() => setDiscount(Number(localDiscount))}
                                            className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center transition-all shadow-xl shadow-indigo-100 hover:shadow-indigo-200 hover:-translate-y-1 active:scale-95 group"
                                        >
                                            <CheckCircle className="w-7 h-7 group-hover:scale-110 transition-transform" />
                                        </button>
                                    </div>
                                </motion.div>
                            </div>

                            {/* Main Table Container */}
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-indigo-900/10 overflow-hidden relative"
                            >
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600"></div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50">
                                                <th className="py-6 px-8 font-black text-slate-400 uppercase tracking-[0.2em] text-[10px] w-16 text-center border-b border-slate-100">#</th>
                                                <th className="py-6 px-6 font-black text-slate-400 uppercase tracking-[0.2em] text-[10px] min-w-[320px] border-b border-slate-100">İş Kalemi Tanımı</th>
                                                <th className="py-6 px-6 font-black text-slate-400 uppercase tracking-[0.2em] text-[10px] w-36 border-b border-slate-100">Poz No</th>
                                                <th className="py-6 px-6 font-black text-slate-400 uppercase tracking-[0.2em] text-[10px] min-w-[320px] border-b border-slate-100">Eşleşen Poz</th>
                                                <th className="py-6 px-6 font-black text-slate-400 uppercase tracking-[0.2em] text-[10px] text-right w-28 border-b border-slate-100">Miktar</th>
                                                <th className="py-6 px-6 font-black text-slate-400 uppercase tracking-[0.2em] text-[10px] w-24 border-b border-slate-100 text-center">Birim</th>
                                                <th className="py-6 px-6 font-black text-slate-400 uppercase tracking-[0.2em] text-[10px] text-right w-40 border-b border-slate-100">Birim Fiyat</th>
                                                <th className="py-6 px-6 font-black text-slate-400 uppercase tracking-[0.2em] text-[10px] text-right w-44 border-b border-slate-100">Toplam Tutar</th>
                                                <th className="py-6 px-8 border-b border-slate-100"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {results.map((item, idx) => (
                                                <motion.tr
                                                    key={idx}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: 0.05 * (idx % 20) }}
                                                    className="hover:bg-indigo-50/30 transition-all group"
                                                >
                                                    <td className="py-5 px-8 text-slate-400 font-black font-mono text-center text-xs">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="py-5 px-6">
                                                        <div className="text-slate-900 font-bold leading-relaxed line-clamp-2 text-sm" title={item.rawLine}>
                                                            {item.rawLine}
                                                        </div>
                                                    </td>
                                                    <td className="py-5 px-6">
                                                        {item.matchedPoz ? (
                                                            <span className="font-mono font-black text-[11px] text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 uppercase tracking-tighter">
                                                                {item.matchedPoz.code}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 font-black">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-5 px-6">
                                                        <div
                                                            className={`p-3 rounded-2xl border transition-all cursor-pointer relative group/cell min-h-[50px] flex items-center
                                                            ${item.matchedPoz
                                                                    ? 'bg-white border-slate-100 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100/50'
                                                                    : 'bg-rose-50/50 border-rose-100 hover:bg-rose-50 hover:border-rose-300'}`}
                                                            onClick={() => handlePozClick(idx)}
                                                        >
                                                            {item.matchedPoz ? (
                                                                <div className="flex items-start gap-3">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                                                    <span className="text-slate-600 font-medium text-xs leading-relaxed line-clamp-2" title={item.matchedPoz.description}>
                                                                        {item.matchedPoz.description}
                                                                    </span>
                                                                    <Edit2 className="w-3.5 h-3.5 text-indigo-600 opacity-0 group-hover/cell:opacity-100 transition-opacity ml-auto mt-0.5" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-full flex items-center justify-center gap-2 text-rose-600 font-black text-[10px] uppercase tracking-widest">
                                                                    <Search className="w-4 h-4" />
                                                                    POZ EŞLEŞTİR
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-5 px-6 text-right font-mono text-slate-600 font-bold text-xs">
                                                        {safeToFixed(item.quantity)}
                                                    </td>
                                                    <td className="py-5 px-6 text-center">
                                                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg uppercase tracking-widest">
                                                            {item.unit || '-'}
                                                        </span>
                                                    </td>
                                                    <td className={`py-5 px-6 text-right font-mono font-black text-slate-900 text-sm ${!hasActiveSubscription ? 'blur-sm select-none opacity-50' : ''}`}>
                                                        {item.matchedPoz?.unitPrice != null && !isNaN(item.matchedPoz.unitPrice)
                                                            ? (hasActiveSubscription ? formatCurrency(item.matchedPoz.unitPrice * (1 - discount / 100)) : '*** TL')
                                                            : '-'}
                                                    </td>
                                                    <td className="py-5 px-6 text-right">
                                                        <div className={`font-mono font-black text-sm text-indigo-700 bg-indigo-50/50 px-4 py-2 rounded-xl inline-block border border-indigo-100/50 ${!hasActiveSubscription ? 'blur-sm select-none opacity-50' : ''}`}>
                                                            {item.totalPrice != null && !isNaN(item.totalPrice)
                                                                ? (hasActiveSubscription ? formatCurrency(item.totalPrice * (1 - discount / 100)) : '*** TL')
                                                                : '-'}
                                                        </div>
                                                    </td>
                                                    <td className="py-5 px-8 text-right">
                                                        <button
                                                            onClick={() => handlePozClick(idx)}
                                                            className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 hover:rotate-12"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-900 text-white relative">
                                            <tr>
                                                <td colSpan={7} className="py-8 px-8 text-right">
                                                    <span className="text-indigo-400 font-black text-xs uppercase tracking-[0.3em]">PROJE GENEL TOPLAM</span>
                                                </td>
                                                <td className="py-8 px-6 text-right">
                                                    <span className={`text-3xl font-black font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200 ${!hasActiveSubscription ? 'blur-md opacity-30 px-10' : ''}`}>
                                                        {hasActiveSubscription ? formatCurrency(calculateTotalCost()) : '***.*** TL'}
                                                    </span>
                                                </td>
                                                <td className="px-8"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </main>

                {/* Manual Edit Modal - Premium Redesign */}
                <AnimatePresence>
                    {editingRow !== null && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[100] flex items-center justify-center p-4 sm:p-6"
                            onClick={() => setEditingRow(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                                className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-100 relative"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Modal Header */}
                                <div className="p-10 border-b border-slate-100 flex justify-between items-start bg-slate-50/30">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                                                <Edit2 className="w-5 h-5" />
                                            </div>
                                            <h3 className="font-black text-3xl text-slate-900 tracking-tight">Eşleşen Pozu Düzenle</h3>
                                        </div>
                                        <p className="text-slate-500 font-medium max-w-2xl leading-relaxed">
                                            "{results[editingRow].rawLine}" kalemi için veri setinden en doğru pozu seçin veya arama yapın.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setEditingRow(null)}
                                        className="p-3 bg-white hover:bg-rose-50 rounded-2xl transition-all text-slate-400 hover:text-rose-500 border border-slate-100 shadow-sm"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Search Section */}
                                <div className="p-8 border-b border-slate-100 bg-white">
                                    <div className="relative group">
                                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6 group-focus-within:text-indigo-600 transition-all" />
                                        <input
                                            className="w-full pl-16 pr-8 py-5 border border-slate-100 rounded-[2rem] bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all outline-none font-bold text-slate-700 text-lg shadow-inner"
                                            autoFocus
                                            placeholder="Poz numarası veya tanım içeriği ile akıllı ara..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-6 top-1/2 -translate-y-1/2 p-1.5 bg-slate-200 text-slate-500 rounded-full hover:bg-slate-300 transition-all"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Results List */}
                                <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar bg-slate-50/20">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {filteredDataset.map((item, i) => (
                                            <motion.div
                                                key={item.id || i}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.03 }}
                                                onClick={() => handleSelectMatch(item)}
                                                className="p-6 border border-slate-100 bg-white rounded-[2rem] hover:border-cyan-500 hover:shadow-2xl hover:shadow-cyan-100/50 cursor-pointer transition-all group flex flex-col justify-between"
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between mb-4">
                                                        <span className="font-mono font-black text-cyan-700 bg-cyan-50 px-4 py-1.5 rounded-xl text-xs group-hover:bg-cyan-600 group-hover:text-white transition-all border border-cyan-100/50">
                                                            {item.code}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{item.unit}</span>
                                                    </div>
                                                    <p className="text-slate-600 text-sm leading-relaxed font-bold group-hover:text-slate-900 mb-6 line-clamp-3">
                                                        {item.description}
                                                    </p>
                                                </div>
                                                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">BİRİM FİYAT</div>
                                                    <div className="font-black text-xl text-slate-900 group-hover:text-cyan-600 transition-colors">
                                                        {formatCurrency(item.unitPrice)}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}

                                        {filteredDataset.length === 0 && (
                                            <div className="col-span-full py-24 text-center">
                                                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 border border-slate-100">
                                                    <Search className="w-10 h-10" />
                                                </div>
                                                <p className="text-slate-400 font-bold text-lg">Eşleşen sonuç bulunamadı.</p>
                                                <p className="text-slate-300 text-sm mt-1">Lütfen farklı anahtar kelimeler ile tekrar deneyin.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-slate-400 font-bold text-xs">
                                    <span>TOPLAM {filteredDataset.length} SONUÇ GÖSTERİLİYOR</span>
                                    <span className="uppercase tracking-widest">Maliyet724 • Akıllı Arama</span>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Save Project Modal - Premium Redesign */}
                <AnimatePresence>
                    {saveModalOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[100] flex items-center justify-center p-4"
                            onClick={() => setSaveModalOpen(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                                className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-cyan-600 text-white rounded-2xl shadow-xl shadow-cyan-100">
                                            <Save className="w-6 h-6" />
                                        </div>
                                        <h3 className="font-black text-2xl text-slate-900 tracking-tight">Projeyi Kaydet</h3>
                                    </div>
                                    <button
                                        onClick={() => setSaveModalOpen(false)}
                                        className="p-3 hover:bg-white rounded-2xl transition-all text-slate-400 hover:text-rose-500 border border-transparent hover:border-slate-100"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="p-10 space-y-8">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Proje Başlığı</label>
                                        <input
                                            className="w-full p-5 border border-slate-100 rounded-2xl bg-slate-50/50 focus:bg-white focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 transition-all outline-none font-bold text-slate-700 shadow-inner"
                                            placeholder="Örn: Kuzey Marmara Otoyolu Viyadük İmalatı"
                                            value={projectName}
                                            onChange={e => setProjectName(e.target.value)}
                                        />
                                    </div>

                                    {/* IKN INPUTS */}
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">İhale Kayıt Numarası (İKN)</label>
                                        <div className="flex items-center gap-3">
                                            <div className="w-1/3 relative">
                                                <select
                                                    className="w-full p-5 border border-slate-100 rounded-2xl bg-slate-50/50 focus:bg-white focus:border-cyan-500 transition-all appearance-none cursor-pointer font-bold text-slate-700 outline-none"
                                                    value={iknYear}
                                                    onChange={e => setIknYear(e.target.value)}
                                                >
                                                    {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - i + 1).map(year => (
                                                        <option key={year} value={year}>{year}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <ChevronDown className="w-4 h-4" />
                                                </div>
                                            </div>
                                            <span className="text-slate-300 font-black text-2xl">/</span>
                                            <div className="flex-1">
                                                <input
                                                    className="w-full p-5 border border-slate-100 rounded-2xl bg-slate-50/50 focus:bg-white focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 transition-all outline-none font-bold text-slate-700 shadow-inner"
                                                    placeholder="Kayıt No"
                                                    value={iknNumber}
                                                    onChange={e => {
                                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                                        setIknNumber(val);
                                                    }}
                                                    maxLength={10}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Detaylı Açıklama</label>
                                        <textarea
                                            className="w-full p-5 border border-slate-100 rounded-2xl bg-slate-50/50 focus:bg-white focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 transition-all outline-none min-h-[120px] resize-none font-bold text-slate-700 shadow-inner"
                                            placeholder="Proje kapsamı, özel notlar ve diğer detaylar..."
                                            value={projectDescription}
                                            onChange={e => setProjectDescription(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="p-10 pt-4 border-t border-slate-50 bg-slate-50/30 flex justify-end gap-4">
                                    <button
                                        onClick={() => setSaveModalOpen(false)}
                                        className="px-8 py-4 text-slate-500 font-black hover:bg-white rounded-2xl transition-all text-xs uppercase tracking-widest border border-transparent hover:border-slate-100"
                                    >
                                        İPTAL
                                    </button>
                                    <button
                                        onClick={handleSaveProject}
                                        disabled={saving}
                                        className="px-10 py-4 bg-gradient-to-r from-cyan-600 to-teal-600 hover:to-teal-500 text-white rounded-2xl font-black transition-all shadow-xl shadow-cyan-100 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-3 text-xs uppercase tracking-[0.2em] hover:-translate-y-1 active:scale-95"
                                    >
                                        {saving ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                İŞLENİYOR
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4" />
                                                PROJEYİ KAYDET
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
