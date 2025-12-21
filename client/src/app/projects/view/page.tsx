'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '../../../components/Navigation';
import { useAuth } from '../../../context/AuthContext';
import * as XLSX from 'xlsx';
import {
    ChevronLeft,
    Edit2,
    Download,
    Save,
    Trash2,
    Calculator,
    Plus,
    Search,
    CheckCircle,
    X,
    AlertCircle,
    BarChart3,
    ArrowRight,
    ArrowUpRight
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

function ProjectDetailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { isLoggedIn } = useAuth();
    const projectId = searchParams.get('id');

    const [projectName, setProjectName] = useState('');
    const [projectDescription, setProjectDescription] = useState('');
    const [ikn, setIkn] = useState('');
    const [createdAt, setCreatedAt] = useState('');
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
    const [editingPriceRow, setEditingPriceRow] = useState<number | null>(null);
    const [tempPrice, setTempPrice] = useState('');

    useEffect(() => {
        if (!isLoggedIn) {
            router.push('/');
            return;
        }
        if (!projectId) {
            router.push('/projects');
            return;
        }
        fetchProject();
        fetchDataset();
    }, [isLoggedIn, projectId]);

    const fetchProject = async () => {
        if (!projectId) return;
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
                setIkn(project.tender_registration_number || '');
                setCreatedAt(project.created_at);

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
            const token = localStorage.getItem('token');
            const res = await fetch('/api/dataset', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
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
            const scrollPos = window.scrollY;
            const updatedResults = [...results];
            updatedResults[selectedIndex].matchedPoz = poz;
            updatedResults[selectedIndex].totalPrice = poz.unitPrice * updatedResults[selectedIndex].quantity;
            updatedResults[selectedIndex].matchScore = 100;
            setResults(updatedResults);
            setShowPozModal(false);
            setSelectedIndex(null);
            // Restore scroll position after render
            setTimeout(() => window.scrollTo(0, scrollPos), 0);
        }
    };

    const handlePriceClick = (idx: number, currentPrice: number = 0) => {
        setEditingPriceRow(idx);
        setTempPrice(currentPrice.toString());
    };

    const handlePriceSave = (idx: number) => {
        const scrollPos = window.scrollY;
        const newPrice = parseFloat(tempPrice);
        if (!isNaN(newPrice) && newPrice >= 0) {
            const updatedResults = [...results];
            if (!updatedResults[idx].matchedPoz) {
                updatedResults[idx].matchedPoz = {
                    code: 'MANUEL',
                    description: 'Manuel Fiyat Girişi',
                    unit: updatedResults[idx].unit || 'adet',
                    unitPrice: newPrice
                };
            } else {
                updatedResults[idx].matchedPoz = {
                    ...updatedResults[idx].matchedPoz!,
                    unitPrice: newPrice
                };
            }
            updatedResults[idx].totalPrice = newPrice * updatedResults[idx].quantity;
            setResults(updatedResults);
        }
        setEditingPriceRow(null);
        // Restore scroll position after render
        setTimeout(() => window.scrollTo(0, scrollPos), 0);
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

    const handleExportExcel = async () => {
        if (results.length === 0) {
            alert('Henüz veri yok!');
            return;
        }

        try {
            const ExcelJS = (await import('exceljs')).default;
            const FileSaver = await import('file-saver');
            const saveAs = FileSaver.saveAs || FileSaver.default;

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Proje Detayı');

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

                // Apply Borders
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    cell.alignment = { vertical: 'middle', wrapText: true };
                });

                // Format Currency
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
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
            });
            totalRow.getCell('H').numFmt = '#,##0.00 "₺"';
            totalRow.getCell('I').numFmt = '#,##0.00 "₺"';

            const fileName = `${projectName || 'Proje'}_${new Date().toISOString().split('T')[0]}.xlsx`;
            await workbook.xlsx.writeBuffer().then(buffer => {
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                saveAs(blob, fileName);
            });

        } catch (err) {
            console.error('Export error:', err);
            alert('Excel oluşturulurken hata oluştu: ' + err);
        }
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
                    <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#fcfdfe] overflow-hidden selection:bg-indigo-100 selection:text-indigo-900 font-sans">
            <Navigation />

            {/* AURA BACKGROUND ENGINE */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[80vw] h-[80vw] bg-indigo-100/20 blur-[120px] rounded-full animate-aura"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-blue-50/30 blur-[100px] rounded-full animate-aura" style={{ animationDirection: 'reverse', animationDuration: '25s' }}></div>
            </div>

            <main className="relative z-10">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 max-w-[95%]">
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                        <div className="flex-1 w-full">
                            <Link href="/projects" className="text-sm font-bold text-slate-400 hover:text-indigo-600 mb-4 inline-flex items-center transition-all group">
                                <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" />
                                Projelerime Dön
                            </Link>

                            {isEditing ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-4 max-w-2xl"
                                >
                                    <input
                                        type="text"
                                        className="text-4xl font-black text-slate-900 bg-white border-2 border-indigo-500 rounded-[1.5rem] px-6 py-3 w-full focus:outline-none focus:ring-4 focus:ring-indigo-500/5 shadow-xl shadow-indigo-100/20"
                                        value={projectName}
                                        onChange={(e) => setProjectName(e.target.value)}
                                        placeholder="Proje Adı"
                                        autoFocus
                                    />
                                    <textarea
                                        className="w-full bg-white border border-slate-200 rounded-[1.5rem] px-6 py-4 focus:border-indigo-500 focus:outline-none resize-none font-medium text-slate-600 shadow-sm"
                                        value={projectDescription}
                                        onChange={(e) => setProjectDescription(e.target.value)}
                                        placeholder="Proje açıklaması (opsiyonel)"
                                        rows={2}
                                    />
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.8 }}
                                    className="flex-1"
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-100/50">
                                            Proje Detayı
                                        </div>
                                        {createdAt && (
                                            <div className="px-3 py-1.5 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-slate-100/50">
                                                {new Date(createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        )}
                                        {ikn && (
                                            <div className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-100/50 flex items-center gap-2">
                                                <span className="opacity-50">İKN:</span> {ikn}
                                            </div>
                                        )}
                                    </div>
                                    <h1 className="text-4xl lg:text-5xl font-black text-slate-900 mb-4 tracking-tight leading-tight">
                                        {projectName}
                                    </h1>
                                    <p className="text-slate-500 font-medium max-w-2xl leading-relaxed text-lg italic">
                                        {projectDescription || 'Bu proje için herhangi bir açıklama bulunmuyor.'}
                                    </p>
                                </motion.div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {isEditing ? (
                                <>
                                    <button
                                        onClick={() => {
                                            setIsEditing(false);
                                            fetchProject();
                                        }}
                                        className="px-6 py-3.5 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all text-sm"
                                    >
                                        Vazgeç
                                    </button>
                                    <button
                                        onClick={handleSaveProject}
                                        disabled={saving}
                                        className="btn-primary"
                                    >
                                        {saving ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Kaydediliyor...
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Save className="w-4 h-4" />
                                                Kaydet
                                            </div>
                                        )}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={handleExportExcel}
                                        className="px-6 py-3.5 rounded-2xl font-bold text-slate-700 bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center gap-2 shadow-sm text-sm"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span className="hidden sm:inline">Excel İndir</span>
                                    </button>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="px-6 py-3.5 rounded-2xl font-bold text-slate-700 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-sm text-sm"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        <span className="hidden sm:inline">Düzenle</span>
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteModal(true)}
                                        className="px-6 py-3.5 rounded-2xl font-bold text-rose-600 bg-white border border-slate-200 hover:border-rose-200 hover:bg-rose-50 transition-all flex items-center gap-2 shadow-sm text-sm"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span className="hidden sm:inline">Projeyi Sil</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Dashboard Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
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
                                <div className="text-indigo-400 font-black text-xs mb-4 uppercase tracking-[0.3em]">PROJE TOPLAM MALİYET</div>
                                <div className="text-5xl font-black font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-white">
                                    {formatCurrency(calculateTotalCost())}
                                </div>
                                <div className="mt-10 flex items-center gap-3 text-xs">
                                    <span className="bg-indigo-500/20 px-4 py-2 rounded-xl text-indigo-300 font-black border border-indigo-500/20 uppercase tracking-widest">
                                        {results.length} KALEM ANALİZ EDİLDİ
                                    </span>
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
                                DOĞRULUK ORANI
                                <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 font-black tracking-tighter text-base">
                                    %{Math.round((matchedCount / results.length) * 100) || 0}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 mb-8">
                                <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
                                    <div
                                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-1000 relative"
                                        style={{ width: `${(matchedCount / results.length) * 100}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black tracking-widest uppercase">
                                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50/50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                    <CheckCircle className="w-3 h-3" />
                                    {matchedCount} EŞLEŞEN
                                </div>
                                <div className="flex items-center gap-2 text-rose-500 bg-rose-50/50 px-3 py-1.5 rounded-lg border border-rose-100">
                                    <AlertCircle className="w-3 h-3" />
                                    {unmatchedCount} EŞLEŞMEYEN
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
                                <div className="text-slate-500 font-black text-xs uppercase tracking-[0.2em]">KIRIM / TENKİSAT</div>
                                {Number(localDiscount) > 0 && (
                                    <div className="text-blue-600 bg-blue-50 px-3 py-1 rounded-lg text-[10px] font-black tracking-[0.2em] border border-blue-100">AKTİF</div>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1 group">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={localDiscount}
                                        onChange={(e) => setLocalDiscount(e.target.value)}
                                        className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] px-6 py-4 font-black text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-2xl shadow-inner text-center pr-12"
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

                    {/* Main Table */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-indigo-900/5 overflow-hidden"
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-100">
                                    <tr>
                                        <th className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px] w-16">Sıra</th>
                                        <th className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px] min-w-[300px]">İş Kalemi</th>
                                        <th className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px] w-32">Poz No</th>
                                        <th className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px] min-w-[300px]">Eşleşen Tanım</th>
                                        <th className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px] text-right w-24">Miktar</th>
                                        <th className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px] w-20">Birim</th>
                                        <th className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px] text-right w-32">B.Fiyat</th>
                                        <th className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px] text-right w-40">Tutar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {results.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                                            <td className="py-5 px-6 text-slate-400 font-mono text-xs">{item.siraNo}</td>
                                            <td className="py-5 px-6 text-slate-700 font-medium leading-relaxed">
                                                <div className="line-clamp-2" title={item.rawLine}>{item.rawLine}</div>
                                            </td>
                                            <td className="py-5 px-6 font-mono text-xs text-indigo-600 font-black whitespace-nowrap">
                                                {item.matchedPoz?.code || '-'}
                                            </td>
                                            <td
                                                className="py-5 px-6 text-slate-600 cursor-pointer hover:text-indigo-600 transition-colors relative"
                                                onClick={() => handlePozClick(idx)}
                                            >
                                                {item.matchedPoz ? (
                                                    <div className="flex items-center gap-3">
                                                        <span className="line-clamp-2 font-medium" title={item.matchedPoz.description}>
                                                            {item.matchedPoz.description}
                                                        </span>
                                                        <Edit2 className="w-4 h-4 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-2 text-rose-600 font-black px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 transition-all text-xs border border-rose-100 w-full justify-center shadow-sm">
                                                        <Search className="w-4 h-4" />
                                                        Poz Eşleştir
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-5 px-6 text-right font-mono text-slate-600 font-medium">{safeToFixed(item.quantity)}</td>
                                            <td className="py-5 px-6 text-slate-500 text-[10px] font-black uppercase tracking-widest">{item.unit || '-'}</td>
                                            <td
                                                className="py-5 px-6 text-right font-mono text-slate-700 cursor-pointer hover:bg-indigo-50/50 transition-colors relative"
                                                onClick={() => handlePriceClick(idx, item.matchedPoz?.unitPrice || 0)}
                                            >
                                                {editingPriceRow === idx ? (
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            className="w-28 text-right border-2 border-indigo-500 rounded-xl px-3 py-1.5 outline-none text-sm font-black bg-white shadow-2xl"
                                                            value={tempPrice}
                                                            onChange={(e) => setTempPrice(e.target.value)}
                                                            onBlur={() => handlePriceSave(idx)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handlePriceSave(idx);
                                                                }
                                                                if (e.key === 'Escape') setEditingPriceRow(null);
                                                            }}
                                                            autoFocus
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className={`${!item.matchedPoz?.unitPrice ? 'text-slate-300' : 'text-slate-700 font-bold'} tracking-tighter`}>
                                                        {item.matchedPoz?.unitPrice != null && !isNaN(item.matchedPoz.unitPrice)
                                                            ? formatCurrency(item.matchedPoz.unitPrice * (1 - discount / 100))
                                                            : '-'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-5 px-6 text-right font-mono font-black text-slate-900 text-base tracking-tighter">
                                                {item.totalPrice != null && !isNaN(item.totalPrice)
                                                    ? formatCurrency(item.totalPrice * (1 - discount / 100))
                                                    : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t border-slate-100">
                                    <tr>
                                        <td colSpan={7} className="py-8 px-8 text-right text-xs font-black uppercase tracking-[0.3em] text-slate-400">Tahmini Toplam Yatırım Tutarı</td>
                                        <td className="py-8 px-8 text-right text-3xl text-indigo-700 font-black font-mono bg-indigo-50/30 tracking-tighter">
                                            {formatCurrency(calculateTotalCost())}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </motion.div>
                </div>

                {/* Poz Selection Modal */}
                <AnimatePresence>
                    {showPozModal && selectedIndex !== null && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
                            onClick={() => setShowPozModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 20 }}
                                className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 relative"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                                    <div>
                                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">Katalogdan Poz Seçimi</h3>
                                        <div className="text-sm text-slate-500 mt-3 flex items-center gap-4">
                                            <span className="font-black text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-xl border border-indigo-100 text-xs">
                                                KALEM #{results[selectedIndex].siraNo || (selectedIndex + 1)}
                                            </span>
                                            <span className="truncate max-w-xl font-medium text-slate-600 italic" title={results[selectedIndex].rawLine}>
                                                "{results[selectedIndex].rawLine}"
                                            </span>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowPozModal(false)} className="text-slate-400 hover:text-rose-500 p-3 rounded-2xl hover:bg-rose-50 transition-all shadow-sm bg-white border border-slate-100">
                                        <X className="w-7 h-7" />
                                    </button>
                                </div>

                                <div className="p-10 border-b border-slate-100 bg-white">
                                    <div className="relative group">
                                        <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6 group-focus-within:text-cyan-600 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Poz kodu, açıklaması veya birim ile akıllı arama..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-slate-50/50 border border-slate-100 rounded-[2rem] px-16 py-5 text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all font-bold shadow-inner text-lg"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-10 bg-[#fcfdfe]">
                                    <div className="grid gap-4">
                                        {filteredDataset.slice(0, 100).map((poz, idx) => (
                                            <motion.button
                                                key={idx}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.02 }}
                                                onClick={() => handleSelectPoz(poz)}
                                                className="w-full text-left p-8 rounded-[2rem] bg-white border border-slate-100 hover:border-cyan-500 hover:shadow-2xl hover:shadow-cyan-900/10 transition-all group relative overflow-hidden"
                                            >
                                                <div className="flex justify-between items-start gap-6 relative z-10">
                                                    <div className="flex-1">
                                                        <div className="font-mono text-xs font-black text-cyan-600 mb-3 bg-cyan-50 w-fit px-3 py-1 rounded-lg border border-cyan-100 group-hover:bg-cyan-600 group-hover:text-white transition-all tracking-wider uppercase">{poz.code}</div>
                                                        <div className="text-base text-slate-600 group-hover:text-slate-900 font-medium leading-relaxed">{poz.description}</div>
                                                    </div>
                                                    <div className="text-right flex flex-col items-end">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">{poz.unit}</div>
                                                        <div className="text-2xl font-black text-slate-900 font-mono tracking-tighter group-hover:text-cyan-600 transition-colors">
                                                            {formatCurrency(poz.unitPrice)}
                                                        </div>
                                                        <div className="mt-2 text-cyan-500 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                                            <ArrowUpRight className="w-6 h-6" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-cyan-600 opacity-0 group-hover:opacity-100 transition-all"></div>
                                            </motion.button>
                                        ))}
                                    </div>
                                    {filteredDataset.length === 0 && (
                                        <div className="text-center py-24 text-slate-400">
                                            <Search className="w-20 h-20 mx-auto mb-6 opacity-10" />
                                            <p className="font-black text-2xl text-slate-300">Sonuç Bulunamadı</p>
                                            <p className="text-slate-400 mt-2 font-medium">Birim fiyat listesinde bu kriterlere uygun poz mevcut değil.</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Delete Confirmation Modal */}
                <AnimatePresence>
                    {showDeleteModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
                            onClick={() => setShowDeleteModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 20 }}
                                className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-10 border border-slate-100 relative overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center gap-5 mb-8">
                                    <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 shadow-inner">
                                        <AlertCircle className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Projeyi Sil</h3>
                                        <p className="text-sm text-slate-400 font-medium tracking-[0.2em] uppercase">Geri alınamaz işlem</p>
                                    </div>
                                </div>
                                <p className="text-slate-600 mb-10 font-medium leading-relaxed text-lg">
                                    <span className="text-slate-900 font-black">{projectName}</span> projesini silmek istediğinizden emin misiniz? Tüm analiz verileri kalıcı olarak kaldırılacaktır.
                                </p>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setShowDeleteModal(false)}
                                        className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all"
                                        disabled={deleting}
                                    >
                                        Vazgeç
                                    </button>
                                    <button
                                        onClick={handleDeleteProject}
                                        className="flex-[1.5] py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-rose-100 hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                                        disabled={deleting}
                                    >
                                        {deleting ? 'Siliniyor...' : 'Evet, Sil'}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main >
        </div >
    );
}

export default function ProjectDetailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50">
                <Navigation />
                <div className="flex justify-center items-center h-96">
                    <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
            </div>
        }>
            <ProjectDetailContent />
        </Suspense>
    );
}
