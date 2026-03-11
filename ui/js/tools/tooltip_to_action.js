/**********************************************************************
tooltip_to_action.js

$Comment: provides custem HTML tooltip for iXMaps SVG maps
$Source : tooltip_basic.js,v $

$InitialAuthor: guenter richter $
$InitialDate: 2022/11/02 $
$Author: guenter richter $
$Id: tooltip_basic.js 1 2022-11-02 10:51:41Z Guenter Richter $map

Copyright (c) Guenter Richter
$Log: tooltip_to_action.js,v $
**********************************************************************/

/** 
 * @fileoverview 
 * This file provides custom HTML tooltip for iXMaps SVG Maps
 *  
 * intercepts tooltip display from the iXMaps SVG map
 * and calls 
 *
 * ixmaps.htmlgui_onTooltipDisplay() intercepts the tooltip display of the SVG map and displays the given text in a popup window
 * ixmaps.htmlgui_onTooltipDelete() removes the popup with the tooltip
 * 
 * intercepts mouse over map item events from the iXMaps SVG map
 * 
 * the code looks for the item data and calls the gui function: ixmaps.htmlgui_onItemAction()
 *
 * @author Guenter Richter guenter.richter@medienobjekte.de
 * @version 1.0 
 * @copyright CC BY SA
 * @license MIT
 */

window.ixmaps = window.ixmaps || {};
(function () {

		/**
		 * define the action on mouse(click) on map item 
		 * in this case, applicate a filter on the map themes that depends on the clicked map item
		 *
		 * @param {string} szId the id of the mouseover object (SVG object)
		 * @param {object} objItem the (iternal) theme obj connected to the onover object
		 * @return boolean
		 * @public
		 */

		var lastId = null;
		var filterDoneIdA = [];
		ixmaps.onItemAction = function(szId, objItem, themeObj) { 
				if (szId && objItem) {
				var value = objItem.szSelectionId;
				var szField = themeObj.szSelectionField;
				var themesA = ixmaps.getThemes();
				for (var i in themesA){
					var fieldsA = themesA[i].objTheme.dbFields;
					for (ii in fieldsA){
						if ((fieldsA[ii].id == szField) &&
							(szId != lastId)){
							if (!lastId){
								filterDoneIdA[themesA[i].szId] = themesA[i].szFilter || "";
							}
							var newFilter = filterDoneIdA[themesA[i].szId];
							if (newFilter && newFilter.length){
								newFilter += " AND \"" + "*" + "\" like \"" + value + "\"";
							}else{
								newFilter = "WHERE \"" + "*" + "\" like \"" + value + "\"";
							}
							//newFilter = value;
							ixmaps.changeThemeStyle(themesA[i].szId,"filter:"+ newFilter, "set");
							break;
						}
					}
				}
				lastId = szId;
			} else {
				for (var id in filterDoneIdA){
					ixmaps.changeThemeStyle(id,"filter:"+(filterDoneIdA[id]||""), "set");
				}
				filterDoneIdA = [];
				lastId = null;
			}
		};

		/**
		 * intercept mouse over map item and create the tooltip
		 * overwrites previous defined mouseover handling
		 *
		 * this creates the custom tooltip content from theme/item data
		 *
		 * @param {event} evt the mouse event handler
		 * @param {string} szId the id of the mouseover opbject (SVG object)
		 * @return boolean
		 * @public
		 */

		var old_htmlgui_onItemClick = ixmaps.htmlgui_onItemClick;
		ixmaps.htmlgui_onItemClick = function(evt, szId, shape) {
			
			var fThemeChart = false;
			var fThemeData = false;

			// get the item data -> the tooltip content
			// ------------------------------------------

			// create a theme item list compatible item id
			//
			var szItem = szId;
			if (szId.match(/chartgroup/)) {
				szItem = szId.split(":chartgroup")[0].split(":");
				szItem = szItem[1] + "::" + szItem[3];
			}
			
			// if click to map background, remove the tooltip or action
			//
			if (!szItem || !szItem.length || szItem.match(/mapbackground/i)) {
				__fTooltipPin = false;
				__fTooltipPinned = false;
				// clear onOver actions
				ixmaps.onItemAction(null, null);
				return;
			}
			
			// id is from a map shape, create sintetic chart id
			//
			if (!szId.match(/\:\:/)) {
				var obj = ixmaps.embeddedSVG.window.map.SVGDocument.getElementById(szItem);
				var szChartId = szItem.match(/::/) ? szId : obj.parentNode.getAttribute("id");
				var szIdA = szChartId.split("#");
				if (szIdA.length > 1) {
					var szIdAA = szIdA[1].split(/\b::\b/);
					szChartId = szIdA[0] + "::" + szIdAA[1];
				}
				szItem = szChartId;
			}

			// get the theme object from item id
			// ------------------------------------

			// 1.try
			var themeObj = ixmaps.getThemeObj(szId.split(":")[0]);
			
			if (!themeObj)
				return true;

			// check and if not the right theme (possible if onOver on map shape)
			if (themeObj && !(themeObj.szId == szId.split(":")[0])) {

				// look in all CHOROPLETH themes for the a corrisponding one
				//
				var themes = ixmaps.getThemes();
				for (i in themes) {
					if (themes[i].szThemes == szId.split(":")[0] && themes[i].szFlag.match(/CHOROPLETH/)) {
						themeObj = themes[i];
					}
				}
			}

			// call onOver actions
			//
			ixmaps.onItemAction(szId, themeObj.itemA[szItem], themeObj);

			if (old_htmlgui_onItemClick){
				//old_htmlgui_onItemClick(evt, szId, shape);
			}
			return true;
		}

})();

/**
 * end of namespace
 */

// -----------------------------
// EOF
// -----------------------------
