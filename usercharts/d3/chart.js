/**********************************************************************
chart.js

$Comment: user chart drawing plugin
$Source : chart.js,v $

$InitialAuthor: guenter richter $
$InitialDate: 2020/04/16 $
$Author: guenter richter $
$Id:chart.js 1 2020-04-16 00:00:00Z Guenter Richter $

Copyright (c) Guenter Richter
$Log:chart.js,v $
**********************************************************************/

/** 
 * @fileoverview This file is a user chart draw plugin for ixmaps
 *
 * @author Guenter Richter guenter.richter@ixmaps.com
 * @version 0.9
 */

/**
 * define namespace ixmaps
 */

window.ixmaps = window.ixmaps || {};
(function() {
	
	// --------------------------------
	// user generated chart 
	// --------------------------------
    
    // --------------------------------
	// helper - define gradient for filling 
	// --------------------------------

	__myGradientId = "myGradient"+Math.random();
	
	__defineGradient = function(target,szId,szColor){

		var mainGradient = target.append('linearGradient')
			.attr('id', szId)
			.attr("x1", "0%")
			.attr("y1", "80%")
			.attr("x2", "0%")
			.attr("y2", "100%");

		// Create the stops of the main gradient. Each stop will be assigned
		// a class to style the stop using CSS.
		mainGradient.append('stop')
			.attr('style', 'stop-color:'+szColor+'')
			.attr('offset', '0');

		mainGradient.append('stop')
			.attr('style', 'stop-color:#dddddd')
			.attr('offset', '1');
		
		// ----------------------------------------------
		
		var mainGradient = target.append('linearGradient')
			.attr('id', szId+"R")
			.attr("x1", "0%")
			.attr("y1", "100%")
			.attr("x2", "0%")
			.attr("y2", "80%");

		// Create the stops of the main gradient. Each stop will be assigned
		// a class to style the stop using CSS.
		mainGradient.append('stop')
			.attr('style', 'stop-color:'+szColor+'')
			.attr('offset', '0');

		mainGradient.append('stop')
			.attr('style', 'stop-color:white')
			.attr('offset', '1');
	}
	
	// --------------------------------------------------
	// init is called once before draw  
	// here we define the gradient for filling the peeks
	// --------------------------------------------------
	
	ixmaps.pinnacleChart_init = function(SVGDocument,args){
		
		// use d3 to draw the chart
		// -------------------------
		var svg = d3.select(args.target);
		
		// Create the svg:defs element and the main gradient definition.
		ixmaps.d3svgDefs = svg.append('defs');
		
		for (i in args.theme.colorScheme){
			__defineGradient(ixmaps.d3svgDefs,__myGradientId+i,args.theme.colorScheme[i]);
		}
	};
	
	// --------------------------------------------------
	// called for every chart of the theme to draw   
	// draw a peak with outline color and gradient filling
	// chart type inspired by NYT pinackle maps
	// --------------------------------------------------
	
	ixmaps.pinnacleChart = function(SVGDocument,args){
        
        // 1. get the height from args
		
		var nValue = args.value || args.values[(args.theme.nActualFrame||args.class||0)];

		if ((nValue < 0) && args.flag.match(/NONEGATIVE/)){
			return false;
		}

		var nMax = Math.max(args.theme.nMax,Math.abs(args.theme.nMin));
		if ( args.theme.nMinValue && (nValue < args.theme.nMinValue) ){
			return false;
		}
		var nHeight = args.item?nValue/nMax*args.maxSize*20:args.maxSize/2*20;
        if ( args.size ){
            nHeight = args.size;
        }
		if ( args.theme.nNormalSizeValue ){
			nHeight = args.item?nValue/args.theme.nNormalSizeValue*args.maxSize*20:args.maxSize/2*20;
		}	
        
        if ( args.size){
 			nHeight = args.item?args.size*20:args.maxSize/2*20;
        }
		nHeight *= args.theme.nRangeScale||1;
        
        // 2. get the color - defined directly or by class
 
 		var szColor = args.color || args.item.szColor || (args.theme.colorScheme[args.class]);
        
        // define a gradient with the given color for the filling 
        //
		var szGradientId = __myGradientId+szColor.replace(/[^a-zA-Z0-9 -]/g,'_');
        if (args.flag.match(/ZOOM/)){
            __defs = d3.select(args.target).append('defs');
            __defineGradient(__defs,szGradientId,szColor);
        } else {
            __defineGradient(ixmaps.d3svgDefs,szGradientId,szColor);
        }
        
 		var szOpacity = args.opacity || args.theme.nOpacity || 1;
		var szFillOpacity = args.fillopacity || args.theme.fillOpacity || 0.6;

		if (nHeight == 0){
			return false;
		}
        
        // ------------------------
        // here we draw the grafic   
        // ------------------------
        
        // use d3 to draw the peaks
		// -------------------------
		var svg = d3.select(args.target);
		
		if ( nHeight>=0 ){
			if ( nHeight> 100 && args.theme.szFlag.match(/SHADOW/)){
				svg.append("path")
					.attr("d", "M0,0 l120,"+(-nHeight/2)+" l100,"+(nHeight/2)+"")
					.attr("style","fill:#888888;stroke:#444444;stroke-width:20;fill-opacity:"+1+";opacity:"+0.5+";")
					.attr("transform","rotate(180) translate(-210 -0) skewX(66) scale(1 0.5)");
			}
			svg.append("path")
				.attr("d", "M0,0 l100,"+(-nHeight)+" l100,"+(nHeight)+"")
				.attr("style","fill:url(#"+szGradientId+");stroke:"+szColor+";stroke-width:20;fill-opacity:"+szFillOpacity+";opacity:"+szOpacity+";");
		}else{
			svg.append("path")
				.attr("d", "M0,0 l100,"+(-nHeight)+" l100,"+(nHeight)+"")
				.attr("style","fill:url(#"+(szGradientId+"R")+");stroke:"+szColor+";stroke-width:20;stroke-opacity:0.3;fill-opacity:"+szFillOpacity+";opacity:"+szOpacity+";");
		}

		if ( args.flag.match(/VALUES|TITLE/) ){

			var nFontSize = Math.sqrt(nHeight)*10;

			// show only if fontsize is reasonable (fontsize is n * 20)
			if ( args.flag.match(/ZOOM/) || (
                nValue > (args.theme.nValueValueMin || 0) && 
                nFontSize > ((args.theme.nValueSizeMin*20)||120) )
               ){
                var szText = ixmaps.formatValue(nValue, (args.theme.nValueDecimals||0)," ") + (args.theme.szUnits||"");
				//var szText = (nValue).toFixed(args.theme.nValueDecimals||0) + (args.theme.szUnits||"");
				var szTextOpacity = 1; // 0.2 + nValue/nMax;

				// show the value on top of the peek
				if (args.flag.match(/VALUES/) ){
                    svg.append("text")
                        .attr("x", 100)
                        .attr("y", -nHeight-nFontSize*0.5)
                        .attr("style","font-family:arial;font-size:"+nFontSize+"px;text-anchor:middle;fill:none;fill-opacity:"+szTextOpacity+";stroke:white;stroke-width:"+nFontSize/7+"px;opacity:"+0.5+";pointer-events:none")
                        .text(szText);
                    svg.append("text")
                        .attr("x", 100)
                        .attr("y", -nHeight-nFontSize*0.5)
                        .attr("style","font-family:arial;font-size:"+nFontSize+"px;text-anchor:middle;fill:"+(args.theme.szValueColor || args.ccolor.lowColor || szColor)+";fill-opacity:"+szTextOpacity+";stroke:none;opacity:"+szOpacity+";pointer-events:none")
                        .text(szText);
                }

				// is there is a chart title defined, show it below the value
				if (args.item.szTitle){
					nFontSize /= 3/(args.theme.nTextScale||1);
					svg.append("text")
						.attr("x", 100)
						.attr("y", -nHeight-nFontSize*0.3)
						.attr("style","font-family:arial;font-size:"+nFontSize+"px;text-anchor:middle;fill:none;fill-opacity:"+szTextOpacity+";stroke:white;stroke-width:"+nFontSize/10+"px;opacity:"+0.6+";pointer-events:none")
						.text(args.item.szTitle);
					svg.append("text")
						.attr("x", 100)
						.attr("y", -nHeight-nFontSize*0.3)
						.attr("style","font-family:arial;font-size:"+nFontSize+"px;text-anchor:middle;fill:#444444;fill-opacity:"+szTextOpacity+";stroke:none;opacity:"+szOpacity+";pointer-events:none")
						.text(args.item.szTitle);
				}
			}
		}
		return {x:0,y:args.item?0:(nHeight+2*20)};
	};

/**
 * end of namespace
 */

})();

// -----------------------------
// EOF
// -----------------------------
