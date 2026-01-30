/**********************************************************************
 htmlgui_dialog.js

$Comment: provides JavaScript HTML application interface to svggis
$Source : htmlgui.js,v $

$InitialAuthor: guenter richter $
$InitialDate: $
$Author: guenter richter $
$Id: htmlgui.js 8 2007-06-05 08:14:02Z Guenter Richter $

Copyright (c) Guenter Richter
$Log: htmlgui.js,v $
**********************************************************************/

/** 
 * @fileoverview This file provides GUI functions for a HTML page that embeds a SVGGIS map<br>
 * @author Guenter Richter guenter.richter@medienobjekte.de
 * @version 1.1 
 */

/** 
 * @namespace ixmaps
 */

(function( ixmaps, $, undefined ) {

	ixmaps.onDialogClose = null;
	ixmaps.beforeDialogTool = "";

	// Dialog utility functions
	ixmaps.dialogUtils = {
		/**
		 * Get dialog statistics
		 * @returns {Object} Dialog statistics
		 */
		getStats: function() {
			if (!window.dialogManager) {
				return { error: 'DialogManager not available' };
			}
			return window.dialogManager.getStats();
		},

		/**
		 * Close all dialogs
		 * @returns {boolean} Success status
		 */
		closeAll: function() {
			if (!window.dialogManager) {
				console.error('DialogManager not available');
				return false;
			}
			window.dialogManager.closeAllDialogs();
			return true;
		},

		/**
		 * Check if dialog limit is reached
		 * @param {number} maxDialogs - Maximum allowed dialogs
		 * @returns {boolean} True if limit reached
		 */
		isLimitReached: function(maxDialogs = 10) {
			if (!window.dialogManager) {
				return false;
			}
			return window.dialogManager.isMaxDialogsReached(maxDialogs);
		},

		/**
		 * Get dialog by element ID
		 * @param {string} elementId - Element ID
		 * @returns {Object|null} Dialog instance or null
		 */
		getByElement: function(elementId) {
			if (!window.dialogManager) {
				return null;
			}
			const dialogs = window.dialogManager.getOpenDialogs();
			return dialogs.find(dialog => dialog.element === elementId) || null;
		}
	};
	
	ixmaps.openDialog = function(szElement, szUrl, szTitle, szPosition, nWidth, nHeight, nOpacity) {
		// Input validation
		if (!szUrl || !szTitle) {
			console.error('openDialog: Missing required parameters (szUrl, szTitle)');
			return null;
		}

		// Check if dialogManager is available
		if (!window.dialogManager) {
			console.error('openDialog: dialogManager not available');
			return null;
		}

		console.log('openDialog:', { szElement, szUrl, szTitle });

		// Get count of open dialogs for logging/monitoring
		const openDialogsCount = window.dialogManager.getOpenDialogs().length;
		console.log(`Currently open dialogs: ${openDialogsCount}`);

		// Validate dimensions
		const width = nWidth && nWidth > 0 ? `${nWidth}px` : '400px';
		const height = nHeight && nHeight > 0 ? `${nHeight}px` : '300px';

		// Calculate position with offset for multiple dialogs
		const positionOffset = openDialogsCount * 10;
		const position = {
			top: `${10 + positionOffset}px`,
			left: `${10 + positionOffset}px`
		};

		try {
			const dialog = window.dialogManager.createDialog({
				title: szTitle,
				position: position,
				width: width,
				height: height,
				element: szElement, // Store element reference
				opacity: nOpacity || 1
			});

			dialog.show();
			
			dialog.loadContent(szUrl, {
				showLoading: true,
				loadingText: 'Loading content...',
				timeout: 15000,
				successHandler: function(dialogInstance, html) {
					console.log('Dialog content loaded successfully');
					// Execute any scripts in the loaded content
					ixmaps.dialogExecScripts(szElement);
				},
				errorHandler: function(dialogInstance, error) {
					console.error('Failed to load dialog content:', error);
					dialogInstance.showError(`Failed to load content: ${error.message}`);
					return false; // Prevent default error display
				}
			});

			return dialog;
		} catch (error) {
			console.error('Error creating dialog:', error);
			return null;
		}
	};

    ixmaps.dialogExecScripts = function(szElement) {
        if (!szElement) {
            console.warn('dialogExecScripts: No element specified');
            return;
        }

        const element = document.getElementById(szElement);
        if (!element) {
            console.warn(`dialogExecScripts: Element '${szElement}' not found`);
            return;
        }

        const scripts = element.querySelectorAll('script');
        if (scripts.length === 0) {
            console.log('dialogExecScripts: No scripts found in element');
            return;
        }

        console.log(`dialogExecScripts: Executing ${scripts.length} script(s)`);

        scripts.forEach((script, index) => {
            try {
                const newScript = document.createElement('script');
                
                // Copy attributes
                Array.from(script.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });

                if (script.src) {
                    // Handle external scripts
                    newScript.onload = () => {
                        console.log(`External script loaded: ${script.src}`);
                    };
                    newScript.onerror = () => {
                        console.error(`Failed to load external script: ${script.src}`);
                    };
                } else {
                    // Handle inline scripts
                    newScript.textContent = script.textContent;
                }

                // Append to head to execute
                document.head.appendChild(newScript);
                
                // Clean up the original script
                script.remove();
                
                console.log(`Script ${index + 1} executed successfully`);
            } catch (error) {
                console.error(`Error executing script ${index + 1}:`, error);
            }
        });
    };
    
	ixmaps.openSidebar = function(szElement,szUrl,szTitle,szPosition,nMinWidth,nMinHeight){
		const sidebarwidth = 400;

		if ( typeof($("#"+szElement)[0]) == "undefined" ){
			szElement = "dialog";
		}
		if ( ixmaps.sidebar ){
			$(ixmaps.sidebar).css("visibility","hidden");
			ixmaps.sidebar.innerHTML = "";
			ixmaps.sidebar = null;
			return;
		}
		$("#"+szElement).css({
			"visibility":"visible",
			"display"	:"inline",	
			"position"	:"absolute",
			"top"		:"0px",
			"left"		:"0px",
			"z-index"	:"1000",
			"width"		:(sidebarwidth)+"px",
			"height"	:(ixmaps.SVGmapHeight) +"px",
			"background-color":"#fff",
			"border-right":"solid 1px #ddd",
			"border-bottom":"solid 1px #ddd"
		});
		let width = parseFloat($("#ixmap").css("width"));
		$("#ixmap").css({
			"left": sidebarwidth+"px",
			"width": (width-sidebarwidth)+"px"
		});

		if ( typeof(szUrl) == "string" && szUrl.length ){
			$("#"+szElement)[0].innerHTML = 
				"<div id=\"sidebarclosebutton\" style=\"position:absolute;top:1px;left:"+sidebarwidth+"px;background-color:#fff;border-right:solid;border-bottom:solid;border-color:#ddd;border-width:1px;\">" + 
				"<a style=\"font-family:verdana;font-size:16px;color:#888\" href=\"javascript:ixmaps.closeSidebar();\">&nbsp;x&nbsp;</a></div>" +
				"<div id='"+szElement+"-content' style='padding:10px;height:"+(ixmaps.SVGmapHeight-60)+"px;overflow:auto;'>"+
				"</div>";

			// Use the new loadSidebarContent function
			ixmaps.loadSidebarContent(szElement + "-content", szUrl, {
				showLoading: true,
				loadingText: 'Loading sidebar content...',
				complete: function(response, status, xhr) {
					console.log('Sidebar content loaded successfully');
				},
				error: function(xhr, status, errorMsg) {
					console.error('Failed to load sidebar content:', errorMsg);
				}
			});
		}
							
		ixmaps.sidebar = $("#"+szElement)[0];
	};

	
	ixmaps.resizeDialog = function(newWidth,newHeight){
		$("#item").parent().css("width", newWidth);
		$("#item").parent().css("height", newHeight);
	};

	/**
	 * Load content into sidebar from URL
	 * @param {string} sidebarElement - ID of the sidebar element
	 * @param {string} url - URL to load content from
	 * @param {Object} options - Loading options
	 */
	ixmaps.loadSidebarContent = function(sidebarElement, url, options = {}) {
		// Input validation
		if (!sidebarElement || !url) {
			console.error('loadSidebarContent: Missing required parameters (sidebarElement, url)');
			return;
		}

		// Check if jQuery is available
		if (!window.jQuery) {
			console.error('loadSidebarContent: jQuery not available');
			return;
		}

		// Get sidebar element
		const sidebar = document.getElementById(sidebarElement);
		if (!sidebar) {
			console.error(`loadSidebarContent: Sidebar element '${sidebarElement}' not found`);
			return;
		}

		// Default options
		const {
			data = null,
			complete = null,
			error = null,
			showLoading = true,
			loadingText = 'Loading sidebar content...',
			timeout = 15000
		} = options;

		// Show loading state if enabled
		if (showLoading) {
			sidebar.innerHTML = `
				<div style="text-align: center; padding: 40px; color: #666;">
					<div style="margin-bottom: 20px;">
						<div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
					</div>
					<div>${loadingText}</div>
				</div>
				<style>
					@keyframes spin {
						0% { transform: rotate(0deg); }
						100% { transform: rotate(360deg); }
					}
				</style>
			`;
		}

		// Use jQuery load method with timeout
		const loadPromise = new Promise((resolve, reject) => {
			$(sidebar).load(url, data, function(response, status, xhr) {
				if (status === "error") {
					reject({
						status: xhr.status,
						statusText: xhr.statusText,
						response: response
					});
				} else {
					resolve({
						response: response,
						status: status,
						xhr: xhr
					});
				}
			});
		});

		// Handle timeout
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => reject(new Error('Request timeout')), timeout);
		});

		// Race between load and timeout
		Promise.race([loadPromise, timeoutPromise])
			.then((result) => {
				// Execute scripts in loaded content
				ixmaps.executeSidebarScripts(sidebar);
				
				// Call complete callback if provided
				if (complete && typeof complete === 'function') {
					complete(result.response, result.status, result.xhr);
				}
				
				console.log('Sidebar content loaded successfully');
			})
			.catch((error) => {
				let errorMsg;
				
				if (error.status) {
					// jQuery error
					errorMsg = `Error loading content: ${error.status} ${error.statusText}`;
				} else {
					// Timeout or other error
					errorMsg = `Error loading content: ${error.message}`;
				}
				
				// Show error state
				sidebar.innerHTML = `
					<div style="text-align: center; padding: 40px; color: #dc3545;">
						<div style="margin-bottom: 20px; font-size: 48px;">⚠️</div>
						<h3>Error Loading Content</h3>
						<p>${errorMsg}</p>
						<button onclick="this.parentElement.innerHTML=''" 
								style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px;">
							Clear Error
						</button>
					</div>
				`;
				
				// Call error callback if provided
				if (error && typeof error === 'function') {
					error(error.status ? error : { status: 0, statusText: error.message });
				}
				
				console.error('Failed to load sidebar content:', errorMsg);
			});
	};

	/**
	 * Execute scripts in sidebar content
	 * @param {HTMLElement} sidebar - Sidebar element
	 */
	ixmaps.executeSidebarScripts = function(sidebar) {
		if (!sidebar) {
			console.warn('executeSidebarScripts: No sidebar element provided');
			return;
		}

		const scripts = sidebar.querySelectorAll('script');
		if (scripts.length === 0) {
			console.log('executeSidebarScripts: No scripts found in sidebar');
			return;
		}

		console.log(`executeSidebarScripts: Executing ${scripts.length} script(s)`);

		scripts.forEach((script, index) => {
			try {
				const newScript = document.createElement('script');
				
				// Copy attributes
				Array.from(script.attributes).forEach(attr => {
					newScript.setAttribute(attr.name, attr.value);
				});

				if (script.src) {
					// Handle external scripts
					newScript.onload = () => {
						console.log(`External script loaded: ${script.src}`);
					};
					newScript.onerror = () => {
						console.error(`Failed to load external script: ${script.src}`);
					};
				} else {
					// Handle inline scripts
					newScript.textContent = script.textContent;
				}

				// Append to head to execute
				document.head.appendChild(newScript);
				
				// Clean up the original script
				script.remove();
				
				console.log(`Sidebar script ${index + 1} executed successfully`);
			} catch (error) {
				console.error(`Error executing sidebar script ${index + 1}:`, error);
			}
		});
	};
	ixmaps.closeSidebar = function(){
		if ( ixmaps.sidebar ){
			let sidebarwidth = parseFloat($(ixmaps.sidebar).css("width"));
			let left = parseFloat($("#ixmap").css("left"));
			let width = parseFloat($("#ixmap").css("width"));
			$("#ixmap").css({
				"left": (left-sidebarwidth)+"0px",
				"width": (width+sidebarwidth)+"px"
			});
			$(ixmaps.sidebar).css("visibility","hidden");
			$(ixmaps.sidebar).css("display","none");
			ixmaps.sidebar.innerHTML = "";
			ixmaps.sidebar = null;
	
			return;
		}
	};
	ixmaps.openMegaBox = function(event,szElement,szUrl,szTitle){
		if ( typeof($("#"+szElement)[0]) == "undefined" ){
			return;
		}

		var dialogWidth   = Math.min(800,window.innerWidth*0.75);
		var dialogHeight  = Math.min(800,window.innerHeight*0.85);
		var nPosition = [window.innerWidth/2-dialogWidth/2,50];

		$("#velo").css({
			"visibility":"visible",
			"width":(ixmaps.SVGmapOffX+ixmaps.SVGmapWidth)+"px",
			"height":(ixmaps.SVGmapHeight)-"px"
		});
		$("#"+szElement).css("visibility","visible");
	    $("#"+szElement).dialog({ width: dialogWidth, height: dialogHeight, title: szTitle, position:  nPosition, close: function(event, ui) {
			$("#velo").css("visibility","hidden");
			}
			});
		if ( typeof(szUrl) == "string" && szUrl.length ){
			$("#"+szElement)[0].innerHTML = 
				"<iframe src=\""+szUrl+"\" width=\"100%\" height=\"100%\" frameborder=\"0\" marginwidth=\"0px\" />";
			}	
	};


	// -----------------------------
	// html bookmark handler
	// -----------------------------

	ixmaps.dispatch = function(szUrl){

		// case a) localhost
		if ( 0 && String(ixmaps.location).match(/localhost/) ){
			return "../../" + szUrl;
		}

		// case b) 'real' URL
		// look for 'ui' in path and set the part before as root
		var szRoot = String(ixmaps.location);
		var szRootUrlA = szRoot.split('/');
		while ( szRootUrlA.length ){
			if ( szRootUrlA.pop() == "ui" ){
				break;
			}
		}
		szRoot = szRootUrlA.join('/');
		return szRoot+ "/" + szUrl;

		/** GR 01.02.2014 commented
		var szHost = "http://"+$(location).attr('host');
		return szHost+ "/" + szUrl;
		**/
	};

	ixmaps.getBaseMapParameter = function(szMapService){
		if ( szMapService == "leaflet" ){
			return "&basemap=ll";
		}else
		if ( szMapService == "openlayers" ){
			return "&basemap=ol";
		}else
		if ( szMapService == "microsoft" ){
			return "&basemap=bg";
		}else{
			return "&basemap=go";
		}
	};

	ixmaps.shareMap = function(target,position){
		this.openDialog('share-dialog',ixmaps.szResourceBase+"ui/html/tools/share_new.html",'share map',position||'auto',400,550);
	};

	ixmaps.popupShare = function(position) {
		ixmaps.shareMap('dialog',position);
	};

	ixmaps.exportMap = function(target,position){
		window.szMapTypeId = ixmaps.getMapTypeId();
		window.DOMViewerObj = ixmaps.embeddedSVG.window.document;
		this.openDialog('export-dialog',ixmaps.szResourceBase+"ui/html/tools/export.html",'export map',position||'auto',500,150);
	};

	ixmaps.viewTable = function(target,position){
		this.openDialog('table-dialog',ixmaps.szResourceBase+"ui/html/tools/table_new.html",'data table',position||'auto',800,600);
	};

	ixmaps.selectBasemap = function(target,position){
		this.openDialog('basemap-dialog',ixmaps.szResourceBase+"ui/html/tools/layer.html",'layer table',position||'auto',400,600);
	};

	ixmaps.popupBookmarks = function(position){
		this.openDialog('bookmarks',ixmaps.szResourceBase+'ui/html/tools/history.html','Bookmarks',position||'50%,103',250,450);
	};

	ixmaps.popupProject = function(position){
		this.openDialog('projects',ixmaps.szResourceBase+'ui/html/tools/project_save.html','Save actual map & theme as project',position||'200,103',450,600);
};

	ixmaps.popupThemeEditor = function(position,szId){
		ixmaps.editor = ixmaps.editor || {};
		ixmaps.editor.themeId = szId;
		this.openDialog('editor',ixmaps.szResourceBase+'ui/html/tools/theme_editor.html','Theme Editor',position||'10,103',500,670);
	};

	ixmaps.popupProjectEditor = function(position){
		this.openDialog('editor',ixmaps.szResourceBase+'ui/html/tools/project_editor.html','Project Editor',position||'10,103',500,650);
};

	ixmaps.popupThemeConfigurator = function(position){
		this.openDialog('sidebar',ixmaps.szResourceBase+'ui/html/tools/theme_configurator.html','Theme Configuator',position||'10,10',450,660);
	};

	/**
	 * Example function showing how to use loadSidebarContent directly
	 * @param {string} position - Position for the sidebar
	 */
	ixmaps.loadSidebarExample = function(position) {
		// First open the sidebar
		ixmaps.openSidebar('sidebar', '', 'Custom Sidebar', position||'10,10', 400, 600);
		
		// Then load content using the new function
		ixmaps.loadSidebarContent('sidebar-content', 'path/to/your/content.html', {
			showLoading: true,
			loadingText: 'Loading custom content...',
			timeout: 10000,
			complete: function(response, status, xhr) {
				console.log('Custom sidebar content loaded successfully');
				// You can add custom logic here after content loads
			},
			error: function(xhr, status, errorMsg) {
				console.error('Failed to load custom sidebar content:', errorMsg);
				// You can add custom error handling here
			}
		});
	};

	ixmaps.popupThemeFacets = function(position,columns){
		ixmaps.themeFacetColumns = columns;
		this.openDialog('facets',ixmaps.szResourceBase+'ui/html/tools/theme_facets.html','Theme Facets',position||'10,10',450,660);
	};

	ixmaps.popupTools = function(position){
        /**
		var szPos = String(parseInt($(ixmaps.gmapDiv).css('left')) + 55) + ',13';
 		ixmaps.openDialog('dialog', ixmaps.szResourceBase+'ui/html/tools/popuptools_line_v2.html', '', szPos, 700, 100);
		$("#dialog").css("height", "100%");
		$("#dialog").css("width", "90%");
		$("#dialog").css("position", "absolute");
		$("#dialog").css("top", "10px");
		$("#dialog").css("overflow", "hidden");
		//ixmaps.openDialog(null, "tools", './tools/popuptools_line_v2.html', 'Tools', '10,10', "95%", 150);
        **/

		$(".dialog-header").css("min-width","500px");
        $(".dialog-header").load(ixmaps.szResourceBase+'ui/html/tools/popuptools_line_v2.html');
        $(".dialog-body").hide();
        document.getElementById('myDialog').show();
	};

	ixmaps.showAbout= function(szUrl,position){
		if ( szUrl ){
			ixmaps.openDialog("tools", szUrl, '', position||'0,0',"350","500");
		}
		if ( ixmaps.loadedProject.metadata.about && ixmaps.loadedProject.metadata.about.length ) {
			ixmaps.openDialog("tools", ixmaps.loadedProject.metadata.about, 'about', position||'100,100',"90%","500");
		}
	};

	
	ixmaps.fullScreenMap = function(szTemplateUrl){

		var szMapService = this.szMapService;
		var szMapUrl    = this.getMapUrl();
		var szMapType   = this.getMapTypeId();
		var szStoryUrl  = this.getStoryUrl();

		// get envelope 
		var szEnvelope = this.getEnvelopeString(1);
		// get all themes
		var szThemesJS = this.getThemesString();
		// compose bookmark
		var szBookmark = szLoadedMap + "map.Api.doZoomMapToGeoBounds("+szEnvelope+");" + "map.Api.clearAll();" + szThemesJS;

		// make url of the map template 
		if ( !szTemplateUrl ){
			szTemplateUrl = ixmaps.dispatch("ui/dispatch.htm?ui=popout&minimal=1&toolbutton=1&logo=1");
		}
		szTemplateUrl += ixmaps.getBaseMapParameter(szMapService);
		// create complete url with query string 
		var szUrl = szTemplateUrl;
		szUrl += szMapUrl?  ("&svggis="		+ encodeURI(szMapUrl))		:"";
		szUrl += szMapType? ("&maptype="	+ szMapType)				:"";
		szUrl += szStoryUrl?("&story="		+ szStoryUrl)					:"";
		szUrl += szBookmark?("&bookmark="	+ encodeURI(szBookmark))	:"";

		window.open(szUrl,'map fullscreen'+Math.random());
	};

	ixmaps.getShareUrl = function(szType){

		// GR 30.04.2015 try to call explicit functions to get the share urls 
		// ------------------------------------------------------------------
		var szEditUrl   = ixmaps.getEditUrl  ?ixmaps.getEditUrl()  :null;
		var szViewUrl   = ixmaps.getViewUrl  ?ixmaps.getViewUrl()  :null;
		var szPViewUrl  = ixmaps.getPViewUrl ?ixmaps.getPViewUrl() :null;
		var szAloneUrl  = ixmaps.getLinkUrl  ?ixmaps.getLinkUrl()  :null;
		var szEmbedUrl  = ixmaps.getEmbedUrl ?ixmaps.getEmbedUrl() :null;
		var szPopoutUrl = ixmaps.getPopoutUrl?ixmaps.getPopoutUrl():null;
		// ------------------------------------------------------------------

		// GR 30.04.2015 get the last valid map name to query the bookmark from
		// ------------------------------------------------------------------
		szName = "map";
		for ( let i in ixmaps.embeddedApiA ){
			szName = i;	
		}

		// GR 30.04.2015 go to the main window API, important for dispatch() 
		// ------------------------------------------------------------------
		while( ixmaps.embeddedApiA && ixmaps.embeddedApiA[szName] && (ixmaps.embeddedApiA[szName] != ixmaps) ){
			ixmaps = ixmaps.embeddedApiA[szName];
		}
		
		// GR 30.04.2015 dispatch() the url returned from the explicit function 
		//				 szAloneUrl is already complete
		// ------------------------------------------------------------------
		szEmbedUrl  = szEmbedUrl ?ixmaps.dispatch(szEmbedUrl) :szEmbedUrl;
		szPopoutUrl = szPopoutUrl?ixmaps.dispatch(szPopoutUrl):szPopoutUrl;

		// make generic share urls from the internal map template 
		// used only, if above defined explicit urls are null
		// ------------------------------------------------------

		// make url of the map template 
		var szTemplateUrl = ixmaps.dispatch("ui/dispatch.htm?");
		var szBasemap = ixmaps.getBaseMapParameter(ixmaps.szMapService);

		var szTemplateEdit   = szTemplateUrl + "ui=edit"   + szBasemap;
		var szTemplateView   = szTemplateUrl + "ui=view"   + szBasemap;
		var szTemplatePView  = szTemplateUrl + "ui=pview"  + szBasemap;
		var szTemplateEmbed  = szTemplateUrl + "ui=embed"  + szBasemap;
		var szTemplateMain   = szTemplateUrl + "ui=embed"  + szBasemap;
		var szTemplatePopout = szTemplateUrl + "ui=popout" + szBasemap;

		window.document.body.topMargin = 0;
		window.document.body.leftMargin = 0;
		
		var szProject = ixmaps.getProjectString();
		// test project string size
		// URL strings > 5000 lead to browser error
		if ( szProject.length > 4000 ){
			// if we have a project URL (.json) return this
			if ( ixmaps.loadedProjectUrl ){
				szProject =  ixmaps.loadedProjectUrl;
			}else
			// if not, try the original loaded project
			if ( ixmaps.loadedProject ){
				szProject = JSON.stringify(ixmaps.loadedProject);
			}
		}
		var szQuery = "&legend=1&project=" + szProject;
		// if szProject is JSON, encode URI
		if (szProject.match(/\{/)){
			szQuery = "&legend=1&project=" + encodeURIComponent(szProject);
		}

		szEmbedUrl  = szEmbedUrl || (szTemplateEmbed + szQuery);
		szAloneUrl  = szAloneUrl || (szTemplateMain + szQuery);
		szEditUrl   = szEditUrl  || (szTemplateEdit + szQuery);
		szViewUrl   = szViewUrl  || (szTemplateView + szQuery);
		szPViewUrl  = szPViewUrl || (szTemplatePView + szQuery);
		szPopoutUrl = szTemplatePopout + szQuery;

		switch(szType){
			case "view":
				return szViewUrl;
			case "pview":
				return szPViewUrl;
			case "edit":
				return szEditUrl;
			case "embed":
				return szEmbedUrl;
		}

	};

	ixmaps.popOutEmbed = function(fFlag,szTemplateUrl){
		window.open(ixmaps.getShareUrl("embed"));
	};

	ixmaps.popOutView = function(fFlag,szTemplateUrl){
		window.open(ixmaps.getShareUrl("view"));
	};

	ixmaps.popOutEdit = function(fFlag,szTemplateUrl){
		window.open(ixmaps.getShareUrl("edit"));
	};
	
	ixmaps.popOutProject = function(fFlag,szTemplateUrl){
		window.open(ixmaps.getShareUrl("pview"));
	};

	ixmaps.popOutMap = function(fFlag,szTemplateUrl){

		var szMapService = this.szMapService;
		var szMapType    = this.getMapTypeId();
		var szMapUrl     = this.getMapUrl();

		// get envelope with zoom factor 3 because the popout window is smaller than the map window
		var szEnvelope = this.getEnvelopeString(3);
		// get all themes
		var szThemesJS = this.getThemesString();
		// compose bookmark
		var szBookmark = "map.Api.doZoomMapToGeoBounds("+szEnvelope+");" + "map.Api.clearAll();" + szThemesJS;
		
		// make url of the map template 
		if ( !szTemplateUrl ){
			szTemplateUrl = ixmaps.dispatch("ui/dispatch.htm?ui=popout&minimal=1&toolbutton=1&logo=1");
		}
		szTemplateUrl += ixmaps.getBaseMapParameter(szMapService);

		// create complete url with query string 
		var szUrl = szTemplateUrl;
		szUrl += "&svggis=" + encodeURI(szMapUrl);
		szUrl += "&maptype=" + szMapType;
		szUrl += "&bookmark=" + encodeURI(szBookmark);

		// alternative store map parameter for child window access
		ixmaps.popoutURL		= szTemplateUrl;
		ixmaps.popoutSVGGIS		= szMapUrl;
		ixmaps.popoutTYPE		= szMapType;
		ixmaps.popoutBOOKMARK	= szBookmark;

		// here we can decide which mode of parameter passing we want (with query string or through ixmaps properties)
		var szPopOutUrl = szUrl;

		if ( !fFlag.match(/window/) ){
			this.openDialog(null,szPopOutUrl,'','auto',400,450);
		}
		if ( !fFlag.match(/dialog/) ){
			window.open(szPopOutUrl,'map popout'+Math.random(), 'alwaysRaised=yes, titlebar=no, toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=400, height=450');
		}
	};
	ixmaps.mailMap = function(fFlag,szTemplateUrl){

		var szMapService = this.szMapService;
		var szMapUrl	 = this.getMapUrl();
		var szMapType    = this.getMapTypeId();
		// get envelope 
		var szEnvelope = this.getEnvelopeString(1);
		// get all themes
		var szThemesJS = this.getThemesString();
		// compose bookmark
		var szBookmark = "map.Api.doZoomMapToGeoBounds("+szEnvelope+");"+szThemesJS;

		var szHost = ""; //"http://"+$(location).attr('host');

		// make url of the map template 
		if ( !szTemplateUrl ){
			szTemplateUrl = ixmaps.dispatch("ui/dispatch.htm?ui=full");
		}
		szTemplateUrl += ixmaps.getBaseMapParameter(szMapService);

		// create complete url with query string 
		var szUrl = szHost + szTemplateUrl;
		szUrl += "&svggis=" + encodeURI(szMapUrl);
		szUrl += "&maptype=" + szMapType;
		szUrl += "&bookmark=" + encodeURIComponent(szBookmark);

		var szSubject = "iXmaps - map link sent by user";		
		var szBody    = "This email was sent to you by a user of iXmaps:\n\n"+
						"The below link will open an interactive SVG map in HTML5 enabled browser (Chrome, Firefox and Safari):\n\n";		
		var szBody2   = "\n\n(the link may be long because it contains zoom and charting parameter)\n";		
		location.href='mailto:?subject='+szSubject+'&body='+encodeURI(szBody)+encodeURIComponent(szUrl)+encodeURI(szBody2)+'';
	};

	ixmaps.getMapUrl = function(){
		return decodeURI(ixmaps.szUrlSVG);
	};
	ixmaps.getLoadedMapUrl = function(){
		if ( ixmaps.loadedMap ){
			return decodeURI(ixmaps.loadedMap);
		}else{
			return "";
		}
	};
	ixmaps.getLoadedMapString = function(){
		if ( ixmaps.loadedMap ){
			return "map.Api.loadMap('"+decodeURI(ixmaps.loadedMap)+"');";
		}else{
			return "";
		}
	};
	ixmaps.getStoryUrl = function(){
		try {
			return decodeURI( $(document).getUrlParam('story')					||
							  $(window.parent.document).getUrlParam('story')	 );
		}
		catch (e){ return null; }
	};
	ixmaps.getMapTypeId = function(){
		return htmlMap_getMapTypeId();
	};
	ixmaps.setMapTypeId = function(szId){
		if ( szId != htmlMap_getMapTypeId() ){
			ixmaps.htmlgui_setMapTypeBG(szId);
			return htmlMap_setMapTypeId(szId);
		}
	};

	function changeCss(className, classValue) {
		var cssMainContainer = $('#css-modifier-container-dialog');

		if (cssMainContainer.length == 0) {
			cssMainContainer = $('<style id="css-modifier-container-dialog"></style>');
			cssMainContainer.appendTo($('head'));
		}
		cssMainContainer.append(className + " {" + classValue + "}\n");
	}

	ixmaps.htmlgui_setMapTypeBG = function(szId){

		if (!szId){
			return;
		}
		$("#css-modifier-container-dialog").remove();

		if ( szId.match(/dark/i) || szId.match(/black/i) || szId.match(/satellite/i)){
			//$("#ixmap").css({"background":"black"});
			$("#gmap").css({"background":"black"});
			$("#story_board").css({"background":"black"});

			// GR 18.06.2019 change color of sidebar body, for legend left/right
			try{
				window.parent.window.parent.window.document.getElementById('sidebar').parentNode.parentNode.style.setProperty("background-color","black");
			}
			catch (e){}

			$( "#switchlegendbutton" ).css("background-color","#222222");
			$( "#switchlegendbutton" ).css("border-color","#666666");

			//$( "#switchmodebutton" ).css("background-color","#888888");
			//$( "#switchmodebutton" ).css("border-color","#666666");

			changeCss(".ui-dialog", "opacity:0.9" );
			changeCss(".ui-dialog", "background:#222" );
			changeCss(".ui-dialog-titlebar", "background:#222" );
			changeCss(".ui-dialog-titlebar", "color:#888" );
			changeCss(".legend-description", "color:#888" );
			changeCss("tr.theme-legend-item-selected", "background:#333" );

			changeCss("span.theme-button", "background:none" );
			changeCss("span.theme-button", "color:white" );
			changeCss("span.legend-button-settings", "color:#333333" );

			changeCss(".btn-default","background-color:#444444");

			changeCss(".loading-text","background-color:rgba(0,0,0,0.5)");

		}else if ( szId.match(/gray/i) ){
			$("#ixmap").css({"background":"#D4DADC"});
			//$("#gmap").css({"background":"#D4DADC"});
			$("#story_board").css({"background":"#D4DADC"});
			$( "#switchlegendbutton" ).css("background-color","#D4DADC");
			$( "#switchlegendbutton" ).css("border-color","#dddddd");

			changeCss(".loading-text","background-color:rgba(255,255,255,0.5)");
			
		}else if ( szId.match(/transparent/i) ){
			$("#ixmap").css({"background":"none"});
			$("#gmap").css({"background":"none"});
			$("#story_board").css({"background":"#ffffff"});
			$( "#switchlegendbutton" ).css("background-color","#D4DADC");
			$( "#switchlegendbutton" ).css("border-color","#dddddd");

			changeCss(".loading-text","background-color:rgba(255,255,255,0.5)");
			
		}else if ( szId.match(/#/i) ){
			console.log({"background":szId});
			$("#ixmap").css({"background":szId});
			$("#gmap").css({"background":szId});
			$("#story_board").css({"background":szId});
			$( "#switchlegendbutton" ).css("background-color","#D4DADC");
			$( "#switchlegendbutton" ).css("border-color","#dddddd");

			changeCss(".loading-text","background-color:rgba(255,255,255,0.5)");
			
		}else{
			$("#ixmap").css({"background":"none"});
			$("#gmap").css({"background":"none"});
			$("#story_board").css({"background":"#ffffff"});
			$( "#switchlegendbutton" ).css("background-color","#ffffff");
			$( "#switchlegendbutton" ).css("border-color","#dddddd");

			changeCss(".loading-text","background-color:rgba(255,255,255,0.5)");
		}

		__cssControls(szId);

		// bubble it up !
		try{
			if ( this.parentApi && (this.parentApi != this) ){
				this.parentApi.htmlgui_setMapTypeBG(szId);
			}
		}
		catch (e){
		}
	};

	ixmaps.htmlgui_saveBookmark = function(){
		ixmaps.htmlgui_doSaveBookmark();
	};

	ixmaps.htmlgui_doSaveBookmark = function(szName){

		var szBookMarkJS = this.getBookmarkString();

		htmlgui_setCookie("test", szBookMarkJS);
		this.embeddedSVG.window.map.Api.displayMessage("Bookmark saved",1000);
	};

	ixmaps.getEnvelopeString = function(nZoom){

		var arrayPtLatLon = this.embeddedSVG.window.map.Api.getBoundsOfMapInGeoBounds();
		arrayPtLatLon[0].x = Math.max(Math.min(arrayPtLatLon[0].x,180),-180);
		arrayPtLatLon[0].y = Math.max(Math.min(arrayPtLatLon[0].y,80),-80);
		arrayPtLatLon[1].x = Math.max(Math.min(arrayPtLatLon[1].x,180),-180);
		arrayPtLatLon[1].y = Math.max(Math.min(arrayPtLatLon[1].y,80),-80);
		
		var mX = (arrayPtLatLon[1].x+arrayPtLatLon[0].x)/2;
		var mY = (arrayPtLatLon[1].y+arrayPtLatLon[0].y)/2;

		var dX = (arrayPtLatLon[1].x-arrayPtLatLon[0].x);
		var dY = (arrayPtLatLon[1].y-arrayPtLatLon[0].y);

		dX = dX / (2*Math.max(1,nZoom||1));
		dY = dY / (2*Math.max(1,nZoom||1));

		var szEnvelope = String(mY-dY) +","+
						 String(mX-dX) +","+
						 String(mY+dY) +","+
						 String(mX+dX);

		return szEnvelope;
	};

	ixmaps.getLayerString = function(){

		var layerA = ixmaps.getLayer();

		var switchLayerObject = {};

		for ( var a in layerA ){
			fOff = false;

			var sub = false;
			var layer = layerA[a];
			for ( var c in layer.categoryA ){
				if ( c && (layer.categoryA[c].type != "single") && (layer.categoryA[c].legendname) ){
					sub = true;
				}
			}

			if ( sub ){
				for ( c in layerA[a].categoryA ){
					if ( layerA[a].categoryA[c].display == "none" )	{
						fOff = true;
					}
				}
				if ( fOff ){
					var offlist = [];
					var onlist = [];
					switchLayerObject[a] = {};
					for ( c in layerA[a].categoryA ){
						if ( layerA[a].categoryA[c].display == "none" )	{
							offlist.push(c);
						}else{
							onlist.push(c);
						}
					}
					if ( offlist.length < onlist.length ){
						switchLayerObject[a].off = offlist;
					}else{
						switchLayerObject[a].on  = onlist;
					}
				}
			}else{
				if ( layerA[a].szDisplay == "none" )	{
					switchLayerObject[a] = {"display":"none"};
				}
			}
		}
		return "map.Api.setMapLayer('"+JSON.stringify(switchLayerObject)+"');";
	};

	ixmaps.getThemesString = function(){

		var szThemesJS  = ixmaps.htmlgui_getParamString().replace(/\"/gi,"'");
			szThemesJS += ixmaps.htmlgui_getFeaturesString().replace(/\"/gi,"'");
		szThemesJS = "";

		var szThemesA	  = this.embeddedSVG.window.map.Api.getMapThemeDefinitionStrings();
		for ( var i=0; i<szThemesA.length; i++){
			szThemesJS += szThemesA[i];
		}
		
		return szThemesJS;
	};
	ixmaps.htmlgui_getParamString = function(){

		var scaleParam = this.embeddedSVG.window.map.Api.getScaleParam();
		return "map.Api.setScaleParam("+JSON.stringify(scaleParam)+");";
	};
	ixmaps.htmlgui_getFeaturesString = function(){

		var szFeatures = this.embeddedSVG.window.map.Api.getMapFeatures()||"";

		// scan for doubles and keep only last one 
		// by creatating an object to reduce and remake the feature string form that

		var szFeaturesA = szFeatures.split(";");
		var d = {};
		for ( i=0; i<szFeaturesA.length; i++ ){
			var xA = szFeaturesA[i].split(":");
			d[xA[0]] = xA[1];
		}
		var szResult = "";
		for ( var i in d ){
			szResult += i +":" + d[i] +";";
		}
		return "map.Api.setMapFeatures('"+szResult+"');";
	};
	ixmaps.getScaleParam = function(){

		return this.embeddedSVG.window.map.Api.getScaleParam();
	};
	ixmaps.getOptionsxxx = function(){

		var szFeatures = this.embeddedSVG.window.map.Api.getMapFeatures();
		if ( !szFeatures || szFeatures == "" ){
			return null;
		}
		// scan for doubles and keep only last one 
		// by creatating an object to reduce and remake the feature string form that

		var szFeaturesA = szFeatures.split(";");
		var result = {};
		for ( i=0; i<szFeaturesA.length; i++ ){
			var xA = szFeaturesA[i].split(":");
			result[xA[0]] = xA[1];
		}

		// add htmlgui options
		result.basemapopacity = $(this.gmapDiv).css("opacity");

		return result;
	};

	ixmaps.getBookmarkString = function(nZoom){ 

		if ( !nZoom ){
			nZoom = 1;
		}

		var szBookMarkJS = "";

		// GR 24.11.2018 get loaded Map String 
		szBookMarkJS += ixmaps.getLoadedMapString();

		szBookMarkJS += ixmaps.htmlgui_getParamString().replace(/\"/gi,"'");
		szBookMarkJS += ixmaps.htmlgui_getFeaturesString().replace(/\"/gi,"'");

		var szEnvelope = this.getEnvelopeString(nZoom);

		// make executable SVG map API call
		szBookMarkJS += "map.Api.doZoomMapToGeoBounds("+szEnvelope+");";

		var center = this.htmlgui_getCenter();
		var zoom = this.htmlgui_getZoom();
		var szView = "["+center.lat+","+center.lng+"],"+ zoom;

		szBookMarkJS += "map.Api.doZoomMapToView("+szView+");";

		szBookMarkJS += this.getLayerString();

		szBookMarkJS += this.getThemesString();

		return szBookMarkJS;
	};

	ixmaps.htmlgui_getAttributionString = function(){
		if ($("#attribution")){
			return $("#attribution").html();
		}
		return "";
	};

	ixmaps.htmlgui_loadBookmark = function(){

		try	{
			// get the bookmark
			var xxx = htmlgui_getCookie("test");
			// if bookmark includes map themes, clear map first
			if ( xxx.match(/newMapTheme/) ){
				this.clearAll();
			}
			// GR 05.09.2011 magick !!
			ixmaps.htmlgui_synchronizeMap(false,true);

			// execute bookmark, which are direct Javascript calls
			this.embeddedSVG.window.map.Api.executeJavascriptWithMessage(xxx,"-> Bookmark",100);
		}
		catch (e){
			try{
				ixmaps.embeddedSVG.window.map.Api.displayMessage("no bookmark found !",1000);
			}catch (e){
				alert("no bookmark found!");
			}
		}
	};
	
	ixmaps.storedBookmarkA = new Array(0);

	ixmaps.execBookmark = function(szBookmark,fClear){

		this.fBookmark = true;

		if ( !this.embeddedSVG || !this.embeddedSVG.window || !this.embeddedSVG.window.map.Api ){
			ixmaps.pushBookmark(szBookmark);
			return;
		}

		if ( !szBookmark || typeof(szBookmark) == "undefined" ){
			this.embeddedSVG.window.map.Api.displayMessage("Bookmark undefined",1000);
			return;
		}

		if ( fClear ){
			this.clearAll();
		}

		// execute bookmark, which are direct Javascript calls
		var bookmarkA = szBookmark.split("map.Api");
		for ( var i=0; i<bookmarkA.length; i++ ){
			//this.embeddedSVG.window.map.Api.executeJavascriptWithMessage(szBookmark,"...",100);
			this.embeddedSVG.window.map.Api.executeJavascriptWithMessage("map.Api"+bookmarkA[i],"...",100);
		}

		// force HTML map synchronisation 
		if ( 0 && szBookmark.match(/doCenterMapToGeoBounds/) ){
			this.HTML_hideMap();
			setTimeout('ixmaps.htmlgui_synchronizeMap(false,true);',1000);
		}
	};

	ixmaps.pushBookmark = function(szBookmark){
		ixmaps.storedBookmarkA.push(szBookmark);
		setTimeout("ixmaps.popBookmark()",100);
	};
	ixmaps.popBookmark = function(){
		if ( !this.embeddedSVG ){
			setTimeout("ixmaps.popBookmark()",100);
			return;
		}
		if ( ixmaps.storedBookmarkA.length ){
			ixmaps.execBookmark(ixmaps.storedBookmarkA.pop());
			setTimeout("ixmaps.popBookmark()",100);
		}
	};
	ixmaps.isBookmark = function(){
		return this.fBookmark?true:false;
	}

	ixmaps.execScript = function(szScript,fClear){

		if ( !this.embeddedSVG || !this.embeddedSVG.window || !this.embeddedSVG.window.map.Api ){
			ixmaps.pushBookmark(szScript);
			return;
		}
		if ( fClear ){
			ixmaps.embeddedSVG.window.map.Api.clearAll();
			if ( szScript.match(/CHOROPLETH/) ){
				ixmaps.embeddedSVG.window.map.Api.clearAllChoropleth();
			}else{
				ixmaps.embeddedSVG.window.map.Api.clearAllCharts();
			}
		}
		eval('ixmaps.embeddedSVG.window.'+szScript);
	};



	// ----------------------
	// make chart type menu 
	// ----------------------

	var szChartMenuId = null;
	var fChartMenuDialog = false;
	var fChartMenuVisible = true;

	ixmaps.makeChartMenueHTML = function(szId){

		ixmaps.themeObj = ixmaps.themeObj || ixmaps.getThemeObj(szId);

		// make <div> + <svg> to receive the chart menu (in svg)
		var szHtml = "";
		szHtml += "<div style='font-size:0.6em;margin-bottom:0.5em'>select chart type:</div>";
		szHtml += "<div id='menuDiv' style='height:300px;width:260px;overflow:auto'><div><svg width='240' height='2000' viewBox='0 0 4800 40000'><g id='getchartmenutarget'></g></svg></div></div>";

		// create dialog
		__showChartDialog(szHtml,ixmaps.themeObj.szTitle);

		// call theme method to draw the charts
		var szTypelistA = ixmaps.themeObj.getChartTypeMenu($("#getchartmenutarget")[0],null,240);

		// create click map to select the chart for the theme
		szHtml = "<div style='position:relative;top:-2010px;'>";
		for ( i in szTypelistA ){
			if ( i%4 == 0 ){
				szHtml += "<div style='clear:both'>";
			}
			szHtml += "<a href=\"javascript:ixmaps.changeThemeStyle(null,'type:"+szTypelistA[i]+"','set');\"><div style='float:left;height:60px;width:60px;'></div></a>";
		}
		szHtml += "</div>";

		$("#menuDiv").append(szHtml);
	};

	__showChartDialog = function(szHtml,szTitle){

		ixmaps.szChartHtml  = szHtml  || ixmaps.szChartHtml  || "";
		ixmaps.szChartTitle = szTitle || ixmaps.szChartTitle || "";

		if ( !fChartMenuVisible ){
			return;
		}
	
		// create dialog (oversized) to host the ChartMenu
		//
		if ( !fChartMenuDialog ){
			ixmaps.openDialog('chartmenue','',ixmaps.szChartTitle,'10,103',300,400);
			fChartMenuDialog = true;
		}

		// set content and resize
		//
		$("#chartmenue").html(ixmaps.szChartHtml);

		$("#chartmenue").parent().css("width","300px");
		$("#chartmenue").parent().css("height","400px");

		$("#chartmenue").dialog({
		  close: function( event, ui ) {
				fChartMenuDialog = false;
				$("#chartmenue").remove();
			}
		});
	};

	ixmaps.copyThemeToClipboard = function(){
		navigator.clipboard.writeText(JSON.stringify(ixmaps.getThemeDefinitionObj()))
			.then(function() {
				ixmaps.message("theme copied",100);
			})
			.catch(function(err) {
				ixmaps.message("no theme to copy",100);
				console.log('Something went wrong', err);
			});
	};

	ixmaps.pasteThemeFromClipboard = function(){
		navigator.clipboard.readText()
			.then(function(text) {
				ixmaps.embeddedSVG.window.map.Api.newMapThemeByObj(JSON.parse(text));
			})
			.catch(function(err) {
				// maybe user didn't grant access to read from clipboard
				ixmaps.message("no theme to paste",100);
				console.log('Something went wrong', err);
			});
	};

    // new dialog !!!
    // --- SMOOTH DRAGGING FOR DIALOG ---
    const dialog = document.getElementById('myDialog');
    const header = document.getElementById('dialogHeader');
    let isDragging = false;
    let startX, startY, dialogStartX, dialogStartY;

    header.addEventListener('mousedown', function(e) {
      // Don't initiate drag if close button was clicked
      if (e.target.classList.contains('close-btn')) return;
      isDragging = true;
      // Use computed style to get current position
      const rect = dialog.getBoundingClientRect();
      dialog.style.left = rect.left + "px";
      dialog.style.top = rect.top + "px";
      startX = e.clientX;
      startY = e.clientY;
      dialogStartX = rect.left;
      dialogStartY = rect.top;
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      // Calculate new position
      let dx = e.clientX - startX;
      let dy = e.clientY - startY;
      dialog.style.left = (dialogStartX + dx) + "px";
      dialog.style.top = (dialogStartY + dy) + "px";
    });

    document.addEventListener('mouseup', function() {
      isDragging = false;
      document.body.style.userSelect = '';
    });

    // Allow closing with Escape key
    document.addEventListener('keydown', function(event){
      if(event.key === "Escape"){
        dialog.close();
      }
    });

    // Reset dialog position on close (optional)
    dialog.addEventListener('close', function() {
      dialog.style.top = '100px';
      dialog.style.left = '100px';
	  $(".dialog-body").html("");
	  $(".dialog-body").width("");
	  $(".dialog-body").height("");
    });


}( window.ixmaps = window.ixmaps || {}, jQuery ));

// -----------------------------
// EOF
// -----------------------------
