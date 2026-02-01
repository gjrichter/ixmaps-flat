# ixMaps - Interactive Map Visualization Library

## What is ixMaps?

ixMaps is a JavaScript library for creating interactive, SVG-based maps with data visualization capabilities. It allows you to easily embed interactive maps in web pages, add data layers, and create choropleth maps, bubble charts, and other visualizations.

## Features

- Interactive SVG-based mapping
- Support for multiple base map services (Leaflet, OpenStreetMap, CartoDB, etc.)
- Data visualization with choropleth maps, bubble charts, and custom visualizations
- Zoom, pan, and search functionality
- Easy integration into any HTML page

## Simplest Example

Here's the simplest way to create a map with ixMaps:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple ixMaps Example</title>
</head>
<body style="margin:0;padding:0;">
    <!-- Map container -->
    <div id="map-div" style="width: 100%; height: 100vh;"></div>

    <!-- Include ixMaps library -->
    <script src="https://gjrichter.github.io/ixmaps/ui/js/htmlgui_flat.js"></script>

    <script type="text/javascript">
        // Create the map
        ixmaps.Map("map-div", {
            mapService: "leaflet_vt",    // Map service to use
            mapType: "ArcGIS - Topo",    // Base map type
            name: "simple_map",          // Map name
            mode: "pan",                 // Pan mode
            legend: "false",             // No legend
            tools: "false"               // No tools
        }, function(map) {
            // Set the initial map view (center and zoom level)
            map.view({
                center: {
                    lat: "42.30",   // Latitude
                    lng: "13.98"    // Longitude
                },
                zoom: "6"           // Zoom level
            });
        });
    </script>
</body>
</html>
```

## How It Works

1. **Container**: Create a `<div>` element where the map will be rendered
2. **Library**: Include the ixMaps library script
3. **Map**: Call `ixmaps.Map()` with:
   - The ID of the container element
   - Configuration options (map service, base map type, etc.)
   - A callback function that receives the map instance when ready
4. **View**: In the callback, set the initial view with `map.view()` to center and zoom the map

That's it! Save this as an HTML file and open it in a web browser to see your interactive map.

## Adding a Theme with Data

Once you have a basic map, you can add a data layer (theme) to visualize data on the map. Here's how to define and load a bubble chart theme using coordinates:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ixMaps with Data Theme</title>
</head>
<body style="margin:0;padding:0;">
    <!-- Map container -->
    <div id="map-div" style="width: 100%; height: 100vh;"></div>

    <!-- Include ixMaps library -->
    <script src="https://gjrichter.github.io/ixmaps/ui/js/htmlgui_flat.js"></script>

    <script type="text/javascript">
        // Sample data with coordinates
        var cityData = [
            { name: "Rome", population: 2875472, lat: 41.8931, lon: 12.4828 },
            { name: "Paris", population: 2161000, lat: 48.8566, lon: 2.3522 },
            { name: "London", population: 8982000, lat: 51.5074, lon: -0.1278 },
            { name: "Berlin", population: 3677472, lat: 52.5200, lon: 13.4050 },
            { name: "Madrid", population: 3223334, lat: 40.4168, lon: -3.7038 }
        ];

        // Create the map
        ixmaps.Map("map-div", {
            mapService: "leaflet_vt",
            mapType: "CartoDB - Positron",
            name: "data_map",
            legend: "true",
            tools: "true"
        }, function(map) {
            // Set the initial map view (centered on Europe)
            map.view([50.0, 5.0], 5);
            
            // Define and load a bubble chart theme
            map.layer(ixmaps.layer("chart")
                .data({
                    data: cityData,
                    type: "json"
                })
                .binding({
                    value: "population",          // Data field that determines bubble size
                    geo: "lat|lon",              // Latitude and longitude fields
                    title: "name"                // Field for tooltips/titles
                })
                .style({
                    type: "CHART|BUBBLE|VALUES",  // Bubble chart visualization
                    colorscheme: ["#bb2233"],     // Bubble color
                    fillopacity: "0.6",           // Fill opacity
                    symbols: ["circle"],          // Shape
                    normalsizevalue: "3000000",   // Base size for normalization
                    showdata: "true",             // Show data labels
                    units: "people",              // Units for display
                    title: "Population"
                })
                .define()
            );
            
            // Set attribution
            map.attribution("Sample city population data");
        });
    </script>
</body>
</html>
```

### Understanding Theme Definition

When defining a theme, you chain several methods:

1. **`ixmaps.layer("LAYER_NAME")`** - Specifies a layer name (e.g., "chart" for bubble charts)
2. **`.data({...})`** - Defines the data source:
   - `data`: Inline data array/object
   - `url`: URL to load data from (CSV, JSON, etc.)
   - `type`: Data format ("json", "csv", etc.)
3. **`.binding({...})`** - Maps data fields to map features:
   - `value`: The data field to visualize (determines bubble size)
   - `geo`: For bubbles, use `"lat|lon"` to specify coordinate fields
   - `title`: Field used for labels/tooltips
4. **`.style({...})`** - Defines visual styling:
   - `type`: Visualization style (`"CHART|BUBBLE|VALUES"` for bubble charts)
   - `colorscheme`: Array with color(s) for bubbles
   - `fillopacity`: Transparency of fills
   - `normalsizevalue`: Base value for size normalization
   - `showdata`: Whether to show data labels
   - `symbols`: Shape array (e.g., `["circle"]`)
5. **`.define()`** - Finalizes and applies the theme

The theme is added to the map using `map.layer()`, which takes the entire chain as its argument.

**Note:** Bubble charts work with coordinate data (lat/lon) and don't require a predefined geographic layer, making them perfect for simple examples. 

For **choropleth themes** or data **without georeference**, you can first load an appropriate geographic layer (with positions, lines, or polygons) and then refer to that layer in your data visualization theme. For example, if you have data with region codes but no coordinates, you would:

1. Load a geographic layer (e.g., `ixmaps.layer("ITALIA_Comuni_2022")` for Italian municipalities)
2. Use `.binding()` with a `position` field to match your data to the geographic features (e.g., `position: "codice_comune"` to match municipality codes)
3. Apply a choropleth visualization type (e.g., `type: "CHOROPLETH|EQUIDISTANT"`)

This allows you to visualize data that references geographic entities by name or code rather than by coordinates.

## Next Steps

- Customize colors and styling
- Add interactive tooltips and legends
- Explore different visualization types (CHOROPLETH, BUBBLE, etc.)
- Add multiple themes to the same map
- Use your own data sources

For more examples and documentation, visit the [ixMaps documentation](https://gjrichter.github.io/ixmaps/).
