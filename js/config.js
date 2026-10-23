// Central configuration for the prototype. Tune values here rather than in the modules.

export const CONFIG = {
  // Fake user position: Gärdet tunnelbana station, Tegeluddsvägen exit
  // (OSM node 197670779). The station's own node (18.098877, 59.345877) lies mid-block
  // with almost no bus stops in view; the exit matches the reference screenshots.
  userLocation: [18.10144, 59.34774], // [lng, lat]
  userHeading: 0, // degrees clockwise from north, direction of the heading cone

  // Default camera = street level, matching reference/zoom-4-street-default.png.
  // Note: MapLibre uses 512 px tiles, so its zoom is ~1 lower than 256-px-tile apps.
  defaultZoom: 14.5,
  minZoom: 9,
  maxZoom: 19,
  // The map fills the whole screen; the dot sits a few px above the screen centre
  // like in the reference (y ≈ 420 of 852 pt). Extra bottom padding moves it up.
  cameraPadding: { top: 0, bottom: 12, left: 0, right: 0 },

  // Scenario clock: the test takes place in the evening. The phone's clock, departures and
  // journeys start at this time (today) and run on from there. null = real time.
  scenarioTime: '18:30',

  // Stop visibility thresholds (MapLibre zoom levels).
  stopsDotMinZoom: 11.8, // below: no stops (zoom-1-city)
  stopsIconMinZoom: 14, // from here: rounded-square icons (zoom-4-street)

  // Sources
  styleUrl: './map-style.json',
  stopsUrl: './data/stops.geojson',
  departuresUrl: './data/departures.json', // sample departures for favourite cards
  searchIndexUrl: './data/search-index.json', // all SL-area stops + municipality

  // Stop search: also match å/ä/ö when typed as a/o (testers may lack a Swedish keyboard).
  searchFoldDiacritics: true,

  // Approximate zoom of each reference screenshot (for side-by-side checks:
  // open index.html?z=1 … ?z=4).
  referenceZooms: { 1: 10.7, 2: 12.9, 3: 13.6, 4: 14.5 },
};
