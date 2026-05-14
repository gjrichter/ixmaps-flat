#!/usr/bin/env python3
"""
Python script to take screenshots of all ixmaps basemaps using Playwright

Usage:
    python take_basemap_screenshots.py

Requirements:
    pip install playwright
    playwright install chromium
"""

import asyncio
from playwright.async_api import async_playwright
import os
from pathlib import Path
from urllib.parse import quote

# List of all basemaps
BASEMAPS = [
    # Vector Tiles
    {"id": "VT_OPENSTREETMAP", "name": "OpenStreetMap"},
    {"id": "VT_TONER", "name": "Toner"},
    {"id": "VT_TONER_LITE", "name": "Toner Lite"},
    {"id": "VT_DATAVIZ", "name": "DataViz"},
    {"id": "VT_DATAVIZ_LIGHT", "name": "DataViz Light"},
    {"id": "VT_DATAVIZ_DARK", "name": "DataViz Dark"},
    {"id": "VT_BACKDROP", "name": "Backdrop"},
    {"id": "VT_BACKDROP_LIGHT", "name": "Backdrop Light"},
    {"id": "VT_BASIC", "name": "Basic"},
    {"id": "VT_BASIC_LIGHT", "name": "Basic Light"},
    {"id": "VT_BRIGHT", "name": "Bright"},
    {"id": "VT_BRIGHT_LIGHT", "name": "Bright Light"},
    {"id": "VT_VOYAGER", "name": "Voyager"},
    {"id": "VT_VOYAGER_LIGHT", "name": "Voyager Light"},
    {"id": "VT_TOPO", "name": "Topo"},
    {"id": "VT_TOPO_SHINY", "name": "Topo Shiny"},
    {"id": "VT_TOPO_TOPOGRAPHIQUE", "name": "Topo Topographique"},
    # Image Tiles
    {"id": "OpenStreetMap - Osmarenderer", "name": "OpenStreetMap"},
    {"id": "OpenStreetMap - wikipedia", "name": "OpenStreetMap Wikipedia"},
    {"id": "OpenStreetMap - gray", "name": "OpenStreetMap Gray"},
    {"id": "OpenStreetMap - roads", "name": "OpenStreetMap Roads"},
    {"id": "OpenStreetMap - admin", "name": "OpenStreetMap Admin"},
    {"id": "OpenStreetMap - admin - dark", "name": "OpenStreetMap Admin Dark"},
    {"id": "OpenStreetMap - FR", "name": "OpenStreetMap FR"},
    {"id": "OpenStreetMap - Transport", "name": "OpenStreetMap Transport"},
    {"id": "Stamen - toner", "name": "Stamen Toner"},
    {"id": "Stamen - toner-lite", "name": "Stamen Toner Lite"},
    {"id": "Stamen - toner-hybrid", "name": "Stamen Toner Hybrid"},
    {"id": "Stamen - watercolor", "name": "Stamen Watercolor"},
    {"id": "Stamen - terrain", "name": "Stamen Terrain"},
    {"id": "ArcGIS - Topo", "name": "ArcGIS Topo"},
    {"id": "ArcGIS - Light Gray Base", "name": "ArcGIS Light Gray"},
    {"id": "ArcGIS - Ocean Basemap", "name": "ArcGIS Ocean"},
    {"id": "ArcGIS - Hillshade", "name": "ArcGIS Hillshade"},
    {"id": "CartoDB - Positron", "name": "CartoDB Positron"},
    {"id": "CartoDB - Dark matter", "name": "CartoDB Dark Matter"},
    {"id": "MapTiler - Positron", "name": "MapTiler Positron"},
    {"id": "MapTiler - Dark Matter", "name": "MapTiler Dark Matter"},
    {"id": "NOKIA", "name": "Nokia/HERE"},
    {"id": "NOKIA OVI - transit", "name": "Nokia Transit"},
    {"id": "NOKIA - satellite", "name": "Nokia Satellite"},
    {"id": "NOKIA - terrain", "name": "Nokia Terrain"},
    {"id": "WAZE", "name": "Waze"},
    {"id": "MapBox - OSM", "name": "MapBox OSM"},
    {"id": "MapQuest - OSM (EU)", "name": "MapQuest OSM"},
    {"id": "OpenTopoMap", "name": "OpenTopoMap"},
    {"id": "OpenPtMap", "name": "OpenPtMap"},
    {"id": "Openpistemap landschaded", "name": "OpenPisteMap"},
    {"id": "RaceDotMap", "name": "Race Dot Map"},
    {"id": "Black", "name": "Black"},
    {"id": "White", "name": "White"},
    {"id": "Gray", "name": "Gray"},
    {"id": "transparent", "name": "Transparent"}
]


def sanitize_filename(name):
    """Sanitize filename by replacing special characters"""
    return "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in name).lower()


async def take_screenshot(page, basemap, index, total, screenshots_dir):
    """Take a screenshot of a single basemap"""
    try:
        # Get the HTML file path
        script_dir = Path(__file__).parent
        html_path = script_dir / "basemap_viewer.html"
        
        # Build URL with basemap parameter
        file_url = f"file://{html_path.absolute()}?basemap={index}"
        
        print(f"[{index + 1}/{total}] Loading: {basemap['name']} ({basemap['id']})")
        
        # Navigate to the page
        await page.goto(file_url, wait_until="networkidle", timeout=30000)
        
        # Wait for map to be ready
        await page.wait_for_function("window.mapReady === true", timeout=30000)
        
        # Additional wait for tiles to load (longer for vector tiles)
        is_vector_tile = basemap['id'].startswith('VT_')
        wait_time = 5000 if is_vector_tile else 3000
        await page.wait_for_timeout(wait_time)
        
        # Take screenshot of the map div
        filename = sanitize_filename(basemap['name']) + '.png'
        filepath = screenshots_dir / filename
        
        map_div = await page.query_selector('#map_div')
        if map_div:
            await map_div.screenshot(path=str(filepath), type='png')
            print(f"  ✓ Screenshot saved: {filename}")
        else:
            print(f"  ✗ Map div not found for {basemap['name']}")
            
    except Exception as error:
        print(f"  ✗ Error taking screenshot of {basemap['name']}: {error}")


async def main():
    """Main function to take screenshots of all basemaps"""
    print(f"Starting to take screenshots of {len(BASEMAPS)} basemaps...\n")
    
    # Create screenshots directory
    script_dir = Path(__file__).parent
    screenshots_dir = script_dir / "basemap_screenshots"
    screenshots_dir.mkdir(exist_ok=True)
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True)
        
        try:
            # Create a new page
            page = await browser.new_page()
            await page.set_viewport_size({"width": 500, "height": 500})
            
            # Take screenshots of all basemaps
            for i, basemap in enumerate(BASEMAPS):
                await take_screenshot(page, basemap, i, len(BASEMAPS), screenshots_dir)
                
                # Small delay between screenshots
                if i < len(BASEMAPS) - 1:
                    await asyncio.sleep(0.5)
            
            print(f"\n✓ All screenshots completed! Saved to: {screenshots_dir}")
            
        except Exception as error:
            print(f"Fatal error: {error}")
        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())

