'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Navigation() {
    const pathname = usePathname();
    const { isLoggedIn, user, logout, subscription } = useAuth();

    // Admin whitelist
    const ADMIN_EMAILS = ['admin@ihalerobotum.com', 'info@ihalerobotum.com', 'sigorta.mucahitdunder@gmail.com'];
    const isAdmin = isLoggedIn && user?.email && ADMIN_EMAILS.includes(user.email);

    const tabs = [
        { name: 'Ana Sayfa', path: '/' },
        { name: 'Maliyet Analizi', path: '/app' },
        { name: 'Poz Bul', path: '/pozbul' },
        { name: 'Paketler', path: '/#pricing' },
    ];

    if (isLoggedIn) {
        tabs.splice(2, 0, { name: 'Projelerim', path: '/projects' });
    }

    if (isAdmin) {
        tabs.push({ name: 'Veri Yönetimi', path: '/dataset' });
        tabs.push({ name: 'Admin', path: '/admin' });
    }

    // Get subscription display info
    const getSubscriptionBadge = () => {
        if (!subscription) return null;

        if (subscription.hasActiveSubscription) {
            if (subscription.isTrial) {
                return { text: 'Deneme', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
            }
            return { text: subscription.planName || 'Aktif', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
        }
        return { text: 'Ücretsiz', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
    };

    const badge = getSubscriptionBadge();

    return (
        <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center gap-10">
                        {/* Logo Area */}
                        <Link href="/" className="flex items-center gap-3 group">
                            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                                </svg>
                            </div>
                            <span className="text-lg font-bold text-white">İhale<span className="text-blue-400">Robotum</span></span>
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center space-x-1">
                            {tabs.map((tab) => {
                                const isActive = pathname === tab.path || (tab.path !== '/' && pathname?.startsWith(tab.path));
                                return (
                                    <Link
                                        key={tab.path}
                                        href={tab.path}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                            }`}
                                    >
                                        {tab.name}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-3">
                        {isLoggedIn && user ? (
                            <div className="flex items-center gap-3">
                                {/* Subscription Badge */}
                                {badge && (
                                    <span className={`hidden sm:inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border ${badge.color}`}>
                                        {badge.text}
                                    </span>
                                )}
                                <Link href="/profile" className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                                        {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium text-slate-300 max-w-[100px] truncate">{user.name || user.email}</span>
                                </Link>
                                <button
                                    onClick={logout}
                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                    title="Çıkış Yap"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Link
                                    href="/?auth=login"
                                    className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                                >
                                    Giriş Yap
                                </Link>
                                <Link
                                    href="/?auth=register"
                                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all"
                                >
                                    Ücretsiz Başla
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
