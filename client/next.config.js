/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    distDir: '../server/public',
    trailingSlash: true,
    images: {
        unoptimized: true
    },
    // API calls will go directly to backend since we're on same origin
    env: {
        NEXT_PUBLIC_API_URL: ''
    }
}

module.exports = nextConfig
