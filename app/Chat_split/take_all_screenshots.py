#!/usr/bin/env python3
"""
Script to take screenshots of all ixmaps basemaps
This script uses browser automation to cycle through basemaps and take screenshots
"""

import time
import json

# List of all basemaps from the HTML file
basemaps = [
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

print(f"Total basemaps to process: {len(basemaps)}")
print("\nBasemap list:")
for i, bm in enumerate(basemaps, 1):
    print(f"{i:2d}. {bm['name']} ({bm['id']})")

