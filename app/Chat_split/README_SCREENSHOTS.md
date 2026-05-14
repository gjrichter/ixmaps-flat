# Basemap Screenshots

This directory contains tools to automatically take screenshots of all ixmaps basemaps.

## Files

- `basemap_viewer.html` - HTML page that loads a basemap based on URL parameter
- `take_basemap_screenshots.js` - Node.js script using Puppeteer
- `take_basemap_screenshots.py` - Python script using Playwright
- `package.json` - Node.js dependencies

## Usage

### Option 1: Node.js with Puppeteer

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the script:
   ```bash
   npm run screenshots
   # or
   node take_basemap_screenshots.js
   ```

### Option 2: Python with Playwright

1. Install dependencies:
   ```bash
   pip install playwright
   playwright install chromium
   ```

2. Run the script:
   ```bash
   python take_basemap_screenshots.py
   ```

## Output

Screenshots will be saved to the `basemap_screenshots/` directory with filenames based on the basemap names (e.g., `openstreetmap.png`, `toner.png`, etc.).

## Testing Individual Basemaps

You can test individual basemaps by opening `basemap_viewer.html` in a browser with URL parameters:

- By index: `basemap_viewer.html?basemap=0` (first basemap)
- By name: `basemap_viewer.html?basemap=OpenStreetMap`
- By partial name: `basemap_viewer.html?basemap=toner`

## Notes

- Vector tiles (VT_*) may take longer to load
- Screenshots are 500x500 pixels
- Map is centered on Rome, Italy
- The script waits for tiles to fully load before taking screenshots

