'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

export default function Navigation() {
    const pathname = usePathname();
    const { isLoggedIn, user, subscription, logout } = useAuth();

    // Admin whitelist
    const ADMIN_EMAILS = [
        'admin@maliyet724.com', 'info@maliyet724.com', 'sigorta.mucahitdunder@gmail.com',
        'admin@ihalerobotum.com', 'info@ihalerobotum.com' // Legacy support
    ];
    const isAdmin = isLoggedIn && user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

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
        tabs.push({ name: 'Paket Yönetimi', path: '/admin/plans' });
        tabs.push({ name: 'Kullanıcılar', path: '/admin/users' });
    }

    return (
        <nav className="fixed top-0 w-full z-50 border-b border-slate-800/50 bg-slate-900/95 backdrop-blur-xl transition-all duration-300 shadow-2xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-20 items-center">
                    <div className="flex items-center gap-12">
                        {/* Logo Area */}
                        <Link href="/" className="flex items-center gap-4 group">
                            <div className="relative">
                                <div className="absolute -inset-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl blur-lg opacity-0 group-hover:opacity-30 transition-opacity duration-500"></div>
                                <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-950 border border-slate-800/50 group-hover:border-indigo-500/50 transition-all duration-500 relative overflow-hidden shadow-2xl">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent"></div>
                                    <svg className="w-7 h-7 text-indigo-400 relative z-10 group-hover:scale-110 transition-transform duration-500 animate-brand-glow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 3v18h18" />
                                        <path d="M18 17l-5-5-3 3-5-5" />
                                    </svg>
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-2xl font-black tracking-tight text-white">
                                    Maliyet<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">724</span>
                                </span>
                            </div>
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden lg:flex items-center space-x-4 ml-8">
                            {tabs.map((tab) => {
                                const isActive = pathname === tab.path || (tab.path !== '/' && pathname?.startsWith(tab.path));
                                return (
                                    <Link
                                        key={tab.path}
                                        href={tab.path}
                                        className={`px-4 py-2 text-[13px] font-extrabold transition-all duration-300 relative group/nav uppercase tracking-wider ${isActive
                                            ? 'text-white'
                                            : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        <span className="relative z-10">{tab.name}</span>
                                        {isActive && (
                                            <motion.div
                                                layoutId="nav-underline"
                                                className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full"
                                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                            />
                                        )}
                                        <div className={`absolute bottom-0 left-4 right-4 h-0.5 bg-white/10 rounded-full transition-transform duration-300 origin-left scale-x-0 group-hover/nav:scale-x-100 ${isActive ? 'hidden' : ''}`} />
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-6">
                        {isLoggedIn && user ? (
                            <div className="flex items-center gap-5">
                                <Link href="/profile" className="hidden md:flex items-center gap-3.5 px-3.5 py-1.5 rounded-xl hover:bg-white/5 transition-all group border border-transparent hover:border-slate-800">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-[12px] font-bold text-white shadow-lg">
                                        {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-300 group-hover:text-white max-w-[140px] truncate leading-none mb-0.5">{user.name || user.email}</span>
                                        {subscription && (
                                            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400 opacity-80 group-hover:opacity-100 flex items-center gap-1.5">
                                                <div className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse"></div>
                                                {subscription.planName || 'deneme sürümü'}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                                <button
                                    onClick={logout}
                                    className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                                    title="Çıkış Yap"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-6">
                                <Link
                                    href="/?auth=login"
                                    className="text-[14px] font-bold text-slate-400 hover:text-white transition-colors"
                                >
                                    Giriş Yap
                                </Link>
                                <Link
                                    href="/?auth=register"
                                    className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-[14px] font-black hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 transition-all hover:-translate-y-0.5"
                                >
                                    Hemen Başla
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
