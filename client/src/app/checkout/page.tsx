'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Navigation from '../../components/Navigation';
import Link from 'next/link';
import axios from 'axios';

function CheckoutContent() {
    const { user, isLoggedIn } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [step, setStep] = useState(1);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(searchParams.get('plan'));
    const [loading, setLoading] = useState(false);

    // Dynamic Plans State
    const [plans, setPlans] = useState<any[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);

    const [billingInfo, setBillingInfo] = useState({
        companyName: '',
        taxOffice: '',
        taxNumber: '',
        address: ''
    });

    useEffect(() => {
        if (!isLoggedIn) {
            router.push('/?auth=login&next=/checkout');
        }
    }, [isLoggedIn, router]);

    // Fallback Data
    const FALLBACK_PLANS = [
        { id: 'starter-1m', name: 'Standart', price: 1299, duration_months: 1, desc: 'Şahıs projeleri için.' },
        { id: 'starter-3m', name: 'Standart', price: 2499, duration_months: 3, desc: 'Şahıs projeleri için.', discount_percent: 35 },
        { id: 'starter-12m', name: 'Standart', price: 6999, duration_months: 12, desc: 'Şahıs projeleri için.', discount_percent: 55 },
        { id: 'pro-1m', name: 'Profesyonel', price: 1499, duration_months: 1, desc: 'Profesyonel ekipler.', tag: 'Popüler' },
        { id: 'pro-3m', name: 'Profesyonel', price: 2899, duration_months: 3, desc: 'Profesyonel ekipler.', tag: 'Popüler', discount_percent: 35 },
        { id: 'pro-12m', name: 'Profesyonel', price: 7999, duration_months: 12, desc: 'Profesyonel ekipler.', tag: 'Popüler', discount_percent: 55 },
    ];

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await fetch('/api/subscription/plans');
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        // Sort by price
                        const validPlans = data.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
                        setPlans(validPlans);
                    } else {
                        setPlans(FALLBACK_PLANS);
                    }
                } else {
                    setPlans(FALLBACK_PLANS);
                }
            } catch (error) {
                console.error('Error fetching plans:', error);
                setPlans(FALLBACK_PLANS);
            } finally {
                setPlansLoading(false);
            }
        };
        fetchPlans();
    }, []);

    const hasAutoSkipped = useRef(false);

    useEffect(() => {
        if (!hasAutoSkipped.current && selectedPlan && plans.length > 0) {
            const planExists = plans.find(p => p.id === selectedPlan);
            if (planExists) {
                setStep(2);
                hasAutoSkipped.current = true;
            }
        }
    }, [selectedPlan, plans]);

    const selectedPlanData = plans.find(p => p.id === selectedPlan);

    const handlePurchase = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/subscriptions/purchase', {
                planId: selectedPlan,
                companyName: billingInfo.companyName,
                taxOffice: billingInfo.taxOffice,
                taxNumber: billingInfo.taxNumber,
                billingAddress: billingInfo.address
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            router.push('/profile');
        } catch (error) {
            console.error('Purchase failed', error);
            alert('Ödeme işlemi başarısız oldu.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 font-sans">
            <Navigation />

            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 via-transparent to-transparent"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/10 rounded-full blur-[150px]"></div>
            </div>

            <div className="relative z-10 pt-24 pb-16 px-4">
                <div className="max-w-5xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-12">
                        <span className="inline-block px-5 py-2 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30 rounded-full text-blue-400 text-sm font-bold mb-4">
                            💳 ÖDEME
                        </span>
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-3">
                            Abonelik Satın Al
                        </h1>
                        <p className="text-lg text-slate-400">Tüm özelliklere anında erişin</p>
                    </div>

                    {/* Steps */}
                    <div className="flex justify-center mb-12">
                        {[
                            { num: 1, label: 'Plan Seçimi' },
                            { num: 2, label: 'Fatura Bilgileri' },
                            { num: 3, label: 'Ödeme' }
                        ].map((s, idx) => (
                            <div key={s.num} className="flex items-center">
                                <div
                                    onClick={() => s.num < step && setStep(s.num)}
                                    className={`flex items-center gap-3 px-5 py-3 rounded-full cursor-pointer transition-all font-medium ${step === s.num
                                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30'
                                        : step > s.num
                                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                                        }`}
                                >
                                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${step === s.num ? 'bg-white/20' : step > s.num ? 'bg-blue-500/30' : 'bg-slate-800'
                                        }`}>
                                        {step > s.num ? '✓' : s.num}
                                    </span>
                                    <span className="hidden sm:inline">{s.label}</span>
                                </div>
                                {idx < 2 && (
                                    <div className={`w-8 sm:w-16 h-1 mx-1 sm:mx-3 rounded-full ${step > s.num ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-slate-800'}`}></div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Step 1: Plan Selection - MODERN & DIKKAT ÇEKİCİ */}
                    {step === 1 && (
                        <div>
                            {plansLoading ? (
                                <div className="text-center text-slate-400 py-12">Planlar yükleniyor...</div>
                            ) : (
                                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {plans.map(plan => {
                                        const monthlyPrice = Math.round(plan.price / plan.duration_months);
                                        return (
                                            <div
                                                key={plan.id}
                                                onClick={() => { setSelectedPlan(plan.id); setStep(2); }}
                                                className={`relative group cursor-pointer ${plan.tag ? 'lg:-translate-y-6 z-10' : ''}`}
                                            >
                                                {plan.tag && (
                                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-20">
                                                        <div className="relative">
                                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur-lg opacity-60 animate-pulse"></div>
                                                            <div className="relative bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-bold px-6 py-2 rounded-full shadow-xl shadow-blue-500/50">
                                                                ⭐ {plan.tag}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className={`h-full p-7 rounded-3xl transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-2xl ${plan.tag
                                                    ? 'bg-gradient-to-b from-blue-600/30 via-blue-800/20 to-slate-900/90 border-2 border-blue-500/60 shadow-[0_0_60px_rgba(59,130,246,0.3)]'
                                                    : 'bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 group-hover:shadow-blue-500/10'
                                                    }`}>
                                                    <h3 className="text-2xl font-bold text-white mb-1">{plan.name}</h3>
                                                    {plan.discount_percent && plan.discount_percent > 0 && (
                                                        <span className="inline-block px-3 py-1 bg-blue-500/20 rounded-full text-blue-400 text-sm font-bold">
                                                            %{plan.discount_percent} tasarruf
                                                        </span>
                                                    )}
                                                    <div className="my-6">
                                                        <span className="text-4xl font-black text-white">₺{plan.price}</span>
                                                        <span className="text-slate-400 text-lg"> / AY</span>
                                                    </div>
                                                    <div className="text-slate-500 text-sm mb-6">{plan.duration_months} Aylık Ödeme</div>
                                                    <button className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${plan.tag
                                                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/40 hover:shadow-blue-500/60 hover:scale-[1.02]'
                                                        : 'bg-slate-800 text-white hover:bg-slate-700 hover:scale-[1.02]'
                                                        }`}>
                                                        Seç →
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Billing */}
                    {step === 2 && (
                        <div className="max-w-xl mx-auto">
                            <div className="p-8 bg-slate-900/80 backdrop-blur-sm rounded-3xl border border-slate-800">
                                <h2 className="text-2xl font-bold text-white mb-6">Fatura Bilgileri</h2>

                                {selectedPlanData && (
                                    <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/30">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="text-slate-400 text-sm">Seçilen Plan</span>
                                                <div className="text-xl font-bold text-white">{selectedPlanData.name} ({selectedPlanData.duration_months} Ay)</div>
                                            </div>
                                            <div className="text-3xl font-black text-white">₺{selectedPlanData.price}</div>
                                        </div>
                                    </div>
                                )}

                                <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Şirket Adı</label>
                                        <input
                                            type="text"
                                            value={billingInfo.companyName}
                                            onChange={(e) => setBillingInfo({ ...billingInfo, companyName: e.target.value })}
                                            className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-lg"
                                            placeholder="Şirket adınız"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">Vergi Dairesi</label>
                                            <input
                                                type="text"
                                                value={billingInfo.taxOffice}
                                                onChange={(e) => setBillingInfo({ ...billingInfo, taxOffice: e.target.value })}
                                                className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                                placeholder="Vergi dairesi"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">Vergi No</label>
                                            <input
                                                type="text"
                                                value={billingInfo.taxNumber}
                                                onChange={(e) => setBillingInfo({ ...billingInfo, taxNumber: e.target.value })}
                                                className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                                placeholder="Vergi no"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Fatura Adresi</label>
                                        <textarea
                                            value={billingInfo.address}
                                            onChange={(e) => setBillingInfo({ ...billingInfo, address: e.target.value })}
                                            className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                                            placeholder="Fatura adresi"
                                            rows={3}
                                            required
                                        />
                                    </div>
                                    <div className="flex gap-4 pt-4">
                                        <button type="button" onClick={() => setStep(1)} className="flex-1 py-4 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors">
                                            ← Geri
                                        </button>
                                        <button type="submit" className="flex-1 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all">
                                            Devam →
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Payment */}
                    {step === 3 && (
                        <div className="max-w-xl mx-auto">
                            <div className="p-8 bg-slate-900/80 backdrop-blur-sm rounded-3xl border border-slate-800">
                                <h2 className="text-2xl font-bold text-white mb-6">Ödeme Bilgileri</h2>

                                {selectedPlanData && (
                                    <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/30">
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-slate-400">
                                                <span>Plan</span>
                                                <span className="text-white font-medium">{selectedPlanData.name}</span>
                                            </div>
                                            <div className="flex justify-between text-slate-400">
                                                <span>Şirket</span>
                                                <span className="text-white font-medium truncate ml-4">{billingInfo.companyName}</span>
                                            </div>
                                            <div className="pt-3 border-t border-blue-500/20">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-lg font-bold text-white">Toplam</span>
                                                    <span className="text-3xl font-black text-white">₺{selectedPlanData.price}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-5 mb-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Kart Numarası</label>
                                        <input type="text" className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-lg tracking-wider" placeholder="0000 0000 0000 0000" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">Son Kullanma</label>
                                            <input type="text" className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-center text-lg" placeholder="AA/YY" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">CVV</label>
                                            <input type="text" className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-center text-lg" placeholder="•••" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 mb-8">
                                    <span className="text-xl">🔒</span>
                                    <span className="text-blue-300 text-sm">256-bit SSL şifreli güvenli ödeme</span>
                                </div>

                                <div className="flex gap-4">
                                    <button type="button" onClick={() => setStep(2)} className="flex-1 py-4 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors">
                                        ← Geri
                                    </button>
                                    <button onClick={handlePurchase} disabled={loading} className="flex-1 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-lg">
                                        {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Ödemeyi Tamamla →'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Trust Badges */}
                    <div className="mt-12 flex flex-wrap justify-center gap-4">
                        {[
                            { icon: '🔒', text: 'SSL Korumalı' },
                            { icon: '💳', text: '3D Secure' },
                            { icon: '⚡', text: 'Anında Aktivasyon' }
                        ].map((badge, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border border-slate-800 rounded-full text-slate-400 text-sm">
                                <span>{badge.icon}</span>
                                <span>{badge.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>}>
            <CheckoutContent />
        </Suspense>
    );
}
