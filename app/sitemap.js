import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = 'https://blindspotco.net';

export default function sitemap() {
  const staticRoutes = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/floor-plan-analysis`, changeFrequency: 'monthly', priority: 0.7 },
  ].map((r) => ({ ...r, lastModified: new Date() }));

  // One entry per real scored locality (see lib/neighbourhood-report/getReportData.js
  // for the same data source) -- these are genuinely unique, content-rich pages
  // (crime/air/schools/price scores per pincode), exactly what's worth indexing
  // individually rather than leaving undiscoverable behind a search box.
  let localityRoutes = [];
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'data/aslivastu/nqi_scores.json'),
      'utf-8'
    );
    const scores = JSON.parse(raw);
    localityRoutes = scores.map((r) => ({
      url: `${SITE_URL}/neighbourhood-report/${r.pin_code}`,
      // Each record carries when it was actually scored. Stamping every URL
      // with the build time told crawlers all 309 localities changed on
      // every deploy, which gets the signal discounted.
      lastModified: r.scored_at ? new Date(r.scored_at) : new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    }));
  } catch {
    // Falls back to static routes only if the data file ever moves/changes shape.
  }

  return [...staticRoutes, ...localityRoutes];
}
