/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        unoptimized: true
    },
    // API calls will go directly to backend since we're on same origin
    env: {
        NEXT_PUBLIC_API_URL: ''
    }
}

module.exports = nextConfig
