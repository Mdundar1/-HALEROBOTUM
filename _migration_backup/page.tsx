'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/context/AuthContext';
import { TierPieChart, DurationBarChart, DailySignupsChart } from '@/components/admin/StatsCharts';

// ChartJS registration is handled in the components now.

const ADMIN_EMAILS = ['admin@ihalerobotum.com', 'info@ihalerobotum.com', 'sigorta.mucahitdunder@gmail.com'];

export default function AdminPage() {
    const { user, isLoggedIn } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'plans'>('dashboard');
    const [stats, setStats] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [userFilter, setUserFilter] = useState<'all' | 'active' | 'trial' | 'passive'>('all');

    // New States for Unified Plan Management
    const [activeDuration, setActiveDuration] = useState(1);
    const [tierUpdates, setTierUpdates] = useState<Record<string, any>>({});

    // Plan Modal State
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState<any>(null);
    interface PlanForm {
        name: string;
        price: number;
        duration_months: number;
        features: { list: string[] };
        is_active: boolean;
        discount_rate: number;
        badge_text: string;
        tier: 'free' | 'standard' | 'pro';
    }

    const [planForm, setPlanForm] = useState<PlanForm>({
        name: '',
        price: 0,
        duration_months: 1,
        features: { list: [] },
        is_active: true,
        discount_rate: 0,
        badge_text: '',
        tier: 'standard'
    });

    useEffect(() => {
        if (!loading && (!isLoggedIn || !user || !ADMIN_EMAILS.includes(user.email))) {
            router.push('/');
        }
    }, [isLoggedIn, user, loading, router]);

    useEffect(() => {
        if (isLoggedIn && user && ADMIN_EMAILS.includes(user.email)) {
            fetchStats();
            fetchUsers();
            fetchPlans();
        } else {
            setTimeout(() => setLoading(false), 1000);
        }
    }, [isLoggedIn, user]);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setUsers(data);
                }
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlans = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/plans', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setPlans(data);
                }
            }
        } catch (error) {
            console.error('Error fetching plans:', error);
        }
    };

    const handleSavePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const url = editingPlan ? `/api/admin/plans/${editingPlan.id}` : '/api/admin/plans';
            const method = editingPlan ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(planForm)
            });

            if (res.ok) {
                setShowPlanModal(false);
                setEditingPlan(null);
                fetchPlans();
                resetPlanForm();
            } else {
                alert('Kaydedilirken bir hata oluştu.');
            }
        } catch (error) {
            console.error('Error saving plan:', error);
        }
    };

    const handleDeletePlan = async (id: string) => {
        if (!confirm('Bu paketi silmek istediğinize emin misiniz?')) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/plans/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                fetchPlans();
            } else {
                const data = await res.json();
                alert(data.error || 'Silinirken bir hata oluştu');
            }
        } catch (error) {
            console.error('Error deleting plan:', error);
        }
    };

    const openEditModal = (plan: any) => {
        setEditingPlan(plan);

        // Parse and Migrate Legacy Features
        let rawFeatures = typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features;
        let featureList: string[] = [];

        if (rawFeatures.list && Array.isArray(rawFeatures.list)) {
            // Already in new format
            featureList = rawFeatures.list;
        } else {
            // Migrate legacy boolean/string features to list
            if (rawFeatures.unlimited_search) featureList.push('Sınırsız analiz');
            if (rawFeatures.all_agencies) featureList.push('Tüm birim fiyatlar');
            if (rawFeatures.support === 'fast') featureList.push('Hızlı teknik destek');
            else if (rawFeatures.support === 'normal' || rawFeatures.support) featureList.push('Teknik destek');

            if (rawFeatures.transport_module) featureList.push('Nakliye modülü');
            if (rawFeatures.api_access) featureList.push('API erişimi');

            // Fallback if empty - MATCH HOMEPAGE DEFAULT
            if (featureList.length === 0) {
                featureList = ['Sınırsız analiz', 'Tüm birim fiyatlar', 'Excel dışa aktırma', 'Teknik destek'];
            }
        }

        setPlanForm({
            name: plan.name,
            price: plan.price,
            duration_months: plan.duration_months,
            features: { list: featureList },
            is_active: !!plan.is_active,
            discount_rate: plan.discount_rate || 0,
            badge_text: plan.badge_text || '',
            tier: plan.tier || 'standard'
        });
        setShowPlanModal(true);
    };

    const openCreateModal = () => {
        setEditingPlan(null);
        resetPlanForm();
        setShowPlanModal(true);
    };

    const resetPlanForm = () => {
        setPlanForm({
            name: '',
            price: 0,
            duration_months: 1,
            features: { list: [] },
            is_active: true,
            discount_rate: 0,
            badge_text: '',
            tier: 'standard'
        });
    };

    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [showUserModal, setShowUserModal] = useState(false);

    const handleViewDetails = async (userId: string) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/users/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setSelectedUser(data);
            setShowUserModal(true);
        } catch (error) {
            console.error('Error fetching user details:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user || !ADMIN_EMAILS.includes(user.email)) {
        return null;
    }

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        if (userFilter === 'all') return true;
        if (userFilter === 'active') return u.sub_status === 'active';
        if (userFilter === 'trial') return u.sub_status === 'trial';
        if (userFilter === 'passive') return u.sub_status !== 'active' && u.sub_status !== 'trial';
        return true;
    });

    // Chart Data moved to StatsCharts components


    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <Navigation />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pt-24">
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Admin Paneli</h1>
                        <p className="text-slate-600">Sistem istatistikleri ve yönetimi.</p>
                    </div>
                    <div className="flex space-x-2 bg-white p-1 rounded-lg border border-slate-200">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('plans')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'plans' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            Paket Yönetimi
                        </button>
                    </div>
                </div>

                {activeTab === 'dashboard' ? (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <div className="text-sm font-medium text-slate-500 mb-1">Toplam Üye</div>
                                <div className="text-3xl font-bold text-slate-900">{stats?.userCount || 0}</div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <div className="text-sm font-medium text-slate-500 mb-1">Aktif Abonelik</div>
                                <div className="text-3xl font-bold text-emerald-600">{stats?.subCount || 0}</div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <div className="text-sm font-medium text-slate-500 mb-1">Pasif/Deneme</div>
                                <div className="text-3xl font-bold text-orange-500">{stats?.passiveSubCount || 0}</div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <div className="text-sm font-medium text-slate-500 mb-1">Bugünkü Kayıt</div>
                                <div className="text-3xl font-bold text-blue-600">{stats?.todayCount || 0}</div>
                            </div>
                        </div>

                        {/* Growth Chart */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Üye Gelişimi (Son 30 Gün)</h3>
                            <div className="h-72">
                                {stats?.dailySignups && <DailySignupsChart data={stats.dailySignups} />}
                                {!stats?.dailySignups && <p className="text-slate-400 text-center py-10">Veri yok</p>}
                            </div>
                        </div>

                        {/* Analysis Charts Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">Üyelik Dağılımı (Paket Tipi)</h3>
                                <div className="h-64">
                                    {stats?.tierStats && <TierPieChart data={stats.tierStats} />}
                                    {!stats?.tierStats && <p className="text-slate-400 text-center py-10">Veri yok</p>}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">Üyelik Süresi Tercihleri</h3>
                                <div className="h-64">
                                    {stats?.durationStats && <DurationBarChart data={stats.durationStats} />}
                                    {!stats?.durationStats && <p className="text-slate-400 text-center py-10">Veri yok</p>}
                                </div>
                            </div>
                        </div>

                        {/* Users Table */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <h3 className="text-lg font-bold text-slate-900">Üye Listesi</h3>
                                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                                    <div className="flex gap-2">
                                        {(['all', 'active', 'trial', 'passive'] as const).map(filter => (
                                            <button
                                                key={filter}
                                                onClick={() => setUserFilter(filter)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${userFilter === filter ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                            >
                                                {filter}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="relative w-full sm:w-64">
                                        <input
                                            type="text"
                                            placeholder="İsim veya e-posta ara..."
                                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                        <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-3">Kullanıcı</th>
                                            <th className="px-6 py-3">Kayıt Tarihi</th>
                                            <th className="px-6 py-3">Abonelik</th>
                                            <th className="px-6 py-3">Bitiş Tarihi</th>
                                            <th className="px-6 py-3">İşlemler</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map((user) => (
                                            <tr key={user.id} className="bg-white border-b border-slate-100 hover:bg-slate-50">
                                                <td className="px-6 py-4 cursor-pointer group" onClick={() => handleViewDetails(user.id)}>
                                                    <div className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">{user.name || 'İsimsiz'}</div>
                                                    <div className="text-slate-500">{user.email}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {new Date(user.created_at).toLocaleDateString('tr-TR')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {user.sub_status === 'active' ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            {user.plan_name || 'Pro'}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                            {user.sub_status === 'trial' ? 'Deneme' : 'Pasif'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {user.sub_ends_at ? new Date(user.sub_ends_at).toLocaleDateString('tr-TR') : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button onClick={() => handleViewDetails(user.id)} className="text-blue-600 hover:text-blue-900 font-medium">Detaylar</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Plans Management Tab - Unified Card View */
                    <div className="space-y-8">
                        {/* Global Duration Selector */}
                        <div className="flex flex-col items-center justify-center space-y-4">
                            <h3 className="text-xl font-bold text-slate-800">Paket Fiyatlandırma Yönetimi</h3>
                            <div className="flex p-1 bg-slate-800/5 rounded-xl border border-slate-200">
                                {[1, 6, 12].map((months) => (
                                    <button
                                        key={months}
                                        onClick={() => setActiveDuration(months)}
                                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeDuration === months
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                            : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                                            }`}
                                    >
                                        {months === 1 ? 'Aylık' : months === 12 ? 'Yıllık' : `${months} Aylık`}
                                        {months === 6 && <span className="ml-2 text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full">%15</span>}
                                        {months === 12 && <span className="ml-2 text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full">%30</span>}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tier Cards Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {['free', 'standard', 'pro'].map((tier) => {
                                // Initialize tier data from state or plans
                                const tierName = { free: 'Ücretsiz Paket', standard: 'Standart Paket', pro: 'Pro Paket' }[tier];
                                const tierColor = { free: 'slate', standard: 'blue', pro: 'purple' }[tier] as any;
                                const headerGradient = {
                                    free: 'from-slate-700 to-slate-800',
                                    standard: 'from-blue-600 to-indigo-600',
                                    pro: 'from-purple-600 to-pink-600'
                                }[tier];

                                // Find plan for current duration
                                const currentPlan = plans.find(p => p.tier === tier && p.duration_months === activeDuration);
                                const masterPlan = plans.find(p => p.tier === tier) || currentPlan; // For features

                                // Local state for inputs (derived from database data if not modified yet)
                                const currentPrice = tierUpdates[tier]?.prices?.[activeDuration] ?? currentPlan?.price ?? 0;
                                const currentFeatures = tierUpdates[tier]?.features ?? (
                                    masterPlan?.features
                                        ? (typeof masterPlan.features === 'string' ? JSON.parse(masterPlan.features).list : masterPlan.features.list)
                                        : []
                                );

                                // Add Feature Handler
                                const addFeature = (e: any) => {
                                    e.preventDefault();
                                    const input = e.target.feature;
                                    const value = input.value.trim();
                                    if (value) {
                                        const newFeatures = [...currentFeatures, value];
                                        setTierUpdates(prev => ({
                                            ...prev,
                                            [tier]: {
                                                ...prev[tier],
                                                features: newFeatures,
                                                // Preserve prices
                                                prices: prev[tier]?.prices || {}
                                            }
                                        }));
                                        input.value = '';
                                    }
                                };

                                // Remove Feature Handler
                                const removeFeature = (idx: number) => {
                                    if (confirm('Bu özelliği silmek istediğinize emin misiniz?')) {
                                        const newFeatures = currentFeatures.filter((_: any, i: number) => i !== idx);
                                        setTierUpdates(prev => ({
                                            ...prev,
                                            [tier]: {
                                                ...prev[tier],
                                                features: newFeatures,
                                                prices: prev[tier]?.prices || {}
                                            }
                                        }));
                                    }
                                };

                                // Price Change Handler
                                const updatePrice = (val: number) => {
                                    setTierUpdates(prev => ({
                                        ...prev,
                                        [tier]: {
                                            ...prev[tier],
                                            features: currentFeatures,
                                            prices: {
                                                ...(prev[tier]?.prices || {}),
                                                [activeDuration]: val
                                            }
                                        }
                                    }));
                                };

                                // Save Handler
                                const saveTier = async () => {
                                    if (!confirm(`${tierName} için değişiklikleri kaydetmek istiyor musunuz?`)) return;

                                    try {
                                        // 1. Update Features for ALL durations of this tier
                                        const tierPlans = plans.filter(p => p.tier === tier);

                                        // 2. Update Price for CURRENT duration
                                        const updates = tierPlans.map(plan => {
                                            const updateData: any = {
                                                features: { list: currentFeatures }
                                            };

                                            // Only update price if it matches the current active duration being edited
                                            // OR if we have specific stored changes for other durations (advanced)
                                            // For now, simpler: we only commit the price of the ACTIVE duration, plus features for all.
                                            if (plan.duration_months === activeDuration) {
                                                updateData.price = currentPrice;
                                            }

                                            return fetch(`/api/admin/plans/${plan.id}`, {
                                                method: 'PUT',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                                },
                                                body: JSON.stringify(updateData)
                                            });
                                        });

                                        await Promise.all(updates);
                                        alert('Paket güncellendi!');
                                        fetchPlans();

                                        // Clear local updates for this tier
                                        setTierUpdates(prev => {
                                            const next = { ...prev };
                                            delete next[tier];
                                            return next;
                                        });

                                    } catch (error) {
                                        console.error(error);
                                        alert('Hata oluştu');
                                    }
                                };

                                return (
                                    <div key={tier} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                                        {/* Header */}
                                        <div className={`bg-gradient-to-r ${headerGradient} p-6 text-white text-center`}>
                                            <h4 className="text-2xl font-bold">{tierName}</h4>
                                            <div className="mt-2 text-white/80 text-sm font-medium bg-white/10 inline-block px-3 py-1 rounded-full">
                                                {activeDuration === 1 ? 'Aylık Plan' : activeDuration + ' Aylık Plan'}
                                            </div>
                                        </div>

                                        {/* Price Section */}
                                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 text-center">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Paket Fiyatı (TL)</label>
                                            <div className="flex items-center justify-center gap-2">
                                                <input
                                                    type="number"
                                                    value={currentPrice}
                                                    onChange={(e) => updatePrice(parseFloat(e.target.value) || 0)}
                                                    className="text-3xl font-bold text-slate-800 bg-transparent border-b-2 border-slate-200 focus:border-blue-500 outline-none w-40 text-center py-1 transition-colors"
                                                />
                                                <span className="text-slate-400 text-xl">₺</span>
                                            </div>
                                            {!currentPlan && (
                                                <p className="mt-2 text-xs text-red-500">Bu sürede tanımlı plan yok. Kaydedince oluşturulacak.</p>
                                            )}
                                        </div>

                                        {/* Features Section */}
                                        <div className="p-6 flex-1 flex flex-col">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Paket Özellikleri</label>

                                            {/* Add New Feature */}
                                            <form onSubmit={addFeature} className="flex gap-2 mb-4">
                                                <input
                                                    name="feature"
                                                    placeholder="Özellik ekle..."
                                                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                />
                                                <button type="submit" className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-700 transition-colors">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                                </button>
                                            </form>

                                            {/* Feature List */}
                                            <div className="space-y-2 flex-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {currentFeatures.map((feature: string, idx: number) => (
                                                    <div key={idx} className="group flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-300 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                                            <span className="text-sm text-slate-700">{feature}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => removeFeature(idx)}
                                                            className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-red-50 rounded"
                                                            title="Özelliği Sil"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    </div>
                                                ))}
                                                {currentFeatures.length === 0 && (
                                                    <div className="text-center py-8 text-slate-400 text-sm">
                                                        Henüz özellik eklenmemiş.
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Footer Actions */}
                                        <div className="p-4 border-t border-slate-100 bg-slate-50">
                                            <button
                                                onClick={saveTier}
                                                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 ${(tierUpdates[tier] || (!currentPlan && activeDuration))
                                                    ? `bg-gradient-to-r ${headerGradient} shadow-${tierColor}-500/25`
                                                    : 'bg-slate-300 cursor-not-allowed'
                                                    }`}
                                                disabled={!tierUpdates[tier] && !!currentPlan}
                                            >
                                                {(tierUpdates[tier]) ? 'Değişiklikleri Kaydet' : 'Güncel'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* User Details Modal */}
            {showUserModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl">
                                    {(selectedUser.name || selectedUser.email || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900">{selectedUser.name || 'İsimsiz'}</h3>
                                    <p className="text-slate-500 text-sm">{selectedUser.email}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowUserModal(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-colors">✕</button>
                        </div>

                        {/* Modal Content - Scrollable */}
                        <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar">

                            {/* Personal & Account Info */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Kişisel Bilgiler</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Kayıt Tarihi</label>
                                        <div className="font-medium text-slate-900">{new Date(selectedUser.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">E-posta Durumu</label>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${selectedUser.email ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            <span className="font-medium text-slate-900">{selectedUser.email ? 'Doğrulanmış' : 'Doğrulanmamış'}</span>
                                        </div>
                                    </div>
                                    {selectedUser.phone && (
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Telefon</label>
                                            <div className="font-medium text-slate-900">{selectedUser.phone}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Subscription Info */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Abonelik Durumu</h4>
                                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                                        <div>
                                            <div className="text-xs text-slate-500 mb-1">Mevcut Paket</div>
                                            <div className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                                {selectedUser.plan_name || 'Paket Yok'}
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${selectedUser.sub_status === 'active' ? 'bg-green-100 text-green-700' :
                                                        selectedUser.sub_status === 'trial' ? 'bg-orange-100 text-orange-700' :
                                                            'bg-slate-200 text-slate-600'
                                                    }`}>
                                                    {selectedUser.sub_status === 'active' ? 'Aktif' : selectedUser.sub_status === 'trial' ? 'Deneme' : 'Pasif'}
                                                </span>
                                            </div>
                                        </div>
                                        {selectedUser.sub_ends_at && (
                                            <div className="text-right">
                                                <div className="text-xs text-slate-500 mb-1">Bitiş Tarihi</div>
                                                <div className="text-lg font-bold text-slate-900">
                                                    {new Date(selectedUser.sub_ends_at).toLocaleDateString('tr-TR')}
                                                </div>
                                                <div className="text-xs text-orange-600 font-medium">
                                                    {Math.ceil((new Date(selectedUser.sub_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} gün kaldı
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Projects */}
                            {selectedUser.projects && selectedUser.projects.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Son Projeler</h4>
                                    <div className="overflow-x-auto border rounded-xl border-slate-200">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium">Proje Adı</th>
                                                    <th className="px-4 py-3 font-medium">Oluşturma</th>
                                                    <th className="px-4 py-3 font-medium text-right">Maliyet</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {selectedUser.projects.map((p: any) => (
                                                    <tr key={p.id} className="hover:bg-slate-50/50">
                                                        <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                                                        <td className="px-4 py-3 text-slate-500">{new Date(p.created_at).toLocaleDateString('tr-TR')}</td>
                                                        <td className="px-4 py-3 text-right font-bold text-slate-700">
                                                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(p.total_cost || 0)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
