import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin Turbopack root so it doesn't pick up a sibling project's lockfile.
  // The Lounge lives next to the main Astroid repo on the operator's
  // machine, and without this pin Turbopack's auto-discover sometimes
  // climbs into the wrong workspace.
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
