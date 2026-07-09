# Map Tiles Directory

This directory serves vector tile files for the MapCore component.

## Files

- `middle-east.pmtiles` â€” Vector tiles for 20 Middle East countries (zoom 0-14)
  - Generated from OpenStreetMap data using Tilemaker + OpenMapTiles schema
  - Countries: Iran, Iraq, Saudi Arabia, Kuwait, UAE, Jordan, Bahrain, Oman,
    Qatar, Turkey, Afghanistan, Pakistan, Azerbaijan, Armenia, Egypt, Palestine,
    Lebanon, Syria, Israel, Yemen

- `world-overview.pmtiles` â€” World overview tiles (zoom 0-5, ~50-200 MB)
  - **Not included** â€” must be downloaded separately (see below)
  - Uses Protomaps Basemap schema (different from regional tiles)
  - Provides: global ocean/land, country boundaries, country/city labels
  - Displayed at z0-z7; hidden at z>7 where regional detail takes over

## Downloading World Overview Tiles

Run the PowerShell download script from the repo root:

```powershell
.\scripts\download-world-tiles.ps1
```

This script:
1. Downloads the `go-pmtiles` CLI tool (Windows binary, cached in %TEMP%)
2. Finds the latest Protomaps CDN build
3. Extracts only z0-z5 tiles (~50-200 MB via HTTP range requests)
4. Saves to `Plugins/analysis.geo_location/data/tiles/world-overview.pmtiles`

> The serve.js tile server auto-serves any `.pmtiles` file in the data/tiles directory.

## Development Setup

For development, you can also serve tiles from the data directory:

```bash
# Option 1: Copy PMTiles to public/tiles/
cp Plugins/analysis.geo_location/data/tiles/middle-east.pmtiles apps/holand-web-app/public/tiles/
cp Plugins/analysis.geo_location/data/tiles/world-overview.pmtiles apps/holand-web-app/public/tiles/

# Option 2: Serve tiles separately (recommended)
node Plugins/analysis.geo_location/data/tiles/serve.js 8765
# Then set in .env.local:
#   NEXT_PUBLIC_PMTILES_URL=http://localhost:8765/middle-east.pmtiles
#   NEXT_PUBLIC_WORLD_TILES_URL=http://localhost:8765/world-overview.pmtiles
```

## Environment Variables

- `NEXT_PUBLIC_PMTILES_URL` â€” Regional tile source URL
  - Default: `/tiles/middle-east.pmtiles` (served from this directory)
  - For dev with separate server: `http://localhost:8765/middle-east.pmtiles`

- `NEXT_PUBLIC_WORLD_TILES_URL` â€” World overview tile source URL (Protomaps schema)
  - Auto-derived from `NEXT_PUBLIC_PMTILES_URL` if not set (replaces filename)
  - Explicit: `http://localhost:8765/world-overview.pmtiles`
  - Set to empty string to disable world overview layer entirely

