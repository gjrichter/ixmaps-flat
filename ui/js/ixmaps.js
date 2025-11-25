/**
 * File: ixmaps.js
 * Project: iXMaps core library
 * Author: Guenter Richter (original), contributors
 *
 * Description:
 *   Core API that exposes the iXMaps namespace to HTML pages and other runtimes.
 *   Provides helper utilities for embedding maps, manipulating themes, handling
 *   map instances, and registering UI behaviour. Consolidates legacy functionality
 *   that historically lived in `htmlgui_api.js` while keeping backward compatibility.
 *
 * Notes:
 *   - The file exports the global `ixmaps` object (UMD style).
 *   - Many legacy helper methods are preserved for compatibility; refactoring
 *     should retain the public signatures referenced by existing projects.
 *
 * License: MIT
 */

/** 
 * @fileoverview This file provides iXmaps interface functions for HTML Pages that embed ixmaps maps<br>
 * @example 
 *
 * embed the map by ixmaps api function and address by the returned map Promise
 *
 * <!DOCTYPE html>
 * <html>
 *   <body>
 *     <div id="map_div"></div>
 * 
 *     <script type="text/javascript" src = "../../ui/js/ixmaps.js" > </script>
 *     <script type="text/javascript" charset="utf-8">
 *
 *     ixmaps.Map("map_div", {
 *        mapName:    "map",
 *        mapService: "leaflet",
 *        mapType:    "OpenStreetMap - FR"
 *     }).then((map) => {
 *        map.view([42.79540065303723,13.20831298828125], 9);
 *        map.layer({
 *          layer: "com2011_s",
 *          field: "Totale complessivo",
 *          style: {
 *            type: "CHOROPLETH|EQUIDISTANT",
 *            colorscheme: ["5", "#FFFDD8", "#B5284B", "2colors", "#FCBA6C"],
 *            dbtable: "themeDataObj csv url(http://mysite/mydata/data.csv)",
 *            lookupfield: "comune"
 *          });
 *     });
 *
 *     </script>
 *   </body>
 * </html>
 *
 * @author Guenter Richter guenter.richter@medienobjekte.de
 * @version 1.0 
 * @copyright CC BY SA
 * @license MIT
 */


/** 
 * @namespace ixmaps
 */

(function (window, document, undefined) {

    var ixmaps = {
        version: "1.0",
        JSON_Schema: "https://gjrichter.github.io/ixmaps/schema/ixmaps/v1.json"
    };

    /**
     * Exposes the ixmaps object to the global window scope.
     * Saves the original ixmaps object to restore later if needed.
     * @function expose
     * @private
     * @returns {void}
     */
    function expose() {
        var oldIxmaps = window.ixmaps;

        ixmaps.noConflict = function () {
            window.ixmaps = oldIxmaps;
            return this;
        };

        window.ixmaps = ixmaps;
    }

    // define Data for Node module pattern loaders, including Browserify
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = ixmaps;

        // define Data as an AMD module
    } else if (typeof define === 'function' && define.amd) {
        define(ixmaps);
    }

    // define Data as a global variable, saving the original Data to restore later if needed
    if (typeof window !== 'undefined') {
        expose();
    }

    /**
     * List of file URLs and their expected types that need to be loaded for the ixmaps application.
     * This array defines all CSS, JavaScript, HTML, and other resources required for the map interface.
     * Resources are loaded asynchronously and processed based on their type (css, js, html, shortcut).
     * @type {Array<{url: string, type: string}>}
     * @private
     */
    const fileUrls = [
        {
            url: 'ui/html/assets/css/icomoon.css',
            type: 'css'
        },
        {
            url: 'ui/html/assets/css/font-awesome.min.css',
            type: 'css'
        },
        {
            url: 'ui/css/messagebox.css',
            type: 'css'
        },
        {
            url: 'ui/css/legend.css',
            type: 'css'
        },
        {
            url: 'ui/css/main.css',
            type: 'css'
        },
        {
            url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
            type: 'css'
        },
        {
            url: 'ui/libs/leaflet-gesture-handling/leaflet-gesture-handling.min.css',
            type: 'css'
        },
        {
            url: 'ui/css/ixmaps.css',
            type: 'css'
        },

        {
            url: 'ui/libs/jquery/jquery-1.7.1.min.js',
            type: 'js'
        },
        {
            url: 'ui/libs/getUrlParam/js/jquery.getUrlParam.js',
            type: 'js'
        },
        {
            url: 'ui/libs/modernizr/js/testsvg.js',
            type: 'js'
        },
        /**
        {
            url: 'https://cdn.jsdelivr.net/npm/jquery@3.6.3/dist/jquery.min.js',
            type: 'js'
        },
        **/
        {
            url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
            type: 'js'
        },
        {
            url: 'ui/libs/maptiler/maptiler-sdk.umd.js',
            type: 'js'
        },
        {
            url: 'ui/libs/maptiler/maptiler-sdk.css',
            type: 'css'
        },
        {
            url: 'ui/libs/maptiler/leaflet-maptilersdk.js',
            type: 'js'
        },
        {
            url: 'ui/libs/messagebox.js',
            type: 'js'
        },
        {
            url: 'ui/js/htmlgui.js',
            type: 'js'
        },
        {
            url: 'ui/js/htmlgui_sync.js',
            type: 'js'
        },
        {
            url: 'ui/js/htmlgui_sync_Leaflet_VT.js',
            type: 'js'
        },
        {
            url: 'ui/js/htmlgui_dialog.js',
            type: 'js'
        },
        {
            url: 'ui/js/htmlgui_story.js',
            type: 'js'
        },
        
        // for configurator only
        // TODO: Move these configurator-specific resources to the dialog code
        // to avoid loading them for all map instances
        {
            url: 'ui/js/htmlgui_query.js',
            type: 'js'
        },
        {
            url: 'ui/js/tools/dialogmanager.js',
            type: 'js'
        },
        {
            url: 'ui/js/tools/colorscheme.js',
            type: 'js'
        },
        {
            url: 'ui/js/tools/colorselect.js',
            type: 'js'
        },
        // ---------------------
        
        {
            url: '../data.js/data.js',
            type: 'js'
        },
        {
            url: 'ui/js/tools/legend.js',
            type: 'js'
        },
        {
            url: 'ui/js/tools/layer_legend.js',
            type: 'js'
        },
        {
            url: 'ui/js/tools/tooltip_mustache.js',
            type: 'js'
        },
        {
            url: 'ui/libs/leaflet-gesture-handling/leaflet-gesture-handling.min.js',
            type: 'js'
        },

        {
            url: 'ui/html/mappage.html',
            type: 'html'
        },
        
        {
            url: 'ui/resources/images/ixmaps_logo.png',
            type: 'shortcut'
        },

        {
            url: 'https://unpkg.com/topojson-client@3.1.0/dist/topojson-client.min.js',
            type: 'js'
        }

        /**
         * Commented out resources - these were previously used but are currently disabled
         * due to compatibility issues or alternative implementations being preferred.
         * Uncomment if needed for specific functionality.
         */
        //{ url: 'https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.7.5/proj4.min.js', type: 'js' },
        //{ url: 'https://unpkg.com/fzstd', type: 'js' },
        //{ url: 'https://cdn.jsdelivr.net/npm/fzstd/umd/index.js', type: 'js' }

        ];

    /**
     * Loads a resource (file) from a given URL.
     *
     * @async
     * @param {string} url - The URL of the resource to load.
     * @param {string} type - The type of the resource (e.g., 'json', 'text', 'js', 'css', 'html', 'blob', 'shortcut').
     * @returns {Promise<any>} A promise that resolves with the loaded resource data or void.
     * @throws {Error} Throws an error if the HTTP request fails or if an unsupported file type is provided.
     */
    async function loadResource(url, type, target) {

        if (!url.match(/http/)) {
            url = ixmaps.szResourceBase + url;
        }

        //console.log("- load: "+url);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }

        switch (type) {
            case 'json':
                return response.json();
            case 'text':
                return response.text();
            case 'blob':
                return response.blob();
            case 'js':
                return response.text(); // no need to eval here
            case 'css':
                const css = await response.text();
                const style = document.createElement('style');
                style.innerHTML = css;
                document.head.appendChild(style);
                return; // no need to return css content
            case 'html':
                const html = await response.text();
                document.getElementById(target).innerHTML = html;
                return;
            case 'shortcut':
                const blob = await response.blob();
                const iconUrl = URL.createObjectURL(blob);
                let link = document.querySelector("link[rel='shortcut icon']");
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'shortcut icon';
                    document.head.appendChild(link);
                }
                link.href = iconUrl;
                return;
            default:
                throw new Error('Unsupported file type');
        }
    }

    /**
     * Loads multiple resources from a list of URLs.
     *
     * @async
     * @param {Array<{url: string, type: string}>} urls - An array of objects, each containing a 'url' and a 'type'.
     * @param {string} target - The target element ID where HTML content should be inserted (for 'html' type resources).
     * @param {function} [callback] - An optional callback function to be executed after all resources are loaded successfully.
     * @param {object} [opt] - Optional configuration object passed to the callback function.
     * @param {function} [callback2] - An optional secondary callback function.
     * @returns {Promise<void>} A promise that resolves when all resources are loaded and processed.
     * @throws {Error} Throws an error if any resource fails to load.
     */
    async function loadResources(urls, target, callback, opt, callback2) {
        console.log("... load resources -->")
        try {
            const fetchPromises = urls.map(({
                url,
                type
            }) => loadResource(url, type, target));
            const files = await Promise.all(fetchPromises);

            for (const file of files) {
                if (typeof file === 'string') {
                    eval(file); // Execute only JavaScript code.
                }
            }
            
            console.log('... all resources loaded successfully');
            //console.log('');

            if (callback) {
                callback(opt, callback2);
            }
        } catch (error) {
            console.error('Error loading resources:', error);
        }
    }
    
    ixmaps.loadResources = function(urls, target, callback, opt, callback2){
        return loadResources(urls, target, callback, opt, callback2);
    };
    
    /**
     * Initializes the loaded UI by parameter.
     *
     * This function configures and styles the map UI using options gives as parameter
     * legend position, on map tools, ...
     * @param {object} opt - a JSON object with parameters.
     * @returns void
    */
    const __config_map_ui = function (opt) {

        $("#map-overlay").css("pointer-events", "none");
        $("#map-overlay").css("width", "100%");

        // -----------------
        // map/theme legend
        // -----------------

        if (opt.align) {
            if (opt.align.match(/left/)) {
                ixmaps.legendAlign = "left";
                $(".map-legend").attr("data-align", "left");
                $(".map-legend").css("text-align", "left");
                var szLeft = opt.align.split("left")[0] || "55px";
                $(".map-legend").css("left", szLeft);
                $(".map-legend").css("top", "12px");
                $(".title-field").css("left", "100px");
                $(".map-legend").css("background", "rgba(255,255,255,0.9");
                $(".map-legend").css("padding", "0 1em");
                $(".map-legend").css("border-radius", "0.5em");
            } else
            if (opt.align.match(/right/)) {
                ixmaps.legendAlign = "right";
                $(".map-legend").attr("data-align", "right");
                $(".map-legend").css("text-align", "left");
                var szRight = opt.align.split("right")[0] || "25px";
                $(".map-legend").css("right", szRight);
                $(".title-field").css("right", "100px");
                $(".map-legend").css("background", "rgba(255,255,255,0.9");
                $(".map-legend").css("padding", "0 1em");
                $(".map-legend").css("border-radius", "0.5em");
            } else
            if ((opt.align == "center") ||
                (opt.align == "top")) {
                $("#map-legend").appendTo("#map-header");
                $("#map-header").show();
                //$("#ixmap").css("top", "75px");
                ixmaps.legendAlign = "center";
                $(".map-legend").css("position", "relative");
                $(".map-legend").attr("data-align", "right");
                $(".map-legend").css("text-align", "center");
                $(".map-legend").css("font-size", "0.7em");
                $(".map-legend").css("margin", "auto");
                $(".map-legend").css("margin-top", "-15px");
                $(".map-legend").css("min-height", "77px");
                $(".map-legend").css("width", "100%");
                $(".map-legend").css("max-width", "inferit");
                $(".map-legend").css("left", "0px");
                $(".map-legend").css("opacity", "1");
            } else
            if (opt.align == "bottom") {
                $("#map-legend").appendTo("#map-header");
                $("#map-header").show();
                $("#ixmap").css("top", "0px");
                ixmaps.legendAlign = "center";
                $(".map-legend").attr("data-align", "right");
                $(".map-legend").css("text-align", "center");
                $(".map-legend").css("font-size", "0.7em");
                $(".map-legend").css("width", "100%");
                $(".map-legend").css("max-width", "inherit");
                $(".map-legend").css("position", "absolute");
                $(".map-legend").css("left", "0px");
                $(".map-legend").css("top", "720px");

                // GR 13/12/2023 HTML color maptype -> map background color 
                // TODO: Implement dynamic background color based on maptype parameter
                // This feature would allow setting the map background color based on URL parameters
                //$(".map-legend").css("background", "rgba(255,255,255,0.5)");
                //var szBackgroundcolor = decodeURIComponent($(document).getUrlParam('maptype'));
                //if (szBackgroundcolor && (szBackgroundcolor.charAt(0) == '#')) {
                //    $("body").css("background", decodeURIComponent($(document).getUrlParam('maptype')));
                //}

                $("#onmapbuttondiv").css("left", "");
                $("#onmapbuttondiv").css("right", "60px");
                $(".title-field").css("right", "100px");
            }
        } else {
            $(".map-legend").css("right", "25px");
            $(".title-field").css("left", "100px");
        }
        setTimeout(() => {
             ixmaps.mapTool(opt.mode||"pan");
             // Initialize mode toggle button state based on opt.mode
             ixmaps.setModeToggleState(opt.mode||"pan");
        }, 1000);

        // set text align for the map !
        $("#ixmap").parent().css("text-align", "left");
        
        if (opt.attribution) {
        	// set attribution (bottom left on map space)
            var attribution = opt.attribution;
            $("#attribution").html((attribution && (attribution != "null")) ? attribution : "");
            ixmaps.attribution = attribution;
        }                   

        // -------------
        // context menu
        // -------------

        // Context menu only on map div
        document.getElementById("ixmap").addEventListener("contextmenu", function(e) {
            e.preventDefault();
            e.stopPropagation();
            $("#contextmenu")[0].style.left = e.pageX - 20 + 'px';
            $("#contextmenu")[0].style.top = e.pageY - 20 + 'px';
            $("#contextmenu").show();
            return true;
        });

        var __contextMenuTrigger = null;
        __contextmenuOver = function(el) {
            clearTimeout(__contextMenuTrigger);
            __contextMenuTrigger = true;
        }

        __contextmenuOut = function(el) {
            __contextMenuTrigger = setTimeout("$('#contextmenu').hide()", 100);
        }

        if (opt.toolbutton || opt.tools ) {
            //$("#switchtoolsbutton").show();
            $("#modeToggle").show();
            setTimeout('$("#onmapbuttondiv").show();', 1000);
            $("#modeToggle").css("cursor", "pointer").click(function (e) {
                e.preventDefault();
                e.stopPropagation();
                ixmaps.toggleInputMode();
            });
            // Keyboard shortcut: press 'M' to toggle mode
            document.addEventListener('keydown', function(event) {
                if (event.key === 'm' || event.key === 'M') {
                    ixmaps.toggleInputMode();
                }
            });
        }else{
            $("#modeToggle").hide();
        }
        
        // Hide search button if search is explicitly false or "false"
        if (opt.search === false || opt.search === "false" || opt.search === "False") {
            $("#switchsearchbutton").hide();
        } else if (opt.search) {

            ixmaps.search.szSearchSuffix = opt.search;

            $("#switchsearchbutton").show();
            $("#switchsearchbutton").css("cursor", "pointer").click(function (e) {
                e.preventDefault();
                e.stopPropagation();
                $(".search-container").css('top', $("#switchsearchbutton").parent().position().top+$("#switchsearchbutton").position().top);
                $(".search-container").css('left', $("#switchsearchbutton").parent().position().left);
                $("#switchsearchbutton").hide();
                $(".search-container").show().animate({
                    width: "400px"
                }, 500);
                $(".search-box").show();
            });
            $(".search-container").click(function (e) {
                e.preventDefault();
                e.stopPropagation();
                $(".search-container").animate({
                    width: "0px"
                }, 500);
                $(".search-container").hide();
                $(".search-box").val("");
                $("#switchsearchbutton").show();
            });
            $(".search-box").click(function (e) {
                e.stopPropagation();
            });
            setTimeout('$("#onmapbuttondiv").show();', 1000);
        }

        ixmaps.search.initSearch();


    }

    // ----------------------------
    // M A P   P R O J E C T I O N S
    // ----------------------------

    /**
     * Get list of available map projections
     * @returns {Array} Array of available projection names
     */
    ixmaps.getAvailableProjections = function() {
        return ['mercator', 'winkel', 'equalearth', 'albersequalarea', 'lambertazimuthalequalarea', 'orthographic'];
    };

    /**
     * Get SVG path for a projection name
     * @param {string} projection - Projection name
     * @returns {string} SVG file path
     */
    ixmaps.getProjectionPath = function(projection) {
        const projectionMap = {
            'mercator': 'maps/svg/maps/generic/mercator.svg',
            'winkel': 'maps/svg/maps/generic/winkel.svg',
            'equalearth': 'maps/svg/maps/generic/equalearth.svg',
            'albers': 'maps/svg/maps/generic/albersequalarea.svg',
            'albersequalarea': 'maps/svg/maps/generic/albersequalarea.svg',
            'lambert': 'maps/svg/maps/generic/lambertazimuthalequalarea.svg',
            'lambertazimuthalequalarea': 'maps/svg/maps/generic/lambertazimuthalequalarea.svg',
            'orthographic': 'maps/svg/maps/generic/orthographic.svg'
        };
        return projectionMap[projection.toLowerCase()] || projectionMap['mercator'];
    };

    // ----------------------------
    // M O D E   T O G G L E
    // ----------------------------

    var currentMode = 'pan';

    // SVG icons (outlined style)
    const panIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3L12 8M12 16L12 21M3 12L8 12M16 12L21 12"/><path d="M8 8L12 12L8 16M16 8L12 12L16 16"/></svg>';
    const infoIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9"/><path d="M12 16L12 12"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/></svg>';

    /**
     * Set the mode toggle button visual state
     * @param {string} mode - The mode to set ('pan' or 'info')
     */
    ixmaps.setModeToggleState = function(mode) {
        const modeButton = document.getElementById('modeToggle');
        const modeIcon = document.getElementById('modeIcon');
        const modeLabel = modeButton ? modeButton.querySelector('.mode-label') : null;
        
        if (!modeButton || !modeIcon || !modeLabel) {
            return;
        }
        
        if (mode === 'info') {
            currentMode = 'info';
            modeIcon.innerHTML = infoIcon;
            modeLabel.textContent = 'INFO';
            modeButton.classList.add('info-mode');
            modeButton.title = 'Modalità INFO - Clicca per tornare a PAN';
        } else {
            currentMode = 'pan';
            modeIcon.innerHTML = panIcon;
            modeLabel.textContent = 'PAN';
            modeButton.classList.remove('info-mode');
            modeButton.title = 'Modalità PAN - Clicca per passare a INFO';
        }
    }

    ixmaps.toggleInputMode = function() {
        if (currentMode === 'pan') {
            // Switch to INFO mode
            ixmaps.setMode('info');
            ixmaps.setModeToggleState('info');
        } else {
            // Switch to PAN mode
            ixmaps.setMode('pan');
            ixmaps.setModeToggleState('pan');
        }
    }

    __switchInputMode = function (szSource) {

        switch (ixmaps.getMapTool()) {
            case 'info':
                ixmaps.mapTool((szSource && (szSource == "button")) ? 'pan' : 'idle');
                ixmaps.switchAndroidEventPane(true);
                $("#switchmodebuttonicon").attr("src", "../resources/images/mano.png");
                $("#switchmodebuttonicon").css("opacity", "1");
                $("#switchmodebutton").css("background", "#ffffff url(../resources/images/info.png) no-repeat 95% 55%");
                $("#switchmodebutton").css("background-size", "13px");
                $("#switchinfobutton").hide();
                //$("#onmapbuttondivzoom").hide();
                break;
            case 'pan':
            default:
                ixmaps.mapTool('info');
                ixmaps.switchAndroidEventPane(false);
                $("#switchmodebuttonicon").attr("src", "../resources/images/info.png");
                $("#switchmodebutton").css("background", "#ffffff url(../resources/images/mano.png) no-repeat 98% 55%");
                $("#switchmodebutton").css("background-size", "13px");
                $("#switchmodebuttonicon").css("opacity", "1");
                $("#onmapbuttondivzoom").show();
                break;
        }
    };


    /**
     * Initializes and loads the ixmaps map application.
     *
     * This function sets up the map configuration, including the map service, type, SVG map,
     * map size, controls, and initial view. It also defines event handlers and themes for the map.
     */
    const __load_map = function (opt, callback) {

        // Map opt.legend to opt.legendState for backward compatibility
        if (opt.legend && !opt.legendState) {
            opt.legendState = opt.legend;
        }

        ixmaps.legendState = (opt.legendState && opt.legendState == "closed") ? 0 : 1;
        
        ixmaps.fMapControls = true;
        let szControls = "small";
        let szSvgLegendFlag = "nolegend";
        let szHTMLLegendFlag = "1";

        // Map projection name to SVG file mapping
        const projectionMap = {
            'mercator': 'maps/svg/maps/generic/mercator.svg',
            'winkel': 'maps/svg/maps/generic/winkel.svg',
            'equalearth': 'maps/svg/maps/generic/equalearth.svg',
            'albers': 'maps/svg/maps/generic/albersequalarea.svg',
            'albersequalarea': 'maps/svg/maps/generic/albersequalarea.svg',
            'lambert': 'maps/svg/maps/generic/lambertazimuthalequalarea.svg',
            'lambertazimuthalequalarea': 'maps/svg/maps/generic/lambertazimuthalequalarea.svg',
            'orthographic': 'maps/svg/maps/generic/orthographic.svg'
        };

        // GR 12.02.2015 define fallback default map, used if parameter SVGGIS is empty  
        let szDefaultMap = "maps/svg/maps/generic/mercator.svg";

        // Handle mapProjection parameter (simple projection name)
        // or fall back to map parameter (full SVG path)
        let szMap = null;
        let currentProjection = ixmaps.currentProjection = "mercator";
        if (opt.mapProjection) {
            currentProjection = opt.mapProjection.toLowerCase();
            szMap = projectionMap[currentProjection] || szDefaultMap;
            // Store projection name globally for later use (e.g., in view())
            ixmaps.currentProjection = currentProjection;
        } else {
            szMap = opt.map || null;
        }
        szMap = (szMap && (szMap != "null")) ? szMap : szDefaultMap;

        let szMapSize = "fullscreen";
        
        // Support for multiple maps - use unique div ID if mapName is provided
        const mapName = opt.mapName || "default";
        const divId = opt.divId || "ixmap";
        
        // Create unique div ID for multiple maps
        const uniqueDivId = mapName !== "default" ? `${divId}_${mapName}` : divId;
        
        // Create the map container if it doesn't exist
        if (!document.getElementById(uniqueDivId)) {
            const mapContainer = document.createElement('div');
            mapContainer.id = uniqueDivId;
            mapContainer.style.width = opt.width || '100%';
            mapContainer.style.height = opt.height || '100%';
            document.body.appendChild(mapContainer);
        }
        
        // if both width and height are given and expressed in "px" 
        if (opt.width || opt.height && !opt.height.match(/%/)){
            console.log("--- opt ---");
            console.log(opt);
            $(`#${uniqueDivId}`).css("width",opt.width||"100%");
            $(`#${uniqueDivId}`).css("height",opt.height||window.innerHeight+"px");
            //$(`#${uniqueDivId}`).parent().css("width",opt.width||"100%");
            $(`#${uniqueDivId}`).parent().css("height",opt.height||window.innerHeight+"px");
            szMapSize = "fix";
        }
 
        // Prepare map options
        const mapOptions = {
            mapService: opt.mapService || "leaflet_vt",
            maptype: opt.maptype || opt.mapType || "Stamen - toner-lite",
            svg: szMap,
            mapsize: szMapSize,
            footer: ixmaps.footer || 0,
            mode: szSvgLegendFlag,
            controls: szControls,
            silent: opt.silent || true,
            scrollsafe: opt.scrollsafe || false,
            scrollsafesilent: opt.scrollsafesilent || false
        };
        
        // Add Albers Equal Area projection parameters if provided
        // Store them globally so mapscript.js can access them during initialization
        if (opt.projectionParams) {
            mapOptions.projectionParams = opt.projectionParams;
            ixmaps.projectionParams = opt.projectionParams;
        }
        
        map = new ixmaps.map(uniqueDivId, mapOptions);
        
        console.log(ixmaps);
        ixmaps.onMapReady = function (szMap) {
            const mapApi = new ixmaps.mapApi(szMap);
            
            // Register the map instance if a name is provided
            if (mapName !== "default") {
                ixmaps.registerMapInstance(mapName, mapApi, {
                    divId: uniqueDivId,
                    mapService: opt.mapService || "leaflet_vt",
                    maptype: opt.maptype || opt.mapType || "Stamen - toner-lite",
                    ...opt
                });
            }
            
            callback(mapApi);
        };

        ixmaps.date = null;
        ixmaps.parent = null;

        // set sync mode ?
        // --------------------
        ixmaps.fSyncMap = true;
        ixmaps.setAutoSwitchInfo(true);

        // show/hide toolsbar elements
        // TODO: Implement dynamic toolbar visibility based on user preferences
        // This would allow showing/hiding toolbar elements based on configuration
        //__switchBannerElements();
        //setTimeout("__switchBannerElements()", 5000);
        htmlMap_enableScrollWheelZoom();

        // configure and style the map UI
        // ------------------------------
        __config_map_ui(opt);
    };




    // generate iframe and embed a map
    // --------------------------------------
    /**
     * embed
     * @param {String} szTargetDiv the id of the <div> to host the map
     * @param {Object} opt a JSON object that describes the map source  
     * @param {Function} fCallBack the function to call, if the map is loaded
     * @return void
     * @example
     *
     * <!DOCTYPE html>
     * <html>
     *   <body>
     *     <div id="map_div"></div>
     *   </body>
     * 
     *     <script type="text/javascript" src = "../../ui/js/ixmaps.js" > </script>
     *     <script type="text/javascript" charset="utf-8">
     *
     *     ixmaps.embed("map_div",
     *       { 
     *          mapName:    "map", 
     *          mapService: "leaflet",
     *          mapType:    "OpenStreetMap - FR"
     *       }
     *     ); 
     *     </script>
     * </html>
     */

    ixmaps.embed = async function (szTargetDiv, opt, callback) {

        console.log("... ixmaps.embed() ---->");

        ixmaps.szResourceBase = "../../";

        let scriptsA = document.querySelectorAll("script");
        for (var i in scriptsA) {
            let scr = scriptsA[i].getAttribute("src");
            if (scr && scr.match(/ixmaps.js/)) {
                ixmaps.szResourceBase = (scr.split("ui/js/ixmaps.js")[0]);
                break;
            }
            if (scr && scr.match(/htmlgui_flat.js/)) {
                ixmaps.szResourceBase = (scr.split("ui/js/htmlgui_flat.js")[0]);
                break;
            }
        }   

        console.log("... ixmaps.szResourceBase = " + ixmaps.szResourceBase);                        
        if (opt.mapCdn) {
            ixmaps.szResourceBase = opt.mapCdn;
        }   

        var target = window.document.getElementById(szTargetDiv);
        
        // Return a Promise that resolves when the map is ready
        return new Promise((resolve, reject) => {
            try {
                // Call the function with the list of file URLs and types
                loadResources(fileUrls, szTargetDiv, __load_map, opt, callback || ((mapApi) => {
                    resolve(mapApi);
                }));
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Convenience alias for {@link ixmaps.embed}. Provides the same behaviour while
     * avoiding namespace conflicts with existing APIs.
     * @function ixmaps.Map
     * @param {String} szTargetDiv
     * @param {Object} opt
     * @param {Function} callback
     * @returns {Promise}
     */
    ixmaps.Map = function (szTargetDiv, opt, callback) {
        console.log("ixmaps.Map() ----> szTargetDiv = " + szTargetDiv + " opt = " + JSON.stringify(opt));
        return ixmaps.embed(szTargetDiv, opt, callback);
    };

    /**
     * the ixmaps.themeApi class
     * provides methods to manipulate realized map themes
     * @class It realizes an object to hold a theme handle
     * @constructor
     * @param {String} [szMap] the name of the map, to define if more than one map present
     * @param {String} [szTheme] the theme id, to define if more than one theme present
     * @return A new ixmaps.themeApi object
     */

    ixmaps.themeApi = function (szMap, szTheme) {
        this.szMap = szMap || null;
        this.szTheme = szTheme || null;
        this.obj = ixmaps.getThemeObj(szTheme) || null;
    };
    ixmaps.themeApi.prototype = {

        /**
         * change Style 
         * @param {String} szStyle a style definition string (see <a href="http://public.ixmaps.com.s3-website-eu-west-1.amazonaws.com/docs/ixmaps-doc-themes-1.html" target="_blank">documentation</a>)
         * @param {String} szFlag the style change method ('set' or 'factor' or 'remove' - see api doc)
         * @example ixmaps.map().theme().changeStyle("opacity:0.5","factor");
         * @example ixmaps.map("map1").theme().changeStyle("type:AGGREGATE","add");
         * @return void
         **/
        changeStyle: function (szStyle, szFlag) {
            ixmaps.changeThemeStyle(this.szMap, this.szTheme, szStyle, szFlag);
        },
        /**
         * mark/highlight theme class
         * @param {Number} nClass the number of the class to mark/highlight
         * @example ixmaps.map().theme().markClass(1);
         * @return void
         **/
        markClass: function (nClass) {
            ixmaps.markThemeClass(this.szMap, this.szTheme, nClass);
        },
        /**
         * unmark theme class
         * @param {Number} nClass the number of the class to un mark
         * @example ixmaps.map().theme().unmarkClass(1);
         * @return void
         **/
        unmarkClass: function (nClass) {
            ixmaps.unmarkThemeClass(this.szMap, this.szTheme, nClass);
        },
        /**
         * show theme
         * @example ixmaps.map().theme().show();
         * @return void
         **/
        show: function () {
            ixmaps.showTheme(this.szMap, this.szTheme);
        },
        /**
         * hide theme
         * @example ixmaps.map().theme().show();
         * @return void
         **/
        hide: function () {
            ixmaps.hideTheme(this.szMap, this.szTheme);
        },
        /**
         * toggle theme
         * @example ixmaps.map().theme().toggle();
         * @return void
         **/
        toggle: function () {
            ixmaps.toggleTheme(this.szMap, this.szTheme);
        },
        /**
         * remove theme
         * @example ixmaps.map().theme().remove();
         * @return void
         **/
        remove: function () {
            ixmaps.removeTheme(this.szMap, this.szTheme);
        },
        /**
         * replace theme
         * @example ixmaps.map().theme().replace(newTheme);
         * @return void
         **/
        replace: function (theme, flag) {
            ixmaps.removeTheme(this.szMap, this.szTheme);
            ixmaps.newTheme(this.szMap, "layer", theme, flag);
        }
    };

    /**
     * the ixmaps.mapApi class.  
     * provides methods to handle maps
     * @class It realizes an object to hold a map handle
     * @constructor
     * @param {String} [szMap] the name of the map, to define if more than one map present
     * @return A new ixmaps.themeApi object
     */
    ixmaps.mapApi = function (szMap) {
        this.szMap = szMap || null;
    };
    ixmaps.mapApi.prototype = {

        setMapTypeId: function (szMapTypeId) {
            ixmaps.setMapTypeId(szMapTypeId);
            return this;
        },
        setMapType: function (szMapTypeId) {
            ixmaps.setMapTypeId(szMapTypeId);
            return this;
        },
        mapType: function (szMapTypeId) {
            ixmaps.setMapTypeId(szMapTypeId);
            return this;
        },
        setBasemapOpacity: function (nOpacity, szMode) {
            ixmaps.setBasemapOpacity(nOpacity, szMode);
            return this;
        },

        loadMap: function (szUrl) {
            alert(szUrl);
            ixmaps.loadMap(szUrl);
            return this;
        },

        setBounds: function (bounds) {
            ixmaps.setBounds(bounds);
            return this;
        },
        
        setView: function (center, zoom) {
            ixmaps.setView(center, zoom);
            return this;
        },
        
        view: function (center, zoom) {
            ixmaps.setView(center, zoom);
            return this;
        },

        flyTo: function (center, zoom) {
            ixmaps.flyTo(center, zoom);
            return this;
        },

        resize: function () {
            ixmaps.resizeMap(null, false);
            return this;
        },

        setScaleParam: function (szParam) {
            ixmaps.setScaleParam(szParam);
            return this;
        },

        setMapFeatures: function (szFeatures) {
            ixmaps.setMapFeatures(szFeatures);
            return this;
        },

        setOptions: function (options) {
            ixmaps.setOptions(options);
            return this;
        },
        options: function (options) {
            ixmaps.setOptions(options);
            return this;
        },

        attribution: function (attribution) {
            ixmaps.setAttribution(attribution);
            return this;
        },

        legend: function (legend) {
            ixmaps.setLegend(legend);
            return this;
        },

        about: function (about) {
            ixmaps.setAbout(about);
            return this;
        },

        title: function (szTitle) {
            ixmaps.embeddedApiA[this.szMap].setTitle(szTitle);
            return this;
        },

        setExternalData: function (data, options) {
            ixmaps.setExternalData(data, options);
            return this;
        },
        setData: function (data, options) {
            ixmaps.setExternalData(data, options);
            return this;
        },
        data: function (data, options) {
            ixmaps.setExternalData(data, options);
            return this;
        },


        setLocalString: function (szGlobal, szLocal) {
            ixmaps.setLocal(szGlobal, szLocal);
            return this;
        },
        setLocal: function (szGlobal, szLocal) {
            ixmaps.setLocal(szGlobal, szLocal);
            return this;
        },
        localize: function (szGlobal, szLocal) {
            ixmaps.setLocal(szGlobal, szLocal);
            return this;
        },
        local: function (szGlobal, szLocal) {
            ixmaps.setLocal(szGlobal, szLocal);
            return this;
        },


        newTheme: function (title, theme, flag) {
            ixmaps.newTheme(title, theme, flag);
            return this;
        },
        addTheme: function (title, theme, flag) {
            ixmaps.newTheme(title, theme, flag);
            return this;
        },
        layer: function (theme, flag) {
            ixmaps.newTheme("layer", theme, flag);
            return this;
        },
        add: function (theme, flag) {
            ixmaps.newTheme("layer", theme, flag);
            return this;
        },


        changeThemeStyle: function (szTheme, style, flag) {
            ixmaps.changeThemeStyle(szTheme, style, flag);
            return this;
        },

        removeTheme: function (szTheme) {
            ixmaps.removeTheme(szTheme);
            return this;
        },
        remove: function (szTheme) {
            ixmaps.removeTheme(szTheme);
            return this;    
        },

        toggleTheme: function (szTheme) {
            ixmaps.toggleTheme(szTheme);
            return this;
        },

        replaceTheme: function (szTheme, theme, flag) {
            ixmaps.replaceTheme(szTheme, theme, flag);
            return this;
        },
        replace: function (szTheme, theme, flag) {
            ixmaps.replaceTheme(szTheme, theme, flag);
            return this;
        },

        show: function (szTheme) {
            ixmaps.showTheme(szTheme);
            return this;
        },

        hide: function (szTheme) {
            ixmaps.hideTheme(szTheme);
            return this;
        },

        getLayer: function () {
            return ixmaps.getLayer(this.szMap);
        },

        getLayerDependency: function () {
            return ixmaps.getLayerDependency(this.szMap);
        },

        getTileInfo: function () {
            return ixmaps.getTileInfo(this.szMap);
        },

        switchLayer: function (szLayerName, fState) {
            ixmaps.switchLayer(szLayerName, fState);
            return this;
        },


        loadProject: function (szUrl, szFlag) {
            ixmaps.loadProject(szUrl, szFlag);
            return this;
        },
        project: function (szUrl, szFlag) {
            ixmaps.loadProject(szUrl, szFlag);
            return this;
        },

        setProject: function (szProject) {
            ixmaps.setProject(szProject);
            return this;
        },

        getProjectString: function () {
            return ixmaps.getProjectString(this.szMap);
        },


        loadSidebar: function (szUrl) {
            ixmaps.loadSidebar(szUrl);
            return this;
        },

        getData: function (szItem) {
            return ixmaps.getData(szItem);
        },

        require: function (szUrl) {
            ixmaps.require(szUrl);
            return this;
        },


        theme: function (szTheme, flag) {
            if (typeof (szTheme) == "object") {
                ixmaps.newTheme("layer", szTheme, flag);
                return this;
            } else {
                return new ixmaps.themeApi(szTheme);
            }
        },
        themes: function () {
            return ixmaps.getThemes(this.szMap);
        },
        getThemes: function () {
            return ixmaps.getThemes(this.szMap);
        },
        stopThemes: function () {
            return ixmaps.stopThemes(this.szMap);
        },
        startThemes: function () {
            return ixmaps.startThemes(this.szMap);
        },
        stop: function () {
            return ixmaps.stopThemes(this.szMap);
        },
        start: function () {
            return ixmaps.startThemes(this.szMap);
        },

        getThemeObj: function (szTheme) {
            return ixmaps.getThemeObj(szTheme);
        },
        getThemeDefinitionObj: function (szTheme) {
            return ixmaps.getThemeDefinitionObj(szTheme);
        },
        message: function (szMessage, nTimeout) {
            ixmaps.setMessage(szMessage, nTimeout);
            return this;
        }
    };

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
            alert("hi");
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
     * ixmaps.map 
     * get an ixmaps.mapApi instance
     * @param {String} [szMap] a map name to get the handle from
     * @return A new ixmaps.mapApi instance
     */
    ixmaps.api = function (szMap) {
        return new ixmaps.mapApi(szMap);
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

        // -------------------------------------------
        // search tool
        // ------------------------------------------- 
        /**
         * Search tool implementation - Currently disabled
         * 
         * This section contains a complete search tool implementation using Nominatim API
         * for geocoding and place search functionality. It has been commented out due to:
         * - API rate limiting issues with Nominatim
         * - Alternative search implementations being preferred
         * - Performance considerations
         * 
         * To re-enable: Uncomment the entire block below and ensure proper API keys
         * and rate limiting are configured.
         */
        ixmaps.search = ixmaps.search || {};

        ixmaps.search.show = function(fFlag) {
            $("#switchsearchbutton").show();
            $("#switchsearchbutton").button().click(function(e) {
                e.preventDefault();
                e.stopPropagation();
                $(".search-container").css('top', $("#switchsearchbutton").offset().top);
                $(".search-container").css('left', $("#switchsearchbutton").offset().left);
                $("#switchsearchbutton").hide();
                $(".search-container").show().animate({
                    width: "400px"
                }, 500);
                $(".search-box").show();
            });
            $(".search-container").click(function(e) {
                e.preventDefault();
                e.stopPropagation();
                $(".search-container").animate({
                    width: "0px"
                }, 500);
                $(".search-container").hide();
                $(".search-box").val("");
                $("#switchsearchbutton").show();
            });
            $(".search-box").click(function(e) {
                e.stopPropagation();
            });
            setTimeout('$("#onmapbuttondiv").show();', 1000);
        };

        ixmaps.search.positionResultList = function(input) {
            $('.result-list').css({
                width: input.outerWidth(),
                top: input.offset().top + input.outerHeight() + 1,
                left: input.position().left + input.parent().position().left
            });
        };

        ixmaps.search.showQueryMessage = function() {
            $('.result-list').empty();
            this.positionResultList($('.search-box'));
            var itemObject = $('<div class="result-item" title="searching"><em>searching ...</em></div>');
            $('.result-list').append(itemObject);
            $('.result-list').show();
        };

        ixmaps.search.renderResults = function(result) {
            $('.result-list').empty();
            this.positionResultList($('.search-box'));
            if (!result) {
                var itemObject = $('<div class="result-item" title="not found"><em>' + $('.search-box').val() +
                    '</em> not found!</div>');
                $('.result-list').append(itemObject);
                $('.result-list').show();
                return;
            }
            var i = 0;
            result.forEach(function(item) {
                if (++i < 10) {
                    var itemStr = '<div id="result-item-' + i + '" class="result-item" title="' + item.display_name + '">' + item.display_name + '</div>';
                    var itemObject = $(itemStr);
                    itemObject.data(item);
                    $('.result-list').append(itemObject);
                }
            });
            $('.result-list').show();
        };

        ixmaps.search.renderMap = function(data) {

            ixmaps.search.result = data;

            var x = (Number(data.boundingbox[0]) + Number(data.boundingbox[1])) / 2;
            var y = (Number(data.boundingbox[2]) + Number(data.boundingbox[3])) / 2;

            if (data.class == "place") {
                ixmaps.setView([x, y], 13);
            } else {
                ixmaps.setBounds([Number(data.boundingbox[0]), Number(data.boundingbox[2]), Number(data.boundingbox[1]), Number(
                    data.boundingbox[3])]);
            }

            var __szBookmark = "map.Api.doZoomMapToGeoBounds(" + data.boundingbox[0] + "," + data.boundingbox[2] + "," + data.boundingbox[
                1] + "," + data.boundingbox[3] + ");";
            setTimeout("ixmaps.execBookmark('" + __szBookmark + "')", 100);

            $('.search-box').val(data.display_name.replace(data.address.hamlet + ', ', ''));
        };

        ixmaps.search.szSearchSuffix = "";
        ixmaps.search.queryNominatim = function() {
            ixmaps.search.lastSearch = $('.search-box').val();
            // GR 15.11.2022 nominatim URL changed, suffix not any longer possible
            //var query = encodeURIComponent($('.search-box').val() + ((this.szSearchSuffix.length > 1) ? ("," + this.szSearchSuffix) :
            //	""));
            var query = encodeURIComponent($('.search-box').val());
            $('.error').hide();
            $('.result-list').empty().hide();

            this.showQueryMessage();

            $.ajax({
                url: "https://nominatim.openstreetmap.org/search?key=9VpTwb1ib382pomWexOxmr2J67UtDJKN&q=" + query +
                    "&format=json&addressdetails=1",
                success: function(result) {
                    if (result.length) {
                        ixmaps.search.renderResults(result);
                    } else {
                        ixmaps.search.renderResults(null);
                        $('.error').show();
                    }
                }
            });
        };

        ixmaps.search.selectResult = function(item) {
            $('.result-item').removeClass('selected');
            item.addClass('selected');
        };

        ixmaps.search.renderMapFromResult = function() {
            var target = $('.result-item.selected');
            ixmaps.search.renderMap(target.data());
            $('.result-list').empty().hide();
        };

        ixmaps.search.initSearch = function() {

            $('.result-list')
                .on('click', '.result-item', ixmaps.search.renderMapFromResult)
                .on('mouseenter', '.result-item', function(e) {
                    $(e.currentTarget).addClass('selected');
                })
                .on('mouseleave', '.result-item', function(e) {
                    $(e.currentTarget).removeClass('selected');
                });

            $(document).on('keydown', '.search-box', function(e) {
                var pressed = e.which;
                var keys = {
                    enter: 13,
                    up: 38,
                    down: 40
                };
                if (pressed === keys.enter) {
                    $('.result-item.selected').length ? ixmaps.search.renderMapFromResult() : ixmaps.search.queryNominatim();
                } else if (pressed === keys.up) {
                    if (!$('.result-item.selected').length || $('.result-item.selected').is(':first-child')) {
                        // Choose last
                        ixmaps.search.selectResult($('.result-item:last-child'));
                    } else {
                        // Choose prev item
                        ixmaps.search.selectResult($('.result-item.selected').prev());
                    }
                } else if (pressed === keys.down) {
                    if (!$('.result-item.selected').length || $('.result-item.selected').is(':last-child')) {
                        // Choose first 
                        ixmaps.search.selectResult($('.result-item:first-child'));
                    } else {
                        // Choose next item
                        ixmaps.search.selectResult($('.result-item.selected').next());
                    }
                } else {
                    if ($('.result-item').length) {
                        $('.result-list').empty().hide();
                    }
                }
            });

            var __queryNominatimTimeout = null;

            $(document).on('keyup', '.search-box', function(e) {
                var pressed = e.which;
                var keys = {
                    enter: 13,
                    up: 38,
                    down: 40
                };
                if (pressed !== keys.enter) {
                    if (__queryNominatimTimeout) {
                        clearTimeout(__queryNominatimTimeout);
                    }
                    __queryNominatimTimeout = setTimeout("ixmaps.search.queryNominatim()", 500);
                }
            });

            $(document).on('blur', '.search-box', function() {
                if ($('.result-item').length) {
                    setTimeout("$('.result-list').empty().hide();", 500);
                }
            });


            $(document).on('click', '.search-btn', ixmaps.search.queryNominatim);
        };

        // ------------------------------------------- 
        // END search tool 
        // ------------------------------------------- 


    /**
     * Multi-Map Registry System
     * Extends ixmaps to support multiple map instances
     */
    ixmaps.mapRegistry = ixmaps.mapRegistry || {};
    ixmaps.mapInstances = ixmaps.mapInstances || {};

    /**
     * Register a new map instance
     * @param {String} mapName - Unique name for the map
     * @param {Object} mapInstance - The map instance to register
     * @param {Object} options - Map configuration options
     */
    ixmaps.registerMapInstance = function(mapName, mapInstance, options) {
        if (!mapName) {
            console.error('Map name is required for registration');
            return false;
        }
        
        ixmaps.mapInstances[mapName] = {
            instance: mapInstance,
            options: options || {},
            createdAt: new Date(),
            divId: options.divId || 'ixmap',
            mapService: options.mapService || 'leaflet_vt',
            maptype: options.maptype || 'Stamen - toner-lite'
        };
        
        console.log(`Map instance '${mapName}' registered successfully`);
        return true;
    };

    /**
     * Get a specific map instance by name
     * @param {String} mapName - Name of the map to retrieve
     * @return {Object} The map instance or null if not found
     */
    ixmaps.getMapInstance = function(mapName) {
        return ixmaps.mapInstances[mapName] ? ixmaps.mapInstances[mapName].instance : null;
    };

    /**
     * Get all registered map instances
     * @return {Object} Object containing all map instances
     */
    ixmaps.getAllMapInstances = function() {
        return ixmaps.mapInstances;
    };

    /**
     * Remove a map instance from registry
     * @param {String} mapName - Name of the map to remove
     */
    ixmaps.removeMapInstance = function(mapName) {
        if (ixmaps.mapInstances[mapName]) {
            delete ixmaps.mapInstances[mapName];
            console.log(`Map instance '${mapName}' removed from registry`);
            return true;
        }
        return false;
    };

    /**
     * Create a new map with a specific name
     * @param {String} mapName - Unique name for the new map
     * @param {String} divId - DOM element ID to host the map
     * @param {Object} options - Map configuration options
     * @param {Function} callback - Callback function when map is ready
     */
    ixmaps.createMap = function(mapName, divId, options, callback) {
        if (!mapName) {
            console.error('Map name is required');
            return null;
        }
        
        if (ixmaps.mapInstances[mapName]) {
            console.warn(`Map instance '${mapName}' already exists`);
            return ixmaps.mapInstances[mapName].instance;
        }
        
        // Create unique div ID if not provided
        const uniqueDivId = divId || `ixmap_${mapName}_${Date.now()}`;
        
        // Create the map instance
        const mapInstance = new ixmaps.map(uniqueDivId, options, function(mapApi) {
            // Register the map instance
            ixmaps.registerMapInstance(mapName, mapApi, {
                ...options,
                divId: uniqueDivId
            });
            
            if (callback) {
                callback(mapApi);
            }
        });
        
        return mapInstance;
    };


}(window, document));
// .............................................................................
// EOF
// .............................................................................
