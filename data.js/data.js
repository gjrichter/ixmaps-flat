/**********************************************************************
data.js

$Comment: provides JavaScript for loading, parsing, selection, transforming and caching data tables
$Source :data.js,v $

$InitialAuthor: guenter richter $
$InitialDate: 2016/26/09 $
$Author: guenter richter $
$Id:data.js 1 2016-26-09 10:30:35Z Guenter Richter $

Copyright (c) Guenter Richter
$Log:data.js,v $
**********************************************************************/

/** 
 * @fileoverview
 * provides an object and methods to load, parse and process various data sources.<br>
 * The <b>sources</b> may be of the following type: <b>csv</b>, <b>json</b>, <b>geojson</b>, <b>kml</b>, <b>gml</b>, <b>rss</b>, <b>parquet</b> (using DuckDB WASM), <b>geopackage</b> (using DuckDB WASM), <b>flatgeobuf</b>, and <b>geobuf</b>.<br>
 * The <b>methods</b> to load data are: 
 * <ul><li>Data.<b>feed()</b> to load from url</li>
 * <li>Data.<b>import()</b> to import javascript objects and</li>
 * <li>Data.<b>broker()</b> to load more than one source</li></ul>
 * The loaded data is stored in a Table object which gives the user the methods to transform the data.<br>
 * The format of the data of a Table object is jsonDB, the same format used internaly by iXmaps.
 * @example 
 *
 *  // define data source
 *  var szUrl = "https://raw.githubusercontent.com/emergenzeHack/terremotocentro/master/_data/issues.csv";
 *
 *  // load data from feed
 *  var myfeed = Data.feed({"source":szUrl,"type":"csv"}).load(function(mydata){
 *
 *      // on data load succeeds, process the loaded data via mydata object
 *      // create new columns 'date' and 'hour' from one timestamp column
 *      // we need them to create pivot tables 
 *      // ---------------------------------------------------------------
 *      mydata.addColumn({'source':'created_at','destination':'date'},function(value){
 *          var d = new Date(__normalizeTime(value));
 *          return( String(d.getDate()) + "." + String(d.getMonth()+1) + "." + String(d.getFullYear()) );
 *      });
 *
 *      // get the hours
 *      // -----------------------------------------
 *      var hoursA = mydata.column("hour").values();
 *
 *      // do something ... 
 *
 *      // make a pivot table from the values in column 'state'
 *      // ----------------------------------------------------
 *      var pivot = mydata.pivot({ "lead":	'date',
 *                                 "keep":  ['created_at'],	
 *                                 "cols":	'state' 
 *                               });
 *
 *      // invert data table (let the last record be the first)
 *      // ----------------------------------------------
 *      pivot = pivot.revert();
 *
 *      // make chart with 2 curves, total and closed issues
 *      // -------------------------------------------------
 *      var set1  = pivot.column("Total").values();
 *      var set2  = pivot.column("closed").values();
 *
 *     ....
 * }).error(function(e){
 *      alert("Data.feed error: " + e);
 * });
 *
 * @author Guenter Richter guenter.richter@medienobjekte.de
 * @version 1.58 
 * @copyright CC BY SA
 * @license MIT
 */

(function (window, document, undefined) {


    // write to console with time in sec : millisec
    //
    const _log_start_time = new Date();
    _LOG = function (szLog) {
        var time = ((new Date()) - _log_start_time) / 1000;
        console.log("_LOG: time[sec.ms] " + time + "\n" + szLog);
    };

    // force string arrays 

    /**
     * test if object is array 
     * @param obj the object to test
     * @returns true/false
     * @type {boolean}
     */
    const __isArray = function (obj) {
        return Object.prototype.toString.call(obj) === '[object Array]';
    };
    /**
     * make sure, object is type array 
     * @param obj the object to transform
     * @returns array
     * @type {Array}
     */
    const __toArray = function (obj) {
        if (!obj || typeof (obj) == 'undefined') {
            return [];
        } else
        if (__isArray(obj)) {
            return obj;
        } else {
            return (String(obj).match(/\|/)) ? String(obj).split('|') : String(obj).split(',');
        }
    };

    /**
     * get array with unique values
     * by filter function 
     * @returns array
     * @type {Array}
     */
    const __onlyUnique = function (value, index, self) {
        return self.indexOf(value) === index;
    };

    /** 
     * @namespace 
     */

    var Data = {
        version: "1.58",
        errors: [],
        log: function(message) {
            console.log(message);
        },
        /**
         * cleanupDuckDB
         * Utility function to manually cleanup DuckDB resources
         * Call this from console if you encounter "Resource temporarily unavailable" errors
         * Usage: Data.cleanupDuckDB()
         */
        cleanupDuckDB: function() {
            try {
                console.log("🧹 Starting manual DuckDB cleanup...");
                if (window.duckdb) {
                    // Try to close connection
                    if (window.duckdb.conn) {
                        try {
                            window.duckdb.conn.close();
                            console.log("✅ Closed DuckDB connection");
                        } catch (e) {
                            console.warn("⚠️ Error closing connection:", e.message);
                        }
                    }
                    
                    // Try to terminate the database
                    if (window.duckdb.db) {
                        try {
                            window.duckdb.db.terminate();
                            console.log("✅ Terminated DuckDB database");
                        } catch (e) {
                            console.warn("⚠️ Error terminating database:", e.message);
                        }
                    }
                    
                    // Try to terminate the worker
                    if (window.duckdb.worker) {
                        try {
                            window.duckdb.worker.terminate();
                            console.log("✅ Terminated DuckDB worker");
                        } catch (e) {
                            console.warn("⚠️ Error terminating worker:", e.message);
                        }
                    }
                    
                    // Clear references
                    delete window.duckdb;
                    delete window.duckdbLoaded;
                    delete window.duckdbLoadedForGpkg;
                    delete window.duckdbLoadError;
                    console.log("✅ DuckDB cleanup complete - you can now reload your file");
                } else {
                    console.log("ℹ️ No DuckDB instance found to cleanup");
                }
            } catch (e) {
                console.error("❌ Error during cleanup:", e);
            }
        },
        
        /**
         * Configurable batch size parameters for parquet reading optimization
         * These can be adjusted based on available memory and performance requirements
         */
        batchConfig: {
            // Original conservative batch sizes (restored for stability)
            baseParquetBatchSize: 200000,        // Original parquet loading batch size (100K rows)
            baseWorkerBatchSize: 500000,         // Original worker processing batch size (500K rows)
            baseExtractBatchSize: 200000,        // Original data extraction batch size (100K rows)
            
            // Memory-based scaling factors (conservative)
            memoryScalingFactor: 1.0,           // No scaling - use base sizes
            maxMemoryMB: 512,                   // Conservative memory limit (512MB)
            
            // Worker batch size limits (original values)
            minWorkerBatchSize: 500000,          // Original minimum worker batch size (500K rows)
            maxWorkerBatchSize: 5000000,         // Original maximum worker batch size (5M rows)
            maxCellsPerBatch: 10000000,          // Original maximum cells per worker batch (10M cells)
            
            // Performance monitoring
            enablePerformanceMonitoring: false,  // Disable to reduce overhead
            adaptiveBatchSizing: false,          // Disable adaptive sizing for stability
        },
        
        /**
         * Get optimized batch size based on available memory and dataset characteristics
         * @param {string} batchType - Type of batch ('parquet', 'worker', 'extract')
         * @param {number} datasetRows - Number of rows in dataset
         * @param {number} columnsCount - Number of columns
         * @returns {number} Optimized batch size
         */
        getOptimizedBatchSize: function(batchType, datasetRows, columnsCount) {
            const config = this.batchConfig;
            let baseSize;
            
            // Get base batch size for the type (original simple approach)
            switch (batchType) {
                case 'parquet':
                    baseSize = config.baseParquetBatchSize;
                    break;
                case 'worker':
                    baseSize = config.baseWorkerBatchSize;
                    break;
                case 'extract':
                    baseSize = config.baseExtractBatchSize;
                    break;
                default:
                    baseSize = config.baseParquetBatchSize;
            }
            
            // Simple constraint: don't exceed dataset size
            return Math.min(baseSize, datasetRows);
        },
        
        /**
         * Performance monitoring for batch processing
         */
        performanceMonitor: {
            batchTimes: [],
            memoryUsage: [],
            adaptiveAdjustments: [],
            
            /**
             * Record batch processing performance
             * @param {string} batchType - Type of batch ('parquet', 'worker', 'extract')
             * @param {number} batchSize - Size of the batch processed
             * @param {number} processingTime - Time taken to process batch (ms)
             * @param {number} memoryUsed - Memory used during processing (MB)
             */
            recordBatchPerformance: function(batchType, batchSize, processingTime, memoryUsed) {
                if (!Data.batchConfig.enablePerformanceMonitoring) return;
                
                const record = {
                    timestamp: Date.now(),
                    batchType: batchType,
                    batchSize: batchSize,
                    processingTime: processingTime,
                    memoryUsed: memoryUsed,
                    throughput: batchSize / (processingTime / 1000) // rows per second
                };
                
                this.batchTimes.push(record);
                this.memoryUsage.push(memoryUsed);
                
                // Keep only last 100 records to prevent memory bloat
                if (this.batchTimes.length > 100) {
                    this.batchTimes.shift();
                    this.memoryUsage.shift();
                }
                
                console.log(`Batch performance: ${batchType} batch of ${batchSize.toLocaleString()} rows processed in ${processingTime.toFixed(1)}ms (${record.throughput.toFixed(0)} rows/sec)`);
            },
            
            /**
             * Get performance statistics for a batch type
             * @param {string} batchType - Type of batch to analyze
             * @returns {object} Performance statistics
             */
            getPerformanceStats: function(batchType) {
                const relevantRecords = this.batchTimes.filter(r => r.batchType === batchType);
                if (relevantRecords.length === 0) return null;
                
                const avgThroughput = relevantRecords.reduce((sum, r) => sum + r.throughput, 0) / relevantRecords.length;
                const avgProcessingTime = relevantRecords.reduce((sum, r) => sum + r.processingTime, 0) / relevantRecords.length;
                const avgMemoryUsed = relevantRecords.reduce((sum, r) => sum + r.memoryUsed, 0) / relevantRecords.length;
                
                return {
                    batchType: batchType,
                    recordCount: relevantRecords.length,
                    avgThroughput: avgThroughput,
                    avgProcessingTime: avgProcessingTime,
                    avgMemoryUsed: avgMemoryUsed,
                    recommendedBatchSize: this.calculateOptimalBatchSize(batchType, relevantRecords)
                };
            },
            
            /**
             * Calculate optimal batch size based on performance history
             * @param {string} batchType - Type of batch
             * @param {array} records - Performance records
             * @returns {number} Recommended batch size
             */
            calculateOptimalBatchSize: function(batchType, records) {
                if (records.length < 3) return null;
                
                // Find the batch size with best throughput
                const bestRecord = records.reduce((best, current) => 
                    current.throughput > best.throughput ? current : best
                );
                
                // If we're consistently hitting memory limits, reduce batch size
                const recentMemoryUsage = this.memoryUsage.slice(-10);
                const avgRecentMemory = recentMemoryUsage.reduce((sum, mem) => sum + mem, 0) / recentMemoryUsage.length;
                
                if (avgRecentMemory > Data.batchConfig.maxMemoryMB * 0.8) {
                    return Math.floor(bestRecord.batchSize * 0.8); // Reduce by 20%
                }
                
                // If throughput is good and memory usage is low, we can increase batch size
                if (bestRecord.memoryUsed < Data.batchConfig.maxMemoryMB * 0.5) {
                    return Math.floor(bestRecord.batchSize * 1.2); // Increase by 20%
                }
                
                return bestRecord.batchSize;
            },
            
            /**
             * Log performance summary
             */
            logPerformanceSummary: function() {
                if (!Data.batchConfig.enablePerformanceMonitoring) return;
                
                console.log("Batch Processing Performance Summary:");
                console.log("=====================================");
                
                const types = ['parquet', 'worker', 'extract'];
                types.forEach(type => {
                    const stats = this.getPerformanceStats(type);
                    if (stats) {
                        console.log(`${type.toUpperCase()}:`);
                        console.log(`  Records: ${stats.recordCount}`);
                        console.log(`  Avg Throughput: ${stats.avgThroughput.toFixed(0)} rows/sec`);
                        console.log(`  Avg Processing Time: ${stats.avgProcessingTime.toFixed(1)}ms`);
                        console.log(`  Avg Memory Used: ${stats.avgMemoryUsed.toFixed(1)}MB`);
                        if (stats.recommendedBatchSize) {
                            console.log(`  Recommended Batch Size: ${stats.recommendedBatchSize.toLocaleString()} rows`);
                        }
                        console.log("");
                    }
                });
            }
        },
        
    };

    function expose() {
        const oldData = window.Data;

        Data.noConflict = function () {
            window.Data = oldData;
            return this;
        };

        window.Data = Data;
    }

    // define Data for Node module pattern loaders, including Browserify
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = Data;

        // define Data as an AMD module
    } else if (typeof define === 'function' && define.amd) {
        define(Data);
    }

    // define Data as a global variable, saving the original Data to restore later if needed
    if (typeof window !== 'undefined') {
        expose();
    }

    /**
     * Create a new Data.Object instance.  
     * @class It realizes an object to load and handle internal (already defined as JavaScript object) data sources (CSV,JSON,...)
     * @constructor
     * @param {Object} options <p>{ <b>source</b>: <em>JavaScript object</em>,
     *								   <table border='0' style='border-left: 1px solid #ddd;'>	
     *								   <tr><th>type</th><th>description</th></tr>
     *								   <tr><td><b>"csv"</b></td><td>the source is 'plain text' formatted as Comma Separated Values<br>delimiter supported: , and ;</td></tr>
     *								   <tr><td><b>"json"</b></td><td>the source is JSON (Javascript Object Notation)</td></tr>
     *								   <tr><td><b>"geojson"</b></td><td>the source is a JSON object formatted in <a href="https://geojson.org/" target="_blank">GeoJson</a></td></tr>
     *								   <tr><td><b>"parquet"</b></td><td>the source is a Parquet or GeoParquet file (using DuckDB WASM, converted to GeoJSON)</td></tr>
     *								   <tr><td><b>"gpkg"</b></td><td>the source is a GeoPackage file (using DuckDB WASM spatial extension, converted to GeoJSON)</td></tr>
     *								   <tr><td><b>"rss"</b></td><td>the source is an xml rss feed</td></tr>
     *								   <tr><td><b>"kml"</b></td><td>the source is in Keyhole Markup Language</td></tr>
     *								   <tr><td><b>"gml"</b></td><td>the source is in Geography Markup Language</td></tr>
     *								   </table> 
     * @type {Data.Object}
     * @example
     * // load the data table defined by a JSON object named response and get the values of one column 
     *
     * Data.object({"source":response,"type":"json"}).import(function(mydata){
     *     var a = mydata.column("column name").values();
     *     ...
     * });
     * @returns A new Data.Import object
     */

    Data.Object = function (options) {
        this.options = options;
        this.debug = false;
    };

    Data.Object.prototype = {

        /**
         * set data from the specified source and call user function
         * @param {function} function(result) the function to call when data is successfully imported<br>
         * the argument passed is a Data.Table object with the imported data 
         * @type {Data.Object}
         * @returns itself 
         */
        import: function (callback) {

            this.options.success = this.options.success || callback;

            // we create a dummy Data.feed to use its parser
            this.feed = Data.feed({});

            // pass options to the Data.feed
            this.feed.options = this.options;

            // import data and create table, calls the callback when done
            if ((this.options.type == "csv") || (this.options.type == "CSV")) {
                this.feed.__processCSVData(this.options.source, this.options);
            } else
            if ((this.options.type == "rss") || (this.options.type == "RSS")) {
                this.options.format = "xml";
                this.feed.__processRSSData(this.options.source, this.options);
            } else
            if ((this.options.type == "kml") || (this.options.type == "KML")) {
                this.options.format = "xml";
                this.feed.__processKMLData(this.options.source, this.options);
            } else
            if ((this.options.type == "gml") || (this.options.type == "GML")) {
                this.options.format = "xml";
                this.feed.__processGMLData(this.options.source, this.options);
            } else
            if ((this.options.type == "json") || (this.options.type == "JSON") || (this.options.type == "Json")) {
                this.feed.__processJsonData(this.options.source, this.options);
            } else
            if ((this.options.type == "jsonl") || (this.options.type == "JSONL") || (this.options.type == "ndjson") || (this.options.type == "NDJSON")) {
                this.feed.__processJSONLinesData(this.options.source, this.options);
            } else
            if ((this.options.type == "geojson") || (this.options.type == "GEOJSON") || (this.options.type == "GeoJson")) {
                this.feed.__processGeoJsonData(this.options.source, this.options);
            } else
            if ((this.options.type == "topojson") || (this.options.type == "TOPOJSON") || (this.options.type == "TopoJson")) {
                this.feed.__processTopoJsonData(this.options.source, this.options);
            } else
            if ((this.options.type == "jsonDB") || (this.options.type == "JSONDB") || (this.options.type == "JsonDB") ||
                (this.options.type == "jsondb")) {
                this.feed.__processJsonDBData(this.options.source, this.options);
            } else
            if ((this.options.type == "parquet") || (this.options.type == "PARQUET")) {
                // Check if source is already an ArrayBuffer (from File API)
                if (this.options.source instanceof ArrayBuffer) {
                    _LOG("Processing parquet ArrayBuffer directly: " + this.options.source.byteLength + " bytes");
                    this.feed.__processParquetData(this.options.source, this.options);
                }
            } else
            if ((this.options.type == "geoparquet") || (this.options.type == "GEOPARQUET")) {
                // Check if source is already an ArrayBuffer (from File API)
                if (this.options.source instanceof ArrayBuffer) {
                    _LOG("Processing geoparquet ArrayBuffer directly: " + this.options.source.byteLength + " bytes");
                    this.feed.__processGeoParquetData(this.options.source, this.options);
                }
            } else
            if ((this.options.type == "gpkg") || (this.options.type == "GPKG") || 
                (this.options.type == "geopackage") || (this.options.type == "GEOPACKAGE")) {
                // Check if source is already an ArrayBuffer (from File API)
                if (this.options.source instanceof ArrayBuffer) {
                    _LOG("Processing GeoPackage ArrayBuffer directly: " + this.options.source.byteLength + " bytes");
                    this.feed.__processGpkgData(this.options.source, this.options);
                }
            } else
            if ((this.options.type == "fgb") || (this.options.type == "FGB") || 
                (this.options.type == "flatgeobuf") || (this.options.type == "FLATGEOBUF") ||
                (this.options.type == "FlatGeobuf")) {
                // Check if source is already an ArrayBuffer (from File API)
                if (this.options.source instanceof ArrayBuffer) {
                    _LOG("Processing FlatGeobuf ArrayBuffer directly: " + this.options.source.byteLength + " bytes");
                    this.feed.__processFlatGeobufData(this.options.source, this.options);
                }
            } else
            if ((this.options.type == "pbf") || (this.options.type == "PBF") || 
                (this.options.type == "geobuf") || (this.options.type == "GEOBUF") ||
                (this.options.type == "Geobuf")) {
                // Check if source is already an ArrayBuffer (from File API)
                if (this.options.source instanceof ArrayBuffer) {
                    _LOG("Processing Geobuf ArrayBuffer directly: " + this.options.source.byteLength + " bytes");
                    this.feed.__processGeobufData(this.options.source, this.options);
                }
            }
            return this;
        },
        /**
         * error function
         * define a function to handle a loading error
         * @param {function} function(errorText) a user defined function to call when an error occurs
         * @type {Data.Object}
         * @returns itself  
         */
        error: function (callback) {
            this.options.error = callback;
            return this;
        }
    };

    /**
     * Create a new Data.Import instance.  
     * @class It realizes an object to load and handle internal (already defined as JavaScript object) data sources (CSV,JSON,...)
     * @constructor
     * @param {Object} options <p>{ <b>source</b>: <em>JavaScript object</em>,
     *								   <table border='0' style='border-left: 1px solid #ddd;'>	
     *								   <tr><th>type</th><th>description</th></tr>
     *								   <tr><td><b>"csv"</b></td><td>the source is 'plain text' formatted as Comma Separated Values<br>delimiter supported: , and ;</td></tr>
     *								   <tr><td><b>"json"</b></td><td>the source is JSON (Javascript Object Notation)</td></tr>
     *								   <tr><td><b>"geojson"</b></td><td>the source is a JSON object formatted in <a href="https://geojson.org/" target="_blank">GeoJson</a></td></tr>
     *								   <tr><td><b>"parquet"</b></td><td>the source is a Parquet o GeoParquet file (using DuckDB WASM, converted to GeoJSON)</td></tr>
     *								   <tr><td><b>"gpkg"</b></td><td>the source is a GeoPackage file (using DuckDB WASM spatial extension, converted to GeoJSON)</td></tr>
     *								   <tr><td><b>"flatgeobuf"</b> or <b>"fgb"</b></td><td>the source is a FlatGeobuf file (binary geospatial format, converted to GeoJSON)</td></tr>
     *								   <tr><td><b>"geobuf"</b> or <b>"pbf"</b></td><td>the source is a Geobuf file (Protocol Buffer geospatial format, converted to GeoJSON)</td></tr>
     *								   <tr><td><b>"topojson"</b></td><td>the source is a JSON object formatted in <a href="https://github.com/topojson/topojson" target="_blank">TopoJson</a></td></tr>
     *								   <tr><td><b>"jsonDB"</b></td><td>the source is a jsonDB table object</td></tr>
     *								   <tr><td><b>"rss"</b></td><td>the source is an xml rss feed</td></tr>
     *								   </table> 
     * @type {Data.Object}
     * @example
     * // load the data table defined by a JSON object named response and get the values of one column 
     *
     * table = Data.import({"source":response,"type":"json"});
     *
     * var a = table.column("column name").values();
     * @returns A new Table object
     */

    Data.Import = function (options) {
        this.options = options;
        this.debug = false;
    };

    /**
     * Create a new Data.Feed instance.  
     * @class It realizes an object to load and handle one data sources
     * @constructor
     * @param {Object} options <p>{ <b>source</b>: <em>url or filename</em>,
     *                                <b>type</b>: <em>see table below</em> }</p>
     *								   <table border='0' style='border-left: 1px solid #ddd;'>	
     *								   <tr><th>type</th><th>description</th></tr>
     *								   <tr><td><b>"csv"</b></td><td>the source is 'plain text' formatted as Comma Separated Values<br>delimiter supported: , and ;</td></tr>
     *								   <tr><td><b>"json"</b></td><td>the source is JSON (Javascript Object Notation)</td></tr>
     *								   <tr><td><b>"geojson"</b></td><td>the source is a JSON object formatted in <a href="https://geojson.org/" target="_blank">GeoJson</a></td></tr>
     *								   <tr><td><b>"geoparquet"</b></td><td>the source is a GeoParquet file (using DuckDB WASM, converted to GeoJSON)</td></tr>
     *								   <tr><td><b>"parquet"</b></td><td>the source is a Parquet file (using DuckDB WASM)</td></tr>
     *								   <tr><td><b>"gpkg"</b></td><td>the source is a GeoPackage file (using DuckDB WASM spatial extension, converted to GeoJSON)</td></tr>
     *								   <tr><td><b>"flatgeobuf"</b> or <b>"fgb"</b></td><td>the source is a FlatGeobuf file (binary geospatial format, converted to GeoJSON)</td></tr>
     *								   <tr><td><b>"geobuf"</b> or <b>"pbf"</b></td><td>the source is a Geobuf file (Protocol Buffer geospatial format, converted to GeoJSON)</td></tr>
     *								   <tr><td><b>"JSON-stat"</b></td><td>the source is a JSON object formatted in <a href="https://json-stat.org/JSON-stat" target="_blank">JSON-stat</a></td></tr>
     *								   <tr><td><b>"jsonDB"</b></td><td>the source is in ixmaps internal data table format</td></tr>
     *								   <tr><td><b>"rss"</b></td><td>the source is an xml rss feed</td></tr>
     *								   </table> 
     * @type {Data.Feed}
     * @returns a new Data.Feed object
     * @example
     * var szUrl = "https://raw.githubusercontent.com/emergenzeHack/terremotocentro/master/_data/issues.csv";
     * var myfeed = new Data.Feed("Segnalazioni",{"source":szUrl,"type":"csv"}).load(function(mydata){
     *	
     *    // when the feed is loaded, it calls the function you defined
     *    // with the loaded data as argument; it is a Table object, so you can use its methods
     *    // example: create new columns 'date' and 'hour' from one timestamp column
     *    // ---------------------------------------------------------------
     *    mydata = mydata.addColumn({'source':'created_at','destination':'date'},
     *        function(value){
     *            var d = new Date(__normalizeTime(value));
     *            return( String(d.getDate()) + "." + String(d.getMonth()+1) + "." + String(d.getFullYear()) );
     *     });
     *  });
     *
     *  // Note: instead of new Data.Feed() you can also use the factory function Data.feed()
     *  var myfeed = Data.feed("Segnalazioni",{"source":szUrl,"type":"csv"}).load(function(mydata){
     *  ...
     *     
     */

    Data.Feed = function (options) {
        this.options = options || {};
        this.debug = false;
        this.options.error = function (e) {
            Data.errors.push(e);
        };
    };
    Data.Feed.prototype = {

        /**
         * load the data from the source specified in the Data.Feed instance and call a user defined callback function on success
         * @param {function} function(data) the function to call when data is successfully loaded<br> it receives a {Data.Table} object with the loaded data
         * @type {Object}
         * @returns the {@link Data.Feed} object
         * @example
         * var szUrl = "https://raw.githubusercontent.com/emergenzeHack/terremotocentro/master/_data/issues.csv";
         * var myfeed = Data.feed({"source":szUrl,"type":"csv"}).load(function(mydata){
         *	...
         *  });
         */
        load: function (callback) {

            this.options.success = callback;

            const option = this.options;
            const szUrl = option.source || option.src || option.url || option.ext;

            if (typeof (option.cache) === 'undefined') {
                option.cache = true;
                if (option.options && typeof (option.options.cache) !== 'undefined') {
                    option.cache = option.options.cache;
                }
            }

            const __this = this;

            if (!szUrl) {
                _alert("Data.feed(...).load(): no source defined !", 2000);
            }

            if (!option.type && szUrl) {
                const normalizedUrl = szUrl.split('?')[0].toLowerCase();
                if (normalizedUrl.endsWith(".jsonl") || normalizedUrl.endsWith(".ndjson")) {
                    option.type = "jsonl";
                }
            }

            if ((option.type == "csv") || (option.type == "CSV")) {
                this.__doCSVImport(szUrl, option);
            } else
            if ((option.type == "rss") || (option.type == "RSS")) {
                this.__doRSSImport(szUrl, option);
            } else
            if ((option.type == "kml") || (option.type == "KML")) {
                this.__doKMLImport(szUrl, option);
            } else
            if ((option.type == "gml") || (option.type == "GML")) {
                this.__doGMLImport(szUrl, option);
            } else
            if ((option.type == "json") || (option.type == "JSON") || (option.type == "Json")) {
                this.__doJSONImport(szUrl, option);
            } else
            if ((option.type == "jsonl") || (option.type == "JSONL") || (option.type == "ndjson") || (option.type == "NDJSON")) {
                this.__doJSONLinesImport(szUrl, option);
            } else
            if ((option.type == "geojson") || (option.type == "GEOJSON") || (option.type == "GeoJson")) {
                this.__doGeoJSONImport(szUrl, option);
            } else
            if ((option.type == "topojson") || (option.type == "TOPOJSON") || (option.type == "TopoJson")) {
                this.__doTopoJSONImport(szUrl, option);
            } else
            if ((option.type == "jsonDB") || (option.type == "JSONDB") || (option.type == "JsonDB") || (option.type == "jsondb")) {
                this.__doJsonDBImport(szUrl, option);
            } else
            if ((option.type == "jsonstat") || (option.type == "jsonStat") || (option.type == "JSONSTAT")) {
                $.getScript("http://json-stat.org/lib/json-stat.js")
                    .done(function (script, textStatus) {
                        __this.__doLoadJSONstat(szUrl, option);
                        return;
                    })
                    .fail(function (jqxhr, settings, exception) {
                        _alert("'" + option.type + "' unknown format !");
                    });
            } else
            if ((option.type == "parquet") || (option.type == "PARQUET")) {
                this.__doParquetImport(szUrl, option);
            } else
            if ((option.type == "gpkg") || (option.type == "GPKG") || 
                (option.type == "geopackage") || (option.type == "GEOPACKAGE")) {
                this.__doGpkgImport(szUrl, option);
            } else
            if ((option.type == "fgb") || (option.type == "FGB") || 
                (option.type == "flatgeobuf") || (option.type == "FLATGEOBUF") ||
                (option.type == "FlatGeobuf")) {
                this.__doFlatGeobufImport(szUrl, option);
            } else
            if ((option.type == "pbf") || (option.type == "PBF") || 
                (option.type == "geobuf") || (option.type == "GEOBUF") ||
                (option.type == "Geobuf")) {
                this.__doGeobufImport(szUrl, option);
            } else {
                _alert("'" + option.type + "' unknown format !");
            }
            return this;
        },
        /**
         * define a function to handle a loading error
         * @param {function} function(errorText) a user defined function to call when an error occurs
         * @type {Object}
         * @returns the {@link Data.Feed} object
         * @example
         * var myfeed = Data.feed("Segnalazioni",{"source":szUrl,"type":"csv"})
         *
         *              .error(function(e){alert(e);})
         *
         *              .load(function(mydata){
         *	               ...
         *              });
         */
        error: function (callback) {
            this.options.error = callback;
            return this;
        },
        
        /**
         * Get the file size (in bytes) of the data file that will be loaded
         * Makes a HEAD request to retrieve the Content-Length header
         * @param {function} [callback] Optional callback function that receives the file size in bytes (or null if unavailable)
         * @returns {Promise<number>|Data.Feed} If callback is provided, returns the Feed object for chaining. 
         *                                        If no callback, returns a Promise that resolves with the file size (number) or null.
         * @example
         * // Using callback
         * var myfeed = Data.feed({"source":"https://example.com/data.csv","type":"csv"});
         * myfeed.getFileSize(function(size){
         *     if (size !== null) {
         *         console.log("File size: " + size + " bytes (" + (size/1024/1024).toFixed(2) + " MB)");
         *     } else {
         *         console.log("File size unavailable");
         *     }
         * });
         * 
         * // Using Promise
         * var myfeed = Data.feed({"source":"https://example.com/data.csv","type":"csv"});
         * myfeed.getFileSize().then(function(size){
         *     if (size !== null) {
         *         console.log("File size: " + size + " bytes");
         *     }
         * }).catch(function(error){
         *     console.error("Error getting file size: " + error);
         * });
         * 
         * // Using async/await
         * var myfeed = Data.feed({"source":"https://example.com/data.csv","type":"csv"});
         * try {
         *     var size = await myfeed.getFileSize();
         *     if (size !== null) {
         *         console.log("File size: " + size + " bytes");
         *     }
         * } catch(error) {
         *     console.error("Error: " + error);
         * }
         */
        getFileSize: function (callback) {
            const option = this.options;
            const szUrl = option.source || option.src || option.url || option.ext;
            
            if (!szUrl) {
                const error = "Data.feed(...).getFileSize(): no source defined!";
                if (callback && typeof callback === "function") {
                    callback(null);
                    return this;
                } else {
                    return Promise.reject(new Error(error));
                }
            }
            
            // Create a promise for the file size request
            // Use GET request (same as load() method) to avoid CORS preflight issues
            // We'll read headers without reading the body to minimize data transfer
            const sizePromise = new Promise((resolve, reject) => {
                // Try XMLHttpRequest first - it may handle CORS headers better
                if (typeof XMLHttpRequest !== 'undefined') {
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', szUrl, true);
                    
                    // Set up event handlers
                    xhr.onreadystatechange = function() {
                        if (xhr.readyState === 2) { // HEADERS_RECEIVED
                            // Try to get Content-Length header
                            // Note: CORS may block this header unless server exposes it
                            try {
                                const contentLength = xhr.getResponseHeader('Content-Length');
                                if (contentLength && contentLength.trim() !== '' && contentLength.trim() !== '0') {
                                    const size = parseInt(contentLength.trim(), 10);
                                    if (!isNaN(size) && size > 0) {
                                        xhr.abort(); // Cancel the request since we got what we need
                                        resolve(size);
                                        return;
                                    }
                                }
                            } catch(e) {
                                // Header might not be accessible due to CORS
                            }
                        } else if (xhr.readyState === 4) { // DONE
                            if (xhr.status === 200 || xhr.status === 206) {
                                try {
                                    const contentLength = xhr.getResponseHeader('Content-Length');
                                    if (contentLength && contentLength.trim() !== '' && contentLength.trim() !== '0') {
                                        const size = parseInt(contentLength.trim(), 10);
                                        if (!isNaN(size) && size > 0) {
                                            resolve(size);
                                            return;
                                        }
                                    }
                                } catch(e) {
                                    // Header might not be accessible due to CORS
                                }
                            }
                            // If XMLHttpRequest didn't work, try fetch with Range request
                            if (typeof fetch !== 'undefined') {
                                // Try Range request to get Content-Range header
                                fetch(szUrl, { 
                                    method: 'GET',
                                    headers: { 'Range': 'bytes=0-0' }
                                })
                                .then(rangeResponse => {
                                    const contentRange = rangeResponse.headers.get('content-range');
                                    if (contentRange) {
                                        const match = contentRange.match(/\/(\d+)/);
                                        if (match && match[1]) {
                                            const size = parseInt(match[1], 10);
                                            if (!isNaN(size) && size > 0) {
                                                resolve(size);
                                                return;
                                            }
                                        }
                                    }
                                    // Fallback to regular GET
                                    return fetch(szUrl, { method: 'GET' });
                                })
                                .then(response => {
                                    if (response) {
                                        const contentLength = response.headers.get('content-length');
                                        if (contentLength && contentLength.trim() !== '' && contentLength.trim() !== '0') {
                                            const size = parseInt(contentLength.trim(), 10);
                                            if (!isNaN(size) && size > 0) {
                                                resolve(size);
                                            } else {
                                                resolve(null);
                                            }
                                        } else {
                                            resolve(null);
                                        }
                                    } else {
                                        resolve(null);
                                    }
                                })
                                .catch(() => resolve(null));
                            } else {
                                resolve(null);
                            }
                        }
                    };
                    
                    xhr.onerror = function() {
                        // Fall back to fetch if XHR fails
                        if (typeof fetch !== 'undefined') {
                            fetch(szUrl, { method: 'GET' })
                            .then(response => {
                                const contentLength = response.headers.get('content-length');
                                if (contentLength && contentLength.trim() !== '') {
                                    const size = parseInt(contentLength.trim(), 10);
                                    if (!isNaN(size) && size > 0) {
                                        resolve(size);
                                    } else {
                                        resolve(null);
                                    }
                                } else {
                                    resolve(null);
                                }
                            })
                            .catch(() => resolve(null));
                        } else {
                            resolve(null);
                        }
                    };
                    
                    xhr.send();
                } else if (typeof fetch !== 'undefined') {
                    // Fallback to fetch API if XMLHttpRequest not available
                    // First try: Regular GET request (same as load() uses)
                    // Check Content-Length header from the response
                    fetch(szUrl, { method: 'GET' })
                    .then(response => {
                        if (!response.ok) {
                            // If response is not OK, try Range request
                            throw new Error('Response not OK');
                        }
                        
                        // Check Content-Length header first (most common)
                        const contentLength = response.headers.get('content-length');
                        if (contentLength && contentLength.trim() !== '') {
                            const size = parseInt(contentLength.trim(), 10);
                            if (!isNaN(size) && size > 0) {
                                resolve(size);
                                return;
                            }
                        }
                        
                        // If Content-Length not available or invalid, try Range request as fallback
                        // Range requests return Content-Range header with total size
                        return fetch(szUrl, { 
                            method: 'GET',
                            headers: { 'Range': 'bytes=0-0' }
                        })
                        .then(rangeResponse => {
                            // Check Content-Range header (format: "bytes 0-0/1234567")
                            const contentRange = rangeResponse.headers.get('content-range');
                            if (contentRange) {
                                // Parse Content-Range: bytes 0-0/1234567 or bytes */1234567
                                const match = contentRange.match(/\/(\d+)/);
                                if (match && match[1]) {
                                    const size = parseInt(match[1], 10);
                                    if (!isNaN(size) && size > 0) {
                                        resolve(size);
                                        return;
                                    }
                                }
                            }
                            
                            // For 206 Partial Content, Content-Length is the range size, not total
                            // For 200 OK on Range request, Content-Length should be the full size
                            if (rangeResponse.status === 200 || rangeResponse.status === 206) {
                                const rangeContentLength = rangeResponse.headers.get('content-length');
                                if (rangeContentLength && rangeContentLength.trim() !== '') {
                                    // For 206, this is just the range size, not helpful
                                    // For 200, this should be the full size
                                    if (rangeResponse.status === 200) {
                                        const size = parseInt(rangeContentLength.trim(), 10);
                                        if (!isNaN(size) && size > 0) {
                                            resolve(size);
                                            return;
                                        }
                                    }
                                }
                            }
                            
                            resolve(null);
                        })
                        .catch(() => resolve(null));
                    })
                    .catch(error => {
                        // If fetch fails, try jQuery as fallback
                        if (typeof $ !== 'undefined' && $.ajax) {
                            $.ajax({
                                url: szUrl,
                                type: 'GET',
                                success: function(data, textStatus, jqXHR) {
                                    const contentLength = jqXHR.getResponseHeader('Content-Length');
                                    if (contentLength) {
                                        const size = parseInt(contentLength, 10);
                                        if (!isNaN(size) && size > 0) {
                                            resolve(size);
                                        } else {
                                            resolve(null);
                                        }
                                    } else {
                                        resolve(null);
                                    }
                                },
                                error: function() {
                                    resolve(null);
                                }
                            });
                        } else {
                            resolve(null); // Gracefully return null instead of rejecting
                        }
                    });
                } else if (typeof $ !== 'undefined' && $.ajax) {
                    // Fallback to jQuery if fetch is not available
                    // Use GET instead of HEAD to match load() behavior and avoid CORS issues
                    $.ajax({
                        url: szUrl,
                        type: 'GET',
                        success: function(data, textStatus, jqXHR) {
                            const contentLength = jqXHR.getResponseHeader('Content-Length');
                            if (contentLength) {
                                const size = parseInt(contentLength, 10);
                                if (!isNaN(size) && size > 0) {
                                    resolve(size);
                                } else {
                                    resolve(null);
                                }
                            } else {
                                resolve(null);
                            }
                        },
                        error: function() {
                            resolve(null);
                        }
                    });
                } else {
                    reject(new Error("Neither fetch API nor jQuery available for file size request"));
                }
            });
            
            // Handle callback or return promise
            if (callback && typeof callback === "function") {
                sizePromise
                    .then(size => callback(size))
                    .catch(error => {
                        if (this.options.error && typeof this.options.error === "function") {
                            this.options.error("getFileSize error: " + error.message);
                        }
                        callback(null);
                    });
                return this;
            } else {
                return sizePromise;
            }
        }
    };


    // @section

    // @factory Data.feed(options: Data options)
    // Instantiates a data object to load external data via URL
    // and an object literal with `data options`.
    //

    Data.feed = function (options) {
        return new Data.Feed(options);
    };

    // @factory Data.object(options: Data options)
    // Instantiates a data object
    // and an object literal with `data options`.
    //

    Data.object = function (options) {
        return new Data.Object(options);
    };

    // @factory Data.import(options: Data options)
    // Instantiates a data object to import data into Data
    // and an object literal with `data options`.
    //

    Data.import = function (options) {
        return new Data.Object(options).import().feed.dbtable;
    };
    var ixmaps = ixmaps || {};
    // -----------------------------
    // D A T A    L O A D E R 
    // -----------------------------
    // ---------------------------------
    // J S O N s t a t  
    // ---------------------------------
    /**
     * doLoadJSONstat 
     * reads JSONstat format using JSONstat Javascript
     * parses the data into the map data source
     * @param szUrl JSONstat URL
     * @param opt options
     * @type void
     */
    Data.Feed.prototype.__doLoadJSONstat = function (szUrl, opt) {

        const __this = this;

        JSONstat(szUrl,
            function () {

                const dataA = [];

                // for now we take dimension 0 and 1
                // 0 for the y axis = first column
                // 1 for the x axis = values columns

                // first row = column names
                //
                let row = [this.Dataset(0).Dimension(0).label];
                const index = this.Dataset(0).Dimension(1).id;
                for (let i = 0; i < index.length; i++) {
                    row.push(this.Dataset(0).Dimension(1).Category(index[i]).label);
                }
                dataA.push(row);

                // data rows
                //
                for (let i = 0; i < this.Dataset(0).Dimension(0).length; i++) {
                    row = [];
                    row.push(this.Dataset(0).Dimension(0).Category(this.Dataset(0).Dimension(0).id[i]).label);
                    for (let ii = 0; ii < this.Dataset(0).Dimension(1).length; ii++) {
                        row.push(this.Dataset(0).Data([i, ii]).value);
                    }
                    dataA.push(row);
                }

                // user defined callback
                if (opt.callback) {
                    opt.callback(dataA, opt);
                    return;
                }

                // finish the data table object 
                __this.__createDataTableObject(dataA, opt.type, opt);

            });
    };

    // ---------------------------------
    // J s o n D B 
    // ---------------------------------

    /**
     * doJsonDBImport 
     * reads JsonDB files from URL
     * JsonDB files are regural JavaScript files, the data object is parsed automatically on load 
     * @param file filename
     * @param i filenumber
     * @type void
     */
    Data.Feed.prototype.__doJsonDBImport = function (szUrl, opt) {

        _LOG("__doJsonDBImport: " + szUrl);
        const __this = this;

        opt.url = szUrl;

        $.getScript(szUrl + ".gz")
            .done(function (script, textStatus) {
                __this.__processJsonDBData(script, opt);
            })
            .fail(function (jqxhr, settings, exception) {
                $.getScript(szUrl)
                    .done(function (script, textStatus) {
                        __this.__processJsonDBData(script, opt);
                    })
                    .fail(function (jqxhr, settings, exception) {
                        if (__this.options.error) {
                            __this.options.error("\"" + szUrl + "\" " + exception);
                        }
                    });
            });
    };

    Data.Feed.prototype.__processJsonDBData = function (script, opt) {

        _LOG("__processJsonDBData:");

        // create data object
        // ------------------
        this.dbtable = new Data.Table();
        let loadedTable = null;
        if (typeof (script) == "string") {
            const name = opt.source.split(/\//).pop().split(/\./)[0];
            loadedTable = (typeof window !== "undefined" ? window[name] : global[name]);
        } else {
            loadedTable = opt.source;
        }

        this.dbtable.table = loadedTable.table;
        this.dbtable.fields = loadedTable.fields;
        this.dbtable.records = loadedTable.records;

        // user defined callback ??
        if (opt.callback) {
            opt.callback(newData, opt);
            return;
        }

        // deploy the object into the map
        // ------------------------------
        if ((typeof (opt) != "undefined") && opt.success) {
            opt.success(this.dbtable);
        }
    };


    // ---------------------------------
    // C S V 
    // ---------------------------------

    /**
     * __doCSVImport 
     * reads CSV files from URL
     * parses the data into the map data source
     * @param szUrl csv file url
     * @param opt optional options
     * @type void
     */
    Data.Feed.prototype.__doCSVImport = function (szUrl, opt) {

        _LOG("__doCSVImport: " + szUrl);
        const __this = this;
        $.ajax({
            type: "GET",
            url: szUrl,
            cache: opt.cache,
            dataType: "text",
            success: function (data) {
                __this.__processCSVData(data, opt);
            },
            error: function (jqxhr, settings, exception) {
                if ((typeof (opt) != "undefined") && opt.error) {
                    opt.error("\"" + szUrl + "\" " + exception);
                }
            }
        });
    };

    /**
     * __processCSVData
     * Parses the loaded CSV text data and creates a data object.
     *
     * @param {string} csv - The CSV text string.
     * @param {Object} opt - Optional options.
     * @param {function} [opt.callback] - A callback function to receive the raw parsed data.
     * @param {Object} [opt.parser] - Papa Parse options.
     * @param {function} [opt.error] - A callback function to handle parsing errors.
     * @param {Object} [opt.options] - Additional options (e.g., name).
     * @param {string} [opt.type] - The data type (e.g., "csv").
     * @returns {boolean} - Returns false if there's an error or a callback is defined.
     */
    Data.Feed.prototype.__processCSVData = function (csv, opt) {
        _LOG("__processCSVData - start");

        // Check if Papa Parse is loaded. If not, load it and retry.
        if (typeof Papa === "undefined") {
            _LOG("__processCSVData:load csv parser!");
            const __this = this;
            $.getScript("https://cdnjs.cloudflare.com/ajax/libs/PapaParse/4.1.2/papaparse.min.js")
                .done(function (script, textStatus) {
                    __this.__processCSVData(csv, opt);
                })
                .fail(function (jqxhr, settings, exception) {
                    _alert("'" + opt.type + "' parser not loaded !");
                    if (opt.error) {
                        opt.error("'" + opt.type + "' parser not loaded !");
                    }
                });
            return false; // Indicates that the function is waiting for the parser to load.
        }

        // Parse the CSV data.
        let parsedData = Papa.parse(csv, opt.parser);
        
        if (parsedData.errors.length){
            _alert("csv parsing error: " + parsedData.errors.map(e=>e.message).join(';'));
            if (opt.error) {
                opt.error("csv parsing error: " + parsedData.errors.map(e=>e.message).join(';'));
            }
            return false;
        }
        let newData = parsedData.data;

        // Check if the parsing resulted in at least two rows.
        if (newData.length < 2 || typeof newData[0] === "undefined" || typeof newData[1] === "undefined") {
            _alert("csv parsing error: insufficient rows in data !");
            if (opt.error) {
                opt.error("csv parsing error: insufficient rows in data !");
            }
            return false;
        }
       
        // Check if delimiter was not set.
        if (!opt.parser || !opt.parser.delimiter) {
             // Check if autodetect delimiter failed.
            if (newData[0].length !== newData[1].length) {
                _LOG("csv parser: autodetect failed");
                const delimiters = [";", ","];
                let success = false;
                for (const delimiter of delimiters) {
                    _LOG(`csv parser: delimiter = ${delimiter}`);
                    newData = Papa.parse(csv, { delimiter }).data;
                    if (newData[0].length === newData[1].length) {
                        success = true;
                        break;
                    }
                    _LOG(`csv parser: delimiter = ${delimiter} failed`);
                }
                if (!success) {
                    _alert("csv parsing error: unable to auto detect delimiter!");
                    if (opt.error) {
                        opt.error("csv parsing error: unable to auto detect delimiter!");
                    }
                    return false;
                }
            }
        }

        // Clean up trailing empty rows and columns.
        if (newData[newData.length - 1].length !== newData[0].length && newData.length > 1) {
            newData.pop();
        }

        // Clean up extra empty columns
        if (newData[0].length - newData[1].length === 1) {
            if (newData[0][newData[0].length - 1].trim() === "") {
                newData[0].pop();
            }
        }

        // User-defined callback with raw data.
        if (opt.callback) {
            opt.callback(newData, opt);
            return false;
        }

        _LOG("__createDataTableObject: " + (opt.options ? " -> " + opt.options.name : ""));
        // Finish and create the data table object.
        this.__createDataTableObject(newData, opt.type, opt);

        return false;
    };

    // ---------------------------------
    // R S S
    // ---------------------------------

    /**
     * __doRSSImport 
     * reads RSS feed from URL
     * parses the data into a table
     * @param szUrl rss feed url
     * @param opt optional options
     * @type void
     */
    Data.Feed.prototype.__doRSSImport = function (szUrl, opt) {

        _LOG("__doRSSImport: " + szUrl);
        const __this = this;

        opt.format = "xml";

        $.ajax({
            type: "GET",
            url: szUrl,
            dataType: "xml",
            success: function (data) {
                __this.__processRSSData(data, opt);
            },
            error: function (jqxhr, settings, exception) {
                if ((typeof (opt) != "undefined") && opt.error) {
                    opt.error(jqxhr, settings, exception);
                }
            }
        });

    };

    /**
     * __processRSSData 
     * parse the loaded RSS xml data and create data object
     * @param the rss object
     * @param opt optional options
     * @type void
     */
    Data.Feed.prototype.__processRSSData = function (data, opt) {

        if (opt.format == "xml") {

            if ($(data).find('rss').length) {
                this.__parseRSSData(data, opt);
            } else
            if ($(data).find('feed').length) {
                _alert("feed not yet supported");
            } else
            if ($(data).find('atom').length) {
                _alert("atom not yet supported");
            }
        }
    };

    /**
     * __parseRSSData 
     * parse the loaded RSS xml data and create data object
     * @param the rss object
     * @param opt optional options
     * @type void
     */
    Data.Feed.prototype.__parseRSSData = function (data, opt) {

        const __this = this;

        if (opt.format == "xml") {

            $(data).find('channel').each(function () {

                const dataA = [];
                let childNamesA = null;

                $(data).find('item').each(function () {

                    // get item fieldnames from the first item of the channel
                    // ------------------------------------------------------
                    if (!childNamesA) {
                        const check = [];
                        childNamesA = [];
                        const childs = $(this).children();
                        for (let i = 0; i < childs.length; i++) {
                            let szNode = $(this).children()[i].nodeName;
                            while (check[szNode]) {
                                szNode += "*";
                            }
                            check[szNode] = szNode;
                            childNamesA[i] = szNode;
                        }

                        dataA.push(childNamesA);
                    }

                    // make one item values
                    const row = [];
                    for (let i = 0; i < childNamesA.length; i++) {
                        if (childNamesA[i] == "enclosure") {
                            row.push(($(this).find(childNamesA[i] + ':first').attr("url")) || "");
                        } else {
                            row.push(($(this).find(childNamesA[i] + ':first').text()) || "");
                        }
                    }
                    dataA.push(row);
                });

                __this.__createDataTableObject(dataA, "rss", opt);

            });
        }
    };

    // ---------------------------------
    // K M L
    // ---------------------------------

    /**
     * __doKMLImport 
     * reads KML feed from URL
     * parses the data into a table
     * @param szUrl kml feed url
     * @param opt optional options
     * @type void
     */
    Data.Feed.prototype.__doKMLImport = function (szUrl, opt) {

        _LOG("__doKMLImport: " + szUrl);
        const __this = this;

        opt.format = "xml";

        $.ajax({
            type: "GET",
            url: szUrl,
            dataType: "xml",
            success: function (data) {
                __this.__processKMLData(data, opt);
            },
            error: function (jqxhr, settings, exception) {
                if ((typeof (opt) != "undefined") && opt.error) {
                    opt.error(jqxhr, settings, exception);
                }
            }
        });

    };

    /**
     * __doGMLImport 
     * reads GML feed from URL
     * parses the data into a table
     * @param szUrl gml feed url
     * @param opt optional options
     * @type void
     */
    Data.Feed.prototype.__doGMLImport = function (szUrl, opt) {

        _LOG("__doGMLImport: " + szUrl);
        const __this = this;

        opt.format = "xml";

        $.ajax({
            type: "GET",
            url: szUrl,
            dataType: "xml",
            success: function (data) {
                __this.__processGMLData(data, opt);
            },
            error: function (jqxhr, settings, exception) {
                if ((typeof (opt) != "undefined") && opt.error) {
                    opt.error(jqxhr, settings, exception);
                }
            }
        });

    };

    /**
     * __processKMLData 
     * parse the loaded KML xml data and create data object
     * @param the kml object
     * @param opt optional options
     * @type void
     */
    Data.Feed.prototype.__processKMLData = function (data, opt) {

        if (opt.format == "xml") {

            if ($(data).find('kml').length) {
                this.__parseKMLData(data, opt);
            } else {
                _alert("feed not kml");
            }
        }
    };
    /**
     * __parseRSSData 
     * parse the loaded RSS xml data and create data object
     * @param the rss object
     * @param opt optional options
     * @type void
     */
    Data.Feed.prototype.__parseKMLData = function (data, opt) {

        const __this = this;

        if (opt.format == "xml") {

            const document = $(data).find('Document');

            const dataA = [];
            let childNamesA = null;

            document.find('Placemark').each(function () {

                const xdata = $(this).find('ExtendedData') || $(this);

                // get item fieldnames from the first item of the channel
                // ------------------------------------------------------
                if (!childNamesA) {
                    childNamesA = [];
                    xdata.find('Data').each(function () {
                        childNamesA.push($(this).attr("name"));
                    });
                    if ($(this).find('Point').find('coordinates')) {
                        childNamesA.push('KML.Point');
                    }
                    dataA.push(childNamesA);
                }

                // make one item values
                const row = [];
                xdata.find('Data').each(function () {
                    row.push($(this).find("value").text());
                });
                if ($(this).find('Point').find('coordinates')) {
                    row.push($(this).find('Point').find('coordinates').text());
                }
                dataA.push(row);

            });

            __this.__createDataTableObject(dataA, "kml", opt);

        }
    };

    /**
     * __processGMLData 
     * parse the loaded GML xml data and create data object
     * @param the gml object
     * @param opt optional options
     * @type void
     */
    Data.Feed.prototype.__processGMLData = function (data, opt) {

        if (opt.format == "xml") {

            if ( typeof(data) === "string"){
                parser = new DOMParser();
                data = parser.parseFromString(data,"text/xml");
            }
            console.log(data);
            console.log($(data).find('wfs\\:FeatureCollection, gml\\:FeatureCollection, FeatureCollection'));
            if ($(data).find('wfs\\:FeatureCollection, gml\\:FeatureCollection, FeatureCollection').length) {
                this.__parseGMLData(data, opt);
            } else {
                _alert("feed not gml");
            }
        }
    };

    /**
     * __parseGMLData 
     * parse the loaded GML xml data and create data object
     * @param the gml object
     * @param opt optional options
     * @type void
     */
    Data.Feed.prototype.__parseGMLData = function (data, opt) {

        const __this = this;

        if (opt.format == "xml") {

            // Look for FeatureCollection (GML 3.x) or gml:FeatureCollection (GML 2.x)
            const featureCollection = $(data).find('wfs\\:FeatureCollection, FeatureCollection').first();
            
            if (featureCollection.length === 0) {
                _alert("No FeatureCollection found in GML data");
                return;
            }

            const dataA = [];
            let childNamesA = null;

            // Process each feature member
            featureCollection.find('wfs\\:member, gml\\:featureMember, featureMember, gml\\:featureMembers, featureMembers').each(function () {
                
                const feature = $(this).find('gml\\:*, *').first();
                if (feature.length === 0) return;

                // Get fieldnames from the first feature
                if (!childNamesA) {
                    childNamesA = [];
                    
                    // Add property columns
                    feature.find('gml\\:*, *').each(function () {
                        const tagName = $(this).prop('tagName');
                        if (tagName && !tagName.match(/^(gml:)?(boundedBy|location|pos|coordinates|geometry|geometryProperty)$/i)) {
                            childNamesA.push(tagName.replace(/^gml:/, ''));
                        }
                    });
                    
                    // Add geometry column
                    childNamesA.push('GML.Geometry');
                    
                    dataA.push(childNamesA);
                }

                // Extract feature data
                const row = [];
                
                
                // Add property values
                feature.find('gml\\:*, *').each(function () {
                    const tagName = $(this).prop('tagName');
                    if (tagName && !tagName.match(/^(gml:)?(boundedBy|location|pos|coordinates|geometry|geometryProperty)$/i)) {
                        row.push($(this).text());
                    }
                });
                
                // Add geometry data
                const geometry = feature.find('gml\\:Polygon').first();
                if (geometry.length > 0) {
                    let value = '{"type":"Polygon","coordinates":[['; 
                    let coords = (geometry.text().split(" "));
                    let start = 0;
                    
                    // Find the first valid number
                    for (var i = 0; i < coords.length; i++){
                        if (Number(coords[i]) && !isNaN(Number(coords[i]))){
                            start = i;
                            break;
                        }
                    }
                    
                    console.log("coords:", coords);
                    console.log("start:", start);
                    console.log("coords length:", coords.length);
                    
                    // Check if we have enough coordinates
                    if (start < coords.length - 1) {
                        console.log("coords[start]:", coords[start]);
                        console.log("coords[start+1]:", coords[start+1]);
                        
                        // Process coordinates in pairs
                        for (i = start; i < coords.length - 1; i += 2) {
                            if (coords[i] && coords[i+1] && 
                                !isNaN(Number(coords[i])) && !isNaN(Number(coords[i+1]))) {
                                value += (i>start?',':'')+ '[' + coords[i+1] + ',' + coords[i] + ']';
                            }
                        }
                    }
                    
                    value += ']]}';
                    console.log("final value:", value);                    
                    row.push(value);
                } else {
                    row.push('');
                }
                
                dataA.push(row);
            });

            __this.__createDataTableObject(dataA, "gml", opt);

        }
    };

    // ---------------------------------
    // J S O N  
    // ---------------------------------

    /** 
     * __doJSONImport 
     * reads a simple JSON table 
     * parses the data into the map data source
     * @param file filename
     * @param i filenumber
     * @type void
     */
    Data.Feed.prototype.__doJSONImport = function (szUrl, opt) {

        const __this = this;
        $.get(szUrl,
            function (data) {
                __this.__processJsonData(data, opt);
            }).fail(function (e) {
            if ((typeof (opt) != "undefined") && opt.error) {
                opt.error(e);
            }
        });

    };

    /**
     * __doJSONLinesImport
     * reads a JSON Lines (NDJSON) file and processes it line by line
     * @param {string} szUrl - jsonl file url
     * @param {Object} opt - optional options
     * @type void
     */
    Data.Feed.prototype.__doJSONLinesImport = function (szUrl, opt) {

        _LOG("__doJSONLinesImport: " + szUrl);
        const __this = this;

        $.ajax({
            type: "GET",
            url: szUrl,
            cache: opt.cache,
            dataType: "text",
            success: function (data) {
                __this.__processJSONLinesData(data, opt);
            },
            error: function (jqxhr, settings, exception) {
                if ((typeof (opt) != "undefined") && opt.error) {
                    opt.error("\"" + szUrl + "\" " + exception);
                }
            }
        });
    };

     /**
     * Generates a list of paths for all leaf nodes in a nested data structure,
     * replicating the traversal and path construction logic of the provided JavaScript code.
     *
     * @param {any} dataItem The current element (object, array, or primitive value) to explore.
     * @param {string} currentPath The accumulated path prefix up to the current element.
     * @returns {string[]} A list of strings, where each string represents a complete path
     *                     to a leaf node in the data structure.
     */
    __getNestedPaths = function(dataItem, currentPath = "") {
        const paths = [];

        // If the current element is an object (but not null and not an array)
        if (typeof dataItem === "object" && dataItem !== null && !Array.isArray(dataItem)) {
            for (const key in dataItem) {
                // Make sure the property is the object's own and not inherited
                if (Object.prototype.hasOwnProperty.call(dataItem, key)) {
                    const value = dataItem[key];
                    // Build the new path by appending the key
                    const newPath = currentPath ? `${currentPath}.${key}` : key;
                    paths.push(...__getNestedPaths(value, newPath));
                }
            }
        }
        // If the current element is an array
        else if (Array.isArray(dataItem)) {
            dataItem.forEach((value, index) => {
                // The original JavaScript code includes array indices in the path.
                // We replicate this behavior by adding the index to the path.
                const newPath = currentPath ? `${currentPath}.${index}` : String(index);
                paths.push(...__getNestedPaths(value, newPath));
            });
        }
        // Base case: the current element is neither an object nor an array, so it's a leaf node.
        // Add the accumulated path to the list.
        else {
            paths.push(currentPath);
        }

        return paths;
    };
   
    /**
     * Recursively extracts "leaf" values from a data element,
     * following the structure defined by a schema element.
     * Handles null values by pushing the string 'null'.
     *
     * @param {any} dataItem The current element from the actual data (e.g., data[i][a]).
     * @param {any} schemaItem The current element from the schema (e.g., data[0][a]).
     * @returns {Array<any>} A list of extracted values.
     */
    __extractValuesRecursive = function(dataItem, schemaItem) {
        let extractedValues = [];

        // Special case: if the data element is null, add the string 'null' as per original logic.
        if (dataItem === null || typeof dataItem === "undefined") {
            extractedValues.push('null');
        }
        // If the schema element is an object (not null, not an array), explore it recursively.
        // Use schemaItem to guide the traversal of properties.
        else if (typeof schemaItem === "object" && schemaItem !== null && !Array.isArray(schemaItem)) {
            for (const key in schemaItem) {
                // Make sure the property is the schema object's own and not inherited.
                if (Object.prototype.hasOwnProperty.call(schemaItem, key)) {
                    // Check if the data element has the corresponding property.
                    // If not, dataItem[key] will be undefined, which will be treated as a primitive.
                    const valueToProcess = Object.prototype.hasOwnProperty.call(dataItem, key) ? dataItem[key] : undefined;
                    extractedValues = extractedValues.concat(__extractValuesRecursive(valueToProcess, schemaItem[key]));
                }
            }
        }
        // If the schema element is an array, explore it recursively.
        // Use schemaItem to guide traversal by index.
        else if (Array.isArray(schemaItem)) {
            // Iterate through indices defined by the schema.
            for (let index = 0; index < schemaItem.length; index++) {
                // Check if the data element has a value at the corresponding index.
                // If not, dataItem[index] will be undefined, which will be treated as a primitive.
                const valueToProcess = index < dataItem.length ? dataItem[index] : undefined;
                extractedValues = extractedValues.concat(__extractValuesRecursive(valueToProcess, schemaItem[index]));
            }
        }
        // Base case: the schema element is neither an object nor an array (i.e., it's a primitive).
        // This means dataItem is the "leaf" value we want to extract.
        else {
            extractedValues.push(dataItem);
        }

        return extractedValues;
    };
    /** 
     * __processJsonData 
     * reads a simple JSON table 
     * parses the data into the map data source
     * @param file filename
     * @param i filenumber
     * @type void
     */
    Data.Feed.prototype.__processJsonData = function (script, opt) {

        const tryProcessAsJSONLines = () => {
            if (typeof script !== "string") {
                return false;
            }

            const lines = script.split(/\r?\n/).filter(line => line.trim().length);
            if (lines.length < 2) {
                return false;
            }

            const sampleCount = Math.min(lines.length, 5);
            for (let i = 0; i < sampleCount; i++) {
                const line = lines[i].trim();
                try {
                    JSON.parse(line);
                } catch (error) {
                    return false;
                }
            }

            this.__processJSONLinesData(script, opt);
            return true;
        };

        let data = null;
        
        if (typeof (script) == "string") {
            try {
                data = JSON.parse(script);
            } catch (e) {
                if (tryProcessAsJSONLines()) {
                    return;
                }
                this.__createDataTableObject([], "json", opt);
                return;
            }
        } else {
            data = script;
        }
        this.data = data;

        let dataA = [];
        let row = [];

        // json with structure data.columns[] data.rows[][]
        // -------------------------------------------------
        if (data && data.data && data.data.columns && data.data.rows) {

            const columns = data.data.columns;
            const rows = data.data.rows;

            for (let i = 0, len = columns.length; i < len; i++) {
                row.push(columns[i]);
            }
            dataA.push(row);

            for (let i = 0, len = rows.length; i < len; i++) {
                row = [];
                for (let ii = 0, row0Len = rows[0].length; ii < row0Len; ii++) {
                    row.push(rows[i][ii]);
                }
                dataA.push(row);
            }

            // json without database structure
            // -------------------------------------------------
        } else {
            // if initial data object, take the data within
            if (data && data.data) {
                data = data.data;
            }

           // if initial object is not an array, search the first one 
           if( !Array.isArray(data) ) {
               
                __findAllArraysInJson = function (jsonObject){
                    const arrays = [];
                    function __recurse(obj) {
                    // Check if the current object is an array
                        if (Array.isArray(obj)) {
                            arrays.push(obj);
                        } else if (typeof obj === 'object' && obj !== null) {
                            // If it's an object, iterate over its keys
                            for (const key in obj) {
                                if (obj.hasOwnProperty(key)) {
                                    __recurse(obj[key]); // Recur for each key
                                }
                            }
                        }
                    }
                    __recurse(jsonObject);
                    return arrays;
                }; 
               
                let arrayA = __findAllArraysInJson(data);
                data = arrayA[0];
            }
            
            // was not able to parse json
            // set source as result
            
            if (!data){
                let dataA = [];
                dataA.push(["unknown type"]);
                const scriptA = script.split('\n');
                for (let i = 0, len = scriptA.length; i < len; i++){
                    dataA.push([scriptA[i]]);
                }
                this.__createDataTableObject(dataA, "json", opt); 
                return;
            }
            
            // create first row with field names
            dataA.push(__getNestedPaths(data[0]));

            // create data rows
            for (let i = 0; i < data.length; i++) {
                dataA.push(__extractValuesRecursive(data[i], data[0]));
            }
        }

        // finish the data table object 
        this.__createDataTableObject(dataA, "json", opt);
    };

    /**
     * __processJSONLinesData
     * parses JSON Lines (NDJSON) content and converts it into a tabular structure
     * @param {string|Array|Object} content - The JSONL content (string or pre-parsed).
     * @param {Object} opt - Options object.
     * @type void
     */
    Data.Feed.prototype.__processJSONLinesData = function (content, opt) {

        _LOG("__processJSONLinesData - start");

        let records = [];
        const parseErrors = [];

        if (Array.isArray(content)) {
            records = content;
        } else if (typeof content === "string") {
            const lines = content.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) {
                    continue;
                }
                try {
                    const parsed = JSON.parse(line);
                    records.push(parsed);
                } catch (e) {
                    parseErrors.push({ lineNumber: i + 1, error: e.message, line: line });
                }
            }
        } else if (content && typeof content === "object") {
            // some callers might pass a {data: [...] } structure
            if (Array.isArray(content.data)) {
                records = content.data;
            } else {
                records = [content];
            }
        }

        if (parseErrors.length) {
            console.warn("⚠️ JSONL parse warnings:", parseErrors.slice(0, 5));
        }

        if (!records.length) {
            console.warn("⚠️ No records parsed from JSONL source");
            if (opt && opt.error) {
                opt.error("JSONL parsing error: no valid records found");
            }
            this.__createDataTableObject([], "jsonl", opt);
            return;
        }

        // Collect column names preserving first-seen order
        const columns = [];
        const columnIndex = {};
        const registerColumn = function (key) {
            if (typeof key === "undefined" || key === null) {
                return;
            }
            if (!Object.prototype.hasOwnProperty.call(columnIndex, key)) {
                columnIndex[key] = columns.length;
                columns.push(key);
            }
        };

        const normalizeRecord = (record) => {
            if (record === null || typeof record === "undefined") {
                return {};
            }
            if (Array.isArray(record)) {
                return { value: JSON.stringify(record) };
            }
            if (typeof record === "object") {
                return record;
            }
            return { value: record };
        };

        const formattedRecords = records.map(normalizeRecord);

        formattedRecords.forEach((record) => {
            for (const key in record) {
                if (Object.prototype.hasOwnProperty.call(record, key)) {
                    registerColumn(key);
                }
            }
        });

        if (!columns.length) {
            columns.push("value");
        }

        const dataA = [columns];

        const convertCellValue = (value) => {
            if (value === null || typeof value === "undefined") {
                return '';
            }
            if (typeof value === "object") {
                try {
                    return JSON.stringify(value);
                } catch (e) {
                    return '';
                }
            }
            return value;
        };

        formattedRecords.forEach((record) => {
            const row = columns.map((columnName) => {
                const cellValue = Object.prototype.hasOwnProperty.call(record, columnName) ? record[columnName] : '';
                return convertCellValue(cellValue);
            });
            dataA.push(row);
        });

        if (opt && opt.callback) {
            opt.callback(dataA, opt);
            return;
        }

        this.__createDataTableObject(dataA, "jsonl", opt);
    };


    // ---------------------------------
    // G E O - J S O N  
    // ---------------------------------

    /** 
     * __doGeoJSONImport 
     * reads a simple JSON table 
     * parses the data into the map data source
     * @param file filename
     * @param i filenumber
     * @type void
     */
    Data.Feed.prototype.__doGeoJSONImport = function (szUrl, opt) {

        const __this = this;
        $.get(szUrl,
            function (data) {
                __this.__processGeoJsonData(data, opt);
            }).fail(function (e) {
            if ((typeof (opt) != "undefined") && opt.error) {
                opt.error(e);
            }
        });

    };
    /** 
     * __processGeoJsonData 
     * reads a simple JSON table 
     * parses the data into the map data source
     * @param file filename
     * @param i filenumber
     * @type void
     */
    Data.Feed.prototype.__processGeoJsonData = function (script, opt) {
        let data = null;

        if (typeof script === "string") {
            try {
                data = JSON.parse(script);
            } catch (e) {
                this.__createDataTableObject([], "json", opt);
                return; // Exit early on parse error
            }
        } else {
            data = script;
        }
        this.data = data;

        const dataA = [];
        const columns = {};

        if (data && data.features && data.features.length) {
            // Collect all unique property keys from all features
            for (const feature of data.features) {
                if (feature.properties) {
                    for (const p in feature.properties) {
                        columns[p] = true;
                    }
                }
            }

            // Create the header row (column names)
            const headerRow = Object.keys(columns);
            headerRow.push("geometry");
            dataA.push(headerRow);

            // Create data rows for each feature
            for (const feature of data.features) {
                const row = [];
                const properties = feature.properties || {}; // Handle cases where properties might be missing

                // Populate data based on the header row order
                for (let p = 0; p < headerRow.length - 1; p++) {
                    const propertyName = headerRow[p];
                    const propertyValue = properties[propertyName];

                    if (typeof propertyValue === "object") {
                        row.push(JSON.stringify(propertyValue));
                    } else {
                        row.push(propertyValue !== undefined ? propertyValue : "");
                    }
                }

                // Add the geometry to the row
                row.push(JSON.stringify(feature.geometry));
                dataA.push(row);
            }
        }

        // Finish the data table object
        this.__createDataTableObject(dataA, "json", opt);
    };

    /** 
     * __processGeoJsonData_expandProperty
     * reads a simple JSON table 
     * parses the data into the map data source
     * @param file filename
     * @param i filenumber
     * @type void
     */
    Data.Feed.prototype.__processGeoJsonData_expandProperty = function (script, opt) {

        let data = null;
        
        if (typeof (script) == "string") {
            try {
                data = JSON.parse(script);
            } catch (e) {
                this.__createDataTableObject([], "json", opt);
            }
        } else {

            data = script;
        }
        this.data = data;

        let dataA = [];
        let row = [];
        const columns = [];

        if (data && data.features && data.features.length) {

            for (let i = 0; i < data.features.length; i++) {
                for (const p in data.features[i].properties) {
                    if (typeof data.features[i].properties[p] === "string" || typeof data.features[i].properties[p] === "number") {
                        columns[p] = true;
                    } else {
                        for (const pp in data.features[i].properties[p]) {
                            columns[p + "." + pp] = true;
                        }
                    }
                }
            }
            for (const p in columns) {
                row.push(p);
            }
            row.push("geometry");
            dataA.push(row);

            for (let i = 0; i < data.features.length; i++) {
                row = [];
                for (let p = 0; p < dataA[0].length - 1; p++) {
                    const xA = dataA[0][p].split(".");
                    if (xA.length >= 2) {
                        row.push(data.features[i].properties[xA[0]][xA[1]] || "");
                    } else {
                        row.push(data.features[i].properties[dataA[0][p]] || "");
                    }
                }
                row.push(JSON.stringify(data.features[i].geometry));
                dataA.push(row);
            }
        }
        // finish the data table object 
        this.__createDataTableObject(dataA, "json", opt);
    };

    // ---------------------------------
    // T O P O - J S O N  
    // ---------------------------------

    /** 
     * __doTopoJSONImport 
     * reads a topojson feed 
     * parses the data into the map data source
     * @param file filename
     * @param i filenumber
     * @type void
     */
    Data.Feed.prototype.__doTopoJSONImport = function (szUrl, opt) {

        const __this = this;
        $.get(szUrl,
            function (data) {
                __this.__processTopoJsonData(data, opt);
            }).fail(function (e) {
            if ((typeof (opt) != "undefined") && opt.error) {
                opt.error(e);
            }
        });

    };
    /** 
     * __processTopoJsonData 
     * parses topojson data into the map data source
     * @param file filename
     * @param i filenumber
     * @type void
     */
    Data.Feed.prototype.__processTopoJsonData = function (script, opt) {

        if (typeof (topojson) == "undefined") {
            _alert("'" + opt.type + "' parser not loaded !");
            return;
        }
        let data = null;
        if (typeof (script) == "string") {
            try {
                data = JSON.parse(script);
            } catch (e) {
                this.__createDataTableObject([], "json", opt);
            }
        } else {
            data = script;
        }
        this.data = data;

        let topoObject = null;

        // select topojson object by given name
        if (opt.options && opt.options.name && data.objects[opt.options.name]) {
            topoObject = topojson.feature(data, data.objects[opt.options.name]);
        } else
            // or take the first object
            for (var i in data.objects) {
                topoObject = topojson.feature(data, data.objects[i]);
                break;
            }

        for (const i in topoObject.features) {
            topoObject.features[i].properties.id = topoObject.features[i].id;
        }

        this.__processGeoJsonData(topoObject, opt);
    };

    // ---------------------------------------
    // P A R Q U E T   e   G E O P A R Q U E T 
    // ---------------------------------------

    /**
     * __doParquetImport
     * reads parquet file from URL using DuckDB WASM module
     * @param szUrl parquet file url
     * @param opt options object
     * @type void
     */
    Data.Feed.prototype.__doParquetImport = function (szUrl, opt) {
        _LOG("__doParquetImport: " + szUrl);
        
        const __this = this;
        
        // Use Fetch API instead of jQuery AJAX for better binary handling
        _LOG("Attempting to load parquet file using Fetch API...");
        
        fetch(szUrl, {
            method: 'GET',
            cache: opt.cache ? 'default' : 'no-cache'
        })
        .then(response => {
            _LOG("Fetch response received, status: " + response.status);
            _LOG("Response headers: " + JSON.stringify([...response.headers.entries()]));
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Get the response as ArrayBuffer
            return response.arrayBuffer();
        })
        .then(arrayBuffer => {
            _LOG("Successfully loaded parquet as ArrayBuffer: " + arrayBuffer.byteLength + " bytes");
            
            // Verify this looks like a parquet file
            const uint8Array = new Uint8Array(arrayBuffer);
            if (uint8Array.length >= 4) {
                const magic = String.fromCharCode(...uint8Array.slice(0, 4));
                _LOG("Magic number: " + magic);
                if (magic === 'PAR1') {
                    _LOG("✅ SUCCESS: Valid parquet file detected!");
                    __this.__processParquetData(arrayBuffer, opt);
                } else {
                    _LOG("⚠️ Warning: Magic number is not PAR1: " + magic);
                    _LOG("First 16 bytes: " + Array.from(uint8Array.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
                    
                    // Even if magic number is wrong, try to process it
                    _LOG("Attempting to process anyway...");
                    __this.__processParquetData(arrayBuffer, opt);
                }
            } else {
                _LOG("⚠️ Warning: Response too short to check magic number");
                __this.__processParquetData(arrayBuffer, opt);
            }
        })
        .catch(error => {
            _LOG("Fetch failed: " + error.message);
            
            // Fallback to XMLHttpRequest if Fetch fails
            _LOG("Falling back to XMLHttpRequest...");
            __this.__loadParquetWithXHR(szUrl, opt);
        });
    };

    /**
     * __loadParquetWithXHR
     * fallback method using XMLHttpRequest if Fetch fails
     * @param szUrl parquet file url
     * @param opt options object
     * @type void
     */
    Data.Feed.prototype.__loadParquetWithXHR = function (szUrl, opt) {
        const __this = this;
        
        _LOG("Loading parquet with XMLHttpRequest...");
        
        const xhr = new XMLHttpRequest();
        xhr.open('GET', szUrl, true);
        xhr.responseType = 'arraybuffer';
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                const arrayBuffer = xhr.response;
                _LOG("XHR successful: " + arrayBuffer.byteLength + " bytes");
                
                // Verify this looks like a parquet file
                const uint8Array = new Uint8Array(arrayBuffer);
                if (uint8Array.length >= 4) {
                    const magic = String.fromCharCode(...uint8Array.slice(0, 4));
                    _LOG("XHR magic number: " + magic);
                    if (magic === 'PAR1') {
                        _LOG("✅ SUCCESS: Valid parquet file via XHR!");
                        __this.__processParquetData(arrayBuffer, opt);
                    } else {
                        _LOG("⚠️ Warning: XHR magic number is not PAR1: " + magic);
                        _LOG("First 16 bytes: " + Array.from(uint8Array.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
                        
                        // Even if magic number is wrong, try to process it
                        _LOG("Attempting to process anyway...");
                        __this.__processParquetData(arrayBuffer, opt);
                    }
                } else {
                    _LOG("⚠️ Warning: XHR response too short to check magic number");
                    __this.__processParquetData(arrayBuffer, opt);
                }
            } else {
                _LOG("XHR failed with status: " + xhr.status + " " + xhr.statusText);
                if (typeof opt !== "undefined" && opt.error) {
                    opt.error("XHR failed: " + xhr.status + " " + xhr.statusText);
                } else {
                    _alert("XHR failed: " + xhr.status + " " + xhr.statusText);
                }
            }
        };
        
        xhr.onerror = function() {
            _LOG("XHR network error");
            if (typeof opt !== "undefined" && opt.error) {
                opt.error("XHR network error");
            } else {
                _alert("XHR network error");
            }
        };
        
        xhr.send();
    };

    /**
     * __checkGeoParquetMetadataWithDuckDB
     * Helper function to check GeoParquet metadata using DuckDB WASM
     * @param parquetBuffer ArrayBuffer containing parquet data
     * @param resolve callback function for success
     * @param reject callback function for error
     */
    Data.Feed.prototype.__checkGeoParquetMetadataWithDuckDB = function (parquetBuffer, resolve, reject) {
        const __this = this;
        
        try {
            console.log("🔍 Checking GeoParquet metadata with DuckDB WASM...");
            
            // Create a copy of the parquet buffer to avoid modifying the original
            const parquetBufferCopy = parquetBuffer.slice();
            
            // Register the parquet buffer as a temporary file in DuckDB's virtual filesystem
            const tempFileName = 'temp_parquet_' + Date.now() + '.parquet';
            
            window.duckdb.db.registerFileBuffer(tempFileName, new Uint8Array(parquetBufferCopy))
                .then(function() {
                    console.log("Parquet file registered in DuckDB virtual filesystem");
                    
                    // Query the actual data to get column names and types
                    const metadataQuery = `
                        SELECT * FROM read_parquet('${tempFileName}') LIMIT 1
                    `;
                    
                    return window.duckdb.conn.query(metadataQuery);
                })
                .then(function(result) {
                    console.log("Metadata query result type:", typeof result);
                    console.log("Metadata query result methods:", Object.getOwnPropertyNames(result));
                    console.log("Metadata query result:", result);
                    
                    let isGeoParquet = false;
                    
                    // Handle different DuckDB result formats
                    let rows;
                    if (typeof result.toArray === 'function') {
                        rows = result.toArray();
                        console.log("Using toArray(), rows:", rows);
                    } else if (typeof result.fetchAll === 'function') {
                        rows = result.fetchAll();
                        console.log("Using fetchAll(), rows:", rows);
                    } else if (Array.isArray(result)) {
                        rows = result;
                        console.log("Result is array, rows:", rows);
                    } else if (result.data && Array.isArray(result.data)) {
                        rows = result.data;
                        console.log("Using result.data, rows:", rows);
                    } else {
                        console.warn("⚠️ Cannot extract rows from metadata result, assuming regular parquet");
                        console.log("Full result object:", result);
                        resolve(false);
                        return;
                    }
                    
                    // Check if any column has geometry-related names
                    if (rows && rows.length > 0) {
                        console.log("Checking columns for geometry indicators...");
                        
                        // Get column names from the first row
                        const firstRow = rows[0];
                        const columnNames = Object.keys(firstRow);
                        
                        console.log("Column names found:", columnNames);
                        
                        // Check for common geometry column names
                        const geoColumns = ['geometry', 'geom', 'the_geom', 'wkb_geometry', 'shape'];
                        for (const columnName of columnNames) {
                            const lowerColumnName = columnName.toLowerCase();
                            console.log(`Checking column: ${columnName}`);
                            
                            if (geoColumns.includes(lowerColumnName)) {
                                console.log("✅ GeoParquet detected via geometry column name:", columnName);
                                isGeoParquet = true;
                                break;
                            }
                        }
                        
                        // Also check if any column contains geometry data (WKB, GeoJSON, etc.)
                        for (const columnName of columnNames) {
                            const lowerColumnName = columnName.toLowerCase();
                            if (lowerColumnName.includes('wkb') || lowerColumnName.includes('geojson') || 
                                lowerColumnName.includes('wkt') || lowerColumnName.includes('coordinates')) {
                                console.log("✅ GeoParquet detected via geometry-related column name:", columnName);
                                isGeoParquet = true;
                                break;
                            }
                        }
                    } else {
                        console.log("No rows found in metadata query");
                    }
                    
                    console.log("🎯 Final GeoParquet detection result:", isGeoParquet);
                    resolve(isGeoParquet);
                })
                .catch(function(error) {
                    console.warn("⚠️ Error checking GeoParquet metadata, assuming regular parquet:", error);
                    // If metadata check fails, assume it's a regular parquet file
                    resolve(false);
                })
                .finally(function() {
                    // Clean up the temporary file
                    try {
                        window.duckdb.db.dropFile(tempFileName);
                    } catch (cleanupError) {
                        console.warn("Warning: Could not clean up temporary file:", cleanupError);
                    }
                });
                
        } catch (error) {
            console.error("❌ Error in GeoParquet detection:", error);
            reject(error);
        }
    };

    // ============================================================================
    // PARQUET PROCESSING HELPER FUNCTIONS
    // ============================================================================
    
    /**
     * Detect column types from DuckDB schema for optimized processing
     * @param {Object} schema - DuckDB result schema
     * @returns {Array} Array of type strings ('string', 'number', 'boolean', 'date', 'geometry', 'array', 'other')
     */
    Data.Feed.prototype.__detectColumnTypes = function(schema) {
        if (!schema || !schema.fields) return null;
        
        const types = schema.fields.map(field => {
            const typeStr = field.type.toString().toLowerCase();
            const fieldName = field.name.toLowerCase();
            
            let detectedType;
            
            // Check for geometry columns (by type or name)
            // Also check for blob/binary types which often contain geometry
            if (typeStr.includes('geometry') || typeStr.includes('wkb') || typeStr.includes('wkt') ||
                typeStr.includes('blob') || typeStr.includes('binary') ||
                fieldName === 'geometry' || fieldName === 'geom' || fieldName === 'wkb_geometry' || 
                fieldName === 'wkt_geometry' || fieldName.includes('shape')) {
                detectedType = 'geometry';
            } else if (typeStr.includes('list') || typeStr.includes('array')) {
                // Array/List columns
                detectedType = 'array';
            } else if (typeStr.includes('utf8') || typeStr.includes('string') || typeStr.includes('varchar')) {
                detectedType = 'string';
            } else if (typeStr.includes('int') || typeStr.includes('float') || typeStr.includes('double') || typeStr.includes('decimal')) {
                detectedType = 'number';
            } else if (typeStr.includes('bool')) {
                detectedType = 'boolean';
            } else if (typeStr.includes('date') || typeStr.includes('timestamp')) {
                detectedType = 'date';
            } else {
                detectedType = 'other';
            }
            
            // Log special column types
            if (detectedType === 'geometry') {
                Data.log(`🗺️ Detected geometry column: "${field.name}" (type: ${typeStr})`);
            } else if (detectedType === 'array') {
                Data.log(`📋 Detected array column: "${field.name}" (type: ${typeStr})`);
            }
            
            return detectedType;
        });
        
        return types;
    };
    /**
     * Convert geometry data (WKB, WKT, or binary) to GeoJSON string
     * @param {*} geometryValue - Geometry in WKB (ArrayBuffer/Uint8Array), WKT (string), or other format
     * @returns {string} GeoJSON representation as string
     */
    Data.Feed.prototype.__convertGeometryToGeoJSON = function(geometryValue) {
        if (!geometryValue) return '';
        
        try {
            // If it's binary (WKB as ArrayBuffer or any typed array view)
            if (geometryValue instanceof ArrayBuffer || ArrayBuffer.isView(geometryValue)) {
                const bytes = geometryValue instanceof Uint8Array
                    ? geometryValue
                    : new Uint8Array(
                        geometryValue.buffer || geometryValue,
                        geometryValue.byteOffset || 0,
                        geometryValue.byteLength || (geometryValue.length || 0)
                    );
                return this.__parseWKB(bytes);
            }
            // If it's an array of byte values (e.g. returned as plain array)
            if (Array.isArray(geometryValue) && geometryValue.length && typeof geometryValue[0] === 'number') {
                const bytes = Uint8Array.from(geometryValue);
                return this.__parseWKB(bytes);
            }
            // If it's already a GeoJSON string
            else if (typeof geometryValue === 'string') {
                // Check if it's WKT format
                if (geometryValue.match(/^(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)\s*\(/i)) {
                    // It's WKT - convert to simple GeoJSON
                    return this.__wktToGeoJSON(geometryValue);
                }
                // Check if it's already GeoJSON
                else if (geometryValue.trim().startsWith('{')) {
                    return geometryValue; // Already GeoJSON string
                }
                // Unknown string format - return as-is
                return geometryValue;
            }
            // If it's an object, stringify it
            else if (typeof geometryValue === 'object') {
                // Some engines return binary columns as plain objects with numeric keys {0:...,1:...}
                const keys = Object.keys(geometryValue);
                if (keys.length && keys.every(key => /^\d+$/.test(key))) {
                    const bytes = new Uint8Array(keys.length);
                    keys.sort((a, b) => a - b).forEach((key, idx) => {
                        bytes[idx] = geometryValue[key];
                    });
                    return this.__parseWKB(bytes);
                }
                return JSON.stringify(geometryValue);
            }
            
            return String(geometryValue);
        } catch (error) {
            console.warn("⚠️ Failed to convert geometry to GeoJSON:", error);
            console.warn("⚠️ Geometry value that failed:", geometryValue);
            // Ensure we always return a valid string
            try {
                return JSON.stringify(geometryValue);
            } catch (e2) {
                return String(geometryValue || '');
            }
        }
    };

    /**
     * Helper to detect plain objects that represent byte sequences (e.g., {0:1,1:237,...})
     * @param {*} value
     * @returns {boolean}
     */
    Data.Feed.prototype.__isNumericKeyObject = function(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return false;
        }
        const keys = Object.keys(value);
        if (!keys.length) {
            return false;
        }
        // Avoid treating small objects as geometry
        if (keys.length < 4) {
            return false;
        }
        return keys.every(key => /^\d+$/.test(key));
    };
    
    /**
     * Parse WKB (Well-Known Binary) geometry to GeoJSON string
     * @param {Uint8Array} bytes - WKB binary data
     * @returns {string} GeoJSON string
     */
    Data.Feed.prototype.__parseWKB = function(bytes) {
        try {
            if (bytes.length < 5) return '';
            
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            const result = this.__readWKBGeometry(view, 0);
            if (result && result.geometry) {
                return JSON.stringify(result.geometry);
            }
        } catch (error) {
            console.warn("⚠️ WKB parsing error:", error);
        }
        
        // Fallback: return hex representation so data isn't lost
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        return JSON.stringify({ type: "WKB", wkb: hex });
    };
    /**
     * Internal helper to read WKB geometry recursively
     * @param {DataView} view - DataView of WKB data
     * @param {number} offset - Current offset in bytes
     * @returns {{geometry: Object, offset: number}}
     */
    Data.Feed.prototype.__readWKBGeometry = function(view, offset) {
        if (offset + 5 > view.byteLength) {
            throw new Error("WKB buffer too small");
        }
        
        const littleEndian = view.getUint8(offset) === 1;
        let cursor = offset + 1;
        let geomType = view.getUint32(cursor, littleEndian);
        cursor += 4;
        
        // Determine dimensionality (Z/M) using ISO 13249-3 (WKB: type + 1000 for Z, +2000 for M)
        const modifier = Math.floor(geomType / 1000);
        const baseType = geomType % 1000;
        const hasZ = modifier === 1 || modifier === 3;
        const hasM = modifier === 2 || modifier === 3;
        
        const readCoordinate = () => {
            const coord = [];
            coord.push(view.getFloat64(cursor, littleEndian)); // x
            cursor += 8;
            coord.push(view.getFloat64(cursor, littleEndian)); // y
            cursor += 8;
            if (hasZ) {
                coord.push(view.getFloat64(cursor, littleEndian)); // z
                cursor += 8;
            }
            if (hasM) {
                coord.push(view.getFloat64(cursor, littleEndian)); // m
                cursor += 8;
            }
            return coord;
        };
        
        const readPointGeometry = () => {
            const coords = readCoordinate();
            return { type: "Point", coordinates: coords };
        };
        
        const readLineStringGeometry = () => {
            const numPoints = view.getUint32(cursor, littleEndian);
            cursor += 4;
            const coordinates = [];
            for (let i = 0; i < numPoints; i++) {
                coordinates.push(readCoordinate());
            }
            return { type: "LineString", coordinates };
        };
        
        const readPolygonGeometry = () => {
            const numRings = view.getUint32(cursor, littleEndian);
            cursor += 4;
            const rings = [];
            for (let i = 0; i < numRings; i++) {
                const numPoints = view.getUint32(cursor, littleEndian);
                cursor += 4;
                const ring = [];
                for (let j = 0; j < numPoints; j++) {
                    ring.push(readCoordinate());
                }
                rings.push(ring);
            }
            return { type: "Polygon", coordinates: rings };
        };
        
        let geometry;
        switch (baseType) {
            case 1: // Point
                geometry = readPointGeometry();
                break;
            case 2: // LineString
                geometry = readLineStringGeometry();
                break;
            case 3: // Polygon
                geometry = readPolygonGeometry();
                break;
            case 4: { // MultiPoint
                const numPoints = view.getUint32(cursor, littleEndian);
                cursor += 4;
                const coordinates = [];
                for (let i = 0; i < numPoints; i++) {
                    const result = this.__readWKBGeometry(view, cursor);
                    cursor = result.offset;
                    if (result.geometry.type === "Point") {
                        coordinates.push(result.geometry.coordinates);
                    } else {
                        coordinates.push(result.geometry);
                    }
                }
                geometry = { type: "MultiPoint", coordinates };
                break;
            }
            case 5: { // MultiLineString
                const numLines = view.getUint32(cursor, littleEndian);
                cursor += 4;
                const coordinates = [];
                for (let i = 0; i < numLines; i++) {
                    const result = this.__readWKBGeometry(view, cursor);
                    cursor = result.offset;
                    if (result.geometry.type === "LineString") {
                        coordinates.push(result.geometry.coordinates);
                    } else {
                        coordinates.push(result.geometry);
                    }
                }
                geometry = { type: "MultiLineString", coordinates };
                break;
            }
            case 6: { // MultiPolygon
                const numPolygons = view.getUint32(cursor, littleEndian);
                cursor += 4;
                const coordinates = [];
                for (let i = 0; i < numPolygons; i++) {
                    const result = this.__readWKBGeometry(view, cursor);
                    cursor = result.offset;
                    if (result.geometry.type === "Polygon") {
                        coordinates.push(result.geometry.coordinates);
                    } else {
                        coordinates.push(result.geometry);
                    }
                }
                geometry = { type: "MultiPolygon", coordinates };
                break;
            }
            case 7: { // GeometryCollection
                const numGeoms = view.getUint32(cursor, littleEndian);
                cursor += 4;
                const geometries = [];
                for (let i = 0; i < numGeoms; i++) {
                    const result = this.__readWKBGeometry(view, cursor);
                    cursor = result.offset;
                    geometries.push(result.geometry);
                }
                geometry = { type: "GeometryCollection", geometries };
                break;
            }
            default: {
                // Unknown type - return hex fallback
                const length = view.byteLength - offset;
                const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length);
                const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
                geometry = { type: "WKB", wkb: hex, geomType: geomType };
                cursor = view.byteLength;
                break;
            }
        }
        
        return { geometry, offset: cursor };
    };
    
    /**
     * Simple WKT to GeoJSON converter (basic implementation)
     * @param {string} wkt - WKT string
     * @returns {string} GeoJSON string
     */
    Data.Feed.prototype.__wktToGeoJSON = function(wkt) {
        try {
            // Simple POINT parsing
            const pointMatch = wkt.match(/POINT\s*\(\s*([^\s]+)\s+([^\s]+)\s*\)/i);
            if (pointMatch) {
                return JSON.stringify({
                    type: "Point",
                    coordinates: [parseFloat(pointMatch[1]), parseFloat(pointMatch[2])]
                });
            }
            
            // For complex geometries, return as-is (WKT string)
            // Can be enhanced with a full WKT parser library if needed
            return JSON.stringify({ type: "WKT", wkt: wkt });
        } catch (error) {
            return wkt; // Return original on error
        }
    };
    
    /**
     * Convert a single value to string based on schema type (fast path)
     * @param {*} value - Value to convert
     * @param {string} columnType - Type from schema ('string', 'number', 'boolean', 'date', 'geometry', 'array', 'other')
     * @returns {string} Converted value
     */
    Data.Feed.prototype.__convertValue = function(value, columnType) {
        if (value == null) return '';
        
        if (columnType) {
            // Schema-based fast path (no runtime type checking!)
            switch (columnType) {
                case 'geometry':
                    // Convert geometry to GeoJSON string
                    return this.__convertGeometryToGeoJSON(value);
                case 'array':
                    // Convert array to readable string format
                    if (Array.isArray(value)) {
                        return JSON.stringify(value); // Standard array: [value1, value2, ...]
                    } else if (value && typeof value === 'object' && typeof value.toArray === 'function') {
                        // Arrow/DuckDB array object - convert to normal array first
                        return JSON.stringify(value.toArray());
                    } else if (value && typeof value === 'object') {
                        // Other array-like object
                        try {
                            return JSON.stringify(Array.from(value));
                        } catch (e) {
                            return JSON.stringify(value);
                        }
                    }
                    return String(value);
                case 'string':
                    return value; // Already string, no conversion!
                case 'number':
                case 'boolean':
                    return String(value);
                case 'date':
                    return value instanceof Date ? value.toISOString() : String(value);
                default:
                    return typeof value === 'string' ? value : (typeof value === 'object' ? JSON.stringify(value) : String(value));
            }
        } else {
            // Fallback: runtime type detection
            if (typeof value === 'string') {
                return value;
            } else if (typeof value === 'number' || typeof value === 'boolean') {
                return String(value);
            } else if (value instanceof Date) {
                return value.toISOString();
            } else if (Array.isArray(value)) {
                if (value.length && value.every(item => typeof item === 'number')) {
                    try {
                        return this.__convertGeometryToGeoJSON(Uint8Array.from(value));
                    } catch (e) {
                        // fall through to JSON formatting
                    }
                }
                return JSON.stringify(value);
            } else if (value && typeof value === 'object' && typeof value.toArray === 'function') {
                // Handle Arrow/DuckDB array objects
                try {
                    return JSON.stringify(value.toArray());
                } catch (e) {
                    return JSON.stringify(value);
                }
            } else if (value && typeof value === 'object') {
                if (this.__isNumericKeyObject(value)) {
                    try {
                        const keys = Object.keys(value).map(Number).sort((a, b) => a - b);
                        const bytes = new Uint8Array(keys.length);
                        keys.forEach((key, idx) => {
                            bytes[idx] = value[key];
                        });
                        return this.__convertGeometryToGeoJSON(bytes);
                    } catch (e) {
                        // fall through to JSON formatting
                    }
                }
                return JSON.stringify(value);
            } else {
                try {
                    return JSON.stringify(value);
                } catch (e) {
                    return String(value || '');
                }
            }
        }
    };
    
    /**
     * Process a single row into array format
     * @param {*} rowData - Row data (array or object)
     * @param {Array} columns - Column names
     * @param {Array} columnTypes - Column types (optional, for optimization)
     * @param {boolean} isArrayFormat - Whether data is in array format
     * @param {boolean} isObjectFormat - Whether data is in object format
     * @returns {Array} Processed row as array of strings
     */
    Data.Feed.prototype.__processRow = function(rowData, columns, columnTypes, isArrayFormat, isObjectFormat) {
        const row = new Array(columns.length);
        
        for (let j = 0; j < columns.length; j++) {
            // Get value based on format
            let value;
            if (isArrayFormat) {
                value = rowData[j];
            } else if (isObjectFormat) {
                value = rowData[columns[j]];
            } else {
                value = rowData;
            }
            
            // Convert value (uses schema optimization if available)
            row[j] = this.__convertValue(value, columnTypes ? columnTypes[j] : null);
        }
        
        return row;
    };

    /**
     * __scheduleIdleWork
     * Smart scheduler that uses requestIdleCallback when available, falls back to setTimeout
     * Provides optimal task scheduling based on browser idle time for better performance
     * 
     * @param {function} workFn - Work function to execute, receives deadline parameter (null in fallback mode)
     * @param {number} timeout - Timeout in ms for requestIdleCallback (default: 1000)
     * @returns {Promise} Promise that resolves when work is complete
     */
    Data.Feed.prototype.__scheduleIdleWork = function(workFn, timeout) {
        return new Promise((resolve, reject) => {
            // Check if requestIdleCallback is available (Chrome, Firefox, Edge)
            if (typeof requestIdleCallback === 'function') {
                // Use requestIdleCallback for smarter scheduling (20-30% faster)
                requestIdleCallback((deadline) => {
                    try {
                        workFn(deadline);
                        resolve();
                    } catch (error) {
                        console.error("❌ Error in idle work:", error);
                        reject(error);
                    }
                }, { timeout: timeout || 1000 });
            } else {
                // Fallback to setTimeout for browsers without requestIdleCallback (Safari, IE11)
                setTimeout(() => {
                    try {
                        workFn(null); // No deadline in fallback mode
                        resolve();
                    } catch (error) {
                        console.error("❌ Error in scheduled work:", error);
                        reject(error);
                    }
                }, 0);
            }
        });
    };

    /**
     * __createParquetWorker
     * Creates an inline Web Worker for processing parquet data in a separate thread
     * This provides maximum performance and keeps the UI fully responsive
     */
    Data.Feed.prototype.__createParquetWorker = function () {
        // Inline worker code as a string
        const workerCode = `
            // Web Worker for processing parquet data
            self.onmessage = function(e) {
                const { rows, columns, isArrayFormat, isObjectFormat, batchSize } = e.data;
                
                try {
                    const cellsPerRow = columns.length;
                    const totalRows = rows.length;
                    let processedRows = 0;
                    
                    // Process data in batches
                    for (let batchStart = 0; batchStart < totalRows; batchStart += batchSize) {
                        const batchEnd = Math.min(batchStart + batchSize, totalRows);
                        const batchData = [];
                        
                        // Process batch
                        for (let i = batchStart; i < batchEnd; i++) {
                            const row = new Array(cellsPerRow);
                            
                            for (let j = 0; j < cellsPerRow; j++) {
                                let value;
                                
                                // Get value based on pre-detected format
                                if (isArrayFormat) {
                                    value = rows[i][j];
                                } else if (isObjectFormat) {
                                    value = rows[i][columns[j]];
                                } else {
                                    value = rows[i];
                                }
                                
                                // Optimized type handling
                                if (value == null) {
                                    row[j] = '';
                                } else if (typeof value === 'string') {
                                    row[j] = value;
                                } else if (typeof value === 'number' || typeof value === 'boolean') {
                                    row[j] = String(value);
                                } else if (value instanceof Date) {
                                    row[j] = value.toISOString();
                                } else {
                                    try {
                                        row[j] = JSON.stringify(value);
                                    } catch (e) {
                                        row[j] = String(value);
                                    }
                                }
                            }
                            batchData.push(row);
                        }
                        
                        processedRows = batchEnd;
                        
                        // Send batch back to main thread
                        self.postMessage({
                            type: 'batch',
                            data: batchData,
                            processed: processedRows,
                            total: totalRows,
                            progress: Math.round((processedRows / totalRows) * 100)
                        });
                        
                        // Clear batch to free memory
                        batchData.length = 0;
                    }
                    
                    // Send completion message
                    self.postMessage({
                        type: 'complete',
                        processed: processedRows,
                        total: totalRows
                    });
                    
                } catch (error) {
                    self.postMessage({
                        type: 'error',
                        error: error.message || String(error)
                    });
                }
            };
        `;
        
        // Create worker from inline code
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        return new Worker(workerUrl);
    };

    /**
     * __processStreamingDataset
     * Process large datasets using Web Worker for maximum performance and UI responsiveness
     * Falls back to optimized main-thread processing if workers not available
     * @param rows array of row data
     * @param columns array of column names
     * @param columnTypes array of column types for schema-based optimization (optional)
     * @param tempFileName temporary file name for cleanup
     * @param opt options object
     */
    Data.Feed.prototype.__processStreamingDataset = function (rows, columns, columnTypes, tempFileName, opt) {
        const __this = this;
        
        console.log("Starting Web Worker-based processing for maximum performance...");
        
        // Memory monitoring function
        const logMemoryUsage = () => {
            if (performance.memory) {
                const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                const total = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
                console.log(`Memory usage: ${used}MB / ${total}MB`);
            }
        };
        
        // Check if Web Workers are supported
        const hasWorkerSupport = typeof Worker !== 'undefined';
        
        if (!hasWorkerSupport) {
            console.warn("⚠️ Web Workers not supported, falling back to main thread processing");
            return __this.__processStreamingDatasetFallback(rows, columns, columnTypes, tempFileName, opt);
        }
        
        // Detect row format once
        const isArrayFormat = rows.length > 0 && Array.isArray(rows[0]);
        const isObjectFormat = rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null && !Array.isArray(rows[0]);
        
        // Pre-allocate the final data array
        const dataA = new Array(rows.length + 1);
        dataA[0] = columns;
        
        // Use optimized worker batch size based on available memory and dataset characteristics
        const cellsPerRow = columns.length;
        const totalCells = rows.length * cellsPerRow;
        const workerBatchSize = Data.getOptimizedBatchSize('worker', rows.length, cellsPerRow);
        
        console.log(`⚡ Worker batch size optimized: ${workerBatchSize.toLocaleString()} rows (${cellsPerRow} columns, ${(workerBatchSize * cellsPerRow).toLocaleString()} cells per batch)`);
        
        // Check if dataset is too large for worker transfer (memory overhead)
        // Workers require cloning data which can cause out-of-memory errors for very large datasets
        const estimatedMemoryMB = (rows.length * cellsPerRow * 50) / (1024 * 1024); // Rough estimate: 50 bytes per cell
        const MAX_WORKER_MEMORY_MB = 500; // Max 500MB for worker transfer
        
        if (estimatedMemoryMB > MAX_WORKER_MEMORY_MB) {
            console.log(`Dataset too large for worker transfer (estimated ${Math.round(estimatedMemoryMB)}MB)`);
            console.log(`Using optimized main-thread processing instead...`);
            return __this.__processStreamingDatasetFallback(rows, columns, columnTypes, tempFileName, opt);
        }
        
        console.log(`Processing ${rows.length.toLocaleString()} rows (${totalCells.toLocaleString()} cells) using Web Worker`);
        console.log(`⚡ Extracting data from DuckDB rows for worker transfer (estimated ${Math.round(estimatedMemoryMB)}MB)...`);
        
        // Convert DuckDB Row objects to plain arrays/objects for worker transfer
        // Do this in async batches to avoid blocking UI
        const extractDataAsync = async () => {
            const plainRows = [];
            const extractBatchSize = Data.getOptimizedBatchSize('extract', rows.length, cellsPerRow);
            
            console.log(`⚡ Data extraction batch size optimized: ${extractBatchSize.toLocaleString()} rows`);
            
            for (let batchStart = 0; batchStart < rows.length; batchStart += extractBatchSize) {
                const batchEnd = Math.min(batchStart + extractBatchSize, rows.length);
                
                await __this.__scheduleIdleWork((deadline) => {
                    for (let i = batchStart; i < batchEnd; i++) {
                        if (isArrayFormat) {
                            const plainRow = new Array(columns.length);
                            for (let j = 0; j < columns.length; j++) {
                                const value = rows[i][j];
                                plainRow[j] = __this.__convertValue(value, columnTypes ? columnTypes[j] : null);
                            }
                            plainRows.push(plainRow);
                        } else if (isObjectFormat) {
                            // Extract object values into plain object
                            const plainRow = {};
                            for (let j = 0; j < columns.length; j++) {
                                const colName = columns[j];
                                const value = rows[i][colName];
                                plainRow[colName] = __this.__convertValue(value, columnTypes ? columnTypes[j] : null);
                            }
                            plainRows.push(plainRow);
                        } else {
                            plainRows.push(__this.__convertValue(rows[i], columnTypes ? columnTypes[0] : null));
                        }
                    }
                    
                    if (batchEnd % 500000 === 0 || batchEnd === rows.length) {
                        console.log(`Extracted ${batchEnd.toLocaleString()} of ${rows.length.toLocaleString()} rows (${Math.round((batchEnd / rows.length) * 100)}%)`);
                    }
                }, 1000);
            }
            
            return plainRows;
        };
        
        return extractDataAsync().then(function(plainRows) {
            console.log(`Data extraction complete, starting worker processing...`);
            
            return new Promise((resolve, reject) => {
                try {
                    // Create worker
                    const worker = __this.__createParquetWorker();
                    let workerUrl = null;
                    
                    // Handle messages from worker
                    worker.onmessage = function(e) {
                    const { type, data, processed, total, progress, error } = e.data;
                    
                    if (type === 'batch') {
                        // Receive processed batch and add to final array
                        const startIndex = processed - data.length + 1;
                        for (let i = 0; i < data.length; i++) {
                            dataA[startIndex + i] = data[i];
                        }
                        
                        // Log progress every 2M rows
                        if (processed % 2000000 === 0 || processed === total) {
                            console.log(`Worker progress: ${processed.toLocaleString()} of ${total.toLocaleString()} rows (${progress}%)`);
                            logMemoryUsage();
                        }
                        
                    } else if (type === 'complete') {
                        console.log("✅ Worker processing completed successfully");
                        
                        // Clean up worker
                        worker.terminate();
                        if (workerUrl) {
                            URL.revokeObjectURL(workerUrl);
                        }
                        
                        // Clean up temp file
                        try {
                            window.duckdb.db.dropFile(tempFileName);
                        } catch (cleanupError) {
                            console.warn("Warning: Could not clean up temporary file:", cleanupError);
                        }
                        
                        _LOG("Worker converted: " + dataA.length + " total rows (including header)");
                        
                        // Process the data using the standard method
                        __this.__createDataTableObject(dataA, "parquet", opt);
                        resolve();
                        
                    } else if (type === 'error') {
                        console.error("❌ Worker error:", error);
                        
                        // Clean up worker
                        worker.terminate();
                        if (workerUrl) {
                            URL.revokeObjectURL(workerUrl);
                        }
                        
                        // Clean up temp file
                        try {
                            window.duckdb.db.dropFile(tempFileName);
                        } catch (cleanupError) {
                            console.warn("Warning: Could not clean up temporary file:", cleanupError);
                        }
                        
                        reject(new Error(error));
                    }
                };
                
                worker.onerror = function(error) {
                    console.error("❌ Worker error:", error);
                    worker.terminate();
                    if (workerUrl) {
                        URL.revokeObjectURL(workerUrl);
                    }
                    reject(error);
                };
                
                // Send plain data to worker (DuckDB Row objects converted to plain JS)
                worker.postMessage({
                    rows: plainRows,
                    columns: columns,
                    isArrayFormat: isArrayFormat,
                    isObjectFormat: isObjectFormat,
                    batchSize: workerBatchSize
                });
                
            } catch (error) {
                console.error("❌ Failed to create worker, falling back:", error);
                // Fallback to main thread processing
                return __this.__processStreamingDatasetFallback(rows, columns, columnTypes, tempFileName, opt);
            }
            });
        }).catch(function(error) {
            console.error("❌ Error in worker processing or data extraction:", error);
            
            // Clean up temp file
            try {
                window.duckdb.db.dropFile(tempFileName);
            } catch (cleanupError) {
                console.warn("Warning: Could not clean up temporary file:", cleanupError);
            }
            
            // Call error callback
            if (opt && typeof opt.error === 'function') {
                opt.error(error);
            }
        });
    };
    /**
     * __processStreamingDatasetFallback
     * Fallback processing on main thread when Web Workers not available
     * @param rows array of row data
     * @param columns array of column names
     * @param columnTypes array of column types for schema-based optimization (optional)
     * @param tempFileName temporary file name for cleanup
     * @param opt options object
     */
    Data.Feed.prototype.__processStreamingDatasetFallback = function (rows, columns, columnTypes, tempFileName, opt) {
        const __this = this;
        
        console.log("Starting fallback main-thread processing...");
        
        // Memory monitoring function
        const logMemoryUsage = () => {
            if (performance.memory) {
                const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                const total = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
                console.log(`Memory usage: ${used}MB / ${total}MB`);
            }
        };
        
        // Detect row format once
        const isArrayFormat = rows.length > 0 && Array.isArray(rows[0]);
        const isObjectFormat = rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null && !Array.isArray(rows[0]);
        
        // Pre-allocate the final data array
        const dataA = new Array(rows.length + 1);
        dataA[0] = columns;
        
        // Dynamic batch sizing
        const cellsPerRow = columns.length;
        const totalCells = rows.length * cellsPerRow;
        /** 
        const microBatchSize = Math.min(
            5000000,
            Math.max(500000, Math.floor(10000000 / cellsPerRow))
        );
        **/
        const microBatchSize = 1000000;

        Data.log(`Processing ${rows.length.toLocaleString()} rows (${totalCells.toLocaleString()} cells) in batches of ${microBatchSize.toLocaleString()} rows`);
        if (columnTypes) {
            Data.log(`⚡ Schema-based optimization active for faster processing`);
        }
        
        // Simplified batch processor using smart idle scheduling
        const processMicroBatch = async (startIndex, endIndex) => {
            return __this.__scheduleIdleWork((deadline) => {
                // Process all rows in batch using helper function
                for (let i = startIndex; i < endIndex; i++) {
                    dataA[i + 1] = __this.__processRow(rows[i], columns, columnTypes, isArrayFormat, isObjectFormat);
                }
            }, 1000);
        };
        
        // Process data in optimized batches
        const processAllData = async () => {
            const startTime = Date.now();
            let lastLogTime = startTime;
            
            for (let batchStart = 0; batchStart < rows.length; batchStart += microBatchSize) {
                const batchEnd = Math.min(batchStart + microBatchSize, rows.length);
                await processMicroBatch(batchStart, batchEnd);
                
                const now = Date.now();
                const timeSinceLastLog = now - lastLogTime;
                
                // Log every 500K rows or every 2 seconds, whichever comes first
                if (batchEnd % 500000 === 0 || batchEnd === rows.length || timeSinceLastLog > 2000) {
                    const elapsed = ((now - startTime) / 1000).toFixed(1);
                    const rowsPerSec = Math.round(batchEnd / ((now - startTime) / 1000));
                    let memInfo = '';
                    if (performance.memory) {
                        const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                        const total = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
                        memInfo = ` | Memory: ${used}MB / ${total}MB`;
                    }
                    Data.log(` ${batchEnd.toLocaleString()} / ${rows.length.toLocaleString()} rows (${Math.round((batchEnd / rows.length) * 100)}%) | ${rowsPerSec.toLocaleString()} rows/sec | ${elapsed}s${memInfo}`);
                    lastLogTime = now;
                }
            }
        };
        
        // Process the data
        return processAllData().then(function() {
            console.log("Fallback dataset processing completed");
            _LOG("Fallback converted: " + dataA.length + " total rows (including header)");
            
            // Clean up the temporary file
            try {
                window.duckdb.db.dropFile(tempFileName);
            } catch (cleanupError) {
                console.warn("Warning: Could not clean up temporary file:", cleanupError);
            }
            
            // Process the data using the standard method
            __this.__createDataTableObject(dataA, "parquet", opt);
            
        }).catch(function(error) {
            console.error("❌ Error in fallback processing:", error);
            
            // Clean up the temporary file
            try {
                window.duckdb.db.dropFile(tempFileName);
            } catch (cleanupError) {
                console.warn("Warning: Could not clean up temporary file:", cleanupError);
            }
            
            // Call error callback
            if (opt && typeof opt.error === 'function') {
                opt.error(error);
            }
        });
    };
    
    /**
     * __processParquetData
     * processes parquet data using DuckDB WASM module and converts it to table format
     * @param parquetBuffer ArrayBuffer containing parquet data
     * @param opt options object
     * @type void
     */
    Data.Feed.prototype.__processParquetData = function (parquetBuffer, opt) {
        const __this = this;
        
        console.log("🚀 Starting parquet processing with DuckDB WASM...");
        _LOG("Processing parquet data with DuckDB WASM...");
        
        // First, ensure DuckDB WASM is loaded AND working
        if (typeof window.duckdb !== 'undefined' && window.duckdbLoaded) {
            console.log("📦 Attempting to use existing DuckDB WASM module");
            
            // Test if the connection is still valid before using it
            if (window.duckdb.conn) {
                window.duckdb.conn.query('SELECT 1 as test')
                    .then(result => {
                        console.log("✅ DuckDB connection is valid for parquet");
                        __this.__processParquetWithDuckDB(parquetBuffer, opt);
                    })
                    .catch(error => {
                        console.warn("⚠️ Existing DuckDB connection is invalid for parquet:", error.message);
                        console.log("🔄 Cleaning up and creating fresh DuckDB instance...");
                        __this.__cleanupDuckDB();
                        __this.__loadDuckDBAndProcess(parquetBuffer, opt);
                    });
            } else {
                // No connection, need to load fresh
                __this.__loadDuckDBAndProcess(parquetBuffer, opt);
            }
        } else {
            console.log("📦 Loading DuckDB WASM module...");
            __this.__loadDuckDBAndProcess(parquetBuffer, opt);
        }
    };
    
    /**
     * __processParquetWithDuckDB
     * Processes parquet data with loaded DuckDB WASM module (includes GeoParquet detection)
     * @param parquetBuffer ArrayBuffer containing parquet data
     * @param opt options object
     */
    Data.Feed.prototype.__processParquetWithDuckDB = function (parquetBuffer, opt) {
        const __this = this;
        console.log("🔍 Starting GeoParquet detection with DuckDB WASM...");
        _LOG("Detecting if parquet file is GeoParquet...");
        
        // Use DuckDB to detect GeoParquet
        __this.__checkGeoParquetMetadataWithDuckDB(parquetBuffer, function(isGeoParquet) {
            console.log("🎯 GeoParquet detection result:", isGeoParquet);
            
            if (isGeoParquet) {
                _LOG("✅ GeoParquet detected! Switching to GeoParquet processing...");
                console.log("🎯 Branching to GeoParquet processing");
                
                // Branch to GeoParquet processing
                if (typeof __this.__processGeoParquetData === 'function') {
                    __this.__processGeoParquetData(parquetBuffer, opt);
                } else {
                    _LOG("⚠️ GeoParquet processing function not found, falling back to regular parquet processing");
                    console.log("⚠️ GeoParquet function not found, using regular processing");
                    __this.__processWithDuckDB(parquetBuffer, opt);
                }
            } else {
                _LOG("✅ Regular parquet file detected, proceeding with standard processing...");
                console.log("🎯 Branching to regular parquet processing");
                
                // Continue with regular parquet processing
                __this.__processWithDuckDB(parquetBuffer, opt);
            }
        }, function(error) {
            _LOG("⚠️ Error detecting GeoParquet, falling back to regular parquet processing: " + error);
            console.error("❌ Detection error:", error);
            
            // Fallback to regular parquet processing
            __this.__processWithDuckDB(parquetBuffer, opt);
        });
    };
    
    /**
     * __loadDuckDBAndProcess
     * Loads DuckDB WASM module and processes parquet data
     * @param parquetBuffer ArrayBuffer containing parquet data
     * @param opt options object
     */
    Data.Feed.prototype.__loadDuckDBAndProcess = function (parquetBuffer, opt) {
        const __this = this;
        
        // Load DuckDB WASM module dynamically
        _LOG("Loading DuckDB WASM module dynamically...");
        
        // Now load DuckDB WASM
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
            // Try to load DuckDB WASM from CDN
            let duckdb;
            try {
                // Try jsDelivr first (most reliable for DuckDB WASM)
                duckdb = await import("https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/+esm");
                console.log("✅ DuckDB loaded from jsDelivr");
            } catch (e1) {
                try {
                    // Fallback to ESM.sh
                    duckdb = await import("https://esm.sh/@duckdb/duckdb-wasm@1.30.0");
                    console.log("✅ DuckDB loaded from ESM.sh");
                } catch (e2) {
                    try {
                        // Fallback to unpkg
                        duckdb = await import("https://unpkg.com/@duckdb/duckdb-wasm@1.30.0");
                        console.log("✅ DuckDB loaded from unpkg");
                    } catch (e3) {
                        throw new Error("Failed to load DuckDB from any CDN: " + e3.message);
                    }
                }
            }
            
            console.log("DuckDB WASM module imported:", duckdb);
            console.log("Available DuckDB methods:", Object.keys(duckdb));
            
            // Initialize DuckDB
            try {
                console.log('🔧 Selecting bundle from jsDelivr CDN...');
                const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
                
                // Force MVP bundle (single-threaded) to avoid pthread worker issues
                // The "eh" bundle uses pthread which can hit browser worker limits
                console.log('🎯 Forcing MVP bundle (single-threaded) to avoid resource limits...');
                const bundle = JSDELIVR_BUNDLES.mvp;
                console.log('✅ Using MVP bundle:', bundle);
                
                console.log("👷 Creating worker from bundle...");
                
                let worker;
                try {
                    // Create worker using blob URL approach to avoid CORS issues
                    const worker_url = URL.createObjectURL(
                        new Blob([\`importScripts("\${bundle.mainWorker}");\`], { type: 'text/javascript' })
                    );
                    worker = new Worker(worker_url);
                    console.log("✅ Worker created successfully");
                    
                    // Revoke the blob URL to free memory
                    URL.revokeObjectURL(worker_url);
                } catch (workerError) {
                    console.error("❌ Failed to create Web Worker:", workerError);
                    throw new Error("Worker creation failed: " + workerError.message + ". This may be due to browser resource limits. Try refreshing the page.");
                }
                
                const logger = new duckdb.ConsoleLogger();
                const db = new duckdb.AsyncDuckDB(logger, worker);
                
                console.log("🚀 Instantiating DuckDB with WASM module...");
                // MVP bundle is single-threaded, so we don't pass pthreadWorker
                await db.instantiate(bundle.mainModule);
                console.log("✅ DuckDB WASM instantiated successfully");
                
                // Create connection
                const conn = await db.connect();
                
                console.log("✅ DuckDB WASM initialized successfully");
                console.log("DuckDB connection object type:", typeof conn);
                console.log("DuckDB connection methods:", Object.getOwnPropertyNames(conn));
                console.log("DuckDB connection constructor:", conn.constructor.name);
                
                // Store references globally with worker reference for cleanup
                window.duckdb = {
                    module: duckdb,
                    worker: worker,
                    db: db,
                    conn: conn
                };
                window.duckdbLoaded = true;
            
            } catch (error) {
                console.error("❌ Failed to initialize DuckDB WASM:", error);
                window.duckdbLoadError = error;
            }
            `;
            
        // Add the script to the document
        document.head.appendChild(script);
        
        // Listen for when DuckDB is loaded
        const checkLoaded = setInterval(function() {
            if (window.duckdbLoaded && window.duckdb) {
                clearInterval(checkLoaded);
                _LOG("DuckDB WASM module loaded successfully");
                __this.__processParquetWithDuckDB(parquetBuffer, opt);
            } else if (window.duckdbLoadError) {
                clearInterval(checkLoaded);
                _LOG("Failed to load DuckDB WASM module: " + window.duckdbLoadError);
                if (typeof opt !== "undefined" && opt.error) {
                    opt.error("Failed to load DuckDB WASM module: " + window.duckdbLoadError);
                } else {
                    _alert("Failed to load DuckDB WASM module: " + window.duckdbLoadError);
                }
            }
        }, 100);
        
        // Set a timeout in case loading fails
        setTimeout(function() {
            if (!window.duckdbLoaded && !window.duckdbLoadError) {
                clearInterval(checkLoaded);
                _LOG("Timeout loading DuckDB WASM module");
                if (typeof opt !== "undefined" && opt.error) {
                    opt.error("Timeout loading DuckDB WASM module");
                } else {
                    _alert("Timeout loading DuckDB WASM module");
                }
            }
        }, 15000); // 15 second timeout
    };
    /**
     * __processWithDuckDB
     * helper method to process parquet data using DuckDB WASM
     * @param parquetBuffer ArrayBuffer containing parquet data
     * @param opt options object
     * @type void
     */
    Data.Feed.prototype.__processWithDuckDB = function (parquetBuffer, opt) {
        const __this = this;
        
        try {
            const fileSizeMB = (parquetBuffer.byteLength / 1024 / 1024).toFixed(2);
            _LOG("Processing parquet data with DuckDB WASM, buffer size: " + parquetBuffer.byteLength + " bytes (" + fileSizeMB + " MB)");
            Data.log("🦆 Starting DuckDB parquet processing...");
            
            // Check file size - warn if too large
            const MAX_RECOMMENDED_SIZE = 500 * 1024 * 1024; // 500MB
            if (parquetBuffer.byteLength > MAX_RECOMMENDED_SIZE) {
                const warningMsg = `⚠️ Large file detected (${fileSizeMB} MB). Processing may fail due to browser memory limits. Consider loading a smaller file or a subset of the data.`;
                console.warn(warningMsg);
                Data.log(warningMsg);
            }
            
            // Check for parquet magic number (PAR1)
            if (parquetBuffer.byteLength < 4) {
                throw new Error("File too small to be a valid parquet file");
            }
            
            const uint8Array = new Uint8Array(parquetBuffer);
            const magic = String.fromCharCode(...uint8Array.slice(0, 4));
            _LOG("Parquet file magic number: " + magic);
            
            if (magic !== 'PAR1') {
                throw new Error("File does not appear to be a valid parquet file (missing PAR1 magic number). Magic: " + magic);
            }
            
            _LOG("Valid parquet file detected, processing with DuckDB WASM...");
            
            // Register the parquet buffer as a temporary file in DuckDB's virtual filesystem
            const tempFileName = 'temp_parquet_' + Date.now() + '.parquet';
            
            // Create a copy of the uint8Array to avoid modifying the original buffer
            const uint8ArrayCopy = new Uint8Array(uint8Array);
            
            window.duckdb.db.registerFileBuffer(tempFileName, uint8ArrayCopy)
                .then(function() {
                    console.log("Parquet file registered in DuckDB virtual filesystem");
                    
                    // First, check how many rows the file has
                    return window.duckdb.conn.query(`SELECT COUNT(*) as count FROM read_parquet('${tempFileName}')`);
                })
                .then(async function(countResult) {
                    // Get total row count - convert BigInt to Number for calculations
                    const totalRowsRaw = countResult.toArray()[0].count;
                    const totalRows = typeof totalRowsRaw === 'bigint' ? Number(totalRowsRaw) : totalRowsRaw;
                    
                    console.log(`File contains ${totalRows.toLocaleString()} total rows`);
                    Data.log(`File has ${totalRows.toLocaleString()} rows - loading all data in batches...`);
                    
                    // Get schema first to determine column count for batch size optimization
                    const schemaQuery = `SELECT * FROM read_parquet('${tempFileName}') LIMIT 1`;
                    const schemaResult = await window.duckdb.conn.query(schemaQuery);
                    const schema = schemaResult.schema;
                    const columnsCount = schema.names ? schema.names.length : 0;
                    
                    // Use original simple batch size approach
                    const BATCH_SIZE = Data.getOptimizedBatchSize('parquet', totalRows, columnsCount);
                    const numBatches = Math.ceil(totalRows / BATCH_SIZE);
                    
                    console.log(`Loading ${totalRows.toLocaleString()} rows in ${numBatches} batch${numBatches > 1 ? 'es' : ''} of ${BATCH_SIZE.toLocaleString()} rows`);
                    
                    // Accumulate all rows from all batches
                    let allRows = [];
                    
                    for (let batchNum = 0; batchNum < numBatches; batchNum++) {
                        const offset = batchNum * BATCH_SIZE;
                        const remaining = totalRows - offset;
                        const limit = Math.min(BATCH_SIZE, remaining);
                        
                        console.log(`⚡ Loading batch ${batchNum + 1}/${numBatches} (rows ${offset.toLocaleString()}-${(offset + limit - 1).toLocaleString()})...`);
                        Data.log(`Loading batch ${batchNum + 1}/${numBatches}... (${Math.round((batchNum / numBatches) * 100)}%)`);
                        
                        const batchQuery = `SELECT * FROM read_parquet('${tempFileName}') LIMIT ${limit} OFFSET ${offset}`;
                        const batchResult = await window.duckdb.conn.query(batchQuery);
                        
                        // Add rows from this batch
                        const batchRows = batchResult.toArray();
                        allRows = allRows.concat(batchRows);
                        
                        console.log(`✅ Batch ${batchNum + 1} loaded: ${batchRows.length.toLocaleString()} rows (total so far: ${allRows.length.toLocaleString()})`);
                    }
                    
                    console.log(`✅ All ${numBatches} batches loaded successfully! Total rows: ${allRows.length.toLocaleString()}`);
                    Data.log(`✅ All ${allRows.length.toLocaleString()} rows loaded successfully!`);
                    
                    // Create a result object similar to what DuckDB returns
                    return {
                        schema: schema,
                        toArray: function() { return allRows; }
                    };
                })
                .then(async function(result) {
                    console.log("DuckDB query completed successfully");
                    _LOG("DuckDB query result type: " + typeof result);
                    console.log("DuckDB result object type:", typeof result);
                    console.log("DuckDB result methods:", Object.getOwnPropertyNames(result));
                    console.log("DuckDB result constructor:", result.constructor.name);
                    
                    if (!result) {
                        throw new Error("DuckDB query returned null/undefined");
                    }
                    
                    // Check if result has toArray method
                    let rows;
                    let columns;
                    
                    if (typeof result.toArray === 'function') {
                        rows = result.toArray();
                        console.log("Using toArray() method, rows count:", rows.length);
                    } else if (typeof result.fetchAll === 'function') {
                        rows = result.fetchAll();
                        console.log("Using fetchAll() method, rows count:", rows.length);
                    } else if (Array.isArray(result)) {
                        rows = result;
                        console.log("Result is already an array, rows count:", rows.length);
                    } else {
                        // Try to access data property
                        if (result.data && Array.isArray(result.data)) {
                            rows = result.data;
                            console.log("Using result.data, rows count:", rows.length);
                        } else {
                            throw new Error("Cannot convert DuckDB result to array. Available methods: " + Object.getOwnPropertyNames(result).join(', '));
                        }
                    }
                    
                    if (rows.length === 0) {
                        throw new Error("No rows found in parquet file");
                    }
                    
                    // Get column names and types from schema
                    let columnTypes = null;
                    if (result.schema && result.schema.fields) {
                        columns = result.schema.fields.map(field => field.name);
                        // Extract type information for optimization using helper
                        columnTypes = __this.__detectColumnTypes(result.schema);
                        if (columnTypes) {
                            _LOG("Schema-based optimization enabled - detected column types: " + columnTypes.join(', '));
                        }
                    } else if (result.columns) {
                        columns = result.columns;
                    } else if (rows.length > 0 && typeof rows[0] === 'object') {
                        columns = Object.keys(rows[0]);
                    } else {
                        throw new Error("Cannot determine column names from DuckDB result");
                    }
                    
                    _LOG("Extracted columns: " + columns.join(', '));
                    
                    if (columns.length === 0) {
                        throw new Error("No columns found in parquet file");
                    }

                    const geometryColumnNames = columns.filter(name => {
                        const lower = (name || '').toLowerCase();
                        return lower === 'geometry' || lower === 'geom' || lower === 'wkb_geometry' || lower === 'shape' || lower.includes('geom');
                    });

                    if (geometryColumnNames.length) {
                        if (!columnTypes) {
                            columnTypes = columns.map(() => 'other');
                        }
                        geometryColumnNames.forEach((colName) => {
                            const idx = columns.indexOf(colName);
                            if (idx !== -1) {
                                columnTypes[idx] = 'geometry';
                            }
                        });
                    }

                    // Convert rows to array format expected by the data table
                    // Process in batches to avoid stack overflow with large datasets
                    const dataRows = [];
                    
                    // Check if dataset is too large to process safely
                    if (rows.length > 10000000) {
                        throw new Error(`Dataset too large (${rows.length} rows). Maximum supported: 10,000,000 rows. Consider using a smaller LIMIT in your query.`);
                    }
                    
                    // Warn about large datasets
                    if (rows.length > 500000) {
                        Data.log(`⚠️ Processing very large dataset (${rows.length} rows). This may take a while and use significant memory.`);
                    }

                    // For large datasets, use streaming processing to avoid memory issues
                    if (rows.length > 100000) {
                        Data.log("Large dataset detected, using streaming processing...");
                        return __this.__processStreamingDataset(rows, columns, columnTypes, tempFileName, opt);
                    }
                    
                    
                    // For medium-large datasets (50K-100K), use optimized batch processing
                    if (rows.length > 50000) {
                        console.log("Medium-large dataset detected, using optimized batch processing...");
                        
                        // Detect row format once (optimization: avoid checking for every cell)
                        const isArrayFormat = rows.length > 0 && Array.isArray(rows[0]);
                        const isObjectFormat = rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null && !Array.isArray(rows[0]);
                        
                        // Dynamic batch sizing based on cell count
                        const cellsPerRow = columns.length;
                        const totalCells = rows.length * cellsPerRow;
                        // Target: process 10M cells per batch for optimal speed
                        const actualBatchSize = Math.min(
                            2000000, // Maximum 2M rows per batch
                            Math.max(
                                100000, // Minimum 100K rows per batch
                                Math.floor(10000000 / cellsPerRow) // 10M cells per batch
                            )
                        );
                        
                        console.log(`Processing ${rows.length.toLocaleString()} rows (${totalCells.toLocaleString()} cells) in batches of ${actualBatchSize.toLocaleString()} rows`);
                        if (columnTypes) {
                            Data.log(`⚡ Schema-based optimization active for medium dataset`);
                        }
                        
                        try {
                            // Simplified batch processor using smart idle scheduling
                            const processMicroBatch = async (startIndex, endIndex) => {
                                return __this.__scheduleIdleWork((deadline) => {
                                    // Process all rows in batch using helper function
                                    for (let i = startIndex; i < endIndex; i++) {
                                        dataRows.push(__this.__processRow(rows[i], columns, columnTypes, isArrayFormat, isObjectFormat));
                                    }
                                }, 1000);
                            };
                            
                            // Process all data in optimized batches
                            const startTime = Date.now();
                            let lastLogTime = startTime;
                            
                            for (let batchStart = 0; batchStart < rows.length; batchStart += actualBatchSize) {
                                const batchEnd = Math.min(batchStart + actualBatchSize, rows.length);
                                await processMicroBatch(batchStart, batchEnd);
                                
                                const now = Date.now();
                                const timeSinceLastLog = now - lastLogTime;
                                
                                // Log every 500K rows or every 2 seconds, whichever comes first
                                if (batchEnd % 500000 === 0 || batchEnd === rows.length || timeSinceLastLog > 2000) {
                                    const elapsed = ((now - startTime) / 1000).toFixed(1);
                                    const rowsPerSec = Math.round(batchEnd / ((now - startTime) / 1000));
                                    let memInfo = '';
                                    if (performance.memory) {
                                        const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                                        const total = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
                                        memInfo = ` | Memory: ${used}MB / ${total}MB`;
                                    }
                                    Data.log(`Processing: ${batchEnd.toLocaleString()} / ${rows.length.toLocaleString()} rows (${Math.round((batchEnd / rows.length) * 100)}%) | ${rowsPerSec.toLocaleString()} rows/sec | ${elapsed}s${memInfo}`);
                                    lastLogTime = now;
                                }
                            }
                        } catch (error) {
                            console.warn("⚠️ Async processing failed, falling back to optimized synchronous processing:", error);
                            
                            // Detect row format once for fallback (optimization)
                            const isArrayFormat = rows.length > 0 && Array.isArray(rows[0]);
                            const isObjectFormat = rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null && !Array.isArray(rows[0]);
                            
                            // Optimized fallback to synchronous processing - format check moved outside loop
                            const fallbackBatchSize = 10000;
                            const startTime = Date.now();
                            let lastLogTime = startTime;
                            
                            // Separate processing paths based on format (eliminates millions of format checks)
                            if (isArrayFormat) {
                                // Fast path for array format
                                for (let batchStart = 0; batchStart < rows.length; batchStart += fallbackBatchSize) {
                                    const batchEnd = Math.min(batchStart + fallbackBatchSize, rows.length);
                                    
                                    for (let i = batchStart; i < batchEnd; i++) {
                                        const row = new Array(columns.length);
                                        for (let j = 0; j < columns.length; j++) {
                                            const value = rows[i][j];
                                            row[j] = __this.__convertValue(value, columnTypes ? columnTypes[j] : null);
                                        }
                                        dataRows.push(row);
                                    }
                                    
                                    const now = Date.now();
                                    const timeSinceLastLog = now - lastLogTime;
                                    
                                    if (batchEnd % 50000 === 0 || batchEnd === rows.length || timeSinceLastLog > 2000) {
                                        const elapsed = ((now - startTime) / 1000).toFixed(1);
                                        const rowsPerSec = Math.round(batchEnd / ((now - startTime) / 1000));
                                        let memInfo = '';
                                        if (performance.memory) {
                                            const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                                            const total = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
                                            memInfo = ` | Memory: ${used}MB / ${total}MB`;
                                        }
                                        Data.log(`Fallback: ${batchEnd.toLocaleString()} / ${rows.length.toLocaleString()} rows (${Math.round((batchEnd / rows.length) * 100)}%) | ${rowsPerSec.toLocaleString()} rows/sec | ${elapsed}s${memInfo}`);
                                        lastLogTime = now;
                                    }
                                }
                            } else if (isObjectFormat) {
                                // Fast path for object format
                                for (let batchStart = 0; batchStart < rows.length; batchStart += fallbackBatchSize) {
                                    const batchEnd = Math.min(batchStart + fallbackBatchSize, rows.length);
                                    
                                    for (let i = batchStart; i < batchEnd; i++) {
                                        const row = new Array(columns.length);
                                        for (let j = 0; j < columns.length; j++) {
                                            const value = rows[i][columns[j]];
                                            row[j] = __this.__convertValue(value, columnTypes ? columnTypes[j] : null);
                                        }
                                        dataRows.push(row);
                                    }
                                    
                                    const now = Date.now();
                                    const timeSinceLastLog = now - lastLogTime;
                                    
                                    if (batchEnd % 50000 === 0 || batchEnd === rows.length || timeSinceLastLog > 2000) {
                                        const elapsed = ((now - startTime) / 1000).toFixed(1);
                                        const rowsPerSec = Math.round(batchEnd / ((now - startTime) / 1000));
                                        let memInfo = '';
                                        if (performance.memory) {
                                            const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                                            const total = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
                                            memInfo = ` | Memory: ${used}MB / ${total}MB`;
                                        }
                                        Data.log(`Fallback: ${batchEnd.toLocaleString()} / ${rows.length.toLocaleString()} rows (${Math.round((batchEnd / rows.length) * 100)}%) | ${rowsPerSec.toLocaleString()} rows/sec | ${elapsed}s${memInfo}`);
                                        lastLogTime = now;
                                    }
                                }
                            } else {
                                // Fallback for other formats
                                for (let batchStart = 0; batchStart < rows.length; batchStart += fallbackBatchSize) {
                                    const batchEnd = Math.min(batchStart + fallbackBatchSize, rows.length);
                                    
                                    for (let i = batchStart; i < batchEnd; i++) {
                                        const row = new Array(columns.length);
                                        for (let j = 0; j < columns.length; j++) {
                                            const value = rows[i];
                                            row[j] = __this.__convertValue(value, columnTypes ? columnTypes[j] : null);
                                        }
                                        dataRows.push(row);
                                    }
                                    
                                    const now = Date.now();
                                    const timeSinceLastLog = now - lastLogTime;
                                    
                                    if (batchEnd % 50000 === 0 || batchEnd === rows.length || timeSinceLastLog > 2000) {
                                        const elapsed = ((now - startTime) / 1000).toFixed(1);
                                        const rowsPerSec = Math.round(batchEnd / ((now - startTime) / 1000));
                                        let memInfo = '';
                                        if (performance.memory) {
                                            const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                                            const total = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
                                            memInfo = ` | Memory: ${used}MB / ${total}MB`;
                                        }
                                        Data.log(`Fallback: ${batchEnd.toLocaleString()} / ${rows.length.toLocaleString()} rows (${Math.round((batchEnd / rows.length) * 100)}%) | ${rowsPerSec.toLocaleString()} rows/sec | ${elapsed}s${memInfo}`);
                                        lastLogTime = now;
                                    }
                                }
                            }
                        }
                    } else {
                        // For smaller datasets (< 50K), use fast synchronous processing
                        console.log(`Processing small dataset (${rows.length.toLocaleString()} rows) synchronously`);
                        
                        // Detect row format once (optimization)
                        const isArrayFormat = rows.length > 0 && Array.isArray(rows[0]);
                        const isObjectFormat = rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null && !Array.isArray(rows[0]);
                        
                        // Fast synchronous processing for small datasets
                        for (let i = 0; i < rows.length; i++) {
                            const row = new Array(columns.length);
                            for (let j = 0; j < columns.length; j++) {
                                let value;
                                
                                // Get value based on pre-detected format
                                if (isArrayFormat) {
                                    value = rows[i][j];
                                } else if (isObjectFormat) {
                                    value = rows[i][columns[j]];
                                } else {
                                    value = rows[i];
                                }
                                
                                row[j] = __this.__convertValue(value, columnTypes ? columnTypes[j] : null);
                            }
                            dataRows.push(row);
                        }
                    }
                    
                    _LOG("Converted " + dataRows.length + " rows with " + columns.length + " columns");
                    
                    // Create data array with header row
                    const dataA = [columns];
                    dataA.push(...dataRows);
                    
                    // Create table object
                    console.log("🎯 Creating data table object...");
                    __this.__createDataTableObject(dataA, "parquet", opt);
                    
                })
                .catch(function(error) {
                    _LOG("Error in DuckDB parquet processing: " + error);
                    console.error("❌ DuckDB processing error:", error);
                    
                    // Check if it's a memory allocation error
                    let errorMessage = error.message;
                    if (error.message && error.message.includes('malloc')) {
                        errorMessage = `File is too large to process in browser (requires ${(parquetBuffer.byteLength / 1024 / 1024).toFixed(0)}+ MB of memory). ` +
                                     `Please try:\n` +
                                     `1. Use a smaller file (< 500MB recommended)\n` +
                                     `2. Filter the data before loading\n` +
                                     `3. Use DuckDB CLI or other tools for large files`;
                        console.error("💾 Memory allocation failed - file is too large for browser processing");
                        Data.log("❌ File too large: Browser cannot allocate enough memory");
                    }
                    
                    if (typeof opt !== "undefined" && opt.error) {
                        opt.error(errorMessage);
                    } else {
                        _alert(errorMessage);
                    }
                })
                .finally(function() {
                    // Clean up the temporary file
                    try {
                        window.duckdb.db.dropFile(tempFileName);
                        console.log("🧹 Cleaned up temporary file");
                    } catch (cleanupError) {
                        console.warn("Warning: Could not clean up temporary file:", cleanupError);
                    }
                });
                
        } catch (error) {
            _LOG("Error in DuckDB parquet processing setup: " + error);
            console.error("❌ DuckDB setup error:", error);
            
            if (typeof opt !== "undefined" && opt.error) {
                opt.error("Error setting up DuckDB parquet processing: " + error.message);
            } else {
                _alert("Error setting up DuckDB parquet processing: " + error.message);
            }
        }
    };
    /**
     * __processGeoParquetData
     * Processes GeoParquet data and converts it to GeoJSON format
     * @param {ArrayBuffer} geoparquetBuffer ArrayBuffer containing GeoParquet data
     * @param {Object} opt options object
     * @type void
     */
    Data.Feed.prototype.__processGeoParquetData = function (geoparquetBuffer, opt) {
        const __this = this;
        
        // Check if geoparquet library is already loaded
        if (typeof window.geoparquet !== 'undefined') {
            _LOG("GeoParquet library already loaded, processing data...");
            __this.__processWithGeoParquet(geoparquetBuffer, opt, window.geoparquet);
        } else {
            _LOG("Loading GeoParquet library dynamically...");
            
            // Create script element to load geoparquet
            const script = document.createElement('script');
            script.type = 'module';
            script.textContent = `
                import { asyncBufferFromUrl, toGeoJson } from 'https://cdn.jsdelivr.net/npm/geoparquet@0.5.0/+esm';
                
                console.log("GeoParquet module imported");
                console.log("Available geoparquet methods:", Object.keys({ asyncBufferFromUrl, toGeoJson }));
                
                // Make geoparquet available globally
                window.geoparquet = { asyncBufferFromUrl, toGeoJson };
                window.geoparquetLoaded = true;
            `;
            
            // Listen for when geoparquet is loaded
            const checkLoaded = setInterval(function() {
                if (window.geoparquetLoaded && window.geoparquet) {
                    clearInterval(checkLoaded);
                    _LOG("GeoParquet module loaded successfully");
                    __this.__processWithGeoParquet(geoparquetBuffer, opt, window.geoparquet);
                }
            }, 100);
            
            // Set a timeout in case loading fails
            setTimeout(function() {
                if (!window.geoparquetLoaded) {
                    clearInterval(checkLoaded);
                    _LOG("Failed to load GeoParquet module");
                    if (typeof opt !== "undefined" && opt.error) {
                        opt.error("Failed to load GeoParquet module");
                    } else {
                        _alert("Failed to load GeoParquet module");
                    }
                }
            }, 10000); // 10 second timeout
            
            // Add the script to the document
            document.head.appendChild(script);
        }
    };
    /**
     * __processWithGeoParquet
     * Helper method to process GeoParquet data once geoparquet library is loaded
     * @param {ArrayBuffer} geoparquetBuffer ArrayBuffer containing GeoParquet data
     * @param {Object} opt options object
     * @param {Object} geoparquet the loaded geoparquet module
     * @type void
     */
    Data.Feed.prototype.__processWithGeoParquet = function (geoparquetBuffer, opt, geoparquet) {
        const __this = this;
        
        try {
            _LOG("Processing GeoParquet data, buffer size: " + geoparquetBuffer.byteLength + " bytes");
            _LOG("GeoParquet object: " + JSON.stringify(geoparquet));
            _LOG("Available geoparquet methods: " + Object.keys(geoparquet).join(', '));
            
            // Check for parquet magic number (PAR1)
            if (geoparquetBuffer.byteLength < 4) {
                throw new Error("File too small to be a valid parquet file");
            }
            
            const uint8Array = new Uint8Array(geoparquetBuffer);
            const magic = String.fromCharCode(...uint8Array.slice(0, 4));
            _LOG("Parquet file magic number: " + magic);
            
            if (magic !== 'PAR1') {
                throw new Error("File does not appear to be a valid parquet file (missing PAR1 magic number). Magic: " + magic);
            }
            
            _LOG("Valid parquet file detected, processing with geoparquet...");
            
            // Check if toGeoJson method exists
            if (typeof geoparquet.toGeoJson !== 'function') {
                throw new Error("toGeoJson method not found in geoparquet. Available methods: " + Object.keys(geoparquet).join(', '));
            }
            
            _LOG("Calling geoparquet.toGeoJson...");
            
            // Convert GeoParquet to GeoJSON (wrap in try-catch for encoding errors)
            let geoJson;
            try {
                geoJson = geoparquet.toGeoJson({ file: geoparquetBuffer });
            } catch (conversionError) {
                // Handle immediate errors (encoding issues, compression issues, etc.)
                const needsDuckDBFallback = conversionError.message && (
                    conversionError.message.includes('non-delta field') ||           // Thrift encoding issue
                    conversionError.message.includes('ZSTD') ||                      // ZSTD compression not supported
                    conversionError.message.includes('unsupported compression') ||   // Other compression issues
                    conversionError.message.toLowerCase().includes('unsupported geometry type') // Geometry type not supported by library
                );
                
                if (needsDuckDBFallback) {
                    if (conversionError.message.includes('ZSTD')) {
                        console.warn("⚠️ GeoParquet library doesn't support ZSTD compression");
                        Data.log("⚠️ File uses ZSTD compression - switching to DuckDB...");
                    } else if (conversionError.message.toLowerCase().includes('unsupported geometry type')) {
                        console.warn("⚠️ GeoParquet library doesn't support this geometry type");
                        Data.log("⚠️ File uses geometry type not supported by GeoParquet library - switching to DuckDB...");
                    } else {
                        console.warn("⚠️ GeoParquet library doesn't support this file's encoding/compression");
                    }
                    console.log("🔄 Falling back to DuckDB WASM for GeoParquet processing...");
                    _LOG("GeoParquet library failed with compatibility issue, using DuckDB fallback");
                    
                    // Check if DuckDB is loaded, if not, load it first
                    if (window.duckdb && window.duckdb.db) {
                        return __this.__processWithDuckDB(geoparquetBuffer, opt);
                    } else {
                        console.log("📦 DuckDB not loaded yet, loading now...");
                        return __this.__loadDuckDBAndProcess(geoparquetBuffer, opt);
                    }
                } else {
                    throw conversionError; // Re-throw other errors
                }
            }
            
            _LOG("GeoJSON conversion result type: " + typeof geoJson);
            _LOG("GeoJSON conversion result: " + JSON.stringify(geoJson));
            
            // Handle both Promise and direct return
            if (geoJson && typeof geoJson.then === 'function') {
                // It's a Promise
                _LOG("GeoJSON conversion is a Promise, waiting for resolution...");
                
                geoJson.then(function(geoJsonData) {
                    try {
                        _LOG("GeoJSON conversion completed successfully");
                        _LOG("GeoJSON type: " + geoJsonData.type);
                        _LOG("Number of features: " + (geoJsonData.features ? geoJsonData.features.length : 'unknown'));
                        
                        // Process the GeoJSON data
                        __this.__processGeoJsonData(geoJsonData, opt);
                        
                    } catch (error) {
                        _LOG("Error processing GeoJSON data: " + error);
                        throw new Error("Error processing GeoJSON data: " + error);
                    }
                }).catch(function(error) {
                    _LOG("Error in GeoJSON conversion: " + error);
                    _LOG("Error stack: " + error.stack);
                    _LOG("Error message: " + error.message);
                    
                    // Check for known compatibility issues that require DuckDB fallback
                    const needsDuckDBFallback = error.message && (
                        error.message.includes('non-delta field') ||           // Thrift encoding issue
                        error.message.includes('ZSTD') ||                      // ZSTD compression not supported
                        error.message.includes('unsupported compression') ||   // Other compression issues
                        error.message.toLowerCase().includes('unsupported geometry type') // Geometry type not supported by library
                    );
                    
                    if (needsDuckDBFallback) {
                        if (error.message.includes('ZSTD')) {
                            console.warn("⚠️ GeoParquet library doesn't support ZSTD compression");
                            Data.log("⚠️ File uses ZSTD compression - switching to DuckDB...");
                        } else if (error.message.toLowerCase().includes('unsupported geometry type')) {
                            console.warn("⚠️ GeoParquet library doesn't support this geometry type");
                            Data.log("⚠️ File uses geometry type not supported by GeoParquet library - switching to DuckDB...");
                        } else {
                            console.warn("⚠️ GeoParquet library doesn't support this file's encoding/compression");
                        }
                        console.log("🔄 Falling back to DuckDB WASM for GeoParquet processing...");
                        _LOG("GeoParquet library failed with compatibility issue, using DuckDB fallback");
                        
                        // Check if DuckDB is loaded, if not, load it first
                        if (window.duckdb && window.duckdb.db) {
                            __this.__processWithDuckDB(geoparquetBuffer, opt);
                        } else {
                            console.log("📦 DuckDB not loaded yet, loading now...");
                            __this.__loadDuckDBAndProcess(geoparquetBuffer, opt);
                        }
                    } else {
                        // Other error - report to user
                        if (typeof opt !== "undefined" && opt.error) {
                            opt.error("Error converting GeoParquet to GeoJSON: " + error);
                        } else {
                            _alert("Error converting GeoParquet to GeoJSON: " + error);
                        }
                    }
                });
            } else {
                // Direct return
                _LOG("GeoJSON conversion returned directly");
                
                if (!geoJson) {
                    throw new Error("GeoJSON conversion returned null or undefined");
                }
                
                _LOG("GeoJSON type: " + geoJson.type);
                _LOG("Number of features: " + (geoJson.features ? geoJson.features.length : 'unknown'));
                
                // Process the GeoJSON data
                this.__processGeoJsonData(geoJson, opt);
            }
            
        } catch (error) {
            _LOG("Error processing GeoParquet data: " + error);
            if (typeof opt !== "undefined" && opt.error) {
                opt.error("Error processing GeoParquet data: " + error);
            } else {
                _alert("Error processing GeoParquet data: " + error);
            }
        }
    };

    // ----------------------------------------
    // G E O P A C K A G E   ( . g p k g )
    // ----------------------------------------
    /**
     * __doGpkgImport
     * reads GeoPackage file from URL using DuckDB WASM spatial extension
     * @param szUrl GeoPackage file url
     * @param opt options object
     * @type void
     */
    Data.Feed.prototype.__doGpkgImport = function (szUrl, opt) {
        _LOG("__doGpkgImport: " + szUrl);
        
        const __this = this;
        
        // Use Fetch API for better binary handling
        _LOG("Attempting to load GeoPackage file using Fetch API...");
        
        fetch(szUrl, {
            method: 'GET',
            cache: opt.cache ? 'default' : 'no-cache'
        })
        .then(response => {
            _LOG("Fetch response received, status: " + response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Get the response as ArrayBuffer
            return response.arrayBuffer();
        })
        .then(arrayBuffer => {
            _LOG("Successfully loaded GeoPackage as ArrayBuffer: " + arrayBuffer.byteLength + " bytes");
            
            // Verify this looks like a SQLite/GeoPackage file
            const uint8Array = new Uint8Array(arrayBuffer);
            if (uint8Array.length >= 16) {
                const magic = String.fromCharCode(...uint8Array.slice(0, 16));
                _LOG("Magic string: " + magic);
                if (magic.startsWith('SQLite format 3')) {
                    _LOG("✅ SUCCESS: Valid GeoPackage (SQLite) file detected!");
                    __this.__processGpkgData(arrayBuffer, opt);
                } else {
                    _LOG("⚠️ Warning: Magic string is not 'SQLite format 3': " + magic);
                    _LOG("First 16 bytes: " + Array.from(uint8Array.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
                    
                    // Try to process anyway
                    _LOG("Attempting to process as GeoPackage anyway...");
                    __this.__processGpkgData(arrayBuffer, opt);
                }
            } else {
                _LOG("⚠️ Warning: Response too short to check magic number");
                __this.__processGpkgData(arrayBuffer, opt);
            }
        })
        .catch(error => {
            _LOG("Fetch failed: " + error.message);
            
            // Fallback to XMLHttpRequest if Fetch fails
            _LOG("Falling back to XMLHttpRequest...");
            __this.__loadGpkgWithXHR(szUrl, opt);
        });
    };
    /**
     * __loadGpkgWithXHR
     * fallback method using XMLHttpRequest if Fetch fails
     * @param szUrl GeoPackage file url
     * @param opt options object
     * @type void
     */
    Data.Feed.prototype.__loadGpkgWithXHR = function (szUrl, opt) {
        const __this = this;
        
        _LOG("Loading GeoPackage with XMLHttpRequest...");
        
        const xhr = new XMLHttpRequest();
        xhr.open('GET', szUrl, true);
        xhr.responseType = 'arraybuffer';
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                const arrayBuffer = xhr.response;
                _LOG("XHR successful: " + arrayBuffer.byteLength + " bytes");
                
                // Verify this looks like a GeoPackage file
                const uint8Array = new Uint8Array(arrayBuffer);
                if (uint8Array.length >= 16) {
                    const magic = String.fromCharCode(...uint8Array.slice(0, 16));
                    _LOG("XHR magic string: " + magic);
                    if (magic.startsWith('SQLite format 3')) {
                        _LOG("✅ SUCCESS: Valid GeoPackage file via XHR!");
                        __this.__processGpkgData(arrayBuffer, opt);
                    } else {
                        _LOG("⚠️ Warning: XHR magic string is not 'SQLite format 3': " + magic);
                        _LOG("First 16 bytes: " + Array.from(uint8Array.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
                        
                        // Try to process anyway
                        _LOG("Attempting to process anyway...");
                        __this.__processGpkgData(arrayBuffer, opt);
                    }
                } else {
                    _LOG("⚠️ Warning: XHR response too short to check magic number");
                    __this.__processGpkgData(arrayBuffer, opt);
                }
            } else {
                _LOG("XHR failed with status: " + xhr.status + " " + xhr.statusText);
                if (typeof opt !== "undefined" && opt.error) {
                    opt.error("XHR failed: " + xhr.status + " " + xhr.statusText);
                } else {
                    _alert("XHR failed: " + xhr.status + " " + xhr.statusText);
                }
            }
        };
        
        xhr.onerror = function() {
            _LOG("XHR network error");
            if (typeof opt !== "undefined" && opt.error) {
                opt.error("XHR network error");
            } else {
                _alert("XHR network error");
            }
        };
        
        xhr.send();
    };

    /**
     * __processGpkgData
     * Entry point for processing GeoPackage files using DuckDB WASM spatial extension
     * @param {ArrayBuffer} gpkgBuffer ArrayBuffer containing GeoPackage data
     * @param {Object} opt options object
     * @type void
     */
    Data.Feed.prototype.__processGpkgData = function (gpkgBuffer, opt) {
        const __this = this;
        
        _LOG("Processing GeoPackage data, buffer size: " + gpkgBuffer.byteLength + " bytes");
        Data.log("📦 Starting GeoPackage processing with DuckDB spatial extension...");
        
        // Check if DuckDB is already loaded AND working
        if (window.duckdb && window.duckdb.db && window.duckdb.conn) {
            console.log("📦 Attempting to use existing DuckDB WASM module for GeoPackage");
            
            // Test if the connection is still valid
            __this.__testAndUseDuckDB(gpkgBuffer, opt);
        } else {
            console.log("📦 Loading DuckDB WASM module for GeoPackage...");
            __this.__loadDuckDBAndProcessGpkg(gpkgBuffer, opt);
        }
    };
    
    /**
     * __testAndUseDuckDB
     * Tests if existing DuckDB connection is still valid, or recreates it
     * @param {ArrayBuffer} gpkgBuffer ArrayBuffer containing GeoPackage data
     * @param {Object} opt options object
     * @type void
     */
    Data.Feed.prototype.__testAndUseDuckDB = function (gpkgBuffer, opt) {
        const __this = this;
        
        // Try a simple query to test if connection is still valid
        window.duckdb.conn.query('SELECT 1 as test')
            .then(result => {
                console.log("✅ DuckDB connection is valid, reusing it");
                __this.__processGpkgWithDuckDB(gpkgBuffer, opt);
            })
            .catch(error => {
                console.warn("⚠️ Existing DuckDB connection is invalid:", error.message);
                console.log("🔄 Cleaning up and creating fresh DuckDB instance...");
                
                // Cleanup the broken instance
                __this.__cleanupDuckDB();
                
                // Create a new instance
                __this.__loadDuckDBAndProcessGpkg(gpkgBuffer, opt);
            });
    };
    
    /**
     * __cleanupDuckDB
     * Properly cleanup DuckDB worker and connections
     * @type void
     */
    Data.Feed.prototype.__cleanupDuckDB = function () {
        try {
            if (window.duckdb) {
                // Try to close connection
                if (window.duckdb.conn) {
                    try {
                        window.duckdb.conn.close();
                        console.log("🧹 Closed DuckDB connection");
                    } catch (e) {
                        console.warn("⚠️ Error closing connection:", e.message);
                    }
                }
                
                // Try to terminate the database
                if (window.duckdb.db) {
                    try {
                        window.duckdb.db.terminate();
                        console.log("🧹 Terminated DuckDB database");
                    } catch (e) {
                        console.warn("⚠️ Error terminating database:", e.message);
                    }
                }
                
                // Try to terminate the worker directly if it exists
                if (window.duckdb.worker) {
                    try {
                        window.duckdb.worker.terminate();
                        console.log("🧹 Terminated DuckDB worker");
                    } catch (e) {
                        console.warn("⚠️ Error terminating worker:", e.message);
                    }
                }
            }
        } catch (e) {
            console.warn("⚠️ Error during DuckDB cleanup:", e.message);
        } finally {
            // Always clear the reference
            delete window.duckdb;
            delete window.duckdbLoadedForGpkg;
            console.log("✅ DuckDB cleanup complete");
        }
    };

    /**
     * __loadDuckDBAndProcessGpkg
     * Loads DuckDB WASM module and processes GeoPackage data
     * Reuses the proven parquet loading mechanism
     * @param gpkgBuffer ArrayBuffer containing GeoPackage data
     * @param opt options object
     */
    Data.Feed.prototype.__loadDuckDBAndProcessGpkg = function (gpkgBuffer, opt) {
        const __this = this;
        
        _LOG("Loading DuckDB WASM module for GeoPackage...");
        
        // Create a wrapper to call GPKG processing after DuckDB loads
        // Store the buffer temporarily
        window.__pendingGpkgBuffer = gpkgBuffer;
        window.__pendingGpkgOpt = opt;
        
        // Use the same proven loading mechanism as parquet
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
            // Try to load DuckDB WASM from CDN
            let duckdb;
            try {
                // Try jsDelivr first (most reliable for DuckDB WASM)
                duckdb = await import("https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/+esm");
                console.log("✅ DuckDB loaded from jsDelivr for GeoPackage");
            } catch (e1) {
                try {
                    // Fallback to ESM.sh
                    duckdb = await import("https://esm.sh/@duckdb/duckdb-wasm@1.30.0");
                    console.log("✅ DuckDB loaded from ESM.sh for GeoPackage");
                } catch (e2) {
                    try {
                        // Fallback to unpkg
                        duckdb = await import("https://unpkg.com/@duckdb/duckdb-wasm@1.30.0");
                        console.log("✅ DuckDB loaded from unpkg for GeoPackage");
                    } catch (e3) {
                        throw new Error("Failed to load DuckDB from any CDN: " + e3.message);
                    }
                }
            }
            
            console.log("DuckDB WASM module imported for GeoPackage:", duckdb);
            console.log("Available DuckDB methods:", Object.keys(duckdb));
            
            // Initialize DuckDB using CDN bundles
            // CRITICAL: GeoPackage requires spatial extension, which MVP bundle doesn't support!
            // We MUST use EH bundle for GeoPackage (even though it uses pthread workers)
            try {
                console.log('🔧 Selecting bundle from jsDelivr CDN for GeoPackage...');
                const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
                
                // IMPORTANT: Must use EH bundle for GeoPackage (supports spatial extension)
                // MVP bundle does NOT support dynamic extensions needed for spatial
                console.log('🎯 Using EH bundle for GeoPackage (required for spatial extension)...');
                const bundle = JSDELIVR_BUNDLES.eh;
                console.log('✅ Using EH bundle:', bundle);
                
                console.log("👷 Creating worker from bundle...");
                
                let worker;
                try {
                    // Create worker using blob URL approach to avoid CORS issues
                    const worker_url = URL.createObjectURL(
                        new Blob([\`importScripts("\${bundle.mainWorker}");\`], { type: 'text/javascript' })
                    );
                    worker = new Worker(worker_url);
                    console.log("✅ Worker created successfully for GeoPackage");
                } catch (workerError) {
                    console.error("❌ Failed to create Web Worker:", workerError);
                    throw new Error("Worker creation failed: " + workerError.message + ". This may be due to browser resource limits. Try refreshing the page.");
                }
                
                const logger = new duckdb.ConsoleLogger();
                const db = new duckdb.AsyncDuckDB(logger, worker);
                
                // EH bundle supports pthread, so we pass pthreadWorker
                console.log("🚀 Instantiating DuckDB with WASM module...");
                await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
                console.log("✅ DuckDB instantiated for GeoPackage with EH bundle (spatial support enabled)");
                
                const conn = await db.connect();
                console.log("✅ DuckDB connection established for GeoPackage");
                
                // Store globally with worker reference for cleanup
                window.duckdb = { 
                    module: duckdb,
                    worker: worker,
                    db: db, 
                    conn: conn 
                };
                window.duckdbLoadedForGpkg = true;
            } catch (initError) {
                console.error("❌ DuckDB initialization error for GeoPackage:", initError);
                throw initError;
            }
        `;
        
        // Listen for when DuckDB is loaded
        const checkLoaded = setInterval(function() {
            if (window.duckdbLoadedForGpkg && window.duckdb) {
                clearInterval(checkLoaded);
                _LOG("DuckDB WASM module loaded successfully for GeoPackage");
                
                // Process the pending GeoPackage
                __this.__processGpkgWithDuckDB(window.__pendingGpkgBuffer, window.__pendingGpkgOpt);
                
                // Clean up
                delete window.__pendingGpkgBuffer;
                delete window.__pendingGpkgOpt;
                delete window.duckdbLoadedForGpkg;
            }
        }, 100);
        
        // Set a timeout in case loading fails
        setTimeout(function() {
            if (!window.duckdbLoadedForGpkg) {
                clearInterval(checkLoaded);
                _LOG("Failed to load DuckDB WASM module for GeoPackage");
                
                // Clean up
                delete window.__pendingGpkgBuffer;
                delete window.__pendingGpkgOpt;
                
                if (typeof opt !== "undefined" && opt.error) {
                    opt.error("Failed to load DuckDB WASM module for GeoPackage");
                } else {
                    _alert("Failed to load DuckDB WASM module for GeoPackage");
                }
            }
        }, 30000); // 30 second timeout
        
        // Add the script to the document
        document.head.appendChild(script);
    };

    /**
     * __ensureSpatialExtension
     * Ensures DuckDB spatial extension is installed and loaded
     * @param {function} callback - Function to call after extension is loaded
     * @param {function} errorCallback - Function to call on error
     */
    Data.Feed.prototype.__ensureSpatialExtension = function(callback, errorCallback) {
        const __this = this;
        
        _LOG("Checking DuckDB spatial extension...");
        
        // Try to load spatial extension (it may already be installed)
        window.duckdb.conn.query("INSTALL spatial;")
            .then(function() {
                _LOG("Spatial extension installed (or already present)");
                return window.duckdb.conn.query("LOAD spatial;");
            })
            .then(function() {
                _LOG("✅ Spatial extension loaded successfully");
                Data.log("✅ DuckDB spatial extension ready for GeoPackage");
                callback();
            })
            .catch(function(error) {
                // Extension might already be loaded, try to continue
                _LOG("Note: " + error.message);
                console.warn("⚠️ Spatial extension load note:", error.message);
                
                // Try to load anyway (extension might be pre-installed)
                window.duckdb.conn.query("LOAD spatial;")
                    .then(function() {
                        _LOG("Spatial extension loaded on second attempt");
                        callback();
                    })
                    .catch(function(error2) {
                        _LOG("❌ Could not load spatial extension: " + error2.message);
                        console.error("❌ Spatial extension not available:", error2);
                        
                        if (errorCallback) {
                            errorCallback(error2);
                        } else if (typeof opt !== "undefined" && opt.error) {
                            opt.error("DuckDB spatial extension not available: " + error2.message);
                        } else {
                            _alert("DuckDB spatial extension not available. Cannot process GeoPackage files.");
                        }
                    });
            });
    };
    /**
     * __processGpkgWithDuckDB
     * Processes GeoPackage data using DuckDB WASM spatial extension with ST_Read
     * @param gpkgBuffer ArrayBuffer containing GeoPackage data
     * @param opt options object
     */
    Data.Feed.prototype.__processGpkgWithDuckDB = function (gpkgBuffer, opt) {
        const __this = this;
        
        try {
            _LOG("Processing GeoPackage with DuckDB spatial extension, buffer size: " + gpkgBuffer.byteLength + " bytes");
            
            // Check for SQLite magic number
            if (gpkgBuffer.byteLength < 16) {
                throw new Error("File too small to be a valid GeoPackage file");
            }
            
            const uint8Array = new Uint8Array(gpkgBuffer);
            const magic = String.fromCharCode(...uint8Array.slice(0, 16));
            _LOG("GeoPackage magic string: " + magic);
            
            if (!magic.startsWith('SQLite format 3')) {
                throw new Error("File does not appear to be a valid GeoPackage file (missing SQLite header). Magic: " + magic);
            }
            
            _LOG("Valid GeoPackage file detected, processing with DuckDB spatial extension...");
            
            // Ensure spatial extension is loaded
            __this.__ensureSpatialExtension(function() {
                // Extension loaded, now process the file
                
                // Register the GeoPackage buffer as a temporary file in DuckDB's virtual filesystem
                const tempFileName = 'temp_gpkg_' + Date.now() + '.gpkg';
                
                // Create a copy to avoid modifying the original buffer
                const uint8ArrayCopy = new Uint8Array(gpkgBuffer);
                
                window.duckdb.db.registerFileBuffer(tempFileName, uint8ArrayCopy)
                    .then(function() {
                        console.log("GeoPackage file registered in DuckDB virtual filesystem");
                        Data.log("📦 Reading GeoPackage with ST_Read...");
                        
                        // First, query to discover geometry column names
                        return window.duckdb.conn.query(`
                            SELECT column_name 
                            FROM (DESCRIBE SELECT * FROM st_read('${tempFileName}'))
                            WHERE column_type LIKE '%GEOMETRY%' OR column_type LIKE '%WKB%'
                        `).then(function(geomColsResult) {
                            let geomColumns = [];
                            try {
                                const geomRows = geomColsResult.toArray ? geomColsResult.toArray() : geomColsResult;
                                geomColumns = geomRows.map(row => row.column_name || row[0]);
                                console.log("Found geometry columns:", geomColumns);
                            } catch (e) {
                                console.warn("⚠️ Could not detect geometry columns, will read all as-is");
                            }
                            
                            // Build query based on whether geometry columns exist
                            let dataQuery;
                            if (geomColumns.length > 0) {
                                // Build SELECT list with geometry conversion
                                const selectCols = geomColumns.map(col => 
                                    `ST_AsGeoJSON(${col}) as ${col}`
                                ).join(', ');
                                
                                dataQuery = `
                                    SELECT * EXCLUDE (${geomColumns.join(', ')}), 
                                           ${selectCols}
                                    FROM st_read('${tempFileName}')
                                    LIMIT 10000000
                                `;
                            } else {
                                // No geometry columns, just read everything
                                dataQuery = `
                                    SELECT *
                                    FROM st_read('${tempFileName}')
                                    LIMIT 10000000
                                `;
                            }
                            
                            console.log("Executing query:", dataQuery);
                            return window.duckdb.conn.query(dataQuery);
                        });
                    })
                    .then(async function(result) {
                        console.log("DuckDB GeoPackage query completed successfully");
                        _LOG("DuckDB query result type: " + typeof result);
                        
                        if (!result) {
                            throw new Error("DuckDB query returned null/undefined");
                        }
                        
                        // Extract rows and columns (same as parquet processing)
                        let rows;
                        let columns;
                        
                        if (typeof result.toArray === 'function') {
                            rows = result.toArray();
                            console.log("Using toArray() method, rows count:", rows.length);
                        } else if (typeof result.fetchAll === 'function') {
                            rows = result.fetchAll();
                            console.log("Using fetchAll() method, rows count:", rows.length);
                        } else if (Array.isArray(result)) {
                            rows = result;
                            console.log("Result is already an array, rows count:", rows.length);
                        } else {
                            throw new Error("Cannot convert DuckDB result to array. Available methods: " + Object.getOwnPropertyNames(result).join(', '));
                        }
                        
                        if (rows.length === 0) {
                            throw new Error("No rows found in GeoPackage file");
                        }
                        
                        // Get column names and types from schema
                        let columnTypes = null;
                        if (result.schema && result.schema.fields) {
                            columns = result.schema.fields.map(field => field.name);
                            // Extract type information for optimization using helper
                            columnTypes = __this.__detectColumnTypes(result.schema);
                            if (columnTypes) {
                                _LOG("Schema-based optimization enabled - detected column types: " + columnTypes.join(', '));
                            }
                        } else if (result.columns) {
                            columns = result.columns;
                        } else if (rows.length > 0 && typeof rows[0] === 'object') {
                            columns = Object.keys(rows[0]);
                        } else {
                            throw new Error("Cannot determine column names from DuckDB result");
                        }
                        
                        _LOG("Extracted columns: " + columns.join(', '));
                        
                        if (columns.length === 0) {
                            throw new Error("No columns found in GeoPackage file");
                        }
                        
                        const geometryColumnNames = columns.filter(name => {
                            const lower = (name || '').toLowerCase();
                            return lower === 'geometry' || lower === 'geom' || lower === 'wkb_geometry' || lower === 'shape' || lower.includes('geom');
                        });

                        if (geometryColumnNames.length) {
                            if (!columnTypes) {
                                columnTypes = columns.map(() => 'other');
                            }
                            geometryColumnNames.forEach((colName) => {
                                const idx = columns.indexOf(colName);
                                if (idx !== -1) {
                                    columnTypes[idx] = 'geometry';
                                }
                            });
                        }
                        
                        // Process rows - check dataset size
                        const dataRows = [];
                        
                        if (rows.length > 10000000) {
                            throw new Error(`Dataset too large (${rows.length} rows). Maximum supported: 10,000,000 rows.`);
                        }
                        
                        // Warn about large datasets
                        if (rows.length > 500000) {
                            Data.log(`⚠️ Processing large GeoPackage dataset (${rows.length} rows). This may take a while.`);
                        }

                        // For large datasets, use streaming processing
                        if (rows.length > 100000) {
                            Data.log("Large GeoPackage dataset detected, using streaming processing...");
                            return __this.__processStreamingDataset(rows, columns, columnTypes, tempFileName, opt);
                        }
                        
                        // For medium-large datasets (50K-100K), use optimized batch processing
                        if (rows.length > 50000) {
                            console.log("Medium-large GeoPackage dataset detected, using optimized batch processing...");
                            
                            // Detect row format once
                            const isArrayFormat = rows.length > 0 && Array.isArray(rows[0]);
                            const isObjectFormat = rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null && !Array.isArray(rows[0]);
                            
                            // Dynamic batch sizing based on cell count
                            const cellsPerRow = columns.length;
                            const totalCells = rows.length * cellsPerRow;
                            const actualBatchSize = Math.min(
                                2000000,
                                Math.max(100000, Math.floor(10000000 / cellsPerRow))
                            );
                            
                            console.log(`Processing ${rows.length.toLocaleString()} GeoPackage rows (${totalCells.toLocaleString()} cells) in batches of ${actualBatchSize.toLocaleString()} rows`);
                            if (columnTypes) {
                                Data.log(`⚡ Schema-based optimization active for GeoPackage dataset`);
                            }
                            
                            try {
                                // Simplified batch processor using smart idle scheduling
                                const processMicroBatch = async (startIndex, endIndex) => {
                                    return __this.__scheduleIdleWork((deadline) => {
                                        // Process all rows in batch using helper function
                                        for (let i = startIndex; i < endIndex; i++) {
                                            dataRows.push(__this.__processRow(rows[i], columns, columnTypes, isArrayFormat, isObjectFormat));
                                        }
                                    }, 1000);
                                };
                                
                                // Process all data in optimized batches
                                const startTime = Date.now();
                                let lastLogTime = startTime;
                                
                                for (let batchStart = 0; batchStart < rows.length; batchStart += actualBatchSize) {
                                    const batchEnd = Math.min(batchStart + actualBatchSize, rows.length);
                                    await processMicroBatch(batchStart, batchEnd);
                                    
                                    const now = Date.now();
                                    const timeSinceLastLog = now - lastLogTime;
                                    
                                    // Log every 500K rows or every 2 seconds
                                    if (batchEnd % 500000 === 0 || batchEnd === rows.length || timeSinceLastLog > 2000) {
                                        const elapsed = ((now - startTime) / 1000).toFixed(1);
                                        const rowsPerSec = Math.round(batchEnd / ((now - startTime) / 1000));
                                        let memInfo = '';
                                        if (performance.memory) {
                                            const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                                            const total = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
                                            memInfo = ` | Memory: ${used}MB / ${total}MB`;
                                        }
                                        Data.log(`Processing GeoPackage: ${batchEnd.toLocaleString()} / ${rows.length.toLocaleString()} rows (${Math.round((batchEnd / rows.length) * 100)}%) | ${rowsPerSec.toLocaleString()} rows/sec | ${elapsed}s${memInfo}`);
                                        lastLogTime = now;
                                    }
                                }
                            } catch (error) {
                                console.warn("⚠️ Async processing failed for GeoPackage, using synchronous:", error);
                                
                                // Fallback to synchronous processing
                                for (let i = 0; i < rows.length; i++) {
                                    dataRows.push(__this.__processRow(rows[i], columns, columnTypes, rows.length > 0 && Array.isArray(rows[0]), rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null && !Array.isArray(rows[0])));
                                }
                            }
                        } else {
                            // For smaller datasets (< 50K), use fast synchronous processing
                            console.log(`Processing small GeoPackage dataset (${rows.length.toLocaleString()} rows) synchronously`);
                            
                            // Detect row format once
                            const isArrayFormat = rows.length > 0 && Array.isArray(rows[0]);
                            const isObjectFormat = rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null && !Array.isArray(rows[0]);
                            
                            // Fast synchronous processing
                            for (let i = 0; i < rows.length; i++) {
                                dataRows.push(__this.__processRow(rows[i], columns, columnTypes, isArrayFormat, isObjectFormat));
                            }
                        }
                        
                        _LOG("Converted " + dataRows.length + " GeoPackage rows with " + columns.length + " columns");
                        
                        // Create data array with header row
                        const dataA = [columns];
                        dataA.push(...dataRows);
                        
                        _LOG("Created data array with " + dataA.length + " rows (including header)");
                        
                        // Clean up the temporary file
                        try {
                            window.duckdb.db.dropFile(tempFileName);
                            console.log("🧹 Cleaned up temporary GeoPackage file");
                        } catch (cleanupError) {
                            console.warn("Warning: Could not clean up temporary file:", cleanupError);
                        }
                        
                        // Process the data using the standard method
                        __this.__createDataTableObject(dataA, "gpkg", opt);
                        
                    })
                    .catch(function(error) {
                        console.error("❌ Error processing GeoPackage with DuckDB:", error);
                        _LOG("Error in GeoPackage processing: " + error);
                        
                        // Clean up the temporary file
                        try {
                            window.duckdb.db.dropFile(tempFileName);
                        } catch (cleanupError) {
                            console.warn("Warning: Could not clean up temporary file:", cleanupError);
                        }
                        
                        if (typeof opt !== "undefined" && opt.error) {
                            opt.error("Error processing GeoPackage: " + error.message);
                        } else {
                            _alert("Error processing GeoPackage: " + error.message);
                        }
                    });
                    
            }, function(error) {
                _LOG("❌ Error loading spatial extension: " + error);
                console.error("❌ Spatial extension error:", error);
                
                if (typeof opt !== "undefined" && opt.error) {
                    opt.error("Error loading DuckDB spatial extension: " + error.message);
                } else {
                    _alert("Error loading DuckDB spatial extension: " + error.message);
                }
            });
                
        } catch (error) {
            _LOG("Error in DuckDB GeoPackage processing setup: " + error);
            console.error("❌ DuckDB GeoPackage setup error:", error);
            
            if (typeof opt !== "undefined" && opt.error) {
                opt.error("Error setting up DuckDB GeoPackage processing: " + error.message);
            } else {
                _alert("Error setting up DuckDB GeoPackage processing: " + error.message);
            }
        }
    };


    // ---------------------------------
    // F L A T G E O B U F 
    // ---------------------------------

    /**
     * __doFlatGeobufImport
     * reads FlatGeobuf (.fgb) files from URL
     * loads binary data and processes it into GeoJSON
     * @param szUrl FlatGeobuf file url
     * @param opt options object
     * @type void
     */
    Data.Feed.prototype.__doFlatGeobufImport = function (szUrl, opt) {
        
        _LOG("__doFlatGeobufImport: " + szUrl);
        const __this = this;
        
        Data.log("Loading FlatGeobuf file from: " + szUrl);
        
        // Check if spatial filter (bbox) is provided
        // If bbox is provided, use streaming with HTTP Range Requests for efficient filtering
        // If no bbox, download the entire file (simpler and faster for full dataset)
        if (opt && opt.bbox) {
            _LOG("Bbox filter detected - using streaming mode with HTTP Range Requests");
            Data.log("🔍 Using HTTP Range Requests for spatial filtering");
            __this.__loadFlatGeobufStreaming(szUrl, opt);
        } else {
            _LOG("No bbox filter - loading entire file");
            // Try using Fetch API first (modern, supports streaming)
            fetch(szUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    _LOG("Fetch successful, reading FlatGeobuf data...");
                    return response.arrayBuffer();
                })
                .then(arrayBuffer => {
                    _LOG("FlatGeobuf data loaded: " + arrayBuffer.byteLength + " bytes");
                    
                    // Verify this looks like a FlatGeobuf file (magic bytes: 0x6667620366676200)
                    const uint8Array = new Uint8Array(arrayBuffer);
                    if (uint8Array.length >= 8) {
                        const magic = Array.from(uint8Array.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
                        _LOG("Magic bytes: " + magic);
                        // FlatGeobuf magic bytes can vary, but typically start with 'fgb' in some form
                        // We'll process it regardless and let the library handle validation
                    }
                    
                    __this.__processFlatGeobufData(arrayBuffer, opt);
                })
                .catch(error => {
                    _LOG("Fetch failed: " + error.message);
                    
                    // Fallback to XMLHttpRequest if Fetch fails
                    _LOG("Falling back to XMLHttpRequest...");
                    __this.__loadFlatGeobufWithXHR(szUrl, opt);
                });
        }
    };
    /**
     * __loadFlatGeobufWithXHR
     * fallback method using XMLHttpRequest if Fetch fails
     * @param szUrl FlatGeobuf file url
     * @param opt options object
     * @type void
     */
    Data.Feed.prototype.__loadFlatGeobufWithXHR = function (szUrl, opt) {
        const __this = this;
        
        _LOG("Loading FlatGeobuf with XMLHttpRequest...");
        
        const xhr = new XMLHttpRequest();
        xhr.open('GET', szUrl, true);
        xhr.responseType = 'arraybuffer';
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                const arrayBuffer = xhr.response;
                _LOG("XHR successful: " + arrayBuffer.byteLength + " bytes");
                __this.__processFlatGeobufData(arrayBuffer, opt);
            } else {
                _LOG("XHR failed with status: " + xhr.status + " " + xhr.statusText);
                if (typeof opt !== "undefined" && opt.error) {
                    opt.error("XHR failed: " + xhr.status + " " + xhr.statusText);
                } else {
                    _alert("XHR failed: " + xhr.status + " " + xhr.statusText);
                }
            }
        };
        
        xhr.onerror = function() {
            _LOG("XHR network error");
            if (typeof opt !== "undefined" && opt.error) {
                opt.error("XHR network error");
            } else {
                _alert("XHR network error");
            }
        };
        
        xhr.send();
    };

    /**
     * __loadFlatGeobufStreaming
     * Loads FlatGeobuf with HTTP Range Requests for efficient spatial filtering
     * This allows the FlatGeobuf R-tree index to fetch only the relevant portions of the file
     * @param szUrl FlatGeobuf file url
     * @param opt options object (must include opt.bbox for spatial filtering)
     * @type void
     */
    Data.Feed.prototype.__loadFlatGeobufStreaming = function (szUrl, opt) {
        const __this = this;
        
        _LOG("Loading FlatGeobuf with streaming and spatial filter...");
        Data.log("🌐 Using HTTP Range Requests for efficient spatial filtering");
        
        // Check if FlatGeobuf library is already loaded
        if (window.flatgeobuf) {
            console.log("📦 Using existing FlatGeobuf library for streaming");
            __this.__streamFlatGeobufWithLib(szUrl, opt);
        } else {
            console.log("📦 Loading FlatGeobuf library for streaming...");
            __this.__loadFlatGeobufLibAndStream(szUrl, opt);
        }
    };
    /**
     * __loadFlatGeobufLibAndStream
     * Loads FlatGeobuf library from CDN and then streams the data with spatial filter
     * @param szUrl FlatGeobuf file url
     * @param opt options object
     */
    Data.Feed.prototype.__loadFlatGeobufLibAndStream = function (szUrl, opt) {
        const __this = this;
        
        _LOG("Loading FlatGeobuf library from CDN for streaming...");
        
        // Capture szUrl and opt in closure to avoid race conditions with multiple concurrent loads
        const capturedUrl = szUrl;
        const capturedOpt = opt;
        
        // Check if library is already being loaded
        if (!window.__flatgeobufLoading) {
            window.__flatgeobufLoading = true;
            
            const script = document.createElement('script');
            script.type = 'module';
            script.textContent = `
                try {
                    // Try to load FlatGeobuf from CDN
                    let flatgeobuf;
                    try {
                        // Try jsDelivr with geojson subpath (most reliable)
                        flatgeobuf = await import("https://cdn.jsdelivr.net/npm/flatgeobuf@3.31.0/lib/mjs/geojson.js");
                        console.log("✅ FlatGeobuf GeoJSON loaded from jsDelivr");
                    } catch (e1) {
                        console.warn("jsDelivr geojson failed:", e1);
                        try {
                            // Try main package from jsDelivr
                            flatgeobuf = await import("https://cdn.jsdelivr.net/npm/flatgeobuf@latest/+esm");
                            console.log("✅ FlatGeobuf loaded from jsDelivr (main)");
                        } catch (e2) {
                            console.warn("jsDelivr main failed:", e2);
                            try {
                                // Fallback to unpkg with geojson
                                flatgeobuf = await import("https://unpkg.com/flatgeobuf@3.31.0/lib/mjs/geojson.js");
                                console.log("✅ FlatGeobuf loaded from unpkg");
                            } catch (e3) {
                                console.warn("unpkg failed:", e3);
                                try {
                                    // Fallback to ESM.sh
                                    flatgeobuf = await import("https://esm.sh/flatgeobuf@3.31.0/lib/mjs/geojson");
                                    console.log("✅ FlatGeobuf loaded from esm.sh");
                                } catch (e4) {
                                    console.error("❌ Failed to load FlatGeobuf from any CDN:", e4);
                                    throw new Error("Failed to load FlatGeobuf library from CDN: " + e4.message);
                                }
                            }
                        }
                    }
                    
                    // Store globally for reuse
                    console.log("FlatGeobuf module loaded, available exports:", Object.keys(flatgeobuf));
                    window.flatgeobuf = flatgeobuf;
                    window.__flatgeobufLoading = false;
                    
                    // Trigger streaming for all pending requests
                    window.dispatchEvent(new CustomEvent('flatgeobuf-streaming-ready'));
                } catch (error) {
                    console.error("❌ FlatGeobuf streaming setup error:", error);
                    window.__flatgeobufLoading = false;
                    window.dispatchEvent(new CustomEvent('flatgeobuf-streaming-error', { detail: error }));
                }
            `;
            
            // Handle script errors
            script.onerror = function(error) {
                _LOG("❌ Failed to load FlatGeobuf library script for streaming");
                window.__flatgeobufLoading = false;
                window.dispatchEvent(new CustomEvent('flatgeobuf-streaming-error', { detail: error }));
            };
            
            document.body.appendChild(script);
        }
        
        // Listen for successful load - use captured values from closure
        const loadHandler = function() {
            window.removeEventListener('flatgeobuf-streaming-ready', loadHandler);
            
            // Use captured values from closure to avoid race conditions
            __this.__streamFlatGeobufWithLib(capturedUrl, capturedOpt);
        };
        
        // Listen for errors
        const errorHandler = function(event) {
            window.removeEventListener('flatgeobuf-streaming-error', errorHandler);
            
            if (typeof capturedOpt !== "undefined" && capturedOpt.error) {
                capturedOpt.error("Failed to load FlatGeobuf library from CDN: " + (event.detail ? event.detail.message : "Unknown error"));
            } else {
                _alert("Failed to load FlatGeobuf library from CDN");
            }
        };
        
        window.addEventListener('flatgeobuf-streaming-ready', loadHandler);
        window.addEventListener('flatgeobuf-streaming-error', errorHandler);
    };

    /**
     * __streamFlatGeobufWithLib
     * Streams FlatGeobuf data using HTTP Range Requests with spatial filtering
     * @param szUrl FlatGeobuf file url
     * @param opt options object with bbox
     */
    Data.Feed.prototype.__streamFlatGeobufWithLib = function (szUrl, opt) {
        const __this = this;
        
        try {
            _LOG("Streaming FlatGeobuf with spatial filter from URL: " + szUrl);
            Data.log("🔄 Streaming FlatGeobuf with spatial filter...");
            
            // Find the deserialize function
            let deserialize = null;
            
            if (window.flatgeobuf) {
                deserialize = window.flatgeobuf.deserialize ||
                              window.flatgeobuf.default?.deserialize ||
                              window.flatgeobuf.geojson?.deserialize ||
                              (window.flatgeobuf.default?.geojson?.deserialize);
            }
            
            if (!deserialize) {
                throw new Error("FlatGeobuf deserialize function not found. Available: " + Object.keys(window.flatgeobuf || {}).join(", "));
            }
            
            _LOG("Found deserialize function, starting streaming...");
            
            // Get bbox for spatial filtering
            const bbox = opt.bbox;
            _LOG("Applying spatial filter - bbox: [" + bbox.join(", ") + "]");
            Data.log("🔍 Spatial filter: [" + bbox.join(", ") + "]");
            
            // Deserialize with streaming and spatial filter
            // The FlatGeobuf library will make range requests using the R-tree index
            // Following the official FlatGeobuf example pattern
            (async () => {
                try {
                    const features = [];
                    const startTime = Date.now();
                    
                    _LOG("Starting FlatGeobuf streaming deserialization with bbox filter...");
                    
                    // Convert bbox array to rect object (FlatGeobuf format)
                    const rect = {
                        minX: bbox[0],
                        minY: bbox[1],
                        maxX: bbox[2],
                        maxY: bbox[3]
                    };
                    
                    // Use the FlatGeobuf library EXACTLY as in official examples
                    // API: deserialize(url, rect, headerCallback?)
                    // Third parameter is optional callback for header metadata, NOT custom fetch
                    const iter = deserialize(szUrl, rect);
                    
                    // Iterate through features asynchronously
                    for await (const feature of iter) {
                        features.push(feature);
                    }
                    
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                    _LOG("Streaming complete! Features: " + features.length + " in " + elapsed + "s");
                    Data.log("✅ Loaded " + features.length + " features in " + elapsed + "s (HTTP range requests)");
                    
                    // Create GeoJSON FeatureCollection
                    const geojson = {
                        type: "FeatureCollection",
                        features: features
                    };
                    
                    // Process as GeoJSON
                    __this.__processGeoJsonData(geojson, opt);
                    
                } catch (error) {
                    // Streaming failed - this is often due to server compression issues
                    // Fallback to full download is automatic and expected for misconfigured servers
                    _LOG("FlatGeobuf streaming not available (common with compressed servers): " + error.message);
                    
                    // Check error type for better diagnostics
                    if (error.message && (error.message.includes('DECODING') || error.message.includes('Failed to fetch'))) {
                        // This is expected for servers that compress data - not an error
                        console.log("ℹ️ Server doesn't support HTTP range requests (likely compressed)");
                        Data.log("ℹ️ Using full download mode (server compression detected)");
                    } else {
                        // Unexpected error - show as warning
                        console.warn("⚠️ Streaming failed:", error.message);
                        Data.log("⚠️ Using fallback download method");
                    }
                    
                    // Fallback to downloading the entire file and filtering in memory
                    _LOG("Downloading full file and filtering in memory");
                    
                    fetch(szUrl)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                            }
                            return response.arrayBuffer();
                        })
                        .then(arrayBuffer => {
                            _LOG("Full file downloaded: " + arrayBuffer.byteLength + " bytes, applying bbox filter in memory");
                            Data.log("Downloaded " + Math.round(arrayBuffer.byteLength/(1024*1024)*10)/10 + " MB, filtering features...");
                            
                            // Process with bbox option - it will filter during deserialization
                            __this.__processFlatGeobufData(arrayBuffer, opt);
                        })
                        .catch(fallbackError => {
                            console.error("❌ Fallback also failed:", fallbackError);
                            _LOG("Fallback download failed: " + fallbackError);
                            
                            if (typeof opt !== "undefined" && opt.error) {
                                opt.error("Error loading FlatGeobuf: " + fallbackError.message);
                            } else {
                                _alert("Error loading FlatGeobuf: " + fallbackError.message);
                            }
                        });
                }
            })();
                
        } catch (error) {
            _LOG("Error setting up FlatGeobuf streaming: " + error);
            console.error("❌ FlatGeobuf streaming setup error:", error);
            
            if (typeof opt !== "undefined" && opt.error) {
                opt.error("Error setting up FlatGeobuf streaming: " + error.message);
            } else {
                _alert("Error setting up FlatGeobuf streaming: " + error.message);
            }
        }
    };
    /**
     * __processFlatGeobufData
     * Entry point for processing FlatGeobuf files using flatgeobuf library
     * @param {ArrayBuffer} fgbBuffer ArrayBuffer containing FlatGeobuf data
     * @param {Object} opt options object
     * @type void
     */
    Data.Feed.prototype.__processFlatGeobufData = function (fgbBuffer, opt) {
        const __this = this;
        
        _LOG("Processing FlatGeobuf data, buffer size: " + fgbBuffer.byteLength + " bytes");
        Data.log("📦 Starting FlatGeobuf processing...");
        
        // Check if FlatGeobuf library is already loaded
        if (window.flatgeobuf) {
            console.log("📦 Using existing FlatGeobuf library");
            __this.__processFlatGeobufWithLib(fgbBuffer, opt);
        } else {
            console.log("📦 Loading FlatGeobuf library from CDN...");
            __this.__loadFlatGeobufLibAndProcess(fgbBuffer, opt);
        }
    };

    /**
     * __loadFlatGeobufLibAndProcess
     * Loads FlatGeobuf library from CDN and processes the data
     * @param fgbBuffer ArrayBuffer containing FlatGeobuf data
     * @param opt options object
     */
    Data.Feed.prototype.__loadFlatGeobufLibAndProcess = function (fgbBuffer, opt) {
        const __this = this;
        
        _LOG("Loading FlatGeobuf library from CDN...");
        
        // Store the buffer temporarily
        window.__pendingFgbBuffer = fgbBuffer;
        window.__pendingFgbOpt = opt;
        
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
            // Try to load FlatGeobuf from CDN
            let flatgeobuf;
            try {
                // Try jsDelivr with geojson subpath (most reliable)
                flatgeobuf = await import("https://cdn.jsdelivr.net/npm/flatgeobuf@3.31.0/lib/mjs/geojson.js");
                console.log("✅ FlatGeobuf GeoJSON loaded from jsDelivr");
            } catch (e1) {
                console.warn("jsDelivr geojson failed:", e1);
                try {
                    // Try main package from jsDelivr
                    flatgeobuf = await import("https://cdn.jsdelivr.net/npm/flatgeobuf@latest/+esm");
                    console.log("✅ FlatGeobuf loaded from jsDelivr (main)");
                } catch (e2) {
                    console.warn("jsDelivr main failed:", e2);
                    try {
                        // Fallback to unpkg with geojson
                        flatgeobuf = await import("https://unpkg.com/flatgeobuf@3.31.0/lib/mjs/geojson.js");
                        console.log("✅ FlatGeobuf loaded from unpkg");
                    } catch (e3) {
                        console.warn("unpkg failed:", e3);
                        try {
                            // Fallback to ESM.sh
                            flatgeobuf = await import("https://esm.sh/flatgeobuf@3.31.0/lib/mjs/geojson");
                            console.log("✅ FlatGeobuf loaded from esm.sh");
                        } catch (e4) {
                            console.error("❌ Failed to load FlatGeobuf from any CDN:", e4);
                            throw new Error("Failed to load FlatGeobuf library from CDN: " + e4.message);
                        }
                    }
                }
            }
            
            // Store globally for reuse
            console.log("FlatGeobuf module loaded, available exports:", Object.keys(flatgeobuf));
            window.flatgeobuf = flatgeobuf;
            
            // Trigger processing
            window.dispatchEvent(new CustomEvent('flatgeobuf-loaded'));
        `;
        
        // Listen for successful load
        const loadHandler = function() {
            const buffer = window.__pendingFgbBuffer;
            const options = window.__pendingFgbOpt;
            
            // Clean up
            delete window.__pendingFgbBuffer;
            delete window.__pendingFgbOpt;
            window.removeEventListener('flatgeobuf-loaded', loadHandler);
            document.body.removeChild(script);
            
            // Process the data
            __this.__processFlatGeobufWithLib(buffer, options);
        };
        
        window.addEventListener('flatgeobuf-loaded', loadHandler);
        
        // Handle errors
        script.onerror = function(error) {
            _LOG("❌ Failed to load FlatGeobuf library");
            window.removeEventListener('flatgeobuf-loaded', loadHandler);
            
            if (typeof opt !== "undefined" && opt.error) {
                opt.error("Failed to load FlatGeobuf library from CDN");
            } else {
                _alert("Failed to load FlatGeobuf library from CDN");
            }
        };
        
        document.body.appendChild(script);
    };

    /**
     * __processFlatGeobufWithDuckDB
     * Fallback to process FlatGeobuf using DuckDB WASM spatial extension
     * @param fgbBuffer ArrayBuffer containing FlatGeobuf data
     * @param opt options object
     *            opt.bbox - optional bounding box filter [minX, minY, maxX, maxY]
     *                       Uses ST_Intersects for spatial filtering
     */
    Data.Feed.prototype.__processFlatGeobufWithDuckDB = function (fgbBuffer, opt) {
        const __this = this;
        
        _LOG("Processing FlatGeobuf with DuckDB WASM spatial extension...");
        Data.log("🦆 Using DuckDB WASM to read FlatGeobuf file...");
        
        // Check if DuckDB is already loaded
        if (window.duckdb && window.duckdb.db) {
            __this.__processFgbWithDuckDB(fgbBuffer, opt);
        } else {
            Data.log("📦 Loading DuckDB WASM...");
            __this.__loadDuckDBAndProcessFgb(fgbBuffer, opt);
        }
    };
    /**
     * __loadDuckDBAndProcessFgb
     * Loads DuckDB WASM and processes FlatGeobuf data
     * @param fgbBuffer ArrayBuffer containing FlatGeobuf data
     * @param opt options object
     */
    Data.Feed.prototype.__loadDuckDBAndProcessFgb = function (fgbBuffer, opt) {
        const __this = this;
        
        _LOG("Loading DuckDB WASM module for FlatGeobuf...");
        
        // Store the buffer temporarily
        window.__pendingFgbBufferDuckDB = fgbBuffer;
        window.__pendingFgbOptDuckDB = opt;
        
        // Use the same proven loading mechanism as parquet and geopackage
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
            // Try to load DuckDB WASM from CDN
            let duckdb;
            try {
                // Try jsDelivr first (most reliable for DuckDB WASM)
                duckdb = await import("https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/+esm");
                console.log("✅ DuckDB loaded from jsDelivr for FlatGeobuf");
            } catch (e1) {
                try {
                    // Fallback to ESM.sh
                    duckdb = await import("https://esm.sh/@duckdb/duckdb-wasm@1.30.0");
                    console.log("✅ DuckDB loaded from ESM.sh for FlatGeobuf");
                } catch (e2) {
                    try {
                        // Fallback to unpkg
                        duckdb = await import("https://unpkg.com/@duckdb/duckdb-wasm@1.30.0/+esm");
                        console.log("✅ DuckDB loaded from unpkg for FlatGeobuf");
                    } catch (e3) {
                        console.error("❌ Failed to load DuckDB from any CDN:", e3);
                        throw new Error("Failed to load DuckDB library from CDN: " + e3.message);
                    }
                }
            }
            
            // Store module reference
            window.duckdbModule = duckdb;
            
            // Check if window.duckdb already exists (from parquet/gpkg loading)
            if (!window.duckdb || !window.duckdb.db) {
                // Get bundles
                const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
                
                // Force MVP bundle (single-threaded) to avoid pthread worker issues
                console.log('🎯 Forcing MVP bundle (single-threaded) to avoid resource limits...');
                const bundle = JSDELIVR_BUNDLES.mvp;
                console.log('✅ Using MVP bundle for FlatGeobuf:', bundle);
                
                console.log("📦 Creating DuckDB worker for FlatGeobuf...");
                
                // Create worker using blob URL to avoid CORS issues
                const worker_url = URL.createObjectURL(
                    new Blob([\`importScripts("\${bundle.mainWorker}");\`], { type: 'text/javascript' })
                );
                const worker = new Worker(worker_url);
                URL.revokeObjectURL(worker_url);
                
                // Initialize DuckDB
                const logger = new duckdb.ConsoleLogger();
                const db = new duckdb.AsyncDuckDB(logger, worker);
                // MVP bundle is single-threaded, so we don't pass pthreadWorker
                await db.instantiate(bundle.mainModule);
                
                console.log("✅ DuckDB initialized successfully for FlatGeobuf");
                
                // Create a new object to store db and connection (don't modify frozen module)
                window.duckdb = {
                    module: duckdb,
                    worker: worker,
                    db: db,
                    conn: await db.connect()
                };
                window.duckdbLoaded = true;
            } else {
                console.log("✅ Using existing DuckDB instance for FlatGeobuf");
            }
            
            // Trigger processing
            window.dispatchEvent(new CustomEvent('duckdb-fgb-loaded'));
        `;
        
        // Listen for successful load
        const loadHandler = function() {
            const buffer = window.__pendingFgbBufferDuckDB;
            const options = window.__pendingFgbOptDuckDB;
            
            // Clean up
            delete window.__pendingFgbBufferDuckDB;
            delete window.__pendingFgbOptDuckDB;
            window.removeEventListener('duckdb-fgb-loaded', loadHandler);
            document.body.removeChild(script);
            
            // Process the data
            __this.__processFgbWithDuckDB(buffer, options);
        };
        
        window.addEventListener('duckdb-fgb-loaded', loadHandler);
        
        // Handle errors
        script.onerror = function(error) {
            _LOG("❌ Failed to load DuckDB for FlatGeobuf");
            window.removeEventListener('duckdb-fgb-loaded', loadHandler);
            
            if (typeof opt !== "undefined" && opt.error) {
                opt.error("Failed to load DuckDB library from CDN");
            } else {
                _alert("Failed to load DuckDB library from CDN");
            }
        };
        
        document.body.appendChild(script);
    };

    /**
     * __processFgbWithDuckDB
     * Processes FlatGeobuf data using DuckDB WASM spatial extension
     * @param fgbBuffer ArrayBuffer containing FlatGeobuf data
     * @param opt options object
     *            opt.bbox - optional bounding box filter [minX, minY, maxX, maxY]
     *                       Uses ST_Intersects with ST_MakeEnvelope for efficient spatial filtering
     */
    Data.Feed.prototype.__processFgbWithDuckDB = function (fgbBuffer, opt) {
        const __this = this;
        
        _LOG("Processing FlatGeobuf with DuckDB spatial extension...");
        Data.log("Reading FlatGeobuf with DuckDB spatial extension...");
        
        // Create a temporary file name
        const tempFileName = 'temp_' + Date.now() + '.fgb';
        
        // Register the file with DuckDB
        const db = window.duckdb.db;
        const conn = window.duckdb.conn;
        
        // Register the ArrayBuffer as a file in DuckDB's virtual filesystem
        db.registerFileBuffer(tempFileName, new Uint8Array(fgbBuffer))
            .then(function() {
                _LOG("FlatGeobuf file registered with DuckDB: " + tempFileName);
                
                // Install and load spatial extension
                return conn.query("INSTALL spatial; LOAD spatial;");
            })
            .then(function() {
                _LOG("DuckDB spatial extension loaded");
                Data.log("🔧 Spatial extension loaded");
                
                // Step 1: Detect geometry columns
                const schemaQuery = `SELECT column_name FROM (DESCRIBE SELECT * FROM st_read('${tempFileName}')) WHERE column_type LIKE '%GEOMETRY%' OR column_type LIKE '%WKB%'`;
                return conn.query(schemaQuery);
            })
            .then(function(schemaResult) {
                const geometryColumns = [];
                for (let i = 0; i < schemaResult.numRows; i++) {
                    geometryColumns.push(schemaResult.get(i).column_name);
                }
                
                _LOG("Detected geometry columns: " + geometryColumns.join(', '));
                
                // Step 2: Build query with ST_AsGeoJSON for geometry columns
                let selectClause = '*';
                let whereClause = '';
                
                if (geometryColumns.length > 0) {
                    const geoJsonSelects = geometryColumns.map(col => 
                        `ST_AsGeoJSON(${col}) AS ${col}`
                    ).join(', ');
                    
                    selectClause = `${geoJsonSelects}, * EXCLUDE (${geometryColumns.join(', ')})`;
                    
                    // Add spatial filter if bbox is provided
                    if (opt && opt.bbox && geometryColumns.length > 0) {
                        const [minX, minY, maxX, maxY] = opt.bbox;
                        const geomCol = geometryColumns[0]; // Use first geometry column
                        whereClause = ` WHERE ST_Intersects(${geomCol}, ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}))`;
                        _LOG("Applying spatial filter in DuckDB - bbox: [" + opt.bbox.join(", ") + "]");
                        Data.log("🔍 Applying spatial filter in DuckDB: [" + opt.bbox.join(", ") + "]");
                    }
                }
                
                const dataQuery = `SELECT ${selectClause} FROM st_read('${tempFileName}')${whereClause}`;
                _LOG("Executing query: " + dataQuery);
                
                return conn.query(dataQuery);
            })
            .then(function(result) {
                _LOG("DuckDB query successful, rows: " + result.numRows);
                Data.log(`✅ Loaded ${result.numRows} features from FlatGeobuf`);
                
                // Convert to our table format using the same processing as parquet
                const rows = result.toArray().map(row => Object.fromEntries(row));
                const columns = result.schema.fields.map(field => field.name);
                
                _LOG("Converting DuckDB result to table format...");
                
                // Detect column types from schema
                const columnTypes = __this.__detectColumnTypes(result.schema);
                
                // Use the standard processing pipeline
                __this.__processStreamingDataset(rows, columns, columnTypes, tempFileName, opt);
            })
            .catch(function(error) {
                console.error("❌ Error processing FlatGeobuf with DuckDB:", error);
                _LOG("Error processing FlatGeobuf with DuckDB: " + error);
                
                if (typeof opt !== "undefined" && opt.error) {
                    opt.error("Error processing FlatGeobuf with DuckDB: " + error.message);
                } else {
                    _alert("Error processing FlatGeobuf with DuckDB: " + error.message);
                }
            });
    };

    /**
     * __processFlatGeobufWithLib
     * Processes FlatGeobuf binary data into GeoJSON using the loaded library
     * @param fgbBuffer ArrayBuffer containing FlatGeobuf data
     * @param opt options object
     *            opt.bbox - optional bounding box filter [minX, minY, maxX, maxY] or [west, south, east, north]
     *                       Uses FlatGeobuf's built-in R-tree spatial index for efficient filtering
     */
    Data.Feed.prototype.__processFlatGeobufWithLib = function (fgbBuffer, opt) {
        const __this = this;
        
        try {
            _LOG("Converting FlatGeobuf to GeoJSON...");
            Data.log("🔄 Converting FlatGeobuf to GeoJSON...");
            
            // Create a ReadableStream from the ArrayBuffer for the FlatGeobuf library
            const uint8Array = new Uint8Array(fgbBuffer);
            
            // Find the deserialize function - it can be in various places depending on CDN/loading method
            let deserialize = null;
            
            // Log what we have for debugging
            console.log("FlatGeobuf library structure:", Object.keys(window.flatgeobuf || {}));
            
            // Try multiple possible locations
            if (window.flatgeobuf) {
                deserialize = window.flatgeobuf.deserialize ||
                              window.flatgeobuf.default?.deserialize ||
                              window.flatgeobuf.geojson?.deserialize ||
                              (window.flatgeobuf.default?.geojson?.deserialize);
            }
            
            if (!deserialize) {
                _LOG("Available properties: " + Object.keys(window.flatgeobuf || {}).join(", "));
                console.error("FlatGeobuf library structure:", window.flatgeobuf);
                throw new Error("FlatGeobuf deserialize function not found. Available: " + Object.keys(window.flatgeobuf || {}).join(", "));
            }
            
            _LOG("Found deserialize function, processing FlatGeobuf data...");
            
            // Check for spatial filter (bounding box)
            // bbox format: [minX, minY, maxX, maxY] or [west, south, east, north]
            let bbox = null;
            if (opt && opt.bbox) {
                bbox = opt.bbox;
                _LOG("Applying spatial filter - bbox: [" + bbox.join(", ") + "]");
                Data.log("🔍 Applying spatial filter: [" + bbox.join(", ") + "]");
            }
            
            // Create a proper ReadableStream from the ArrayBuffer
            // FlatGeobuf library expects a ReadableStream, not an async generator
            const stream = new ReadableStream({
                start(controller) {
                    // Enqueue the entire buffer
                    controller.enqueue(uint8Array);
                    controller.close();
                }
            });
            
            // Deserialize and collect features
            // The deserialize function returns an async iterator directly, not a Promise
            (async () => {
                try {
                    const features = [];
                    
                    _LOG("Starting FlatGeobuf deserialization from ReadableStream...");
                    
                    // Iterate over features asynchronously
                    // Pass bbox to deserialize for spatial filtering
                    // Note: When using a stream from ArrayBuffer, the bbox filter is applied
                    // during deserialization (reads R-tree from buffer), but the full file was already downloaded
                    let featureIterator;
                    if (bbox) {
                        // Convert bbox array to rect object format that FlatGeobuf expects
                        const rect = {
                            minX: bbox[0],
                            minY: bbox[1],
                            maxX: bbox[2],
                            maxY: bbox[3]
                        };
                        _LOG("Applying bbox filter to stream: " + JSON.stringify(rect));
                        featureIterator = deserialize(stream, rect);
                    } else {
                        featureIterator = deserialize(stream);
                    }
                    
                    for await (const feature of featureIterator) {
                        features.push(feature);
                    }
                    
                    _LOG("Converted " + features.length + " features from FlatGeobuf");
                    Data.log("✅ Converted " + features.length + " features from FlatGeobuf");
                    
                    // Create GeoJSON FeatureCollection
                    const geojson = {
                        type: "FeatureCollection",
                        features: features
                    };
                    
                    // Process as GeoJSON
                    __this.__processGeoJsonData(geojson, opt);
                    
                } catch (error) {
                    console.error("❌ Error deserializing FlatGeobuf:", error);
                    _LOG("Error in FlatGeobuf deserialization: " + error);
                    
                    // Check if it's a JSON parsing error (incompatible data types)
                    if (error.message && error.message.includes('JSON')) {
                        console.warn("⚠️ FlatGeobuf library can't parse this file's data format");
                        Data.log("🔄 Switching to DuckDB WASM for better FlatGeobuf compatibility...");
                        _LOG("FlatGeobuf library failed with data parsing issue, using DuckDB fallback");
                        
                        // Use DuckDB WASM which has excellent FlatGeobuf support via spatial extension
                        __this.__processFlatGeobufWithDuckDB(fgbBuffer, opt);
                    } else {
                        // Other error - report to user
                        if (typeof opt !== "undefined" && opt.error) {
                            opt.error("Error processing FlatGeobuf: " + error.message);
                        } else {
                            _alert("Error processing FlatGeobuf: " + error.message);
                        }
                    }
                }
            })();
                
        } catch (error) {
            _LOG("Error in FlatGeobuf processing: " + error);
            console.error("❌ FlatGeobuf processing error:", error);
            
            if (typeof opt !== "undefined" && opt.error) {
                opt.error("Error processing FlatGeobuf: " + error.message);
            } else {
                _alert("Error processing FlatGeobuf: " + error.message);
            }
        }
    };


    // ---------------------------------
    // G E O B U F 
    // ---------------------------------
    /**
     * __doGeobufImport
     * reads Geobuf (.pbf) files from URL
     * loads binary data and processes it into GeoJSON
     * @param szUrl Geobuf file url
     * @param opt options object
     * @type void
     */
    Data.Feed.prototype.__doGeobufImport = function (szUrl, opt) {
        
        _LOG("__doGeobufImport: " + szUrl);
        const __this = this;
        
        Data.log("Loading Geobuf file from: " + szUrl);
        
        // Try using Fetch API first (modern, supports streaming)
        fetch(szUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                _LOG("Fetch successful, reading Geobuf data...");
                return response.arrayBuffer();
            })
            .then(arrayBuffer => {
                _LOG("Geobuf data loaded: " + arrayBuffer.byteLength + " bytes");
                
                // Verify this looks like a Geobuf file (Protocol Buffer format)
                const uint8Array = new Uint8Array(arrayBuffer);
                if (uint8Array.length >= 4) {
                    // Geobuf files are Protocol Buffers, check for valid PBF structure
                    _LOG("Geobuf file size: " + uint8Array.length + " bytes");
                }
                
                __this.__processGeobufData(arrayBuffer, opt);
            })
            .catch(error => {
                _LOG("Fetch failed: " + error.message);
                
                // Fallback to XMLHttpRequest if Fetch fails
                _LOG("Falling back to XMLHttpRequest...");
                __this.__loadGeobufWithXHR(szUrl, opt);
            });
    };
    /**
     * __loadGeobufWithXHR
     * fallback method using XMLHttpRequest if Fetch fails
     * @param szUrl Geobuf file url
     * @param opt options object
     * @type void
     */
    Data.Feed.prototype.__loadGeobufWithXHR = function (szUrl, opt) {
        const __this = this;
        
        _LOG("Loading Geobuf with XMLHttpRequest...");
        
        const xhr = new XMLHttpRequest();
        xhr.open('GET', szUrl, true);
        xhr.responseType = 'arraybuffer';
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                const arrayBuffer = xhr.response;
                _LOG("XHR successful: " + arrayBuffer.byteLength + " bytes");
                __this.__processGeobufData(arrayBuffer, opt);
            } else {
                _LOG("XHR failed with status: " + xhr.status + " " + xhr.statusText);
                if (typeof opt !== "undefined" && opt.error) {
                    opt.error("XHR failed: " + xhr.status + " " + xhr.statusText);
                } else {
                    _alert("XHR failed: " + xhr.status + " " + xhr.statusText);
                }
            }
        };
        
        xhr.onerror = function() {
            _LOG("XHR network error");
            if (typeof opt !== "undefined" && opt.error) {
                opt.error("XHR network error");
            } else {
                _alert("XHR network error");
            }
        };
        
        xhr.send();
    };

    /**
     * __processGeobufData
     * Entry point for processing Geobuf files using geobuf library
     * @param {ArrayBuffer} pbfBuffer ArrayBuffer containing Geobuf data
     * @param {Object} opt options object
     * @type void
     */
    Data.Feed.prototype.__processGeobufData = function (pbfBuffer, opt) {
        const __this = this;
        
        _LOG("Processing Geobuf data, buffer size: " + pbfBuffer.byteLength + " bytes");
        Data.log("📦 Starting Geobuf processing...");
        
        // Check if Geobuf library is already loaded
        if (window.geobuf && window.Pbf) {
            console.log("📦 Using existing Geobuf library");
            __this.__processGeobufWithLib(pbfBuffer, opt);
        } else {
            console.log("📦 Loading Geobuf library from CDN...");
            __this.__loadGeobufLibAndProcess(pbfBuffer, opt);
        }
    };
    /**
     * __loadGeobufLibAndProcess
     * Loads Geobuf library from CDN and processes the data
     * @param pbfBuffer ArrayBuffer containing Geobuf data
     * @param opt options object
     */
    Data.Feed.prototype.__loadGeobufLibAndProcess = function (pbfBuffer, opt) {
        const __this = this;
        
        _LOG("Loading Geobuf library from CDN...");
        
        // Store the buffer temporarily
        window.__pendingPbfBuffer = pbfBuffer;
        window.__pendingPbfOpt = opt;
        
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
            // Try to load Geobuf and Pbf from CDN
            let geobuf, Pbf;
            try {
                // Try jsDelivr first
                geobuf = await import("https://cdn.jsdelivr.net/npm/geobuf@3.0.2/+esm");
                Pbf = await import("https://cdn.jsdelivr.net/npm/pbf@3.2.1/+esm");
                console.log("✅ Geobuf and Pbf loaded from jsDelivr");
            } catch (e1) {
                console.warn("jsDelivr failed:", e1);
                try {
                    // Fallback to unpkg
                    geobuf = await import("https://unpkg.com/geobuf@3.0.2/dist/geobuf.js");
                    Pbf = await import("https://unpkg.com/pbf@3.2.1/dist/pbf.js");
                    console.log("✅ Geobuf and Pbf loaded from unpkg");
                } catch (e2) {
                    console.warn("unpkg failed:", e2);
                    try {
                        // Fallback to ESM.sh
                        geobuf = await import("https://esm.sh/geobuf@3.0.2");
                        Pbf = await import("https://esm.sh/pbf@3.2.1");
                        console.log("✅ Geobuf and Pbf loaded from esm.sh");
                    } catch (e3) {
                        console.error("❌ Failed to load Geobuf from any CDN:", e3);
                        throw new Error("Failed to load Geobuf library from CDN: " + e3.message);
                    }
                }
            }
            
            // Store globally for reuse
            console.log("Geobuf module loaded, available exports:", Object.keys(geobuf));
            console.log("Pbf module loaded, available exports:", Object.keys(Pbf));
            window.geobuf = geobuf;
            window.Pbf = Pbf;
            
            // Trigger processing
            window.dispatchEvent(new CustomEvent('geobuf-loaded'));
        `;
        
        // Listen for successful load
        const loadHandler = function() {
            const buffer = window.__pendingPbfBuffer;
            const options = window.__pendingPbfOpt;
            
            // Clean up
            delete window.__pendingPbfBuffer;
            delete window.__pendingPbfOpt;
            window.removeEventListener('geobuf-loaded', loadHandler);
            document.body.removeChild(script);
            
            // Process the data
            __this.__processGeobufWithLib(buffer, options);
        };
        
        window.addEventListener('geobuf-loaded', loadHandler);
        
        // Handle errors
        script.onerror = function(error) {
            _LOG("❌ Failed to load Geobuf library");
            window.removeEventListener('geobuf-loaded', loadHandler);
            
            if (typeof opt !== "undefined" && opt.error) {
                opt.error("Failed to load Geobuf library from CDN");
            } else {
                _alert("Failed to load Geobuf library from CDN");
            }
        };
        
        document.body.appendChild(script);
    };

    /**
     * __processGeobufWithLib
     * Processes Geobuf binary data into GeoJSON using the loaded library
     * @param pbfBuffer ArrayBuffer containing Geobuf data
     * @param opt options object
     */
    Data.Feed.prototype.__processGeobufWithLib = function (pbfBuffer, opt) {
        const __this = this;
        
        try {
            _LOG("Converting Geobuf to GeoJSON...");
            Data.log("🔄 Converting Geobuf to GeoJSON...");
            
            // Create a Pbf instance from the ArrayBuffer
            const uint8Array = new Uint8Array(pbfBuffer);
            
            // Find the decode function - it can be in various places depending on CDN/loading method
            let decode = null;
            
            // Log what we have for debugging
            console.log("Geobuf library structure:", Object.keys(window.geobuf || {}));
            console.log("Pbf library structure:", Object.keys(window.Pbf || {}));
            
            // Try multiple possible locations for decode function
            if (window.geobuf) {
                decode = window.geobuf.decode ||
                         window.geobuf.default?.decode ||
                         (window.geobuf.default?.geobuf?.decode);
            }
            
            // Try multiple possible locations for Pbf constructor
            let PbfConstructor = null;
            if (window.Pbf) {
                PbfConstructor = window.Pbf.default ||
                                 window.Pbf.Pbf ||
                                 window.Pbf;
            }
            
            if (!decode) {
                _LOG("Available geobuf properties: " + Object.keys(window.geobuf || {}).join(", "));
                console.error("Geobuf library structure:", window.geobuf);
                throw new Error("Geobuf decode function not found. Available: " + Object.keys(window.geobuf || {}).join(", "));
            }
            
            if (!PbfConstructor) {
                _LOG("Available Pbf properties: " + Object.keys(window.Pbf || {}).join(", "));
                console.error("Pbf library structure:", window.Pbf);
                throw new Error("Pbf constructor not found. Available: " + Object.keys(window.Pbf || {}).join(", "));
            }
            
            _LOG("Found decode function and Pbf constructor, processing Geobuf data...");
            
            // Create Pbf instance and decode
            const pbf = new PbfConstructor(uint8Array);
            const geojson = decode(pbf);
            
            _LOG("Converted Geobuf to GeoJSON successfully");
            Data.log("✅ Converted Geobuf to GeoJSON successfully");
            
            // Process as GeoJSON
            __this.__processGeoJsonData(geojson, opt);
                
        } catch (error) {
            _LOG("Error in Geobuf processing: " + error);
            console.error("❌ Geobuf processing error:", error);
            
            if (typeof opt !== "undefined" && opt.error) {
                opt.error("Error processing Geobuf: " + error.message);
            } else {
                _alert("Error processing Geobuf: " + error.message);
            }
        }
    };


    // ---------------------------------
    // C R E A T E   D A T A   T A B L E 
    // ---------------------------------

    /**
     * __createTableDataObject 
     * finally make the data object with the iXmaps data structure
     * @type void
     */
    Data.Feed.prototype.__createDataTableObject = function (dataA, szType, opt) {

        if (dataA) {
            
            this.dbtable = new Data.Table().setArray(dataA);
            dataA = null;

            if ((typeof (opt) != "undefined") && opt.success) {
                opt.success(this.dbtable);
            } else {
                _LOG("callback to call on succes is 'undefined'!");
            }

            return;
        }
    };

    /**
     * Create a new Data.Table instance.  
     * <p>All data loaded by the methods <b>.feed()</b>, <b>.object()</b> and <b>.broker()</b> is stored in a Table instance.</p>
     * <p>The Table class provides the methods to read and process the data.</p>
     * @class It realizes an object to store <b>data</b> in <b>Data.Table </b>format and<br> provides the <b>methods</b> to load, read and process it
     * @example
     * // the data of the Table object ist stored like this example:
     * {
     *     table : {    
     *               fields:3,
     *              records:2
     *             },
     *    fields : [
     *              {id:"column 1"},
     *              {id:"column 2"},
     *              {id:"column 3"}
     *             ],
     *   records : [
     *              ["value11","value12","value13"],
     *              ["value21","value22","value23"]
     *             ]
     * }
     * @constructor
     * @type {Data.Table}
     * @returns A new Data.Table object<br><br>in the following the methods of the Data.Table to read and process the data
     */

    Data.Table = function (table) {
        if (table) {
            this.table = table.table;
            this.fields = table.fields;
            this.records = table.records;
        } else {
            this.table = {
                records: 0,
                fields: 0
            };
            this.fields = [];
            this.records = [];
        }
    };
    Data.Table.prototype = {

        /**
         * get the data of a Data.Table as 2d array
         * first row are the column names
         * @type {Array}
         * @returns table as array of arrays
         */
        getArray: function () {
            let dataA = [[]];
            for (let i = 0, len = this.fields.length; i < len; i++) {
                dataA[0].push(this.fields[i].id);
            }
            for (let i = 0, len = this.records.length; i < len; i++) {
                dataA.push(this.records[i]);
            }
            return dataA;
        },

        /**
         * set the data of a Data.Table by a given 2d array
         * first row must be the column names
         * @param {Array} dataA a 2 dimensionale array with the table data<br>first row must contain the column names
         * @type {Data.Table}
         * @return itself
         */
        setArray: function (dataA) {
            if (dataA.length < 2) {
                return this;
            }
            // first row of data => object.fields
            // ------------
            this.fields = [];
            for (let a = 0, len = dataA[0].length; a < len; a++) {
                this.fields.push({
                    id: (dataA[0][a] || " ").trim(),
                    typ: 0,
                    width: 60,
                    decimals: 0
                });
            }
            // following rows => object.records
            // --------------
            dataA.shift();

            // set records checking length
            this.records = [];
            for (let r = 0, len = dataA.length; r < len; r++) {
                if (dataA[r].length == this.fields.length) {
                    this.records.push(dataA[r]);
                }
            }
            this.table = {
                records: this.records.length,
                fields: this.fields.length
            };
            return this;
        },

        /**
         * revert the rows of a data table
         * @type {Data.Table}
         * @returns the reverted table
         */
        revert: function () {
            let records = [];
            for (let i = this.records.length - 1; i >= 0; i--) {
                records.push(this.records[i]);
            }
            this.records = records;
            return this;
        },

        /**
         * reverse the rows of a data table
         * @type {Data.Table}
         * @return the reversed table
         */
        reverse: function () {
            let records = [];
            for (let i = this.records.length - 1; i >= 0; i--) {
                records.push(this.records[i]);
            }
            this.records = records;
            return this;
        },

        /**
         * get an array of the column names
         * @type {Array}
         * @returns an array with the column names
         */
        columnNames: function () {
            const fieldsA = [];
            for (let i = 0, len = this.fields.length; i < len; i++) {
                fieldsA.push(this.fields[i].id);
            }
            return fieldsA;
        },

        /**
         * get the index of a column by its name<br>
         * useful if you have the values of one data row as array and want to access a column value
         * @param {string} columnName the name of the column
         * @type {number}
         * @return {number} the index of the column or null
         */
        columnIndex: function (szColumn) {
            for (var i in this.fields) {
                if (this.fields[i].id == szColumn) {
                    return i;
                }
            }
            return null;
        },

        /**
         * get a column object for one column from the Data.Table<br>
         * the column object provides methods to read or map the column values
         * @param {string} columnName the name of the column to get a handle to
         * @type {Data.Column}
         * @returns {Data.Column} Data.Column object
         * @example
         * var myfeed = new Data.Feed("Segnalazioni",{"source":szUrl,"type":"csv"}).load(function(mydata){
         *    var dateArray = mydata.column('created_at').values();
         *    ...
         * });
         */
        column: function (szColumn) {
            for (let i in this.fields) {
                if (this.fields[i].id == szColumn) {
                    const column = new Data.Column();
                    column.index = i;
                    column.table = this;
                    return column;
                }
            }
            return null;
        },

        /**
         * get an associative array of the values of two columns like array[String(lookup column value)] = value
         * @param {string} szValue the name of the value column
         * @param {string} szLookup the name of the lookup value column
         * @type {Array}
         * @return {Array} associative array for lookup
         * @example
         * id           nome
         * -------------------------------------------
         * 00000000000  ITALIA
         * 01000000000  PIEMONTE 1
         * 01100000000  PIEMONTE 1 - 01
         * 01110000000  01 TORINO - ZONA STATISTICA 16
         * 01110812620  TORINO - PIEMONTE 1 - 01 - 01
         * 01120000000  02 TORINO - ZONA STATISTICA 38
         * ...
         *
         * // create assoc.array with id ==> nome from camera_geopolitico_italia.csv (id == ELIGENDO_C_UID_CI)
         * var nomeA = camera_geopolitico_italia.lookupArray("nome","id");
         *
         * ['00000000000']="ITALIA";
         * ['01000000000']="PIEMONTE 1";
         * ['01100000000']="PIEMONTE 1 - 01";
         * ['01110000000']="01 TORINO - ZONA STATISTICA 16";
         * ['01110812620']="TORINO - PIEMONTE 1 - 01 - 01";
         * ['01120000000']="02 TORINO - ZONA STATISTICA 38";
         * ...
         *
         */
        lookupArray: function (szValue, szLookup) {

            let calc = "overwrite";

            // GR 06.09.2021 new argument object {}
            if (szValue && szValue.key) {
                calc = szValue.calc || calc;
                szLookup = szValue.key;
                szValue = szValue.value;
            }

            let lookupA = [];
            if (!this.column(szLookup)) {
                alert("'" + szLookup + "' column not found!");
            }
            if (!this.column(szValue)) {
                alert("'" + szValue + "' column not found!");
            }

            const idA = this.column(szLookup).values();
            const valueA = this.column(szValue).values();
            if (calc == "sum") {
                for (let i = 0, len = idA.length; i < len; i++) {
                    lookupA[String(idA[i])] = (lookupA[String(idA[i])] || 0) + valueA[i];
                }
            } else
            if (calc == "max") {
                for (let i = 0, len = idA.length; i < len; i++) {
                    lookupA[String(idA[i])] = Math.max(lookupA[String(idA[i])] || 0, valueA[i]);
                }
            } else {
                for (let i = 0, len = idA.length; i < len; i++) {
                    lookupA[String(idA[i])] = valueA[i];
                }
            }
            return lookupA;
        },

        /**
         * get an associative array of the values of two columns like array[String(lookup column value)] = value
         * in difference to lookupArray, this method creates a concatenated string in case of multiple values
         * only for string values, creates a comma separated risultive string 
         * @param {string} szValue the name of the value column
         * @param {string} szLookup the name of the lookup value column
         * @type {Array}
         * @returns {Array} associative array for lookup
         * @example
         * id           nome
         * -------------------------------------------
         * 00000000000  ITALIA
         * 00000000000  PIEMONTE 1
         * 01100000000  PIEMONTE 1 - 01
         * 01100000000  01 TORINO - ZONA STATISTICA 16
         * 01110812620  TORINO - PIEMONTE 1 - 01 - 01
         * 01120000000  02 TORINO - ZONA STATISTICA 38
         * ...
         *
         * // create assoc.array with id ==> nome from camera_geopolitico_italia.csv (id == ELIGENDO_C_UID_CI)
         * var nomeA = camera_geopolitico_italia.lookupArray("nome","id");
         *
         * ['00000000000']="ITALIA, PIEMONTE 1";
         * ['01100000000']="PIEMONTE 1 - 01, 01 TORINO - ZONA STATISTICA 16";
         * ['01110812620']="TORINO - PIEMONTE 1 - 01 - 01";
         * ['01120000000']="02 TORINO - ZONA STATISTICA 38";
         * ...
         *
         */
        lookupStringArray: function (szValue, szLookup) {

            // GR 06.09.2021 new argument object {}
            if (szValue && szValue.key) {
                szLookup = szValue.key;
                szValue = szValue.value;
            }

            let lookupA = [];
            if (!this.column(szLookup)) {
                alert("'" + szLookup + "' column not found!");
            }
            if (!this.column(szValue)) {
                alert("'" + szValue + "' column not found!");
            }

            const idA = this.column(szLookup).values();
            const valueA = this.column(szValue).values();
            for (let i = 0, len = idA.length; i < len; i++) {
                lookupA[String(idA[i])] = (lookupA[String(idA[i])] ? (lookupA[String(idA[i])] + ", " + valueA[i]) : valueA[i]);
            }
            return lookupA;
        },

        /**
         * get the value of a column cell by the known value of a lookup column
         * @param value the value we know 
         * @param {Object} option a json structure with {value:value column name, lookup:lookup column name} 
         * @type {string}
         * @return the found value 
         */
        lookup: function (value, option) {
            const colValue = option.value;
            const colLookup = option.lookup;
            const sCacheId = colValue + "_" + colLookup;
            if (!(this.lookupsA && this.lookupsA[sCacheId])) {
                this.lookupsA = this.lookupsA || [];
                this.lookupsA[sCacheId] = this.lookupArray(colValue, colLookup);
            }
            return (this.lookupsA[sCacheId][value] || "-");
        },

        /**
         * get a key value array (associative array) with the values of two columns
         * @param {Object} option a json structure with {key:key column name, value:value column name} 
         * @type {Array}
         * @return {Array} associative array with key/value pairs
         * @example
         * id           nome
         * -------------------------------------------
         * 00000000000  ITALIA
         * 01000000000  PIEMONTE 1
         * 01100000000  PIEMONTE 1 - 01
         * 01110000000  01 TORINO - ZONA STATISTICA 16
         * 01110812620  TORINO - PIEMONTE 1 - 01 - 01
         * 01120000000  02 TORINO - ZONA STATISTICA 38
         * ...
         *
         * // create assoc.array with id ==> nome from camera_geopolitico_italia.csv (id == ELIGENDO_C_UID_CI)
         * var nomeA = camera_geopolitico_italia.toKeyValue({key:"id", value:"nome"});
         *
         * ['00000000000']="ITALIA";
         * ['01000000000']="PIEMONTE 1";
         * ['01100000000']="PIEMONTE 1 - 01";
         * ['01110000000']="01 TORINO - ZONA STATISTICA 16";
         * ['01110812620']="TORINO - PIEMONTE 1 - 01 - 01";
         * ['01120000000']="02 TORINO - ZONA STATISTICA 38";
         * ...
         *
         */
        toKeyValue: function (option) {
            return this.lookupArray(option.value, option.key);
        },

        /**
         * creates a new column based on existing ones<br>
         * the values of the new column are defined by a user function, which receives data from the actual row and must returns the new value
         * @param {Object} options the creation parameter
         *								   <table border='0' style='border-left: 1px solid #ddd;'>	
         *								   <tr><th>property</th><th>description</th></tr>
         *								   <tr><td><b>"source"</b></td><td>[optional] the name of the source column (string) or array of source column names (string[])</td></tr>
         *								   <tr><td><b>"destination"</b></td><td>the name of the new colmn to create</td></tr>
         *								   </table> 
         * @param {function(...values, row)} function(...values, row) Required: A function to be run for each element in the array
         *								   <br>Function arguments:<br>
         *								   <table border='0' style='border: 1px solid #ddd;margin:0.5em 0em'>	
         *								   <tr><th>argument</th><th>description</th></tr>
         *								   <tr><td>value (or value1, value2, ...)</td><td>If source is a string: the value of the source column cell.<br>If source is an array: individual values from each source column (as separate arguments).<br>If no source column defined: an array of all values of the current row.</td></tr>
         *								   <tr><td>row</td><td>[optional] the entire row array (always passed as last argument when source is defined)</td></tr>
         *								   </table> 
         *  Must return the values for the new column.<br>
         *  It is called for every row of the table and receives as parameters:
         *  <ul>
         *    <li>Single source: <code>function(value, row)</code></li>
         *    <li>Multiple sources: <code>function(value1, value2, ..., row)</code></li>
         *    <li>No source: <code>function(row)</code></li>
         *  </ul>
         * @type {Data.Table}
         * @returns {Data.Table} the enhanced table
         * @example
         *    // Single source column
         *    mydata = mydata.addColumn({'source':'created_at','destination':'date'},
         *        function(value, row){
         *            var d = new Date(__normalizeTime(value));
         *            return( String(d.getDate()) + "." + String(d.getMonth()+1) + "." + String(d.getFullYear()) );
         *     });
         *    // Multiple source columns
         *    mydata = mydata.addColumn({'source':['first_name','last_name'],'destination':'full_name'},
         *        function(firstName, lastName, row){
         *            return firstName + ' ' + lastName;
         *     });
         *
         */
        addColumn: function (options, callback) {

            if (!options.destination) {
                alert("'data.addColumn' no destination defined!");
                return null;
            }
            var column = null;        // For single source (backward compatibility)
            var columns = null;        // For multiple sources (new)
            
            if (options.source) {
                // Check if source is an array
                if (Array.isArray(options.source)) {
                    // Multiple source columns
                    columns = [];
                    const missingColumns = [];
                    
                    for (let srcIdx = 0; srcIdx < options.source.length; srcIdx++) {
                        const sourceName = options.source[srcIdx];
                        let found = false;
                        
                        for (let i = 0, len = this.fields.length; i < len; i++) {
                            if (this.fields[i].id == sourceName) {
                                columns.push(i);
                                found = true;
                                break;
                            }
                        }
                        
                        if (!found) {
                            missingColumns.push(sourceName);
                        }
                    }
                    
                    if (missingColumns.length > 0) {
                        alert("'data.addColumn' source columns not found: " + missingColumns.join(', '));
                        return null;
                    }
                    
                    if (columns.length === 0) {
                        alert("'data.addColumn' no valid source columns provided!");
                        return null;
                    }
                    
                } else {
                    // Single source column (existing behavior)
                    for (let i = 0, len = this.fields.length; i < len; i++) {
                        if (this.fields[i].id == options.source) {
                            column = i;
                            break;
                        }
                    }
                    if (column == null) {
                        alert("'data.addColumn' source column '" + options.source + "' not found!");
                        return null;
                    }
                }
            }

            // add new column name
            this.fields.push({
                id: String(options.destination),
                created: true
            });
            this.table.fields++;

            // add new column values
            // ---------------------
            if (callback && (typeof (callback) == "function")) {
                for (let j = 0, len = this.records.length; j < len; j++) {
                    let result;
                    
                    if (columns !== null) {
                        // Multiple source columns: extract values and pass as individual arguments
                        const sourceValues = columns.map(colIdx => this.records[j][colIdx]);
                        // Pass values as individual arguments: callback(value1, value2, ..., row)
                        result = callback.apply(null, sourceValues.concat([this.records[j]]));
                    } else if (column != null) {
                        // Single source column (existing behavior)
                        result = callback(this.records[j][column], this.records[j]);
                    } else {
                        // No source: pass entire row (existing behavior)
                        result = callback(this.records[j]);
                    }
                    
                    this.records[j].push(result);
                }
            } else
            if (callback && (typeof (callback) == "object")) {
                for (let j = 0, len = this.records.length; j < len; j++) {
                    this.records[j].push(callback[j] || 0);
                }
            } else
            if (options.values && (typeof (options.values) == "object")) {
                for (let j = 0, len = this.records.length; j < len; j++) {
                    this.records[j].push(options.values[j] || 0);
                }
            } else {
                for (let j = 0, len = this.records.length; j < len; j++) {
                    this.records[j].push(0);
                }
            }

            return this;
        },
        /**
         * adds a row to the data<br>
         * the values of columns are defined by a JSON Object, which defines values for selected columns; non defined columns are set to ' '
         * @param {Object} options the creation parameter
         *								   <table border='0' style='border-left: 1px solid #ddd;'>	
         *								   <tr><th>property</th><th>description</th></tr>
         *								   <tr><td><b>"column name"</b></td><td>value</td></tr>
         *								   <tr><td><b>"column name"</b></td><td>value</td></tr>
         *								   </table> 
         * @type {Data.Table}
         * @return {Data.Table} the enhanced table
         * @example
         *    mydata = mydata.addRow({'column 1':'Rossi','column 2':'Aldo'} );
         */
        addRow: function (options) {

            if (!options || (typeof options !== "object")) {
                alert("'data.addRow' no options defined!");
                return null;
            }
            // create new empty row
            var row = [];
            for (let i = 0, len = this.fields.length; i < len; i++) {
                row.push("");
            }
            // set user values
            for (var i in options) {
                if (this.column(i)) {
                    row[this.column(i).index] = options[i];
                } else {
                    alert("'data.addRow' column '" + i + "' not found!");
                }
            }
            // add the new row to the data table
            this.records.push(row);
            this.table.records++;

            return this;
        },

        /**
         * filter rows from a dbtable objects data by callback
         * @param {function} the user defined filter function, must return 0 or 1 
         * @type {Data.Table}
         * @returns {Data.Table}
         * @example
         *    mydata.filter(
         *        function(row){
         *            return( (row[0] == 'filtervalue') ? 1 : 0 );
         *     });
         */
        filter: function (callback) {

            this.selection = new Data.Table();

            for (const j in this.records) {
                if (callback && callback(this.records[j])) {
                    this.selection.records.push(this.records[j]);
                    this.selection.table.records++;
                }
            }
            this.selection.fields = this.fields.slice();
            this.selection.table.fields = this.table.fields;
            return this.selection;
        },
        /**
         * select rows from a dbtable objects data by SQL query
         * @param {string} szSelection the selection query string<br>WHERE "<em>column name</em>" [operator] "<em>selection value</em>" 
         *<table class="w3-table-all notranslate">
         * <tr>
         *    <th style="width:20%">Operator</th>
         *    <th>Description</th>
         *  </tr>
         *  <tr>
         *    <td>=</td>
         *    <td>Equal</td>
         *  </tr>
         *  <tr>
         *    <td>&lt;&gt;</td>
         *    <td>Not equal. <b>Note:</b> In some versions of SQL this operator may be written as !=</td>
         *  </tr>
         *  <tr>
         *    <td>&gt;</td>
         *    <td>Greater than</td>
         *  </tr>
         *  <tr>
         *    <td>&lt;</td>
         *    <td>Less than</td>
         *  </tr>
         *  <tr>
         *    <td>&gt;=</td>
         *    <td>Greater than or equal</td>
         *  </tr>
         *  <tr>
         *   <td>&lt;=</td>
         *   <td>Less than or equal</td>
         * </tr>
         * <tr>
         *   <td>BETWEEN</td>
         *   <td>Between an inclusive range;<br> example: WHERE "<em>column</em>" BETWEEN "<em>value1</em>" AND "<em>value2</em>"</td>
         * </tr>
         * <tr>
         *   <td>LIKE</td>
         *   <td>Search for a pattern</td>
         * </tr>
         * <tr>
         *   <td>NOT</td>
         *   <td>Must not contain pattern</td>
         * </tr>
         *  <tr>
         *    <td>IN</td>
         *   <td>To specify multiple possible values for a column;<br> example: WHERE "<em>column</em>" IN "<em>value1,value2,value3</em>"</td>
         *  </tr>
         *</table>
         * @type {Data.Table}
         * @returns {Data.Table} object with the selection result in dbTable format
         * @example
         * var mydata   =  mydata.select('WHERE description like "montana"');
         * var ageTotal = rawdata.select('WHERE "Age" = "Total" AND "SEX" = "MW" AND "Series" = "Labour force participation rate"');
         * var ageWork  = rawdata.select('WHERE "Age" BETWEEN "18" AND "65"');
         */
        select: function (szSelection) {

            if (szSelection.match(/WHERE/)) {

                // first time ?
                // get query parts

                if (1) {

                    // tokenize
                    // ---------
                    let szTokenA = szSelection.split('WHERE')[1].trim().split(' ');

                    // test for quotes and join the included text parts
                    for (let ii = 0; ii < szTokenA.length; ii++) {
                        if (szTokenA[ii].length) {
                            if ((szTokenA[ii][0] == '"') && (szTokenA[ii][szTokenA[ii].length - 1] != '"')) {
                                do {
                                    szTokenA[ii] = szTokenA[ii] + " " + szTokenA[ii + 1];
                                    szTokenA.splice(ii + 1, 1);
                                }
                                while (szTokenA[ii][szTokenA[ii].length - 1] != '"');
                            }
                            if ((szTokenA[ii][0] == '(') && (szTokenA[ii][szTokenA[ii].length - 1] != ')')) {
                                do {
                                    szTokenA[ii] = szTokenA[ii] + " " + szTokenA[ii + 1];
                                    szTokenA.splice(ii + 1, 1);
                                }
                                while (szTokenA[ii][szTokenA[ii].length - 1] != ')');
                            }
                        } else {
                            szTokenA.splice(ii, 1);
                            ii--;
                        }
                    }
                    this.filterQueryA = [];
                    let filterObj = {};

                    let szCombineOp = "";

                    // make the query object(s)
                    // ------------------------
                    do {
                        let nToken = 0;

                        if (szTokenA.length >= 3) {
                            filterObj = {};
                            filterObj.szSelectionField = szTokenA[0].replace(/("|)/g, "");
                            filterObj.szSelectionOp = szTokenA[1];
                            // For IN operator, preserve parentheses if present (standard SQL syntax)
                            // Otherwise remove quotes as before
                            if (szTokenA[1].toUpperCase() == "IN" && szTokenA[2].startsWith('(') && szTokenA[2].endsWith(')')) {
                                filterObj.szSelectionValue = szTokenA[2]; // Keep parentheses for IN
                            } else {
                                filterObj.szSelectionValue = szTokenA[2].replace(/("|)/g, "");
                            }
                            nToken = 3;
                        }
                        if (filterObj.szSelectionOp == "BETWEEN") {
                            if (szTokenA.length >= 5) {
                                if (szTokenA[3] == "AND") {
                                    filterObj.szSelectionValue2 = szTokenA[4];
                                    nToken = 5;
                                }
                            }
                        }

                        if (nToken) {

                            // get data table column index for query field
                            for (let ii = 0; ii < this.fields.length; ii++) {
                                if (this.fields[ii].id == filterObj.szSelectionField) {
                                    filterObj.nFilterFieldIndex = ii;
                                }
                                // GR 26.12.2019 filter value may be column name (defined by $column name$)
                                if (("$" + this.fields[ii].id + "$") == filterObj.szSelectionValue) {
                                    filterObj.nFilterValueIndex = ii;
                                }
                            }
                            // set query combine operator 
                            filterObj.szCombineOp = szCombineOp;

                            // add the query object
                            this.filterQueryA.push(filterObj);
                            szTokenA.splice(0, nToken);

                        } else {
                            _alert("data.js - selection error - incomplete query!\nquery: " + szSelection);
                            break;
                        }

                        // only 'AND' combination (OR tdb)
                        if (szTokenA.length && (szTokenA[0] == "AND")) {
                            szCombineOp = "AND";
                            szTokenA.splice(0, 1);
                        } else
                        if (szTokenA.length && (szTokenA[0] == "OR")) {
                            szCombineOp = "OR";
                            szTokenA.splice(0, 1);
                        } else {
                            break;
                        }
                    }
                    while (szTokenA.length);

                }

                this.selection = new Data.Table();

                for (let i = 0; i < this.filterQueryA.length; i++) {
                    if (typeof this.filterQueryA[i].nFilterFieldIndex === "undefined") {
                        this.selection.fields = this.fields.slice();
                        this.selection.table.fields = this.table.fields;
                        _LOG("Selection: invalid query: " + szSelection);
                        return this.selection;
                    }
                }

                for (let j = 0, len = this.records.length; j < len; j++) {

                    let allResult = null;

                    for (let i = 0, lenQA = this.filterQueryA.length; i < lenQA; i++) {

                        let result = true;
                        // get the value to test
                        this.__szValue = String(this.records[j][this.filterQueryA[i].nFilterFieldIndex]);
                        this.__szSelectionOp = this.filterQueryA[i].szSelectionOp.toUpperCase();
                        this.__szSelectionValue = this.filterQueryA[i].szSelectionValue;
                        this.__szSelectionValue2 = this.filterQueryA[i].szSelectionValue2;
                        this.__szCombineOp = this.filterQueryA[i].szCombineOp;

                        // GR 26.12.2019 filter value may be column name
                        if (this.filterQueryA[i].nFilterValueIndex != null) {
                            this.__szSelectionValue = String(this.records[j][this.filterQueryA[i].nFilterValueIndex]);
                        }

                        // do the query 
                        // ------------
                        let nValue = __scanValue(this.__szValue);
                        if (this.__szSelectionOp == "=") {
                            if (this.__szSelectionValue == '*') {
                                result = (this.__szValue.replace(/ /g, "") != "");
                            } else {
                                result = ((this.__szValue == this.__szSelectionValue) || (nValue == Number(this.__szSelectionValue)));
                            }
                        } else
                        if (this.__szSelectionOp == "<>") {
                            result = !((this.__szValue == this.__szSelectionValue) || (nValue == Number(this.__szSelectionValue)));
                        } else
                        if (this.__szSelectionOp == ">") {
                            result = (nValue > Number(this.__szSelectionValue));
                        } else
                        if (this.__szSelectionOp == "<") {
                            result = (nValue < Number(this.__szSelectionValue));
                        } else
                        if (this.__szSelectionOp == ">=") {
                            result = (nValue >= Number(this.__szSelectionValue));
                        } else
                        if (this.__szSelectionOp == "<=") {
                            result = (nValue <= Number(this.__szSelectionValue));
                        } else
                        if (this.__szSelectionOp == "LIKE") {
                            if (this.__szSelectionValue == "*") {
                                result = this.__szValue.length;
                            } else {
                                // Escape regex special characters in the value
                                const pattern = this.__szSelectionValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const regex = new RegExp(pattern, "i");
                                result = regex.test(this.__szValue);
                            }
                        } else
                        if (this.__szSelectionOp == "NOT") {
                            const pattern = this.__szSelectionValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const regex = new RegExp(pattern, "i");
                            result = !regex.test(this.__szValue);
                        } else
                        if (this.__szSelectionOp == "IN") {
                            // Support both syntaxes:
                            // 1. IN "value1,value2,value3" (old syntax)
                            // 2. IN (value1,value2,value3) (standard SQL syntax)
                            let valuesStr = this.__szSelectionValue;
                            
                            // Remove parentheses if present: (value1,value2) -> value1,value2
                            if (valuesStr.startsWith('(') && valuesStr.endsWith(')')) {
                                valuesStr = valuesStr.slice(1, -1);
                            }
                            
                            // Split by comma and trim each value, remove quotes if present
                            const values = valuesStr.split(",").map(v => v.trim().replace(/^["']|["']$/g, ''));
                            
                            // Check if value matches (support both string and numeric comparison)
                            const strMatch = values.includes(this.__szValue);
                            const numValue = __scanValue(this.__szValue);
                            const numMatch = !isNaN(numValue) && values.some(v => {
                                const numV = Number(v);
                                return !isNaN(numV) && numValue === numV;
                            });
                            
                            result = strMatch || numMatch;
                        } else
                        if ((this.__szSelectionOp == "BETWEEN")) {
                            result = ((nValue >= Number(this.__szSelectionValue)) &&
                                (nValue <= Number(this.__szSelectionValue2)));
                        } else {
                            // default operator
                            const pattern = this.__szSelectionValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const regex = new RegExp(pattern, "i");
                            result = regex.test(this.__szValue);
                        }
                        if (this.__szCombineOp == "AND") {
                            allResult = (allResult && result);
                        } else {
                            allResult = (allResult || result);
                        }
                    }
                    if (allResult) {
                        this.selection.records.push(this.records[j].slice());
                        this.selection.table.records++;
                    }
                }
            }
            this.selection.fields = this.fields.slice();
            this.selection.table.fields = this.table.fields;
            return this.selection;
        },
        /**
         * aggregate the values of one column for the unique values of one or more other columns<br>
         * usefull to transform journals with more than one qualifying column (time, product class, ...)<br>
         * into something like a pivot table 
         * @param {string} valueColumn the value source
         * @param {string} aggregateColumn the aggregation leads; more than one column can be defined with seperator '|'<br>example: "month|type"
         * @type {Data.Table}
         * @returns {Data.Table} object with the aggregation result in dbTable format
         * @example
         *  myData.aggregate("value","month|type");
         *	     
         *  // "value"     : the value source column is named "value"
         *  // "month|type": columns "month" and "type" will lead the aggregation
         * @example
         *  if the source table is like:
         *
         *  "data"     "month" "day" "hour" "operator" "type" "value"
         *  2015/07/15 "jul"   15    03     "everyone" "wood" 15  
         *  2015/07/15 "jul"   15    06     "clerk"    "iron" 25  
         *  2015/07/16 "jul"   16    11     "clerk"    "iron" 32  
         *  2015/07/22 "jul"   16    15     "carp"     "wood" 17  
         *  2015/08/02 "aug"   02    22     "carp"     "wood" 22  
         *  ...
         *
         *  the result will be:
         *
         *  "month" "type" "value"
         *  "jul"   "wood"  32
         *  "jul"   "iron"  57 
         *  "aug"   "wood"  22 
         */
        aggregate: function (szColumn, szAggregate) {

            let mean = false;

            // GR 06.09.2021 new argument object {}
            if (szColumn.lead) {
                mean = (szColumn.calc && (szColumn.calc == "mean"));
                szAggregate = szColumn.lead;
                szColumn = szColumn.column || szColumn.value;
            }

            const szAggregateA = szAggregate.split("|");
            const nAggregateIndexA = [];

            let nValueIndex = null;

            for (let i = 0; i < szAggregateA.length; i++) {
                for (let ii = 0; ii < this.fields.length; ii++) {
                    if (this.fields[ii].id == szAggregateA[i]) {
                        nAggregateIndexA[i] = ii;
                    }
                    if (this.fields[ii].id == szColumn) {
                        nValueIndex = ii;
                    }
                }
            }

            this.aggregation = new Data.Table();

            xRecords = [];
            xCount = [];
            for (let j = 0, len = this.records.length; j < len; j++) {
                const fieldParts = [];
                for (let i = 0, lenA = nAggregateIndexA.length; i < lenA; i++) {
                    fieldParts.push(this.records[j][nAggregateIndexA[i]]);
                }
                const xField = fieldParts.join("");
                if (xRecords[xField]) {
                    xRecords[xField][nAggregateIndexA.length] += __scanValue(this.records[j][nValueIndex]);
                    xCount[xField][nAggregateIndexA.length]++;
                } else {
                    xRecords[xField] = [];
                    xRecords[xField][nAggregateIndexA.length] = __scanValue(this.records[j][nValueIndex]);
                    for (let i = 0; i < nAggregateIndexA.length; i++) {
                        xRecords[xField][i] = this.records[j][nAggregateIndexA[i]];
                    }
                    xCount[xField] = [];
                    xCount[xField][nAggregateIndexA.length] = 1;
                }
            }

            for (let j = 0, len = xRecords.length; j < len; j++) {
                if (mean) {
                    xRecords[j][nAggregateIndexA.length] /= xCount[j][nAggregateIndexA.length];
                }
                this.aggregation.records.push(xRecords[j]);
                this.aggregation.table.records++;
            }

            const fields = [];
            for (let i = 0; i < szAggregateA.length; i++) {
                fields[i] = {
                    id: szAggregateA[i]
                };
            }
            fields[szAggregateA.length] = {
                id: szColumn
            };

            this.aggregation.fields = fields;
            this.aggregation.table.fields = fields;

            return this.aggregation;
        },

        /**
         * condense (aggregate) the rows of a table by the unique values of one column <br>
         * sums the numeric values of the rows with the same leed column value<br>
         * don't sum the values of columns defined as 'keep' in the 'option'
         * @param {string} leadColumn the column of the values to make unique
         * @param {Object} option parameter
         * @type {Data.Table}
         * @returns the condensed table
         * @example
         *  data.condense({lead:'name',keep:'codice'});
         *
         *  if the source table is like:
         *
         *  "name"     "codice" "hours"
         *  "everyone" "001"     15  
         *  "clerk"    "002"     25  
         *  "clerk"    "002"     32  
         *  "carp"     "005"     17  
         *  "carp"     "005"     22  
         *  ...
         *
         *  the result will be:
         *
         *  "name"     "codice" "value"
         *  "everyone" "001"     15
         *  "clerk"    "002"     57 
         *  "carp"     "005"     39 
         *
         */
        condense: function (szColumn, option) {

            const uniqueA = {};
            const keepIndexA = [];

            // GR 06.09.2021 new argument object {}
            if (szColumn && szColumn.lead) {
                option = szColumn;
                szColumn = option.lead;
            }

            const uniqueIndex = this.columnIndex(szColumn);

            if (option && option.keep) {
                // option.keep is string
                if (typeof (option.keep) == "string") {
                    keepIndexA[this.columnIndex(option.keep)] = true;
                } else
                    // or array of strings
                    for (i = 0; i < option.keep.length; i++) {
                        keepIndexA[this.columnIndex(option.keep[i])] = true;
                    }
            }
            const __newRecords = [];
            for (let j = 0; j < this.records.length; j++) {
                const szTest = String(this.records[j][uniqueIndex]);
                if (uniqueA[szTest] != null) {
                    const k = uniqueA[szTest];
                    for (let v = 0, len = this.records[j].length; v < len; v++) {
                        if (!keepIndexA[v]) {
                            if (!isNaN(this.records[j][v])) {
                                if (option && option.calc == "max") {
                                    __newRecords[k][v] = Math.max(Number(__newRecords[k][v]), Number(this.records[j][v]));
                                } else {
                                    __newRecords[k][v] = Number(__newRecords[k][v]) + Number(this.records[j][v]);
                                }
                            } else {
                                if (isNaN(this.records[j][v]) && (__newRecords[k][v] != this.records[j][v])) {
                                    let n = parseFloat(String(__newRecords[k][v]).split(" (+")[1]) || 0;
                                    __newRecords[k][v] = String(__newRecords[k][v]).split(" (+")[0] + " (+" + (++n) + ") ";
                                }
                            }
                        }
                    }
                } else {
                    __newRecords.push(this.records[j].slice());
                    uniqueA[szTest] = __newRecords.length - 1;
                }
            }
            
            this.__condense = new Data.Table();
            this.__condense.fields = this.fields;
            this.__condense.table.fields = this.fields;
            this.__condense.records = __newRecords.slice();
            this.__condense.table.records = this.__condense.records.length;

            return this.__condense;
        },

        /**
         * creates a new column based on existing ones<br>
         * the values of the new column are the sum of the source columns
         * @param {Object} options the creation parameter
         *								   <table border='0' style='border-left: 1px solid #ddd;'>	
         *								   <tr><th>property</th><th>description</th></tr>
         *								   <tr><td><b>"source"</b></td><td>the name of the source columns </td></tr>
         *								   <tr><td><b>"destination"</b></td><td>the name of the new colmn to create</td></tr>
         *								   </table> 
         * @type {Data.Table}
         * @returns {Data.Table} the enhanced table
         * @example
         *    mydata = mydata.groupColumns({'source':['col_1','col_2'],'destination':'col_sum'});
         *
         */
        groupColumns: function (options) {

            let sourceA = options.source;
            let iA = [];
            for (let i = 0, len = sourceA.length; i < len; i++) {
                iA[i] = this.column(sourceA[i]).index;
            }
            this.addColumn({
                destination: options.destination
            }, function (row) {
                let value = 0;
                for (let i = 0, len = iA.length; i < len; i++) {
                    value += Number(row[iA[i]]);
                }
                return value;
            });

            return this;
        },
        /**
         * creates a pivot table <br>
         * @param {Object} options the pivot creation parameter
         *<table class="w3-table-all notranslate">
         * <tr>
         *    <th style="width:20%">Property</th>
         *    <th>Description</th>
         *  </tr>
         *  <tr>
         *    <td>lead</td>
         *    <td>the sourcetable field that defines the pivot rows</td>
         *  </tr>
         *  <tr>
         *    <td>keep</td>
         *    <td>columns of the sourcetable to copy into the pivot</td>
         *  </tr>
         *  <tr>
         *    <td>sum</td>
         *    <td>columns of the sourcetable to copy and sum into the pivot</td>
         *  </tr>
         *  <tr>
         *    <td>cols</td>
         *    <td>the sourcetable field that defines the pivot columns (together with 'keep')</td>
         *  </tr>
         *  <tr>
         *    <td>value</td>
         *    <td>the sourcetable field where to get the value to accumulate
         *         if '1', count the cases of the cols topicsthan</td>
         *  </tr>
         *</table>
         * @type {Data.Table}
         * @returns the pivot table
         * @example
         * 
         * // we have a table 'scrutini' with election results like:
         *	
         * assemblea  codice       tipo   tipo_riga  cand_descr_riga  descr_lista              voti   perc    
         * --------------------------------------------------------------------------------------------------
         * Camera     01110812620  Comune CA         ANDREA GIORGIS                            49654  "40,93"
         * Camera     01110812620  Comune LI                          PARTITO DEMOCRATICO      33228  "28,75" 
         * Camera     01110812620  Comune LI                          +EUROPA                  12970  "11,22"
         * Camera     01110812620  Comune LI                          ITALIA EUROPA INSIEME    846    "0,73"
         * Camera     01110812620  Comune LI                          CIVICA POPOLARE LORENZIN 601    "0,52" 
         * ...
         *
         * // --------------------------------------------------------------------------------------------
         * // make pivot table with columns == descr_lista (partiti)  
         * // --------------------------------------------------------------------------------------------
         *
         * var pivot = scrutini.pivot({
         *              "lead":	'codice',
         *              "keep":	['tipo'],
         *              "sum":	['membri'],
         *              "cols":	'descr_lista',
         *              "value":  "voti" 
         *              });
         *
         *
         * // the resulting pivot table is:
         *
         * codice       tipo   PARTITO DEMOCRATICO +EUROPA  ITALIA EUROPA INSIEME  CIVICA POPOLARE LORENZIN    
         * --------------------------------------------------------------------------------------------------
         * 01110812620  Comune 33228               12970    846                    601
         * ...
         */
        pivot: function (options) {

            options.lead = options.lead || options.rows;
            options.cols = options.cols || options.columns;
            options.keep = options.keep || [];
            options.sum = options.sum || [];

            // force string arrays 

            options.lead = __toArray(options.lead);
            options.cols = __toArray(options.cols);
            options.keep = __toArray(options.keep);
            options.sum = __toArray(options.sum);
            options.value = __toArray(options.value);
            options.forced = __toArray(options.forced);

            // make field indices

            let indexA = [];
            for (let i = 0; i < this.fields.length; i++) {
                indexA[String(this.fields[i].id)] = i;
            }

            // check the source columns

            for (let i = 0, len = options.lead.length; i < len; i++) {
                if (typeof (indexA[options.lead[i]]) == 'undefined') {
                    _alert("data.pivot - pivot keep column '" + options.lead[i] + "' not found");
                }
            }
            for (let i = 0, len = options.cols.length; i < len; i++) {
                if (options.cols && (typeof (indexA[options.cols[i]]) == 'undefined')) {
                    _alert("data.pivot - pivot columns source column '" + options.cols[i] + "' not found");
                }
            }
            for (let i = 0, len = options.keep.length; i < len; i++) {
                if (typeof (indexA[options.keep[i]]) == 'undefined') {
                    _alert("data.pivot - pivot keep column '" + options.keep[i] + "' not found");
                }
            }
            for (let i = 0, len = options.sum.length; i < len; i++) {
                if (typeof (indexA[options.sum[i]]) == 'undefined') {
                    _alert("data.pivot - pivot sum column '" + options.sum[i] + "' not found");
                }
            }
            for (let i = 0, len = options.value.length; i < len; i++) {
                if (typeof (indexA[options.value[i]]) == 'undefined') {
                    _alert("data.pivot - pivot value column '" + options.value[i] + "' not found");
                }
            }

            // make the pivot 

            let rowA = [];
            let colA = [];
            let data = this.records;

            // GR 12/03/2023 preset columns with forced columns

            if (options.forced) {
                for (let i = 0; i < options.forced.length; i++) {
                    colA[String(options.forced[i])] = 0;
                }
            }

            for (let row = 0, len = data.length; row < len; row++) {

                const parts = [data[row][indexA[options.lead[0]]]];
                for (let k = 1; k < options.lead.length; k++) {
                    parts.push(data[row][indexA[options.lead[k]]]);
                }
                const szRow = parts.join("|");

                let szCol = String(data[row][indexA[options.cols[0]]]);

                let nValue = null;
                if (options.calc == "string") {
                    nValue = data[row][indexA[options.value[0]]];
                } else {
                    nValue = 1;
                    if (options.value && options.value.length) {
                        nValue = 0;
                        for (let k = 0; k < options.value.length; k++) {
                            nValue += options.value[k] ? __scanValue(data[row][indexA[options.value[k]]]) : 1;
                        }
                    }
                }
                if (!szCol || szCol.length < 1) {
                    szCol = "undefined";
                }
                if (typeof (colA[szCol]) == 'undefined') {
                    colA[szCol] = 0;
                }
                if (!rowA[szRow]) {
                    rowA[szRow] = {
                        "Total": 0
                    };
                    for (let k = 0; k < options.keep.length; k++) {
                        rowA[szRow][options.keep[k]] = data[row][indexA[options.keep[k]]];
                    }
                    for (let k = 0; k < options.sum.length; k++) {
                        rowA[szRow][options.sum[k]] = Number(data[row][indexA[options.sum[k]]]);
                    }
                } else {
                    for (let k = 0; k < options.keep.length; k++) {
                        if (data[row][indexA[options.keep[k]]] &&
                            data[row][indexA[options.keep[k]]].length &&
                            (rowA[szRow][options.keep[k]] != data[row][indexA[options.keep[k]]])) {
                            rowA[szRow][options.keep[k]] = data[row][indexA[options.keep[k]]];
                        }
                    }
                    for (let k = 0; k < options.sum.length; k++) {
                        rowA[szRow][options.sum[k]] += Number(data[row][indexA[options.sum[k]]]);
                    }
                }

                rowA[szRow].Total += nValue;

                if (!rowA[szRow][szCol]) {
                    rowA[szRow][szCol] = nValue;
                    rowA[szRow][szCol + "count"] = 1;
                } else {
                    if (options.calc == "string") {}
                    if (options.calc == "max") {
                        rowA[szRow][szCol] = Math.max(nValue, rowA[szRow][szCol]);
                    } else {
                        rowA[szRow][szCol] += nValue;
                        rowA[szRow][szCol + "count"]++;
                    }
                }
            }
            
            this.__pivot = new Data.Table();

            // make first row (table.fields) with column names
            // ------------------------------------------------

            // lead
            for (let k = 0; k < options.lead.length; k++) {
                this.__pivot.fields.push({
                    id: options.lead[k]
                });
            }
            // keep
            for (let k = 0; k < options.keep.length; k++) {
                this.__pivot.fields.push({
                    id: options.keep[k]
                });
            }
            // sum
            for (let k = 0; k < options.sum.length; k++) {
                this.__pivot.fields.push({
                    id: options.sum[k]
                });
            }
            // cols
            if (options.cols && options.cols.length)
                for (let a in colA) {
                    if (Object.prototype.hasOwnProperty.call(colA, a)) {
                        this.__pivot.fields.push({
                            id: a
                        });
                    }
                }
            //totale
            this.__pivot.fields.push({
                id: "Total"
            });


            // make the values
            // ----------------
            for (let a in rowA) {
                if (Object.prototype.hasOwnProperty.call(rowA, a)) {
                    // collect values per place
                    const valueA = [];
                    // lead
                    const leadA = a.split("|");
                    if (options.lead && options.lead.length)
                        for (let k = 0; k < leadA.length; k++) {
                            valueA.push(leadA[k]);
                        }
                    // keep
                    for (let k = 0; k < options.keep.length; k++) {
                        valueA.push(rowA[a][options.keep[k]]);
                    }
                    // sum
                    for (let k = 0; k < options.sum.length; k++) {
                        valueA.push(rowA[a][options.sum[k]]);
                    }
                    // cols
                    if (options.cols && options.cols.length)
                        for (let t in colA) {
                            if (Object.prototype.hasOwnProperty.call(colA, t)) {
                                if (options.calc == "mean") {
                                    valueA.push((rowA[a][t] || 0) / (rowA[a][t + "count"] || 1));
                                } else {
                                    valueA.push(rowA[a][t] || 0);
                                }
                            }
                        }
                    // totale
                    valueA.push(rowA[a].Total);
                    // record complete
                    this.__pivot.records.push(valueA);
                    this.__pivot.table.records++;
                }
            }
            
            return (this.__pivot);
        },
        /**
         * creates a sub table <br>
         * which only contains the specified columns
         * @param options {Object} the subtable columns definition; use either 'columns' or 'fields'
         *<table class="w3-table-all notranslate">
         * <tr>
         *    <th style="width:20%">Property</th>
         *    <th>Description</th>
         *  </tr>
         *  <tr>
         *    <td>columns</td>
         *    <td>array of column indices</td>
         *  </tr>
         *  <tr>
         *    <td>fields</td>
         *    <td>array of column names</td>
         *  </tr>
         *</table>
         * @type {Data.Table}
         * @returns the generated sub table
         * @example
         * subTable = table.subtable({"columns":[1,2,3]});
         * @example
         * subTable = table.subtable({"fields":['comune_scr','provincia_scr','Lat','Lon']});
         */
        subtable: function (options) {

            this.__subt = new Data.Table();

            if (options.fields) {
                options.columns = [];
                for (let i = 0; i < options.fields.length; i++) {
                    for (let ii = 0; ii < this.fields.length; ii++) {
                        if (this.fields[ii].id == options.fields[i]) {
                            options.columns.push(ii);
                        }
                    }
                }
            }

            for (let i = 0; i < options.columns.length; i++) {
                this.__subt.fields.push({
                    id: String(this.fields[options.columns[i]].id)
                });
                this.__subt.table.fields++;
            }
            for (const j in this.records) {
                let records = [];
                for (let i = 0; i < options.columns.length; i++) {
                    records.push(this.records[j][options.columns[i]]);
                }
                this.__subt.records.push(records);
                this.__subt.table.records++;
            }
            return this.__subt;
        },

        /**
         * sort the rows of a data table by values of a given column
         * @param {string} sortColumn the column by which values to sort the table
         * @type {Data.Table}
         * @returns the sorted table
         */
        sort: function (szColumn, szFlag) {
            let valuesA = this.column(szColumn).values();
            let number = 0;
            for (let i = 0; i < Math.min(valuesA.length,10); i++) {
                 if (!isNaN(parseFloat(String(valuesA[i]).replace(",",".")))){
                    number++;
                }
            }
            let sortA = [];
            if (number){
                for (let i = 0; i < valuesA.length; i++) {
                    sortA.push({
                        index: i,
                        value: Number(String(valuesA[i]).replace(",","."))
                    });
                }
            }else{
                 for (let i = 0; i < valuesA.length; i++) {
                    sortA.push({
                        index: i,
                        value: valuesA[i]
                    });
                }
            }
            if (szFlag && szFlag == "DOWN") {
                sortA.sort(function (a, b) {
                    return ((a.value > b.value) ? -1 : 1);
                });
            } else {
                sortA.sort(function (a, b) {
                    return ((a.value < b.value) ? -1 : 1);
                });
            }
            let records = [];
            for (let i = 0; i < sortA.length; i++) {
                records.push(this.records[sortA[i].index]);
            }
            this.records = records;
            return this;
        },

        /**
         * appends the rows of a data table to the actual table<br>
         * ! <b>important</b>: the structure of both tables must be identical, i.e. same column count and names
         * @param {Data.Table} sourceTable table the source of the rows to append
         * @type {Data.Table}
         * @returns the extended table
         */
        append: function (sourceTable) {
            if (this.table.fields.length != sourceTable.table.fields.length) {
                return null;
            }
            for (let i = 0; i < this.table.fields.length; i++) {
                if (this.table.fields[i].id != sourceTable.table.fields[i].id) {
                    return null;
                }
            }
            let records = sourceTable.records;
            for (let i = 0; i < records.length; i++) {
                this.records.push(records[i]);
            }
            this.table.records = this.records.length;
            return this;
        },

        /**
         * creates a json object array from the table <br>
         * every row creates an array element 
         * array elements are of type:
         * { name_1: value_1, name_2: value_2, ... }
         */
        json: function () {

            this.__json = [];
            for (const r in this.records) {
                let row = {};
                for (const c in this.fields) {
                    row[String(this.fields[c].id)] = this.records[r][c];
                }
                this.__json.push(row);
            }
            return this.__json;
        }

    };


    //...................................................................
    // local helper
    //...................................................................
    __myNumber = function (value) {
        let number = parseFloat(value.replace(/\./g, "").replace(/\,/g, "."));
        return isNaN(number) ? 0 : number;
    };

    __scanValue = function (nValue) {
        // strips blanks inside numbers (e.g. 1 234 456 --> 1234456)
        let number = null;
        if (String(nValue).match(/,/)) {
            number = parseFloat(String(nValue).replace(/\./gi, "").replace(/,/gi, "."));
            return isNaN(number) ? 0 : number;
        } else {
            number = parseFloat(String(nValue).replace(/ /gi, ""));
            return isNaN(number) ? 0 : number;
        }
    };


    // ---------------------------------------------------------------------------------
    //
    // additional specific functions (not core, can also be realized by above functions)
    //
    // ---------------------------------------------------------------------------------

    /**
     * creates new columns on base of a timestamp that contain the following time orders <br>
     * date,year,month,day,hour
     * <br>
     * @param data the input tabel (array of arrarys)
     * @param options generation options
     * @type {Array}
     * @returns the pivot table
     * @example
     * <br><br>
     * <strong>options definition object:</strong>
     *		var options = { "source":	'name of timestamp column',
     *						"create":	['date','year','month','day','hour']
     *					}
     *	<br>
     *  source: the sourcetable field that contains the toime stamp
     *  create: [optional] an array of columns to creaate
     *          to define only if not wished to create all of above listed time columns
     */
    Data.Table.prototype.addTimeColumns = function (options) {

        if (!options.source) {
            return null;
        }

        for (const column in this.fields) {
            if (this.fields[column].id == options.source) {

                // make fields object
                // ------------------

                // copy orig fields 
                let timeCollA = options.create || ['date', 'year', 'month', 'day', 'hour'];

                // add new time columns 
                for (let i = 0; i < timeCollA.length; i++) {
                    this.fields.push({
                        id: String(timeCollA[i])
                    });
                    this.table.fields++;
                }

                // make values 
                // ------------------
                let length = this.records.length;
                let j = 0;
                for (j = 0; j < length; j++) {

                    // add new time column values
                    let d = new Date(this.records[j][column]);
                    if (d) {
                        for (let i = 0; i < timeCollA.length; i++) {
                            switch (timeCollA[i]) {
                                case 'date':
                                    let date = String(d.getDate()) + "." + String(d.getMonth() + 1) + "." + String(d.getFullYear());
                                    this.records[j].push(date);
                                    break;
                                case 'year':
                                    this.records[j].push(d.getFullYear());
                                    break;
                                case 'month':
                                    this.records[j].push(d.getMonth() + 1);
                                    break;
                                case 'day':
                                    this.records[j].push(d.getDay());
                                    break;
                                case 'hour':
                                    this.records[j].push(d.getHours());
                                    break;
                            }
                        }
                    }
                }

            }
        }

        return this;
    };

    /**
     * Create a new Data.Column instance.  
     * <p>it is generally created by the <b>.column()</b> method of <b>Data.table</b> object</p>
     * <p>it provides ther methods to access or process the values of one column of the data table</p>
     * @class It realizes an object to hold a table column
     * @constructor
     * @returns A new Data.Column object
     * @example
     *    var myColumn = mydata.column('timestamp');
     */

    Data.Column = function () {
        this.table = null;
        this.index = null;
        this.valueA = null;
    };
    Data.Column.prototype = {
        /**
         * get the values of the column
         * <br>
         * @type {Array}
         * @returns {Array} an array with the values of the column
         * @example
         *    var sumArray = mydata.column('total').values();
         */
        values: function () {
            this.valueA = [];
            for (const i in this.table.records) {
                this.valueA.push(this.table.records[i][this.index]);
            }
            return this.valueA;
        },

        /**
         * get the values of the column
         * <br>
         * @type {Array}
         * @returns {Array} an array with the values of the column
         * @example
         *    var sumArray = mydata.column('total').values();
         */
        uniqueValues: function () {
            this.valueA = [];
            for (const i in this.table.records) {
                this.valueA.push(this.table.records[i][this.index]);
            }
            return this.valueA.filter(__onlyUnique);
        },

        /**
         * map the values of the column
         * @param {function} function(currVal) the user function to map the column values
         * @type void
         * @returns {Data.Column}
         * @example
         *    mydata.column('timestamp').map(
         *        function(value){
         *            var d = new Date(value);
         *            return( String(d.getDate()) + "." + String(d.getMonth()+1) + "." + String(d.getFullYear()) );
         *     });
         */
        map: function (callback) {

            // make new record values 
            // ----------------------
            for (const j in this.table.records) {
                // query new column value by callback
                this.table.records[j][this.index] = callback(this.table.records[j][this.index], this.table.records[j], this.index);
            }

            return this;
        },

        /**
         * rename the column
         * @param {string} szName the new column name
         * @type void
         * @returns {Data.Column}
         * @example
         *    mydata.column('timestamp').rename('time');
         */
        rename: function (szName) {

            this.table.fields[this.index].id = szName;
            return this;
        },

        /**
         * remove the column
         * @type void
         * @returns {Data.Column}
         * @example
         *    mydata.column('timestamp').remove();
         */
        remove: function () {

            this.table.fields.splice(this.index, 1);
            for (const j in this.table.records) {
                this.table.records[j].splice(this.index, 1);
            }
            this.table.table.fields--;
            return this;
        }
    };

    // ----------------------------------------------------
    // W R A P  Data.Table  functions to Data.Feed object
    // ----------------------------------------------------
    /**
     * extract the values of one column from a data table
     * @param szColumn the name of the column to extract from loaded data
     * @type {Array}
     * @returns column values array or null
     */
    Data.Feed.prototype.column = function (szColumn) {
        return this.dbtable.column(szColumn);
    };

    /**
     * applicate filter to one theme item
     * @param j the index (data row) of the item to check
     * @type {boolean}
     * @returns true if item passes the filter
     */
    Data.Feed.prototype.select = function (szSelection) {
        return this.dbtable.select(szSelection);
    };

    /**
     * aggregate 
     * @param j the index (data row) of the item to check
     * @type {boolean}
     * @returns true if item passes the filter
     */
    Data.Feed.prototype.aggregate = function (szColumn, szAggregation) {
        return this.dbtable.aggregate(szColumn, szAggregation);
    };

    /**
     * revert 
     * @param void
     * @type {Data.Feed}
     * @returns the reverted feed
     */
    Data.Feed.prototype.revert = function () {
        return this.dbtable.revert();
    };

    /**
     * reverse 
     * @param void
     * @type {Data.Feed}
     * @returns the reversed feed
     */
    Data.Feed.prototype.reverse = function () {
        return this.dbtable.reverse();
    };

    /**
     * pivot 
     * @param j the index (data row) of the item to check
     * @type {boolean}
     * @returns true if item passes the filter
     */
    Data.Feed.prototype.pivot = function (options) {
        return this.dbtable.pivot(options);
    };

    /**
     * subtable 
     * @param j the index (data row) of the item to check
     * @type {boolean}
     * @returns true if item passes the filter
     */
    Data.Feed.prototype.subtable = function (options) {
        return this.dbtable.subtable(options);
    };

    /**
     * add time fields to table by a timestamp column 
     * @param options ( see Data.Table.prototype.addTimeColumns )
     * @type {Data.Feed}
     * @returns the enhanced feed
     */
    Data.Feed.prototype.addTimeColumns = function (options) {
        return this.dbtable.addTimeColumns(options);
    };

    // =====================================================================
    // data broker
    // =====================================================================

    /**
     * This is the Data.Broker class.  
     * <br>
     * It realizes an object to load <b>one or more</b> data sources 
     * and call a user defined function if all sources have been successfully loaded.<br>
     * It passes an array with the loaded data (Data.Table objects) to the user function
     * 
     * @class realizes an object to load <b>one or more</b> data sources
     * @constructor
     * @type {Data.Broker}
     * @returns a new Data.Broker object
     * @example
     *	var broker = new Data.Broker()
     *		.addSource("https://raw.githubusercontent.com/ondata/elezionipolitiche2018/master/dati/scrutiniCI_cm.csv","csv")
     *		.addSource("https://raw.githubusercontent.com/ondata/elezionipolitiche2018/master/risorse/comuniViminaleISTAT.csv","csv")
     * 		.addSource("https://raw.githubusercontent.com/ondata/elezionipolitiche2018/master/dati/camera_geopolitico_italia.csv","csv")
     *		.realize(
     *	function(dataA) {
     *		var scrutini                    = dataA[0];
     *		var comuniViminaleISTAT         = dataA[1];
     *		var camera_geopolitico_italia   = dataA[2];
     *
     *		scrutini = scrutini.select("WHERE tipo_riga == LI");
     *		 ...
     *	});
     */
    Data.Broker = function (options) {
        this.souceQueryA = [];
        this.options = options || {};
        if (options) {
            this.parseDefinition(options);
        }
        this.onNotify = function () {};
        this.onError = function (e) {alert("error loading data:" + e)};
    };

    /**
     * inherit methods from Data.Feed class  
     */
    Data.Broker.prototype = new Data.Feed();

    Data.Broker.prototype = {
        /**
         * add one source to the broker
         * @param {string} szUrl the url of the data source
         * @param {string} szType type of the data (csv,...)
         *								   <table border='0' style='border-left: 1px solid #ddd;'>	
         *								   <tr><td><b>"csv"</b></td><td>the source is 'plain text' formatted as Comma Separated Values<br>delimiter supported: <span style='background:#dddddd'>,</span> and <span style='background:#dddddd'>;</span></td></tr>
         *								   <tr><td><b>"json"</b></td><td>the source is JSON (Javascript Object Notation)</td></tr>
         *								   <tr><td><b>"geojson"</b></td><td>the source is a JSON object formatted in <a href="https://geojson.org/" target="_blank">GeoJson</a></td></tr>
         *								   <tr><td><b>"geoparquet"</b></td><td>the source is a GeoParquet file (converted to GeoJSON)</td></tr>
         *								   <tr><td><b>"parquet"</b></td><td>the source is a Parquet file</td></tr>
         *								   <tr><td><b>"gpkg"</b></td><td>the source is a GeoPackage file (using DuckDB WASM spatial extension, converted to GeoJSON)</td></tr>
         *								   <tr><td><b>"JSON-stat"</b></td><td>the source is a JSON object formatted in <a href="https://json-stat.org/JSON-stat" target="_blank">JSON-stat</a></td></tr>
         *								   <tr><td><b>"jsonDB"</b></td><td>the source is in ixmaps internal data table format</td></tr>
         *								   <tr><td><b>"rss"</b></td><td>the source is an xml rss feed</td></tr>
         *								   </table> 
         * @type {Data.Broker}
         * @returns the Data.Broker object
         */
        addSource: function (szUrl, szType) {
            _LOG("Data.Broker.addSource: " + szUrl);
            this.souceQueryA.push({
                url: szUrl,
                type: szType,
                data: null,
                result: null,
                next: this
            });
            return this;
        },

        /**
         * set the callback function to execute on sucess of all loading.<br>
         * Note: can also be defined as argument of .realize()
         * @param {function(broker)} callback the callback function
         * @type {Data.Broker}
         * @returns the Data.Broker object
         * @example
         *  function onSuccess(dataA) {
         *      ... do something with the loaded data
         *  }
         *
         *  var broker = new Data.Broker()
         *      .addSource("https://raw.githubusercontent.com/ondata/elezionipolitiche2018/master/dati/scrutiniCI_cm.csv","csv")
         *      .setCallback(onSuccess)
         *      .realize();
         * @deprecated use callback in realize()
         */
        setCallback: function (callback) {
            this.callback = callback;
            return this;
        },

        /**
         * start the broker<br>
         * initiate the process to load the added sources and [optional] define a user function to be called 
         * on success.<br>the argument passed to the user function is an array with the loaded data as {@link "-_anonymous_-Data.Table"} objects
         * @param {function} callback type of the data (csv,...)
         * @type void
         * @see {@link Data.Broker.setCallback}
         * @example
         *		...
         *		.realize(
         *	function(dataA) {
         *		var scrutini                    = dataA[0];
         *		var comuniViminaleISTAT         = dataA[1];
         *		var camera_geopolitico_italia   = dataA[2];
         *		...
         *	});
         */
        realize: function (callback) {
            this.callback = callback || this.callback;
            for (const i in this.souceQueryA) {
                if (this.souceQueryA[i].url && !this.souceQueryA[i].result) {
                    this.getData(this.souceQueryA[i]);
                    return this;
                }
            }
            this.data = [];
            for (const i in this.souceQueryA) {
                this.data.push(this.souceQueryA[i].data || new Data.Table());
            }
            this.callback(this.data);
            return this;
        },

        /**
         * define error function
         * @param {function(exception)} onError a user defined function to call when error occurs 
         * @type {Data.Broker}
         * @returns the Data.Broker object
         * @example
         *	var broker = new Data.Broker()
         *      .addSource("https://raw.githubusercontent.com/ondata/elezionipolitiche2018/master/dati/scrutiniCI_cm.csv","csv")
         *
         *      .error(function(e){alert(e);})
         *
         *      .realize(
         *	function(broker) {
         *          ...
         *	});
         */

        error: function (onError) {
            this.onError = onError || this.onError;
            return this;
        },

        /**
         * define notify function
         * @param {function(exception)} onError a user defined function to call when notify occurs 
         * @type {Data.Broker}
         * @returns the Data.Broker object
         * @example
         *	var broker = new Data.Broker()
         *      .addSource("https://raw.githubusercontent.com/ondata/elezionipolitiche2018/master/dati/scrutiniCI_cm.csv","csv")
         *
         *      .notify(function(e){alert(e);})
         *
         *      .realize(
         *	function(broker) {
         *          ...
         *	});
         */
        notify: function (onNotify) {
            this.onNotify = onNotify || this.onNotify;
            return this;
        }
    };

    /**
     * internal method to read parameter from the definition object
     * @method parseDefinition
     * @param definition the object literal with `data options`
     * @param szType type of the data (csv,...)
     * @private
     * @type void
     */
    Data.Broker.prototype.parseDefinition = function (definition) {
        this.callback = definition.callback || null;
    };
    /**
     * internal method to get one data from the specified source
     * @method getData
     * @param query object with the definition of the data source
     * @private
     * @type void
     */
    Data.Broker.prototype.getData = function (query) {
        this.onNotify(query);
        query.feed = Data.feed({
            "source": query.url,
            "type": query.type,
            "options": query.next.options,
            parent: this
        }).load(function (mydata) {
            query.data = mydata;
            query.data.raw = query.feed.data;
            this.parent.onNotify(query);
            query.result = "success";
            query.next.realize();
        }).error(function (e) {
            this.parent.onError(query.url);
            query.data = null;
            query.result = "error";
            query.next.realize();
        });
    };
    /**
     * set the broker result as the new Data.Table in the parent Data.Feed object
     * @method setData
     * @param data a 2 dim data array
     * @private
     * @type void
     */
    Data.Broker.prototype.setData = function (data) {
        this.parent.__doCreateTableDataObject(data, null, this.parent.options);
    };

    // Instantiates a broker object with 
    // an object literal with `data options`.
    // @factory Data.Feed.broker(options?: Data options)
    //
    Data.Feed.prototype.broker = function (options) {
        let broker = new Data.Broker(options);
        broker.parent = this;
        return broker;
    };

    // @factory Data.broker()
    // Instantiates a Data.Broker
    //

    Data.broker = function () {
        return new Data.Broker();
    };

    // @factory Data.provider()
    // Instantiates a Data.Broker
    //

    Data.provider = function () {
        return new Data.Broker();
    };
    // =====================================================================
    // data merger
    // =====================================================================

    /* End of legacy __processWithHyparquet function */

    // ---------------------------------------
    // D A T A   M E R G E R   C L A S S
    // ---------------------------------------

    /**
     * This is the Data.Merger class.  
     * <br>
     * It realizes an object to load <b>two or more</b> data sources 
     * and merge the data guided by 2 columns with identical values.<br>
     * 
     * @class realizes an object to merge <b>two or more</b> data sources
     * @constructor
     * @type {Data.Merger}
     * @returns a new Data.Merger object
     * @example
     *	var merger = new Data.Merger()
     *      .addSource(prezzi,{lookup:"idImpianto",columns:["descCarburante","prezzo","isSelf","dtComu"]});
     *      .addSource(impianti,{lookup:"idImpianto",columns:["Bandiera","Latitudine","Longitudine"]});
     *		.realize(
     *	function(mergedTable) {
     *
     *		selection = mergedTable.select("WHERE tipo_riga == LI");
     *		 ...
     *	});
     */
    Data.Merger = function (options) {
        this.sourceA = [];
        this.options = options || {};
        if (options) {
            this.parseDefinition(options);
        }
    };
    Data.Merger.prototype = {
        /**
         * add one source to the merger
         * @param {Object} source a loaded data.js table object, typically the result of a data.feed 
         * @param {Object} option the merging parameter for this sorce: lookup, columns and label [optional]
         * @example
         *   .addSource(prezzi,{lookup:"idImpianto",columns:["descCarburante","prezzo","isSelf","dtComu"]});
         * @example
         *   .addSource(prezzi,{lookup:"idImpianto",columns:["descCarburante","prezzo","isSelf","dtComu"],label:["CARB1","PREZZO","SELF","COM"]});
         * @type {Data.Merger}
         * @returns the Data.Merger object
         */
        addSource: function (source, option) {
            this.sourceA.push({
                data: source,
                opt: option
            });
            return this;
        },

        /**
         * define which source columns should be included into the merged table.
         * @param {Array} columnsA a subset of source columns or label you defined by .addSource 
         * @type {Data.Merger}
         * @return the Data.Merger object
         * @example
         *		var merger = new Data.Merger()
         *      .addSource(prezzi,{lookup:"idImpianto",columns:["descCarburante","prezzo","isSelf","dtComu"]});
         *      .addSource(impianti,{lookup:"idImpianto",columns:["Bandiera","Latitudine","Longitudine"]});
         *		.setOuputColumns(["desCaburante","prezzo"])
         *      .realize();
         */
        setOutputColumns: function (columnsA) {
            this.outColumnsA = columnsA;
            return this;
        },

        /**
         * initiates the process of merging the sources, guided by the lookup column,
         * inserting all columns that have been defined by .addSource(), or a subset<br>
         * of them defined by .setOutputColumns()
         * @param {function} callback user defined function which receives as argument the merged table 
         * @type void
         * @see {@link Data.Merger.setCallback}
         * @example
         *  ...
         * .realize(function(newData){
         *     ixmaps.setExternalData(newData,{"type":"jsonDB","name":"prezzi_tipo_latlon"});
         * });	
         */
        realize: function (callback) {

            this.callback = callback || this.callback;

            _LOG("DataMerger: >>>");

            let indexAA = [];

            for (const i in this.sourceA) {

                let source = this.sourceA[i];

                source.opt.columns = source.opt.columns || source.data.columnNames();
                source.opt.label = source.opt.label || [];

                source.opt.columns = __toArray(source.opt.columns);
                source.opt.label = __toArray(source.opt.label);
                
                if (!this.sourceA[i].data) {
                    _alert("DataMerger: source '" + i + "' not found");
                }

                if (!this.sourceA[i].data[0]) {
                    this.sourceA[i].data = this.sourceA[i].data.getArray();
                }

                if (!this.sourceA[i].data[0]) {
                    _alert("DataMerger: source '" + i + "' not found or not of type Array");
                }

                let index = [];
                for (const ii in this.sourceA[i].data[0]) {

                    if (this.sourceA[i].data[0][ii] == this.sourceA[i].opt.lookup) {
                        index[this.sourceA[i].opt.lookup] = ii;
                    }

                    for (const iii in this.sourceA[i].opt.columns) {
                        if (!this.sourceA[i].opt.label[iii]) {
                            this.sourceA[i].opt.label[iii] = this.sourceA[i].opt.columns[iii] + "." + (Number(i) + 1) + "";
                        }
                        if (this.sourceA[i].data[0][ii] == this.sourceA[i].opt.columns[iii]) {
                            index[this.sourceA[i].opt.label[iii]] = ii;
                        }
                    }
                }
                // check completeness
                for (const iii in this.sourceA[i].opt.columns) {
                    if (!index[this.sourceA[i].opt.label[iii]]) {
                        _LOG("DataMerger: '" + this.sourceA[i].opt.label[iii] + "' not found");
                    }
                }
                indexAA.push(index);
            }

            let labelA = [];
            for (const i in this.sourceA) {
                for (const ii in this.sourceA[i].opt.label) {
                    labelA.push(this.sourceA[i].opt.label[ii]);
                }
            }

            if (!this.outColumnsA) {
                this.outColumnsA = [];
                for (const i in labelA) {
                    this.outColumnsA.push(labelA[i]);
                }
            }

            let outColumnsLookupA = [];
            for (const i in this.outColumnsA) {
                for (const ii in indexAA) {
                    for (const iii in indexAA[ii]) {
                        if (iii == this.outColumnsA[i]) {
                            outColumnsLookupA[iii] = {
                                input: ii,
                                index: indexAA[ii][iii]
                            };
                        }
                    }
                }
            }

            for (const i in this.outColumnsA) {
                if (!outColumnsLookupA[this.outColumnsA[i]]) {

                    for (const ii in this.sourceA[0].data[0]) {
                        if (this.sourceA[0].data[0][ii] == this.outColumnsA[i]) {
                            outColumnsLookupA[this.outColumnsA[i]] = {
                                input: 0,
                                index: ii
                            };
                        }
                    }
                }
            }

            this.namedSourceA = [];
            for (let i = 1; i < this.sourceA.length; i++) {
                this.namedSourceA[i] = [];
                for (let ii = 1; ii < this.sourceA[i].data.length; ii++) {
                    this.namedSourceA[i][String(this.sourceA[i].data[ii][indexAA[i][this.sourceA[i].opt.lookup]])] = this.sourceA[i].data[ii];
                }
            }

            let newData = [];
            newData.push(this.outColumnsA);

            for (let i = 1; i < this.sourceA[0].data.length; i++) {
                let lookup = String(this.sourceA[0].data[i][[indexAA[0][this.sourceA[0].opt.lookup]]]);

                let row = [];

                for (const ii in this.outColumnsA) {
                    let ll = outColumnsLookupA[this.outColumnsA[ii]];
                    if (ll) {
                        if (ll.input == 0) {
                            row.push(this.sourceA[0].data[i][ll.index]);
                        } else {
                            if (this.namedSourceA[ll.input][lookup]) {
                                row.push(this.namedSourceA[ll.input][lookup][ll.index]);
                            } else {
                                row.push(" ");
                            }
                        }
                    } else {
                        _alert("DataMerger - missing \"" + this.outColumnsA[ii] + "\" in label:[...]");
                        return null;
                    }
                }

                newData.push(row);
            }

            _LOG("DataMerger: done");

            let dbTable = new Data.Table();
            dbTable.setArray(newData);

            if (this.callback) {
                this.callback(dbTable);
            }

            return dbTable;
        },

        /**
         * define error function
         * @param {function(exception)} onError a user defined function to call when error occurs 
         * @type {Data.Merger}
         * @returns the Data.Merger object
         * @example
         *	var merger= new Data.Merger()
         *      .addSource("https://raw.githubusercontent.com/ondata/elezionipolitiche2018/master/dati/scrutiniCI_cm.csv","csv")
         *
         *      .error(function(e){alert(e);})
         *
         *      .realize(
         *	function() {
         *          ...
         *	});
         */
        error: function (onError) {
            this.onError = onError || this.onError;
            return this;
        }
    };

    // @factory Data.merger()
    // Instantiates a Data.Merger
    //

    Data.merger = function () {
        return new Data.Merger();
    };

    // =====================================================================
    // end of data merger
    // =====================================================================

    // version message
    console.log("*** data.js " + Data.version + " ***");

    // alert handling
    var _alert = function (szAlert) {
        console.log("data.js v" + Data.version + ": " + szAlert);
    };

    /**
     * end of namespace
     */


}(window, document));

// -----------------------------
// EOF
// -----------------------------