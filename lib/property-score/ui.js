// lib/property-score/ui.js
// Small shared pieces used across the Property Score tab's components
// (LocalityPicker, AddressPicker, UnitVerdict) so they don't each redefine
// the same badge/bar/formatting helpers.

// Labels matched to AsliVastu's own live report (aslivastu.com/report-v2/…):
// their Dimension Readout calls these "Safety", "Water Supply" and
// "Drainage & Sewerage", not the shorter "Crime"/"Water"/"Sewerage" this
// used to say -- was also an internal inconsistency on BlindSpot's own
// report page already, since AVDetailedReadout's category-card titles
// hardcoded "Water Supply"/"Drainage & Sewerage" independently of this
// constant while everything else read the old short labels off of it.
export const FACTOR_LABELS = {
  crime: 'Safety', infrastructure: 'Infrastructure', air: 'Air Quality',
  power: 'Power', schools: 'Schools', water: 'Water Supply', roads: 'Roads', sewerage: 'Drainage & Sewerage',
};

export const FACING_OPTS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
export function inr(n) {
  if (n == null) return '-';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
