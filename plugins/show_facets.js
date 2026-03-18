/** 
 * @fileoverview This file provides functions to list filter facets
 *
 * @author Guenter Richter guenter.richter@medienobjekte.de
 * @version 1.0 
 * @copyright CC BY SA
 * @license MIT
 */

ixmaps = ixmaps || {};
ixmaps.data = ixmaps.data || {};

(function () {

	// ===========================================
	//
	// h e l p e r
	//
	// ===========================================

	/**
	 * Create a distribution of data values for histograms  
	 * @param szMapDiv the id of the div, where to create the SVG map
	 * @param options javascript object with the creation options
	 * @type object
	 * @return the new ixmaps object
	 */
	const __getScatterArray = (data, nMin, nMax, nTicks, szFlag) => {

		let nCountMax = 0;
		let dValue = 0;

		if (szFlag.match(/LOG/)) {
			dValue = nMin ? 0 : 0.1;
			nMin = Math.log(nMin + dValue);
			nMax = Math.log(nMax + dValue);
		}

		const nPop = (nMax - nMin) / (nTicks - 1);

		const nPopA = [];
		const nTickA = [];
		let nTickVal = nMin;
		// For small ranges, preserve decimal precision in tick values
		const preserveDecimals = (nMax - nMin) < 10;
		for (let i = 0; i < nTicks + 1; i++) {
			nPopA[i] = 0;
			if (szFlag.match(/LOG/)) {
				nTickA[i] = Math.exp(nTickVal);
			} else {
				// For small ranges, keep decimal precision; for larger ranges, use floor
				nTickA[i] = preserveDecimals ? nTickVal : Math.floor(nTickVal);
			}
			nTickVal += nPop;
		}
		
		data.forEach((value) => {
			let xValue = value;
			if (typeof (xValue) == 'number') {
				if (szFlag.match(/LOG/)) {
					xValue = Math.log(xValue + dValue);
				}
				const nPos = Math.max(0, Math.min(nTicks - 1, Math.floor((xValue - nMin) / nPop)));
				nPopA[nPos]++;
				nCountMax = Math.max(nCountMax, nPopA[nPos]);
			}
		});

		return {
			min: nTickA,
			count: nPopA
		};
	};

	// Use helper functions from facet.js (no duplication)
	const { getUniqueValues, scanValue, countValues, isNumericField } = ixmaps.data.facetHelpers;

	
	const hex2rgba = (hex, alpha = 1) => {
	  if (hex.match(/rgb/i)){
		  return hex;
	  }	
	  const [r, g, b] = hex.match(/\w\w/g).map(x => parseInt(x, 16));
	  return `rgba(${r},${g},${b},${alpha})`;
	};	
	
	
	
	// ===========================================
	//
	// facet filter handling 
	//
	// ===========================================

	// -----------------------------------------------
	// set the selected facet filter
	// if this filter is already active, clear filter
	// -----------------------------------------------
	const __setFacetFilter = (szFilter) => {
		
		// if new filter given, add to filter array (delete existent filter of the same data column)
		if (szFilter.length) {

			// get filter without WHERE 
			szFilter = szFilter.split(/WHERE /)[1];

			// Extract field name from new filter
			const newFieldMatch = szFilter.match(/"([^"]+)"/);
			const newField = newFieldMatch ? newFieldMatch[1] : null;

			// Remove any existing filter for the same field (use robust matching)
			ixmaps.data.facetsFilterA = ixmaps.data.facetsFilterA.filter((filterPart) => {
				const match = filterPart.match(/"([^"]+)"/);
				const fieldInFilter = match ? match[1] : null;
				return fieldInFilter !== newField;
			});

			ixmaps.data.facetsFilterA.push(szFilter);
			
			// Track the most recently activated facet field
			ixmaps.data.facetsLastActiveField = newField;
		}

		// Build final filter: Combine base filter + facet filters
		let finalFilterParts = [];
		
		// Add base filter if exists
		if (ixmaps.data.facetsBaseFilter && ixmaps.data.facetsBaseFilter.length > 0) {
			const baseParts = ixmaps.data.facetsBaseFilter.split(/WHERE /)[1];
			if (baseParts) {
				finalFilterParts.push(baseParts);
			}
		}
		
		// Add facet filters
		if (ixmaps.data.facetsFilterA.length > 0) {
			finalFilterParts.push(ixmaps.data.facetsFilterA.join(" AND "));
		}
		
		// Combine all filter parts
		szFilter = finalFilterParts.length ? ("WHERE " + finalFilterParts.join(" AND ")) : null;

		// show filter in input field
		$("#query").val(szFilter);

		// filter items on map
		const objThemesA = ixmaps.getThemes();
		for (const objTheme of objThemesA) {
			if (objTheme.szFlag.match(/CHART|CHOROPLETH/) && !objTheme.szFlag.match(/NOFILTER/)) {
				ixmaps.message('&#9881;');
				if (szFilter) {
					ixmaps.changeThemeStyle(objTheme.szId, `filter:${szFilter || " "}`, "set");
				} else {
					ixmaps.changeThemeStyle(objTheme.szId, "filter", "remove");
				}
			}
		}

	};

	// -------------------------------------------------------------------------
	// set a range filter for a data field
	// if a range is already active on this data field, remove this range before
	// --------------------------------------------------------------------------
		const __setRangeFilter = (szField, szRange, min, max) => {
		const rangeA = szRange.split(",");
		const szFilter = `WHERE "${szField}" BETWEEN ${rangeA[0]} AND ${rangeA[1]}`;
		// delete filter with same field (use robust matching)
		ixmaps.data.facetsFilterA = ixmaps.data.facetsFilterA.filter((filterPart) => {
			const match = filterPart.match(/"([^"]+)"/);
			const fieldInFilter = match ? match[1] : null;
			return fieldInFilter !== szField;
		});
		// Track the most recently activated facet field
		ixmaps.data.facetsLastActiveField = szField;
		__setFacetFilter(szFilter);
	};

	// -------------------------------------------------------------------------
	// set a input field filter
	// --------------------------------------------------------------------------
	const __setFilter = (szField, szFilter) => {
		const szQuery = `WHERE "${szField}" like "${szFilter}"`;
		// delete filter with same field (use robust matching)
		ixmaps.data.facetsFilterA = ixmaps.data.facetsFilterA.filter((filterPart) => {
			const match = filterPart.match(/"([^"]+)"/);
			const fieldInFilter = match ? match[1] : null;
			return fieldInFilter !== szField;
		});
		// Track the most recently activated facet field
		ixmaps.data.facetsLastActiveField = szField;
		__setFacetFilter(szFilter.length ? szQuery : "");
	};

	// -----------------------------------------------
	// remove all filter of one data field
	// -----------------------------------------------
	const __removeFacets = (szField) => {
		// Robust field name extraction from filter string
		ixmaps.data.facetsFilterA = ixmaps.data.facetsFilterA.filter((filterPart) => {
			// Extract field name from filter part using regex
			// Handle various filter formats: "field" = "value", "field" BETWEEN x AND y, etc.
			const match = filterPart.match(/"([^"]+)"/);
			const fieldInFilter = match ? match[1] : null;
			
			// Keep filter if field name doesn't match
			return fieldInFilter !== szField;
		});
		
		__setFacetFilter("");
	};

	// -----------------------------------------------
	// Initialize facet state in ixmaps.data namespace
	// -----------------------------------------------
	ixmaps.data.facetsFilterA = ixmaps.data.facetsFilterA || [];  // Array of active facet filter parts
	ixmaps.data.facetsBaseFilter = ixmaps.data.facetsBaseFilter || "";  // Initial filter (non-facet, preserved)
	ixmaps.data.facetsRangesA = ixmaps.data.facetsRangesA || [];  // Range data for numeric facets
	ixmaps.data.facetsQueryA = ixmaps.data.facetsQueryA || [];  // Filter queries for click handlers
	ixmaps.data.facetsLastActiveField = ixmaps.data.facetsLastActiveField || null;  // Track most recently activated facet field
	ixmaps.data.facetsSortActiveFirst = ixmaps.data.facetsSortActiveFirst !== undefined ? ixmaps.data.facetsSortActiveFirst : true;  // Toggle to sort active facets first
	ixmaps.data.facetsCurrentA = ixmaps.data.facetsCurrentA || null;  // Current facets array for rendering
	
	// Module-only state (not exposed globally)
	let __oldFilter = "";
	let __szFilter = null;
	let __szDiv = null;
	let __facetsA = null;
	let __worldCloudField = null;
	
	// -----------------------------------------------
	// Helper: Separate base filter from facet filters
	// -----------------------------------------------
	const __separateBaseFilter = (szFilter, facetsA) => {
		if (!szFilter || !szFilter.match(/WHERE/)) {
			ixmaps.data.facetsBaseFilter = "";
			ixmaps.data.facetsFilterA = [];
			return;
		}
		
		// Get filter parts
		let filterParts = szFilter.split('WHERE ')[1].split(/\s+AND\s+/);
		
		// Handle BETWEEN x AND y (join two parts around AND)
		for (let i = 0; i < filterParts.length; i++) {
			if (filterParts[i].match(/BETWEEN/)) {
				filterParts[i] = filterParts[i] + " AND " + filterParts[i + 1];
				filterParts.splice(i + 1, 1);
			}
		}
		
		// Get facet field names
		const facetFields = new Set(facetsA.map(f => f.id));
		
		// Separate into base and facet filters
		const baseFilterParts = [];
		const facetFilterParts = [];
		
		for (let part of filterParts) {
			const fieldName = part.split('"')[1];
			if (fieldName && facetFields.has(fieldName)) {
				facetFilterParts.push(part.trim());
			} else {
				baseFilterParts.push(part.trim());
			}
		}
		
		// Store separated filters in ixmaps.data for persistence
		ixmaps.data.facetsBaseFilter = baseFilterParts.length ? ("WHERE " + baseFilterParts.join(" AND ")) : "";
		ixmaps.data.facetsFilterA = facetFilterParts;
	};
	
	const __makeWordCloud = (szField) => {
		if (__worldCloudField == szField) {
			__worldCloudField = null;
		} else {
			__worldCloudField = szField;
		}
		ixmaps.data.showFacets(__szFilter, __szDiv, __facetsA);
	};
	
	const __makeHistogram = (sliderId, szRange) => {

		const rangeA = szRange.split(",");

		// Look up by sliderId in rangesA (which uses original field name as key)
		const rangeData = ixmaps.data.facetsRangesA[Object.keys(ixmaps.data.facetsRangesA).find(key => 
			key.replace(/ |\W/g, "_") === sliderId || key === sliderId
		)];

		if (rangeData && rangeData.data) {

			const objThemeDefinition = ixmaps.getThemeDefinitionObj();
			const objTheme = ixmaps.getThemeObj();

			const fOnMap = (objThemeDefinition.field === rangeData.id);

			const min = rangeData.min;
			const max = rangeData.max;
			const fieldId = rangeData.id;
			const range = max - min;
			
			// For small ranges, check if we have many unique values (likely decimals)
			let nTicks = Math.min(40, (max - min + 1));
			if (range < 10 && rangeData.data && rangeData.data.length > 0) {
				// Count unique values to detect decimal precision
				const uniqueValues = new Set(rangeData.data.map(v => typeof v === 'number' ? v : parseFloat(v)));
				const uniqueCount = uniqueValues.size;
				// If we have many unique values relative to range, increase ticks
				// Aim for at least one bin per 0.1 unit, or use unique count if reasonable
				if (uniqueCount > nTicks * 2) {
					// Use more ticks to preserve decimal detail
					nTicks = Math.min(40, Math.max(nTicks, Math.ceil(uniqueCount / 2)));
					// For very small ranges, ensure we have enough bins for decimal precision
					if (range < 1) {
						nTicks = Math.min(40, Math.max(nTicks, Math.ceil(range * 10)));
					}
				}
			}
			nTicks = (nTicks >= 5) ? nTicks : 40;
			const nStep = (max - min) / nTicks;
			if (nStep > 1 && nStep < 2) {
				nTicks = max - min + 1;
			}

			const szScale = ((max - min) < 40) ? "" : "LOG";
			const fDiscret = (nTicks == max - min);

			const barA = __getScatterArray(rangeData.data, min, max, nTicks, szScale);
			let maxHeight = 0;
			barA.count.forEach((height) => {
				maxHeight = Math.max(maxHeight, height);
			});
			const scale = 75 / maxHeight;
			const width = 210 / nTicks;
			let szHtml = "";

			for (let b = 0; b < barA.count.length - 1; b++) {
				const height = barA.count[b];
				const bMin = barA.min[b];
				const bMax = fDiscret ? barA.min[b] : barA.min[b + 1];
				let color = ((bMax >= rangeA[0]) && (bMin <= rangeA[1])) ? "#888" : "#ddd";

				if (fOnMap) {
					//color = objTheme.partsA[0].color;
					objTheme.partsA.forEach((part) => {
						if (bMin >= part.min) {
							color = part.color;
						}
					});
				}
				const szFilter = `ixmaps.filterThemeItems(null, null, '', { field: '${fieldId}', min: ${bMin}, max: ${bMax} }`;
				const szHighlight = `$(this).css('background','#880000');${szFilter}`;
				const szClearHighlight = "$(this).css('background','');ixmaps.filterThemeItems(null,null,'','remove');";
				const formattedMin = ixmaps.formatValue(bMin, 2, "BLANK");
				const formattedMax = ixmaps.formatValue(bMax, 2, "BLANK");
				szHtml += `<div style='display:inline-block;width:${width}px;background-color:${color};height:${1 + (height * scale)}px;' data-toggle='tooltip' title='${formattedMin} - ${formattedMax}' onmouseover='${szHighlight}' onmouseout='${szClearHighlight}'></div>`;
			}
			szHtml += "</div>";

			// Save scroll position before DOM update
			const scrollParent = $("#facets").parent();
			const scrollTop = scrollParent.scrollTop();
			
			$("#" + sliderId + "histogram").html(szHtml);
			
			// Restore scroll position after DOM update
			scrollParent.scrollTop(scrollTop);
		}
	};

	__oldFilter = "";

	// ---------------------------------------------------
	// highlight map theme items by query
	// select data by query and create list of theme items 
	// highlight this item on the map
	// ---------------------------------------------------

	const __HighlightFacetItems = (szField, szValue) => {
		const objTheme = ixmaps.getThemeObj();
		__oldFilter = objTheme.szFilter;
		if (objTheme && (objTheme.szFlag.match(/AGGREGATE/) || objTheme.szFlag.match(/MULTI/))) {
			if (__oldFilter.match(/WHERE/)) {
				ixmaps.filterThemeItems(null, null, `${__oldFilter} AND "${szField}" = "${szValue}"`, 'set');
			} else {
				ixmaps.filterThemeItems(null, null, `WHERE "${szField}" = "${szValue}"`, 'set');
			}
		} else {
			ixmaps.filterThemeItems(null, null, "", {
				field: szField,
				txt: szValue
			});
		}
	};

	// ===========================================
	//
	// create the html facet list
	//
	// ===========================================

	ixmaps.data.showFacets = function (szFilter, szDiv, facetsA) {
		
		try {
			__szFilter = szFilter;
			__szDiv = szDiv;
			__facetsA = facetsA;

			// Separate base filter from facet filters
			__separateBaseFilter(szFilter, facetsA);
			
			// Sort facets if requested: put active facets first (only if multiple active)
			if (ixmaps.data.facetsSortActiveFirst){
				// Count active facets
				var activeCount = facetsA.filter(function(f){ return f.isActive; }).length;
				
				// Only sort if more than one active facet
				if (activeCount > 1){
					facetsA.sort(function(a, b){
						// Active facets come first
						if (a.isActive && !b.isActive) return -1;
						if (!a.isActive && b.isActive) return 1;
						// Otherwise maintain original order
						return 0;
					});
				}
			}

			const sliderA = [];
			const objThemeDefinition = ixmaps.data.objThemeDefinition;
			const objTheme = ixmaps.data.objTheme;

		szDiv = (szDiv || "facets");

		let szHtml = "";
		
		// Add CSS for dual range slider thumbs (only once)
		if (!document.getElementById('dual-slider-styles')) {
			const style = document.createElement('style');
			style.id = 'dual-slider-styles';
			style.textContent = `
				input[type=range].dual-slider::-webkit-slider-thumb {
					-webkit-appearance: none;
					pointer-events: auto;
					width: 20px;
					height: 20px;
					background: #888;
					border-radius: 50%;
					border: 2px solid #555;
					cursor: pointer;
					margin-top: -6px;
					position: relative;
					z-index: 2;
				}
				input[type=range].dual-slider:focus::-webkit-slider-thumb {
					background: #666;
				}
				input[type=range].dual-slider::-moz-range-thumb {
					pointer-events: auto;
					width: 20px;
					height: 20px;
					background: #888;
					border-radius: 50%;
					border: 2px solid #555;
					cursor: pointer;
					position: relative;
					z-index: 2;
				}
				input[type=range].dual-slider:focus::-moz-range-thumb {
					background: #666;
				}
			`;
			document.head.appendChild(style);
		}
		
		const szHighlight = '$(".shareIcon").show()';
		const szClearHighlight = '$(".shareIcon").hide()';
		szHtml += `<div id='list-facets' class='list-group' style='width:100%;margin-bottom:5em;' onmouseover='${szHighlight}' onmouseout='${szClearHighlight}'>`;

		// create an array of the filter to pass them to the executing function
		// to avoid problems with special characters " and '
		ixmaps.data.facetsQueryA.length = 0;  // Clear array instead of creating new one

		// Store facets for access by index
		ixmaps.data.facetsCurrentA = facetsA;
		
		// loop over facets array and create HTML to show the facets
		//
		let currentFacetIndex = -1;
		for (let i = 0; i < facetsA.length; i++) {
			currentFacetIndex = i;

			// Use facet properties instead of manual checking
			const fActiveFacet = facetsA[i].isActive || false;
			const szActiveFilter = facetsA[i].activeFilter || null;

			// replace all non word characters with underscore
			const szSafeId = facetsA[i].id.replace(/ |\W/g, "_");

			szHtml += fActiveFacet ? "<div class='facet-active'>" : "<div class='facet'>";

			// ------------------------------
			// facet header - with fieldname
			// ------------------------------

			const bgColor = fActiveFacet ? "#884444" : "#888888";

			const szMin = ixmaps.formatValue(facetsA[i].min, 2, "BLANK");
			const szMax = ixmaps.formatValue(facetsA[i].max, 2, "BLANK");

			// Use facet index to avoid any escaping issues with special characters
			const removeAttr = fActiveFacet ? ` onclick="__removeFacets(ixmaps.data.facetsCurrentA[${i}].id); return false;" style='cursor:pointer;color:white'` : "";
			szHtml += fActiveFacet ? `<a ${removeAttr}>` : "";
			szHtml += "<div style='font-family:arial;font-size:1.1em;text-align:left;padding:0.5em 0.5em 0.5em 0.5em;margin:1em 0 0.4em 0;background:" + bgColor + ";border-radius:5px;color:white'>";
			szHtml += facetsA[i].id;

			if (facetsA[i].data &&
				facetsA[i].data.length &&
				!isNaN(facetsA[i].min) &&
				!isNaN(facetsA[i].max) &&
				(facetsA[i].min < facetsA[i].max)) {
				szHtml += (typeof (facetsA[i].min) != "undefined") ? ((facetsA[i].min != facetsA[i].max) ? (": " + szMin + " - " + szMax) : (": " + szMin)) : "";
			}

			szHtml += fActiveFacet ? "<span style='float:right;margin-right:0em;padding-top:0em;'><i class='icon shareIcon share_bitly icon-cancel-circle' title='Share a short link' tabindex='-1'></i></span>" : "";
			if ((facetsA[i].type == "textual") && !facetsA[i].values){
				szHtml += `<a onclick="__makeWordCloud(ixmaps.data.facetsCurrentA[${i}].id); return false;" style='cursor:pointer'><span style='float:right;margin-right:0em;padding-top:0em;color:white'><i class='icon shareIcon share_bitly icon-cloud' title='Share a short link' tabindex='-1'></i></span></a>`;
			}
			
			szHtml += "</div>";
			szHtml += fActiveFacet ? "</a>" : "";

		if (facetsA[i].type == "textual") {
			let placeholder = "Filtra per ..." + ((!facetsA[i].values) ? (" (e.g. " + (facetsA[i].example || " ") + ")") : "");
			let value = "";
			if (fActiveFacet && szActiveFilter) {
				value = placeholder = szActiveFilter.split("\"")[3] || "";
			}
			if ( !facetsA[i] || !facetsA[i].values || facetsA[i].values.length > 10){
				const inputId = szSafeId + "query";
				szHtml += '<div class="input-group" style="margin-bottom:0.5em;margin-left:0.1em;width:100%" >';
				szHtml += `<input id="${inputId}" type="text" class="form-control" style="background:transparent;border:none" value="${value}" placeholder="${placeholder}" data-facet-index="${i}"`;
				szHtml += ` onKeyUp="if(event.which == 13){var value = this.value; __setFilter(ixmaps.data.facetsCurrentA[this.getAttribute('data-facet-index')].id, value);}">`;
				szHtml += '<span class="input-group-btn" style="float:right;margin-left:-0.5em;margin-right:0.2em;">';
				szHtml += `<button class="btn btn-search" style="border:none" type="button" onclick="var input=document.getElementById('${inputId}'); __setFilter(ixmaps.data.facetsCurrentA[input.getAttribute('data-facet-index')].id, input.value);"><i class="icon shareIcon share_bitly icon-search" title="Search by text" tabindex="-1"></i> </button>`;
				szHtml += '</span></input>';
				szHtml += '</div>'
			}else{
				szHtml += '<div class="input-group" style="margin-bottom:0.5em" >';
				szHtml += '</div>'
			}
		if ( facetsA[i].id == __worldCloudField ){
			const szTarget = "thisismywordcloud"+facetsA[i].id.replace(/[\W_]/g, "_");
			szHtml += "<div id='"+szTarget+"'><div style='width:100%;text-align:center'><i class='icon shareIcon share_bitly icon-cloud' title='Share a short link' style='color:#888888;font-size:36px' tabindex='-1'></i><br><svg width='28' height='28' viewBox='0 0 24 24' style='display:inline-block'><circle cx='12' cy='12' r='10' fill='none' stroke='#1e90f0' stroke-width='3' stroke-linecap='round' stroke-dasharray='31.4 31.4' transform='rotate(0 12 12)'><animateTransform attributeName='transform' type='rotate' from='0 12 12' to='360 12 12' dur='1s' repeatCount='indefinite'/></circle></svg></div></div>";
			// Use index-based approach to avoid escaping issues
			const facetIdx = i;
			setTimeout(() => {
				ixmaps.data.makeWordCloud(objTheme.szId, ixmaps.data.facetsCurrentA[facetIdx].id, szTarget);
			}, 100);
		}
			}

			// ------------------------------------
			// make facet content, different types
			// ------------------------------------
			
			const localTextA = {
				M1: "M1 - Digitalizz., innov., competi., cultura e turismo",
				M2: "M2 - Rivoluzione verde e trans. eco.",
				M3: "M3 - Infrastrutture per una mobilità sostenibile",
				M4: "M4 - Istruzione e ricerca",
				M5: "M5 - Inclusione e coesione",
				M6: "M6 - Salute"
			};

			if (typeof (facetsA[i].min) != "undefined" &&
				!isNaN(facetsA[i].min) &&
				!isNaN(facetsA[i].max) &&
				(facetsA[i].min < facetsA[i].max)) {

				// ---------------------------------
				// type A
				// continous value facet
				// make min/max slider
				// ---------------------------------
				
				if (!ixmaps.data.facetsRangesA[facetsA[i].id] || !fActiveFacet) {
					ixmaps.data.facetsRangesA[facetsA[i].id] = {
						min: facetsA[i].min,
						max: facetsA[i].max,
						data: facetsA[i].data,
						id: facetsA[i].id
					};
				}

				const min = ixmaps.data.facetsRangesA[facetsA[i].id].min;
				const max = ixmaps.data.facetsRangesA[facetsA[i].id].max;
				
				// Parse active filter to get actual slider values if filter is active
				let sliderMin = facetsA[i].min;
				let sliderMax = facetsA[i].max;
				if (fActiveFacet && szActiveFilter && szActiveFilter.match(/BETWEEN/)) {
					const betweenMatch = szActiveFilter.match(/BETWEEN\s+([\d.]+)\s+AND\s+([\d.]+)/i);
					if (betweenMatch) {
						sliderMin = parseFloat(betweenMatch[1]);
						sliderMax = parseFloat(betweenMatch[2]);
					}
				}
				
				const szMin = ixmaps.formatValue(sliderMin, 2, "BLANK");
				const szMax = ixmaps.formatValue(sliderMax, 2, "BLANK");

				const href = "#";
				const bgColor = "#eeeeee";
				const szCount = "";

				// make histogram
				// ---------------------------------

				if (facetsA[i].data) {

					const fOnMap = (objThemeDefinition.field == facetsA[i].id);

					const sliderId = szSafeId;
					const range = max - min;
					
					// For small ranges, check if we have many unique values (likely decimals)
					let nTicks = Math.min(40, (max - min + 1));
					if (range < 10 && facetsA[i].data && facetsA[i].data.length > 0) {
						// Count unique values to detect decimal precision
						const uniqueValues = new Set(facetsA[i].data.map(v => typeof v === 'number' ? v : parseFloat(v)));
						const uniqueCount = uniqueValues.size;
						// If we have many unique values relative to range, increase ticks
						// Aim for at least one bin per 0.1 unit, or use unique count if reasonable
						if (uniqueCount > nTicks * 2) {
							// Use more ticks to preserve decimal detail
							nTicks = Math.min(40, Math.max(nTicks, Math.ceil(uniqueCount / 2)));
							// For very small ranges, ensure we have enough bins for decimal precision
							if (range < 1) {
								nTicks = Math.min(40, Math.max(nTicks, Math.ceil(range * 10)));
							}
						}
					}
					nTicks = (nTicks >= 5) ? nTicks : 40;

					let nStep = (max - min) / nTicks;
					if (nStep > 1 && nStep < 2) {
						nTicks = max - min;
					}

					const szScale = ((max - min) < 40) ? "" : "LOG";

					const barA = __getScatterArray(ixmaps.data.facetsRangesA[facetsA[i].id].data, min, max, nTicks, szScale);
					let maxHeight = 0;
					barA.count.forEach((height) => {
						maxHeight = Math.max(maxHeight, height);
					});
					const fDiscret = (nTicks == max - min + 1);
					const scale = 75 / maxHeight;
					const width = 210 / nTicks;
					szHtml += '<div style="background:#eeeeee;margin-top:0.4em;border-radius:5px;">'

					szHtml += '<div id="' + sliderId + 'histogram" style="padding-top:2em;margin-left:1em">';
					for (let b = 0; b < barA.count.length - 1; b++) {
						const height = barA.count[b];
						const bMin = barA.min[b];
						const bMax = fDiscret ? barA.min[b] : barA.min[b + 1];
						const szbMin = ixmaps.formatValue(bMin, bMin < 100 ? 2 : 0, "BLANK");
						const szbMax = ixmaps.formatValue(bMax, bMax < 100 ? 2 : 0, "BLANK");
						const fActive = ((bMax >= facetsA[i].min) && (bMin <= facetsA[i].max));
						let color = fActive ? "#888" : "#ddd";
						if (fOnMap) {
							//color = objTheme.partsA[0].color;
							objTheme.partsA.forEach((part) => {
								if (bMin >= part.min) {
									color = part.color;
								}
							});
						}

					const szTooltip = fDiscret ? String(bMin) : ixmaps.formatValue(bMin, 2, "BLANK") + ' - ' + ixmaps.formatValue(bMax, 2, "BLANK");
					const szFilter = `ixmaps.filterThemeItems(null, null, "", { field: "${facetsA[i].id}", min: ${bMin}, max: ${bMax} });`;
					const szHighlight = "$(this).css(\"border\",\"solid #ffffff 0.5px\");";
					const szClearHighlight = "$(this).css(\"border\",\"\");";

					szHtml += `<div style='display:inline-block;width:${width}px;background-color:${color};height:${1 + (height * scale)}px;' `;
					szHtml += ` data-toggle='tooltip' title='${szTooltip}' data-facet-index='${i}' data-range='${bMin},${bMax}' onclick="__setRangeFilter(ixmaps.data.facetsCurrentA[this.getAttribute('data-facet-index')].id, this.getAttribute('data-range'), 0, 0)"`;
					szHtml += fActive ? ` onmouseover='${szHighlight}' onmouseout='${szClearHighlight}'>` : ">";
					szHtml += "</div>";
						//szHtml += "<div style='display:inline-block;width:" + width + "px;background-color:" + color + ";height:" + (1 + (height * scale)) + "px;' data-toggle='tooltip' title='" + (szbMin + ' - ' + szbMax) + "'></div>";
					}
					szHtml += "</div>";

					// make slider
					// ---------------------------------

				// Calculate step for slider (range already declared above)
				// For small ranges with decimals, use finer step
				let step;
				if (range < 1) {
					// For very small ranges, use 0.01 or 0.001 depending on range
					step = range < 0.1 ? 0.001 : 0.01;
				} else if (range < 10) {
					// For small ranges, use 0.1 or 0.01 depending on range
					step = range < 1 ? 0.01 : 0.1;
				} else if (range < 100) {
					step = 1;
				} else {
					step = Math.pow(10, Math.floor(Math.log10(range / 100)));
				}
				
				sliderA.push({
					id: sliderId,
					field: facetsA[i].id,
					scale: szScale,
					min: min,
					max: max,
					step: step,
					ticks: nTicks,
					currentMin: sliderMin,
					currentMax: sliderMax
				});
				
				// Dual handle HTML5 range slider (using overlapping technique from test_slider.html)
				// Clipped to histogram width (210px)
				szHtml += '<div style="margin:0em 0em 0.5em 0em;background:#eee;border-radius:5px;padding:0.5em 0.5em 1em 0.5em">';
				szHtml += '<div style="display:flex;justify-content:space-between;margin-bottom:0.3em;max-width:210px;margin-left:1em;">';
				szHtml += `<span id="${sliderId}_minlabel" class="minvalue" style="font-size:0.9em;">${szMin}</span>`;
				szHtml += `<span id="${sliderId}_maxlabel" class="maxvalue" style="font-size:0.9em;">${szMax}</span>`;
				szHtml += '</div>';
				szHtml += '<div style="position:relative;height:33px;max-width:210px;margin-left:1em;">';
				szHtml += '<div class="slider-track" style="position:absolute;height:8px;border-radius:4px;background:#ddd;top:8px;width:100%;z-index:1;"></div>';
				szHtml += `<div class="slider-range" id="${sliderId}_range" style="position:absolute;height:8px;border-radius:4px;background:#888;top:8px;z-index:1;"></div>`;
				szHtml += `<input type="range" class="dual-slider" id="${sliderId}_min" min="${min}" max="${max}" value="${sliderMin}" step="${step}" style="position:absolute;left:0;top:11px;width:100%;height:8px;background:transparent;margin:0;-webkit-appearance:none;pointer-events:none;" data-slider-id="${sliderId}" data-field="${facetsA[i].id}"/>`;
				szHtml += `<input type="range" class="dual-slider" id="${sliderId}_max" min="${min}" max="${max}" value="${sliderMax}" step="${step}" style="position:absolute;left:0;top:11px;width:100%;height:8px;background:transparent;margin:0;-webkit-appearance:none;pointer-events:none;" data-slider-id="${sliderId}" data-field="${facetsA[i].id}"/>`;
				szHtml += '</div>';
				szHtml += '</div>';

					szHtml += '</div>'
				}
			} else
			if (facetsA[i].values) {
				
				if (facetsA[i].values.length == 0){
					szHtml += '<div>'+facetsA[i].values.length+'</div>';
				}

				// ---------------------------------
				// type B
				// unique value facet
				// ---------------------------------

				szHtml += '<div>'

				// if more than 20 items, clip list to 10
				// --------------------------------------
				const maxII = (facetsA[i].values.length < 12) ? facetsA[i].values.length : 10;

				for (let ii = 0; ii < facetsA[i].values.length; ii++) {
					
					if (facetsA[i].values[ii].length && (facetsA[i].values[ii] != " ")) {

					// make the facet filter 
					const szQuery = `WHERE "${facetsA[i].id}" = "${facetsA[i].values[ii]}"`;

					// make href, pass filter by filter array to avoid " or ' conflicts
					ixmaps.data.facetsQueryA.push(szQuery);
					const href = `javascript:__setFacetFilter(ixmaps.data.facetsQueryA[${ixmaps.data.facetsQueryA.length - 1}]);`;

						// how often is the value in the column
						const nCount = facetsA[i].valuesCount ? facetsA[i].valuesCount[facetsA[i].values[ii]] : null;
						const nMaxCount = facetsA[i].nValuesSum || facetsA[i].nCount;

						let bgColor = "";
						const szCount = ixmaps.formatValue(nCount, 0, "BLANK") + " " + (ixmaps.data.fShowFacetValues ? (objTheme.szUnits || "") : "");
						
						let szText = facetsA[i].values[ii];
						
						if ((objThemeDefinition.field == facetsA[i].id)) {
							try {
								bgColor = hex2rgba(objTheme.colorScheme[objTheme.nStringToValueA[facetsA[i].values[ii]] - 1],0.7);
								if ( objTheme.szLabelA && objTheme.szValuesA ){
									szText = objTheme.szLabelA[objTheme.nStringToValueA[facetsA[i].values[ii]] - 1];
								}
							} catch (e) {}
						}

						if ( localTextA[szText] ){
							szText = localTextA[szText];
						}

						// facet button with one unique value
						// -----------------------------------
						szHtml += '<a href="' + href + '" style="text-decoration:none">';
						szHtml += '<div class="input-group" style="margin-bottom:0em;width:100%">';
						
						if (facetsA[i].type == "textual") {
							if (fActiveFacet) {
								value = szActiveFilter.split("\"")[3];
								if ( value ){
									value = value.replace("\/", "\\\/");
									if ( value != "*" ){
										var szTextA = eval("szText.split(/" + value + "/i)");
										szText = szTextA.join("<span style='color:#000000;background:#ffff00;padding:0 0.2em;'>" + value + "</span>");
									}
								}
							}
						}
						szHtml += '<button type="button" class="btn btn-block btn-primary " style="width:100%;border:none;border-bottom:solid rgba(128,128,128,0.3) 0.1px;border-radius:0;"> <i class="icon shareIcon share_bitly icon-filter" style="float:left;margin-left:-0.5em;margin-right:1em;padding-top:0.2em;color:#888888;display:none" title="filter by this" tabindex="-1"></i><span style="margin-left:-0.5em;float:left;white-space:normal;text-align:left;margin-top:0.2em">' + szText + '</span><span class="badge badge-primary badge-pill pull-right" style="top:0.1em;right:-0.25em;float:right;text-align:right;font-size:18px">' + szCount + '</span></button>';
						
						bgColor = "rgba(208,208,208,1)";
						if (objTheme.nParts > 1) {
							bgColor = objTheme.colorScheme[0];
						} else if ((objThemeDefinition.field == facetsA[i].id)) {
							bgColor = hex2rgba(objTheme.colorScheme[objTheme.nStringToValueA[facetsA[i].values[ii]] - 1] || objTheme.colorScheme[0] || "none");
						}

						const nWidth = (100 / nMaxCount * nCount);
						if (!isNaN(nWidth) && (nWidth < 100) && (facetsA[i].uniqueValues >= 2)) {
							
							szHtml += '<div style="position:relative;top:-7px;left:0.3em;background:'+bgColor+';line-height:0.4em;width:' + nWidth + '%;border-radius:0 0.5em 0.5em 0">&nbsp;</div>';
						}

						szHtml += '</div>';
						szHtml += '</a>';
					}

					// clip list to max itema
					// --------------------------------------
					if (ii == maxII) {
						szHtml += '</div>';
						szHtml += '<div id="' + (szSafeId + "plus") + '" style="display:none">';
					}

				}
				szHtml += '</div>';
				szHtml += '<div>';

				// if list clipped, make butto to expand 
				// --------------------------------------
				if (facetsA[i].values.length > maxII) {
					szHtml += '<a ><button type="button" class="btn btn-default " style="padding:0.2em 0.5em" onclick="$(this).hide();$(\'#' + (szSafeId + "plus") + '\').toggle();">+ ' + (facetsA[i].values.length - maxII) + '</button></a>';
				}

				szHtml += "</div>";
			} else {
				// facet has no property .values 
				// may be there are 0 or to many unique values when creating the facet
				//szHtml += '(too many values)';
			}
			szHtml += "</div>";

		}
		szHtml += "</div>";
		$("#"+szDiv).html(szHtml);
		
			// Scroll to the most recently activated facet
		if (ixmaps.data.facetsLastActiveField){
			// Find the facet with the matching field name and scroll to it
			var targetFacet = $(".facet-active").filter(function(){
				var headerText = $(this).find('div').first().text();
				// Handle cases where the header might have "name: min - max" or just "name"
				var fieldName = headerText.split(':')[0].trim();
				return fieldName === ixmaps.data.facetsLastActiveField;
			})[0];
			if (targetFacet){
				$("#"+szDiv).parent().scrollTop(targetFacet.offsetTop-$("#"+szDiv)[0].offsetTop)+"px";
			}
		}
		
		// Initialize HTML5 dual range sliders (using technique from test_slider.html)
		if (sliderA.length > 0) {
			sliderA.forEach((slider) => {
				const sliderMin = document.getElementById(slider.id + "_min");
				const sliderMax = document.getElementById(slider.id + "_max");
				const sliderRange = document.getElementById(slider.id + "_range");
				const minLabel = document.getElementById(slider.id + "_minlabel");
				const maxLabel = document.getElementById(slider.id + "_maxlabel");

				if (!sliderMin || !sliderMax || !sliderRange) return;

				// Update ONLY visual range indicator (no DOM updates, no histogram)
				const updateVisualRange = () => {
					let minVal = parseFloat(sliderMin.value);
					let maxVal = parseFloat(sliderMax.value);

					// Prevent overlap (maintain minimum gap)
					// For small ranges, use the step value; for larger ranges, use at least 1
					const minGap = slider.step || (slider.max - slider.min < 10 ? 0.1 : 1);
					if (minVal > maxVal - minGap) {
						minVal = maxVal - minGap;
						sliderMin.value = minVal;
					}
					if (maxVal < minVal + minGap) {
						maxVal = minVal + minGap;
						sliderMax.value = maxVal;
					}

					// Update ONLY the visual range indicator (CSS only, no reflow)
					const percent1 = ((minVal - slider.min) / (slider.max - slider.min)) * 100;
					const percent2 = ((maxVal - slider.min) / (slider.max - slider.min)) * 100;
					sliderRange.style.left = percent1 + '%';
					sliderRange.style.width = (percent2 - percent1) + '%';
					
					// Update numeric labels with proper formatting
					if (minLabel) minLabel.textContent = ixmaps.formatValue ? ixmaps.formatValue(minVal, 2, "BLANK") : minVal;
					if (maxLabel) maxLabel.textContent = ixmaps.formatValue ? ixmaps.formatValue(maxVal, 2, "BLANK") : maxVal;
				};

				// Apply filter when slider is released
				const applyFilter = () => {
					const minVal = parseFloat(sliderMin.value);
					const maxVal = parseFloat(sliderMax.value);
					
					// DISABLED: __makeHistogram causes scroll issues
					// __makeHistogram(slider.id, minVal + "," + maxVal);
					
					// Apply filter
					__setRangeFilter(slider.field, minVal + "," + maxVal, slider.min, slider.max);
				};

				// Event listeners
				// While dragging: only update visual (fast, no scroll issues)
				sliderMin.addEventListener('input', updateVisualRange);
				sliderMax.addEventListener('input', updateVisualRange);
				
				// On release: apply filter (histogram disabled to prevent scroll issues)
				sliderMin.addEventListener('change', applyFilter);
				sliderMax.addEventListener('change', applyFilter);

				// Initialize slider on page load
				updateVisualRange();
				// DISABLED: Initial histogram also causes issues
				// __makeHistogram(slider.id, slider.currentMin + "," + slider.currentMax);
			});
		}

		} catch (error) {
			console.error("ERROR in showFacets:", error.message);
			console.error("Facet index:", currentFacetIndex, facetsA?.[currentFacetIndex]?.id);
			console.error(error.stack);
			
			// Display error to user
			$("#" + (szDiv || "facets")).html(`
				<div style="padding:20px;color:red;background:#fee;">
					<h4>Error displaying facets</h4>
					<p><strong>${error.message}</strong></p>
					<p>Check console for details</p>
					<button onclick="location.reload()">Reload Page</button>
				</div>
			`);
		}
	};

	// ===========================================
	//
	// E X P O S E   A P I   F O R   H T M L   H A N D L E R S
	//
	// ===========================================
	
	// Expose filter functions globally so HTML onclick handlers can access them
	window.__setFacetFilter = __setFacetFilter;
	window.__setRangeFilter = __setRangeFilter;
	window.__setFilter = __setFilter;
	window.__removeFacets = __removeFacets;
	window.__makeWordCloud = __makeWordCloud;
	window.__HighlightFacetItems = __HighlightFacetItems;
	
	// Toggle function to switch between sorted and unsorted facet display
	const __toggleSortActiveFacets = function(){
		ixmaps.data.facetsSortActiveFirst = !ixmaps.data.facetsSortActiveFirst;
		// Re-render facets with new sort order
		if (__szFilter !== null && __szDiv && __facetsA){
			ixmaps.data.showFacets(__szFilter, __szDiv, __facetsA);
		}
	};
	window.__toggleSortActiveFacets = __toggleSortActiveFacets;
	
	// Note: State variables (facetsQueryA, facetsFilterA, facetsRangesA, facetsBaseFilter, etc.) 
	// are now initialized in ixmaps.data namespace (lines 206-216)

	/**
	 * end of namespace
	 */

})();

// -----------------------------
// EOF
// -----------------------------
