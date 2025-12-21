'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Navigation from '../../components/Navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, BarChart3, Trash2, AlertCircle, ArrowRight } from 'lucide-react';

interface Project {
    id: string;
    name: string;
    description: string;
    total_cost: number;
    created_at: string;
}

export default function ProjectsPage() {
    const { isLoggedIn } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<any>(null);

    useEffect(() => {
        if (isLoggedIn) {
            fetchProjects();
        } else {
            setLoading(false);
        }
    }, [isLoggedIn]);

    const fetchProjects = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/projects', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setProjects(data);
            }
        } catch (error) {
            console.error('Failed to fetch projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, project: any) => {
        e.preventDefault();
        e.stopPropagation();
        setProjectToDelete(project);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (!projectToDelete) return;

        setDeletingId(projectToDelete.id);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/projects/${projectToDelete.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                setProjects(projects.filter(p => p.id !== projectToDelete.id));
                setShowDeleteModal(false);
                setProjectToDelete(null);
            } else {
                const err = await res.json();
                alert('Hata: ' + (err.error || 'Bilinmeyen bir hata oluştu'));
            }
        } catch (error: any) {
            console.error('Delete error:', error);
            alert('Silme başarısız oldu: ' + (error.message || error));
        } finally {
            setDeletingId(null);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-slate-50 font-sans">
                <Navigation />
                <div className="container mx-auto px-4 py-16 text-center">
                    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-lg">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Giriş Yapmalısınız</h2>
                        <p className="text-slate-600 mb-6">Projelerinizi görmek için lütfen giriş yapın.</p>
                        <Link href="/" className="btn btn-primary w-full py-3 justify-center">
                            Ana Sayfaya Dön
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#fcfdfe] overflow-hidden selection:bg-indigo-100 selection:text-indigo-900 font-sans">
            <Navigation />

            {/* AURA BACKGROUND ENGINE */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[80vw] h-[80vw] bg-indigo-100/20 blur-[120px] rounded-full animate-aura"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-blue-50/30 blur-[100px] rounded-full animate-aura" style={{ animationDirection: 'reverse', animationDuration: '25s' }}></div>
            </div>

            <main className="relative z-10">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8 max-w-[1200px]">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Projelerim</h1>
                            <p className="text-slate-500 font-medium">Kaydettiğiniz tüm maliyet analizleri burada listelenir.</p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            <Link href="/app" className="btn-primary flex items-center gap-2">
                                <Plus className="w-5 h-5" />
                                Yeni Analiz Başlat
                            </Link>
                        </motion.div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        </div>
                    ) : projects.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-24 bg-white/50 backdrop-blur-xl rounded-[3rem] border border-slate-100 shadow-2xl shadow-indigo-900/5"
                        >
                            <div className="w-24 h-24 bg-indigo-50 text-indigo-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                                <Plus className="w-10 h-10" />
                            </div>
                            <h3 className="text-3xl font-black text-slate-900 mb-3">Henüz Proje Yok</h3>
                            <p className="text-slate-500 mb-10 font-medium text-lg">İlk maliyet analizinizi oluşturarak hemen başlayın.</p>
                            <Link href="/app" className="btn-primary inline-flex items-center gap-2">
                                Analiz Oluştur
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                        </motion.div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {projects.map((project, index) => (
                                <motion.div
                                    key={project.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <Link href={`/projects/view?id=${project.id}`} className="premium-card p-10 block group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-indigo-100 transition-colors"></div>
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-8">
                                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm border border-indigo-100 group-hover:border-indigo-600">
                                                    <BarChart3 className="w-7 h-7" />
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 group-hover:bg-white transition-colors uppercase tracking-[0.2em]">
                                                        {formatDate(project.created_at)}
                                                    </span>
                                                    <button
                                                        onClick={(e) => handleDeleteClick(e, project)}
                                                        className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-sm border border-slate-100"
                                                        title="Projeyi Sil"
                                                        disabled={deletingId === project.id}
                                                    >
                                                        {deletingId === project.id ? (
                                                            <div className="w-4 h-4 border-2 border-rose-200 border-t-rose-600 rounded-full animate-spin"></div>
                                                        ) : (
                                                            <Trash2 className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            <h3 className="text-2xl font-black text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors tracking-tight line-clamp-1">{project.name}</h3>
                                            <p className="text-slate-500 text-sm mb-10 line-clamp-2 font-medium leading-relaxed">{project.description || 'Proje açıklaması bulunmuyor'}</p>
                                            <div className="pt-8 border-t border-slate-100 flex justify-between items-center group-hover:border-indigo-100 transition-colors">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Toplam Yatırım</span>
                                                <span className="text-2xl font-black text-slate-900 font-mono tracking-tighter group-hover:text-indigo-600 transition-colors">{formatCurrency(project.total_cost)}</span>
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </main >

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {
                    showDeleteModal && projectToDelete && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
                            onClick={() => setShowDeleteModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 20 }}
                                className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-10 border border-slate-100 relative overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center gap-5 mb-8">
                                    <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 shadow-inner">
                                        <AlertCircle className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Projeyi Sil</h3>
                                        <p className="text-sm text-slate-400 font-medium tracking-widest uppercase">Geri alınamaz işlem</p>
                                    </div>
                                </div>
                                <p className="text-slate-600 mb-10 font-medium leading-relaxed text-lg">
                                    <span className="text-slate-900 font-black">{projectToDelete.name}</span> projesini silmek istediğinizden emin misiniz?
                                </p>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => { setShowDeleteModal(false); setProjectToDelete(null); }}
                                        className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all"
                                        disabled={deletingId !== null}
                                    >
                                        Vazgeç
                                    </button>
                                    <button
                                        onClick={handleDeleteConfirm}
                                        className="flex-[1.5] py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-rose-100 hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                                        disabled={deletingId !== null}
                                    >
                                        {deletingId ? 'Siliniyor...' : 'Evet, Sil'}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )
                }
            </AnimatePresence >
        </div >
    );
}
