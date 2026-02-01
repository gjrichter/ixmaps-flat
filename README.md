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

## Quick Start

### Simple HTML Example

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Simple ixMaps Example</title>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="ixmaps/ui/js/htmlgui_flat.js"></script>
    <style>
        #map { width: 100%; height: 600px; }
    </style>
</head>
<body>
    <div id="map"></div>

    <script>
        ixmaps.Map("map", {
            mapService: "leaflet_vt",
            mapType: "OpenStreetMap",
            legend: "true"
        }, function(map) {
            // Set initial view (latitude, longitude, zoom level)
            map.view([42.0, 12.5], 6);

            // Create a bubble chart layer from GeoJSON data
            map.layer(
                ixmaps.layer("cities")
                    .data({
                        url: "data/cities.geojson",
                        type: "geojson"
                    })
                    .binding({
                        position: "geometry",
                        value: "population"
                    })
                    .style({
                        colorscheme: ["#ffffb2", "#fd8d3c", "#bd0026"],
                        opacity: 0.7
                    })
                    .type("CHART|BUBBLE")
                    .define()
            );
        });
    </script>
</body>
</html>
```

This example creates an OpenStreetMap-based map centered on Italy, displaying cities as proportional bubbles sized by population data from a GeoJSON file.

## Core API

### Map Initialization

```javascript
ixmaps.Map("container_id", {
    mapService: "leaflet_vt",
    mapType: "OpenStreetMap",
    legend: "true"
}, function(map) {
    // Map is ready
});
```

### Layer Definition (Fluent API)

```javascript
ixmaps.layer("layerName")
    .data({url: "data.geojson", type: "geojson"})
    .binding({position: "geometry", value: "fieldname"})
    .style({colorscheme: ["#fff", "#000"], opacity: 0.8})
    .type("CHOROPLETH|EQUIDISTANT")
    .define()
```

### Visualization Types

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
