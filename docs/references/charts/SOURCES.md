# Chart references — sources and licence basis

Reference material only (UI direction research, task 12bl). **Not shipped**: nothing in this folder is imported by
the app, the site or the store pages. Retrieved 2026-11-05.

## Licence basis

Every image here is a crop of a chart produced by the **United States federal government** — the Federal Aviation
Administration (FAA, Aeronautical Information Services), the U.S. Coast and Geodetic Survey (Department of Commerce)
and the Department of Commerce Aeronautics Branch / Bureau of Air Commerce. Works of the U.S. Government are not
subject to copyright in the United States (**17 U.S.C. § 105**); the FAA publishes its aeronautical charts and the
d-TPP as public, freely redistributable products. The Library of Congress scans are faithful photographic
reproductions of those public-domain sheets (a slavish reproduction adds no new copyright). No Jeppesen, Lufthansa,
airline, ICAO-state (DFS, IAA…) or game material is used. Crops are outdated and must never be used for navigation.

## How the files were obtained (network note)

The session's egress policy blocked `faa.gov`, `aeronav.faa.gov`, `loc.gov`, `tile.loc.gov`, `commons.wikimedia.org`,
`noaa.gov`, `usgs.gov`, `archives.gov` and `archive.org` (HTTP 403 on CONNECT). Only GitHub was reachable, so the
original public-domain images were taken **unmodified from public GitHub repositories that redistribute them** (pinned
to a commit below), then cropped / rescaled by us. The upstream original is listed for each file; anyone can verify
it there.

| Repository (retrieval route) | Commit | Contents used |
|---|---|---|
| `cam-rodriguez/aero-maps` | `6386e083a829b548c83261090f5d7c992d87042a` (2024-04-07) | Library of Congress IIIF downloads (25 %) of the Chicago sectional series, LoC `gct00089` |
| `zoro2026/faa107-quiz` | `b6bfef85c651c159e45abfea1441af094ff10b5f` (2026-10-22) | 1400 px excerpts of the FAA **Washington** sectional |
| `Jregalado89/interactive-VFR-chart` | `985bb64e9fed9af716da3288e9ef70f4a0e482c8` (2026-03-07) | excerpt of the FAA **Dallas–Ft Worth** terminal area chart |
| `jlmcgraw/GeoReferencePlates` | `bb146d9ea7e66affd33827ad32dd1bac3dae7704` (2018-01-23) | FAA d-TPP PDFs for Boston Logan (rendered at 300 dpi with `pdftoppm`) |

## Files

| # | File | Title / chart | Date | Upstream original (public domain) | Retrieved from |
|---|---|---|---|---|---|
| 01 | `01-lotnisko-sectional-bwi.jpg` | FAA Washington Sectional Aeronautical Chart — Baltimore/BWI, Glen Burnie, Fort Meade | current edition (c. 2025–26) | FAA VFR raster charts, `https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr/` | `zoro2026/faa107-quiz/img/bwi-baltimore.jpg`, crop 480,520–1000,900, ×2 |
| 02 | `02-lotnisko-tac-dfw.jpg` | FAA Dallas–Ft Worth Terminal Area Chart (VFR) — DFW Intl, Class B core | current edition (c. 2025–26) | same FAA VFR raster page (TAC) | `Jregalado89/interactive-VFR-chart/public/dfw-tac.png`, crop 520,280–920,580, ×2 |
| 03 | `03-lotnisko-diagram-bos.jpg` | FAA Airport Diagram AL-58, General Edward Lawrence Logan Intl (BOS) | d-TPP NE-1, 03 APR 2014 – 01 MAY 2014 | FAA d-TPP, `https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/` | `jlmcgraw/GeoReferencePlates/examples/BOS/MA-BOS-AIRPORT-DIAGRAM.pdf` |
| 04 | `04-lotnisko-szkice-1930.jpg` | "Airports and Fields" sketch sheet (verso of a Chicago airway chart), Aeronautics Branch, Dept. of Commerce — Decatur, Champaign, Rantoul, Bloomington | c. 1930–1934 (Aeronautics Branch era) | LoC `https://tile.loc.gov/image-services/iiif/service:gmd:gmd370m:g3701m:g3701pm:gct00089:ca000826v/full/pct:25/0/default.jpg` | `cam-rodriguez/aero-maps/images/raw/…ca000826v…jpg`, crop 480,215–1090,705, ×2 |
| 05 | `05-napisy-sectional-phl.jpg` | FAA Washington Sectional — Wilmington, New Castle, Delaware River | current edition (c. 2025–26) | FAA VFR raster page | `zoro2026/faa107-quiz/img/phl-philadelphia.jpg`, crop 0,560–760,1180 |
| 06 | `06-napisy-ils-naglowek.jpg` | FAA Instrument Approach Procedure "ILS or LOC RWY 4R", BOS — briefing strip (top third) | Amdt 10, 15 DEC 2011; d-TPP NE-1 APR 2014 | FAA d-TPP (as 03) | `jlmcgraw/GeoReferencePlates/examples/BOS/MA-BOS-ILS-OR-LOC-RWY-04R.pdf` |
| 07 | `07-napisy-tytul-1949.jpg` | Chicago (U-7) Sectional Aeronautical Chart, U.S. Coast and Geodetic Survey — title block + airport legend | base ed. Feb 1947, revised Nov 1949 | LoC `…gct00089:ca000800/full/pct:25/0/default.jpg` | `cam-rodriguez/aero-maps`, crop 40,1555–800,1725, ×2 |
| 08 | `08-farby-sectional-dov.jpg` | FAA Washington Sectional — Delaware Bay, Dover AFB | current edition (c. 2025–26) | FAA VFR raster page | `zoro2026/faa107-quiz/img/dov-dover-afb.jpg`, crop 380,0–1400,820 |
| 09 | `09-farby-chicago-1956.jpg` | Chicago Sectional Aeronautical Chart, U.S. Coast and Geodetic Survey — Lake Michigan shore | base ed. June 1956 | LoC `…gct00089:ca000785r/full/pct:25/0/default.jpg` | `cam-rodriguez/aero-maps`, crop 1300,0–2300,640 |
| 10 | `10-farby-chicago-1935.jpg` | Chicago Sectional Airway Map, C&GS for the Bureau of Air Commerce — Lake Michigan shore | Nov 1935 | LoC `…gct00089:ca000820/full/pct:25/0/default.jpg` | `cam-rodriguez/aero-maps`, crop 1100,40–2050,660 |
| 11 | `11-margines-legenda-1944.jpg` | Chicago (U-7) Sectional Aeronautical Chart — legend (airports, beacons, radio) | 27 Apr 1944 | LoC `…gct00089:ca000810/full/pct:25/0/default.jpg` | `cam-rodriguez/aero-maps`, crop 1860,1520–2480,1828, ×2 |
| 12 | `12-margines-skale-1956.jpg` | Chicago Sectional, C&GS — triple scale bar (km / NM / statute), neatline, title block | base ed. June 1956 | LoC `…gct00089:ca000785r/full/pct:25/0/default.jpg` | `cam-rodriguez/aero-maps`, crop 40,1560–1000,1735, ×2 |
| 13 | `13-trasy-radiolatarnie-1949.jpg` | Chicago (U-7) Sectional, C&GS — radio-range legs as translucent magenta bands | base ed. Feb 1947, revised Nov 1949 | LoC `…gct00089:ca000800/full/pct:25/0/default.jpg` | `cam-rodriguez/aero-maps`, crop 1000,0–2100,760 |
| 14 | `14-trasy-rnav-celtk.jpg` | FAA SID "CELTK THREE DEPARTURE (RNAV)", BOS | d-TPP NE-1, APR 2014 | FAA d-TPP (as 03) | `jlmcgraw/GeoReferencePlates/examples/BOS/MA-BOS-CELTK-THREE-RNAV.pdf` |
| 15 | `15-trasy-star-gardner.jpg` | FAA STAR "GARDNER FOUR ARRIVAL", BOS | d-TPP NE-1, APR 2014 | FAA d-TPP (as 03) | `jlmcgraw/GeoReferencePlates/examples/BOS/MA-BOS-GARDNER-FOUR.pdf` |
| 16 | `16-trasy-sectional-mdt.jpg` | FAA Washington Sectional — Harrisburg, York, Victor airways, VOR compass rose | current edition (c. 2025–26) | FAA VFR raster page | `zoro2026/faa107-quiz/img/mdt-harrisburg.jpg`, crop 300,0–1400,861 |

Crop boxes are in pixels of the retrieved file; "×2" = upscaled 2× (Lanczos) because the source is low-resolution.
PDFs (03, 06, 14, 15) were rendered at 300 dpi and cropped to the drawing area (06: top 36 %). Each JPEG is < 1 MB (total ≈ 3.5 MB). `plansza.png` is a contact sheet of these crops
built with Playwright (own layout, CC0).

Gaps: no IFR **enroute** low/high excerpt and no FAA Chart User's Guide page — both live only on `aeronav.faa.gov` /
`faa.gov`, which were blocked. Worth adding once those hosts are allowed.
