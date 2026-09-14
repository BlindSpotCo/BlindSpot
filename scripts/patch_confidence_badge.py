"""
One-time patch: adds a small confidence badge to AVDetailedReadout.js,
reading the L0 provenance envelope (record._provenance) added by
scripts/patch_metro.py -- item 6 on the trust-framework checklist
("Confidence bands... High/Medium/Low based on data freshness,
completeness and source quality").

Today only metro_stations_nearby (Delhi NCR + Bangalore) carries a
_provenance entry, so this badge will only actually render there until
more fields get one -- but the mechanism is generic: any field that gets
a _provenance[fieldKey] entry in future automatically gets a badge, no
further UI change needed.

Exact, unique string replacements only -- see patch_avdetailedreadout.py
for the same discipline.
"""
PATH = "components/property-score/AVDetailedReadout.js"
src = open(PATH, encoding="utf-8").read()
original = src

def replace_once(old, new, label):
    global src
    count = src.count(old)
    if count != 1:
        raise SystemExit(f"FAILED [{label}]: expected exactly 1 occurrence, found {count}")
    src = src.replace(old, new, 1)

# 1. CategoryCard: accept provenance, render a badge next to any field that has one
replace_once(
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

    "function CategoryCard({ title, tip, stats, pinCode, city, provenance }) {\n"
    "  return (\n"
    "    <BPF style={{ padding: '18px 20px' }}>\n"
    "      <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, color: 'var(--slate)', margin: '0 0 14px', display: 'flex', alignItems: 'center' }}>{title}<Info text={tip} /></p>\n"
    "      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px 20px' }}>\n"
    "        {stats.filter(Boolean).map(([label, val, itemTip, fieldKey]) => {\n"
    "          const prov = fieldKey ? provenance?.[fieldKey] : null;\n"
    "          return (\n"
    "          <div key={label}>\n"
    "            <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}>{label}<Info text={itemTip} /></div>\n"
    "            <div style={{ fontFamily: \"'Geist', sans-serif\", fontSize: 15.5, fontWeight: 400, marginTop: 3, color: 'var(--text)', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>\n"
    "              {val ?? '-'}\n"
    "              {prov && <ConfidenceBadge provenance={prov} />}\n"
    "              {fieldKey && pinCode && (\n"
    "                <FieldFeedback pinCode={pinCode} city={city} fieldName={fieldKey} fieldLabel={label} currentValue={val} />\n"
    "              )}\n"
    "            </div>\n"
    "          </div>\n"
    "          );\n"
    "        })}\n"
    "      </div>\n"
    "    </BPF>\n"
    "  );\n"
    "}\n"
    "\n"
    "// L0 provenance -> L6 calibrated-display badge (docs/data-integrity-architecture.md,\n"
    "// items 6/L0). Only renders for a field that actually carries a _provenance entry --\n"
    "// most fields don't yet, so most rows show nothing here until they do (see this\n"
    "// file's own comment above CategoryCard's `provenance` prop).\n"
    "const CONFIDENCE_STYLE = {\n"
    "  high:   { label: 'verified', color: '#1a7a3c' },\n"
    "  medium: { label: 'estimated', color: '#9a6b00' },\n"
    "  low:    { label: 'unverified', color: '#a33' },\n"
    "  none:   { label: 'no data', color: '#a33' },\n"
    "};\n"
    "function ConfidenceBadge({ provenance }) {\n"
    "  const style = CONFIDENCE_STYLE[provenance.confidence] || CONFIDENCE_STYLE.medium;\n"
    "  const title = [\n"
    "    provenance.source_id && `Source: ${provenance.source_id}`,\n"
    "    provenance.method && `Method: ${provenance.method}`,\n"
    "    provenance.as_of && `As of: ${provenance.as_of}`,\n"
    "  ].filter(Boolean).join(' \\u00b7 ');\n"
    "  return (\n"
    "    <span\n"
    "      title={title}\n"
    "      style={{\n"
    "        fontSize: 9.5, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase',\n"
    "        color: style.color, border: `1px solid ${style.color}`, borderRadius: 999,\n"
    "        padding: '1px 6px', marginLeft: 6, lineHeight: 1.5, cursor: 'help',\n"
    "      }}\n"
    "    >\n"
    "      {style.label}\n"
    "    </span>\n"
    "  );\n"
    "}",
    "CategoryCard + ConfidenceBadge",
)

# 2. Pass record._provenance into the Infrastructure card (the only card with any
# provenance data today -- metro_stations_nearby). Extending to other cards is a
# one-line change (add `provenance={record._provenance}`) once they carry real data.
replace_once(
    "<CategoryCard title=\"Connectivity & Infrastructure\" tip={source('infrastructure', record.city)} pinCode={record.pin_code} city={record.city} stats={[",
    "<CategoryCard title=\"Connectivity & Infrastructure\" tip={source('infrastructure', record.city)} pinCode={record.pin_code} city={record.city} provenance={record._provenance} stats={[",
    "Infrastructure card provenance wiring",
)

if src == original:
    raise SystemExit("FAILED: no changes were made")

open(PATH, "w", encoding="utf-8").write(src)
print(f"Patched {PATH}: {len(src) - len(original)} bytes added.")
