import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development
  reactStrictMode: true,

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 31536000, // 1 year cache for optimized images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },

  // Aggressive caching headers
  async headers() {
    return [
      {
        // Cache static assets for 1 year
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache JS/CSS for 1 year (they have hashes in filenames)
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Security headers and DNS prefetch for all pages
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '0',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            // SECURITY: 'unsafe-eval' is required in development for Webpack HMR/Fast Refresh.
            // It is NOT included in production builds.
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://clerk.kaulbyapp.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://us.i.posthog.com https://us-assets.i.posthog.com https://vercel.live; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.clerk.com https://img.clerk.com https://vercel.live https://*.vercel.live; connect-src 'self' https://*.clerk.accounts.dev https://clerk.kaulbyapp.com https://us.i.posthog.com https://us.posthog.com https://us-assets.i.posthog.com https://api.polar.sh https://vercel.live https://*.vercel.live https://*.sentry.io; frame-src https://challenges.cloudflare.com https://*.clerk.accounts.dev https://vercel.live; worker-src 'self' blob:; frame-ancestors 'none';`,
          },
        ],
      },
    ];
  },

  // Exclude ws from serverless bundling — it uses native Buffer.mask()
  // which breaks when minified by Next.js (causes "b.mask is not a function")
  serverExternalPackages: ['ws'],

  // Enable experimental features for performance
  experimental: {
    // Optimize package imports (tree-shaking)
    optimizePackageImports: [
      'lucide-react',
      '@clerk/nextjs',
      'framer-motion',
      'recharts',
      'posthog-js',
      '@sentry/nextjs',
    ],
  },

  // Enable gzip compression
  compress: true,

  // Generate ETags for caching
  generateEtags: true,

  // Power optimization for faster cold starts
  poweredByHeader: false,
};

export default withSentryConfig(nextConfig, {
  // Upload source maps for better stack traces
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Suppress source map upload logs during build
  silent: !process.env.CI,

  // Hide source maps from clients
  hideSourceMaps: true,

  // Disable Sentry telemetry
  telemetry: false,

  // PERF: Don't inject Sentry into Edge middleware bundle (saves ~100 kB)
  webpack: {
    autoInstrumentMiddleware: false,
  },
});
