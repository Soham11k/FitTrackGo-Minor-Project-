/** @type {import('next').NextConfig} */
const buildForAndroid = process.env.BUILD_FOR_ANDROID === '1'

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Static export for Capacitor Android build (see ANDROID-BUILD.md)
  ...(buildForAndroid && {
    output: 'export',
    assetPrefix: './',
    trailingSlash: true,
  }),
}

export default nextConfig
