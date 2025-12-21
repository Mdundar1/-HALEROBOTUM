import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '../context/AuthContext'
import Navigation from '../components/Navigation'

const poppins = Poppins({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700', '800'],
    variable: '--font-poppins'
})

export const metadata: Metadata = {
    title: 'Maliyet Sihirbazı v2 - AI Destekli Metraj Analizi',
    description: 'Ultra-modern arayüz ile metraj analizi, poz arama ve maliyet tahmini',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="tr">
            <body className={poppins.className}>
                <AuthProvider>
                    <Navigation />
                    {children}
                </AuthProvider>
            </body>
        </html>
    )
}
