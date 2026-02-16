/** 
 * @fileoverview This file provides functions for a HTML layer legend
 *
 * @author Guenter Richter guenter.richter@medienobjekte.de
 * @version 1.0 
 * @copyright CC BY SA
 * @license MIT
 */

window.ixmaps = window.ixmaps || {};

(function () {

	// --------------------------------
	// h e l p e r 
	// --------------------------------

	var __Utf8 = {

		// public method for url encoding
		encode: function (string) {
			string = string.replace(/\r\n/g, "\n");
			var utftext = "";

			for (var n = 0; n < string.length; n++) {

				var c = string.charCodeAt(n);

				if (c < 128) {
					if (string[n] == '&' || string[n] == '"' || string[n] == '<' || string[n] == '>') {
						utftext += "&#";
						utftext += String(c);
						utftext += ";";
					} else {
						utftext += String.fromCharCode(c);
					}
				} else if ((c > 127) && (c < 2048)) {
					utftext += "&#";
					utftext += String(c);
					utftext += ";";
				} else {
					utftext += "&#";
					utftext += String(c);
					utftext += ";";
				}

			}

			return utftext;
		},

		// public method for url decoding
		decode: function (utftext) {
			var string = "";
			var i = 0;
			var c = c1 = c2 = 0;

			while (i < utftext.length) {

				c = utftext.charCodeAt(i);

				if (c < 128) {
					string += String.fromCharCode(c);
					i++;
				} else if ((c > 191) && (c < 224)) {
					c2 = utftext.charCodeAt(i + 1);
					string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
					i += 2;
				} else {
					c2 = utftext.charCodeAt(i + 1);
					c3 = utftext.charCodeAt(i + 2);
					string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
					i += 3;
				}

			}

			return string;
		}

	}

	/**
	 * __listOneNode  
	 * @param oneNode the DOM node to list
	 * @type string
	 * @return node code
	 */
	var depth = 0;

	function __listOneNode(oneNode) {

		var htmla = new String("");

		var attrs = null;
		if (attrs = oneNode.attributes) {
			for (i = 0; i < attrs.length; i++) {
				var nAttr = attrs.item(i);
				htmla += " " + nAttr.name + "=\"" + __Utf8.encode(nAttr.value) + "\"";
			}
		}
		if (oneNode.nodeName == "#text") {
			if (oneNode.nodeValue.length && !(oneNode.nodeValue.charCodeAt(0) == 10)) {
				htmla += __Utf8.encode(oneNode.nodeValue.replace(/\n\t+/g, ''));
			} else {
				return "";
			}
		}
		if (oneNode.nodeName == "#cdata-section") {

			if (1 || (oneNode.parentNode.nodeName == "style")) {
				htmla += "<![CDATA[\n";
				htmla += oneNode.nodeValue;
				htmla += "]]>\n";
				return htmla;
			}
			return "";
		}
		if (oneNode.nodeName == "#text") {
			return htmla;
		}
		return "<" + oneNode.nodeName + " " + htmla + " >\n";
	}

	/**
	 * __listNodewithChilds  
	 * @param originalNode the DOM node to start listing
	 * @type string
	 * @return node and child code
	 */
	function __listNodewithChilds(originalNode) {

		var szIndent = "  ";

		var s = "";
		if (!originalNode.nodeName.match(/#/)) {
			for (var i = 0; i < depth; i++) {
				s += szIndent;
			}
		}

		s += __listOneNode(originalNode);

		if (originalNode.hasChildNodes()) {

			depth++;

			var collChilds = originalNode.childNodes;
			for (var c = 0; c < collChilds.length; c++) {
				s += __listNodewithChilds(collChilds.item(c));
			}
			depth--;
		}

		if (!originalNode.nodeName.match(/#/)) {
			for (var i = 0; i < depth; i++) {
				s += szIndent;
			}
			s += "</" + originalNode.nodeName + ">\n";
		}

		return s;
	}

	/**
	 * __inFilter  
	 * check if sublayer is filtered 
	 * @param layer the layer object
	 * @param c the sublayer name
	 * @type boiolean
	 * @return true if sublayer is in filter value
	 */
	__inFilter = function (layer, c) {
		var filterA = layer.szFilterValue.split("|");
		for (i in filterA) {
			if (filterA[i] == c) {
				return true;
			}
		}
		return false;
	}

	/**
	 * ixmaps.__switchLayer  
	 * switch one layer/sublayer on/off dependent of the checked value  
	 * @param el the caller (HTML) element 
	 * @param szLayer the layer name
	 * @type void
	 */
	ixmaps.__switchLayer = function (el, szLayer) {
		szLayer = szLayer.replace(/\'/g, "&#x27;");
		ixmaps.map().switchLayer(szLayer, $(el).is(":checked"));
		ixmaps.makeLayerLegend();
	}

	/**
	 * ixmaps.__switchMasterLayer  
	 * switch all sublayer of a master layer on/off dependent of the checked value 
	 * to switch, trigger the legend checkboxes of the sublayer
	 * @param el the caller (HTML) element 
	 * @param szLayer the layer name
	 * @type void
	 */
	ixmaps.__switchMasterLayer = function (el, szLayer) {
		var subLayerList = $($(el)[0].parentNode).find('input.sub_check');
		for (var i = 0; i < subLayerList.length; i++) {
			$(subLayerList[i]).prop('checked', $(el).is(":checked"));
			$(subLayerList[i]).trigger('change');
		}
		ixmaps.makeLayerLegend();
	}

	// --------------------------------
	// m a i n   c o d e    
	// --------------------------------

	/**
	 * __getLayerColor
	 * Extract color from layer for display in legend patch
	 * @param layer the layer object
	 * @type string
	 * @return color value (hex or rgb)
	 */
	__getLayerColor = function(layer) {
		// Try to get color from first category
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
		switch(layer.szType) {
			case "polygon": return "#4a90e2";
			case "line": return "#e24a4a";
			case "point": return "#4ae24a";
			default: return "#888888";
		}
	};

	/**
	 * __makeLayerlistItem
	 * Create a simple layer list item with colored patch and name
	 * @param layer the layer object
	 * @param name the layer name
	 * @type string
	 * @return the legend element (HTML)
	 */
	__makeLayerlistItem = function(layer, name) {
		var color = __getLayerColor(layer);
		var displayName = layer.szLegendName || layer.szName || name;
		
		return '<div class="layerlist-item">' +
			   '<span class="layer-patch" style="background-color:' + color + '"></span>' +
			   '<span class="layer-name">' + displayName + '</span>' +
			   '</div>';
	};

	/**
	 * __makeLegendType  
	 * make a part of the layer legend 
	 * generates the legend elements of one layer with the given type (polygon,polyline,point,..) 
	 * the layer may have sublayer
	 * @param layer the layer object
	 * @param name the layer name
	 * @param type the type of the layer (polygon,polyline,point,..)
	 * @type string
	 * @return the legend element (HTML)
	 */
	__makeLegendType = function (layer, name, type) {

		var szLegend = "";

		if (layer.categoryA && (layer.szType == type)) {

			var sub = false;
			for (c in layer.categoryA) {
				if (c && (layer.categoryA[c].type != "single") && (layer.categoryA[c].legendname)) {
					sub = true;
				}
			}

			if (0) {
				var szChecked = (layer.nState == false) ? "" : "checked=\"checked\"";

				szLegend += "<li style='margin-top:1.5em;'>";
				szLegend += '<input type="checkbox" class="check" ' + szChecked + ' onchange="javascript:ixmaps.__switchMasterLayer($(this),\'' + name + '\');">';
				szLegend += '<span style="font-size:1.3em;line-height:0.8em;">&nbsp;' + layer.szLegendName + '</span>';
			}
			if (sub) {
				var szChecked = (layer.nState == false) ? "" : "checked=\"checked\"";

				szLegend += "<li style='margin-top:1.5em;'>";
				szLegend += '<div class="checkbox layerheader"><label>';
				szLegend += '<input type="checkbox" class="check" ' + szChecked + '  onchange="javascript:ixmaps.__switchMasterLayer($(this),\'' + name + '\');">';
				szLegend += '<span class="cr" style="font-size:1.2em"><i class="cr-icon fa fa-check fa-fw"></i></span>';
				szLegend += '<span style="font-size:1.3em;line-height:1.2em;text-decoration:none">&nbsp;' + layer.szLegendName + '</span>';
			}

			szLegend += sub ? "<div class='list-group' style='margin-top:0.5em;margin-bottom:0.5em;'>" : "";

			var szChecked = (layer.szDisplay == "none") ? "" : "checked=\"checked\"";

			switch (layer.szType) {
				case "point":
					for (c in layer.categoryA) {
						if (c == "" || (layer.szFilter && layer.szFilterValue && !__inFilter(layer, c))) {
							continue;
						}
						var szCatogoryName = layer.categoryA[c].legendname || layer.szLegendName;
						szCatogoryName = (c && (szCatogoryName != "(null)")) ? szCatogoryName : layer.szLegendName;
						szLegend += "<div class='list-group-item'>";
						szLegend += '<div class="checkbox" style="font-size:0.8em;float:right;padding:0;margin-top:5px;margin-right:-10px;margin-left:0px"><label>';
						szLegend += '<input type="checkbox" class="check sub_check" ' + szChecked + ' style="margin:0.4em 0em 0 0.2em;float:right" onchange="javascript:ixmaps.__switchLayer($(this),\'' + name + ((c && (layer.categoryA[c].legendname)) ? ('::' + String(c).replace(/\'/g, "\\\'")) : '') + '\');">&nbsp;';
						szLegend += '<span class="cr"><i class="cr-icon fa fa-check fa-fw"></i></span>';
						szLegend += "</label></div>";
						szLegend += "<span style='vertical-align:-0.1em;font-size:1.5em;line-height:0.8em;color:" + layer.categoryA[c].fill + "'>&#8226;</span>&nbsp;&nbsp;" + szCatogoryName + "</div>";
					}
					break;
				case "line":
					for (c in layer.categoryA) {
						if (c == "" || (c && c != "null" && layer.szFilter && layer.szFilterValue && !__inFilter(layer, c))) {
							continue;
						}
						szChecked = (layer.categoryA[c].display == "none") ? "" : "checked=\"checked\"";

						var szCatogoryName = layer.categoryA[c].legendname || layer.szLegendName;
						szCatogoryName = (c && (szCatogoryName != "(null)")) ? szCatogoryName : layer.szLegendName;
						var szCategory = (c && (c != "null")) ? c : name;
						szLegend += "<div class='list-group-item'>";
						szLegend += "<div class='list-group-item-left'>";
						szLegend += "<span style='vertical-align:1.1em;font-size:0.2em;margin-left:0.3em;background:" + layer.categoryA[c].fill + "'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>";
						szLegend += "</div><div class='list-group-item-right'>";
						szLegend += "<span style='color:" + (szChecked.length ? "inherit" : "#bbb") + "'>" + szCatogoryName + "</span>";
						szLegend += '<div class="checkbox" style="font-size:0.8em;float:right;padding:0;margin-top:5px;margin-right:-10px;margin-left:0px"><label>';
						szLegend += '<input type="checkbox" class="check sub_check" ' + szChecked + ' style="margin:0.4em 0em 0 0.2em;float:right" onchange="javascript:ixmaps.__switchLayer($(this),\'' + name + ((c && (layer.categoryA[c].legendname)) ? ('::' + String(c).replace(/\'/g, "\\\'")) : '') + '\');">&nbsp;';
						szLegend += '<span class="cr"><i class="cr-icon fa fa-check fa-fw"></i></span>';
						szLegend += "</label></div>";
						szLegend += "</div>";
						szLegend += "</div>";
					}
					break;
				case "polygon":
					for (c in layer.categoryA) {
						if (c == "" || (c && c != "null" && layer.szFilter && layer.szFilterValue && !__inFilter(layer, c))) {
							continue;
						}
						szChecked = (layer.categoryA[c].display == "none") ? "" : "checked=\"checked\"";

						var szCatogoryName = layer.categoryA[c].legendname || layer.szLegendName;
						szCatogoryName = (c && (szCatogoryName != "(null)")) ? szCatogoryName : layer.szLegendName;
						var szCategory = (c && (c != "null")) ? c : name;
						szLegend += "<div class='list-group-item'>";
						szLegend += "<div class='list-group-item-left'>";
						if (szChecked.length) {
							szLegend += ixmaps.__getLayerLegendSVG(name, szCategory, layer.categoryA[c].fill, layer.categoryA[c].stroke);
						} else {
							szLegend += ixmaps.__getLayerLegendSVG(name, szCategory, "none", "#aaaaaa");
						}
						szLegend += "</div><div class='list-group-item-right' style='width:90%;>";
						szLegend += "<span style='color:" + (szChecked.length ? "inherit" : "#bbb") + "'>" + szCatogoryName + "</span>";
						szLegend += '<div class="checkbox" style="font-size:0.8em;float:right;padding:0;margin-top:2px;margin-right:-50px;"><label>';
						szLegend += '<input type="checkbox" class="check sub_check" ' + szChecked + ' style="margin:0.4em 0em 0 0.2em;float:right" onchange="javascript:ixmaps.__switchLayer($(this),\'' + name + ((c && (layer.categoryA[c].legendname)) ? ('::' + String(c).replace(/\'/g, "\\\'")) : '') + '\');">&nbsp;';
						szLegend += '<span class="cr"><i class="cr-icon fa fa-check fa-fw"></i></span>';
						szLegend += "</label></div>";
						szLegend += "</div>";
						szLegend += "</div>";
					}
					break;
			}
			szLegend += sub ? "</div>" : "";

			if (sub) {
				szLegend += "</li>";
			}

		} else
		if (layer.szType == type) {
			
			var szChecked = (layer.szDisplay == "none") ? "" : "checked=\"checked\"";

			szLegend += "<li style='margin-top:-1em;margin-bottom:1em;'>";
			szLegend += '<input type="checkbox" class="check" '+szChecked+' onchange="javascript:ixmaps.__switchLayer($(this),\'' + name + '\');">';
			szLegend += '<span>&nbsp;' + name + ' (' + type + ') </span>';
			szLegend += "</li>";
		}
		return szLegend;
	};

	/**
	 * ixmaps.__getLayerLegendSVG  
	 * get a legend stroke/fill sprite (icon) in SVG 
	 * tries to get the layer style from the SVG code inside the map
	 * this includes pattern, opacity etc.
	 * if no style found, uses the function parameter szFill/szStroke 
	 * @param szLayerName the layer name
	 * @param szCategoryName the (sub)layer name
	 * @param szFill a default fill color
	 * @param szFill a default stroke color
	 * @type string
	 * @return the legend element (HTML)
	 */
	ixmaps.__getLayerLegendSVG = function (szLayerName, szCategoryName, szFill, szStroke) {

		var szHtml = "";

		node = ixmaps.embeddedSVG.window.map.SVGDocument.getElementById("legend:setactive:" + szLayerName + ((szLayerName != szCategoryName) ? ("::" + szCategoryName) : ""));
		if (node) {
			node = node.childNodes.item(1);
		}

		// a) try to get a style attribute from a SVG layer shape 
		// ------------------------------------------------------

		if (!node) {
			node = ixmaps.embeddedSVG.window.map.SVGDocument.getElementById(szLayerName + ((szLayerName != szCategoryName) ? ("::" + szCategoryName) : ""));
		}

		if (node) {
			var szPattern = "";
			node = node.cloneNode(true);
			node.style.setProperty("stroke-width", "50px");
			szStyle = node.getAttributeNS(null, "style");
			var fill = node.style.getPropertyValue("fill");
			if (fill && fill.match(/url/)) {
				pattern = (fill.replace(/\"/g, "").split("#")[1].split("\)")[0] + ":antizoomandpan");
				pattern = ixmaps.embeddedSVG.window.map.SVGDocument.getElementById(pattern);
				if (pattern) {
					pattern = pattern.cloneNode(true);
					szPatternId = pattern.getAttributeNS(null, "id") + ":antizoomandpan";
					pattern.setAttributeNS(null, "id", szPatternId);
					szPattern = __listNodewithChilds(pattern);
					node.style.setProperty("fill", "url(#" + szPatternId + ")");
					szStyle = node.getAttributeNS(null, "style").replace(/\"/g, "");
				}
			}
			if (!szStyle.match(/fill:/) && !szStyle.match(/stroke:/)) {
				szStyle += "fill:none;stroke:black";
			}
			if (szFill && (szFill == "none")) {
				szStyle += "fill:none;stroke:black";
			}
			szHtml += '<span style="vertical-align:-4px"><svg width="25" height="25" viewBox="0 0 800 800">';
			szHtml += '<defs>';
			szHtml += szPattern;
			szHtml += '</defs>';
			szHtml += '<path style="' + szStyle + '" d="M0,0 l0,800 800,0 0,-800 z" ></path>';
			szHtml += '</svg></span>';

		}

		// b) make legend sprite from fill/stroke arguments 
		// ------------------------------------------------------
		else {

			szHtml = '<span style="vertical-align:-4px"><svg width="25" height="25" viewBox="0 0 800 800">';
			szHtml += '<path style="fill:' + szFill + ';stroke:' + szStroke + ';fill-opacity:0.7;stroke-width:80px" d="M0,0 l0,800 800,0 0,-800 z" ></path>';
			szHtml += '</svg></span>';
		}

		return (szHtml);

	};

	var list_group_item_left = {
		"float": "left",
		"padding": " 0px",
		"padding-top": "2px",
		"margin-right": "0.5em",
		"min-width": "15px",
		"text-align": "center",
		"vertical-align": "50%"
	};
	var list_group_item_right = {
		"font-weight": "300",
		"display": "block",
		"margin": "0 0 0 0px"
	};
	var list_group_item = {
		"border-top": " 0",
		"border-left": " 0",
		"border-right": "0",
		"border-bottom": "solid rgba(220,220,220,0.5) 0px",
		"margin-bottom": "0",
		"padding": "0.3em 0.5em 0.5em 0.0em",
		"font-size": "1.5em",
		"line-height": "1em",
		"background-color": "rgba(255,255,255,0)"
	};
	var list_group = {
		"border-top": "solid rgba(120,120,120,0.5) 1px",
		"background-color": "rgba(255,255,255,0)",
		"margin": "1em 0em 0em 0em",
		"padding": "0.5em 0em 0em 0em"
	};

	var ul_ = {
		"display": " block",
		"list-style-type": "disc",
		"-webkit-margin-before": "1em",
		"-webkit-margin-after": "0.5em",
		"-webkit-margin-start": "0px",
		"-webkit-margin-end": "0px",
		"-webkit-padding-start": "0px"
	};

	/**
	 * ixmaps.__makeLegend  
	 * make the legend for all layer in the map 
	 * @type boolean
	 */
	ixmaps.makeLayerLegend = function (nMaxHeight) {
		nMaxHeight = nMaxHeight || ixmaps.__layerLegendHeight || 300;
		ixmaps.__layerLegendHeight = nMaxHeight;

		if (!$("#map-legend")[0]) {
			console.log("makeLayerLegend: #map-legend element not found");
			return false;
		}

		var szLegend = "";

		// Get all themes and group them by type
		var featureThemes = [];
		var choroplethThemes = [];
		var chartThemes = [];

		try {
			var themes = ixmaps.getThemes();
			if (themes && themes.length > 0) {
				console.log("makeLayerLegend: Found", themes.length, "themes");
				for (var t = 0; t < themes.length; t++) {
					var theme = themes[t];
					var themeObj = ixmaps.getThemeObj(theme.szId);
					if (!themeObj) continue;
					
					// Skip themes with SILENT or NOLEGEND flags
					if (themeObj.szFlag && themeObj.szFlag.match(/SILENT|NOLEGEND/)) {
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
					
					// Create a layer-like object for the theme
					var themeLayer = {
						szType: themeType === "CHART" ? "point" : (themeType === "CHOROPLETH" ? "polygon" : "polygon"),
						szName: themeName,
						szLegendName: themeName,
						themeType: themeType,
						themeObj: themeObj
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
				console.log("makeLayerLegend: Grouped themes - FEATURE:", featureThemes.length, "CHOROPLETH:", choroplethThemes.length, "CHART:", chartThemes.length);
			} else {
				console.log("makeLayerLegend: No themes found");
			}
		} catch(e) {
			console.error("makeLayerLegend: Error getting themes:", e);
		}
		
		// Build legend HTML with grouped sections by theme type
		if (featureThemes.length > 0) {
			szLegend += "<div class='layerlist-group'>";
			szLegend += "<div class='layerlist-group-title'>Features</div>";
			for (var i = 0; i < featureThemes.length; i++) {
				szLegend += __makeLayerlistItem(featureThemes[i].layer, featureThemes[i].name);
			}
			szLegend += "</div>";
		}

		if (choroplethThemes.length > 0) {
			szLegend += "<div class='layerlist-group'>";
			szLegend += "<div class='layerlist-group-title'>Choropleths</div>";
			for (var i = 0; i < choroplethThemes.length; i++) {
				szLegend += __makeLayerlistItem(choroplethThemes[i].layer, choroplethThemes[i].name);
			}
			szLegend += "</div>";
		}

		if (chartThemes.length > 0) {
			szLegend += "<div class='layerlist-group'>";
			szLegend += "<div class='layerlist-group-title'>Charts</div>";
			for (var i = 0; i < chartThemes.length; i++) {
				szLegend += __makeLayerlistItem(chartThemes[i].layer, chartThemes[i].name);
			}
			szLegend += "</div>";
		}
		
		// Check if we have any themes to display
		var polygonLayers = featureThemes.concat(choroplethThemes);
		var pointLayers = chartThemes;
		var lineLayers = [];

		// no elements in legend 
		// then exit
		if (szLegend === "" || (polygonLayers.length === 0 && lineLayers.length === 0 && pointLayers.length === 0)) {
			console.log("makeLayerLegend: No layers found, returning false");
			return false;
		}

		// -------------------------------------------------
		// show the legend
		// -------------------------------------------------

		// if not yet present, create the hosting legend pane
		//
		if (!$("#map-legend-list")[0]) {
			var szHtml = "";

			if (!description) {
				szHtml += "<h3 id='map-legend-title' style='margin-top:0.5em;'>Map Layers";
				szHtml += "</h3>";
			} else {
				szHtml += "<div style='height:0.5em;'></div>";
			}

			szHtml += "<div id='map-legend-body' style='max-height:" + nMaxHeight + "px;overflow:auto;padding-right:0.7em'>";
			szHtml += "<div id='map-legend-list'>";
			szHtml += "</div>";
			szHtml += "</div>";

			var szLegendPane = "<div id='map-legend-pane' class='map-legend-pane'>" +
				"<a href='javascript:__toggleLegendPane(-1)'>" +
				"<div id='legend-type-switch' style='border:none'>" +
				"<span style='font-size:28px;'>&#8942;</span>" +
				"</div>" +
				"</a>" +
				"<div>" +
				"<div class='row'>" +
				"<div class='col-lg-12 col-md-12 col-xs-0'>" +
				"<div id='map-legend-content'>" + szHtml + "</div>" +
				"</div>" +
				"</div>" +
				"</div>";
			$("#map-legend").html(szLegendPane);
		}

		// append the legend html
		//
		$("#map-legend-list").html(szLegend);
		$("#map-legend").show();

		return true;
	}

	/**
	 * listen on Zoom and Pan  
	 * make the legend for all layer in the map 
	 * @type void
	 */
	__old__htmlgui_onZoomAndPan = ixmaps.htmlgui_onZoomAndPan;
	ixmaps.htmlgui_onZoomAndPan = function (nZoom) {
		if (  ixmaps.loadedMap && 
			!(ixmaps.loadedProject && ixmaps.loadedProject.themes) && 
			!(ixmaps.legend && ixmaps.legend.externalLegend) &&
			!(ixmaps.legendType == "theme") ) {
			setTimeout("ixmaps.makeLayerLegend(" + window.innerHeight * 0.75 + ")", 100);
		}
		__old__htmlgui_onZoomAndPan(nZoom);
	};

	/**
	 * Initialize layer legend on map ready if legend type is "layer"
	 * @type void
	 */
	var __old_onMapReady = ixmaps.onMapReady;
	ixmaps.onMapReady = function() {
		if (__old_onMapReady) {
			__old_onMapReady.apply(this, arguments);
		}
		// If legend type is "layer" and map is loaded, show layer legend
		if (ixmaps.legendType === "layer" && ixmaps.loadedMap) {
			setTimeout(function() {
				__tryInitLayerLegend();
			}, 500); // Delay to ensure map is fully initialized
		}
	};

	/**
	 * Try to initialize layer legend when map becomes available
	 * This handles cases where onMapReady might have already been called
	 * @returns {boolean} true if initialization was successful, false otherwise
	 */
	function __tryInitLayerLegend() {
		console.log("__tryInitLayerLegend called:", {
			legendType: ixmaps.legendType,
			loadedMap: !!ixmaps.loadedMap,
			hasMakeLayerLegend: typeof ixmaps.makeLayerLegend === 'function',
			hasLegendElement: !!$("#map-legend")[0],
			hasThemes: !!(ixmaps.loadedProject && ixmaps.loadedProject.themes),
			externalLegend: !!(ixmaps.legend && ixmaps.legend.externalLegend),
			legendState: ixmaps.legendState,
			hasGetLayer: typeof ixmaps.getLayer === 'function'
		});
		
		if (ixmaps.legendType === "layer" && 
			ixmaps.loadedMap && 
			ixmaps.makeLayerLegend &&
			$("#map-legend")[0] &&
			!(ixmaps.legend && ixmaps.legend.externalLegend)) {
			
			// Check if layers are available
			var layerA = null;
			try {
				if (typeof ixmaps.getLayer === 'function') {
					layerA = ixmaps.getLayer();
					var layerCount = layerA ? Object.keys(layerA).length : 0;
					console.log("__tryInitLayerLegend: Layers available:", layerCount);
					
					// If no layers yet, return false but don't give up (will retry)
					if (!layerA || layerCount === 0) {
						console.log("__tryInitLayerLegend: No layers available yet, will retry");
						return false;
					}
				} else {
					console.log("__tryInitLayerLegend: ixmaps.getLayer() not available");
					return false;
				}
			} catch(e) {
				console.log("__tryInitLayerLegend: Error checking layers:", e);
				return false;
			}
			
			// Ensure legend state is set to show the legend
			if (typeof ixmaps.legendState === 'undefined' || ixmaps.legendState === 0) {
				ixmaps.legendState = 1;
			}
			
			// Show the legend if it's hidden
			if ($("#map-legend").is(":hidden")) {
				$("#map-legend").show();
			}
			
			try {
				console.log("Calling ixmaps.makeLayerLegend()");
				var result = ixmaps.makeLayerLegend(window.innerHeight * 0.75);
				console.log("makeLayerLegend returned:", result);
				if (result) {
					// If layer legend was successfully created, ensure legend pane is shown
					// Note: __switchLegendPanes is in legend.js scope, so we can't call it directly
					// But makeLayerLegend should have already populated the legend content
					return true;
				} else {
					console.log("__tryInitLayerLegend: makeLayerLegend returned false - no layers found");
				}
			} catch(e) {
				console.error("Failed to initialize layer legend:", e);
			}
		}
		return false;
	}

	// Try initialization immediately if map is already loaded
	if (typeof window !== 'undefined' && window.ixmaps && window.ixmaps.loadedMap) {
		setTimeout(function() {
			console.log("layer_legend.js: Trying to initialize layer legend (map already loaded)");
			__tryInitLayerLegend();
		}, 1000);
	}

	// Also try when DOM is ready
	if (typeof $ !== 'undefined') {
		$(document).ready(function() {
			setTimeout(function() {
				console.log("layer_legend.js: Trying to initialize layer legend (DOM ready)");
				__tryInitLayerLegend();
			}, 1500);
		});
	}
	
	// Also try periodically until successful (with max attempts)
	var __initAttempts = 0;
	var __maxInitAttempts = 10;
	var __initInterval = setInterval(function() {
		__initAttempts++;
		if (__initAttempts > __maxInitAttempts) {
			clearInterval(__initInterval);
			return;
		}
		if (ixmaps.legendType === "layer" && 
			ixmaps.loadedMap && 
			$("#map-legend")[0] &&
			!(ixmaps.loadedProject && ixmaps.loadedProject.themes)) {
			console.log("layer_legend.js: Periodic check - attempting to initialize layer legend");
			if (__tryInitLayerLegend()) {
				clearInterval(__initInterval);
			}
		}
	}, 2000);

	// Hook into htmlgui_onDrawTheme to check if we should show layer legend instead
	var __old_htmlgui_onDrawTheme = ixmaps.htmlgui_onDrawTheme;
	if (typeof ixmaps.htmlgui_onDrawTheme === 'function') {
		ixmaps.htmlgui_onDrawTheme = function(szId) {
			// If legend type is "layer", show layer legend instead of theme legend
			if (ixmaps.legendType === "layer") {
				setTimeout(__tryInitLayerLegend, 100);
				// Still call the original function but it will be intercepted by legend.js logic
				if (__old_htmlgui_onDrawTheme) {
					__old_htmlgui_onDrawTheme.apply(this, arguments);
				}
				return;
			}
			// Otherwise, call the original function
			if (__old_htmlgui_onDrawTheme) {
				__old_htmlgui_onDrawTheme.apply(this, arguments);
			}
		};
	}
	
	// Hook into htmlgui_onNewTheme to ensure layer legend shows when no themes are present
	var __old_htmlgui_onNewTheme = ixmaps.htmlgui_onNewTheme;
	if (typeof ixmaps.htmlgui_onNewTheme === 'function') {
		ixmaps.htmlgui_onNewTheme = function(szId) {
			if (__old_htmlgui_onNewTheme) {
				__old_htmlgui_onNewTheme.apply(this, arguments);
			}
			// If legend type is "layer", try to show layer legend
			if (ixmaps.legendType === "layer") {
				setTimeout(__tryInitLayerLegend, 200);
			}
		};
	}

	/**
	 * end of namespace
	 */

})();

// -----------------------------
// EOF
// -----------------------------
