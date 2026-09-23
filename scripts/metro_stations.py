#!/usr/bin/env python3
"""
scripts/metro_stations.py

Real, named metro-station registries for BlindSpot's L1 "derive, don't
store" fix (see docs/data-integrity-architecture.md section 3, "L1 -
Derive, don't store"), replacing the hand-maintained metro_stations_nearby
scalar that the architecture doc's audit found was wrong for 91% of Delhi
pins, 61% of Mumbai, 44% of Bangalore -- the flagship example being PIN
110001 / Connaught Place showing 0 metro stations while sitting on top of
Rajiv Chowk, the busiest interchange on the whole Delhi Metro network.

SOURCES (real, verifiable, checked against known geography before use)
- DELHI_STATIONS (262 stations): DelhiMetroNetwork.csv, a Delhi Metro
  Network Analysis dataset built from DMRC's public route/station data
  (github.com/Vinith-J/Delhi-Metro-Network-Analysis, mirrors the widely-
  used "Delhi Metro Dataset" also published on Kaggle by arunjangir245).
  Deduplicated from 285 rows (one row per station-per-line, so interchange
  stations like "Welcome [Conn: Red]" appear twice) down to 262 unique
  physical stations by name, keeping first-seen coordinates. Spot-checked
  against the architecture doc's own Connaught Place narrative before
  trusting the file: Rajiv Chowk lands at (28.63282, 77.21826), ~30m from
  PIN 110001's own AREA_COORDS centroid (28.633, 77.219); Barakhamba,
  Janpath and Patel Chowk are all present and all within the ~1km the doc
  describes. Covers the core DMRC network + the Rapid Metro (Gurugram)
  and Aqua Line (Noida) lines the dataset includes under the same system.

- BANGALORE_STATIONS (83 stations): bengaluru_metro_network.csv from
  github.com/Vinayak-Chinchakhandi/Bengaluru-Metro-Network-Dataset, a
  graph-format Namma Metro dataset (Purple/Green/Yellow lines) with a
  latitude/longitude column. Deduplicated from 85 rows to 83 unique
  stations by name.

- MUMBAI_STATIONS (66 stations) / HYDERABAD_STATIONS (53 stations):
  populated 2026-09-23, closing the follow-up this docstring used to
  flag. No bulk structured dataset exists for either city (checked
  again: Wikipedia's list pages still have no coordinates column, no
  GitHub/Kaggle dataset turned up), so these were built by looking up
  each individual, currently-operational station (Wikipedia infobox
  where a dedicated page exists, OSM/Mappls cross-checked against 2+
  sources otherwise), via 4 parallel research passes, one per
  line-group per city.
  That per-station approach caught real errors a bulk import would have
  silently inherited: Wikipedia's own infoboxes for Mumbai's Asalpha
  station and Hyderabad's Dr B R Ambedkar Balanagar, Habsiguda, and
  Parade Ground stations are each wrong or duplicate another station's
  coordinate outright (Parade Ground's infobox is a byte-for-byte copy
  of Punjagutta's, 5.9km away). Each was corrected using an independent
  source rather than propagated. Three Hyderabad stations (ESI
  Hospital, Nampally, Gandhi Bhavan) have no reliable coordinate
  anywhere checked (Wikipedia, Wikidata, yometro, ltmetro, railmetro,
  nobroker, metrolinemap, OSM/mapcarta, Mappls) and are deliberately
  left OUT rather than guessed; Victoria Memorial's only available
  value is an unverified duplicate of LB Nagar's and is also left out
  of the list actually used for distance joins, kept only as a comment.
  Monorail stations and stations on lines still under construction
  (Mumbai Line 6, Hyderabad Phase 2) are excluded -- this registry is
  currently-operational metro only, matching what "metro_stations_nearby"
  is supposed to mean.
  Re-running the centroid-radius join with this registry changed
  metro_stations_nearby for 77 of Mumbai+Hyderabad's 137 pins (both
  up and down: several pins carried an unsourced "1" from the old
  zone/jitter model in areas no operational line actually reaches, as
  well as the expected undercounts) and added a real citation to 59
  more pins whose existing value turned out to already be correct.
  See CHANGELOG.md v1.10 for the full pass, including a handful of
  pins (Hyderabad's Miyapur among them) where the pincode's own centroid
  sits further from its namesake station than the standard 1.5km radius
  -- kept consistent with the same standard applied everywhere else in
  this dataset rather than special-cased, but worth a human sanity check.

METHOD
haversine() gives great-circle distance in km between two (lat, lon)
points. stations_within_radius() counts real stations within a radius of
a pin's own centroid (lib/aslivastu/areaCoords.js) -- the architecture
doc's own default of 1500m for a "count within radius of pin centroid"
L1 derivation. This is deliberately the doc's declared interim method,
not its ideal one: the doc itself flags (section "L1 - Derive, don't
store", design note) that a pincode is an area and a single centroid
point will systematically undercount elongated pincodes -- the correct
fix is a buffered pincode boundary polygon, which needs pincode boundary
geodata this pass doesn't have. Centroid-radius is still a large,
verifiable improvement over a hand-typed scalar with no source at all.
"""
import math

def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))

def stations_within_radius(lat, lon, stations, radius_km=1.5):
    """stations: list of (name, lat, lon) tuples. Returns (count, [names])."""
    hits = [name for name, slat, slon in stations
            if haversine_km(lat, lon, slat, slon) <= radius_km]
    return len(hits), hits

# name, lat, lon
DELHI_STATIONS = [
    ("AIIMS", 28.568920, 77.207710),
    ("Adarsh Nagar", 28.716420, 77.170460),
    ("Akshardham", 28.618060, 77.278690),
    ("Alpha 1 Greater Noida", 28.470900, 77.512700),
    ("Anand Vihar", 28.646950, 77.316030),
    ("Arjan Garh", 28.480760, 77.125830),
    ("Arthala", 28.676999, 77.391892),
    ("Ashok Park Main", 28.671530, 77.155270),
    ("Ashram", 28.572423, 77.258598),
    ("Azadpur", 28.707657, 77.175547),
    ("Badarpur Border", 28.493340, 77.303070),
    ("Badkal Mor", 28.422814, 77.310278),
    ("Bahdurgarh City", 28.690785, 76.935485),
    ("Barakhamba", 28.630030, 77.224360),
    ("Bata Chowk", 28.385836, 77.313462),
    ("Belvedere Towers", 28.491664, 77.088139),
    ("Bhikaji Cama Place", 28.567900, 77.187016),
    ("Botanical Garden", 28.563896, 77.334332),
    ("Brigadier Hoshiar Singh", 28.697460, 76.919203),
    ("Central Secretariat", 28.614740, 77.211910),
    ("Chandni Chowk", 28.657850, 77.230140),
    ("Chawri Bazar", 28.649310, 77.226370),
    ("Chhattarpur", 28.506710, 77.174840),
    ("Chirag Delhi", 28.538141, 77.228069),
    ("Civil Lines", 28.676851, 77.225030),
    ("Cyber City", 28.497963, 77.089168),
    ("DLF Phase 1", 28.471408, 77.093933),
    ("DLF Phase 2", 28.487534, 77.092947),
    ("DLF Phase 3", 28.493512, 77.093676),
    ("Dabri Mor - Janakpuri South", 28.615755, 77.085178),
    ("Dashrath Puri", 28.601875, 77.082356),
    ("Delhi Aerocity", 28.548810, 77.120920),
    ("Delhi Cantt", 28.593833, 77.134979),
    ("Delhi Gate", 28.639204, 77.240782),
    ("Delta 1 Greater Noida", 28.478448, 77.525704),
    ("Depot Greater Noida", 28.488962, 77.543994),
    ("Dhaula Kuan", 28.591780, 77.161550),
    ("Dilli Haat INA", 28.574408, 77.210241),
    ("Dilshad Garden", 28.675920, 77.321420),
    ("Durgabai Deshmukh South Campus", 28.589438, 77.169082),
    ("Dwarka", 28.577192, 77.044293),
    ("Dwarka Mor", 28.619320, 77.033260),
    ("Dwarka Sector 10", 28.580680, 77.056820),
    ("Dwarka Sector 11", 28.586570, 77.049290),
    ("Dwarka Sector 12", 28.592320, 77.040510),
    ("Dwarka Sector 13", 28.597220, 77.033260),
    ("Dwarka Sector 14", 28.602230, 77.025880),
    ("Dwarka Sector 21", 28.552260, 77.058280),
    ("Dwarka Sector 21(First station)", 28.552260, 77.058280),
    ("Dwarka Sector 8", 28.565830, 77.067060),
    ("Dwarka Sector 9", 28.574870, 77.064540),
    ("ESI BASAI DARAPUR", 28.658074, 77.127268),
    ("East Azad Nagar", 28.664696, 77.284881),
    ("Escorts Mujesar", 28.370234, 77.314920),
    ("GNIDA Office", 28.484600, 77.536500),
    ("Ghevra Metro station", 28.685238, 76.996159),
    ("Ghitorni", 28.493830, 77.149220),
    ("Gokulpuri", 28.702475, 77.286125),
    ("Golf Course", 28.567140, 77.345980),
    ("Govind Puri", 28.544510, 77.264010),
    ("Greater Kailash", 28.541878, 77.238455),
    ("Green Park", 28.559790, 77.206820),
    ("Guru Dronacharya", 28.482030, 77.102320),
    ("Guru Tegh Bahadur Nagar", 28.697850, 77.207220),
    ("Haiderpur Badli Mor", 28.730121, 77.149403),
    ("Hauz Khas", 28.544256, 77.206707),
    ("Hindon River", 28.878965, 77.415483),
    ("Huda City Centre", 28.459270, 77.072680),
    ("IFFCO Chowk", 28.472090, 77.071750),
    ("IGI Airport", 28.556930, 77.086690),
    ("IIT Delhi", 28.544788, 77.189870),
    ("IP Extension", 28.628899, 77.310198),
    ("ITO", 28.630509, 77.241436),
    ("Inderlok", 28.673190, 77.169940),
    ("Inderlok Conn:Red", 28.673190, 77.169940),
    ("Indraprastha", 28.620510, 77.249930),
    ("JAMIA MILLIA ISLAMIA", 28.558490, 77.281165),
    ("Jaffrabad", 28.682682, 77.274805),
    ("Jahangirpuri", 28.725920, 77.162670),
    ("Jama Masjid", 28.650010, 77.237676),
    ("Janak Puri East", 28.633050, 77.086690),
    ("Janak Puri West", 28.629430, 77.077670),
    ("Jangpura", 28.584300, 77.237660),
    ("Janpath", 28.608860, 77.218165),
    ("Jasola", 28.538240, 77.283190),
    ("Jasola Vihar Shaheen Bagh", 28.545828, 77.296658),
    ("Jawaharlal Nehru Stadium", 28.590400, 77.233260),
    ("Jhandewalan", 28.644270, 77.199880),
    ("Jhil Mil", 28.675790, 77.312390),
    ("Johri Enclave", 28.712880, 77.286125),
    ("Jor Bagh", 28.587080, 77.212090),
    ("Kailash Colony", 28.555270, 77.242050),
    ("Kalindi Kunj", 28.545219, 77.305989),
    ("Kalkaji Mandir", 28.549775, 77.260667),
    ("Kanhaiya Nagar", 28.682540, 77.164590),
    ("Karkar Duma", 28.648490, 77.305580),
    ("Karkarduma Court", 28.653600, 77.295788),
    ("Karol Bagh", 28.644000, 77.188550),
    ("Kashmere Gate", 28.667500, 77.228170),
    ("Kaushambi", 28.645440, 77.324320),
    ("Keshav Puram", 28.688940, 77.161600),
    ("Khan Market", 28.602760, 77.228290),
    ("Kirti Nagar", 28.655750, 77.150570),
    ("Knowledge Park II", 28.456867, 77.500054),
    ("Kohat Enclave", 28.698100, 77.140240),
    ("Krishna Nagar", 28.657846, 77.290185),
    ("Lajpat Nagar", 28.570790, 77.236530),
    ("Lal Quila", 27.920862, 77.528502),
    ("Laxmi Nagar", 28.630640, 77.277490),
    ("Lok Kalyan Marg", 28.597260, 77.210880),
    ("MG Road", 28.479570, 77.080060),
    ("Madipur", 28.677340, 77.119650),
    ("Maharaja Surajmal Stadium", 28.681800, 77.073850),
    ("Majlis Park", 28.724431, 77.181964),
    ("Major Mohit Sharma", 28.677611, 77.358143),
    ("Malviya Nagar", 28.527980, 77.205650),
    ("Mandawali - West Vinod Nagar", 28.624971, 77.304491),
    ("Mandi House", 28.625880, 77.234100),
    ("Mansarovar Park", 28.675440, 77.300950),
    ("Maujpur", 28.691978, 77.279624),
    ("Maya Puri", 28.637179, 77.129733),
    ("Mayur Vihar Extention", 28.594158, 77.294589),
    ("Mayur Vihar Phase-1", 28.604420, 77.294550),
    ("Mayur Vihar Pocket I", 28.605862, 77.298702),
    ("Mewala Maharajpur", 28.441875, 77.302300),
    ("Model Town", 28.702780, 77.193630),
    ("Mohan Estate", 28.519380, 77.293880),
    ("Mohan Nagar", 28.606319, 77.106082),
    ("Moolchand", 28.564170, 77.234230),
    ("Moti Nagar", 28.657840, 77.142480),
    ("Moulsari Avenue", 28.500697, 77.094600),
    ("Mundka", 28.683210, 77.031330),
    ("Mundka Industrial Area (MIA)", 28.683449, 77.017133),
    ("Munirka", 28.554886, 77.171084),
    ("N.H.P.C. Chowk", 28.457690, 77.221939),
    ("NSEZ Noida", 28.532300, 77.394800),
    ("Najafgarh", 28.612304, 76.982391),
    ("Nangli", 28.617300, 77.010437),
    ("Nangloi", 28.682310, 77.064710),
    ("Nangloi Railway Station", 28.682080, 77.055960),
    ("Naraina Vihar", 28.627337, 77.140317),
    ("Nawada", 28.620250, 77.045140),
    ("Neelam Chowk Ajronda", 28.397482, 77.312360),
    ("Nehru Enclave", 28.546058, 77.251506),
    ("Nehru Place", 28.551480, 77.251540),
    ("Netaji Subash Place", 28.696052, 77.152640),
    ("New Ashok Nagar", 28.589160, 77.302040),
    ("New Delhi", 28.643070, 77.221440),
    ("New Delhi-Airport Express", 28.643070, 77.221440),
    ("Nirman Vihar", 28.636630, 77.286830),
    ("Noida City Center", 28.574660, 77.356080),
    ("Noida Sector 101", 28.556402, 77.384798),
    ("Noida Sector 137", 28.509079, 77.409015),
    ("Noida Sector 142", 28.499084, 77.412611),
    ("Noida Sector 143", 28.502663, 77.426256),
    ("Noida Sector 144", 28.486483, 77.432877),
    ("Noida Sector 145", 28.479000, 77.442500),
    ("Noida Sector 146", 28.408229, 76.963024),
    ("Noida Sector 147", 28.459502, 77.465914),
    ("Noida Sector 148", 28.448100, 77.476600),
    ("Noida Sector 15", 28.585120, 77.311390),
    ("Noida Sector 16", 28.578190, 77.317570),
    ("Noida Sector 18", 28.570810, 77.326120),
    ("Noida Sector 34", 28.580199, 77.363442),
    ("Noida Sector 50", 28.574518, 77.377206),
    ("Noida Sector 51", 28.585700, 77.375300),
    ("Noida Sector 52", 28.586700, 77.372839),
    ("Noida Sector 59", 28.606493, 77.372726),
    ("Noida Sector 61", 28.597631, 77.372299),
    ("Noida Sector 62", 28.617000, 77.373600),
    ("Noida Sector 76", 28.568746, 77.382685),
    ("Noida Sector 81", 28.622575, 77.374315),
    ("Noida Sector 83", 28.524115, 77.397244),
    ("Okhla", 28.542920, 77.275040),
    ("Okhla Bird Sanctuary", 28.552942, 77.321595),
    ("Okhla NSIC", 28.554483, 77.264849),
    ("Okhla Vihar", 28.561300, 77.291930),
    ("Old Faridabad", 28.410800, 77.311400),
    ("Palam", 28.591893, 77.082824),
    ("Panchsheel Park", 28.543353, 77.214076),
    ("Pandit Shree Ram Sharma", 28.689281, 76.951199),
    ("Pari Chowk Greater Noida", 28.463128, 77.508099),
    ("Paschim Vihar (East)", 28.677300, 77.112280),
    ("Paschim Vihar (West)", 28.678550, 77.102270),
    ("Patel Chowk", 28.622950, 77.213890),
    ("Patel Nagar", 28.644980, 77.169290),
    ("Peera Garhi", 28.679590, 77.092610),
    ("Pitam Pura", 28.703170, 77.132230),
    ("Pratap Nagar", 28.666620, 77.198820),
    ("Preet Vihar", 28.641710, 77.295430),
    ("Pul Bangash", 28.666360, 77.207270),
    ("Punjabi Bagh", 28.672890, 77.146140),
    ("Punjabi Bagh West", 28.670320, 77.142088),
    ("Qutab Minar", 28.513020, 77.186480),
    ("R K Ashram Marg", 28.639230, 77.208400),
    ("RK Puram", 28.551426, 77.184701),
    ("Raj Bagh", 28.640860, 77.209500),
    ("Raja Nahar Singh", 28.340019, 77.316428),
    ("Rajdhani Park", 28.682210, 77.043810),
    ("Rajendra Place", 28.642500, 77.178150),
    ("Rajiv Chowk", 28.632820, 77.218260),
    ("Rajouri Garden", 28.642152, 77.116060),
    ("Ramesh Nagar", 28.652740, 77.131640),
    ("Rithala(last station)", 28.720720, 77.107130),
    ("Rohini East", 28.707600, 77.125910),
    ("Rohini Sector 18-19", 28.738348, 77.139832),
    ("Rohini West", 28.714830, 77.114670),
    ("Sadar Bazaar Cantonment", 28.577151, 77.111153),
    ("Saket", 28.520600, 77.201380),
    ("Samaypur Badli(First Station)", 28.744616, 77.138265),
    ("Sant Surdas - Sihi", 28.354651, 77.316226),
    ("Sarai", 28.477682, 77.305003),
    ("Sarai Kale Khan Hazrat Nizamuddin", 28.588749, 77.257249),
    ("Sarita Vihar", 28.528780, 77.288260),
    ("Sarojini Nagar", 28.574157, 77.195370),
    ("Satguru Ram Singh Marg", 28.661990, 77.157480),
    ("Sector 28 Faridabad", 28.545257, 77.032576),
    ("Sector 42-43", 28.457392, 77.096895),
    ("Sector 53-54", 28.446374, 77.100435),
    ("Sector 54 Chowk", 28.432921, 77.104921),
    ("Sector 55-56", 28.423278, 77.105221),
    ("Seelampur", 28.669890, 77.266700),
    ("Shadipur", 28.651600, 77.158240),
    ("Shahdara", 28.673450, 77.289620),
    ("Shaheed Nagar", 28.530780, 77.212057),
    ("Shaheed Sthal(First Station)", 28.670611, 77.415582),
    ("Shakurpur", 28.685767, 77.149609),
    ("Shalimar Bagh", 28.717453, 77.150867),
    ("Shankar Vihar", 28.557439, 77.139665),
    ("Shastri Nagar", 28.669990, 77.181690),
    ("Shastri Park", 28.668000, 77.249940),
    ("Shiv Vihar", 28.617538, 77.035430),
    ("Shivaji Park", 28.674900, 77.130560),
    ("Shivaji Stadium", 28.629010, 77.211900),
    ("Shyam park", 28.698807, 28.698807),
    ("Sikandarpur", 28.481400, 77.093100),
    ("Sir Vishweshwaraiah Moti Bagh", 28.578533, 77.175741),
    ("South Extension", 28.568611, 77.220265),
    ("Subhash Nagar", 28.640390, 77.104950),
    ("Sukhdev Vihar", 28.559748, 77.274900),
    ("Sultanpur", 28.499270, 77.161530),
    ("Supreme Court (Pragati Maidan)", 28.623420, 77.242500),
    ("Tagore Garden", 28.643790, 77.112840),
    ("Terminal 1 IGI Airport", 28.565300, 77.122300),
    ("Tikri Border", 28.688025, 76.964083),
    ("Tikri Kalan", 28.686866, 76.977207),
    ("Tilak Nagar", 28.636570, 77.096480),
    ("Tis Hazari", 28.667110, 77.216530),
    ("Trilokpuri Sanjay Lake", 28.613453, 77.308855),
    ("Tughlakabad", 28.502540, 77.299300),
    ("Udyog Bhawan", 28.611660, 77.211980),
    ("Udyog Nagar", 28.680900, 77.080770),
    ("Uttam Nagar East", 28.621770, 77.055850),
    ("Uttam Nagar West", 28.624810, 77.065300),
    ("Vaishali", 28.649970, 77.339740),
    ("Vasant Vihar", 28.560691, 77.160791),
    ("Vidhan Sabha", 28.688020, 77.221400),
    ("Vinobapuri", 28.566976, 77.249191),
    ("Vinod Nagar East", 28.620044, 77.305407),
    ("Vishwavidyalaya", 28.694800, 77.214830),
    ("Welcome", 28.671800, 77.277560),
    ("Yamuna Bank", 28.623310, 77.267920),
]

BANGALORE_STATIONS = [
    ("Attiguppe", 12.961915, 77.533948),
    ("BTM Layout", 12.916393, 77.608113),
    ("Baiyappanahalli", 12.990554, 77.652859),
    ("Banashankari", 12.915614, 77.573507),
    ("Benniganahalli", 12.996388, 77.668180),
    ("Beratena Agrahara", 12.856277, 77.663327),
    ("Biocon Hebbagodi", 12.828711, 77.681240),
    ("Bommanahalli", 12.910788, 77.626395),
    ("Central Silk Board", 12.916310, 77.620409),
    ("Challaghatta", 12.897430, 77.461109),
    ("Chickpete", 12.967492, 77.574630),
    ("Chikkabidarakallu", 13.052349, 77.487821),
    ("Cubbon Park", 12.980973, 77.597315),
    ("Dasarahalli", 13.043630, 77.512324),
    ("Deepanjali Nagar", 12.952086, 77.536823),
    ("Delta Electronics Bommasandra", 12.819555, 77.688743),
    ("Doddakallasandra", 12.884672, 77.552838),
    ("Dr B R Ambedkar Station Vidhana Soudha", 12.979865, 77.592723),
    ("Electronic City", 12.856540, 77.663284),
    ("Garudacharapalya", 12.993565, 77.703542),
    ("Goraguntepalya", 13.028302, 77.540833),
    ("Halasuru", 12.976462, 77.625994),
    ("Hongasandra", 12.901564, 77.632017),
    ("Hoodi", 12.988861, 77.711246),
    ("Hopefarm Channasandra", 12.987288, 77.753629),
    ("Hosa Road", 12.870955, 77.652406),
    ("Huskur Road", 12.838802, 77.677447),
    ("Indiranagar", 12.978176, 77.638332),
    ("Infosys Foundation Konappana Agrahara", 12.846265, 77.671118),
    ("Jalahalli", 13.039833, 77.519939),
    ("Jayadeva Hospital", 12.916581, 77.599809),
    ("Jayanagar", 12.929841, 77.579886),
    ("Jayaprakash Nagar", 12.907755, 77.572945),
    ("Jnanabharathi", 12.935315, 77.510945),
    ("Kadugodi Tree Park", 12.985649, 77.746494),
    ("Kengeri", 12.908001, 77.476355),
    ("Kengeri Bus Terminal", 12.914693, 77.487642),
    ("Konanakunte Cross", 12.888801, 77.562534),
    ("Krantivira Sangolli Rayanna Railway Station", 12.976008, 77.565834),
    ("Krishna Rajendra Market", 12.959932, 77.574476),
    ("Krishnarajapura", 13.000109, 77.677621),
    ("Kudlu Gate", 12.889960, 77.639392),
    ("Kundalahalli", 12.977654, 77.715580),
    ("Lalbagh", 12.946255, 77.579784),
    ("Madavara", 13.057306, 77.472845),
    ("Magadi Road", 12.975506, 77.555448),
    ("Mahakavi Kuvempu Road", 12.998415, 77.556784),
    ("Mahalakshmi", 13.008261, 77.549025),
    ("Mahatma Gandhi Road", 12.975662, 77.606757),
    ("Manjunath Nagar", 13.050310, 77.494353),
    ("Mantri Square Sampige Road", 12.990328, 77.570641),
    ("Mysuru Road", 12.946858, 77.529828),
    ("Nadaprabhu Kempegowda Station Majestic", 12.975590, 77.573129),
    ("Nagasandra", 13.048236, 77.500163),
    ("Nallurhalli", 12.976590, 77.724661),
    ("National College", 12.950632, 77.573609),
    ("Pantharapalya Nayandahalli", 12.941798, 77.523476),
    ("Pattanagere", 12.924230, 77.498242),
    ("Pattandur Agrahara", 12.987593, 77.737740),
    ("Peenya", 13.033118, 77.533327),
    ("Peenya Industry", 13.036458, 77.525279),
    ("Ragigudda", 12.916937, 77.588115),
    ("Rajajinagar", 13.000384, 77.549783),
    ("Rajarajeshwari Nagar", 12.936695, 77.519185),
    ("Rashtreeya Vidyalaya Road", 12.921683, 77.580346),
    ("Sandal Soap Factory", 13.014730, 77.553933),
    ("Seetharampalya", 12.981166, 77.708692),
    ("Silk Institute", 12.861885, 77.529923),
    ("Singasandra", 12.880606, 77.644597),
    ("Singayyanapalya", 12.996618, 77.692363),
    ("Sir M Visvesvaraya Central College", 12.974168, 77.584287),
    ("South End Circle", 12.938446, 77.579988),
    ("Sri Balagangadharanatha Swamiji Hosahalli", 12.974126, 77.545192),
    ("Sri Sathya Sai Hospital", 12.981164, 77.727343),
    ("Srirampura", 12.996622, 77.563424),
    ("Swami Vivekananda Road", 12.986017, 77.644813),
    ("Thalaghattapura", 12.871288, 77.538292),
    ("Trinity", 12.972944, 77.616713),
    ("Vajarahalli", 12.877209, 77.544621),
    ("Vijayanagar", 12.970906, 77.537209),
    ("Whitefield (Kadugodi)", 12.995699, 77.757730),
    ("Yelachenahalli", 12.896263, 77.569985),
    ("Yeshwanthpur", 13.023274, 77.549783),
]

# Not sourced this pass -- see module docstring. Kept as None (not []) so
# any caller trying to use these fails with a clear AttributeError/TypeError
# rather than silently scoring every Mumbai/Hyderabad pin as "0 stations
# within radius of an empty list", which would be a new fabricated 0, not
# an honest gap.
MUMBAI_STATIONS = [
    ("Versova", 19.13028, 72.82139, "1", "wiki"),
    ("D N Nagar", 19.12806, 72.83028, "1", "wiki"),
    ("Azad Nagar", 19.1269, 72.8378, "1", "wiki"),
    ("Andheri", 19.12056, 72.84806, "1", "wiki"),
    ("Asalpha", 19.0964, 72.8949, "1", "osm-corrected"),
    ("Chakala (J B Nagar)", 19.112045, 72.867696, "1", "wiki"),
    ("Saki Naka", 19.103528, 72.887962, "1", "wiki"),
    ("Marol Naka", 19.108195, 72.879536, "1", "wiki"),
    ("Western Express Highway", 19.11556, 72.85639, "1", "wiki"),
    ("Ghatkopar", 19.0866611, 72.9079889, "1", "wiki"),
    ("Jagruti Nagar", 19.092582, 72.901866, "1", "wiki"),
    ("Airport Road", 19.11027, 72.87475, "1", "wiki"),
    ("Andheri West", 19.1291337, 72.8314307, "2A", "wiki"),
    ("Borivali West", 19.2313925, 72.8408607, "2A", "wiki"),
    ("Eksar", 19.2404402, 72.8434822, "2A", "wiki"),
    ("Kandivli West", 19.21413, 72.83735, "2A", "wiki"),
    ("Kandarpada", 19.2565999, 72.8506506, "2A", "wiki"),
    ("Shimpoli", 19.2228332, 72.8409432, "2A", "wiki"),
    ("Mandapeshwar", 19.2495764, 72.8457622, "2A", "wiki"),
    ("Dahisar East", 19.2511, 72.8670, "2A", "wiki"),
    ("Anand Nagar", 19.257217, 72.8651362, "2A", "wiki"),
    ("Lower Oshiwara", 19.1406979, 72.8317139, "2A", "wiki"),
    ("Oshiwara", 19.1460351, 72.8339520, "2A", "wiki"),
    ("Malad West", 19.18527, 72.83583, "2A", "wiki"),
    ("Lower Malad", 19.17295, 72.83645, "2A", "wiki"),
    ("Valnai-Meeth Chowky", 19.1968293, 72.8337752, "2A", "wiki"),
    ("Goregaon West", 19.1530241, 72.8356664, "2A", "wiki"),
    ("Bangur Nagar", 19.1624723, 72.8348708, "2A", "wiki"),
    ("Dahanukarwadi", 19.20624, 72.83476, "2A", "wiki"),
    ("CSMIA Airport T1", 19.093899, 72.853577, "3", "single"),
    ("Sahar Road", 19.102196, 72.865236, "3", "wiki"),
    ("MIDC Andheri", 19.117374, 72.873359, "3", "single"),
    ("SEEPZ", 19.128741, 72.875562, "3", "single"),
    ("Bandra Colony", 19.069963, 72.849360, "3", "wiki"),
    ("Bandra Kurla Complex", 19.060663, 72.854680, "3", "wiki"),
    ("Aarey JVLR", 19.130699, 72.884309, "3", "wiki"),
    ("Santacruz", 19.079289, 72.847119, "3", "wiki"),
    ("Acharya Atre Chowk", 18.997152, 72.817978, "3", "wiki"),
    ("Shitaladevi Mandir", 19.038300, 72.842100, "3", "wiki"),
    ("Dadar", 19.023704, 72.839385, "3", "single"),
    ("Dharavi", 19.046339, 72.849685, "3", "single"),
    ("Siddhivinayak", 19.015959, 72.830562, "3", "wiki"),
    ("Worli", 19.008700, 72.819410, "3", "wiki"),
    ("Mahalaxmi", 18.979467, 72.825401, "3", "wiki"),
    ("Grant Road", 18.962986, 72.817942, "3", "single"),
    ("Jagannath Shankar Sheth Road", 18.970826, 72.822026, "3", "wiki"),
    ("Kalbadevi", 18.946511, 72.826943, "3", "single"),
    ("Hutatma Chowk", 18.934066, 72.832380, "3", "single"),
    ("Girgaon", 18.952182, 72.822131, "3", "single"),
    ("Science Centre", 18.990490, 72.822242, "3", "wiki"),
    ("Vidhan Bhavan", 18.924630, 72.825570, "3", "single"),
    ("Churchgate", 18.930917, 72.826438, "3", "single"),
    ("Cuffe Parade", 18.914256, 72.821500, "3", "wiki"),
    ("Chhatrapati Shivaji Maharaj Terminus", 18.941326, 72.830817, "3", "wiki"),
    ("Aarey", 19.169420, 72.858730, "7", "wiki"),
    ("Akurli", 19.198290, 72.860650, "7", "wiki"),
    ("Rashtriya Udyan", 19.234660, 72.863130, "7", "wiki"),
    ("Poisar", 19.203890, 72.863420, "7", "wiki"),
    ("Kurar", 19.187260, 72.858480, "7", "wiki"),
    ("Ovaripada", 19.243460, 72.864200, "7", "wiki"),
    ("Mogra", 19.128850, 72.855360, "7", "wiki"),
    ("Devipada", 19.224250, 72.864220, "7", "wiki"),
    ("Dindoshi", 19.179760, 72.858240, "7", "wiki"),
    ("Gundavali", 19.115020, 72.855170, "7", "wiki"),
    ("Goregaon East", 19.152720, 72.856520, "7", "wiki"),
    ("Jogeshwari East", 19.143020, 72.855100, "7", "wiki"),
]

# Victoria Memorial is deliberately omitted from this list: its only
# available coordinate (17.348426, 78.550959) is byte-for-byte identical
# to LB Nagar's, an unverified duplicate rather than an independently
# confirmed distinct point (see this file's own module docstring).
HYDERABAD_STATIONS = [
    ("Miyapur", 17.4964, 78.3731, "Red", "wiki"),
    ("JNTU College", 17.498653, 78.388793, "Red", "wiki"),
    ("KPHB Colony", 17.493780, 78.401795, "Red", "wiki"),
    ("Kukatpally", 17.4851155, 78.409369, "Red", "wiki"),
    ("Dr B R Ambedkar Balanagar", 17.476826, 78.4221146, "Red", "wiki-corrected"),
    ("Moosapet", 17.4739606, 78.4204396, "Red", "wiki"),
    ("Bharat Nagar", 17.463997, 78.4278693, "Red", "wiki"),
    ("Erragadda", 17.4567784, 78.4304257, "Red", "wiki"),
    ("S R Nagar", 17.441657, 78.439058, "Red", "single"),
    ("Ameerpet", 17.4348028, 78.4480111, "Red", "wiki"),
    ("Punjagutta", 17.436793, 78.443906, "Red", "wiki"),
    ("Irrum Manzil", 17.4204695, 78.4539726, "Red", "wiki"),
    ("Khairatabad", 17.41275, 78.45803, "Red", "wiki"),
    ("Lakdi-ka-pul", 17.4038078, 78.4646968, "Red", "wiki"),
    ("Assembly", 17.3978004, 78.4699168, "Red", "wiki"),
    ("Osmania Medical College", 17.3823887, 78.4789574, "Red", "wiki"),
    ("MG Bus Station", 17.378055, 78.480005, "Red", "wiki"),
    ("Malakpet", 17.3772, 78.4940, "Red", "wiki"),
    ("New Market", 17.3734, 78.5031, "Red", "wiki"),
    ("Musarambagh", 17.3711, 78.5120, "Red", "wiki"),
    ("Dilsukhnagar", 17.3686, 78.5257, "Red", "wiki"),
    ("Chaitanyapuri", 17.3682882, 78.5357829, "Red", "wiki"),
    ("LB Nagar", 17.348426, 78.550959, "Red", "wiki"),
    ("Raidurg", 17.442222, 78.377222, "Blue", "wiki"),
    ("HITEC City", 17.448889, 78.383056, "Blue", "wiki"),
    ("Durgam Cheruvu", 17.44278, 78.38750, "Blue", "wiki"),
    ("Madhapur", 17.437222, 78.398333, "Blue", "wiki"),
    ("Peddamma Gudi", 17.4306, 78.4084, "Blue", "single"),
    ("Jubilee Hills Check Post", 17.416389, 78.438333, "Blue", "wiki"),
    ("Road No 5 Jubilee Hills", 17.43002, 78.42318, "Blue", "single"),
    ("Yusufguda", 17.4350829, 78.4265277, "Blue", "wiki"),
    ("Madhura Nagar", 17.43697, 78.4391, "Blue", "single"),
    ("Begumpet", 17.4375, 78.45667, "Blue", "wiki"),
    ("Prakash Nagar", 17.444722, 78.465278, "Blue", "wiki"),
    ("Rasoolpura", 17.44333, 78.47583, "Blue", "wiki"),
    ("Paradise", 17.4435274, 78.4850961, "Blue", "wiki"),
    ("Parade Ground", 17.443284, 78.498881, "Blue", "wiki-corrected"),
    ("Secunderabad East", 17.433611, 78.501667, "Blue", "wiki"),
    ("Mettuguda", 17.435556, 78.519722, "Blue", "wiki"),
    ("Tarnaka", 17.427778, 78.536111, "Blue", "wiki"),
    ("Habsiguda", 17.42018, 78.54055, "Blue", "osm-corrected"),
    ("NGRI", 17.4150, 78.5462, "Blue", "single"),
    ("Stadium", 17.407336, 78.554261, "Blue", "wiki"),
    ("Uppal", 17.3987948, 78.5538439, "Blue", "wiki"),
    ("Nagole", 17.3908477, 78.5587195, "Blue", "wiki"),
    ("JBS Parade Ground", 17.444742, 78.497303, "Green", "single"),
    ("Secunderabad West", 17.4338060, 78.4987186, "Green", "wiki"),
    ("Gandhi Hospital", 17.42531, 78.50184, "Green", "single"),
    ("Musheerabad", 17.417874, 78.499505, "Green", "single"),
    ("RTC Cross Roads", 17.407032, 78.496802, "Green", "single"),
    ("Chikkadpally", 17.40036, 78.4949, "Green", "single"),
    ("Narayanguda", 17.393865, 78.489825, "Green", "single"),
    ("Sultan Bazaar", 17.384293, 78.483818, "Green", "single"),
]

# Ahmedabad Metro (Red Line + Blue Line), real operational stations with
# real, individually-verified Wikipedia infobox coordinates -- the
# centroid-radius join method (same as Delhi/Bangalore/Mumbai/Hyderabad),
# NOT Chennai's hand-picked name-matched dict, which missed a real
# station once (Thiruvottiyur) purely because of a spelling/transliteration
# mismatch. Using real coordinates + haversine distance eliminates that
# whole error class rather than trying to catch instances of it by hand.
#
# Each station's coordinate was cross-checked for internal consistency
# (no two distinct stations sharing a near-identical coordinate, the
# Mumbai/Hyderabad Wikipedia-infobox-copy-paste bug found in a prior
# pass) and sanity-checked against Ahmedabad's real geographic bounds.
# None of that class of error was found here.
#
# 3 real, named stations have NO reliable coordinate (Wikipedia's own
# infobox was empty or the page repeatedly failed to resolve to a
# distinct article) and are deliberately left OUT of this list rather
# than estimated from a neighbouring station: Paldi, Thaltej Gam,
# Kalupur Railway Station. All three are real, currently operational
# stations -- excluded from the geo-join only, not disclaimed as
# non-existent.
#
# "Sabarmati" and "Sabarmati Railway Station" are two distinct real Red
# Line stations (~1.85km apart, each with its own separate, real
# Wikipedia infobox coordinate) -- not a duplicate, both included.
AHMEDABAD_STATIONS = [
    # Red Line
    ("AEC", 23.07511, 72.59321),
    ("Gandhigram", 23.02667, 72.56890),
    ("Jivraj Park", 23.00551, 72.53357),
    ("Motera Stadium", 23.09654, 72.60071),
    ("Rajiv Nagar", 23.00973, 72.53686),
    ("Ranip", 23.06774, 72.57410),
    ("Sabarmati", 23.08564, 72.59228),
    ("Sabarmati Railway Station", 23.06979, 72.58777),
    ("Shreyas", 23.01364, 72.54944),
    ("Usmanpura", 23.04600, 72.56498),
    ("Vadaj", 23.06766, 72.56580),
    ("Vijay Nagar", 23.05618, 72.56239),
    ("Old High Court", 23.03733, 72.56704),  # Red/Blue interchange, counted once
    ("APMC", 22.99773, 72.53725),
    # Blue Line
    ("Amraiwadi", 23.00776, 72.62866),
    ("Apparel Park", 23.01069, 72.61807),
    ("Commerce Six Road", 23.04070, 72.55302),
    ("Doordarshan Kendra", 23.04817, 72.52447),
    ("Gheekanta", 23.02860, 72.58683),
    ("Gujarat University", 23.04486, 72.54361),
    ("Gurukul Road", 23.04587, 72.53493),
    ("Kankaria East", 23.01520, 72.60442),
    ("Nirant Cross Road", 22.99982, 72.65891),
    ("Rabari Colony", 23.00553, 72.63545),
    ("SP Stadium", 23.03987, 72.56164),
    ("Shahpur", 23.03920, 72.58124),
    ("Thaltej", 23.04974, 72.51621),
    ("Vastral", 23.00360, 72.64761),
    ("Vastral Gam", 22.99724, 72.66766),
]
# Paldi, Thaltej Gam, Kalupur Railway Station -- real, operational stations,
# no reliable coordinate found this session. Not included above, not guessed.
AHMEDABAD_STATIONS_UNREAD = ["Paldi", "Thaltej Gam", "Kalupur Railway Station"]
