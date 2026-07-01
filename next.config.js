/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname:  'res.cloudinary.com',
      },
    ],
  },
  // Allow Cloudinary URLs through next/image optimisation
  // (we use Cloudinary's own transforms, so Next image optimisation is bypassed for those)
}

module.exports = nextConfig
