import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center p-8 bg-white rounded-2xl shadow-xl border border-slate-200">
                <h2 className="text-6xl font-bold text-blue-600 mb-4">404</h2>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Sayfa Bulunamadı</h3>
                <p className="text-slate-600 mb-8">Aradığınız sayfa mevcut değil veya taşınmış olabilir.</p>
                <Link
                    href="/"
                    className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                >
                    Ana Sayfaya Dön
                </Link>
            </div>
        </div>
    );
}
