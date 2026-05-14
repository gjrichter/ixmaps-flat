/**
 * Puppeteer script to take screenshots of all ixmaps basemaps
 * 
 * Usage:
 *   node take_basemap_screenshots.js
 * 
 * Requirements:
 *   npm install puppeteer
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// List of all basemaps
const basemaps = [
    // Vector Tiles
    { id: 'VT_OPENSTREETMAP', name: 'OpenStreetMap' },
    { id: 'VT_TONER', name: 'Toner' },
    { id: 'VT_TONER_LITE', name: 'Toner Lite' },
    { id: 'VT_DATAVIZ', name: 'DataViz' },
    { id: 'VT_DATAVIZ_LIGHT', name: 'DataViz Light' },
    { id: 'VT_DATAVIZ_DARK', name: 'DataViz Dark' },
    { id: 'VT_BACKDROP', name: 'Backdrop' },
    { id: 'VT_BACKDROP_LIGHT', name: 'Backdrop Light' },
    { id: 'VT_BASIC', name: 'Basic' },
    { id: 'VT_BASIC_LIGHT', name: 'Basic Light' },
    { id: 'VT_BRIGHT', name: 'Bright' },
    { id: 'VT_BRIGHT_LIGHT', name: 'Bright Light' },
    { id: 'VT_VOYAGER', name: 'Voyager' },
    { id: 'VT_VOYAGER_LIGHT', name: 'Voyager Light' },
    { id: 'VT_TOPO', name: 'Topo' },
    { id: 'VT_TOPO_SHINY', name: 'Topo Shiny' },
    { id: 'VT_TOPO_TOPOGRAPHIQUE', name: 'Topo Topographique' },
    // Image Tiles
    { id: 'OpenStreetMap - Osmarenderer', name: 'OpenStreetMap' },
    { id: 'OpenStreetMap - wikipedia', name: 'OpenStreetMap Wikipedia' },
    { id: 'OpenStreetMap - gray', name: 'OpenStreetMap Gray' },
    { id: 'OpenStreetMap - roads', name: 'OpenStreetMap Roads' },
    { id: 'OpenStreetMap - admin', name: 'OpenStreetMap Admin' },
    { id: 'OpenStreetMap - admin - dark', name: 'OpenStreetMap Admin Dark' },
    { id: 'OpenStreetMap - FR', name: 'OpenStreetMap FR' },
    { id: 'OpenStreetMap - Transport', name: 'OpenStreetMap Transport' },
    { id: 'Stamen - toner', name: 'Stamen Toner' },
    { id: 'Stamen - toner-lite', name: 'Stamen Toner Lite' },
    { id: 'Stamen - toner-hybrid', name: 'Stamen Toner Hybrid' },
    { id: 'Stamen - watercolor', name: 'Stamen Watercolor' },
    { id: 'Stamen - terrain', name: 'Stamen Terrain' },
    { id: 'ArcGIS - Topo', name: 'ArcGIS Topo' },
    { id: 'ArcGIS - Light Gray Base', name: 'ArcGIS Light Gray' },
    { id: 'ArcGIS - Ocean Basemap', name: 'ArcGIS Ocean' },
    { id: 'ArcGIS - Hillshade', name: 'ArcGIS Hillshade' },
    { id: 'CartoDB - Positron', name: 'CartoDB Positron' },
    { id: 'CartoDB - Dark matter', name: 'CartoDB Dark Matter' },
    { id: 'MapTiler - Positron', name: 'MapTiler Positron' },
    { id: 'MapTiler - Dark Matter', name: 'MapTiler Dark Matter' },
    { id: 'NOKIA', name: 'Nokia/HERE' },
    { id: 'NOKIA OVI - transit', name: 'Nokia Transit' },
    { id: 'NOKIA - satellite', name: 'Nokia Satellite' },
    { id: 'NOKIA - terrain', name: 'Nokia Terrain' },
    { id: 'WAZE', name: 'Waze' },
    { id: 'MapBox - OSM', name: 'MapBox OSM' },
    { id: 'MapQuest - OSM (EU)', name: 'MapQuest OSM' },
    { id: 'OpenTopoMap', name: 'OpenTopoMap' },
    { id: 'OpenPtMap', name: 'OpenPtMap' },
    { id: 'Openpistemap landschaded', name: 'OpenPisteMap' },
    { id: 'RaceDotMap', name: 'Race Dot Map' },
    { id: 'Black', name: 'Black' },
    { id: 'White', name: 'White' },
    { id: 'Gray', name: 'Gray' },
    { id: 'transparent', name: 'Transparent' }
];

// Create screenshots directory
const screenshotsDir = path.join(__dirname, 'basemap_screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Sanitize filename
function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// Take screenshot of a single basemap
async function takeScreenshot(browser, basemap, index, total) {
    const page = await browser.newPage();
    
    try {
        // Set viewport size
        await page.setViewport({ width: 500, height: 500 });
        
        // Get the HTML file path
        const htmlPath = path.join(__dirname, 'basemap_viewer.html');
        const fileUrl = `file://${htmlPath}?basemap=${index}`;
        
        console.log(`[${index + 1}/${total}] Loading: ${basemap.name} (${basemap.id})`);
        
        // Navigate to the page
        await page.goto(fileUrl, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        // Wait for map to be ready
        await page.waitForFunction(() => window.mapReady === true, {
            timeout: 30000
        });
        
        // Additional wait for tiles to load (longer for vector tiles)
        const isVectorTile = basemap.id.startsWith('VT_');
        const waitTime = isVectorTile ? 5000 : 3000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Take screenshot of the map div
        const filename = sanitizeFilename(basemap.name) + '.png';
        const filepath = path.join(screenshotsDir, filename);
        
        const mapDiv = await page.$('#map_div');
        if (mapDiv) {
            await mapDiv.screenshot({ 
                path: filepath,
                type: 'png'
            });
            console.log(`  ✓ Screenshot saved: ${filename}`);
        } else {
            console.error(`  ✗ Map div not found for ${basemap.name}`);
        }
        
    } catch (error) {
        console.error(`  ✗ Error taking screenshot of ${basemap.name}:`, error.message);
    } finally {
        await page.close();
    }
}

// Main function
async function main() {
    console.log(`Starting to take screenshots of ${basemaps.length} basemaps...\n`);
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        for (let i = 0; i < basemaps.length; i++) {
            await takeScreenshot(browser, basemaps[i], i, basemaps.length);
            
            // Small delay between screenshots
            if (i < basemaps.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        console.log(`\n✓ All screenshots completed! Saved to: ${screenshotsDir}`);
    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        await browser.close();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { basemaps, takeScreenshot, main };
