# Airline-network globe game: visual direction research

Art direction research, 2026-11-02. Scope: references, 5 directions, colour accessibility, ranking. No game code.

---

## 0. TL;DR

- **Recommended: Direction C, "Plotting Chart".** The globe reads as a working aeronautical chart. Hub capacity is the tick ring of the real airport symbol, minimum connection time is a compass-rose sweep, curfew is hatched restricted airspace, and routes are great-circle course lines with distance ticks. Every mark has a job in the game. It looks nothing like Mini Metro (no subway diagram), Mini Airways (no dark radar) or Fly Corp (no satellite globe, no menus). It is also clearly separate from the studio's poster-style dogfight game.
- **Runner-up / hybrid source: Direction D, "Flap Mosaic".** The globe is built from split-flap cells, and the terminator literally flips them. Borrow its flap-counter for the hub readout and its clack for sound.
- **Demoted: the screen-printed airline-poster direction (E).** It is the most obvious and most "AI-nostalgic" idea, and it collides with the studio's existing poster "great air circus" plane game, which is the one we most need to differ from.
- Encode passenger destination by **shape first, colour second**. Use an aviation-derived glyph set (chevron, bow-tie, crescent, keyhole, tail-fin, bracket, half-disc, notch-tag), not Mini Metro primitives. The colour sets below were checked with a Machado-2009 CVD simulation (script in scratchpad `cvd/`).

---

## 1. Annotated reference library

### 1.1 Mid-century airline posters and route maps
| Ref | Usable | Trap |
|---|---|---|
| David Klein, TWA posters 1950s–60s ([Gazette Drouot essay](https://www.gazette-drouot.com/en/article/david-klein-the-mid-century-s-gold-standard-travel-poster-artist/31679), [examples](https://www.1stdibs.com/buy/david-klein-vintage-travel-posters)) | Flat overlapping colour planes and offset registration. Fragmented, prismatic city silhouettes. Good for key art and the store icon. | It is the default "retro travel" look; every AI image generator outputs it. It also sits too close to the studio's poster dogfight game. |
| Raymond Savignac, Air France "J'y vole donc j'y suis" c.1970 ([listing](https://www.1stdibs.com/art/prints-works-on-paper/raymond-savignac-circa-1970-jy-vole-donc-jy-suis-air-france-poster-raymond-savignac/id-a_15596702), [AGI profile](https://a-g-i.org/user/raymondsavignac/)) | One gag, one image, huge negative space. Teaches *economy*: one idea per screen. | His humour is character-based, and our game has no characters. |
| Herbert Leupin and Manfred Bingler, Swissair ([Leupin](https://galerie123.com/en/artists/15251/herbert-leupin-original-vintage-poster/), [Bingler 1964 series](https://www.1stdibs.com/art/prints-works-on-paper/manfred-bingler-1964-original-travel-poster-bingler-manfred-swissair-to-europe/id-a_14627452)) | Bingler's 1964 region series uses one region per poster and a strict grid. That is a model for region and level cards in Puzzle mode. | The Swiss red cross / Swissair red is trademark-adjacent. |
| Pan Am × Jeppesen 1952 world route map; 1955 "continuous wall map" ([Geographicus](https://www.geographicus.com/P/AntiqueMap/worldroutes-panamerican-1952-2), [Raremaps](https://raremaps.com/gallery/detail/93556), [SFO Museum system map](https://collection.sfomuseum.org/objects/1511910247/), [David Rumsey](https://www.davidrumsey.com/luna/servlet/detail/RUMSEY~8~1~352831~90119905:World-Route-Map,-Pan-Am-Clippers,-P)) | Routes are thin arcs with small city labels, and the map is *extendable sideways*. That fits Endless mode (the world unrolls). | The Pan Am blue globe logo must not be quoted. |
| Imperial Airways 1930s maps: James Gardner 1938 (Beck-inspired), Moholy-Nagy attributed 1936 ([NatGeo](https://www.nationalgeographic.com/culture/article/vintage-maps-rekindle-the-romance-of-early-air-travel), [Swann](https://swanngalleries.com/3dcat/2314/files/assets/basic-html/page75.html), [Antikbar planisphere](https://antikbar.co.uk/collections/1930s/products/imperial-airways-planisphere-route-map-pa2365)) | The planisphere in four lobes is a lovely world-overview screen. Moholy-Nagy shows modernist economy applied to a map. | Gardner's map is Beck-derived, so it is a subway diagram, which is exactly the Mini Metro trap. Empire-era iconography is politically loaded. |

### 1.2 Navigation charts and historic cartography
| Ref | Usable | Trap |
|---|---|---|
| FAA sectional / VFR conventions ([Wikipedia: US chart conventions](https://en.wikipedia.org/wiki/Aeronautical_chart_conventions_(United_States)), [legend guide](https://uavcoach.com/read-sectional-chart/)) | **The core find.** Towered airports are blue and others magenta. The airport "wheel" symbol is a circle with ticks round the edge, so capacity can be shown as filled ticks. Airspace uses solid vs dashed rings, and restricted areas are hatched. All of it is a ready-made, legible symbol grammar with real meaning. | Full sectional detail is far too busy for a 412-px phone. Take the grammar, not the density. |
| Jeppesen route charts (via the Pan Am collaboration above) | Course numbers along lines, distance boxes, a monochrome-plus-one-accent discipline. | Real Jeppesen layouts and the Jeppesen name are trademarked. Do not imitate their chart frame. |
| Portolan charts (from c.1290): windrose lines radiating from compass roses, colour-coded black/green/red by wind rank ([RMG](https://rmg.co.uk/stories/blog/library-archive/all-about-portolans), [U Toronto MDL](https://mdl.library.utoronto.ca/node/55719), [Raremaps essay](https://raremaps.com/essay/140/portolan-charts)) | Each hub can carry its own small rose with lines radiating to its routes. The rose doubles as the connection-time dial. Rank by colour plus line weight, as the old charts did. | Decorative ornament creep (gold, sea monsters) turns into "fantasy map" slop. |
| Great-circle / gnomonic charts | In a gnomonic projection great circles are straight lines, which explains why routes bend. Usable for a one-time tutorial reveal. | Do not use it as the main view. |

### 1.3 Airport information design
| Ref | Usable | Trap |
|---|---|---|
| Solari di Udine split-flap boards (1950s onward; spread worldwide under Pirelli after 1964; Cifra 3 by Gino Valle 1965) ([Wikipedia](https://en.wikipedia.org/wiki/Split-flap_display), [Fondazione Pirelli](https://www.fondazionepirelli.org/en/activities/exhibitions/gino-valle-clocks-and-the-fusion-of-technology-and-design/), [Solari history](https://www.solari.it/en/?p=5910)) | A short mechanical transition that is the opposite of bouncy springs. The clack sound comes for free. Flaps are a natural readout for time, queues and gates. | Flap "Welcome" screens are a cliché. Never animate text purely for decoration. |
| Mijksenaar, Schiphol (1991 on): yellow for flights, blue for facilities, anthracite for waiting, green for escape ([Mijksenaar project](https://www.mijksenaar.com/project/schiphol-airport/), [UX Collective analysis](https://uxdesign.cc/wayfinding-at-schiphol-some-design-considerations-behind-the-world-famous-vi-system-and-what-29842b368252)) | Colour = function, not decoration. Yellow is reserved for "the thing you act on". That is a good HUD rule. | Schiphol yellow on black is recognisably Schiphol. Shift the hue. |
| Kinneir & Calvert: Gatwick signage, then Transport and Rail Alphabet ([Design Museum](https://designmuseum.org/design/jock-kinneir-margaret-calvert), [Transport typeface](https://en.wikipedia.org/wiki/Transport_(typeface))) | Mixed-case lettering for legibility at speed, and pictograms drawn to the same stroke as the type. | Transport itself is not OFL. |
| Otl Aicher: Munich '72 pictograms, Frankfurt Airport signage ([FSB archive](https://www.fsb.de/en/landingpage/otlaicher/otlaicher_pictograms), [Wikipedia](https://en.wikipedia.org/wiki/Otl_Aicher)) | A 45°/90° grid for pictograms. Draw our own icon set on a strict grid of that kind. | Copying the actual figures is plagiarism. Take the grid method only. |

### 1.4 Paper ephemera
| Ref | Usable | Trap |
|---|---|---|
| Airmail etiquettes and borders. France's first label was dated 17 Aug 1918; "Par avion" is used because French is the UPU language; the red/blue envelope border was common through the 20th century ([Wikipedia](https://en.wikipedia.org/wiki/Airmail_etiquette), [Smithsonian Postal Museum](https://postalmuseum.si.edu/exhibition/fad-to-fundamental-airmail-in-america-airmail-object-showcase-stamps-and-covers/us-1), [Collectors Club Chicago](https://www.collectorsclubchicago.org/philatelic-encyclopedia/airmail-label/)) | The chevron border can mark long-haul routes. Stamp perforations make countable capacity pips. Cancellation marks can mark a delivered passenger. | Heavy "vintage paper texture" overlays are slop and cost fill-rate. |
| Risograph / screen print. Riso Fluorescent Pink is ≈ #FF48B0 and Blue ≈ #0075BF ([SAIC Riso sheet](https://sites.saic.edu/servicebureau/wp-content/uploads/sites/20/2025/03/EverythingRiso_2024.pdf)) | Multiply-overprint means two overlapping routes produce a third colour, which shows shared corridors for free. | Riso is a 2018–2024 indie trend with a high cliché risk, and fluorescent ink does not exist on screen anyway. |

### 1.5 Earth at night and traffic visualisation
| Ref | Usable | Trap |
|---|---|---|
| NASA Black Marble, VIIRS Day/Night Band ([NASA Black Marble](https://blackmarble.gsfc.nasa.gov), [SVS gallery](https://svs.gsfc.nasa.gov/Gallery/EarthatNightImagery.html)) | City light density is a true proxy for demand, and continent shapes emerge from lights alone. | Photographic texture pulls toward Fly Corp realism. Bloom pulls toward "neon slop". |
| Aaron Koblin, *Flight Patterns* (FAA data, 24 h over North America, Processing) ([artist](https://www.aaronkoblin.com/project/flight-patterns/), [Cooper Hewitt](https://www.cooperhewitt.org/2015/08/05/flight-patterns/)) | Traffic volume as accumulated hairline density. A busy route literally thickens from its trail history, so no number is needed. | Additive white-on-black hairlines are the canonical look for "data viz" and "AI tech". |

### 1.6 Competitors to avoid (visual signatures)
- **Mini Metro / Motorways:** saturated lines on pastel, primitive passenger shapes (circle, triangle, square, plus pentagon, star, cross, diamond and others). Ban every geometric primitive as a passenger glyph.
- **Mini Airways:** monochrome flat ATC screen in the Mini Metro idiom, criticised for borrowing it ([GamingOnLinux](https://gamingonlinux.com/2024/03/mini-airways-is-like-mini-metro-mini-motorways-but-for-aircraft)). Avoid a dark flat radar with circular sweep.
- **Fly Corp:** realistic globe and country borders with tycoon menus ([Steam](https://store.steampowered.com/app/1372530/Fly_Corp/)). Avoid satellite textures, political borders and side panels.

---

## 2. Five visual directions

The **font licences** were all verified as present under `google/fonts/ofl/<family>/OFL.txt` (HTTP 200, checked 2026-11-02). None uses Inter or Roboto.

### A. "Night Shift": the globe as city lights
**Idea:** The globe is almost black, drawn only as a dot-matrix of city lights. Demand *is* light, and routes are hairline trails that thicken with traffic.

**Mechanics encoding**
- **Hub load:** the city's light cluster is a ring of dots that turn from sodium amber to white as load rises. At 80% the outer dots begin to blink at 1 Hz with no glow.
- **Connection time:** a dark gap closes around the dot ring like an iris.
- **Day/night:** the day side is lit as flat pale ocean with dim cities; the night side goes dark and cities brighten, which reads directly as a demand wave. Curfew cities "switch off" to hollow dots.
- **Routes:** hairline arcs that accumulate trail density, after Koblin.
- **Plane types:** a turboprop is one point with a short single trail; a widebody is two points with a double trail.
- **Passengers:** tiny glyphs in a queue stacked beside the city.

**Palette**
| Name | Hex | Role |
|---|---|---|
| Orbit Black | `#0B0E14` | night hemisphere |
| Day Ocean | `#2A3A4A` | day hemisphere |
| Coast Dust | `#3E4A55` | land edges (dotted) |
| Sodium | `#FFB547` | city light, low load; destination 1 |
| Ice | `#9FD6F0` | destination 2 |
| Signal Green | `#3FB87F` | destination 3 |
| Coral | `#FF6F61` | destination 4; jam warning |
| Lilac | `#C3A6FF` | destination 5 |
| Phosphor White | `#FFFFFF` | full load; destination 6 |

**Type:** Headline is **Martian Mono** (OFL). Text is **Atkinson Hyperlegible Next** (OFL).

**Icons:** dot-grid icons built only from 3×3 to 5×5 dot matrices, like LED signage.

**Motion and sound:** constant slow globe rotation. Hum, soft relay ticks, a low airliner drone filtered by zoom.

**Uniqueness:** it is the most different from Mini Metro's pastel. However, the dark background is shared with Mini Airways and the realism risk is Fly Corp's. Moderate.

**Risks**
- Dark plus glowing lights is one step from the forbidden neon look; it needs strict "no bloom, no blur" rules.
- Tiny dots on a 412×915 screen are hard to tap; it needs 48 dp invisible hit areas.
- CVD: the worst pair is green vs coral under protanopia (ΔE 12.6), so shape must carry it.
- Dot matrices with alpha are cheap; avoid full-screen post-processing.

### B. "Air Mail Globe": deliberately in the studio family
**Idea:** A mid-century schoolroom globe drawn in the studio's flat outlined illustration manner. Cities are postage stamps and routes are air-mail ribbons.

**Mechanics encoding**
- **Hub load:** the stamp's perforation teeth are the capacity pips, filled in dark ink as the queue grows. A full stamp gets a red "cancelled" bar, meaning jammed.
- **Connection time:** a postmark circle around the stamp fills like a clock.
- **Long-range routes:** wear the red/blue "par avion" chevron border; short routes are plain ribbon.
- **Day/night:** a flat transparent navy wash sweeps across. Curfew cities get a "closed" sealing-wax blob.
- **Plane types:** a turboprop is a small high-wing outline; a widebody is a long swept outline with 4 engine dots.

**Palette**
| Name | Hex | Role |
|---|---|---|
| Envelope Cream | `#F3EAD7` | land / background |
| Globe Sea | `#B9CFD6` | ocean |
| Outline Ink | `#2E2B28` | strokes; destination 6 |
| Par Avion Red | `#C8332B` | destination 1; jam |
| Par Avion Blue | `#1F3F8F` | destination 2; long-haul chevron |
| Mustard Stamp | `#B8860B` | destination 3 |
| Sky Stamp | `#7FB6D9` | destination 4 |
| Rose Stamp | `#F2B5C4` | destination 5 |
| Night Wash | `#1B2440` at 45% | terminator overlay |

**Type:** Headline is **Young Serif** (OFL). Text is **Familjen Grotesk** (OFL).

**Icons:** outlined at 2 px, the same stroke weight as the studio's Brussels game, but using philatelic forms (stamp, postmark, tag).

**Motion and sound:** stamping thunks and paper slides; routes "unroll" like ribbon at linear speed.

**Uniqueness vs. competitors:** high. **vs. the studio:** low on purpose. It does, however, risk resembling the studio's soft-illustrated tower game (drag-to-connect plus counters), so the stamp language must replace "towers with counters" fully.

**Risks**
- Perforation pips at phone size: the minimum is 8 pips per hub at 3 px each.
- Cream plus illustration can slide into "cozy game" genericness.

### C. "Plotting Chart" (recommended)
**Idea:** The globe is a living aeronautical chart. Every gameplay value is a real chart symbol: you *read* the network the way a pilot reads a sectional.

**Mechanics encoding**
- **Hub:** the airport wheel symbol (circle plus tick ring). Ticks are capacity and filled ticks are passengers waiting, so overflow is visible as the ring closing *before* you read any number.
  - A hub becomes a "towered" airport (blue) once it is upgraded to an expansion hub; ordinary cities stay magenta. That is the real sectional convention, re-purposed.
  - When the ring is full, the hub gets a second, dashed vermilion ring (the "airspace violation" warning) and a 1-cycle tick.
- **Minimum connection time:** a compass-rose bezel around the hub. Transferring passengers sit on the bezel and travel clockwise; a passenger who reaches north can board. The player sees a short or long MCT as the speed of rotation around the dial.
- **Routes:** great-circle lines with distance ticks every 500 km (chart tick marks).
  - Turboprop routes are dashed single lines, which are short and cheap.
  - Widebody routes are solid double lines (Victor/Jet airway analogue).
  - The range limit is a "range arc" drawn as a thin circle from the hub while dragging.
- **Day/night:** the terminator is a contour-style line with soft graticule shading on the night side, rendered as a 45° ink hatch (low cost, no gradient). Curfew zones use the magenta hatched "restricted area" pattern; cities inside it show hollow symbols.
- **Planes:** small drawn planform silhouettes. The turboprop has straight wings and prop discs; the widebody has swept wings and 2 or 4 engine pods. Each carries a load bar *along the fuselage* (seats filled).
- **Passengers:** destination glyphs (section 3) printed like chart symbols, queued on the hub ring.

**Palette**
| Name | Hex | Role |
|---|---|---|
| Chart Paper | `#EEF0E6` | land |
| Chart Water | `#D6E6EA` | sea (flat, no gradient) |
| Contour Tan | `#D9CDB0` | relief tint (optional, 1 step) |
| Chart Blue | `#1F4E9C` | towered hubs, widebody airways; destination 1 |
| Sectional Magenta | `#B0177E` | ordinary cities, curfew hatching; destination 2 |
| Ochre | `#E0A526` | destination 3; turboprop routes |
| Sky Teal | `#5FB8C9` | destination 4 |
| Warning Vermilion | `#D24A1C` | overflow ring, jam; destination 5 |
| Chart Ink | `#2B2A28` | graticule, text; destination 6 |
| Night Hatch | `#3A4660` at 30% | terminator hatch |

**Type:** Headline is **Big Shoulders Display** (OFL, by Patric King, condensed American Gothic rooted in railway signage). Text and numbers are **B612** and **B612 Mono** (OFL), designed with Airbus for cockpit-screen legibility ([source](https://raw.githubusercontent.com/google/fonts/main/ofl/b612/DESCRIPTION.en_us.html)). The text face has a real aviation story, not a borrowed one.

**Icons:** drawn on a 24-unit grid with 1.5-unit strokes, Aicher-style 45°/90° discipline, borrowing chart symbols: airport wheel, VOR-like hex rose (for the hub-upgrade card), range arc, hatch, compass needle. Use no generic Material icons.

**Motion and sound**
- Plotter-like: lines draw at constant speed (120 ms per segment), the bezel rotates in fixed steps of 1 tick per game minute, and overflow blinks twice without scaling.
- Sound: pencil-on-paper for the route drag, a dry relay click for boarding, a low two-tone chime (ATC-like) for a jam warning, and quiet distant radio static as the bed.

**Uniqueness:** this is not a subway diagram. The lines are curved, measured and ticked, on light paper rather than pastel. It is not a radar either: light background, no sweep. Nor is it Fly Corp: no satellite imagery, borders or menus. It is also nothing like the studio's poster or pill-HUD looks.

**Risks**
- Hatching can moiré on low-DPI screens. Render it in world space with a minimum 4 dp spacing and fade the hatch out when zoomed far away.
- Protanopia confuses Chart Blue vs Magenta (ΔE 13.8). Hub status therefore also uses tick fill and ring dash, not colour alone.
- Thin lines need 2 dp minimum stroke and a 48 dp drag hit-tube.
- Performance is very good: vector lines and SDF glyphs.

### D. "Flap Mosaic": the globe as a departure board
**Idea:** The globe surface is tessellated into split-flap cells. The world itself is the departure board.

**Mechanics encoding**
- **Day/night:** the terminator flips cells from day face to night face with a real flap animation and clack, sweeping round the globe. It is the most literal and memorable possible depiction of the mechanic.
- **Hub:** a 3-character flap counter on the hub showing queue size. Over 75% capacity it flips to a yellow face; when full, it shows "HLD" (hold).
- **Connection time:** a flap clock (mm) counting down beside the waiting glyphs.
- **Routes:** chains of flipped cells along the great circle, coloured in the route colour, so routes are "pixelated" arcs in flap units.
- **Plane types:** a turboprop occupies 1 cell; a widebody is a 2-cell elongated tile.
- **Passengers:** glyphs printed on mini flaps.

**Palette**
| Name | Hex | Role |
|---|---|---|
| Board Anthracite | `#1E2022` | night face |
| Flap Grey | `#3A3D40` | day face land |
| Flap Sea | `#2B3440` | sea face |
| Signal Yellow | `#FFC917` | actionable, over-load; destination 1 |
| Board White | `#F2EFE6` | text; destination 2 |
| Cyan | `#4FB3E8` | destination 3 |
| Vermilion | `#E8532A` | jam; destination 4 |
| Green | `#2FA36B` | destination 5 |
| Pink | `#E58FB6` | destination 6 |

**Type:** Headline is **Overpass** (OFL, Highway Gothic lineage). Text and numbers are **Overpass Mono** (OFL).

**Icons:** drawn to fit the flap-cell grid (a 2:3 cell), cut by the flap hinge line.

**Motion and sound:** 60–90 ms flips, staggered in a sweep. The Solari-like clack is pitched by cell count, and must be mixed very low or it becomes fatiguing.

**Uniqueness:** extremely distinctive. The dark board must stay warm grey, not black, to avoid reading as Mini Airways; it is also close-ish to the studio's dark-HUD lane battler.

**Risks**
- A tessellated sphere has distortion at the poles. Use an icosahedral or HEALPix-style cell grid.
- Flip animation on thousands of cells is a performance concern. Animate only cells at the terminator band (a few hundred) with instanced quads.
- Cells limit route resolution.

### E. "Overprint": screen-printed poster globe
**Idea:** The globe is a 3-ink screen print. Routes are ink layers that overprint, so shared corridors and hubs darken by multiply.

**Mechanics encoding**
- **Hub load:** ink "fills" the hub stamp from the bottom, like a print run.
- **Overlap:** busy corridors overprint into a deeper third colour.
- **Day/night:** a halftone dot screen sweeps across, with dot size as darkness. Curfew cities are knocked out to bare paper.
- **Plane types:** a turboprop is a small single-ink silhouette; a widebody is a 2-ink, slightly misregistered silhouette.

**Palette**
| Name | Hex | Role |
|---|---|---|
| Paper | `#F4EEDF` | background |
| Fluo Pink | `#FF48B0` | destination 1 |
| Riso Blue | `#0075BF` | destination 2; sea |
| Yellow | `#FFE800` | destination 3 |
| Green | `#00A95C` | destination 4 |
| Orange | `#FF6C2F` | destination 5; jam |
| Black | `#2B2A28` | destination 6; text |

**Type:** Headline is **Bricolage Grotesque** (OFL). Text is **Instrument Sans** (OFL).

**Icons:** cut-paper shapes with 1–2 px misregistration.

**Motion and sound:** stepped animation at 12 fps, with a squeegee swoosh.

**Uniqueness:** acceptable versus competitors. However, it is **too close to the studio's poster "great air circus" plane game** and to the generic retro-travel look.

**Risks**
- Overprint mixing makes destination colours ambiguous: the colour of an overlap is no longer any destination's colour.
- Protanopia confuses Fluo Pink vs Blue (ΔE 12.2).
- It reads as a style rather than a system.

---

## 3. Colour accessibility and passenger destination encoding

**Rule:** shape is the identity, colour is reinforcement, and position (queue at hub, seat on plane) is context. Never rely on hue alone for hub state; use tick fill, dashes and blink as well.

### Destination glyph vocabulary
These avoid Mini Metro's circle, triangle, square, pentagon, star, cross and diamond. Each is drawn on a 12×12 dp grid with a 2 dp stroke and solid fill, and must stay distinct at 10 dp.

1. **Chevron** (from the par-avion stripe).
2. **Bow-tie / hourglass** (two touching wedges).
3. **Crescent.**
4. **Keyhole** (circle plus stem; reads as a "gate").
5. **Tail-fin** (an aircraft fin: right-angle trapezoid).
6. **Bracket / "L" hook** (an ICAO corner mark).
7. **Half-disc** (a semicircle with a flat base).
8. **Notch-tag** (a luggage tag with a punched hole).

Extend beyond 8 with *variant marks* (glyph plus a bar underneath = a second city in the same region) rather than new silhouettes. With many cities, assign glyphs to regions, and show the exact city only on tap or long-press.

Make silhouettes pairwise different in **area and convexity**: the chevron and fin are pointed, the crescent and half-disc rounded, and the bow-tie and keyhole have strong negative space. That keeps them distinct even when blurred.

**Plane type** is also encoded by shape and line: straight wing plus prop disc plus dashed trail, versus swept wing plus pods plus double trail.

**Cargo** (if added): an outlined, hollow version of the glyph inside a box frame. People are filled and cargo is boxed.

### Colour sets tested
Method: Machado-2009 full-severity simulation; minimum pairwise CIE76 ΔE among the 6 destination colours. A ΔE of 15 or more is safe; 10–15 needs shape support.

| Set | Normal | Protan | Deutan | Tritan |
|---|---|---|---|---|
| Okabe-Ito 6 (`#E69F00 #56B4E9 #009E73 #F0E442 #0072B2 #D55E00`) ([ref](https://siegal.bio.nyu.edu/color-palette/)) | 26.4 | 24.7 | 17.0 | 16.1 |
| C "Plotting Chart" | 48.0 | 13.8 (blue/magenta) | 21.9 | 23.3 |
| D "Flap Mosaic" | 47.2 | 19.5 | 23.7 | 15.2 |
| B "Air Mail" | 42.0 | 18.2 | 19.4 | 23.2 |
| A "Night Shift" | 27.7 | 12.6 (green/coral) | 21.1 | 22.3 |
| E "Overprint" (green/orange variant) | 56.7 | 12.2 (pink/blue) | 33.3 | 15.0 |

**Notes**
- Okabe-Ito is the most uniformly safe. For C, shift Magenta to `#C2188A` and Blue to `#1F4E9C` only with shape support. Alternatively, give the 6 destinations Okabe-Ito-derived hues remapped to chart tones: Chart Blue `#0072B2`, Vermilion `#D55E00`, Ochre `#E69F00`, Sky `#56B4E9`, Bluish Green `#009E73`, Reddish Purple `#CC79A7`. That keeps Magenta and Chart Blue for the UI.
- Red/green never carries meaning on its own: jam = vermilion + dashed ring + blink.
- Offer a CVD mode that swaps palettes, and a "glyph outline thicken" option.
- The script is at `/tmp/claude-0/-workspace-airway/7d43130c-ca9f-5f97-ae67-cbb555ed2f79/scratchpad/cvd/cvd.py`.

---

## 4. Ranking

1. **C, Plotting Chart.** Strongest *explanatory* fit: tick ring = capacity, bezel = MCT, hatch = curfew, dashed vs double line = plane class, range arc = long-range upgrade. It has an authentic aviation provenance (sectional conventions, and the B612 cockpit font), works on a light background in portrait, is cheap to render, and is the furthest from all three competitors and all five studio games.
2. **D, Flap Mosaic.** The most memorable single image (the terminator flipping the world), but it carries performance and resolution risks and sits near dark-HUD territory. *Steal its flap counter and clack sound for C's hub readouts and the weekly-upgrade reveal.*
3. **B, Air Mail Globe.** The safe family member. Charming, and the perforation pips are clever, but it risks reading as "cozy illustrated" and as the tower-connection game re-skinned.
4. **A, Night Shift.** Gorgeous and uses real demand semantics, but it fights the anti-neon rule, invites Fly Corp realism comparisons, and has a tap-target problem with tiny lights. Good for the endless-mode night palette or the trailer.
5. **E, Overprint.** Most clichéd, closest to the studio's poster plane game, and overprint colour mixing undermines destination encoding. Use it only for marketing posters, if at all.

**Suggested synthesis:** C as the in-game language, plus D's split-flap for counters and the upgrade card, plus A's city-light dot density on the night hemisphere at low opacity (no glow), so night demand waves read as lights coming on.
