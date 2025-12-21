'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center p-8 bg-white rounded-2xl shadow-xl">
                <h2 className="text-2xl font-bold text-red-600 mb-4">Bir şeyler ters gitti!</h2>
                <p className="text-slate-600 mb-6">{error.message}</p>
                <button
                    onClick={() => reset()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Tekrar Dene
                </button>
            </div>
        </div>
    );
}
