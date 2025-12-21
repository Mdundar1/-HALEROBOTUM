'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import Navigation from '../../../components/Navigation';
import {
    Plus,
    Edit2,
    Trash2,
    Check,
    X,
    Package,
    Tag,
    Calendar,
    DollarSign,
    Percent,
    Sparkles,
    Save,
    AlertCircle,
    ChevronRight,
    LayoutGrid
} from 'lucide-react';

const ADMIN_EMAILS = [
    'admin@maliyet724.com', 'info@maliyet724.com', 'sigorta.mucahitdunder@gmail.com',
    'admin@ihalerobotum.com', 'info@ihalerobotum.com'
];

interface Plan {
    id: string;
    name: string;
    price: number;
    duration_months: number;
    features: any; // Can be string on fetch, need parsing
    is_active: number | boolean;
    discount_percent?: number;
    tag?: string;
}

interface PlanGroup {
    name: string;
    tag?: string;
    features: string[];
    variants: Plan[];
}

export default function AdminPlansPage() {
    const { user, isLoggedIn, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [planGroups, setPlanGroups] = useState<PlanGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (!authLoading && (!isLoggedIn || !user || !ADMIN_EMAILS.includes(user.email.toLowerCase()))) {
            router.push('/');
        }
    }, [isLoggedIn, user, authLoading, router]);

    // Form States
    // groupForm holds common data: name, tag, features
    const [groupForm, setGroupForm] = useState<{ name: string; tag: string; features: string[] }>({ name: '', tag: '', features: [] });
    // variantsForm holds the list of specific pricing options
    const [variantsForm, setVariantsForm] = useState<Partial<Plan>[]>([]);

    // Feature input state
    const [featureInput, setFeatureInput] = useState('');

    // Original Name for tracking renaming vs new creation
    const [originalGroupName, setOriginalGroupName] = useState<string | null>(null);

    // Global Active State for logic
    const [isGlobalActive, setIsGlobalActive] = useState(true);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; groupName: string } | null>(null);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/plans', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();

                // 1. Process Data
                const parsedData = data.map((p: any) => ({
                    ...p,
                    features: typeof p.features === 'string' ? JSON.parse(p.features || '[]') : p.features
                }));

                // 2. Group by Name
                const groups: Record<string, PlanGroup> = {};

                parsedData.forEach((plan: Plan) => {
                    if (!groups[plan.name]) {
                        groups[plan.name] = {
                            name: plan.name,
                            tag: plan.tag,
                            features: Array.isArray(plan.features) ? plan.features : [],
                            variants: []
                        };
                    }
                    groups[plan.name].variants.push(plan);
                });

                // 3. Convert to Array and Sort Variants
                const groupArray = Object.values(groups).map(g => {
                    g.variants.sort((a, b) => a.duration_months - b.duration_months);
                    return g;
                });

                setPlanGroups(groupArray);

            } else if (res.status === 401 || res.status === 403) {
                alert('Oturum süreniz doldu. Lütfen tekrar giriş yapın.');
                localStorage.removeItem('token');
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Error fetching plans:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setGroupForm({ name: '', tag: '', features: [] });
        setVariantsForm([{
            duration_months: 1,
            price: 0,
            discount_percent: 0,
            is_active: 1,
            // Temporary ID for key
            id: 'temp-' + Date.now()
        }]);
        setOriginalGroupName(null);
        setIsGlobalActive(true);
        setShowModal(true);
    };

    const handleOpenEdit = (group: PlanGroup) => {
        setGroupForm({
            name: group.name,
            tag: group.tag || '',
            features: [...group.features]
        });
        // Deep copy variants to avoid direct mutation
        setVariantsForm(group.variants.map(v => ({ ...v })));
        setOriginalGroupName(group.name);
        setIsGlobalActive(group.variants.every(v => v.is_active === 1 || v.is_active === true));
        setShowModal(true);
    };

    const handleGlobalActiveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setIsGlobalActive(checked);
        setVariantsForm(prev => prev.map(v => ({ ...v, is_active: checked ? 1 : 0 })));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            // 1. Determine deleted variants (if editing)
            if (originalGroupName) {
                const originalGroup = planGroups.find(g => g.name === originalGroupName);
                if (originalGroup) {
                    const currentIds = variantsForm.map(v => v.id).filter(id => id && !id.startsWith('temp-'));
                    const toDelete = originalGroup.variants.filter(v => !currentIds.includes(v.id));

                    // Delete removed variants
                    for (const plan of toDelete) {
                        await fetch(`/api/admin/plans/${plan.id}`, { method: 'DELETE', headers });
                    }
                }
            }

            // 2. Upsert (Create/Update) Variants
            for (const variant of variantsForm) {
                const payload = {
                    ...variant,
                    name: groupForm.name,
                    tag: groupForm.tag,
                    features: groupForm.features
                };

                // ID handling: temp- means new
                if (variant.id && !variant.id.startsWith('temp-')) {
                    // Update
                    await fetch(`/api/admin/plans/${variant.id}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify(payload)
                    });
                } else {
                    // Create (Remove temp ID)
                    const { id, ...newPayload } = payload as any;
                    await fetch('/api/admin/plans', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(newPayload)
                    });
                }
            }

            setShowModal(false);
            fetchPlans();

        } catch (error) {
            console.error('Error saving plan group:', error);
            alert('Kaydetme sırasında bir hata oluştu.');
        }
    };

    const handleDeleteClick = (groupName: string) => {
        setDeleteConfirmation({ isOpen: true, groupName });
    };

    const confirmDelete = async () => {
        if (!deleteConfirmation) return;
        const groupName = deleteConfirmation.groupName;

        try {
            const token = localStorage.getItem('token');
            const group = planGroups.find(g => g.name === groupName);
            if (!group) return;

            // Delete all variants in loop
            for (const plan of group.variants) {
                await fetch(`/api/admin/plans/${plan.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
            setDeleteConfirmation(null);
            fetchPlans();
        } catch (error) {
            console.error('Error deleting group:', error);
            alert('Silme sırasında bir hata oluştu.');
            setDeleteConfirmation(null);
        }
    };

    // --- Helper Functions ---

    const addFeature = () => {
        if (!featureInput.trim()) return;
        setGroupForm(prev => ({ ...prev, features: [...prev.features, featureInput.trim()] }));
        setFeatureInput('');
    };

    const removeFeature = (index: number) => {
        setGroupForm(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }));
    };

    const addVariantRows = () => {
        setVariantsForm([...variantsForm, {
            duration_months: 12,
            price: 0,
            discount_percent: 0,
            is_active: 1,
            id: 'temp-' + Date.now()
        }]);
    };

    const removeVariantRow = (index: number) => {
        if (variantsForm.length === 1) {
            alert('En az bir fiyat seçeneği olmalıdır.');
            return;
        }
        setVariantsForm(variantsForm.filter((_, i) => i !== index));
    };

    const updateVariant = (index: number, field: keyof Plan, value: any) => {
        const newVariants = [...variantsForm];
        newVariants[index] = { ...newVariants[index], [field]: value };
        setVariantsForm(newVariants);
    };

    return (
        <div className="min-h-screen bg-[#0f172a] font-sans text-slate-200">
            <Navigation />

            {/* Background Glow */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full"></div>
            </div>

            <div className="container mx-auto px-4 pt-24 pb-12 relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                                <LayoutGrid className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white">Paket Yönetimi</h1>
                                <p className="text-slate-400">Paketleeri ve fiyatlandırma seçeneklerini yönetin</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleOpenCreate}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 flex items-center gap-2 group"
                    >
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        Yeni Paket Grubu
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-slate-500 animate-pulse">Paketler yükleniyor...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {planGroups.map((group, idx) => (
                            <div key={idx} className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden flex flex-col group hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-900/10 transition-all duration-300">
                                {/* Header */}
                                <div className="p-6 border-b border-slate-800 bg-slate-800/30">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-xl font-bold text-white">{group.name}</h3>
                                        {group.tag && (
                                            <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/20 font-bold uppercase tracking-wider">
                                                {group.tag}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-slate-500 flex gap-2">
                                        <span>{group.variants.length} Seçenek</span>
                                        <span>•</span>
                                        <span>{group.features.length} Özellik</span>
                                    </div>
                                </div>

                                {/* Variants Table */}
                                <div className="p-0">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-800/50">
                                            <tr>
                                                <th className="px-6 py-3 font-medium">Süre</th>
                                                <th className="px-6 py-3 font-medium">Fiyat</th>
                                                <th className="px-4 py-3 font-medium text-right">Durum</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {group.variants.map((v) => (
                                                <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-6 py-3 font-medium text-slate-300">{v.duration_months} Ay</td>
                                                    <td className="px-6 py-3 text-white">₺{v.price.toLocaleString('tr-TR')}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        {v.is_active ?
                                                            <div className="inline-block w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div> :
                                                            <div className="inline-block w-2 h-2 rounded-full bg-slate-600"></div>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Shared Features Preview */}
                                <div className="p-6 border-t border-slate-800 bg-slate-900/30 flex-1">
                                    <div className="space-y-2">
                                        {group.features.slice(0, 3).map((f, i) => (
                                            <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                                                <Check className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
                                                <span className="line-clamp-1">{f}</span>
                                            </div>
                                        ))}
                                        {group.features.length > 3 && (
                                            <div className="text-[10px] text-slate-600 pl-5 italic">
                                                + {group.features.length - 3} özellik daha
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions Footer */}
                                <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex justify-between items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteClick(group.name);
                                        }}
                                        className="p-2 text-slate-500 hover:text-white hover:bg-red-500 rounded-lg transition-all shadow-sm hover:shadow-red-500/50"
                                        title="Grubu Sil"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleOpenEdit(group)}
                                        className="flex-1 py-2 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 group/btn"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        Düzenle
                                        <ChevronRight className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {/* New Plan Quick Button */}
                        <button
                            onClick={handleOpenCreate}
                            className="bg-slate-900/30 border border-dashed border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/5 rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center gap-4 text-slate-500 hover:text-blue-400 group h-full min-h-[300px]"
                        >
                            <div className="w-16 h-16 rounded-full bg-slate-800 group-hover:bg-blue-500/20 flex items-center justify-center transition-colors">
                                <Plus className="w-8 h-8" />
                            </div>
                            <span className="font-semibold">Yeni Bir Paket Grubu Ekle</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirmation && deleteConfirmation.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                                <Trash2 className="w-6 h-6 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-2">Paketi Sil</h3>
                                <p className="text-slate-400 text-sm">
                                    <span className="text-white font-medium">{deleteConfirmation.groupName}</span> paketini ve tüm seçeneklerini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                                </p>
                            </div>
                            <div className="flex gap-3 w-full mt-2">
                                <button
                                    onClick={() => setDeleteConfirmation(null)}
                                    className="flex-1 px-4 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors font-medium border border-slate-700"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors font-medium shadow-lg shadow-red-500/20"
                                >
                                    Evet, Sil
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal END */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all overflow-y-auto">
                    <div className="my-auto w-full max-w-4xl">
                        <div
                            className="bg-[#0f172a] border border-slate-700/50 rounded-2xl shadow-2xl relative flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                        <Package className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">
                                        {originalGroupName ? `Paket Grubunu Düzenle: ${originalGroupName}` : 'Yeni Paket Grubu Oluştur'}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-2 rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row h-[70vh]">
                                {/* LEFT SIDE: Group Info & Features */}
                                <div className="lg:w-1/3 p-6 border-r border-slate-800 overflow-y-auto custom-scrollbar bg-slate-900/20">
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Package className="w-4 h-4" /> Genel Bilgiler
                                    </h4>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Paket Adı</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                                placeholder="Örn: Standart"
                                                value={groupForm.name}
                                                onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                                            />
                                            <p className="text-xs text-slate-500 mt-1">Bu isim tüm seçeneklerde görünecek.</p>
                                        </div>

                                        <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                                            <input
                                                type="checkbox"
                                                id="globalActive"
                                                checked={isGlobalActive}
                                                onChange={handleGlobalActiveChange}
                                                className="w-5 h-5 bg-slate-800 border-slate-600 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                                            />
                                            <label htmlFor="globalActive" className="text-sm font-medium text-slate-300 cursor-pointer select-none">
                                                Tüm Seçenekleri Aktif Yap
                                            </label>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Etiket (Opsiyonel)</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                                placeholder="Örn: En Çok Tercih Edilen"
                                                value={groupForm.tag}
                                                onChange={e => setGroupForm({ ...groupForm, tag: e.target.value })}
                                            />
                                        </div>

                                        <div className="h-px bg-slate-800 my-4" />

                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-2 flex justify-between">
                                                <span>Ortak Özellikler</span>
                                                <span className="text-xs text-slate-500 font-normal">{groupForm.features.length} eklendi</span>
                                            </label>

                                            <div className="flex gap-2 mb-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-blue-500 outline-none"
                                                    value={featureInput}
                                                    onChange={e => setFeatureInput(e.target.value)}
                                                    placeholder="Özellik ekle..."
                                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={addFeature}
                                                    className="bg-slate-700 hover:bg-slate-600 text-white px-3 rounded-lg"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                                {groupForm.features.map((f, i) => (
                                                    <div key={i} className="flex justify-between items-start bg-slate-800/50 p-2 rounded border border-slate-700/50 group">
                                                        <span className="text-xs text-slate-300 leading-tight flex-1">{f}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFeature(i)}
                                                            className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 p-0.5 ml-2"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT SIDE: Variants */}
                                <div className="lg:w-2/3 p-6 overflow-y-auto custom-scrollbar">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                            <Calendar className="w-4 h-4" /> Fiyatlandırma Seçenekleri
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={addVariantRows}
                                            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"
                                        >
                                            <Plus className="w-3 h-3" /> Seçenek Ekle
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {variantsForm.map((variant, idx) => (
                                            <div key={idx} className="bg-slate-900/30 border border-slate-700 rounded-xl p-4 relative group hover:border-slate-600 transition-colors">
                                                <button
                                                    type="button"
                                                    onClick={() => removeVariantRow(idx)}
                                                    className="absolute top-2 right-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-red-500 p-1.5 rounded-lg transition-all shadow-sm"
                                                    title="Bu seçeneği sil"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>

                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-400 mb-1">Süre (Ay)</label>
                                                        <select
                                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-blue-500 outline-none"
                                                            value={variant.duration_months}
                                                            onChange={e => updateVariant(idx, 'duration_months', Number(e.target.value))}
                                                        >
                                                            {[1, 3, 6, 12, 24].map(m => (
                                                                <option key={m} value={m}>{m} Aylık</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-400 mb-1">Fiyat (₺)</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-blue-500 outline-none"
                                                            value={variant.price}
                                                            onChange={e => updateVariant(idx, 'price', Number(e.target.value))}
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-400 mb-1">İndirim %</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-blue-500 outline-none"
                                                            value={variant.discount_percent || 0}
                                                            onChange={e => updateVariant(idx, 'discount_percent', Number(e.target.value))}
                                                        />
                                                    </div>

                                                    <div className="md:col-span-1">
                                                        <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-950 border border-slate-700 rounded-lg p-2 h-[38px]">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-600 bg-slate-800"
                                                                checked={!!variant.is_active}
                                                                onChange={e => updateVariant(idx, 'is_active', e.target.checked ? 1 : 0)}
                                                            />
                                                            <span className="text-sm text-slate-300">Aktif</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </form>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-5 py-2.5 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl font-medium transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Kaydet
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
