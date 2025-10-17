/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint:{
    ignoreDuringBuilds:true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        // Opcionalmente, puedes especificar un puerto si fuera diferente (aunque para Firebase no es necesario)
        // port: '', 
        // Opcionalmente, puedes restringir el pathname (e.g., '/v0/b/')
        pathname: '/v0/b/cre-app-clinic.firebasestorage.app/o/**',
      },
      // Puedes añadir más patrones si tienes otras fuentes de imágenes...
    ],
  },
};

module.exports = nextConfig;
