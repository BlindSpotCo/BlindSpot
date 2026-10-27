// components/profile/MapThumb.js
//
// A satellite view centred on a home, for the profile cards. Three by three
// map tiles through the site's own tile proxy (the same Esri imagery the 3D
// map's Satellite button uses), positioned so the pin sits dead centre --
// no map library, no API key, nothing to load but nine small images.

const TILE = 256;
const SAT = (z, x, y) => `/api/sunscout/tile-proxy?url=${encodeURIComponent(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`)}`;

export default function MapThumb({ lat, lon, zoom = 18, className = '' }) {
  const la = Number(lat), lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) {
    return <div className={`pf-thumb is-blank ${className}`} aria-hidden="true" />;
  }
  const n = 2 ** zoom;
  const rad = (la * Math.PI) / 180;
  const xt = ((lo + 180) / 360) * n;
  const yt = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const x0 = Math.floor(xt) - 1, y0 = Math.floor(yt) - 1;
  // Where the pin is inside the 3x3 block, in pixels.
  const px = (xt - x0) * TILE, py = (yt - y0) * TILE;
  const tiles = [];
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) tiles.push([dx, dy]);
  return (
    <div className={`pf-thumb ${className}`} aria-hidden="true">
      <div className="pf-thumb-tiles" style={{ left: `calc(50% - ${px.toFixed(1)}px)`, top: `calc(50% - ${py.toFixed(1)}px)` }}>
        {tiles.map(([dx, dy]) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`${dx}${dy}`} src={SAT(zoom, x0 + dx, y0 + dy)} alt="" loading="lazy" decoding="async"
            style={{ left: dx * TILE, top: dy * TILE }} />
        ))}
      </div>
      <span className="pf-thumb-pin" />
    </div>
  );
}
