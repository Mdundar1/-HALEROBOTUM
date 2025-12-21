'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/context/AuthContext';
import * as XLSX from 'xlsx';

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

export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { isLoggedIn } = useAuth();
    const projectId = params.id as string;

    const [projectName, setProjectName] = useState('');
    const [projectDescription, setProjectDescription] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [results, setResults] = useState<MatchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [showPozModal, setShowPozModal] = useState(false);
    const [dataset, setDataset] = useState<PozItem[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [discount, setDiscount] = useState(0);
    const [localDiscount, setLocalDiscount] = useState('0');
    const [searchQuery, setSearchQuery] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (!isLoggedIn) {
            router.push('/');
            return;
        }
        fetchProject();
        fetchDataset();
    }, [isLoggedIn, projectId]);

    const fetchProject = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/projects/${projectId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                const project = await res.json();
                setProjectName(project.name);
                setProjectDescription(project.description || '');

                // Transform DB items back to MatchResult format
                const transformedResults: MatchResult[] = project.items.map((item: any, index: number) => ({
                    siraNo: String(index + 1),
                    rawLine: item.raw_line,
                    matchedPoz: item.matched_poz_code ? {
                        code: item.matched_poz_code,
                        description: item.matched_poz_description,
                        unit: item.matched_poz_unit,
                        unitPrice: item.matched_poz_unit_price
                    } : null,
                    unit: item.unit || item.matched_poz_unit || '',
                    quantity: item.quantity,
                    totalPrice: item.total_price,
                    matchScore: item.match_score || 0
                }));

                setResults(transformedResults);
            } else {
                alert('Proje bulunamadı');
                router.push('/projects');
            }
        } catch (error) {
            console.error('Failed to fetch project:', error);
            alert('Proje yüklenirken hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const fetchDataset = async () => {
        try {
            const res = await fetch('/api/dataset');
            if (res.ok) {
                const data = await res.json();
                setDataset(data.items);
            }
        } catch (error) {
            console.error('Failed to fetch dataset:', error);
        }
    };

    const handlePozClick = (idx: number) => {
        setSelectedIndex(idx);
        setShowPozModal(true);
        setSearchQuery('');
    };

    const handleSelectPoz = (poz: PozItem) => {
        if (selectedIndex !== null) {
            const updatedResults = [...results];
            updatedResults[selectedIndex].matchedPoz = poz;
            updatedResults[selectedIndex].totalPrice = poz.unitPrice * updatedResults[selectedIndex].quantity;
            updatedResults[selectedIndex].matchScore = 100;
            setResults(updatedResults);
            setShowPozModal(false);
            setSelectedIndex(null);
        }
    };

    const handleSaveProject = async () => {
        if (!projectName.trim()) {
            alert('Proje adı gerekli');
            return;
        }

        setSaving(true);
        try {
            const totalCost = calculateTotalCost();
            const token = localStorage.getItem('token');

            const res = await fetch(`/api/projects/${projectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: projectName,
                    description: projectDescription,
                    items: results,
                    totalCost
                })
            });

            if (res.ok) {
                alert('Proje başarıyla güncellendi!');
                setIsEditing(false);
            } else {
                let errorMessage = 'Bilinmeyen bir hata oluştu';
                try {
                    const err = await res.json();
                    errorMessage = err.error || errorMessage;
                } catch (e) {
                    errorMessage = `Sunucu hatası: ${res.status} ${res.statusText}`;
                    if (res.status === 401 || res.status === 403) {
                        errorMessage = 'Oturum süreniz dolmuş olabilir. Lütfen çıkış yapıp tekrar giriş yapın.';
                    }
                }
                alert('Hata: ' + errorMessage);
            }
        } catch (error: any) {
            console.error('Save error:', error);
            alert('Güncelleme başarısız oldu: ' + (error.message || error));
        } finally {
            setSaving(false);
        }
    };

    const handleExportExcel = () => {
        if (results.length === 0) {
            alert('Henüz veri yok!');
            return;
        }

        const excelData = results.map((item, idx) => {
            const totalPrice = typeof item.totalPrice === 'number' && !isNaN(item.totalPrice) ? item.totalPrice : 0;
            const unitPrice = item.matchedPoz?.unitPrice;
            const discountedPrice = totalPrice * (1 - discount / 100);
            return {
                'Sıra No': item.siraNo || idx + 1,
                'İş Kalemi': item.rawLine,
                'Eşleşen Poz No': item.matchedPoz?.code || '-',
                'Eşleşen Poz Tanımı': item.matchedPoz?.description || '-',
                'Miktar': item.quantity,
                'Birim': item.unit || item.matchedPoz?.unit || '-',
                'Birim Fiyat': unitPrice != null && !isNaN(unitPrice) ? safeToFixed(unitPrice) : '-',
                'Tutar (Ham)': safeToFixed(totalPrice),
                [`Tutar (Kırım %${discount})`]: safeToFixed(discountedPrice),
            };
        });

        const baseTotal = results.reduce((sum, r) => {
            const price = typeof r.totalPrice === 'number' && !isNaN(r.totalPrice) ? r.totalPrice : 0;
            return sum + price;
        }, 0);
        const totalRow: any = {
            'Sıra No': '',
            'İş Kalemi': 'TOPLAM',
            'Eşleşen Poz No': '',
            'Eşleşen Poz Tanımı': '',
            'Miktar': '',
            'Birim': '',
            'Birim Fiyat': '',
            'Tutar (Ham)': safeToFixed(baseTotal),
        };
        totalRow[`Tutar (Kırım %${discount})`] = safeToFixed(baseTotal * (1 - discount / 100));
        excelData.push(totalRow);

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, projectName || 'Proje');

        worksheet['!cols'] = [
            { wch: 8 }, { wch: 50 }, { wch: 15 }, { wch: 50 },
            { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
        ];

        const fileName = `${projectName}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    const handleDeleteProject = async () => {
        setDeleting(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                alert('Proje başarıyla silindi!');
                router.push('/projects');
            } else {
                const err = await res.json();
                alert('Hata: ' + (err.error || 'Bilinmeyen bir hata oluştu'));
            }
        } catch (error: any) {
            console.error('Delete error:', error);
            alert('Silme başarısız oldu: ' + (error.message || error));
        } finally {
            setDeleting(false);
            setShowDeleteModal(false);
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

    const filteredDataset = useMemo(() => {
        if (!searchQuery.trim()) return dataset;
        const query = searchQuery.toLowerCase();
        return dataset.filter(item =>
            item.code.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
        );
    }, [dataset, searchQuery]);

    const matchedCount = results.filter(r => r.matchedPoz).length;
    const unmatchedCount = results.filter(r => !r.matchedPoz).length;

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50">
                <Navigation />
                <div className="flex justify-center items-center h-96">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <Navigation />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <Link href="/projects" className="text-sm text-blue-600 hover:text-blue-700 mb-2 inline-flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                            Projelerime Dön
                        </Link>
                        {isEditing ? (
                            <div className="space-y-2 mt-2">
                                <input
                                    type="text"
                                    className="input-field text-2xl font-bold"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    placeholder="Proje Adı"
                                />
                                <textarea
                                    className="input-field w-full"
                                    value={projectDescription}
                                    onChange={(e) => setProjectDescription(e.target.value)}
                                    placeholder="Açıklama (opsiyonel)"
                                    rows={2}
                                />
                            </div>
                        ) : (
                            <>
                                <h1 className="text-3xl font-bold text-slate-900 mt-2">{projectName}</h1>
                                {projectDescription && <p className="text-slate-600 mt-1">{projectDescription}</p>}
                            </>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        fetchProject();
                                    }}
                                    className="btn btn-secondary"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleSaveProject}
                                    className="btn btn-primary"
                                    disabled={saving}
                                >
                                    {saving ? 'Kaydediliyor...' : 'Kay det'}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleExportExcel}
                                    className="btn btn-secondary"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                    Excel İndir
                                </button>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="btn btn-primary"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                    Düzenle
                                </button>
                                <button
                                    onClick={() => setShowDeleteModal(true)}
                                    className="btn bg-red-600 hover:bg-red-700 text-white"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    Sil
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Left Column: Results */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Summary Card */}
                        <div className="card p-6">
                            <div className="flex gap-4 text-sm font-medium mb-4">
                                <div className="px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-100 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    {matchedCount} Eşleşen
                                </div>
                                <div className="px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-100 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    {unmatchedCount} Eşleşmeyen
                                </div>
                            </div>
                        </div>

                        {/* Results Table */}
                        <div className="card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="text-left py-3 px-4 font-semibold text-slate-700" style={{ width: '50px' }}>Sıra</th>
                                            <th className="text-left py-3 px-4 font-semibold text-slate-700" style={{ minWidth: '200px', maxWidth: '300px' }}>İş Kalemi</th>
                                            <th className="text-left py-3 px-4 font-semibold text-slate-700" style={{ width: '90px' }}>Poz</th>
                                            <th className="text-left py-3 px-4 font-semibold text-slate-700" style={{ minWidth: '200px', maxWidth: '300px' }}>Tanım</th>
                                            <th className="text-right py-3 px-4 font-semibold text-slate-700" style={{ width: '70px' }}>Miktar</th>
                                            <th className="text-left py-3 px-4 font-semibold text-slate-700" style={{ width: '60px' }}>Birim</th>
                                            <th className="text-right py-3 px-4 font-semibold text-slate-700" style={{ width: '90px' }}>B.Fiyat</th>
                                            <th className="text-right py-3 px-4 font-semibold text-slate-700" style={{ width: '100px' }}>Tutar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {results.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="p-2 text-slate-500 font-mono text-xs">{item.siraNo}</td>
                                                <td className="p-2 text-slate-700 font-medium text-xs leading-relaxed">
                                                    <div className="line-clamp-2" title={item.rawLine}>{item.rawLine}</div>
                                                </td>
                                                <td className="p-2 font-mono text-xs text-blue-600 font-medium whitespace-nowrap">
                                                    {item.matchedPoz?.code || '-'}
                                                </td>
                                                <td
                                                    className="p-2 text-xs text-slate-600 cursor-pointer hover:text-blue-600 transition-colors group relative"
                                                    onClick={() => handlePozClick(idx)}
                                                >
                                                    {item.matchedPoz ? (
                                                        <div className="line-clamp-2" title={item.matchedPoz.description}>
                                                            {item.matchedPoz.description}
                                                        </div>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-red-500 font-medium px-2 py-1 rounded bg-red-50 hover:bg-red-100 transition-colors text-[10px]">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                                            Poz Seç
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2 text-right font-mono text-slate-700 text-xs">{safeToFixed(item.quantity)}</td>
                                                <td className="p-2 text-slate-500 text-xs">{item.unit || '-'}</td>
                                                <td className="p-2 text-right font-mono text-slate-600 text-xs">
                                                    {item.matchedPoz?.unitPrice != null && !isNaN(item.matchedPoz.unitPrice)
                                                        ? `₺${safeToFixed(item.matchedPoz.unitPrice * (1 - discount / 100))}`
                                                        : '-'}
                                                </td>
                                                <td className="p-2 text-right font-mono font-bold text-slate-800 text-xs">
                                                    {item.totalPrice != null && !isNaN(item.totalPrice)
                                                        ? `₺${safeToFixed(item.totalPrice * (1 - discount / 100))}`
                                                        : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                                        <tr>
                                            <td colSpan={7} className="p-4 text-right text-sm uppercase tracking-wider text-slate-500">Toplam Tutar:</td>
                                            <td className="p-4 text-right text-lg text-blue-600 font-mono">
                                                {formatCurrency(calculateTotalCost())}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Sidebar */}
                    <div className="space-y-6">
                        {/* Summary Card */}
                        <div className="card p-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white border-0 shadow-xl">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <svg className="w-5 h-5 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                                Proje Özeti
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center py-3 px-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                                    <span className="text-blue-50 text-sm font-medium">Toplam Kalem</span>
                                    <span className="font-mono font-bold text-white text-xl">{results.length}</span>
                                </div>
                                <div className="flex justify-between items-center py-3 px-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                                    <span className="text-blue-50 text-sm font-medium">Başarılı Eşleşme</span>
                                    <span className="font-mono font-bold text-green-300 text-xl">{matchedCount}</span>
                                </div>
                                <div className="pt-2 px-4 py-4 bg-white/15 rounded-xl backdrop-blur-sm border border-white/30">
                                    <div className="text-sm text-blue-100 mb-2 font-medium">Tahmini Maliyet</div>
                                    <div className="text-3xl font-bold tracking-tight text-white font-mono">
                                        {formatCurrency(calculateTotalCost())}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Discount Card */}
                        <div className="card p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                Tenkisat / Kırım
                            </h3>
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={localDiscount}
                                    onChange={(e) => setLocalDiscount(e.target.value)}
                                    className="w-full text-center text-lg font-bold text-slate-900 outline-none bg-transparent"
                                    placeholder="0"
                                />
                                <span className="text-slate-400 font-bold px-2">%</span>
                                <button
                                    onClick={() => setDiscount(Number(localDiscount))}
                                    className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                                >
                                    Uygula
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                                Toplam tutar üzerinden uygulanacak indirim oranını giriniz.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Poz Selection Modal */}
            {showPozModal && selectedIndex !== null && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPozModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Poz Eşleştirme</h3>
                                <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                                    <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                        {results[selectedIndex].siraNo || '#'}
                                    </span>
                                    <span className="truncate max-w-md" title={results[selectedIndex].rawLine}>
                                        {results[selectedIndex].rawLine}
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setShowPozModal(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div className="p-6 border-b border-slate-100">
                            <input
                                type="text"
                                placeholder="Poz kodu veya tanımı ile ara..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input-field w-full"
                                autoFocus
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-2">
                                {filteredDataset.slice(0, 100).map((poz, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelectPoz(poz)}
                                        className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all group"
                                    >
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <div className="font-mono text-sm font-bold text-blue-600 mb-1">{poz.code}</div>
                                                <div className="text-sm text-slate-700 line-clamp-2">{poz.description}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-slate-500">{poz.unit}</div>
                                                <div className="text-sm font-bold text-slate-900 font-mono">₺{poz.unitPrice.toFixed(2)}</div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {filteredDataset.length === 0 && (
                                <div className="text-center py-12 text-slate-400">
                                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    <p>Sonuç bulunamadı</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Projeyi Sil</h3>
                                <p className="text-sm text-slate-500">Bu işlem geri alınamaz</p>
                            </div>
                        </div>
                        <p className="text-slate-600 mb-6">
                            <strong>{projectName}</strong> projesini silmek istediğinizden emin misiniz? Bu proje ve tüm verileri kalıcı olarak silinecektir.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="btn btn-secondary"
                                disabled={deleting}
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleDeleteProject}
                                className="btn bg-red-600 hover:bg-red-700 text-white"
                                disabled={deleting}
                            >
                                {deleting ? 'Siliniyor...' : 'Evet, Sil'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
