# SL Map – baseline prototype

Mobile web prototype that recreates the default **Map** module of the SL app (dark mode)
as the baseline condition for a KTH HCI master's thesis on a "tourist mode".
Static site: no backend, no build step. Participants open the shared link **on a computer**. The app runs inside an
iPhone 15 Pro mockup (fixed 393×852 pt screen), scaled to fit the browser window's height.
They pan by dragging, zoom with the scroll wheel or trackpad pinch, and drag the bottom sheet with the mouse.

> Research prototype. Not affiliated with SL; no SL logo or assets are used.

## Two test versions (A / B)

The study compares two versions. Participants get two links:

| Version | Link (GitHub Pages) | Local |
|---|---|---|
| A: baseline, the SL app as it is | `https://<user>.github.io/<repo>/a/` | http://localhost:8080/a/ |
| B: redesign | `https://<user>.github.io/<repo>/b/` | http://localhost:8080/b/ |

The neutral names (a / b) don't reveal which version is the original.

- **Shared code:** both versions run the same code. `a/index.html` and `b/index.html` only set
  `<html data-variant="a|b">` and `<base href="../">`. They are generated from `index.html`; after editing
  `index.html`, run:
  ```bash
  node scripts/make-entries.mjs
  ```
- **Version B's changes:** they live only in `js/b/` (entry: `js/b/index.js`, called from `js/ui.js` when the version
  is B) and `css/b.css`. Version A never loads them, so A stays the baseline.
- **Separate storage:** each version keeps its own favourites and history (`sl-proto-v1-a` / `sl-proto-v1-b` in
  localStorage), so a participant who tests both starts clean in each. `?reset` wipes both.
- **Baseline snapshot:** git tag `baseline-v1` marks version A as finished before work on B started.
- The root URL (`/`) also opens version A, for development.

## Run locally

```bash
python3 scripts/serve.py
```

This serves the folder on port 8080 with caching disabled, and prints two URLs:

- `http://localhost:8080` for this computer
- `http://<your-LAN-IP>:8080` for another device on the **same Wi-Fi**.
  On macOS you can find the IP with `ipconfig getifaddr en0`.
  If the other device can't connect, allow incoming connections for Python in
  System Settings → Network → Firewall, and check the Wi-Fi has no "client isolation" (common on guest/eduroam networks).

Any static server works too (e.g. `npx serve -l 8080`), but plain `python3 -m http.server` lets browsers
cache JS modules, so you may need a hard reload after edits.

### Handy URL parameters

| URL | Effect |
|---|---|
| `?z=1` … `?z=4` | Start at the zoom of reference screenshot 1–4 |
| `?zoom=13.2` | Start at any zoom |

In the browser console, `slMap` is the MapLibre map (e.g. `slMap.getZoom()`).

## Deploy to GitHub Pages

1. Create a GitHub repository and push this folder to it (the root of the repo = this folder).
   ```bash
   git init && git add . && git commit -m "Baseline map prototype"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch `main`, folder `/ (root)`. Save.
3. After a minute the site is live at `https://<user>.github.io/<repo>/`. Share that link with participants.

All paths are relative, so it works under the `/<repo>/` sub-path. `.nojekyll` disables Jekyll processing.
Consider leaving `reference/` out of a public repo if the screenshots shouldn't be published.

## Project structure

```
index.html            page shell + static overlay markup (shared by both versions)
a/index.html          version A entry (generated)
b/index.html          version B entry (generated)
js/variant.js         which version is running ('a' or 'b')
js/b/, css/b.css      version B (redesign) only
css/app.css           all styling; design tokens (incl. --font-ui) at the top
js/config.js          location, zoom levels, stop thresholds, data URLs  ← tune here
js/map.js             MapLibre map, icon loading, stop layers, user-location marker
js/sheet.js           draggable bottom sheet (collapsed / default / expanded)
js/search-panel.js    full-screen stop search (opens from the sheet's search field)
js/favorites.js       favourite cards in the sheet + "Add favorite"
js/stop-page.js       stop page in the sheet (mode / line chips, departures per mode)
js/departures.js      sample departure schedules (listed + generated services)
js/departure-row.js   shared markup for departure rows and line badges
js/travel.js          Travel tab: Plan journey + Journey results
js/journeys.js        sample journey planner (no real routing)
js/time-picker.js     "When do you want to travel?" sheet
js/filters-sheet.js   Travel Filters sheet
js/stop-index.js      loads the shared stop list once
js/store.js           favourites + search history (localStorage), shared by sheet and search page
js/stop-search.js     search matching + ranking (no DOM)
js/keyboard.js        simulated iOS keyboard (dark)
js/device.js          fits the iPhone mockup to the window
js/ui.js              entry point: wires sheet, favourites, search, buttons; page-zoom lock
map-style.json        custom dark MapLibre style (OpenMapTiles schema, OpenFreeMap tiles)
data/stops.geojson    bus stops + metro stations (static, from OSM)
data/departures.json  sample services (lines, end stations, headway) per stop
data/search-index.json  all stops in Stockholm County: name, municipality, modes, position
icons/                SVG icons: stops, POI categories, road shield
assets/hotel-room.jpg page background for the test scenario (see "Test scenario")
js/ambience.js        hotel-room ambient sound (Web Audio, no file)
js/clock.js           scenario clock (starts at CONFIG.scenarioTime, e.g. 18:30)
scripts/fetch-stops.mjs  regenerates data/stops.geojson from the Overpass API
scripts/fetch-search-index.mjs  regenerates data/search-index.json from the Overpass API
scripts/serve.py      no-cache LAN dev server
scripts/make-entries.mjs  generates a/index.html and b/index.html from index.html
reference/            SL screenshots + comparison image
```

To add tourist-mode features later: add a new module (e.g. `js/tourist.js`) that receives the
MapLibre `map` from `createMap()` in `ui.js` and adds its own sources/layers.
The base style and stop layers stay untouched.

## Map details

The SL app uses the phone's system map: Apple Maps on iOS, as in the reference screenshots.
Apple MapKit JS was considered. It needs a paid Apple Developer membership ($99/year) to get a key,
so the prototype stays free: OpenFreeMap tiles with a custom style tuned to look like Apple Maps dark mode.

- **Tiles:** [OpenFreeMap](https://openfreemap.org) vector tiles (no API key), OpenMapTiles schema.
  Attribution (OpenFreeMap, OpenMapTiles, OpenStreetMap) is shown small, top left.
- **Library:** MapLibre GL JS 4.7.1 from unpkg. **Font:** Special Gothic (Google Fonts, close to SL's typeface), swappable via `--font-ui`.
- **Fake location:** Gärdet T, Tegeluddsvägen exit (59.34774, 18.10144). Testers are usually not in Stockholm,
  so the device's real location is never requested; everyone is placed at Gärdet. This is the spot that reproduces the reference screenshots.
  The station's own OSM node (59.345877, 18.098877) lies mid-block with almost no stops in view.
  Change it in `js/config.js`.
- **Zoom mapping:** MapLibre uses 512-px tiles, so its zoom numbers are about 1 lower than in many native SDKs.
  Calibrated against the screenshots:

  | Screenshot | MapLibre zoom | Stops |
  |---|---|---|
  | zoom-1-city | ≈10.7 | none (< 11.8) |
  | zoom-2-district | ≈12.9 | sparse dots (collision-thinned) |
  | zoom-3-neighbourhood | ≈13.6 | denser dots |
  | zoom-4-street-default | 14.5 (default) | rounded-square icons (≥ 14) |

### Regenerating stop data

```bash
node scripts/fetch-stops.mjs
```

Needs Node 18+. The script queries `highway=bus_stop`, `public_transport=platform` + `bus=yes` and
`station=subway` in the bounding box Östermalm–Gärdet–Ropsten–Mörby centrum (+ western Lidingö).
It merges duplicates within 20 m and retries on mirror servers if overpass-api.de is busy.
Data © OpenStreetMap contributors (ODbL).

## Desktop mockup

- `index.html` wraps the app in `.device` → `.screen` (393×852 pt, iPhone 15 Pro), with a simulated status bar,
  Dynamic Island and home indicator. Safe areas are fixed at 59 pt (top) and 34 pt (bottom), as on the real phone.
- `js/device.js` scales the whole device to the window height (20 px margin top and bottom; it also shrinks for narrow windows).
  The layout is not responsive: the app is always laid out at 393×852.
- At scales above 1 the map's pixel ratio is raised so it stays sharp. MapLibre maps mouse positions
  correctly through the CSS scale, and the bottom sheet converts drag distances into screen points.
- Ctrl+wheel (trackpad pinch) is blocked on the page, so only the map zooms, never the browser page.
- Page background and frame colours are the `--page-bg` / `--bezel` tokens in `css/app.css`.

## Stop search

Tapping "Search stop/station" slides up a full-screen search panel (dark SL style) with a simulated iOS keyboard.
With an empty field the page lists the user's **Favourites** and **Search history**. On a first visit
both are empty, so nothing is shown below the field.

- **Typing:** on-screen keys, or the computer keyboard (captured globally, so no OS input method such as
  Chinese pinyin interferes). The matching on-screen key flashes. Paste (⌘/Ctrl+V) also works.
- **Keyboard visibility:** tapping anywhere outside the keyboard and the field hides the keyboard.
  Tapping the field, or typing, brings it back. Esc hides the keyboard, and a second Esc closes the panel.
- **Rules** (`js/stop-search.js`):
  - **Empty field:** nothing is shown.
  - **1 letter:** "Enter at least two letters".
  - **2+ letters:** a stop qualifies if its name, or a word in it, starts with the first two letters.
    Qualifying stops are ranked by similarity to the whole query: longest matching start, then edit distance,
    then stations before bus stops, then shorter names. Results stay listed when letter 3+ doesn't match,
    so typos still find the stop ("karlpaln" → Karlaplan).
  - **No stop matches the first two letters:** "No search results", and Enter does nothing.
- **Matching details:** case-insensitive, ignores hyphens and spaces ("tcentralen" → T-Centralen).
  `searchFoldDiacritics` in `js/config.js` lets a/o match å/ä/ö (on by default; set it to false for strict Swedish letters).
- **Enter / search key / tapping a result:** picks that stop, records it in the search history and opens its
  stop page.
- **Data:** `data/search-index.json` holds 5,908 stops (bus, metro, train, tram, ferry) from OpenStreetMap,
  covering all 26 municipalities of Stockholm County. Regenerate it with `node scripts/fetch-search-index.mjs`.

## Favourites and search history (one shared store)

`js/store.js` keeps the favourites and the search history in **localStorage**, so they survive reloads.
The sheet's favourite cards and the search page's lists both read from it, and any change shows up everywhere at once.

- **First visit:** no favourites and no history.
  - The sheet shows the empty card ("You have no favorites added") with "+ Add favorite".
  - The search page shows nothing below the field.
- **Add favorite:** opens the same search page in favourite mode. Picking a stop (tap a result, or press Enter
  for the first one) closes the page, returns the sheet to the default position and adds the stop as a favourite.
  New favourites go first, so the new card is visible at once.
- **Search page lists:** with an empty field it shows "Favourites" (filled stars) and "Search history"
  (outline star = not a favourite yet), with "Clear" for the history. Tapping a star toggles the favourite;
  tapping a row picks that stop.
- **Search history:** a stop is added whenever it is picked from typed results (newest first, max 10).
- **Favourite cards:** show the stop's next 3 departures (see "Stop page" for where they come from).
  Tapping a card opens the stop page.
- **Journey history:** Travel keeps its own Search history of From → To pairs (with stars), in the same store.
- **Reset:** open the link with `?reset` (e.g. `https://<user>.github.io/<repo>/?reset`) to wipe favourites,
  stop history and journey history, for example between test sessions on the same computer.

## Stop page

Opened by picking a stop in the search list, tapping a favourite card, or clicking a stop icon or dot on the map.

- **Map:** flies to the stop (zoom 16) and shows a large stop pin in the map area above the sheet.
- **Sheet:** switches to the stop page and returns to the default height.
  - **Header:** stop name, favourite star (shares the favourites store) and close (✕ returns to the default sheet).
  - **Mode chips:** one per mode at the stop (Metro, Commuter rail, Tram/light rail, Bus, Boat). Selecting one filters
    to that mode and reveals its line chips; selecting a line filters further. Tap a chip again to clear it.
    The filter button is visual only.
  - **Departures:** one section per mode (mode icon + stop name), with up to 12 departures each, in SL line colours.
    Badge shapes follow SL: rectangles for metro, train and bus, a slanted badge for tram/light rail, a flag for boats.
    Times show "Nu", "N min", or a clock time from 30 min on, and update every 30 s.
- **Expanded state:** pulled up to full height, the sheet turns opaque dark as in the SL app; the list then scrolls
  with the mouse wheel or trackpad.
- **Departure data:** there is no real-time data.
  - **Listed stops:** `data/departures.json` lists real SL lines, end stations and approximate headways for
    T-Centralen, Odenplan, Östermalmstorg, Karlaplan, Gärdet, Ropsten, Stadion, Tekniska högskolan, Universitetet,
    Mörby centrum, Mörby (Roslagsbanan) and Finnhamn.
  - **Other stops:** they get generated services, the same every time for a given stop. Metro and pendeltåg use real
    SL lines and end stations, which may not be the ones that actually serve that stop. Bus, tram and boat services
    use plausible line numbers, with destinations taken from real stop names in the same municipality.
  - **Listed stops with buses or boats:** generated services are added for those modes as well.
  - **Times:** each service runs both directions every `headway` minutes from the clock, so countdowns stay consistent.
- **Not built yet:** route lines on the map for a selected line, service notices (the orange warning boxes),
  and the departure detail page behind each row's chevron.

## Tab bar

- **Travel:** the journey planner, described below.
- **Map:** the map with its bottom sheet.
- **Tickets, More:** show "This page is not included in the test."

Switching tabs keeps each page's state, so the map position and the Travel results stay as they were.
The "Research prototype" label sits outside the phone, bottom-left of the browser window.

## Travel (journey planner)

- **Plan journey:** From / To (tap to pick; ⇅ swaps them), "Depart now" (time picker), Filters, Search, and the
  journey Search history. On a first visit the From / To fields and the history are empty.
  - **Picking From / To:** uses the same stop search page, with a "From" / "To" placeholder and a
    **My location** card on top. "My location" is the fake Gärdet position.
  - **Search with a field empty:** opens the picker for the missing field.
  - **History entries:** tapping one runs that search again; the star marks it as a favourite.
- **Time picker:** Departure time / Arrival time, wheels for day, hour and minute (24-hour; scroll or click a value),
  "Leave Now" and "Done". The label becomes e.g. "Depart 17:45" or "Arrive by Tomorrow 09:00".
- **Filters:** transport-type switches (Metro, Bus, Commuter rail, Tram/light rail, Ferry) are used by the planner.
  "Include nearby stops", "Local transport", "Bike at the start of the journey" and "Exclude line" are visual only.
  Clear resets; Done applies.
- **Journey results:** back button, From / To and time / filters (changing them searches again),
  "Faster journey" / "Fewer transfers", "Earlier journeys" / "Later journeys", and journey cards.
  Each card shows the times, the duration, "HH:MM from <stop>", and the legs (walk distance, mode icons,
  line badges). A day label such as "Tomorrow" appears when the first journey is not today. Tapping a journey
  does nothing yet.
- **How the sample journeys are built** (`js/journeys.js`; there is no real routing):
  - **From "My location":** a 130 m walk to Gärdet T.
  - **Shared line:** if both ends share a line in the sample services, it's a direct ride.
  - **Otherwise one transfer:**
    - **Between two rail lines:** at the listed stop served by both lines, nearest the destination
      (e.g. 13 → 14 at Östermalmstorg), else T-Centralen.
    - **Otherwise:** at the first line's stop nearest the destination.
  - **Times:** ride times come from distance and mode speed; waits follow the lines' sample schedules.
  - **Fewer transfers:** an extra, slower direct bus is added for trips under 30 km.
  - **Faster journey:** hides journeys that leave no later and arrive no earlier than another journey.
  - **Fewer transfers tab:** keeps only the journeys with the fewest transfers.

## Journey details

Tapping a journey in Journey results opens **Journey details** (`js/journey-details.js`):
- **Route map card:** a second map showing the route. Walks are dashed; rides use the line colour, with white stop dots
  and large circles where you board and alight; the fake user position is also shown. The card has locate and
  expand buttons; expand opens a full-screen "Map" with back. Wheel-zoom and dragging work only in full screen,
  so the page scrolls normally. Below the map: total time and number of transfers.
- **Ride cards:** departure and arrival times, ride duration, a bar in the line colour, the stop name with mode icon
  and line badge, sample "Track" / "Typically quiet" chips, "Metro Red line 13 toward Norsborg", and
  "Show / Hide N stops" with times at each intermediate stop.
- **Between rides:** walk and "Transfer to …" rows. At the bottom: price information
  ("SL Single journey ticket 43 kr", plus a Waxholmsbolaget note for boats).
- **Stops along a ride** (`js/routes.js`): real station sequences for metro lines 10, 11, 13, 14, 17, 18 and 19;
  for other modes, real stops of that mode along the corridor between the two ends.
  Ride times follow the path length.
- **Vehicle marker:** for metro rides, the route map shows the train of the first ride (line badge + arrow) between
  the previous station and the boarding station. It gets closer as departure approaches; this is a sample position,
  not live data.
- **Service notices:** `notices` in `data/departures.json` (per stop; currently the two notices from the SL screenshots:
  Östermalmstorg and Mörby). They show as an orange box on the stop page and in ride cards that start or end at
  that stop, and as ⚠ next to the line badge in Journey results.
- **Not built:** the "Adult" ticket-type choice, the "Read more" link, ticket purchase.

## Test scenario (page around the phone)

The page simulates a tourist using the app in an ordinary hotel room:
- **Background:** `assets/hotel-room.jpg`, "A hotel room with two beds and a nightstand" by hidefumi ohmichi
  (https://unsplash.com/photos/2vbt0ZHR_ds), Unsplash License (free to use, credit appreciated).
  Replace the file to change the scene. The `--page-bg` colour in `css/app.css` shows while it loads.
- **Phone:** the mockup frame only, with no drop shadow.
- **Time of day:** the scenario is an evening. `scenarioTime: '18:30'` in `js/config.js` sets the phone's clock to
  18:30 (today) when the page opens; it then runs normally. Departures, "Depart now", journey times, the time
  picker and the vehicle marker all use this clock (`js/clock.js`), so everything matches what the phone shows.
  Set it to `null` to use the computer's real time.
- **Ambient sound:** generated in the browser (`js/ambience.js`): soft brown noise (ventilation, distant traffic),
  a faint 50 Hz hum and a slow swell. Browsers only allow sound after a user action, so it fades in on the first
  click or key press. The "Ambient sound on/off" button (bottom-left, outside the phone) mutes it and remembers
  the choice in that browser. Change `VOLUME` in `js/ambience.js` to adjust the level. Testers should have sound
  enabled on their computer.
