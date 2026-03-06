/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // pdfjs-dist uses canvas optionally — mark as external to avoid build errors
    config.resolve.alias.canvas = false;
    return config;
  },
};
module.exports = nextConfig;
