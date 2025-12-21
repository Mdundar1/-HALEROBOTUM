'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import Navigation from '../../../components/Navigation';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { useRouter } from 'next/navigation';

const ADMIN_EMAILS = [
    'admin@maliyet724.com', 'info@maliyet724.com', 'sigorta.mucahitdunder@gmail.com',
    'admin@ihalerobotum.com', 'info@ihalerobotum.com'
];

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

interface User {
    id: string;
    name: string;
    email: string;
    phone?: string;
    created_at: string;
    subscription_status: string;
    subscription_ends_at: string;
    plan_name: string;
    plan_price: number;
    company_name?: string;
    tax_office?: string;
    tax_number?: string;
    billing_address?: string;
}

export default function AdminUsersPage() {
    const { user, isLoggedIn, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'active' | 'free' | 'passive'>('all');

    // Modal State
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (!authLoading && (!isLoggedIn || !user || !ADMIN_EMAILS.includes(user.email.toLowerCase()))) {
            router.push('/');
        }
    }, [isLoggedIn, user, authLoading, router]);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const isSubscriptionActive = (user: User) => {
        if (!user.subscription_status) return false;
        if (user.subscription_status === 'trial') {
            return new Date(user.subscription_ends_at) > new Date();
        }
        if (user.subscription_status === 'active') {
            return new Date(user.subscription_ends_at) > new Date();
        }
        return false;
    };

    // --- Chart Data Preparation ---
    const activeCount = users.filter(u => isSubscriptionActive(u) && u.plan_name).length;
    const passiveCount = users.filter(u => !!u.plan_name && !isSubscriptionActive(u)).length;
    const freeCount = users.length - activeCount - passiveCount;

    const membershipChartData = {
        labels: ['Aktif Üyeler', 'Pasif (Süresi Biten)', 'Ücretsiz'],
        datasets: [
            {
                data: [activeCount, passiveCount, freeCount],
                backgroundColor: [
                    'rgba(74, 222, 128, 0.6)', // Green (Active)
                    'rgba(248, 113, 113, 0.6)', // Red (Passive)
                    'rgba(148, 163, 184, 0.6)', // Slate (Free)
                ],
                borderColor: [
                    'rgba(74, 222, 128, 1)',
                    'rgba(248, 113, 113, 1)',
                    'rgba(148, 163, 184, 1)',
                ],
                borderWidth: 1,
            },
        ],
    };

    // Revenue Calculation (Mock: Sum of active plan prices)
    const totalRevenue = users.reduce((acc, curr) => acc + (curr.plan_price || 0), 0);

    const revenueChartData = {
        labels: ['Toplam Tahmini Gelir'],
        datasets: [
            {
                label: 'Gelir (TL)',
                data: [totalRevenue],
                backgroundColor: 'rgba(59, 130, 246, 0.6)', // Blue
            },
        ],
    };

    const handleAnalyze = async (userId: string) => {
        // Fetch full details including billing info (using the unified endpoint logic)
        // Since list endpoint already returns billing info now (we updated it), we can just find locally.
        // But for robustness let's refetch or just use local if available.
        // The backend update for list endpoint now includes billing columns, so local find is enough!
        const user = users.find(u => u.id === userId);
        if (user) {
            setSelectedUser(user);
            setIsModalOpen(true);
        }
    };

    const filteredUsers = users.filter(user => {
        const isActive = isSubscriptionActive(user);
        const hasPlan = !!user.plan_name;

        if (activeTab === 'all') return true;
        if (activeTab === 'active') return isActive && hasPlan;
        if (activeTab === 'free') return !hasPlan && !isActive;
        if (activeTab === 'passive') return hasPlan && !isActive;
        return true;
    });

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
            <Navigation />

            <div className="container mx-auto px-4 pt-24 pb-12">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Kullanıcı Yönetimi ve Analiz</h1>
                        <p className="text-slate-400">Üye veritabanı, abonelik durumları ve gelir analizi</p>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                        <h3 className="text-lg font-bold text-white mb-4">Üyelik Dağılımı</h3>
                        <div className="h-64 flex justify-center">
                            <Pie data={membershipChartData} options={{ maintainAspectRatio: false }} />
                        </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                        <h3 className="text-lg font-bold text-white mb-4">Finansal Genel Bakış</h3>
                        <div className="h-64">
                            <Bar
                                data={revenueChartData}
                                options={{
                                    maintainAspectRatio: false,
                                    scales: {
                                        y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                                        x: { grid: { display: false } }
                                    }
                                }}
                            />
                        </div>
                        <div className="mt-4 text-center">
                            <span className="text-slate-400">Toplam Ciro (Tahmini): </span>
                            <span className="text-2xl font-bold text-white">₺{totalRevenue.toLocaleString('tr-TR')}</span>
                        </div>
                    </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                        <div className="text-slate-400 text-sm mb-1">Toplam Üye</div>
                        <div className="text-2xl font-bold text-white">{users.length}</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                        <div className="text-blue-400 text-sm mb-1">Aktif Abonelik</div>
                        <div className="text-2xl font-bold text-white">{activeCount}</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                        <div className="text-green-400 text-sm mb-1">Aylık Yeni Üye</div>
                        <div className="text-2xl font-bold text-white">
                            {/* Mock for demo, real implementation uses created_at */}
                            {users.filter(u => new Date(u.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}
                        </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                        <div className="text-red-400 text-sm mb-1">Süresi Biten (Pasif)</div>
                        <div className="text-2xl font-bold text-white">{passiveCount}</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-slate-800 pb-1">
                    {[
                        { id: 'all', label: 'Tümü' },
                        { id: 'active', label: 'Aktif Üyeler' },
                        { id: 'free', label: 'Ücretsiz' },
                        { id: 'passive', label: 'Pasif (Süresi Biten)' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative top-[1px] ${activeTab === tab.id
                                ? 'bg-slate-900 text-blue-400 border border-slate-800 border-b-slate-900'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="text-center py-12">Yükleniyor...</div>
                ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-950 text-slate-400 text-sm uppercase">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Kullanıcı</th>
                                        <th className="px-6 py-4 font-medium">İletişim</th>
                                        <th className="px-6 py-4 font-medium">Kayıt Tarihi</th>
                                        <th className="px-6 py-4 font-medium">Paket</th>
                                        <th className="px-6 py-4 font-medium">Durum</th>
                                        <th className="px-6 py-4 font-medium text-right">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {filteredUsers.map(user => (
                                        <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-white">{user.name || 'İsimsiz'}</div>
                                                <div className="text-sm text-slate-500">{user.email}</div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-sm">
                                                {user.phone || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-sm">
                                                {new Date(user.created_at).toLocaleDateString('tr-TR')}
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.plan_name ? (
                                                    <span className="text-white font-medium">{user.plan_name}</span>
                                                ) : (
                                                    <span className="text-slate-500 italic">Yok</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isSubscriptionActive(user) ? (
                                                    user.plan_name ?
                                                        <span className="bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/20">Aktif</span>
                                                        : <span className="bg-blue-500/10 text-blue-400 text-xs px-2 py-1 rounded-full border border-blue-500/20">Deneme</span>
                                                ) : (
                                                    user.plan_name ?
                                                        <span className="bg-red-500/10 text-red-400 text-xs px-2 py-1 rounded-full border border-red-500/20">Süresi Bitti</span>
                                                        : <span className="bg-slate-500/10 text-slate-400 text-xs px-2 py-1 rounded-full border border-slate-500/20">Ücretsiz</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleAnalyze(user.id)}
                                                    className="text-blue-400 hover:text-blue-300 text-sm font-medium bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-all"
                                                >
                                                    Analiz Et
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                Bu kategoride kullanıcı bulunamadı.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Analysis Modal */}
            {isModalOpen && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex justify-between items-center z-10">
                            <h2 className="text-xl font-bold text-white">Kullanıcı Analizi: {selectedUser.name}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Profile Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Kişisel Bilgiler</h3>
                                    <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-3">
                                        <div>
                                            <div className="text-xs text-slate-500">Ad Soyad</div>
                                            <div className="text-white font-medium">{selectedUser.name || '-'}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-500">Email</div>
                                            <div className="text-white font-medium">{selectedUser.email}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-500">Telefon</div>
                                            <div className="text-white font-medium">{selectedUser.phone || '-'}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-500">Kayıt Tarihi</div>
                                            <div className="text-white font-medium">{new Date(selectedUser.created_at).toLocaleDateString('tr-TR')}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Abonelik Durumu</h3>
                                    <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-3">
                                        <div>
                                            <div className="text-xs text-slate-500">Mevcut Paket</div>
                                            <div className="text-white font-medium">{selectedUser.plan_name || 'Yok'}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-500">Durum</div>
                                            <div className="mt-1">
                                                {isSubscriptionActive(selectedUser) ?
                                                    <span className="bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/20">Aktif</span>
                                                    : <span className="bg-red-500/10 text-red-400 text-xs px-2 py-1 rounded-full border border-red-500/20">Pasif / Yok</span>
                                                }
                                            </div>
                                        </div>
                                        {selectedUser.subscription_ends_at && (
                                            <div>
                                                <div className="text-xs text-slate-500">Bitiş Tarihi</div>
                                                <div className="text-white font-medium">{new Date(selectedUser.subscription_ends_at).toLocaleDateString('tr-TR')}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Billing Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Fatura Bilgileri</h3>
                                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-xs text-slate-500">Şirket Adı</div>
                                        <div className="text-white font-medium">{selectedUser.company_name || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">Vergi Dairesi</div>
                                        <div className="text-white font-medium">{selectedUser.tax_office || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">Vergi No</div>
                                        <div className="text-white font-medium">{selectedUser.tax_number || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">Adres</div>
                                        <div className="text-white font-medium">{selectedUser.billing_address || '-'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-800 flex justify-end">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
                                >
                                    Kapat
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
