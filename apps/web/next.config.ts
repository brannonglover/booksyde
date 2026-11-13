import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Internal workspace packages ship TypeScript source; let Next compile them.
  transpilePackages: ["@booksyde/shared", "@booksyde/theme", "@booksyde/types"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "covers.openlibrary.org" },
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
