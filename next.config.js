/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Unsplash hotlinked image CDN — required by their API Guidelines:
      // https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

module.exports = nextConfig;
