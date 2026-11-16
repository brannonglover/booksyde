import type { NextConfig } from "next";

// PostHog region (US by default). Events go through /ingest on our own domain; see src/instrumentation-client.ts.
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const posthogAssets = posthogHost.replace(".i.posthog.com", "-assets.i.posthog.com");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: `${posthogAssets}/static/:path*` },
      { source: "/ingest/:path*", destination: `${posthogHost}/:path*` },
    ];
  },
  // PostHog's API paths end in a slash; don't redirect them away.
  skipTrailingSlashRedirect: true,
  cacheComponents: true,
  partialPrefetching: true,
  // Internal workspace packages ship TypeScript source; let Next compile them.
  transpilePackages: ["@booksyde/shared", "@booksyde/theme", "@booksyde/types"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "covers.openlibrary.org" },
      // Publisher covers from Google Books (see src/lib/covers.ts).
      { protocol: "https", hostname: "books.google.com", pathname: "/books/**" },
      { protocol: "https", hostname: "books.googleusercontent.com" },
      // Hand-picked covers where Open Library only has a poor photo.
      { protocol: "https", hostname: "m.media-amazon.com", pathname: "/images/**" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
