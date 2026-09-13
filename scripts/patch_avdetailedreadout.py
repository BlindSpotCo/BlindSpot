"""
One-time patch: wires the L5 "report this" feedback affordance
(components/shared/FieldFeedback.js) into AVDetailedReadout.js.

Applies exact, unique string replacements (never a blind rewrite of the
file) so anything not explicitly touched here is provably unchanged.
Fails loudly (raises) if any expected string isn't found exactly once,
rather than silently doing nothing.
"""
import sys

PATH = "components/property-score/AVDetailedReadout.js"
src = open(PATH, encoding="utf-8").read()
original = src

def replace_once(old, new, label):
    global src
    count = src.count(old)
    if count != 1:
        raise SystemExit(f"FAILED [{label}]: expected exactly 1 occurrence, found {count}")
    src = src.replace(old, new, 1)

# 1. Import
replace_once(
    "import { sourceFor } from '@/lib/aslivastu/cityMeta';",
    "import { sourceFor } from '@/lib/aslivastu/cityMeta';\n"
    "import FieldFeedback from '@/components/shared/FieldFeedback';",
    "import",
)

# 2. CategoryCard: accept pinCode/city, render FieldFeedback next to each value that has a fieldKey
replace_once(
    "function CategoryCard({ title, tip, stats }) {\n"
    "  return (\n"
    "    <BPF style={{ padding: '18px 20px' }}>\n"
    "      <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, color: 'var(--slate)', margin: '0 0 14px', display: 'flex', alignItems: 'center' }}>{title}<Info text={tip} /></p>\n"
    "      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px 20px' }}>\n"
    "        {stats.filter(Boolean).map(([label, val, itemTip]) => (\n"
    "          <div key={label}>\n"
    "            <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}>{label}<Info text={itemTip} /></div>\n"
    "            <div style={{ fontFamily: \"'Geist', sans-serif\", fontSize: 15.5, fontWeight: 400, marginTop: 3, color: 'var(--text)' }}>{val ?? '-'}</div>\n"
    "          </div>\n"
    "        ))}\n"
    "      </div>\n"
    "    </BPF>\n"
    "  );\n"
    "}",

    "function CategoryCard({ title, tip, stats, pinCode, city }) {\n"
    "  return (\n"
    "    <BPF style={{ padding: '18px 20px' }}>\n"
    "      <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, color: 'var(--slate)', margin: '0 0 14px', display: 'flex', alignItems: 'center' }}>{title}<Info text={tip} /></p>\n"
    "      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px 20px' }}>\n"
    "        {stats.filter(Boolean).map(([label, val, itemTip, fieldKey]) => (\n"
    "          <div key={label}>\n"
    "            <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}>{label}<Info text={itemTip} /></div>\n"
    "            <div style={{ fontFamily: \"'Geist', sans-serif\", fontSize: 15.5, fontWeight: 400, marginTop: 3, color: 'var(--text)', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>\n"
    "              {val ?? '-'}\n"
    "              {fieldKey && pinCode && (\n"
    "                <FieldFeedback pinCode={pinCode} city={city} fieldName={fieldKey} fieldLabel={label} currentValue={val} />\n"
    "              )}\n"
    "            </div>\n"
    "          </div>\n"
    "        ))}\n"
    "      </div>\n"
    "    </BPF>\n"
    "  );\n"
    "}",
    "CategoryCard",
)

# 3. Pass pinCode/city into every CategoryCard call, and tag the fields this
# pass's data-integrity work actually touched/audited with a fieldKey (the
# 4th tuple element). Every other row is untouched -- CategoryCard already
# treats a missing 4th element as "no feedback affordance for this row yet",
# so this is purely additive and easy to extend later.

replace_once(
    '<CategoryCard title="Safety" tip={source(\'crime\', record.city)} stats={[\n'
    "          ['Total crimes', record.total_cognizable_crimes, \"Total cognizable crimes reported annually for this pin's police-station catchment, which can span a wider area than any one colony.\"],",
    '<CategoryCard title="Safety" tip={source(\'crime\', record.city)} pinCode={record.pin_code} city={record.city} stats={[\n'
    "          ['Total crimes', record.total_cognizable_crimes, \"Total cognizable crimes reported annually for this pin's police-station catchment, which can span a wider area than any one colony.\", 'total_cognizable_crimes'],",
    "Safety card",
)

replace_once(
    '<CategoryCard title="Air Quality" tip={source(\'air\', record.city)} stats={[\n'
    "          ['AQI', record.aqi_avg != null ? Math.round(record.aqi_avg) : '-', 'Air Quality Index, CPCB/KSPCB daily average.'],",
    '<CategoryCard title="Air Quality" tip={source(\'air\', record.city)} pinCode={record.pin_code} city={record.city} stats={[\n'
    "          ['AQI', record.aqi_avg != null ? Math.round(record.aqi_avg) : '-', 'Air Quality Index, CPCB/KSPCB daily average.', 'aqi_avg'],",
    "Air Quality card",
)

replace_once(
    '<CategoryCard title="Power Supply" tip={source(\'power\', record.city)} stats={[\n'
    "          ['Discom', record.discom, 'The electricity distribution company serving this area.'],",
    '<CategoryCard title="Power Supply" tip={source(\'power\', record.city)} pinCode={record.pin_code} city={record.city} stats={[\n'
    "          ['Discom', record.discom, 'The electricity distribution company serving this area.', 'discom'],",
    "Power Supply card",
)

replace_once(
    "<CategoryCard title=\"Connectivity & Infrastructure\" tip={source('infrastructure', record.city)} stats={[\n"
    "          ['Zone', record.zone_type, 'Land-use zone type, residential, mixed, commercial or industrial.'],\n"
    "          ['Metro nearby', record.metro_stations_nearby, 'Number of operational metro stations near this pin.'],\n"
    "          ['Metro planned', record.metro_planned_stations, 'Approved but not-yet-open metro stations nearby.'],\n"
    "          ['Highway', record.highway_proximity, 'Proximity to major highways / arterial roads.'],\n"
    "          ['Smart city', record.smart_city_project ? 'Yes' : 'No', 'Whether the area falls under the Smart Cities Mission.'],\n"
    "          ['Infra score', (record.infra_score_raw ?? s.infrastructure) != null ? `${record.infra_score_raw ?? s.infrastructure}/100` : '-', 'Composite of metro access, highway proximity, zone type and smart-city status.'],",

    "<CategoryCard title=\"Connectivity & Infrastructure\" tip={source('infrastructure', record.city)} pinCode={record.pin_code} city={record.city} stats={[\n"
    "          ['Zone', record.zone_type, 'Land-use zone type, residential, mixed, commercial or industrial.', 'zone_type'],\n"
    "          ['Metro nearby', record.metro_stations_nearby, 'Number of operational metro stations near this pin.', 'metro_stations_nearby'],\n"
    "          ['Metro planned', record.metro_planned_stations, 'Approved but not-yet-open metro stations nearby.', 'metro_planned_stations'],\n"
    "          ['Highway', record.highway_proximity, 'Proximity to major highways / arterial roads.', 'highway_proximity'],\n"
    "          ['Smart city', record.smart_city_project ? 'Yes' : 'No', 'Whether the area falls under the Smart Cities Mission.', 'smart_city_project'],\n"
    "          ['Infra score', (record.infra_score_raw ?? s.infrastructure) != null ? `${record.infra_score_raw ?? s.infrastructure}/100` : '-', 'Composite of metro access, highway proximity, zone type and smart-city status.', 'infra_score_raw'],",
    "Infrastructure card",
)

replace_once(
    '<CategoryCard title="Water Supply" tip={source(\'water\', record.city)} stats={[',
    '<CategoryCard title="Water Supply" tip={source(\'water\', record.city)} pinCode={record.pin_code} city={record.city} stats={[',
    "Water Supply card header",
)

replace_once(
    '<CategoryCard title="Roads" tip={source(\'roads\', record.city)} stats={[',
    '<CategoryCard title="Roads" tip={source(\'roads\', record.city)} pinCode={record.pin_code} city={record.city} stats={[',
    "Roads card header",
)

replace_once(
    '<CategoryCard title="Drainage & Sewerage" tip={source(\'sewerage\', record.city)} stats={[',
    '<CategoryCard title="Drainage & Sewerage" tip={source(\'sewerage\', record.city)} pinCode={record.pin_code} city={record.city} stats={[',
    "Sewerage card header",
)

if src == original:
    raise SystemExit("FAILED: no changes were made")

open(PATH, "w", encoding="utf-8").write(src)
print(f"Patched {PATH}: {len(src) - len(original)} bytes added.")
