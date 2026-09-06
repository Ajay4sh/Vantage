/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    // This machine's native file-watching is unreliable (bleeding-edge Node +
    // Windows), which corrupted HMR into serving stale SWC output. Polling is
    // slower but deterministic — dev edits reflect reliably. Prod is untouched.
    if (dev) {
      config.watchOptions = { poll: 800, aggregateTimeout: 300, ignored: /node_modules/ };
    }
    return config;
  },
};

export default nextConfig;
