import createMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  // The OG-image / favicon routes read .ttf files from assets/fonts at runtime
  // via process.cwd(). That path isn't statically analyzable, so Vercel's file
  // tracing can miss it and the routes 500 in production. Pin the fonts into
  // each route's serverless bundle.
  outputFileTracingIncludes: {
    "/icon": ["./assets/fonts/**"],
    "/apple-icon": ["./assets/fonts/**"],
    "/opengraph-image": ["./assets/fonts/**"],
    "/pitch/opengraph-image": ["./assets/fonts/**"],
    "/why/opengraph-image": ["./assets/fonts/**"],
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig);
