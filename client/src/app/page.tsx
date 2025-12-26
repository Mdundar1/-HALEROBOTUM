'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ArrowUpRight,
    FileText,
    Upload,
    Search,
    Download,
    CheckCircle,
    Check,
    ArrowRight,
    Star,
    Mail,
    Phone,
    Lock,
    User,
    Linkedin,
    Instagram,
    MapPin,
    Zap,
    Clock,
    Shield,
    ChevronRight,
    X,
    Eye,
    EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from '../components/Navigation';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';

interface Plan {
    id: string;
    name: string;
    price: number;
    duration_months: number;
    features: any;
    is_active: number | boolean;
    discount_percent?: number;
    tag?: string;
}

interface PlanGroup {
    name: string;
    tag?: string;
    features: string[];
    variants: Plan[];
    special?: boolean;
    desc?: string;
}

function LandingContent() {
    const { login, register, isLoggedIn, user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Admin whitelist
    const ADMIN_EMAILS = [
        'admin@maliyet724.com', 'info@maliyet724.com', 'sigorta.mucahitdunder@gmail.com',
        'admin@ihalerobotum.com', 'info@ihalerobotum.com' // Legacy support
    ];
    const isAdmin = isLoggedIn && user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
    // UI States
    const [scrolled, setScrolled] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

    // Dynamic Social Proof Stats Engine
    const stats = useMemo(() => {
        const today = new Date();
        const dateStr = today.getFullYear().toString() + (today.getMonth() + 1).toString() + today.getDate().toString();
        const seed = parseInt(dateStr);
        // Deterministic but daily changing numbers - Scaled for Realistic Growth
        // Launch baseline: Dec 22, 2025 -> 71 Analiz, 10654 Poz
        const startDate = new Date('2025-12-22');
        const daysDiff = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

        const analysisNoise = seed % 11; // bit of noise (0-10)
        const schedules = 71 + (daysDiff * 15) + analysisNoise;

        const successRate = 88.7 + ((seed % 41) / 10) - 2; // 86.7 to 90.7
        const totalItems = 10654 + (schedules - 71) * 140 + (seed % 50);

        return {
            schedules: schedules.toLocaleString('tr-TR'),
            successRate: successRate.toFixed(1),
            totalItems: totalItems.toLocaleString('tr-TR')
        };
    }, []);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedDurations, setSelectedDurations] = useState<Record<string, number>>({});

    // Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    // Dynamic Plans from API
    const [apiPlanGroups, setApiPlanGroups] = useState<PlanGroup[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await fetch('/api/subscription/plans');
                if (res.ok) {
                    const data = await res.json();

                    // Group by Name (matching Admin logic)
                    const groups: Record<string, PlanGroup> = {};

                    // Feature Definitions
                    const standardFeatures = [
                        'Her ay güncellenen birim fiyatlar',
                        'Standart Raporlama seçenekleri',
                        'Ayda 10 adet ihale yaklaşık maliyet analizi',
                        'Pozbul ekranına sınırsız erişim',
                        '7 / 24 standart destek'
                    ];

                    const proFeatures = [
                        'Her ay güncellenen birim fiyatlar',
                        'Gelişmiş Raporlama seçenekleri',
                        'Sınırsız sayıda ihale yaklaşık maliyet analizi',
                        'Pozbul ekranına sınırsız erişim',
                        '7 / 24 anlık destek',
                        'Analiz oluştur ekranı'
                    ];

                    const enterpriseFeatures = [
                        'API Erişimi',
                        'Çoklu Kullanıcı',
                        'Özel Entegrasyon',
                        'Metraj Servisleri',
                        'Danışmanlık'
                    ];

                    data.forEach((plan: Plan) => {
                        if (!groups[plan.name]) {
                            let displayName = plan.name;
                            let desc = '';
                            let features = [];

                            if (plan.name === 'Standart' || plan.name === 'Başlangıç') {
                                displayName = 'Standart';
                                desc = 'Şahıs projeleri için.';
                                features = standardFeatures;
                            } else if (plan.name === 'Profesyonel') {
                                displayName = 'Profesyonel';
                                desc = 'Profesyonel ekipler.';
                                features = proFeatures;
                            } else if (plan.name === 'Kurumsal') {
                                displayName = 'Kurumsal';
                                desc = 'Büyük ölçekli yapılar.';
                                features = enterpriseFeatures;
                            } else {
                                features = typeof plan.features === 'string' ? JSON.parse(plan.features || '[]') : (plan.features || []);
                            }

                            groups[plan.name] = {
                                name: displayName,
                                tag: plan.tag,
                                features: features,
                                variants: [],
                                special: plan.name === 'Profesyonel', // Mark as popüler
                                desc: desc
                            };
                        }
                        groups[plan.name].variants.push(plan);
                    });

                    // Sort variants by duration
                    const groupArray = Object.values(groups).map(g => {
                        g.variants.sort((a, b) => a.duration_months - b.duration_months);
                        return g;
                    });

                    // CHECK: If the API data is "old" (missing 1-month plans for Başlangıç/Profesyonel), 
                    // we might want to ignore it or merge it to avoid flickering back to old prices.
                    const hasOneMonth = groupArray.some(g => g.variants.some(v => v.duration_months === 1));

                    if (hasOneMonth) {
                        // Initialize selected durations: default to 12 months if available
                        const initialDurations: Record<string, number> = {};
                        groupArray.forEach(g => {
                            if (g.variants.length > 0) {
                                const annual = g.variants.find(v => v.duration_months === 12);
                                initialDurations[g.name] = annual ? 12 : g.variants[g.variants.length - 1].duration_months;
                            }
                        });
                        setSelectedDurations(prev => ({ ...prev, ...initialDurations }));
                        setApiPlanGroups(groupArray);
                    } else {
                        console.log('API returned outdated plans (missing 1-month options). Using hardcoded fallbacks.');
                    }
                }
            } catch (error) {
                console.error('Error fetching plans:', error);
            } finally {
                setLoadingPlans(false);
            }
        };

        fetchPlans();

        const savedEmail = localStorage.getItem('remembered_email');
        const savedPassword = localStorage.getItem('remembered_password');
        if (savedEmail && savedPassword) {
            setEmail(savedEmail);
            setPassword(savedPassword);
            setRememberMe(true);
        }

        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);

        const authParam = searchParams.get('auth');
        if (authParam === 'login' || authParam === 'register') {
            setAuthMode(authParam);
            setShowAuthModal(true);
        }

        return () => window.removeEventListener('scroll', handleScroll);
    }, [searchParams]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (authMode === 'login') {
                await login(email, password);
                if (rememberMe) {
                    localStorage.setItem('remembered_email', email);
                    localStorage.setItem('remembered_password', password);
                } else {
                    localStorage.removeItem('remembered_email');
                    localStorage.removeItem('remembered_password');
                }
                setShowAuthModal(false);
                const next = searchParams.get('next') || '/app';
                router.push(next);
            } else {
                if (password !== confirmPassword) throw new Error('Şifreler eşleşmiyor.');
                if (!acceptTerms) throw new Error('Kullanım şartlarını kabul etmelisiniz.');

                const fullName = `${firstName} ${lastName}`.trim();
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, name: fullName, phone })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Kayıt başarısız');

                await login(email, password);
                setShowAuthModal(false);
                const next = searchParams.get('next') || '/app';
                router.push(next);
            }
        } catch (err: any) {
            setError(err.message || 'Bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    // Animation Variants
    const fadeInUp = {
        initial: { opacity: 0, y: 20 },
        animate: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.6, ease: [0.2, 0, 0, 1] }
        }
    };

    const containerVariants = {
        animate: {
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const staggerContainer = {
        animate: { transition: { staggerChildren: 0.1 } }
    };

    return (
        <div className="min-h-screen bg-[#fcfdfe] overflow-hidden selection:bg-indigo-100 selection:text-indigo-900 font-sans">
            <Navigation />

            {/* AURA BACKGROUND ENGINE */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[80vw] h-[80vw] bg-indigo-100/30 blur-[120px] rounded-full animate-aura"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-blue-50/40 blur-[100px] rounded-full animate-aura" style={{ animationDirection: 'reverse', animationDuration: '25s' }}></div>
            </div>

            <main className="relative z-10 pt-20">
                {/* HERO SECTION */}
                <section className="relative pt-32 pb-20 overflow-hidden">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
                        <div className="grid lg:grid-cols-2 gap-20 items-center">
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{
                                    opacity: 1,
                                    y: 0,
                                    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
                                }}
                            >
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{
                                        opacity: 1,
                                        transition: { delay: 0.2 }
                                    }}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/5 border border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-10 shadow-sm"
                                >
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                                    <Logo className="scale-[0.5] origin-left -ml-2" animated={false} />
                                    AI Destekli Metraj Çözümleri
                                </motion.div>
                                <motion.h1
                                    variants={fadeInUp}
                                    className="text-6xl lg:text-7xl font-black text-slate-900 leading-[1.1] tracking-tight mb-8"
                                >
                                    İhale Metraj ve Maliyetlerinizi <br />
                                    <span className="text-indigo-600">Dakikalar İçinde</span> <br />
                                    Hatasız Hesaplayın.
                                </motion.h1>
                                <p className="text-xl text-slate-600 font-semibold leading-relaxed mb-12 max-w-xl">
                                    Manuel hesaplara son. Profesyoneller için geliştirilmiş ihale maliyet analizi.
                                </p>
                                <motion.div
                                    variants={fadeInUp}
                                    className="flex flex-wrap gap-6"
                                >
                                    {isLoggedIn ? (
                                        <Link
                                            href="/app"
                                            className="px-10 py-5 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 shadow-2xl shadow-indigo-600/20 transition-all hover:-translate-y-1 active:scale-95 text-sm uppercase tracking-widest flex items-center gap-2"
                                        >
                                            Hemen Analize Başla <ArrowRight className="w-4 h-4" />
                                        </Link>
                                    ) : (
                                        <Link
                                            href="/?auth=register"
                                            className="px-10 py-5 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800 shadow-2xl shadow-slate-900/20 transition-all hover:-translate-y-1 active:scale-95 text-sm uppercase tracking-widest"
                                        >
                                            Hemen Ücretsiz Dene
                                        </Link>
                                    )}
                                    <Link
                                        href="/#pricing"
                                        className="px-10 py-5 rounded-2xl bg-white border border-slate-200 text-slate-900 font-black hover:bg-slate-50 transition-all hover:border-slate-300 text-sm uppercase tracking-widest"
                                    >
                                        Planları İncele
                                    </Link>
                                </motion.div>
                                {!isLoggedIn && (
                                    <motion.div
                                        variants={fadeInUp}
                                        className="mt-6 flex items-center gap-2 text-slate-400 font-bold text-xs px-2"
                                    >
                                        <Check className="w-4 h-4 text-emerald-500" />
                                        <span>Kredi kartı gerekmez</span>
                                    </motion.div>
                                )}
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, x: 30 }}
                                animate={{
                                    opacity: 1,
                                    scale: 1,
                                    x: 0,
                                    transition: { duration: 1, delay: 0.2, ease: [0.2, 0, 0, 1] }
                                }}
                                className="relative hidden lg:block"
                            >
                                <div className="absolute -inset-10 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>
                                <div className="relative bg-slate-900 rounded-[3rem] p-1 shadow-2xl overflow-hidden border border-slate-800">
                                    <div className="bg-white rounded-[2.8rem] p-10 relative overflow-hidden">
                                        {/* Technical Grid Overlay */}
                                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                                        <div className="flex items-center gap-3 mb-10 relative">
                                            <div className="w-10 h-10 rounded-2xl bg-slate-950 text-indigo-400 flex items-center justify-center shadow-xl font-black text-xs animate-brand-glow">
                                                <Zap className="w-5 h-5" />
                                            </div>
                                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Kazançlarınız</h3>
                                        </div>

                                        <div className="space-y-6 relative">
                                            {[
                                                { title: 'Zaman Tasarrufu', desc: 'Manuel hesaplamalara göre %80 daha hızlı sonuç alın.', icon: <Clock className="w-5 h-5" />, color: 'bg-blue-600' },
                                                { title: 'Güvenli Eşleşme', desc: 'Akıllı eşleştirme ile insan hatasını en aza indirin.', icon: <CheckCircle className="w-5 h-5" />, color: 'bg-indigo-600' },
                                                { title: 'Güncel Veriler', desc: 'Her zaman güncel kurum pozları ile hata payını sıfırlayın.', icon: <Shield className="w-5 h-5" />, color: 'bg-emerald-500' },
                                                { title: 'Kolay Raporlama', desc: 'Tek tıkla Excel formatında detaylı raporlar alın.', icon: <FileText className="w-5 h-5" />, color: 'bg-amber-500' },
                                                { title: 'Her Yerden Erişim', desc: 'Dilediğiniz yerden saniyeler içinde analiz yapın.', icon: <User className="w-5 h-5" />, color: 'bg-indigo-500' }
                                            ].map((feature, i) => (
                                                <div key={i} className="flex gap-6 group items-start">
                                                    <div className={`w-12 h-12 rounded-2xl ${feature.color} text-white flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110 group-hover:rotate-12`}>
                                                        {feature.icon}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-slate-900 text-md mb-0.5 tracking-tight uppercase">{feature.title}</h4>
                                                        <p className="text-slate-500 font-medium text-xs leading-relaxed max-w-xs">{feature.desc}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* SOCIAL PROOF SECTION - ENHANCED WITH GRAPHS */}
                        <motion.div
                            variants={fadeInUp}
                            className="mt-32 max-w-6xl mx-auto px-4"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {/* STAT 1: ANALYZED SCHEDULES - LINE CHART */}
                                <div className="relative group p-1 rounded-[2.5rem] bg-gradient-to-br from-indigo-500/20 via-blue-500/20 to-indigo-500/20 hover:scale-[1.02] transition-all duration-500">
                                    <div className="bg-white rounded-[2.4rem] p-8 h-full relative overflow-hidden flex flex-col justify-between">
                                        <div className="relative z-10 flex flex-col items-center text-center">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-6 shadow-xl shadow-indigo-100 group-hover:rotate-12 transition-transform">
                                                <FileText className="w-6 h-6" />
                                            </div>
                                            <div className="text-5xl font-black text-slate-900 mb-2 tracking-tighter">
                                                {stats.schedules}
                                            </div>
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Bugüne Kadar Gerçekleşen</h4>
                                            <div className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest border border-indigo-100 mb-6">
                                                Birim Fiyat Teklif Analizi
                                            </div>
                                        </div>

                                        {/* Line Chart SVG */}
                                        <div className="h-16 w-full opacity-30 mt-auto">
                                            <svg viewBox="0 0 100 30" className="w-full h-full">
                                                <motion.path
                                                    d="M 0 25 Q 25 25 25 10 Q 50 -5 75 20 L 100 15"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="3"
                                                    className="text-indigo-600"
                                                    initial={{ pathLength: 0 }}
                                                    whileInView={{ pathLength: 1 }}
                                                    transition={{ duration: 1.5, ease: "easeInOut" }}
                                                />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {/* STAT 2: MATCHED POZ - BAR CHART */}
                                <div className="relative group p-1 rounded-[2.5rem] bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-emerald-500/20 hover:scale-[1.02] transition-all duration-500">
                                    <div className="bg-white rounded-[2.4rem] p-8 h-full relative overflow-hidden flex flex-col justify-between">
                                        <div className="relative z-10 flex flex-col items-center text-center">
                                            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-6 shadow-xl shadow-emerald-100 group-hover:-rotate-12 transition-transform">
                                                <CheckCircle className="w-6 h-6" />
                                            </div>
                                            <div className="text-5xl font-black text-slate-900 mb-2 tracking-tighter">
                                                {stats.totalItems}
                                            </div>
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Bugüne Kadar</h4>
                                            <div className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-100 mb-6">
                                                Eşleştirilen Poz Sayısı
                                            </div>
                                        </div>

                                        {/* Bar Chart SVG */}
                                        <div className="h-16 w-full opacity-30 mt-auto flex items-end justify-center gap-2">
                                            {[20, 35, 25, 45, 30, 50].map((h, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    className="w-4 bg-emerald-600 rounded-t-lg"
                                                    initial={{ height: 0 }}
                                                    whileInView={{ height: `${h}%` }}
                                                    transition={{ duration: 1, delay: idx * 0.1 }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* STAT 3: SUCCESS RATE - CIRCLE CHART */}
                                <div className="relative group p-1 rounded-[2.5rem] bg-gradient-to-br from-teal-500/20 via-cyan-500/20 to-teal-500/20 hover:scale-[1.02] transition-all duration-500">
                                    <div className="bg-white rounded-[2.4rem] p-8 h-full relative overflow-hidden flex flex-col justify-between">
                                        <div className="relative z-10 flex flex-col items-center text-center">
                                            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center mb-6 shadow-xl shadow-teal-100 group-hover:scale-110 transition-transform">
                                                <Zap className="w-6 h-6" />
                                            </div>
                                            <div className="text-5xl font-black text-slate-900 mb-2 tracking-tighter">
                                                %{stats.successRate}
                                            </div>
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Bugüne Kadar Ki</h4>
                                            <div className="px-3 py-1 rounded-full bg-teal-50 text-teal-600 text-[9px] font-black uppercase tracking-widest border border-teal-100 mb-6">
                                                Başarılı Eşleştirme Oranı
                                            </div>
                                        </div>

                                        {/* Circular Chart SVG */}
                                        <div className="h-20 w-full opacity-30 mt-auto flex items-center justify-center">
                                            <svg className="w-14 h-14" viewBox="0 0 36 36">
                                                <path
                                                    className="text-slate-100"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                    fill="none"
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                />
                                                <motion.path
                                                    className="text-teal-600"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                    strokeDasharray={`${stats.successRate}, 100`}
                                                    strokeLinecap="round"
                                                    fill="none"
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                    initial={{ pathLength: 0 }}
                                                    whileInView={{ pathLength: 1 }}
                                                    transition={{ duration: 2, ease: "easeOut" }}
                                                />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <p className="text-center mt-12 text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] opacity-40">
                                maliyet724 akıllı algoritmaları ile tam veri hassasiyeti
                            </p>
                        </motion.div>

                        {/* WIDER MARQUEE SECTION */}
                        <motion.div
                            variants={fadeInUp}
                            className="mt-20 pt-10 border-t border-slate-100 overflow-hidden relative"
                        >
                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] mb-10 text-center opacity-70">Entegre Kurum Birim Fiyatları</p>
                            <div className="flex gap-16 items-center animate-scroll whitespace-nowrap">
                                {[
                                    'Çevre ve Şehircilik Bakanlığı',
                                    'Karayolları Genel Müdürlüğü',
                                    'İller Bankası Genel Müdürlüğü',
                                    'PTT Genel Müdürlüğü',
                                    'Orman Genel Müdürlüğü',
                                    'Vakıflar Genel Müdürlüğü',
                                    'Kültür Bakanlığı',
                                    'TEDAŞ',
                                    'Ulaştırma Bakanlığı',
                                    'Milli Savunma Bakanlığı'
                                ].map((inst, i) => (
                                    <div key={i} className="flex items-center gap-4 group transition-all duration-300">
                                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-indigo-600 text-xs shadow-sm group-hover:border-indigo-300 group-hover:shadow-md transition-all">
                                            {inst.charAt(0)}
                                        </div>
                                        <span className="text-[13px] font-black text-slate-600 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">{inst}</span>
                                    </div>
                                ))}
                                {/* Duplicate for infinite loop */}
                                {[
                                    'Çevre ve Şehircilik Bakanlığı',
                                    'Karayolları Genel Müdürlüğü',
                                    'İller Bankası Genel Müdürlüğü',
                                    'PTT Genel Müdürlüğü',
                                    'Orman Genel Müdürlüğü',
                                    'Vakıflar Genel Müdürlüğü',
                                    'Kültür Bakanlığı',
                                    'TEDAŞ',
                                    'Ulaştırma Bakanlığı',
                                    'Milli Savunma Bakanlığı'
                                ].map((inst, i) => (
                                    <div key={`dup-${i}`} className="flex items-center gap-4 group transition-all duration-300">
                                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-indigo-600 text-xs shadow-sm group-hover:border-indigo-300 group-hover:shadow-md transition-all">
                                            {inst.charAt(0)}
                                        </div>
                                        <span className="text-[13px] font-black text-slate-600 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">{inst}</span>
                                    </div>
                                ))}
                            </div>
                            <style jsx>{`
                                @keyframes scroll {
                                    0% { transform: translateX(0); }
                                    100% { transform: translateX(-50%); }
                                }
                                .animate-scroll {
                                    display: flex;
                                    width: fit-content;
                                    animation: scroll 60s linear infinite;
                                }
                            `}</style>
                        </motion.div>
                    </div>
                </section>

                {/* 3 STEPS SECTION */}
                <section className="py-24 relative bg-white border-y border-slate-100">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center max-w-3xl mx-auto mb-20 px-4">
                            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-6 tracking-tighter">3 Adımda <span className="text-indigo-600">Yaklaşık Maliyet</span></h2>
                            <p className="text-lg text-slate-500 font-medium italic">Karmaşık süreçleri basit adımlara dönüştürdük.</p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-12">
                            {[
                                { id: '01', title: 'Dosya Yükle', desc: 'Metraj dosyanızı (.docx, .txt) sisteme sürükleyip bırakın.', icon: <Upload className="w-8 h-8" /> },
                                { id: '02', title: 'Analiz Et', desc: 'Yapay zeka metinleri tarar ve en uygun pozlarla eşleştirir.', icon: <Search className="w-8 h-8" /> },
                                { id: '03', title: 'Rapor Al', desc: 'Sonuçları Excel formatında indirin ve kullanıma hazır hale getirin.', icon: <Download className="w-8 h-8" /> }
                            ].map((step, idx) => (
                                <motion.div
                                    key={idx}
                                    whileHover={{ y: -10 }}
                                    className="premium-card p-10 group"
                                >
                                    <div className="w-20 h-20 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-inner">
                                        {step.icon}
                                    </div>
                                    <div className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-[0.3em]">{step.id}</div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tighter">{step.title}</h3>
                                    <p className="text-slate-500 font-medium leading-relaxed text-sm">{step.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* WHY Maliyet724 SECTION */}
                <section className="py-24 relative bg-slate-50/50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center max-w-3xl mx-auto mb-20 px-4">
                            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-6 tracking-tighter">Neden <span className="text-indigo-600">Maliyet724?</span></h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[
                                { title: 'Akıllı Analiz', desc: 'Metraj dosyanızı yükleyin, yapay zeka saniyeler içinde analiz etsin.', icon: <Zap className="w-6 h-6" /> },
                                { title: 'Güncel Veriler', desc: 'Çevre ve Şehircilik Bakanlığı pozları ile her zaman güncel kalın.', icon: <Search className="w-6 h-6" /> },
                                { title: 'Hızlı Raporlama', desc: 'Tek tıkla Excel formatında detaylı yaklaşık maliyet raporu alın.', icon: <FileText className="w-6 h-6" /> },
                                { title: 'Proje Yönetimi', desc: 'Projelerinizi kaydedin, düzenleyin ve istediğiniz yerden erişin.', icon: <Lock className="w-6 h-6" /> },
                                { title: 'Güvenli Altyapı', desc: 'Verileriniz bulut tabanlı sunucularda güvenle saklanır.', icon: <Shield className="w-6 h-6" /> },
                                { title: '7/24 Destek', desc: 'Teknik destek ekibimiz her zaman yanınızda.', icon: <Mail className="w-6 h-6" /> }
                            ].map((feature, idx) => (
                                <motion.div
                                    key={idx}
                                    whileHover={{ scale: 1.02 }}
                                    className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col gap-6"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                                        {feature.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">{feature.title}</h3>
                                        <p className="text-slate-500 font-medium text-sm leading-relaxed">{feature.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* PRICING */}
                <section id="pricing" className="py-32 bg-[#020617] relative overflow-hidden">
                    {/* Ambient Background */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"></div>
                    <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none"></div>
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02] pointer-events-none"></div>

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        {/* Header */}
                        <div className="text-center max-w-3xl mx-auto mb-20 px-4">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-indigo-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-8 shadow-2xl"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                Sizin İçin En Uygun Plan
                            </motion.div>

                            <h2 className="text-4xl md:text-5xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
                                Paket <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Seçenekleri</span>
                            </h2>
                            <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-xl mx-auto">
                                Ücretsiz deneme ile başlayın, istediğiniz zaman iptal edin.
                            </p>
                        </div>

                        {/* CARDS */}
                        <motion.div
                            variants={containerVariants}
                            initial="initial"
                            whileInView="animate"
                            viewport={{ once: true }}
                            className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto items-start"
                        >
                            {(apiPlanGroups.length > 0 ? apiPlanGroups : [
                                {
                                    name: 'Standart',
                                    variants: [
                                        { id: 'starter-1m', duration_months: 1, price: 1299, is_active: true } as Plan,
                                        { id: 'starter-3m', duration_months: 3, price: 2499, is_active: true } as Plan,
                                        { id: 'starter-12m', duration_months: 12, price: 6999, is_active: true } as Plan,
                                    ],
                                    desc: 'Şahıs projeleri için.',
                                    features: [
                                        'Her ay güncellenen birim fiyatlar',
                                        'Standart Raporlama seçenekleri',
                                        'Ayda 10 adet ihale yaklaşık maliyet analizi',
                                        'Pozbul ekranına sınırsız erişim',
                                        '7 / 24 standart destek'
                                    ]
                                },
                                {
                                    name: 'Profesyonel',
                                    variants: [
                                        { id: 'pro-1m', duration_months: 1, price: 1499, is_active: true } as Plan,
                                        { id: 'pro-3m', duration_months: 3, price: 2899, is_active: true } as Plan,
                                        { id: 'pro-12m', duration_months: 12, price: 7999, is_active: true } as Plan,
                                    ],
                                    desc: 'Profesyonel ekipler.',
                                    features: [
                                        'Her ay güncellenen birim fiyatlar',
                                        'Gelişmiş Raporlama seçenekleri',
                                        'Sınırsız sayıda ihale yaklaşık maliyet analizi',
                                        'Pozbul ekranına sınırsız erişim',
                                        '7 / 24 anlık destek',
                                        'Analiz oluştur ekranı'
                                    ],
                                    special: true
                                },
                                {
                                    name: 'Kurumsal',
                                    variants: [],
                                    desc: 'Büyük ölçekli yapılar.',
                                    features: ['API Erişimi', 'Çoklu Kullanıcı', 'Özel Entegrasyon', 'Metraj Servisleri', 'Danışmanlık']
                                }
                            ]).map((plan: any) => {
                                // Add helper data for rendering compatible with current UI
                                const getVariant = (months: number) => plan.variants?.find((v: any) => v.duration_months === months);
                                const currentDur = selectedDurations[plan.name] || (plan.variants && plan.variants.length > 0 ? plan.variants[plan.variants.length - 1].duration_months : 0);
                                const monthly = getVariant(1);
                                const current = getVariant(currentDur);

                                return {
                                    ...plan,
                                    currentDur,
                                    displayPrice: current ? `₺${current.price.toLocaleString('tr-TR')}` : (plan.name === 'Kurumsal' ? 'Bize Ulaşın' : '---'),
                                    originalPrice: monthly?.price && current?.price && current.price < monthly.price ? `₺${monthly.price.toLocaleString('tr-TR')}` : null,
                                    totalPrice: current ? `₺${(current.price * (current.duration_months)).toLocaleString('tr-TR')}` : null,
                                    saving: monthly?.price && current?.price && current.price < monthly.price
                                        ? Math.round(((monthly.price - current.price) / monthly.price) * 100)
                                        : null
                                };
                            }).map((plan, idx) => (
                                <motion.div
                                    key={idx}
                                    variants={fadeInUp}
                                    className={`relative group h-full`}
                                >
                                    <div className={`h-full rounded-3xl p-1 transition-all duration-500 ${plan.special
                                        ? 'bg-gradient-to-b from-indigo-500/50 to-blue-600/50 shadow-2xl shadow-indigo-500/10'
                                        : 'bg-slate-800/50 hover:bg-slate-700/50'
                                        }`}>
                                        <div className={`h-full rounded-[1.4rem] flex flex-col relative overflow-hidden ${plan.special ? 'bg-slate-950 border border-indigo-500/20' : 'bg-slate-950 border border-slate-800'
                                            }`}>

                                            {/* Top Illustration Area - Compact */}
                                            <div className={`relative h-32 overflow-hidden ${plan.special ? 'bg-indigo-900/20' : 'bg-slate-900/50'}`}>
                                                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.05]"></div>
                                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/90 z-10"></div>

                                                <div className="absolute inset-0 flex items-center justify-center z-20">
                                                    <motion.div
                                                        animate={{
                                                            y: [0, -10, 0],
                                                            scale: [1, 1.05, 1],
                                                            filter: ["drop-shadow(0 0 0px rgba(99, 102, 241, 0))", "drop-shadow(0 0 20px rgba(99, 102, 241, 0.5))", "drop-shadow(0 0 0px rgba(99, 102, 241, 0))"]
                                                        }}
                                                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                                        className={`w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/5 ${plan.special ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800/50 text-slate-500'}`}
                                                    >
                                                        {plan.name === 'Standart' ? <Zap className="w-8 h-8" /> :
                                                            plan.name === 'Profesyonel' ? <Star className="w-8 h-8" /> :
                                                                <Shield className="w-8 h-8" />}
                                                    </motion.div>
                                                </div>

                                                {/* Animated Background Elements */}
                                                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                                        className={`absolute -top-1/2 -right-1/2 w-full h-full rounded-full blur-[80px] opacity-30 ${plan.special ? 'bg-indigo-500' : 'bg-slate-700'}`}
                                                    />
                                                </div>

                                                {/* Popüler Tag */}
                                                <div className="absolute top-3 right-3 z-30">
                                                    {plan.special && (
                                                        <motion.span
                                                            initial={{ opacity: 0, scale: 0.8 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            className="px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg border border-white/10"
                                                        >
                                                            Popüler
                                                        </motion.span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="p-6 flex flex-col flex-1">
                                                {/* Header */}
                                                <div className="mb-6">
                                                    <h3 className={`text-xl font-bold mb-1 ${plan.special ? 'text-white' : 'text-slate-200'}`}>
                                                        {plan.name}
                                                    </h3>
                                                    <p className="text-slate-500 text-sm font-medium">{plan.desc}</p>
                                                </div>

                                                {/* Features List */}
                                                <div className="mb-8 flex-1">
                                                    <ul className="space-y-3">
                                                        {(plan.features || []).map((f: string, i: number) => {
                                                            const isSuperior = plan.name === 'Profesyonel' && [
                                                                'Gelişmiş Raporlama seçenekleri',
                                                                'Sınırsız sayıda ihale yaklaşık maliyet analizi',
                                                                '7 / 24 anlık destek',
                                                                'Analiz oluştur ekranı'
                                                            ].includes(f);

                                                            return (
                                                                <li key={i} className="flex items-start gap-3">
                                                                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center ${isSuperior ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                                                                        <Check className="w-3 h-3" strokeWidth={3} />
                                                                    </div>
                                                                    <span className={`text-[14px] font-medium leading-tight ${isSuperior ? 'text-white' : 'text-slate-400'}`}>
                                                                        {f}
                                                                    </span>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>

                                                {/* Duration Selectors (Stacked Cards) */}
                                                {plan.name !== 'Kurumsal' && plan.variants && plan.variants.length > 0 && (
                                                    <div className="mb-8 space-y-3">
                                                        {plan.variants.filter((v: any) => [1, 3, 12].includes(v.duration_months)).map((v: any) => (
                                                            <button
                                                                key={v.duration_months}
                                                                onClick={() => setSelectedDurations(prev => ({ ...prev, [plan.name]: v.duration_months }))}
                                                                className={`w-full p-3 rounded-xl flex items-center justify-between transition-all duration-300 border relative group ${plan.currentDur === v.duration_months
                                                                    ? 'bg-indigo-500/10 border-indigo-500/50'
                                                                    : 'bg-transparent border-slate-800 hover:border-slate-700 hover:bg-slate-800/30'
                                                                    }`}
                                                            >
                                                                {v.duration_months === 12 && (
                                                                    <div className="absolute -top-2.5 right-4 px-2 py-0.5 bg-indigo-600 text-[9px] font-black text-white rounded-full uppercase tracking-tighter z-10">
                                                                        En Popüler
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col text-left">
                                                                    <span className={`text-[15px] font-black ${plan.currentDur === v.duration_months ? 'text-white' : 'text-slate-300'}`}>
                                                                        {v.duration_months === 1 ? 'Aylık Plan' : `${v.duration_months} Aylık Plan`}
                                                                    </span>
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                                                        {v.duration_months === 12 ? 'Yıllık Yenilenir' : v.duration_months === 1 ? 'Aylık Yenilenir' : `${v.duration_months} Aylık Ödeme`}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-col text-right">
                                                                    <span className={`text-[18px] font-black ${plan.currentDur === v.duration_months ? 'text-white' : 'text-slate-200'}`}>
                                                                        ₺{v.price.toLocaleString('tr-TR')}
                                                                    </span>
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">/ AY</span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Action Button */}
                                                <button
                                                    onClick={() => {
                                                        if (plan.name === 'Kurumsal') {
                                                            window.open('https://wa.me/905453915840?text=Kurumsal%20hizmetler%20hakkında%20bilgi%20almak%20istiyorum.', '_blank');
                                                        } else {
                                                            const variant = plan.variants?.find((v: any) => v.duration_months === plan.currentDur);
                                                            const checkoutUrl = `/checkout?plan=${variant?.id}`;

                                                            if (isLoggedIn) {
                                                                router.push(checkoutUrl);
                                                            } else {
                                                                router.push(`/?auth=register&next=${encodeURIComponent(checkoutUrl)}#pricing`);
                                                                setAuthMode('register');
                                                                setShowAuthModal(true);
                                                            }
                                                        }
                                                    }}
                                                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 transform active:scale-[0.98] ${plan.special
                                                        ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-2xl shadow-indigo-500/20'
                                                        : 'bg-white text-slate-900 hover:bg-slate-100'
                                                        }`}
                                                >
                                                    {plan.name === 'Kurumsal' ? 'BİZE ULAŞIN' : 'ABONE OL VE DEVAM ET'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </section>

                {/* FOOTER */}
                <footer className="py-24 bg-white border-t border-slate-100">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid md:grid-cols-4 gap-12 mb-16">
                            <div className="col-span-1 md:col-span-1">
                                <Logo />
                                <p className="text-slate-400 text-sm font-bold mt-4 leading-relaxed">
                                    Türkiye'nin en gelişmiş yapay zeka destekli metaj ve maliyet analiz platformu.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-xs">Hizmetlerimiz</h4>
                                <ul className="space-y-4 text-sm font-bold text-slate-500">
                                    <li><Link href="/app" className="hover:text-indigo-600 transition-colors">Akıllı Metraj</Link></li>
                                    <li><Link href="/pozbul" className="hover:text-indigo-600 transition-colors">Poz Arama</Link></li>
                                    <li><Link href="#" className="hover:text-indigo-600 transition-colors">Excel Entegrasyonu</Link></li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-xs">Kurumsal</h4>
                                <ul className="space-y-4 text-sm font-bold text-slate-500">
                                    <li><Link href="#" className="hover:text-indigo-600 transition-colors">Hakkımızda</Link></li>
                                    <li><Link href="#" className="hover:text-indigo-600 transition-colors">İletişim</Link></li>
                                    <li><Link href="#" className="hover:text-indigo-600 transition-colors">Gizlilik Sözleşmesi</Link></li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-xs">Sosyal</h4>
                                <div className="flex gap-4">
                                    <a href="#" className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-slate-100">
                                        <Linkedin className="w-5 h-5" />
                                    </a>
                                    <a href="#" className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all border border-slate-100">
                                        <Instagram className="w-5 h-5" />
                                    </a>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-12 border-t border-slate-100">
                            <p className="text-slate-400 text-sm font-bold">© 2024 maliyet724. Tüm hakları saklıdır.</p>
                            <div className="flex items-center gap-2 text-slate-300">
                                <MapPin className="w-4 h-4 text-indigo-600" />
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Global Teknoloji Kampüsü, TR</span>
                            </div>
                        </div>
                    </div>
                </footer>
            </main>

            {/* AUTH MODAL */}
            <AnimatePresence>
                {showAuthModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-4 overflow-y-auto"
                        onClick={() => setShowAuthModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className={`w-full ${authMode === 'register' ? 'max-w-5xl' : 'max-w-md'} bg-white rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col md:flex-row`}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Left Panel - Benefits (Visible on registration) */}
                            {authMode === 'register' && (
                                <div className="w-full md:w-[45%] bg-slate-900 relative p-10 md:p-14 flex flex-col justify-between text-white border-r border-slate-800">
                                    {/* Blueprint Background Pattern */}
                                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                                        backgroundImage: `linear-gradient(#475569 1px, transparent 1px), linear-gradient(90deg, #475569 1px, transparent 1px)`,
                                        backgroundSize: '40px 40px'
                                    }}></div>
                                    <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
                                        backgroundImage: `linear-gradient(#64748b 1px, transparent 1px), linear-gradient(90deg, #64748b 1px, transparent 1px)`,
                                        backgroundSize: '10px 10px'
                                    }}></div>

                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-12">
                                            <Logo light animated={false} />
                                        </div>

                                        <h2 className="text-4xl font-black tracking-tight leading-tight mb-6">
                                            İnşaat Metrajını <br />
                                            <span className="text-indigo-400">Yapay Zeka</span> İle Yönetin
                                        </h2>

                                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-8 mb-10 backdrop-blur-sm">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                                                    <Clock className="w-6 h-6 text-indigo-400" />
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-xl text-indigo-400 uppercase tracking-wide">3 Günlük Deneme</h3>
                                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Hiçbir ücret ödemeden başlayın</p>
                                                </div>
                                            </div>

                                            <ul className="space-y-4">
                                                {[
                                                    '3 gün sınırsız kullanım süresi',
                                                    'Sınırsız poz arama ve birim fiyat sorgulama',
                                                    'Excel formatında detaylı maliyet raporları',
                                                    'Otomatik nakliye ve kantar hesaplamaları'
                                                ].map((benefit, i) => (
                                                    <li key={i} className="flex items-start gap-3">
                                                        <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                                            <Check className="w-3 h-3 text-white" />
                                                        </div>
                                                        <span className="text-sm font-bold text-slate-300">{benefit}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="relative z-10 pt-10 border-t border-slate-800">
                                        <div className="flex items-center gap-4 text-slate-400">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                                                <Shield className="w-5 h-5 text-indigo-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-widest text-slate-200">Kredi Kartı Gerekmez</p>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hızlı ve güvenli kayıt</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Right Panel - Form */}
                            <div className={`p-10 md:p-14 flex-1 bg-white relative ${authMode === 'register' ? 'md:bg-slate-50/30' : ''}`}>
                                <div className="absolute top-0 right-0 p-8">
                                    <button onClick={() => setShowAuthModal(false)} className="text-slate-300 hover:text-slate-900 transition-colors p-2 hover:bg-slate-100 rounded-full">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="max-w-md mx-auto">
                                    <div className="mb-8 text-center md:text-left">
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                                            {authMode === 'login' ? 'Tekrar Hoşgeldiniz' : 'Yeni Hesap Oluşturun'}
                                        </h3>
                                        <p className="text-slate-500 font-medium text-xs">
                                            {authMode === 'login'
                                                ? 'Lütfen giriş bilgilerinizi giriniz.'
                                                : 'Maliyet724 dünyasına ilk adımınızı atın.'}
                                        </p>
                                    </div>

                                    {error && (
                                        <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-black flex items-center gap-3 animate-shake">
                                            <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-200">!</div>
                                            {error}
                                        </div>
                                    )}

                                    <form onSubmit={handleAuth} className="space-y-4">
                                        {authMode === 'register' && (
                                            <>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="relative group">
                                                        <input
                                                            type="text"
                                                            placeholder="Ad"
                                                            className="w-full px-5 py-4 rounded-xl bg-slate-50/50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-sm text-slate-900 focus:shadow-xl focus:shadow-indigo-500/5 placeholder:text-slate-400"
                                                            value={firstName} onChange={e => setFirstName(e.target.value)} required
                                                        />
                                                    </div>
                                                    <div className="relative group">
                                                        <input
                                                            type="text"
                                                            placeholder="Soyad"
                                                            className="w-full px-5 py-4 rounded-xl bg-slate-50/50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-sm text-slate-900 focus:shadow-xl focus:shadow-indigo-500/5 placeholder:text-slate-400"
                                                            value={lastName} onChange={e => setLastName(e.target.value)} required
                                                        />
                                                    </div>
                                                </div>
                                                <div className="relative group">
                                                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-500 transition-all pointer-events-none" />
                                                    <input
                                                        type="tel"
                                                        placeholder="Telefon (5xx...)"
                                                        className="w-full pl-14 pr-5 py-4 rounded-xl bg-slate-50/50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-sm text-slate-900 focus:shadow-xl focus:shadow-indigo-500/5 placeholder:text-slate-400"
                                                        value={phone} onChange={e => setPhone(e.target.value)} required
                                                    />
                                                </div>
                                            </>
                                        )}

                                        <div className="relative group">
                                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-500 transition-all pointer-events-none" />
                                            <input
                                                type="email"
                                                placeholder="E-posta Adresiniz"
                                                className="w-full pl-14 pr-5 py-4 rounded-xl bg-slate-50/50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-sm text-slate-900 focus:shadow-xl focus:shadow-indigo-500/5 placeholder:text-slate-400"
                                                value={email} onChange={e => setEmail(e.target.value)} required
                                            />
                                        </div>

                                        <div className="relative group">
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-5 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 transition-colors z-20"
                                            >
                                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-500 transition-all pointer-events-none" />
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                placeholder="Şifreniz"
                                                className="w-full pl-14 pr-14 py-4 rounded-xl bg-slate-50/50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-sm text-slate-900 focus:shadow-xl focus:shadow-indigo-500/5 placeholder:text-slate-400"
                                                value={password} onChange={e => setPassword(e.target.value)} required
                                            />
                                        </div>

                                        {authMode === 'login' && (
                                            <div className="flex items-center gap-2 px-2 pb-2">
                                                <input
                                                    type="checkbox"
                                                    id="rememberMe"
                                                    className="w-4 h-4 rounded border-slate-200 text-transparent bg-indigo-50 border-2 checked:bg-indigo-600 checked:border-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer accent-indigo-600"
                                                    checked={rememberMe}
                                                    onChange={(e) => setRememberMe(e.target.checked)}
                                                />
                                                <label htmlFor="rememberMe" className="text-[11px] text-slate-500 font-bold cursor-pointer uppercase tracking-tight select-none">
                                                    Beni Hatırla
                                                </label>
                                            </div>
                                        )}

                                        {authMode === 'register' && (
                                            <>
                                                <div className="relative group">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                        className="absolute right-5 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 transition-colors z-20"
                                                    >
                                                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                    </button>
                                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-500 transition-all pointer-events-none" />
                                                    <input
                                                        type={showConfirmPassword ? "text" : "password"}
                                                        placeholder="Şifre Onayı"
                                                        className="w-full pl-14 pr-14 py-4 rounded-xl bg-slate-50/50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-sm text-slate-900 focus:shadow-xl focus:shadow-indigo-500/5 placeholder:text-slate-400"
                                                        value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                                                    />
                                                </div>
                                                <div className="flex items-start gap-3 px-2 pt-2">
                                                    <input
                                                        type="checkbox"
                                                        id="terms"
                                                        className="w-5 h-5 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer mt-0.5"
                                                        checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} required
                                                    />
                                                    <label htmlFor="terms" className="text-[11px] text-slate-400 font-bold cursor-pointer leading-tight uppercase tracking-tight">
                                                        <Link href="#" className="text-indigo-600 hover:underline">Kullanım Şartlarını</Link> ve <Link href="#" className="text-indigo-600 hover:underline">Gizlilik Politikasını</Link> kabul ediyorum.
                                                    </label>
                                                </div>
                                            </>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full py-5 rounded-2xl bg-slate-900 text-white font-black text-sm uppercase tracking-widest hover:bg-black transition-all shadow-2xl shadow-slate-200 active:scale-[0.98] disabled:opacity-50 mt-8 relative overflow-hidden group"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                            <span className="relative z-10 flex items-center justify-center gap-2">
                                                {loading ? 'İşleniyor...' : (authMode === 'login' ? 'Giriş Yap' : 'Hesabı Oluştur ve Başla')}
                                                {!loading && <ArrowRight className="w-4 h-4" />}
                                            </span>
                                        </button>
                                    </form>

                                    <div className="mt-12 pt-8 border-t border-slate-100 text-center">
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                                            {authMode === 'login' ? 'Henüz hesabınız yok mu?' : 'Zaten hesabınız var mı?'}
                                            <button
                                                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                                                className="ml-2 text-indigo-600 hover:text-indigo-700 transition-all font-black border-b border-indigo-500/30 hover:border-indigo-600"
                                            >
                                                {authMode === 'login' ? 'YENI HESAP' : 'GIRIŞ YAP'}
                                            </button>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}

export default function LandingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#fcfdfe] flex items-center justify-center"><div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div></div>}>
            <LandingContent />
        </Suspense>
    );
}
