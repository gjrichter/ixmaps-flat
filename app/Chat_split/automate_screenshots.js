// Script to automate taking screenshots of all basemaps
// This will be executed in the browser console

(async function() {
    const allBasemaps = window.allBasemaps || [];
    console.log(`Found ${allBasemaps.length} basemaps to process`);
    
    // Function to change basemap and wait
    async function changeBasemapAndWait(basemap) {
        console.log(`Changing to: ${basemap.name} (${basemap.id})`);
        
        // Change basemap
        if (window.mapInstance && window.mapInstance.setMapTypeId) {
            window.mapInstance.setMapTypeId(basemap.id);
        } else if (window.ixmaps && window.ixmaps.setMapTypeId) {
            window.ixmaps.setMapTypeId(basemap.id);
        } else if (window.ixmaps && window.ixmaps.htmlMap_setMapTypeId) {
            window.ixmaps.htmlMap_setMapTypeId(basemap.id);
        } else if (window.ixmaps && window.ixmaps.embeddedSVG && 
                   window.ixmaps.embeddedSVG.window && 
                   window.ixmaps.embeddedSVG.window.map && 
                   window.ixmaps.embeddedSVG.window.map.Api &&
                   window.ixmaps.embeddedSVG.window.map.Api.setMapTypeId) {
            window.ixmaps.embeddedSVG.window.map.Api.setMapTypeId(basemap.id);
        }
        
        // Wait for basemap to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Update status
        if (document.getElementById('status')) {
            document.getElementById('status').textContent = 
                `Processing: ${basemap.name} (${allBasemaps.indexOf(basemap) + 1}/${allBasemaps.length})`;
        }
        
        // Signal ready
        window.currentBasemapName = basemap.name;
        window.currentBasemapId = basemap.id;
        window.screenshotReady = true;
        
        console.log(`Ready for screenshot: ${basemap.name}`);
    }
    
    // Process all basemaps
    for (let i = 0; i < allBasemaps.length; i++) {
        const basemap = allBasemaps[i];
        await changeBasemapAndWait(basemap);
        
        // Wait before next
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('All basemaps processed!');
})();

