'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../context/AuthContext';

interface PozItem {
    id?: string;
    code: string;
    description: string;
    unit: string;
    unitPrice: number;
}

// Admin email whitelist - only these users can access dataset management
const ADMIN_EMAILS = [
    'admin@maliyet724.com', 'info@maliyet724.com', 'sigorta.mucahitdunder@gmail.com',
    'admin@ihalerobotum.com', 'info@ihalerobotum.com'
];

export default function DatasetPage() {
    const { isLoggedIn, user } = useAuth();
    const [dataset, setDataset] = useState<PozItem[]>([]);
    const [jsonInput, setJsonInput] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [editingItem, setEditingItem] = useState<PozItem & { id: string } | null>(null);
    const [editForm, setEditForm] = useState({ code: '', description: '', unit: '', unitPrice: 0 });

    // Check if user is admin
    const isAdmin = isLoggedIn && user && ADMIN_EMAILS.includes(user.email.toLowerCase());

    useEffect(() => {
        if (isAdmin) {
            loadDataset();
        }
    }, [isAdmin]);

    const loadDataset = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/dataset', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setDataset(data.items || []);
        } catch (e) {
            console.error('Dataset yüklenemedi', e);
        }
    };

    // If not admin, show access denied
    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
                <Navigation />
                <div className="max-w-lg mx-auto p-6 mt-20 text-center">
                    <div className="card p-8">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800 mb-2">Erişim Engellendi</h1>
                        <p className="text-gray-600 mb-6">
                            Bu sayfaya yalnızca yöneticiler erişebilir.
                        </p>
                        <Link href="/" className="btn-primary inline-block px-6 py-3">
                            Ana Sayfaya Dön
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const handleFileUpload = async (file: File) => {
        setUploadProgress(0);
        setIsUploading(true);
        setUploadStatus('Dosya yükleniyor...');

        const formData = new FormData();
        formData.append('file', file);

        try {
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded / e.total) * 50);
                        setUploadProgress(percentComplete);
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        setUploadProgress(75);
                        setUploadStatus('İşleniyor...');

                        try {
                            const data = JSON.parse(xhr.responseText);

                            if (data.success) {
                                setUploadProgress(100);
                                setUploadStatus('Tamamlandı!');
                                loadDataset();

                                const msg = data.message ||
                                    (data.duplicatesSkipped && data.duplicatesSkipped > 0
                                        ? `Başarıyla ${data.addedCount} yeni kayıt eklendi! (${data.duplicatesSkipped} duplicate atlandı) Toplam: ${data.totalCount}`
                                        : `Başarıyla ${data.addedCount} kayıt eklendi! Toplam: ${data.totalCount}`);

                                setTimeout(() => {
                                    alert(msg);
                                    setIsUploading(false);
                                    setUploadProgress(0);
                                    setUploadStatus('');
                                }, 500);

                                resolve(data);
                            } else {
                                throw new Error(data.error || 'Bilinmeyen hata');
                            }
                        } catch (err: any) {
                            reject(err);
                        }
                    } else {
                        reject(new Error(`Server error: ${xhr.status}`));
                    }
                });

                xhr.addEventListener('error', () => {
                    reject(new Error('Network error'));
                });

                xhr.open('POST', '/api/dataset/upload');
                const token = localStorage.getItem('token');
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.send(formData);
            });
        } catch (err: any) {
            alert('Yükleme hatası: ' + err.message);
            setIsUploading(false);
            setUploadProgress(0);
            setUploadStatus('');
        }
    };

    const handleImportJson = async () => {
        try {
            const data = JSON.parse(jsonInput);
            if (Array.isArray(data)) {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/dataset/upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ items: data }),
                });

                if (res.ok) {
                    await loadDataset();
                    setJsonInput('');
                    alert(`${data.length} kayıt yüklendi!`);
                } else {
                    alert('Yükleme hatası!');
                }
            } else {
                alert('JSON bir array olmalı');
            }
        } catch (e) {
            alert('Geçersiz JSON formatı');
        }
    };

    const handleExportJson = () => {
        const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'poz-dataset.json';
        a.click();
    };

    const handleClear = async () => {
        if (confirm('Tüm dataset silinecek. Emin misiniz?')) {
            const token = localStorage.getItem('token');
            await fetch('/api/dataset', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await loadDataset();
        }
    };

    const handleLoadSample = async () => {
        const sample: PozItem[] = [
            { code: "15.010.1001", description: "Kazı işleri (Zemin)", unit: "m3", unitPrice: 25.50 },
            { code: "15.020.1002", description: "Dolgu işleri", unit: "m3", unitPrice: 18.75 },
            { code: "16.010.1001", description: "Beton dökümü C25", unit: "m3", unitPrice: 450.00 },
            { code: "16.020.1002", description: "Demir donatı", unit: "ton", unitPrice: 8500.00 },
            { code: "17.010.1001", description: "Tuğla duvar", unit: "m2", unitPrice: 85.00 }
        ];

        const token = localStorage.getItem('token');
        const res = await fetch('/api/dataset/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ items: sample }),
        });

        if (res.ok) {
            await loadDataset();
            alert('Örnek dataset yüklendi!');
        }
    };

    const handleEditClick = (item: PozItem & { id: string }) => {
        setEditingItem(item);
        setEditForm({
            code: item.code,
            description: item.description,
            unit: item.unit,
            unitPrice: item.unitPrice
        });
    };

    const handleSaveEdit = async () => {
        if (!editingItem?.id) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/dataset/item/${editingItem.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editForm),
            });

            if (res.ok) {
                await loadDataset();
                setEditingItem(null);
                alert('Kayıt başarıyla güncellendi!');
            } else {
                const data = await res.json();
                alert('Güncelleme hatası: ' + (data.error || 'Bilinmeyen hata'));
            }
        } catch (e: any) {
            alert('Güncelleme hatası: ' + e.message);
        }
    };

    const handleCancelEdit = () => {
        setEditingItem(null);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
            <Navigation />

            {/* Animated Background Orbs */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-20 -left-20 w-96 h-96 bg-gradient-to-br from-indigo-300/30 to-blue-300/30 rounded-full blur-3xl animate-float"></div>
                <div className="absolute -bottom-20 right-20 w-80 h-80 bg-gradient-to-br from-blue-300/30 to-indigo-300/30 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
                <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-gradient-to-br from-indigo-300/20 to-blue-300/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }}></div>
            </div>

            <div className="max-w-[1600px] mx-auto p-6 relative z-10">
                {/* Compact Header */}
                <div className="flex flex-col lg:flex-row justify-between items-end gap-4 mb-8">
                    <div className="flex-1">
                        <Link href="/" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-3 transition-colors font-semibold text-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                            Ana Sayfa
                        </Link>
                        <h1 className="text-4xl font-black gradient-text mb-2 tracking-tight">Dataset Yönetimi</h1>
                        <p className="text-slate-500 font-medium">POZ verilerini yükleyin ve merkezi veritabanını yönetin</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <div className="bg-white/80 backdrop-blur-md border border-slate-200 px-6 py-2.5 rounded-2xl shadow-sm flex items-center gap-4">
                            <div className="flex flex-col">
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Toplam Kayıt</span>
                                <span className="text-2xl font-black text-slate-900 leading-none">{dataset.length.toLocaleString()}</span>
                            </div>
                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
                            </div>
                        </div>
                        <button onClick={handleExportJson} disabled={dataset.length === 0} className="btn-primary px-6 py-3 text-sm disabled:opacity-50 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            Export
                        </button>
                        <button onClick={handleClear} className="bg-white border border-red-100 text-red-600 hover:bg-red-50 px-6 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            Temizle
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Compact Upload Sidebar */}
                    <div className="col-span-1 lg:col-span-3 space-y-6">
                        <div className="card p-6 shadow-premium">
                            <h2 className="text-xl font-black mb-4 text-slate-800 flex items-center gap-2">
                                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                </div>
                                Dosya Yükle
                            </h2>

                            {/* Progress Modal */}
                            {isUploading && (
                                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
                                    <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl">
                                        <div className="text-center mb-6">
                                            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <svg className="w-8 h-8 text-indigo-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-900 mb-2">Dosya Yükleniyor</h3>
                                            <p className="text-gray-500 text-sm">{uploadStatus}</p>
                                        </div>

                                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300"
                                                style={{ width: `${uploadProgress}%` }}
                                            ></div>
                                        </div>

                                        <div className="flex justify-between mt-2 text-xs text-gray-500">
                                            <span>% {uploadProgress}</span>
                                            <span>Lütfen bekleyin...</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-8 text-center transition-all relative group cursor-pointer bg-slate-50/50 hover:bg-indigo-50/30 mb-6">
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.pdf,.png,.jpg,.jpeg"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            handleFileUpload(file);
                                            e.target.value = '';
                                        }
                                    }}
                                    disabled={isUploading}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 disabled:cursor-not-allowed"
                                />
                                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                                    <svg className="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                </div>
                                <p className="text-sm font-bold text-slate-700 mb-1">
                                    {isUploading ? 'Yükleniyor...' : 'Excel veya PDF'}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Sürükle veya Tıkla</p>
                            </div>

                            <div className="pt-4 border-t border-gray-200">
                                <h3 className="text-sm font-bold mb-2 text-gray-700">JSON İmport</h3>
                                <textarea
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    placeholder='[{"code":"15.010.1001",...}]'
                                    className="w-full h-32 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-700 focus:border-indigo-500 focus:outline-none transition-colors"
                                />
                                <button
                                    onClick={handleImportJson}
                                    disabled={!jsonInput.trim()}
                                    className="btn-primary w-full mt-2 py-2 text-sm disabled:opacity-50"
                                >
                                    JSON Yükle
                                </button>
                                <button
                                    onClick={handleLoadSample}
                                    className="w-full mt-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 py-2 rounded-xl text-xs font-medium transition-all"
                                >
                                    Örnek Data Yükle
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Optimized Table - Full Width */}
                    <div className="col-span-1 lg:col-span-9">
                        <div className="card p-0 overflow-hidden shadow-premium min-h-[600px] flex flex-col">
                            <div className="overflow-auto flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="bg-slate-900 text-white">
                                            <th className="p-4 font-bold text-[10px] uppercase tracking-widest border-b border-slate-800" style={{ width: '140px' }}>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center">
                                                        <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path></svg>
                                                    </div>
                                                    Poz No
                                                </div>
                                            </th>
                                            <th className="p-4 font-bold text-[10px] uppercase tracking-widest border-b border-slate-800">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center">
                                                        <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
                                                    </div>
                                                    Tanım / Açıklama
                                                </div>
                                            </th>
                                            <th className="p-4 font-bold text-[10px] uppercase tracking-widest border-b border-slate-800 text-center" style={{ width: '100px' }}>
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center">
                                                        <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>
                                                    </div>
                                                    Birim
                                                </div>
                                            </th>
                                            <th className="p-4 font-bold text-[10px] uppercase tracking-widest border-b border-slate-800 text-right" style={{ width: '150px' }}>
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center">
                                                        <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                    </div>
                                                    Birim Fiyat
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {dataset.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-indigo-50/50 transition-colors group cursor-pointer" onClick={() => item.id && handleEditClick(item as PozItem & { id: string })}>
                                                <td className="p-2 font-mono text-indigo-600 font-bold text-xs" style={{ width: '110px', minWidth: '110px', maxWidth: '110px' }}>
                                                    <div className="flex items-center gap-1 truncate">
                                                        {item.code}
                                                        <svg className="w-3 h-3 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                                    </div>
                                                </td>
                                                <td className={`p-3 text-xs ${!item.description || item.description.length < 5 ? 'text-orange-600 font-semibold' : 'text-gray-700'}`} style={{ minWidth: '300px' }} title={item.description}>
                                                    <div className="line-clamp-2">
                                                        {item.description || '⚠️ Açıklama eksik'}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-gray-600 text-xs text-center" style={{ width: '80px', minWidth: '80px' }}>
                                                    {item.unit || <span className="text-orange-500 italic text-xs">eksik</span>}
                                                </td>
                                                <td className="p-3 text-right font-bold text-gray-900 text-xs" style={{ width: '120px', minWidth: '120px' }}>
                                                    ₺{item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                        {dataset.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-20 text-center">
                                                    <div className="max-w-xs mx-auto">
                                                        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                                                            <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                                                        </div>
                                                        <h4 className="text-lg font-bold text-slate-800 mb-2">Henüz Veri Yok</h4>
                                                        <p className="text-sm text-slate-500 font-medium">Dataset şu an boş görünüyor. Sol panelden yeni veriler yükleyerek başlayabilirsiniz.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Edit Modal */}
                {editingItem && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
                        <div className="bg-white p-8 rounded-2xl w-full max-w-2xl shadow-2xl relative">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>

                            <h2 className="text-2xl font-bold mb-2 gradient-text">Kayıt Düzenle</h2>
                            <p className="text-gray-500 text-sm mb-6">Eksik veya hatalı bilgileri düzeltin</p>

                            {/* Warning for incomplete data */}
                            {(!editForm.description || editForm.description.length < 5 || !editForm.unit) && (
                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 flex items-start gap-3">
                                    <svg className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                    <div>
                                        <p className="text-orange-800 text-sm font-semibold">Eksik bilgi tespit edildi</p>
                                        <p className="text-orange-600 text-xs mt-1">Lütfen tüm alanları eksiksiz doldurun</p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Poz Kodu</label>
                                    <input
                                        type="text"
                                        value={editForm.code}
                                        onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
                                        placeholder="örn: 15.010.1001"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <div className="flex items-center justify-between">
                                            <span>Tanım / Açıklama</span>
                                            <span className="text-xs text-gray-500">{editForm.description.length} karakter</span>
                                        </div>
                                    </label>
                                    <textarea
                                        value={editForm.description}
                                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                        rows={6}
                                        autoFocus
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-indigo-500"
                                        placeholder="Detaylı poz tanımını buraya yazın..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Birim</label>
                                        <input
                                            type="text"
                                            value={editForm.unit}
                                            onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-purple-500"
                                            placeholder="m2, m3, kg..."
                                            list="unit-suggestions"
                                        />
                                        <datalist id="unit-suggestions">
                                            <option value="m2">m² - Metrekare</option>
                                            <option value="m3">m³ - Metreküp</option>
                                            <option value="m">m - Metre</option>
                                            <option value="kg">kg - Kilogram</option>
                                            <option value="ton">ton - Ton</option>
                                            <option value="adet">adet - Adet</option>
                                        </datalist>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Birim Fiyat (₺)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editForm.unitPrice}
                                            onChange={(e) => setEditForm({ ...editForm, unitPrice: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-purple-500"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 mt-8">
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={!editForm.code || !editForm.description || editForm.description.length < 5}
                                    className="btn-primary flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        Kaydet
                                    </div>
                                </button>
                                <button
                                    onClick={handleCancelEdit}
                                    className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-3 rounded-xl font-semibold transition-all"
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        İptal
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
