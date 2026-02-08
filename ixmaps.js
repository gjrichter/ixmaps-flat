/**
 * ixmaps core library
 *
 * This file loads the initial ixmaps API and exposes the public surface.
 *
 * **User entry points:**
 * 1. `ixmaps.layer(szLayerName [, callback])` – define visualization themes (fluent builder).
 * 2. `ixmaps.Map(targetDiv, options [, callback])` – embed the map and optionally receive
 *    the map handle to load themes and control map features (fluent chaining or Promise).
 * 3. `ixmaps.init()` – explicitly load the full API (htmlgui_flat.js) before using Map.
 *
 * **Public API surface (what this file exposes):**
 * - `ixmaps` – global namespace; `version`, `JSON_Schema`, `init`, `Map`, `layer`, `Layer`, `theme`, `themeConstruct`, `MapBuilder`
 * - `ixmaps.Map(div, options, callback)` – returns a Proxy around MapBuilder (chainable or .then())
 * - `ixmaps.layer(szLayer, callback?)` – returns themeConstruct instance or layer definition JSON
 * - `ixmaps.Layer` – alias for `ixmaps.layer`
 * - `ixmaps.theme(szLayer)` – returns themeConstruct instance (used when `this.szMap` is set, e.g. inside embed)
 * - `ixmaps.themeConstruct` – constructor for layer/theme definition builder
 * - `ixmaps.MapBuilder` – internal builder used by Map(); documented for API clarity
 *
 * **File structure (for AI/navigation):**
 * - Lines ~16–64: ixmaps object, loadScript, base URL resolution for htmlgui_flat.js
 * - Lines ~66–127: Queuing mechanism comment, module state (_scriptLoadPromise, ensureMapInitialized, ixmaps.init)
 * - Lines ~154–391: MapBuilder class (queue-or-execute, chainable methods, then/catch)
 * - Lines ~394–539: window.ixmaps.Map – creates MapBuilder and wraps in Proxy for method validation
 * - Lines ~547–931: Theme Construct API (themeConstruct, data/binding/type/style/meta/define)
 * - Lines ~932–996: ixmaps.theme, ixmaps.layer, ixmaps.Layer
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

// Resolve the base URL for loading htmlgui_flat.js from the location of this script.
// We need the script that is actually executing (this file), not the first match in the DOM.
// If this script is in <head>, another script (e.g. CDN) might match "ixmaps.js" first and
// yield the wrong base, so we use document.currentScript when available. That way the script
// works in both <head> and <body>.
var _ixmapsScriptEl = typeof document !== "undefined" && document.currentScript;
if (_ixmapsScriptEl && _ixmapsScriptEl.src && _ixmapsScriptEl.src.indexOf("ixmaps.js") !== -1) {
    szScript2 = (_ixmapsScriptEl.src.split("ixmaps.js")[0]) + szScript2;
} else {
    // Fallback: first script whose src contains "ixmaps.js" (e.g. older browsers, or inline script)
    var scriptsA = document.querySelectorAll("script");
    for (var i = 0; i < scriptsA.length; i++) {
        var scr = scriptsA[i].getAttribute("src");
        if (scr && scr.indexOf("ixmaps.js") !== -1) {
            szScript2 = (scr.split("ixmaps.js")[0]) + szScript2;
            break;
        }
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
// 
// different coding examples
// 
//  ixmaps.Map("map_div", {
//      mode: "pan"
//  }).then(map => map
//      .view([51.43209416269992, 19.80295632748655], 3.8)
//      .layer(world_grid)
//  );
//
//  ixmaps.Map("map_div", {
//      mode: "pan"
//  })
//  .view([51.43209416269992, 19.80295632748655], 3.8)
//  .layer(world_grid)
// 
//  let myMap = ixmaps.Map("map_div", {
//      mode: "pan"
//  });
//  myMap.view([51.43209416269992, 19.80295632748655], 3.8);
//  myMap.layer(world_grid);
//


window.ixmaps = ixmaps || {};

/**
 * Queuing Mechanism:
 * 
 * MapBuilder uses a queuing system to allow method chaining before the map is ready.
 * When chainable methods (view, layer, options, etc.) are called:
 * 
 * 1. If map is ready (this._ready && this._map):
 *    - Methods execute immediately via this._map[method].apply(this._map, args)
 * 
 * 2. If map is not ready:
 *    - Methods are queued in this._queue array as {method: string, args: Array}
 *    - Queue preserves call order
 * 
 * 3. When map becomes ready (in MapBuilder constructor callback):
 *    - _executeQueue() iterates through this._queue
 *    - Each queued method executes in strict order on the map instance
 *    - Queue is cleared after execution
 * 
 * This ensures fluent API calls work identically whether called before or after
 * map initialization, matching the Promise-based .then() API behavior.
 */

var _scriptLoadPromise = null;
var _scriptLoaded = false;
var _realMapFunction = null;

/**
 * Ensures the full ixmaps API (htmlgui_flat.js) is loaded. Resolves immediately if already loaded;
 * otherwise loads the script once and caches the promise. Used by Map and init.
 * @returns {Promise<void>} Resolves when the API is ready
 */
function ensureMapInitialized() {
    if (_scriptLoaded && _realMapFunction) {
        return Promise.resolve();
    }
    if (_scriptLoadPromise) {
        return _scriptLoadPromise;
    }
    _scriptLoadPromise = loadScript(szScript2).then(function() {
        _scriptLoaded = true;
        // Store reference to the real Map function from htmlgui_flat.js
        _realMapFunction = ixmaps.Map;
    });
    return _scriptLoadPromise;
}

// first option: load the ixmaps API explicitly
window.ixmaps.init = function () {
    return ensureMapInitialized();
}
/**
 * MapBuilder class for fluent API map configuration.
 * Provides a builder pattern that queues method calls until the map is initialized,
 * while also supporting the legacy Promise-based .then() pattern.
 * 
 * @class ixmaps.MapBuilder
 * @constructor
 * @param {string|HTMLElement} div - The target div element or its ID
 * @param {Object} options - Map configuration options
 * @param {Function} [callback] - Optional callback (legacy support)
 */
ixmaps.MapBuilder = function (div, options, callback) {
    var self = this;
    
    // Properties
    this._queue = [];           // Array of pending method calls {method, args}
    this._map = null;           // Reference to actual map (null until ready)
    this._ready = false;        // Boolean flag indicating initialization complete
    this._error = null;         // Stores any error that occurred
    this._promiseResolve = null; // For .then() support
    this._promiseReject = null;  // For .then() support
    this._callback = callback;   // Legacy callback support
    this._projection = null;     // Store projection type for special handling
    
    // Start async initialization
    ensureMapInitialized().then(function() {
        // Use the stored reference to the real Map function from htmlgui_flat.js
        // This avoids calling our own wrapper recursively
        if (!_realMapFunction) {
            throw new Error("Map API not loaded correctly - _realMapFunction is null");
        }
        
        try {
            _realMapFunction(div, options, function(map) {
                if (!map) {
                    self._onError(new Error("Map initialization returned null/undefined"), 'initialization');
                    return;
                }
                
                self._map = map;
                self._ready = true;
                
                // If legacy callback was provided, call it and skip queue
                if (self._callback) {
                    try {
                        self._callback(map);
                    } catch (callbackError) {
                        console.error("Error in Map callback:", callbackError);
                    }
                    return;
                }
                
                // Execute queued method calls immediately - callback is called when map is ready
                // This matches the behavior of the .then() version where methods are called
                // directly on the map instance in the callback
                self._executeQueue();
                
                // Resolve promise if .then() was called
                if (self._promiseResolve) {
                    self._promiseResolve(map);
                }
            });
        } catch (mapError) {
            self._onError(mapError, 'Map creation');
        }
    }).catch(function(error) {
        self._onError(error, 'initialization');
    });
};

ixmaps.MapBuilder.prototype = {
    
    /**
     * Execute all queued method calls in strict order.
     * Stops execution on first error.
     * @private
     */
    _executeQueue: function() {
        // Execute queue immediately - callback is called when map is ready
        this._executeQueueNow();
    },
    
    /**
     * Actually execute the queued method calls.
     * @private
     */
    _executeQueueNow: function() {
        for (var i = 0; i < this._queue.length; i++) {
            var call = this._queue[i];
            try {
                // Check if method exists on the map
                if (typeof this._map[call.method] !== 'function') {
                    throw new Error("Method '" + call.method + "' does not exist on map object");
                }
                // Execute method exactly as it would be called in .then() callback
                this._map[call.method].apply(this._map, call.args);
            } catch (error) {
                this._onError(error, call.method);
                return; // Stop execution on error
            }
        }
        this._queue = [];
    },
    
    /**
     * Handle errors during queue execution or initialization.
     * Logs error message, stops queue, and rejects promise if applicable.
     * @private
     * @param {Error} error - The error that occurred
     * @param {string} methodName - Name of the method where error occurred
     */
    _onError: function(error, methodName) {
        this._error = error;
        var msg = "ixmaps.Map error in ." + methodName + "(): " + error.message;
        console.error(msg);
        
        // Reject promise if .then() was called
        if (this._promiseReject) {
            this._promiseReject(error);
        }
    },
    
    /**
     * Queue a method call or execute immediately if map is ready.
     * @private
     * @param {string} method - Method name to call
     * @param {Array} args - Arguments to pass to the method
     * @returns {ixmaps.MapBuilder} Returns self for chaining
     */
    _queueOrExecute: function(method, args) {
        if (this._error) {
            // Don't queue more calls if an error occurred
            return this;
        }
        
        // List of supported chainable methods
        var supportedMethods = [
            'view', 'layer', 'options', 'on', 'attribution', 
            'require', 'local', 'legend'
        ];
        
        // Check if method is supported by the chaining API
        if (supportedMethods.indexOf(method) === -1) {
            var error = new Error(
                "Method '" + method + "' is not supported by the fluent chaining API. " +
                "Supported methods: " + supportedMethods.join(', ') + ". " +
                "If you need to call this method, use the Promise-based API: " +
                "ixmaps.Map(...).then(map => map." + method + "(...))"
            );
            this._onError(error, method);
            return this;
        }
        
        if (this._ready && this._map) {
            // Map is ready, execute immediately
            try {
                if (typeof this._map[method] !== 'function') {
                    throw new Error("Method '" + method + "' does not exist on map object");
                }
                this._map[method].apply(this._map, args);
            } catch (error) {
                this._onError(error, method);
            }
        } else {
            // Map not ready, queue the call
            this._queue.push({ method: method, args: args });
        }
        return this;
    },
    
    // ==========================================
    // Chainable Methods
    // ==========================================
    
    /**
     * MapBuilder Chainable Methods
     * 
     * All chainable methods follow the same pattern:
     * 1. They accept method-specific parameters
     * 2. They call _queueOrExecute() which either:
     *    - Executes immediately if map is ready (this._ready && this._map)
     *    - Queues the call if map is not ready yet
     * 3. They return 'this' for method chaining
     * 
     * When the map becomes ready (after htmlgui_flat.js loads and initializes),
     * all queued methods are executed in strict order via _executeQueue().
     * This ensures fluent API calls work identically whether called before or
     * after the map is ready, matching the behavior of the Promise-based .then() API.
     */
    
    /**
     * Set the map view (center and zoom level).
     * Supports two signatures:
     * - view([lat, lng], zoom) - Array with coordinates and zoom as separate argument
     * - view({center: {lat, lng}, zoom: number}) - Object with center and zoom properties
     * @param {Array|Object} center - Center coordinates [lat, lng] or {center: {lat, lng}, zoom: number}
     * @param {number} [zoom] - Zoom level (if center is an array)
     * @returns {ixmaps.MapBuilder} Returns self for chaining
     */
    view: function(center, zoom) {
        // Support both signatures: view([lat, lng], zoom) and view({center: {lat, lng}, zoom: number})
        // Pass all arguments to preserve the exact call signature
        var args = Array.prototype.slice.call(arguments);
        return this._queueOrExecute('view', args);
    },
    
    /**
     * Add a layer/theme to the map.
     * Accepts either a layer name (string) for fluent definition, or a ready-made definition object.
     * @param {string|Object} layerDefOrName - Layer name (string) to start a fluent chain, or layer definition object (from ixmaps.layer().define())
     * @returns {ixmaps.MapBuilder|ixmaps.themeConstruct} If string: returns a layer builder with .data(), .binding(), .style(), .define(); .define() adds the layer and returns the map. If object: adds the layer and returns self.
     * @example
     * // Fluent: define layer from the map
     * map.layer("roads").data({url: "data.geojson", type: "geojson"}).binding({geo: "geometry"}).style({}).define();
     * @example
     * // Definition object (unchanged)
     * map.layer(ixmaps.layer("roads").data({url: "data.geojson", type: "geojson"}).define());
     */
    layer: function(layerDefOrName) {
        if (typeof layerDefOrName === 'string') {
            var lb = new ixmaps.themeConstruct(this.szMap, layerDefOrName);
            lb.__mapBuilder = this;
            var self = this;
            lb.define = function () {
                return self._queueOrExecute('layer', [this.def]);
            };
            return lb;
        }
        return this._queueOrExecute('layer', [layerDefOrName]);
    },
    
    /**
     * Set map options.
     * @param {Object} opts - Map options
     * @returns {ixmaps.MapBuilder} Returns self for chaining
     */
    options: function(opts) {
        return this._queueOrExecute('options', [opts]);
    },
    
    /**
     * Register an event handler.
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     * @returns {ixmaps.MapBuilder} Returns self for chaining
     */
    on: function(event, handler) {
        return this._queueOrExecute('on', [event, handler]);
    },
    
    /**
     * Set the map attribution text (displayed in the bottom left corner).
     * @param {string} text - Attribution text (can include HTML)
     * @returns {ixmaps.MapBuilder} Returns self for chaining
     */
    attribution: function(text) {
        return this._queueOrExecute('attribution', [text]);
    },
    
    /**
     * Set legend content (HTML string or URL).
     * @param {string} legend - Legend HTML string or URL
     * @returns {ixmaps.MapBuilder} Returns self for chaining
     */
    legend: function(legend) {
        return this._queueOrExecute('legend', [legend]);
    },
    
    /**
     * Load an external JavaScript file before map initialization.
     * Can be called multiple times to load multiple scripts.
     * @param {string} scriptPath - Path or URL to the JavaScript file to load
     * @returns {ixmaps.MapBuilder} Returns self for chaining
     */
    require: function(scriptPath) {
        return this._queueOrExecute('require', [scriptPath]);
    },
    
    /**
     * Set a localized string translation.
     * Maps a global (original) string to a localized version.
     * Can be called multiple times to set multiple translations.
     * @param {string} szGlobal - The original/global string to translate
     * @param {string} szLocal - The localized translation
     * @returns {ixmaps.MapBuilder} Returns self for chaining
     */
    local: function(szGlobal, szLocal) {
        return this._queueOrExecute('local', [szGlobal, szLocal]);
    },
    
    // ==========================================
    // Promise Support (Legacy API)
    // ==========================================
    
    /**
     * Promise-style then() for legacy API support.
     * @param {Function} onFulfilled - Called when map is ready
     * @param {Function} [onRejected] - Called on error
     * @returns {Promise} Returns a Promise that resolves with the map
     */
    then: function(onFulfilled, onRejected) {
        var self = this;
        
        return new Promise(function(resolve, reject) {
            if (self._ready && self._map) {
                // Already ready
                try {
                    var result = onFulfilled ? onFulfilled(self._map) : self._map;
                    resolve(result);
                } catch (error) {
                    if (onRejected) {
                        onRejected(error);
                    }
                    reject(error);
                }
            } else if (self._error) {
                // Already errored
                if (onRejected) {
                    onRejected(self._error);
                }
                reject(self._error);
            } else {
                // Store resolve/reject for later
                self._promiseResolve = function(map) {
                    try {
                        var result = onFulfilled ? onFulfilled(map) : map;
                        resolve(result);
                    } catch (error) {
                        if (onRejected) {
                            onRejected(error);
                        }
                        reject(error);
                    }
                };
                self._promiseReject = function(error) {
                    if (onRejected) {
                        onRejected(error);
                    }
                    reject(error);
                };
            }
        });
    },
    
    /**
     * Promise-style catch() for error handling.
     * @param {Function} onRejected - Called on error
     * @returns {Promise} Returns a Promise
     */
    catch: function(onRejected) {
        return this.then(null, onRejected);
    }
};

/**
 * Main map entry point: creates a map in the given container with optional fluent chaining or Promise API.
 * Loads the full ixmaps API (htmlgui_flat.js) on first use. Returns a Proxy around MapBuilder so that
 * unsupported method names yield a clear error and list of supported methods instead of undefined.
 *
 * @function ixmaps.Map
 * @param {string|HTMLElement} div - Target container ID or element
 * @param {Object} options - Map options (e.g. mode: "pan")
 * @param {Function} [callback] - Optional legacy callback(map) when map is ready
 * @returns {Proxy<ixmaps.MapBuilder>} Proxy around MapBuilder; supports view, layer, options, on, attribution, require, local, legend, then, catch
 */
window.ixmaps.Map = function (div, options, callback) {
    var builder = new ixmaps.MapBuilder(div, options, callback);

    var supportedMethods = [
        'view', 'layer', 'options', 'on', 'attribution',
        'require', 'local', 'legend', 'then', 'catch'
    ];

    // Proxy: intercept undefined property access to throw with supported-method list (AI/tooling-friendly)
    return new Proxy(builder, {
        get: function(target, prop) {
            // If property exists on target or its prototype, return it (normal behavior)
            // This includes all defined chainable methods and internal properties
            if (prop in target || (typeof prop === 'string' && typeof target[prop] !== 'undefined')) {
                return target[prop];
            }
            
            // If it's a Symbol or special property, return it from target
            if (typeof prop === 'symbol' || prop === 'constructor' || prop === 'toString' || prop === 'valueOf') {
                return target[prop];
            }
            
            // If it's an undefined method call, return a function that validates and throws
            if (typeof prop === 'string') {
                var error = new Error(
                    "Method '" + prop + "' is not supported by the fluent chaining API. " +
                    "Supported methods: " + supportedMethods.join(', ') + ". " +
                    "If you need to call this method, use the Promise-based API: " +
                    "ixmaps.Map(...).then(map => map." + prop + "(...))"
                );
                // Return a function that validates and throws the error when called
                return function() {
                    // Show alert for immediate feedback
                    alert("Error: Method '" + prop + "' is not supported by the fluent chaining API.\n\n" +
                          "Supported methods: " + supportedMethods.join(', ') + "\n\n" +
                          "If you need to call this method, use the Promise-based API:\n" +
                          "ixmaps.Map(...).then(map => map." + prop + "(...))");
                    target._onError(error, prop);
                    throw error;
                };
            }
            
            // For other properties, return undefined (normal JavaScript behavior)
            return undefined;
        }
    });
};

// log a message to the console
// this message is displayed when the ixmaps.js file is loaded
console.log("ixmaps.js loaded and waiting for initialization");


// -------------------------------------------------
//
// T H E M E   C O N S T R U C T   A P I
//
// -------------------------------------------------

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
     * @param {Object} [dataObj.data] - Inline data (alias for obj; GeoJSON/array/table)
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
                    // Support "data" as alias for "obj" (inline GeoJSON/array)
                    if (dataObj.data !== undefined) {
                        this.def.data.obj = dataObj.data;
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
    /**
     * Set the data process/transform identifier for the layer.
     * @param {string} szProcess - Process name or identifier
     * @returns {ixmaps.themeConstruct} Returns self for chaining
     */
    process: function (szProcess) {
        this.def.data.process = szProcess;
        return this;
    },
    /**
     * Set the data query (e.g. for external/DB sources).
     * @param {string} szQuery - Query string
     * @returns {ixmaps.themeConstruct} Returns self for chaining
     */
    query: function (szQuery) {
        this.def.data.query = szQuery;
        return this;
    },
    /**
     * Set the primary item/field name used for data binding (default "$item$").
     * @param {string} szName - Field name
     * @returns {ixmaps.themeConstruct} Returns self for chaining
     */
    field: function (szName) {
        this.def.field = szName;
        return this;
    },
    /**
     * Set the secondary field name (e.g. for 100% normalization).
     * @param {string} szName - Field name
     * @returns {ixmaps.themeConstruct} Returns self for chaining
     */
    field100: function (szName) {
        this.def.field100 = szName;
        return this;
    },
    /**
     * Set the lookup/join field for geometry or feature matching.
     * @param {string} szName - Field name (e.g. "geometry", "fid")
     * @returns {ixmaps.themeConstruct} Returns self for chaining
     */
    lookup: function (szName) {
        this.def.style.lookupfield = szName;
        return this;
    },
    /**
     * Alias for lookup: set the geometry/position field.
     * @param {string} szName - Field name
     * @returns {ixmaps.themeConstruct} Returns self for chaining
     */
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
    /**
     * Set bindings from encoding-style objects (field or raw value per key).
     * @param {Object} bObj - Keys are binding names; values are {field: string} or string
     * @returns {ixmaps.themeConstruct} Returns self for chaining
     */
    encoding: function (bObj) {
        this.def.binding = this.def.binding || {};
        for (var i in bObj) {
            this.def.binding[i] = bObj[i].field || bObj[i];
        }
        return this;
    },
    /**
     * Set a filter expression for the layer (e.g. to limit visible features).
     * @param {string} szFilter - Filter expression
     * @returns {ixmaps.themeConstruct} Returns self for chaining
     */
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
    /**
     * Set the layer title (displayed in legend/UI).
     * @param {string} szTitle - Title text
     * @returns {ixmaps.themeConstruct} Returns self for chaining
     */
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
 * Returns a themeConstruct instance bound to the current map context (this.szMap).
 * Use when defining layers from a context where the map is already set (e.g. inside ixmaps.embed).
 * For standalone layer definitions (e.g. passed to ixmaps.Map().layer(...)), use ixmaps.layer() instead.
 *
 * @function ixmaps.theme
 * @param {string} [szLayer] - Layer name/identifier
 * @returns {ixmaps.themeConstruct} New themeConstruct instance
 */
ixmaps.theme = function (szLayer) {
    return new ixmaps.themeConstruct(this.szMap, szLayer);
};

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
 * Alias for {@link ixmaps.layer}. Same behaviour; use when "Layer" is preferred (e.g. to avoid conflicts with other APIs).
 * @function ixmaps.Layer
 * @param {string} [szLayer] - Layer name/identifier
 * @param {Function} [callback] - Optional callback(layerBuilder) that receives the builder; when used, returns layer definition JSON
 * @returns {ixmaps.themeConstruct|Object} themeConstruct instance or layer definition object if callback provided
 */
ixmaps.Layer = function (szLayer, callback) {
    return ixmaps.layer(szLayer, callback);
};



