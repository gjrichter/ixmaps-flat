/**********************************************************************
 mapscript.js

$Comment: provides JavaScript interactivity for svggis
$Source : mapscript.js,v $

$InitialAuthor: guenter richter $
$InitialDate: 2004/12/15 $
$Author: guenter richter $
$Id: mapscript.js 9 2007-06-27 10:30:35Z Guenter Richter $

Copyright (c) Guenter Richter
$Log: mapscript.js,v $
**********************************************************************/

/** 
 * @fileoverview This file is the main JavaScript for SVGGIS Map Applications.<br>
 *
 * @author Guenter Richter guenter.richter@medienobjekte.de
 * @version 0.98 
 */

/* jshint funcscope:true, evil:true, eqnull:true, loopfunc:true, shadow: true, laxcomma: true, laxbreak: true, expr: true, sub: true */
/* globals 
	document, HTMLDocument, navigator, contextMenu, XMLHttpRequest,
	setTimeout, clearTimeout, alert, window, setMapTool, console, TRACE, _TRACE, _ERROR,
	displayScale, viewBox, viewBoxScale,
	TextField, InfoContainer, _removeInfo, Button
	*/

(function () {
    'use strict';
    
    /* ...................................................................* 
     *  global vars                                                       * 
     * ...................................................................*/

    var szSVG = "http:" + "/" + "/" + "www.w3.org/2000/svg";
    var szMapNs = "http:" + "/" + "/" + "www.medienobjekte.de";
    var szXlink = "http:" + "/" + "/" + "www.w3.org/1999/xlink";
    var szHTTP = "http:" + "/" + "/";
    var szHTTPS = "https:" + "/" + "/";

    var nStandardPPI = 72;
    var nScreenPPI = 96;
    var nInch = 2.54;

    var idTooltipTimeout = null;
    var nTooltipTimeout = 500;
    var idInfoTimeout = null;
    var nInfoTimeout = 250;

    var szViewer = "Adobe3.0";

    /** node of the legend text that is actually highlighted */
    /** name of the actually active theme (layer) */
    /** node found by map query, that activated a theme */
    /** holds the actual tooltip text, is used as flag */
    /**
     * define function printNode() if not given by the viewer
     */
    if (typeof (printNode) == "undefined") {
        window.printNode = function(node) {
            var serializer = new XMLSerializer();
            var xml = serializer.serializeToString(node);
            return xml;
        };
    }

    /* ...................................................................* 
     *  global objects                                                    * 
     * ...................................................................*/

    var map = null;

    /* ...................................................................* 
     *  the main namespace                                                    * 
     * ...................................................................*/

    /**
     * Create a new ixMap instance.  
     * @class the main namespace for all map properties and methods.
     * @constructor
     * @throws 
     * @return A new ixMap
     */
    var ixMap = function () {
        /** flag: initialization in progress */
        this.fInitializing = false;
        /** holds the subclass for event handling */
        this.Event = null;
        /** holds the subclass for map scaling */
        this.Scale = null;
        /** holds the subclass for map layer handling */
        this.Layer = null;
        /** holds the subclass for map tile handling */
        this.Tiles = null;
        /** holds the subclass for zooming methods */
        this.Zoom = null;
        /** holds the subclass for map query methods */
        this.Query = null;
        /** holds the subclass for methods to create map themes */
        this.Themes = null;

        /** holds the subclass for map legend handling */
        this.Legend = null;
        /** holds the subclass for toolbar handling */
        this.Toolbar = null;
        /** holds the subclass for map viewport methods */
        this.Viewport = null;

        /** holds the subclass for map api methods */
        this.Api = null;

        /** holds the URL root of a loaded map, "" if no additional map has been loaded */
        this.mapRoot = "";

        /** holds a SVG loader object, created on init() */
        this.Loader = new SVGLoader();

        // Global variables moved to ixMap object
        this.SVGDocument = null;
        this.rootGroup = null;
        this.nNodesCreated = 0;
        this.fObjectPseudoShadow = true;
        this.fEmbedScale = false;
        this.fSVGEmbeded = false;
        this.HTMLWindow = null;
        this.SVGRootElement = null;
        this.SVGToolsGroup = null;
        this.SVGThemeGroup = null;
        this.SVGFixedGroup = null;
        this.SVGPopupGroup = null;
        this.SVGNotifyGroup = null;
        this.SVGMessageGroup = null;
        this.SVGMenuGroup = null;
        this.SVGTltipGroup = null;
        this.SVGHiddenGroup = null;
        this.SVGTempGroup = null;
        this.SVGWidth = null;
        this.SVGHeight = null;
        this.SVGViewBox = null;
        this.SVGOrigViewBoxString = null;
        this.EmbedWidth = null;
        this.EmbedHeight = null;
        this.fTransparentMap = false;
        this.fClipMap = true;
        this.fClipMapDynamic = false;
        this.fZoomByViewer = false;
        this.fPDFEmbed = false;
        this.fAllIncluded = false;
        this.fSwitchByCSS = true;
        this.fLocalHost = false;
        this.fLoadIncludes = true;
        this.fDynamicLayer = true;
        this.fDynamicTiles = true;
        this.fTilesLoaded = false;
        this.fDiscardTiles = "delayed";
        this.fLoadMultiTiles = true;
        this.fMarkTiles = false;
        this.fLoadingSilent = false;
        this.fExecuteSilent = true;
        this.fNotify = false;
        this.szObjectGroupId = "mapobjects";
        this.szShadowFilterId = "DropShadowFilterObjects:antizoomandpan";
        this.szShadowFilterToolsId = "DropShadowFilterTools:antizoomandpan";
        this.szShadowFilterShapeId = "DropShadowFilterShape:antizoomandpan";

        this.fAntiZoomAndPan = true;
        this.fFeatureScaling = true;
        this.fObjectScaling = true;
        this.fSymbolScalingDynamic = true;
        this.fFeatureScalingDynamic = false;
        this.fAdaptLabelToScaling = true;
        this.fCheckLabelOverlap = true;
        this.fCheckLabelSpace = false;
        this.nCheckLabelSpace = 0.8;
        this.fCheckLabelSqueeze = true;
        this.fCheckLabelSize = true;
        this.fKillOverlappingLabel = false;
        this.fCheckLabelOnlyOne = false;
        this.fCheckOverlapImplicit = true;
        this.fCheckOverlapAllLayer = true;
        this.fCheckOverlapClipOnTiles = false;
        this.fTileTextNoClip = false;
        this.fFeatureScalingByLayer = true;
        this.fFroozeDynamicContent = false;
        this.fPendingNewGeoBounds = false;
        this.fPanByViewer = false;
        this.fPanToolByViewer = true;
        this.fPanHideTools = true;
        this.fEndPan = "normal";

        this.fRotateOnMouseMove = false;
        this.fTriggerMouseMoveForPan = true;
        this.fPreserveMapRatio = true;
        this.fInitLegendOff = false;
        this.fMapBorder = false;
        this.fMapBorder3D = false;
        this.nMapBorderWidth = 1;
        this.szMapBorderColor = "#B6BAC0";
        this.szMapPanBorderStyle = "fill:#E0E5F0";
        this.szMapPanBorderOnoverStyle = "fill:#d0d5e0";
        this.szMapBackgroundStyle = null;
        this.szMapBackgroundColor = null;
        this.fClipMapToLegend = false;
        this.fLegendToggleButtons = false;
        this.fNorthArrow = "rotatable";
        this.szNorthArrowPosition = "INMAP";
        this.szLocalPopupAlignment = null;
        this.szMessagePosition = "center";
        this.nToolMarginTop = 0;
        this.nFixedInfoScale = 1;
        this.fScaleBar = true;

        this.fDebug = false;
        this.fStatus = false;
        this.fSetToolCursor = false;
        this.fActivateInfoOnClick = false;
        this.szTextGridStyle = "background:#dddddd";
        this.fCheckSublayerCollapse = false;
        this.fCreatTextLink = true;
        this.nClipTextLink = 30;
        this.nInfoOffsetX = 25;
        this.nInfoOffsetY = -25;
        this.szInfoTitleColor = '#000000';
        this.szInfoTitleBgColor = '#ffffff';
        this.szInfoBodyColor = '#444444';
        this.szInfoBodyBgColor = '#FFFFDD';
        this.nInfoRoundRect = 2;
        this.fInfoShowShape = false;
        this.fActiveThemeInfo = false;
        this.fDecimalPointComma = false;
        this.nNormalSymbolSize = 20;
        this.nNormalButtonSize = 10;

        this.nNormalFontSize = 12;
        this.nHighlightToggle = 0;
        this.fLoadExternalData = false;
        this.fScaleToFullscreen = false;
        this.fHighlightHint = true;
        this.fAdaptMapScaleToSize = true;
        this.fLimitMapToExtent = false;
        this.szMapToolType = "";
        this.szLinkTarget = "_blank";
        this.szEmbedName = "SVGMap";
        this.newShape = null;
        this._legendIdent = null;
        this._activeTheme = null;
        this._activeItem = null;
        this._tooltip = null;

        this.antiZoomAndPanList = null;
        this.mouseObject = null;
        this.mapTool = null;
        this.mapTiles = null;
        this.bookmarkList = null;
        this.zoomAndPanHistory = null;
        this.highLightList = null;
        // end of globals

        /** holds the pushed init actions (see {@link #pushInitAction}) @type array */
        this.initActionA = new Array(0);
        /** holds the pushed messages for the pushed init action (or null) */
        this.initMessageA = new Array(0);
        /** holds the pushed actions (see {@link #pushAction}) @type array */
        this.actionA = new Array(0);
        /** holds the pushed messages for the pushed action (or null) */
        this.messageA = new Array(0);
    };
    /**
     * May be called by the embedding HTML page to set/change the map behaviour.<br>
     * Must be called as the answer to HTMLWindow.ixmaps.htmlgui_queryMapFeatures().
     * @param szFeatures string that contains the features
     * <br><br>
     * The syntax is similar to CSS stypes: "property_1:value_1;property_2:value_2;..."
     * <br><br>
     * The following map feature can be set:
     * <br><br>
     *  <table>
     *  <tr><td>featurescaling</td><td>adapt map features to zoom (p.e. line thickness)</td><td>false / true / dynamic</td></tr>
     *  <tr><td>objectscaling</td><td>adapt generated objets (e.b. charts) to the zoom</td><td>false / true / dynamic</td></tr>
     *  <tr><td>dynamiclabel</td><td>adapt label to path length, polygon space and check for overlap</td><td>false / true / delayed / ...</td></tr>
     *  <tr><td>dynamiclayer</td><td>switch layer on/off according to defined min/max scale</td><td>false / true / delayed</td></tr>
     *  <tr><td>dynamictiles</td><td>load tiles according to the map position (panning)</td><td>false / true / delayed</td></tr>
     *  <tr><td>discardtiles</td><td>clear unused (switched off) tiles</td><td>false / true / delayed</td></tr>
     *  <tr><td>loadmultitiles</td><td>allow multiple xml http request</td><td>false / true</td></tr>
     *  <tr><td>loadexternaldata</td><td>try to load map data from exeternal file (.js|.xml) before searching SVG</td><td>false / true</td></tr>
     *  <tr><td>loadincludes</td><td>load the defined SVG include files</td><td>false / true</td></tr>
     *  <tr><td>fastpan</td><td>hide map tools while panning</td><td>false / true</td></tr>
     *  <tr><td>panborder</td><td>define the width of a border around the map with which the map can be panned</td><td>false / true</td></tr>
     *  <tr><td>tooltipdelay</td><td>define delay (ms) for the tooltip display on mouse over</td><td>100 .. 1000</td></tr>
     *  <tr><td>popupdelay</td><td>define delay (ms) for the info display on mouse over</td><td>100 .. 1000</td></tr>
     *  <tr><td>popupgridstyle</td><td>define style of info display table</td><td>background|alternate|full|firstright|firstsmall|firstitalic|firstgray</td></tr>
     *  <tr><td>buttonsize</td><td>define the size (maximum of width/height) for all buttons (default 10 pixel)</td><td>[pixel]</td></tr>
     *  <tr><td>symbolsize</td><td>define the size (maximum of width/height) for all symbols (default 20 pixel)</td><td>[pixel]</td></tr>
     *  <tr><td>checklabeloverlap</td><td>if true, labels are checked for overlapping, and if possible the position is corrected</td><td>false / true</td></tr>
     *  <tr><td>onlyonelabel</td><td>if true, only one label per layer (or tile) is shown</td><td>false / true</td></tr>
     *  <tr><td>decimalpoint</td><td>the decimalpoint can be defined to comma by this</td><td>comma</td></tr>
     *  <tr><td>dynamicscale</td><td>adapt the map scale to the size of the embedding window (Browser, PDF Reader)</td><td>false / true</td></tr>
     *  <tr><td>screenppi</td><td>to set the screen ppi different from 96 (windows standard)</td><td>[number]</td></tr>
     *  <tr><td>clipmap</td><td>clip the map to the visible range (affects panning)</td><td>false / true / dynamic</td></tr>
     *  <tr><td>marktiles</td><td>show the tiling of the map by lines</td><td>[name]</td></tr>
     *  <tr><td>embedname</td><td>tell the name of the embed object (svg viewer)</td><td>[name]</td></tr>
     *  </table>
     * <br>
     * <strong>Sample:</strong><br> map.Api.setMapFeatures("featurescaling:dynamic;dynamiclayer:true;loadmultitiles:false"); 
     * <br><br>
     * <strong>Hints:</strong>
     * <table>
     * <tr><td>"featurescaling:dynamic"</td><td> features size will increase with progressive zoom</td></tr>
     * <tr><td>"mapclip:dynamic"</td><td> clip affects pattern, when map is zoomed; value 'dynamic' resolves that problem, but causes slower panning</td></tr>
     * <tr><td>"delayed"</td><td> the appropriate feature will be called with a little timeout; this enables faster map rendering, but shows transitory map states</td></tr>
     *  </table>
     */
    ixMap.prototype.setFeatures = function (szFeatures) {
        // save for bookmark creation
        // --------------------------
        this.szFeatures = (this.szFeatures || "") + ";" + szFeatures;
        var fOldCheckLabelOverlap = this.fCheckLabelOverlap;
        var featuresA = szFeatures.split(';');
        for (var i in featuresA) {
            var szAttA = featuresA[i].split(':');
            switch (szAttA[0]) {
                case "featurescaling":
                    if (szAttA[1] == "dynamic") {
                        this.fFeatureScaling = true;
                        this.fFeatureScalingDynamic = true;
                    } else {
                        this.fFeatureScaling = szAttA[1] == "false" ? false : szAttA[1];
                        this.fFeatureScalingDynamic = false;
                    }
                    break;
                case "objectscaling":
                    if (szAttA[1] == "dynamic") {
                        this.fObjectScaling = "dynamic";
                        // this.fFeatureScalingDynamic = true;
                    } else {
                        this.fObjectScaling = szAttA[1] == "false" ? false : szAttA[1];
                    }
                    break;
                case "objectlayer":
                    if (szAttA[1] == "belowlabel") {
                        this.szObjectGroupId = "mapobjects_below_label";
                    } else {
                        this.szObjectGroupId = szAttA[1];
                    }
                    break;
                case "dynamiclabel":
                    this.fAdaptLabelToScaling = szAttA[1] == "false" ? false : szAttA[1];
                    if (this.fAdaptLabelToScaling) {
                        this.fCheckLabelOverlap = true;
                        this.fCheckLabelSpace = true;
                        this.fCheckLabelSqueeze = true;
                        this.fKillOverlappingLabel = true;
                        this.fCheckLabelOnlyOne = false;
                        if (szAttA[1].match(/CHECKSPACE/)) {
                            this.fCheckLabelSpace = true;
                        }
                        if (szAttA[1].match(/NOCHECKSPACE/)) {
                            this.fCheckLabelSpace = false;
                        }
                        if (szAttA[1].match(/NOREPOSITIONING/)) {
                            this.fCheckLabelOverlap = true;
                            this.fKillOverlappingLabel = true;
                        }
                        if (szAttA[1].match(/NOREMOVE/)) {
                            this.fKillOverlappingLabel = false;
                        }
                        if (szAttA[1].match(/CHECKOVERLAP/)) {
                            this.fCheckLabelOverlap = true;
                        }
                        if (szAttA[1].match(/NOCHECKOVERLAP/)) {
                            this.fCheckLabelOverlap = false;
                        }
                        if (szAttA[1].match(/ONLYONE/)) {
                            this.fCheckLabelOnlyOne = true;
                        }
                        if (szAttA[1].match(/SQUEEZE/)) {
                            this.fCheckLabelSpace = true;
                        }
                        if (szAttA[1].match(/NOSQUEEZE/)) {
                            this.fCheckLabelSqueeze = false;
                        }
                        if (szAttA[1].match(/SIZE/)) {
                            this.fCheckLabelSize = true;
                        }
                        if (szAttA[1].match(/NOSIZE/)) {
                            this.fCheckLabelSize = false;
                        }
                        if (szAttA[1].match(/CLIPONTILES/)) {
                            this.fCheckOverlapClipOnTiles = true;
                        }
                        if (szAttA[1].match(/NOCLIPONTILES/)) {
                            this.fCheckOverlapClipOnTiles = false;
                        }
                    } else {
                        this.fCheckLabelOverlap = false;
                        this.fCheckLabelSpace = false;
                        this.fCheckLabelSqueeze = false;
                        this.fCheckLabelSize = false;
                        this.fKillOverlappingLabel = false;
                        this.fCheckLabelOnlyOne = false;
                    }
                    break;
                case "dynamiclayer":
                    this.fDynamicLayer = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "dynamictiles":
                    this.fDynamicTiles = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "discardtiles":
                    this.fDiscardTiles = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "loadmultitiles":
                    this.fLoadMultiTiles = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "loadexternaldata":
                    this.fLoadExternalData = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "loadincludes":
                    this.fLoadIncludes = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "loadsilent":
                    this.fLoadingSilent = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "worksilent":
                    this.fExecuteSilent = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "notify":
                    this.fNotify = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "fastpan":
                    this.fPanToolByViewer = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "fullscreen":
                    this.fScaleToFullscreen = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "realtimerotate":
                    this.fRotateOnMouseMove = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "tooltipdelay":
                    this.nTooltipTimeout = Number(szAttA[1]);
                    break;
                case "popupdelay":
                    this.nInfoTimeout = Number(szAttA[1]);
                    break;
                case "popupgridstyle":
                    this.szTextGridStyle = szAttA[1];
                    break;
                case "buttonsize":
                    this.nNormalButtonSize = Number(szAttA[1]);
                    break;
                case "symbolsize":
                    this.nNormalSymbolSize = Number(szAttA[1]);
                    break;
                case "panborder":
                    this.fMapBorder = true;
                    this.nMapBorderWidth = Number(szAttA[1]);
                    break;
                case "sidebarbuttons":
                    this.fLegendToggleButtons = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "3Dborder":
                    this.fMapBorder3D = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "mapbackgroundstyle":
                    this.szMapBackgroundStyle = szAttA[1];
                    break;
                case "mapbackgroundcolor":
                    this.szMapBackgroundColor = szAttA[1];
                    break;
                case "transparent":
                case "transparentbackground":
                    this.fTransparentMap = true;
                    break;
                case "mapopacity":
                    this.nOpacity = parseFloat(szAttA[1]);
                    this.setOpacity(this.nOpacity, "absolute");
                    break;
                case "clipmap":
                    if (szAttA[1] == "dynamic") {
                        this.fClipMap = true;
                        this.fClipMapDynamic = true;
                    } else {
                        this.fClipMap = szAttA[1] == "false" ? false : szAttA[1];
                        this.fClipMapDynamic = false;
                    }
                    break;
                case "checklabeloverlap":
                    this.fCheckLabelOverlap = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "onlyonelabel":
                    this.fCheckLabelOnlyOne = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "labelspace":
                    this.nCheckLabelSpace = parseFloat(szAttA[1]);
                    break;
                case "decimalpoint":
                    this.fDecimalPointComma = ((szAttA[1] == ",") || (szAttA[1] == "komma") || (szAttA[1] == "Komma") || (szAttA[1] == "comma")) ? true : false;
                    break;
                case "dynamicscale":
                    this.fAdaptMapScaleToSize = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "toolcursor":
                    this.fSetToolCursor = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "scalebar":
                    this.fScaleBar = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "northarrow":
                    this.fNorthArrow = szAttA[1] == "false" ? false : szAttA[1];
                    break;
                case "northarrowposition":
                    this.szNorthArrowPosition = szAttA[1];
                    break;
                case "screenppi":
                    nScreenPPI = Number(szAttA[1]);
                    if (!nScreenPPI) {
                        nScreenPPI = 96;
                    }
                    break;
                case "embedname":
                    this.szEmbedName = szAttA[1];
                    break;
                case "debug":
                    this.fDebug = szAttA[1];
                    break;
                case "marktiles":
                    this.fMarkTiles = szAttA[1];
                    break;
                case "popupalignment":
                    this.szLocalPopupAlignment = szAttA[1];
                    break;
                case "toolmargintop":
                    this.nToolMarginTop = Number(szAttA[1]);
                    break;
                case "messageposition":
                    this.szMessagePosition = szAttA[1];
                    break;

                    // GR 25.06.2012 map themes parameter

                case "maxThemeCharts":
                    this.Themes.nMaxThemeCharts = Number(szAttA[1]);
                    break;
                case "maxShadowCharts":
                    this.Themes.nMaxShadowCharts = Number(szAttA[1]);
                    break;
                case "flushPaintShape":
                    this.Themes.nflushPaintShape = Number(szAttA[1]);
                    break;
                case "flushChartDraw":
                    this.Themes.nflushChartDraw = Number(szAttA[1]);
                    if (this.Themes.activeTheme) {
                        this.Themes.activeTheme.nflushChartDraw = Number(szAttA[1]);
                    }
                    break;
                case "flushLabelDraw":
                    this.Label.nflushLabelDraw = Number(szAttA[1]);
                    break;
                case "activeThemeInfo":
                    this.fActiveThemeInfo = szAttA[1];
                    break;
                case "fixedInfoScale":
                    this.nFixedInfoScale = Number(szAttA[1]);
                    break;
                    // GR 19.10.2017
                case "normalSizeScale":
                    this.Scale.nNormalSizeScale = Number(szAttA[1]);
                    break;
                    // GR 04.01.2018
                case "dynamicScalePow":
                    this.Scale.nDynamicScalePow = Number(szAttA[1]);
                    break;
            }
        }
        // execute new settings
        if (!this.fClipMap || this.fClipMapDynamic) {
            map.Zoom.removeClipping();
        }
    };
    /**
     * get changed features string like: "featurescaling:dynamic;dynamiclayer:true;loadmultitiles:false"
     * @type string
     * @return the feature definition string
     */
    ixMap.prototype.getFeatures = function () {
        var szFeatures = this.szFeatures;
        this.szFeatures += ";mapopacity:" + String(this.nOpacity || 1);
        this.szFeatures += ";flushChartDraw:" + String(this.Themes.nflushChartDraw || 100000);
        return this.szFeatures;
    };
    /**
     * checks if any loading is in process (HTTLXMLRequest)
     * @return true or false
     */
    ixMap.prototype.isLoading = function () {
        if ((this.Loader && this.Loader.isWaiting()) ||
            (this.mapLoader && this.mapLoader.isWaiting()) ||
            (map.Tiles && map.Tiles.isLoading()) ||
            scriptLoaderPool.isLoading()) {
            return true;
        }
        return false;
    };
    /**
     * checks if an initializing (legend,toolbar,...) is in process 
     * @return true or false
     */
    ixMap.prototype.isInitializing = function () {
        if (this.fInitializing || (this.Legend && this.Legend.fInitializing) || !this.Scale) {
            return true;
        }
        return false;
    };
    /**
     * checks if no javascript is in process or planned 
     * @return true or false
     */
    ixMap.prototype.isIdle = function () {
        if (!this.isInitializing() && !this.isLoading() && (this.actionA.length === 0) && (this.initActionA.length === 0)) {
            return true;
        }
        return false;
    };
    /**
     * stores an action (JavaScript function to eval) for future execution.
     * the action will be executed when all actual loading processes are done.
     * a setTimeout("map.popAction()") is done to check this condition.
     * @param szAction the (JavaScript) action to be stored  
     */
    ixMap.prototype.pushAction = function (szAction, szMessage) {

        // GR 18.02.2014 prevent obsolet zoom and pan on initializing
        if (szAction.toString().match(/geobounds/i)) {
            for (var i = 0; i < this.actionA.length; i++) {
                if (this.actionA[i].toString().match(/geobounds/i)) {
                    this.actionA[i].slice(i, 1);
                    if (this.messageA[i]) {
                        this.messageA[i].slice(i, 1);
                    }
                }
            }
            this.fPendingNewGeoBounds = true;
        }
        if (szAction.toString().match(/toview/i)) {
            for (var i = 0; i < this.actionA.length; i++) {
                if (this.actionA[i].toString().match(/toview/i)) {
                    this.actionA[i].slice(i, 1);
                    if (this.messageA[i]) {
                        this.messageA[i].slice(i, 1);
                    }
                }
            }
            this.fPendingNewGeoBounds = true;
        }

        this.actionA.push(szAction);
        this.messageA.push(szMessage);
        if (!this.isInitializing() && this.actionA.length == 1) {
            setTimeout("map.popAction()", 10);
        }
    };
    /**
     * stores an action (JavaScript function to eval) for future execution.
     * the action will be executed when all actual loading processes are done.
     * a setTimeout("map.popAction()") is done to check this condition.
     * @param szAction the (JavaScript) action to be stored  
     */
    ixMap.prototype.pushInitAction = function (szAction, szMessage) {
        this.initActionA.push(szAction);
        this.initMessageA.push(szMessage);
        if (this.initActionA.length == 1) {
            setTimeout("map.popInitAction()", 10);
        }
    };
    /**
     * checks if all loading processes are done, to prove the condition for executing a stored (JacaScript) action.
     * if this condition is given, the action is executed by eval(szAction);
     * if not, a setTimeout("map.popAction()") is done to recheck later
     */
    ixMap.prototype.popAction = function () {
        if (this.actionA.length === 0) {
            //clearMessage();
            return;
        }
        if (this.isLoading() || this.isInitializing()) {
            if (!this.isLoading()) {
                this.npopActionWaitInit++;
            } else {
                this.npopActionWaitInit = 0;
            }
            if (this.npopActionWaitInit < 100) {
                setTimeout("map.popAction()", 500);
            } else {
                alert("Error at initializing !\nResource missing or corrupted ?\n");
                this.actionA.length = 0;
                this.initActionA.length = 0;
                this.fInitializing = false;
                try {
                    if (map.HTMLWindow) {
                        map.HTMLWindow.ixmaps.htmlgui_onMapError(window);
                    }
                } catch (e) {}
            }
            return;
        }
        var szAction = this.actionA.shift();
        var szMessage = this.messageA.shift();
        if (szMessage) {
            displayMessage(szMessage, 1000);
        }
        if (typeof szAction === 'function') {
            try {
                szAction();
            } catch (e) {
                if (e && (typeof (e) != "undefined") && e.description && (typeof (e.description) != "undefined")) {
                    alert("Error: " + e.description + ":\n\n" + szAction);
                }
            }
        }else{
            console.error("map.pushAction: Strings are no longer supported. Please pass a function.");
            alert("Error: map.pushAction called with string. See console for details.");
        }
        setTimeout("map.popAction()", 10);
    };
    /**
     * checks if all loading processes are done, to prove the condition for executing a stored (JacaScript) action.
     * if this condition is given, the action is executed by eval(szAction);
     * if not, a setTimeout("map.popAction()") is done to recheck later
     */
    ixMap.prototype.popInitAction = function () {
        if (this.initActionA.length === 0) {
            map.npopActionWaitInit = 0;
            map.popAction();
            return;
        }
        if (this.isLoading()) {
            setTimeout("map.popInitAction()", 10);
            return;
        }
        var szAction = this.initActionA.shift();
        var szMessage = this.initMessageA.shift();
        if (szMessage) {
            displayMessage(szMessage, 1000);
        }
        if (typeof szAction === 'function') {
            try {
                szAction();
            } catch (e) {}
        }else{
            console.error("map.pushInitAction: Strings are no longer supported. Please pass a function.");
            alert("Error: map.pushInitAction called with string. See console for details.");
        }
        setTimeout("map.popInitAction()", 10);
    };
    /**
     * checks if the given version is correct; used by additional JavaScript modules to check their compatibility
     * @param szVersion the version check string
     * @type boolean
     * @return true, if version is ok
     */
    ixMap.prototype.checkVersion = function (szVersion) {
        if (szVersion === null || szVersion != this.version) {
            return false;
        }
        return true;
    };
    /**
     * Is called by initAll with delay, to switch off the svggis logo
     */
    ixMap.prototype.fadeLogo = function () {
        var logoNode = this.SVGDocument.getElementById("mapbackground:logo");
        if (logoNode) {
            logoNode.parentNode.removeChild(logoNode);
        }
    };



    /**
     * Is called by initAll to hide map and legend during initialization
     */
    ixMap.prototype.hideAll = function () {
        var canvasNode = this.SVGDocument.getElementById("mapcanvas");
        if (canvasNode) {
            canvasNode.style.setProperty("display", "none", "");
        }
    };
    /**
     * Is called by initAll to show map and legend
     */
    ixMap.prototype.showAll = function () {
        var canvasNode = this.SVGDocument.getElementById("mapcanvas");
        if (canvasNode) {
            canvasNode.style.setProperty("display", "inline", "");
        }
    };
    /**
     * hide all map shapes
     */
    ixMap.prototype.hideMap = function () {
        if (this.fHidden) {
            return;
        }
        var canvasNode = this.SVGDocument.getElementById("maplayer");
        if (canvasNode) {
            canvasNode.style.setProperty("display", "none", "");
        }
        var objectsNode = this.SVGDocument.getElementById("mapobjects");
        if (objectsNode) {
            objectsNode.style.setProperty("display", "none", "");
        }
        this.fHidden = true;
    };
    /**
     * show all map shapes
     */
    ixMap.prototype.showMap = function () {
        if (!this.fHidden) {
            return;
        }
        var canvasNode = this.SVGDocument.getElementById("maplayer");
        if (canvasNode) {
            canvasNode.style.setProperty("display", "inline", "");
        }
        var objectsNode = this.SVGDocument.getElementById("mapobjects");
        if (objectsNode) {
            objectsNode.style.setProperty("display", "inline", "");
        }
        this.fHidden = false;
    };
    /**
     * set opacity of map shapes
     */
    ixMap.prototype.setOpacity = function (nValue, szMode) {
        var canvasNode = this.SVGDocument.getElementById("maplayer");
        if (canvasNode) {
            if (szMode == "absolute") {
                canvasNode.style.setProperty("opacity", nValue, "");
                this.nOpacity = nValue;
            } else {
                var szOpacity = canvasNode.style.getPropertyValue("opacity");
                if (szOpacity === null || szOpacity.length === 0) {
                    szOpacity = "1";
                }
                var nOpacity = parseFloat(szOpacity);
                nOpacity = nOpacity + nValue;
                nOpacity = Math.min(Math.max(nOpacity, 0), 1);
                this.nOpacity = nOpacity;
                canvasNode.style.setProperty("opacity", nOpacity, "");
            }
        }
    };
    /**
     * toggle opacity of map shapes
     */
    ixMap.prototype.toggleOpacity = function () {
        var canvasNode = this.SVGDocument.getElementById("maplayer");
        if (canvasNode) {
            var szOpacity = canvasNode.style.getPropertyValue("opacity");
            if (szOpacity === null || szOpacity.length === 0) {
                szOpacity = "1";
            }
            var nOpacity = parseFloat(szOpacity);
            nOpacity = (nOpacity < 1) ? 1 : 0;
            canvasNode.style.setProperty("opacity", nOpacity, "");
        }
    };
    /**
     * claer all highlights, themes, selections ...
     */
    ixMap.prototype.clearAll = function () {
        map.Dom.clearGroup(map.SVGToolsGroup);
        map.Dom.clearGroup(map.SVGFixedGroup);
        map.removeAllHighlights();
        if (map.Themes && map.Themes.removeAll) {
            map.Themes.removeAll();
        }
        setMapTool("");
        this.Scale.nObjectScaling = 1.0;
    };

    /**
     * load a new map
     * @param szUrl the map Url
     * @type void
     */
    ixMap.prototype.loadMap = function (szUrl) {
        if (!this.mapLoader) {
            this.mapLoader = new SVGLoaderMap();
        }
        if (this.mapLoader.importSVGFile(szUrl, this.SVGDocument)) {
            try {
                map.HTMLWindow.ixmaps.loadingMap = szUrl;
            } catch (e) {}
            if (szUrl.match(/http/)) {
                var szUrlA = szUrl.split(/\//);
                szUrlA.splice(-1);
                szUrl = szUrlA.join("/");
                this.mapRoot = szUrl + "/";
            } else {
                this.mapRoot = "";
            }
            this.clearAll();
            //map.Themes = new ixMap.Themes();
            map.Dom.clearGroup(map.Layer.objectGroup);
        }
    };

    // create instance here 
    var thisversion = "0.98";
    map = new ixMap();
    map.version = thisversion;
    // and make global
    window.map = map;
    window.thisversion = thisversion;
    
    /* ...................................................................* 
     *  Initialization                                                    * 
     * ...................................................................*/

    /**
     * Is called by the SVG document, if it is loaded 
     * @param evt the 'onload' event handle
     * @param embedName (optional) the name of the HTML tag that embeds the SVG document
     */
    function initAll(evt, embedName) {
        console.log("*** iXMaps mapscript version: " + map.version);
        // GR 03.12.2011 new timeout necessary because of cascaded embedding of SVG maps and Firefox ( parent window width was not ready; see below)) 
        // set SVGDocument must be called here !! because evt is lost by setTimeout();
        setSVGDocument(evt, null);
        setTimeout("delayedInitAll(null,'" + embedName + "')", 10);
    }
    var init = 0;

    function delayedInitAll(evt, embedName) {

        if ((window.innerWidth <= 0) || (window.innerHeight <= 0)) {
            console.log("window dimension is zero -> no map");
            setTimeout("delayedInitAll(null,'" + embedName + "')", 1000);
            return;
        }

        if (map.fInitializing) {
            return;
        }
        map.fInitializing = true;

        setSVGDocument(evt, null);


        // clear screen during init                                    
        map.hideAll();

        // create the dom manipulating object                                    
        map.Dom = new ixMap.Dom(evt);

        // get root element                                     
        map.SVGRootElement = map.SVGDocument;

        // store the embed information in the SVGDocument
        if (map.fSVGEmbeded) {
            var embedGroup = map.Dom.newNode('g', map.SVGRootElement);
            embedGroup.setAttribute("id", 'embed');
            embedGroup.setAttribute("name", embedName);
        }

        // create Group for all generated graphical objects         
        map.rootGroup = map.Dom.newGroup(map.SVGRootElement, 'objects:antizoomandpan');

        // create all needed Groups for the different graphic elements  
        map.SVGToolsGroup = map.Dom.newGroup(map.rootGroup, 'ToolsGroup');
        map.SVGFixedGroup = map.Dom.newGroup(map.rootGroup, 'FixedGroup');
        map.SVGThemeGroup = map.Dom.newGroup(map.rootGroup, 'ThemeGroup');
        map.SVGThemeGroup.style.setProperty("display", "none", "");
        map.SVGPopupGroup = map.Dom.newGroup(map.rootGroup, 'PopupGroup');
        map.SVGNotifyGroup = map.Dom.newGroup(map.rootGroup, 'NotifyGroup');
        map.SVGMessageGroup = map.Dom.newGroup(map.rootGroup, 'MessageGroup');
        map.SVGMenuGroup = map.Dom.newGroup(map.rootGroup, 'MenuGroup');
        map.SVGTltipGroup = map.Dom.newGroup(map.rootGroup, 'TltipGroup');
        map.SVGHiddenGroup = map.Dom.newGroup(map.rootGroup, 'HiddenGroup');
        map.SVGHiddenGroup.style.setProperty("display", "none", "");
        map.SVGTempGroup = map.Dom.newGroup(map.rootGroup, 'TempGroup');

        // read the SVG documents scaling                                   
        map.SVGWidth = parseInt(map.SVGRootElement.getAttribute('width'));
        map.SVGHeight = parseInt(map.SVGRootElement.getAttribute('height'));
        map.SVGOrigViewBoxString = map.SVGRootElement.getAttribute('viewBox');
        map.SVGViewBox = map.SVGRootElement.getAttribute('viewBox').split(' ');
        map.SVGViewBox[0] = Number(map.SVGViewBox[0]);
        map.SVGViewBox[1] = Number(map.SVGViewBox[1]);
        map.SVGViewBox[2] = Number(map.SVGViewBox[2]);
        map.SVGViewBox[3] = Number(map.SVGViewBox[3]);

        // create the scaling object                                    
        map.Scale = new ixMap.Scale();
        if (!map.Scale.scaleNode || !map.Scale.extentNode) {
            alert("SVG source not valid SVGGIS map !");
            return;
        }
        map.Scale.superclass = map;

        if (map.fAllIncluded || map.fPDFEmbed) {
            map.Scale.createWidgetStyles();
            map.Scale.normalizeSymbols(map.SVGDocument.getElementById("symbolstore"));
            map.Scale.normalizeButtons(map.SVGDocument.getElementById("widgetstore"));
            map.Event = new ixMap.Event();
            map.Event.initUseNodes(map.SVGDocument.getElementById("widgetstore"));
        } else {
            map.pushAction(() => {
                map.Scale.createWidgetStyles();
            });
            map.pushAction(() => {
                map.Scale.normalizeSymbols(map.SVGDocument.getElementById("symbolstore"));
            });
            map.pushAction(() => {
                map.Scale.normalizeButtons(map.SVGDocument.getElementById("widgetstore"));
            });

            // load local settings here, so they can parametrize the 2nd part of init
            try {
                // 1. load from referenced include path                                    
                if (typeof (map.HTMLWindow.ixmaps.SVGResources_includePath) != 'undefined') {
                    map.Loader.importSVGFile(map.HTMLWindow.ixmaps.SVGResources_includePath + "/maplocal.svg", map.SVGDocument, map.SVGTempGroup, null);
                }
                // 2. load from resource base 
                else
                if (typeof (ixmaps.szResourceBase) != 'undefined') {
                    map.Loader.importSVGFile(ixmaps.szResourceBase + "/maps/svg/resources/svg/maplocal.svg", map.SVGDocument, map.SVGTempGroup, null);
                }
                // if not defined, try this                                    
                else {
                    map.Loader.importSVGFile("../../maps/svg/resources/svg/maplocal.svg", map.SVGDocument, map.SVGTempGroup, null);
                    //map.Loader.importSVGFile("../resources/svg/maplocal.svg",map.SVGDocument,map.SVGTempGroup,null);
                }
                // than load from local include path                                    
                //map.Loader.importSVGFile("./maplocal.svg",map.SVGDocument,map.SVGTempGroup,null);
            } catch (e) {}
        }

        // GR 30.06.2007 make shadow for the objects
        if (!map.SVGDocument.getElementById(map.szShadowFilterToolsId)) {
            var filterNode = map.Dom.newNode('filter', map.rootGroup);

            filterNode.setAttributeNS(null, "id", map.szShadowFilterToolsId);
            filterNode.setAttributeNS(null, "filterUnits", "objectBoundingBox");
            filterNode.setAttributeNS(null, "x", "-50%");
            filterNode.setAttributeNS(null, "y", "-50%");
            filterNode.setAttributeNS(null, "width", "200%");
            filterNode.setAttributeNS(null, "height", "200%");

            var filter = map.Dom.newNode('feGaussianBlur', filterNode);
            filter.setAttributeNS(null, "stdDeviation", "50");
            filter.setAttributeNS(null, "result", "BlurAlpha");

            filter = map.Dom.newNode('feOffset', filterNode);
            filter.setAttributeNS(null, "in", "BlurAlpha");
            filter.setAttributeNS(null, "dx", "20");
            filter.setAttributeNS(null, "dy", "20");
            filter.setAttributeNS(null, "result", "OffsetBlurAlpha");

            filter = map.Dom.newNode('feColorMatrix', filterNode);
            filter.setAttributeNS(null, "in", "OffsetBlurAlpha");
            filter.setAttributeNS(null, "type", "matrix");
            filter.setAttributeNS(null, "values", "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.3 0");
            filter.setAttributeNS(null, "result", "matrixOut");

            filter = map.Dom.newNode('feMerge', filterNode);
            var merge = map.Dom.newNode('feMergeNode', filter);
            merge.setAttributeNS(null, "in", "matrixOut");
            merge = map.Dom.newNode('feMergeNode', filter);
            merge.setAttributeNS(null, "in", "SourceGraphic");
        }

        // GR 10.02.2011 workaround firefox (needs it twice; getBBox() error ) 
        if (szViewer.match(/Firefox/i)) {
            map.pushAction(() => {
                map.Scale.normalizeSymbols(map.SVGDocument.getElementById("symbolstore"));
            });
            map.pushAction(() => {
                map.Scale.normalizeButtons(map.SVGDocument.getElementById("widgetstore"));
            });
        }

        init++;
        //displayMessage(" ... loading ... "+(init>1?String(init):""));

        // load external SVG fragments                                    
        if (map.fLoadIncludes) {
            if (map.fLoadIncludes == "delayed") {
                map.pushInitAction(() => {
                    load_includes();
                });
            } else {
                load_includes();
            }
        }

        if (map.fAllIncluded || map.fPDFEmbed) {
            doInitAll_2();
        } else {
            // give time to load and/or render before 2nd part
            map.pushInitAction(() => {
                doInitAll_2(null);
            }, " ... ");
        }
    }
    /**
     * Is called by initAll() to continue initialization 
     * @param evt the 'onload' event handle
     */
    function doInitAll_2(evt) {


        if (map.HTMLWindow) {
            map.pushInitAction(() => {
                map.HTMLWindow.ixmaps.htmlgui_onMapInit(window);
            });
        }

        // create the event object                                    
        map.Event = new ixMap.Event();

        // set basic actionhandler                                     
        map.SVGRootElement.setAttribute("onmouseover", "map.Event.defaultMouseOver(evt)");
        map.SVGRootElement.setAttribute("onmouseout", "map.Event.defaultMouseOut(evt)");
        map.SVGRootElement.setAttribute("onmousedown", "map.Event.defaultMouseDown(evt)");
        map.SVGRootElement.setAttribute("ontouchstart", "map.Event.defaultMouseDown(evt)");
        map.SVGRootElement.setAttribute("onmouseup", "map.Event.defaultMouseUp(evt)");
        map.SVGRootElement.setAttribute("ontouchend", "map.Event.defaultMouseUp(evt);map.Event.defaultMouseClick(evt)");
        map.SVGRootElement.setAttribute("onmousemove", "map.Event.defaultMouseMove(evt)");
        map.SVGRootElement.setAttribute("ontouchmove", "map.Event.defaultMouseUp(evt);map.Event.defaultMouseMove(evt);map.HTMLWindow.ixmaps.htmlgui_onSVGPointerIdle()");
        map.SVGRootElement.setAttribute("onclick", "map.Event.defaultMouseClick(evt)");
        map.SVGRootElement.setAttribute("onkeydown", "map.Event.defaultKeyDown(evt)");
        map.SVGRootElement.setAttribute("onkeyup", "map.Event.defaultKeyUp(evt)");

        // set viewer zoom actionhandler                                     
        if (typeof (map.Event.doDefaultZoom) == 'function') {
            map.SVGRootElement.addEventListener('SVGZoom', map.Event.doDefaultZoom, false);
            map.SVGRootElement.addEventListener('SVGScroll', map.Event.doDefaultPan, false);
            map.SVGRootElement.addEventListener('SVGResize', map.Event.doDefaultResize, false);
        }

        // create the layer object                                    
        map.Layer = new ixMap.Layer(evt);

        // Recreate themes object to ensure clean state on SVG reload
        // (map.Themes is created at script load time in maptheme.js, but recreated here for clean state)
        if (window.ixMap) {
            map.Themes = new ixMap.Themes();
            try {
                if (map.HTMLWindow && map.HTMLWindow.ixmaps && map.HTMLWindow.ixmaps.htmlgui_onInitThemes) {
                    map.HTMLWindow.ixmaps.htmlgui_onInitThemes();
                }
            } catch (e) { }
        }

        // initialize anti zoom and pan                                   
        map.antiZoomAndPanList = new AntiZoomAndPan(evt);
        map.antiZoomAndPanList.initAntiZoomPattern(evt, null);
        // GR 04.02.2011
        map.antiZoomAndPanList.initAntiZoomSymbols(null, map.SVGDocument.getElementById("symbolstore"));
        map.antiZoomAndPanList.initAntiZoomStyles(evt);
        map.Layer.initPatternScaling(evt, null);

        // initialize zooming                                    
        map.Zoom = new ixMap.Zoom(map.Scale.initScale);

        // initialize tile processing                                   
        map.Tiles = new ixMap.Tiles();

        // initialize label processing                                   
        map.Label = new ixMap.Label();

        // initialize map viewport
        map.Viewport = new ixMap.Viewport(evt);

        //setTimeout("displayScale(null,'bottom')",100);
        // map.pushAction(() {
        //  map.Zoom.initOverviewMap(null);
        // });

        // may be not necessary; TBD changes in SVGGIS GR 05.10.2006
        map.Layer.switchScaleDependentLayer(evt);
        map.Scale.refreshCSSStyles();

        // GR 28.02.2011 baseline-shift not working in Chrome, Firefox, ...
        map.pushAction(() => {
            map.Layer.scaleLineDecorations(map.SVGRootElement,1);
        });

        // initialize map GUI  
        try {
            // remove Adobe Context Menu
            var mRoot = contextMenu.firstChild;
            map.Dom.clearGroup(mRoot);
        } catch (e) {}

        // initialize html GUI and ask for map feature parameter
        try {
            map.HTMLWindow.ixmaps.htmlgui_setScaleSelect(String(__formatValue(Math.floor(map.Scale.nTrueMapScale * map.Scale.nZoomScale)), 0, "BLANK"));
        } catch (e) {}
        // report actual envelope 
        try {
            map.HTMLWindow.ixmaps.htmlgui_setCurrentEnvelope(map.Zoom.getEnvelopeString(), true);
        } catch (e) {}
        try {
            map.HTMLWindow.ixmaps.htmlgui_queryMapFeatures();
        } catch (e) {}


        // if clipping switched off, deactivate clip path
        if (!map.fClipMap || map.fClipMapDynamic) {
            map.Zoom.removeClipping();
        }

        // finally load external tiles, if present
        if (map.fPDFEmbed) {
            map.Tiles.switchScaleDependentTiles(evt);
            clearMessage();
        }

        // show all
        //setTimeout("map.showAll()",1500);
        //map.pushAction(() => {
        //  map.showAll();
        // });

        // init delayed to include all loaded parameter 
        setTimeout(() => {map.Zoom.init();}, 1000);

        // and fade logo
        setTimeout(() => {map.fadeLogo();}, 10000);

        // initiate dynamic label, if wanted
        map.Layer.prepareCheckOverlap(evt, map.Layer.layerNode);


        map.fInitializing = false;

        //map.Loader.importSVGFile("./maplocal.svg",map.SVGDocument,map.SVGTempGroup,null);

        // For orthographic projections only, center early BEFORE showAll() to prevent visual jump
        // This must happen before elements are drawn
        // Albers and Lambert don't need early centering as it causes ugly effects
        var szProjection = map.Scale.szMapProjection || "";
        if (szProjection.match(/orthographic/i)) {
            map.pushInitAction(() => {
                try {
                    // For orthographic, always start at (0, 0) to center the globe in SVG space
                    var centerLat = 0;
                    var centerLon = 0;
                    var zoomLevel = 5; // Default zoom
                    
                    // Try to get zoom from HTML map or use current zoom scale
                    if (map.HTMLWindow && map.HTMLWindow.ixmaps) {
                        try {
                            var htmlZoom = map.HTMLWindow.ixmaps.getZoom();
                            if (htmlZoom !== undefined && Number.isFinite(htmlZoom)) {
                                zoomLevel = htmlZoom;
                            }
                        } catch (e) {}
                    }
                    if (zoomLevel === 5 && map.Scale.nZoomScale && map.Scale.nZoomScale > 0) {
                        zoomLevel = Math.max(1, Math.min(20, Math.log2(map.Scale.nZoomScale) + 5));
                    }
                    
                    // For orthographic, also center the zoom node to align projection origin (0,0) with SVG viewport center
                    // Set flag to allow orthographic centering
                    map._allowOrthographicCenter = true;
                    map.Zoom.doCenterMapToGeoPosition(0, 0);
                    map._allowOrthographicCenter = false;
                    
                    // Center the orthographic projection early with small bounds around center point
                    // This updates projection parameters synchronously before showAll() is called
                    console.log("Early centering orthographic projection: center:", centerLat, centerLon, "zoom:", zoomLevel);
                    map.Zoom.doCenterMapToGeoBounds(centerLat - 0.1, centerLon - 0.1, centerLat + 0.1, centerLon + 0.1);
                } catch (e) {
                    console.error("Error in early orthographic projection centering:", e);
                }
            });
        }

        if (map.HTMLWindow) {
            map.pushInitAction(()=> {
                map.HTMLWindow.ixmaps.htmlgui_onMapReady(window);
            });
        }

        // show all
        map.pushInitAction(() => {
            map.showAll();
        });

        // with this dummy, we force the popInitAction() to start, if no other pushInitAction() has been done
        // this is necessary to get the popAction() running when the initAction queue has been done
        map.pushInitAction(() => {
            nothing();
        });

    }

    /* ...................................................................* 
     *  End Initialization                                                * 
     * ...................................................................*/

    // .............................................................................
    // init helpers            
    // .............................................................................

    /**
     * Is called by initAll (or with delay via popAction), to load external SVG fragments
     */
    function load_includes() {
        try {
            // first load from general resource path                                    
            //loadSVGIncludes(null, "../../maps/svg/resources/svg");
            // then load from maps resource path                                    
            //setTimeout("loadSVGIncludes(null,'../resources/svg')",10);
            // then load from the map path                                    
            //setTimeout("loadSVGIncludes(null,'./')",10);

            // finally, if defined, then load from an explicitly defined resource path                                    
            if (typeof (map.HTMLWindow.ixmaps.SVGResources_includePath) != 'undefined') {
                setTimeout("loadSVGIncludes(null,'" + map.HTMLWindow.ixmaps.SVGResources_includePath + "')");
            }
        } catch (e) {}
    }

    /**
     * Is called by initAll
     * @param evt the 'onload' event handle
     * @param embedName (optional) the name of the HTML tag that embeds the SVG document
     */
    function setSVGDocument(evt, embedName) {
        if (embedName) {
            map.fSVGEmbeded = true;
            if (document.embeds[embedName]) {
                map.SVGDocument = document.embeds[embedName].getSVGDocument();
                map.EmbedHeight = document.embeds[embedName].height;
                map.EmbedWidth = document.embeds[embedName].width;
            }
        } else {
            if (evt) {
                map.SVGDocument = evt.target.ownerDocument;
            } else {
                map.SVGDocument = document.getElementById("svg_map_document");
            }

        }
        // check, if we have all external svg included ; 
        if (map.SVGDocument.getElementById("widgetstore") && map.SVGDocument.getElementById("widgetstore").childNodes.length > 2) {
            map.fAllIncluded = true;
        }
        // check, if we run inside PDF; 
        if (!window.parent || !window.screen || !window.location) {
            map.fPDFEmbed = true;
        }

        map.fLocalHost = String(window.location).match(/localhost/);

        szViewer = navigator.appName;

        // get SVG viever info
        if (navigator.appName.match(/Adobe/) && navigator.appVersion.match(/6.0x/)) {
            szViewer = "Adobe6.0";
        } else
        if (navigator.appName.match(/Adobe/) && navigator.appVersion.match(/3.0/)) {
            szViewer = "Adobe3.0";
        } else
        if (navigator.appName.match(/Opera/)) {
            szViewer = "Opera";
        } else
        if (navigator.appName.match(/Netscape/)) {
            szViewer = "Netscape";
        }

        if (navigator.userAgent && navigator.userAgent.match(/Chrome/)) {
            szViewer = "Chrome";
        } else
        if (navigator.userAgent && navigator.userAgent.match(/Firefox/)) {
            szViewer = "Firefox";
        }

        // set the map namespace
        var szNs = map.SVGDocument.getAttribute("xmlns:xmap");
        if (szNs && szNs.length > 3) {
            szMapNs = szNs;
        }

        // GR 14.04.2010 set HTML document for __htmlgui calls (Firefox,Chrome,Opera,Safari)
        map.HTMLWindow = window;
        /**
        if (window.parent && window.parent.window && window.parent.window.ixmaps) {
            map.HTMLWindow = window.parent.window;
        }
        **/
    }

    // GR 09.05.2011 delay method calls for Firefox ( getBBox() error )

    var __execLaterA = new Array(0);

    function __executeMethodLater(obj, szExec) {
        __execLaterA.push({
            obj: obj,
            szExec: szExec
        });
        setTimeout("__doExecuteMethodLater()", 1);
    }

    function __doExecuteMethodLater() {
        var exec = __execLaterA.shift();
        if (exec) {
            if (typeof exec.obj[exec.szExec] === 'function') {
                exec.obj[exec.szExec]();
            } else {
                console.warn("__executeMethodLater: Method " + exec.szExec + " not found or not a function on object.");
            }
        }
    }

    // .............................................................................
    // methods to create and remove elements from the SVGObjectGroup (DOM)            
    // .............................................................................

    /**
     * Create a new ixMap.Dom instance.  
     * @class It links to the DOM of the SVG document and defines methods to query and change it
     * @constructor
     * @throws 
     * @return A new ixMap.Dom
     */
    ixMap.Dom = function (evt) {
        /** holds the main SVG document */
        this.targetDocument = window.document;
        if (evt) {
            this.targetDocument = evt.target.ownerDocument;
        }
        /** holds the root element of the SVG document @type DOM node */
        this.rootElement = map.SVGDocument;
        /** array that holds the result of the method {@link #getAllIds} @type array */
        this.idList = new Array(0);
        /** array that holds objects by random names created by pushObject; usefull to find DOM objects by a generated name on events */
        this.objStackA = new Array(0);
    };
    ixMap.Dom.prototype = new ixMap();

    /**
     * sets a new target document for all ixMapDom methods 
     * @param targetDocument the new target document to set
     */
    ixMap.Dom.prototype.setTargetDocument = function (targetDocument) {
        if (targetDocument) {
            this.targetDocument = targetDocument;
        }
    };
    /**
     * sets a new target SVG group <g> for all create methods.
     * New elements will be created within this group
     * @param targetGroup the new target group to set
     */
    ixMap.Dom.prototype.setTargetGroup = function (targetGroup) {
        if (targetGroup) {
            this.targetGroup = targetGroup;
        }
    };
    /**
     * creates a new DOM element with the given tag name 
     * @param tagName the tag name of the new element
     * @param targetGroup [optional] the target group to create the new node within 
     * @return the created element
     */
    ixMap.Dom.prototype.newNode = function (tagName, targetGroup) {
        var newNode = this.targetDocument.createElementNS(szSVG, tagName);
        (targetGroup || this.targetGroup).appendChild(newNode);
        return newNode;
    };
    /**
     * creates a new SVG group element with the given id
     * @param targetGroup [optional] the target group to create the new group within
     * @param szId  [optional] the id to be set for the created grouph
     * @return the created group element
     */
    ixMap.Dom.prototype.newGroup = function (targetGroup, szId) {
        var newNode = this.newNode('g', targetGroup);
        if (newNode) {
            if (szId) {
                newNode.setAttribute("id", szId);
            }
            newNode.fu = new Methods(newNode);
        }
        return newNode;
    };
    /**
     * creates a new DOM element with the given tag name and adds extended methods
     * @param tagName the tag name of the new element
     * @param targetGroup [optional] the target group to create the new node within 
     * @return the created element
     */
    ixMap.Dom.prototype.newObject = function (tagName, targetGroup) {
        var newNode = this.newNode(tagName, targetGroup);
        if (newNode) {
            newNode.fu = new Methods(newNode);
        }
        return newNode;
    };
    /**
     * calls .getElementById(id) and adds extended methods if node found
     * @param szId the id of the DOM node to fetch 
     * @return the enhanced element or null
     */
    ixMap.Dom.prototype.getObjectById = function (szId) {
        var nNode = this.targetDocument.getElementById(szId);
        if (nNode) {
            nNode.fu = new Methods(nNode);
        }
        return nNode;
    };
    /**
     * removes all child elements from the given SVG group <g>
     * @param nodeGroup the node of the group to clear 
     */
    ixMap.Dom.prototype.clearGroup = function (nodeGroup) {
        if (nodeGroup && nodeGroup.hasChildNodes()) {
            var childNodes = nodeGroup.childNodes;
            for (var i = childNodes.length - 1; i >= 0; i--) {
                nodeGroup.removeChild(childNodes.item(i));
            }
        }
    };
    /**
     * remove a DOM element given by its id
     * @param szId the id of the object (shape,group,...) to remove
     */
    ixMap.Dom.prototype.removeElementById = function (szId) {
        var objNode = map.SVGDocument.getElementById(szId);
        if (objNode && objNode.parentNode) {
            objNode.parentNode.removeChild(objNode);
        }
    };
    /**
     * creates a new DOM node and sets the given attributes
     * @param tagName the tag name of the new element
     * @param targetGroup the target group to create the new node within 
     * @param attributes an array with the attributes to set after node creation; e.g. {x:200,y:200,width:234 ... }
     * @return the created node
     */
    ixMap.Dom.prototype.constructNode = function (tagName, targetGroup, attributes) {
        var newElement = this.newObject(tagName, targetGroup);
        var a;
        for (a in attributes) {
            if (a.match(/xlink/)) {
                newElement.setAttributeNS("http:" + "/" + "/" + "www.w3.org/1999/xlink", a, attributes[a]);
            } else {
                newElement.setAttribute(a, attributes[a]);
            }
        }
        return newElement;
    };
    /**
     * helper to store a DOM object handle with a generated random name into a array
     * this is usefull, to retrieve the object later by this random name on events (text names can be passed to eventhandler)  
     * @return the generated random name to later retrieve the object
     */
    ixMap.Dom.prototype.pushObj = function (objNode) {
        var szId = "stackedObject" + String(Math.random());
        this.objStackA[szId] = objNode;
        return szId;
    };
    /**
     * helper to retrieve a stored a DOM object handle with its assoziated generated random name   
     * @return the stored object handle
     */
    ixMap.Dom.prototype.popObj = function (szId) {
        return this.objStackA[szId];
    };

    /**
     * creates a new SVG shape;
     * usefull wraper to create rect, circle, line and path elements.
     * <br><br>
     * The following shapes can be created:
     * <br><br>
     *  <table>
     *  <tr><td><CODE>szShape</CODE></td><td><CODE>a,b,c,...</CODE></td></tr>
     *  <tr><td>rect</td><td>x,y,width,height,style</td></tr>
     *  <tr><td>circle</td><td>cx,cy,r,style</td></tr>
     *  <tr><td>line</td><td>x1,y1,x2,y2,style</td></tr>
     *  <tr><td>path</td><td>d,style</td></tr>
     *  </table>
     * <br>
     * <strong>Sample:</strong><br> map.Dom.newShape("rect",0,0,200,200,"fill:red"); 
     * <br><br>
     * @param szShape the tag name of the shape element
     * @param targetGroup the target group to create the new node within 
     * @param a,b,c,... CSV of attributes 
     * @return the created shape node or null
     */
    ixMap.Dom.prototype.newShape = function (szShape, targetGroup, a, b, c, d, e, f, g, h, i, j, k) {
        var attributeA = null;
        switch (szShape) {
            case 'rect':
                if (!(isNaN(c) || (c <= 0) || isNaN(d) || (d <= 0))) {
                    attributeA = {
                        x: String(a),
                        y: String(b),
                        width: String(c),
                        height: String(d),
                        style: e
                    };
                }
                break;
            case 'circle':
                if (isFinite(c) && (c > 0)) {
                    attributeA = {
                        cx: String(a),
                        cy: String(b),
                        r: String(c),
                        style: d
                    };
                }
                break;
            case 'line':
                if (isFinite(a) && isFinite(b) && isFinite(c) && isFinite(d)) {
                    attributeA = {
                        x1: String(a),
                        y1: String(b),
                        x2: String(c),
                        y2: String(d),
                        style: e
                    };
                }
                break;
            case 'path':
                attributeA = {
                    d: String(a),
                    style: b
                };
                break;
        }
        if (attributeA) {
            return this.constructNode(szShape, targetGroup, attributeA);
        }
        return null;
    };
    /**
     * creates a new SVG text element
     * @param targetGroup the target group to create the new text node within 
     * @param x x position of the text 
     * @param y y position of the text 
     * @param s style of the text 
     * @param szText text itself 
     * @return the created text element
     */
    ixMap.Dom.prototype.newText = function (targetGroup, x, y, s, szText) {
        if (!(isFinite(x) && isFinite(y))) {
            return null;
        }
        if (!szText || (typeof (szText) == "undefined")) {
            szText = "(undefined)";
        }
        szText = String(szText);
        if (map.fCreatTextLink && szText.substr(0, 7) == szHTTP) {
            return this.newTextLink(targetGroup, x, y, s, szText);
        }
        if (map.fCreatTextLink && szText.substr(0, 8) == szHTTPS) {
            return this.newTextLink(targetGroup, x, y, s, szText);
        }
        var nT = this.constructNode('text', targetGroup, {
            x: String(x),
            y: String(y),
            style: s
        });
        var atext = this.targetDocument.createTextNode(szText);
        nT.appendChild(atext);
        return nT;
    };
    /**
     * creates a new SVG tspan element
     * @param targetGroup the target group to create the new tspan node within (must be a text node)
     * @param x x position of the text 
     * @param y y position of the text 
     * @param s style of the text 
     * @param szText text itself 
     * @return the created tspan element
     */
    ixMap.Dom.prototype.newTSpan = function (targetGroup, s, szText) {
        if (targetGroup.nodeName != "text") {
            return null;
        }
        if (!szText) {
            var szText = "(undefined)";
        }
        var nT = this.constructNode('tspan', targetGroup, {
            style: s
        });
        var atext = this.targetDocument.createTextNode(szText);
        nT.appendChild(atext);
        return nT;
    };
    /**
     * creates a new SVG text on path element
     * @param targetGroup the target group to create the new textPath node within 
     * @param szPathId the id of a SVG path element
     * @param szText text itself 
     * @param s the text style 
     * @param offset an offset of the text resp. the start of the path 
     * @return the created text element
     */
    ixMap.Dom.prototype.newTextOnPath = function (targetGroup, szPathId, szText, s, offset) {
        if (!szText || (typeof (szText) == "undefined")) {
            szText = "(undefined)";
        }
        szText = String(szText);
        var nT = this.constructNode('text', targetGroup, {
            style: s
        });
        var nTP = this.constructNode('textPath', targetGroup, {
            style: s
        });
        nTP.setAttributeNS(szXlink, "xlink:href", "#" + szPathId);
        nTP.setAttributeNS(null, "startOffset", offset);
        var atext = this.targetDocument.createTextNode(szText);
        nTP.appendChild(atext);
        nT.appendChild(nTP);
        return nT;
    };
    /**
     * creates a new SVG text link element ( &lt;a&gt; tag with blue and underlined text ).
     * <br>If the parameter <CODE>szLink</CODE> is missing, the displayed text will be the same as the link, but clipped at 30 characters.
     * @param targetGroup the target group to create the new text node within 
     * @param x x position of the text 
     * @param y y position of the text 
     * @param s style of the text 
     * @param szText text itself 
     * @param szLink [optional] a link different from the text can be defined here 
     * @return the created text link element
     */
    ixMap.Dom.prototype.newTextLink = function (targetGroup, x, y, s, szText, szLink) {
        var nL = this.constructNode('a', targetGroup);
        nL.setAttributeNS(szXlink, "xlink:href", (szLink ? szLink : szText));
        nL.setAttributeNS(null, "target", szLinkTarget);
        if (szText && (szText.length > 30)) {
            szText = szText.substr(0, 29) + " ...";
        }
        var nT = this.constructNode('text', nL, {
            x: String(x),
            y: String(y),
            style: s
        });
        var atext = this.targetDocument.createTextNode(szText);
        nT.appendChild(atext);
        nT.style.setProperty("fill", "blue", "");
        nT.style.setProperty("text-decoration", "underline", "");
        return nL;
    };
    /**
     * break long text into lines to fit within max width
     * @param textNode the SVG DOM node with the long text 
     * @param nMaxWidth the maximal block width
     * @return number of rows
     */
    ixMap.Dom.prototype.wrapText = function (textNode, nMaxWidth) {

        var text = textNode.firstChild.data;
        var fontsize = textNode.style.getPropertyValue("font-size");
        if (text) {
            // get text offset
            var x = textNode.getAttributeNS(null, "x");

            // get possible breaks
            var words = text.split(' ');
            textNode.removeChild(textNode.firstChild);

            var tspan_element = this.newTSpan(textNode, "", words[0]);
            tspan_element.setAttributeNS(null, "x", x);

            var nRows = 1;

            for (var i = 1; i < words.length; i++) {
                var len = tspan_element.firstChild.data.length; // Find number of letters in string
                tspan_element.firstChild.data += " " + words[i]; // Add next word
                if (tspan_element.getComputedTextLength() > nMaxWidth) {
                    tspan_element.firstChild.data = tspan_element.firstChild.data.slice(0, len); // Remove added word
                    var tspan_element = this.newTSpan(textNode, "", words[i]);
                    tspan_element.setAttributeNS(null, "x", x);
                    tspan_element.setAttributeNS(null, "dy", fontsize);
                    nRows++;
                }
            }
            return nRows;
        }
    };
    /**
     * get all id's within the childs of one node
     * @param objNode the node to start looking for ids 
     * @type array
     * @return an array with the found nodes
     */
    ixMap.Dom.prototype.getAllIds = function (objNode, nRecursion) {
        if (nRecursion === null) {
            this.idList.length = 0;
        }
        if (objNode && objNode.hasChildNodes()) {
            if (objNode.hasAttributes) {
                var szId = objNode.getAttributeNS(null, "id");
                if (szId) {
                    this.idList[this.idList.length] = szId;
                }
            }
            var allChildsA = objNode.childNodes;
            for (var i = 0; i < allChildsA.length; i++) {
                this.getAllIds(allChildsA.item(i), 1);
            }
        }
        return this.idList;
    };
    /**
     * add a given extension to all id's in the given node and its childnodes
     * usefull to create unique id's in loaded SVG fragments
     * @param objNode the node to start looking for ids to extend 
     * @param szExtend the string to add to all id found 
     */
    ixMap.Dom.prototype.extendAllIds = function (objNode, szExtend) {
        if (objNode && objNode.nodeType == 1) {
            var szId = objNode.getAttributeNS(null, "id");
            objNode.setAttributeNS(null, "id", szId + szExtend);
            var allChildsA = objNode.childNodes;
            for (var i = 0; i < allChildsA.length; i++) {
                this.extendAllIds(allChildsA.item(i), szExtend);
            }
        }
    };
    /**
     * returns the first parent node of a given node with a defined node name (tag i.e. <svg> ) 
     * @param objNode	 the starting node
     * @param szNodename the searched parent nodename
     * @return the first parent node that fits or null
     */
    ixMap.Dom.prototype.getParentByNodename = function (objNode, szNodename) {
        var parentNode = null;
        if (objNode) {
            while ((parentNode = objNode.parentNode)) {
                if (parentNode.nodeName == szNodename) {
                    return parentNode;
                }
                objNode = parentNode;
            }
        }
        return null;
    };

    /**
     * returns the first value found for the requested attribute starting from the given node 
     * @type string
     * @param objNode	 the starting node
     * @param szNspace   the namespace of the attribute
     * @param szAttName  the searched attribute field
     * @return the attribute value found or an empty string
     */
    ixMap.Dom.prototype.getAttributeByNodeOrParents = function (objNode, szNspace, szAttName) {
        var szId = null;
        while (objNode && (objNode.nodeType == 1)) {
            szId = objNode.getAttributeNS(szNspace, szAttName);
            if ((szId === null) || (szId.length === 0)) {
                objNode = objNode.parentNode;
            } else {
                return szId;
            }
        }
        return "";
    };
    /**
     * check if object has a clip-path defined, and return the clipping rect 
     * @param objNode	 the starting node
     * @return the clipping rect
     */
    ixMap.Dom.prototype.getClipRect = function (objNode) {
        var clipRect = null;
        var szClipUrl = objNode.getAttributeNS(null, "clip-path");
        if (szClipUrl) {
            var szM = szClipUrl.match(urlRegExp);
            if (szM && szM[1]) {
                var clipPathNode = map.SVGDocument.getElementById(szM[1]);
                if (clipPathNode && clipPathNode.hasChildNodes) {
                    clipRect = clipPathNode.firstChild;
                }
            }
        }
        return clipRect;
    };
    /**
     * set rectangular clipping to an object<br>
     * if clip-path not yet exists, create new one, else use existing one
     * @param objNode	 the starting node
     * @param setBox	 the clipping region as a box 
     * @return the clipping rect
     */
    ixMap.Dom.prototype.setClipRect = function (objNode, bBox) {
        var clipRect = this.getClipRect(objNode);
        if (!clipRect) {
            var szId = objNode.getAttributeNS(null, "id");
            var clipPathNode = map.Dom.newNode('clipPath', objNode.parentNode);
            clipPathNode.setAttributeNS(null, "id", szId + ":clippath");
            // for Firefox 1.5.0.1
            clipPathNode.setAttributeNS(null, "style", "pointer-events:all");
            clipRect = map.Dom.newShape('rect', clipPathNode, 0, 0, 1, 1, "fill:none;stroke:none;opacity:0");
            clipRect.setAttributeNS(null, "id", szId + ":cliprect");
            objNode.setAttributeNS(null, "clip-path", "url(#" + szId + ":clippath" + ")");
        }
        clipRect.setAttributeNS(null, "x", bBox.x);
        clipRect.setAttributeNS(null, "y", bBox.y);
        clipRect.setAttributeNS(null, "width", bBox.width);
        clipRect.setAttributeNS(null, "height", bBox.height);
        return clipRect;
    };

    // .................................................................... 
    // scaling              
    // .................................................................... 

    /**
     * Create a new ixMap.Scale instance.  
     * @class It provides all scaling and normalizing functions. <br>It scans the metadata of the SVG map to get the maps dimension and scale.
     * @constructor
     * @throws -
     * @return A new scale
     */
    ixMap.Scale = function () {


        if (map.fScaleToFullscreen && !map.fPDFEmbed && window.screen) {
            map.SVGRootElement.currentScale = 1;
            var xScale = window.innerWidth / map.SVGWidth;
            var yScale = window.innerHeight / map.SVGHeight;
            map.SVGRootElement.currentScale = Math.min(xScale, yScale);
        }
        /** the original viewbox of the SVG document as box object @type box */
        this.viewBox = new box(map.SVGViewBox[0], map.SVGViewBox[1], map.SVGViewBox[2], map.SVGViewBox[3]);
        /** the metadata node that contains the scaling attributes @type DOM node */
        this.scaleNode = null;
        /** the map scaling as factor (relative to the map scaling units) @type int */
        this.nMapScale = null;
        /** the map units as string @type string */
        this.szMapUnits = null;
        /** the map units as string @type string */
        this.szMapProjection = "UTM";

        /** the position of the map relative to the SVG canvas @type point */
        this.mapPosition = new point(0, 0);
        /** the internal offset of the map.  
         * ixMaps are generally generated around the coordinate 0,0. (e.g. -5000,-5000 - 5000,5000) and than translated. 
         * The mapOffset must be added to all map coordinates to get the canvas coordinate.
         * @type point
         */
        this.mapOffset = new point(0, 0);

        /** the SVG node, that realises the positioning of the map @type DOM node*/
        this.offsetNode = map.SVGDocument.getElementById("mapoffset");
        /** the SVG node, that realises the internal map coordinate offset @type DOM node */
        this.canvasNode = map.SVGDocument.getElementById("mapcanvas");
        /** the SVG node, that realises the map zooming and panning @type DOM node */
        this.zoomNode = map.SVGDocument.getElementById("mapzoomandpan");

        if (this.canvasNode) {
            this.mapOffset = getTranslate(this.canvasNode);
        }
        if (this.offsetNode) {
            this.mapPosition = getTranslate(this.offsetNode);
        }

        /** holds the node of the css styles @type DOM node */
        this.CSSStyleNodes = map.SVGDocument.getElementById("mapstyles");
        /** flag to notify that any CSS style has been changed; for assynchronous style activation @type boolean */
        this.fCSSStyleNodeChanged = false;
        /** array to hold all symbols, that have been scaled */
        this.scaledSymbolsA = new Array(0);
        /** array to hold all symbols, that have been rotated */
        this.rotatedSymbolsA = new Array(0);

        /** the width of the screen (in pixle) @type int */
        this.screenX = 1024;
        /** the height of the screen (in pixle) @type int */
        this.screenY = 768;
        /** pixel per inch of the screen; needed for the map scale @type double */
        this.nPPI = nScreenPPI;

        /** initialise dynamic scaling */
        this.featureScaling_lastScale = 1;
        this.symbolScaling_lastScale = 1;
        this.objectScaling_lastScale = 1;

        /** get map metadata */
        /** holds the root mode of the map metadata @type DOM node*/
        this.metadataNode = null;

        var mNodesA = map.SVGRootElement.getElementsByTagName("metadata");

        this.metadataNode = mNodesA[mNodesA.length - 1];

        if (this.metadataNode) {
            /** holds metadata information of the map creation @type DOM node */
            this.creationNode = this.metadataNode.getElementsByTagName("xmap:creation").item(0);

            /** holds metadata information about the map extension @type DOM node */
            this.extentNode = this.metadataNode.getElementsByTagName("xmap:extension").item(0);

            if (this.extentNode) {
                /** map geo envelope, min x geo coordinate @type double */
                this.minBoundX = Number(this.extentNode.getAttribute('minboundx'));
                /** map geo envelope, max x geo coordinate @type double */
                this.maxBoundX = Number(this.extentNode.getAttribute('maxboundx'));
                /** map geo envelope, min y geo coordinate @type double */
                this.minBoundY = Number(this.extentNode.getAttribute('minboundy'));
                /** map geo envelope, max y geo coordinate @type double */
                this.maxBoundY = Number(this.extentNode.getAttribute('maxboundy'));
                /** map size, min SVG x value @type int */
                this.minX = Number(this.extentNode.getAttribute('minx'));
                /** map size, min SVG y value @type int */
                this.minY = Number(this.extentNode.getAttribute('miny'));
                /** map size, max SVG x value @type int */
                this.maxX = Number(this.extentNode.getAttribute('maxx'));
                /** map size, max SVG y value @type int */
                this.maxY = Number(this.extentNode.getAttribute('maxy'));

                /** map size as SVG coordinate box (x,y,width,height) @type box */
                this.bBox = new box(this.minX, this.minY, this.maxX - this.minX, this.maxY - this.minY);

                /** geo to svg coordinate resolution of x axis @type double */
                this.mapUnitsPPX = (this.maxBoundX - this.minBoundX) / (this.maxX - this.minX);
                /** geo to svg coordinate resolution of y axis @type double*/
                this.mapUnitsPPY = (this.maxBoundY - this.minBoundY) / (this.maxY - this.minY);

                this.origMinX = this.minX;
                this.origMinY = this.minY;
            }

            /** holds metadata information about the map scaling @type DOM node */
            this.scaleNode = this.metadataNode.getElementsByTagName("xmap:scale").item(0);
            if (this.scaleNode) {
                /** original scale of the map @type double */
                this.nMapScale = Number(this.scaleNode.getAttribute('mapscale'));

                /** original dpi (dots per inch) of the map @type double */
                this.nMapPPI = Number(this.scaleNode.getAttribute('dpi'));
                if (!this.nMapPPI) {
                    this.nMapPPI = nStandardPPI;
                }

                /** sacel units (as string) @type string */
                this.szMapUnits = this.scaleNode.getAttribute('mapunitsstr');

                /** initial scale different from original scale (if defined) @type double */
                this.initScale = this.scaleNode.getAttribute('mapinitscale');

                /** node that holds the initial zoom envelope (if defined, map will be zoomed to this extend after init() ) @type DOM node */
                this.initZoomNode = this.metadataNode.getElementsByTagName("xmap:initzoom").item(0);

                /** initial scaling for all features (lines,symbols,...) @type double */
                this.nFeatureScaling = 1;
                /** initial scaling for all border lines (of polygons) @type double */
                this.nBorderScaling = 1;
                /** additional scaling only for lines @type double */
                this.nLineScaling = 1;
                /** additional scaling only for label @type double */
                this.nLabelScaling = 1;
                /** additional scaling only for objects @type double */
                this.nObjectScaling = 1;

                /** true map scale as seen on the screen */
                this.nTrueMapScale = this.getTrueMapScale();

                /** sets the map scale as base scale for dyamic object scaling */
                /** GR 24.10.2016 */
                this.nNormalSizeScale = this.nMapScale;
                /** GR 24.10.2016 */
                this.nDynamicScalePow = 3;
            }
            /** holds metadata information about the map coordinate system @type DOM node */
            this.coordsysNode = this.metadataNode.getElementsByTagName("xmap:coordsys").item(0);
            if (this.coordsysNode) {
                /** projection of the map coordinate system */
                this.szMapProjection = this.coordsysNode.getAttribute('projection');
                /** datum of the map coordinate system */
                this.szDatum = this.coordsysNode.getAttribute('datum');
                /** UTM zone of the map coordinate system */
                this.szUTMZone = this.coordsysNode.getAttribute('UTMZone');
                /** the false easting of the map coordinate system (only set if diverts from UTM standard) */
                this.nFalseEasting = Number(this.coordsysNode.getAttribute('falseeasting'));
                /** the false northing of the map coordinate system (only set if diverts from UTM standard) */
                this.nFalseNorthing = Number(this.coordsysNode.getAttribute('falsenorthing'));
                /** a correction to be applied to the false easting */
                this.nCorrectEasting = Number(this.coordsysNode.getAttribute('correcteasting'));
                /** a correction to be applied to the false northing */
                this.nCorrectNorthing = Number(this.coordsysNode.getAttribute('correctnorthing'));
                
                // Projection parameters (auto-calculated for specific projections)
                const projParams = map.HTMLWindow.ixmaps.projectionParams || {};
                
                /** first standard parallel for Albers projection (degrees) */
                this.nAlbersLat1 = projParams.lat1 !== undefined ? Number(projParams.lat1) : 
                                  (this.coordsysNode.getAttribute('lat1') ? Number(this.coordsysNode.getAttribute('lat1')) : null);
                /** second standard parallel for Albers projection (degrees) */
                this.nAlbersLat2 = projParams.lat2 !== undefined ? Number(projParams.lat2) : 
                                  (this.coordsysNode.getAttribute('lat2') ? Number(this.coordsysNode.getAttribute('lat2')) : null);
                /** latitude of origin for Albers projection (degrees) */
                this.nAlbersLat0 = projParams.lat0 !== undefined ? Number(projParams.lat0) : 
                                  (this.coordsysNode.getAttribute('lat0') ? Number(this.coordsysNode.getAttribute('lat0')) : null);
                /** central meridian for Albers projection (degrees) */
                this.nAlbersLon0 = projParams.lon0 !== undefined ? Number(projParams.lon0) : 
                                  (this.coordsysNode.getAttribute('lon0') ? Number(this.coordsysNode.getAttribute('lon0')) : null);
                
                // Pre-calculate Albers projection constants for performance
                // These constants depend only on the projection parameters, not on individual points
                // Calculating them once and reusing them is much more efficient than recalculating for every point
                this._albersConstants = null;
                if (this.nAlbersLat1 !== null && this.nAlbersLat2 !== null && 
                    this.nAlbersLat0 !== null && this.nAlbersLon0 !== null) {
                    this._calculateAlbersConstants();
                }
                
                // Initialize storage for last Albers parameters (used for change detection)
                this.lastAlbersParams = null;

                if (this.szMapProjection === "LambertAzimuthalEqualArea") {
                    /** latitude of origin for Lambert Azimuthal Equal Area projection (degrees) */
                    this.nLambertLat0 = projParams.lat0 !== undefined ? Number(projParams.lat0) :
                                        (this.coordsysNode.getAttribute('lambertlat0') ? Number(this.coordsysNode.getAttribute('lambertlat0')) : null);
                    /** central meridian for Lambert Azimuthal Equal Area projection (degrees) */
                    this.nLambertLon0 = projParams.lon0 !== undefined ? Number(projParams.lon0) :
                                        (this.coordsysNode.getAttribute('lambertlon0') ? Number(this.coordsysNode.getAttribute('lambertlon0')) : null);
                } else {
                    this.nLambertLat0 = null;
                    this.nLambertLon0 = null;
                }

                // Pre-calculate Lambert Azimuthal Equal Area projection constants for performance
                this._lambertConstants = null;
                if (this.nLambertLat0 !== null && this.nLambertLon0 !== null) {
                    this._calculateLambertAzimuthalConstants();
                }
                
                // Initialize storage for last Lambert parameters (used for change detection)
                this.lastLambertParams = null;

                if (this.szMapProjection === "Orthographic") {
                    /** latitude of origin for Orthographic projection (degrees) */
                    this.nOrthographicLat0 = projParams.lat0 !== undefined ? Number(projParams.lat0) :
                                            (this.coordsysNode.getAttribute('orthographiclat0') ? Number(this.coordsysNode.getAttribute('orthographiclat0')) : null);
                    /** central meridian for Orthographic projection (degrees) */
                    this.nOrthographicLon0 = projParams.lon0 !== undefined ? Number(projParams.lon0) :
                                            (this.coordsysNode.getAttribute('orthographiclon0') ? Number(this.coordsysNode.getAttribute('orthographiclon0')) : null);
                } else {
                    this.nOrthographicLat0 = null;
                    this.nOrthographicLon0 = null;
                }

                // Initialize storage for last Orthographic parameters (used for change detection)
                this.lastOrthographicParams = null;
            }
            /** node that can hold attributes to change the map features (e.g.cliptextpath="true") @type DOM node */
            this.featuresNode = this.metadataNode.getElementsByTagName("xmap:features").item(0);
            if (this.featuresNode) {
                var szMapFeatures = this.featuresNode.getAttributeNS(null, "mapfeatures");
                if (szMapFeatures && szMapFeatures.length > 1) {
                    map.setFeatures(szMapFeatures);
                }
                if (this.featuresNode.getAttributeNS(null, "cliptextpath") == "true") {
                    map.fAdaptLabelToScaling = "delayed";
                }
                if (this.featuresNode.getAttributeNS(null, "initlegendoff") == "true") {
                    map.fInitLegendOff = true;
                }
                if (this.featuresNode.getAttributeNS(null, "checklabeloverlap") == "true") {
                    map.fCheckLabelOverlap = true;
                }
                if (this.featuresNode.getAttributeNS(null, "onlyonelabel") == "true") {
                    map.fCheckLabelOnlyOne = true;
                }
                if (this.featuresNode.getAttributeNS(null, "tiletextnoclip") == "true") {
                    map.fTileTextNoClip = true;
                }

                this.nFeatureScaling = Number(this.featuresNode.getAttribute('featurescaling'));
                this.nBorderScaling = Number(this.featuresNode.getAttribute('borderscaling'));
                this.nLineScaling = Number(this.featuresNode.getAttribute('linescaling'));
                this.nLabelScaling = Number(this.featuresNode.getAttribute('labelscaling'));
                this.nObjectScaling = Number(this.featuresNode.getAttribute('objectscaling'));

                this.nFeatureScaling = this.nFeatureScaling ? this.nFeatureScaling : 1;
                this.nBorderScaling = this.nBorderScaling ? this.nBorderScaling : 1;
                this.nLineScaling = this.nLineScaling ? this.nLineScaling : 1;
                this.nLabelScaling = this.nLabelScaling ? this.nLabelScaling : 1;
                this.nObjectScaling = this.nObjectScaling ? this.nObjectScaling : 1;
            }
        }

        /** the size of grafic ui elements */
        this.nButtonSize = this.nNormalButtonSize;
        this.nSymbolSize = this.nNormalSymbolSize;
        this.nFontSize = this.nNormalFontSize;

        /** the screen coordinate scale */
        this.nScaleX = (this.viewBox.width / this.getEmbedWidth() * this.getEmbedScale());
        this.nScaleY = (this.viewBox.height / this.getEmbedHeight() * this.getEmbedScale());
        /** the actual map zoom ( factor applied to nMapScale ) @type double */
        this.nZoomScale = 1;

        /** the center of the view port in map coordinates; changes with zoom and pan */
        this.mapCenter = new point(0, 0);

        /** the center of the map relative to the SVG canvas @type point */
        this.mapCanvasCenter = new point(this.mapPosition.x + this.bBox.width / 2, this.mapPosition.y + this.bBox.height / 2);

        // Use actual container dimensions instead of maximum screen width
        // This ensures Lambert and Albers projections center correctly on the target area
        var containerDims = this.getContainerDimensions();
        this.setCanvasSize(0, 0, containerDims.width, containerDims.height, "center");
    };

    ixMap.Scale.prototype = new ixMap();

    /**
     * Pre-calculate Albers Equal Area projection constants for performance optimization
     * These constants depend only on the projection parameters (lat1, lat2, lat0, lon0)
     * and not on individual points, so calculating them once is much more efficient
     * than recalculating for every coordinate transformation.
     */
    ixMap.Scale.prototype._calculateAlbersConstants = function () {
        const degreesToRadians = (deg) => deg * Math.PI / 180;
        
        // Convert parameters to radians
        const φ1 = degreesToRadians(this.nAlbersLat1);
        const φ2 = degreesToRadians(this.nAlbersLat2);
        const φ0 = degreesToRadians(this.nAlbersLat0);
        const λ0 = degreesToRadians(this.nAlbersLon0);
        
        // WGS84 ellipsoid parameters
        const a = 6378137.0;              // semi-major axis in meters
        const e = 0.0818191908426;        // eccentricity
        const e2 = e * e;                 // eccentricity squared
        
        // Helper function to calculate authalic latitude parameter q
        const calcQ = (sinPhi) => {
            const eSinPhi = e * sinPhi;
            return (1 - e2) * (
                sinPhi / (1 - e2 * sinPhi * sinPhi) - 
                (1 / (2 * e)) * Math.log((1 - eSinPhi) / (1 + eSinPhi))
            );
        };
        
        // Helper function to calculate m = cos(φ) / sqrt(1 - e²sin²(φ))
        const calcM = (phi) => {
            const sinPhi = Math.sin(phi);
            return Math.cos(phi) / Math.sqrt(1 - e2 * sinPhi * sinPhi);
        };
        
        // Calculate auxiliary values for standard parallels
        const q0 = calcQ(Math.sin(φ0));
        const q1 = calcQ(Math.sin(φ1));
        const q2 = calcQ(Math.sin(φ2));
        const m1 = calcM(φ1);
        const m2 = calcM(φ2);
        
        // Calculate projection constants (these are what we want to cache)
        const n = (m1 * m1 - m2 * m2) / (q2 - q1);
        const C = m1 * m1 + n * q1;
        const ρ0 = (a / n) * Math.sqrt(C - n * q0);
        
        // Store all constants for reuse
        this._albersConstants = {
            // Parameters in radians
            φ1: φ1,
            φ2: φ2,
            φ0: φ0,
            λ0: λ0,
            // Ellipsoid constants
            a: a,
            e: e,
            e2: e2,
            // Projection constants
            n: n,
            C: C,
            ρ0: ρ0,
            // Helper functions (stored for reuse in inverse projection)
            calcQ: calcQ,
            calcM: calcM
        };
        
        // Pre-calculated Albers constants stored in this._albersConstants
    };

    /**
     * Pre-calculate Lambert Azimuthal Equal Area projection constants for performance optimization.
     * These constants depend only on the projection parameters (lat0, lon0) and are reused for all points.
     */
    ixMap.Scale.prototype._calculateLambertAzimuthalConstants = function () {
        const degreesToRadians = (deg) => deg * Math.PI / 180;
        
        const φ0 = degreesToRadians(this.nLambertLat0);
        const λ0 = degreesToRadians(this.nLambertLon0);
        
        const a = 6378137.0;              // semi-major axis (GRS80 / ETRS89)
        const f = 1 / 298.257222101;      // flattening (GRS80 / ETRS89)
        const e2 = 2 * f - f * f;         // eccentricity squared
        const e = Math.sqrt(e2);          // eccentricity
        
        const calcQ = (phi) => {
            const sinPhi = Math.sin(phi);
            const eSinPhi = e * sinPhi;
            return (1 - e2) * (
                sinPhi / (1 - e2 * sinPhi * sinPhi) -
                (1 / (2 * e)) * Math.log((1 - eSinPhi) / (1 + eSinPhi))
            );
        };

        const qp = (1 - e2) * (
            1 / (1 - e2) -
            (1 / (2 * e)) * Math.log((1 - e) / (1 + e))
        );

        const q0 = calcQ(φ0);
        const sinBeta0 = q0 / qp;
        const cosBeta0 = Math.sqrt(Math.max(0, 1 - sinBeta0 * sinBeta0));
        const Rq = a * Math.sqrt(0.5 * qp);

        const inverseQ = (q) => {
            let φ = Math.asin(Math.max(-1, Math.min(1, q / (2))));
            const maxIterations = 12;
            const tolerance = 1e-12;

            for (let i = 0; i < maxIterations; i++) {
                const sinPhi = Math.sin(φ);
                const eSinPhi = e * sinPhi;
                const oneMinus = 1 - e2 * sinPhi * sinPhi;

                const qPhi = (1 - e2) * (
                    sinPhi / oneMinus -
                    (1 / (2 * e)) * Math.log((1 - eSinPhi) / (1 + eSinPhi))
                );

                const dqDphi = (1 - e2) / oneMinus;
                const delta = (q - qPhi) / dqDphi;
                φ += delta;

                if (Math.abs(delta) < tolerance) {
                    break;
                }
            }

            return φ;
        };

        this._lambertConstants = {
            a,
            e,
            e2,
            λ0,
            φ0,
            qp,
            q0,
            sinBeta0,
            cosBeta0,
            Rq,
            calcQ,
            inverseQ
        };

        // Normalize map bounds to maintain aspect ratio when using Lambert projection
        const maxRadius = Rq * Math.sqrt(2);
        if (Number.isFinite(maxRadius) && maxRadius > 0) {
            this.minBoundX = -maxRadius;
            this.maxBoundX = maxRadius;
            this.minBoundY = -maxRadius;
            this.maxBoundY = maxRadius;

            if ((this.maxX - this.minX) !== 0 && (this.maxY - this.minY) !== 0) {
                this.mapUnitsPPX = (this.maxBoundX - this.minBoundX) / (this.maxX - this.minX);
                this.mapUnitsPPY = (this.maxBoundY - this.minBoundY) / (this.maxY - this.minY);
            }
        }

        // Pre-calculated Lambert Azimuthal constants stored in this._lambertConstants
    };

    /**
     * Calculate Albers Equal Area projection parameters from center coordinates and zoom level.
     * Implemented on the scale prototype so the map runtime owns the logic.
     * @param {number|string} lat - Center latitude
     * @param {number|string} lng - Center longitude
     * @param {number|string} zoom - Zoom level (higher = more zoomed in)
     * @returns {Object|null} Projection parameters {lat1, lat2, lat0, lon0, _n} or null on invalid input
     */
    ixMap.Scale.prototype.calculateAlbersParameters = function (lat, lng, zoom) {
        const originalArgs = { lat, lng, zoom };

        lat = parseFloat(lat);
        lng = parseFloat(lng);
        zoom = parseFloat(zoom);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            console.warn('calculateAlbersParameters: invalid center coordinates', originalArgs);
            return null;
        }

        if (!Number.isFinite(zoom)) {
            console.warn('calculateAlbersParameters: invalid zoom, defaulting to 5', originalArgs);
            zoom = 5;
        }

        let normalizedZoom = zoom;

        const DEG_TO_RAD = Math.PI / 180;

        let powFactor = Math.pow(2, normalizedZoom - 5);
        if (!Number.isFinite(powFactor) || powFactor === 0) {
            console.warn('calculateAlbersParameters: invalid powFactor, enforcing zoom=5', { originalArgs, normalizedZoom, powFactor });
            normalizedZoom = 5;
            powFactor = Math.pow(2, normalizedZoom - 5);
        }

        let latitudeSpacing = 15 / powFactor;
        if (!Number.isFinite(latitudeSpacing)) {
            console.warn('calculateAlbersParameters: invalid latitudeSpacing, enforcing zoom=5', { originalArgs, normalizedZoom, powFactor, latitudeSpacing });
            normalizedZoom = 5;
            powFactor = Math.pow(2, normalizedZoom - 5);
            latitudeSpacing = 15 / powFactor;
        }

        if (!Number.isFinite(latitudeSpacing)) {
            latitudeSpacing = 15;
        }

        console.debug('calculateAlbersParameters: normalized inputs', {
            originalArgs,
            lat,
            lng,
            zoom: normalizedZoom,
            latitudeSpacing
        });

        let lat1 = lat + latitudeSpacing;
        let lat2 = lat - latitudeSpacing;

        lat1 = Math.max(-89, Math.min(89, lat1));
        lat2 = Math.max(-89, Math.min(89, lat2));

        if (lat2 > lat1) {
            const tmp = lat1;
            lat1 = lat2;
            lat2 = tmp;
        }

        const phi1 = lat1 * DEG_TO_RAD;
        const phi2 = lat2 * DEG_TO_RAD;
        const phi0 = lat * DEG_TO_RAD;

        // Calculate cone constant n using correct ellipsoid-based formula
        // This matches the calculation in _calculateAlbersConstants() for consistency
        const a = 6378137.0;              // semi-major axis (WGS84)
        const e = 0.0818191908426;        // eccentricity (WGS84)
        const e2 = e * e;                 // eccentricity squared
        
        // Helper function to calculate authalic latitude parameter q
        const calcQ = (sinPhi) => {
            const eSinPhi = e * sinPhi;
            return (1 - e2) * (
                sinPhi / (1 - e2 * sinPhi * sinPhi) - 
                (1 / (2 * e)) * Math.log((1 - eSinPhi) / (1 + eSinPhi))
            );
        };
        
        // Helper function to calculate m = cos(φ) / sqrt(1 - e²sin²(φ))
        const calcM = (phi) => {
            const sinPhi = Math.sin(phi);
            return Math.cos(phi) / Math.sqrt(1 - e2 * sinPhi * sinPhi);
        };
        
        // Calculate auxiliary values for standard parallels
        const q1 = calcQ(Math.sin(phi1));
        const q2 = calcQ(Math.sin(phi2));
        const m1 = calcM(phi1);
        const m2 = calcM(phi2);
        
        // Calculate cone constant n using correct ellipsoid formula
        // Check for division by zero (would occur if lat1 == lat2)
        const qDiff = q2 - q1;
        if (Math.abs(qDiff) < 1e-10) {
            console.warn('calculateAlbersParameters: standard parallels too close, adjusting', { lat1, lat2 });
            // Use sphere approximation as fallback if parallels are too close
            const n = (Math.sin(phi1) + Math.sin(phi2)) / 2;
            const result = {
                lat1: Math.round(lat1 * 10) / 10,
                lat2: Math.round(lat2 * 10) / 10,
                lat0: Math.round(lat * 10) / 10,
                lon0: Math.round(lng * 10) / 10,
                _n: Math.round(n * 10000) / 10000
            };
            if (!Number.isFinite(result.lat1) || !Number.isFinite(result.lat2) || !Number.isFinite(result._n)) {
                console.warn('calculateAlbersParameters: produced invalid result', {
                    result,
                    intermediate: { lat1, lat2, n },
                    inputs: { lat, lng, normalizedZoom, latitudeSpacing }
                });
            } else {
                console.debug('calculateAlbersParameters: result', result);
            }
            this.nAlbersLat1 = result.lat1;
            this.nAlbersLat2 = result.lat2;
            this.nAlbersLat0 = result.lat0;
            this.nAlbersLon0 = result.lon0;
            if (typeof this._calculateAlbersConstants === 'function') {
                this._calculateAlbersConstants();
            }
            return result;
        }
        
        const n = (m1 * m1 - m2 * m2) / qDiff;

        const result = {
            lat1: Math.round(lat1 * 10) / 10,
            lat2: Math.round(lat2 * 10) / 10,
            lat0: Math.round(lat * 10) / 10,
            lon0: Math.round(lng * 10) / 10,
            _n: Math.round(n * 10000) / 10000
        };

        if (!Number.isFinite(result.lat1) || !Number.isFinite(result.lat2) || !Number.isFinite(result._n)) {
            console.warn('calculateAlbersParameters: produced invalid result', {
                result,
                intermediate: { lat1, lat2, n },
                inputs: { lat, lng, normalizedZoom, latitudeSpacing }
            });
        } else {
            console.debug('calculateAlbersParameters: result', result);
        }

        this.nAlbersLat1 = result.lat1;
        this.nAlbersLat2 = result.lat2;
        this.nAlbersLat0 = result.lat0;
        this.nAlbersLon0 = result.lon0;

        if (typeof this._calculateAlbersConstants === 'function') {
            this._calculateAlbersConstants();
        }

        return result;
    };

    /**
     * Calculate Lambert Azimuthal Equal Area projection parameters from center coordinates.
     * @param {number|string} lat - Center latitude
     * @param {number|string} lng - Center longitude
     * @returns {Object|null} Projection parameters {lat0, lon0, _Rq, _sinBeta0} or null on invalid input
     */
    ixMap.Scale.prototype.calculateLambertAzimuthalParameters = function (lat, lng) {
        const originalArgs = { lat, lng };

        lat = parseFloat(lat);
        lng = parseFloat(lng);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            console.warn('calculateLambertAzimuthalParameters: invalid center coordinates', originalArgs);
            return null;
        }

        const clampedLat = Math.max(-89.9999, Math.min(89.9999, lat));
        const normalizedLng = ((lng + 180) % 360 + 360) % 360 - 180;

        this.nLambertLat0 = clampedLat;
        this.nLambertLon0 = normalizedLng;

        if (typeof this._calculateLambertAzimuthalConstants === 'function') {
            this._calculateLambertAzimuthalConstants();
        }

        const result = {
            lat0: Math.round(this.nLambertLat0 * 10) / 10,
            lon0: Math.round(this.nLambertLon0 * 10) / 10
        };

        if (this._lambertConstants) {
            result._sinBeta0 = Math.round(this._lambertConstants.sinBeta0 * 10000) / 10000;
            result._Rq = Math.round(this._lambertConstants.Rq);
        }

        console.debug('calculateLambertAzimuthalParameters: result', result);

        return result;
    };

    /**
     * Calculate Lambert Azimuthal Equal Area projection parameters from NE/SW bounds.
     * @param {number|string} latSW - Southwest latitude
     * @param {number|string} lonSW - Southwest longitude
     * @param {number|string} latNE - Northeast latitude
     * @param {number|string} lonNE - Northeast longitude
     * @returns {Object|null} Projection parameters {lat0, lon0, ...}
     */
    ixMap.Scale.prototype.calculateLambertAzimuthalParametersFromBounds = function (latSW, lonSW, latNE, lonNE) {
        latSW = parseFloat(latSW);
        lonSW = parseFloat(lonSW);
        latNE = parseFloat(latNE);
        lonNE = parseFloat(lonNE);

        if (!Number.isFinite(latSW) || !Number.isFinite(lonSW) ||
            !Number.isFinite(latNE) || !Number.isFinite(lonNE)) {
            console.warn('calculateLambertAzimuthalParametersFromBounds: invalid bounds', { latSW, lonSW, latNE, lonNE });
            return null;
        }

        const northLat = Math.max(latSW, latNE);
        const southLat = Math.min(latSW, latNE);
        const eastLng = Math.max(lonSW, lonNE);
        const westLng = Math.min(lonSW, lonNE);

        const centerLat = (northLat + southLat) / 2;
        let centerLng = (eastLng + westLng) / 2;

        if (Math.abs(lonNE - lonSW) > 180) {
            const adjustedEast = (eastLng < 0 ? eastLng + 360 : eastLng);
            const adjustedWest = (westLng < 0 ? westLng + 360 : westLng);
            centerLng = (((adjustedEast + adjustedWest) / 2) % 360);
            if (centerLng > 180) {
                centerLng -= 360;
            }
        }

        console.debug('calculateLambertAzimuthalParametersFromBounds: derived center', {
            latSW,
            lonSW,
            latNE,
            lonNE,
            centerLat,
            centerLng
        });

        return this.calculateLambertAzimuthalParameters(centerLat, centerLng);
    };

    /**
     * Calculate Orthographic projection parameters from center coordinates.
     * Orthographic is an azimuthal projection that shows the Earth as seen from space.
     * @param {number|string} lat - Center latitude
     * @param {number|string} lng - Center longitude
     * @returns {Object|null} Projection parameters {lat0, lon0} or null on invalid input
     */
    ixMap.Scale.prototype.calculateOrthographicParameters = function (lat, lng) {
        const originalArgs = { lat, lng };

        lat = parseFloat(lat);
        lng = parseFloat(lng);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            console.warn('calculateOrthographicParameters: invalid center coordinates', originalArgs);
            return null;
        }

        const clampedLat = Math.max(-89.9999, Math.min(89.9999, lat));
        const normalizedLng = ((lng + 180) % 360 + 360) % 360 - 180;

        this.nOrthographicLat0 = clampedLat;
        this.nOrthographicLon0 = normalizedLng;

        // Note: Orthographic projection doesn't require pre-calculated constants
        // like Lambert Azimuthal, as it's a simpler azimuthal projection

        const result = {
            lat0: Math.round(this.nOrthographicLat0 * 10) / 10,
            lon0: Math.round(this.nOrthographicLon0 * 10) / 10
        };

        console.debug('calculateOrthographicParameters: result', result);

        return result;
    };

    /**
     * Calculate Orthographic projection parameters from NE/SW bounds.
     * @param {number|string} latSW - Southwest latitude
     * @param {number|string} lonSW - Southwest longitude
     * @param {number|string} latNE - Northeast latitude
     * @param {number|string} lonNE - Northeast longitude
     * @returns {Object|null} Projection parameters {lat0, lon0, ...}
     */
    ixMap.Scale.prototype.xxxcalculateOrthographicParametersFromBounds = function (latSW, lonSW, latNE, lonNE) {
        latSW = parseFloat(latSW);
        lonSW = parseFloat(lonSW);
        latNE = parseFloat(latNE);
        lonNE = parseFloat(lonNE);
        
        if (!Number.isFinite(latSW) || !Number.isFinite(lonSW) ||
            !Number.isFinite(latNE) || !Number.isFinite(lonNE)) {
            console.warn('calculateOrthographicParametersFromBounds: invalid bounds', { latSW, lonSW, latNE, lonNE });
            return null;
        }

        const northLat = Math.max(latSW, latNE);
        const southLat = Math.min(latSW, latNE);
        const eastLng = Math.max(lonSW, lonNE);
        const westLng = Math.min(lonSW, lonNE);

        const centerLat = (northLat + southLat) / 2;
        let centerLng = (eastLng + westLng) / 2;

        if (Math.abs(lonNE - lonSW) > 180) {
            const adjustedEast = (eastLng < 0 ? eastLng + 360 : eastLng);
            const adjustedWest = (westLng < 0 ? westLng + 360 : westLng);
            centerLng = (((adjustedEast + adjustedWest) / 2) % 360);
            if (centerLng > 180) {
                centerLng -= 360;
            }
        }

        console.debug('calculateOrthographicParametersFromBounds: derived center', {
            latSW,
            lonSW,
            latNE,
            lonNE,
            centerLat,
            centerLng
        });

        return this.calculateOrthographicParameters(centerLat, centerLng);
    };

    /**
     * Calculate Albers parameters using a bounding box defined by NE and SW coordinates.
     * Derives the center and an approximate zoom level from the bounds and delegates
     * to calculateAlbersParameters for the actual projection parameter computation.
     * @param {Array|Object} northEast - [lat, lng] array or {lat, lng} object representing the northeast corner
     * @param {Array|Object} southWest - [lat, lng] array or {lat, lng} object representing the southwest corner
     * @returns {Object|null} Projection parameters {lat1, lat2, lat0, lon0, _n} or null on invalid input
     */
    ixMap.Scale.prototype.calculateAlbersParametersFromBounds = function (latSW, lonSW, latNE, lonNE) {
        latSW = parseFloat(latSW);
        lonSW = parseFloat(lonSW);
        latNE = parseFloat(latNE);
        lonNE = parseFloat(lonNE);

        if (!Number.isFinite(latSW) || !Number.isFinite(lonSW) ||
            !Number.isFinite(latNE) || !Number.isFinite(lonNE)) {
            console.warn('calculateAlbersParametersFromBounds: invalid bounds', { latSW, lonSW, latNE, lonNE });
            return null;
        }

        const northLat = Math.max(latSW, latNE);
        const southLat = Math.min(latSW, latNE);
        const eastLng = Math.max(lonSW, lonNE);
        const westLng = Math.min(lonSW, lonNE);
        

        const centerLat = (northLat + southLat) / 2;
        let centerLng = (eastLng + westLng) / 2;

        if (Math.abs(lonNE - lonSW) > 180) {
            const adjustedEast = (eastLng < 0 ? eastLng + 360 : eastLng);
            const adjustedWest = (westLng < 0 ? westLng + 360 : westLng);
            centerLng = (((adjustedEast + adjustedWest) / 2) % 360);
            if (centerLng > 180) {
                centerLng -= 360;
            }
        }

        let lat1 = northLat;
        let lat2 = southLat;

        if (lat1 === lat2) {
            lat1 = Math.min(89, lat1 + 0.5);
            lat2 = Math.max(-89, lat2 - 0.5);
        }

        const DEG_TO_RAD = Math.PI / 180;
        const phi1 = lat1 * DEG_TO_RAD;
        const phi2 = lat2 * DEG_TO_RAD;
        const phi0 = centerLat * DEG_TO_RAD;

        // Calculate cone constant n using correct ellipsoid-based formula
        // This matches the calculation in _calculateAlbersConstants() for consistency
        const a = 6378137.0;              // semi-major axis (WGS84)
        const e = 0.0818191908426;        // eccentricity (WGS84)
        const e2 = e * e;                 // eccentricity squared
        
        // Helper function to calculate authalic latitude parameter q
        const calcQ = (sinPhi) => {
            const eSinPhi = e * sinPhi;
            return (1 - e2) * (
                sinPhi / (1 - e2 * sinPhi * sinPhi) - 
                (1 / (2 * e)) * Math.log((1 - eSinPhi) / (1 + eSinPhi))
            );
        };
        
        // Helper function to calculate m = cos(φ) / sqrt(1 - e²sin²(φ))
        const calcM = (phi) => {
            const sinPhi = Math.sin(phi);
            return Math.cos(phi) / Math.sqrt(1 - e2 * sinPhi * sinPhi);
        };
        
        // Calculate auxiliary values for standard parallels
        const q1 = calcQ(Math.sin(phi1));
        const q2 = calcQ(Math.sin(phi2));
        const m1 = calcM(phi1);
        const m2 = calcM(phi2);
        
        // Calculate cone constant n using correct ellipsoid formula
        // Check for division by zero (would occur if lat1 == lat2)
        const qDiff = q2 - q1;
        if (Math.abs(qDiff) < 1e-10) {
            console.warn('calculateAlbersParametersFromBounds: standard parallels too close, adjusting', { lat1, lat2 });
            // Use sphere approximation as fallback if parallels are too close
            const n = (Math.sin(phi1) + Math.sin(phi2)) / 2;
            const result = {
                lat1: Math.round(lat1 * 10) / 10,
                lat2: Math.round(lat2 * 10) / 10,
                lat0: Math.round(centerLat * 10) / 10,
                lon0: Math.round(centerLng * 10) / 10,
                _n: Math.round(n * 10000) / 10000
            };
            this.nAlbersLat1 = result.lat1;
            this.nAlbersLat2 = result.lat2;
            this.nAlbersLat0 = result.lat0;
            this.nAlbersLon0 = result.lon0;
            if (typeof this._calculateAlbersConstants === 'function') {
                this._calculateAlbersConstants();
            }
            console.debug('calculateAlbersParametersFromBounds: derived inputs', {
                latSW,
                lonSW,
                latNE,
                lonNE,
                centerLat,
                centerLng,
                lat1,
                lat2
            });
            return result;
        }
        
        const n = (m1 * m1 - m2 * m2) / qDiff;
        
        const result = {
            lat1: Math.round(lat1 * 10) / 10,
            lat2: Math.round(lat2 * 10) / 10,
            lat0: Math.round(centerLat * 10) / 10,
            lon0: Math.round(centerLng * 10) / 10,
            _n: Math.round(n * 10000) / 10000
        };

        this.nAlbersLat1 = result.lat1;
        this.nAlbersLat2 = result.lat2;
        this.nAlbersLat0 = result.lat0;
        this.nAlbersLon0 = result.lon0;

        if (typeof this._calculateAlbersConstants === 'function') {
            this._calculateAlbersConstants();
        }

        console.debug('calculateAlbersParametersFromBounds: derived inputs', {
            latSW,
            lonSW,
            latNE,
            lonNE,
            result
        });

        return result;
    };

    /**
     * reset map scale to initial values
     */
    ixMap.Scale.prototype.reset = function () {


        if (map.fScaleToFullscreen && !map.fPDFEmbed && window.screen) {
            map.SVGRootElement.currentScale = 1;
            var xScale = window.innerWidth / map.SVGWidth;
            var yScale = window.innerHeight / map.SVGHeight;
            map.SVGRootElement.currentScale = Math.min(xScale, yScale);
        }
        if (this.canvasNode) {
            this.mapOffset = getTranslate(this.canvasNode);
        }
        if (this.offsetNode) {
            this.mapPosition = getTranslate(this.offsetNode);
        }

        /** the center of the map relative to the SVG canvas @type point */
        this.mapCanvasCenter = new point(this.mapPosition.x + this.bBox.width / 2, this.mapPosition.y + this.bBox.height / 2);

        // Use actual container dimensions instead of maximum screen width
        // This ensures Lambert and Albers projections center correctly on the target area
        var containerDims = this.getContainerDimensions();
        this.setCanvasSize(0, 0, containerDims.width, containerDims.height, "center");
    };
    /**
     * set new map extension in screen coordinates
     * @param x position 
     * @param y position 
     * @param width position 
     * @param height position 
     */
    ixMap.Scale.prototype.setCanvasSize = function (x, y, width, height, szMethod) {


        if (!width || !height) {
            return false;
        }

        this.nScaleX = 20;
        this.nScaleY = 20;

        var SVGViewBoxString = "" + String(x) + " " + String(y) + " " + String(this.normalX(width)) + " " + String(this.normalX(height)) + "";

        // new map width in svg coordinates - legend offset tolted
        var newWidth = (this.normalX(width) - this.mapPosition.x);
        var newHeight = (this.normalX(height) - this.mapPosition.y);

        // delta size for x and y 
        var dWidth = newWidth - (this.maxX - this.minX);
        var dHeight = newHeight - (this.maxY - this.minY);

        if (szMethod == "extendmax") {
            // resizing method I: via extending max x and y
            // --------------------------------------------
            this.maxX += dWidth;
            this.maxY += dHeight;
            this.maxBoundX += dWidth * this.mapUnitsPPX;
            this.minBoundY -= dHeight * this.mapUnitsPPY;
        } else {
            // resizing method II: keep center of map
            // --------------------------------------------
            this.minX -= dWidth / 2;
            this.minY -= dHeight / 2;
            this.maxX += dWidth / 2;
            this.maxY += dHeight / 2;
            this.minBoundX -= dWidth / 2 * this.mapUnitsPPX;
            this.maxBoundY += dHeight / 2 * this.mapUnitsPPY;
            this.maxBoundX += dWidth / 2 * this.mapUnitsPPX;
            this.minBoundY -= dHeight / 2 * this.mapUnitsPPY;
            if (this.canvasNode) {
                setTranslate(this.canvasNode, this.maxX, this.maxY);
                this.mapOffset = getTranslate(this.canvasNode);
            }
        }


        // resizing SVG canvas 
        // --------------------------------------------
        map.SVGWidth = width;
        map.SVGHeight = height;
        map.SVGRootElement.setAttribute('width', map.SVGWidth + "px");
        map.SVGRootElement.setAttribute('height', map.SVGHeight + "px");
        map.SVGRootElement.setAttribute('viewBox', SVGViewBoxString);

        map.SVGOrigViewBoxString = map.SVGRootElement.getAttribute('viewBox');
        map.SVGViewBox = map.SVGRootElement.getAttribute('viewBox').split(' ');
        map.SVGViewBox[0] = Number(map.SVGViewBox[0]);
        map.SVGViewBox[1] = Number(map.SVGViewBox[1]);
        map.SVGViewBox[2] = Number(map.SVGViewBox[2]);
        map.SVGViewBox[3] = Number(map.SVGViewBox[3]);

        this.viewBox = new box(map.SVGViewBox[0], map.SVGViewBox[1], map.SVGViewBox[2], map.SVGViewBox[3]);
        this.bBox = new box(this.minX, this.minY, this.maxX - this.minX, this.maxY - this.minY);
        this.mapCanvasCenter = new point(this.mapPosition.x + this.bBox.width / 2, this.mapPosition.y + this.bBox.height / 2);
        this.nScaleX = (this.viewBox.width / this.getEmbedWidth() * this.getEmbedScale());
        this.nScaleY = (this.viewBox.height / this.getEmbedHeight() * this.getEmbedScale());

        // resizing clipping 
        // --------------------------------------------
        var clipRect = map.SVGDocument.getElementById("mapcliprect");
        if (clipRect) {
            clipRect.setAttributeNS(null, "width", newWidth);
            clipRect.setAttributeNS(null, "height", newHeight);
        }
        clipRect = map.SVGDocument.getElementById("mapcliprect2");

        // reposition annotation 
        // --------------------------------------------
        var annotationObj = map.SVGDocument.getElementById("map:annotation");
        if (annotationObj) {
            annotationObj.fu = new Methods(annotationObj);
            var bBox = annotationObj.fu.getBox();
            annotationObj.fu.setPosition(this.normalX(width - 2) - this.mapPosition.x,
                this.normalY(height) - this.mapPosition.y - bBox.height * 2);
        }
    };
    /**
     * set new map extension in screen coordinates
     * @param x position 
     * @param y position 
     * @param width position 
     * @param height position 
     */
    ixMap.Scale.prototype.resizeCanvas = function (x, y, width, height, szMethod) {

        if (!szMethod) {
            szMethod = "center";
        }

        this.setCanvasSize(x, y, width, height, szMethod);

        try {
            map.Viewport.reformat();
            map.Themes.reformat();
            map.Themes.redraw();
            map.Legend.reformat();
        } catch (e) {}

        try {
            displayScale(null, "bottom");
        } catch (e) {}

    };
    /**
     * returns the distance between to map points in meter
     * @type double
     * @param x1 x of the first map coordinate
     * @param y1 y of the first map coordinate
     * @param x2 x of the second map coordinate
     * @param y2 y of the second map coordinate
     * @return the distance in meter
     */
    ixMap.Scale.prototype.getDistanceInMeter = function (x1, y1, x2, y2) {
        var nDeltaX = x2 - x1;
        var nDeltaY = y2 - y1;
        var nMeter = 0;
        if (this.szMapProjection == "Mercator") {
            this.szMapUnits = "degrees";
        }
        switch (this.szMapUnits) {
            case "feet":
                nDeltaX /= 3.2808399;
                nDeltaY /= 3.2808399;
                // fall through intentionally
            case "meter":
            case "meters":
                nDeltaX = nDeltaX * this.nZoomScale * this.mapUnitsPPX;
                nDeltaY = nDeltaY * this.nZoomScale * this.mapUnitsPPY;
                nMeter = Math.sqrt(nDeltaX * nDeltaX + nDeltaY * nDeltaY);
                if (nMeter > 100) {
                    nMeter = Math.round(nMeter);
                }
                if (nMeter > 10) {
                    nMeter = Math.round(nMeter * 10) / 10;
                } else {
                    nMeter = Math.round(nMeter * 100) / 100;
                }
                break;
            default:
                // lat lon coordinate system
                var mapPos1 = map.Scale.getMapPosition(x1, y1);
                var mapPos2 = map.Scale.getMapPosition(x2, y2);
                var mapCoord1 = map.Scale.getMapCoordinate(mapPos1.x, mapPos1.y);
                var mapCoord2 = map.Scale.getMapCoordinate(mapPos2.x, mapPos2.y);
                mapCoord1 = map.Scale.getGeoCoordinateOfPoint(mapCoord1.x, mapCoord1.y);
                mapCoord2 = map.Scale.getGeoCoordinateOfPoint(mapCoord2.x, mapCoord2.y);

                if (!mapCoord1 || !mapCoord2) {
                    return 0;
                }
                // Haversine Function ( correct for all distances )
                var nLat1 = mapCoord1.y / 180 * Math.PI;
                var nLat2 = mapCoord2.y / 180 * Math.PI;
                var nLon1 = mapCoord1.x / 180 * Math.PI;
                var nLon2 = mapCoord2.x / 180 * Math.PI;

                var dLon = Math.abs(nLon2 - nLon1);
                var dLat = Math.abs(nLat2 - nLat1);

                var a = Math.pow((Math.sin(dLat / 2)), 2) + Math.cos(nLat1) * Math.cos(nLat2) * Math.pow((Math.sin(dLon / 2)), 2);
                var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

                nMeter = c * 6378.388 * 1000;

                break;
        }
        return nMeter;
    };
    /**
     * formats a distance given in meter into a string of the appropriate map unit ( meter, kilometer, feet, miles )
     * @type string
     * @param nMeter the distance in meter to format
     * @return string with distance and unit
     */
    ixMap.Scale.prototype.formatDistanceString = function (nMeter) {
        if (nMeter > 1000) {
            return String(Math.round(nMeter / 100) / 10) + " km";
        } else if (nMeter > 100) {
            return String(Math.round(nMeter * 10) / 10) + " m";
        } else {
            return String(Math.round(nMeter * 100) / 100) + " m";
        }
    };
    /**
     * formats a surface given in squaremeter into a string of the appropriate map unit ( meter2, km2, feet2, miles2 )
     * @type string
     * @param nQMeter the surface in meter to format
     * @return string with surface and unit
     */
    ixMap.Scale.prototype.formatSurfaceString = function (nQMeter) {
        var szValue = "";
        if (nQMeter > 1000000) {
            szValue = String(Math.round(nQMeter / 1000000 * 1000) / 1000) + " km2";
        } else {
            szValue = String(Math.round(nQMeter * 1000) / 1000) + " m2";
        }
        var szValueA = szValue.split(".");
        if (szValueA.length > 1) {
            szValue = szValueA[0] + ',' + szValueA[1];
        }
        return szValue;
    };
    /**
     * returns the X scalar in canvas coordinates of a distance in meter
     * @type double
     * @param nMeter the distance in meter
     * @return the X scalar
     */
    ixMap.Scale.prototype.getDeltaXofDistanceInMeter = function (nMeter) {
        var n1000 = this.getDistanceInMeter(1000, 1000, 2000, 1000);
        return 1000 / n1000 * nMeter;
    };
    /**
     * returns the Y scalar in canvas coordinates of a distance in meter
     * @type double
     * @param nMeter the distance in meter
     * @return the Y scalar
     */
    ixMap.Scale.prototype.getDeltaYofDistanceInMeter = function (nMeter) {
        var n1000 = this.getDistanceInMeter(1000, 1000, 1000, 2000);
        return 1000 / n1000 * nMeter;
    };
    /**
     * returns the geo coordinates of a map position as longitude,latitude 
     * @param x x of the map coordinate
     * @param y y of the map coordinate
     * @return the geo coordinates as point object
     */
    ixMap.Scale.prototype.getMapCoordinate = function (x, y) {

        var nLon1 = 0;
        var nLat1 = 0;

        x = x + this.mapOffset.x;
        y = (this.maxY - this.minY) - (y + this.mapOffset.y);

        switch (this.szMapUnits) {
            case "feet":
            case "meter":
            case "meters":
                nLon1 = (this.minBoundX + x * this.mapUnitsPPX);
                nLat1 = (this.minBoundY + y * this.mapUnitsPPY);
                break;
            default:
                nLon1 = (this.minBoundX + x * this.mapUnitsPPX);
                nLat1 = (this.minBoundY + y * this.mapUnitsPPY);
        }
        return new point(nLon1, nLat1);
    };
    /**
     * returns the geo coordinates of map position in UTM
     * @param x x of the map coordinate
     * @param y y of the map coordinate
     * @return the UTM coordinates as point object
     */
    ixMap.Scale.prototype.getMapCoordinateUTM = function (x, y) {

        var ptCoord = this.getMapCoordinate(x, y);
        if (this.szMapProjection == "Mercator") {
            ptCoord = _LLtoMercator(ptCoord.y, ptCoord.x);
        } else
        if (this.szMapProjection == "WinkelTripel") {
            ptCoord = _LLtoWinkelTripel(ptCoord.y, ptCoord.x);
        } else
        if (this.szMapProjection == "EqualEarth") {
            ptCoord = _LLtoEqualEarth(ptCoord.y, ptCoord.x);
        } else
        if (this.szMapProjection == "AlbersEqualArea") {
            ptCoord = _LLtoAlbersEqualArea(ptCoord.y, ptCoord.x, {
                lat1: this.nAlbersLat1,
                lat2: this.nAlbersLat2,
                lat0: this.nAlbersLat0,
                lon0: this.nAlbersLon0
            });
        } else
        if (this.szMapProjection == "LambertAzimuthalEqualArea") {
            ptCoord = _LLtoLambertAzimuthalEqualArea(ptCoord.y, ptCoord.x, {
                lat0: this.nLambertLat0,
                lon0: this.nLambertLon0
            });
        } else
        if (this.szMapProjection == "Orthographic") {
            ptCoord = _LLtoOrthographic(ptCoord.y, ptCoord.x, {
                lat0: this.nOrthographicLat0,
                lon0: this.nOrthographicLon0
            });
        } else
        if (this.szMapUnits != "feet" && this.szMapUnits != "meter" && this.szMapUnits != "meters") {
            ptCoord = _LLtoUTM("WGS84", ptCoord.y, ptCoord.x);
        }
        return ptCoord;
    };
    /**
     * returns the map position of geo coordinates in x/y UTM (meter)
     * @param x of the UTM coordinate
     * @param y of the UTM coordinate
     * @param szUtmZone the UTM zone (tipo: 33N)
     * @type point
     * @return the map coordinates as point object
     */
    ixMap.Scale.prototype.getMapPositionOfUTM = function (x, y, szDatum, szUtmZone) {

        var ptOff = _UTMtoLL(szDatum, x, y, szUtmZone);
        ptOff = map.Scale.getMapCoordinateOfLatLon(ptOff.y, ptOff.x);
        var nX = (ptOff.x - map.Scale.minBoundX) / map.Scale.mapUnitsPPX - map.Scale.mapOffset.x;
        var nY = map.Scale.bBox.height - (ptOff.y - map.Scale.minBoundY) / map.Scale.mapUnitsPPY - map.Scale.mapOffset.y;
        return {
            x: nX,
            y: nY
        }; // new point(nX,nY);
    };
    /**
     * returns the map position of geo coordinates in Lat/Lon
     * @param lat of the map coordinate
     * @param lon of the map coordinate
     * @type point
     * @return the map coordinates as point object
     */
    ixMap.Scale.prototype.getMapPositionOfLatLon = function (lat, lon) {
        // For Orthographic projection, check if point is on backside of globe (>90° from center)
        // If so, return null to indicate the point should not be rendered
        if (this.szMapProjection === "Orthographic" && 
            this.isPointOnBacksideOrthographic && 
            this.isPointOnBacksideOrthographic(lat, lon)) {
            return null;
        }

        var ptOff = map.Scale.getMapCoordinateOfLatLon(lat, lon);
        if (!ptOff) {
            return null;
        }
        var nX = (ptOff.x - map.Scale.minBoundX) / map.Scale.mapUnitsPPX - map.Scale.mapOffset.x;
        var nY = map.Scale.bBox.height - (ptOff.y - map.Scale.minBoundY) / map.Scale.mapUnitsPPY - map.Scale.mapOffset.y;
        return {
            x: nX,
            y: nY
        }; // new point(nX,nY);
    };
    /**
     * returns the map coordinates of a geo coordinates in Lat/Lon
     * @param lat of the geo coordinate
     * @param lon of the geo coordinate
     * @type point
     * @return the map coordinates as point object
     */
    ixMap.Scale.prototype.getMapCoordinateOfLatLon = function (lat, lon) {

        var ptCoord;
        if (this.szMapProjection == "Mercator") {
            ptCoord = _LLtoMercator(lat, lon);
        } else
        if (this.szMapProjection == "WinkelTripel") {
            ptCoord = _LLtoWinkelTripel(lat, lon);
        } else
        if (this.szMapProjection == "EqualEarth") {
            ptCoord = _LLtoEqualEarth(lat, lon);
        } else
        if (this.szMapProjection == "AlbersEqualArea") {
            ptCoord = _LLtoAlbersEqualArea(lat, lon, {
                lat1: this.nAlbersLat1,
                lat2: this.nAlbersLat2,
                lat0: this.nAlbersLat0,
                lon0: this.nAlbersLon0
            });
        } else
        if (this.szMapProjection == "LambertAzimuthalEqualArea") {
            ptCoord = _LLtoLambertAzimuthalEqualArea(lat, lon, {
                lat0: this.nLambertLat0,
                lon0: this.nLambertLon0
            });
        } else
        if (this.szMapProjection == "Orthographic") {
            ptCoord = _LLtoOrthographic(lat, lon, {
                lat0: this.nOrthographicLat0,
                lon0: this.nOrthographicLon0
            });
        } else
        if (this.szMapUnits == "feet" || this.szMapUnits == "meter" || this.szMapUnits == "meters") {
            if (!this.szDatum && !this.szUTMZone) {
                return null;
            }
            var ptCoord = _LLtoUTM(this.szDatum, lat, lon, this.szUTMZone);
            if (this.nFalseEasting) {
                ptCoord.x += (this.nFalseEasting - 500000.0);
            }
            ptCoord.y += this.nFalseNorthing + this.nCorrectNorthing;

            ptCoord.x += this.nCorrectEasting;
            ptCoord.y += this.nCorrectNorthing;
        }
        return ptCoord;
    };
    /**
     * returns the map coordinates of a geo coordinates in Lat/Lon
     * @param lat of the geo coordinate
     * @param lon of the geo coordinate
     * @type point
     * @return the map coordinates as point object
     */
    ixMap.Scale.prototype.getGeoCoordinateOfPoint = function (x, y) {

        if (this.szMapProjection == "Mercator") {
            return _MercatortoLL(y, x);
        }
        if (this.szMapProjection == "EqualEarth") {
            return _EqualEarthtoLL(y, x);
        }
        if (this.szMapProjection == "AlbersEqualArea") {
            return _AlbersEqualAreatoLL(x, y, {
                lat1: this.nAlbersLat1,
                lat2: this.nAlbersLat2,
                lat0: this.nAlbersLat0,
                lon0: this.nAlbersLon0
            });
        }
        if (this.szMapProjection == "LambertAzimuthalEqualArea") {
            return _LambertAzimuthalEqualAreatoLL(x, y, {
                lat0: this.nLambertLat0,
                lon0: this.nLambertLon0
            });
        }
        if (this.szMapProjection == "Orthographic") {
            return _OrthographicToLL(x, y, {
                lat0: this.nOrthographicLat0,
                lon0: this.nOrthographicLon0
            });
        }
        if (this.szMapUnits != "feet" && this.szMapUnits != "meter" && this.szMapUnits != "meters") {
            return new point(x, y);
        } else {
            if (!this.szDatum && !this.szUTMZone) {
                return null;
            }
            var ptCoord = new point(x, y);
            if (this.nFalseEasting) {
                ptCoord.x -= (this.nFalseEasting - 500000.0);
            }
            ptCoord.y -= this.nFalseNorthing + this.nCorrectNorthing;

            ptCoord.x -= this.nCorrectEasting;
            ptCoord.y -= this.nCorrectNorthing;

            return _UTMtoLL(this.szDatum, ptCoord.y, ptCoord.x, this.szUTMZone);
        }
    };
    /**
     * Check if a geographic point is on the backside of the globe for Orthographic projection.
     * A point is on the backside if its angular distance from the projection center is > 90°.
     * @param {number} lat - Latitude in decimal degrees
     * @param {number} lon - Longitude in decimal degrees
     * @returns {boolean} true if point is on backside, false otherwise
     */
    ixMap.Scale.prototype.isPointOnBacksideOrthographic = function (lat, lon) {
        // Only check for Orthographic projection
        if (this.szMapProjection !== "Orthographic" || 
            this.nOrthographicLat0 === null || 
            this.nOrthographicLon0 === null) {
            return false; // Not orthographic or params not set
        }
        
        const degreesToRadians = (deg) => deg * Math.PI / 180;
        const φ0 = degreesToRadians(this.nOrthographicLat0);
        const λ0 = degreesToRadians(this.nOrthographicLon0);
        const φ = degreesToRadians(lat);
        const λ = degreesToRadians(lon);
        const Δλ = λ - λ0;
        
        // Calculate cos(angular_distance) using spherical law of cosines
        // cos(angular_distance) = sin(φ0)*sin(φ) + cos(φ0)*cos(φ)*cos(Δλ)
        const cosAngularDist = Math.sin(φ0) * Math.sin(φ) + 
                              Math.cos(φ0) * Math.cos(φ) * Math.cos(Δλ);
        
        // If cos(angular_distance) < 0, point is >90° away (on backside)
        return cosAngularDist < 0;
    };
    /**
     * returns the map coordinates of a point given in widget coordinates (antizoomandpan).
     * usefull to translate tool coordinates to map coordinates
     * @param x x of the widget coordinate
     * @param y y of the widget coordinate
     * @return the map position (x,y) as point object
     */
    ixMap.Scale.prototype.getMapPosition = function (x, y) {

        var zoomMatrixA = getMatrix(this.zoomNode);
        var nZoomX = zoomMatrixA[0];
        var nZoomY = zoomMatrixA[3];

        // from widget to canvas
        var matrixA = map.antiZoomAndPanList.getActualMatrix();
        x = x * matrixA[0] + matrixA[4];
        y = y * matrixA[3] + matrixA[5];

        // from canvas to map
        x = x - this.mapPosition.x - this.mapOffset.x;
        y = y - this.mapPosition.y - this.mapOffset.y;

        // subtract old map zoom and pan
        x = (x - zoomMatrixA[4]) / nZoomX;
        y = (y - zoomMatrixA[5]) / nZoomY;

        return new point(x, y);
    };
    /**
     * clips the given point to the map position range
     * @param ptPos point to be clipped ( as point object )
     * @return the clipped position as point object
     */
    ixMap.Scale.prototype.clipWidgetPositionToMap = function (ptPos) {

        if (ptPos.x >= this.mapPosition.x + this.bBox.width) {
            ptPos.x = this.mapPosition.x + this.bBox.width;
        }
        if (ptPos.x <= this.mapPosition.x) {
            ptPos.x = this.mapPosition.x;
        }
        if (ptPos.y >= this.mapPosition.y + this.bBox.height) {
            ptPos.y = this.mapPosition.y + this.bBox.height;
        }
        if (ptPos.y <= this.mapPosition.y) {
            ptPos.y = this.mapPosition.y;
        }
        return ptPos;
    };
    /**
     * checks if the given point is within map position range
     * @type boolean
     * @param ptPos point to be checked
     * @return true or false
     */
    ixMap.Scale.prototype.isWidgetPositionInMap = function (ptPos) {

        if (ptPos.x > this.mapPosition.x + this.bBox.width ||
            ptPos.x < this.mapPosition.x ||
            ptPos.y > this.mapPosition.y + this.bBox.height ||
            ptPos.y < this.mapPosition.y) {
            return false;
        }
        return true;
    };
    /**
     * positions the given widget object relative to the given point and offset and
     * corrects the poition if the widget object box exeeds the map area.
     * The poition is corrected to show the whole object.
     * The object is automatically positioned to the possible side of the reference point. 
     * @param objNode widget object to be positioned
     * @param ptPos desired position
     * @param ptOffset desired offset from the given position
     * @return the clipped position as point object
     */
    ixMap.Scale.prototype.clipWidgetObjectToMap = function (objNode, ptPos, ptOffset) {

        var bBox = map.Dom.getBox(objNode);

        if ((ptPos.x + ptOffset.x + bBox.width) > this.mapPosition.x + this.bBox.width) {
            ptPos.x -= bBox.width + ptOffset.x * 2;
        }
        if ((ptPos.y + ptOffset.y + bBox.height) > this.mapPosition.y + this.bBox.height) {
            ptPos.y -= bBox.height + ptOffset.y * 2;
        }
        return new point(ptPos.x + ptOffset.x, ptPos.y + ptOffset.y);
    };
    /**
     * positions the given widget object relative to the given point and offset and
     * corrects the poition if the widget object box exeeds the SVG canvas.
     * The poition is corrected to show the whole object.
     * The object is automatically positioned to the possible side of the reference point. 
     * @param objNode widget object to be positioned
     * @param ptPos desired position
     * @param ptOffset desired offset from the given position
     * @return the clipped position as point object
     */
    ixMap.Scale.prototype.clipWidgetObjectToSVG = function (objNode, ptPos, ptOffset, bBox) {

        if (!bBox) {
            bBox = map.Dom.getBox(objNode);
        }

        if (objNode.getAttributeNS(null, "clip-path")) {
            var szClipPath = objNode.getAttributeNS(null, "clip-path");
            if (szClipPath.match(/url/)) {
                szClipPath = szClipPath.substr(5, szClipPath.length - 6);
                var clipPathNode = map.SVGDocument.getElementById(szClipPath);
                if (clipPathNode) {
                    var clipPathRect = clipPathNode.firstChild;
                    bBox.x = Number(clipPathRect.getAttributeNS(null, "x"));
                    bBox.y = Number(clipPathRect.getAttributeNS(null, "y"));
                    bBox.width = Number(clipPathRect.getAttributeNS(null, "width"));
                    bBox.height = Number(clipPathRect.getAttributeNS(null, "height"));
                }
            }
        }
        var newPosition = new point(ptPos.x + ptOffset.x, ptPos.y + ptOffset.y);

        if ((newPosition.x + bBox.width) > this.viewBox.width) {
            newPosition.x = ptPos.x - bBox.width - ptOffset.x;
        }
        if ((newPosition.x) < 0) {
            newPosition.x = map.Scale.normalX(5);
            if (ptOffset.y <= 0) {
                newPosition.y -= ptOffset.y;
                ptOffset.y = map.Scale.normalY(20);
                newPosition.y += ptOffset.y;
            }
        }
        if ((newPosition.y + bBox.height) > this.viewBox.height) {
            newPosition.y = ptPos.y - bBox.height - ptOffset.y;
        }
        if ((newPosition.y) < 0) {
            newPosition.y = map.Scale.normalX(5);
        }
        return newPosition;
    };
    /**
     * returns the width of the SVG document. If the SVG is embeded, it returns the actual client width
     * @type int
     * @return the width in pixel
     */
    ixMap.Scale.prototype.getEmbedWidth = function () {

        if (typeof (HTMLDocument) != 'undefined' && HTMLDocument != null) {
            try {
                var nWidth = HTMLDocument.embeds[map.szEmbedName].clientWidth;
                var nHeight = HTMLDocument.embeds[map.szEmbedName].clientHeight;
                var windowRatio = nWidth / nHeight;
                var SVGRatio = map.SVGWidth / map.SVGHeight;
                if (windowRatio < SVGRatio) {
                    return (nWidth);
                }
                return nWidth * (SVGRatio / windowRatio);
            } catch (e) {
                return map.SVGWidth;
            }
        }

        if (map.fSVGEmbeded && map.fEmbedScale) {
            if (map.EmbedWidth.indexOf('%') != -1) {
                return document.embeds["svgMain"].clientWidth;
            }
            return map.EmbedWidth;
        }
        if (map.fPDFEmbed) {
            var windowRatio = window.innerWidth / window.innerHeight;
            var SVGRatio = map.SVGWidth / map.SVGHeight;
            if (windowRatio < SVGRatio) {
                return window.innerWidth;
            }
            return window.innerWidth * (SVGRatio / windowRatio);
        }
        return map.SVGWidth;
    };
    /**
     * returns the height of the SVG document. If the SVG is embeded, it returns the actual client height
     * @type int
     * @return the height in pixel
     */
    ixMap.Scale.prototype.getEmbedHeight = function () {

        if (typeof (HTMLDocument) != 'undefined' && HTMLDocument != null) {
            try {
                var nWidth = HTMLDocument.embeds[map.szEmbedName].clientWidth;
                var nHeight = HTMLDocument.embeds[map.szEmbedName].clientHeight;
                var windowRatio = nWidth / nHeight;
                var SVGRatio = map.SVGWidth / map.SVGHeight;
                if (SVGRatio < windowRatio) {
                    return (nHeight);
                }
                return nHeight * (windowRatio / SVGRatio);
            } catch (e) {
                return map.SVGHeight;
            }
        }

        if (map.fSVGEmbeded && map.fEmbedScale) {
            if (map.EmbedHeight.indexOf('%') != -1) {
                return document.embeds["svgMain"].clientHeight;
            }
            return map.EmbedHeight;
        }
        if (map.fPDFEmbed) {
            var windowRatio = window.innerWidth / window.innerHeight;
            var SVGRatio = map.SVGWidth / map.SVGHeight;
            if (SVGRatio < windowRatio) {
                return window.innerHeight;
            }
            return window.innerHeight * (windowRatio / SVGRatio);
        }
        return map.SVGHeight;
    };
    /**
     * Get the actual container dimensions (map-div) that hosts the SVG map.
     * This is used to ensure projections center correctly relative to the visible map area,
     * not the maximum screen width. Returns container dimensions when available, otherwise falls back to window dimensions.
     * @returns {Object} {width: number, height: number} Container dimensions in pixels
     */
    ixMap.Scale.prototype.getContainerDimensions = function () {
        // Try to get dimensions from the actual SVG container element (most reliable)
        if (map.SVGRootElement) {
            try {
                // Try parent element first (the HTML container)
                var container = map.SVGRootElement.parentElement;
                if (container) {
                    var containerWidth = container.clientWidth || container.offsetWidth;
                    var containerHeight = container.clientHeight || container.offsetHeight;
                    if (containerWidth > 0 && containerHeight > 0) {
                        return { width: containerWidth, height: containerHeight };
                    }
                }
                // If parent doesn't work, try the SVG element's own dimensions
                var svgWidth = map.SVGRootElement.clientWidth || map.SVGRootElement.offsetWidth;
                var svgHeight = map.SVGRootElement.clientHeight || map.SVGRootElement.offsetHeight;
                if (svgWidth > 0 && svgHeight > 0) {
                    return { width: svgWidth, height: svgHeight };
                }
            } catch (e) {
                // Fall through to other methods
            }
        }
        
        // Try to get from embed element if available
        if (typeof (HTMLDocument) != 'undefined' && HTMLDocument != null && map.szEmbedName) {
            try {
                var embed = HTMLDocument.embeds[map.szEmbedName];
                if (embed) {
                    var embedWidth = embed.clientWidth;
                    var embedHeight = embed.clientHeight;
                    if (embedWidth > 0 && embedHeight > 0) {
                        return { width: embedWidth, height: embedHeight };
                    }
                }
            } catch (e) {
                // Fall through
            }
        }
        
        // Try document.embeds for SVG embedded case
        if (map.fSVGEmbeded) {
            try {
                var svgEmbed = document.embeds["svgMain"];
                if (svgEmbed) {
                    var embedWidth = svgEmbed.clientWidth;
                    var embedHeight = svgEmbed.clientHeight;
                    if (embedWidth > 0 && embedHeight > 0) {
                        return { width: embedWidth, height: embedHeight };
                    }
                }
            } catch (e) {
                // Fall through
            }
        }
        
        // Try getEmbedWidth/getEmbedHeight - these have logic to get container dimensions
        // but we need to be careful about circular dependencies
        try {
            // Only use getEmbedWidth/Height if map.SVGWidth/Height are already set
            // (to avoid circular dependency during initialization)
            if (map.SVGWidth && map.SVGHeight && map.SVGWidth > 0 && map.SVGHeight > 0) {
                var width = this.getEmbedWidth();
                var height = this.getEmbedHeight();
                // Check if they returned actual container dimensions (not just the fallback)
                // If they're different from map.SVGWidth/Height, they're likely from container
                if (width > 0 && height > 0 && (width !== map.SVGWidth || height !== map.SVGHeight)) {
                    return { width: width, height: height };
                }
            }
        } catch (e) {
            // Fall through to window dimensions
        }
        
        // Final fallback: use window dimensions (but this is what we're trying to avoid for projections)
        // This should only happen during very early initialization
        return {
            width: window.innerWidth || 1024,
            height: window.innerHeight || 768
        };
    };
    /**
     * returns the scaling by the embedding document (HTML,PDF). the aspect ratio of the map is preserved, so only one scaling factor is needed
     * @type double
     * @return the scaling factor
     */
    ixMap.Scale.prototype.getEmbedScale = function () {

        if (typeof (HTMLDocument) != 'undefined' && HTMLDocument != null) {
            try {
                var nWidth = HTMLDocument.embeds[map.szEmbedName].clientWidth;
                var nHeight = HTMLDocument.embeds[map.szEmbedName].clientHeight;
                var windowRatio = nWidth / nHeight;
                var SVGRatio = map.SVGWidth / map.SVGHeight;
                if (SVGRatio < windowRatio) {
                    return (nHeight / map.SVGHeight);
                }
                return (nWidth / map.SVGWidth);
            } catch (e) {
                return 1;
            }
        }
        if (map.fPDFEmbed) {
            var windowRatio = window.innerWidth / window.innerHeight;
            var SVGRatio = map.SVGWidth / map.SVGHeight;
            if (SVGRatio < windowRatio) {
                return (window.innerHeight / map.SVGHeight);
            }
            return (window.innerWidth / map.SVGWidth);
        }
        return 1;
    };
    /**
     * returns the actual map scale as seen on the screen (including embed scaling and ppi scaling)
     * @type double
     * @return the map scale 
     */
    ixMap.Scale.prototype.getTrueMapScale = function () {
        if (map.fAdaptMapScaleToSize) {
            return this.nMapScale / this.getEmbedScale() * this.nPPI / this.nMapPPI;
        } else {
            return this.nMapScale * this.nPPI / this.nMapPPI;
        }
    };
    /**
     * scales a given x value to the initial SVG resolution
     * @type double
     * @param x the value to scale
     * @return the scaled x value
     */
    ixMap.Scale.prototype.normalX = function (x) {
        return (x * this.nScaleX);
    };
    /**
     * scales a given y value to the initial SVG resolution
     * @type double
     * @param y the value to scale
     * @return the scaled y value
     */
    ixMap.Scale.prototype.normalY = function (y) {
        return (y * this.nScaleY);
    };
    /**
     * scales a given x value to the embed (HTML) SVG resolution
     * @type double
     * @param x the value to scale
     * @return the scaled x value
     */
    ixMap.Scale.prototype.embedX = function (x) {
        return (x / this.nScaleX);
    };
    /**
     * scales a given y value to the embed (HTML) SVG resolution
     * @type double
     * @param y the value to scale
     * @return the scaled y value
     */
    ixMap.Scale.prototype.embedY = function (y) {
        return (y / this.nScaleY);
    };
    /**
     * scales a given x value to the actual (zoomed) SVG resolution
     * @type double
     * @param x the value to scale
     * @return the scaled x value
     */
    ixMap.Scale.prototype.scaleX = function (x) {
        return (x / map.SVGRootElement.currentScale * this.viewBox.width / this.getEmbedWidth());
    };
    /**
     * scales a given y value to the actual (zoomed) SVG resolution
     * @type double
     * @param y the value to scale
     * @return the scaled y value
     */
    ixMap.Scale.prototype.scaleY = function (y) {
        return (y / map.SVGRootElement.currentScale * this.viewBox.height / this.getEmbedHeight());
    };
    /**
     * scales a given x screen position (mouse) to the actual (zoomed and panned) SVG coordinate
     * @type double
     * @param x the value to scale
     * @return the scaled x value
     */
    ixMap.Scale.prototype.toSVGx = function (x) {
        return this.scaleX(x * map.SVGRootElement.currentScale - map.SVGRootElement.currentTranslate.x) + this.viewBox.x;
    };
    /**
     * scales a given y screen position (mouse) to the actual (zoomed and panned) SVG coordinate
     * @type double
     * @param y the value to scale
     * @return the scaledy  value
     */
    ixMap.Scale.prototype.toSVGy = function (y) {
        return this.scaleY(y * map.SVGRootElement.currentScale - map.SVGRootElement.currentTranslate.y) + this.viewBox.y;
    };
    /**
     * scales a given (zoomed and panned) SVG coordinate to screen position
     * @type double
     * @param x the value to scale
     * @return the scaled x value
     */
    ixMap.Scale.prototype.toScreenX = function (x) {
        return (x - this.scaleX(-map.SVGRootElement.currentTranslate.x) + Number(viewBox[0])) / map.SVGRootElement.currentScale / viewBoxScale;
    };
    /**
     * scales a given (zoomed and panned) SVG coordinate to screen position
     * @type double
     * @param y the value to scale
     * @return the scaled y value
     */
    ixMap.Scale.prototype.toScreenY = function (y) {
        return (y - this.scaleY(-map.SVGRootElement.currentTranslate.y) + Number(viewBox[3])) / map.SVGRootElement.currentScale / viewBoxScale;
    };
    /**
     * translates a given SVG position into a map position
     * @type double
     * @param x the value to scale
     * @return the x map position
     */
    ixMap.Scale.prototype.toMapX = function (x) {
        return (x - this.scaleX(-map.SVGRootElement.currentTranslate.x) + Number(viewBox[0])) / map.SVGRootElement.currentScale / viewBoxScale;
    };
    /**
     * translates a given SVG position into a map position
     * @type double
     * @param y the value to scale
     * @return the y map position
     */
    ixMap.Scale.prototype.toMapY = function (y) {
        return (y - this.scaleY(-map.SVGRootElement.currentTranslate.y) + Number(viewBox[3])) / map.SVGRootElement.currentScale / viewBoxScale;
    };

    // -----------------------------
    // new tries
    // -----------------------------

    /**
     * get the offset of a node caused by an internal parent &lt;svg&gt; tag
     * @param objNode the node to look at
     * @return the offset as point object
     */
    ixMap.Scale.prototype.getSVGOffset = function (objNode) {
        var svgNode = objNode;
        if (svgNode.nodeName != 'svg') {
            svgNode = map.Dom.getParentByNodename(objNode, 'svg');
        }
        if (svgNode && svgNode != map.SVGRootElement) {
            var viewBox = svgNode.getAttribute('viewBox');
            var SVGViewBox = viewBox.split(' ');
            if (SVGViewBox.length == 4) {
                return new point(Number(SVGViewBox[0]), Number(SVGViewBox[1]));
            } else {
                return new point(0, 0);
            }
        }
        return new point(0, 0);
    };
    /**
     * get the offset of a given node defined by parent groups (stops at group: mapzoomandpan)
     * @param objNode the node to look at
     * @return the group offset as point object
     */
    ixMap.Scale.prototype.getGroupOffset = function (objNode) {
        var pNode = null;
        var sumOffset = new point(0, 0);
        if (objNode) {
            while ((pNode = objNode.parentNode)) {
                if (pNode == map.Zoom.zoomNode || pNode.nodeType != 1) {
                    return sumOffset;
                }
                var nodeMatrixA = getMatrix(pNode);
                sumOffset.x = sumOffset.x * nodeMatrixA[0] + nodeMatrixA[4];
                sumOffset.y = sumOffset.y * nodeMatrixA[3] + nodeMatrixA[5];
                objNode = pNode;
            }
        }
        return new point(0, 0);
    };
    /**
     * get the scale of a given node defined by parent groups (stops at group: mapzoomandpan)
     * @param objNode the node to look at
     * @return the scale as point object
     */
    ixMap.Scale.prototype.getGroupScale = function (objNode) {
        var groupScale = new point(1, 1);
        var pNode = objNode.parentNode;
        while (pNode && pNode.nodeType == 1) {
            var ptScale = getScale(pNode);
            if (ptScale) {
                groupScale.x *= ptScale.x;
                groupScale.y *= ptScale.y;
            }
            pNode = pNode.parentNode;
        }
        return groupScale;
    };
    /**
     * get the offset of a given node defined by &lt;svg&gt; and &lt;g&gt; tags
     * @param objNode the node to look at
     * @return the offset as point object
     */
    ixMap.Scale.prototype.getMapOffset = function (objNode) {
        var ptSVGOffset = this.getSVGOffset(objNode);
        var ptGroupOffset = this.getGroupOffset(objNode);
        return new point(-ptSVGOffset.x + ptGroupOffset.x, -ptSVGOffset.y + ptGroupOffset.y);
    };
    /**
     * get the position of a node in screen coordinates
     * @param objNode the node to look at
     * @return the position as point object
     */
    ixMap.Scale.prototype.getScreenPosition = function (objNode) {
        var ptSVGOffset = this.getSVGOffset(objNode);
        var ptGroupOffset = this.getGroupOffset(objNode);
        var ptOffset = getTranslate(objNode);
        var bBox = map.Dom.getBox(objNode);
        if (bBox) {
            ptOffset.x += bBox.x + bBox.width / 2;
            ptOffset.y += bBox.y + bBox.height / 2;
        }
        var matrixA = map.antiZoomAndPanList.getActualMatrix();
        var zoomMatrixA = getMatrix(this.zoomNode);

        // GR 14.12.1007 to be revisited
        ptOffset = map.Scale.rotatePoint(ptOffset, -1);

        // _TRACE("mapoffset:"+(this.mapPosition.x+this.mapOffset.x)+','+(this.mapPosition.x+this.mapOffset.x));
        // _TRACE("mapzoom:"+(zoomMatrixA[0])+','+(zoomMatrixA[3]));
        // _TRACE("mappan:"+(zoomMatrixA[4]/zoomMatrixA[0])+','+(zoomMatrixA[5]/zoomMatrixA[3]));
        // _TRACE("objoffset:"+(ptOffset.x-ptSVGOffset.x+ptGroupOffset.x)*zoomMatrixA[0]+','+(ptOffset.y-ptSVGOffset.y+ptGroupOffset.y)*zoomMatrixA[3]);
        // _TRACE("vieweroffset:"+(matrixA[4]*matrixA[0])+','+(matrixA[5]*matrixA[3]));

        //                 <----- map offset ----------------> <-- map pan -> <------------ position of the object -------------------> <-- antizoom & pan -->
        return new point((this.mapPosition.x + this.mapOffset.x + zoomMatrixA[4] + (ptOffset.x - ptSVGOffset.x + ptGroupOffset.x) * zoomMatrixA[0] - matrixA[4]) * matrixA[0],
            (this.mapPosition.y + this.mapOffset.y + zoomMatrixA[5] + (ptOffset.y - ptSVGOffset.y + ptGroupOffset.y) * zoomMatrixA[3] - matrixA[5]) * matrixA[3]);
    };
    /**
     * returns the actual mouse position in SVG document coordinates
     * @param evt the mouse event
     * @param clientGroup [optional] if given, the returned position is relative to this node
     * @return the position as point object
     */
    ixMap.Scale.prototype.getClientMousePosition = function (evt, clientGroup) {
        var ret = null;
        if (evt) {
            const dx = (map.SVGDocument.parentNode.parentNode.offsetLeft);
            const dy = (map.SVGDocument.parentNode.parentNode.offsetTop);
            var temp = map.fEmbedScale;
            map.fEmbedScale = true;
            // if client is in antizoomandpan group, we have to scale differently
            if (clientGroup && map.antiZoomAndPanList && map.antiZoomAndPanList.isContained(clientGroup)) {
                ret = new point(this.normalX(evt.clientX-dx), this.normalY(evt.clientY-dy));
                var clientScale = new point(this.getEmbedScale(), this.getEmbedScale());
                ret.x /= clientScale.x;
                ret.y /= clientScale.y;
            }
            // if not, do this
            else {
                ret = new point(this.toSVGx(evt.clientX-dx), this.toSVGy(evt.clientY-dy));
            }
            // add group scaling, if necessary
            if (clientGroup) {
                var ptScale = map.Scale.getGroupScale(clientGroup);
                ret.x /= ptScale.x;
                ret.y /= ptScale.y;
            }
            map.fEmbedScale = temp;
        }
        return ret;
    };
    /**
     * checks if CSSStyles has ben changed, if yes, makes a reappend to bring the new styles into display
     */
    ixMap.Scale.prototype.refreshCSSStyles = function () {
        if (this.fCSSStyleNodeChanged) {
            this.CSSStyleNodes.parentNode.parentNode.appendChild(this.CSSStyleNodes.parentNode);
            this.fCSSStyleNodeChanged = false;
        }
    };
    /**
     * normalize all symbols - calls {@link #normalizeElements} with <code>map.nNormalSymbolSize</code>
     * @param targetGroup the DOM group to look for symbols
     */
    ixMap.Scale.prototype.normalizeSymbols = function (targetGroup) {
        if (this.featureScaling_lastScale == 1) {
            this.normalizeElements(targetGroup, /symbol/, map.nNormalSymbolSize);
        }
        this.nSymbolSize = this.nNormalButtonSize;
    };
    /**
     * normalize all buttons - calls {@link #normalizeElements} with <code>this.nNormalButtonSize</code>
     * @param targetGroup the DOM group to look for buttons
     */
    ixMap.Scale.prototype.normalizeButtons = function (targetGroup) {
        this.normalizeElements(targetGroup, /button/, this.nNormalButtonSize);
        this.normalizeElements(targetGroup, /icon/, this.nNormalButtonSize);
        this.nButtonSize = this.nNormalButtonSize;
    };
    /**
     * normalize all elements; set normal size and center symbol
     * @param targetGroup the DOM group to look for elements
     * @param regExMatch a regular expression to match the elements (e.g./symbol/)
     * @param nNormalSize the size (max x/y) all elements will be scaled to
     */
    ixMap.Scale.prototype.normalizeElements = function (targetGroup, regExMatch, nNormalSize) {
        if (targetGroup) {
            var symbolObjects = targetGroup.getElementsByTagName('g');
            var objA = new Array(0);
            for (var i = 0; i < symbolObjects.length; i++) {
                objA[i] = symbolObjects.item(i);
            }
            for (var i = 0; i < objA.length; i++) {
                var symbolObj = objA[i];
                var szId = symbolObj.getAttributeNS(null, "id");
                if (szId && szId.match(regExMatch)) {
                    var firstObj = map.SVGDocument.getElementById(szId);
                    if (firstObj && (firstObj != symbolObj)) {
                        //firstObj.setAttributeNS(null,"id","doublette");
                        firstObj.parentNode.removeChild(firstObj);
                    }
                    symbolObj.fu = new Methods(symbolObj);

                    var bBox = map.Dom.getBox(symbolObj);
                    // if we can't get the box, make temporary use element and trry again (for firefox!)
                    if (bBox.width === 0) {
                        var cNode = map.Dom.constructNode('use', map.SVGTempGroup, {
                            'xlink:href': '#' + szId
                        });
                        bBox = map.Dom.getBox(cNode);
                    }

                    var nScale = this.normalX(nNormalSize) / bBox.height;
                    symbolObj.fu.setPosition((-bBox.x - bBox.width / 2) * nScale, (-bBox.y - bBox.height / 2) * nScale);
                    symbolObj.fu.scale(nScale, nScale);

                    // re-create object 
                    // have to do this for firefox 
                    if (szViewer.match(/Firefox/i)) {
                        symbolObj.setAttributeNS(null, "id", "");
                        var normalObj = map.Dom.newGroup(symbolObj.parentNode);
                        normalObj = symbolObj.parentNode.insertBefore(normalObj, symbolObj);
                        normalObj.appendChild(symbolObj);
                        normalObj.setAttributeNS(null, "id", szId);
                    }
                }
            }
        }
        map.Dom.clearGroup(map.SVGTempGroup);
    };
    /**
     * change the rotation of the map canvas 
     * @param nDelta the rotation change amount
     */
    ixMap.Scale.prototype.changeRotation = function (evt, nDelta) {
        var nRot = getRotateAttributeValue(map.Scale.canvasNode);
        nRot = (360 + Number(nRot) + Number(nDelta)) % 360;
        setRotate(map.Scale.canvasNode, nRot);
        map.Layer.setObjectRotate(evt, -nRot);
        map.Layer.setPatternRotate(evt, -nRot);
        map.Layer.setLabelRotate(evt, -nRot);
    };
    /**
     * set the rotation of the map canvas 
     * @param nAngle the rotation angle to set
     */
    ixMap.Scale.prototype.setRotation = function (evt, nAngle) {
        nAngle = Math.floor(nAngle);
        setRotate(map.Scale.canvasNode, nAngle);

        map.Layer.setSymbolRotate(evt, -nAngle);
        map.Layer.setObjectRotate(evt, -nAngle);
        map.Layer.setPatternRotate(evt, -nAngle);
        map.Layer.setLabelRotate(evt, -nAngle);
        if (map.Themes) {
            map.Themes.resortCharts();
        }
        map.Dom.clearGroup(map.SVGToolsGroup);
        map.Dom.clearGroup(map.SVGFixedGroup);
        map.removeAllHighlights();
    };
    /**
     * get rotated point
     * @type point
     * @param pPoint the point coordinates
     * @param nDir the direction of the rotate; -1 = unrotate
     */
    ixMap.Scale.prototype.rotatePoint = function (pPoint, nDir) {
        var nRot = getRotateAttributeValue(map.Scale.canvasNode) / 180 * Math.PI;
        if (nRot) {
            if (nDir == -1) {
                nRot = -nRot;
            }
            var x = pPoint.x;
            var y = pPoint.y;
            pPoint.x = x * Math.cos(nRot) + y * Math.sin(nRot);
            pPoint.y = -x * Math.sin(nRot) + y * Math.cos(nRot);
        }
        return pPoint;
    };
    /**
     * create widget styles
     */
    ixMap.Scale.prototype.createWidgetStyles = function () {

        if (typeof (szContainerTitle) != 'string') {
            var szContainerTitle = "font-family:arial;font-size:12px;fill:#444444;pointer-events:none;";
        }
        if (typeof (szInfoContainerTitle) != 'string') {
            var szInfoContainerTitle = szContainerTitle;
        }
        if (typeof (szDescription) != 'string') {
            var szDescription = "font-family:arial;font-size:10px;fill:#888888;font-weight:bold;font-style:italic;pointer-events:none;";
        }
        if (typeof (szSnippet) != 'string') {
            var szSnippet = "font-family:arial;font-size:11px;fill:#555555;;pointer-events:none;";
        }
        if (typeof (szSummary) != 'string') {
            var szSummary = "font-family:arial;font-size:10px;fill:#444444;pointer-events:none;";
        }
        if (typeof (szNote) != 'string') {
            var szNote = "font-family:arial;font-size:11px;fill:darkgrey;font-style:italic;stroke:none;pointer-events:none;";
        }
        if (typeof (szValues) != 'string') {
            var szValues = "font-family:arial;font-size:10px;fill:#798697;font-style:normal;stroke:none;pointer-events:none;";
        }

        this.tStyle = {};

        this.tStyle.ContainerTitle = this.createTextObject(szContainerTitle);
        this.tStyle.InfoContainerTitle = this.createTextObject(szInfoContainerTitle);
        this.tStyle.Description = this.createTextObject(szDescription);
        this.tStyle.Snippet = this.createTextObject(szSnippet);
        this.tStyle.Summary = this.createTextObject(szSummary);
        this.tStyle.Note = this.createTextObject(szNote);
        this.tStyle.Values = this.createTextObject(szValues);
    };
    /**
     * create one text style object
     */
    ixMap.Scale.prototype.createTextObject = function (szTextStyle) {

        var tObject = {};

        tObject.szStyle = __scaleStyleString(szTextStyle, this.normalY(1));
        tObject.nFontHeight = __getFontHeightfromStyleString(tObject.szStyle);

        return tObject;
    };
    /**
     * get scale parameter
     * @type array 
     * @return javascript object with scale parameter
     */
    ixMap.Scale.prototype.getScaleParam = function () {

        var scaleParam = {};

        if (this.nFeatureScaling && (this.nFeatureScaling != 1)) {
            scaleParam.featureScaling = this.nFeatureScaling;
        }
        if (this.nBorderScaling && (this.nBorderScaling != 1)) {
            scaleParam.borderScaling = this.nBorderScaling;
        }
        if (this.nLineScaling && (this.nLineScaling != 1)) {
            scaleParam.lineScaling = this.nLineScaling;
        }
        if (this.nObjectScaling && (this.nObjectScaling != 1)) {
            scaleParam.objectScaling = this.nObjectScaling;
        }
        if (this.nLabelScaling && (this.nLabelScaling != 1)) {
            scaleParam.labelScaling = this.nLabelScaling;
        }
        if (this.nNormalSizeScale && (this.nNormalSizeScale != 1)) {
            scaleParam.normalSizeScale = this.nNormalSizeScale;
        }
        if (this.nDynamicScalePow && (this.nDynamicScalePow != 3)) {
            scaleParam.dynamicScalePow = this.nDynamicScalePow;
        }
        return scaleParam;
    };
    /**
     * get scale parameter
     * @param nodeObj the node to look at
     * @return void
     */
    ixMap.Scale.prototype.setScaleParam = function (obj) {

        // because featurescaliing acts on the actual zoom scale,
        // we must save/restore this local variable of .changeFeatureScaling()
        // TBD  split .changeFeatureScaling() into .unzoomFeatureScaling and .changeFeatureScaling()
        var saveScale = this.featureScaling_lastScale;

        this.nFeatureScaling = 1;
        this.nBorderScaling = 1;
        this.nLineScaling = 1;
        this.nLabelScaling = 1;
        this.nObjectScaling = 1;

        if (obj.featureScaling && (obj.featureScaling != 1)) {
            this.nFeatureScaling = obj.featureScaling;
        }
        if (obj.borderScaling && (obj.borderScaling != 1)) {
            this.nBorderScaling = obj.borderScaling;
        }
        if (obj.lineScaling && (obj.lineScaling != 1)) {
            map.Layer.changeLineScaling(null, obj.lineScaling / this.nLineScaling);
            this.featureScaling_lastScale = saveScale;
        }
        if (obj.labelScaling && (obj.labelScaling != 1)) {
            map.Layer.changeLabelScaling(null, obj.labelScaling / this.nLabelScaling);
            this.featureScaling_lastScale = saveScale;
        }
        if (obj.objectScaling && (obj.objectScaling != 1)) {
            this.nObjectScaling = obj.objectScaling;
        }
        if (obj.normalSizeScale && (obj.normalSizeScale != 1)) {
            this.nNormalSizeScale = Number(obj.normalSizeScale);
        }

        this.nDynamicScalePow = 3;
        if (obj.dynamicScalePow && (obj.dynamicScalePow != 3)) {
            this.nDynamicScalePow = Number(obj.dynamicScalePow);
        }
        map.Layer.doDynamicObjectScaling(map.Scale.nZoomScale);

    };
    // .................................................................... 
    // helper for positioning and scaling of SVG elements       
    // .................................................................... 

    var matrixRegExp = /matrix\(([^,]*)\)/;
    var matrixRegExp1 = /matrix\(([^,]*)\)/;
    var matrixRegExp2 = /matrix\(([0-9., -e]*)\)/;
    var translateRegExp1 = /translate\(([^,]*)\)/;
    var translateRegExp2 = /translate\(([0-9., -e]*)\)/;
    var rotateRegExp = /rotate\(([0-9]*)\)/;

    var urlRegExp = /url\(#([a-zA-Z0-9\-\.\_\:]*)\)/;

    /**
     * get the transform matrix of the given node as Array(6)
     * @type array 
     * @param nodeObj the node to look at
     * @return the matrix as array[6] of numbers
     */
    function getMatrix(nodeObj) {
        if (nodeObj) {
            var szM = nodeObj.getAttribute("transform");
            var szMM = null;
            if (szM && (szMM = szM.match(matrixRegExp1))) {
                var szMA = szMM[1].split(' ');
                // !!! parseFloat is magic !! don't know why
                return new Array(Number(szMA[0]), Number(szMA[1]), Number(szMA[2]), Number(szMA[3]), Number(szMA[4]), parseFloat(szMA[5]));
            }
            if (szM && (szMM = szM.match(matrixRegExp2))) {
                var szMA = szMM[1].split(',');
                return new Array(Number(szMA[0]), Number(szMA[1]), Number(szMA[2]), Number(szMA[3]), Number(szMA[4]), Number(szMA[5]));
            }
        }
        return new Array(1, 0, 0, 1, 0, 0);
    }
    /**
     * set the transform matrix of the given node
     * @param nodeObj the node 
     * @param m the matrix to be set as array[6] of numbers
     * @param m the matrix to be set as array[6] of numbers
     */
    function setMatrix(nodeObj, m, fKeepTranslate) {
        if (nodeObj && m.length == 6) {
            var fCheck = true;
            m.forEach(function (v) {
                if (isNaN(v)) {
                    fCheck = false;
                }
            });
            if (fCheck) {
                var szTransform = nodeObj.getAttributeNS(null, "transform");
                var szNewTransform = "matrix(" + m[0] + " " + m[1] + " " + m[2] + " " + m[3] + " " + m[4] + " " + m[5] + ")";
                // may be we have other transform parts, keep only rotate(...) !
                var szTransformA = szTransform ? szTransform.split(")") : new Array(0);
                for (var i = 0; i < szTransformA.length; i++) {
                    if (szTransformA[i].length > 3 &&
                        (szTransformA[i].match(/rotate/) || szTransformA[i].match(/scale/) || (fKeepTranslate && szTransformA[i].match(/translate/)))) {
                        szNewTransform = szNewTransform + " " + szTransformA[i] + ")";
                    }
                }
                nodeObj.setAttributeNS(null, "transform", szNewTransform);
            }
        }
    }
    /**
     * return the translation of the given node as point(x,y) object
     * @param nodeObj the node 
     * @return the translation as point object
     */
    function getTranslate(nodeObj) {
        if (nodeObj) {
            var m = getMatrix(nodeObj);
            return new point(Number(m[4]), Number(m[5]));
        }
        return new point(0, 0);
    }
    /**
     * set the translation of the given node
     * @param nodeObj the node 
     * @param x the x position ( in relative svg coordinates )
     * @param y the y position ( in relative svg coordinates )
     */
    function setTranslate(nodeObj, x, y) {
        var m = getMatrix(nodeObj);
        m[4] = x;
        m[5] = y;
        setMatrix(nodeObj, new Array(m[0], m[1], m[2], m[3], m[4], m[5]));
    }
    /**
     * return the translation attribute! (not matrix) of the given node as point(x,y) object
     * @param nodeObj the node 
     * @return the translation as point object
     */
    function getTranslateAttributeValue(nodeObj) {
        if (nodeObj) {
            var szM = nodeObj.getAttributeNS(null, "transform");
            var szMM = null;
            if (szM && (szMM = szM.match(translateRegExp1))) {
                var szMA = szMM[1].split(' ');
                return new point(Number(szMA[0]), parseFloat(szMA[1]));
            }
            if (szM && (szMM = szM.match(translateRegExp2))) {
                var szMA = szMM[1].split(',');
                return new point(Number(szMA[0]), Number(szMA[1]));
            }
        }
        return new point(0, 0);
    }
    /**
     * return the x/y scaling factors of the given node as point(x,y) object
     * @param nodeObj the node 
     * @return the x/y scaling factors as point object
     */
    function getScale(nodeObj) {
        if (nodeObj) {
            var m = getMatrix(nodeObj);
            return new point(Number(m[0]), Number(m[3]));
        }
        return new point(1, 1);
    }
    /**
     * set the x/y scaling factors of the given node 
     * @param nodeObj the node 
     * @param x the x scaling factor 
     * @param y the y scaling factor  
     */
    function setScale(nodeObj, x, y) {
        if (nodeObj) {
            var m = getMatrix(nodeObj);
            m[0] = x;
            m[3] = y;
            setMatrix(nodeObj, new Array(m[0], m[1], m[2], m[3], m[4], m[5]), true);
        }
    }
    /**
     * return the rotate attribute! (not matrix) of the given node as number
     * @param nodeObj the node 
     * @param szAttributeName optional parameter if != 'transform'  
     * @return the rotation as number
     */
    function getRotateAttributeValue(nodeObj, szAttributeName) {
        if (!szAttributeName) {
            szAttributeName = "transform";
        }
        if (nodeObj) {
            var szR = nodeObj.getAttributeNS(null, szAttributeName);
            var szRot = null;
            if (szR && (szRot = szR.match(rotateRegExp))) {
                return Number(szRot[1]);
            }
        }
        return 0;
    }
    /**
     * set the rotation of the given node
     * @param nodeObj the node 
     * @param szAttributeName optional parameter if != 'transform'  
     * @param r the rotation to set
     */
    function setRotate(nodeObj, r, szAttributeName) {
        if (!szAttributeName) {
            szAttributeName = "transform";
        }
        if (nodeObj) {
            var fRotateFound = false;
            var szNewTransform = "";
            var szTransform = nodeObj.getAttributeNS(null, szAttributeName);
            var szTransformA = szTransform ? szTransform.split(")") : new Array(0);
            for (var i = 0; i < szTransformA.length; i++) {
                if (szTransformA[i].match(/rotate/)) {
                    szNewTransform = szNewTransform + " rotate(" + r + ")";
                    fRotateFound = true;
                } else if (szTransformA[i].length > 3) {
                    szNewTransform = szNewTransform + " " + szTransformA[i] + ")";
                }
            }
            if (!fRotateFound) {
                szNewTransform = szNewTransform + " rotate(" + r + ")";
            }
            nodeObj.setAttributeNS(null, szAttributeName, szNewTransform);
        }
    }
    /**
     * get the transform matrix of the given pattern node as Array(6)
     * @type array
     * @param nodeObj the node to look at
     * @return the pattern matrix as array[6] of numbers
     */
    function getPatternMatrix(nodeObj) {
        if (nodeObj) {
            var szM = nodeObj.getAttribute("patternTransform");
            if (szM && (szM = szM.match(matrixRegExp1))) {
                var szMA = szM[1].split(' ');
                return new Array(Number(szMA[0]), Number(szMA[1]), Number(szMA[2]), Number(szMA[3]), Number(szMA[4]), Number(szMA[5]));
            }
            if (szM && (szM = szM.match(matrixRegExp2))) {
                var szMA = szM[1].split(',');
                return new Array(Number(szMA[0]), Number(szMA[1]), Number(szMA[2]), Number(szMA[3]), Number(szMA[4]), Number(szMA[5]));
            }
        }
        return new Array(1, 0, 0, 1, 0, 0);
    }
    /**
     * Create a new point instance.  
     * @class It realizes an object to define one coordinate point
     * @constructor
     * @return A new point object
     * @param x x position of the point 
     * @param y y position of the point 
     */
    var point = function (x, y) {
        this.x = x;
        this.y = y;
    };
    /**
     * Create a new box instance.  
     * @class It realizes an object to define an coordinate area
     * @constructor
     * @return A new box object
     * @param x x position of the left upper corner 
     * @param y y position of the left upper corner
     * @param width  the width of the box
     * @param height the height of the box
     */
    var box = function (x, y, width, height) {
        this.x = Number(x);
        this.y = Number(y);
        this.width = Number(width);
        this.height = Number(height);
    };
    /**
     * scale the box object by a given factor
     * @param nFactor scales width and height of the box 
     */
    box.prototype.scale = function (nFactor) {
        var newWidth = this.width * nFactor;
        var newHeight = this.height * nFactor;
        this.x -= (newWidth - this.width) / 2;
        this.y -= (newHeight - this.height) / 2;
        this.width = newWidth;
        this.height = newHeight;
    };
    /**
     * check the box object 
     * @return true or false
     */
    box.prototype.check = function () {
        if (isNaN(this.x) || isNaN(this.y) || isNaN(this.width) || isNaN(this.height)) {
            return false;
        }
        return true;
    };
    /**
     * returns an own duplicate of a given box
     * needed because IE9 don't gives a freely calcoltable box at getBBox()
     * @type array
     * @param abox the given box to duplicate
     * @return a new box object
     */
    function __boxDup(aBox) {
        return new box(aBox.x, aBox.y, aBox.width, aBox.height);
    }
    /**
     * safe method to ge a box 
     * returns an own duplicate of a given box or a zero box
     * needed for firefox (error if box is null) and IE9 (don't gives a freely calcoltable box at getBBox())
     * @type array
     * @param element the DOM element of which to give the box
     * @return a new box object
     */
    ixMap.Dom.prototype.getBox = function (element) {
        try {
            return __boxDup(element.getBBox());
        } catch (e) {
            return new box(0, 0, 0, 0);
        }
    };

    // .................................................................... 
    // function wrapper for map objects, SVG <g> nodes with id
    // .................................................................... 

    /**
     * Create a new mapObject instance.  
     * @class returns a mapobject for the given DOM node. A map object:
     * <ul>
     * <li>must have an id<br>(if the given node has no id, the first node upwards with an id is taken)</li>
     * <li>provides extended methods accessible with: object.fu.method()</li>
     * </ul>
     * @constructor
     * @param nodeObj the node to become an object
     * @throws -
     * @return A new mapObject
     */
    function MapObject(nodeObj) {
        if (nodeObj.nodeType != 1) {
            return null;
        }
        // must have an id !
        /** the id of the mapObject @type string */
        this.szId = "";
        while (this.szId === "" && nodeObj.parentNode && nodeObj.nodeType == 1) {
            this.szId = nodeObj.getAttributeNS(null, 'id');
            if ((typeof this.szId != "string") || (this.szId === "") || (this.szId.match(/noobject/))) {
                nodeObj = nodeObj.parentNode;
                this.szId = "";
            }
        }
        /** the node itself @type DOM node */
        this.objNode = nodeObj;
        /** link to the exetended methods (class {@link Methods}) @type Methods */
        this.fu = new Methods(nodeObj);
    }
    /**
     * get the context menu id of this SVG node ( ore parents )
     * @type string
     * @return the id as string or null
     */
    MapObject.prototype.getContextMenuId = function () {
        var nodeObj = null;
        for (nodeObj = this.objNode; nodeObj; nodeObj = nodeObj.parentNode) {
            if (nodeObj.nodeType == 1) {
                var szMenuId = nodeObj.getAttributeNS(szMapNs, "menu");
                if (szMenuId && szMenuId.length) {
                    return szMenuId;
                }
            }
        }
        return null;
    };
    /**
     * set the context menu id of this SVG node 
     * @param szId the name of the assoziated menu 
     */
    MapObject.prototype.setContextMenuId = function (szId) {
        this.objNode.setAttributeNS(szMapNs, "menu", szId);
    };

    // .................................................................... 
    // methods to query and manipulate SVG objects (nodes) 
    // .................................................................... 

    /**
     * Create a new Methods instance.  
     * @class It provides extended methods to an SVG DOM node; usage: anySVGNode.fu = new Methods(anySVGNode); 
     * @constructor
     * @param nodeObj the node to apply the methods
     * @throws -
     * @return A new Method
     */
    function Methods(nodeObj) {
        /* the target DOM node for the methods @type DOM node */
        this.nodeObj = nodeObj;
    }
    /**
     * position and scale SVG node by matrix
     * @param m the transform matrix 
     */
    Methods.prototype.setMatrix = function (m) {
        setMatrix(this.nodeObj, m);
    };
    /**
     * returns the position of this SVG node as point(x,y) object
     * @type point
     * @return the x/y position as point object
     */
    Methods.prototype.getPosition = function () {
        var m = getMatrix(this.nodeObj);
        return new point(Number(m[4]), Number(m[5]));
    };
    /**
     * position this SVG node to x/y
     * @param x the x position ( in relative svg coordinates )
     * @param y the y position ( in relative svg coordinates )
     */
    Methods.prototype.setPosition = function (x, y) {
        var m = getMatrix(this.nodeObj);
        m[4] = x;
        m[5] = y;
        setMatrix(this.nodeObj, new Array(m[0], m[1], m[2], m[3], m[4], m[5]));
    };
    /**
     * scale this SVG node to x/y (absolute scaling)
     * @param x the new x scale factor
     * @param y the new y scale factor
     */
    Methods.prototype.scale = function (x, y) {
        var m = getMatrix(this.nodeObj);
        m[0] = x;
        m[3] = y;
        setMatrix(this.nodeObj, new Array(m[0], m[1], m[2], m[3], m[4], m[5]));
    };
    /**
     * scale this SVG node by x/y (relative scaling)
     * @param x the x scaling factor
     * @param y the y scaling factor
     */
    Methods.prototype.scaleBy = function (x, y) {
        var bBox = this.getBox();
        var dX = (bBox.width / 2 + bBox.x);
        var dY = (bBox.height / 2 + bBox.y);
        var m = getMatrix(this.nodeObj);
        m[0] *= x;
        m[3] *= y;
        if (x > 1) {
            m[4] -= dX * x - dX;
            m[5] -= dY * y - dY;
        } else {
            m[4] -= dX - dX / x;
            m[5] -= dY - dY / y;
        }
        setMatrix(this.nodeObj, new Array(m[0], m[1], m[2], m[3], m[4], m[5]));
    };
    /**
     * rotate this SVG node by alpha
     * @param alpha the rotation angle
     */
    Methods.prototype.rotateBy = function (alpha) {
        setRotate(this.nodeObj, alpha);
    };
    /**
     * gets the scale of this SVG node
     * @type point
     * @return the x/y scale as point object
     */
    Methods.prototype.getScale = function () {
        var m = getMatrix(this.nodeObj);
        return new point(Number(m[0]), Number(m[3]));
    };
    /**
     * gets the scale of the parent of this SVG node
     * @type point
     * @return the x/y scale as point object
     */
    Methods.prototype.getParentScale = function () {
        var m = getMatrix(this.nodeObj.parentNode);
        return new point(Number(m[0]), Number(m[3]));
    };
    /**
     * gets the scale of this SVG node relative to the SVG canvas
     * @type point
     * @return the x/y scale as point object
     */
    Methods.prototype.getGroupScale = function () {
        return map.Scale.getGroupScale(this.nodeObj);
    };
    /**
     * scale this SVG node to the new width and height
     * @param nWidth the new width 
     * @param nHeight the new height
     */
    Methods.prototype.scaleTo = function (nWidth, nHeight) {
        var bBox = this.getBox();
        if (nWidth && nHeight) {
            this.scaleBy(nWidth / bBox.width, nHeight / bBox.height);
        } else if (nWidth) {
            this.scaleBy(nWidth / bBox.width, nWidth / bBox.width);
        } else if (nHeight) {
            this.scaleBy(nHeight / bBox.height, nHeight / bBox.height);
        }
    };
    /**
     * gets the (scaled) box of this SVG node
     * (this is the box of the node as seen from outside!)
     * @type box
     * @return the position and extension of the node as box object
     */
    Methods.prototype.getBox = function () {
        var bBox = map.Dom.getBox(this.nodeObj);
        var ptScale = this.getScale();
        var sBox = new box(bBox.x, bBox.y, bBox.width, bBox.height);
        sBox.x *= ptScale.x;
        sBox.y *= ptScale.y;
        sBox.width *= ptScale.x;
        sBox.height *= ptScale.y;
        return sBox;
    };
    /**
     * gets the (computed) text length of this SVG node
     * @type double
     * @return the textlengh
     */
    Methods.prototype.getTextLength = function () {
        if (this.nodeObj.nodeName == "text") {
            return this.nodeObj.getComputedTextLength();
        }
        return 0;
    };
    /**
     * position this SVG node to x/y and scale it to nScale
     * ( used to focus on the given node )
     * @param x the x position ( in relative svg coordinates )
     * @param y the y position ( in relative svg coordinates )
     * @param nScale the new scaling factor
     */
    Methods.prototype.focus = function (x, y, nScale) {
        setMatrix(this.nodeObj, new Array(nScale, 0, 0, nScale, Number(x * nScale), Number(y * nScale)));
    };
    /**
     * clear this SVG node; remove all child elements (only applicabile to SVG groups)
     */
    Methods.prototype.clear = function () {
        map.Dom.clearGroup(this.nodeObj);
    };
    /**
     * check, if the given node is contained in (= is child of) the method target node
     * @type boolean
     * @param objNode the dom node to examine
     * @return true if the node is contained
     */
    Methods.prototype.isContained = function (objNode) {
        while ((objNode = objNode.parentNode)) {
            if (objNode == this.nodeObj) {
                return true;
            }
        }
        return false;
    };
    /**
     * add a given extension to all id's of the node and its child nodes
     * @param szExtend the string to add to all ids found 
     */
    Methods.prototype.extendAllIds = function (szExtend) {
        map.Dom.extendAllIds(this.objNode, szExtend);
    };



    // --------------------------------------------------------------------------------- 
    // modify tyle strings (class)
    // --------------------------------------------------------------------------------- 

    /**
     * Create a new ixMap.CSS instance.  
     * @class It reads the CSS styles of the SVG and realizes CSS style changing functions 
     * @constructor
     * @param styleNodes the DOM node that containes the CSS styles definition
     * @throws 
     * @return A new ixMap.CSS Object
     */
    ixMap.CSS = function (styleNodes) {

        this.stylesA = new Array(0);
        var szStylesValue = styleNodes.firstChild.nextSibling.nodeValue;

        var szStylesA = szStylesValue.split('}');
        for (var s = 0; s < szStylesA.length; s++) {
            var szClassName = szStylesA[s].split('{')[0];
            szClassName = szClassName.split('.')[1];
            this.stylesA[szClassName] = __getStyleArray(szStylesA[s].split('{')[1]);
        }
    };
    /**
     * create the new (changed) CSS style string; this can be set as new value of the DOM node that containes the CSS styles definition
     * @type string
     * @return a style string with all changes (featurescaling, ... )
     */
    ixMap.CSS.prototype.getStyleString = function () {
        var szStyles = "";
        for (var a in this.stylesA) {
            szStyles += ' .' + a + '{';
            for (var s in this.stylesA[a]) {
                szStyles += s + ':' + this.stylesA[a][s] + ';';
            }
            szStyles += '}';
        }
        return szStyles;
    };
    /**
     * set a new value for the given style of a specific class
     * @param szClass name of the CSS class
     * @param szAttribute style attribute to change
     * @param szValue new value to set
     */
    ixMap.CSS.prototype.setStyle = function (szClass, szAttribute, szValue) {
        try {
            this.stylesA[szClass][szAttribute] = szValue;
        } catch (e) {}
    };

    // --------------------------------------------------------------------------------- 
    // (helper)
    // --------------------------------------------------------------------------------- 

    /**
     * adapt one style string to the acual scaling ( nDelta = actual/incremental scaling
     * @param szStylesValue the original style string
     * @param nDelta the factor to change style attributes
     * @type string
     * @return the scaled style string
     */
    function __scaleStyleString(szStylesValue, nDelta) {
        if (!szStylesValue || !nDelta) {
            return null;
        }
        var szStylesValuesA = szStylesValue.split(';');
        var styleA = null;
        for (var i = 0; i < szStylesValuesA.length; i++) {
            if (szStylesValuesA[i].match(/stroke-width/)) {
                styleA = szStylesValuesA[i].split(':');
                styleA[1] = String(parseFloat(styleA[1]) * nDelta);
                szStylesValuesA[i] = styleA.join(':');
            } else
            if (szStylesValuesA[i].match(/font-size/)) {
                styleA = szStylesValuesA[i].split(':');
                styleA[1] = String(parseFloat(styleA[1]) * nDelta) + 'px';
                szStylesValuesA[i] = styleA.join(':');
            } else
            if (szStylesValuesA[i].match(/stroke-dashoffset/)) {
                styleA = szStylesValuesA[i].split(':');
                styleA[1] = String(parseFloat(styleA[1]) * nDelta);
                szStylesValuesA[i] = styleA.join(':');
            } else
            if (szStylesValuesA[i].match(/stroke-dasharray/)) {
                styleA = szStylesValuesA[i].split(':');
                var dashA = styleA[1].split(',');
                if (dashA.length > 1) {
                    szStylesValuesA[i] = styleA[0] + ':';
                    for (var d = 0; d < dashA.length; d++) {
                        dashA[d] = String(parseFloat(dashA[d]) * nDelta);
                        szStylesValuesA[i] += dashA[d];
                        if (d < dashA.length - 1) {
                            szStylesValuesA[i] += ',';
                        }
                    }
                } else {
                    dashA = styleA[1].split(' ');
                    szStylesValuesA[i] = styleA[0] + ':';
                    for (var d = 0; d < dashA.length; d++) {
                        dashA[d] = String(parseFloat(dashA[d]) * nDelta);
                        szStylesValuesA[i] += dashA[d];
                        if (d < dashA.length - 1) {
                            szStylesValuesA[i] += ',';
                        }
                    }
                }
            }
            /**
            if ( 0 && szStylesValuesA[i].match(/baseline-shift/)){
            	styleA=szStylesValuesA[i].split(':');
            	styleA[1] = String(parseFloat(styleA[1])*nDelta);
            	szStylesValuesA[i] = styleA[0]+':'+styleA[1];
            }
            **/
        }

        return szStylesValuesA.join(';');
    }
    /**
     * adapt one style string to the acual scaling ( nDelta = actual/incremental scaling
     * @param szStylesValue the original style string
     * @param nDelta the factor to change style attributes
     * @type string
     * @return the scaled style string
     */
    function __scaleLineStyleString(szStylesValue, nDelta) {
        if (!szStylesValue || !nDelta) {
            return null;
        }
        var szStylesValuesA = szStylesValue.split(';');
        var styleA = null;
        for (var i = 0; i < szStylesValuesA.length; i++) {
            if (szStylesValuesA[i].match(/stroke-width/)) {
                styleA = szStylesValuesA[i].split(':');
                styleA[1] = String(parseFloat(styleA[1]) * nDelta);
                szStylesValuesA[i] = styleA.join(':');
            } else
            if (szStylesValuesA[i].match(/stroke-dashoffset/)) {
                styleA = szStylesValuesA[i].split(':');
                styleA[1] = String(parseFloat(styleA[1]) * nDelta);
                szStylesValuesA[i] = styleA.join(':');
            } else
            if (szStylesValuesA[i].match(/stroke-dasharray/)) {
                styleA = szStylesValuesA[i].split(':');
                var dashA = styleA[1].split(',');
                if (dashA.length > 1) {
                    szStylesValuesA[i] = styleA[0] + ':';
                    for (var d = 0; d < dashA.length; d++) {
                        dashA[d] = String(parseFloat(dashA[d]) * nDelta);
                        szStylesValuesA[i] += dashA[d];
                        if (d < dashA.length - 1) {
                            szStylesValuesA[i] += ',';
                        }
                    }
                } else {
                    dashA = styleA[1].split(' ');
                    szStylesValuesA[i] = styleA[0] + ':';
                    for (var d = 0; d < dashA.length; d++) {
                        dashA[d] = String(parseFloat(dashA[d]) * nDelta);
                        szStylesValuesA[i] += dashA[d];
                        if (d < dashA.length - 1) {
                            szStylesValuesA[i] += ',';
                        }
                    }
                }
            }
        }
        return szStylesValuesA.join(';');
    }
    /**
     * adapt one text style string to the acual scaling ( nDelta = actual/incremental scaling
     * @param szStylesValue the original style string
     * @param nDelta the factor to change style attributes
     * @type string
     * @return the scaled style string
     */
    function __scaleTextStyleString(szStylesValue, nDelta) {
        if (!szStylesValue || !nDelta) {
            return null;
        }
        var szStylesValuesA = szStylesValue.split(';');
        var styleA = null;
        for (var i = 0; i < szStylesValuesA.length; i++) {
            if (szStylesValuesA[i].match(/font-size/)) {
                styleA = szStylesValuesA[i].split(':');
                styleA[1] = String(parseFloat(styleA[1]) * nDelta) + 'px';
                szStylesValuesA[i] = styleA.join(':');
            }
        }
        return szStylesValuesA.join(';');
    }
    /**
     * get the font height for a text style string
     * @param szStylesValue the original style string
     * @type float
     * @return the text height
     */
    function __getFontHeightfromStyleString(szStyle) {
        if (!szStyle) {
            return -1;
        }
        var szStyleA = szStyle.split(';');
        for (var i = 0; i < szStyleA.length; i++) {
            if (szStyleA[i].match(/font-size/)) {
                var styleA = szStyleA[i].split(':');
                return parseFloat(styleA[1]);
            }
        }
        return -1;
    }


    var __idSetRotationTimeout = null;
    var __nOldAngle = 0;

    function __setRotation(evt, nAngle) {
        if (nAngle == __nOldAngle) {
            return;
        }
        __nOldAngle = nAngle;
        if (__idSetRotationTimeout) {
            clearTimeout(__idSetRotationTimeout);
        }
        __idSetRotationTimeout = setTimeout("__doSetRotation(" + nAngle + ")", 200);
    }

    function __doSetRotation(nAngle) {
        executeWithMessage(() => map.Scale.setRotation(null, nAngle), "...");
        __idSetRotationTimeout = null;
    }


    // .................................................................... 
    // adobe viewer zoom handler
    // - prevent special Group(s) from zoom and pan
    // - change map scaling 
    // .................................................................... 

    /**
     * Create a new AntiZoomAndPan instance.  
     * @class It realizes a list of groups, that shall not appear zoomed or panned; everytime, a zoom or pan is performed, this groups will be transformed in an adequate way, to keep their zooming and position.
     * @constructor
     * @throws 
     * @return A new AntiZoomAndPan list
     */
    function AntiZoomAndPan(evt) {


        /** the list of all SVG groups with 'antizoomandpan' property; they will be retransformed on zoom and pan  @type array */
        this.listA = new Array(0);
        this.buildList(evt);

    }
    /**
     * create a new entry in the antizoomandpan list
     * @param nodeGroup the DOm node of the group
     */
    AntiZoomAndPan.prototype.addGroup = function (nodeGroup) {
        this.listA[this.listA.length] = nodeGroup;
    };
    /**
     * build the antizoomandpan list from the SVGRootElement on.
     * <br>add any group, who's id matches /antizoomandpan/
     * @param evt the actual event
     */
    AntiZoomAndPan.prototype.buildList = function (evt) {
        var childNodesA = map.SVGRootElement.childNodes;
        for (var i = 0; i < childNodesA.length; i++) {
            try {
                if (childNodesA.item(i).nodeType == '1' && childNodesA.item(i).getAttributeNS(null, 'id').match(/antizoomandpan/)) {
                    this.addGroup(childNodesA.item(i));
                }
            } catch (e) {}
        }
    };
    /**
     * check if an SVG element is or is contained in an antizoomandpan group 
     * @param nodeGroup the DOM node of the element
     * @type boolean
     * @return true, if is contained in antizoomandpan group
     */
    AntiZoomAndPan.prototype.isContained = function (nodeGroup) {
        while (nodeGroup) {
            if (this.checkGroup(nodeGroup)) {
                return true;
            }
            nodeGroup = nodeGroup.parentNode;
        }
        return false;
    };
    /**
     * check if an SVG group is within the antizoomandpan list 
     * @param nodeGroup the DOM node of the group
     * @type boolean
     * @return true, if group is in antizoomandpan list
     */
    AntiZoomAndPan.prototype.checkGroup = function (nodeGroup) {
        for (var i = 0; i < this.listA.length; i++) {
            if (nodeGroup == this.listA[i]) {
                return true;
            }
        }
        return false;
    };
    /**
     * retransform the groups within the antizoomandpan list after a zooming or panning event
     * @param evt the actual event
     */
    AntiZoomAndPan.prototype.adjustGroups = function (evt) {
        if (!map.fAntiZoomAndPan) {
            return;
        }
        var viewBox = map.SVGRootElement.getAttribute('viewBox').split(' ');
        var origViewBox = map.SVGOrigViewBoxString.split(' ');
        var viewBoxScale = Number(origViewBox[2]) / Number(viewBox[2]);
        var matrixA;
        for (var i = 0; i < this.listA.length; i++) {
            var nodeGroup = this.listA[i];
            if ((matrixA = getMatrix(nodeGroup))) {
                matrixA[0] = 1 / map.SVGRootElement.currentScale / viewBoxScale;
                matrixA[3] = 1 / map.SVGRootElement.currentScale / viewBoxScale;
                matrixA[4] = map.Scale.scaleX(-map.SVGRootElement.currentTranslate.x) + Number(viewBox[0]);
                matrixA[5] = map.Scale.scaleY(-map.SVGRootElement.currentTranslate.y) + Number(viewBox[1]);
                setMatrix(nodeGroup, matrixA);
            }
        }
    };
    /**
     * get the actual correction matrix of the AntiZoomAndPan groups
     * @param evt the actual event
     * @type array
     * @return the matrix
     */
    AntiZoomAndPan.prototype.getActualMatrix = function (evt) {
        var nodeGroup = this.listA[0];
        return getMatrix(nodeGroup);
    };
    /**
     * switches the the groups within the antizoomandpan list (tools,...) on/off; used in fast panning mode
     * @param evt the actual event
     * @param state the new display attribute value
     */
    AntiZoomAndPan.prototype.setDisplay = function (evt, state) {
        for (var i = 0; i < this.listA.length; i++) {
            var nodeGroup = this.listA[i];
            nodeGroup.style.setProperty("display", state, "");
        }
    };

    /**
     * clones the fill pattern for use within the legend (antizoomandpan)
     * @param evt the event
     * @param rootNode the dom node to start the recursive search for childs 
     */
    AntiZoomAndPan.prototype.initAntiZoomPattern = function (evt, rootNode) {

        if (rootNode === null) {
            rootNode = map.SVGDocument;
        }
        if (evt) {
            rootNode = evt.target.ownerDocument;
        }

        // clone pattern
        var nodeA = rootNode.getElementsByTagName('pattern');
        if (nodeA === null || nodeA.length === 0) {
            return;
        }
        var nMaxP = nodeA.length;
        var patternNodes = nodeA.item(0).parentNode;
        var newPattern;
        for (var p = 0; p < nMaxP; p++) {
            if (!nodeA.item(p).getAttributeNS(null, "id").match(/antizoomandpan/)) {
                newPattern = nodeA.item(p).cloneNode(1000);
                newPattern.setAttributeNS(null, "id", newPattern.getAttributeNS(null, "id") + ":antizoomandpan");
                patternNodes.appendChild(newPattern);
            }
        }
        patternNodes.parentNode.appendChild(patternNodes);
    };

    /**
     * clones the fill pattern for use within the legend (antizoomandpan)
     * @param evt the event
     * @param rootNode the dom node to start the recursive search for childs 
     */
    AntiZoomAndPan.prototype.initAntiZoomSymbols = function (evt, rootNode) {

        if (rootNode === null) {
            return;
        }
        // clone pattern
        var nodeA = rootNode.getElementsByTagName('g');
        if (nodeA === null || nodeA.length === 0) {
            return;
        }
        var nMaxP = nodeA.length;
        var symbolNodes = nodeA.item(0).parentNode;
        var newSymbol;
        for (var p = 0; p < nMaxP; p++) {
            var szId = nodeA.item(p).getAttributeNS(null, "id");
            if (szId && szId.length && szId.match(/symbol/) && !szId.match(/antizoomandpan/)) {
                newSymbol = nodeA.item(p).cloneNode(1000);
                newSymbol.setAttributeNS(null, "id", szId + ":antizoomandpan");
                symbolNodes.appendChild(newSymbol);
            }
        }
        symbolNodes.parentNode.appendChild(symbolNodes);
    };

    /**
     * exetends the url references of all fill properties to link to antizoomandpan pattern clones
     * @param evt the event
     * @param objNode the dom node to start the recursive search for childs 
     * @param szExtend the text to add to all url definitions within style attributes; sample: fill:url(#pattern) --> fill:url(#pattern:antizoomandpan) 
     */
    AntiZoomAndPan.prototype.extendAllPatternStyles = function (evt, objNode, szExtend) {
        if (objNode && objNode.nodeType == 1) {
            var szFill = objNode.style.getPropertyValue("fill");
            if (szFill && szFill.length > 1 && szFill.match(/url/)) {
                var idA = szFill.split(')');
                szFill = idA[0] + szExtend + ")";
                objNode.style.setProperty("fill", szFill, "");
            }
        }
    };
    /**
     * clones the style definitions for use within the legend (antizoomandpan)
     * @param evt the event
     */
    AntiZoomAndPan.prototype.initAntiZoomStyles = function (evt) {
        var SVGDoc = evt ? evt.target.ownerDocument : map.SVGDocument;
        var legendNode = map.SVGDocument.getElementById("widgets:antizoomandpan");
        this.extendAllPatternStyles(evt, legendNode, ":antizoomandpan");
    };

    // .............................................................................
    // t i l e s          
    // .............................................................................



    /**
     * activate theme 
     * @param szTheme the name of the theme to be activated
     */
    function activateTheme(szTheme) {

        if (szTheme.match(/:label/)) {
            return;
        }

        // subtract tile appendix
        szTheme = map.Tiles.getMasterId(szTheme);

        if (map._activeTheme == szTheme) {
            return;
        }

        // GR 05.06.2012 
        if (szTheme == "mapcanvas") {
            return;
        }

        var legendIdent = map.SVGDocument.getElementById("legend:ident:" + szTheme);
        if (legendIdent) {
            clearThemes();
            map._legendIdent = legendIdent;
            var textNode = map._legendIdent.nextSibling.nextSibling;
            if (textNode && textNode.nodeName == "text") {
                try {
                    var bBox = map.Dom.getBox(textNode);
                    map._legendIdent.setAttributeNS(null, "width", bBox.width + map.Scale.normalX(10));
                } catch (e) {}
            }
            map._legendIdent.style.setProperty("display", "inline", "");
            map._activeTheme = szTheme;

            // GR 25.10.2011 new; show info if we have an active theme
            // --------------------------------------------------------
            if (map.fActiveThemeInfo) {
                var ptPos = new point(map.Scale.mapPosition.x, map.Scale.mapPosition.y + map.Scale.normalX(map.nToolMarginTop));
                if (map.Viewport.szPopupAlignment.match(/TOP/)) {
                    ptPos.y = map.Scale.bBox.height + map.Scale.mapPosition.y - map.Scale.normalY(38);
                }
                var _activeThemeInfo = new InfoContainer(map.SVGDocument, map.SVGMenuGroup, "movable", ptPos, {
                    x: map.Scale.normalX(5),
                    y: map.Scale.normalY(5)
                }, "fix");
                _activeThemeInfo.frameNode.style.setProperty("fill", "#fafafa", "");
                _activeThemeInfo.setTitle("info on");
                _activeThemeInfo.setOnRemove("clearThemes()");

                var infoWorkspace = _activeThemeInfo.workspaceNode;
                var szTextStyle = map.Scale.tStyle.Description.szStyle;
                map.Dom.newText(infoWorkspace, map.Scale.normalX(5), map.Scale.tStyle.Description.nFontHeight, szTextStyle, textNode.firstChild.nodeValue);
                _activeThemeInfo.reformat();
            }
            // --------------------------------------------------------

            try {
                map.HTMLWindow.ixmaps.htmlgui_setActiveTheme(szTheme);
            } catch (e) {}
            try {
                map.Themes.redrawInfoAll(null);
            } catch (e) {}
        } else {
            clearThemes();
            _removeInfo(null);
            map._activeTheme = szTheme;
            try {
                map.HTMLWindow.ixmaps.htmlgui_setActiveTheme(szTheme);
            } catch (e) {}
            try {
                map.Themes.redrawInfoAll(null);
            } catch (e) {}
        }

        // GR 21.01.2011 test test test
        map.Layer.setPointerEvents(map._activeTheme);

        map._activeItem = null;
    }
    /**
     * get active theme 
     */
    function getActiveTheme() {
        return map._activeTheme;
    }
    /**
     * is active theme 
     */
    function isActiveTheme(szTheme) {
        return (szTheme == map._activeTheme);
    }
    /**
     * deactive theme 
     */
    function deactivateTheme(szTheme) {
        if (isActiveTheme(szTheme)) {
            clearThemes();
        }
    }
    /**
     * clear highlight in legend
     */
    function clearThemes() {
        if (map._legendIdent) {
            map._legendIdent.style.setProperty("display", "none", "");
            map._legendIdent = null;
        }
        map._activeTheme = null;
        map.highLightList.removeAll();
    }
    /**
     * highlight theme 
     * @param szTheme the name of the theme to be activated
     */
    var __highlightedTheme = null;

    function highlightTheme(mapObj) {

        while (mapObj && (mapObj.objNode.nodeName != 'g') && mapObj.objNode.parentNode) {
            if ((mapObj = new MapObject(mapObj.objNode.parentNode)) === null) {
                return;
            }
        }

        // subtract tile appendix
        var szTheme = mapObj.szId;
        if (map.Tiles) {
            szTheme = map.Tiles.getMasterId(szTheme);
        }
        var szValue = mapObj.objNode.getAttributeNS(szMapNs, "value");
        if ((!szValue || szValue.length < 1) && (mapObj.objNode.firstChild && mapObj.objNode.firstChild.nextSibling)) {
            szValue = mapObj.objNode.firstChild.nextSibling.getAttributeNS(szMapNs, "value");
        }
        if (szValue && szValue.length) {
            szTheme = szTheme.split('::')[0] + '::' + szValue;
        }

        __highlightedTheme = map.SVGDocument.getElementById("legend:ident:" + szTheme);
        if (__highlightedTheme) {
            var textNode = __highlightedTheme.nextSibling.nextSibling;
            if (textNode && textNode.nodeName == "text") {
                var bBox = map.Dom.getBox(textNode);
                __highlightedTheme.setAttributeNS(null, "width", bBox.width + map.Scale.normalX(10));
            }
            __highlightedTheme.style.setProperty("display", "inline", "");
        }
    }
    /**
     * get active theme 
     */
    function highlightThemeRemove() {
        if (__highlightedTheme) {
            __highlightedTheme.style.setProperty("display", "none", "");
            __highlightedTheme = null;
        }
    }

    // .............................................................................
    // popup tooltip     
    // ..............................................................................

    /**
     * Display the tooltip of an SVG shape as popup text at the mouse position.
     * To do this with delay, an execute function is called by setTimeout(...)
     * @param infoShape the SVG shape to get the 'tooltip' from (as attribute tooltip='...')
     */
    function displayTooltip(evt, infoShape) {

        if (infoShape && infoShape.nodeType == 1) {
            // read tooltip from shape
            var szText = (infoShape.getAttributeNS(szMapNs, "tooltip") || "");
            // add parents tooltips until 'g' element
            while ((infoShape = infoShape.parentNode) != null) {
                if ((infoShape.nodeName != 'g')) {
                    break;
                }
                var szXText = infoShape.getAttributeNS(szMapNs, "tooltip");
                if (szXText && szXText.length) {
                    szText = szXText;
                    //szText += (szText.length?String.fromCharCode(32,160):"") + szXText;
                }
            }
            if (szText && szText.length) {
                try {
                    szText = map.User.onTooltipDisplay(null, szText, infoShape);
                } catch (e) {}
                try {
                    szText = map.HTMLWindow.ixmaps.htmlgui_onTooltipDisplay(evt, szText);
                } catch (e) {}
                if (idTooltipTimeout) {
                    clearTimeout(idTooltipTimeout);
                }
                if (szText && szText.length) {
                    var position = map.Scale.getClientMousePosition(evt, map.SVGPopupGroup);
                    killTooltip();
                    idTooltipTimeout = setTimeout("doDisplayTooltip(\"" + __stripQuotes(szText) + "\"," + position.x + "," + position.y + ")", nTooltipTimeout);
                }
                return true;
            }
        }
        return false;
    }

    function displayTooltipText(evt, szText) {

        if (szText && szText.length) {
            var position = map.Scale.getClientMousePosition(evt, map.SVGPopupGroup);
            killTooltip();
            idTooltipTimeout = setTimeout("doDisplayTooltip('" + __stripQuotes(szText) + "'," + position.x + "," + position.y + ")", nTooltipTimeout);
        }
    }

    function __stripQuotes(szText) {

        if (!szText || !szText.length) {
            return szText;
        }
        var szTextA = szText.split('"');
        szText = szTextA[0];
        for (var i = 1; i < szTextA.length; i++) {
            szText += "``" + szTextA[i];
        }
        return szText;
    }

    function __encodeSingleQuote(szText) {

        if (!szText || !szText.length) {
            return szText;
        }
        var szTextA = szText.split('\'');
        szText = szTextA[0];
        for (var i = 1; i < szTextA.length; i++) {
            szText += "`" + szTextA[i];
        }
        return szText;
    }

    function __encodeDoubleQuotes(szText) {

        if (!szText || !szText.length) {
            return szText;
        }
        // GR 17.11.2017 encode also \" -> \\\"
        return szText.replace(/\\/gi, "\\\\").replace(/\"/gi, "\\\"");
    }

    function __decodeSingleQuote(szText) {

        if (!szText || !szText.length) {
            return szText;
        }
        var szTextA = szText.split("`");
        szText = szTextA[0];
        for (var i = 1; i < szTextA.length; i++) {
            szText += '\'' + szTextA[i];
        }
        return szText;
    }
    /**
     * Display the tooltip at delay timeout 
     * @param szText the 'tooltip' text
     * @param xPos the x position of the popup
     * @param yPos the y position of the popup
     */
    function doDisplayTooltip(szText, xPos, yPos) {

        idTooltipTimeout = null;

        if (!szText || !szText.length) {
            return;
        }
        map.SVGTltipGroup.fu.clear();
        var position = new point(xPos, yPos);
        if (szText.length) {
            szText = map.Dictionary.getLocalText(szText);
            var offset = new point(map.Scale.normalX(20), map.Scale.normalY(20));
            var newText = createTextField(map.SVGDocument, map.SVGTltipGroup, 'tooltip', szText, 16);
            newText.style.setProperty("pointer-events", "none", "");
            var textBox = map.Dom.getBox(newText);
            if (map.SVGPopupGroup.hasChildNodes) {
                position.y -= map.Scale.normalY(20);
            }
            if ((position.x + offset.x + textBox.width) > map.Scale.viewBox.width) {
                position.x -= ((position.x + offset.x + textBox.width) - map.Scale.viewBox.width);
                position.y += textBox.height;
            }
            if ((position.y + offset.y + textBox.height) > map.Scale.viewBox.height) {
                position.y -= textBox.height + offset.y * 2;
            }
            newText.fu.setPosition(position.x + offset.x, Math.max(position.y + offset.y, 100));
            map_tooltip = newText;
        }
    }

    /**
     * Clear the tooltip timeout, so a pending tooltip is not executed.
     * Called if the mouse gets 'out', or before a new tooltip is defined.
     */
    function killTooltip() {
        if (idTooltipTimeout) {
            clearTimeout(idTooltipTimeout);
        }
        if (map._tooltip) {
            map.SVGTltipGroup.fu.clear();
            map._tooltip = null;
        }
        try {
            if (map.HTMLWindow.ixmaps.htmlgui_onTooltipDelete()) {
                map.highLightList.unlock();
                map.highLightList.removeAll();
            }
        } catch (e) {}
    }

    // .............................................................................
    // dictionary      
    // ..............................................................................

    /**
     * Create a new Dictionary instance.  
     * @class It realizes local text translations
     * @constructor
     * @throws 
     * @return A new Dictionary Object
     */
    var Dictionary = function () {
        this.szDictionary = [];
    };
    // realize the dictionary here, to have it ready
    map.Dictionary = new Dictionary();

    /**
     * add a definition pair into the dictionary 
     * @param szOrig the original text
     * @param szLocal the localized text
     */
    Dictionary.prototype.add = function (szOrig, szLocal) {
        if (!this.szDictionary[szOrig]) {
            this.szDictionary[szOrig] = szLocal;
        }
    };
    /**
     * replace a definition pair in the dictionary 
     * @param szOrig the original text
     * @param szLocal the localized text
     */
    Dictionary.prototype.replace = function (szOrig, szLocal) {
        this.szDictionary[szOrig] = szLocal;
    };
    /**
     * get the local translation of an arbitrary text 
     * @param szText the source text
     * @type string
     * @return the translated text, or the original text if no translation found
     */
    Dictionary.prototype.getLocalText = function (szText) {
        try {
            if (typeof (this.szDictionary[szText]) != 'undefined') {
                return String(this.szDictionary[szText]);
            } else {
                var szDText = "";
                var szTextA = szText.split(' ');
                for (var i = 0; i < szTextA.length; i++) {
                    var szTrans = this.szDictionary["'" + szTextA[i] + "'"];
                    szDText += String(szTrans ? szTrans : szTextA[i]);
                    szDText += (i < szTextA.length - 1) ? " " : "";
                }
                return szDText;
            }
        } catch (e) {
            return szText;
        }
    };
    /**
     * translate all texts contained as childs in a given node 
     * @param nodeObj the root node to look for contained text nodes
     */
    Dictionary.prototype.applyToNode = function (nodeObj) {
        var textNodesA = nodeObj.getElementsByTagName("text");
        for (var i = 0; i < textNodesA.length; i++) {
            textNodesA.item(i).firstChild.nodeValue = this.getLocalText(textNodesA.item(i).firstChild.nodeValue);
        }
    };

    // .................................................................... 
    // display loading, waiting, ... text               
    // .................................................................... 

    // to avoid flickering of messages
    var tClearMessage = null;
    var tClearNotify = null;

    /**
     * Display the given text as message in the center of the SVG object  
     * @param szMessage		the text to display
     */
    function displayMessage(szMessage, nTimeout, fAlert) {

        if ((fAlert == "notify") && !map.fNotify) {
            return;
        }

        if ((typeof (szMessage) != 'string') || (szMessage.length === 0)) {
            map.SVGMessageGroup.fu.clear();
            return;
        }
        if (tClearMessage) {
            clearTimeout(tClearMessage);
            tClearMessage = null;
        }
        szMessage = map.Dictionary.getLocalText(szMessage);
        // use HTML messaging if possible
        //

        if ((fAlert != "notify") && (fAlert != "big")) {
            if (map.isInitializing()) {
                try {
                    map.HTMLWindow.ixmaps.htmlgui_displayInfo(szMessage);
                    return;
                } catch (e) {}
            } else {
                try {
                    if (map.HTMLWindow.ixmaps.htmlgui_isInfoDisplay()) {
                        map.HTMLWindow.ixmaps.htmlgui_displayInfo(szMessage);
                        if (nTimeout) {
                            clearMessage(nTimeout);
                        }
                        return;
                    }
                } catch (e) {}
            }
        }

        // SVG messaging 
        //
        if (fAlert == "big") {
            var fontheight = 64;
            var szTemplate = "transparent";
            var ptPos = new point(map.Scale.bBox.width / 2 + map.Scale.mapPosition.x, map.Scale.normalY(38));
        } else
        if (fAlert == "notify") {
            var fontheight = 24;
            var szTemplate = "flat";
            var ptPos = new point(map.Scale.bBox.width / 2 + map.Scale.mapPosition.x, map.Scale.mapPosition.y + (map.Scale.normalY(fontheight * 2 / 3) + map.nToolMarginTop));
        } else
        if (fAlert == "top") {
            var fontheight = 24;
            var szTemplate = "flat";
            var ptPos = new point(map.Scale.bBox.width / 2 + map.Scale.mapPosition.x, map.Scale.mapPosition.y + (map.Scale.normalY(fontheight * 2 / 3) + map.nToolMarginTop));
        } else {
            var fontheight = 36;
            var szTemplate = "flat";
            var ptPos = new point(map.Scale.bBox.width / 2 + map.Scale.mapPosition.x, map.Scale.bBox.height / 2 + map.Scale.mapPosition.y - map.Scale.normalX(fontheight / 2));
        }
        if (map.SVGDocument && map.SVGMessageGroup) {

            (fAlert == "notify") ? map.SVGNotifyGroup.fu.clear(): map.SVGMessageGroup.fu.clear();
            if (szMessage && szMessage.length) {

                var newGroup = null;

                try {
                    var textField = new TextField(null, (fAlert == "notify") ? map.SVGNotifyGroup : map.SVGMessageGroup, szTemplate, fontheight);
                    textField.setText(szMessage);
                    newGroup = textField.textGroup;
                    var bBox = newGroup.fu.getBox();
                    newGroup.fu.setPosition(ptPos.x - bBox.width / 2, ptPos.y + bBox.height / 2);
                } catch (e) {
                    newGroup = createTextField(map.SVGDocument, (fAlert == "notify") ? map.SVGNotifyGroup : map.SVGMessageGroup, "popup_message", szMessage, fontheight);
                    try {
                        var bBox = newGroup.fu.getBox();
                        newGroup.fu.setPosition(ptPos.x - bBox.width / 2, ptPos.y + bBox.height / 2);
                    } catch (e) {
                        newGroup.fu.setPosition(ptPos.x - map.Scale.normalX(50), ptPos.y + map.Scale.normalX(10));
                    }
                }
            }
        }

        if (nTimeout) {
            (fAlert == "notify") ? clearNotify(nTimeout): clearMessage(nTimeout);
        }

    }
    /**
     * Clear the message text box  
     */
    function clearMessage(nTimeout) {
        if (tClearMessage && !nTimeout) {
            return;
        }
        do_clearMessage(nTimeout || 0);
    }

    function do_clearMessage(nTimeout) {
        if (nTimeout) {
            if (tClearMessage) {
                clearTimeout(tClearMessage);
            }
            tClearMessage = setTimeout("do_clearMessage()", nTimeout);
            return;
        } else {
            try {
                map.HTMLWindow.ixmaps.htmlgui_killInfo();
            } catch (e) {}
            map.SVGMessageGroup.fu.clear();
        }
    }
    /**
     * Clear the notify text box  
     */
    function clearNotify(nTimeout) {
        if (nTimeout) {
            if (tClearNotify) {
                clearTimeout(tClearNotify);
            }
            tClearNotify = setTimeout("clearNotify()", nTimeout);
            return;
        } else {
            map.SVGNotifyGroup.fu.clear();
        }
    }
    /**
     * Display the given text as message in the center of the SVG object  
     * @param szMessage		the text to display
     */
    function displayProgressBarOld(nActual, nMaximal, szMessage, nTimeout, szCancel, nElapsedTime) {

        var fontheight = 13;
        var szTemplate = "light";
        var ptPos = new point(map.Scale.bBox.width / 2 + map.Scale.mapPosition.x, map.Scale.mapPosition.y + map.Scale.normalX((map.fMapBorder3D ? 6 : 0) + map.nToolMarginTop));

        if (map.SVGDocument && map.SVGMessageGroup) {

            if (!szMessage) {
                szMessage = "";
            }
            szMessage = map.Dictionary.getLocalText(szMessage);
            var newGroup = null;
            var workspaceNode = null;

            var textField = new TextField(null, map.SVGMessageGroup, map.fPDFEmbed ? "" : szTemplate, fontheight);
            if (textField) {
                textField.setText(szMessage);
                newGroup = textField.textGroup;
                workspaceNode = textField.workspaceNode;
            } else {
                newGroup = createTextField(map.SVGDocument, map.SVGMessageGroup, "popup_message", szMessage, 24);
                workspaceNode = newGroup;
            }

            var nBarWidth = 100;
            var nBarHeight = fontheight; // /2.4; //10;
            var nStep = nBarWidth / nMaximal;
            var nHeight = nBarHeight;
            var nXoff = szMessage.length * fontheight / 2;
            var nYoff = szMessage.length ? (-fontheight * 0.72) : 0;
            if (szMessage.length) {
                var bBox = map.Dom.getBox(workspaceNode);
                if (bBox.width) {
                    nXoff = bBox.width + 10;
                }
            }
            //var maxRect = map.Dom.newShape('rect',workspaceNode,nXoff,nYoff,nBarWidth+2,nHeight,"fill:none;stroke:none;");
            var maxRect = map.Dom.newShape('rect', workspaceNode, nXoff, nYoff, nMaximal * nStep, nHeight, "fill:none;stroke:grey;");
            var actRect = map.Dom.newShape('rect', workspaceNode, nXoff, nYoff, nActual * nStep, nHeight, "fill:#3787D7;stroke:none;");

            if (szCancel) {
                var buttonObj = new Button(workspaceNode, "", "BUTTON", '#delete_button', szCancel, "", "cancel operation");
                buttonObj.scale(1 / map.Scale.normalX(1), 1 / map.Scale.normalY(1));
                buttonObj.setPosition(nXoff + nBarWidth + 20, -3);
            }

            if (nElapsedTime && nActual) {
                var szText = map.Dictionary.getLocalText("done") + " " + nActual +
                    " " + map.Dictionary.getLocalText("/") + " " + nMaximal +
                    " " + map.Dictionary.getLocalText("in") + " " + __formatTime(nElapsedTime) +
                    " ";
                szText += map.Dictionary.getLocalText("estimated time left") + ": " + __formatTime((nElapsedTime / nActual * nMaximal) - nElapsedTime);
                var newText = map.Dom.newText(workspaceNode, 0, fontheight * 1.2, "font-family:arial;font-size:" + fontheight + "px;fill:gray;", szText);
            }

            if (textField) {
                textField.resizeField();
            }
            try {
                var bBox = newGroup.fu.getBox();
                newGroup.fu.setPosition(ptPos.x - bBox.width / 2, ptPos.y + map.Scale.normalY(fontheight * 1.3));
            } catch (e) {}
        }

        if (nTimeout) {
            clearMessage(nTimeout);
        }
    }
    /**
     * Display the given text as message in the center of the SVG object  
     * @param szMessage		the text to display
     */
    function displayProgressBar(nActual, nMaximal, szMessage, nTimeout, szCancel, nElapsedTime) {

        if (map.SVGDocument && map.SVGMessageGroup) {

            var barGroup = map.Dom.newGroup(map.SVGMessageGroup, "popup_progressbar");
            barGroup.fu.setPosition(0, 0);
            barGroup.fu.scale(20, 20);

            var nBarWidth = map.SVGWidth;
            var nBarHeight = 1.5; // /2.4; //10;
            var nStep = nBarWidth / nMaximal;
            var nHeight = nBarHeight;

            var actRect = map.Dom.newShape('rect', barGroup, 0, 0, nActual * nStep, nHeight, "fill:#3787D7;stroke:none;");

        }

        if (nTimeout) {
            clearMessage(nTimeout);
        }
    }
    /**
     * Display the given text as Debug Output in the left upper corner  
     * @param szMessage		the text to display
     */
    var debugLine = 0;
    var lastDate = new Date();

    function _TRACE(szMessage) {

        if (typeof (console) != "undefined" && typeof (console.log) != "undefined") {
            var x = new Date();
            var time = x - lastDate;
            lastDate = x;
            console.log("_TRACE: time[" + time + "] " + szMessage);
            return;
        }

        if (map.fPDFEmbed) {
            if (!map.fDebug) {
                return;
            }
        }

        try {
            TRACE(szMessage);
        } catch (e) {
            if (map.fDebug) {
                var fontHeight = 12;
                try {
                    if (map.SVGDocument && map.SVGMenuGroup) {

                        var newGroup = createTextField(map.SVGDocument, map.SVGMenuGroup, 'message', szMessage);
                        newGroup.fu.setPosition(map.Scale.normalX(0), map.Scale.normalY(debugLine * (fontHeight + 6)));
                        if (++debugLine > 20) {
                            debugLine = 0;
                            map.SVGMenuGroup.fu.clear();
                        }
                    }
                } catch (e) {}
            }
        }
    }
    /**
     * console log with time stamp of the givven text   
     * @param szMessage	the text to display
     */
    function _LOG(szMessage) {

        if (typeof (console) != "undefined" && typeof (console.log) != "undefined") {
            var x = new Date();
            var time = x.getMinutes() + ":" + String(x.getSeconds()) + "." + String(x.getMilliseconds());
            console.log("_LOG: time[" + time + "] " + szMessage);
            return;
        }
    }
    /**
     * Display the given text as status line output in the defined SVG group "legend:statusgroup"  
     * @param szMessage		the text to display
     */
    function _STATUS(szMessage) {
        if (!map.fStatus) {
            return;
        }
        var statusGroup = map.Dom.getObjectById("legend:statusgroup");
        if (!statusGroup) {
            var scaleGroup = map.Dom.getObjectById("legend:scalegroup");
            statusGroup = map.Dom.newGroup(scaleGroup, "legend:statusgroup");
        }
        map.Dom.clearGroup(statusGroup);
        var fontheight = 12;
        var newText = map.Dom.newText(statusGroup, map.Scale.normalX(220), map.Scale.normalY(fontheight), "font-family:arial;font-size:" + map.Scale.normalY(fontheight) + "px;fill:black", szMessage);
        return;
    }

    /**
     * Display the given text as Debug Output in the left upper corner  
     * @param szMessage		the text to display
     */
    function _INFO(szMessage) {

        try {
            map.HTMLWindow.ixmaps.htmlgui_displayInfo(szMessage);
        } catch (e) {
            if (map.fDebug) {
                var fontheight = 12;
                if (map.SVGDocument && map.SVGMessageGroup) {
                    var newGroup = createTextField(map.SVGDocument, map.SVGMessageGroup, 'message', szMessage);
                    newGroup.fu.setPosition(map.Scale.normalX(0), map.Scale.normalY(0));
                }
            }
        }
    }

    function _KILLINFO() {
        try {
            map.HTMLWindow.ixmaps.htmlgui_killInfo();
        } catch (e) {}
    }
    /**
     * Display the given text as Debug Error Output
     * @param szMessage		the text to display
     */
    function _ERROR(szMessage) {
        try {
            map.HTMLWindow.ixmaps.htmlgui_errorLog(szMessage);
        } catch (e) {
            if (map.fDebug) {
                var fontheight = 12;
                if (map.SVGDocument && map.SVGMessageGroup) {
                    var newGroup = createTextField(map.SVGDocument, map.SVGMessageGroup, 'message', szMessage);
                    newGroup.fu.setPosition(map.Scale.normalX(0), map.Scale.normalY(0));
                }
            }
        }
    }


    // .................................................................... 
    // display popup text               
    // .................................................................... 

    var __textField_group = null;
    var __textField_frame = null;
    var __textField_shadow = null;
    var __textField_fontheight = 12;
    /**
     * Display the given text with autosizing background and shadow  
     * @param SVGDocument		the target document
     * @param SVGTargetGroup	the target group
     * @param szId				give the new element this id
     * @param szText			the text to display
     */
    function createTextField(SVGDocument, SVGTargetGroup, szId, szText, fontheight) {
        if (!fontheight) {
            fontheight = 12;
        }
        if (SVGDocument && SVGTargetGroup) {
            var newGroup = map.Dom.newGroup(SVGTargetGroup, szId);
            var newShadow = map.Dom.newShape('rect', newGroup, 1, 1, 1, 1, "fill:#aaaaaa;opacity:0.5;stroke:none");
            var newRect = map.Dom.newShape('rect', newGroup, 1, 1, 1, 1, "fill:#fefeff;stroke:#aaaaaa;stroke-width:" + map.Scale.normalX(0.2) + "");
            var newText = map.Dom.newText(newGroup, 0, map.Scale.normalY(fontheight * 1.25), "font-family:arial;font-size:" + map.Scale.normalY(fontheight) + "px;fill:" + map.szInfoBodyColor + "", szText);

            __textField_group = newGroup;
            __textField_frame = newRect;
            __textField_shadow = newShadow;
            __textField_fontheight = fontheight;

            sizeTextField();

            return newGroup;
        }
    }

    function sizeTextField() {
        var fontheight = __textField_fontheight;
        var bBox = map.Dom.getBox(__textField_group);
        __textField_frame.setAttributeNS(null, "rx", map.Scale.normalX(4));
        __textField_frame.setAttributeNS(null, "ry", map.Scale.normalX(4));
        __textField_frame.setAttributeNS(null, "x", -map.Scale.normalX(fontheight * 0.75));
        __textField_frame.setAttributeNS(null, "y", -map.Scale.normalY(1));
        __textField_frame.setAttributeNS(null, "width", bBox.width + map.Scale.normalX(fontheight * 1.5));
        __textField_frame.setAttributeNS(null, "height", bBox.height + map.Scale.normalY(fontheight) / 2);

        __textField_shadow.setAttributeNS(null, "rx", map.Scale.normalX(4));
        __textField_shadow.setAttributeNS(null, "ry", map.Scale.normalX(4));
        __textField_shadow.setAttributeNS(null, "x", -map.Scale.normalX(fontheight * 0.75) + map.Scale.normalX(1));
        __textField_shadow.setAttributeNS(null, "y", map.Scale.normalY(1));
        __textField_shadow.setAttributeNS(null, "width", bBox.width + map.Scale.normalX(fontheight * 1.5) + map.Scale.normalX(1.5));
        __textField_shadow.setAttributeNS(null, "height", bBox.height + map.Scale.normalX(fontheight) / 2 - map.Scale.normalX(0));
        return;
    }


    /*
    @ -----------------------------------------------------------------------------
    @ H e l p e r 
    @ -----------------------------------------------------------------------------
    */
    function executeWithMessage(szFu, szMessage, nTimeout) {
        if (typeof (nTimeout) == "undefined") {
            nTimeout = 250;
        }
        
        if (map.fExecuteSilent) {
            if (typeof szFu === 'function') {
                setTimeout(function() { doExecuteWithMessage(szFu); }, nTimeout);
            } else {
                setTimeout("doExecuteWithMessage(\"" + __encodeDoubleQuotes(szFu) + "\")", nTimeout);
            }
            return;
        }

        // GR 18.06.2014 displayMessage with 3. parameter true -> alert style -> centered
        displayMessage(szMessage, null, map.szMessagePosition);
        
        if (typeof szFu === 'function') {
            setTimeout(function() { doExecuteWithMessage(szFu); }, nTimeout);
        } else {
            console.warn("executeWithMessage: String-based execution is deprecated. Please pass a function.");
            setTimeout("doExecuteWithMessage(\"" + __encodeDoubleQuotes(szFu) + "\")", nTimeout);
        }
    }

    function doExecuteWithMessage(szFu) {

        if (map.isIdle()) {
            //clearMessage(250);
        }
        // GR 26.07.2017 lets try without
        // setTimeout("map.SVGMessageGroup.fu.clear()",500);

        try {
            if (typeof szFu === 'function') {
                szFu();
            } else {
                console.warn("doExecuteWithMessage: Executing string via eval. This is unsafe. Please pass a function.");
                eval(szFu);
            }
        } catch (e) {
            alert("error '" + e + "' on: " + szFu);
        }

    }

    function executeWithProgressBar(szFu, nActual, nMaximal, szMessage, szCancel, nElapsedTime) {
        displayProgressBar(nActual, nMaximal, szMessage, 0, szCancel, nElapsedTime);
        setTimeout(szFu, 1);
    }

    function __doGetPolygonSurface(ptList, fWidget) {
        for (var a in ptList) {
            if (fWidget) {
                // get lan lon coordinates
                var mapPos = map.Scale.getMapPosition(ptList[a].x, ptList[a].y);
                var mapCoord = map.Scale.getMapCoordinate(mapPos.x, mapPos.y);
                mapCoord = map.Scale.getGeoCoordinateOfPoint(mapCoord.x, mapCoord.y);
                // aprossimativo ??
                mapCoord = _LLtoUTM("WGS84", mapCoord.y, mapCoord.x);
            } else {
                var mapCoord = map.Scale.getMapCoordinateUTM(ptList[a].x, ptList[a].y);
            }
            ptList[a].x = mapCoord.x;
            ptList[a].y = mapCoord.y;
        }
        var nArea = 0;
        var nCalc = 0;
        ptList[ptList.length] = ptList[0];
        for (var i = 0; i < ptList.length - 1; i++) {
            nCalc = ((ptList[i].x * ptList[i + 1].y) - (ptList[i + 1].x * ptList[i].y));
            nArea += nCalc;
        }
        return (nArea /= 2);
    }

    function __doGetPolygonCenter(ptList) {
        var ptCenter = new point(0, 0);
        for (var a in ptList) {
            ptCenter.x += ptList[a].x;
            ptCenter.y += ptList[a].y;
        }
        ptCenter.x /= ptList.length;
        ptCenter.y /= ptList.length;
        return (ptCenter);
    }

    /**
     * transform a style string: name:value;name:value ... into an object
     * @param szStyle the style string
     * @return an object of the kind: object.name = value
     */
    function __getStyleObj(szStyle) {
        if (szStyle === null || szStyle.length < 2) {
            return null;
        }
        try {
            map.styleObj = {};
            var szPartsA = szStyle.split(';');
            for (var i = 0; i < szPartsA.length; i++) {
                if (szPartsA[i].length) {
                    var szPartA = szPartsA[i].split(':');
                    var nPLen = szPartA[0].length + 1;
                    var szValue = szPartsA[i].substr(nPLen, szPartsA[i].length - nPLen);
                    try {
                        map.styleObj[szPartA[0].trim()] = JSON.parse(szValue);
                    } catch (e) {
                        map.styleObj[szPartA[0].trim()] = szValue;
                    }
                }
            }
            return map.styleObj;
        } catch (e) {
            alert("ERROR parsing: " + szStyle);
        }
        return null;
    }
    /**
     * transform a style string: name:value;name:value ... into a named array
     * @param szStyle the style string
     * @return an object of the kind: object.name = value
     */
    function __getStyleArray(szStyle) {
        if (typeof (szStyle) == "undefined" || szStyle == null || szStyle.length < 2) {
            return null;
        }
        try {
            var styleA = new Array(0);
            var szPartsA = szStyle.split(';');
            for (var i = 0; i < szPartsA.length; i++) {
                if (szPartsA[i].length) {
                    var szPartA = szPartsA[i].split(':');
                    styleA[szPartA[0]] = szPartA[1];
                }
            }
            return styleA;
        } catch (e) {
            alert("ERROR parsing: " + szStyle);
        }
        return null;
    }
    /**
     * sets the timer to zero
     */
    var __timer_nMillisec = 0;

    function __timer_reset() {
        var jetzt = new Date();
        __timer_nMillisec = jetzt.getTime();
    }
    /**
     * gets the elapsed time (in ms)
     */
    function __timer_getMS() {
        var jetzt = new Date();
        var nActMilli = jetzt.getTime();
        return (nActMilli - __timer_nMillisec);
    }
    /**
     * gets the elapsed time (in ms)
     */
    function __timer_getSEC() {
        var jetzt = new Date();
        var nActMilli = jetzt.getTime();
        return (nActMilli - __timer_nMillisec) / 1000;
    }
    /**
     * convert a number of seconds into a formatted string like "4 hr 3 min 25 sec"
     * @param nValue the time in seconds to format
     * @type string
     * @return the formatted time as string
     */
    function __formatTime(nValue) {
        var nHour = Math.floor(nValue / 3600);
        nValue -= nHour * 3600;
        var nMin = Math.floor(nValue / 60);
        nValue -= nMin * 60;
        if (nHour) {
            return String(nHour + " hr " + nMin + " min " + Math.floor(nValue) + " sec");
        } else if (nMin) {
            return String(nMin + " min " + Math.floor(nValue) + " sec");
        } else {
            return String(Math.floor(nValue) + " sec");
        }
    }
    /**
     * convert a number into a formatted string; if the number > 1000 it will be formatted like 1.023.234 
     * @param nValue the number to format
     * @param nPrecision the wanted decimal points 
     * @param szFlag "CEIL" or "FLOOR" (round either up or down)
     */
    function __formatValue(nValue, nPrecision, szFlag) {

        nValue = Number(nValue);

        if (!isFinite(nValue) || !isFinite(nPrecision)) {
            return String(nValue);
        }
        if (nValue === 0) {
            return String(nValue);
        }
        if (nValue > 1000000000000) {
            return String(nValue);
        }
        if (nValue < -1000000000000) {
            return String(nValue);
        }

        if (!map.fDecimalPointComma) {
            szFlag += "|BLANK";
        }

        if (!nPrecision) {
            nPrecision = 0;
        }
        nPrecision = Math.max(0, nPrecision);

        // GR 02.12.2011 make that low values do not collapse to 0
        if ((nValue > 0.0000001) && (nPrecision > 0)) {
            while (nValue.toFixed(nPrecision) === 0) {
                nPrecision++;
            }
        }

        // GR 11.03.2009 fix precision before CEIL or FLOOR to avoid JS errors eg. 0.0000000000003
        nValue = nValue.toFixed(nPrecision + 1);

        var nClipDecimal = Math.pow(10, nPrecision);
        if (szFlag && szFlag.match(/CEIL/)) {
            nValue = Math.ceil(nValue * nClipDecimal) / nClipDecimal;
        } else
        if (szFlag && szFlag.match(/FLOOR/)) {
            nValue = Math.floor(nValue * nClipDecimal) / nClipDecimal;
        } else {
            nValue = Math.round(nValue * nClipDecimal) / nClipDecimal;
        }

        var szDecimals = String(nValue);
        if (szDecimals.match(/\./)) {
            szDecimals = szDecimals.split(".")[1];
        } else {
            szDecimals = "";
        }
        while (szDecimals.length < nPrecision) {
            szDecimals += '0';
        }
        var szReturn = nValue < 0 ? "-" : "";
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
                        szBreak = " ";
                    } else {
                        szBreak = ".";
                    }
                }
                szReturn += szBreak;
            }

            szReturn += __maptheme_formatpart(nValue, szLeading);

            if (!szReturn.length || (szReturn == "-")) {
                szReturn += "0";
            }

            //if ( szDecimals.length && szDecimals != "00" ){
            if (szDecimals.length) {
                szReturn += ((szFlag && szFlag.match(/BLANK/)) ? "." : ",") + szDecimals;
            }
        }
        return szReturn;
    }
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
        if (nPart === 0) {
            szPart += szLeading;
        } else {
            szPart += String(nPart);
        }
        return szPart;
    }

    /*
    @ -----------------------------------------------------------------------------
    @ S V G   f r a g m e n t s   l o a d i n g
    @ -----------------------------------------------------------------------------
    */

    /**
     * Create a new SVGLoader instance.  
     * @class A loader can import SVG files to the current SVG document
     * @constructor
     * @throws 
     * @return A new SVGLoader
     */
    function SVGLoader() {

        this.szUrlA = new Array(0);
        this.stackA = new Array(0);
        this.nPending = 0;

        /**
         * Import a SVG file containing a map tile to a specified group of the given document<br>  
         * Stacks the import, is fLoadTilesMulti is false
         * @param  szUrl
         * @param  svgDocument the target SVG document
         * @param  targetGroup the target SVG group; content of the loaded document will be added as a new child to this group
         * @param  callback optional function to be called on succeed
         */
        this.importSVGFile = function (szUrl, svgDocument, targetGroup, callback) {


            if (this.szUrlA[szUrl] == targetGroup) {
                return false;
            }
            this.doImportSVGFile(szUrl, svgDocument, targetGroup, callback);
        };
        /**
         * stack one tile import information (clled when no multi import allowed)
         * @param  szUrl
         * @param  svgDocument the target SVG document
         * @param  targetGroup the target SVG group; content of the loaded document will be added as a new child to this group
         * @param  callback optional function to be called on succeed
         */
        this.push = function (szUrl, svgDocument, targetGroup, callback) {
            this.stackA.push({
                szUrl: szUrl,
                svgDocument: svgDocument,
                targetGroup: targetGroup,
                callback: callback
            });
        };
        /**
         * unstack one tile import information<br>
         * calls .doImportSVGFile(...) method if there is a stacked tile to import
         */
        this.pop = function () {
            if (!this.isWaiting()) {
                var nextTile = this.stackA.shift();
                if (nextTile) {
                    this.doImportSVGFile(nextTile.szUrl, nextTile.svgDocument, nextTile.targetGroup, nextTile.callback);
                }
            }
        };
        /**
         * Import a SVG file to a specified group of the given document  
         * @param  szUrl
         * @param  svgDocument the target SVG document
         * @param  targetGroup the target SVG group; content of the loaded document will be added as a new child to this group
         * @param  callback optional function to be called on succeed
         */
        this.doImportSVGFile = function (szUrl, svgDocument, targetGroup, callback) {
            this.nPending++;

            function CallbackHandler(parent) {
                this.parent = parent;
            }
            CallbackHandler.prototype.operationComplete = function (status, xmlObject, szText) {
                this.parent.nPending--;
                this.parent.pop();
                if (xmlObject && status == 200) {
                    this.processImported(xmlObject.documentElement);
                    _LOG("SVGLoader: " + szUrl + " (loaded)");
                }
            };
            CallbackHandler.prototype.processImported = function (d) {
                /** GR 01.09.2019 not necessary
                try{
                	d = map.SVGDocument.importNode(d, true);
                }
                catch (e){
                }
                **/
                if (szUrl.match(/widget/)) {
                    // check for already defined templates, and remove them
                    var idA = map.Dom.getAllIds(d);
                    for (var i = 0; i < idA.length; i++) {
                        var isObj = map.SVGDocument.getElementById(idA[i]);
                        if (isObj) {
                            isObj.parentNode.removeChild(isObj);
                        }
                    }
                }
                if (szUrl.match(/pattern/)) {
                    targetGroup = map.Dom.newGroup(targetGroup, String(Math.random()));
                }

                targetGroup.appendChild(d);

                if (this.initMenu(targetGroup)) {
                    return;
                }
                this.initCSS(targetGroup);

                this.initScripts(targetGroup);

                if (szUrl.match(/widget/)) {
                    this.initToolbar(targetGroup);
                }

                if (szUrl.match(/logo/)) {
                    this.initLogo(targetGroup);
                }

                this.loadScripts(targetGroup);
                try {
                    map.antiZoomAndPanList.initAntiZoomPattern(null, targetGroup);
                    map.Layer.initPatternScaling(null, targetGroup);
                } catch (e) {}
                // normalize symbol center to 0,0 
                if (szUrl.match(/symbol/)) {
                    map.Scale.normalizeSymbols(targetGroup);
                }
                // normalize buttons center to 0,0 
                if (szUrl.match(/widget/)) {
                    map.Scale.normalizeButtons(targetGroup);
                }
            };
            CallbackHandler.prototype.initMenu = function (targetGroup) {
                var menuObjectsA = targetGroup.getElementsByTagName('menu');
                if (menuObjectsA.length) {
                    // remove older menu entries
                    for (var i = 0; i < menuObjectsA.length; i++) {
                        var szId = menuObjectsA.item(i).getAttributeNS(null, "id");
                        var firstObj = map.SVGDocument.getElementById(szId);
                        if (firstObj && (firstObj != menuObjectsA.item(i))) {
                            firstObj.parentNode.removeChild(firstObj);
                            i--;
                        }
                    }
                    return true;
                }
                return false;
            };
            CallbackHandler.prototype.initToolbar = function (targetGroup) {
                try {
                    map.Toolbar.init();
                    map.Legend.init();
                } catch (e) {}
                return true;
            };
            CallbackHandler.prototype.initLogo = function (targetGroup) {
                var logoGroup = map.SVGDocument.getElementById("mapbackground:logo");
                if (logoGroup === null) {
                    logoGroup = map.Dom.newGroup(map.SVGDocument.getElementById("mapbackground"), "mapbackground:logo");
                }
                if (logoGroup) {
                    map.Dom.clearGroup(logoGroup);
                    var svgNodesA = targetGroup.getElementsByTagName('svg');
                    var childNodesA = svgNodesA.item(0).childNodes;
                    for (var i = 0; i < childNodesA.length; i++) {
                        logoGroup.appendChild(childNodesA.item(i));
                        i--;
                    }
                }
                return true;
            };
            CallbackHandler.prototype.loadScripts = function (targetGroup) {
                var scriptObjectA = targetGroup.getElementsByTagName('script');
                for (var i = 0; i < scriptObjectA.length; i++) {
                    var szScript = scriptObjectA.item(i).getAttributeNS(szXlink, 'href');
                    if (szScript && szScript.length) {
                        var jsLoader = new JSLoader();
                        jsLoader.loadScript(szScript);
                    }
                }
                return true;
            };
            CallbackHandler.prototype.initScripts = function (targetGroup) {
                var scriptObjectA = targetGroup.getElementsByTagName('script');
                for (var i = 0; i < scriptObjectA.length; i++) {
                    if (scriptObjectA.item(i).firstChild) {
                        var szScript = scriptObjectA.item(i).firstChild.nodeValue;
                        try {
                            eval(szScript);
                        } catch (e) {
                            _LOG("ERROR: could not eval loaded script!");
                        }
                    }
                }
                return true;
            };
            CallbackHandler.prototype.initCSS = function (targetGroup) {
                var cssStylesA = targetGroup.getElementsByTagName("style");
                if (cssStylesA.length) {
                    var cssStyleNode = map.SVGDocument.getElementById("mapstyles");
                    return true;
                }
                return false;
            };

            if (szUrl.length > 0) {
                getData(szUrl, new CallbackHandler(this));
            }
        };
        /**
         * tell the number of pending tiles (svg fragments)  
         * @return number of asynchronous data loads still pending
         */
        this.isWaiting = function () {
            return this.nPending;
        };
    }

    /**
     * Import all SVG files referenced by include statements.
     * Includes are defined by SVG groups with an 'xlink:href' which
     * must! be inside the one and only! <g> with  id='mapinclude' 
     * @param  evt the event
     */

    function loadSVGIncludes(evt, szPath, szFile) {
        
        alert("ohhh");


        var SVGDoc = evt ? evt.target.ownerDocument : map.SVGDocument;
        var includeGroup = SVGDoc.getElementById("mapinclude");
        if (includeGroup) {

            if (szPath && szPath.length > 1) {
                var lastChar = szPath.substr(szPath.length - 1, 1);
                if (lastChar != '\\' && lastChar != '/') {
                    szPath += '/';
                }
            }
            var includeA = includeGroup.getElementsByTagName("g");
            for (var i = 0; i < includeA.length; i++) {
                var includeNode = includeA.item(i);
                var szUrl = includeNode.getAttribute("xlink:href");
                // maplocal is loaded explizit (see init)
                if (!szUrl || szUrl.match(/maplocal/)) {
                    continue;
                }
                if (szUrl.match(/mapmenu/)) {
                    continue;
                }
                if (szUrl.match(/mapimages/)) {
                    continue;
                }
                if (szUrl.match(/mappattern/)) {
                    continue;
                }
                if (szUrl.match(/mapfilter/)) {
                    continue;
                }
                if (szUrl && szUrl.length > 1 && (!szFile || (szUrl == szFile))) {
                    szUrl = szPath + szUrl;
                    var xLoader = new SVGLoader();
                    map.Loader.importSVGFile(szUrl, SVGDoc, includeNode, null);
                }
            }
        }
    }

    /*
    @ -----------------------------------------------------------------------------
    @ T i l e s   l o a d i n g
    @ -----------------------------------------------------------------------------
    */
    /**
     * Create a new SVGLoaderTiles instance.  
     * @class A loader to import SVG files representing map tiles into the current SVG document
     * @constructor
     * @throws 
     * @return A new SVGLoaderTiles
     */
    var __svgLoaderTiles = null;

    function SVGLoaderTiles() {
        this.szUrlA = new Array(0);
        this.stackA = new Array(0);
        this.nPending = 0;
        this.nRequest = 0;
        this.nToLoad = 0;
        __svgLoaderTiles = this;

        /**
         * Import a SVG file containing a map tile to a specified group of the given document<br>  
         * Stacks the import, is fLoadTilesMulti is false
         * @param  szUrl the URL of the SVG file
         * @param  svgDocument the target SVG document
         * @param  targetGroup the target SVG group; content of the loaded document will be added as a new child to this group
         * @param  callback optional function to be called on succeed
         */
        this.importSVGFile = function (szUrl, svgDocument, targetGroup, callback) {

            szUrl = (map.mapRoot || "") + szUrl;

            if (this.szUrlA[szUrl] == targetGroup) {
                return false;
            }
            this.nRequest++;
            this.nToLoad++;
            // silent
            if (map.fLoadingSilent) {
                this.doImportSVGFile(szUrl, svgDocument, targetGroup, callback);
            }
            // show progress bar
            else
            if (!map.fLoadMultiTiles && this.isWaiting()) {
                this.push(szUrl, svgDocument, targetGroup, callback);
            } else {
                displayProgressBar(0, 1, map.Dictionary.getLocalText("loading map elements"));
                this.push(szUrl, svgDocument, targetGroup, callback);
                setTimeout("__svgLoaderTiles.pop()", 10);
            }
            return true;
        };
        /**
         * stack one tile import information (called when no multi import allowed)
         * @param  szUrl the URL of the SVG file
         * @param  svgDocument the target SVG document
         * @param  targetGroup the target SVG group; content of the loaded document will be added as a new child to this group
         * @param  callback optional function to be called on succeed
         */
        this.push = function (szUrl, svgDocument, targetGroup, callback) {
            if (!this.isStacked(szUrl, svgDocument, targetGroup)) {
                this.stackA.push({
                    szUrl: szUrl,
                    svgDocument: svgDocument,
                    targetGroup: targetGroup,
                    callback: callback
                });
            }
        };
        /**
         * unstack one tile import information<br>
         * calls .doImportSVGFile(...) method if there is a stacked tile to import
         */
        this.pop = function () {
            if (!this.isWaiting()) {
                var nextTile = this.stackA.shift();
                if (nextTile) {
                    displayProgressBar(this.nToLoad - this.nPending - this.stackA.length, this.nToLoad, map.Dictionary.getLocalText("loading map elements"));
                    this.doImportSVGFile(nextTile.szUrl, nextTile.svgDocument, nextTile.targetGroup, nextTile.callback);
                } else {
                    this.nRequest = 0;
                    this.nToLoad = 0;
                    //clearMessage();
                }
            }
        };
        /**
         * check if szUrl is waiting in stack
         * @param  szUrl the URL of the SVG file
         * @param  svgDocument the target SVG document
         * @param  targetGroup the target SVG group; content of the loaded document will be added as a new child to this group
         */
        this.isStacked = function (szUrl, svgDocument, targetGroup) {
            for (var i = 0; i < this.stackA.length; i++) {
                if (this.stackA[i].szUrl == szUrl) {
                    if (this.stackA[i].svgDocument == svgDocument &&
                        this.stackA[i].targetGroup == targetGroup) {
                        return true;
                    }
                }
            }
            return false;
        };
        /**
         * check if any URL is waiting in stack
         */
        this.isAnyStacked = function () {
            return (this.stackA.length);
        };
        /**
         * executes the Import a SVG file containing a map tile to a specified group of the given document  
         * does some map scale and layer on/off adapting on the loaded fragment
         * @param  szUrl the URL of the SVG file
         * @param  svgDocument the target SVG document
         * @param  targetGroup the target SVG group; content of the loaded document will be added as a new child to this group
         * @param  callback optional function to be called on succeed
         */
        this.doImportSVGFile = function (szUrl, svgDocument, targetGroup, callback) {
            // check if loading in process
            if (this.szUrlA[szUrl] == targetGroup) {
                return false;
            }
            this.szUrlA[szUrl] = targetGroup;
            this.nPending++;

            function CallbackHandler(parent) {
                this.parent = parent;
            }
            CallbackHandler.prototype.operationComplete = function (status, xmlObject, szText) {
                this.parent.szUrlA[szUrl] = null;
                this.parent.nPending--;
                this.parent.nRequest--;
                if (xmlObject && (status == 200)) {
                    this.processImported(xmlObject.documentElement);
                }
                this.parent.pop();
            };
            CallbackHandler.prototype.processImported = function (d) {

                if (targetGroup.childNodes.length) {
                    _STATUS("Tiling: doppio tile !!!");
                    return;
                }
                /** GR 01.09.2019 not necessary
                try{
                	d = map.SVGDocument.importNode(d, true);
                }
                catch (e){
                }
                **/
                targetGroup.appendChild(d);

                // report state (ddebug)
                // ------------

                if (map && map.Layer) {
                    // switch layer
                    for (var a in map.Layer.listA) {
                        var layerItem = map.Layer.listA[a];
                        if (typeof (layerItem.nState) != "undefined") {
                            var szTile = targetGroup.getAttributeNS(null, "id");
                            var szTheme = layerItem.szName + "#" + szTile.substr(szTile.length - 6, 6);
                            map.Layer.switchLayerByFeature(szTheme, layerItem.nState);
                        }
                        // switch sublayer (categories)
                        for (var c in layerItem.categoryA) {
                            var szTile = targetGroup.getAttributeNS(null, "id");
                            var szTheme = layerItem.szName + "#" + szTile.substr(szTile.length - 6, 6) + "::" + c;
                            map.Layer.switchLayerByFeature(szTheme, layerItem.categoryA[c].display == 'inline');
                        }
                    }
                    if (!map.fSwitchByCSS || !map.Scale.CSSStyleNodes) {
                        map.Layer.switchScaleDependentLayer(null, targetGroup);
                    }
                }

                if (map && map.Zoom) {
                    if (map.Zoom.nZoom != 1) {
                        var nodeA = null;
                        // adapt styles to scaling --------------------------------------
                        nodeA = targetGroup.getElementsByTagName('g');
                        for (var n = 0; n < nodeA.length; n++) {
                            var szStyle = nodeA.item(n).getAttributeNS(null, "style");
                            if (szStyle && szStyle.length) {
                                var szNewStylesValue = __scaleStyleString(szStyle, map.Layer.nFeatureScale * map.Scale.nLineScaling);
                                nodeA.item(n).setAttributeNS(null, "style", szNewStylesValue);
                                targetGroup.setAttributeNS(szMapNs, "deltaTBD", "1");
                                // GR 27.06.2014
                                targetGroup.setAttributeNS(szMapNs, "scale", String(map.Layer.nFeatureScale * map.Scale.nLineScaling));
                            }
                            var childA = nodeA.item(n).childNodes;
                            for (c = 0; c < childA.length; c++) {
                                if (childA.item(c).nodeName == "text") {
                                    var szStyle = childA.item(c).getAttributeNS(null, "style");
                                    if (szStyle && szStyle.length) {
                                        szNewStylesValue = __scaleStyleString(szStyle, map.Layer.nFeatureScale * map.Scale.nLabelScaling);
                                        childA.item(c).setAttributeNS(null, "style", szNewStylesValue);
                                    }
                                }
                            }
                        }

                        map.Layer.scaleTextOffsets(targetGroup, 1 / map.Zoom.nZoomX, 1 / map.Zoom.nZoomY, true);
                    }
                    map.Layer.adaptLabel(null, targetGroup);
                }

                if (map && map.Themes) {
                    // build node cache --------------------------------------
                    map.Themes.addToThemeNodesCache(targetGroup);
                    // all tiles loaded, actualize themes --------------------
                    if ((this.parent.nPending + this.parent.stackA.length) === 0) {
                        map.Themes.actualizeActiveTheme(true);
                    }
                }
            };
            if (szUrl.length > 0) {
                getData(szUrl, new CallbackHandler(this));
                return true;
            }
            return false;
        };
        /**
         * tell the number of pending tiles (svg fragments)  
         * @return number of asynchronous data loads still pending
         */
        this.isWaiting = function () {
            return this.nPending;
        };
        /**
         * tell the number of pending tiles (svg fragments)  
         * @return number of asynchronous data loads still pending
         */
        this.isLoading = function () {
            return (this.nPending | this.isAnyStacked());
        };
    }
    /*
    @ -----------------------------------------------------------------------------
    @ M A P   l o a d i n g
    @ -----------------------------------------------------------------------------
    */
    /**
     * Create a new SVGLoaderMap instance.  
     * @class A loader to import complete SVG maps into the current SVG document
     * @constructor
     * @throws 
     * @return A new SVGLoaderMap
     */
    var __svgLoaderMap = null;

    function SVGLoaderMap() {
        this.szUrlA = new Array(0);
        this.stackA = new Array(0);
        this.nPending = 0;
        this.nRequest = 0;
        this.nToLoad = 0;
        __svgLoaderMap = this;

        /**
         * Import a SVG file containing a map tile to a specified group of the given document<br>  
         * Stacks the import, is fLoadTilesMulti is false
         * @param  szUrl the URL of the SVG file
         * @param  svgDocument the target SVG document
         * @param  targetGroup the target SVG group; content of the loaded document will be added as a new child to this group
         * @param  callback optional function to be called on succeed
         */
        this.importSVGFile = function (szUrl, svgDocument, targetGroup, callback) {

            if (targetGroup && (this.szUrlA[szUrl] == targetGroup)) {
                return false;
            }
            this.nRequest++;
            this.nToLoad++;
            // silent
            if (map.fLoadingSilent) {
                this.doImportSVGFile(szUrl, svgDocument, targetGroup, callback);
            }
            // show progress bar
            else
            if (!map.fLoadMultiTiles && this.isWaiting()) {
                this.push(szUrl, svgDocument, targetGroup, callback);
            } else {
                displayMessage(map.Dictionary.getLocalText("loading map"));
                displayProgressBar(0, 1, map.Dictionary.getLocalText("loading map"));
                this.push(szUrl, svgDocument, targetGroup, callback);
                setTimeout("__svgLoaderMap.pop()", 10);
            }
            return true;
        };
        /**
         * stack one tile import information (called when no multi import allowed)
         * @param  szUrl the URL of the SVG file
         * @param  svgDocument the target SVG document
         * @param  targetGroup the target SVG group; content of the loaded document will be added as a new child to this group
         * @param  callback optional function to be called on succeed
         */
        this.push = function (szUrl, svgDocument, targetGroup, callback) {
            if (!this.isStacked(szUrl, svgDocument, targetGroup)) {
                this.stackA.push({
                    szUrl: szUrl,
                    svgDocument: svgDocument,
                    targetGroup: targetGroup,
                    callback: callback
                });
            }
        };
        /**
         * unstack one tile import information<br>
         * calls .doImportSVGFile(...) method if there is a stacked tile to import
         */
        this.pop = function () {
            if (!this.isWaiting()) {
                var nextTile = this.stackA.shift();
                if (nextTile) {
                    displayProgressBar(this.nToLoad - this.nPending - this.stackA.length, this.nToLoad, map.Dictionary.getLocalText("loading map elements"));
                    this.doImportSVGFile(nextTile.szUrl, nextTile.svgDocument, nextTile.targetGroup, nextTile.callback);
                } else {
                    this.nRequest = 0;
                    this.nToLoad = 0;
                    //clearMessage();
                }
            }
        };
        /**
         * check if szUrl is waiting in stack
         * @param  szUrl the URL of the SVG file
         * @param  svgDocument the target SVG document
         * @param  targetGroup the target SVG group; content of the loaded document will be added as a new child to this group
         */
        this.isStacked = function (szUrl, svgDocument, targetGroup) {
            for (var i = 0; i < this.stackA.length; i++) {
                if (this.stackA[i].szUrl == szUrl) {
                    if (this.stackA[i].svgDocument == svgDocument &&
                        this.stackA[i].targetGroup == targetGroup) {
                        return true;
                    }
                }
            }
            return false;
        };
        /**
         * check if any URL is waiting in stack
         */
        this.isAnyStacked = function () {
            return (this.stackA.length);
        };
        /**
         * executes the Import a SVG file containing a map   
         * @param  szUrl the URL of the SVG file
         * @param  svgDocument the target SVG document
         * @param  targetGroup the target SVG group; content of the loaded document will be added as a new child to this group
         * @param  callback optional function to be called on succeed
         */
        this.doImportSVGFile = function (szUrl, svgDocument, targetGroup, callback) {

            // check if loading in process
            if (targetGroup && (this.szUrlA[szUrl] == targetGroup)) {
                return false;
            }
            this.szUrlA[szUrl] = targetGroup;
            this.nPending++;

            function CallbackHandler(parent) {
                this.parent = parent;
            }

            CallbackHandler.prototype.operationComplete = function (status, xmlObject, szText) {

                this.parent.szUrlA[szUrl] = null;
                this.parent.nPending--;
                this.parent.nRequest--;
                if (xmlObject && (status == 200)) {
                    this.processImported(xmlObject.documentElement);
                } else {
                    displayMessage("error loading map");
                }
                this.parent.pop();
            };

            CallbackHandler.prototype.processImported = function (d) {

                // local helper
                var __replace = function (oldNode, newNode) {
                    if (newNode && oldNode) {
                        oldNode.parentNode.insertBefore(newNode, oldNode);
                        oldNode.parentNode.removeChild(oldNode);
                    } else
                    if (newNode) {
                        if (newNode.parentNode.nodeName == "defs") {
                            map.SVGRootElement.appendChild(newNode.parentNode);
                        } else {
                            map.SVGRootElement.appendChild(newNode);
                        }
                    } else
                    if (oldNode) {
                        oldNode.parentNode.removeChild(oldNode);
                    }
                };

                // ------------------------------
                // import new map SVG nodes
                // ------------------------------

                map.hideAll();

                /** GR 01.09.2019 not necessary
                try{
                	d = map.SVGDocument.importNode(d, true);
                }
                catch (e){
                **/

                // replace metadata with data from new map
                __replace(map.SVGDocument.getElementsByTagName("metadata")[2],
                    d.getElementsByTagName("metadata")[0]);

                // replace maplayer with those of the new map
                __replace(map.SVGDocument.getElementById("maplayer"),
                    d.getElementById("maplayer"));

                // change extension to new map
                __replace(map.SVGDocument.getElementById("extension"),
                    d.getElementById("extension"));

                // change clipping to new map
                __replace(map.SVGDocument.getElementById("mapclipdef"),
                    d.getElementById("mapclipdef"));

                // copy styles of new map, if defined 
                __replace(map.SVGDocument.getElementById("mapstyles"),
                    d.getElementById("mapstyles"));

                // add pattern defs for the new map
                var patternA = d.getElementsByTagName("pattern");
                if (patternA && patternA[0]) {
                    var defsB = d.getElementsByTagName("pattern")[0].parentNode;
                    map.SVGRootElement.appendChild(defsB);
                }

                // ------------------------------
                // reset/recreate the map handling
                // ------------------------------

                map.Scale = new ixMap.Scale(null);
                map.Scale.superclass = map;

                map.Scale.createWidgetStyles();
                map.Scale.normalizeSymbols(map.SVGDocument.getElementById("symbolstore"));
                map.Scale.normalizeButtons(map.SVGDocument.getElementById("widgetstore"));

                map.Layer = new ixMap.Layer(null);

                map.Layer.initPatternScaling(null, null);

                map.Zoom = new ixMap.Zoom(map.Scale.initScale);
                map.Tiles = new ixMap.Tiles();
                map.Label = new ixMap.Label();
                map.Viewport = new ixMap.Viewport();

                map.Query = new ixMap.Query();

                // magick !!!
                //var rectArea = map.Zoom.getBox();
                //var pt1 = map.Scale.getMapCoordinate(rectArea.x+rectArea.width/2,rectArea.y+rectArea.height/2);
                //map.Zoom.doSetCenterByParentMap(pt1.x,pt1.y);

                map.Layer.switchScaleDependentLayer();
                map.Scale.refreshCSSStyles();

                map.HTMLWindow.ixmaps.htmlgui_onMapReady(window);

                setTimeout("map.showAll()", 1000);

                return;
            };

            console.log("*** load new map ***");
            console.log(szUrl);
            console.log("********************");

            if (szUrl.length > 0) {
                getData(szUrl, new CallbackHandler(this));
                return true;
            }
            return false;
        };
        /**
         * tell the number of pending tiles (svg fragments)  
         * @return number of asynchronous data loads still pending
         */
        this.isWaiting = function () {
            return this.nPending;
        };
        /**
         * tell the number of pending tiles (svg fragments)  
         * @return number of asynchronous data loads still pending
         */
        this.isLoading = function () {
            return (this.nPending | this.isAnyStacked());
        };
    }

    /*
    @ -----------------------------------------------------------------------------
    @ S c r i p t   l o a d i n g
    @ -----------------------------------------------------------------------------
    */
    var scriptLoaderPool = new JSLoaderPool();

    /**
     * Create a new JSLoaderPool instance.  
     * @class It realizes an object to coordinate script loading
     * @constructor
     * @throws 
     * @return A new JSLoaderPool
     */
    function JSLoaderPool() {
        /** holds the created {@link JSLoader} instances @type array */
        this.loaderA = new Array(0);
        /** defines the file ending for all scripts to load @type string */
        this.szSuffix = ".js";
        /** array of all scripts (URLs) already loaded @type string */
        this.loadedUrlA = new Array(0);
        /** array of the scripts (URLs) in progress of beeing loaded @type string */
        this.loadingUrlA = new Array(0);
        /** array of all scripts (URLs) that could not be loaded @type string */
        this.errorUrlA = new Array(0);
    }
    /**
     * adds one created loader object to the pool  
     * @param  loaderObj the loader object to add
     */
    JSLoaderPool.prototype.add = function (loaderObj) {
        this.loaderA[this.loaderA.length] = loaderObj;
    };
    /**
     * evaluates all loaded script, in order to make them functional  
     */
    JSLoaderPool.prototype.evalScripts = function () {

        if (this.isLoading() === false) {

            for (var i = 0; i < this.loaderA.length; i++) {
                var loader = this.loaderA[i];
                for (var ii = 0; ii < loader.loadedScripts.length; ii++) {
                    if (!this.isScriptLoaded(loader.szUrl)) {
                        this.evalScript(loader.loadedScripts[ii]);
                        this.setScriptLoaded(loader.szUrl);
                    }
                }
            }
            this.loaderA.length = 0;
        }
    };
    /**
     * evaluates a loaded script, in order to make it functional  
     */
    JSLoaderPool.prototype.evalScript = function () {
        eval(arguments[0]);
    };
    /**
     * adds this url to the array of non loadable scripts  
     * @param  szUrl the URL of the script, that caused a loading error
     */
    JSLoaderPool.prototype.setScriptError = function (szUrl) {
        this.errorUrlA[this.errorUrlA.length] = szUrl;
    };
    /**
     * adds this url to the array of loaded scripts  
     * @param  szUrl the URL of the script, that has successfully been loaded
     */
    JSLoaderPool.prototype.setScriptLoaded = function (szUrl) {
        this.loadedUrlA[this.loadedUrlA.length] = szUrl;
    };
    /**
     * adds this url to the array of loads in progress  
     * @param  szUrl the URL of the script 
     */
    JSLoaderPool.prototype.setScriptLoading = function (szUrl) {
        this.loadingUrlA[this.loadingUrlA.length] = szUrl;
    };
    /**
     * check the loaded state of a script  
     * @type boolean
     * @param  szUrl the URL of the script to be checked
     * @return true if the script has successfully been loaded
     */
    JSLoaderPool.prototype.isScriptLoaded = function (szUrl) {
        for (var i = 0; i < this.loadedUrlA.length; i++) {
            if (this.loadedUrlA[i] == szUrl) {
                return true;
            }
        }
        return false;
    };
    /**
     * check the loading state of a script  
     * @type boolean
     * @param  szUrl the URL of the script to be checked
     * @return true if the loading of the script is in progress
     */
    JSLoaderPool.prototype.isScriptLoading = function (szUrl) {
        for (var i = 0; i < this.loadingUrlA.length; i++) {
            if (this.loadingUrlA[i] == szUrl) {
                return true;
            }
        }
        return false;
    };
    /**
     * check the error state of a script  
     * @type boolean
     * @param  szUrl the URL of the script to be checked
     * @return true if the script could not be loaded
     */
    JSLoaderPool.prototype.isScriptError = function (szUrl) {
        for (var i = 0; i < this.errorUrlA.length; i++) {
            if (this.errorUrlA[i] == szUrl) {
                return true;
            }
        }
        return false;
    };
    /**
     * uncheck the loaded state of a script  
     * @type boolean
     * @param  szUrl the URL of the script to be checked
     */
    JSLoaderPool.prototype.resetScriptLoading = function (szUrl) {
        for (var i = 0; i < this.loadingUrlA.length; i++) {
            if (this.loadingUrlA[i] == szUrl) {
                this.loadingUrlA[i] = "";
            }
        }
        for (var i = 0; i < this.loadedUrlA.length; i++) {
            if (this.loadedUrlA[i] == szUrl) {
                this.loadedUrlA[i] = "";
            }
        }
        for (var i = 0; i < this.errorUrlA.length; i++) {
            if (this.errorUrlA[i] == szUrl) {
                this.errorUrlA[i] = "";
            }
        }
    };
    /**
     * check the loading state of all loader in the pool  
     * @type boolean
     * @return true if any loader is in progress of loading
     */
    JSLoaderPool.prototype.isLoading = function () {
        var i;
        for (i = 0; i < this.loaderA.length; i++) {
            if (this.loaderA[i].reqCnt > 0) {
                return true;
            }
        }
        return false;
    };
    /**
     * Create a new JSLoader instance.  
     * @class It realizes an object to load scripts from URL and evaluate them on load success
     * @constructor
     * @throws 
     * @return A new JSLoader
     */
    function JSLoader() {
        /** array of strings which each can hold a loaded scripts @type array */
        this.loadedScripts = [];
        /** number of requests (loadings in progress) @type int */
        this.reqCnt = 0;
        /** flag to indicate any loading process in progress @type boolean */
        this.isLoading = false;
        /** function to be called on loading error @type string */
        this.errorCallback = null;
        /** function to be called on loading success @type string */
        this.finishedCallback = null;
        /** message to be displayed on loading */
        this.szMessage = "... loading ...";
        /** link to a parent class ({@link JSLoaderPool}) that controlls all created JSLoader @type JSLoaderPool */
        this.pool = scriptLoaderPool;
        this.pool.add(this);
    }
    /**
     * start loading the specified script  
     * @param  szUrl the URL of the script to be loaded
     */
    JSLoader.prototype.loadScript = function (szUrl, fRefresh) {


        if (fRefresh) {
            this.pool.resetScriptLoading(szUrl);
        }

        try {
            // check url, maybe add javascript file suffix 
            if (!szUrl.match(/./)) {
                szUrl += this.pool.szSuffix;
            }
            this.szUrl = szUrl;
            if (this.pool.isScriptError(this.szUrl)) {
                if (typeof this.errorCallback === 'function') {
                    this.errorCallback();
                } else {
                    eval(this.errorCallback);
                }
                return;
            }
            if (this.pool.isScriptLoaded(this.szUrl)) {
                if (typeof this.finishedCallback === 'function') {
                    this.finishedCallback();
                } else {
                    eval(this.finishedCallback);
                }
                return;
            }
            if (!this.pool.isScriptLoading(this.szUrl)) {
                this.isLoading = true;
                this.reqCnt++;
                this.pool.setScriptLoading(this.szUrl);
                getData(szUrl, this);
            }
        } catch (e) {}
    };
    /**
     * callback function to terminate the data request from XMLHTTPRequest
     * checks the error state and in case of success, activates the loaded content
     * @param  status 
     * @param  xmlObject
     * @param  szText 
     */
    JSLoader.prototype.operationComplete = function (status, xmlObject, szText) {
        if (status != 200 || (!xmlObject && !szText)) {
            this.pool.setScriptError(this.szUrl);
            if (this.errorCallback) {
                this.finishedCallback = null;
                if (typeof this.errorCallback === 'function') {
                    this.errorCallback();
                } else {
                    eval(this.errorCallback);
                }
            }
        } else {
            this.loadedScripts.push(szText);
        }
        this.reqCnt--;
        if (this.reqCnt <= 0) {
            this.evalScripts();
        }
    };
    /**
     * must not occur, if does instead, gives alert
     * @param  s the result of the loading process
     */
    JSLoader.prototype.processImported = function (s) {
        alert(s);
    };
    /**
     * activate all new loaded scripts, uses the appropriate methods of the pool !
     */
    JSLoader.prototype.evalScripts = function () {
        this.pool.evalScripts();
        //or to have them all evaled in the same scope:
        //evalScripts(this.loadedScripts.join("\n");
        this.isLoading = false;
        if (this.finishedCallback) {
            if (typeof this.finishedCallback === 'function') {
                this.finishedCallback();
            } else {
                eval(this.finishedCallback);
            }
        }
    };
    /**
     * returns the loading state of the loader object
     * Note: because is called periodically, does the 'loading...' message
     * @type boolean
     * @return true if the loader is loading (waiting)
     */
    JSLoader.prototype.isLoading = function () {
        return (this.reqCnt > 0);
    };

    // .............................................................................
    // handle both getUrl (ASV) and XMLHttpRequest (Mozilla SVG)
    // .............................................................................

    /**
     * executes all !! asynchronous data loading (SVG,XML,Scrips,...); 
     * every loader uses this function, to achieve browser and XMLHttpRequest compatibility 
     * @param  szUrl the URL of the data to be loaded 
     * @param  getDataCallback the callback function to process the imported data
     */
    function getData(szUrl, getDataCallback) {

        // call getURL() if available, case ASV3, ASV6 and Batik
        if (window.getURL) {
            window.getURL(szUrl, getDataCallback);
        }
        // call XMLHttpRequest() if available, case MozillaSVG
        else if (window.XMLHttpRequest) {
            // this nested function is used to make XMLHttpRequest threadsafe
            // (subsequent calls would not override the state of the request and can use the variable/object context of the parent function)
            // this idea is borrowed from http://www.xml.com/cs/user/view/cs_msg/2815 (brockweaver)
            var XMLHttpRequestCallback = function () {
                // we are only interested in the complete transaction (readyState 4)
                if (xmlRequest.readyState == 4) {
                    getDataCallback.operationComplete(xmlRequest.status, xmlRequest.responseXML, xmlRequest.responseText);
                }
            };
            try {
                var xmlRequest = null;
                xmlRequest = new XMLHttpRequest();
                xmlRequest.open("GET", szUrl, true);
                xmlRequest.onreadystatechange = XMLHttpRequestCallback;
                xmlRequest.send(null);
            } catch (e) {}
        }
        //write an error message if either method is not available
        else {
            alert("your browser/svg viewer neither supports window.getURL nor window.XMLHttpRequest!");
        }
    }

    // .............................................................................
    // C O O R D I N A T E    T R A N S F O R M A T I O N  
    //  adapted from a Python script, written by Chuck Gantz- chuck.gantz@globalstar.com
    //  based on Defense Mapping Agency. 1987b. DMA Technical Report: Supplement to Department of Defense World Geodetic System
    //  1984 Technical Report. Part I and II. Washington, DC: Defense Mapping Agency
    // .............................................................................

    /**
     * Returns the hyperbolic sine of the number, defined as (exp(number) - exp(-number))/2  
     * @param  arg a number
     */
    const sinh = function (arg) {
        return (Math.exp(arg) - Math.exp(-arg)) / 2;
    };
    const _deg2rad = Math.PI / 180.0;
    const _rad2deg = 180.0 / Math.PI;
    const _maxLat = Math.atan(sinh(Math.PI)) * _rad2deg;

    const _refEllipsoid = {
        "WGS84": {
            _EquatorialRadius: 6378137,
            _eccentricitySquared: 0.00669438
        },
        "Airy": {
            _EquatorialRadius: 6377563,
            _eccentricitySquared: 0.00667054
        },
        "Australian National": {
            _EquatorialRadius: 6378160,
            _eccentricitySquared: 0.006694542
        },
        "Bessel 1841": {
            _EquatorialRadius: 6377397,
            _eccentricitySquared: 0.006674372
        },
        "Bessel 1841 (Nambia]": {
            _EquatorialRadius: 6377484,
            _eccentricitySquared: 0.006674372
        },
        "Clarke 1866": {
            _EquatorialRadius: 6378206,
            _eccentricitySquared: 0.006768658
        },
        "Clarke 1880": {
            _EquatorialRadius: 6378249,
            _eccentricitySquared: 0.006803511
        },
        "Everest": {
            _EquatorialRadius: 6377276,
            _eccentricitySquared: 0.006637847
        },
        "Fischer 1960 (Mercury]": {
            _EquatorialRadius: 6378166,
            _eccentricitySquared: 0.006693422
        },
        "Fischer 1968": {
            _EquatorialRadius: 6378150,
            _eccentricitySquared: 0.006693422
        },
        "GRS 1967": {
            _EquatorialRadius: 6378160,
            _eccentricitySquared: 0.006694605
        },
        "GRS 1980": {
            _EquatorialRadius: 6378137,
            _eccentricitySquared: 0.00669438
        },
        "Helmert 1906": {
            _EquatorialRadius: 6378200,
            _eccentricitySquared: 0.006693422
        },
        "Hough": {
            _EquatorialRadius: 6378270,
            _eccentricitySquared: 0.00672267
        },
        "International": {
            _EquatorialRadius: 6378388,
            _eccentricitySquared: 0.00672267
        },
        "Krassovsky": {
            _EquatorialRadius: 6378245,
            _eccentricitySquared: 0.006693422
        },
        "Modified Airy": {
            _EquatorialRadius: 6377340,
            _eccentricitySquared: 0.00667054
        },
        "Modified Everest": {
            _EquatorialRadius: 6377304,
            _eccentricitySquared: 0.006637847
        },
        "Modified Fischer 1960": {
            _EquatorialRadius: 6378155,
            _eccentricitySquared: 0.006693422
        },
        "South American 1969": {
            _EquatorialRadius: 6378160,
            _eccentricitySquared: 0.006694542
        },
        "WGS 60": {
            _EquatorialRadius: 6378165,
            _eccentricitySquared: 0.006693422
        },
        "WGS 66": {
            _EquatorialRadius: 6378145,
            _eccentricitySquared: 0.006694542
        },
        "WGS-72": {
            _EquatorialRadius: 6378135,
            _eccentricitySquared: 0.006694318
        },
        "WGS-84": {
            _EquatorialRadius: 6378137,
            _eccentricitySquared: 0.00669438
        }
    };

    /**
     * converts lat/long to UTM coords.  Equations from USGS Bulletin 1532 
     * East Longitudes are positive, West longitudes are negative. 
     * North latitudes are positive, South latitudes are negative
     * Lat and Long are in decimal degrees
     * @param  ReferenceEllipsoid the name of the ReferenceEllipsoid ( only WGS84 )
     * @param  nLat latitude in decimal degrees
     * @param  nLon longitude in decimal degrees
     * @param  UTMZone UTM Zone (only set if diverts from standard)
     * @type   point
     */
    const _LLtoUTM = function (szRefEllipsoid, nLat, nLon, UTMZone) {

        if (!_refEllipsoid[szRefEllipsoid]) {
            szRefEllipsoid = "WGS84";
        }
        var a = _refEllipsoid[szRefEllipsoid]._EquatorialRadius;
        var eccSquared = _refEllipsoid[szRefEllipsoid]._eccentricitySquared;
        var k0 = 0.9996;

        // make sure the longitude is between -180.00 .. 179.9
        var nLongTemp = (nLon + 180) - Math.floor((nLon + 180) / 360) * 360 - 180;

        var nLatRad = nLat * _deg2rad;
        var nLongRad = nLongTemp * _deg2rad;

        var nZoneNumber = Math.floor((nLongTemp + 180) / 6) + 1;

        if (nLat >= 56.0 && nLat < 64.0 && nLongTemp >= 3.0 && nLongTemp < 12.0) {
            nZoneNumber = 32;
        }
        // special zones for Svalbard
        if (nLat >= 72.0 && nLat < 84.0) {
            if (nLongTemp >= 0.0 && nLongTemp < 9.0) {
                nZoneNumber = 31;
            } else if (nLongTemp >= 9.0 && nLongTemp < 21.0) {
                nZoneNumber = 33;
            } else if (nLongTemp >= 21.0 && nLongTemp < 33.0) {
                nZoneNumber = 35;
            } else if (nLongTemp >= 33.0 && nLongTemp < 42.0) {
                nZoneNumber = 37;
            }
        }
        // GR 27.11.2007 zone given ?
        if (UTMZone && UTMZone.length) {
            nZoneNumber = parseInt(UTMZone);
        }
        // +3 puts origin in middle of zone
        var nLongOrigin = (nZoneNumber - 1) * 6 - 180 + 3;
        var nLongOriginRad = nLongOrigin * _deg2rad;

        // compute the UTM Zone from the latitude and longitude
        var szUTMZone = String(nZoneNumber + _UTMLetterDesignator(nLat));
        var eccPrimeSquared = (eccSquared) / (1 - eccSquared);
        var N = a / Math.sqrt(1 - eccSquared * Math.sin(nLatRad) * Math.sin(nLatRad));
        var T = Math.tan(nLatRad) * Math.tan(nLatRad);
        var C = eccPrimeSquared * Math.cos(nLatRad) * Math.cos(nLatRad);
        var A = Math.cos(nLatRad) * (nLongRad - nLongOriginRad);

        var M = a * ((1 -
                eccSquared / 4 -
                3 * eccSquared * eccSquared / 64 -
                5 * eccSquared * eccSquared * eccSquared / 256) * nLatRad -
            (3 * eccSquared / 8 +
                3 * eccSquared * eccSquared / 32 +
                45 * eccSquared * eccSquared * eccSquared / 1024) * Math.sin(2 * nLatRad) +
            (15 * eccSquared * eccSquared / 256 + 45 * eccSquared * eccSquared * eccSquared / 1024) * Math.sin(4 * nLatRad) -
            (35 * eccSquared * eccSquared * eccSquared / 3072) * Math.sin(6 * nLatRad));

        var UTMEasting = (k0 * N * (A + (1 - T + C) * A * A * A / 6 +
                (5 - 18 * T + T * T + 72 * C - 58 * eccPrimeSquared) * A * A * A * A * A / 120) +
            500000.0);

        var UTMNorthing = (k0 * (M + N * Math.tan(nLatRad) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24 +
            (61 -
                58 * T +
                T * T +
                600 * C -
                330 * eccPrimeSquared) * A * A * A * A * A * A / 720)));

        // 10000000 meter offset for southern hemisphere
        if (nLat < 0) {
            UTMNorthing = UTMNorthing + 10000000.0;
        }
        return new point(UTMEasting, UTMNorthing);
    };

    const _UTMLetterDesignator = function (nLat) {
        // This routine determines the correct UTM letter designator for the given latitude
        // returns 'Z' if latitude is outside the UTM limits of 84N to 80S
        // Written by Chuck Gantz- chuck.gantz@globalstar.com

        if (84 >= nLat >= 72) {
            return 'X';
        } else if (72 > nLat >= 64) {
            return 'W';
        } else if (64 > nLat >= 56) {
            return 'V';
        } else if (56 > nLat >= 48) {
            return 'U';
        } else if (48 > nLat >= 40) {
            return 'T';
        } else if (40 > nLat >= 32) {
            return 'S';
        } else if (32 > nLat >= 24) {
            return 'R';
        } else if (24 > nLat >= 16) {
            return 'Q';
        } else if (16 > nLat >= 8) {
            return 'P';
        } else if (8 > nLat >= 0) {
            return 'N';
        } else if (0 > nLat >= -8) {
            return 'M';
        } else if (-8 > nLat >= -16) {
            return 'L';
        } else if (-16 > nLat >= -24) {
            return 'K';
        } else if (-24 > nLat >= -32) {
            return 'J';
        } else if (-32 > nLat >= -40) {
            return 'H';
        } else if (-40 > nLat >= -48) {
            return 'G';
        } else if (-48 > nLat >= -56) {
            return 'F';
        } else if (-56 > nLat >= -64) {
            return 'E';
        } else if (-64 > nLat >= -72) {
            return 'D';
        } else if (-72 > nLat >= -80) {
            return 'C';
        } else {
            return 'Z';
        }
        // if the Latitude is outside the UTM limits
    };

    /*******************************************************************************/
    /* void UTMtoLL(int szRefEllipsoid, const double UTMNorthing, const double UTMEasting, const char* UTMZone, */
    /*			    double& Lat,  double& Long )                                   */
    /* converts UTM coords to lat/long.  Equations from USGS Bulletin 1532         */
    /* East Longitudes are positive, West longitudes are negative.                 */
    /* North latitudes are positive, South latitudes are negative                  */
    /* Lat and Long are in decimal degrees.                                        */
    /* Written by Chuck Gantz- chuck.gantz@globalstar.com                          */
    /* Converted to Python by Russ Nelson <nelson@crynwr.com>                      */
    /*******************************************************************************/

    const _UTMtoLL = function (szRefEllipsoid, UTMNorthing, UTMEasting, szUTMZone) {
        if (!_refEllipsoid[szRefEllipsoid]) {
            szRefEllipsoid = "WGS84";
        }
        if (!szUTMZone) {
            return null;
        }

        var k0 = 0.9996;
        var a = _refEllipsoid[szRefEllipsoid]._EquatorialRadius;
        var eccSquared = _refEllipsoid[szRefEllipsoid]._eccentricitySquared;
        var e1 = (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));

        var NorthernHemisphere; //1 for northern hemispher, 0 for southern

        var x = UTMEasting - 500000.0; // remove 500,000 meter offset for longitude
        var y = UTMNorthing;

        var nZoneNumber = parseInt(szUTMZone);
        var szZoneLetter = szUTMZone.substr(szUTMZone.length - 1, 1);
        if (szZoneLetter >= 'N') {
            NorthernHemisphere = 1; // point is in northern hemisphere
        } else {
            NorthernHemisphere = 0; // point is in southern hemisphere
            y -= 10000000.0; // remove 10,000,000 meter offset used for southern hemisphere
        }
        var LongOrigin = (nZoneNumber - 1) * 6 - 180 + 3; // +3 puts origin in middle of zone

        var eccPrimeSquared = (eccSquared) / (1 - eccSquared);

        var M = y / k0;
        var mu = M / (a * (1 - eccSquared / 4 - 3 * eccSquared * eccSquared / 64 - 5 * eccSquared * eccSquared * eccSquared / 256));

        var phi1Rad = (mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu) +
            (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu) +
            (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu));
        var phi1 = phi1Rad * _rad2deg;

        var N1 = a / Math.sqrt(1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad));
        var T1 = Math.tan(phi1Rad) * Math.tan(phi1Rad);
        var C1 = eccPrimeSquared * Math.cos(phi1Rad) * Math.cos(phi1Rad);
        var R1 = a * (1 - eccSquared) / Math.pow(1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad), 1.5);
        var D = x / (N1 * k0);

        var nLat = 0;
        var nLong = 0;

        nLat = phi1Rad - (N1 * Math.tan(phi1Rad) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * eccPrimeSquared) * D * D * D * D / 24 +
            (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * eccPrimeSquared - 3 * C1 * C1) * D * D * D * D * D * D / 720);
        nLat = nLat * _rad2deg;

        nLong = (D - (1 + 2 * T1 + C1) * D * D * D / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * eccPrimeSquared + 24 * T1 * T1) *
            D * D * D * D * D / 120) / Math.cos(phi1Rad);
        nLong = LongOrigin + nLong * _rad2deg;

        return new point(nLong, nLat);
    };

    /**
     * converts lat/long to Mercator coords.
     * East Longitudes are positive, West longitudes are negative. 
     * North latitudes are positive, South latitudes are negative
     * Lat and Long are in decimal degrees
     * @param  nLat latitude in decimal degrees
     * @param  nLon longitude in decimal degrees
     * @type   point
     */
    const _LLtoMercator = function (nLat, nLon) {
        // Clamp latitude to valid Mercator projection range
        nLat = Math.max(Math.min(nLat, _maxLat), -_maxLat);

        // Direct Mercator transformation
        const phi = nLat * _deg2rad;
        const nNorthing = Math.log(Math.tan(Math.PI / 4 + phi / 2)) * _rad2deg;

        return new point(nLon, nNorthing);
    };
    /**
     * converts Mercator coordinates to lat/long.
     * East Longitudes are positive, West longitudes are negative. 
     * North latitudes are positive, South latitudes are negative
     * Lat and Long are in decimal degrees
     * @param  nNorthing Mercator latitude
     * @param  nEasting Mercator longitude
     * @type   point
     */
    const _MercatortoLL = function (nNorthing, nEasting) {
        var nLat = Math.atan(sinh(nNorthing * _deg2rad)) * _rad2deg;
        var nLon = nEasting;
        return new point(nLon, nLat);
    };

    /**
     * converts lat/long to WinkelTripple coords.
     * East Longitudes are positive, West longitudes are negative. 
     * North latitudes are positive, South latitudes are negative
     * Lat and Long are in decimal degrees
     * @param  nLat latitude in decimal degrees
     * @param  nLon longitude in decimal degrees
     * @type   point
     */
    const _copysign = function (a, b) {
        if (a < 0 && b > 0) {
            return -a;
        }
        if (a > 0 && b < 0) {
            return -a;
        }
        return a;
    };

    const WGS_84_EQ_RAD = 6378137;
    const CENTRAL_MERIDIAN = 0;

    const _LLtoWinkelTripel = function (nLat, nLon) {
        /* Convert lon/lat to Winkel Tripel x/y */
        var C, D, x1, x2, y1, y2, x, y;

        if ((nLon - CENTRAL_MERIDIAN) < -180.0) nLon = -180.0 + CENTRAL_MERIDIAN;
        if ((nLon - CENTRAL_MERIDIAN) > 180.0) nLon = 180.0 + CENTRAL_MERIDIAN;

        nLon -= CENTRAL_MERIDIAN;
        nLat *= _deg2rad;
        nLon *= (0.5 * _deg2rad);

        /* Fist find Aitoff x/y */

        D = Math.acos(Math.cos(nLat) * Math.cos(nLon));
        if (D === 0.0)
            x1 = y1 = 0.0;
        else {
            C = Math.sin(nLat) / Math.sin(D);
            D *= WGS_84_EQ_RAD;
            x1 = _copysign(2.0 * D * Math.sqrt(1.0 - C * C), nLon);
            y1 = D * C;
        }

        /* Then get equirectangular projection */

        x2 = WGS_84_EQ_RAD * 2 * nLon * Math.cos(50.467);
        y2 = WGS_84_EQ_RAD * nLat;

        /* Winkler is the average value */

        x = 0.5 * (x1 + x2);
        y = 0.5 * (y1 + y2);

        return new point(x, y);
    };

    /**
     * converts lat/long to Equal Earth coords.
     * East Longitudes are positive, West longitudes are negative. 
     * North latitudes are positive, South latitudes are negative
     * Lat and Long are in decimal degrees
     * @param  nLat latitude in decimal degrees
     * @param  nLon longitude in decimal degrees
     * @type   point
     */
    const A1 = 1.340264,
        A2 = -0.081106,
        A3 = 0.000893,
        A4 = 0.003796,
        M = Math.sqrt(3) / 2,
        iterations = 12;

    const _LLtoEqualEarth = function (nLat, nLon) {
        /* Convert lon/lat to Equal Earth x/y */
        nLat *= _deg2rad;
        nLon *= _deg2rad;
        var l = Math.asin(M * Math.sin(nLat)),
            l2 = l * l,
            l6 = l2 * l2 * l2;
        return new point(
            WGS_84_EQ_RAD * nLon * Math.cos(l) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))),
            WGS_84_EQ_RAD * l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2))
        );
    };

    const _EqualEarthtoLL = function (x, y) {

        while (x > WGS_84_EQ_RAD) {
            x -= WGS_84_EQ_RAD;
        }
        while (y > WGS_84_EQ_RAD) {
            y -= WGS_84_EQ_RAD;
        }
        while (x < -WGS_84_EQ_RAD) {
            x += WGS_84_EQ_RAD;
        }
        while (y < -WGS_84_EQ_RAD) {
            y += WGS_84_EQ_RAD;
        }

        x /= WGS_84_EQ_RAD;
        y /= WGS_84_EQ_RAD;

        var l = y,
            l2 = l * l,
            l6 = l2 * l2 * l2;
        var delta = 0;
        for (var i = 0, delta, fy, fpy; i < iterations; ++i) {
            var fy = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)) - y;
            var fpy = A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2);
            l -= delta = fy / fpy, l2 = l * l, l6 = l2 * l2 * l2;
            if (Math.abs(delta) < 0.1) break;
        }
        return new point(
            _rad2deg * M * x * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)) / Math.cos(l),
            _rad2deg * Math.asin(Math.sin(l) / M)
        );
    };

    /**
     * converts lat/long to Albers Equal Area coords using WGS84 ellipsoid.
     * East Longitudes are positive, West longitudes are negative. 
     * North latitudes are positive, South latitudes are negative
     * Lat and Long are in decimal degrees
     * @param  lat latitude in decimal degrees
     * @param  lon longitude in decimal degrees
     * @param  params optional projection parameters: {lat1, lat2, lat0, lon0}
     *                if not provided, uses pre-calculated constants from map.Scale
     * @type   point
     */
    const _LLtoAlbersEqualArea = function (lat, lon, params) {
        
        // Use pre-calculated constants from map.Scale if available (much faster!)
        // Otherwise fall back to on-the-fly calculation (slower, for compatibility)
        const usePreCalc = map && map.Scale && map.Scale._albersConstants;
        
        let a, e, e2, n, C, ρ0, λ0, calcQ;
        
        if (usePreCalc) {
            // Fast path: use pre-calculated constants
            const c = map.Scale._albersConstants;
            a = c.a;
            e = c.e;
            e2 = c.e2;
            n = c.n;
            C = c.C;
            ρ0 = c.ρ0;
            λ0 = c.λ0;
            calcQ = c.calcQ;
        } else {
            // Slow path: calculate on-the-fly (for backwards compatibility)
            const degreesToRadians = (deg) => deg * Math.PI / 180;
            params = params || {};
            const φ1 = degreesToRadians(params.lat1 !== undefined ? params.lat1 : 29.5);
            const φ2 = degreesToRadians(params.lat2 !== undefined ? params.lat2 : 45.5);
            const φ0 = degreesToRadians(params.lat0 !== undefined ? params.lat0 : 23);
            λ0 = degreesToRadians(params.lon0 !== undefined ? params.lon0 : -96);
            
            a = 6378137.0;
            e = 0.0818191908426;
            e2 = e * e;
            
            calcQ = function(sinPhi) {
                const eSinPhi = e * sinPhi;
                return (1 - e2) * (
                    sinPhi / (1 - e2 * sinPhi * sinPhi) - 
                    (1 / (2 * e)) * Math.log((1 - eSinPhi) / (1 + eSinPhi))
                );
            };
            
            const calcM = (phi) => {
                const sinPhi = Math.sin(phi);
                return Math.cos(phi) / Math.sqrt(1 - e2 * sinPhi * sinPhi);
            };
            
            const q0 = calcQ(Math.sin(φ0));
            const q1 = calcQ(Math.sin(φ1));
            const q2 = calcQ(Math.sin(φ2));
            const m1 = calcM(φ1);
            const m2 = calcM(φ2);
            
            n = (m1 * m1 - m2 * m2) / (q2 - q1);
            C = m1 * m1 + n * q1;
            ρ0 = (a / n) * Math.sqrt(C - n * q0);
        }
        
        // Convert input coordinates to radians
        const φ = (lat * Math.PI / 180);
        const λ = (lon * Math.PI / 180);
        
        // Calculate q for the point (this varies per point, cannot be pre-calculated)
        const q = calcQ(Math.sin(φ));
        
        // Calculate ρ and θ for the point (per-point calculations)
        const ρ = (a / n) * Math.sqrt(C - n * q);
        const θ = n * (λ - λ0);
        
        // Calculate projected coordinates (x, y)
        const x = ρ * Math.sin(θ);
        const y = ρ0 - ρ * Math.cos(θ);
        
        return new point(x, y);
    };

    /**
     * converts lat/long to Lambert Azimuthal Equal Area coords using WGS84 ellipsoid.
     * @param  lat latitude in decimal degrees
     * @param  lon longitude in decimal degrees
     * @param  params optional projection parameters: {lat0, lon0}
     * @type   point
     */
    const _LLtoLambertAzimuthalEqualArea = function (lat, lon, params) {
        const degreesToRadians = (deg) => deg * Math.PI / 180;

        const usePreCalc = map && map.Scale && map.Scale._lambertConstants;

        let a, e, e2, λ0, qp, sinBeta0, cosBeta0, Rq, calcQ;

        if (usePreCalc) {
            const c = map.Scale._lambertConstants;
            a = c.a;
            e = c.e;
            e2 = c.e2;
            λ0 = c.λ0;
            qp = c.qp;
            sinBeta0 = c.sinBeta0;
            cosBeta0 = c.cosBeta0;
            Rq = c.Rq;
            calcQ = c.calcQ;
        } else {
            params = params || {};
            const φ0 = degreesToRadians(params.lat0 !== undefined ? params.lat0 : 0);
            λ0 = degreesToRadians(params.lon0 !== undefined ? params.lon0 : 0);

            a = 6378137.0;
            const f = 1 / 298.257222101;
            e2 = 2 * f - f * f;
            e = Math.sqrt(e2);

            calcQ = (phi) => {
                const sinPhi = Math.sin(phi);
                const eSinPhi = e * sinPhi;
                return (1 - e2) * (
                    sinPhi / (1 - e2 * sinPhi * sinPhi) -
                    (1 / (2 * e)) * Math.log((1 - eSinPhi) / (1 + eSinPhi))
                );
            };

            qp = (1 - e2) * (
                1 / (1 - e2) -
                (1 / (2 * e)) * Math.log((1 - e) / (1 + e))
            );

            const q0 = calcQ(φ0);
            sinBeta0 = q0 / qp;
            cosBeta0 = Math.sqrt(Math.max(0, 1 - sinBeta0 * sinBeta0));
            Rq = a * Math.sqrt(0.5 * qp);
        }

        const φ = degreesToRadians(lat);
        const λ = degreesToRadians(lon);
        const Δλ = λ - λ0;

        const q = calcQ(φ);
        const sinBeta = q / qp;
        const cosBeta = Math.sqrt(Math.max(0, 1 - sinBeta * sinBeta));

        const sinDelta = Math.sin(Δλ);
        const cosDelta = Math.cos(Δλ);

        const denominator = 1 + sinBeta0 * sinBeta + cosBeta0 * cosBeta * cosDelta;
        const k = Math.sqrt(Math.max(0, 2 / Math.max(1e-15, denominator)));

        const x = Rq * k * cosBeta * sinDelta;
        const y = Rq * k * (cosBeta0 * sinBeta - sinBeta0 * cosBeta * cosDelta);

        return new point(x, y);
    };

    /**
     * converts Albers Equal Area coords to lat/long using WGS84 ellipsoid (inverse transformation).
     * @param  x projected x coordinate in meters
     * @param  y projected y coordinate in meters
     * @param  params optional projection parameters: {lat1, lat2, lat0, lon0}
     *                if not provided, uses pre-calculated constants from map.Scale
     * @type   point
     * @return point with lon (x) and lat (y) in decimal degrees
     */
    const _AlbersEqualAreatoLL = function (x, y, params) {
        const radiansToDegrees = (rad) => rad * 180 / Math.PI;
        
        // Use pre-calculated constants from map.Scale if available (much faster!)
        // Otherwise fall back to on-the-fly calculation (slower, for compatibility)
        const usePreCalc = map && map.Scale && map.Scale._albersConstants;
        
        let a, e, e2, n, C, ρ0, λ0;
        
        if (usePreCalc) {
            // Fast path: use pre-calculated constants
            const c = map.Scale._albersConstants;
            a = c.a;
            e = c.e;
            e2 = c.e2;
            n = c.n;
            C = c.C;
            ρ0 = c.ρ0;
            λ0 = c.λ0;
        } else {
            // Slow path: calculate on-the-fly (for backwards compatibility)
            const degreesToRadians = (deg) => deg * Math.PI / 180;
            params = params || {};
            const φ1 = degreesToRadians(params.lat1 !== undefined ? params.lat1 : 29.5);
            const φ2 = degreesToRadians(params.lat2 !== undefined ? params.lat2 : 45.5);
            const φ0 = degreesToRadians(params.lat0 !== undefined ? params.lat0 : 23);
            λ0 = degreesToRadians(params.lon0 !== undefined ? params.lon0 : -96);
            
            a = 6378137.0;
            const f = 1 / 298.257222101;
            e2 = 2 * f - f * f;
            e = Math.sqrt(e2);
            
            const calcQ = function(sinPhi) {
                const eSinPhi = e * sinPhi;
                return (1 - e2) * (
                    sinPhi / (1 - e2 * sinPhi * sinPhi) - 
                    (1 / (2 * e)) * Math.log((1 - eSinPhi) / (1 + eSinPhi))
                );
            };
            
            const calcM = (phi) => {
                const sinPhi = Math.sin(phi);
                return Math.cos(phi) / Math.sqrt(1 - e2 * sinPhi * sinPhi);
            };
            
            const q0 = calcQ(Math.sin(φ0));
            const q1 = calcQ(Math.sin(φ1));
            const q2 = calcQ(Math.sin(φ2));
            const m1 = calcM(φ1);
            const m2 = calcM(φ2);
            
            n = (m1 * m1 - m2 * m2) / (q2 - q1);
            C = m1 * m1 + n * q1;
            ρ0 = (a / n) * Math.sqrt(C - n * q0);
        }
        
        // Calculate ρ and θ from x, y
        const ρ = Math.sqrt(x * x + (ρ0 - y) * (ρ0 - y));
        const θ = Math.atan2(x, ρ0 - y);
        
        // Calculate longitude
        const λ = λ0 + θ / n;
        
        // Calculate q from ρ
        const q = (C - (ρ * n / a) * (ρ * n / a)) / n;
        
        // Calculate latitude from q using iterative method
        // Initial approximation
        let φ = Math.asin(q / 2);
        
        // Newton-Raphson iteration to solve for latitude
        const maxIterations = 10;
        const tolerance = 1e-10;
        
        for (let i = 0; i < maxIterations; i++) {
            const sinPhi = Math.sin(φ);
            const eSinPhi = e * sinPhi;
            const oneMinus = 1 - e2 * sinPhi * sinPhi;
            
            // Calculate q for current φ
            const qPhi = (1 - e2) * (
                sinPhi / oneMinus - 
                (1 / (2 * e)) * Math.log((1 - eSinPhi) / (1 + eSinPhi))
            );
            
            // Calculate derivative dq/dφ
            const dqDphi = (1 - e2) / oneMinus;
            
            // Newton-Raphson update
            const delta = (q - qPhi) / dqDphi;
            φ += delta;
            
            if (Math.abs(delta) < tolerance) {
                break;
            }
        }
        
        // Convert to degrees
        const lon = radiansToDegrees(λ);
        const lat = radiansToDegrees(φ);
        
        return new point(lon, lat);
    };

    /**
     * converts Lambert Azimuthal Equal Area coords to lat/long using WGS84 ellipsoid.
     * @param  x projected x coordinate in meters
     * @param  y projected y coordinate in meters
     * @param  params optional projection parameters: {lat0, lon0}
     * @type   point
     */
    const _LambertAzimuthalEqualAreatoLL = function (x, y, params) {
        const radiansToDegrees = (rad) => rad * 180 / Math.PI;

        const usePreCalc = map && map.Scale && map.Scale._lambertConstants;

        let a, e, e2, λ0, qp, sinBeta0, cosBeta0, Rq, calcQ, inverseQ, φ0;

        if (usePreCalc) {
            const c = map.Scale._lambertConstants;
            a = c.a;
            e = c.e;
            e2 = c.e2;
            λ0 = c.λ0;
            qp = c.qp;
            sinBeta0 = c.sinBeta0;
            cosBeta0 = c.cosBeta0;
            Rq = c.Rq;
            calcQ = c.calcQ;
            inverseQ = c.inverseQ;
            φ0 = c.φ0;
        } else {
            params = params || {};
            const degreesToRadians = (deg) => deg * Math.PI / 180;
            φ0 = degreesToRadians(params.lat0 !== undefined ? params.lat0 : 0);
            λ0 = degreesToRadians(params.lon0 !== undefined ? params.lon0 : 0);

            a = 6378137.0;
            const f = 1 / 298.257222101;
            e2 = 2 * f - f * f;
            e = Math.sqrt(e2);

            calcQ = (phi) => {
                const sinPhi = Math.sin(phi);
                const eSinPhi = e * sinPhi;
                return (1 - e2) * (
                    sinPhi / (1 - e2 * sinPhi * sinPhi) -
                    (1 / (2 * e)) * Math.log((1 - eSinPhi) / (1 + eSinPhi))
                );
            };

            qp = (1 - e2) * (
                1 / (1 - e2) -
                (1 / (2 * e)) * Math.log((1 - e) / (1 + e))
            );

            const q0 = calcQ(φ0);
            sinBeta0 = q0 / qp;
            cosBeta0 = Math.sqrt(Math.max(0, 1 - sinBeta0 * sinBeta0));
            Rq = a * Math.sqrt(0.5 * qp);

            inverseQ = (q) => {
                let φ = Math.asin(Math.max(-1, Math.min(1, q / 2)));
                const maxIterations = 12;
                const tolerance = 1e-12;

                for (let i = 0; i < maxIterations; i++) {
                    const sinPhi = Math.sin(φ);
                    const eSinPhi = e * sinPhi;
                    const oneMinus = 1 - e2 * sinPhi * sinPhi;

                    const qPhi = (1 - e2) * (
                        sinPhi / oneMinus -
                        (1 / (2 * e)) * Math.log((1 - eSinPhi) / (1 + eSinPhi))
                    );

                    const dqDphi = (1 - e2) / oneMinus;
                    const delta = (q - qPhi) / dqDphi;
                    φ += delta;

                    if (Math.abs(delta) < tolerance) {
                        break;
                    }
                }

                return φ;
            };
        }

        const ρ = Math.sqrt(x * x + y * y);

        if (ρ < 1e-12) {
            return new point(radiansToDegrees(λ0), radiansToDegrees(φ0));
        }

        const Ce = 2 * Math.asin(Math.min(1, ρ / (2 * Rq)));
        const sinCe = Math.sin(Ce);
        const cosCe = Math.cos(Ce);

        const sinBeta = cosCe * sinBeta0 + (y * sinCe * cosBeta0) / ρ;
        const cosBeta = Math.sqrt(Math.max(0, 1 - sinBeta * sinBeta));

        const λ = λ0 + Math.atan2(
            x * sinCe,
            (ρ * cosBeta0 * cosCe) - (y * sinBeta0 * sinCe)
        );

        const q = qp * sinBeta;
        const φ = inverseQ(q);

        const lon = radiansToDegrees(λ);
        const lat = radiansToDegrees(φ);

        return new point(lon, lat);
    };

    /**
     * converts lat/long to Orthographic coords using WGS84 ellipsoid.
     * Orthographic projection shows the Earth as seen from space (azimuthal perspective).
     * @param  lat latitude in decimal degrees
     * @param  lon longitude in decimal degrees
     * @param  params optional projection parameters: {lat0, lon0}
     * @type   point
     * @return point with x, y in meters
     */
    const _LLtoOrthographic = function (lat, lon, params) {
        const degreesToRadians = (deg) => deg * Math.PI / 180;
        
        params = params || {};
        const φ0 = degreesToRadians(params.lat0 !== undefined ? params.lat0 : 0);
        const λ0 = degreesToRadians(params.lon0 !== undefined ? params.lon0 : 0);
        
        // WGS84 Earth radius in meters
        const R = 6378137.0;
        
        // Convert input coordinates to radians
        const φ = degreesToRadians(lat);
        const λ = degreesToRadians(lon);
        
        // Calculate angular distance from center
        const Δλ = λ - λ0;
        
        // Calculate trigonometric values
        const cosφ = Math.cos(φ);
        const sinφ = Math.sin(φ);
        const cosφ0 = Math.cos(φ0);
        const sinφ0 = Math.sin(φ0);
        const cosΔλ = Math.cos(Δλ);
        const sinΔλ = Math.sin(Δλ);
        
        // Orthographic projection formulas
        // x = R * cos(φ) * sin(λ - λ0)
        // y = R * (cos(φ0) * sin(φ) - sin(φ0) * cos(φ) * cos(λ - λ0))
        const x = R * cosφ * sinΔλ;
        const y = R * (cosφ0 * sinφ - sinφ0 * cosφ * cosΔλ);
        
        return new point(x, y);
    };

    /**
     * converts Orthographic coords to lat/long using WGS84 ellipsoid (inverse transformation).
     * @param  x projected x coordinate in meters
     * @param  y projected y coordinate in meters
     * @param  params optional projection parameters: {lat0, lon0}
     * @type   point
     * @return point with lon (x) and lat (y) in decimal degrees
     */
    const _OrthographicToLL = function (x, y, params) {
        const radiansToDegrees = (rad) => rad * 180 / Math.PI;
        const degreesToRadians = (deg) => deg * Math.PI / 180;
        
        params = params || {};
        const φ0 = degreesToRadians(params.lat0 !== undefined ? params.lat0 : 0);
        const λ0 = degreesToRadians(params.lon0 !== undefined ? params.lon0 : 0);
        
        // WGS84 Earth radius in meters
        const R = 6378137.0;
        
        // Calculate distance from center
        const ρ = Math.sqrt(x * x + y * y);
        
        // Check if point is beyond the visible hemisphere
        if (ρ > R) {
            // Point is outside the visible hemisphere, return null or edge point
            return null;
        }
        
        // Calculate angular distance from center
        const c = Math.asin(ρ / R);
        
        // Calculate trigonometric values
        const cosc = Math.cos(c);
        const sinc = Math.sin(c);
        const cosφ0 = Math.cos(φ0);
        const sinφ0 = Math.sin(φ0);
        
        // Handle edge case when ρ is very small (near center)
        if (ρ < 1e-10) {
            return new point(radiansToDegrees(λ0), radiansToDegrees(φ0));
        }
        
        // Inverse orthographic projection formulas
        // φ = asin(cos(c) * sin(φ0) + (y * sin(c) * cos(φ0)) / ρ)
        // λ = λ0 + atan2(x * sin(c), ρ * cos(φ0) * cos(c) - y * sin(φ0) * sin(c))
        const φ = Math.asin(cosc * sinφ0 + (y * sinc * cosφ0) / ρ);
        const λ = λ0 + Math.atan2(x * sinc, ρ * cosφ0 * cosc - y * sinφ0 * sinc);
        
        // Convert to degrees
        const lon = radiansToDegrees(λ);
        const lat = radiansToDegrees(φ);
        
        return new point(lon, lat);
    };

    // ========================================
    // EXPORT TO GLOBAL SCOPE - ONLY ixMap    *
    // ========================================

    // Export the main ixMap constructor to global scope
    window.ixMap = ixMap;

    // Export the global map instance
    window.map = map;

    // ========================================
    // BACKWARD COMPATIBILITY EXPORTS         *
    // ========================================

    // Export essential functions globally for backward compatibility
    // These can be removed in future versions

    window.getMatrix = getMatrix;
    window.setMatrix = setMatrix;
    window.getTranslate = getTranslate;
    window.setTranslate = setTranslate;
    window.getScale = getScale;
    window.setScale = setScale;
    window.getRotateAttributeValue = getRotateAttributeValue;
    window.setRotate = setRotate;
    window.getPatternMatrix = getPatternMatrix;
    window.activateTheme = activateTheme;
    window.getActiveTheme = getActiveTheme;
    window.isActiveTheme = isActiveTheme;
    window.deactivateTheme = deactivateTheme;
    window.clearThemes = clearThemes;
    window.displayTooltip = displayTooltip;
    window.killTooltip = killTooltip;
    window.displayMessage = displayMessage;
    window.clearMessage = clearMessage;
    window.point = point;
    window.box = box;
    window.initAll = initAll;
    window.delayedInitAll = delayedInitAll;
    //window.doInitAll_2 = doInitAll_2;
    //window.load_includes = load_includes;
    //window.setSVGDocument = setSVGDocument;

    // Export coordinate transformation functions
    //window._LLtoUTM = _LLtoUTM;
    //window._UTMtoLL = _UTMtoLL;
    //window._LLtoMercator = _LLtoMercator;
    //window._MercatortoLL = _MercatortoLL;
    //window._LLtoWinkelTripel = _LLtoWinkelTripel;
    //window._LLtoEqualEarth = _LLtoEqualEarth;
    //window._EqualEarthtoLL = _EqualEarthtoLL;
    //window._LLtoAlbersEqualArea = _LLtoAlbersEqualArea;
    //window._AlbersEqualAreatoLL = _AlbersEqualAreatoLL;

    // Export utility functions
    //window.sinh = sinh;
    //window._copysign = _copysign;

    // Export loader classes
    //window.SVGLoader = SVGLoader;
    //window.SVGLoaderTiles = SVGLoaderTiles;
    //window.SVGLoaderMap = SVGLoaderMap;
    //window.JSLoaderPool = JSLoaderPool;
    //window.JSLoader = JSLoader;

    // Export ALL remaining functions for complete access
    window.getData = getData;
    window.AntiZoomAndPan = AntiZoomAndPan;
    window.createTextField = createTextField;
    window.sizeTextField = sizeTextField;
    window.executeWithMessage = executeWithMessage;
    window.doExecuteWithMessage = doExecuteWithMessage;
    window.executeWithProgressBar = executeWithProgressBar;

    // Export ALL helper functions
    /**
    window.__executeMethodLater = __executeMethodLater;
    window.__doExecuteMethodLater = __doExecuteMethodLater;
    window.__scaleStyleString = __scaleStyleString;
    window.__scaleLineStyleString = __scaleLineStyleString;
    window.__scaleTextStyleString = __scaleTextStyleString;
    window.__getFontHeightfromStyleString = __getFontHeightfromStyleString;
    window.__setRotation = __setRotation;
    window.__doSetRotation = __doSetRotation;
    window.__doGetPolygonSurface = __doGetPolygonSurface;
    window.__doGetPolygonCenter = __doGetPolygonCenter;
    window.__getStyleObj = __getStyleObj;
    window.__getStyleArray = __getStyleArray;
    window.__timer_reset = __timer_reset;
    window.__timer_getMS = __timer_getMS;
    window.__timer_getSEC = __timer_getSEC;
    window.__formatTime = __formatTime;
    window.__formatValue = __formatValue;
    window.__maptheme_formatpart = __maptheme_formatpart;
    window.__stripQuotes = __stripQuotes;
    window.__encodeSingleQuote = __encodeSingleQuote;
    window.__encodeDoubleQuotes = __encodeDoubleQuotes;
    window.__decodeSingleQuote = __decodeSingleQuote;
    window.__boxDup = __boxDup;
	**/
    window.__timer_getSEC = __timer_getSEC;
    window.__timer_reset = __timer_reset;
    window.__formatValue = __formatValue;
    window.__getStyleObj = __getStyleObj;
    window.__getStyleArray = __getStyleArray;
    window.__scaleStyleString = __scaleStyleString;
    window.__scaleLineStyleString = __scaleLineStyleString;
    window.__scaleTextStyleString = __scaleTextStyleString;



    // Export ALL theme management functions
    window.highlightTheme = highlightTheme;
    window.highlightThemeRemove = highlightThemeRemove;

    // Export ALL UI functions
    // window.displayTooltipText = displayTooltipText;
    window.nInfoTimeout = nInfoTimeout;
    
    // Export ALL loader functions
    window.loadSVGIncludes = loadSVGIncludes;

    // Export ALL class constructors
    window.MapObject = MapObject;
    window.Methods = Methods;

    // Export ALL logging functions
    window._TRACE = _TRACE;
    window._LOG = _LOG;
    window._STATUS = _STATUS;
    //window._INFO = _INFO;
    //window._KILLINFO = _KILLINFO;
    window._ERROR = _ERROR;

    // Export ALL progress bar functions
    /**
    window.displayProgressBarOld = displayProgressBarOld;
    window.displayProgressBar = displayProgressBar;
    window.clearNotify = clearNotify;
    window.do_clearMessage = do_clearMessage;
    window.doDisplayTooltip = doDisplayTooltip;
    **/
    window.displayProgressBar = displayProgressBar;
    window.do_clearMessage = do_clearMessage;

    // Export constants
    //window.szSVG = szSVG;
    window.szMapNs = szMapNs;
    window.szXlink = szXlink;
    window.szHTTP = szHTTP;
    window.szHTTPS = szHTTPS;
    //window.nStandardPPI = nStandardPPI;
    //window.nScreenPPI = nScreenPPI;
    window.nInch = nInch;
    //window.szViewer = szViewer;



})(); // End of IIFE - All functions are now local!

// .............................................................................
// EOF
// .............................................................................
