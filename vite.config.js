import { defineConfig, loadEnv } from 'vite';

/**
 * Public URL of the deployed site (with trailing slash). Used for canonical,
 * Open Graph / Twitter image URLs, sitemap.xml and robots.txt.
 *
 * Override at build time:  SITE_URL=https://example.hr/ npm run build
 */
const DEFAULT_SITE_URL = 'https://markobozac.com/cijepiva/';

function siteMeta(siteUrl) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    name: 'site-meta',
    transformIndexHtml(html) {
      return html.replaceAll('%SITE_URL%', siteUrl);
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  let siteUrl = env.SITE_URL || DEFAULT_SITE_URL;
  if (!siteUrl.endsWith('/')) siteUrl += '/';

  return {
    // Relative asset paths: the build works from any folder (/, /cijepiva/, …).
    base: './',
    plugins: [siteMeta(siteUrl)],
  };
});
