/**
 * background_theme.js
 * Qualify map background values (basemap id or CSS color) as light or dark
 * for UI theming (controls, legend, dialogs).
 */
(function (ixmaps) {
    if (!ixmaps) {
        return;
    }

    var MAP_TYPE_PATTERN = /dark|light|satellite|street|toner|positron|terrain|osm|mapbox|stamen|arcgis|carto|openstreetmap|maptiler|gray|grey|white|black|transparent|topo|ocean|basic|bright|dataviz|voyager|positron|toner/i;

    /**
     * True when szId looks like a CSS color rather than a basemap name.
     * @param {string} szId
     * @returns {boolean}
     */
    ixmaps.isCssColorValue = function (szId) {
        if (!szId || typeof szId !== "string") {
            return false;
        }
        szId = szId.trim();
        if (/^#([0-9a-f]{3,8})$/i.test(szId)) {
            return true;
        }
        if (/^rgba?\(/i.test(szId) || /^hsla?\(/i.test(szId)) {
            return true;
        }
        if (/^(none|transparent)$/i.test(szId)) {
            return true;
        }
        // simple named color (e.g. "navy", "red") — not a typical basemap id
        if (/^[a-zA-Z]+$/.test(szId) && !MAP_TYPE_PATTERN.test(szId)) {
            return true;
        }
        return false;
    };

    /**
     * Parse a CSS color to {r,g,b,a} in sRGB 0-255, or null.
     * Uses a temporary DOM element so named colors resolve correctly.
     * @param {string} colorStr
     * @returns {{r:number,g:number,b:number,a:number}|null}
     */
    ixmaps.parseCssColor = function (colorStr) {
        if (!colorStr || typeof colorStr !== "string") {
            return null;
        }
        colorStr = colorStr.trim();
        if (/^(none|transparent)$/i.test(colorStr)) {
            return null;
        }
        if (typeof document === "undefined" || !document.body) {
            return null;
        }
        var el = document.createElement("span");
        el.style.display = "none";
        el.style.color = colorStr;
        document.body.appendChild(el);
        var computed = window.getComputedStyle(el).color;
        document.body.removeChild(el);

        var m = computed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
        if (!m) {
            return null;
        }
        return {
            r: parseInt(m[1], 10),
            g: parseInt(m[2], 10),
            b: parseInt(m[3], 10),
            a: m[4] !== undefined ? parseFloat(m[4]) : 1
        };
    };

    /**
     * WCAG relative luminance (0 = black, 1 = white).
     * @param {number} r
     * @param {number} g
     * @param {number} b
     * @returns {number}
     */
    ixmaps.getColorLuminance = function (r, g, b) {
        function linearize(c) {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        }
        return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
    };

    /**
     * True when a CSS color reads as dark on screen.
     * Semi-transparent colors are blended against white first.
     * @param {string} colorStr
     * @param {number} [threshold=0.45]
     * @returns {boolean}
     */
    ixmaps.isDarkColor = function (colorStr, threshold) {
        var c = ixmaps.parseCssColor(colorStr);
        if (!c) {
            return false;
        }
        threshold = threshold !== undefined ? threshold : 0.45;
        if (c.a < 1) {
            c.r = Math.round(c.r * c.a + 255 * (1 - c.a));
            c.g = Math.round(c.g * c.a + 255 * (1 - c.a));
            c.b = Math.round(c.b * c.a + 255 * (1 - c.a));
        }
        return ixmaps.getColorLuminance(c.r, c.g, c.b) < threshold;
    };

    /**
     * True when a map background id or CSS color should use dark UI chrome.
     * @param {string} szId
     * @returns {boolean}
     */
    ixmaps.isDarkMapBackground = function (szId) {
        if (!szId || typeof szId !== "string") {
            return false;
        }
        if (/satellite/i.test(szId)) {
            return true;
        }
        if (/^black$/i.test(szId.trim())) {
            return true;
        }
        if (ixmaps.isCssColorValue(szId)) {
            return ixmaps.isDarkColor(szId);
        }
        if (/dark|black/i.test(szId)) {
            return true;
        }
        return false;
    };

    /**
     * Parse boolean map/embed option values.
     * @param {*} val
     * @returns {boolean}
     */
    ixmaps.parseBoolOption = function (val) {
        if (val === true || val === 1) {
            return true;
        }
        if (val === false || val === 0 || val === null || val === undefined || val === "") {
            return false;
        }
        if (typeof val === "string") {
            return /^(true|1|yes|on)$/i.test(val.trim());
        }
        return !!val;
    };

    /**
     * When true, map UI chrome stays dark regardless of basemap/background.
     * Set via map option forceDarkUi (alias: darkUi).
     */
    ixmaps.forceDarkUi = false;

    /**
     * Enable or disable forced dark UI and optionally refresh styling.
     * @param {*} val
     * @param {boolean} [fRefresh=true]
     * @returns {object} ixmaps
     */
    ixmaps.setForceDarkUi = function (val, fRefresh) {
        ixmaps.forceDarkUi = ixmaps.parseBoolOption(val);
        if (fRefresh !== false) {
            ixmaps.refreshMapUiTheme();
        }
        return ixmaps;
    };

    /**
     * True when UI elements should use dark styling.
     * @param {string} [szId] basemap id or background color
     * @returns {boolean}
     */
    ixmaps.shouldUseDarkUi = function (szId) {
        if (ixmaps.forceDarkUi) {
            return true;
        }
        return ixmaps.isDarkMapBackground(szId);
    };

    /**
     * Re-apply map UI theme for the current basemap/background.
     */
    ixmaps.refreshMapUiTheme = function () {
        if (typeof ixmaps.htmlgui_setMapTypeBG !== "function") {
            return;
        }
        var szId = null;
        if (typeof ixmaps.getMapTypeId === "function") {
            try {
                szId = ixmaps.getMapTypeId();
            } catch (e) { /* ignore */ }
        }
        if (!szId && ixmaps.legendBackground) {
            szId = ixmaps.legendBackground;
        }
        if (!szId && ixmaps.fMapType) {
            szId = ixmaps.fMapType;
        }
        if (szId) {
            ixmaps.htmlgui_setMapTypeBG(szId);
        }
    };

    /**
     * Apply forceDarkUi from map/embed options (supports darkUi alias).
     * @param {object} opt
     */
    ixmaps.applyForceDarkUiOption = function (opt) {
        if (!opt) {
            return;
        }
        if (opt.forceDarkUi !== undefined) {
            ixmaps.setForceDarkUi(opt.forceDarkUi, false);
        } else if (opt.darkUi !== undefined) {
            ixmaps.setForceDarkUi(opt.darkUi, false);
        }
    };

}(window.ixmaps = window.ixmaps || {}));
