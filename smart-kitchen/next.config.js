/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The service worker (public/sw.js) is served from the origin root so it can
  // control the entire scope. We add headers to make sure it is never cached by
  // the browser HTTP cache (the SW manages its own caching lifecycle).
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
