# BlindSpot

Property intelligence for home buyers in India. Pick a location and BlindSpot tells you about the **neighbourhood** (infrastructure, schools, safety, water, power, air quality and more) and the **flat** (sun, heat risk, view, privacy, ventilation, dampness risk, noise risk, estimated summer AC cost), then combines them into one report.

Live at [blindspot.properties](https://blindspot.properties).

- **Neighbourhood score:** covers the Tier 1 Indian cities plus Chandigarh, scored per pincode.
- **Flat score:** works for any address. It uses a 3D sun and shadow simulation for the chosen floor and facing.
- **AI report:** a written verdict covering both sides, with seasonal map images, exportable as a PDF.

## Stack

- Next.js 16 (App Router), React 19
- Supabase for auth (magic link and Google) and saved reports
- Gemini for the written report and image captions
- OSM Buildings + Leaflet for the 3D map, NOAA-based solar maths
- Hosted on Vercel

## Running locally

```bash
git clone https://github.com/BlindSpotCo/BlindSpot.git
cd BlindSpot
npm install
cp .env.local.example .env.local   # then fill in the values below
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | What it's for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth and saved reports (see [SUPABASE_SETUP.md](SUPABASE_SETUP.md)) |
| `GEMINI_API_KEY` | AI report generation (`GEMINI_MODELS`, `GEMINI_BASE_URL` optional) |
| `GOOGLE_AIR_QUALITY_KEY` | Live AQI |
| `OPEN_METEO_API_KEY` / `OPEN_METEO_FREE` | Weather and wind data |
| `OSMB_DATA_KEY`, `OSMB_REFERER` | OSM Buildings 3D tiles |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for SEO and sitemap |
| `GOOGLE_SITE_VERIFICATION` | Search Console (optional) |

Without the Supabase variables the site still runs, but sign-in is off.

## Project layout

```
app/              pages and API routes (app/api/*)
components/       UI: report flow, 3D map, neighbourhood report, profile
lib/              scoring, report building, auth, paywall config
data/aslivastu/   neighbourhood scores per pincode
scripts/          per-city data builders and validators (Python)
docs/             data integrity notes, city launch checklist, paywall plan
```

## Data checks

```bash
npm run validate:data        # data integrity
npm run validate:quality     # completeness and quality metrics
npm run validate:benchmark   # price correlation sanity check
npm run validate:checklist   # new-city launch checklist
```

Scoring and data changes are logged in [CHANGELOG.md](CHANGELOG.md).

## Map data

Map and building data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the Open Database License (ODbL). Satellite imagery © Esri.

## Licence

© 2026 BLINDSPOT LLP. All rights reserved. See [LICENSE](LICENSE). The code is public to read, not to reuse.
