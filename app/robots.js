export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/login',
        '/signup',
        '/forgot-password',
        '/reset-password',
        '/my-reports',
        '/auth/',
        '/api/',
      ],
    },
    sitemap: 'https://blindspotco.net/sitemap.xml',
  };
}
