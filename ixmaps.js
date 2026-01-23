/**
 * ixmaps core library
 * 
 * This file loads the initial ixmaps API
 * 
 * the user can define map themes and embed the ixmaps map
 * 
 * 1. with ixmaps.layer(szLayerName,callback) 
 *    the user can define visualization themes
 * 
 * 2. with ixmaps.Map(targetDiv, options, callback)
 *    the user can embed the map into the target div
 *    and define a callback function which will receive the map handle with the ixmaps API 
 *    to load and handle visualization themes and map featiures
 */

// Define the ixmaps object
// This is the global object that will be used to access the ixmaps API

var ixmaps = {
    version: "1.0",
    JSON_Schema: "https://gjrichter.github.io/ixmaps/schema/ixmaps/v1.json"
};

// Load a script (helper)
// This function loads a script from a given URL
// It returns a promise that resolves when the script is loaded
// It rejects if the script fails to load
// @param src - The URL of the script to load
// @returns A promise that resolves when the script is loaded
// @returns A promise that rejects if the script fails to load
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Define the script to load
// This is the script with the complete ixmaps API
let szScript2 = "ui/js/htmlgui_flat.js";

// we make final URL to load the above script depending from the ixmaps.js path
//
// Find the script object that contains this ixmaps.js file
// and use the URL of the script to build the complete URL to load the ixmaps API
let scriptsA = document.querySelectorAll("script");
for (var i in scriptsA) {
    let scr = scriptsA[i].getAttribute("src");
    if (scr && scr.match(/ixmaps.js/)) {
        szScript2 = (scr.split("ixmaps.js")[0]) + szScript2;
        break;
    }
}

// Create a promise that resolves when script2 is ready
// the ixmaps user has 2 options to load the ixmaps API:
// 1. load the ixmaps API directly
// 2. load the ixmaps API through a script tag
//
// The first option is to load the ixmaps API explicitly 
// and then load a map by calling ixmaps.Map
//
// The second option is to load the ixmaps API inplicity
// by calling ixmaps.map(div, options, callback)
// where div is the HTML element to load the map into
// options is an object with the options for the map
// callback is a function that will be called when the map is loaded
//
// The second option is the default option
// The first option is used when the ixmaps user wants to load the ixmaps API explicitly

window.ixmaps = ixmaps || {};

// first option: load the ixmaps API explicitly
window.ixmaps.init = function () {
    return loadScript(szScript2);
}
// second option: load the ixmaps API inplicity
window.ixmaps.Map = function (div, options, callback) {
    return new Promise((resolve, reject) => {
        loadScript(szScript2).then(() => {
            ixmaps.Map(div, options, (map) => {
                if (callback) {
                    callback(map);
                } else {
                    resolve(map);
                }
            });
        }).catch(reject);
    });
};

// log a message to the console
// this message is displayed when the ixmaps.js file is loaded
console.log("ixmaps.js loaded and waiting for initialization");

/**
 * ixmaps API to define visualization layer
 * 
 * this api gives the user the possibility to define ixmaps themes (JSON)
 * with a convenient javascript api
 * 
 * ixmaps.Layer(layer_name)
 *    .data({})
 *    .binding({})
 *    .type(string)  
 *    .style({})
 *    .meta({}) 
 *    .define();  
 * 
 * will return a JSON object with the layer definition
 */

/**
 * ixmaps.themeConstruct  
 * @class It realizes an object to create a theme JSON 
 * @constructor
 * @param {Object} [map] a map object to define the theme for
 * @return A new ixmaps.themeConstruct object
 */

/**
 * Builder class for creating map layer/theme definitions.
 * Provides a fluent API for configuring data sources, visualization types, bindings, and styles.
 * 
 * @class ixmaps.themeConstruct
 * @constructor
 * @param {string} szMap - The map instance name (optional)
 * @param {string} szLayer - The layer name/identifier
 * 
 * @property {string} szMap - Map instance name
 * @property {Object} def - Layer definition object
 * @property {string} def.layer - Layer identifier
 * @property {Object} def.data - Data source configuration
 * @property {Object} def.style - Style/visualization configuration
 * @property {string} def.field - Field name for data binding
 */
ixmaps.themeConstruct = function (szMap, szLayer) {
    this.szMap = szMap;
    this.def = {};
    this.def.layer = szLayer || "generic";
    this.def.data = {};
    this.def.style = {
        type: "CHART|DOT",
        lookupfield: "geometry"
    };
    this.def.field = "$item$";
};
ixmaps.themeConstruct.prototype = {
    /**
     * Configures the data source for the layer.
     * 
     * @param {Object|string} [dataObj] - Data source configuration object or URL string
     * @param {string} [dataObj.url] - URL to data source (GeoJSON, TopoJSON, CSV, etc.)
     * @param {string} [dataObj.type] - Data type: "geojson"|"topojson"|"csv"|"json"|"kml"|"rss"|"ext"
     * @param {string} [dataObj.name] - Optional name for the data source
     * @param {Object} [dataObj.obj] - Inline data object (alternative to URL)
     * @param {string} [dataObj.ext] - External data source identifier
     * @param {string} [dataObj.query] - SQL query for database sources
     * @param {string} [szType] - Data type (if dataObj is a string URL)
     * @param {string} [szName] - Data source name (if dataObj is a string URL)
     * @returns {ixmaps.themeConstruct} Returns self for method chaining
     * 
     * @example
     * // Object configuration
     * layer.data({url: "https://example.com/data.geojson", type: "geojson"})
     * 
     * @example
     * // String URL with type parameter
     * layer.data("https://example.com/data.csv", "csv")
     */
    data: function (dataObj, szType, szName) {
        var szName = szName || "DBTABLE" + Math.floor(Math.random() * 100000000);
        this.def.data.name = szName;
        if (dataObj) {
            if (typeof (dataObj) == "string") {
                if (szType == "ext") {
                    this.def.data.ext = dataObj;
                    this.def.data.type = szType;
                } else {
                    this.def.data.url = dataObj;
                    this.def.data.type = szType;
                }
            } else {
                if (szType) {
                    this.def.data.obj = dataObj;
                    this.def.data.szType = szType;
                } else {
                    for (var i in dataObj) {
                        this.def.data[i] = dataObj[i];
                    }
                }

                if (dataObj.name) {
                    this.def.data.name = dataObj.name;
                }
                if (dataObj.url) {
                    this.def.data.type = szType || dataObj.type;
                    if (this.def.data.type && (this.def.data.type == "ext")) {
                        this.def.data.ext = dataObj.url;
                    } else {
                        this.def.data.url = dataObj.url;
                    }
                } else
                    if (dataObj.ext) {
                        this.def.data.ext = dataObj.ext;
                        this.def.data.type = szType || dataObj.type || "ext";
                    } else
                        if (dataObj.query) {
                            this.def.data.query = dataObj.query;
                            this.def.data.type = szType || dataObj.type || "ext";
                        } else {
                            this.def.data.type = szType || dataObj.type;
                            //ixmaps.setData(dataObj,{type:szType,name:szName});
                        }

            }
        } else {
            this.def.data.type = szType || "ext";
        }
        if (this.def.data.type && this.def.data.type.match(/geojson|topojson/i)) {
            this.def.style.lookupfield = "geometry";
            this.def.style.type = "FEATURES|NOLEGEND";
        }
        return this;
    },
    process: function (szProcess) {
        this.def.data.process = szProcess;
        return this;
    },
    query: function (szQuery) {
        this.def.data.query = szQuery;
        // alert("hi"); // DEBUG: Removed alert
        return this;
    },
    field: function (szName) {
        this.def.field = szName;
        return this;
    },
    field100: function (szName) {
        this.def.field100 = szName;
        return this;
    },
    lookup: function (szName) {
        this.def.style.lookupfield = szName;
        return this;
    },
    geo: function (szName) {
        this.def.style.lookupfield = szName;
        return this;
    },
    /**
     * Configures how data fields are bound to map features.
     * 
     * @param {Object} bObj - Binding configuration object
     * @param {string} [bObj.position] - Field name for geometry/position (e.g., "geometry", "fid")
     * @param {string} [bObj.geo] - Alias for position (geometry field)
     * @param {string} [bObj.georef] - Geographic reference field
     * @param {string} [bObj.id] - Unique identifier field (e.g., "fid")
     * @param {string} [bObj.value] - Value field for visualization (e.g., "Type", "Population")
     * @param {string} [bObj.size] - Size field for bubble/chart visualizations
     * @param {string} [bObj.lookup] - Lookup field for joining data
     * @param {string} [bObj.lookupfield] - Alias for lookup
     * @param {string} [bObj.item] - Item field identifier
     * @param {string} [bObj.itemfield] - Alias for item
     * @returns {ixmaps.themeConstruct} Returns self for method chaining
     * 
     * @example
     * layer.binding({
     *     position: "geometry",
     *     id: "fid",
     *     value: "Type"
     * })
     * 
     * @example
     * layer.binding({
     *     position: "fid",
     *     value: "Population",
     *     size: "Area"
     * })
     */
    binding: function (bObj) {
        this.def.binding = this.def.binding || {};
        for (var i in bObj) {
            this.def.binding[i] = bObj[i];
        }
        return this;
    },
    encoding: function (bObj) {
        this.def.binding = this.def.binding || {};
        for (var i in bObj) {
            this.def.binding[i] = bObj[i].field || bObj[i];
        }
        return this;
    },
    filter: function (szFilter) {
        this.def.style = this.def.style || {};
        this.def.style.filter = szFilter;
        return this;
    },
    /**
     * Sets the visualization type and modifiers for the layer.
     * 
     * @param {string} szType - Layer type string with pipe-separated modifiers
     * 
     * **Base Types:**
     * - `"FEATURE"` - Feature layer (lines, polygons, points) - Note: Auto-converted to "FEATURES" for GeoJSON/TopoJSON
     * - `"FEATURES"` - Feature layer (plural form, used internally for GeoJSON/TopoJSON)
     * - `"CHOROPLETH"` - Color-coded areas by value
     * - `"CHART"` - Chart visualization
     * - `"DOT"` - Point markers
     * - `"BUBBLE"` - Bubble charts
     * - `"PIE"` - Pie charts
     * - `"BAR"` - Bar charts
     * 
     * **Modifiers (pipe-separated):**
     * - `"NOLEGEND"` - Hide legend
     * - `"CATEGORICAL"` - Categorical data (not numeric)
     * - `"EQUIDISTANT"` - Equal interval classification
     * - `"QUANTILE"` - Quantile classification
     * - `"NATURAL"` - Natural breaks classification
     * - `"AGGREGATE"` - Aggregate data
     * - `"ZOOMTO"` - Zoom to feature on click
     * - `"SIMPLELEGEND"` - Simple legend style
     * - `"SORT"` - Sort data
     * - `"DOWN"` - Sort descending
     * 
     * @returns {ixmaps.themeConstruct} Returns self for method chaining
     * 
     * @example
     * layer.type("FEATURE|NOLEGEND")
     * 
     * @example
     * layer.type("CHOROPLETH|CATEGORICAL")
     * 
     * @example
     * layer.type("CHART|BUBBLE|SIZEP4|AGGREGATE")
     */
    type: function (szType) {
        this.def.style.type = szType;
        return this;
    },
    /**
     * Configures visualization styles and appearance.
     * 
     * @param {Object} styleObj - Style configuration object
     * 
     * **Color Configuration:**
     * @param {string|Array<string>} [styleObj.colorscheme] - Color scheme:
     *   - String: "none" (no color), or named scheme like "tableau10", "viridis"
     *   - Array: [numberOfClasses, startColor, endColor, ...additionalColors]
     *     Example: ["5", "#FFFDD8", "#B5284B"] or ["#ce420a", "#85c9d6"]
     * 
     * **Visual Properties:**
     * @param {string|number} [styleObj.opacity] - Opacity (0-1 or "0.9")
     * @param {string|number} [styleObj.fillopacity] - Fill opacity
     * @param {string|number} [styleObj.stroke] - Stroke color (e.g., "RGB(80,80,80)", "#000000")
     * @param {string|number} [styleObj.strokeWidth] - Stroke width in pixels
     * @param {string|number} [styleObj.linewidth] - Line width (for line geometries)
     * 
     * **Data Display:**
     * @param {string|boolean} [styleObj.showdata] - Show data on click ("true"/"false")
     * @param {string} [styleObj.units] - Units for display (e.g., "km", "m", "%")
     * @param {string|number} [styleObj.scale] - Scale factor for charts/bubbles
     * 
     * **Values/Labels:**
     * @param {Array<string>} [styleObj.values] - Array of category values/labels
     *   Example: ["Main Road", "Secondary Road"]
     * 
     * **Other:**
     * @param {string} [styleObj.name] - Layer name/identifier
     * @param {string|number} [styleObj.refreshtimeout] - Refresh timeout in milliseconds
     * 
     * @returns {ixmaps.themeConstruct} Returns self for method chaining
     * 
     * @example
     * layer.style({
     *     colorscheme: ["#ce420a", "#85c9d6"],
     *     values: ["Main Road", "Secondary Road"],
     *     opacity: "0.9",
     *     stroke: "RGB(80,80,80)",
     *     strokeWidth: "1"
     * })
     * 
     * @example
     * layer.style({
     *     colorscheme: "none",
     *     linewidth: "5",
     *     showdata: "true"
     * })
     */
    style: function (styleObj) {
        this.def.style = this.def.style || {};
        for (var i in styleObj) {
            this.def.style[i] = styleObj[i];
        }
        return this;
    },
    /**
     * Sets metadata for the layer (title, description, splash screen, etc.).
     * 
     * @param {Object} styleObj - Metadata object
     * @param {string} [styleObj.title] - Layer title displayed in legend/info
     * @param {string} [styleObj.splash] - Loading message/splash text
     * @param {string} [styleObj.description] - Layer description
     * @param {string} [styleObj.author] - Author/attribution
     * @param {string} [styleObj.source] - Data source attribution
     * @returns {ixmaps.themeConstruct} Returns self for method chaining
     * 
     * @example
     * layer.meta({
     *     title: "Roads of the Roman Empire - Choropleth by Type",
     *     splash: "loading roads data ..."
     * })
     */
    meta: function (styleObj) {
        this.def.meta = this.def.meta || {};
        for (var i in styleObj) {
            this.def.meta[i] = styleObj[i];
        }
        return this;
    },
    title: function (szTitle) {
        this.def.style.title = szTitle;
        return this;
    },

    // get the theme definition object (JSON)

    /**
     * Returns the layer definition object.
     * **Note:** `define()` is the recommended alias - it's more semantic and clearer.
     * Use this at the end of method chaining when not using the callback pattern.
     * 
     * @returns {Object} The complete layer definition object
     * 
     * @example
     * .layer(
     *     ixmaps.layer("roads")
     *     .data({url: "data.geojson", type: "geojson"})
     *     .style({colorscheme: "none"})
     *     .define()  // Returns the layer definition
     * )
     */
    definition: function () {
        return this.def;
    },
    /**
     * Returns the layer definition object. 
     * **Recommended:** Use this method at the end of method chaining.
     * More semantic and clearer than `json()` - describes what you're getting (a definition).
     * 
     * @returns {Object} The complete layer definition object
     * 
     * @example
     * .layer(
     *     ixmaps.layer("roads")
     *     .data({url: "data.geojson", type: "geojson"})
     *     .style({colorscheme: "none"})
     *     .define()  // Returns the layer definition
     * )
     */
    define: function () {
        return this.def;
    },
    /**
     * Alias for {@link ixmaps.themeConstruct#define}. Returns the layer definition object.
     * **Note:** `define()` is preferred for clarity - it's more semantic and self-documenting.
     * 
     * @returns {Object} The complete layer definition object
     */
    json: function () {
        return this.def;
    }
};
/**
* ixmaps.theme 
* get an ixmaps.themeConstructer instance
* @param {String} [szLayer] the name of a layer to define or to refer
* @return A new ixmaps.themeConstruct instance
*/
ixmaps.theme = function (szLayer) {
    return new ixmaps.themeConstruct(this.szMap, szLayer);
}

/**
 * Creates a new map layer with a fluent/builder API.
 * 
 * **Note:** This function uses `this.szMap` internally, so it's typically called within 
 * a map builder context (e.g., inside `ixmaps.embed()` callback).
 * 
 * @param {string} szLayer - The name/identifier of the layer (e.g., "roads", "cities")
 * @param {Function} [callback] - Optional callback function that receives the layer builder.
 *                                 If provided, the function is called with the builder and
 *                                 the layer definition JSON is returned.
 * @returns {ixmaps.themeConstruct|Object} 
 *   - If callback is provided: Returns the layer definition JSON object
 *   - If no callback: Returns a new themeConstruct instance for method chaining
 * 
 * @example
 * // Recommended: Without callback (more straightforward, linear flow)
 * .layer(
 *     ixmaps.layer("roads")
 *     .data({url: "data.geojson", type: "geojson"})
 *     .type("FEATURE|NOLEGEND")
 *     .binding({position: "geometry", id: "fid"})
 *     .style({colorscheme: "none", linewidth: "5"})
 *     .define()  // Returns the layer definition
 * )
 * 
 * @example
 * // Alternative: With callback (returns JSON automatically)
 * var layerDef = ixmaps.layer("roads", layer => layer
 *     .data({url: "data.geojson", type: "geojson"})
 *     .type("FEATURE|NOLEGEND")
 *     .style({colorscheme: "none"})
 * );
 */
ixmaps.layer = function (szLayer, callback) {
    if (callback) {
        var layer = new ixmaps.themeConstruct(this.szMap, szLayer);
        callback(layer);
        return layer.json();
    }
    return new ixmaps.themeConstruct(this.szMap, szLayer);
}

/**
 * Convenience alias for {@link ixmaps.layer}. Provides the same behaviour while
 * avoiding namespace conflicts with existing APIs.
 * @function ixmaps.Layer
 * @param {String} [szLayer] the name of a layer to define or to refer
 * @param {Function} [callback] optional callback function
 * @return A new ixmaps.themeConstruct instance
 */
ixmaps.Layer = function (szLayer, callback) {
    return ixmaps.layer(szLayer, callback);
};



