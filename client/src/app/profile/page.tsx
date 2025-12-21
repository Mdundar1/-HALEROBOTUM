'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User,
    Mail,
    Phone,
    Building2,
    Calendar,
    ShieldCheck,
    ChevronRight,
    Save,
    Loader2,
    Crown,
    CheckCircle2,
    AlertCircle,
    ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
    const { user: authUser, isLoggedIn, checkAuth, subscription: authSub } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profileData, setProfileData] = useState<any>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Form states - Initialize with authUser if available
    const [name, setName] = useState(authUser?.name || '');
    const [email, setEmail] = useState(authUser?.email || '');
    const [phone, setPhone] = useState('');
    const [company, setCompany] = useState('');

    useEffect(() => {
        if (!isLoggedIn) {
            router.push('/?auth=login');
            return;
        }
        fetchProfile();
    }, [isLoggedIn]);

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/user/profile', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setProfileData(res.data);
            // Only update if data exists, otherwise keep authUser defaults
            if (res.data.user) {
                setName(res.data.user.name || authUser?.name || '');
                setEmail(res.data.user.email || authUser?.email || '');
                setPhone(res.data.user.phone || '');
                setCompany(res.data.user.company || '');
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching profile:', error);
            setLoading(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const token = localStorage.getItem('token');
            // Backend PUT /api/user/profile now protects name
            await axios.put('/api/user/profile',
                { email, phone, company },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setMessage({ type: 'success', text: 'Profiliniz başarıyla güncellendi.' });
            await checkAuth(); // Refresh global auth state
            fetchProfile(); // Refresh local data

            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Güncelleme sırasında bir hata oluştu.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 pt-24 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-slate-500 font-bold animate-pulse">Profiliniz Hazırlanıyor...</p>
            </div>
        );
    }

    // Use profileData subscription or fallback to authSub
    const subscription = profileData?.subscription || authSub;
    const hasActiveSub = subscription?.hasActiveSubscription;

    return (
        <div className="min-h-screen bg-[#f8fafc] pt-28 pb-20 overflow-x-hidden">
            {/* Background Decorative Elements */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-100/30 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-blue-100/20 rounded-full blur-[120px]"></div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Welcome Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6"
                >
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-widest border border-indigo-100 mb-2">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Güvenli Hesap Alanı
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight lowercase">
                            Hoşgeldiniz, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 animate-brand-glow italic">{name.split(' ')[0] || 'Kullanıcı'}</span>
                        </h1>
                        <p className="text-slate-500 font-medium text-lg">Hesap ayarlarınızı ve abonelik detaylarınızı buradan yönetebilirsiniz.</p>
                    </div>
                </motion.div>

                <div className="grid lg:grid-cols-3 gap-10 items-start">

                    {/* Left Column: Subscription & Quick Stats */}
                    <div className="lg:col-span-1 space-y-8">

                        {/* Status Card */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden group"
                        >
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-all duration-700">
                                <Crown className="w-32 h-32 rotate-12" />
                            </div>

                            <div className="relative z-10">
                                <div className="text-indigo-400 font-black text-[10px] tracking-[0.3em] uppercase mb-6">ABONELİK DURUMU</div>

                                <div className="flex items-center gap-4 mb-8">
                                    <div className={`p-4 rounded-3xl ${hasActiveSub ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                        <Crown className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-black tracking-tight">{subscription?.planName || 'Ücretsiz Plan'}</div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mt-1">
                                            <div className={`w-2 h-2 rounded-full ${hasActiveSub ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-500'}`}></div>
                                            {hasActiveSub ? 'Aktif Üyelik' : 'Kısıtlı Erişim'}
                                        </div>
                                    </div>
                                </div>

                                {hasActiveSub ? (
                                    <div className="space-y-4 py-6 border-t border-white/10">
                                        {subscription.startsAt && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Başlangıç</span>
                                                <span className="font-mono font-bold text-slate-200">{new Date(subscription.startsAt).toLocaleDateString('tr-TR')}</span>
                                            </div>
                                        )}
                                        {subscription.endsAt && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Bitiş Tarihi</span>
                                                <span className="font-mono font-bold text-indigo-400">{new Date(subscription.endsAt).toLocaleDateString('tr-TR')}</span>
                                            </div>
                                        )}

                                        <Link href="/pricing" className="mt-6 flex w-full items-center justify-center gap-3 bg-white/10 hover:bg-white text-white hover:text-slate-900 py-4 rounded-[1.5rem] font-black text-sm transition-all border border-white/10 group/btn">
                                            Üyelik Paketini Yönet
                                            <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="pt-6 border-t border-white/10">
                                        <p className="text-xs text-slate-400 leading-relaxed mb-6">Analiz özelliklerini sınırsız kullanmak için abonelik paketi satın alın.</p>
                                        <Link href="/#pricing" className="flex w-full items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-[1.5rem] font-black text-sm transition-all shadow-xl shadow-indigo-900/50">
                                            Paketleri İncele
                                            <ArrowRight className="w-4 h-4" />
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        {/* Security Badge */}
                        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-xs font-black text-slate-900 uppercase tracking-tight">KVKK Uyumluluğu</div>
                                <p className="text-[10px] text-slate-500 font-bold">Verileriniz uçtan uca şifrelenmektedir.</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Form */}
                    <div className="lg:col-span-2 space-y-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 p-10 relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600"></div>

                            <div className="flex items-center justify-between mb-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl border border-slate-100">
                                        <User className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Kişisel Bilgiler</h3>
                                </div>
                                <AnimatePresence>
                                    {message && (
                                        <motion.div
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black
                                                ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}
                                            `}
                                        >
                                            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                            {message.text}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <form onSubmit={handleUpdate} className="space-y-10">
                                <div className="grid md:grid-cols-2 gap-8 text-left">
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                                            <User className="w-3.5 h-3.5" />
                                            Ad Soyad
                                        </label>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                value={name}
                                                readOnly
                                                className="w-full bg-slate-100 border border-slate-200 rounded-[1.5rem] px-6 py-5 font-bold text-slate-500 outline-none cursor-not-allowed shadow-inner"
                                                placeholder="Ad Soyad"
                                            />
                                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400">
                                                <ShieldCheck className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                                            <Mail className="w-3.5 h-3.5" />
                                            E-posta Adresi
                                        </label>
                                        <div className="relative group">
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] px-6 py-5 font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner group-hover:border-slate-200"
                                                placeholder="E-posta Adresiniz"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                                            <Phone className="w-3.5 h-3.5" />
                                            Telefon Numarası
                                        </label>
                                        <div className="relative group">
                                            <input
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] px-6 py-5 font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner group-hover:border-slate-200"
                                                placeholder="05xx xxx xx xx"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                                            <Building2 className="w-3.5 h-3.5" />
                                            Şirket / Kurum
                                        </label>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                value={company}
                                                onChange={(e) => setCompany(e.target.value)}
                                                className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] px-6 py-5 font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner group-hover:border-slate-200"
                                                placeholder="Şirket isminiz"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-6">
                                    <div className="hidden sm:block">
                                        <div className="text-xs font-bold text-slate-400 flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-indigo-600" />
                                            Son Güncelleme: <span className="text-slate-600">{new Date().toLocaleDateString('tr-TR')}</span>
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="btn-primary px-10 py-5 rounded-[1.5rem] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-xl shadow-indigo-900/10 group active:scale-95"
                                    >
                                        {saving ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        )}
                                        <span className="font-black tracking-tight text-sm">Bilgileri Güncelle</span>
                                    </button>
                                </div>
                            </form>
                        </motion.div>

                        <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] p-8 border border-white/50 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black">?</div>
                                <div>
                                    <h4 className="text-slate-800 font-bold text-sm tracking-tight">Yardıma mı ihtiyacınız var?</h4>
                                    <p className="text-slate-500 text-xs font-medium">Hesap sorunları için destek ekibimize ulaşın.</p>
                                </div>
                            </div>
                            <Link href="/contact" className="px-6 py-3 bg-white text-slate-900 border border-slate-200 rounded-2xl text-xs font-black shadow-sm hover:shadow-md transition-all">
                                Destek Al
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
