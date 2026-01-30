/**
 * @fileoverview This file is part of the iXMaps Composer (DataKrauti)
 *
 * @author Guenter Richter guenter.richter@medienobjekte.de
 * @version 1.0.0
 * @date 2025-01.01
 * @description this code creates a HTML table view of tabular data
 * @license
 * This software is licensed under the MIT License.
 *
 * Copyright (c) 2025 Guenter Richter
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

(() => {
    window.ixmaps = window.ixmaps || {};
    window.ixmaps.data = window.ixmaps.data || {};

    /**
     * Represents an object to hold all data sinks
     *
     * @class DataSinks
     * @constructor
     */
    DataSinks = function () {
        this.dataSinkA = [];
    };
    /**
     * add a data sink to the pool
     * @param {Object} data - The data object containing records and fields
     * @param {string} name - Unique identifier for the table
     * @returns {DataSink} the created DataSink
     */
    DataSinks.prototype.add = function (data, name) {
        this.dataSinkA[name] = new DataSink(data);
        this.dataSinkA[name].name = name;
        return this.dataSinkA[name];
    };

    /**
     * Get a DataSink by name
     * @param {string} name - The name of the DataSink to retrieve
     * @returns {DataSink|null} The DataSink instance or null if not found
     */
    DataSinks.prototype.get = function (name) {
        return this.dataSinkA[name] || null;
    };
    window.dataSinks = new DataSinks();

    /**
     * Represents a data sink, holding the data and related properties.
     *
     * @class DataSink
     * @param {object} data - The data object.
     * @property {object} data - The data object of the sink.
     * @property {string} type - The type of data.
     * @property {array} filterA - The array of actual filters.
     * @property {string} facetsFilter - The filter string.
     * @property {string} sortDir - The sort direction.
     * @property {boolean} fPivot - Whether the data has been pivoted.
     * @property {boolean} fShowAnalytics - Whether to show analytics.
     * @property {boolean} fShowFilter - Whether to show the filter.
     * @property {object} map - The map object.
     * @constructor
     */
    DataSink = function (data) {
        this.data = data;
        this.type = null;

        this.filterA = null;
        this.facetsFilter = null;

        this.sortDir = null;

        this.fPivot = null;
        this.fShowAnalytics = null;
        this.fShowFilter = true;
        this.fShowCards = null;
        this.fShowMapRoles = null;

        this.map = null;
        this.themeId = null; // Store theme ID for direct theme lookup

        // Store the name for this DataSink instance
        this.name = null;
    };

    /**
     * Creates a data table with sorting, filtering, analytics, and pivot capabilities
     * @param {Object} data - The data object containing records and fields
     * @param {string} name - Unique identifier for the table
     * @param {number} height - Table height
     * @returns {string} HTML string of the generated table
     */
    DataSink.prototype.makeDataTable = function (height) {

        let data = this.data;
        let name = this.name;
        this.height = height;

        if (this.fShowCards) {
            return this.makeDataCards(height);
        }

        // Constants
        const MAX_RECORDS = 100;
        const MAX_TEXT_LENGTH = 20;
        const SCROLL_ID = `input-table-table-${name}`;
        const TABLE_ID = `input-table-table-${name}-table`;
        const INFO_ID = `input-table-info-${name}`;

        // Process data table with filters if needed
        let dbtable = data;
        if (this.facetsFilter && !this.fPivot) {
            dbtable = dbtable.select(this.facetsFilter);
        }

        // start table 
        // ------------    
        var table = `
            <div id='${SCROLL_ID}' class='data-scroll' style='resize:vertical;min-height:0px;height:${height}px;overflow:auto;' onscroll='__onScroll(event, "${name}")'>
                <div class='data-body'>
                    <div class='card-body'>
                        <div style='margin-top:0.5em'>
 		                     <table id='${TABLE_ID}' class='display dataTable' >`;

        // header row    
        table += "<tr style='vertical-align:top;line-height:1em'>";
        for (let i in dbtable.fields) {
            let szSort = (this.sortDir && (this.sortDir.split("-")[0] == dbtable.fields[i].id)) ? (this.sortDir.match(/up/i) ? "<i class='bi-sort-down-alt  me-1'></i>" : "<i class='bi-sort-down  me-1'></i>") : "";
            table += "<th style='min-width:50px'><a style='color:black;text-decoration:red;margin-right:1em;font-size:1em' href='#' onclick='event.preventDefault(); window.dataSinks.get(\"" + name + "\").sort(\"" + dbtable.fields[i].id + "\")' title='click to sort table by this column'><span style='white-space:nowrap'>" + (szSort + dbtable.fields[i].id) + "&nbsp;&nbsp;&nbsp;</span></a></th>";
        }
        table += "</tr>";

        // filter row    
        if (this.fShowFilter) {
            table += "<tr>";
            for (let i in dbtable.fields) {
                var szSafeId = ("input-table-table-" + name + "-filter-" + dbtable.fields[i].id).replace(/ |\W/g, "_");
                table += "<th style='min-width:50px'><input id='" + szSafeId + "' style='color:black;text-decoration:red;margin-right:1em;font-size:1.1em;width:100px' onkeyup='javascript:window.dataSinks.get(\"" + name + "\").applyFilter(\"" + dbtable.fields[i].id + "\",$(this).val(),event)' value='" + (this.filterA ? this.filterA[dbtable.fields[i].id] || "" : "") + "'></input></th>";
            }
            table += "</tr>";
        }

        // analytics row
        if (this.fShowAnalytics) {
            table += "<tr style='vertical-align:top;'>";
            for (let i in dbtable.fields) {
                table += "<td id='analytics-" + name + "-" + i + "' style='min-width:50px;line-height:1em;background:#f8f8f8;border:2px solid #fff;padding-bottom:0.2em'><br><br><br><br><br></td>";
            }
            table += "</tr>";
        }

        // pivot row 
        if (this.fShowPivot) {
            table += "<tr style='vertical-align:top;'>";
            for (var i in dbtable.fields) {
                table += "<th style='min-width:50px;padding-right:0.5em;'><select id='pivot-" + name + "-" + i + "' value='no role'><option value='no role'>---</option><option>row</option><option>columns</option><option>values</option></select></td>";
            }
            table += "</tr>";
        }

        // map roles row
        if (this.fShowMapRoles && this.map) {
            // Get current theme to determine existing roles
            let currentRoles = {};
            try {
                const map = this.map;
                
                // Try multiple ways to get themes (Chat app uses different API structure)
                let themesA = [];
                if (map && map.Themes && typeof map.Themes.getThemes === 'function') {
                    themesA = map.Themes.getThemes();
                } else if (map && map.Api && typeof map.Api.getAllThemes === 'function') {
                    themesA = map.Api.getAllThemes();
                } else if (map && typeof map.getThemes === 'function') {
                    themesA = map.getThemes();
                }
                
                if (themesA && themesA.length) {
                    // Try to find the theme that matches this data table
                    // Match by checking if theme's dbtable matches the data table name or structure
                    let themeObj = null;
                    let themeDefinition = null;
                    
                    // First, try to use stored themeId if available
                    if (this.themeId) {
                        for (let t = 0; t < themesA.length; t++) {
                            const candidateTheme = themesA[t];
                            const candidateThemeId = candidateTheme.id || candidateTheme.szId || candidateTheme.szThemeId;
                            if (candidateThemeId === this.themeId) {
                                themeObj = candidateTheme;
                                // Get theme definition
                                if (typeof map.getThemeDefinitionObj === 'function') {
                                    themeDefinition = map.getThemeDefinitionObj(this.themeId);
                                } else if (typeof map.Api !== 'undefined' && typeof map.Api.getMapThemeDefinitionObj === 'function') {
                                    themeDefinition = map.Api.getMapThemeDefinitionObj(this.themeId);
                                }
                                console.log('[MAP ROLES] Using stored themeId:', this.themeId);
                                break;
                            }
                        }
                    }
                    
                    // If themeId not found or not set, try to find theme by matching data table
                    if (!themeDefinition) {
                        for (let t = 0; t < themesA.length; t++) {
                            const candidateTheme = themesA[t];
                            const candidateThemeId = candidateTheme.id || candidateTheme.szId || candidateTheme.szThemeId;
                            
                            // Get theme definition to check if it matches
                            let candidateDef = null;
                            if (typeof map.getThemeDefinitionObj === 'function') {
                                candidateDef = map.getThemeDefinitionObj(candidateThemeId);
                            } else if (typeof map.Api !== 'undefined' && typeof map.Api.getMapThemeDefinitionObj === 'function') {
                                candidateDef = map.Api.getMapThemeDefinitionObj(candidateThemeId);
                            }
                            
                            if (candidateDef && candidateDef.style) {
                                // Check if theme's dbtable matches the data name or if fields match
                                const themeDbTable = candidateDef.style.dbtable || candidateDef.style.dbtableUrl || candidateDef.style.dbtableExt;
                                const dataTableName = this.name || name;
                                
                                // Match if dbtable name matches, or if we can't determine, use first theme
                                if (themeDbTable === dataTableName || 
                                    themeDbTable === name ||
                                    (t === 0 && !themeObj)) { // Fallback to first theme if no match found
                                    themeObj = candidateTheme;
                                    themeDefinition = candidateDef;
                                    // If we found a match, break
                                    if (themeDbTable === dataTableName || themeDbTable === name) {
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    
                    // If no theme found yet, use first theme as fallback
                    if (!themeObj && themesA.length > 0) {
                        themeObj = themesA[0];
                        const themeId = themeObj.id || themeObj.szId || themeObj.szThemeId;
                        if (typeof map.getThemeDefinitionObj === 'function') {
                            themeDefinition = map.getThemeDefinitionObj(themeId);
                        } else if (typeof map.Api !== 'undefined' && typeof map.Api.getMapThemeDefinitionObj === 'function') {
                            themeDefinition = map.Api.getMapThemeDefinitionObj(themeId);
                        }
                    }
                    
                    // Also try matching by checking if theme's objTheme has matching fields
                    if (!themeDefinition && themesA.length > 0) {
                        for (let t = 0; t < themesA.length; t++) {
                            const candidateTheme = themesA[t];
                            // Check if theme has objTheme with matching fields
                            if (candidateTheme.objTheme && candidateTheme.objTheme.dbFields) {
                                const themeFields = candidateTheme.objTheme.dbFields;
                                const dataFields = dbtable.fields;
                                // Check if field count matches and field names match
                                if (themeFields.length === dataFields.length) {
                                    let matches = 0;
                                    for (let f = 0; f < themeFields.length; f++) {
                                        const themeFieldName = themeFields[f].id || themeFields[f].name || themeFields[f];
                                        const dataFieldName = dataFields[f].id || dataFields[f].name || dataFields[f];
                                        if (themeFieldName === dataFieldName || 
                                            String(themeFieldName).toLowerCase() === String(dataFieldName).toLowerCase()) {
                                            matches++;
                                        }
                                    }
                                    // If most fields match, use this theme
                                    if (matches >= themeFields.length * 0.8) {
                                        themeObj = candidateTheme;
                                        const themeId = themeObj.id || themeObj.szId || themeObj.szThemeId;
                                        if (typeof map.getThemeDefinitionObj === 'function') {
                                            themeDefinition = map.getThemeDefinitionObj(themeId);
                                        } else if (typeof map.Api !== 'undefined' && typeof map.Api.getMapThemeDefinitionObj === 'function') {
                                            themeDefinition = map.Api.getMapThemeDefinitionObj(themeId);
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    
                    if (themeDefinition && themeDefinition.style) {
                        // Get fields from themeDefinition.style (this is where they are stored)
                        // Also check binding object as fallback
                        let lookupfield = themeDefinition.style.lookupfield || themeDefinition.style.itemfield || "";
                        // Check binding.geo as fallback
                        if ((!lookupfield || lookupfield === " ") && themeDefinition.binding && themeDefinition.binding.geo) {
                            lookupfield = themeDefinition.binding.geo;
                        }
                        // Handle case where itemfield is string "null"
                        if (lookupfield === "null" || lookupfield === null) {
                            lookupfield = "";
                        }
                        let sizefield = themeDefinition.style.sizefield || "";
                        // Check binding.size as fallback
                        if (!sizefield && themeDefinition.binding && themeDefinition.binding.size) {
                            sizefield = themeDefinition.binding.size;
                        }
                        
                        // Color field can be defined in two ways:
                        // 1. colorfield (always used for color, CATEGORICAL not needed)
                        // 2. field (only if colorfield is not set AND type contains CATEGORICAL)
                        // Note: valuefield is for chart text values, not treated here
                        let colorfield = themeDefinition.style.colorfield || "";
                        let themeField = themeDefinition.field || "";
                        // Check binding.value as fallback for color
                        if (!colorfield && !themeField && themeDefinition.binding && themeDefinition.binding.value) {
                            themeField = themeDefinition.binding.value;
                        }
                        const themeType = themeDefinition.style.type || "";
                        const isCategorical = themeType.includes("CATEGORICAL");
                        
                        // Determine which field is used for color
                        // colorfield takes precedence, otherwise use field if CATEGORICAL is present
                        let colorField = "";
                        if (colorfield) {
                            // colorfield takes precedence (CATEGORICAL not needed)
                            colorField = colorfield;
                        } else if (isCategorical && themeField && themeField !== "$item$") {
                            // field is used for color if colorfield is not set AND type is CATEGORICAL
                            colorField = themeField;
                        }
                        
                        // Size is always determined by sizefield (never by field)
                        // sizefield is already read from themeDefinition.style.sizefield above

                        // Check lookupfield (can be geometry or lat|lon)
                        if (lookupfield && lookupfield !== " ") {
                            if (lookupfield.includes("|")) {
                                const [lat, lon] = lookupfield.split("|");
                                if (lat && lat.trim()) currentRoles[lat.trim()] = "lat";
                                if (lon && lon.trim()) currentRoles[lon.trim()] = "lon";
                            } else {
                                currentRoles[lookupfield] = "geometry";
                            }
                        }

                        // Check sizefield
                        if (sizefield && sizefield.trim()) {
                            currentRoles[sizefield.trim()] = "size";
                        }

                        // Check color field
                        if (colorField && colorField !== "$item$" && colorField.trim()) {
                            currentRoles[colorField.trim()] = "color";
                        }
                        
                        // Debug logging
                        console.log('[MAP ROLES] Current roles detected:', currentRoles);
                        console.log('[MAP ROLES] Theme definition:', {
                            lookupfield: lookupfield,
                            sizefield: sizefield,
                            colorfield: colorfield,
                            themeField: themeField,
                            colorField: colorField,
                            binding: themeDefinition.binding
                        });
                    }
                } else {
                    console.warn(`[MAP ROLES] Could not get themes from map. Available methods:`, {
                        hasMap: !!map,
                        hasThemes: !!(map && map.Themes),
                        hasThemesGetThemes: !!(map && map.Themes && typeof map.Themes.getThemes === 'function'),
                        hasApi: !!(map && map.Api),
                        hasApiGetAllThemes: !!(map && map.Api && typeof map.Api.getAllThemes === 'function'),
                        hasGetThemes: !!(map && typeof map.getThemes === 'function')
                    });
                }
            } catch (e) {
                console.error("[MAP ROLES] Error getting theme roles:", e);
            }

            table += "<tr style='vertical-align:top;'>";
            for (let i in dbtable.fields) {
                const fieldName = dbtable.fields[i].id;
                // Try exact match first, then case-insensitive match
                let currentRole = currentRoles[fieldName] || currentRoles[fieldName.toLowerCase()] || currentRoles[fieldName.toUpperCase()] || "-";
                // Also try matching with trimmed field names
                if (currentRole === "-") {
                    for (const roleField in currentRoles) {
                        if (roleField.trim() === fieldName.trim() || roleField.toLowerCase() === fieldName.toLowerCase()) {
                            currentRole = currentRoles[roleField];
                            break;
                        }
                    }
                }
                const szSafeId = ("input-table-table-" + name + "-map-role-" + fieldName).replace(/ |\W/g, "_");
                table += "<th style='min-width:50px;padding-right:0.5em;'>";
                table += "<select id='" + szSafeId + "' style='font-size:0.9em;width:100px' onchange='if(typeof __updateMapRole === \"function\") { __updateMapRole(\"" + name + "\",\"" + fieldName + "\",this.value); } else if(typeof window.__updateMapRole === \"function\") { window.__updateMapRole(\"" + name + "\",\"" + fieldName + "\",this.value); } else { console.error(\"__updateMapRole is not defined\"); }'>";
                table += "<option value='-'" + (currentRole === "-" ? " selected" : "") + ">-</option>";
                table += "<option value='lat'" + (currentRole === "lat" ? " selected" : "") + ">lat</option>";
                table += "<option value='lon'" + (currentRole === "lon" ? " selected" : "") + ">lon</option>";
                table += "<option value='geometry'" + (currentRole === "geometry" ? " selected" : "") + ">geometry</option>";
                table += "<option value='color'" + (currentRole === "color" ? " selected" : "") + ">color</option>";
                table += "<option value='size'" + (currentRole === "size" ? " selected" : "") + ">size</option>";
                table += "</select>";
                table += "</th>";
            }
            table += "</tr>";
        }

        // data rows
        // ----------
        let max = Math.min(MAX_RECORDS, dbtable.records.length);
        for (r = 0; r < max; r++) {
            table += r % 2 ? "<tr class='odd'>" : "<tr class='even'>";
            for (let i in dbtable.fields) {
                let text = String(dbtable.records[r][i]).replace(/\'/i, "\\\'");
                if (text.match(/999999|000000/)) {
                    text = Number(text).toFixed(2);
                }
                let tooltip = "";
                if (text.length > MAX_TEXT_LENGTH) {
                    tooltip = "onmouseover=\"__showTooltip(event,'" + text + "')\" onmouseout=\"hideTooltip()\"";
                }
                table += "<td nowrap class='" + name + "_column_" + i + "' style='padding-right:0.5em;overflow:hidden;text-overflow:ellipsis;max-width:300px;' " + tooltip + "'>" + text + "&nbsp;</td>";
            }
            table += "</tr>";
        }

        // finish table 
        // -------------
        table += `</table>
                        </div>
                    </div>
                </div>
            </div>`;

        // add table info 
        // -------------
        let mapRolesButton = '';
        if (this.map) {
            const mapRolesButtonId = `input-table-header-${name}-map-roles`;
            const isActive = this.fShowMapRoles ? 'active' : '';
            mapRolesButton = ` &nbsp;&nbsp;<button id="${mapRolesButtonId}" class="map-roles-btn ${isActive}" data-datasink="${this.escapeHtml(name || '')}" style="background:none; border:none; color:#007bff; text-decoration:none; cursor:pointer; padding:0;" onclick="if(typeof __dataMapRoles === 'function') { __dataMapRoles('${name}'); } else if(typeof window.__dataMapRoles === 'function') { window.__dataMapRoles('${name}'); }">
                    <i class='bi-geo-alt me-1'></i> map roles
                </button>`;
        }
        table += `<div id='${INFO_ID}' style='margin-top:0.5em;'>
                records: ${this.escapeHtml(data.table.records || 0)} &nbsp;&nbsp;<button class="export-csv-btn" data-datasink="${this.escapeHtml(name || '')}" style="background:none; border:none; color:#007bff; text-decoration:none; cursor:pointer; padding:0;">
                    <i class='bi-download me-1'></i> export data
                </button>${mapRolesButton}
            </div>`;

        // Handle analytics
        if (this.fShowAnalytics) {
            // Wait a bit longer and check if getDataFacets is available
            setTimeout(() => {
                // Check if getDataFacets is available, retry if not
                if (ixmaps && ixmaps.data && typeof ixmaps.data.getDataFacets === 'function') {
                    this.getAnalyticsFromDataTable();
                } else {
                    // Retry after a longer delay
                    setTimeout(() => {
                        if (ixmaps && ixmaps.data && typeof ixmaps.data.getDataFacets === 'function') {
                            this.getAnalyticsFromDataTable();
                        } else {
                            console.warn('[ANALYTICS] ixmaps.data.getDataFacets not available after retry, skipping analytics');
                        }
                    }, 500);
                }
            }, 200);
        }

        // Update shown records count
        this.shown = max;

        return table;
    };

    /**
     * Escapes HTML special characters to prevent XSS
     * @param {string} text - The text to escape
     * @returns {string} The escaped text
     */
    DataSink.prototype.escapeHtml = function(text) {
        if (text === null || text === undefined) return '';
        return String(text).replace(/[<>&"']/g, function(match) {
            const escapeMap = {'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'};
            return escapeMap[match];
        });
    };

    /**
     * Sets up event listeners for the data table
     * @param {string} name - The name of the DataSink
     */
    DataSink.prototype.setupTableEventListeners = function(name) {
        // Set up export CSV button event listeners
        const exportButtons = document.querySelectorAll(`#input-table-info-${name} .export-csv-btn`);
        exportButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const dataSinkName = button.getAttribute('data-datasink');
                if (dataSinkName && window.dataSinks && window.dataSinks.get) {
                    const dataSink = window.dataSinks.get(dataSinkName);
                    if (dataSink) {
                        saveAsCSV(dataSink);
                    }
                }
            });
        });
    };

    /**
     * Add more rows to the data table
     * @void
     */
    DataSink.prototype.addToDataTable = function () {
        const name = this.name; // Use the instance name instead of parameter

        var dbtable = this.data;
        if (this.facetsFilter) {
            dbtable = dbtable.select(this.facetsFilter);
        }

        let table = "";
        let start = this.shown;
        let max = Math.min(start + 100, dbtable.records.length);
        for (r = start; r < max; r++) {
            table += r % 2 ? "<tr class='odd'>" : "<tr class='even'>";
            for (let i in dbtable.fields) {
                let text = String(dbtable.records[r][i]).replace(/\'/i, "\\\'");
                let tooltip = "";
                if (text.length > 40) {
                    tooltip = "onmouseover=\"__showTooltip(event,'" + text + "')\" onmouseout=\"hideTooltip()\"";
                }
                table += "<td nowrap class='" + name + "_column_" + i + "' style='padding-right:0.5em;overflow:hidden;text-overflow:ellipsis;max-width:500px;' " + tooltip + "'>" + dbtable.records[r][i] + "&nbsp;</td>";
            }
            table += "</tr>";
        }
        $("#input-table-table-" + name + "-table").append(table);


        if (this.fShowAnalytics && this.facetsA) {
            const facetsA = this.facetsA;
            for (let i in dbtable.fields) {
                $("." + name + "_column_" + i).addClass(facetsA[i].undef ? "td_red" : facetsA[i].type == 'numeric' ? "td_blue" : (facetsA[i].uniqueValues ? "td_yellow" : ""));

                if (facetsA[i].type == 'numeric') {
                    $("." + name + "_column_" + i).addClass("td_right");
                    $("." + name + "_column_" + i).each(function () {
                        if (!isNaN($(this).text())) {
                            $(this).html(ixmaps.formatValue($(this).text(), 2, "BLANK"));
                        }
                    });
                }
            }
        }

        this.shown = max;
    };

    /**
     * Creates an extended table header with information about the columns data type and quality
     * @returns {void}
     */
    DataSink.prototype.getAnalyticsFromDataTable = function () {
        const name = this.name; // Use the instance name instead of parameter

        // Check if getDataFacets is available, otherwise skip analytics
        if (!ixmaps || !ixmaps.data || typeof ixmaps.data.getDataFacets !== 'function') {
            console.warn('[ANALYTICS] ixmaps.data.getDataFacets is not available, skipping analytics');
            return;
        }

        var facetsA = ixmaps.data.getDataFacets(this.data, this.facetsFilter);
        this.facetsA = facetsA;

        dbtable = this.data;
        for (let i in dbtable.fields) {
            let value = "";
            if (facetsA[i]) {
                let type = "<b>" + (facetsA[i].type || "numeric") + "</b>";
                let unique = "<small style='white-space:nowrap'>" + (facetsA[i].uniqueValues ? (facetsA[i].uniqueValues + '<br>unique values') : '') + "</small>";
                value = type + "<br>" + unique;
                if (facetsA[i].min <= facetsA[i].max) {
                    value = type + "<small style='white-space:nowrap'>" +
                        "<br>min: " + ixmaps.formatValue(facetsA[i].min, 2, "BLANK") +
                        "<br>max: " + ixmaps.formatValue(facetsA[i].max, 2, "BLANK") +
                        "<br>sum: " + ixmaps.formatValue(facetsA[i].sum, 2, "BLANK") +
                        "</small>";
                }
                if (facetsA[i].undef) {
                    value += "<small style='white-space:nowrap'>" +
                        "<br>" + facetsA[i].undef + " missing values" +
                        "</small>";
                }
            }
            $("#analytics-" + name + "-" + i).html(value);

            $("." + name + "_column_" + i).addClass(facetsA[i].undef ? "td_red" : facetsA[i].type == 'numeric' ? "td_blue" : facetsA[i].type == 'time' ? "td_green" : facetsA[i].uniqueValues ? "td_yellow" : "");

            if (facetsA[i].type == 'numeric') {
                $("." + name + "_column_" + i).addClass("td_right");
                $("." + name + "_column_" + i).each(function () {
                    $(this).html(ixmaps.formatValue($(this).text(), 2, "BLANK"));
                });
            }
        }
    };

    /**
     * Sorts the data by a specific field
     * @param {string} fieldId - The field ID to sort by
     */
    DataSink.prototype.sort = function (fieldId) {
        // Toggle sort direction if same field is clicked
        if (this.sortDir && this.sortDir.split("-")[0] === fieldId) {
            this.sortDir = this.sortDir.match(/UP/i) ? fieldId + "-DOWN" : fieldId + "-UP";
        } else {
            // Default to ascending order for new field
            this.sortDir = fieldId + "-UP";
        }

        // Get the data to sort
        let dbtable = this.data;
        if (this.facetsFilter && !this.fPivot) {
            dbtable = dbtable.select(this.facetsFilter);
        }

        // Sort Data
        dbtable.sort(fieldId, this.sortDir.split("-")[1]);

        // Refresh the table display to show the sorted data
        this.refreshTable();
    };

    /**
     * Refreshes the table display after sorting
     */
    DataSink.prototype.refreshTable = function () {
        const name = this.name; // Use the instance name instead of parameter

        // Re-render the table with the sorted data
        const tableContainer = document.querySelector(`#input-table-table-${name}-table`).closest('.data-scroll').parentElement;
        if (tableContainer) {
            const height = $(tableContainer).children(":first").height();
            const offset = $(tableContainer).scrollLeft();
            // Re-generate the table HTML
            const newTable = this.makeDataTable(height || this.height || 400);
            tableContainer.innerHTML = newTable;
            $(tableContainer).children(":first").scrollLeft(offset);
            
            // Set up event listeners for the new table
            this.setupTableEventListeners(this.name);
        }
    };

    /**
     * Gets the active map instance for this DataSink
     * @returns {Object|null} The map instance or null if not found
     */
    DataSink.prototype.getActiveMapInstance = function () {
        try {
            // First check if map is explicitly set
            if (this.map) {
                return this.map;
            }
            
            // Try to get map from ixmaps API
            if (typeof ixmaps !== 'undefined') {
                // Try embeddedSVG window map
                if (ixmaps.embeddedSVG && ixmaps.embeddedSVG.window && ixmaps.embeddedSVG.window.map) {
                    return ixmaps.embeddedSVG.window.map;
                }
                // Try ixmaps.map() function
                if (typeof ixmaps.map === 'function') {
                    const map = ixmaps.map();
                    if (map) {
                        return map;
                    }
                }
            }
            
            return null;
        } catch (e) {
            console.warn('Error getting active map instance:', e);
            return null;
        }
    };

    /**
     * Finds all themes that use a specific data source
     * @param {Object} mapInstance - The map instance
     * @param {string} dataSourceName - The name of the data source (e.g., "themeDataObj")
     * @returns {Array<string>} Array of theme IDs that match the data source
     */
    DataSink.prototype.findThemesByDataSource = function (mapInstance, dataSourceName) {
        try {
            if (!mapInstance || !dataSourceName) {
                return [];
            }
            
            const matchingThemes = [];
            
            // Get all themes from the map
            let themes = [];
            if (typeof ixmaps !== 'undefined' && typeof ixmaps.getThemes === 'function') {
                themes = ixmaps.getThemes() || [];
            } else if (mapInstance.getAllThemes && typeof mapInstance.getAllThemes === 'function') {
                themes = mapInstance.getAllThemes() || [];
            }
            
            // Check each theme for matching data source
            for (let i = 0; i < themes.length; i++) {
                try {
                    const theme = themes[i];
                    const themeId = theme.szId || theme.id || theme;
                    
                    // Get theme definition
                    let themeDef = null;
                    if (typeof ixmaps !== 'undefined' && typeof ixmaps.getThemeDefinitionObj === 'function') {
                        themeDef = ixmaps.getThemeDefinitionObj(themeId);
                    } else if (mapInstance.getMapThemeDefinitionObj && typeof mapInstance.getMapThemeDefinitionObj === 'function') {
                        themeDef = mapInstance.getMapThemeDefinitionObj(themeId);
                    }
                    
                    if (themeDef && themeDef.style) {
                        const themeDataSource = themeDef.style.dbtable;
                        // Match if data source names are equal
                        if (themeDataSource === dataSourceName) {
                            matchingThemes.push(themeId);
                        }
                    }
                } catch (e) {
                    // Skip themes that can't be accessed
                    console.warn('Error checking theme:', e);
                }
            }
            
            return matchingThemes;
        } catch (e) {
            console.warn('Error finding themes by data source:', e);
            return [];
        }
    };

    /**
     * Removes filter conditions from an existing filter
     * @param {string} existingFilter - The existing filter string
     * @param {string} filterToRemove - The filter string to remove
     * @returns {string} The filter with conditions removed
     */
    DataSink.prototype.removeFilterConditions = function (existingFilter, filterToRemove) {
        try {
            if (!existingFilter || !existingFilter.trim()) {
                return '';
            }
            if (!filterToRemove || !filterToRemove.trim()) {
                return existingFilter;
            }
            
            // Extract WHERE clauses
            const extractWhereClause = (filter) => {
                if (!filter) return '';
                const whereMatch = filter.match(/WHERE\s+(.+)/i);
                return whereMatch ? whereMatch[1].trim() : filter.trim();
            };
            
            const existingClause = extractWhereClause(existingFilter);
            const removeClause = extractWhereClause(filterToRemove);
            
            if (!existingClause) {
                return '';
            }
            if (!removeClause) {
                return existingFilter;
            }
            
            // Parse conditions (reuse the same parsing logic)
            const parseConditions = (clause) => {
                const conditions = [];
                let current = '';
                let inQuotes = false;
                let quoteChar = '';
                let parenDepth = 0;
                
                for (let i = 0; i < clause.length; i++) {
                    const char = clause[i];
                    const nextChar = clause[i + 1];
                    
                    if (!inQuotes && (char === '"' || char === "'")) {
                        inQuotes = true;
                        quoteChar = char;
                        current += char;
                    } else if (inQuotes && char === quoteChar) {
                        inQuotes = false;
                        current += char;
                    } else if (!inQuotes && char === '(') {
                        parenDepth++;
                        current += char;
                    } else if (!inQuotes && char === ')') {
                        parenDepth--;
                        current += char;
                    } else if (!inQuotes && parenDepth === 0 && 
                               char === 'A' && nextChar === 'N' && clause.substring(i, i + 3).match(/^AND\s/i)) {
                        if (current.trim()) {
                            conditions.push(current.trim());
                        }
                        current = '';
                        i += 2;
                    } else {
                        current += char;
                    }
                }
                
                if (current.trim()) {
                    conditions.push(current.trim());
                }
                
                return conditions;
            };
            
            const existingConditions = parseConditions(existingClause);
            const removeConditions = parseConditions(removeClause);
            
            // Remove conditions that match (remove ALL instances, not just first)
            const normalizedRemoveConditions = removeConditions.map(cond => 
                cond.replace(/\s+/g, ' ').trim().toLowerCase()
            );
            
            const remainingConditions = existingConditions.filter(existingCond => {
                const normalizedExisting = existingCond.replace(/\s+/g, ' ').trim().toLowerCase();
                // Remove if it matches any of the conditions to remove
                return !normalizedRemoveConditions.includes(normalizedExisting);
            });
            
            if (remainingConditions.length === 0) {
                return '';
            }
            
            const remainingClause = remainingConditions.join(' AND ');
            return `WHERE ${remainingClause}`;
        } catch (e) {
            console.warn('Error removing filter conditions:', e);
            // If removal fails, return empty (safer than keeping old filter)
            return '';
        }
    };

    /**
     * Intelligently merges two WHERE clause filters
     * @param {string} existingFilter - The existing filter string
     * @param {string} newFilter - The new filter string to merge
     * @returns {string} The merged filter string
     */
    DataSink.prototype.mergeFilters = function (existingFilter, newFilter) {
        try {
            // Handle empty cases
            if (!existingFilter || !existingFilter.trim()) {
                return newFilter || '';
            }
            if (!newFilter || !newFilter.trim()) {
                // When newFilter is empty, we should remove table filter conditions from existing
                // But we don't know which parts came from table, so return existing for now
                // The caller should handle removal separately
                return existingFilter || '';
            }
            
            // Extract WHERE clauses
            const extractWhereClause = (filter) => {
                if (!filter) return '';
                const whereMatch = filter.match(/WHERE\s+(.+)/i);
                return whereMatch ? whereMatch[1].trim() : filter.trim();
            };
            
            const existingClause = extractWhereClause(existingFilter);
            const newClause = extractWhereClause(newFilter);
            
            if (!existingClause) {
                return newFilter;
            }
            if (!newClause) {
                return existingFilter;
            }
            
            // Parse conditions from both clauses
            const parseConditions = (clause) => {
                // Split by AND, handling quoted strings and parentheses
                const conditions = [];
                let current = '';
                let inQuotes = false;
                let quoteChar = '';
                let parenDepth = 0;
                
                for (let i = 0; i < clause.length; i++) {
                    const char = clause[i];
                    const nextChar = clause[i + 1];
                    
                    if (!inQuotes && (char === '"' || char === "'")) {
                        inQuotes = true;
                        quoteChar = char;
                        current += char;
                    } else if (inQuotes && char === quoteChar) {
                        inQuotes = false;
                        current += char;
                    } else if (!inQuotes && char === '(') {
                        parenDepth++;
                        current += char;
                    } else if (!inQuotes && char === ')') {
                        parenDepth--;
                        current += char;
                    } else if (!inQuotes && parenDepth === 0 && 
                               char === 'A' && nextChar === 'N' && clause.substring(i, i + 3).match(/^AND\s/i)) {
                        // Found AND separator
                        if (current.trim()) {
                            conditions.push(current.trim());
                        }
                        current = '';
                        i += 2; // Skip 'AND'
                    } else {
                        current += char;
                    }
                }
                
                if (current.trim()) {
                    conditions.push(current.trim());
                }
                
                return conditions;
            };
            
            const existingConditions = parseConditions(existingClause);
            const newConditions = parseConditions(newClause);
            
            // Combine conditions, avoiding duplicates
            const allConditions = [...existingConditions];
            
            for (const newCondition of newConditions) {
                // Normalize condition for comparison (remove extra spaces, normalize quotes)
                const normalizedNew = newCondition.replace(/\s+/g, ' ').trim();
                let isDuplicate = false;
                
                for (const existingCondition of existingConditions) {
                    const normalizedExisting = existingCondition.replace(/\s+/g, ' ').trim();
                    // Check if conditions are the same (exact match or same field+operator+value)
                    if (normalizedNew.toLowerCase() === normalizedExisting.toLowerCase()) {
                        isDuplicate = true;
                        break;
                    }
                }
                
                if (!isDuplicate) {
                    allConditions.push(newCondition);
                }
            }
            
            // Combine all conditions with AND
            if (allConditions.length === 0) {
                return '';
            }
            
            const mergedClause = allConditions.join(' AND ');
            return `WHERE ${mergedClause}`;
        } catch (e) {
            console.warn('Error merging filters:', e);
            // Fallback: simple concatenation
            if (existingFilter && newFilter) {
                const existingClause = existingFilter.replace(/^WHERE\s+/i, '').trim();
                const newClause = newFilter.replace(/^WHERE\s+/i, '').trim();
                return `WHERE ${existingClause} AND ${newClause}`;
            }
            return newFilter || existingFilter || '';
        }
    };

    /**
     * Applies a filter to the data based on keyup events in the filter input fields.
     *
     * @param {string} szColumn - The column to filter.
     * @param {string} szSelect - The filter string entered by the user.
     * @param {Event} event - The keyup event.
     */
    DataSink.prototype.applyFilter = function (szColumn, szSelect, event) {
        if (!["ArrowLeft", "ArrowRight", "Enter"].includes(event.key)) return;
        if (event.key !== "Enter") return;

        const dataName = this.name;
        let data = this.data;
        this.filterA = this.filterA || {};
        delete this.filterA[szColumn];

        if (szSelect && szSelect.length) {
            this.filterA[szColumn] = szSelect;
        }

        let filterParts = [];
        for (const column in this.filterA) {
            let filterValue = this.filterA[column];
            if (!filterValue || (filterValue[0].match(/[<>]/) && filterValue.length < 2)) {
                continue;
            }
            const operator = filterValue[0].match(/[<>]/) ? filterValue[0] : "like";
            const value = filterValue.startsWith("<") || filterValue.startsWith(">") ?
                (filterValue.startsWith("< ") || filterValue.startsWith("> ") ? filterValue.slice(1).trim() : filterValue.slice(1)) :
                (filterValue.match(/BETWEEN/) ? filterValue : `"${filterValue}"`);

            let filterPart;
            if (operator === "like") {
                filterPart = `"${column}" ${operator} ${value}`;
            } else {
                filterPart = `"${column}" ${operator} ${value}`;
            }
            filterParts.push(filterPart);
        }

        const newFilter = filterParts.length ? `WHERE ${filterParts.join(" AND ")}` : "";
        if (newFilter) {
            data = data.select(newFilter);
        }

        // Apply filter to themes bound to this data source
        try {
            const mapInstance = this.getActiveMapInstance();
            
            if (mapInstance) {
                // Determine the data source name
                // Try multiple possible locations for the data source name
                let dataSourceName = null;
                if (this.data && this.data.table && this.data.table.name) {
                    dataSourceName = this.data.table.name;
                } else if (this.name) {
                    dataSourceName = this.name;
                } else if (this.data && this.data.name) {
                    dataSourceName = this.data.name;
                }
                
                // Initialize matchingThemes array
                let matchingThemes = [];
                
                if (dataSourceName) {
                    matchingThemes = this.findThemesByDataSource(mapInstance, dataSourceName);
                    
                    // If no themes found, try alternative matching strategies
                    if (matchingThemes.length === 0) {
                        // Strategy 1: Try matching by data object reference
                        // Get all themes and check if they use the same data object
                        try {
                            let allThemes = [];
                            if (typeof ixmaps !== 'undefined' && typeof ixmaps.getThemes === 'function') {
                                allThemes = ixmaps.getThemes() || [];
                            } else if (mapInstance.getAllThemes && typeof mapInstance.getAllThemes === 'function') {
                                allThemes = mapInstance.getAllThemes() || [];
                            }
                            
                            const dataObj = this.data?.table;
                            if (dataObj) {
                                for (const theme of allThemes) {
                                    try {
                                        const themeId = theme.szId || theme.id || theme;
                                        let themeDef = null;
                                        if (typeof ixmaps !== 'undefined' && typeof ixmaps.getThemeDefinitionObj === 'function') {
                                            themeDef = ixmaps.getThemeDefinitionObj(themeId);
                                        } else if (mapInstance.getMapThemeDefinitionObj && typeof mapInstance.getMapThemeDefinitionObj === 'function') {
                                            themeDef = mapInstance.getMapThemeDefinitionObj(themeId);
                                        }
                                        
                                        if (themeDef && themeDef.style && themeDef.style.dbtable) {
                                            // Try to get the actual data object from the theme's dbtable name
                                            const themeDataName = themeDef.style.dbtable;
                                            let themeDataObj = null;
                                            try {
                                                if (typeof ixmaps !== 'undefined' && ixmaps.embeddedSVG && ixmaps.embeddedSVG.window) {
                                                    themeDataObj = ixmaps.embeddedSVG.window[themeDataName];
                                                } else if (typeof window !== 'undefined') {
                                                    themeDataObj = window[themeDataName];
                                                }
                                                
                                                // Compare data objects by checking if they have the same records/fields
                                                if (themeDataObj && dataObj) {
                                                    // Check if they're the same object or have matching structure
                                                    if (themeDataObj === dataObj || 
                                                        (themeDataObj.table && themeDataObj.table === dataObj) ||
                                                        (themeDataObj.records && dataObj.records && 
                                                         themeDataObj.records.length === dataObj.records.length &&
                                                         themeDataObj.fields && dataObj.fields &&
                                                         themeDataObj.fields.length === dataObj.fields.length)) {
                                                        if (!matchingThemes.includes(themeId)) {
                                                            matchingThemes.push(themeId);
                                                        }
                                                    }
                                                }
                                            } catch (e) {
                                                // Skip if can't access theme data
                                            }
                                        }
                                    } catch (e) {
                                        // Skip theme if error
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('Error in alternative theme matching:', e);
                        }
                    }
                    
                    matchingThemes.forEach(themeId => {
                        try {
                            // Get theme definition to check for existing filter
                            let themeDef = null;
                            if (typeof ixmaps !== 'undefined' && typeof ixmaps.getThemeDefinitionObj === 'function') {
                                themeDef = ixmaps.getThemeDefinitionObj(themeId);
                            } else if (mapInstance.getMapThemeDefinitionObj && typeof mapInstance.getMapThemeDefinitionObj === 'function') {
                                themeDef = mapInstance.getMapThemeDefinitionObj(themeId);
                            }
                            
                            // Get existing filter from theme
                            let existingFilter = '';
                            if (themeDef && themeDef.style && themeDef.style.filter) {
                                existingFilter = themeDef.style.filter;
                            } else {
                                // Try to get filter from theme object directly
                                const themeObj = mapInstance.getTheme ? mapInstance.getTheme(themeId) : null;
                                if (themeObj && themeObj.szFilter) {
                                    existingFilter = themeObj.szFilter;
                                }
                            }
                            
                            // Determine the final filter to apply
                            let finalFilter = '';
                            if (newFilter && newFilter.trim()) {
                                // When adding/updating filter, first remove previous table filter conditions
                                // to avoid duplicates, then merge with new filter
                                const previousTableFilter = this.facetsFilter || '';
                                let cleanedExistingFilter = existingFilter;
                                
                                if (previousTableFilter && previousTableFilter.trim() && existingFilter && existingFilter.trim()) {
                                    // Remove previous table filter conditions from existing filter
                                    cleanedExistingFilter = this.removeFilterConditions(existingFilter, previousTableFilter);
                                }
                                
                                // Now merge the cleaned existing filter with the new filter
                                finalFilter = this.mergeFilters(cleanedExistingFilter, newFilter);
                            } else {
                                // When removing filter, subtract table filter conditions from existing
                                // Store the previous table filter to know what to remove
                                const previousTableFilter = this.facetsFilter || '';
                                if (previousTableFilter && previousTableFilter.trim()) {
                                    // Remove the table filter conditions from existing filter
                                    finalFilter = this.removeFilterConditions(existingFilter, previousTableFilter);
                                } else {
                                    // No previous table filter, so just remove everything
                                    finalFilter = '';
                                }
                            }
                            
                            // Apply final filter to theme
                            // Try multiple ways to call changeThemeStyle
                            let changeThemeStyleFunc = null;
                            if (typeof ixmaps !== 'undefined' && typeof ixmaps.changeThemeStyle === 'function') {
                                changeThemeStyleFunc = ixmaps.changeThemeStyle;
                            } else if (mapInstance && mapInstance.Api && typeof mapInstance.Api.changeThemeStyle === 'function') {
                                changeThemeStyleFunc = mapInstance.Api.changeThemeStyle.bind(mapInstance.Api);
                            } else if (mapInstance && mapInstance.changeThemeStyle && typeof mapInstance.changeThemeStyle === 'function') {
                                changeThemeStyleFunc = mapInstance.changeThemeStyle;
                            } else if (typeof ixmaps !== 'undefined' && ixmaps.embeddedSVG && ixmaps.embeddedSVG.window && ixmaps.embeddedSVG.window.map && ixmaps.embeddedSVG.window.map.Api && typeof ixmaps.embeddedSVG.window.map.Api.changeThemeStyle === 'function') {
                                changeThemeStyleFunc = ixmaps.embeddedSVG.window.map.Api.changeThemeStyle.bind(ixmaps.embeddedSVG.window.map.Api);
                            }
                            
                            if (changeThemeStyleFunc) {
                                if (finalFilter && finalFilter.trim()) {
                                    changeThemeStyleFunc(themeId, `filter:${finalFilter}`, "set");
                                } else {
                                    // Remove filter if empty
                                    changeThemeStyleFunc(themeId, "filter", "remove");
                                }
                            }
                        } catch (e) {
                            console.warn(`Error applying filter to theme ${themeId}:`, e);
                        }
                    });
                }
            }
        } catch (e) {
            console.warn('Error applying filters to themes:', e);
        }

        // Keep existing this.map logic for backward compatibility
        if (this.map) {
            this.map.changeThemeStyle(null, newFilter ? `filter:${newFilter}` : "filter", newFilter ? "set" : "remove");
        }

        this.facetsFilter = newFilter;

        // Update the table with filtered data
        this.updateDataTable(data);

        const $info = $(`#input-table-info-${dataName}`);
        const totalRecords = this.data.table.records;
        if (newFilter) {
            $info.html(`records: <b>${this.escapeHtml(data.table.records || 0)}</b> / ${this.escapeHtml(totalRecords || 0)} &nbsp; <small><i class='bi-funnel me-1'></i> ${this.escapeHtml(newFilter || '')}</small> &nbsp; <button class="export-csv-btn" data-datasink="${this.escapeHtml(dataName || '')}" style="background:none; border:none; color:#007bff; text-decoration:none; cursor:pointer; padding:0;">
                <i class='bi-download me-1'></i> export data
            </button>`);
        } else {
            $info.html(`records: ${this.escapeHtml(data.table.records || 0)}&nbsp;&nbsp; <button class="export-csv-btn" data-datasink="${this.escapeHtml(dataName || '')}" style="background:none; border:none; color:#007bff; text-decoration:none; cursor:pointer; padding:0;">
                <i class='bi-download me-1'></i> export data
            </button>`);
        }
        
        // Set up event listeners for the new export buttons
        this.setupTableEventListeners(dataName);

        const szSafeId = (`input-table-table-${dataName}-filter-${szColumn}`).replace(/ |\W/g, "_");
        const $input = $(`#${szSafeId}`);
        const len = $input.val().length;
        $input.focus().prop('selectionStart', len).prop('selectionEnd', len);
    };

    /**
     * Updates the data table with filtered data
     * @param {Object} filteredData - The filtered data to display
     */
    DataSink.prototype.updateDataTable = function (filteredData) {
        // Re-render the table with the filtered data
        const tableContainer = document.querySelector(`#input-table-table-${this.name}-table`).closest('.data-scroll').parentElement;
        if (tableContainer) {
            // Temporarily store the filtered data
            const originalData = this.data;
            this.data = filteredData;

            // Re-generate the table HTML
            const newTable = this.makeDataTable(this.height || 400);
            tableContainer.innerHTML = newTable;
            
            // Set up event listeners for the new table
            this.setupTableEventListeners(this.name);

            // Restore the original data
            this.data = originalData;
        }
    };

    /**
     * Creates a alternative data visualization as cards 
     * @returns {string} HTML string of the generated table
     */
    DataSink.prototype.makeDataCards = function () {
        const dbtable = this.data; // Use the instance data instead of parameter

        var leftWidth = "50px";
        var rightWidth = "100px";


        var table = "<div style='border-top:black solid 1px;'>";

        table += "<div class='card-body' >";
        table += "<div>";

        table += "<table class='display dataTable wrapword' width='100%' style='line-height:1.1em'>";

        let max = Math.min(101, dbtable.records.length);
        for (var r = 0; r < max; r++) {

            table += "<tr style='line-height:0.6em'><td>" + "&nbsp;" + "</td><td>" + "&nbsp;" + "</td></tr>";
            table += "<tr style='border-top:solid #dddddd 1px;padding-top:0.5em;padding-bottom:-0.5em;background:#ffffff'><td>" + (r + 1) + "</td><td></td><td></td><td></td></tr>";

            var delta = Math.ceil(dbtable.records[r].length / 2);

            for (var d = 0; d < dbtable.records[r].length / 2; d++) {

                var szValue1 = dbtable.records[r][d];
                if (szValue1.length && !isNaN(szValue1)) {
                    var nValue1 = (dbtable.records[r][d]);
                    szValue1 = ixmaps.formatValue(nValue1, 2, "BLANK");
                }
                var szValue2 = dbtable.records[r][d + delta];
                if (szValue2 && szValue2.length && !isNaN(szValue2)) {
                    var nValue2 = (dbtable.records[r][d + delta]);
                    szValue2 = ixmaps.formatValue(nValue2, 2, "BLANK");
                }
                table += "<tr><td style='text-align:right;vertical-align:top;padding-top:0.3em;width:" + leftWidth + ";color:#aaa;font-size:0.8em;'>" + dbtable.fields[d].id + "</td><td style='padding-left:0.5em;vertical-align:top;width:" + rightWidth + ";'>" + szValue1 + "</td>";
                szValue2 = szValue2 || " ";
                if (dbtable.fields[d + delta] && dbtable.fields[d + delta].id) {
                    table += "<td style='text-align:right;vertical-align:top;padding-top:0.3em;width:" + leftWidth + ";color:#aaa;font-size:0.8em;'>" + dbtable.fields[d + delta].id + "</td><td style='padding-left:0.5em;vertical-align:top;width:" + rightWidth + ";'>" + szValue2 + "</td>";
                }
                table += "</tr>";
            }
        }

        table += "</table>";
        table += "</div>";

        return table;
    };
    
    // --------------------------------------------------------------------------------------------
    // local helper functions
    // --------------------------------------------------------------------------------------------


    /**
    * check scroll and add data rows if scroll at end 
    * @function __onScroll
    * @param {object} event - The scroll event.
    * @param {string} dataName - The name of the data.
    * @returns {void}
    * @private
    */
   __onScroll = function (event, dataName) {
       let rest = 1000;
       for (var i in event.target.childNodes) {
           if (event.target.childNodes.item(i).tagName == "DIV") {
               rest = event.target.childNodes.item(i).clientHeight - event.target.scrollTop - event.target.clientHeight;
           }
       }
       if (rest < 100) {
           // Get the DataSink instance using the new structure
           const dataSink = window.dataSinks.get(dataName);
           if (dataSink) {
               dataSink.addToDataTable();
           }
       }
   };
    // --------------------------------------------------------------------------------------------
    // tooltips
    // --------------------------------------------------------------------------------------------

    __hideTimeout = null;
    __showTooltip = function (evt, text) {
        setTimeout(() => {
            doShowTooltip(evt.pageX, evt.pageY, text);
        }, 250);
    };
    doShowTooltip = function (x, y, text) {
        if (text && text.length) {

            var tooltip = document.getElementById("tooltip");
            tooltip.innerHTML = text;
            tooltip.style.display = "block";
            tooltip.style.left = x + 15 + 'px';
            tooltip.style.top = y - 5 + 'px';
            tooltip.setAttribute("onMouseOver", "clearTimeout(__hideTimeout)");
            tooltip.setAttribute("onMouseOut", "hideTooltip()");
        }
    };
    hideTooltip = function () {
        __hideTimeout = setTimeout(() => doHideTooltip(), 250);
    };
    doHideTooltip = function () {
        var tooltip = document.getElementById("tooltip");
        tooltip.style.display = "none";
    };
    // --------------------------------------------------------------------------------------------
    // stringify table object to csv   
    // --------------------------------------------------------------------------------------------

    var dumpTable = function (tableObj) {

        var numRows = tableObj.records.length;
        var numCols = tableObj.fields.length;
        var records = tableObj.records;

        var columns = [];
        for (i = 0; i < numCols; i++) {
            columns.push({
                "title": tableObj.fields[i].id
            });
        }

        var szText = "";
        for (var i in columns) {
            szText += (szText.length ? ";" : "") + columns[i].title;
        }
        szText += "\r\n";
        for (i in records) {
            var szRow = "";
            for (var ii in records[i]) {
                szRow += (szRow.length ? ";" : "") + records[i][ii];
            }
            szText += szRow;
            szText += "\r\n";
        }

        return szText;
    };

    // --------------------------------------------------------------------------------------------
    // save content of HTML text area id="oputput" to local filesystem
    // --------------------------------------------------------------------------------------------

    saveAsCSV = function (dataSink) {

        let data = dataSink.data;

        // Process data table with filters if needed
        if (dataSink.facetsFilter && !dataSink.fPivot) {
            data = data.select(dataSink.facetsFilter);
        }

        var textToWrite = dumpTable(data);
        var textFileAsBlob = new Blob([textToWrite], {
            type: 'text/plain'
        });
        var fileNameToSaveAs = "export.csv";

        var downloadLink = document.createElement("a");
        downloadLink.download = fileNameToSaveAs;
        downloadLink.innerHTML = "Download File";
        if (window.URL != null) {
            // Chrome allows the link to be clicked
            // without actually adding it to the DOM.
            downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
        } else {
            // Firefox requires the link to be added to the DOM
            // before it can be clicked.
            downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
            downloadLink.onclick = destroyClickedElement;
            downloadLink.style.display = "none";
            document.body.appendChild(downloadLink);
        }

        downloadLink.click();
    };


})();

// -----------------------------
// EOF
// -----------------------------
