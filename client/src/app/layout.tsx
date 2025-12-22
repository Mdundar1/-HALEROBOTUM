import type { Metadata } from 'next'
import { Poppins, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '../context/AuthContext'
import Navigation from '../components/Navigation'

const poppins = Poppins({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700', '800'],
    variable: '--font-poppins'
})

const spaceGrotesk = Space_Grotesk({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700'],
    variable: '--font-space-grotesk'
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
            <body className={`${poppins.className} ${spaceGrotesk.variable}`}>
                <AuthProvider>
                    <Navigation />
                    {children}
                </AuthProvider>
            </body>
        </html>
    )
}
