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
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.blindspot.properties'}/sitemap.xml`,
  };
}
