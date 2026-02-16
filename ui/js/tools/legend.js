/**********************************************************************
 legend.js

$Comment: provides JavaScript for ixmaps UI theme legends in HTML
$Source : legend.js,v $

$InitialAuthor: guenter richter $
$InitialDate: $
$Author: guenter richter $
$Id: legend.js 8 2015-02-10 08:14:02Z Guenter Richter $

Copyright (c) Guenter Richter
$Log: legend.js,v $
**********************************************************************/

window.ixmaps = window.ixmaps || {};
window.ixmaps.legend = window.ixmaps.legend || {};

(function () {

    ixmaps.legend.legendA = [];
    ixmaps.legend.scrollPositions = {};  // Store scroll positions by theme ID

    // Set default legend type - use layerlist only if .legend() is defined
    // Otherwise use normal theme legend
    if (typeof ixmaps.legendType === 'undefined') {
        ixmaps.legendType = "theme"; // Default to normal theme legend
    }
    
    /**
     * __getLayerColor
     * Extract color from layer/theme for display in legend patch
     * @param layer the layer/theme object
     * @type string
     * @return color value (hex or rgb)
     */
    var __getLayerColor = function(layer) {
        // If this is a theme layer, get color from the actual theme object
        if (layer.themeObj) {
            var themeObj = layer.themeObj;
            
            // Try to get color from colorScheme array (first actual color)
            if (themeObj.colorScheme && Array.isArray(themeObj.colorScheme) && themeObj.colorScheme.length > 0) {
                // Find first valid color in colorScheme (skip numbers and non-color strings)
                for (var i = 0; i < themeObj.colorScheme.length; i++) {
                    var color = themeObj.colorScheme[i];
                    if (typeof color === 'string') {
                        // Check if it's a hex color
                        if (color.match(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)) {
                            return color;
                        }
                        // Check if it's an rgb/rgba color
                        if (color.match(/^rgba?\(/i)) {
                            return color;
                        }
                        // Check if it's a named color (basic check)
                        if (color.match(/^[a-z]+$/i) && color.length < 20) {
                            return color;
                        }
                    }
                }
            }
            
            // Try to get color from partsA (for choropleth themes)
            if (themeObj.partsA && Array.isArray(themeObj.partsA) && themeObj.partsA.length > 0) {
                // Get color from first part
                var firstPart = themeObj.partsA[0];
                if (firstPart.color) {
                    return firstPart.color;
                }
                if (firstPart.fill && firstPart.fill !== "none") {
                    return firstPart.fill;
                }
            }
            
            // Try to get color from categoryA (first category with fill)
            if (themeObj.categoryA) {
                for (var c in themeObj.categoryA) {
                    if (themeObj.categoryA[c].fill && themeObj.categoryA[c].fill !== "none") {
                        return themeObj.categoryA[c].fill;
                    }
                }
            }
            
            // Fallback to stroke color from categoryA
            if (themeObj.categoryA) {
                for (var c in themeObj.categoryA) {
                    if (themeObj.categoryA[c].stroke) {
                        return themeObj.categoryA[c].stroke;
                    }
                }
            }
            
            // Try fillColor property
            if (themeObj.fillColor) {
                return themeObj.fillColor;
            }
            
            // Try szFillColor property
            if (themeObj.szFillColor) {
                return themeObj.szFillColor;
            }
            
            // Try lineColor for line themes
            if (themeObj.szLineColor) {
                return themeObj.szLineColor;
            }
            
            // Try to get from style object if it exists
            if (themeObj.style) {
                if (themeObj.style.fillColor) {
                    return themeObj.style.fillColor;
                }
                if (themeObj.style.lineColor) {
                    return themeObj.style.lineColor;
                }
                if (themeObj.style.colorscheme && Array.isArray(themeObj.style.colorscheme)) {
                    for (var i = 0; i < themeObj.style.colorscheme.length; i++) {
                        var color = themeObj.style.colorscheme[i];
                        if (typeof color === 'string' && (color.match(/^#/) || color.match(/^rgba?\(/i))) {
                            return color;
                        }
                    }
                }
            }
            
            // Try to extract color from SVG if available
            if (themeObj.szId && typeof ixmaps !== 'undefined' && ixmaps.embeddedSVG && ixmaps.embeddedSVG.window && ixmaps.embeddedSVG.window.map) {
                try {
                    var map = ixmaps.embeddedSVG.window.map;
                    var svgTheme = map.Themes ? map.Themes.getTheme(themeObj.szId) : null;
                    if (svgTheme) {
                        // Try to get color from first shape element
                        if (svgTheme.chartGroup && svgTheme.chartGroup.firstChild) {
                            var firstShape = svgTheme.chartGroup.firstChild;
                            if (firstShape.style) {
                                var fill = firstShape.style.getPropertyValue("fill") || firstShape.getAttribute("fill");
                                if (fill && fill !== "none" && fill !== "transparent") {
                                    return fill;
                                }
                                var stroke = firstShape.style.getPropertyValue("stroke") || firstShape.getAttribute("stroke");
                                if (stroke && stroke !== "none" && stroke !== "transparent") {
                                    return stroke;
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Ignore errors
                }
            }
        }
        
        // Try to get color from layer's categoryA (for actual SVG layers)
        if (layer.categoryA) {
            for (var c in layer.categoryA) {
                if (layer.categoryA[c].fill && layer.categoryA[c].fill !== "none") {
                    return layer.categoryA[c].fill;
                }
            }
        }
        // Fallback to stroke color
        if (layer.categoryA) {
            for (var c in layer.categoryA) {
                if (layer.categoryA[c].stroke) {
                    return layer.categoryA[c].stroke;
                }
            }
        }
        // Default colors by type
        if (layer.szType) {
            switch(layer.szType) {
                case "polygon": return "#4a90e2";
                case "line": return "#e24a4a";
                case "point": return "#4ae24a";
                default: return "#888888";
            }
        }
        return "#888888";
    };
    
    /**
     * __makeLayerlistItem
     * Create HTML for a single layer/theme item in the layerlist
     * @param layer the layer/theme object
     * @param name the display name
     * @type string
     * @return HTML string for the item
     */
    var __makeLayerlistItem = function(layer, name) {
        var color = __getLayerColor(layer);
        var displayName = layer.szLegendName || layer.szName || name;
        
        // Get theme ID for toggle functionality
        var themeId = null;
        if (layer.themeObj && layer.themeObj.szId) {
            themeId = layer.themeObj.szId;
        } else if (layer.szId) {
            themeId = layer.szId;
        }
        
        // Determine patch shape based on theme type
        var patchShape = "square"; // default
        if (layer.themeObj && layer.themeObj.szFlag) {
            if (layer.themeObj.szFlag.match(/BUBBLE|SYMBOL|DOT/)) {
                patchShape = "circle";
            }
        }
        
        // Get fill opacity from theme object
        var opacity = 1.0; // default
        if (layer.themeObj) {
            // Try different opacity property names
            if (typeof layer.themeObj.fillOpacity !== 'undefined') {
                opacity = layer.themeObj.fillOpacity;
            } else if (typeof layer.themeObj.nFillOpacity !== 'undefined') {
                opacity = layer.themeObj.nFillOpacity;
            } else if (typeof layer.themeObj.opacity !== 'undefined') {
                opacity = layer.themeObj.opacity;
            } else if (typeof layer.themeObj.nOpacity !== 'undefined') {
                opacity = layer.themeObj.nOpacity;
            }
            // Ensure opacity is between 0 and 1
            opacity = Math.max(0, Math.min(1, parseFloat(opacity) || 1.0));
        }
        
        var patchClass = "layer-patch";
        var patchStyle = "background-color:" + color;
        if (opacity < 1.0) {
            // Use rgba or opacity depending on color format
            if (color.match(/^#/)) {
                // Convert hex to rgba
                var hex = color.replace('#', '');
                var r = parseInt(hex.substr(0, 2), 16);
                var g = parseInt(hex.substr(2, 2), 16);
                var b = parseInt(hex.substr(4, 2), 16);
                patchStyle = "background-color:rgba(" + r + "," + g + "," + b + "," + opacity + ")";
            } else {
                // For named colors or rgb, use opacity property
                patchStyle += ";opacity:" + opacity;
            }
        }
        if (patchShape === "circle") {
            patchClass += " layer-patch-circle";
            patchStyle += ";border-radius:50%";
        }
        
        // Check initial visibility from SVG to set correct state on load
        var isVisible = true;
        if (themeId && typeof ixmaps !== 'undefined' && ixmaps.embeddedSVG && ixmaps.embeddedSVG.window && ixmaps.embeddedSVG.window.map) {
            try {
                var map = ixmaps.embeddedSVG.window.map;
                var theme = map.Themes ? map.Themes.getTheme(themeId) : null;
                if (theme && theme.chartGroup && theme.chartGroup.style) {
                    var display = theme.chartGroup.style.getPropertyValue("display");
                    if (display === "none") {
                        isVisible = false;
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        }
        
        // Add click handler if theme ID is available
        // Note: We rely on jQuery event delegation instead of inline onclick handlers
        // This works better in external legend context where HTML is dynamically inserted
        var clickHandler = "";
        var itemClass = "layerlist-item layerlist-item-clickable";
        var nameStyle = "";
        // Don't add inline onclick - jQuery event delegation will handle clicks
        // This ensures clicks work in external legend context
        
        // Apply initial visibility state
        var patchDisplayStyle = patchStyle;
        if (!isVisible) {
            itemClass += " layerlist-item-hidden";
            nameStyle = " style='color: #999 !important;'";
            patchDisplayStyle = "display: none !important;";
        }
        
        return '<div class="' + itemClass + '"' + clickHandler + ' data-theme-id="' + (themeId || '') + '" data-visible="' + (isVisible ? 'true' : 'false') + '">' +
               '<span class="' + patchClass + '" style="' + patchDisplayStyle + '"></span>' +
               '<span class="layer-name"' + nameStyle + '>' + displayName + '</span>' +
               '</div>';
    };

    var szControls = "small";
    var szSvgLegendFlag = "nolegend";
    var szHTMLLegendFlag = "1";
    var szLegendId = null;
    var fLegendDialog = false;
    var fOnRemove = false;
    var fLegendCompact = true;
    var fButton = true;

    // -------------
    // little helper
    // -------------

    ixmaps.toggleValueDisplay = function (szThemeId) {
        var szThemeStyle = ixmaps.getThemeStyleString(szThemeId);
        if (szThemeStyle && szThemeStyle.match(/VALUES/)) {
            ixmaps.changeThemeStyle(szThemeId, 'type:VALUES;', 'remove');
        } else {
            ixmaps.changeThemeStyle(szThemeId, 'type:VALUES;', 'add');
        }
    };

    ixmaps.changeThemeDynamic = function (szThemeId, szParameter, szFactor) {

        var nFactor = Number(eval(szFactor));

        var szThemeStyle = ixmaps.getThemeStyleString(szThemeId);

        if (szThemeStyle.match(/CHOROPLETH/)) {
            switch (szParameter) {
                case "amplify":
                    ixmaps.changeThemeStyle(szThemeId, 'dopacitypow:' + String(1 / nFactor), 'factor');
                    break;
                case "scale":
                    ixmaps.changeThemeStyle(szThemeId, 'dopacityscale:' + String(nFactor), 'factor');
                    break;
                case "opacity":
                    ixmaps.changeThemeStyle(szThemeId, 'opacity:' + String(nFactor), 'factor');
                    break;
            }
        } else
        if (szThemeStyle.match(/VECTOR|BEZIER/)) {
            switch (szParameter) {
                case "amplify":
                    ixmaps.changeThemeStyle(szThemeId, 'rangescale:' + String(1 / nFactor), 'factor');
                    break;
                case "scale":
                    ixmaps.changeThemeStyle(szThemeId, 'normalsizevalue:' + String(1 / nFactor), 'factor');
                    break;
                case "opacity":
                    ixmaps.changeThemeStyle(szThemeId, 'opacity:' + String(nFactor), 'factor');
                    break;
            }
        } else
        if (szThemeStyle.match(/GRIDSIZE/) || szThemeStyle.match(/AUTOSIZE/) || szThemeStyle.match(/AGGREGATE/)) {
            switch (szParameter) {
                case "amplify":
                    ixmaps.changeThemeStyle(szThemeId, 'gridwidth:' + String(nFactor), 'factor');
                    break;
                case "scale":
                    ixmaps.changeThemeStyle(szThemeId, 'scale:' + String(nFactor), 'factor');
                    break;
                case "opacity":
                    if (szThemeStyle.match(/DOPACITY/)) {
                        ixmaps.changeThemeStyle(szThemeId, 'dopacityscale:' + String(nFactor), 'factor');
                    } else {
                        ixmaps.changeThemeStyle(szThemeId, 'fillopacity:' + String(nFactor), 'factor');
                    }
                    break;
                case "aggregation":
                    ixmaps.changeThemeStyle(szThemeId, 'gridwidth:' + String(nFactor), 'factor');
                    break;
            }
        } else {
            switch (szParameter) {
                case "amplify":
                    if (szThemeStyle.match(/BAR/) || szThemeStyle.match(/PLOT/) || szThemeStyle.match(/STAR/)) {
                        ixmaps.changeThemeStyle(szThemeId, 'rangescale:' + String(nFactor), 'factor');
                    } else {
                        ixmaps.changeThemeStyle(szThemeId, 'normalsizevalue:' + String(1 / nFactor), 'factor');
                    }
                    break;
                case "scale":
                    if (szThemeStyle.match(/VECTOR/)) {
                        ixmaps.changeThemeStyle(szThemeId, 'linewidth:' + String(nFactor), 'factor');
                    } else {
                        ixmaps.changeThemeStyle(szThemeId, 'scale:' + String(nFactor), 'factor');
                    }
                    break;
                case "opacity":
                    if (szThemeStyle.match(/DOPACITY/)) {
                        ixmaps.changeThemeStyle(szThemeId, 'dopacityscale:' + String(nFactor), 'factor');
                    } else {
                        ixmaps.changeThemeStyle(szThemeId, 'fillopacity:' + String(nFactor), 'factor');
                    }
                    break;
                case "aggregation":
                    ixmaps.changeThemeStyle(szThemeId, 'gridwidth:' + String(nFactor), 'factor');
                    break;
            }
        }
    };

    // ---------------------------------------------------
    // format number display 
    // ---------------------------------------------------

    /**
     * convert a number into a formatted string; if the number > 1000 it will be formatted like 1 023 234 
     * @param nValue the number to format
     * @param nPrecision the wanted decimal points 
     * @param szFlag "CEIL" or "FLOOR" (round either up or down)
     */
    ixmaps.__formatValue = function (nValue, nPrecision, szFlag) {

        nValue = Number(nValue);

        if (!isFinite(nValue) || !isFinite(nPrecision)) {
            return String(nValue);
        }
        if (nValue == 0) {
            return String(nValue);
        }
        if (nValue > 1000000000000) {
            return String(nValue);
        }
        if (nValue < -1000000000000) {
            return String(nValue);
        }

        var szReturn = null;
        
        if (!nPrecision) {
            nPrecision = 0;
        }
        nPrecision = Math.max(0, nPrecision);

        // GR 02.12.2011 make that low values do not collapse to 0
        if ((nValue > 0.0000001) && (nPrecision > 0)) {
            while (nValue.toFixed(nPrecision - 1) == 0) {
                nPrecision++;
            }
        }

        // GR 11.03.2009 fix precision before CEIL or FLOOR to avoid JS errors eg. 0.0000000000003
        nValue = nValue.toFixed(nPrecision + 1);

        nClipDecimal = Math.pow(10, nPrecision);
        if (szFlag && szFlag.match(/CEIL/)) {
            nValue = Math.ceil(nValue * nClipDecimal) / nClipDecimal;
        } else
        if (szFlag && szFlag.match(/FLOOR/)) {
            nValue = Math.floor(nValue * nClipDecimal) / nClipDecimal;
        } else {
            nValue = Math.round(nValue * nClipDecimal) / nClipDecimal;
        }
        // format numbers > 1000
        if (0 && (nValue < 1000)) {
            return String(nValue);
        } else {
            var szDecimals = String(nValue);
            if (szDecimals.match(/\./)) {
                szDecimals = szDecimals.split(".")[1];
                while (szDecimals.length < nPrecision) {
                    szDecimals += '0';
                }
            } else {
                szDecimals = "";
            }
            szReturn = nValue < 0 ? "-" : "";
            var szLeading = "";

            nValue = Math.floor(Math.abs(nValue));

            // GR new flag
            if (!szFlag || !szFlag.match(/NOBREAKS/)) {
                var nClip = 1000;
                while (nValue > nClip) {
                    nClip *= 1000;
                }
                nClip /= 1000;

                var nPart = 0;
                var szBreak = " ";
                while (nClip >= 1000) {
                    nPart = Math.floor(nValue / nClip);
                    szReturn += __maptheme_formatpart(nPart, szLeading);
                    nValue = nValue % nClip;
                    nClip /= 1000;
                    if (nPart) {
                        szLeading = "0";
                        if (szFlag && szFlag.match(/BLANK/)) {
                            szBreak = "&nbsp;";
                        } else {
                            szBreak = ".";
                        }
                    }
                    szReturn += szBreak;
                }
            }

            szReturn += __maptheme_formatpart(nValue, szLeading);

            if (!szReturn.length || (szReturn == "-")) {
                szReturn += "0";
            }

            if (szDecimals.length && szDecimals != "00") {
                szReturn += ((szFlag && szFlag.match(/BLANK/)) ? "." : ",") + szDecimals;
            }
        }
        return szReturn;
    };
    /**
     * helper to format a number from 0 to 999 into a string with leading character (sample 32 -> "032" )
     * @param nPart the number to format
     * @param szLeading the leading character to insert if necessary 
     */
    function __maptheme_formatpart(nPart, szLeading) {
        if (!szLeading) {
            szLeading = "";
        }
        var szPart = "";
        if (nPart < 100) {
            szPart += szLeading;
        }
        if (nPart < 10) {
            szPart += szLeading;
        }
        if (nPart == 0) {
            szPart += szLeading;
        } else {
            szPart += String(nPart);
        }
        return szPart;
    }

    // must clear some chars to get it through the .dialog precedures 
    var __getLegendId = function (szId) {
        return szId.replace(".", "_");
    };

    // ------------------------------------------
    // color scheme for legend, explicit version
    // ------------------------------------------

    /**
     * make a long version color scheme with multiple lines
     * there are different types selectable via themeObj.szFlag:
     * default:       one line with the color label
     *                and one line with the color bar and additional text (values, min, max ...)
     * COMPACTLEGEND: 
     * @param {string} szId the theme id 
     * @param {string} szLegendId a target id (div) [optional] 
     * @param {string} szMode "compact" to allow compact (one line) legend if possible 
     */
    ixmaps.legend.makeColorLegendHTMLLong = function (szId, szLegendId, szMode) {
 
        szLegendId = szLegendId || "generic";

        var themeObj = ixmaps.getThemeObj(szId);

        var colorA = themeObj.colorScheme;
        var labelA = themeObj.szLabelA;
        
        while ( colorA && colorA.length > themeObj.partsA.length ){
            colorA.pop();
        }
        while ( labelA && labelA.length > themeObj.partsA.length ){
            labelA.pop();
        }

        var nDecimals = (typeof(themeObj.nValueDecimals) != 'undefined')?themeObj.nValueDecimals:2; 		

        // if color field defined, we collect the colors and make legend label here
        // -----------------------------------------------------------------------
        if (themeObj.colorFieldA) {
            labelA = [];
            for (var a in themeObj.colorFieldA) {
                labelA.push(a);
            }
            // create list of colors (classes) used 
            themeObj.colorClassUsedA = [];
            for (var i in themeObj.indexA) {
                themeObj.colorClassUsedA[themeObj.itemA[themeObj.indexA[i]].nClass] = true;
            }
        }

        // compose the units suffix
        // ---------------------------
        var szUnit = themeObj.szLegendUnits || themeObj.szUnits || "";
        szUnit = szUnit.replace(/ /g, '&nbsp;');

        // if no labels or colors are defined, make value range texts as label
        // -----------------------------------------------------------------------
        if (!labelA) {
            labelA = [];
            var len = Math.min(colorA.length, themeObj.partsA.length);
            for (var i = 0; i < len; i++) {
                var szPart = parseFloat(themeObj.partsA[i].min).toFixed(2) + "&nbsp;" + " ... " + parseFloat(themeObj.partsA[i].max).toFixed(2) + "&nbsp;" + szUnit;
                labelA.push(szPart);
            }
        }

        // how many rows 
        // ---------------------------
        var nRows = Math.min(themeObj.partsA.length,Math.min(colorA.length, labelA.length));

        // sort (or don't sort) the legend rows
        // -------------------------------------
        var sortA = [];
        
        var allSum = 0;
        for (var i = 0; i < nRows; i++) {
            allSum += themeObj.partsA[i].nSum;
        }

        for (var i = 0; i < nRows; i++) {

            // ic = i for color, may be recursive for plot curves 
            var ic = i % (themeObj.nGridX || 10000000000);

            if (themeObj.szFlag.match(/SUM/) ||
                (themeObj.szFlag.match(/CATEGORICAL/) && !themeObj.szFlag.match(/SIZE/))) {
                if (themeObj.szFlag.match(/AUTO100/)) {
                    sortA.push({
                        index: i,
                        color: (themeObj.szFlag.match(/INVERT/) ? (nRows - i - 1) : ic),
                        count: (themeObj.partsA[i].nSum / themeObj.partsA[i].nCount)
                    });
                } else
                if (themeObj.partsA[i] && typeof (themeObj.partsA[i].nSum) != "undefined") {
                    if (themeObj.szFlag.match(/SUM/) && themeObj.szFlag.match(/PERCENT/) && !themeObj.szFlag.match(/COUNT/)) {
                        sortA.push({
                            index: i,
                            color: (themeObj.szFlag.match(/INVERT/) ? (nRows - i - 1) : ic),
                            count: (100 / allSum * themeObj.partsA[i].nSum )
                        });
                    } else
                    if (themeObj.szFlag.match(/SUM/) && !themeObj.szFlag.match(/COUNT/)) {
                        sortA.push({
                            index: i,
                            color: (themeObj.szFlag.match(/INVERT/) ? (nRows - i - 1) : ic),
                            count: (themeObj.partsA[i].nSum)
                        });
                    } else
                    if (themeObj.szFlag.match(/MEAN/) && !themeObj.szFlag.match(/COUNT/)) {
                        sortA.push({
                            index: i,
                            color: (themeObj.szFlag.match(/INVERT/) ? (nRows - i - 1) : ic),
                            count: (themeObj.partsA[i].nSum / themeObj.partsA[i].nCount)
                        });
                    } else {
                        sortA.push({
                            index: i,
                            color: (themeObj.szFlag.match(/INVERT/) ? (nRows - i - 1) : ic),
                            count: (themeObj.partsA[i].nCount)
                        });
                    }
                } else {
                    sortA.push({
                        index: i,
                        color: (themeObj.szFlag.match(/INVERT/) ? (nRows - i - 1) : ic),
                        count: (themeObj.exactSizeA[i] || themeObj.exactCountA[i] || themeObj.nMeanA[i] || ((themeObj.szFieldsA.length > 1) ? themeObj.nOrigSumA[i] : null))
                    });
                }
            } else {
                if (themeObj.szFlag.match(/COUNT/)) {
                    sortA.push({
                        index: i,
                        color: (ic),
                        count: themeObj.partsA[i] ? themeObj.partsA[i].nCount : themeObj.exactCountA[i]
                    });
                } else {
                    sortA.push({
                        index: i,
                        color: (ic),
                        count: (themeObj.exactSizeA[i] / themeObj.exactCountA[i])
                    });
                }
            }
        }
        if (themeObj.szFlag.match(/AREA/) && themeObj.szFlag.match(/STACKED/) && !themeObj.szShowParts) {
            sortA.sort(function (a, b) {
                return b.index - a.index;
            });
        } else
        if (!themeObj.szFlag.match(/NOSORT/)) {
            sortA.sort(function (a, b) {
                return b.count - a.count;
            });
        }

        // colorscheme
        //
        // start making the HTML
        // -----------------------------
        var szHtml = "";

        // show theme filter, if defined
        if (0 && themeObj.szFilter) {
            szHtml += "<p class='legend-filter' style='margin-top:0em;color:#fff;background:#ddd'><span class='icon icon-filter' style='float:left;padding:0.2em 0.5em;'></span><span class='legend-filter-text'>" + themeObj.szFilter + "</span><a href='javascript:ixmaps.changeThemeStyle(null,null,\"filter\",\"remove\");' title=\"remove\" ><span class='icon icon-cancel-circle' style='float:right;padding:0.2em 0.5em;'></span></a></p>";
        }

        // color legend = table
        // ---------------------
        szHtml += "<div id='legend-classes" + szLegendId + "' class='legend-item-list' style='overflow:hidden'>";

        var fColorScheme = false;
        var fCountBars = false;
        var nMaxCount = 0;
		var nSumCount = 0;

        for (var i = 0; i < nRows; i++) {
            if (colorA[0] != colorA[i]) {
                fColorScheme = true;
            }
            if (sortA[i].count) {
                nMaxCount = Math.max(nMaxCount, sortA[i].count);
				nSumCount += sortA[i].count;
                fCountBars = true;
                fColorScheme = true;
           }
        }
        // clip legend rows !!
        nRows = Math.min(500, Math.min(colorA.length, labelA.length));

        if (fColorScheme &&
            ((themeObj.partsA.length > 2) ||
                themeObj.szLabelA ||
                themeObj.szFlag.match(/CATEGORICAL/) ||
                themeObj.szRangesA)) {

            // -------------------------
            // make legend rows
            // -------------------------

            for (var i = 0; i < nRows; i++) {

                // suppress legend rows with no map charts
                // ----------------------------------------

                if (themeObj.colorFieldA) {
                    if (!themeObj.colorClassUsedA[sortA[i].index]) {
                        continue;
                    }
                } else
                if (themeObj.szFlag.match(/CATEGORICAL&CHART/) && themeObj.partsA[sortA[i].index] && !themeObj.partsA[sortA[i].index].nSum) {
                    continue;
                }

                if ((fCountBars || themeObj.szFlag.match(/FILTER/)) && !sortA[i].count) {
                    continue;
                }

                // check if legend part is selected (shows a marked class)
                // --------------------------------------------------------

                var fSelected = false;
                if (((typeof (themeObj.markedClass) != "undefined") && (themeObj.markedClass == sortA[i].index)) ||
                    ((typeof (themeObj.markedClasses) != "undefined") && (themeObj.markedClasses[sortA[i].index]))) {
                    fSelected = true;
                } else
                if (themeObj.szShowParts) {
                    for ( var p in themeObj.szShowPartsA) {
                        if (themeObj.szShowPartsA[p] == i) {
                            fSelected = true;
                        }
                    }
                }

                // show class count
                var szCount = ixmaps.__formatValue(sortA[i].count, nDecimals, "BLANK") + (themeObj.szFlag.match(/COUNT/) ? "" : (" " + szUnit));

                // -------------------------
                // start legend row
                // -------------------------

                // switch theme class onclick
                var szAction = "ixmaps.markThemeClass(\"" + szId + "\"," + sortA[i].index + ");event.stopPropagation();return false;";

				var szStyle = themeObj.szFlag.match(/SIMPLELEGEND|COMPACTLEGEND/) ? "margin-bottom:0.5em;margin-right:1em;float:left":"margin-bottom:0.2em";
 
				if (fSelected) {
                    szHtml += "<div valign='center' class='theme-legend-item-selected' style='" + szStyle + "' onclick='" + szAction + "'>";
                } else {
                    szHtml += "<div valign='center' class='theme-legend-item' style='" + szStyle + "' onclick='" + szAction + "'>";
                }

                szHtml += "<div>";

                if (themeObj.szFlag.match(/SIMPLELEGEND/)) {

                    // ---------------------------
                    // simple one line legend item
                    // ---------------------------
					
					if (themeObj.szFlag.match(/\bCLIP\b/)){
						
					}else{

						szHtml += "<div style='margin-top:0.2em;margin-bottom:0em;align'>";

					szHtml += "<span style='line-height:5px'>";
					szHtml += "<a class='legend-color-button' style='pointer-events:all'  href='#' title='click to see'>";

					// Check if this is a SEQUENCE|SYMBOL theme with URL-based symbols
					var szSymbolUrl = null;
					if (themeObj.szFlag.match(/SEQUENCE/) && themeObj.szFlag.match(/SYMBOL/) && themeObj.szSymbolsA && themeObj.szSymbolsA.length > 0) {
						var symbolIndex = sortA[i].index;
						if (symbolIndex < themeObj.szSymbolsA.length) {
							var szSymbol = themeObj.szSymbolsA[symbolIndex];
							// Check if it's a URL-based symbol (svg, png, jpeg)
							if (szSymbol && szSymbol.match(/\.(svg|png|jpeg|jpg)$/i)) {
								szSymbolUrl = szSymbol;
							}
						}
					}

					if (szSymbolUrl) {
						// Display URL-based symbol as image
						szHtml += "<img src='" + szSymbolUrl + "' style='width:16px;height:16px;vertical-align:middle;margin-right:0.5em;' alt='' />";
					} else {
						// Display color patch as before
						if ((colorA[sortA[i].color] == "none") || (themeObj.szLineColor && themeObj.nLineWidth)) {
							if (themeObj.fillOpacity < 0.1) {
								szHtml += "<span style='background:none;border:solid " + themeObj.szLineColor + " 1px;opacity:0.7;font-size:0.5em'>";
							} else {
								szHtml += "<span style='background:" + colorA[sortA[i].color] + ";border:solid " + themeObj.szLineColor + " 1px;opacity:0.7;font-size:0.5em'>";
							}
						} else {
							szHtml += "<span style='background:" + colorA[sortA[i].color] + ";opacity:0.7;font-size:1em;border-radius:0.6em;margin-right:1em;width:1em;'>";
						}

						szHtml += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp";

						szHtml += "</span>";
					}
					
					// Show count bars even when symbols are displayed
					// Note: Count bars are typically shown after the label in SIMPLELEGEND mode, so they're handled separately
					szHtml += "</a>";
					szHtml += "</span>";
						var szLabel = labelA[sortA[i].index];
						szHtml += "<span class='theme-legend' >";
						szHtml += "<a class='theme-button' style='pointer-events:all' href='#' title='click to see'>";
						szHtml += "<span title='" + szLabel + "' style=''>";
						szHtml += "<span>";
						szHtml += szLabel;
						szHtml += "</span>";
						szHtml += "</span>";
						szHtml += "</a>";
						szHtml += "</span>";

						szHtml += "</div>";
					}


                } else {

                    // ------------------------------
                    // 2 line legend item with values
                    // ------------------------------
                    // make the color bar header
					
					
                    let szLabel = labelA[sortA[i].index];
                    if ( szLabel && szLabel.length && szLabel != ' '){
                        szHtml += "<span class='theme-legend' >";
                        szHtml += "<a class='theme-button' href='#' title='click to see'>";
                        szHtml += "<span title='" + szLabel + "' >";
                        szHtml += "<span>";
                        szHtml += szLabel;
                        szHtml += "</span>";
                        szHtml += "</span>";
                        szHtml += "</a>";
                        szHtml += "</span>";
                    }

                    szHtml += "</div>";

                    if (fSelected) {
                        szHtml += "<div style='margin-top:0px;margin-bottom:0em;padding-bottom:0.3em;border-bottom:#dddddd solid 0px;'>";
                    } else {
                        szHtml += "<div style='margin-top:0px;margin-bottom:0em;padding-bottom:0.3em;border-bottom:#dddddd solid 0px;'>";
                    }

                    szHtml += "<span style='line-height:5px'>";
                    szHtml += "<a class='legend-color-button' style='pointer-events:all' href='#' title='click to see'>";

                    // Check if this is a SEQUENCE|SYMBOL theme with URL-based symbols
                    var szSymbolUrl = null;
                    if (themeObj.szFlag.match(/SEQUENCE/) && themeObj.szFlag.match(/SYMBOL/) && themeObj.szSymbolsA && themeObj.szSymbolsA.length > 0) {
                        var symbolIndex = sortA[i].index;
                        if (symbolIndex < themeObj.szSymbolsA.length) {
                            var szSymbol = themeObj.szSymbolsA[symbolIndex];
                            // Check if it's a URL-based symbol (svg, png, jpeg)
                            if (szSymbol && szSymbol.match(/\.(svg|png|jpeg|jpg)$/i)) {
                                szSymbolUrl = szSymbol;
                            }
                        }
                    }

                    if (szSymbolUrl) {
                        // Display URL-based symbol as image
                        szHtml += "<img src='" + szSymbolUrl + "' style='width:16px;height:16px;vertical-align:middle;margin-right:0.5em;' alt='' />";
                        
                        // make the color bar even when symbol is displayed, with designated colors
                        if (fCountBars) {
                            var nMaxBar = Math.min(100,($("#map-legend").width() - 20) * 0.5);
                            var nBar = Math.ceil(Math.pow(sortA[i].count, 1) * Math.min(10, nMaxBar / Math.pow(nMaxCount, 1)));
                            szHtml += "<span style='display:inline-block;width:" + nBar + "px;font-size:0.5em;background:" + colorA[sortA[i].color] + "'>&nbsp;</span>";
                        } else {
                            if (themeObj.szFlag.match(/DOPACITY/)) {
                                szHtml += "<span onclick='javascript:ixmaps.markThemeClass(\"" + szId + "\"," + sortA[i].color + ");event.stopPropagation();return false;' style='background:" + colorA[sortA[i].color] + ";opacity:0.25;font-size:0.5em'>";
                                szHtml += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>";
                                szHtml += "<span onclick='javascript:ixmaps.markThemeClass(\"" + szId + "\"," + sortA[i].color + ");event.stopPropagation();return false;' style='background:" + colorA[sortA[i].color] + ";opacity:0.55;font-size:0.5em'>";
                                szHtml += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>";
                                szHtml += "<span onclick='javascript:ixmaps.markThemeClass(\"" + szId + "\"," + sortA[i].color + ");event.stopPropagation();return false;' style='background:" + colorA[sortA[i].color] + ";opacity:1;font-size:0.5em'>";
                                szHtml += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>";
                           } else {
                                szHtml += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
                            }
                        }
                    } else {
                        // Display color patch as before
                        if ( themeObj.szFlag.match(/VECTOR/) || themeObj.szFlag.match(/BEZIER/) && themeObj.szLineColor ){
                             szHtml += "<span style='background:" + (themeObj.szLineColor||colorA[sortA[i].color]) + ";opacity:0.7;font-size:0.5em'>";
                        } else
                        if (colorA[sortA[i].color] == "none" || (themeObj.szLineColor && themeObj.nLineWidth) ) {
                            if (themeObj.fillOpacity < 0.1) {
                                szHtml += "<span style='background:none;border:solid " + themeObj.szLineColor + " 1px;opacity:0.7;font-size:0.5em'>";
                            } else {
                                szHtml += "<span style='background:" + colorA[sortA[i].color] + ";border:solid " + themeObj.szLineColor + " 1px;opacity:0.7;font-size:0.5em'>";
                            }
                        } else {
						  szHtml += "<span style='background:" + colorA[sortA[i].color] + ";border:solid " + themeObj.szLineColor + " 1px;opacity:1;font-size:0.6em;border-radius:0.6em 0.6em 0.6em 0.6em'>";
                          //szHtml += "<span style='background:" + colorA[sortA[i].color] + ";opacity:1;font-size:0.6em;border-radius:0 0.6em 0.6em 0'>";
                        }

                        // make the color bar
                        if (fCountBars) {
                            var nMaxBar = Math.min(100,($("#map-legend").width() - 20) * 0.5);
                            var nBar = Math.ceil(Math.pow(sortA[i].count, 1) * Math.min(10, nMaxBar / Math.pow(nMaxCount, 1)));
                            szHtml += "<span style='display:inline-block;width:" + nBar + "px;font-size:0.5em'>&nbsp;</span>";
                        } else {
                            if (themeObj.szFlag.match(/DOPACITY/)) {
                                szHtml += "</span><span onclick='javascript:ixmaps.markThemeClass(\"" + szId + "\"," + sortA[i].color + ");event.stopPropagation();return false;' style='background:" + colorA[sortA[i].color] + ";opacity:0.25;font-size:0.5em'>";
                                szHtml += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>";
                                szHtml += "<span onclick='javascript:ixmaps.markThemeClass(\"" + szId + "\"," + sortA[i].color + ");event.stopPropagation();return false;' style='background:" + colorA[sortA[i].color] + ";opacity:0.55;font-size:0.5em'>";
                                szHtml += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>";
                                szHtml += "<span onclick='javascript:ixmaps.markThemeClass(\"" + szId + "\"," + sortA[i].color + ");event.stopPropagation();return false;' style='background:" + colorA[sortA[i].color] + ";opacity:1;font-size:0.5em'>";
                                szHtml += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>";
                           } else {
                                szHtml += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
                            }
                        }

                        szHtml += "</span>";
                    }
                    szHtml += "</a>";
                    szHtml += "</span>";

                    // add information to the color bar

                    if (sortA[i].count) {
 						if ( $("#map-legend").attr("data-align") == "left" ){
                       		szHtml += "<span class='theme-legend-count' style='pointer-events:all;color:#888888;vertical-align:-10%'>&nbsp;&nbsp;" + szCount + "</span>";
						}else{
							szHtml += "<span class='theme-legend-count' style='pointer-events:all;color:#888888;float:right;'>&nbsp;&nbsp;" + szCount + "</span>";
						}
                    } else
                    if (themeObj.szLabelA) {
                        if ((typeof (themeObj.partsA[i].min) != "undefined") && (typeof (themeObj.partsA[i].max) != "undefined")) {
                            szHtml += "<span style='padding-left:10px'>" + ixmaps.__formatValue(themeObj.partsA[i].min, 2, "BLANK") + " " + szUnit + "</span>  ... <span style='padding-left:5px'>" + ixmaps.__formatValue(themeObj.partsA[i].max, 2, "BLANK") + " " + szUnit + "</span>";
                        } else 
                        if ((typeof (themeObj.nMinA[i]) != "undefined") &&
                            (typeof (themeObj.nMaxA[i]) != "undefined") &&
                            (themeObj.nMinA[i] < themeObj.nMaxA[i])) {
                            szHtml += "<span style='padding-left:10px'>" + ixmaps.__formatValue(themeObj.nMinA[i], 2, "BLANK") + " " + szUnit + "</span>  ... <span style='padding-left:5px'>" + ixmaps.__formatValue(themeObj.nMaxA[i], 2, "BLANK") + " " + szUnit + "</span>";
                            if (themeObj.nMeanA[i]) {
                                szHtml += "<span style='padding-left:10px' title='mean value'>(" + ixmaps.__formatValue(themeObj.nMeanA[i], 2, "BLANK") + ")</span>";
                            }
                        } else
                        if ((typeof (themeObj.nOrigMinA[i]) != "undefined") &&
                            (typeof (themeObj.nOrigMaxA[i]) != "undefined") &&
                            (themeObj.nOrigMinA[i] < themeObj.nOrigMaxA[i])) {
                            szHtml += "<span style='padding-left:10px'>" + ixmaps.__formatValue(themeObj.nOrigMinA[i], 2, "BLANK") + " " + szUnit + "</span>  ... <span style='padding-left:5px'>" + ixmaps.__formatValue(themeObj.nOrigMaxA[i], 2, "BLANK") + " " + szUnit + "</span>";
                        } else {
                         }
                    }
                }

                // end of color bar
                szHtml += "</div>";

                // end of legend part
                szHtml += "</div>";
            }
        } else {
            if (((themeObj.nMinValue || themeObj.nMin) != 1) || ((themeObj.nMaxValue || themeObj.nMax) != 1)) {
                szHtml += "<tr valign='top'><td><span onclick='javascript:ixmaps.hideThemeClass(\"" + szId + "\"," + 0 + ")'  style='background:" + colorA[0] + ";font-size:0.7em;'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></td><td><span style='padding-left:5px'>" + ixmaps.__formatValue((themeObj.nMinValue || themeObj.nMin), 2, "BLANK") + " </span></td><td> &nbsp;...</td><td><span style='padding-left:5px'>" + ixmaps.__formatValue((themeObj.nMaxValue || themeObj.nMax), 2, "BLANK") + " " + szUnit + "</span></td></tr>";
            } else {
                szHtml += "<tr valign='top'><td><span onclick='javascript:ixmaps.hideThemeClass(\"" + szId + "\"," + 0 + ")'  style='background:" + colorA[0] + ";font-size:0.7em;'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></td><td><span style='padding-left:5px'>" + (themeObj.szLabelA || themeObj.szFields) + "</td></tr>";
            }
        }

        szHtml += "</div>";

        return szHtml;
    };

    // --------------------------------
    // color scheme compact (one line) 
    // --------------------------------

    /**
     * make a short version color scheme with only one line	
     * @param {string} szId the theme id 
     * @param {string} szLegendId a target id (div) [optional] 
     * @param {string} szMode "compact" to allow compact (one line) legend if possible 
     */
    ixmaps.legend.makeColorLegendHTMLCompact = function (szId, szLegendId) {

        szLegendId = szLegendId || "generic";

        var themeObj = ixmaps.getThemeObj(szId);

        var colorA = themeObj.colorScheme;
        var labelA = themeObj.szLabelA;
        var nColors = colorA.length;

		var nDecimals = (typeof(themeObj.nValueDecimals) != 'undefined')?themeObj.nValueDecimals:2; 		

		var szUnit = themeObj.szLegendUnits || themeObj.szUnits || "";
        szUnit = szUnit.replace(/ /g, '&nbsp;');
        var szHtml = "";

        // theme filter
        if (0 && themeObj.szFilter) {
            szHtml += "<p class='legend-filter-text' >Filter: " + themeObj.szFilter + "</p>";
        }

        if ((themeObj.partsA.length == 1) && themeObj.szFlag.match(/DOPACITY/)) { 

            // 1 color and DOPACITY, make 7 step opacity growth
            nColors = 7;

            szHtml += "<table id='legend-classes" + szLegendId + "' >";

            szHtml += "<tr valign='top' >";
            for (var i = 0; i < nColors; i++) {

                var nCount = Math.min(100 / nColors, 8);
                var nGap = nCount / 10;

                szHtml += "<td><div style='margin-right:" + nGap + "px;overflow:hidden;'>";
                szHtml += "<span style='background:" + colorA[0] + ";opacity:" + (1 / (nColors - i)) + "'>";

                for (ii = 0; ii < nCount; ii++) {
                    szHtml += "&nbsp;";
                }

                szHtml += "</span></div></td>";
            }
            szHtml += "</tr>";

        } else { 

            // color legend 
            szHtml += "<table id='legend-classes" + szLegendId + "' cellspacing='1' cellpadding='0' >";

            var nRows = (themeObj.szFlag.match(/DOPACITY/) && themeObj.szAlphaField && themeObj.nMaxAlpha) ? 3 : 1;
            for (var row = 0; row < nRows; row++) {
                szHtml += "<tr valign='top' >";
                for (var i = 0; i < nColors; i++) {
                    var szMinMax = "";
                    var ix = themeObj.szFlag.match(/INVERT/) ? (nColors - i - 1) : i;
                    if (themeObj.partsA[ix] && themeObj.partsA[ix].min && themeObj.partsA[ix].max) {
                        szMinMax = ixmaps.__formatValue(themeObj.partsA[ix].min, nDecimals, "SPACE") + szUnit + " ... " + 					ixmaps.__formatValue(themeObj.partsA[ix].max, nDecimals, "SPACE") + szUnit;
                    }
                    var nCount = Math.min(50 / nColors, 8);
                    var nOpacity = (1 / (row + 1));
                    if ( (nRows == 1) && themeObj.szFlag.match(/DOPACITY/)) {
                        var nValue = themeObj.partsA[i].min + (themeObj.partsA[i].max - themeObj.partsA[i].min)/2;
                        var nPow = 1 / (themeObj.nDopacityPow || 1);
                        if ( themeObj.szFlag.match(/DOPACITYMINMAX/) ){
                            if (nValue >= themeObj.nMedianA[0]) {
                                nOpacity = Math.pow(Math.abs(nValue - themeObj.nMedianA[0]), nPow) / Math.pow((themeObj.nMax - themeObj.nMedianA[0]), nPow) * (themeObj.fillOpacity || 1) * (themeObj.nDopacityScale || 1);
                            } else {
                                nOpacity = Math.pow(Math.abs(nValue - themeObj.nMedianA[0]), nPow) / Math.pow((themeObj.nMedianA[0] - themeObj.nMin), nPow) * (themeObj.fillOpacity || 1) * (themeObj.nDopacityScale || 1);
                            }
                        } // ------------------------------------------------------------------------------
                        else
                        if (themeObj.szFlag.match(/DOPACITYMIN/)) {
                            nOpacity = Math.pow((themeObj.nMax - nValue), nPow) / Math.pow((themeObj.nMax - themeObj.nMin), nPow) * (themeObj.fillOpacity || 1) * (themeObj.nDopacityScale || 1);
                        } // ------------------------------------------------------------------------------
                        else
                        if (themeObj.szFlag.match(/DOPACITYMAX/)) {
                            nOpacity = Math.pow((nValue - themeObj.nMin), nPow) / Math.pow((themeObj.nMax - themeObj.nMin), nPow) * (themeObj.fillOpacity || 1) * (themeObj.nDopacityScale || 1);
                        } // ------------------------------------------------------------------------------
                        else
                        if (themeObj.szFlag.match(/DOPACITYLOG/)) {
                            nOpacity = Math.log(nValue - themeObj.nMin) / Math.log(themeObj.nMedianA[0] - themeObj.nMin) * 0.5 * (themeObj.fillOpacity || 1) * (themeObj.nDopacityScale || 1);
                        } // ------------------------------------------------------------------------------
                        else
                        if (themeObj.szFlag.match(/DOPACITY/)) {
                            nOpacity = (nValue - themeObj.nMin) / (themeObj.nMedianA[0] - themeObj.nMin) * 0.5 * (themeObj.fillOpacity || 1) * (themeObj.nDopacityScale || 1);
                        } // ------------------------------------------------------------------------------
                        else {
                            nOpacity = (i + (nColors / 10)) / nColors;
                        }
                    }
                    szHtml += "<td><a " + ((nCount <= 1) ? "style='margin-right:-0.5px'" : "") + " class='legend-color-button' href='#' title='" + szMinMax + " click to see'><span onclick='javascript:ixmaps.markThemeClass(\"" + szId + "\"," + ix + ");event.stopPropagation();return false;' style='background:" + colorA[ix] + ";opacity:" + nOpacity + "'>";
                    if (((typeof (themeObj.markedClass) != "undefined") && (themeObj.markedClass == ix)) ||
                        ((typeof (themeObj.markedClasses) != "undefined") && (themeObj.markedClasses[ix]))) {
                        nCount -= 4;
                    }
                    for (ii = 0; ii < nCount; ii++) {
                        szHtml += "&nbsp;";
                    }
                    if (((typeof (themeObj.markedClass) != "undefined") && (themeObj.markedClass == ix)) ||
                        ((typeof (themeObj.markedClasses) != "undefined") && (themeObj.markedClasses[ix]))) {
                        szHtml += "<span style='font-size:2em;line-height:0;vertical-align:-0.35em;color:#444'>*</span>";
                    }
                    szHtml += "</td></a>";
                }
                if (themeObj.szFlag.match(/DOPACITY/) && themeObj.szAlphaField && themeObj.nMaxAlpha) {
                    if (row == 0) {
                        szHtml += "<td><span style='padding-left:0.5em'>" + ixmaps.__formatValue(themeObj.nMaxAlpha, 0, "BLANK") + "</span></td>";
                    } else
                    if (row == 1) {
                        szHtml += "<td><span style='padding-left:0.5em'>&#8595; " + (themeObj.szAlphaValueUnits || "") + "</span></td>";
                    } else {
                        szHtml += "<td><span style='padding-left:0.5em'>" + ixmaps.__formatValue(themeObj.nMinAlpha, 0, "BLANK") + "</span></td>";
                    }
                }
                szHtml += "</tr>";
            }
        }
        // first/last value text below the one line color scheme
        // -------------------------------------------
        // if szUnits == . don't insert leading blank
        var szUnit = themeObj.szLegendUnits || themeObj.szUnits || "     ";

        szUnit = ((szUnit.substr(0, 1) == '.') ? "" : " ") + szUnit;
        var span = Math.floor(nColors * 0.5);
		//var nMin = themeObj.nMinA[0]||themeObj.nMin;
		//var nMax = themeObj.nMaxA[0]||themeObj.nMax;
		var nMin = themeObj.nMin;
		var nMax = themeObj.nMax;
        if (themeObj.nRangesA && themeObj.nRangesA.length){
            nMin = themeObj.nRangesA[0];
            nMax = themeObj.nRangesA[themeObj.nRangesA.length-1];
        }
        szHtml += "<tr class='legend-range-text' >";
        szHtml += "<td colspan='" + (span) + "' align='left'>" + ixmaps.__formatValue(nMin, nDecimals, "SPACE") + szUnit + "</td>";
        szHtml += "<td colspan='" + (nColors - span) + "' align='right'>" + ixmaps.__formatValue(nMax, nDecimals, "SPACE") + ((szUnit.length <= 3) ? szUnit : "") + "</td>";
        szHtml += "</tr>";

        szHtml += "</table>";

        return szHtml;
    };


    /**
     * make a color scheme legend in HTML 	
     * @param {string} szId the theme id 
     * @param {string} szLegendId a target id (div) [optional] 
     * @param {string} szMode "compact" to allow compact (one line) legend if possible 
     */
    ixmaps.legend.makeColorLegendHTML = function (szId, szLegendId, szMode) {

        szLegendId = szLegendId || "generic";

        var fLegendCompact = (szMode && szMode == "compact") ? true : false;
        var themeObj = ixmaps.getThemeObj(szId);
        /** 
        if (themeObj.nDoneCount == 0) {
            if (themeObj.nChartUpper) {
                return ("<strong>not visible at actual zoom!</strong><br>please zoom in below 1:" + themeObj.nChartUpper);
            }
        }
        **/

        // check whether to make VECTOR legend 
        // -----------------------------------------------
        if (themeObj.szFlag.match(/VECTOR/) && themeObj.szLineColor && 0 ) {
            return ("<span style='display:inline-block;background:" + themeObj.szLineColor + ";font-size:0.1em;width:350px'>&nbsp;</span>");
        }
        // check whether to make compact (one line) legend 
        // -----------------------------------------------
        if (0 && fLegendCompact &&
		   themeObj.szFlag.match(/\bCLIP\b/)){
       		return "";
	   }
       if (0 && themeObj.szFlag.match(/\bCLIP\b/)) {
            return ixmaps.legend.makeColorLegendHTMLCompact(szId, szLegendId);
        }
        if ((themeObj.partsA.length == 1) &&
            themeObj.szFlag.match(/DOPACITY/) &&
            !themeObj.szFlag.match(/CATEGORICAL/)) {
            return ixmaps.legend.makeColorLegendHTMLCompact(szId, szLegendId);
        }
       if (0 && fLegendCompact &&
		   themeObj.szFlag.match(/\bCLIP\b/)){
       		return "";
	   }
       if (fLegendCompact &&
            themeObj.partsA.length >= 5 &&
            !themeObj.szFlag.match(/CATEGORICAL/) &&
            !themeObj.szFlag.match(/PLOT/) &&
            !(themeObj.szLabelA && themeObj.szLabelA.length && !(themeObj.szFlag.match(/SEQUENCE/) && !themeObj.szFlag.match(/SYMBOL/)))) {
            return ixmaps.legend.makeColorLegendHTMLCompact(szId, szLegendId);
        }

        return ixmaps.legend.makeColorLegendHTMLLong(szId, szLegendId);
    };

    // ---------------------------------------------
    // legend footer  
    // ---------------------------------------------

    ixmaps.htmlgui_onLegendFooter = function (szId, themeObj) {

        this.themeObj = themeObj;

        var themeDef = themeObj.def();

        var szHtml = "";

        // show theme filter, if defined
        if (themeObj.szFilter) {
            szHtml += "<p class='legend-filter' style='margin-top:0em;color:#fff;background:#ddd;width:85%'><span class='icon icon-filter' style='float:left;padding:0.2em 0.5em;'></span><span class='legend-filter-text'>" + themeObj.szFilter + "</span><a href='javascript:ixmaps.changeThemeStyle(null,null,\"filter\",\"remove\");' title=\"remove\" ><span class='icon icon-cancel-circle' style='float:right;padding:0.2em 0.5em;'></span></a></p>";
        }
        if (0 && (themeObj.partsA.length > 2)) {
            szHtml += "<p style='color:#444444;><i class='icon-arrow-up' title='arrow up' ></i> clicca sui colori per evidenziare</p>";
        }
        if (themeDef.style.type.match(/AGGREGATE/) && themeDef.style.gridwidthpx) {
            szHtml += "<p style='color:#444444'> aggregato per griglia di " + themeDef.style.gridwidthpx + " pixel</p>";
            szHtml += "<p>";
            szHtml += "<button type='button' class='btn btn-default' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridwidthpx:1\",\"set\");'>1</button>";
            szHtml += "<button type='button' class='btn btn-default' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridwidthpx:2\",\"set\");'>2</button>";
            szHtml += "<button type='button' class='btn btn-default' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridwidthpx:5\",\"set\");'>5</button>";
            szHtml += "<button type='button' class='btn btn-default' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridwidthpx:10\",\"set\");'>10</button>";
            szHtml += "<button type='button' class='btn btn-default' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridwidthpx:20\",\"set\");'>20</button>";
            szHtml += "<button type='button' class='btn btn-default' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridwidthpx:50\",\"set\");'>50</button>";
            szHtml += "<button type='button' class='btn btn-default' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridwidthpx:100\",\"set\");'>100</button>";
            szHtml += "</p>";
            
            szHtml += "<p>";
            szHtml += "<button type='button' class='btn btn-default' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridoffsetx:-5\",\"add\");'>&larr;</button>";
            szHtml += "<button type='button' class='btn btn-default' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridoffsetx:5\",\"add\");'>&rarr;</button>";
            szHtml += "<button type='button' class='btn btn-default' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridoffsety:-5\",\"add\");'>&darr;</button>";
            szHtml += "<button type='button' class='btn btn-default' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridoffsety:5\",\"add\");'>&uarr;</button>";
            szHtml += "</p>";
        } else
        if (themeDef.style.type.match(/AGGREGATE/) && themeDef.style.gridwidth) {
            szHtml += "<p style=margin-top:-10px'> aggregato per griglia di " + themeDef.style.gridwidth.toFixed(0) + " metri</p>";
            szHtml += "<p>";
            szHtml += "<button type='button' class='btn btn-default " + ((themeDef.style.gridwidth == 100 ? "focus" : "")) + "' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridwidth:100\",\"set\");'>100</button>";
            szHtml += "<button type='button' class='btn btn-default " + ((themeDef.style.gridwidth == 250 ? "focus" : "")) + "' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridwidth:250\",\"set\");'>250</button>";
            szHtml += "<button type='button' class='btn btn-default " + ((themeDef.style.gridwidth == 500 ? "focus" : "")) + "' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridwidth:500\",\"set\");'>500</button>";
            szHtml += "<button type='button' class='btn btn-default " + ((themeDef.style.gridwidth == 1000 ? "focus" : "")) + "' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridwidth:1000\",\"set\");'>1000</button>";
            szHtml += "<button type='button' class='btn btn-default " + ((themeDef.style.gridwidth == 5000 ? "focus" : "")) + "' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridwidth:5000\",\"set\");'>5km</button>";
            szHtml += "<button type='button' class='btn btn-default " + ((themeDef.style.gridwidth == 10000 ? "focus" : "")) + "' onclick='javascript:ixmaps.changeThemeStyle(null,\"gridwidth:10000\",\"set\");'>10km</button>";
            szHtml += "</p>";
            szHtml += "<div class='btn-group' style='margin-bottom:1em' ole='group' aria-label='...'>";
            szHtml += "  <button type='button' class='btn btn-default " + (themeDef.style.symbols == "square" ? "focus" : "") + "' onclick='ixmaps.changeThemeStyle(null,\"type:RECT\",\"add\");ixmaps.changeThemeStyle(null,\"symbols:square\",\"set\");'>rettangoli</button>";
            szHtml += "  <button type='button' class='btn btn-default " + (themeDef.style.symbols == "circle" ? "focus" : "") + "' onclick='ixmaps.changeThemeStyle(null,\"type:RECT\",\"add\");ixmaps.changeThemeStyle(null,\"symbols:circle\",\"set\");'>cerchi</button>";
            szHtml += "  <button type='button' class='btn btn-default " + (themeDef.style.symbols == "hexagon" ? "focus" : "") + "' onclick='ixmaps.changeThemeStyle(null,\"type:RECT\",\"remove\");ixmaps.changeThemeStyle(null,\"symbols:hexagon\",\"set\");'>esagoni</button>";
            szHtml += "</div>";
        } else
        if (themeDef.style.type.match(/AGGREGATE/) && themeDef.style.gridwidthxxx) {
            szHtml += "<p style='color:#444444;margin-top:-10px'>" +
                "<div class='dropdown' >aggregato per griglia di " +
                "<button class='btn btn-default dropdown-toggle' type='button' id='dropdownMenu1' data-toggle='dropdown' aria-haspopup='true' aria-expanded='true'> " +
                themeDef.style.gridwidth +
                " <span class='caret'></span>" +
                "</button>" +
                "<ul class='dropdown-menu' aria-labelledby='dropdownMenu1'>" +
                "<li><a href='javascript:ixmaps.changeThemeStyle(\"" + szId + "\",\"gridwidth:100\",\"set\");'>100 metri</a></li>" +
                "<li><a href='javascript:ixmaps.changeThemeStyle(\"" + szId + "\",\"gridwidth:250\",\"set\");'>250 metri</a></li>" +
                "<li><a href='javascript:ixmaps.changeThemeStyle(\"" + szId + "\",\"gridwidth:500\",\"set\");'>500 metri</a></li>" +
                "<li><a href='javascript:ixmaps.changeThemeStyle(\"" + szId + "\",\"gridwidth:1000\",\"set\");'>1000 metri</a></li>" +
                "</ul> metri" +
                "</div>";
            szHtml += "</p>";
        }

        var id = szId.replace(/\./g, '');

        var bigger_icon = "<span class='icon icon-arrow-up theme-tool-button' ></span>";
        var smaller_icon = "<span class='icon icon-arrow-down theme-tool-button' ></span>";

        if (themeObj.szFlag.match(/AGGREGATE/)) {
            bigger_icon = "<i class='fa fa-th-large fa-fw'></i>";
            smaller_icon = "<span style='margin-left:3px'>&nbsp;</span><i class='fa fa-th fa-fw'></i>";
        }

        szHtml += "<div style='position:relative;margin-top:0.5em;margin-bottom:1em;margin-left:-0.8em;line-height:2em;' >";
        szHtml += "<span id='legend-buttons" + szId + "'>";

        szHtml += "<a id='highbutton" + id + "' class='theme-tool-button' href='javascript:ixmaps.changeThemeDynamic(\"" + szId + "\",\"amplify\",\"0.66\");' title='smooth chart' >";
        szHtml += smaller_icon;
        szHtml += "</a>&nbsp;";

        szHtml += "<a id='lowbutton" + id + "' class='theme-tool-button' href='javascript:ixmaps.changeThemeDynamic(\"" + szId + "\",\"amplify\",\"1.5\");' title='amplify chart'>";
        szHtml += bigger_icon;
        szHtml += "</a>&nbsp;";

        szHtml += "<a id='minusbutton" + id + "' class='theme-tool-button' href='javascript:ixmaps.changeThemeDynamic(\"" + szId + "\",\"scale\",\"0.66\");' title='smaller charts'>";
        szHtml += "<span class='icon icon-minus theme-tool-button' ></span>";
        szHtml += "</a>&nbsp;";

        szHtml += "<a id='plusbutton" + id + "' class='theme-tool-button' href='javascript:ixmaps.changeThemeDynamic(\"" + szId + "\",\"scale\",\"1.5\");' title='bigger charts'>";
        szHtml += "<span class='icon icon-plus theme-tool-button' ></span>";
        szHtml += "</a> ";

        szHtml += "<a id='valuebutton" + id + "' class='theme-tool-button' href='javascript:ixmaps.toggleValueDisplay(\"" + szId + "\");' title='add/remove textual values'>";
        szHtml += "<span class='icon icon-spell-check theme-tool-button' ></span>";
        szHtml += "</a>&nbsp;";

        szHtml += "<a id='opminusbutton" + id + "' class='theme-tool-button' href='javascript:ixmaps.changeThemeDynamic(\"" + szId + "\",\"opacity\",\"0.66\");' title='more transparency'>";
        szHtml += "<span class='icon icon-checkbox-unchecked theme-tool-button' style='padding:0.5em;'></span>";
        szHtml += "</a>&nbsp;";

        szHtml += "<a id='opplusbutton" + id + "' class='theme-tool-button' href='javascript:ixmaps.changeThemeDynamic(\"" + szId + "\",\"opacity\",\"1.5\");' title='less transparency'>";
        szHtml += "<span class='icon icon-stop2 theme-tool-button' ></span>";
        szHtml += "</a>&nbsp;";

        szHtml += "<a id='deletebutton" + id + "' class='theme-tool-button'  href='javascript:ixmaps.makeChartMenueHTML(\"" + szId + "\");' title='chart menu'>";
        szHtml += "<span class='icon icon-pie-chart theme-tool-button' ></span>";
        szHtml += "</a>&nbsp;";

        szHtml += "<a id='lockbutton" + id + "' class='theme-tool-button'  href='javascript:ixmaps.changeThemeStyle(\"" + szId + "\",\"type:LOCKED\",\"toggle\");' title='chart menu'>";
        if (themeDef.style.type.match(/LOCKED/)) {
            szHtml += "<span class='icon icon-lock theme-tool-button' ></span>";
            szHtml += "</a>&nbsp;";
        } else {
            szHtml += "<span class='icon icon-unlocked theme-tool-button' ></span>";
            szHtml += "</a>&nbsp;";
        }

        szHtml += "<a id='deletebutton" + id + "' class='theme-tool-button'  href='javascript:ixmaps.removeTheme(\"" + szId + "\");' title='remove theme'>";
        szHtml += "<span class='icon icon-bin2 theme-tool-button' ></span>";
        szHtml += "</a>&nbsp;";


        szHtml += "</ span>";
        szHtml += "</ div>";

        if (ixmaps.date && (ixmaps.date != "null")) {
            if (ixmaps.parent && (ixmaps.parent != "null")) {
                var link = "<a style='text-decoration:none' href='" + ixmaps.parent + "' target='_blank'>this application</a>";
                szHtml += "<div style='margin-left:0.5em;font-size:0.8em'><p>created by " + link + " on " + ixmaps.date.split(/GMT/)[0] + "</p></div>";
            } else {
                szHtml += "<div style='margin-left:0.5em;font-size:0.7em'><p>creation time:<br> " + ixmaps.date + "</p></div>";
            }
        }

        szHtml += "</div>";

        return szHtml;
    };


    ixmaps.legend.loadExternalLegend = function (szUrl) {
		
        var szHtml = '<div id="map-legend-body" class="map-legend-body" style="margin-top:-1em"></div>';
        $("#map-legend").html(szHtml);
        $("#map-legend-body").load(szUrl, function(response, status, xhr) {
            if (status === "success") {
                // Check for mustache template placeholders in loaded content
                var loadedContent = $("#map-legend-body").html();
                if (loadedContent && (loadedContent.indexOf('{{themes}}') !== -1 || loadedContent.indexOf('{{layers}}') !== -1)) {
                    // Generate layer list HTML
                    var layerListHTML = __generateLayerListHTML();
                    // Replace placeholders
                    loadedContent = loadedContent.replace(/\{\{themes\}\}/g, layerListHTML);
                    loadedContent = loadedContent.replace(/\{\{layers\}\}/g, layerListHTML);
                    // Add fold button to the external legend
                    // Ensure legendState is initialized (default to 1 = unfolded)
                    // Preserve existing state if set (for redraw persistence), otherwise default to 1
                    if (typeof ixmaps.legendState === 'undefined' || ixmaps.legendState === null) {
                        ixmaps.legendState = 1; // Default to unfolded
                    }
                    var currentState = parseInt(ixmaps.legendState) || 1;
                    // When unfolded (state 1 or 2), show up arrow (to fold). When folded (state 0), show down arrow (to unfold)
                    // icon-arrow-up2 = fold (when unfolded), icon-arrow-down2 = unfold (when folded)
                    var isFolded = (currentState === 0);
                    // Only create the arrow that should be visible - not both
                    var arrowIcon = isFolded ? 'icon-arrow-down2' : 'icon-arrow-up2';
                    var foldButtonHtml = '<div id="map-legend-external-fold-button" style="position:absolute;top:11px;right:0.3em;cursor:pointer;z-index:1000;background:rgba(255,255,255,0.9);border:1px solid rgba(0,0,0,0.2);border-radius:3px;padding:0.2em 0.4em;font-size:0.9em;" title="Fold/Unfold legend">' +
                        '<span class="icon ' + arrowIcon + '"></span>' +
                        '</div>';
                    
                    // Update the HTML with fold button
                    $("#map-legend-body").html('<div style="position:relative;">'+foldButtonHtml+loadedContent+'</div>');
                    // Ensure legend is positioned correctly (top: 11px, right: calc(4% - 4px)) - fixed position, never changes
                    $("#map-legend").css({
                        "top": "11px",
                        "right": "calc(4% - 4px)",
                        "position": "absolute"
                    });
                    // Ensure pointer events are enabled for click handlers
                    $("#map-legend-body").css("pointer-events","auto");
                    $("#map-legend-body .layerlist-item-clickable").css("pointer-events","auto");
                    
                    // Create Legend button for when folded - positioned at same location as legend (top: 11px)
                    // Always create it, even if initially unfolded (it will be hidden)
                    var initialState = parseInt(ixmaps.legendState) || 1;
                    // Remove existing button if it exists
                    $("#map-legend-external-legend-button").remove();
                    var legendButton = $('<button id="map-legend-external-legend-button" class="legend-toggle-button" style="position:absolute;top:13px;left:90px;display:' + (initialState === 0 ? 'flex' : 'none') + ';z-index:10000;">Legend</button>');
                    // Append to map container (same parent as legend)
                    var mapContainer = $("#map-legend").parent();
                    if (mapContainer.length) {
                        mapContainer.append(legendButton);
                    } else if ($("#ixmap").length) {
                        $("#ixmap").append(legendButton);
                    } else {
                        $("body").append(legendButton);
                    }
                    legendButton.on('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        // Trigger the fold button click to unfold
                        $("#map-legend-external-fold-button").trigger('click');
                        return false;
                    });
                    
                    // If initially folded, hide legend and show button
                    if (initialState === 0) {
                        $("#map-legend").hide();
                        $("#map-legend-external-fold-button").hide();
                        legendButton.css("display", "flex").show();
                    }
                    
                    
                    // Define fold button click handler function (using event delegation so it works after button regeneration)
                    var foldButtonClickHandler = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        var button = $("#map-legend-external-fold-button");
                        var contentWrapper = $("#map-legend-body > div");
                        var currentState = parseInt(ixmaps.legendState) || 1;
                        
                        // Determine new state: toggle between 0 (folded) and 1 (unfolded)
                        var newState = (currentState === 0) ? 1 : 0;
                        
                        // Update state first (persists in memory for redraws)
                        ixmaps.legendState = newState;
                        
                        // Update visibility: when folded, hide legend and show button; when unfolded, show legend and hide button
                        if (newState === 0) {
                            // Folded: hide legend, show Legend button (both at same position top: 11px)
                            $("#map-legend").hide();
                            button.hide(); // Hide fold button when folded
                            var legendButton = $("#map-legend-external-legend-button");
                            if (!legendButton.length) {
                                // Button doesn't exist, create it now
                                legendButton = $('<button id="map-legend-external-legend-button" class="legend-toggle-button" style="position:absolute;top:13px;left:90px;z-index:10000;">Legend</button>');
                                var mapContainer = $("#map-legend").parent();
                                if (mapContainer.length) {
                                    mapContainer.append(legendButton);
                                } else if ($("#ixmap").length) {
                                    $("#ixmap").append(legendButton);
                                } else {
                                    $("body").append(legendButton);
                                }
                                legendButton.on('click', function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    $("#map-legend-external-fold-button").trigger('click');
                                    return false;
                                });
                            }
                            // Ensure button is visible and properly styled
                            legendButton.css({
                                "display": "flex",
                                "position": "absolute",
                                "top": "11px",
                                "left": "92px",
                                "z-index": "10000",
                                "visibility": "visible",
                                "opacity": "1"
                            }).show();
                        } else {
                            // Unfolded: redraw legend content to ensure all elements are drawn
                            __redrawLegendContent();
                            $("#map-legend").show();
                            $("#map-legend-external-legend-button").hide();
                            var newButton = $("#map-legend-external-fold-button");
                            newButton.show();
                            // Update fold button to show only up arrow (to fold)
                            newButton.html('<span class="icon icon-arrow-up2"></span>');
                            // Handler is already attached via delegation, so no need to reattach
                        }
                        
                        return false;
                    };
                    
                    // Use event delegation on #map-legend-body so handler works even after button is regenerated
                    // This ensures the handler works even when __redrawLegendContent() regenerates the button HTML
                    $("#map-legend-body").off('click', '#map-legend-external-fold-button').on('click', '#map-legend-external-fold-button', foldButtonClickHandler);
                    
                    // Re-attach click handlers using event delegation
                    setTimeout(function() {
                        $("#map-legend-body").off('click', '.layerlist-item-clickable');
                        $("#map-legend-body").on('click', '.layerlist-item-clickable', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            var themeId = $(this).attr('data-theme-id');
                            if (themeId && typeof ixmaps !== 'undefined' && ixmaps.toggleTheme) {
                                var item = this;
                                var scrollContainer = document.querySelector("#map-legend-body") || document.querySelector("#map-legend-body > div");
                                var savedScroll = scrollContainer ? (scrollContainer.scrollTop || 0) : 0;
                                try {
                                    ixmaps.toggleTheme(themeId);
                                    if ($(item).hasClass("layerlist-item-hidden")) {
                                        $(item).removeClass("layerlist-item-hidden");
                                    } else {
                                        $(item).addClass("layerlist-item-hidden");
                                    }
                                    setTimeout(function() {
                                        var newScrollContainer = document.querySelector("#map-legend-body") || document.querySelector("#map-legend-body > div");
                                        if (newScrollContainer && savedScroll > 0) {
                                            newScrollContainer.scrollTop = savedScroll;
                                        }
                                    }, 50);
                                } catch(err) {
                                    console.warn('Error toggling theme:', err);
                                }
                            }
                            return false;
                        });
                        $("#map-legend-body .layerlist-item-clickable").css("cursor", "pointer");
                    }, 100);
                }
            }
        });
        $("#map-legend-body").css("pointer-events","all");
        $("#map-legend-delete").css("pointer-events","all");
        $("#map-legend").show();

    };
    /**
     * Redraw legend content if it has placeholders that need regeneration
     * This is called when unfolding the legend to ensure all elements are drawn
     */
    var __redrawLegendContent = function() {
        // Check if we have an external legend URL/template stored
        if (ixmaps.legend && ixmaps.legend.url && ixmaps.legend.url.length) {
            var legendUrl = ixmaps.legend.url;
            
            // If it's a URL (http or relative path), reload it
            if (legendUrl.substr(0, 4) == "http" || legendUrl.substr(0, 6) == "../../") {
                // Temporarily set externalLegend to false so it will reload
                var wasExternal = ixmaps.legend.externalLegend;
                ixmaps.legend.externalLegend = false;
                // Reload the legend (this will regenerate content with current themes)
                ixmaps.legend.loadExternalLegend(legendUrl);
                // Restore the external legend flag
                ixmaps.legend.externalLegend = wasExternal;
                return;
            } 
            // If it's a template string with mustache placeholders, regenerate it
            else if (legendUrl.indexOf('{{themes}}') !== -1 || legendUrl.indexOf('{{layers}}') !== -1) {
                var legendBody = $("#map-legend-body");
                if (!legendBody.length) {
                    return;
                }
                
                // Generate layer list HTML
                var layerListHTML = __generateLayerListHTML();
                // Replace placeholders in template
                var loadedContent = legendUrl.replace(/\{\{themes\}\}/g, layerListHTML);
                loadedContent = loadedContent.replace(/\{\{layers\}\}/g, layerListHTML);
                
                // Create fold button HTML
                var foldButtonHtml = '<div id="map-legend-external-fold-button" style="position:absolute;top:11px;right:0.3em;cursor:pointer;z-index:1000;background:rgba(255,255,255,0.9);border:1px solid rgba(0,0,0,0.2);border-radius:3px;padding:0.2em 0.4em;font-size:0.9em;" title="Fold/Unfold legend">' +
                    '<span class="icon icon-arrow-up2"></span>' +
                    '</div>';
                
                // Update the HTML with fold button and regenerated content
                legendBody.html('<div style="position:relative;">'+foldButtonHtml+loadedContent+'</div>');
                
                // Re-attach click handlers to layer list items
                $("#map-legend-body .layerlist-item-clickable").css("pointer-events","auto");
                
                // Re-attach fold button click handler after regenerating HTML
                $("#map-legend-external-fold-button").off('click').on('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    var button = $("#map-legend-external-fold-button");
                    var currentState = parseInt(ixmaps.legendState) || 1;
                    
                    // Determine new state: toggle between 0 (folded) and 1 (unfolded)
                    var newState = (currentState === 0) ? 1 : 0;
                    
                    // Update state first (persists in memory for redraws)
                    ixmaps.legendState = newState;
                    
                    // Simple show/hide - no complex manipulation, no re-rendering
                    if (newState === 0) {
                        // Folded: hide legend, show Legend button
                        $("#map-legend").hide();
                        button.hide();
                        var legendButton = $("#map-legend-external-legend-button");
                        if (!legendButton.length) {
                            // Button doesn't exist, create it now
                            legendButton = $('<button id="map-legend-external-legend-button" class="legend-toggle-button" style="position:absolute;top:13px;left:90px;z-index:10000;">Legend</button>');
                            var mapContainer = $("#map-legend").parent();
                            if (mapContainer.length) {
                                mapContainer.append(legendButton);
                            } else if ($("#ixmap").length) {
                                $("#ixmap").append(legendButton);
                            } else {
                                $("body").append(legendButton);
                            }
                            legendButton.on('click', function(e) {
                                e.preventDefault();
                                e.stopPropagation();
                                // Simple unfold: redraw legend content and show the legend
                                ixmaps.legendState = 1;
                                __redrawLegendContent();
                                $("#map-legend").show();
                                $("#map-legend-external-legend-button").hide();
                                $("#map-legend-external-fold-button").show().html('<span class="icon icon-arrow-up2"></span>');
                                return false;
                            });
                        }
                        legendButton.css({
                            "display": "flex",
                            "position": "absolute",
                            "top": "13px",
                            "left": "90px",
                            "z-index": "10000"
                        }).show();
                    } else {
                        // Unfolded: simple show (no manipulation, no re-rendering, preserves position/margin)
                        $("#map-legend").show();
                        $("#map-legend-external-legend-button").hide();
                        button.show();
                        button.html('<span class="icon icon-arrow-up2"></span>');
                    }
                    
                    return false;
                });
                
                return;
            }
        }
        
        // Fallback: try to regenerate from current content if it has placeholders
        var legendBody = $("#map-legend-body");
        if (!legendBody.length) {
            return;
        }
        
        var currentHtml = legendBody.html();
        if (!currentHtml) {
            return;
        }
        
        // Check if content has placeholders
        var hasPlaceholders = currentHtml.indexOf('{{themes}}') !== -1 || currentHtml.indexOf('{{layers}}') !== -1;
        
        if (hasPlaceholders) {
            // Extract the actual content (remove fold button wrapper if present)
            var contentMatch = currentHtml.match(/<div[^>]*>([\s\S]*)<\/div>$/);
            var loadedContent = contentMatch ? contentMatch[1] : currentHtml;
            
            // Remove fold button HTML if present in content
            loadedContent = loadedContent.replace(/<div[^>]*id="map-legend-external-fold-button"[^>]*>[\s\S]*?<\/div>/g, '');
            
            // Generate layer list HTML
            var layerListHTML = __generateLayerListHTML();
            // Replace placeholders
            loadedContent = loadedContent.replace(/\{\{themes\}\}/g, layerListHTML);
            loadedContent = loadedContent.replace(/\{\{layers\}\}/g, layerListHTML);
            
            // Create fold button HTML
            var foldButtonHtml = '<div id="map-legend-external-fold-button" style="position:absolute;top:11px;right:0.3em;cursor:pointer;z-index:1000;background:rgba(255,255,255,0.9);border:1px solid rgba(0,0,0,0.2);border-radius:3px;padding:0.2em 0.4em;font-size:0.9em;" title="Fold/Unfold legend">' +
                '<span class="icon icon-arrow-up2"></span>' +
                '</div>';
            
            // Update the HTML with fold button and regenerated content
            legendBody.html('<div style="position:relative;">'+foldButtonHtml+loadedContent+'</div>');
            
            // Re-attach click handlers to layer list items
            $("#map-legend-body .layerlist-item-clickable").css("pointer-events","auto");
            
            // Re-attach fold button click handler after regenerating HTML
            $("#map-legend-external-fold-button").off('click').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                var button = $("#map-legend-external-fold-button");
                var currentState = parseInt(ixmaps.legendState) || 1;
                
                // Determine new state: toggle between 0 (folded) and 1 (unfolded)
                var newState = (currentState === 0) ? 1 : 0;
                
                // Update state first (persists in memory for redraws)
                ixmaps.legendState = newState;
                
                // Simple show/hide - no complex manipulation, no re-rendering
                if (newState === 0) {
                    // Folded: hide legend, show Legend button
                    $("#map-legend").hide();
                    button.hide();
                    var legendButton = $("#map-legend-external-legend-button");
                    if (!legendButton.length) {
                        // Button doesn't exist, create it now
                        legendButton = $('<button id="map-legend-external-legend-button" class="legend-toggle-button" style="position:absolute;top:13px;left:90px;z-index:10000;">Legend</button>');
                        var mapContainer = $("#map-legend").parent();
                        if (mapContainer.length) {
                            mapContainer.append(legendButton);
                        } else if ($("#ixmap").length) {
                            $("#ixmap").append(legendButton);
                        } else {
                            $("body").append(legendButton);
                        }
                        legendButton.on('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            // Simple unfold: redraw legend content and show the legend
                            ixmaps.legendState = 1;
                            __redrawLegendContent();
                            $("#map-legend").show();
                            $("#map-legend-external-legend-button").hide();
                            $("#map-legend-external-fold-button").show().html('<span class="icon icon-arrow-up2"></span>');
                            return false;
                        });
                    }
                    legendButton.css({
                        "display": "flex",
                        "position": "absolute",
                        "top": "13px",
                        "left": "90px",
                        "z-index": "10000"
                    }).show();
                } else {
                    // Unfolded: simple show (no manipulation, no re-rendering, preserves position/margin)
                    $("#map-legend").show();
                    $("#map-legend-external-legend-button").hide();
                    button.show();
                    button.html('<span class="icon icon-arrow-up2"></span>');
                }
                
                return false;
            });
        }
    };

    /**
     * Generate layer list HTML for mustache template replacement
     * @returns {string} HTML string with layer list items
     */
    var __generateLayerListHTML = function() {
        var allThemes = ixmaps.getThemes();
        if (!allThemes || allThemes.length === 0) {
            return "";
        }
        
        // Group themes by type
        var featureThemes = [];
        var choroplethThemes = [];
        var chartThemes = [];
        
        for (var i = 0; i < allThemes.length; i++) {
            var theme = allThemes[i];
            var themeObj = ixmaps.getThemeObj(theme.szId);
            if (!themeObj) continue;
            
            // Skip themes with NOLEGEND flag only (SILENT themes should still appear in legend)
            if (themeObj.szFlag && themeObj.szFlag.match(/NOLEGEND/)) {
                continue;
            }
            
            var themeName = themeObj.szLegendName || themeObj.szName || themeObj.szTitle || theme.szId;
            
            // Determine theme type from flags
            var themeType = "FEATURE"; // default
            if (themeObj.szFlag) {
                if (themeObj.szFlag.match(/CHOROPLETH/)) {
                    themeType = "CHOROPLETH";
                } else if (themeObj.szFlag.match(/CHART|BUBBLE|DOT/)) {
                    themeType = "CHART";
                }
            }
            
            // Create a layer-like object for the theme
            // Make sure themeObj is properly attached so __getLayerColor can extract colors
            var themeLayer = {
                szType: themeType === "CHART" ? "point" : (themeType === "CHOROPLETH" ? "polygon" : "polygon"),
                szName: themeName,
                szLegendName: themeName,
                themeType: themeType,
                themeObj: themeObj, // This is crucial - __getLayerColor needs this
                szId: theme.szId
            };
            
            // Also copy categoryA for backward compatibility and to ensure colors are available
            // This matches the structure used in the main legend code
            if (themeObj.categoryA) {
                for (var c in themeObj.categoryA) {
                    if (themeObj.categoryA[c].fill && themeObj.categoryA[c].fill !== "none") {
                        themeLayer.categoryA = {};
                        themeLayer.categoryA[c] = { fill: themeObj.categoryA[c].fill };
                        break;
                    }
                }
            }
            // If no fill color, try stroke color
            if (!themeLayer.categoryA && themeObj.categoryA) {
                for (var c in themeObj.categoryA) {
                    if (themeObj.categoryA[c].stroke) {
                        themeLayer.categoryA = {};
                        themeLayer.categoryA[c] = { fill: themeObj.categoryA[c].stroke };
                        break;
                    }
                }
            }
            
            if (themeType === "FEATURE") {
                featureThemes.push(themeLayer);
            } else if (themeType === "CHOROPLETH") {
                choroplethThemes.push(themeLayer);
            } else if (themeType === "CHART") {
                chartThemes.push(themeLayer);
            }
        }
        
        // Generate HTML for each group
        var szHtml = "";
        
        if (featureThemes.length > 0) {
            szHtml += '<div class="layerlist-group">';
            for (var j = 0; j < featureThemes.length; j++) {
                szHtml += __makeLayerlistItem(featureThemes[j], featureThemes[j].szName);
            }
            szHtml += '</div>';
        }
        
        if (choroplethThemes.length > 0) {
            szHtml += '<div class="layerlist-group">';
            for (var j = 0; j < choroplethThemes.length; j++) {
                szHtml += __makeLayerlistItem(choroplethThemes[j], choroplethThemes[j].szName);
            }
            szHtml += '</div>';
        }
        
        if (chartThemes.length > 0) {
            szHtml += '<div class="layerlist-group">';
            for (var j = 0; j < chartThemes.length; j++) {
                szHtml += __makeLayerlistItem(chartThemes[j], chartThemes[j].szName);
            }
            szHtml += '</div>';
        }
        
        return szHtml;
    };
    
    ixmaps.legend.setExternalLegend = function (szLegend) {
        // Check for mustache template placeholders
        if (szLegend && (szLegend.indexOf('{{themes}}') !== -1 || szLegend.indexOf('{{layers}}') !== -1)) {
            // Delay generation slightly to ensure themes are fully loaded with color data
            // Generate layer list HTML - use a small delay to ensure theme data is ready
            var generateAndSet = function() {
                // Ensure legendState is properly initialized before creating button
                // Preserve existing state if set (for redraw persistence), otherwise default to unfolded
                // If legendState is 0 (folded), preserve it - don't reset to unfolded
                if (typeof ixmaps.legendState === 'undefined' || ixmaps.legendState === null) {
                    ixmaps.legendState = 1; // Default to unfolded only if not set
                }
                // If it's already 0 (folded), keep it folded - don't reset
                
                var layerListHTML = __generateLayerListHTML();
                // Replace placeholders
                var finalLegend = szLegend.replace(/\{\{themes\}\}/g, layerListHTML);
                finalLegend = finalLegend.replace(/\{\{layers\}\}/g, layerListHTML);
                
                // Add fold button to the external legend
                // When unfolded (state 1 or 2), show up arrow (to fold). When folded (state 0), show down arrow (to unfold)
                // icon-arrow-up2 = fold (when unfolded), icon-arrow-down2 = unfold (when folded)
                var currentState = parseInt(ixmaps.legendState) || 1;
                var isFolded = (currentState === 0);
                // Only create the arrow that should be visible - not both
                var arrowIcon = isFolded ? 'icon-arrow-down2' : 'icon-arrow-up2';
                var foldButtonHtml = '<div id="map-legend-external-fold-button" style="position:absolute;top:11px;right:0.3em;cursor:pointer;z-index:1000;background:rgba(255,255,255,0.9);border:1px solid rgba(0,0,0,0.2);border-radius:3px;padding:0.2em 0.4em;font-size:0.9em;" title="Fold/Unfold legend">' +
                    '<span class="icon ' + arrowIcon + '"></span>' +
                    '</div>';
                
                var szHtml = '<div id="map-legend-body" class="map-legend-body" style="margin-top:0;"><div style="position:relative;">'+foldButtonHtml+finalLegend+'</div></div>';
                $("#map-legend").html(szHtml);
                // Ensure legend is positioned correctly (top: 11px, right: calc(4% - 4px)) - fixed position
                $("#map-legend").css({
                    "top": "11px",
                    "right": "calc(4% - 4px)",
                    "position": "absolute"
                });
                // Allow pointer events on the legend body so click handlers work
                $("#map-legend").css("pointer-events","auto");
                $("#map-legend-body").css("pointer-events","auto");
                // Make sure layer list items are clickable
                $("#map-legend-body .layerlist-item-clickable").css("pointer-events","auto");
                $("#map-legend-delete").css("pointer-events","all");
                $("#map-legend").show();
                
                // Create Legend button for when folded - positioned at same location as legend (top: 13px)
                // Position it relative to the map container, not the legend body
                var initialState = parseInt(ixmaps.legendState) || 1;
                var legendButton = $('<button id="map-legend-external-legend-button" class="legend-toggle-button" style="position:absolute;top:13px;left:90px;display:' + (initialState === 0 ? 'flex' : 'none') + ';z-index:10000;">Legend</button>');
                // Append to map container (same parent as legend)
                var mapContainer = $("#map-legend").parent();
                if (mapContainer.length) {
                    mapContainer.append(legendButton);
                } else if ($("#ixmap").length) {
                    $("#ixmap").append(legendButton);
                } else {
                    $("body").append(legendButton);
                }
                legendButton.on('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Simple unfold: redraw legend content and show the legend
                    ixmaps.legendState = 1;
                    __redrawLegendContent();
                    $("#map-legend").show();
                    $("#map-legend-external-legend-button").hide();
                    $("#map-legend-external-fold-button").show().html('<span class="icon icon-arrow-up2"></span>');
                    
                    return false;
                });
                
                // If initially folded, hide legend and show button
                if (initialState === 0) {
                    $("#map-legend").hide();
                    $("#map-legend-external-fold-button").hide();
                    legendButton.css("display", "flex").show();
                }
                
                // Attach click handler to fold button
                $("#map-legend-external-fold-button").off('click').on('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    var button = $("#map-legend-external-fold-button");
                    var contentWrapper = $("#map-legend-body > div");
                    var currentState = parseInt(ixmaps.legendState) || 1;
                    
                    // Determine new state: toggle between 0 (folded) and 1 (unfolded)
                    var newState = (currentState === 0) ? 1 : 0;
                    
                    // Update state first (persists in memory for redraws)
                    ixmaps.legendState = newState;
                    
                    // Simple show/hide - no complex manipulation, no re-rendering
                    if (newState === 0) {
                        // Folded: hide legend, show Legend button
                        $("#map-legend").hide();
                        button.hide();
                        var legendButton = $("#map-legend-external-legend-button");
                        if (!legendButton.length) {
                            // Button doesn't exist, create it now
                            legendButton = $('<button id="map-legend-external-legend-button" class="legend-toggle-button" style="position:absolute;top:13px;left:90px;z-index:10000;">Legend</button>');
                            var mapContainer = $("#map-legend").parent();
                            if (mapContainer.length) {
                                mapContainer.append(legendButton);
                            } else if ($("#ixmap").length) {
                                $("#ixmap").append(legendButton);
                            } else {
                                $("body").append(legendButton);
                            }
                            legendButton.on('click', function(e) {
                                e.preventDefault();
                                e.stopPropagation();
                                // Simple unfold: redraw legend content and show the legend
                                ixmaps.legendState = 1;
                                __redrawLegendContent();
                                $("#map-legend").show();
                                $("#map-legend-external-legend-button").hide();
                                $("#map-legend-external-fold-button").show().html('<span class="icon icon-arrow-up2"></span>');
                                return false;
                            });
                        }
                        legendButton.css({
                            "display": "flex",
                            "position": "absolute",
                            "top": "13px",
                            "left": "90px",
                            "z-index": "10000"
                        }).show();
                    } else {
                        // Unfolded: simple show (no manipulation, no re-rendering, preserves position/margin)
                        $("#map-legend").show();
                        $("#map-legend-external-legend-button").hide();
                        button.show();
                        button.html('<span class="icon icon-arrow-up2"></span>');
                    }
                    
                    return false;
                });
                
                // Re-attach click handlers using event delegation for dynamically inserted content
                // This ensures clicks work even if inline handlers don't execute
                setTimeout(function() {
                    // Use event delegation on the legend body to handle clicks
                    // Remove any existing handlers first, then attach new ones
                    $("#map-legend-body").off('click', '.layerlist-item-clickable');
                    $("#map-legend-body").on('click', '.layerlist-item-clickable', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        var themeId = $(this).attr('data-theme-id');
                        if (themeId && typeof ixmaps !== 'undefined' && ixmaps.toggleTheme) {
                            var item = this;
                            var scrollContainer = document.querySelector("#map-legend-body") || document.querySelector("#map-legend-body > div");
                            var savedScroll = scrollContainer ? (scrollContainer.scrollTop || 0) : 0;
                            try {
                                ixmaps.toggleTheme(themeId);
                                if ($(item).hasClass("layerlist-item-hidden")) {
                                    $(item).removeClass("layerlist-item-hidden");
                                } else {
                                    $(item).addClass("layerlist-item-hidden");
                                }
                                setTimeout(function() {
                                    var newScrollContainer = document.querySelector("#map-legend-body") || document.querySelector("#map-legend-body > div");
                                    if (newScrollContainer && savedScroll > 0) {
                                        newScrollContainer.scrollTop = savedScroll;
                                    }
                                }, 50);
                            } catch(err) {
                                console.warn('Error toggling theme:', err);
                            }
                        }
                        return false;
                    });
                    
                    // Also ensure cursor pointer is set
                    $("#map-legend-body .layerlist-item-clickable").css("cursor", "pointer");
                }, 100);
            };
            
            // Wait a short delay to ensure themes are fully loaded with color data before rendering
            setTimeout(generateAndSet, 200);
        } else {
            // No mustache templates
            var isTextOnly = !szLegend || !/<[a-zA-Z]/.test(szLegend.trim());
            if (isTextOnly && szLegend) {
                // Plain text only: use same background div as theme legend and show text as h1
                var textEscaped = String(szLegend)
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;");
                var szHtml = "<div id='map-legend-pane' class='map-legend-pane'>" +
                    "<div id='map-legend-content'>" +
                    "<div id='map-legend-body' class='map-legend-body'>" +
                    "<h1 id='map-legend-title' style='pointer-events:all;margin:0.3em 0;padding:0.2em 0.5em;font-size:1em;line-height:1.2;font-weight:normal;'>" + textEscaped + "</h1>" +
                    "</div></div></div>";
                $("#map-legend").html(szHtml);
                $("#map-legend").css("pointer-events", "none");
                $("#map-legend-body").css("pointer-events", "none");
                $("#map-legend-delete").css("pointer-events", "all");
                $("#map-legend").show();
            } else {
                // Contains HTML - set as-is
                var szHtml = '<div id="map-legend-body" class="map-legend-body" style="margin-top:-1em">'+szLegend+'</div>';
                $("#map-legend").html(szHtml);
                $("#map-legend").css("pointer-events","none");
                $("#map-legend-body").css("pointer-events","none");
                $("#map-legend-delete").css("pointer-events","all");
                $("#map-legend").show();
            }
        }

    };
   ixmaps.legend.removeExternalLegend = function (szUrl) {
        var szHtml = '<div id="map-legend-body" class="map-legend-body" style="margin-top:-1em"></div>';
        szHtml += '<div id="map-legend-delete" style="position:absolute;top:0.4em;right:-1em;border:solid 1px;padding:1.1em 0.8em 0.9em 0.8em;border-radius:2em">';
        szHtml += '<b><a href="javascript:ixmaps.legend.loadExternalLegend(\'' + szUrl + '\')" style="text-decoration:none"><span class="icon icon-menu theme-tool-button" ></span></a></b></div>';
        $("#map-legend").html(szHtml);
        ixmaps.legend.url = null;
        ixmaps.legend.externalLegend = false;
        var idA = ixmaps.getThemes();
        ixmaps.htmlgui_onDrawTheme(idA[idA.length - 1].szId);
    };

    // ============================================
    // event handler
    // ============================================

    var old_onNewTheme = ixmaps.htmlgui_onNewTheme;

    /**
     * Get the featureupper scale denominator from a theme (zoom-dependent visibility).
     * @param {Object} themeObj - Theme object
     * @returns {number|null} Scale denominator (e.g. 200000 for "1:200000") or null
     */
    var __getFeatureUpperScale = function (themeObj) {
        if (!themeObj) return null;
        if (typeof themeObj.nFeatureUpper === 'number') return themeObj.nFeatureUpper;
        if (themeObj.szFeatureUpper) {
            var m = String(themeObj.szFeatureUpper).match(/1\s*:\s*(\d+)/i);
            return m ? parseInt(m[1], 10) : null;
        }
        try {
            var def = themeObj.def && themeObj.def();
            var style = def && def.style;
            var fu = style && style.featureupper;
            if (fu) {
                if (typeof fu === 'number') return fu;
                var m2 = String(fu).match(/1\s*:\s*(\d+)/i);
                return m2 ? parseInt(m2[1], 10) : null;
            }
        } catch (e) {}
        return null;
    };

    ixmaps.htmlgui_onNewTheme = function (szId) {

        try {
            old_onNewTheme(szId);
        } catch (e) {}

        var themeObj = ixmaps.getThemeObj(szId);
        if (!themeObj) {
            return;
        }

        if (themeObj.szFlag.match(/SUBTHEME/) || themeObj.szFlag.match(/NOLEGEND/) || themeObj.szFlag.match(/NOINFO/)) {
            return;
        }
        ixmaps.legend.externalLegend = false;
        if ( typeof(themeObj.nChartUpper) === 'undefined'){
            var splashHtml = themeObj.szSplash || "loading ...";
            var featureUpperScale = __getFeatureUpperScale(themeObj);
            if (featureUpperScale) {
                var themes = ixmaps.getThemes ? ixmaps.getThemes() : [];
                if (themes.length <= 1 && themeObj.fVisible !== true) {
                    splashHtml = "Layer not visible at this zoom level. Zoom in to 1:" + featureUpperScale.toLocaleString() + " or closer.";
                }
            }
            $("#map-legend").html("<h3 id='map-legend-title' class='loading-text' style='font-size:20px;line-height:1.3em;margin-top:1px;padding:0.5em 1em;border:solid #444 0px;border-radius:5px'>" + splashHtml + "</h3>");
        }
        $("#map-legend").show();
    };

    // --------------------------------------------------
    // intercept theme creation, to make the theme legend
    // --------------------------------------------------

    var old_onDrawTheme = ixmaps.htmlgui_onDrawTheme;
	var __noSlideRefresh = false;
	var __sliderRange = null;

	ixmaps.setSliderRange = function(range){
		$("#rangeBtnHour").removeClass("active");
		$("#rangeBtnDay").removeClass("active");
		$("#rangeBtnWeek").removeClass("active");
		$("#rangeBtnMonth").removeClass("active");
		$("#rangeBtnYear").removeClass("active");
		if (range == "hour"){
			__sliderRange = 1000*60*60;
			$("#rangeBtnHour").addClass("active");
		}else
		if (range == "day"){
			__sliderRange = 1000*60*60*24;
			$("#rangeBtnDay").addClass("active");
		}else
		if (range == "week"){
			__sliderRange = 1000*60*60*24*7;
			$("#rangeBtnWeek").addClass("active");
		}else
		if (range == "month"){
			__sliderRange = 1000*60*60*24*28;
			$("#rangeBtnMonth").addClass("active");
		}else
		if (range == "year"){
			__sliderRange = 1000*60*60*24*356;
			$("#rangeBtnYear").addClass("active");
		}
	};

    ixmaps.htmlgui_onDrawTheme = function (szId) { 

        try {
            old_onDrawTheme(szId);
        } catch (e) {}

        // GR 18.12.2018
        //ixmaps.htmlgui_setMapTypeBG(ixmaps.getMapTypeId());
		
        // Check if .legend() is defined - if so, use layer list legend (with mustache support)
        // Otherwise, use normal theme legend
        var useLayerListLegend = !!(ixmaps.legend && ixmaps.legend.url && ixmaps.legend.url.length);
        
        // Handle external legend loading (with mustache support)
        if (useLayerListLegend) {
            // If .legend() is defined, check if it contains mustache templates
            var hasMustacheTemplate = false;
            if (ixmaps.legend.url && ( (ixmaps.legend.url.substr(0,4) == "http") || (ixmaps.legend.url.substr(0,6) == "../../") ) ) {
                // For URL-based legends, we'll check in the load callback
                if ( !ixmaps.legend.externalLegend) {
                    ixmaps.legend.loadExternalLegend(ixmaps.legend.url);
                    ixmaps.legend.externalLegend = true;
                }
                return;
            } else if (ixmaps.legend.url && ixmaps.legend.url.length) {
                // For HTML string legends, check for mustache templates
                hasMustacheTemplate = (ixmaps.legend.url.indexOf('{{themes}}') !== -1 || ixmaps.legend.url.indexOf('{{layers}}') !== -1);
                if ( !ixmaps.legend.externalLegend) {
                    // Process mustache templates and set external legend
                    ixmaps.legend.setExternalLegend(ixmaps.legend.url);
                    ixmaps.legend.externalLegend = true;
                }
                // Always return - external legend handles the display (with or without mustache templates)
                return;
            }
        } else {
            // No .legend() defined - handle external legend normally (for backward compatibility)
            if (ixmaps.legend.url && ( (ixmaps.legend.url.substr(0,4) == "http") || (ixmaps.legend.url.substr(0,6) == "../../") ) ) {
                if ( !ixmaps.legend.externalLegend) {
                    ixmaps.legend.loadExternalLegend(ixmaps.legend.url);
                    ixmaps.legend.externalLegend = true;
                }
                return;
            }else
            if (ixmaps.legend.url && ixmaps.legend.url.length ) {
                if ( !ixmaps.legend.externalLegend) {
                    ixmaps.legend.setExternalLegend(ixmaps.legend.url);
                    ixmaps.legend.externalLegend = true;
                }
                return;
            }
        }
        
        // Check if we should show legends for all themes
        if (1 || ixmaps.showAllThemesLegend) {
            // If slider is being dragged, don't regenerate legend - just update time span based on slider value
            if (__noSlideRefresh) {
                var allThemes = ixmaps.getThemes();
                for (var i = 0; i < allThemes.length; i++) {
                    var theme = allThemes[i];
                    var themeObj = ixmaps.getThemeObj(theme.szId);
                    if (!themeObj) continue;
                    
                    // Update CLIP slider time span
                    if (themeObj.szFlag && themeObj.szFlag.match(/\bCLIP\b/)) {
                        var clipSliderId = "clipRange_" + theme.szId.replace(/[^a-zA-Z0-9]/g, '_');
                        var slider = document.getElementById(clipSliderId);
                        if (slider) {
                            // Don't update slider.value - user is dragging it
                            // Update time span based on slider's current value (not themeObj.nActualFrame which might be stale)
                            var currentSliderValue = parseInt(slider.value, 10);
                            var szFrameText = themeObj.szXaxisA && themeObj.szXaxisA[currentSliderValue];
                            if (szFrameText !== undefined && szFrameText !== null) {
                                // Use attribute selector to handle dots in theme ID
                                $("span[id='time-span-"+theme.szId+"']").html(szFrameText);
                                // Also update generic time-span for backward compatibility
                                $("#time-span").html(szFrameText);
                            }
                        }
                    }
                    
                    // Update time slider time span
                    if (themeObj.szTimeField) {
                        var timeSliderId = "timeRange_" + theme.szId.replace(/[^a-zA-Z0-9]/g, '_');
                        var timeSlider = document.getElementById(timeSliderId);
                        if (timeSlider) {
                            // Don't update slider.value - user is dragging it
                            // Update time span based on slider's current value
                            var uMin = parseFloat(timeSlider.min);
                            var uMax = parseFloat(timeSlider.max);
                            var x = new Date(Number(timeSlider.value)) || timeSlider.value;
                            var uDay = 1000*60*60*24;
                            var range = uDay;
                            var days = (uMax-uMin)/uDay;
                            if (uMax < uDay){
                                range = 0;
                            }else
                            if (days > 120){
                                range = 1000*60*60*24*28;
                            }else
                            if (days < 7){
                                range = 1000*60*60;
                            }
                            range = __sliderRange||range;
                            var timeSpanText = "";
                            if (timeSlider.value == uMin ){
                                timeSpanText = "";
                            }else
                            if (range == 0){
                                timeSpanText = String(timeSlider.value);
                            }else
                            if (range < uDay){
                                timeSpanText = x.toLocaleDateString()+"-"+x.toLocaleTimeString();
                            }else{
                                timeSpanText = x.toLocaleDateString()+" - "+new Date(Number(timeSlider.value)+Number(range)).toLocaleDateString();
                            }
                            if (timeSpanText !== undefined) {
                                $("span[id='time-span-"+theme.szId+"-time']").html(timeSpanText);
                                $("#time-span").html(timeSpanText);
                            }
                        }
                    }
                }
                return;
            }
            
            // Show legends for all themes (excluding those with NOLEGEND flag)
            var allThemes = ixmaps.getThemes();
            var szHtml = "";

            // Single layer, zoom-dependent and not visible: show "zoom in..." in legend (this path runs when showAllThemesLegend is used)
            if (allThemes && allThemes.length === 1) {
                var singleThemeObj = ixmaps.getThemeObj(allThemes[0].szId);
                if (singleThemeObj) {
                    var singleFeatureUpper = __getFeatureUpperScale(singleThemeObj);
                    if (singleFeatureUpper && (singleThemeObj.fVisible !== true || singleThemeObj.nDoneCount == 0)) {
                        if (!(singleThemeObj.fVisible === true && singleThemeObj.nDoneCount == 0)) {
                            var singleZoomMsg = "Layer not visible at this zoom level. Zoom in to 1:" + singleFeatureUpper.toLocaleString() + " or closer.";
                            $("#map-legend").html("<h3 id='map-legend-title' class='loading-text' style='font-size:20px;line-height:1.3em;margin-top:1px;padding:0.5em 1em;border:solid #444 0px;border-radius:5px'>" + singleZoomMsg + "</h3>");
                            $("#map-legend").show();
                            return;
                        }
                    }
                }
            }

            // Save current scroll position before updating (for layerlist legend type)
            var scrollContainer = $("#map-legend-body > div")[0];
            var savedScrollPosition = 0;
            if (scrollContainer) {
                savedScrollPosition = scrollContainer.scrollTop;
                // Store scroll position for layerlist legend type
                if (useLayerListLegend) {
                    ixmaps.legend.scrollPositions = ixmaps.legend.scrollPositions || {};
                    ixmaps.legend.scrollPositions["layerlist"] = savedScrollPosition;
                } else if (szId) {
                    ixmaps.legend.scrollPositions[szId] = savedScrollPosition;
                }
            }
            
            // Clear legend to prevent accumulation
            $("#map-legend").html("");
            
            // If .legend() is defined, show layer list legend (simple list of all themes)
            // Otherwise, use normal theme legend
            if (useLayerListLegend) {
                // Group themes by type
                var featureThemes = [];
                var choroplethThemes = [];
                var chartThemes = [];
                
                for (var i = 0; i < allThemes.length; i++) {
                    var theme = allThemes[i];
                    var themeObj = ixmaps.getThemeObj(theme.szId);
                    if (!themeObj) continue;
                    
                    // Skip themes with NOLEGEND flag only (SILENT themes should still appear in legend)
                    if (themeObj.szFlag && themeObj.szFlag.match(/NOLEGEND/)) {
                        continue;
                    }
                    
                    var themeName = themeObj.szLegendName || themeObj.szName || themeObj.szTitle || theme.szId;
                    
                    // Determine theme type from flags
                    var themeType = "FEATURE"; // default
                    if (themeObj.szFlag) {
                        if (themeObj.szFlag.match(/CHOROPLETH/)) {
                            themeType = "CHOROPLETH";
                        } else if (themeObj.szFlag.match(/CHART|BUBBLE|DOT/)) {
                            themeType = "CHART";
                        } else if (themeObj.szFlag.match(/FEATURE/)) {
                            themeType = "FEATURE";
                        }
                    }
                    
                    // Check theme visibility - themes are hidden if fHide is true, shown if fShow is true
                    var isVisible = true;
                    if (themeObj) {
                        // fHide takes precedence - if fHide is true, theme is hidden
                        if (typeof themeObj.fHide !== 'undefined' && themeObj.fHide === true) {
                            isVisible = false;
                        } else if (typeof themeObj.fShow !== 'undefined') {
                            // If fShow is explicitly set, use it
                            isVisible = themeObj.fShow;
                        } else if (typeof themeObj.fVisible !== 'undefined') {
                            isVisible = themeObj.fVisible;
                        }
                    }
                    
                    // Create a layer-like object for the theme
                    var themeLayer = {
                       	szType: themeType === "CHART" ? "point" : "polygon",
                       	szName: themeName,
                       	szLegendName: themeName,
                       	themeType: themeType,
                       	themeObj: themeObj,
                       	szId: theme.szId, // Store theme ID for toggle functionality
                       	fVisible: isVisible // Store visibility state
                    };
                    
                    // Get color from theme
                    if (themeObj.categoryA) {
                        for (var c in themeObj.categoryA) {
                            if (themeObj.categoryA[c].fill && themeObj.categoryA[c].fill !== "none") {
                                themeLayer.categoryA = {};
                                themeLayer.categoryA[c] = { fill: themeObj.categoryA[c].fill };
                                break;
                            }
                       	}
                    }
                    // If no fill color, try stroke color
                    if (!themeLayer.categoryA && themeObj.categoryA) {
                        for (var c in themeObj.categoryA) {
                            if (themeObj.categoryA[c].stroke) {
                                themeLayer.categoryA = {};
                                themeLayer.categoryA[c] = { fill: themeObj.categoryA[c].stroke };
                                break;
                            }
                       	}
                    }
                    
                    // Group by theme type
                    if (themeType === "FEATURE") {
                        featureThemes.push({layer: themeLayer, name: themeName});
                    } else if (themeType === "CHOROPLETH") {
                        choroplethThemes.push({layer: themeLayer, name: themeName});
                    } else if (themeType === "CHART") {
                        chartThemes.push({layer: themeLayer, name: themeName});
                    }
                }
                
                // Build simple list HTML
                if (featureThemes.length > 0 || choroplethThemes.length > 0 || chartThemes.length > 0) {
                    var szStyle = (ixmaps.legendAlign=="center")?"pointer-events:all;width:fit-content;margin:auto":"pointer-events:none";
                    szHtml += "<div id='map-legend-body' class='map-legend-body' style='"+szStyle+"'>";
                    
                    if ( $("#map-legend").attr("data-align") == "left" ) {
                        szHtml += "<div style='max-height:"+window.innerHeight+"px;overflow:hidden;margin-right:24px;padding-right:1em;pointer-events:none'>";
                    } else {
                        szHtml += "<div style='max-height:300px;overflow:auto;margin:1em 24px 0 0;padding-right:1em;pointer-events:all'>";
                    }
                    
                    if (featureThemes.length > 0) {
                        szHtml += "<div class='layerlist-group'>";
                        for (var i = 0; i < featureThemes.length; i++) {
                            szHtml += __makeLayerlistItem(featureThemes[i].layer, featureThemes[i].name);
                        }
                        szHtml += "</div>";
                    }
                    
                    if (choroplethThemes.length > 0) {
                        szHtml += "<div class='layerlist-group'>";
                        for (var i = 0; i < choroplethThemes.length; i++) {
                            szHtml += __makeLayerlistItem(choroplethThemes[i].layer, choroplethThemes[i].name);
                        }
                        szHtml += "</div>";
                    }
                    
                    if (chartThemes.length > 0) {
                        szHtml += "<div class='layerlist-group'>";
                        for (var i = 0; i < chartThemes.length; i++) {
                            szHtml += __makeLayerlistItem(chartThemes[i].layer, chartThemes[i].name);
                        }
                        szHtml += "</div>";
                    }
                    
                    // Opacity slider for choropleth / Chart size slider for chart (at legend bottom)
                    var firstChoropleth = choroplethThemes.length > 0 ? choroplethThemes[0] : null;
                    var firstChart = chartThemes.length > 0 ? chartThemes[0] : null;
                    if (firstChoropleth) {
                        var cThemeObj = firstChoropleth.layer.themeObj;
                        var cThemeId = firstChoropleth.layer.szId;
                        var fillOpacityVal = 90;
                        try {
                            var cDef = cThemeObj.def && cThemeObj.def();
                            if (cDef && cDef.style && cDef.style.fillopacity != null) { fillOpacityVal = Math.max(0, Math.min(100, Math.round(parseFloat(String(cDef.style.fillopacity)) * 100))); }
                        } catch (e) {}
                        if (cThemeObj.fillOpacity != null) { fillOpacityVal = Math.max(0, Math.min(100, Math.round(parseFloat(cThemeObj.fillOpacity) * 100))); }
                        szHtml += "<div class='legend-bottom-slider' style='margin-top:0.6em;margin-bottom:0.4em;pointer-events:all'>";
                        szHtml += "<label style='font-size:0.85em;color:#555;display:block;margin-bottom:0.35em'>Opacity: <span id='legend-opacity-value'>" + fillOpacityVal + "</span>%</label>";
                        szHtml += "<input type='range' min='0' max='100' value='" + fillOpacityVal + "' class='slider' id='legendOpacitySlider' data-theme-id='" + cThemeId.replace(/'/g, "&#39;") + "' style='width:50%;margin-top:0.4em'>";
                        szHtml += "</div>";
                    }
                    if (firstChart) {
                        var sThemeObj = firstChart.layer.themeObj;
                        var sThemeId = firstChart.layer.szId;
                        var scaleVal = 100;
                        try {
                            var sDef = sThemeObj.def && sThemeObj.def();
                            if (sDef && sDef.style && sDef.style.scale != null) { scaleVal = Math.max(25, Math.min(200, Math.round(parseFloat(String(sDef.style.scale)) * 100))); }
                        } catch (e) {}
                        if (sThemeObj.nScale != null) { scaleVal = Math.max(25, Math.min(200, Math.round(parseFloat(sThemeObj.nScale) * 100))); }
                        szHtml += "<div class='legend-bottom-slider' style='margin-top:0.6em;margin-bottom:0.4em;pointer-events:all'>";
                        szHtml += "<label style='font-size:0.85em;color:#555;display:block;margin-bottom:0.35em'>Chart size: <span id='legend-scale-value'>" + scaleVal + "</span>%</label>";
                        szHtml += "<input type='range' min='25' max='200' value='" + scaleVal + "' class='slider' id='legendScaleSlider' data-theme-id='" + sThemeId.replace(/'/g, "&#39;") + "' style='width:50%;margin-top:0.4em'>";
                        szHtml += "</div>";
                    }
                    
                    szHtml += "</div>";
                    szHtml += "</div>";
                }
            } else {
                // Normal detailed theme legend
                for (var i = 0; i < allThemes.length; i++) {
                    var theme = allThemes[i];
                    var themeObj = ixmaps.getThemeObj(theme.szId);
                if (!themeObj) {
                    continue;
                }
                
                // Skip themes with NOLEGEND flag
                if (themeObj.szFlag && themeObj.szFlag.match(/NOLEGEND/)) {
                    continue;
                }
                
                // Skip themes with FEATURE flag but not CHOROPLETH flag
                if (themeObj.szFlag && themeObj.szFlag.match(/FEATURE/) && !themeObj.szFlag.match(/CHOROPLETH/)) {
                    continue;
                }
                
                // Skip themes that are not done loading
                if (!themeObj.fDone || themeObj.fOutOfScale) {
                    continue;
                }
 
                if (szHtml.length > 0) {
                    szHtml += "<hr style='margin-top:1.6em;margin-bottom:-0.5em'>";
                }
                
                // Add theme title
                szHtml += "<h3 style='pointer-events:all;margin-top:0.5em'>" + (themeObj.szTitle || "Color Legend") + "</h3>";
                
                // Add theme snippet if available
                if (themeObj.szSnippet) {
                    szHtml += "<h4 style='pointer-events:none;margin-bottom:0.5em'>" + themeObj.szSnippet + "</h4>";
                }
                
                // Add legend body
                var szStyle = (ixmaps.legendAlign=="center")?"pointer-events:all;width:fit-content;margin:auto":"pointer-events:none";
                szHtml += "<div id='map-legend-body' class='map-legend-body' style='"+szStyle+"'>";
                
                if ( $("#map-legend").attr("data-align") == "left" ){
                    szHtml += "<div style='max-height:"+window.innerHeight+"px;overflow:hidden;margin-right:24px;padding-right:1em;pointer-events:none'>";
                }else{
                    szHtml += "<div style='max-height:300px;overflow:auto;margin:1em 24px 0 0;padding-right:1em;pointer-events:all'>";
                }
                
                // Add color legend if not TEXTLEGEND
                if (!themeObj.szFlag || !themeObj.szFlag.match(/\bTEXTLEGEND\b/)) {
                    szHtml += ixmaps.legend.makeColorLegendHTML(theme.szId, "generic", "compact");
                }
                
                szHtml += "</div>";
                szHtml += "</div>";
                
                // Add description if available
                if (themeObj.szDescription) {
                    szHtml += "<div style='height:0em;'></div>";
                    szHtml += "<div style='pointer-events:all;margin-bottom:1em'>" + themeObj.szDescription + "</div>";
                } else {
                    szHtml += "<div style='height:0.4em'></div>";
                }
                
                // if theme is CLIP, make clip frame slider 
                // ---------------------------------------------------------------
                if (themeObj.szFlag && themeObj.szFlag.match(/\bCLIP\b/)){
                    var clipFrames = themeObj.nClipFrames;
                    var actualFrame = themeObj.nActualFrame;
                    var szFrameText = themeObj.szXaxisA && themeObj.szXaxisA[themeObj.nActualFrame];
                    var clipSliderId = "clipRange_" + theme.szId.replace(/[^a-zA-Z0-9]/g, '_');
                    szHtml += "<h3 style='margin-top:0.8em;margin-bottom:0.2em'><span id='time-span-"+theme.szId+"'>"+szFrameText+"</span></h3>";
                    szHtml += "<div style='margin-left:-0.2em;margin-bottom:0.9em;pointer-events:all'>";
                    if(themeObj.fClipPause){
                        szHtml += "<a id='clipbutton-"+theme.szId+"' href='javascript:ixmaps.legend.toggleClipState(\""+theme.szId+"\",true);' title='start clip'>";
                        szHtml += "<i id='clipbuttonicon-"+theme.szId+"' class='fa fa-play fa-fw' style='color:#666666;'></i>";
                        szHtml += "</a>";
                    }else{
                        szHtml += "<a id='clipbutton-"+theme.szId+"' href='javascript:ixmaps.legend.toggleClipState(\""+theme.szId+"\",false);' title='pause clip'>";
                        szHtml += "<i id='clipbuttonicon-"+theme.szId+"' class='fa fa-pause fa-fw' style='color:#666666;vertical-align:-10%'></i>";
                        szHtml += "</a>";
                    }
                    szHtml += "<input type='range' min='"+0+"' max='"+(clipFrames-1)+"' value='"+actualFrame+"' class='slider' id='"+clipSliderId+"' data-theme-id='"+theme.szId+"' style='margin-left:2em;width:50%;margin-top:-1em;margin-bottom:0.5em'>";
                    szHtml += "</div>";
                }
                
                // if time field is defined, make time slider 
                // ---------------------------------------------------------------
                if (themeObj.szTimeField) {
                    var timeSliderId = "timeRange_" + theme.szId.replace(/[^a-zA-Z0-9]/g, '_');
                    var uMin = 10000000000000;
                    var uMax = -100000000000000;
                    szHtml += "<h4 style='margin-top:0.5em;margin-bottom:0.5em'>"+themeObj.szTimeField+": <span id='time-span-"+theme.szId+"-time'></span></h4>";
                    if ( themeObj.szTimeField == "$item$" ){
                        uMin = new Date(themeObj.szFieldsA[0]).getTime();
                        uMax = new Date(themeObj.szFieldsA[themeObj.szFieldsA.length-1]).getTime();
                        __sliderRange = uMax-uMin;
                    }else{
                        for ( var a in themeObj.itemA ){
                            var uTime = new Date(themeObj.itemA[a].szTime).getTime() || 0;
                            uMax = Math.max(uMax,uTime||uMax);
                            uMin = Math.min(uMin,uTime||uMin);
                        }
                    }
                    szHtml += "<input type='range' min='"+uMin+"' max='"+uMax+"' value='0' class='slider' id='"+timeSliderId+"' data-theme-id='"+theme.szId+"' style='width:100%;margin-bottom:0.5em'>";
                    
                    var uDay = 1000*60*60*24;
                    var days = (uMax-uMin)/uDay;
                    // Count how many range options are available
                    var rangeOptionsCount = 0;
                    if ( days > 1 ) rangeOptionsCount++; // day
                    if ( days < 2 ) rangeOptionsCount++; // hour
                    if ( days > 13 ) rangeOptionsCount++; // week
                    if ( days > 55 ) rangeOptionsCount++; // month
                    if ( days > 365 ) rangeOptionsCount++; // year
                    
                    // Only show range selection buttons if there are multiple options
                    if ( rangeOptionsCount > 1 ){
                        szHtml += "<div class='btn-group btn-group-toggle' data-toggle='buttons' style='margin-left:-0.6em;margin-top:0.5em'>";
                        if ( days > 1 ){
                            szHtml += "  <label id='rangeBtnDay-"+theme.szId+"' class='btn btn-secondary active' onclick='javascript:ixmaps.setSliderRange(\"day\",\""+theme.szId+"\");'>";
                            szHtml += "	<input type='radio' name='options-"+theme.szId+"' id='option1-"+theme.szId+"'> day";
                            szHtml += "  </label>";
                        }
                        if ( days < 2 ){
                            szHtml += "  <label id='rangeBtnHour-"+theme.szId+"' class='btn btn-secondary' onclick='javascript:ixmaps.setSliderRange(\"hour\",\""+theme.szId+"\");'>";
                            szHtml += "	<input type='radio' name='options-"+theme.szId+"' id='option1-hour-"+theme.szId+"'> hour";
                            szHtml += "  </label>";
                        }
                        if ( days > 13 ){
                            szHtml += "  <label id='rangeBtnWeek-"+theme.szId+"' class='btn btn-secondary' onclick='javascript:ixmaps.setSliderRange(\"week\",\""+theme.szId+"\");'>";
                            szHtml += "	<input type='radio' name='options-"+theme.szId+"' id='option2-"+theme.szId+"'> week";
                            szHtml += "  </label>";
                        }
                        if ( days > 55 ){
                            szHtml += "  <label id='rangeBtnMonth-"+theme.szId+"' class='btn btn-secondary' onclick='javascript:ixmaps.setSliderRange(\"month\",\""+theme.szId+"\");'>";
                            szHtml += "	<input type='radio' name='options-"+theme.szId+"' id='option3-"+theme.szId+"'> month";
                            szHtml += "  </label>";
                        }
                        if ( days > 365 ){
                            szHtml += "  <label id='rangeBtnYear-"+theme.szId+"' class='btn btn-secondary' onclick='javascript:ixmaps.setSliderRange(\"year\",\""+theme.szId+"\");'>";
                            szHtml += "	<input type='radio' name='options-"+theme.szId+"' id='option4-"+theme.szId+"'> year";
                            szHtml += "  </label>";
                        }
                        szHtml += "</div>";
                    }
                }
                
                // Opacity slider (choropleth) or Chart size slider (chart) per theme
                var isChoroplethTheme = themeObj.szFlag && themeObj.szFlag.match(/\bCHOROPLETH\b/);
                var isChartTheme = themeObj.szFlag && themeObj.szFlag.match(/\bCHART\b|\bBUBBLE\b|\bDOT\b/);
                if (isChoroplethTheme) {
                    var fillOpacityValT = 90;
                    try {
                        var defT = themeObj.def && themeObj.def();
                        if (defT && defT.style && defT.style.fillopacity != null) { fillOpacityValT = Math.max(0, Math.min(100, Math.round(parseFloat(String(defT.style.fillopacity)) * 100))); }
                    } catch (e) {}
                    if (themeObj.fillOpacity != null) { fillOpacityValT = Math.max(0, Math.min(100, Math.round(parseFloat(themeObj.fillOpacity) * 100))); }
                    var opacitySliderId = "legendOpacitySlider_" + theme.szId.replace(/[^a-zA-Z0-9]/g, '_');
                    var opacityValueId = "legend-opacity-value-" + theme.szId.replace(/[^a-zA-Z0-9]/g, '_');
                    szHtml += "<div class='legend-bottom-slider' style='margin-top:0.6em;margin-bottom:0.4em;pointer-events:all'>";
                    szHtml += "<label style='font-size:0.85em;color:#555;display:block;margin-bottom:0.35em'>Opacity: <span id='"+opacityValueId+"'>" + fillOpacityValT + "</span>%</label>";
                    szHtml += "<input type='range' min='0' max='100' value='"+fillOpacityValT+"' class='slider' id='"+opacitySliderId+"' data-theme-id='"+theme.szId.replace(/'/g, "&#39;")+"' style='width:50%;margin-top:0.4em'>";
                    szHtml += "</div>";
                }
                if (isChartTheme) {
                    var scaleValT = 100;
                    try {
                        var defS = themeObj.def && themeObj.def();
                        if (defS && defS.style && defS.style.scale != null) { scaleValT = Math.max(25, Math.min(200, Math.round(parseFloat(String(defS.style.scale)) * 100))); }
                    } catch (e) {}
                    if (themeObj.nScale != null) { scaleValT = Math.max(25, Math.min(200, Math.round(parseFloat(themeObj.nScale) * 100))); }
                    var scaleSliderId = "legendScaleSlider_" + theme.szId.replace(/[^a-zA-Z0-9]/g, '_');
                    var scaleValueId = "legend-scale-value-" + theme.szId.replace(/[^a-zA-Z0-9]/g, '_');
                    szHtml += "<div class='legend-bottom-slider' style='margin-top:0.6em;margin-bottom:0.4em;pointer-events:all'>";
                    szHtml += "<label style='font-size:0.85em;color:#555;display:block;margin-bottom:0.35em'>Chart size: <span id='"+scaleValueId+"'>" + scaleValT + "</span>%</label>";
                    szHtml += "<input type='range' min='25' max='200' value='"+scaleValT+"' class='slider' id='"+scaleSliderId+"' data-theme-id='"+theme.szId.replace(/'/g, "&#39;")+"' style='width:50%;margin-top:0.4em'>";
                    szHtml += "</div>";
                }
            }
            }

            // Add the complete HTML to the legend
            // Extract title from szHtml if it exists to show separately when folded
            // Try multiple regex patterns to match the title
            var titleMatch = szHtml.match(/<h3[^>]*id=['"]map-legend-title['"][^>]*>([\s\S]*?)<\/h3>/);
            if (!titleMatch) {
                // Try without id requirement
                titleMatch = szHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
            }
            var titleText = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : "";
            var titleHtml = titleText ? "<h3 id='map-legend-title-folded' style='pointer-events:all;margin:0.3em 0;padding:0.2em 0.5em;font-size:1em;line-height:1.2;'>" + titleText + "</h3>" : "";
            
            // Also try to get title from themeObj if regex didn't work
            if (!titleText) {
                // Find the first theme in the list to get its title
                for (var i = 0; i < allThemes.length; i++) {
                    var theme = allThemes[i];
                    var themeObj = ixmaps.getThemeObj(theme.szId);
                    if (themeObj && themeObj.szTitle) {
                        titleText = themeObj.szTitle;
                        titleHtml = "<h3 id='map-legend-title-folded' style='pointer-events:all;margin:0.3em 0;padding:0.2em 0.5em;font-size:1em;line-height:1.2;'>" + titleText + "</h3>";
                        break;
                    }
                }
            }
            
            var szLegendPane = "";
            szLegendPane += "<div id='map-legend-pane' class='map-legend-pane'>" +
                "<a href='javascript:__toggleLegendPane()' title='unfold/fold the legend'>" +
                "<div id='legend-type-switch' style='border:none' >" +
                "<button id='legend-closed-button' class='legend-toggle-button' style='display:none;'>Legend</button>" +
                "<span id='legend-open-icon' style='font-size:28px;'>&#8942;</span>" +
                "</div>" +
                "</a>" +
                "<div id='map-legend-content'>" + szHtml + "</div>";
            
            szLegendPane += "<a href='javascript:__toggleLegendPane(0);'>" +
                "<div id='legend-type-switch-bottom' style='display:none'>" +
                "<i id='map-legend-pane-switch' class='icon shareIcon blackHover icon-arrow-down2' title='close' style='color:#888;pointer-events:none;' tabindex='-1'></i>" +
                "</div>" +
                "</a>";

            if ( $("#map-legend").attr("data-align") == "left" ){
                $("#map-legend").append(szHtml);
                $("#map-legend").css("pointer-events","none");
            }else
            if ( $("#map-legend").attr("data-align") == "right" ){
                $("#map-legend").append(szHtml);
                $("#map-legend").css("pointer-events","none");
            }else{
                $("#map-legend").html(szLegendPane);
            }
            
            // Restore scroll position after updating
            requestAnimationFrame(function() {
                var scrollContainer = $("#map-legend-body > div")[0];
                if (scrollContainer) {
                    var scrollPos = 0;
                    // For layerlist legend type, use the stored position
                    if (ixmaps.legendType === "layerlist" && ixmaps.legend.scrollPositions && typeof ixmaps.legend.scrollPositions["layerlist"] !== 'undefined') {
                        scrollPos = ixmaps.legend.scrollPositions["layerlist"];
                    } else if (szId && ixmaps.legend.scrollPositions && typeof ixmaps.legend.scrollPositions[szId] !== 'undefined') {
                        scrollPos = ixmaps.legend.scrollPositions[szId];
                    }
                    if (scrollPos > 0) {
                        scrollContainer.scrollTop = scrollPos;
                    }
                }
            });
            
            // Initialize CLIP sliders and time sliders for all themes
            setTimeout(function() {
                for (var j = 0; j < allThemes.length; j++) {
                    var themeForInit = allThemes[j];
                    var themeObjForInit = ixmaps.getThemeObj(themeForInit.szId);
                    if (!themeObjForInit) continue;
                    
                    // Initialize CLIP slider
                    if (themeObjForInit.szFlag && themeObjForInit.szFlag.match(/\bCLIP\b/)) {
                        var clipSliderId = "clipRange_" + themeForInit.szId.replace(/[^a-zA-Z0-9]/g, '_');
                        var slider = document.getElementById(clipSliderId);
                        if (slider) {
                            var currentThemeId = themeForInit.szId;
                            var currentThemeObj = themeObjForInit;
                            slider.oninput = function() {
                                __noSlideRefresh = true;
                                var themeId = this.getAttribute('data-theme-id');
                                var themeObj = ixmaps.getThemeObj(themeId);
                                if (themeObj) {
                                    var frameValue = parseInt(this.value, 10);
                                    // Update time span immediately before any other operations
                                    var szFrameText = themeObj.szXaxisA && themeObj.szXaxisA[frameValue];
                                    if (szFrameText !== undefined && szFrameText !== null) {
                                        // Use attribute selector to handle dots in theme ID
                                        $("span[id='time-span-"+themeId+"']").html(szFrameText);
                                        // Also update generic time-span for backward compatibility
                                        $("#time-span").html(szFrameText);
                                    }
                                    // Pause clip and set frame
                                    ixmaps.legend.toggleClipState(themeId, false);
                                    ixmaps.setThemeClipFrame(themeId, frameValue);
                                }
                            };
                            slider.onmouseup = function(){
                                __noSlideRefresh = false;
                            };
                            slider.onchange = function(){
                                console.log(this.value);
                            };
                        }
                    }
                    
                    // Initialize time slider
                    if (themeObjForInit.szTimeField) {
                        var timeSliderId = "timeRange_" + themeForInit.szId.replace(/[^a-zA-Z0-9]/g, '_');
                        var timeSlider = document.getElementById(timeSliderId);
                        if (timeSlider) {
                            timeSlider.oninput = function() {
                                __noSlideRefresh = true;
                                var currentThemeId = this.getAttribute('data-theme-id');
                                var currentThemeObj = ixmaps.getThemeObj(currentThemeId);
                                if (!currentThemeObj) return;
                                
                                // Get min/max from slider attributes or recalculate
                                var uMin = parseFloat(this.min);
                                var uMax = parseFloat(this.max);
                                var x = new Date(Number(this.value)) || this.value;
                                
                                if (this.value == uMin ){
                                    ixmaps.setThemeTimeFrame(currentThemeId, uMin, uMax);
                                    $("span[id='time-span-"+currentThemeId+"-time']").html("");
                                    $("#time-span").html("");
                                }else{
                                    var uDay = 1000*60*60*24;
                                    var range = uDay;
                                    var days = (uMax-uMin)/uDay;
                                    // values are not uTime values, but simple numeric sequenze
                                    if (uMax < uDay){
                                        range = 0;
                                    }else
                                    if (days > 120){
                                        range = 1000*60*60*24*28;
                                    }else
                                    if (days < 7){
                                        range = 1000*60*60;
                                    }
                                    range = __sliderRange||range;
                                    if ( currentThemeObj.szTimeField == "$item$" ){
                                        ixmaps.setThemeTimeFrame(currentThemeId, Number(this.value)-Number(range), this.value);
                                    }else{
                                        ixmaps.setThemeTimeFrame(currentThemeId, this.value, Number(this.value)+Number(range));
                                    }
                                    if (range == 0){
                                        $("span[id='time-span-"+currentThemeId+"-time']").html(String(this.value));
                                        $("#time-span").html(String(this.value));
                                    }else
                                    if (range < uDay){
                                        $("span[id='time-span-"+currentThemeId+"-time']").html(x.toLocaleDateString()+"-"+x.toLocaleTimeString());
                                        $("#time-span").html(x.toLocaleDateString()+"-"+x.toLocaleTimeString());
                                    }else{
                                        $("span[id='time-span-"+currentThemeId+"-time']").html(x.toLocaleDateString()+" - "+new Date(Number(this.value)+Number(range)).toLocaleDateString());
                                        $("#time-span").html(x.toLocaleDateString()+" - "+new Date(Number(this.value)+Number(range)).toLocaleDateString());
                                    }
                                }
                            };
                            timeSlider.onmouseup = function(){
                                __noSlideRefresh = false;
                            };
                        }
                    }
                    
                    // Init per-theme opacity slider (theme legends)
                    if (themeObjForInit.szFlag && themeObjForInit.szFlag.match(/\bCHOROPLETH\b/)) {
                        var opacitySliderIdTh = "legendOpacitySlider_" + themeForInit.szId.replace(/[^a-zA-Z0-9]/g, '_');
                        var opacityValueIdTh = "legend-opacity-value-" + themeForInit.szId.replace(/[^a-zA-Z0-9]/g, '_');
                        var opacitySliderTh = document.getElementById(opacitySliderIdTh);
                        if (opacitySliderTh) {
                            var themeIdOpacity = themeForInit.szId;
                            opacitySliderTh.oninput = function() {
                                __noSlideRefresh = true;
                                var tid = this.getAttribute("data-theme-id");
                                if (!tid) return;
                                var pct = parseInt(this.value, 10);
                                $("#" + opacityValueIdTh).text(pct);
                                var mapApi = ixmaps.api && ixmaps.api();
                                if (mapApi && mapApi.changeThemeStyle) {
                                    mapApi.changeThemeStyle(tid, "fillopacity:" + (pct / 100), "set");
                                    if (mapApi.redrawTheme) { mapApi.redrawTheme(tid); }
                                }
                            };
                            opacitySliderTh.onmouseup = opacitySliderTh.onpointerup = function() { __noSlideRefresh = false; };
                            opacitySliderTh.onmouseleave = opacitySliderTh.onpointerleave = function() { __noSlideRefresh = false; };
                        }
                    }
                    // Init per-theme chart size slider (theme legends)
                    if (themeObjForInit.szFlag && themeObjForInit.szFlag.match(/\bCHART\b|\bBUBBLE\b|\bDOT\b/)) {
                        var scaleSliderIdTh = "legendScaleSlider_" + themeForInit.szId.replace(/[^a-zA-Z0-9]/g, '_');
                        var scaleValueIdTh = "legend-scale-value-" + themeForInit.szId.replace(/[^a-zA-Z0-9]/g, '_');
                        var scaleSliderTh = document.getElementById(scaleSliderIdTh);
                        if (scaleSliderTh) {
                            var themeIdScale = themeForInit.szId;
                            scaleSliderTh.oninput = function() {
                                __noSlideRefresh = true;
                                var tid = this.getAttribute("data-theme-id");
                                if (!tid) return;
                                var pct = parseInt(this.value, 10);
                                $("#" + scaleValueIdTh).text(pct);
                                var mapApi = ixmaps.api && ixmaps.api();
                                if (mapApi && mapApi.changeThemeStyle) {
                                    mapApi.changeThemeStyle(tid, "scale:" + (pct / 100), "set");
                                }
                            };
                            scaleSliderTh.onmouseup = scaleSliderTh.onpointerup = function() { __noSlideRefresh = false; };
                            scaleSliderTh.onmouseleave = scaleSliderTh.onpointerleave = function() { __noSlideRefresh = false; };
                        }
                    }
                }
                
                // Init opacity slider (layer list legend)
                var opacitySlider = document.getElementById("legendOpacitySlider");
                if (opacitySlider) {
                    opacitySlider.oninput = function() {
                        __noSlideRefresh = true;
                        var themeId = this.getAttribute("data-theme-id");
                        if (!themeId) return;
                        var pct = parseInt(this.value, 10);
                        $("#legend-opacity-value").text(pct);
                        var mapApi = ixmaps.api && ixmaps.api();
                        if (mapApi && mapApi.changeThemeStyle) {
                            mapApi.changeThemeStyle(themeId, "fillopacity:" + (pct / 100), "set");
                            if (mapApi.redrawTheme) { mapApi.redrawTheme(themeId); }
                        }
                    };
                    opacitySlider.onmouseup = opacitySlider.onpointerup = function() { __noSlideRefresh = false; };
                    opacitySlider.onmouseleave = opacitySlider.onpointerleave = function() { __noSlideRefresh = false; };
                }
                // Init chart size slider (layer list legend)
                var scaleSlider = document.getElementById("legendScaleSlider");
                if (scaleSlider) {
                    scaleSlider.oninput = function() {
                        __noSlideRefresh = true;
                        var themeId = this.getAttribute("data-theme-id");
                        if (!themeId) return;
                        var pct = parseInt(this.value, 10);
                        $("#legend-scale-value").text(pct);
                        var mapApi = ixmaps.api && ixmaps.api();
                        if (mapApi && mapApi.changeThemeStyle) {
                            mapApi.changeThemeStyle(themeId, "scale:" + (pct / 100), "set");
                        }
                    };
                    scaleSlider.onmouseup = scaleSlider.onpointerup = function() { __noSlideRefresh = false; };
                    scaleSlider.onmouseleave = scaleSlider.onpointerleave = function() { __noSlideRefresh = false; };
                }
            }, 100);
            
            // Define toggleClipState function - support both new (themeId, state) and old (state only) signatures
            ixmaps.legend.toggleClipState = function(themeIdOrState, stateOrUndefined){
                // Handle both signatures: (themeId, state) or (state) for backward compatibility
                var themeId, state;
                if (stateOrUndefined === undefined) {
                    // Old signature: (state) - find the active CLIP theme
                    state = themeIdOrState;
                    var allThemes = ixmaps.getThemes();
                    for (var i = 0; i < allThemes.length; i++) {
                        var theme = allThemes[i];
                        var themeObj = ixmaps.getThemeObj(theme.szId);
                        if (themeObj && themeObj.szFlag && themeObj.szFlag.match(/\bCLIP\b/)) {
                            themeId = theme.szId;
                            break;
                        }
                    }
                    if (!themeId) return;
                } else {
                    // New signature: (themeId, state)
                    themeId = themeIdOrState;
                    state = stateOrUndefined;
                }
                
                var themeObj = ixmaps.getThemeObj(themeId);
                if (!themeObj) return;
                
                if (state){
                    if ( themeObj.nActualFrame >= themeObj.nClipFrames-1 ){
                        ixmaps.setThemeClipFrame(themeId,0);
                    }
                    ixmaps.startThemeClip(themeId);
                    // Update theme-specific IDs (new format) - use attribute selector for dots in IDs
                    $("a[id='clipbutton-"+themeId+"']").attr("href","javascript:ixmaps.legend.toggleClipState(\""+themeId+"\",false);");
                    $("i[id='clipbuttonicon-"+themeId+"']").removeClass("fa-play").addClass("fa-pause");
                    // Also update generic IDs (old format) for backward compatibility
                    var genericButton = $("#clipbutton");
                    var genericIcon = $("#clipbuttonicon");
                    if (genericButton.length) {
                        genericButton.attr("href","javascript:ixmaps.legend.toggleClipState(false);");
                    }
                    if (genericIcon.length) {
                        genericIcon.removeClass("fa-play").addClass("fa-pause");
                    }
                }else{
                    ixmaps.pauseThemeClip(themeId);
                    // Update theme-specific IDs (new format) - use attribute selector for dots in IDs
                    $("a[id='clipbutton-"+themeId+"']").attr("href","javascript:ixmaps.legend.toggleClipState(\""+themeId+"\",true);");
                    $("i[id='clipbuttonicon-"+themeId+"']").removeClass("fa-pause").addClass("fa-play");
                    // Also update generic IDs (old format) for backward compatibility
                    var genericButton = $("#clipbutton");
                    var genericIcon = $("#clipbuttonicon");
                    if (genericButton.length) {
                        genericButton.attr("href","javascript:ixmaps.legend.toggleClipState(true);");
                    }
                    if (genericIcon.length) {
                        genericIcon.removeClass("fa-pause").addClass("fa-play");
                    }
                }
            };
            
            // Check if there's actual content to display before showing legend
            // Remove empty divs and whitespace-only content to check for real content
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = szHtml;
            var textContent = tempDiv.textContent || tempDiv.innerText || '';
            var hasContent = textContent.trim().length > 0 || 
                            szHtml.match(/<[^>]+style[^>]*background[^>]*>/) || // Has colored elements
                            szHtml.match(/<input[^>]*type=['"]range['"]/) || // Has sliders
                            szHtml.match(/<button/) || // Has buttons
                            szHtml.match(/<h[1-6][^>]*>.*?<\/h[1-6]>/); // Has headings with content
            
            __actualThemeId = szId;
            
            // Only show legend if there's actual content
            if (hasContent) {
                // Preserve existing legendState if set (for redraw persistence)
                // Only set to unfolded (1) if it's truly undefined
                if (typeof ixmaps.legendState === 'undefined') {
                    ixmaps.legendState = 1; // Default to unfolded only if not set
                }
                // If legendState is 0 (folded), preserve it - don't reset to unfolded
                __switchLegendPanes();
            } else {
                // Hide legend if no content
                $("#map-legend").hide();
            }
            // Set legend type based on whether .legend() is defined
            if (useLayerListLegend) {
                ixmaps.legendType = "layerlist";
            } else {
                ixmaps.legendType = "theme";
            }
            return;
        }

        var themeObj = ixmaps.getThemeObj(szId);
        if (!themeObj) {
            return;
        }

		var szThemeA = ixmaps.getThemes();
		var featureUpperScale = __getFeatureUpperScale(themeObj);
		var singleLayer = !szThemeA || szThemeA.length <= 1;
		// Single layer, zoom-dependent: show "zoom in..." when not visible OR still loading (same as past behavior)
		if (featureUpperScale && singleLayer && (themeObj.fVisible !== true || themeObj.nDoneCount == 0)) {
			// Only skip if we know the layer is visible and still loading (don't show full legend yet)
			if (themeObj.fVisible === true && themeObj.nDoneCount == 0) {
				return;
			}
			var zoomMsg = "Layer not visible at this zoom level. Zoom in to 1:" + featureUpperScale.toLocaleString() + " or closer.";
			$("#map-legend").html("<h3 id='map-legend-title' class='loading-text' style='font-size:20px;line-height:1.3em;margin-top:1px;padding:0.5em 1em;border:solid #444 0px;border-radius:5px'>" + zoomMsg + "</h3>");
			$("#map-legend").show();
			return;
		}
		if (themeObj.nDoneCount == 0){
			if ( szThemeA && szThemeA.length > 1 ){
				return;
			}
			if (featureUpperScale && themeObj.fVisible === true) {
				return;
			}
		}
		
        if (themeObj.szFlag.match(/SUBTHEME/) || themeObj.szFlag.match(/NOLEGEND/) || themeObj.szFlag.match(/NOINFO/)) {
            return;
        }

		// if CLIP theme, don't actualize legend on every frame
		// BUT only if the slider already exists - otherwise we need to create it first
		//
		if(themeObj.szFlag.match(/\bCLIP\b/) && themeObj.nActualFrame){
			var clipSliderId = "clipRange_" + szId.replace(/[^a-zA-Z0-9]/g, '_');
			var clipSlider = document.getElementById(clipSliderId);
			// Only do early return if slider already exists in DOM
			if (clipSlider) {
				var actualFrame = themeObj.nActualFrame;
				var szFrameText = themeObj.szXaxisA && themeObj.szXaxisA[themeObj.nActualFrame];
				if (szFrameText) {
					// Use attribute selector to handle dots in theme ID
					$("span[id='time-span-"+szId+"']").html(szFrameText);
					// Also update generic time-span for backward compatibility
					$("#time-span").html(szFrameText);
				}
				clipSlider.value = actualFrame;
				if ( (themeObj.nActualFrame >= (themeObj.nClipFrames-1)) && !themeObj.szFlag.match(/\bLOOP\b/)){
					ixmaps.legend.toggleClipState(szId, false);
				}
				return;
			}
			// If slider doesn't exist, continue to create it
		}

		// Save current scroll position before updating
		var scrollContainer = $("#map-legend-body > div")[0];
		if (scrollContainer && szId) {
			ixmaps.legend.scrollPositions[szId] = scrollContainer.scrollTop;
		}
		
		// Clear legend to prevent accumulation
		$("#map-legend").html("");
		
        // in case szId is not giveb, set it from themeObj
        szId = szId || themeObj.szId;

        var szHtml = "";
        var szTitleHtml = "";
		
		if (!ixmaps.legend.externalLegend){			
			// Extract title to show separately when folded
			var titleText = themeObj.szTitle || "Color Legend";
			szTitleHtml += "<h3 id='map-legend-title' style='pointer-events:all'>" + titleText;
			// theme filter
			if (themeObj.szFilter) {
				//szTitleHtml += "<p class='legend-filter-text' style='font-size:11px'>&nbsp;"+themeObj.szFilter+"</p>";
			}
			szTitleHtml += "</h3>";
			// Also include title in content for when unfolded
			szHtml += szTitleHtml;

			szHtml += "<h4 id='map-legend-snippet' style='pointer-events:none'>" + (themeObj.szSnippet || "") + "</h4>";
		}
		
		var szStyle = (ixmaps.legendAlign=="center")?"pointer-events:all;width:fit-content;margin:auto":"pointer-events:none";
        szHtml += "<div id='map-legend-body' class='map-legend-body' style='"+szStyle+"'>";
		
 		if ( $("#map-legend").attr("data-align") == "left" ){
        	szHtml += "<div style='max-height:"+window.innerHeight+"px;overflow:hidden;margin-right:24px;padding-right:1em;pointer-events:none'>";
		}else{
        	szHtml += "<div style='max-height:300px;overflow:auto;margin:0.5em 24px 0 0;padding-right:1em;pointer-events:all'>";
		}	
        
        var colorLegendHtml = "";
        if (!themeObj.szFlag.match(/\bTEXTLEGEND\b/)) {
            colorLegendHtml = ixmaps.legend.makeColorLegendHTML(szId, "generic", "compact");
            szHtml += colorLegendHtml;
        }
    
        szHtml += "</div>";
        //szHtml += "<br>";

        //szHtml += ixmaps.legend.makeLegendButtons(szId,"generic");
        //szHtml += "<br>";


        szHtml += "</div>";

        if (themeObj.szDescription) {
           szHtml += "<div style='height:0em;'></div>";
           szHtml += "<div id='map-legend-description' style='pointer-events:all'>" + (themeObj.szDescription || "") + "</div>";
        } else {
            szHtml += "<div style='height:0.4em'></div>";
        }

		// ---------------------------------------------------------------
		// make slider 
		// ---------------------------------------------------------------
		
		// if time field is defined, make time slider 
		// ---------------------------------------------------------------
		var uMin = 10000000000000;
		var uMax = -100000000000000;
		if (themeObj.szTimeField  ){
			szHtml += "<h4 style='margin-top:0.5em;margin-bottom:0.5em'>"+themeObj.szTimeField+": <span id='time-span'></span></h4>";
			if ( themeObj.szTimeField == "$item$" ){
				uMin = new Date(themeObj.szFieldsA[0]).getTime();
				uMax = new Date(themeObj.szFieldsA[themeObj.szFieldsA.length-1]).getTime();
				__sliderRange = uMax-uMin;
			}else
			for ( a in themeObj.itemA ){
				var uTime = new Date(themeObj.itemA[a].szTime).getTime() || 0;
				uMax = Math.max(uMax,uTime||uMax);
				uMin = Math.min(uMin,uTime||uMin);
			}
	  		szHtml += "<input type='range' min='"+uMin+"' max='"+uMax+"' value='0' class='slider' id='myRange'>";

			var uDay = 1000*60*60*24;
			var days = (uMax-uMin)/uDay;
			// Count how many range options are available
			var rangeOptionsCount = 0;
			if ( days > 1 ) rangeOptionsCount++; // day
			if ( days < 2 ) rangeOptionsCount++; // hour
			if ( days > 13 ) rangeOptionsCount++; // week
			if ( days > 55 ) rangeOptionsCount++; // month
			if ( days > 365 ) rangeOptionsCount++; // year
			
			// Only show range selection buttons if there are multiple options
			if ( rangeOptionsCount > 1 ){
				szHtml += "<div class='btn-group btn-group-toggle' data-toggle='buttons' style='margin-left:-0.6em;margin-top:0.5em'>";
				if ( days > 1 ){
					szHtml += "  <label id='rangeBtnDay' class='btn btn-secondary active' onclick='javascript:ixmaps.setSliderRange(\"day\");'>";
					szHtml += "	<input type='radio' name='options' id='option1'> day";
					szHtml += "  </label>";
				}
				if ( days < 2 ){
					szHtml += "  <label id='rangeBtnHour' class='btn btn-secondary' onclick='javascript:ixmaps.setSliderRange(\"hour\");'>";
					szHtml += "	<input type='radio' name='options' id='option1'> hour";
					szHtml += "  </label>";
				}
				if ( days > 13 ){
					szHtml += "  <label id='rangeBtnWeek' class='btn btn-secondary' onclick='javascript:ixmaps.setSliderRange(\"week\");'>";
					szHtml += "	<input type='radio' name='options' id='option2'> week";
					szHtml += "  </label>";
					setTimeout(() => {ixmaps.setSliderRange(week);},1000);
				}
				if ( days > 55 ){
					szHtml += "  <label id='rangeBtnMonth' class='btn btn-secondary' onclick='javascript:ixmaps.setSliderRange(\"month\");'>";
					szHtml += "	<input type='radio' name='options' id='option3'> month";
					szHtml += "  </label>";
					setTimeout(() => {ixmaps.setSliderRange(month);},1000);
				}
				if ( days > 365 ){
					szHtml += "  <label id='rangeBtnYear' class='btn btn-secondary' onclick='javascript:ixmaps.setSliderRange(\"year\");'>";
					szHtml += "	<input type='radio' name='options' id='option4' > year";
					szHtml += "  </label>";
					setTimeout(() => {ixmaps.setSliderRange("year");},1000);
				}
				szHtml += "</div>";
			}
		}
		
 		// if theme is CLIP, make clip frame slider 
		// ---------------------------------------------------------------
		if (themeObj.szFlag && themeObj.szFlag.match(/\bCLIP\b/)){
			var clipFrames = themeObj.nClipFrames;
			var actualFrame = themeObj.nActualFrame;
			var szFrameText = themeObj.szXaxisA && themeObj.szXaxisA[themeObj.nActualFrame];
			szHtml += "<h3 style='margin-top:0.8em;margin-bottom:0.2em'><span id='time-span'>"+szFrameText+"</span></h3>";
			szHtml += "<div style='margin-left:-0.2em;margin-bottom:0.9em;pointer-events:all'>";
			if(themeObj.fClipPause){
				szHtml += "<a id='clipbutton' href='javascript:ixmaps.legend.toggleClipState(true);' title='start clip'>";
				szHtml += "<i id='clipbuttonicon' class='fa fa-play fa-fw' style='color:#666666;'></i>";
				szHtml += "</a>";
			}else{
				szHtml += "<a id='clipbutton' href='javascript:ixmaps.legend.toggleClipState(false);' title='pause clip'>";
				szHtml += "<i id='clipbuttonicon' class='fa fa-pause fa-fw' style='color:#666666;vertical-align:-10%'></i>";
				szHtml += "</a>";
			}
			szHtml += "<input type='range' min='"+0+"' max='"+(clipFrames-1)+"' value='"+actualFrame+"' class='slider' id='clipRange' style='margin-left:2em;width:50%;margin-top:-1em;margin-bottom:0.5em'>";
			szHtml += "</div>";
			
			// The unified toggleClipState function is already defined in the "show all themes" path
			// It supports both old (state only) and new (themeId, state) signatures
			// and updates both theme-specific and generic IDs
		}
		
		// ---------------------------------------------------------------
		// opacity (choropleth) or chart size slider at legend bottom
		// ---------------------------------------------------------------
		var isChoropleth = themeObj.szFlag && themeObj.szFlag.match(/\bCHOROPLETH\b/);
		var isChart = themeObj.szFlag && themeObj.szFlag.match(/\bCHART\b|\bBUBBLE\b|\bDOT\b/);
		var fillOpacityVal = 90;
		var scaleVal = 100;
		try {
			var def = themeObj.def && themeObj.def();
			if (def && def.style) {
				var fo = def.style.fillopacity;
				if (fo !== undefined && fo !== null) { fillOpacityVal = Math.round(parseFloat(String(fo)) * 100) || 90; fillOpacityVal = Math.max(0, Math.min(100, fillOpacityVal)); }
				var sc = def.style.scale;
				if (sc !== undefined && sc !== null) { scaleVal = Math.round(parseFloat(String(sc)) * 100) || 100; scaleVal = Math.max(25, Math.min(200, scaleVal)); }
			}
		} catch (e) {}
		// fallback: read from theme object (SVG map uses fillOpacity, nScale)
		if (themeObj.fillOpacity !== undefined && themeObj.fillOpacity !== null) { fillOpacityVal = Math.round(parseFloat(themeObj.fillOpacity) * 100) || 90; fillOpacityVal = Math.max(0, Math.min(100, fillOpacityVal)); }
		if (themeObj.nScale !== undefined && themeObj.nScale !== null) { scaleVal = Math.round(parseFloat(themeObj.nScale) * 100) || 100; scaleVal = Math.max(25, Math.min(200, scaleVal)); }
		if (isChoropleth) {
			szHtml += "<div class='legend-bottom-slider' style='margin-top:0.6em;margin-bottom:0.4em;pointer-events:all'>";
			szHtml += "<label style='font-size:0.85em;color:#555;display:block;margin-bottom:0.35em'>Opacity: <span id='legend-opacity-value'>" + fillOpacityVal + "</span>%</label>";
			szHtml += "<input type='range' min='0' max='100' value='" + fillOpacityVal + "' class='slider' id='legendOpacitySlider' style='width:50%;margin-top:0.4em'>";
			szHtml += "</div>";
		} else if (isChart) {
			szHtml += "<div class='legend-bottom-slider' style='margin-top:0.6em;margin-bottom:0.4em;pointer-events:all'>";
			szHtml += "<label style='font-size:0.85em;color:#555;display:block;margin-bottom:0.35em'>Chart size: <span id='legend-scale-value'>" + scaleVal + "</span>%</label>";
			szHtml += "<input type='range' min='25' max='200' value='" + scaleVal + "' class='slider' id='legendScaleSlider' style='width:50%;margin-top:0.4em'>";
			szHtml += "</div>";
		}
		
		// ---------------------------------------------------------------
		// ---------------------------------------------------------------
		
		szHtml += "<div id='map-legend-footer' >";
        szHtml += ixmaps.htmlgui_onLegendFooter ? ixmaps.htmlgui_onLegendFooter(szId, themeObj, ixmaps.getThemeDefinitionObj(szId)) : "";
		szHtml += "</div>";
		
		szLegendPane = "";
		
		// Extract title from szHtml if it exists to show separately when folded
		// Try multiple regex patterns to match the title
		var titleMatch = szHtml.match(/<h3[^>]*id=['"]map-legend-title['"][^>]*>([\s\S]*?)<\/h3>/);
		if (!titleMatch) {
			// Try without id requirement
			titleMatch = szHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
		}
		var titleText = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : "";
		var titleHtml = titleText ? "<h3 id='map-legend-title-folded' style='pointer-events:all;margin:0.3em 0;padding:0.2em 0.5em;font-size:1em;line-height:1.2;'>" + titleText + "</h3>" : "";
		
		// Also try to get title from themeObj if regex didn't work
		if (!titleText && themeObj && themeObj.szTitle) {
			titleText = themeObj.szTitle;
			titleHtml = "<h3 id='map-legend-title-folded' style='pointer-events:all;margin:0.3em 0;padding:0.2em 0.5em;font-size:1em;line-height:1.2;'>" + titleText + "</h3>";
		}

		szLegendPane += "<div id='map-legend-pane' class='map-legend-pane'>" +
            "<a href='javascript:__toggleLegendPane()' title='unfold/fold the legend'>" +
            "<div id='legend-type-switch' style='border:none' >" +
            "<button id='legend-closed-button' style='display:none;font-size:0.9em;font-family:\"Helvetica Condensed\",Frutiger,\"Open Sans\",Roboto,Avenir,sans-serif;color:#666;background:rgba(255,255,255,0.9);border:1px solid rgba(0,0,0,0.2);border-radius:4px;padding:0.3em 0.8em;cursor:pointer;'>Legend</button>" +
            "<span id='legend-open-icon' style='font-size:28px;'>&#8942;</span>" +
            "</div>" +
            "</a>" +
            "<div id='map-legend-content'>" + szHtml + "</div>";
		
        szLegendPane += "<a href='javascript:__toggleLegendPane(0);'>" +
            "<div id='legend-type-switch-bottom' style='display:none'>" +
            "<i id='map-legend-pane-switch' class='icon shareIcon blackHover icon-arrow-down2' title='close' style='color:#888;pointer-events:none;' tabindex='-1'></i>" +
            "</div>" +
            "</a>";

		if ( $("#map-legend").attr("data-align") == "left" ){
        	$("#map-legend").append(szHtml);
			$("#map-legend").css("pointer-events","none");
		}else
		if ( $("#map-legend").attr("data-align") == "right" ){
        	$("#map-legend").append(szHtml);
			$("#map-legend").css("pointer-events","none");
		}else{
       		$("#map-legend").html(szLegendPane);
		}
		// Restore scroll position after updating
		requestAnimationFrame(function() {
			var scrollContainer = $("#map-legend-body > div")[0];
			if (scrollContainer && szId && typeof ixmaps.legend.scrollPositions[szId] !== 'undefined') {
				scrollContainer.scrollTop = ixmaps.legend.scrollPositions[szId];
			}
		});

		// ---------------------------------------------------------------
		// init the slider if created
		// ---------------------------------------------------------------

		// init time frame slider
		// ------------------------
		if (themeObj.szTimeField){
			var slider = document.getElementById("myRange");
			// Update the current slider value (each time you drag the slider handle)
			slider.oninput = function() {
				var x = new Date(Number(this.value)) || this.value;
				if (this.value == uMin ){
					ixmaps.setThemeTimeFrame(null,uMin, uMax);
					$("#time-span").html("");
				}else{
					var uDay = 1000*60*60*24;
					var range = uDay;
					var days = (uMax-uMin)/uDay;
                    // values are not uTime values, but simple numeric sequenze
                    if (uMax < uDay){
                        range = 0;
                    }else
					if (days > 120){
						range = 1000*60*60*24*28;
					}else
					if (days < 7){
						range = 1000*60*60;
					}
					range = __sliderRange||range;
					if ( themeObj.szTimeField == "$item$" ){
						ixmaps.setThemeTimeFrame(null,Number(this.value)-Number(range),this.value);
					}else{
						ixmaps.setThemeTimeFrame(null,this.value,Number(this.value)+Number(range));
					}
					if (range == 0){
						$("#time-span").html(String(this.value));
                    }else
					if (range < uDay){
						$("#time-span").html(x.toLocaleDateString()+"-"+x.toLocaleTimeString());
					}else{
						$("#time-span").html(x.toLocaleDateString()+" - "+new Date(Number(this.value)+Number(range)).toLocaleDateString());
					}
				}
				//clearTimeout(clipTimeout);
				//ixmaps.setClipFrame(Number(this.value));
			};
			slider.onmouseup = function(){
				//ixmaps.setClipFrame(Number(this.value));
			};
			slider.onchange = function(){
				console.log(this.value);
			};
		}
		
		// init clip frame slider
		// ------------------------
		if (themeObj.szFlag.match(/\bCLIP\b/) ){
			var slider = document.getElementById("clipRange");
			if (slider) {
				// Update the current slider value (each time you drag the slider handle)
				slider.oninput = function() {
					__noSlideRefresh = true;
					var frameValue = parseInt(this.value, 10);
					// Update time span immediately
					var szFrameText = themeObj.szXaxisA && themeObj.szXaxisA[frameValue];
					if (szFrameText !== undefined && szFrameText !== null) {
						$("#time-span").html(szFrameText);
						// Also update theme-specific time-span if it exists - use attribute selector for dots
						$("span[id='time-span-"+themeObj.szId+"']").html(szFrameText);
					}
					// Pause and set frame
					ixmaps.legend.toggleClipState(false);
					ixmaps.setThemeClipFrame(themeObj.szId, frameValue);
				};
				slider.onmouseup = function(){
					__noSlideRefresh = false;
					//ixmaps.setClipFrame(Number(this.value));
				};
				slider.onchange = function(){
					console.log(this.value);
				};
			}
		}
		
		// init opacity slider (choropleth)
		// ---------------------------------
		var opacitySlider = document.getElementById("legendOpacitySlider");
		if (opacitySlider) {
			var themeIdForOpacity = szId;
			opacitySlider.oninput = function() {
				__noSlideRefresh = true;
				var pct = parseInt(this.value, 10);
				$("#legend-opacity-value").text(pct);
				var mapApi = ixmaps.api && ixmaps.api();
				if (mapApi && mapApi.changeThemeStyle) {
					mapApi.changeThemeStyle(themeIdForOpacity, "fillopacity:" + (pct / 100), "set");
					if (mapApi.redrawTheme) { mapApi.redrawTheme(themeIdForOpacity); }
				}
			};
			opacitySlider.onmouseup = opacitySlider.onpointerup = function() { __noSlideRefresh = false; };
			opacitySlider.onmouseleave = opacitySlider.onpointerleave = function() { __noSlideRefresh = false; };
		}
		
		// init chart size slider
		// ----------------------
		var scaleSlider = document.getElementById("legendScaleSlider");
		if (scaleSlider) {
			var themeIdForScale = szId;
			scaleSlider.oninput = function() {
				__noSlideRefresh = true;
				var pct = parseInt(this.value, 10);
				$("#legend-scale-value").text(pct);
				var mapApi = ixmaps.api && ixmaps.api();
				if (mapApi && mapApi.changeThemeStyle) {
					mapApi.changeThemeStyle(themeIdForScale, "scale:" + (pct / 100), "set");
				}
			};
			scaleSlider.onmouseup = scaleSlider.onpointerup = function() { __noSlideRefresh = false; };
			scaleSlider.onmouseleave = scaleSlider.onpointerleave = function() { __noSlideRefresh = false; };
		}
		
        __actualThemeId = szId;

        // Check if there's actual content to display before showing legend
        // Check if title exists and is meaningful
        var hasTitle = themeObj.szTitle && themeObj.szTitle.trim().length > 0 && themeObj.szTitle !== "Color Legend";
        
        // Check if color legend has actual content (not just empty divs)
        var hasColorLegend = false;
        if (colorLegendHtml && colorLegendHtml.trim().length > 0) {
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = colorLegendHtml;
            var legendTextContent = tempDiv.textContent || tempDiv.innerText || '';
            // Check if there's meaningful content (more than just whitespace or empty divs)
            if (legendTextContent.trim().length > 0 || 
                colorLegendHtml.match(/<[^>]+style[^>]*background[^>]*>/) ||
                colorLegendHtml.match(/<span[^>]*style[^>]*background/)) {
                hasColorLegend = true;
            }
        }
        
        // Check if there's a description
        var hasDescription = themeObj.szDescription && themeObj.szDescription.trim().length > 0;
        
        // Check if there's a time slider or clip slider
        var hasSlider = themeObj.szTimeField || themeObj.szFlag.match(/\bCLIP\b/);
        
        // Check if footer has content
        var footerHtml = ixmaps.htmlgui_onLegendFooter ? ixmaps.htmlgui_onLegendFooter(szId, themeObj, ixmaps.getThemeDefinitionObj(szId)) : "";
        var hasFooter = footerHtml && footerHtml.trim().length > 0;
        
        // Only show legend if there's actual content
        var hasContent = hasTitle || hasColorLegend || hasDescription || hasSlider || hasFooter;
        
        if (hasContent) {
            __switchLegendPanes();
        } else {
            // Hide legend if no content
            $("#map-legend").hide();
        }
		
		// Don't override layerlist type - keep it as is for testing
		if (ixmaps.legendType !== "layerlist") {
			ixmaps.legendType = "theme";
		}
    };

    // --------------------------------------------------
    // intercept theme deletion, to remove active themes mark
    // --------------------------------------------------

    var old_onRemoveTheme = ixmaps.htmlgui_onRemoveTheme;
    ixmaps.htmlgui_onRemoveTheme = function (szId) {

        try {
            old_onRemoveTheme(szId);
        } catch (e) {}

        if ((!__actualThemeId || (__actualThemeId == szId)) && !ixmaps.legend.externalLegend) {
            $("#map-legend-content").html("");
            $("#map-legend").hide();
        }
    };

    // ============================================
    // show/hide legend 
    // ============================================
	
	ixmaps.legend.show = function(){
		$("#map-legend").show();
		$("#map-legend-switch").hide();
	};
	
	ixmaps.legend.hide = function(){
		$("#map-legend").hide();
		if ( !$("#map-legend-switch")[0] ){
			var szButton = '<button type="button" id="map-legend-switch" title="info/pan" class="toolbutton shadow" style="height:40px;width:40px;" onclick="javascript:ixmaps.legend.show()"><label for="map-legend-switch" style="height:36px;"><i id="clipbuttonicon" class="fa fa-bars fa-fw" style="font-size:2em;font-size:1.3em;padding:0.5em 0;color:#888888;"></i></label></button>';
			/**
			$("#onmapbuttondiv").append("<button type='button' id='map-legend-switch' style='toolbutton shadow'><a href='javascript:ixmaps.legend.show()'><i id='clipbuttonicon' class='fa fa-bars fa-fw' style='font-size:2em;font-size:1.3em;padding:0.5em 0;color:#666666;'></i></a></button>");
			**/
			$("#onmapbuttondivlegend").append(szButton);
			$("#onmapbuttondivlegend").show();
		}
		$("#map-legend-switch").show();
	};
	
    // ============================================
    // show/hide legend parts
    // ============================================

    /**
     * display/hide the legend parts
     * @type void
     */

    // define initial/actual legend state (0=title only, 1=colorlegend, 2=footer/tools)
    // Default to unfolded (1) if not already defined
    if (typeof ixmaps.legendState === 'undefined') {
        ixmaps.legendState = 1;
    }

    __actualThemeId = null;

    __switchLegendPanes = function (state) {
        // If state is explicitly provided, use it
        // Otherwise, preserve existing legendState (for redraw persistence)
        if (typeof (state) != 'undefined') {
            ixmaps.legendState = state;
        } else {
            // Preserve existing state - only default to 1 (unfolded) if truly undefined
            // If legendState is 0 (folded), preserve it - don't reset to unfolded
            if (typeof ixmaps.legendState === 'undefined') {
                ixmaps.legendState = 1; // Default to unfolded only if not set
            }
            // If it's already 0 (folded), keep it folded - don't reset
        }

        $("#map-legend-pane-switch").removeClass("icon-arrow-down2");
        $("#map-legend-pane-switch").addClass("icon-arrow-up2");

        if (ixmaps.legendState == 2) {
            $("#map-legend-body").show();
            $("#map-legend-snippet").show();
            $("#map-legend-footer").show();
            $("#map-legend-pane-switch").parent().show();
            $("#legend-closed-button").hide();
            $("#legend-open-icon").show();
            $("#map-legend-content").show();
            // Hide folded title elements when unfolding
            $("#map-legend-title-folded").hide();
            $("#map-legend-title-folded").parent("a").hide();
            $("#map-legend-pane").css({
                "padding": "",
                "background": "",
                "border": "",
                "box-shadow": "",
                "width": "",
                "min-width": "",
                "max-width": ""
            }).removeClass("legend-folded");
            $("#map-legend").removeClass("legend-folded");
        } else
        if (ixmaps.legendState == 1) {
            $("#map-legend-body").show();
            $("#map-legend-snippet").show();
            $("#map-legend-footer").hide();
            $("#map-legend-pane-switch").show();
            $("#legend-closed-button").hide();
            $("#legend-open-icon").show();
            $("#map-legend-content").show();
            // Hide folded title elements when unfolding
            $("#map-legend-title-folded").hide();
            $("#map-legend-title-folded").parent("a").hide();
            $("#map-legend-pane").css({
                "padding": "",
                "background": "",
                "border": "",
                "box-shadow": "",
                "width": "",
                "min-width": "",
                "max-width": ""
            }).removeClass("legend-folded");
            $("#map-legend").removeClass("legend-folded");
        } else {
            // When folded, hide everything except the button and title
            $("#map-legend-body").hide();
            $("#map-legend-snippet").hide();
            $("#map-legend-footer").hide();
            $("#map-legend-pane-switch").parent().hide();
            // Hide content but show title if it exists
            $("#map-legend-content").hide();
            // Show the title if it exists (either in content or folded version), otherwise show the button
            var titleElement = $("#map-legend-title");
            var titleFoldedElement = $("#map-legend-title-folded");
            var hasTitle = false;
            
            // Check for title in various places
            if (titleFoldedElement.length && titleFoldedElement.text().trim().length > 0) {
                hasTitle = true;
            } else if (titleElement.length && titleElement.text().trim().length > 0) {
                hasTitle = true;
            }
            
            if (hasTitle) {
                // Show folded title version if it exists
                if (titleFoldedElement.length) {
                    // Make title clickable to unfold
                    if (!titleFoldedElement.parent().is("a")) {
                        titleFoldedElement.wrap("<a href='javascript:__toggleLegendPane()' style='text-decoration:none;color:inherit;cursor:pointer;'></a>");
                    }
                    titleFoldedElement.show().css({
                        "display": "block !important",
                        "visibility": "visible !important",
                        "margin": "0.3em 0",
                        "padding": "0.2em 0.5em",
                        "font-size": "1em",
                        "line-height": "1.2",
                        "cursor": "pointer"
                    });
                    titleFoldedElement.parent("a").show();
                } else if (titleElement.length) {
                    // Clone title outside content if needed
                    if (titleElement.parent().is("#map-legend-content")) {
                        var titleText = titleElement.text().trim();
                        if (titleText) {
                            var clonedTitle = $("<a href='javascript:__toggleLegendPane()' style='text-decoration:none;color:inherit;cursor:pointer;'><h3 id='map-legend-title-folded' style='pointer-events:all;margin:0.3em 0;padding:0.2em 0.5em;font-size:1em;line-height:1.2;display:block !important;visibility:visible !important;cursor:pointer;'>" + titleText + "</h3></a>");
                            clonedTitle.insertAfter("#legend-type-switch");
                        }
                    } else {
                        // Make title clickable to unfold if not already wrapped
                        if (!titleElement.parent().is("a")) {
                            titleElement.wrap("<a href='javascript:__toggleLegendPane()' style='text-decoration:none;color:inherit;cursor:pointer;'></a>");
                        }
                        titleElement.show();
                        titleElement.parent("a").show();
                    }
                }
                $("#legend-closed-button").hide();
            } else {
                titleElement.hide();
                titleFoldedElement.hide();
                $("#legend-closed-button").show().css({
                    "display": "inline-block",
                    "visibility": "visible"
                });
            }
            $("#legend-open-icon").hide();
            // Collapse the legend pane but keep it visible with title/button
            $("#map-legend-pane").css({
                "padding": "0.3em 0.5em",
                "background": "rgba(255,255,255,0.9)",
                "border": "1px solid rgba(0,0,0,0.1)",
                "box-shadow": "0 2px 4px rgba(0,0,0,0.1)",
                "width": "auto",
                "min-width": "auto",
                "max-width": "none",
                "display": "block",
                "visibility": "visible"
            }).addClass("legend-folded");
            $("#map-legend").addClass("legend-folded").css({
                "display": "block",
                "visibility": "visible"
            });
            // Ensure the legend type switch is visible
            $("#legend-type-switch").show().css({
                "display": "block",
                "visibility": "visible"
            });
        }
		
		// If legend type is "layer" and legend is visible, ensure layer legend is shown
		if ((ixmaps.legendState == 1 || ixmaps.legendState == 2) && 
			ixmaps.legendType === "layer" && 
			ixmaps.loadedMap &&
			ixmaps.makeLayerLegend &&
			!(ixmaps.loadedProject && ixmaps.loadedProject.themes) && 
			!(ixmaps.legend && ixmaps.legend.externalLegend)) {
			setTimeout(function() {
				ixmaps.makeLayerLegend(window.innerHeight * 0.75);
			}, 100);
		}
		
		if (window.innerWidth < 500){
			ixmaps.legend.hide();
		}else{
			$("#map-legend").slideDown();
			ixmaps.legend.show();
		}
   };

    /**
     * open/close the legend parts
     * @type void
     */
    __toggleLegendPane = function (i) {

        if (i == 0) {
            __switchLegendPanes(-1);
        } else
        if (ixmaps.legendState == 2) {
            if (ixmaps.makeLayerLegend()){
				ixmaps.legendType = "layer";
			}else{
				// switch to next theme (if we have more than one)
				__nextLegendTheme();
				ixmaps.htmlgui_onDrawTheme(__actualThemeId);
				__switchLegendPanes();
			}
        } else
            // switch back to theme legend
            if ((i == -1) && __actualThemeId) {
				// switch to next theme (if we have more than one)
				__nextLegendTheme();
                ixmaps.htmlgui_onDrawTheme(__actualThemeId);
                __switchLegendPanes(0);
				ixmaps.legendType = "theme";
            } else {
                i = 0;
            }

        ixmaps.legendState += i || 0;

        if ($("#map-legend-footer").height()) {
            ixmaps.legendState = ++ixmaps.legendState % 3;
        } else {
            ixmaps.legendState = ++ixmaps.legendState % 2;
        }

		__switchLegendPanes();

    };
	
    /**
     * get the next theme to display in Legend
     * @type void
     */
	__nextLegendTheme = function(){
		var szThemeA = ixmaps.getThemes();
		for ( var t = 0; t < szThemeA.length; t++ ){
			if ( szThemeA[t].szId == __actualThemeId ){
				__actualThemeId = szThemeA[(++t)%szThemeA.length].szId;
			}
		}
        var themeObj = ixmaps.getThemeObj(__actualThemeId);
        if (themeObj.szFlag.match(/SUBTHEME/) || themeObj.szFlag.match(/NOLEGEND/) || themeObj.szFlag.match(/NOINFO/)) {
            __nextLegendTheme();
        }
	};

    /**
     * get the first visible theme to display in Legend
     * @type void
     */
	__firstVisibleLegendTheme = function(){
		var szThemeA = ixmaps.getThemes();
		__actualThemeId = szThemeA[0].szId;
		var themeObj = ixmaps.getThemeObj(szThemeA[0].szId);
		for ( var t = 0; t < szThemeA.length; t++ ){
			var test = ixmaps.getThemeObj(szThemeA[t].szId);
			if (test.nDoneCount > 0){
 				__actualThemeId = szThemeA[t].szId;
				themeObj = ixmaps.getThemeObj(__actualThemeId);
				break;
			}
		}
		return themeObj;
	};
	
	
    /**
     * set legend background on map type change
     * @type void
     */
    function changeCss(className, classValue) {
        var cssMainContainer = $('#css-modifier-container');

        if (cssMainContainer.length == 0) {
            var cssMainContainer = $('<style id="css-modifier-container"></style>');
            cssMainContainer.appendTo($('head'));
        }
        cssMainContainer.append(className + " {" + classValue + "}\n");
    }
    var old_setMapTypeBG = ixmaps.htmlgui_setMapTypeBG;
    ixmaps.htmlgui_setMapTypeBG = function (szId) {
		
		if (!szId){
			return;
		}
		
        if (old_setMapTypeBG) {
            old_setMapTypeBG(szId);
        }

        $("#css-modifier-container").remove();
		
		var nBasemapOpacity = $(this.gmapDiv).css("opacity");

        if (nBasemapOpacity > 0.5 && (szId.match(/dark/i) || szId.match(/black/i) || szId.match(/satellite/i))) {

            changeCss(".map-legend-body", "color:#fff");

            changeCss(".map-legend-pane:before", "background:#111");
            changeCss(".map-legend-pane:before", "border-color:#444");
            changeCss(".map-legend-pane", "color:#fff");
            changeCss(".map-legend-count", "color:#ddd");
            changeCss(".map-legend-switch", "color:#888");

            $("#map-legend-pane-switch").attr("style", "color:#888");

            changeCss(".btn-default", "color:#888");
            changeCss(".btn-default", "border-color:#666");
            changeCss(".btn-default", "background-color:#333");

            changeCss(".btn-default.active", "color:#888");
            changeCss(".btn-default.focus", "color:#888");
            changeCss(".btn-default:active", "color:#888");
            changeCss(".btn-default:focus", "color:#888");

            changeCss(".btn-default.active", "background-color:#333");
            changeCss(".btn-default.focus", "background-color:#333");
            changeCss(".btn-default:active", "background-color:#333");
            changeCss(".btn-default:focus", "background-color:#333");

            changeCss(".btn-default.active", "outline:none");
            changeCss(".btn-default.focus", "outline:none");
            changeCss(".btn-default:active", "outline:none");
            changeCss(".btn-default:focus", "outline:none");

            changeCss("tr.theme-legend-item-selected", "background:#444");

            changeCss("#legend-type-switch", "background-color:#111");
            changeCss("#legend-type-switch", "border-color:#444");

            changeCss(".loading-text", "background-color:rgba(0,0,0,0.5)");
            changeCss(".loading-text", "color:#d8d8d8");

        } else 
		if (szId.match(/#/i)) {
            changeCss(".map-legend-pane:before", "background:"+szId);
            changeCss(".map-legend", "background:"+szId);
            changeCss("#map-legend", "background:"+szId);
            changeCss(".loading-text", "background-color:"+szId);
            changeCss(".loading-text", "color:#666");
        } else {
            changeCss(".loading-text", "background-color:rgba(255,255,255,0.5)");
            changeCss(".loading-text", "color:#666");
       }
    };

	ixmaps.legend.showItemList = function(szTheme){
		ixmaps.legend.actualTheme = szTheme;
   		ixmaps.legend.loadExternalLegend("../../ui/html/tools/list.html");
	};
	
	ixmaps.legend.showItemGrid = function(szTheme){
 		ixmaps.legend.actualTheme = szTheme;
       	$("#map-popup").load("../../ui/html/tools/list.html");
        $("#map-popup").show();
		$("#map-popup").css("width",window.innerWidth);
	};

    /**
     * end of namespace
     */

})();

// -----------------------------
// EOF
// -----------------------------
