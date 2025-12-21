'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../context/AuthContext';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const ADMIN_EMAILS = [
    'admin@maliyet724.com', 'info@maliyet724.com', 'sigorta.mucahitdunder@gmail.com',
    'admin@ihalerobotum.com', 'info@ihalerobotum.com'
];

export default function AdminPage() {
    const { user, isLoggedIn, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!authLoading && (!isLoggedIn || !user || !ADMIN_EMAILS.includes(user.email.toLowerCase()))) {
            router.push('/');
        }
    }, [isLoggedIn, user, authLoading, router]);

    useEffect(() => {
        if (!authLoading && isLoggedIn && user && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
            fetchStats();
            fetchUsers();
        } else if (!authLoading) {
            setDataLoading(false);
        }
    }, [isLoggedIn, user, authLoading]);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setStats(data);
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
            const data = await res.json();
            setUsers(data);
            setDataLoading(false);
        } catch (error) {
            console.error('Error fetching users:', error);
            setDataLoading(false);
        }
    };

    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [showModal, setShowModal] = useState(false);

    const handleViewDetails = async (userId: string) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/users/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setSelectedUser(data);
            setShowModal(true);
        } catch (error) {
            console.error('Error fetching user details:', error);
        }
    };

    if (authLoading || dataLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!user || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        return null;
    }

    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const lineChartData = {
        labels: stats?.dailySignups?.map((d: any) => new Date(d.date).toLocaleDateString('tr-TR')) || [],
        datasets: [
            {
                label: 'Günlük Kayıt',
                data: stats?.dailySignups?.map((d: any) => d.count) || [],
                borderColor: 'rgb(79, 70, 229)',
                backgroundColor: 'rgba(79, 70, 229, 0.5)',
                tension: 0.3,
            },
        ],
    };

    const revenueChartData = {
        labels: stats?.dailySignups?.map((d: any) => new Date(d.date).toLocaleDateString('tr-TR')) || [],
        datasets: [
            {
                label: 'Tahmini Gelir (₺)',
                // Simulating revenue trend based on signups for demo purposes
                data: stats?.dailySignups?.map((d: any) => d.count * 1099 * 0.2) || [],
                borderColor: 'rgb(16, 185, 129)',
                backgroundColor: 'rgba(16, 185, 129, 0.5)',
                tension: 0.3,
            },
        ],
    };

    const barChartData = {
        labels: stats?.planDistribution?.map((d: any) => d.name) || [],
        datasets: [
            {
                label: 'Abonelik Dağılımı',
                data: stats?.planDistribution?.map((d: any) => d.count) || [],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                ],
                borderWidth: 1,
            },
        ],
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <Navigation />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Admin Paneli</h1>
                    <p className="text-slate-600">Sistem istatistikleri ve kullanıcı yönetimi.</p>
                </div>

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
                        <div className="text-3xl font-bold text-indigo-600">{stats?.todayCount || 0}</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 col-span-1 md:col-span-2 lg:col-span-4">
                        <div className="text-sm font-medium text-slate-500 mb-1">Tahmini Aylık Gelir</div>
                        <div className="text-3xl font-bold text-slate-900">
                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(stats?.revenue || 0)}
                        </div>
                    </div>
                </div>

                {/* Charts */}
                <div className="grid lg:grid-cols-2 gap-8 mb-10">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-6">Son 30 Gün Üye Artışı</h3>
                        <div className="h-64">
                            <Line options={{ maintainAspectRatio: false }} data={lineChartData} />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-6">Gelir Trendi (Simüle)</h3>
                        <div className="h-64">
                            <Line options={{ maintainAspectRatio: false }} data={revenueChartData} />
                        </div>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <h3 className="text-lg font-bold text-slate-900">Üye Listesi</h3>
                        <div className="relative w-full sm:w-64">
                            <input
                                type="text"
                                placeholder="İsim veya e-posta ara..."
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
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
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">{user.name || 'İsimsiz'}</div>
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
                                                    {user.sub_status === 'trial' ? 'Deneme' : 'Ücretsiz'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.sub_ends_at ? new Date(user.sub_ends_at).toLocaleDateString('tr-TR') : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleViewDetails(user.id)}
                                                className="text-indigo-600 hover:text-indigo-900 font-medium"
                                            >
                                                Detaylar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filteredUsers.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                            Kullanıcı bulunamadı.
                        </div>
                    )}
                </div>
            </div>

            {/* User Details Modal */}
            {showModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white">
                            <h2 className="text-xl font-bold text-slate-900">Kullanıcı Detayları</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Personal Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-500">İsim</label>
                                    <div className="text-slate-900 font-medium">{selectedUser.name || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500">Email</label>
                                    <div className="text-slate-900 font-medium">{selectedUser.email}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500">Telefon</label>
                                    <div className="text-slate-900 font-medium">{selectedUser.phone || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500">Kayıt Tarihi</label>
                                    <div className="text-slate-900 font-medium">{new Date(selectedUser.created_at).toLocaleString('tr-TR')}</div>
                                </div>
                            </div>

                            {/* Subscription Info */}
                            <div className="bg-slate-50 p-4 rounded-xl">
                                <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">Abonelik Bilgisi</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500">Durum</label>
                                        <div className="text-slate-900 font-medium capitalize">{selectedUser.sub_status || 'Yok'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500">Paket</label>
                                        <div className="text-slate-900 font-medium">{selectedUser.plan_name || '-'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500">Bitiş Tarihi</label>
                                        <div className="text-slate-900 font-medium">
                                            {selectedUser.sub_ends_at ? new Date(selectedUser.sub_ends_at).toLocaleDateString('tr-TR') : '-'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Projects */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">Son Projeler</h3>
                                {selectedUser.projects && selectedUser.projects.length > 0 ? (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500">
                                                <tr>
                                                    <th className="px-4 py-2 font-medium">Proje Adı</th>
                                                    <th className="px-4 py-2 font-medium">Tarih</th>
                                                    <th className="px-4 py-2 font-medium text-right">Tutar</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedUser.projects.map((p: any) => (
                                                    <tr key={p.id} className="border-t border-slate-100">
                                                        <td className="px-4 py-2">{p.name || 'İsimsiz'}</td>
                                                        <td className="px-4 py-2 text-slate-500">{new Date(p.created_at).toLocaleDateString('tr-TR')}</td>
                                                        <td className="px-4 py-2 text-right font-medium">
                                                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(p.total_cost || 0)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-slate-500 text-sm italic">Henüz proje oluşturmamış.</div>
                                )}
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
