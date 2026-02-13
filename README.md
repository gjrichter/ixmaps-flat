# ixMaps Framework

**ixMaps** is a JavaScript framework for creating interactive, data-driven web maps with sophisticated visualization capabilities. It combines SVG-based cartography with Leaflet/OpenStreetMap base maps to enable powerful geospatial data visualizations including choropleth maps, bubble charts, pie charts, and bar charts. The framework supports 15+ data formats (CSV, JSON, GeoJSON, Parquet, GeoPackage, etc.) and features an AI-assisted chat interface for intuitive map creation. With its fluent API and browser-based architecture, ixMaps allows both developers and non-technical users to create sophisticated interactive maps without server infrastructure.

## Key Features

- **Interactive SVG-based mapping** with zoom, pan, and search functionality
- **Multiple visualization types**: choropleth maps, bubble charts, pie charts, bar charts, and more
- **Extensive data format support**: CSV, JSON, GeoJSON, TopoJSON, Parquet, GeoParquet, GeoPackage, FlatGeoBuf, KML, GML, and others
- **AI-assisted interface** for natural language map creation
- **Fluent API** with chainable builder pattern
- **Multi-map support** for synchronized map instances
- **Browser-based processing** with no server requirements
- **Export capabilities** to standalone HTML or JSON projects

## CDN

CDN_BASE=https://cdn.jsdelivr.net/gh/gjrichter/ixmaps_flat@master/

Script:
<script src="https://cdn.jsdelivr.net/gh/gjrichter/ixmaps_flat@master/ixmaps.js"></script>

## Quick Start

### Simple HTML Example

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Simple ixMaps Example</title>
    <script src="https://cdn.jsdelivr.net/gh/gjrichter/ixmaps_flat@master/ixmaps.js"></script>
    <style>
        body { margin: 0; padding: 0; }
        #map { width: 100%; height: 100vh; }
    </style>
</head>
<body>
    <div id="map"></div>

    <script>
        // Define inline JSON data with city information
        const cityData = [
            { name: "Rome", pop: "2875472", lat: "41.893056", lon: "12.482778" },
            { name: "Paris", pop: "7389520", lat: "48.856667", lon: "2.351944" },
            { name: "Berlin", pop: "3531201", lat: "52.518611", lon: "13.408056" },
            { name: "London", pop: "8787892", lat: "51.507222", lon: "-0.1275" }
        ];

        // Create the map and add a bubble chart layer
        let myMap = ixmaps.Map("map", {
            mapType: "VT_TONER_LITE"
        })
        myMap.options({
            objectscaling: "dynamic",
            basemapopacity: 0.5
        });
        myMap.view({
            center: { lat: 48.0, lng: 10.0 },
            zoom: 5
        });
        myMap.layer("cities")
            .data({ obj: cityData, type: "json" })
            .binding({ geo: "lat|lon", value: "pop", title: "name" })
            .style({
                colorscheme: ["#bd0026"],
                normalsizevalue: 10000000,
                units: "people"
            })
            .type("CHART|BUBBLE|SIZE|VALUES")
            .title("European Cities Population")
            .define()
      
    </script>
</body>
</html>
```

This example creates an interactive map centered on Europe, displaying major cities as proportional bubbles sized by population. The data is provided inline as a JSON object, so no external data files are needed. See it in the [code viewer](https://gjrichter.github.io/MapCodeViewer/index.html?url=maps/first_demo.html) 

### Loading External Data

You can also load data from external files:

```javascript
// From GeoJSON file
let layer1 = ixmaps.layer("cities")
    .data({ url: "data/cities.geojson", type: "geojson" })
    .binding({ position: "geometry", value: "population" })
    .type("CHART|BUBBLE")
    .define();

// From CSV file
let layer2 = ixmaps.layer("data")
    .data({ url: "data/statistics.csv", type: "csv" })
    .binding({ geo: "latitude|longitude", value: "count" })
    .type("CHOROPLETH|QUANTILE")
    .define();

// Add layers to the map
myMap.layer(layer1);
myMap.layer(layer2);
```

## Core API

### CDN

Include ixMaps in your HTML from the CDN:

```html
<script src="https://cdn.jsdelivr.net/gh/gjrichter/ixmaps_flat@master/ixmaps.js"></script>
```

### Map Initialization

```javascript
// Initialize map and store reference in variable
let myMap = ixmaps.Map("container_id", {
    mapType: "VT_TONER_LITE"  // or "OpenStreetMap", "CartoDB Positron", etc.
});

// Configure the map using fluent API
myMap.view({
        center: { lat: 42.0, lng: 12.5 },
        zoom: 6
    })
    .options({
        objectscaling: "dynamic",
        basemapopacity: 0.5
    });

// Alternative: with callback function
ixmaps.Map("container_id", {
    mapType: "OpenStreetMap"
}, function(map) {
    // Map is ready, you can now add layers
    map.view([42.0, 12.5], 6);
});
```

### Layer Definition (Fluent API)

```javascript
// Create a layer and store reference
let layer = ixmaps.layer("layerName")
    .data({ url: "data.geojson", type: "geojson" })
    .binding({ position: "geometry", value: "fieldname" })
    .style({ colorscheme: ["#fff", "#000"], opacity: 0.8 })
    .type("CHOROPLETH|EQUIDISTANT")
    .define();

// Add the layer to the map
myMap.layer(layer);
```

### Adding Multiple Layers

```javascript
// Create multiple layers
let populationLayer = ixmaps.layer("population")
    .data({ url: "data/population.csv", type: "csv" })
    .binding({ geo: "lat|lon", value: "count" })
    .style({ colorscheme: ["#ffffb2", "#bd0026"] })
    .type("CHART|BUBBLE")
    .define();

let boundaryLayer = ixmaps.layer("boundaries")
    .data({ url: "data/regions.geojson", type: "geojson" })
    .binding({ position: "geometry" })
    .style({ opacity: 0.3, stroke: "#333" })
    .type("FEATURE")
    .define();

// Add all layers to the map
myMap.layer(populationLayer)
    .layer(boundaryLayer);
```

## Visualization Types

- **FEATURE/FEATURES** - Raw geographic features with styling
- **CHOROPLETH** - Color-coded areas by values (EQUIDISTANT, QUANTILE, NATURAL breaks)
- **CHART|BUBBLE** - Proportional circles
- **CHART|PIE** - Pie charts
- **CHART|BAR** - Bar charts
- **CHART|DOT** - Point markers

## Documentation

- [ixMaps Introduction](ixmaps_introduction.md) - Basic framework documentation
- [Chat Application Guide](ixmaps_chat_app.md) - AI-assisted map creation
- [Multi-Map Extension](MULTI_MAP_README.md) - Multiple synchronized maps

## Architecture

The framework consists of several layers:

1. **Core API Layer** (`ixmaps.js`) - Main entry points and public API
2. **Theme/Layer Definition** (`ixmaps.themeConstruct`) - Builder pattern for layer configuration
3. **Data Processing Layer** (`data.js`) - Multi-format data handling with DuckDB WASM
4. **Map Rendering Engine** (`htmlgui.js`, `htmlgui_flat.js`) - Leaflet integration and UI
5. **SVG Mapping System** (`/ixmaps/maps/svg/js/`) - SVG rendering and theme visualization
6. **UI/Dialog System** (`/ixmaps/ui/`) - Legends, tooltips, and dialogs
7. **Chat Application** (`/ixmaps/app/Chat/`) - AI-assisted interface

## Requirements

- jQuery 1.7.1+
- Leaflet 1.9.4+ (included)
- Modern web browser with JavaScript enabled

## License

[License information to be added]

## Contributing

[Contributing guidelines to be added]
