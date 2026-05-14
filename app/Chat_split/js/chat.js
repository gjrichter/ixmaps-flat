        let mapInstance = null;
        let messageHistory = [];
        let currentDataTable = null;
        let currentDataUrl = null;
        let currentDataType = null;
        let pendingAnalysisOffer = false; // Track if we've offered to analyze data
        
        // Undo system - save project JSON snapshots before each change
        let projectHistory = []; // Array of project JSON objects (as strings or objects)
        const MAX_UNDO_HISTORY = 50; // Limit history size to prevent memory issues
        
        // User prompt history for arrow key navigation
        let userPromptHistory = []; // Array of user prompt strings
        let promptHistoryIndex = -1; // Current position in history (-1 means at the end/current input)
        let tempInputValue = ''; // Store current input when navigating history
        
        /**
         * Get current project JSON
         * @returns {Object|null} Project JSON object or null if not available
         */
        function getCurrentProjectJSON() {
            try {
                let projectString = null;
                const map = ixmaps && ixmaps.map ? ixmaps.map() : null;
                const mapInstance = ixmaps && ixmaps.embeddedSVG && ixmaps.embeddedSVG.window ? ixmaps.embeddedSVG.window.map : null;
                
                if (map && typeof map.getProjectString === 'function') {
                    projectString = map.getProjectString();
                } else if (mapInstance && typeof mapInstance.getProjectString === 'function') {
                    projectString = mapInstance.getProjectString();
                } else if (ixmaps && typeof ixmaps.getProjectString === 'function') {
                    projectString = ixmaps.getProjectString();
                }
                
                if (projectString) {
                    try {
                        return JSON.parse(projectString);
                    } catch (e) {
                        console.warn('Could not parse project string:', e);
                        return null;
                    }
                }
                return null;
            } catch (error) {
                console.warn('Error getting project JSON:', error);
                return null;
            }
        }
        
        /**
         * Save current project JSON to undo history
         */
        function saveProjectToHistory() {
            try {
                const project = getCurrentProjectJSON();
                // Save even if project is null/empty (to track state changes)
                // Deep clone the project to avoid reference issues
                const projectCopy = project ? JSON.parse(JSON.stringify(project)) : null;
                projectHistory.push(projectCopy);
                
                // Limit history size
                if (projectHistory.length > MAX_UNDO_HISTORY) {
                    projectHistory.shift(); // Remove oldest
                }
                
                console.log('Saved project to history, history length:', projectHistory.length);
            } catch (error) {
                console.warn('Error saving project to history:', error);
            }
        }

        /** Placeholder and other small UI tweaks when chat is embedded in the map page (?embed=host). */
        function applyEmbedChatUiHints() {
            if (!window.__IXMAPS_AI_CHAT_EMBED_HOST__) {
                return;
            }
            const input = document.getElementById('chatInput');
            if (input) {
                input.placeholder = 'Ask about this map…';
            }
        }

        // Initialize the map
        function initMap() {

            if (window.__IXMAPS_AI_CHAT_EMBED_HOST__) {
                var sp = document.getElementById('mapLoadingSpinner');
                if (sp) {
                    sp.classList.remove('active');
                    sp.style.display = 'none';
                }
                return;
            }

            // Show spinner during initial map loading
            showMapLoadingSpinner();
            
            ixmaps.Map("map-div", {
                mapService: "leaflet_vt",
                mapType: "OpenStreetMap - Osmarenderer",
                mapProjection: "mercator",
                name: "map_1",
                mode: "pan",
                legend: "closed",
                tools: "true",
                search: "Europe",
                about: "test"
            }).then(map => {
                // Hide spinner when map is ready
                setTimeout(() => {
                    hideMapLoadingSpinner();
                }, 1000);
                mapInstance = map;

                // Set initial view
                map.options({
                    featurescaling: "true",
                    objectscaling: "true",
                    normalSizeScale: "20000000",
                    dynamicScalePow: "2",
                    flushChartDraw: "1000000",
                    flushPaintShape: "1000000",
                    basemapopacity: "0.7",
                    worksilent: "false",
                    loadsilent: "false",
                    hideOnPan: "false",
                    freezeOnPan: "false",
                });

                // Set initial view
                map.view({
                    center: { lat: 20, lng: 0 },
                    zoom: 2
                });

            }).catch(error => {
                // Hide spinner on error
                hideMapLoadingSpinner();
                console.error('Error initializing map:', error);
            });
        }

        // ============================================
        // HTML MAP LOADER FUNCTIONS
        // ============================================

        /**
         * Parse JavaScript object string to actual object
         * Handles basic object syntax with strings, numbers, booleans, arrays
         */
        function parseObjectString(objStr, alreadyNormalized = false) {
            if (!objStr || typeof objStr !== 'string') {
                return null;
            }

            let cleaned = objStr;

            // Only normalize if not already normalized
            if (!alreadyNormalized) {
                // !!! Replace all linebreak characters with " " before parsing
                cleaned = objStr
                    .replace(/\r\n/g, ' ')  // Windows line breaks
                    .replace(/\n/g, ' ')    // Unix line breaks
                    .replace(/\r/g, ' ')     // Old Mac line breaks
                    .replace(/\t/g, ' ')     // Tabs
                    .replace(/\s+/g, ' ')    // Multiple spaces to single space
                    .trim();


            } else {

            }

            // Remove comments (be VERY careful with URLs)
            // Only remove /* */ style comments which are safer
            cleaned = cleaned
                .replace(/\/\*[\s\S]*?\*\//g, '')  // Only remove /* */ comments (safer)
                .trim();


            // Try to extract object/array content
            // The cleaned string should already be the object, but let's make sure
            let content = cleaned;

            // If it doesn't start with { or [, it might be wrapped
            if (!cleaned.trim().startsWith('{') && !cleaned.trim().startsWith('[')) {
                const objMatch = cleaned.match(/\{[\s\S]*\}/);
                const arrMatch = cleaned.match(/\[[\s\S]*\]/);

                if (objMatch) {
                    content = objMatch[0];

                } else if (arrMatch) {
                    content = arrMatch[0];

                } else {


                    return null;
                }
            } else {

            }

            // Convert to valid JSON by processing character by character
            let result = '';
            let j = 0;
            let inString2 = false;
            let stringChar2 = null;

            while (j < content.length) {
                const char = content[j];

                // Track string boundaries
                if ((char === '"' || char === "'") && (j === 0 || content[j - 1] !== '\\')) {
                    if (!inString2) {
                        inString2 = true;
                        stringChar2 = char;
                        result += '"'; // Normalize to double quotes
                    } else if (char === stringChar2) {
                        inString2 = false;
                        stringChar2 = null;
                        result += '"';
                    } else {
                        result += char;
                    }
                    j++;
                    continue;
                }

                if (inString2) {
                    // Inside a string - preserve everything, including escape sequences
                    // But we need to escape backslashes and quotes properly for JSON
                    if (char === '\\') {
                        // Check if this is an escape sequence
                        result += char;
                        j++;
                        if (j < content.length) {
                            result += content[j];
                            j++;
                        }
                        continue;
                    }
                    result += char;
                    j++;
                    continue;
                }

                // Quote unquoted keys (must be at start of object or after comma/brace)
                if (char.match(/[a-zA-Z_$]/) && (j === 0 || content[j - 1].match(/[{,:\s]/))) {
                    let keyEnd = j;
                    while (keyEnd < content.length && content[keyEnd].match(/[a-zA-Z0-9_$]/)) {
                        keyEnd++;
                    }
                    // Check if this is followed by a colon (making it a key)
                    if (keyEnd < content.length) {
                        // Skip whitespace after key
                        let colonPos = keyEnd;
                        while (colonPos < content.length && content[colonPos].match(/\s/)) {
                            colonPos++;
                        }
                        if (colonPos < content.length && content[colonPos] === ':') {
                            result += '"' + content.substring(j, keyEnd) + '":';
                            j = colonPos + 1;
                            continue;
                        }
                    }
                }

                result += char;
                j++;
            }

            // Final cleanup: handle unquoted string values
            // But be careful not to break URLs or complex strings or already-quoted strings
            // We need to avoid matching inside already-quoted strings
            let finalResult = '';
            let inString3 = false;
            let stringChar3 = null;
            let i3 = 0;

            while (i3 < result.length) {
                const char3 = result[i3];

                // Track string boundaries
                if ((char3 === '"' || char3 === "'") && (i3 === 0 || result[i3 - 1] !== '\\')) {
                    if (!inString3) {
                        inString3 = true;
                        stringChar3 = char3;
                    } else if (char3 === stringChar3) {
                        inString3 = false;
                        stringChar3 = null;
                    }
                    finalResult += char3;
                    i3++;
                    continue;
                }

                if (inString3) {
                    // Inside a string - preserve everything
                    finalResult += char3;
                    i3++;
                    continue;
                }

                // Outside strings - apply the replacement for unquoted values
                // But only if we're not inside a string
                const remaining = result.substring(i3);
                const match = remaining.match(/^:\s*([^",\[\]{}:,\s]+)(\s*[,}\]])/);
                if (match) {
                    const value = match[1].trim();
                    const suffix = match[2];
                    // Skip if already quoted or is a number/boolean/null
                    if (value.match(/^["']/) || value.match(/^-?\d+\.?\d*$/) ||
                        ['true', 'false', 'null'].includes(value)) {
                        finalResult += match[0];
                        i3 += match[0].length;
                        continue;
                    }
                    // Skip if it looks like part of a URL or path
                    if (value.includes('://') || value.includes('/') || value.includes('\\')) {
                        finalResult += match[0];
                        i3 += match[0].length;
                        continue;
                    }
                    // Quote the value
                    finalResult += ':"' + value.replace(/"/g, '\\"') + '"' + suffix;
                    i3 += match[0].length;
                    continue;
                }

                finalResult += char3;
                i3++;
            }

            result = finalResult;

            try {
                return JSON.parse(result);
            } catch (e) {

                // Fallback: try with Function constructor (less safe but more flexible)
                try {
                    // Check if this contains a query property with a function string
                    // The query property should already be a properly escaped JSON string
                    // The issue is that JSON.parse failed, likely because the string contains
                    // characters that need special handling

                    // Try to parse it as a JavaScript object literal directly
                    // This is safer than sanitizing, which might break the query string

                    // Use eval in a safer way - only if it looks like a valid object literal
                    if (cleaned.trim().startsWith('{') && cleaned.trim().endsWith('}')) {
                        try {
                            // Wrap in parentheses to ensure it's treated as an expression
                            const parsed = eval('(' + cleaned + ')');


                            // Verify the query property is preserved correctly
                            if (parsed.query && typeof parsed.query === 'string') {
                                if (!parsed.query.startsWith('query = function') && !parsed.query.startsWith('function query')) {
                                }
                            }

                            return parsed;
                        } catch (evalError) {

                            // Fall through to sanitization approach
                        }
                    }

                    // If direct eval failed, try sanitization (but preserve string values)
                    let sanitized = cleaned;

                    // Remove function expressions: function() { ... }
                    // But be careful - this regex matches inside strings too, which breaks things
                    // Instead, only remove if not inside a string
                    sanitized = sanitized.replace(/function\s*\([^)]*\)\s*\{[^}]*\}/g, 'null');

                    // Remove arrow functions: () => { ... }
                    sanitized = sanitized.replace(/\([^)]*\)\s*=>\s*\{[^}]*\}/g, 'null');
                    const func = new Function('return ' + sanitized);
                    const parsed = func();

                    return parsed;
                } catch (e2) {

                    // Last resort: try to manually construct object from key-value pairs
                    try {

                        const manual = parseObjectManually(cleaned);

                        return manual;
                    } catch (e3) {
                        return null;
                    }
                }
            }
        }

        /**
         * Manual object parser as last resort
         * Extracts key: value pairs from object string
         */
        function parseObjectManually(objStr) {
            const result = {};

            // Remove outer braces
            let content = objStr.trim();
            if (content.startsWith('{')) {
                content = content.substring(1);
            }
            if (content.endsWith('}')) {
                content = content.substring(0, content.length - 1);
            }

            // Split by commas, but respect strings and nested objects
            const pairs = [];
            let current = '';
            let depth = 0;
            let inString = false;
            let stringChar = null;

            for (let i = 0; i < content.length; i++) {
                const char = content[i];

                if ((char === '"' || char === "'") && (i === 0 || content[i - 1] !== '\\')) {
                    if (!inString) {
                        inString = true;
                        stringChar = char;
                    } else if (char === stringChar) {
                        inString = false;
                        stringChar = null;
                    }
                }

                if (!inString) {
                    if (char === '{' || char === '[') {
                        depth++;
                    } else if (char === '}' || char === ']') {
                        depth--;
                    } else if (char === ',' && depth === 0) {
                        pairs.push(current.trim());
                        current = '';
                        continue;
                    }
                }

                current += char;
            }

            if (current.trim()) {
                pairs.push(current.trim());
            }

            // Parse each key: value pair
            for (const pair of pairs) {
                const colonIndex = pair.indexOf(':');
                if (colonIndex === -1) continue;

                let key = pair.substring(0, colonIndex).trim();
                let value = pair.substring(colonIndex + 1).trim();

                // Remove quotes from key
                key = key.replace(/^["']|["']$/g, '');

                // Parse value
                if (value.startsWith('"') && value.endsWith('"')) {
                    result[key] = value.substring(1, value.length - 1);
                } else if (value.startsWith("'") && value.endsWith("'")) {
                    result[key] = value.substring(1, value.length - 1);
                } else if (value === 'true') {
                    result[key] = true;
                } else if (value === 'false') {
                    result[key] = false;
                } else if (value === 'null') {
                    result[key] = null;
                } else if (/^-?\d+\.?\d*$/.test(value)) {
                    result[key] = parseFloat(value);
                } else if (value.startsWith('[') && value.endsWith(']')) {
                    // Array - simple parsing
                    try {
                        result[key] = JSON.parse(value);
                    } catch (e) {
                        result[key] = value; // Keep as string if parsing fails
                    }
                } else {
                    result[key] = value; // Keep as string
                }
            }

            return result;
        }

        /**
         * Extract script content from HTML
         */
        function extractScripts(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const scripts = Array.from(doc.querySelectorAll('script'));
            const scriptContent = scripts.map(s => s.textContent).join('\n');
            return scriptContent;
        }

        /**
         * Find matching brace position in string
         */
        function findMatchingBrace(str, startPos) {
            let depth = 0;
            let inString = false;
            let stringChar = null;
            let i = startPos;

            while (i < str.length) {
                const char = str[i];

                // Track string boundaries
                if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== '\\')) {
                    if (!inString) {
                        inString = true;
                        stringChar = char;
                    } else if (char === stringChar) {
                        inString = false;
                        stringChar = null;
                    }
                }

                if (!inString) {
                    if (char === '{') {
                        depth++;
                    } else if (char === '}') {
                        depth--;
                        if (depth === 0) {
                            return i;
                        }
                    }
                }

                i++;
            }

            return -1; // Not found
        }

        /**
         * Parse ixmaps.embed or ixmaps.Map configuration
         */
        function parseEmbedConfig(scriptContent) {
            // Find all ixmaps.embed or ixmaps.Map calls
            // Pattern 1: ixmaps.embed("div-id", { ... })
            // Pattern 2: ixmaps.Map("div-id", { ... })
            const embedPattern = /ixmaps\.(?:embed|Map)\s*\(\s*["']([^"']+)["']\s*,\s*\{/g;

            const matches = [];
            let match;
            while ((match = embedPattern.exec(scriptContent)) !== null) {
                const apiType = match[0].includes('Map') ? 'Map' : 'embed';
                const containerId = match[1]; // Extract container ID from regex match
                const braceStart = match.index + match[0].length - 1; // Position of opening {

                // Find matching closing brace
                const braceEnd = findMatchingBrace(scriptContent, braceStart);

                if (braceEnd === -1) {

                    continue;
                }

                // Extract the object string
                const configStr = scriptContent.substring(braceStart, braceEnd + 1);

                try {
                    const config = parseObjectString(configStr);
                    if (config) {
                        matches.push({ containerId, config, apiType });

                    }
                } catch (e) {
                }
            }

            if (matches.length === 0) {

            }

            return matches;
        }

        /**
         * Extract method call with balanced parentheses
         * @param {string} scriptContent - The script content to search in
         * @param {number} startPos - Starting position to search from
         * @param {string} methodName - Name of the method to find
         * @param {number} endPos - Optional end position to limit search
         */
        function extractMethodCall(scriptContent, startPos, methodName, endPos = null) {
            const searchEnd = endPos !== null ? Math.min(endPos, scriptContent.length) : scriptContent.length;
            const searchContent = scriptContent.substring(startPos, searchEnd);

            const methodPattern = new RegExp(`\\.${methodName}\\s*\\(`, 'g');
            const match = methodPattern.exec(searchContent);

            if (!match) {
                return null;
            }

            // Adjust positions relative to full scriptContent
            const methodStart = startPos + match.index;
            const parenStart = methodStart + match[0].length - 1;

            // Find matching closing parenthesis
            // We need to track depth for both () and {} since objects can be nested
            let parenDepth = 0;
            let braceDepth = 0;
            let inString = false;
            let stringChar = null;
            let i = parenStart;

            while (i < searchEnd) {
                const char = scriptContent[i];

                // Track string boundaries
                if ((char === '"' || char === "'") && (i === 0 || scriptContent[i - 1] !== '\\')) {
                    if (!inString) {
                        inString = true;
                        stringChar = char;
                    } else if (char === stringChar) {
                        inString = false;
                        stringChar = null;
                    }
                }

                if (!inString) {
                    if (char === '(') {
                        parenDepth++;
                    } else if (char === ')') {
                        parenDepth--;
                        // Only return if we're back to the original depth (the opening paren of this method)
                        // and we're not inside any braces (objects)
                        if (parenDepth === 0 && braceDepth === 0) {
                            const content = scriptContent.substring(parenStart + 1, i).trim();
                            return {
                                start: parenStart,
                                end: i + 1,
                                content: content
                            };
                        }
                    } else if (char === '{') {
                        braceDepth++;
                    } else if (char === '}') {
                        braceDepth--;
                    }
                }

                i++;
            }

            return null;
        }

        /**
         * Parse ixmaps.layer chain definitions
         * Handles multiple patterns:
         * 1. ixmaps.layer("name").data({...}).binding({...}).style({...})
         * 2. ixmaps.layer("name", layer => layer.data({...}).type("...").style({...}))
         * 3. ixmaps.Layer("name").data({...}).style({...}).json()
         * @param {string} scriptContent - The script content to parse
         * @param {string} queryFunction - Optional query function string to replace query.toString() references
         */
        function parseLayerChains(scriptContent, queryFunction = null) {
            const layers = [];




            // First, let's see if we can find any layer patterns at all
            const testPattern = /ixmaps\.(?:layer|Layer)/gi;
            const allMatches = scriptContent.match(testPattern);

            if (allMatches) {

            }

            // Also check for .layer(ixmaps.layer pattern
            const layerCallPattern = /\.layer\s*\(\s*ixmaps\.(?:layer|Layer)/gi;
            const layerCallMatches = scriptContent.match(layerCallPattern);


            // Pattern 1: ixmaps.layer("name") or ixmaps.Layer("name")
            // Make pattern more flexible to handle whitespace variations
            // Also handle cases where it's inside .layer(ixmaps.layer(...))
            const layerStartPattern = /ixmaps\.(?:layer|Layer)\s*\(\s*["']([^"']+)["']/g;

            let match;
            let matchCount = 0;
            while ((match = layerStartPattern.exec(scriptContent)) !== null) {
                matchCount++;
                let layerName = null; // Declare outside try block for catch block access
                try {
                    layerName = match[1] || 'unknown';
                    const startPos = match.index + match[0].length;

                    const layer = {
                        name: layerName,
                        data: null,
                        binding: null,
                        style: null,
                        meta: null,
                        type: null,
                        filter: null,
                        usesJson: false  // Track if layer uses .json() instead of .define()
                    };

                    // Find the end of the layer definition (closing parenthesis or bracket)
                    let currentPos = startPos;

                    // Find the end of this layer definition to limit search scope
                    // First, check if there's a .json() method which indicates the end of the layer
                    let jsonMatch = null;
                    let jsonPosition = null;  // Position where .json() starts
                    let jsonEndPos = null;   // Position after .json()) closes the .layer() call

                    // First, find the next .layer( call to limit our search
                    const nextLayerMatch = scriptContent.substring(currentPos).match(/\.layer\s*\(/);
                    const searchLimit = nextLayerMatch ? (currentPos + nextLayerMatch.index) : Math.min(currentPos + 2000, scriptContent.length);

                    // Search for .json() method first - it marks the end of the layer
                    // But only search up to the next .layer( call
                    const jsonPattern = /\.json\s*\(\s*\)/g;
                    // Reset regex lastIndex to start from currentPos
                    jsonPattern.lastIndex = currentPos;
                    while ((jsonMatch = jsonPattern.exec(scriptContent)) !== null) {
                        if (jsonMatch.index >= currentPos && jsonMatch.index < searchLimit) {
                            // Found .json() - save its position
                            jsonPosition = jsonMatch.index;
                            layer.usesJson = true;

                            // Find the closing paren after .json() - this closes the .layer() call
                            let jsonEnd = jsonMatch.index + jsonMatch[0].length;
                            let parenDepth = 0;
                            let inString = false;
                            let stringChar = null;

                            for (let i = jsonEnd; i < Math.min(jsonEnd + 200, searchLimit); i++) {
                                const char = scriptContent[i];

                                if ((char === '"' || char === "'") && (i === 0 || scriptContent[i - 1] !== '\\')) {
                                    if (!inString) {
                                        inString = true;
                                        stringChar = char;
                                    } else if (char === stringChar) {
                                        inString = false;
                                        stringChar = null;
                                    }
                                }

                                if (!inString) {
                                    if (char === '(' || char === '{') {
                                        parenDepth++;
                                    } else if (char === ')' || char === '}') {
                                        parenDepth--;
                                        // When we find a closing paren at depth 0, this closes the .layer() call
                                        if (parenDepth === 0 && char === ')') {
                                            jsonEndPos = i + 1;
                                            break;
                                            // Verify the next thing is .layer( or end
                                            const nextChars = scriptContent.substring(i + 1, i + 10).trim();

                                            break;
                                        }
                                    }
                                }
                                if (jsonEndPos) break;
                            }
                            if (jsonEndPos) break;
                        } else if (jsonMatch.index >= searchLimit) {
                            // We've gone past the search limit, stop searching
                            break;
                        }
                    }

                    let layerEndPos = currentPos;

                    if (jsonEndPos) {
                        // Layer ends after .json())
                        layerEndPos = jsonEndPos;
                    } else {
                        // No .json() found, use the original logic to find the end
                        // We need to find the closing paren of the Layer() call
                        // Start from currentPos which is after the callback start
                        // We need to track paren depth, but we start at depth 1 (inside Layer())
                        let parenDepth = 1; // We're already inside Layer(, so start at 1
                        let inString = false;
                        let stringChar = null;
                        let foundLayerEnd = false;

                        // Search forward to find where this layer definition ends
                        // We need to find the closing paren that matches the opening paren of Layer(
                        for (let i = currentPos; i < Math.min(currentPos + 5000, scriptContent.length); i++) {
                            const char = scriptContent[i];

                            if ((char === '"' || char === "'") && (i === 0 || scriptContent[i - 1] !== '\\')) {
                                if (!inString) {
                                    inString = true;
                                    stringChar = char;
                                } else if (char === stringChar) {
                                    inString = false;
                                    stringChar = null;
                                }
                            }

                            if (!inString) {
                                if (char === '(') {
                                    parenDepth++;
                                } else if (char === ')') {
                                    parenDepth--;
                                    // If we're back to depth 0, this closes the Layer() call
                                    if (parenDepth === 0) {
                                        // Check if this is followed by .layer( or end of chain or assignment
                                        const nextChars = scriptContent.substring(i + 1, i + 20).trim();
                                        // Accept if followed by .layer(, ), semicolon, comma, or end of line
                                        if (nextChars.startsWith('.layer(') ||
                                            nextChars.startsWith(')') ||
                                            nextChars.startsWith(';') ||
                                            nextChars.startsWith(',') ||
                                            nextChars === '' ||
                                            nextChars.match(/^\s*[=;,\n]/)) {
                                            layerEndPos = i + 1;
                                            foundLayerEnd = true;

                                            break;
                                        }
                                    }
                                } else if (char === '{') {
                                    // Track braces but don't affect paren depth
                                } else if (char === '}') {
                                    // Track braces but don't affect paren depth
                                }
                            }
                        }

                        if (!foundLayerEnd) {
                            // Fallback: search for next .layer( call
                            const nextLayerMatch = scriptContent.substring(currentPos).match(/\.layer\s*\(/);
                            if (nextLayerMatch) {
                                layerEndPos = currentPos + nextLayerMatch.index;
                            } else {
                                layerEndPos = Math.min(currentPos + 2000, scriptContent.length);
                            }
                        }
                    }

                    // Extract methods in order, but only within this layer's scope
                    const methods = ['data', 'filter', 'binding', 'type', 'style', 'meta'];

                    // CRITICAL: If .json() was found, methods should ONLY be searched BEFORE .json(), not after
                    // jsonPosition is the position where .json() starts - we must stop BEFORE it
                    const methodsSearchEnd = jsonPosition !== null ? jsonPosition : layerEndPos;




                    // Track the last position where we found a method, so we can search for the next one after it
                    let lastMethodEnd = currentPos;

                    for (const method of methods) {
                        // Only search within this layer's scope - STRICT boundary check
                        // If .json() exists, don't search beyond it
                        const searchEnd = Math.min(methodsSearchEnd, scriptContent.length);
                        // Search from the last method end position, not from currentPos
                        // This ensures we find methods in order
                        const methodCall = extractMethodCall(scriptContent, lastMethodEnd, method, searchEnd);

                        // CRITICAL: Only accept method if it's completely within this layer's boundaries
                        // Both start and end must be within searchEnd
                        // If .json() exists, the method MUST be before jsonPosition
                        if (methodCall && methodCall.start >= lastMethodEnd && methodCall.end <= searchEnd) {
                            // Additional check: if .json() exists, method must be BEFORE it
                            if (jsonPosition !== null && methodCall.start >= jsonPosition) {
                                continue;
                            }

                            // Update lastMethodEnd to continue searching after this method
                            lastMethodEnd = methodCall.end;

                            if (method === 'type' || method === 'filter') {
                                // These are string parameters, not objects
                                let content = methodCall.content.trim();
                                if (content.startsWith('"') && content.endsWith('"')) {
                                    content = content.substring(1, content.length - 1);
                                    content = content.replace(/\\"/g, '"');
                                    content = content.replace(/\\\\/g, '\\');
                                } else if (content.startsWith("'") && content.endsWith("'")) {
                                    content = content.substring(1, content.length - 1);
                                    content = content.replace(/\\'/g, "'");
                                    content = content.replace(/\\\\/g, '\\');
                                }
                                layer[method] = content;
                            } else {
                                // Object parameters
                                // !!! Normalize linebreaks and whitespace BEFORE parsing
                                // BUT: Be careful with long strings (like query functions)
                                // We need to preserve strings correctly, so normalize carefully
                                let content = methodCall.content;

                                // If this is data method, check for any function.toString() patterns and replace them FIRST
                                // This must happen BEFORE normalization to ensure patterns match correctly
                                if (method === 'data') {
                                    // Pattern to match: query: functionName.toString() or query:functionName.toString()
                                    // Capture the function name - use more flexible pattern to handle whitespace
                                    const toStringPattern = /query\s*:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\.\s*toString\s*\(\s*\)/g;
                                    let match;
                                    const matches = [];
                                    // First, collect all matches (reset regex lastIndex)
                                    toStringPattern.lastIndex = 0;
                                    while ((match = toStringPattern.exec(content)) !== null) {
                                        matches.push({
                                            index: match.index,
                                            fullMatch: match[0],
                                            functionName: match[1]
                                        });
                                    }
                                    // Process matches in reverse order to preserve indices
                                    for (let i = matches.length - 1; i >= 0; i--) {
                                        const m = matches[i];
                                        const functionName = m.functionName;
                                        // Extract the function from scriptContent (available as parameter)
                                        const extractedFunction = extractFunctionByName(scriptContent, functionName);
                                        if (extractedFunction) {
                                            // Replace the functionName.toString() with the actual function string (quoted)
                                            const functionEscaped = JSON.stringify(extractedFunction);
                                            content = content.substring(0, m.index) + 
                                                     `query: ${functionEscaped}` + 
                                                     content.substring(m.index + m.fullMatch.length);
                                        }
                                    }
                                    
                                    // Also handle the old pattern with explicit query function parameter
                                    if (typeof queryFunction !== 'undefined' && queryFunction) {
                                        const queryFunctionEscaped = JSON.stringify(queryFunction);
                                        const replacementPattern = /query\s*:\s*query\s*\.\s*toString\s*\(\s*\)/g;
                                        if (replacementPattern.test(content)) {
                                            content = content.replace(replacementPattern, `query: ${queryFunctionEscaped}`);
                                        }
                                    }
                                }

                                // Check if content might contain a query function (very long string)
                                // If so, be more careful with normalization
                                const mightHaveQuery = content.includes('query:') || content.includes('query :');

                                if (mightHaveQuery) {
                                    // Normalize whitespace but preserve string content
                                    // Only normalize whitespace OUTSIDE of strings
                                    let normalized = '';
                                    let inString = false;
                                    let stringChar = null;
                                    let i = 0;

                                    while (i < content.length) {
                                        const char = content[i];

                                        // Track string boundaries
                                        if ((char === '"' || char === "'") && (i === 0 || content[i - 1] !== '\\')) {
                                            if (!inString) {
                                                inString = true;
                                                stringChar = char;
                                            } else if (char === stringChar) {
                                                inString = false;
                                                stringChar = null;
                                            }
                                            normalized += char;
                                        } else if (inString) {
                                            // Inside string: preserve everything including whitespace
                                            normalized += char;
                                        } else {
                                            // Outside string: normalize whitespace
                                            if (char === '\r' || char === '\n' || char === '\t') {
                                                normalized += ' ';
                                            } else if (char.match(/\s/)) {
                                                // Multiple spaces: replace with single space
                                                if (normalized.length === 0 || normalized[normalized.length - 1] !== ' ') {
                                                    normalized += ' ';
                                                }
                                            } else {
                                                normalized += char;
                                            }
                                        }
                                        i++;
                                    }

                                    content = normalized.trim();
                                } else {
                                    // Normal case: aggressive normalization
                                    content = content
                                        .replace(/\r\n/g, ' ')  // Windows line breaks
                                        .replace(/\n/g, ' ')    // Unix line breaks
                                        .replace(/\r/g, ' ')     // Old Mac line breaks
                                        .replace(/\t/g, ' ')     // Tabs
                                        .replace(/\s+/g, ' ')    // Multiple spaces to single space
                                        .trim();
                                }

                                // Try to parse as object (pass true to indicate it's already normalized)
                                const parsed = parseObjectString(content, true);
                                if (parsed) {
                                    layer[method] = parsed;
                                } else {
                                    console.warn(`    ⚠️ Failed to parse ${method} content`);
                                }
                            }
                        }
                    }

                    // Only add if we have at least data
                    if (layer.data) {
                        layers.push(layer);
                    } else {
                        console.warn(`  ⚠️ Skipping layer ${layerName}: no data found`);
                    }
                } catch (e) {
                    console.error(`  ❌ Error processing layer ${layerName || 'unknown'}:`, e);
                }
            }

            return layers;
        }

        /**
         * Parse map.layer() theme definitions
         */
        function parseLayerCalls(scriptContent) {
            const themes = [];
            const layerCallPattern = /\.layer\s*\(\s*(\{[\s\S]*?\})\s*\)/g;

            let match;
            while ((match = layerCallPattern.exec(scriptContent)) !== null) {
                try {
                    let braceCount = 0;
                    let start = match.index + match[0].indexOf('{');
                    let end = start;

                    for (let i = start; i < scriptContent.length; i++) {
                        if (scriptContent[i] === '{' && (i === 0 || scriptContent[i - 1] !== '\\')) {
                            braceCount++;
                        } else if (scriptContent[i] === '}' && (i === 0 || scriptContent[i - 1] !== '\\')) {
                            braceCount--;
                            if (braceCount === 0) {
                                end = i + 1;
                                break;
                            }
                        }
                    }

                    const objStr = scriptContent.substring(start, end);
                    const layerObj = parseObjectString(objStr);

                    if (layerObj && (layerObj.layer || layerObj.data)) {
                        themes.push(layerObj);
                    }
                } catch (e) {

                }
            }

            return themes;
        }

        /**
         * Parse map.view() settings
         */
        function parseViewSettings(scriptContent) {
            let view = null;
            const viewPattern1 = /\.view\s*\(\s*(\{[\s\S]*?\})\s*\)/;
            const match1 = scriptContent.match(viewPattern1);

            if (match1) {
                try {
                    const viewObj = parseObjectString(match1[1]);
                    if (viewObj) {
                        if (viewObj.center && viewObj.zoom !== undefined) {
                            view = viewObj;
                        } else if (viewObj.lat !== undefined && viewObj.lng !== undefined && viewObj.zoom !== undefined) {
                            view = {
                                center: { lat: viewObj.lat, lng: viewObj.lng },
                                zoom: viewObj.zoom
                            };
                        }
                    }
                } catch (e) {

                }
            }

            if (!view) {
                const viewPattern2 = /\.view\s*\(\s*\[([\d.]+),\s*([\d.]+)\]\s*,\s*([\d.]+)\s*\)/;
                const match2 = scriptContent.match(viewPattern2);

                if (match2) {
                    view = {
                        center: {
                            lat: parseFloat(match2[1]),
                            lng: parseFloat(match2[2])
                        },
                        zoom: parseFloat(match2[3])
                    };
                }
            }

            return view;
        }

        /**
         * Parse map.options() settings
         */
        function parseMapOptions(scriptContent) {
            const optionsPattern = /\.options\s*\(\s*(\{[\s\S]*?\})\s*\)/;
            const match = scriptContent.match(optionsPattern);

            if (match) {
                return parseObjectString(match[1]);
            }

            return null;
        }

        /**
         * Load HTML page and extract map configuration
         */
        async function loadHTMLPage(url) {
            try {
                if (!url || (typeof url !== 'string')) {
                    throw new Error('Invalid URL provided');
                }

                // Resolve relative URLs properly
                let resolvedUrl = url;
                if (!url.match(/^https?:\/\//) && !url.match(/^\/\//)) {
                    // Relative URL - resolve it relative to current page
                    try {
                        resolvedUrl = new URL(url, window.location.href).toString();
                    } catch (e) {
                        // If URL resolution fails, try prepending https:// as fallback
                        resolvedUrl = 'https://' + url;
                    }
                }

                const response = await fetch(resolvedUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const html = await response.text();

                if (!html || html.length === 0) {
                    throw new Error('Empty HTML content received');
                }

                return html;
            } catch (error) {
                if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
                    throw new Error(`CORS error: Cannot load ${url}. The server may not allow cross-origin requests. Try loading the file locally instead.`);
                }
                throw new Error(`Failed to load HTML from ${url}: ${error.message}`);
            }
        }

        /**
         * Extract query function definition from script content
         * Looks for patterns like: query = function(...) { ... } or function query(...) { ... }
         * Uses brace balancing to handle nested functions correctly
         */
        function extractQueryFunction(scriptContent) {


            // Find the start of the query function
            // Pattern 1: query = function(themeObj, options) { (with optional var/let/const)
            // More flexible pattern that handles spaces and newlines
            const startPattern1 = /(?:^|[\s;])(?:var\s+|let\s+|const\s+)?query\s*=\s*function\s*\([^)]*\)\s*\{/m;
            // Pattern 2: function query(themeObj, options) {
            const startPattern2 = /(?:^|[\s;])function\s+query\s*\([^)]*\)\s*\{/m;

            let startMatch = scriptContent.match(startPattern1) || scriptContent.match(startPattern2);
            if (!startMatch) {

                // Try a more permissive search
                const permissivePattern = /query\s*=\s*function\s*\(/;
                const permissiveMatch = scriptContent.match(permissivePattern);
                if (permissiveMatch) {



                }
                return null;
            }

            // Verify the match is correct
            const matchedText = startMatch[0];
            const matchIndex = startMatch.index;

            const startPos = matchIndex + matchedText.length - 1; // Position of opening {

            // Use brace balancing to find the matching closing brace
            // startPos points to the opening '{' of the function body
            let braceDepth = 1; // We're already inside the function body (the opening brace)
            let inString = false;
            let stringChar = null;
            let i = startPos + 1; // Start after the opening brace

            while (i < scriptContent.length) {
                const char = scriptContent[i];

                // Track string boundaries
                if ((char === '"' || char === "'") && (i === 0 || scriptContent[i - 1] !== '\\')) {
                    if (!inString) {
                        inString = true;
                        stringChar = char;
                    } else if (char === stringChar) {
                        inString = false;
                        stringChar = null;
                    }
                }

                if (!inString) {
                    if (char === '{') {
                        braceDepth++;
                    } else if (char === '}') {
                        braceDepth--;
                        if (braceDepth === 0) {
                            // Found the matching closing brace
                            const endPos = i + 1;
                            let queryFunction = scriptContent.substring(matchIndex, endPos).trim();

                            // Verify the function starts correctly
                            const trimmedFunction = queryFunction.trim();
                            if (!trimmedFunction.startsWith('query') && !trimmedFunction.startsWith('function query')) {



                                // Try to find where "query" actually starts in the extracted string
                                const queryPos = queryFunction.indexOf('query');
                                if (queryPos > 0) {
                                    // Try to extract from the actual "query" position
                                    const correctedStart = matchIndex + queryPos;
                                    const correctedFunction = scriptContent.substring(correctedStart, endPos).trim();
                                    if (correctedFunction.startsWith('query')) {

                                        queryFunction = correctedFunction;
                                    }
                                }

                                // Try to find the actual start in script content (before matchIndex)
                                if (!queryFunction.startsWith('query')) {
                                    const actualStart = scriptContent.lastIndexOf('query', matchIndex);
                                    if (actualStart >= 0 && actualStart < matchIndex) {


                                        // Try extracting from this position
                                        const altFunction = scriptContent.substring(actualStart, endPos).trim();
                                        if (altFunction.startsWith('query = function') || altFunction.startsWith('function query')) {

                                            queryFunction = altFunction;
                                        }
                                    }
                                }

                                // Final check - if still not valid, return null
                                if (!queryFunction.trim().startsWith('query') && !queryFunction.trim().startsWith('function query')) {

                                    return null;
                                }
                            }



                            return queryFunction;
                        }
                    }
                }

                i++;
            }


            return null;
        }

        /**
         * Extract a function definition by name from script content
         * @param {string} scriptContent - The script content to search in
         * @param {string} functionName - The name of the function to extract
         * @returns {string|null} The function definition string, or null if not found
         */
        function extractFunctionByName(scriptContent, functionName) {
            // Pattern 1: function functionName(...) {
            const pattern1 = new RegExp(`(?:^|[\\s;])function\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{`, 'm');
            // Pattern 2: var/let/const functionName = function(...) {
            const pattern2 = new RegExp(`(?:^|[\\s;])(?:var\\s+|let\\s+|const\\s+)?${functionName}\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{`, 'm');

            let startMatch = scriptContent.match(pattern1) || scriptContent.match(pattern2);
            if (!startMatch) {
                return null;
            }

            const matchIndex = startMatch.index;
            const matchedText = startMatch[0];
            const startPos = matchIndex + matchedText.length - 1; // Position of opening {

            // Use brace balancing to find the matching closing brace
            let braceDepth = 1;
            let inString = false;
            let stringChar = null;
            let i = startPos + 1;

            while (i < scriptContent.length) {
                const char = scriptContent[i];

                // Track string boundaries
                if ((char === '"' || char === "'") && (i === 0 || scriptContent[i - 1] !== '\\')) {
                    if (!inString) {
                        inString = true;
                        stringChar = char;
                    } else if (char === stringChar) {
                        inString = false;
                        stringChar = null;
                    }
                }

                if (!inString) {
                    if (char === '{') {
                        braceDepth++;
                    } else if (char === '}') {
                        braceDepth--;
                        if (braceDepth === 0) {
                            const endPos = i + 1;
                            return scriptContent.substring(matchIndex, endPos).trim();
                        }
                    }
                }

                i++;
            }

            return null;
        }

        /**
         * Process HTML content and extract map configuration
         */
        function processHTMLContent(html) {
            const scriptContent = extractScripts(html);

            // Extract query function if it exists
            const queryFunction = extractQueryFunction(scriptContent);

            const embedConfigs = parseEmbedConfig(scriptContent);
            if (embedConfigs.length === 0) {
                throw new Error('No ixmaps.embed or ixmaps.Map found in HTML');
            }

            const embedConfig = embedConfigs[0];

            // Prepare query function for use (strip newlines if found)
            let queryFunctionStripped = null;
            if (queryFunction) {
                // Strip newlines from query function for use in theme object
                // But preserve essential structure - only normalize whitespace, don't break syntax
                queryFunctionStripped = queryFunction
                    .replace(/\r\n/g, ' ')  // Windows line breaks
                    .replace(/\n/g, ' ')     // Unix line breaks
                    .replace(/\r/g, ' ')     // Old Mac line breaks
                    .replace(/\t/g, ' ')     // Tabs
                    .replace(/\s{2,}/g, ' ') // Multiple spaces to single space
                    .trim();

                // Validate that the stripped function is still valid (has balanced braces)
                let openBraces = (queryFunctionStripped.match(/\{/g) || []).length;
                let closeBraces = (queryFunctionStripped.match(/\}/g) || []).length;
                if (openBraces !== closeBraces) {



                    queryFunctionStripped = queryFunction; // Fallback to original
                }

            }

            // Parse layers with query function replacement
            const layers = parseLayerChains(scriptContent, queryFunctionStripped);
            const themes = parseLayerCalls(scriptContent);
            const view = parseViewSettings(scriptContent);
            const options = parseMapOptions(scriptContent);

            // Post-process layers to ensure query strings don't have newlines
            if (queryFunctionStripped) {
                layers.forEach((layer, idx) => {
                    if (layer.data && layer.data.query) {
                        // If query is a string and has newlines, strip them
                        if (typeof layer.data.query === 'string') {
                            const hasNewlines = layer.data.query.includes('\n') || layer.data.query.includes('\r');
                            if (hasNewlines) {

                                layer.data.query = layer.data.query.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();
                            }
                        }
                    }
                });
            }

            return {
                layers,
                themes,
                view,
                options,
                embed: embedConfig ? embedConfig.config : null
            };
        }

        async function applyMapConfig(map, config, clearExisting = false) {
            let layersAdded = 0;
            let layersSkipped = [];
            let layersFailed = [];

            for (let idx = 0; idx < config.layers.length; idx++) {
                const layerDef = config.layers[idx];
                try {
                    if (!layerDef.data) {
                        layersSkipped.push({ name: layerDef.name || 'unknown', reason: 'no data' });
                        continue;
                    }

                    // Use ixmaps.Layer if available (capital L), otherwise ixmaps.layer
                    const LayerConstructor = ixmaps.Layer || ixmaps.layer;

                    // Ensure layer name is defined
                    const layerName = layerDef.name || `layer_${idx}`;
                    let layer = LayerConstructor(layerName);


                    if (layerDef.data) {
                        // Check if data has query property (function as string)
                        if (layerDef.data.query) {
                            if (layerDef.data.query.length > 500) {
                            }
                            layer = layer.data(layerDef.data);
                        }
                        if (layerDef.filter) {
                            layer = layer.filter(layerDef.filter);
                        }
                        // Only add binding if it exists - don't invent one!
                        if (layerDef.binding && layerDef.binding !== null) {
                            layer = layer.binding(layerDef.binding);
                        } else {

                        }
                        if (layerDef.type) {
                            layer = layer.type(layerDef.type);
                        }
                        if (layerDef.style) {
                            layer = layer.style(layerDef.style);
                        }
                        if (layerDef.meta) {
                            layer = layer.meta(layerDef.meta);
                        }

                        // Check if .json() or .define() should be called

                        try {
                            let themeObject = null;

                            // Check if layer definition indicates it uses .json()
                            if (layerDef.usesJson && layer.json && typeof layer.json === 'function') {

                                themeObject = layer.json();

                                map.layer(themeObject);

                            } else if (layer.json && typeof layer.json === 'function') {

                                themeObject = layer.json();

                                map.layer(themeObject);

                            } else if (layer.define && typeof layer.define === 'function') {

                                themeObject = layer.define();

                                map.layer(themeObject);

                            } else {

                                themeObject = layer;

                                map.layer(themeObject);

                            }
                            layersAdded++;
                        } catch (e) {

                            layersFailed.push({ name: layerDef.name || `layer_${idx}`, error: e.message, layerDef });
                            throw e;
                        }
                    }
                } catch (e) {

                    layersFailed.push({ name: layerDef.name, error: e.message, layerDef });
                }
            }








            let themesAdded = 0;
            let themesFailed = [];




            for (let idx = 0; idx < config.themes.length; idx++) {
                const themeDef = config.themes[idx];
                try {

                    map.layer(themeDef);

                    themesAdded++;
                } catch (e) {

                    themesFailed.push({ index: idx + 1, error: e.message, themeDef });
                }
            }







            if (config.view) {
                try {
                    map.view(config.view);
                } catch (e) {

                }
            }

            // Log final map project
            try {
                if (typeof ixmaps.getProjectString === 'function') {
                    const projectString = ixmaps.getProjectString();
                    if (projectString) {
                        const project = JSON.parse(projectString);

                    }
                }
            } catch (e) {
                // Could not get project - silent
            }

            return {
                map,
                layersAdded,
                themesAdded
            };
        }

        /**
         * Load map from HTML URL
         */
        async function loadMapFromHTML(url, clearExisting = false) {
            // Use the same approach as file loading: load URL into iframe and read project JSON
            return new Promise((resolve, reject) => {
                const iframe = document.getElementById('map-loader-frame');
                if (!iframe) {
                    reject(new Error('Map loader frame not found'));
                    return;
                }

                // Resolve relative URLs properly
                let resolvedUrl = url;
                try {
                    if (!url.match(/^https?:\/\//) && !url.match(/^\/\//)) {
                        resolvedUrl = new URL(url, window.location.href).toString();
                    }
                } catch (e) {
                    console.warn('Could not resolve URL:', url, e);
                }

                // Set timeout
                const timeoutId = setTimeout(() => {
                    reject(new Error('Timeout loading map from URL'));
                }, 15000); // 15s timeout for URL loading

                // Cleanup function
                const cleanup = () => {
                    clearTimeout(timeoutId);
                    iframe.onload = null;
                    iframe.onerror = null;
                };

                // Fallback to text parsing if iframe method fails
                const fallbackToTextParsing = async () => {
                    try {
                        console.log('🔄 [Load Map from HTML] Falling back to text parsing...');
                        const html = await loadHTMLPage(resolvedUrl);
                        const config = processHTMLContent(html);

                        if (!mapInstance) {
                            reject(new Error('Map instance not initialized'));
                            return;
                        }

                        const result = await applyMapConfig(mapInstance, config, clearExisting);

                        resolve({
                            success: true,
                            config: config,
                            layersAdded: result.layersAdded,
                            themesAdded: result.themesAdded
                        });
                    } catch (error) {
                        reject(new Error(`Failed to load map: ${error.message}`));
                    }
                };
                
                iframe.onload = () => {
                    try {
                        const win = iframe.contentWindow;

                        if (!win) {
                            cleanup();
                            // CORS blocked - fall back to text parsing
                            fallbackToTextParsing();
                            return;
                        }

                        // Check for ixmaps in iframe
                        // We need to wait for ixmaps.getProjectString to be available
                        // It might take a moment after load for scripts to initialize

                        let attempts = 0;
                        const checkInterval = setInterval(() => {
                            attempts++;

                            try {
                                // Try to access win.ixmaps - this will throw SecurityError if CORS blocks it
                                if (win.ixmaps && typeof win.ixmaps.getProjectString === 'function') {
                                    clearInterval(checkInterval);
                                    cleanup();
                                    try {
                                        setTimeout(() => {
                                            console.log('📥 [Load Map from HTML] Getting project JSON from hidden frame...');
                                            const projectString = win.ixmaps.getProjectString();
                                            if (projectString) {
                                                console.log('✅ [Load Map from HTML] Project string retrieved, length:', projectString.length);
                                                console.log('📋 [Load Map from HTML] Project string preview:', projectString.substring(0, 200) + '...');
                                                
                                                // Parse to verify validity
                                                let project;
                                                try {
                                                    project = JSON.parse(projectString);
                                                    console.log('✅ [Load Map from HTML] Project JSON parsed successfully');
                                                    console.log('📊 [Load Map from HTML] Complete project JSON:', JSON.stringify(project, null, 2));
                                                    console.log('📊 [Load Map from HTML] Project keys:', Object.keys(project));
                                                    if (project.themes) {
                                                        console.log('🎨 [Load Map from HTML] Number of themes:', project.themes.length);
                                                    }
                                                    if (project.map) {
                                                        console.log('🗺️ [Load Map from HTML] Map configuration:', {
                                                            mapService: project.map.mapService,
                                                            mapType: project.map.mapType,
                                                            map: project.map.map,
                                                            mapProjection: project.map.mapProjection,
                                                            center: project.map.center,
                                                            zoom: project.map.zoom
                                                        });
                                                    }
                                                } catch (e) {
                                                    console.error('❌ [Load Map from HTML] Error parsing project JSON:', e);
                                                    throw new Error("Invalid project string returned");
                                                }

                                                // Ensure project.map.map has ../../ prefix if not already present
                                                if (project.map && project.map.map) {
                                                    if (!project.map.map.startsWith('../../') && !project.map.map.startsWith('http://') && !project.map.map.startsWith('https://') && !project.map.map.startsWith('//')) {
                                                        project.map.map = '../../' + project.map.map;
                                                        console.log('🔧 [Load Map from HTML] Adjusted SVG path to:', project.map.map);
                                                    }
                                                }

                                                // Update main map
                                                if (typeof ixmaps.setProjectJSON === 'function') {
                                                    console.log('🔄 [Load Map from HTML] Loading project into main map via setProjectJSON...');
                                                    ixmaps.setProjectJSON(project);
                                                    
                                                    console.log('✅ [Load Map from HTML] Project loaded into main map successfully');
                                                    
                                                    resolve({
                                                        success: true,
                                                        config: { 
                                                            layers: project.layers || [], 
                                                            themes: project.themes || [],
                                                            embed: project.map || {}
                                                        },
                                                        layersAdded: project.layers ? project.layers.length : 0,
                                                        themesAdded: project.themes ? project.themes.length : 0
                                                    });
                                                } else {
                                                    console.error('❌ [Load Map from HTML] ixmaps.setProjectJSON not available on main map');
                                                    reject(new Error('ixmaps.setProjectJSON not available on main map'));
                                                }
                                            } else {
                                                console.warn('⚠️ [Load Map from HTML] Empty project string returned from hidden frame');
                                                reject(new Error('Empty project string returned'));
                                            }
                                        }, 1000);
                                    } catch (e) {
                                        console.error('❌ [Load Map from HTML] Error in setTimeout callback:', e);
                                        reject(e);
                                    }
                                }
                            } catch (accessError) {
                                // CORS error or access error - fall back to text parsing
                                clearInterval(checkInterval);
                                cleanup();
                                console.warn('⚠️ [Load Map from HTML] Cannot access iframe content (CORS):', accessError);
                                fallbackToTextParsing();
                                return;
                            }

                            if (attempts > 20) { // Try for 2 seconds (100ms * 20)
                                console.warn('⚠️ [Load Map from HTML] Timeout waiting for ixmaps.getProjectString in hidden frame (attempts:', attempts, ')');
                                clearInterval(checkInterval);
                                cleanup();
                                // Fall back to text parsing instead of failing
                                fallbackToTextParsing();
                                return;
                            }
                        }, 100);

                    } catch (e) {
                        cleanup();
                        reject(e);
                    }
                };

                iframe.onerror = (e) => {
                    cleanup();
                    reject(new Error('Failed to load URL into iframe'));
                };

                // Load URL into iframe (same as blobUrl for files)
                iframe.src = resolvedUrl;
            });
        }

        /**
         * Load map from local HTML or JSON file
         */
        async function loadMapFromFile(file, clearExisting = false) {
            // Check if file is JSON
            const fileName = file.name.toLowerCase();
            const isJSON = fileName.endsWith('.json');
            
            if (isJSON) {
                // Load JSON project file
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        try {
                            const jsonText = e.target.result;
                            const project = JSON.parse(jsonText);
                            
                            // Validate that it looks like an ixmaps project
                            if (!project || (typeof project !== 'object')) {
                                throw new Error('Invalid JSON format');
                            }
                            
                            // Load project using setProjectJSON
                            if (typeof ixmaps.setProjectJSON === 'function') {
                                ixmaps.setProjectJSON(project);
                                
                                resolve({
                                    success: true,
                                    config: { 
                                        layers: project.layers || [], 
                                        themes: project.themes || [],
                                        embed: project.map || {}
                                    },
                                    layersAdded: project.layers ? project.layers.length : 0,
                                    themesAdded: project.themes ? project.themes.length : 0
                                });
                            } else {
                                reject(new Error('ixmaps.setProjectJSON not available'));
                            }
                        } catch (error) {
                            reject(new Error(`Failed to load JSON project: ${error.message}`));
                        }
                    };
                    reader.onerror = () => reject(new Error('Failed to read JSON file'));
                    reader.readAsText(file);
                });
            }
            
            // Use iframe loading for HTML files - this is more reliable for getting the exact project state
            return new Promise((resolve, reject) => {
                const iframe = document.getElementById('map-loader-frame');
                if (!iframe) {
                    // Fallback to text reading if iframe missing (shouldn't happen)
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        try {
                            const html = e.target.result;
                            const config = processHTMLContent(html);

                            if (!mapInstance) {
                                throw new Error('Map instance not initialized');
                            }

                            const result = await applyMapConfig(mapInstance, config, clearExisting);

                            resolve({
                                success: true,
                                config: config,
                                layersAdded: result.layersAdded,
                                themesAdded: result.themesAdded
                            });
                        } catch (error) {
                            reject(error);
                        }
                    };
                    reader.onerror = () => reject(new Error('Failed to read file'));
                    reader.readAsText(file);
                    return;
                }

                // Create Blob URL
                const blobUrl = URL.createObjectURL(file);

                // Set timeout
                const timeoutId = setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                    reject(new Error('Timeout loading map file'));
                }, 15000); // 15s timeout for file loading

                // Cleanup function
                const cleanup = () => {
                    clearTimeout(timeoutId);
                    iframe.onload = null;
                    iframe.onerror = null;
                    URL.revokeObjectURL(blobUrl);
                };
                iframe.onload = () => {
                    try {
                        const win = iframe.contentWindow;

                        // Check for ixmaps in iframe
                        // We need to wait for ixmaps.getProjectString to be available
                        // It might take a moment after load for scripts to initialize

                        let attempts = 0;
                        const checkInterval = setInterval(() => {
                            attempts++;

                            if (win.ixmaps && typeof win.ixmaps.getProjectString === 'function') {
                                clearInterval(checkInterval);
                                cleanup();
                                try {
                                    setTimeout(() => {
                                        console.log('📥 [Load Map from HTML] Getting project JSON from hidden frame...');
                                        const projectString = win.ixmaps.getProjectString();
                                        if (projectString) {
                                            console.log('✅ [Load Map from HTML] Project string retrieved, length:', projectString.length);
                                            console.log('📋 [Load Map from HTML] Project string preview:', projectString.substring(0, 200) + '...');
                                            
                                            // Parse to verify validity
                                            let project;
                                            try {
                                                project = JSON.parse(projectString);
                                                console.log('✅ [Load Map from HTML] Project JSON parsed successfully');
                                                console.log('📊 [Load Map from HTML] Complete project JSON:', JSON.stringify(project, null, 2));
                                                console.log('📊 [Load Map from HTML] Project keys:', Object.keys(project));
                                                if (project.themes) {
                                                    console.log('🎨 [Load Map from HTML] Number of themes:', project.themes.length);
                                                }
                                                if (project.map) {
                                                    console.log('🗺️ [Load Map from HTML] Map configuration:', {
                                                        mapService: project.map.mapService,
                                                        mapType: project.map.mapType,
                                                        map: project.map.map,
                                                        mapProjection: project.map.mapProjection,
                                                        center: project.map.center,
                                                        zoom: project.map.zoom
                                                    });
                                                }
                                            } catch (e) {
                                                console.error('❌ [Load Map from HTML] Error parsing project JSON:', e);
                                                // If simple string, maybe it's not JSON? 
                                                // Usually getProjectString returns a JSON string
                                                throw new Error("Invalid project string returned");
                                            }

                                            // Update main map
                                            if (typeof ixmaps.setProjectJSON === 'function') {
                                                console.log('🔄 [Load Map from HTML] Loading project into main map via setProjectJSON...');
                                                //ixmaps.console("--- Loading project from hidden frame ---");
                                                ixmaps.setProjectJSON(project);
                                                
                                                console.log('✅ [Load Map from HTML] Project loaded into main map successfully');
                                                
                                                // Re-enable chat input if it was disabled (handled by caller usually)
                                                resolve({
                                                    success: true,
                                                    config: { 
                                                        layers: project.layers || [], 
                                                        themes: project.themes || [],
                                                        embed: project.map || {}
                                                    },
                                                    layersAdded: project.layers ? project.layers.length : 0,
                                                    themesAdded: project.themes ? project.themes.length : 0
                                                });
                                            } else {
                                                console.error('❌ [Load Map from HTML] ixmaps.setProjectJSON not available on main map');
                                                reject(new Error('ixmaps.setProjectJSON not available on main map'));
                                            }
                                        } else {
                                            console.warn('⚠️ [Load Map from HTML] Empty project string returned from hidden frame');
                                            reject(new Error('Empty project string returned'));
                                        }
                                    }, 1000);
                                } catch (e) {
                                    console.error('❌ [Load Map from HTML] Error in setTimeout callback:', e);
                                    reject(e);
                                }
                            } else if (attempts > 20) { // Try for 2 seconds (100ms * 20)
                                console.warn('⚠️ [Load Map from HTML] Timeout waiting for ixmaps.getProjectString in hidden frame (attempts:', attempts, ')');
                                clearInterval(checkInterval);
                                cleanup();
                                reject(new Error('Timed out waiting for ixmaps initialization in frame'));
                            }
                        }, 100);

                    } catch (e) {
                        cleanup();
                        reject(e);
                    }
                };

                iframe.onerror = (e) => {
                    cleanup();
                    reject(new Error('Failed to load file into iframe'));
                };

                iframe.src = blobUrl;
            });
        }

        /**
         * Load map from JSON URL
         */
        async function loadMapFromJSON(url) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const jsonText = await response.text();
                const project = JSON.parse(jsonText);
                
                // Validate that it looks like an ixmaps project
                if (!project || (typeof project !== 'object')) {
                    throw new Error('Invalid JSON format');
                }
                
                // Load project using setProjectJSON
                if (typeof ixmaps.setProjectJSON === 'function') {
                    ixmaps.setProjectJSON(project);
                    
                    return {
                        success: true,
                        config: { 
                            layers: project.layers || [], 
                            themes: project.themes || [],
                            embed: project.map || {}
                        },
                        layersAdded: project.layers ? project.layers.length : 0,
                        themesAdded: project.themes ? project.themes.length : 0
                    };
                } else {
                    throw new Error('ixmaps.setProjectJSON not available');
                }
            } catch (error) {
                return {
                    success: false,
                    error: error.message || 'Failed to load JSON project'
                };
            }
        }

        /**
         * Handle load map command from chat
         */
        async function handleLoadMapFromHTML(url) {
            // Check if URL is a JSON file
            const urlLower = url.toLowerCase();
            if (urlLower.endsWith('.json')) {
                addMessage(`🔄 Loading map from JSON: ${url}`, false);
                addLoadingMessage();
                
                try {
                    const result = await loadMapFromJSON(url);
                    removeLoadingMessage();
                    
                    if (result.success) {
                        const config = result.config;
                        let message = `✅ **Map loaded successfully from JSON!**\n\n`;
                        message += `**Map Configuration:**\n`;
                        message += `- Layers: ${result.layersAdded || 0}\n`;
                        message += `- Themes: ${result.themesAdded || 0}\n`;
                        
                        if (config.embed && config.embed.mapService) {
                            message += `- Map Service: ${config.embed.mapService}\n`;
                        }
                        if (config.embed && config.embed.mapType) {
                            message += `- Map Type: ${config.embed.mapType}\n`;
                        }
                        
                        // Tell user they can ask about the data
                        message += `\n\n💡 You can ask me about the data, themes, or map configuration. For example: "show available themes" or "what data is available?".`;
                        
                        addMessage(message, false);
                    } else {
                        addMessage(`❌ **Error loading JSON map:** ${result.error}`, false);
                    }
                } catch (error) {
                    removeLoadingMessage();
                    addMessage(`❌ **Error:** ${error.message}`, false);
                }
                return;
            }
            
            addMessage(`🔄 Loading map from: ${url} `, false);
            addLoadingMessage();

            try {
                const result = await loadMapFromHTML(url);

                removeLoadingMessage();

                if (result.success) {
                    const config = result.config;
                    let message = `✅ **Map loaded successfully!**\n\n`;
                    message += `**Map Configuration:**\n`;
                    if (config.embed && config.embed.mapService) {
                        message += `- Map Service: ${config.embed.mapService}\n`;
                    }
                    if (config.embed && config.embed.mapType) {
                        message += `- Map Type: ${config.embed.mapType}\n`;
                    }
                    if (config.embed && config.embed.mapProjection) {
                        message += `- Map Projection: ${config.embed.mapProjection}\n`;
                    }
                    if (result.layersAdded > 0 || config.layers.length > 0) {
                        message += `- Geometric Layers: ${result.layersAdded || 0} added (${config.layers.length} found)\n`;
                    }
                    message += `- Theme Layers: ${result.themesAdded || 0} added (${config.themes.length} found)\n`;

                    // Show details about extracted layers
                    if (config.layers.length > 0) {
                        message += `\n**Extracted Layers:**\n`;
                        config.layers.forEach((layer, idx) => {
                            message += `${idx + 1}. **${layer.name}**\n`;
                            if (layer.data) {
                                if (layer.data.url) {
                                    message += `   - Data URL: ${layer.data.url}\n`;
                                }
                                if (layer.data.type) {
                                    message += `   - Data Type: ${layer.data.type}\n`;
                                }
                                if (layer.data.name) {
                                    message += `   - Data Name: ${layer.data.name}\n`;
                                }
                            }
                            if (layer.type) {
                                message += `   - Type: ${layer.type}\n`;
                            }
                            if (layer.filter) {
                                message += `   - Filter: ${layer.filter}\n`;
                            }
                            if (layer.binding) {
                                const bindingKeys = Object.keys(layer.binding);
                                if (bindingKeys.length > 0) {
                                    message += `   - Binding: ${bindingKeys.map(k => `${k}: ${layer.binding[k]}`).join(', ')}\n`;
                                }
                            } else {
                                message += `   - Binding: none (geometric layer)\n`;
                            }
                            if (layer.style) {
                                const styleKeys = Object.keys(layer.style);
                                if (styleKeys.length > 0) {
                                    message += `   - Style properties: ${styleKeys.slice(0, 3).join(', ')}${styleKeys.length > 3 ? '...' : ''}\n`;
                                }
                            }
                        });
                    }

                    if (config.view) {
                        const center = config.view.center || {};
                        message += `\n- View: zoom ${config.view.zoom || 'N/A'}, center (${center.lat || 'N/A'}, ${center.lng || 'N/A'})\n`;
                    }

                    if (config.options) {
                        message += `- Options: applied\n`;
                    }

                    if (result.layersAdded === 0 && result.themesAdded === 0) {
                        message += `\n⚠️ **Note:** No layers were added. The map configuration was found but may need manual adjustment. Check the browser console for details.`;
                    }

                    // Tell user they can ask about the data
                    message += `\n\n💡 You can ask me about the data, themes, or map configuration. For example: "show available themes" or "what data is available?".`;

                    addMessage(message, false);
                } else {
                    addMessage(`❌ **Error loading map:** ${result.error}\n\n💡 **Tip:** If you're getting a CORS error, try loading the HTML file locally using the "📁 Load Map" button.`, false);
                }
            } catch (error) {
                removeLoadingMessage();
                addMessage(`❌ **Error:** ${error.message}\n\n💡 **Tip:** Make sure the URL is correct and accessible, or try loading the HTML file locally.`, false);
            }
        }

        // Load data from URL (following pattern from dialog_data_load.html)
        async function loadDataFromUrl(urlParam = null) {
            const url = urlParam;

            if (!url) {
                addMessage('❌ No URL provided', false);
                return Promise.reject('No URL provided');
            }

            // Check file size before loading
            const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB in bytes
            
            try {
                // Create a Data.feed to check file size
                const dataFeed = Data.feed({
                    source: url,
                    type: "csv" // Type doesn't matter for size check
                });
                
                // Get file size
                const fileSize = await dataFeed.getFileSize();
                
                if (fileSize !== null && fileSize > MAX_FILE_SIZE) {
                    // File is too large, ask user for confirmation
                    const sizeInMB = (fileSize / (1024 * 1024)).toFixed(2);
                    const sizeInGB = (fileSize / (1024 * 1024 * 1024)).toFixed(2);
                    const sizeText = fileSize > 1024 * 1024 * 1024 ? `${sizeInGB} GB` : `${sizeInMB} MB`;
                    
                    // Show warning message and ask for confirmation
                    const confirmMessage = `⚠️ **Large File Warning**\n\n` +
                        `The file you're trying to load is **${sizeText}** (${fileSize.toLocaleString()} bytes), which exceeds the recommended limit of 50 MB.\n\n` +
                        `Loading large files may:\n` +
                        `- Take a long time to download\n` +
                        `- Use significant memory\n` +
                        `- Slow down your browser\n\n` +
                        `Do you want to proceed with loading this file?`;
                    
                    addMessage(confirmMessage, false);
                    
                    // Wait for user confirmation
                    return new Promise((resolve, reject) => {
                        // Add confirmation buttons to the last message
                        setTimeout(() => {
                            const messagesContainer = document.getElementById('chatMessages');
                            const lastMessage = messagesContainer.lastElementChild;
                            if (lastMessage && lastMessage.classList.contains('message') && !lastMessage.classList.contains('user')) {
                                const buttonContainer = document.createElement('div');
                                buttonContainer.style.cssText = 'margin-top: 10px; display: flex; gap: 10px;';
                                
                                const yesButton = document.createElement('button');
                                yesButton.textContent = 'Yes, Load File';
                                yesButton.style.cssText = 'padding: 8px 16px; background: #10a37f; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;';
                                yesButton.onclick = async () => {
                                    buttonContainer.remove();
                                    try {
                                        await proceedWithDataLoad(url);
                                        resolve();
                                    } catch (error) {
                                        reject(error);
                                    }
                                };
                                
                                const noButton = document.createElement('button');
                                noButton.textContent = 'Cancel';
                                noButton.style.cssText = 'padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;';
                                noButton.onclick = () => {
                                    buttonContainer.remove();
                                    addMessage('❌ File loading cancelled by user.', false);
                                    reject(new Error('User cancelled file loading'));
                                };
                                
                                buttonContainer.appendChild(yesButton);
                                buttonContainer.appendChild(noButton);
                                lastMessage.querySelector('.message-content').appendChild(buttonContainer);
                            }
                        }, 100);
                    });
                } else if (fileSize !== null) {
                    // File size is OK, proceed with loading
                    const sizeInMB = (fileSize / (1024 * 1024)).toFixed(2);
                    console.log(`File size: ${sizeInMB} MB - OK to load`);
                } else {
                    // File size unavailable, proceed anyway but log a warning
                    console.warn('File size unavailable, proceeding with load');
                }
            } catch (error) {
                // If size check fails, proceed anyway (some servers don't support HEAD requests)
                console.warn('Could not check file size:', error);
            }

            // Proceed with normal loading
            return proceedWithDataLoad(url);
        }

        // Helper function to proceed with actual data loading (after size check)
        async function proceedWithDataLoad(url) {
            // Add loading message
            addLoadingMessage();

            const urlLower = url.toLowerCase();

            // Handle binary file types with Data.feed (like composer does)
            if (urlLower.endsWith('.parquet')) {
                return new Promise((resolve, reject) => {
                    const dataFeed = Data.feed({
                        source: url,
                        type: "parquet",
                        cache: true
                    });

                    dataFeed.load(function (dataTable) {
                        handleDataLoaded(dataTable, url, "parquet", resolve);
                    }).error(function (error) {
                        removeLoadingMessage();
                        addMessage(`❌ **Error loading Parquet file:** ${error.message || error}\n\n💡 **Tip:** Make sure the file is a valid Parquet file and not corrupted.`, false);
                        reject(error);
                    });
                });
            }

            if (urlLower.endsWith('.geoparquet')) {
                return new Promise((resolve, reject) => {
                    const dataFeed = Data.feed({
                        source: url,
                        type: "parquet",
                        cache: true
                    });

                    dataFeed.load(function (dataTable) {
                        handleDataLoaded(dataTable, url, "geoparquet", resolve);
                    }).error(function (error) {
                        removeLoadingMessage();
                        addMessage(`❌ **Error loading GeoParquet file:** ${error.message || error}\n\n💡 **Tip:** Make sure the file is a valid GeoParquet file with geometry data.`, false);
                        reject(error);
                    });
                });
            }

            if (urlLower.endsWith('.gpkg')) {
                return new Promise((resolve, reject) => {
                    const dataFeed = Data.feed({
                        source: url,
                        type: "gpkg",
                        cache: true
                    });

                    dataFeed.load(function (dataTable) {
                        handleDataLoaded(dataTable, url, "gpkg", resolve);
                    }).error(function (error) {
                        removeLoadingMessage();
                        addMessage(`❌ **Error loading GeoPackage file:** ${error.message || error}\n\n💡 **Tip:** Make sure the file is a valid GeoPackage (.gpkg) file.`, false);
                        reject(error);
                    });
                });
            }

            if (urlLower.endsWith('.fgb') || urlLower.endsWith('.flatgeobuf')) {
                return new Promise((resolve, reject) => {
                    const dataFeed = Data.feed({
                        source: url,
                        type: "flatgeobuf",
                        cache: true
                    });

                    dataFeed.load(function (dataTable) {
                        handleDataLoaded(dataTable, url, "flatgeobuf", resolve);
                    }).error(function (error) {
                        removeLoadingMessage();
                        addMessage(`❌ **Error loading FlatGeobuf file:** ${error.message || error}\n\n💡 **Tip:** Make sure the file is a valid FlatGeobuf (.fgb) file.`, false);
                        reject(error);
                    });
                });
            }

            if (urlLower.endsWith('.pbf') || urlLower.endsWith('.geobuf')) {
                return new Promise((resolve, reject) => {
                    const dataFeed = Data.feed({
                        source: url,
                        type: "geobuf",
                        cache: true
                    });

                    dataFeed.load(function (dataTable) {
                        handleDataLoaded(dataTable, url, "geobuf", resolve);
                    }).error(function (error) {
                        removeLoadingMessage();
                        addMessage(`❌ **Error loading Geobuf file:** ${error.message || error}\n\n💡 **Tip:** Make sure the file is a valid Geobuf (.pbf) file.`, false);
                        reject(error);
                    });
                });
            }

            // For text-based files, load via fetch and process like composer does
            return new Promise((resolve, reject) => {
                fetch(url)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.text();
                    })
                    .then(text => {
                        processTextData(text, url, resolve, reject);
                    })
                    .catch(error => {
                        removeLoadingMessage();
                        addMessage(`❌ **Error loading data:** ${error.message}\n\n💡 **Tip:** Check that the file format is supported and the file is not corrupted.`, false);
                        if (reject) reject(error);
                    });
            });
        }

        // Process text data and detect type (like composer's processTextData)
        function processTextData(text, szSource, resolve, reject) {
            let sType = "";

            // Detect file type from content (same logic as composer)
            if (text.match(/\<xml/) && text.match(/feed/)) {
                sType = "rss";
            } else if (text.match(/\<xml/) && text.match(/www.opengis.net\/kml/)) {
                sType = "kml";
            } else if (text.match(/\<?xml/) && text.match(/www.opengis.net\/gml/)) {
                sType = "gml";
            } else if (text.match(/created by dbf2xml/)) {
                sType = "jsonDB";
            } else if (text.match(/\"type\"/) && text.match(/\"FeatureCollection\"/)) {
                sType = "geojson";
            } else if (text.match(/\"type\"/) && text.match(/\"Topology\"/)) {
                sType = "topojson";
            } else if ((text[0] == "{") || (text[0] == "[")) {
                sType = "json";
            } else if ((text[0] == 'P') && (text[1] == 'A') && (text[2] == 'R')) {
                sType = "parquet";
            } else {
                sType = "csv";
            }

            // Use Data.import for text-based data (needs callback, not synchronous)
            try {
                Data.import({
                    source: text,
                    type: sType,
                    success: function (dataTable) {
                        // Data table is ready, process it
                        handleDataLoaded(dataTable, szSource, sType, resolve);
                    },
                    error: function (error) {
                        removeLoadingMessage();
                        addMessage(`❌ Error processing ${sType} data: ${error}`, false);
                        if (reject) reject(error);
                    }
                });
            } catch (error) {
                removeLoadingMessage();
                addMessage(`❌ Error processing ${sType} data: ${error.message}`, false);
                if (reject) reject(error);
            }
        }

        // Make functions globally available for onclick handlers
        window.copyCodeToClipboard = function (code, type) {
            navigator.clipboard.writeText(code).then(() => {
                // Show temporary success message
                const notification = document.createElement('div');
                notification.textContent = '✓ Copied to clipboard!';
                notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10a37f; color: white; padding: 12px 20px; border-radius: 6px; z-index: 10000; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
                document.body.appendChild(notification);
                setTimeout(() => {
                    notification.remove();
                }, 2000);
            }).catch(err => {

                alert('Failed to copy to clipboard. Please select and copy manually.');
            });
        }

        // Make functions globally available for onclick handlers
        window.downloadCode = function (code, filename) {
            const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        /**
         * Show map loading spinner
         */
        function showMapLoadingSpinner() {
            const spinner = document.getElementById('mapLoadingSpinner');
            if (spinner) {
                spinner.style.display = 'flex';
                // Force reflow to ensure display change is applied
                spinner.offsetHeight;
                spinner.classList.add('active');
            }
        }

        /**
         * Hide map loading spinner with fade out animation
         */
        function hideMapLoadingSpinner() {
            const spinner = document.getElementById('mapLoadingSpinner');
            if (spinner) {
                // Remove active class to trigger fade out
                spinner.classList.remove('active');
                // Remove from DOM after animation completes
                setTimeout(() => {
                    if (spinner && !spinner.classList.contains('active')) {
                        spinner.style.display = 'none';
                    }
                }, 500); // Match transition duration
            }
        }

        /**
         * Save map as HTML file
         * @param {String} filename - Filename (with or without .html extension)
         * @returns {Promise<Object>} Result object with success status and message
         */
        async function saveMapAsHTML(filename) {
            try {
                // Get project string
                let projectString = null;
                const map = ixmaps && ixmaps.map ? ixmaps.map() : null;
                const mapInstance = ixmaps && ixmaps.embeddedSVG && ixmaps.embeddedSVG.window ? ixmaps.embeddedSVG.window.map : null;

                if (map && typeof map.getProjectString === 'function') {
                    projectString = map.getProjectString();
                } else if (mapInstance && typeof mapInstance.getProjectString === 'function') {
                    projectString = mapInstance.getProjectString();
                } else if (ixmaps && typeof ixmaps.getProjectString === 'function') {
                    projectString = ixmaps.getProjectString();
                }

                if (!projectString) {
                    return {
                        success: false,
                        message: '⚠️ No project code available. The map may not have any themes loaded yet.'
                    };
                }

                // Generate HTML code using Config
                let htmlCode = '';
                try {
                    if (typeof Config !== 'undefined') {
                        const config = new Config(projectString);
                        htmlCode = config.getProjectHTML();
                    } else {
                        throw new Error('Config class not available. Please ensure json_config_html.js is loaded.');
                    }
                } catch (e) {
                    return {
                        success: false,
                        message: `❌ Error generating HTML code: ${e.message}`
                    };
                }

                // Ensure filename has .html extension
                let finalFilename = filename;
                if (!finalFilename.toLowerCase().endsWith('.html')) {
                    finalFilename += '.html';
                }

                // Download the file
                downloadCode(htmlCode, finalFilename);

                return {
                    success: true,
                    message: `✅ Map saved as ${finalFilename}`
                };
            } catch (error) {
                return {
                    success: false,
                    message: `❌ Error saving map as HTML: ${error.message}`
                };
            }
        }

        /**
         * Save map as JSON file
         * @param {String} filename - Filename (with or without .json extension)
         * @returns {Promise<Object>} Result object with success status and message
         */
        async function saveMapAsJSON(filename) {
            try {
                // Get project string
                let projectString = null;
                const map = ixmaps && ixmaps.map ? ixmaps.map() : null;
                const mapInstance = ixmaps && ixmaps.embeddedSVG && ixmaps.embeddedSVG.window ? ixmaps.embeddedSVG.window.map : null;

                if (map && typeof map.getProjectString === 'function') {
                    projectString = map.getProjectString();
                } else if (mapInstance && typeof mapInstance.getProjectString === 'function') {
                    projectString = mapInstance.getProjectString();
                } else if (ixmaps && typeof ixmaps.getProjectString === 'function') {
                    projectString = ixmaps.getProjectString();
                }

                if (!projectString) {
                    return {
                        success: false,
                        message: '⚠️ No project code available. The map may not have any themes loaded yet.'
                    };
                }

                // Parse and format JSON
                let formattedJSON;
                try {
                    const projectObj = JSON.parse(projectString);
                    formattedJSON = JSON.stringify(projectObj, null, 2);
                } catch (e) {
                    // If it's not valid JSON, use as is
                    formattedJSON = projectString;
                }

                // Ensure filename has .json extension
                let finalFilename = filename;
                if (!finalFilename.toLowerCase().endsWith('.json')) {
                    finalFilename += '.json';
                }

                // Download the file
                downloadCode(formattedJSON, finalFilename);

                return {
                    success: true,
                    message: `✅ Map saved as ${finalFilename}`
                };
            } catch (error) {
                return {
                    success: false,
                    message: `❌ Error saving map as JSON: ${error.message}`
                };
            }
        }

        // Show project HTML code with syntax highlighting
        function showProjectHTML() {
            try {
                if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                    addMessage('⚠️ Map is not ready yet. Please wait a moment and try again.', false);
                    return;
                }

                const map = ixmaps.embeddedSVG.window.map;
                let projectString = null;

                // Try to get project string from map instance
                if (map && typeof map.getProjectString === 'function') {
                    projectString = map.getProjectString();
                } else if (mapInstance && typeof mapInstance.getProjectString === 'function') {
                    projectString = mapInstance.getProjectString();
                } else if (ixmaps && typeof ixmaps.getProjectString === 'function') {
                    projectString = ixmaps.getProjectString();
                }

                if (!projectString) {
                    addMessage('⚠️ No project code available. The map may not have any themes loaded yet.', false);
                    return;
                }

                // Generate HTML code using Config
                let htmlCode = '';
                try {
                    if (typeof Config !== 'undefined') {
                        const config = new Config(projectString);
                        htmlCode = config.getProjectHTML();
                    } else {
                        throw new Error('Config class not available. Please ensure json_config_html.js is loaded.');
                    }
                } catch (e) {

                    addMessage('❌ Error generating HTML code: ' + e.message, false);
                    return;
                }

                // Create message with formatted code block
                let message = `## Project HTML Code\n\n`;
                message += `Here is the HTML code for embedding the current map:\n\n`;
                message += `**Tip:** You can copy this code and use it to create a standalone HTML page with the map.`;

                // Add the message first
                const messageDiv = addMessage(message, false);

                // Create a code block with syntax highlighting
                const codeContainer = document.createElement('div');
                codeContainer.className = 'project-code-container';

                // Add action buttons FIRST (so they appear on top)
                const codeActions = document.createElement('div');
                codeActions.className = 'code-actions';

                const copyBtn = document.createElement('button');
                copyBtn.className = 'code-action-btn';
                copyBtn.title = 'Copy to clipboard';
                copyBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                `;
                copyBtn.onclick = () => copyCodeToClipboard(htmlCode, 'html');

                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'code-action-btn';
                downloadBtn.title = 'Download as file';
                downloadBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                `;
                downloadBtn.onclick = () => downloadCode(htmlCode, 'ixmaps-project.html');

                codeActions.appendChild(copyBtn);
                codeActions.appendChild(downloadBtn);
                codeContainer.appendChild(codeActions);

                // Create code container with Composer style (like __showProjectHTML)
                const codePre = document.createElement('pre');
                codePre.id = 'source-html-' + Date.now();
                codePre.className = 'language-HTML';
                codePre.style.cssText = 'margin: 0; padding: 0.2em 0 0.2em 1em; background: #f3f3f3; overflow-x: auto;';
                codePre.textContent = htmlCode;

                codeContainer.appendChild(codePre);

                // Find the message content div and append code container
                const messageContent = messageDiv.querySelector('.message-content');
                if (messageContent) {
                    messageContent.appendChild(codeContainer);

                    // Highlight the code using highlight.js (like Composer)
                    if (typeof hljs !== 'undefined') {
                        hljs.highlightBlock(codePre);
                    }
                }
            } catch (error) {

                addMessage('❌ Error retrieving project HTML code: ' + error.message, false);
            }
        }

        // Show theme JavaScript code with syntax highlighting
        function showThemeCode(themeId = null) {
            try {
                if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                    addMessage('⚠️ Map is not ready yet. Please wait a moment and try again.', false);
                    return;
                }

                const map = ixmaps.embeddedSVG.window.map;
                const mapApi = map.Api;

                // Check if Config class is available (from json_config_html.js)
                if (typeof Config === 'undefined') {
                    addMessage('⚠️ Config class not available. Please ensure json_config_html.js is loaded.', false);
                    return;
                }

                // Get project string to access theme in JSON format (like json_config_html.js does)
                // Use Config object like getProjectHTML() does to ensure we get the same project object
                let project = null;
                try {
                    let projectString = null;
                    if (map && typeof map.getProjectString === 'function') {
                        projectString = map.getProjectString();
                    } else if (mapInstance && typeof mapInstance.getProjectString === 'function') {
                        projectString = mapInstance.getProjectString();
                    } else if (ixmaps && typeof ixmaps.getProjectString === 'function') {
                        projectString = ixmaps.getProjectString();
                    }

                    if (!projectString) {
                        addMessage('⚠️ Could not retrieve project string. The theme may not exist.', false);
                        return;
                    }

                    // Use Config object like getProjectHTML() does - this ensures we get the same structure
                    const config = new Config(projectString);
                    project = config.obj; // Use the parsed object from Config, same as getProjectHTML does
                } catch (e) {
                    addMessage('⚠️ Could not parse project JSON: ' + e.message, false);
                    return;
                }

                // Find theme(s) in project.themes array
                let themeObjects = [];
                if (project.themes && Array.isArray(project.themes)) {
                    // If no specific themeId requested, show all themes
                    if (!themeId) {
                        // Use all themes from project JSON
                        // Make sure we get all themes even if they share the same layer name
                        themeObjects = project.themes.slice(); // Create a copy to avoid mutations
                        
                        // Verify we have all themes - if project JSON is stale, it might not have all themes
                        const allThemesFromMap = mapApi.getAllThemes ? mapApi.getAllThemes() : [];
                        if (allThemesFromMap.length > project.themes.length) {
                            // Project JSON might be stale - log a warning but use what we have
                            console.warn(`[THEME CODE] Map has ${allThemesFromMap.length} themes but project JSON has ${project.themes.length}. Using project JSON themes.`);
                        }
                    } else {
                        // Get theme ID and index for the requested theme
                        let targetThemeId = themeId;
                        let themeIndex = null;
                        
                        // Find the index of the requested theme
                        const allThemes = mapApi.getAllThemes ? mapApi.getAllThemes() : [];
                        for (let i = 0; i < allThemes.length; i++) {
                            const t = allThemes[i];
                            const tId = Array.isArray(allThemes) ? t : (t?.szId || t?.id || t);
                            if (tId === targetThemeId || String(tId) === String(targetThemeId)) {
                                themeIndex = i;
                                break;
                            }
                        }
                        // If we have a theme index, use it directly (most reliable)
                        if (themeIndex !== null && themeIndex >= 0 && themeIndex < project.themes.length) {
                            themeObjects = [project.themes[themeIndex]];
                        } else {
                            // Fallback: try to find by ID match
                            const foundTheme = project.themes.find(t => {
                                const tId = t.id || t.szId || t.theme?.id || t.theme?.szId;
                                return tId === targetThemeId || String(tId) === String(targetThemeId);
                            });
                            
                            // If still no match, try to match by layer name
                            if (foundTheme) {
                                themeObjects = [foundTheme];
                            } else {
                                const themeDef = mapApi.getMapThemeDefinitionObj ? mapApi.getMapThemeDefinitionObj(targetThemeId) : null;
                                if (themeDef && themeDef.layer) {
                                    const foundByLayer = project.themes.find(t => t.layer === themeDef.layer);
                                    if (foundByLayer) {
                                        themeObjects = [foundByLayer];
                                    }
                                }
                            }
                        }
                    }
                }

                if (themeObjects.length === 0) {
                    addMessage('⚠️ Could not find theme in project. The theme may not exist.', false);
                    return;
                }

                // Helper function to generate JavaScript code for a single theme
                function generateThemeCode(themeObj) {
                    // Get layer name
                    let layerName = themeObj.layer || '';
                    if (!layerName) {
                        const tId = themeObj.id || themeObj.szId || themeObj.theme?.id || themeObj.theme?.szId || '';
                        layerName = 'theme_' + String(tId).replace(/[^a-zA-Z0-9]/g, '_');
                    }

                    // Build JavaScript code chain following json_config_html.js pattern exactly
                    let jsCode = `var ${layerName} = ixmaps.layer("${layerName}")`;

                    // Data - transform from JSON structure like json_config_html.js does
                    const data = {
                        type: String(themeObj.style.dbtableType || ''),
                        name: String(themeObj.style.dbtable || '')
                    };
                    if (themeObj.style.dbtableQuery) {
                        data.query = String(themeObj.style.dbtableQuery);
                    } else if (themeObj.style.dbtableUrl) {
                        data.url = String(themeObj.style.dbtableUrl);
                    }
                    if (themeObj.style.dbtableProcess) {
                        data.process = String(themeObj.style.dbtableProcess);
                    }
                    
                    const dataObj = new Config(data);
                    let szData = dataObj.getPrettyString().replace(/\n/g, "\n    ");
                    szData = szData.replace(/\"\$/g,"").replace(/\$\"/g,"");
                    jsCode += `\n    .data(${szData})`;

                    // Filter (if present) - like json_config_html.js does
                    if (themeObj.style.filter) {
                        const filterStr = String(themeObj.style.filter).replace(/\"/g, '\\"');
                        jsCode += `\n    .filter("${filterStr}")`;
                    }

                    // Binding - transform from JSON structure like json_config_html.js does
                    const binding = {
                        geo: String(themeObj.style.lookupfield || '')
                    };
                    if (themeObj.field) {
                        binding.value = String(themeObj.field);
                    }
                    if (themeObj.style.itemfield) {
                        binding.id = String(themeObj.style.itemfield);
                    }
                    
                    const bindingObj = new Config(binding);
                    let szBinding = bindingObj.getPrettyString().replace(/\n/g, "\n    ");
                    jsCode += `\n    .binding(${szBinding})`;

                    // Type - like json_config_html.js does
                    if (themeObj.style.type) {
                        jsCode += `\n    .type("${themeObj.style.type}")`;
                    }

                    // Style - copy remaining style properties after removing data/binding/type/filter properties
                    // Make a copy to avoid mutating the original
                    const style = JSON.parse(JSON.stringify(themeObj.style));
                    delete style.dbtableProcess;
                    delete style.dbtableQuery;
                    delete style.dbtableUrl;
                    delete style.dbtableExt;
                    delete style.dbtableType;
                    delete style.dbtable;
                    delete style.filter;
                    delete style.lookupfield;
                    delete style.itemfield;
                    delete style.type;
                    // Remove meta properties from style (they will go into meta)
                    delete style.name;
                    delete style.title;
                    delete style.tooltip;
                    delete style.description;
                    delete style.snippet;
                    
                    const styleObj = new Config(style);
                    let szStyle = styleObj.getPrettyString().replace(/\n/g, "\n    ");
                    // Handle query function references (like json_config_html.js does)
                    if (szStyle.match(/toString\(\)/)) {
                        szStyle = szStyle.replace(/\"\$/g,"").replace(/\$\"/g,"");
                    }
                    jsCode += `\n    .style(${szStyle})`;

                    // Meta - collect from themeObj.meta and also from root level properties
                    const meta = themeObj.meta ? JSON.parse(JSON.stringify(themeObj.meta)) : {};
                    
                    // Move name, title, tooltip, description, snippet to meta if they exist at root level or in style
                    if (themeObj.name && !meta.name) meta.name = themeObj.name;
                    if (themeObj.title && !meta.title) meta.title = themeObj.title;
                    if (themeObj.tooltip && !meta.tooltip) meta.tooltip = themeObj.tooltip;
                    if (themeObj.description && !meta.description) meta.description = themeObj.description;
                    if (themeObj.snippet && !meta.snippet) meta.snippet = themeObj.snippet;
                    
                    // Also check in style object
                    if (themeObj.style) {
                        if (themeObj.style.name && !meta.name) meta.name = themeObj.style.name;
                        if (themeObj.style.title && !meta.title) meta.title = themeObj.style.title;
                        if (themeObj.style.tooltip && !meta.tooltip) meta.tooltip = themeObj.style.tooltip;
                        if (themeObj.style.description && !meta.description) meta.description = themeObj.style.description;
                        if (themeObj.style.snippet && !meta.snippet) meta.snippet = themeObj.style.snippet;
                    }
                    
                    const metaObj = new Config(meta);
                    let szMeta = metaObj.getPrettyString().replace(/\n/g, "\n    ");
                    jsCode += `\n    .meta(${szMeta})`;

                    // Define
                    jsCode += `\n    .define();`;
                    
                    return { jsCode, layerName, themeTitle: themeObj.meta?.title || themeObj.style?.title || layerName };
                }

                // Generate code for all themes
                const themeCodes = themeObjects.map(generateThemeCode);
                const allJsCode = themeCodes.map(tc => tc.jsCode).join('\n\n');

                // Create message with formatted code block
                let message = '';
                if (themeCodes.length === 1) {
                    message = `## Theme JavaScript Code: ${themeCodes[0].themeTitle}\n\n`;
                    message += `Here is the JavaScript code to create this theme:\n\n`;
                } else {
                    message = `## Theme JavaScript Code (${themeCodes.length} themes)\n\n`;
                    message += `Here is the JavaScript code to create all themes:\n\n`;
                }
                message += `**Tip:** You can copy this code and use it to recreate the theme(s) programmatically.`;

                // Add the message first
                const messageDiv = addMessage(message, false);

                // Create a code block with syntax highlighting
                const codeContainer = document.createElement('div');
                codeContainer.className = 'project-code-container';

                // Add action buttons
                const codeActions = document.createElement('div');
                codeActions.className = 'code-actions';

                const copyBtn = document.createElement('button');
                copyBtn.className = 'code-action-btn';
                copyBtn.title = 'Copy to clipboard';
                copyBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                `;
                copyBtn.onclick = () => copyCodeToClipboard(allJsCode, 'javascript');

                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'code-action-btn';
                downloadBtn.title = 'Download as file';
                downloadBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                `;
                const downloadFileName = themeCodes.length === 1 ? `${themeCodes[0].layerName}.js` : 'themes.js';
                downloadBtn.onclick = () => downloadCode(allJsCode, downloadFileName);

                codeActions.appendChild(copyBtn);
                codeActions.appendChild(downloadBtn);
                codeContainer.appendChild(codeActions);

                const codePre = document.createElement('pre');
                codePre.className = 'language-javascript';
                codePre.style.cssText = 'margin: 0; padding: 16px; overflow-x: auto;';

                const codeElement = document.createElement('code');
                codeElement.className = 'language-javascript';
                codeElement.textContent = allJsCode;
                codeElement.style.cssText = 'display: block; white-space: pre; font-family: inherit; font-size: inherit;';

                codePre.appendChild(codeElement);
                codeContainer.appendChild(codePre);

                // Find the message content div and append code container
                const messageContent = messageDiv.querySelector('.message-content');
                if (messageContent) {
                    messageContent.appendChild(codeContainer);

                    // Highlight the code using Prism.js (preferred) or hljs (fallback)
                    // Use setTimeout to ensure DOM is ready and Prism is loaded
                    setTimeout(() => {
                        if (typeof Prism !== 'undefined' && Prism.highlight) {
                            // Check if JavaScript language is loaded
                            if (Prism.languages && Prism.languages.javascript) {
                                // Use Prism.highlight to get highlighted HTML
                                try {
                                    codeElement.innerHTML = Prism.highlight(allJsCode, Prism.languages.javascript, 'javascript');
                                } catch (e) {
                                    console.warn('Prism highlight failed, trying highlightElement:', e);
                                    if (Prism.highlightElement) {
                                        Prism.highlightElement(codeElement);
                                    }
                                }
                            } else if (Prism.highlightElement) {
                                // Fallback: try highlightElement
                                Prism.highlightElement(codeElement);
                            }
                        } else if (typeof hljs !== 'undefined') {
                            codePre.className = 'javascript';
                            try {
                                if (hljs.highlightElement) {
                                    hljs.highlightElement(codePre);
                                } else if (hljs.highlightBlock) {
                                    hljs.highlightBlock(codePre);
                                } else if (hljs.highlight) {
                                    codeElement.innerHTML = hljs.highlight(allJsCode, { language: 'javascript' }).value;
                                }
                            } catch (e) {
                                console.warn('hljs highlight failed:', e);
                            }
                        }
                    }, 50);
                }
            } catch (error) {
                addMessage('❌ Error retrieving theme JavaScript code: ' + error.message, false);
            }
        }

        // Show project code (JSON) with syntax highlighting
        function showProjectCode() {
            try {
                if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                    addMessage('⚠️ Map is not ready yet. Please wait a moment and try again.', false);
                    return;
                }

                const map = ixmaps.embeddedSVG.window.map;
                let projectString = null;

                // Try to get project string from map instance
                if (map && typeof map.getProjectString === 'function') {
                    projectString = map.getProjectString();
                } else if (mapInstance && typeof mapInstance.getProjectString === 'function') {
                    projectString = mapInstance.getProjectString();
                } else if (ixmaps && typeof ixmaps.getProjectString === 'function') {
                    projectString = ixmaps.getProjectString();
                }

                if (!projectString) {
                    addMessage('⚠️ No project code available. The map may not have any themes loaded yet.', false);
                    return;
                }

                // Try to parse and format JSON for better readability
                try {
                    const projectObj = JSON.parse(projectString);
                    formattedCode = JSON.stringify(projectObj, null, 2);
                } catch (e) {
                    // If it's not valid JSON, use as is
                }

                // Create message with formatted code block
                let message = `## Project Code (JSON)\n\n`;
                message += `Here is the current map project configuration:\n\n`;
                message += `**Tip:** You can copy this code and use it to recreate the map configuration.\n\n`;
                message += `💡 **To save this code as a file:** Use \`save map as [filename].json\` or \`save project as [filename].json\``;

                // Add the message first
                const messageDiv = addMessage(message, false);

                // Create a code block with syntax highlighting
                const codeContainer = document.createElement('div');
                codeContainer.className = 'project-code-container';

                // Add action buttons FIRST (so they appear on top)
                const codeActions = document.createElement('div');
                codeActions.className = 'code-actions';

                const copyBtn = document.createElement('button');
                copyBtn.className = 'code-action-btn';
                copyBtn.title = 'Copy to clipboard';
                copyBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                `;
                copyBtn.onclick = () => copyCodeToClipboard(formattedCode, 'json');

                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'code-action-btn';
                downloadBtn.title = 'Download as file';
                downloadBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                `;
                downloadBtn.onclick = () => downloadCode(formattedCode, 'ixmaps-project.json');

                codeActions.appendChild(copyBtn);
                codeActions.appendChild(downloadBtn);
                codeContainer.appendChild(codeActions);

                const codePre = document.createElement('pre');
                codePre.style.cssText = 'margin: 0; padding: 16px; overflow-x: auto;';

                const codeElement = document.createElement('code');
                codeElement.className = 'language-json';
                codeElement.textContent = formattedCode;
                codeElement.style.cssText = 'display: block; white-space: pre; font-family: inherit; font-size: inherit;';

                codePre.appendChild(codeElement);
                codeContainer.appendChild(codePre);

                // Find the message content div and append code container
                const messageContent = messageDiv.querySelector('.message-content');
                if (messageContent) {
                    messageContent.appendChild(codeContainer);

                    // Highlight the code using Prism.js
                    if (typeof Prism !== 'undefined') {
                        Prism.highlightElement(codeElement);
                    }
                }
            } catch (error) {

                addMessage('❌ Error retrieving project code: ' + error.message, false);
            }
        }

        /** Send a preset prompt from empty-state hints (e.g. "What themes are on the map?"). */
        function sendChatPromptFromHint(text) {
            if (!text || typeof text !== 'string') {
                return;
            }
            const chatInput = document.getElementById('chatInput');
            const sendButton = document.getElementById('sendButton');
            if (!chatInput || !sendButton) {
                return;
            }
            chatInput.value = text;
            sendButton.click();
        }
        window.sendChatPromptFromHint = sendChatPromptFromHint;

        // Show sample data URLs
        function showSampleData() {
            if (window.__IXMAPS_AI_CHAT_EMBED_HOST__) {
                addMessage(
                    'Sample data lists are not available in embedded mode. Use the themes already on the map, or add data with `load data url [URL]`.',
                    false
                );
                return;
            }
            const sampleDataUrls = [
                {
                    name: "Cities Population Data (CSV)",
                    url: "https://s3.tebi.io/data/samples/WUP2025-DB-DEGURBA-Cities-Population-Surface-Data-filtered.csv",
                    description: "World Urban Population data with city coordinates, population, and area information"
                },
                {
                    name: "Country Boundaries (TopoJSON)",
                    url: "https://s3.eu-central-1.amazonaws.com/maps.ixmaps.com/topojson/CNTR_RG_10M_2020_4326.json",
                    description: "Country boundaries in TopoJSON format"
                },
                {
                    name: "World Urban Population Data (CSV)",
                    url: "https://s3.tebi.io/data/samples/world_country_population_1960_2016.csv",
                    description: "Population data for countries 1960-2016"
                }
            ];

            let message = `## Sample Data Sources\n\n`;
            message += `Here are some sample data files you can load:\n\n`;

            sampleDataUrls.forEach((sample, index) => {
                message += `### ${index + 1}. ${sample.name}\n\n`;
                message += `**URL:** [${sample.url}](${sample.url})\n\n`;
                message += `${sample.description}\n\n`;
            });

            message += `\n**Tip:** You can also copy any URL above and use the command: \`load data url [URL]\`\n`;

            addMessage(message, false, null, null); // null model = generic icon
        }

        // Load sample data (called from button click)
        window.loadSampleData = async function (url) {
            addMessage(`Loading: \`${url}\``, false);
            try {
                await loadDataFromUrl(url);
            } catch (error) {

                addMessage(`❌ Error loading data: ${error.message}`, false);
            }
        };

        // Show application capabilities using Gemini AI
        async function showApplicationCapabilities() {
            const capabilitiesPrompt = `You are an AI assistant for iXMaps Chat, a web-based interactive mapping and data visualization application. 

Here are the key features and capabilities of iXMaps Chat:

**Data Loading:**
- Load data from URLs by typing "load data url [URL]" or just paste a URL
- Supported formats: CSV, JSON, GeoJSON, TopoJSON, Parquet, GeoParquet, GeoPackage, FlatGeobuf, Geobuf
${window.__IXMAPS_AI_CHAT_EMBED_HOST__ ? '- Embedded mode: the map is already open in the host page; do not mention sample datasets or "show sample data".' : '- Ask "show me some sample data" to see example datasets'}

**Map Interaction:**
- Natural language queries to explore and filter data
- Ask questions like "show me all features", "find countries with population over 1000000"
- Visualize query results on the map
- Clear the map with commands: reset, clear, pulisci, remove all, remove themes, clean up

**Data Analysis:**
- When data is loaded, the system automatically analyzes it and provides an introduction
- Ask about available data fields and structure
- Query data using natural language
- Get insights and suggestions about the data

**Tooltip Configuration:**
- Configure custom tooltips for map themes using Mustache templates
- Tooltips can display: theme title, item data, charts, field values, and more
- Ask to "set tooltip" or "configure tooltip" for a theme
- Use template variables like {{theme.item.title}}, {{theme.item.data}}, {{theme.item.chart}}, {{field_name}}
- Examples: "set tooltip to show data table", "configure tooltip with chart and title"

**AI Features:**
- Uses AI (Gemini or Mistral) for intelligent data analysis when API keys are configured
- Natural language understanding for queries
- Automatic data structure analysis and recommendations
- Mistral available as a free alternative to Gemini

**Save & Export:**
- Save map as HTML: "save map as [filename].html" or "save map [filename].html" - Creates a standalone HTML page
- Save map as JSON: "save map as [filename].json" or "save project as [filename].json" - Saves project configuration
- Show project code: "show project code" or "show code" - Displays JSON project code
- Show project HTML: "show project html" or "show html" - Displays generated HTML code
- Take screenshot: "screenshot" or "take screenshot" - Captures current map view
- Quick help: Type "save" to see all save options

Please provide a friendly, helpful overview of what users can do with iXMaps Chat. Format it in a clear, organized way with sections and examples. Always refer to the application as "iXMaps Chat" in your response. Include the Save & Export section with all the save commands mentioned above, explaining what each command does and when to use it.`;

            // Check if any AI provider is available
            const useGemini = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.useGemini;
            const hasGeminiKey = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.geminiApiKey;
            const useMistral = localStorage.getItem('useMistral') === 'true';
            const hasMistralKey = localStorage.getItem('mistralApiKey');
            const hasAnyAI = (useGemini && hasGeminiKey) || (useMistral && hasMistralKey);

            if (hasAnyAI) {
                // Use AI (Gemini first, Mistral as fallback)
                addLoadingMessage();

                try {
                    const result = await askAIDirectly(capabilitiesPrompt);
                    removeLoadingMessage();
                    const response = result.response || result; // Support both old (string) and new (object) format
                    const modelUsed = result.model || null;
                    addMessage(response, false, null, modelUsed);
                } catch (error) {
                    removeLoadingMessage();

                    // Fallback to simple help
                    showSimpleHelp();
                }
            } else {
                // Use simple help without AI
                showSimpleHelp();
            }
        }

        // Show simple help without AI
        function showSimpleHelp() {
            let help = `## What You Can Do with iXMaps Chat\n\n`;
            help += `### 📊 **Data Loading**\n\n`;
            help += `- Load data from URLs: Type \`load data url [URL]\` or just paste a URL\n`;
            help += `- Supported formats: CSV, JSON, GeoJSON, TopoJSON, Parquet, GeoParquet, GeoPackage, FlatGeobuf, Geobuf\n`;
            if (!window.__IXMAPS_AI_CHAT_EMBED_HOST__) {
                help += `- Try: \`show me some sample data\` to see example datasets\n`;
            }
            help += `\n`;

            help += `### 🗺️ **Map Interaction**\n\n`;
            help += `- Ask natural language questions about your data\n`;
            help += `- Examples:\n`;
            help += `  - "Show me all features"\n`;
            help += `  - "Find countries with population over 1000000"\n`;
            help += `  - "What data is available?"\n`;
            help += `- Clear the map: \`reset\`, \`clear\`, \`remove all themes\`, \`clean up\`\n\n`;

            help += `### 📈 **Data Analysis**\n\n`;
            help += `- Automatic data structure analysis when data is loaded\n`;
            help += `- Explore fields and get insights\n`;
            help += `- Query and filter data using natural language\n`;
            help += `- Visualize results on the map\n\n`;

            help += `### 💬 **Tooltip Configuration**\n\n`;
            help += `- Configure custom tooltips for map themes\n`;
            help += `- Use Mustache templates: \`{{theme.item.title}}\`, \`{{theme.item.data}}\`, \`{{theme.item.chart}}\`\n`;
            help += `- Examples:\n`;
            help += `  - "set tooltip to show data table"\n`;
            help += `  - "configure tooltip with chart and title"\n`;
            help += `  - "show tooltip with {{field_name}}"\n\n`;

            help += `### 🤖 **AI Features**\n\n`;
            help += `- Configure Gemini AI in Settings (⚙️) for enhanced analysis\n`;
            help += `- Intelligent data structure analysis\n`;
            help += `- Natural language query understanding\n\n`;

            help += `### 💾 **Save & Export**\n\n`;
            help += `**Save Map as HTML:**\n`;
            help += `- \`save map as [filename].html\` - Creates a standalone HTML page with your map\n`;
            help += `- \`save map [filename].html\` - Shorthand version\n`;
            help += `- Example: \`save map as mymap.html\`\n\n`;
            help += `**Save Map as JSON Project:**\n`;
            help += `- \`save map as [filename].json\` - Saves project configuration as JSON\n`;
            help += `- \`save project as [filename].json\` - Alternative command\n`;
            help += `- Example: \`save project as config.json\`\n\n`;
            help += `**View Code:**\n`;
            help += `- \`show project code\` or \`show code\` - Displays the JSON project code\n`;
            help += `- \`show project html\` or \`show html\` - Displays the generated HTML code\n\n`;
            help += `**Screenshots:**\n`;
            help += `- \`screenshot\` or \`take screenshot\` - Captures the current map view\n\n`;
            help += `**Quick Save:**\n`;
            help += `- Type \`save\` to see all available save options\n\n`;

            help += `**Tip:** Start by loading a data file, then ask questions about it in iXMaps Chat!`;

            addMessage(help, false);
        }

        // Configure tooltip for a theme
        async function configureTooltip(query) {
            try {
                if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                    addMessage('⚠️ Map is not ready yet. Please wait a moment and try again.', false);
                    return;
                }

                const map = ixmaps.embeddedSVG.window.map;

                // Get available themes
                let themes = [];
                try {
                    if (map.Themes && map.Themes.getThemes) {
                        const themeObjects = map.Themes.getThemes();
                        themes = themeObjects.map(t => t.szId || t.szName || t.id || t.name).filter(Boolean);
                    } else if (map.Api && map.Api.getAllThemes) {
                        const themeObjects = map.Api.getAllThemes();
                        themes = themeObjects.map(t => t.szId || t.szName || t.id || t.name).filter(Boolean);
                    }
                } catch (e) {

                }

                if (themes.length === 0) {
                    addMessage('⚠️ No themes found on the map. Please load some data first.', false);
                    return;
                }

                // Use AI to parse the tooltip request and generate template
                const tooltipPrompt = `You are helping to configure a tooltip for an iXMaps Chat theme.

Available themes: ${themes.join(', ')}

User request: "${query}"

Tooltips in iXMaps Chat use Mustache template syntax. Available variables:
- {{theme.title}} - Theme title
- {{theme.item.title}} - Item title
- {{theme.item.data}} - Data table for the item
- {{theme.item.chart}} - Chart visualization for the item
- {{theme.item.value}} - Formatted value
- {{theme.item.label}} - Label
- {{theme.item.class}} - Class number
- {{theme.item.count}} - Number of records
- {{field_name}} - Any field from the data (use actual field names)

Common tooltip templates:
- "{{theme.item.chart}}{{theme.item.data}}" - Chart and data table
- "{{theme.item.data}}" - Just data table
- "<h3>{{theme.item.title}}</h3>{{theme.item.chart}}" - Title and chart
- "{{theme.item.chart}}<br><b>Field:</b> {{field_name}}" - Chart with specific field

Based on the user's request, generate an appropriate tooltip template. If the user mentions specific fields, include them. If they want a simple tooltip, use a basic template.

Respond with ONLY the tooltip template string, nothing else. If the user's request is unclear, use: "{{theme.item.chart}}{{theme.item.data}}"`;

                addLoadingMessage();

                try {
                    const result = await askAIDirectly(tooltipPrompt);
                    const tooltipTemplate = result.response || result; // Support both old (string) and new (object) format
                    const cleanTemplate = tooltipTemplate.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present

                    // Try to apply to all themes or the first theme
                    let applied = false;
                    let appliedThemes = [];

                    for (let themeId of themes) {
                        try {
                            if (map.Api && map.Api.changeThemeStyle) {
                                // Use changeThemeStyle with tooltip property
                                map.Api.changeThemeStyle(themeId, `tooltip:${cleanTemplate}`, "set");
                                applied = true;
                                appliedThemes.push(themeId);
                            } else if (map.Api && map.Api.getMapThemeDefinitionObj) {
                                // Alternative: get theme definition and modify it
                                const themeDef = map.Api.getMapThemeDefinitionObj(themeId);
                                if (themeDef && themeDef.style) {
                                    themeDef.style.tooltip = cleanTemplate;
                                    // Recreate theme with new tooltip
                                    if (map.Api.newMapTheme) {
                                        // This would require more complex logic, so we'll just log
                                    }
                                }
                            }
                        } catch (e) {

                        }
                    }

                    removeLoadingMessage();

                    if (applied) {
                        addMessage(`✅ Tooltip configured for theme${appliedThemes.length > 1 ? 's' : ''}: ${appliedThemes.join(', ')}\n\n**Template:**\n\`\`\`\n${cleanTemplate}\n\`\`\`\n\nHover over map features to see the new tooltip!`, false);
                    } else {
                        addMessage(`⚠️ Could not automatically apply tooltip. Here's the template you can use:\n\n\`\`\`\n${cleanTemplate}\n\`\`\`\n\nYou can configure it manually in the theme settings.`, false);
                    }
                } catch (error) {
                    removeLoadingMessage();

                    addMessage(`❌ Error configuring tooltip: ${error.message}`, false);
                }
            } catch (error) {

                addMessage(`❌ Error: ${error.message}`, false);
            }
        }

        // Clear the map by removing all themes
        function clearMap() {
            try {
                if (!mapInstance) {
                    addMessage('⚠️ Map not initialized yet.', false);
                    return;
                }

                // Check if map is ready
                if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                    addMessage('⚠️ Map not ready yet. Please wait a moment and try again.', false);
                    return;
                }

                // Use the map API to clear all themes
                const mapApi = ixmaps.embeddedSVG.window.map.Api;
                if (mapApi && mapApi.clearAll) {
                    mapApi.clearAll();
                    addMessage('✅ Map cleared successfully. All themes have been removed.', false);
                } else {
                    // Fallback: try to access themes directly
                    const map = ixmaps.embeddedSVG.window.map;
                    if (map && map.Themes && map.Themes.removeAll) {
                        map.Themes.removeAll();
                        addMessage('✅ Map cleared successfully. All themes have been removed.', false);
                    } else {
                        addMessage('⚠️ Unable to clear map. Map API not available.', false);
                    }
                }
            } catch (error) {

                addMessage(`❌ Error clearing map: ${error.message}`, false);
            }
        }

        // Remove a specific theme by name or ID
        function removeTheme(themeIdentifier) {
            try {
                if (!mapInstance) {
                    addMessage('⚠️ Map not initialized yet.', false);
                    return;
                }

                // Check if map is ready
                if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                    addMessage('⚠️ Map not ready yet. Please wait a moment and try again.', false);
                    return;
                }

                const map = ixmaps.embeddedSVG.window.map;
                if (!map || !map.Themes) {
                    addMessage('⚠️ Unable to access map themes. Map API not available.', false);
                    return;
                }

                // Get all themes to find the matching one
                let allThemes = [];
                if (map.Themes.getThemes) {
                    allThemes = map.Themes.getThemes();
                } else if (map.Api && map.Api.getAllThemes) {
                    allThemes = map.Api.getAllThemes();
                }

                if (allThemes.length === 0) {
                    addMessage('⚠️ No themes found on the map.', false);
                    return;
                }

                // Try to find theme by ID, name, or title (case-insensitive)
                const lowerIdentifier = themeIdentifier.toLowerCase();
                let foundTheme = null;
                let themeId = null;

                for (const theme of allThemes) {
                    const themeIdLower = (theme.szId || theme.id || '').toLowerCase();
                    const themeNameLower = (theme.szName || theme.name || '').toLowerCase();
                    const themeTitleLower = (theme.szTitle || theme.title || '').toLowerCase();

                    if (themeIdLower === lowerIdentifier || 
                        themeNameLower === lowerIdentifier || 
                        themeTitleLower === lowerIdentifier ||
                        themeIdLower.includes(lowerIdentifier) ||
                        themeNameLower.includes(lowerIdentifier) ||
                        themeTitleLower.includes(lowerIdentifier)) {
                        foundTheme = theme;
                        themeId = theme.szId || theme.id || theme.szName || theme.name;
                        break;
                    }
                }

                if (!foundTheme || !themeId) {
                    const availableThemes = allThemes.map(t => t.szTitle || t.szName || t.szId || t.title || t.name || t.id).filter(Boolean);
                    addMessage(`⚠️ Theme "${themeIdentifier}" not found. Available themes: ${availableThemes.join(', ')}`, false);
                    return;
                }

                // Remove the theme
                if (map.Themes.removeTheme) {
                    map.Themes.removeTheme(null, themeId);
                    const themeTitle = foundTheme.szTitle || foundTheme.title || foundTheme.szName || foundTheme.name || themeId;
                    addMessage(`✅ Theme "${themeTitle}" has been removed successfully.`, false);
                } else {
                    addMessage('⚠️ Unable to remove theme. removeTheme method not available.', false);
                }
            } catch (error) {
                addMessage(`❌ Error removing theme: ${error.message}`, false);
            }
        }

        /**
         * Change map projection using project JSON approach
         * @param {String} projectionName - Projection name (e.g., 'mercator', 'winkel')
         * @returns {Promise<Object>} Result object with success status and message
         */
        async function changeProjection(projectionName) {

            try {
                // Normalize projection name (handle aliases)

                const projectionAliases = {
                    'albers': 'albersequalarea',
                    'lambert': 'lambertazimuthalequalarea',
                    'laea': 'lambertazimuthalequalarea'
                };
                const normalizedName = projectionAliases[projectionName.toLowerCase()] || projectionName.toLowerCase();


                // Validate projection name and get path

                let projectionPath = null;
                if (typeof ixmaps.getProjectionPath === 'function') {

                    projectionPath = ixmaps.getProjectionPath(normalizedName);

                } else {

                    // Fallback: manual mapping
                    const projectionMap = {
                        'mercator': 'maps/svg/maps/generic/mercator.svg',
                        'winkel': 'maps/svg/maps/generic/winkel.svg',
                        'equalearth': 'maps/svg/maps/generic/equalearth.svg',
                        'albersequalarea': 'maps/svg/maps/generic/albersequalarea.svg',
                        'lambertazimuthalequalarea': 'maps/svg/maps/generic/lambertazimuthalequalarea.svg',
                        'orthographic': 'maps/svg/maps/generic/orthographic.svg'
                    };
                    projectionPath = projectionMap[normalizedName] || projectionMap['mercator'];

                }

                // Check if projection path is valid (not default fallback)

                const validProjections = ['mercator', 'winkel', 'equalearth', 'albersequalarea', 'lambertazimuthalequalarea', 'orthographic'];
                if (!validProjections.includes(normalizedName)) {

                    return {
                        success: false,
                        message: `❌ Invalid projection: "${projectionName}".\n\nAvailable projections:\n- mercator\n- winkel\n- equalearth\n- albersequalarea (or "albers")\n- lambertazimuthalequalarea (or "lambert")\n- orthographic`
                    };
                }


                // Get current project


                let projectString = null;
                if (typeof ixmaps.getProjectString === 'function') {

                    projectString = ixmaps.getProjectString();

                } else {


                    return {
                        success: false,
                        message: 'Unable to get current project state. Projection change not available.'
                    };
                }

                if (!projectString) {

                    // Wait a bit and retry (map might still be initializing)
                    await new Promise(resolve => setTimeout(resolve, 500));
                    projectString = ixmaps.getProjectString();

                    if (!projectString) {

                        return {
                            success: false,
                            message: 'No project state available. Please ensure the map is fully loaded and try again.'
                        };
                    }
                }

                // Parse project JSON

                let project;
                try {
                    project = JSON.parse(projectString);
                } catch (e) {
                    return {
                        success: false,
                        message: `Error parsing project JSON: ${e.message} `
                    };
                }

                // Check if project has map structure

                if (!project.map) {

                    project.map = {};
                }

                // Store old projection for feedback (optional)
                const oldProjectionPath = project.map.map || 'unknown';


                // Update projection


                // Add resource base to projection path
                project.map.map = ixmaps.szResourceBase + projectionPath;


                // Set basemap based on projection

                if (normalizedName === 'mercator') {
                    project.map.basemap = 'VT_TONER_LITE';

                } else {
                    project.map.basemap = 'white';

                }

                // Reload project with new projection



                // Show full project structure before setting
                // If orthographic projection, insert graticule layer as first theme in project JSON
                if (normalizedName === 'orthographic') {


                    // Create graticule layer object
                    const graticuleTheme =
                        ixmaps.layer("world_grid")
                            .data({
                                url: "https://s3.fr-par.scw.cloud/ixmaps.data/geometries/world_graticules/ne_110m_graticules_5.topojson",
                                type: "topojson"
                            })
                            .binding({
                                geo: "geometry"
                            })
                            .type("FEATURE")
                            .style({
                                colorscheme: ["#ccddff"],
                                linecolor: ["#ccddff"],
                                linewidth: "1",
                                fillopacity: "1"
                            })
                            .meta({
                                title: "world grid"
                            })
                            .json();


                    // Ensure themes array exists
                    if (!project.themes) {
                        project.themes = [];
                    }

                    // Insert graticule as first theme
                    project.themes.unshift(graticuleTheme);


                }

                // Clear existing themes before loading new project to avoid duplicates

                try {
                    if (mapInstance) {
                        // Try to clear themes via API
                        if (mapInstance.Api && mapInstance.Api.clearAll) {
                            mapInstance.Api.clearAll();

                        } else if (mapInstance.Themes && mapInstance.Themes.removeAll) {
                            mapInstance.Themes.removeAll();

                        } else {

                        }
                    } else if (ixmaps.embeddedSVG && ixmaps.embeddedSVG.window && ixmaps.embeddedSVG.window.map) {
                        const map = ixmaps.embeddedSVG.window.map;
                        if (map.Api && map.Api.clearAll) {
                            map.Api.clearAll();

                        } else if (map.Themes && map.Themes.removeAll) {
                            map.Themes.removeAll();

                        } else {

                        }
                    }

                    // Small delay to ensure clearing is complete before loading new themes
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (clearError) {
                }

                // Note: setProjectJSON handles all the complexity of loading map, themes, view, etc.
                if (typeof ixmaps.setProjectJSON === 'function') {

                    try {
                        ixmaps.setProjectJSON(project);

                    } catch (setError) {


                        throw setError;
                    }
                } else {


                    return {
                        success: false,
                        message: 'Unable to reload project. setProjectJSON function not available.'
                    };
                }

                // Get projection display name

                const projectionDisplayNames = {
                    'mercator': 'Mercator',
                    'winkel': 'Winkel Tripel',
                    'equalearth': 'Equal Earth',
                    'albersequalarea': 'Albers Equal Area',
                    'lambertazimuthalequalarea': 'Lambert Azimuthal Equal Area',
                    'orthographic': 'Orthographic'
                };
                const displayName = projectionDisplayNames[normalizedName] || projectionName;


                return {
                    success: true,
                    message: `** Projection changed to ${displayName}**\n\nThe map has been reloaded with the new projection.All themes, data, and view settings have been preserved.`
                };

            } catch (error) {


                return {
                    success: false,
                    message: `Error changing projection: ${error.message} `
                };
            }
        }

        // Handle successful data loading
        async function handleDataLoaded(dataTable, url, dataType, resolve) {
            try {
                currentDataTable = dataTable;
                
                // Check if this is a local file and format URL accordingly (like Composer)
                const isLocalFile = !url.match(/^https?:\/\//) && !url.match(/^\/\//);
                if (isLocalFile) {
                    // Format: [local file:filename] for local files
                    currentDataUrl = `[local file:${url}]`;
                } else {
                    currentDataUrl = url;
                }
                
                currentDataType = dataType;

                // Add data to map immediately
                addDataToMap(dataTable, currentDataUrl, dataType);

                // Remove loading message and show success message with analysis offer
                removeLoadingMessage();
                pendingAnalysisOffer = true;
                addMessage(`✅ ** Data loaded successfully! **\n\nWould you like me to analyze this data ? `, false);

                // Resolve immediately
                if (resolve) {
                    resolve(dataTable);
                }

            } catch (error) {
                removeLoadingMessage();

                // Format URL for local files even in error case
                const isLocalFile = !url.match(/^https?:\/\//) && !url.match(/^\/\//);
                const formattedUrl = isLocalFile ? `[local file:${url}]` : url;
                
                addMessage(`✅ Data loaded successfully!`, false);
                addDataToMap(dataTable, formattedUrl, dataType);
                if (resolve) {
                    resolve(dataTable);
                }
            }
        }

        /**
         * Load data from local file
         * Uses the same approach as Composer: Data.import() with array buffers for binary files
         */
        async function loadDataFromFile(file) {
            const fileName = file.name.toLowerCase();
            const fileExtension = fileName.split('.').pop();
            
            // Add loading message
            addLoadingMessage();
            addMessage(`🔄 Loading data from file: ${file.name}`, false);
            
            try {
                // Handle binary file types with Data.import (same as Composer)
                if (fileExtension === 'parquet' || fileExtension === 'geoparquet') {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const arrayBuffer = e.target.result;
                            
                            // Verify it's a valid parquet file (same validation as Composer)
                            const uint8Array = new Uint8Array(arrayBuffer);
                            if (uint8Array.length >= 4) {
                                const magic = String.fromCharCode(...uint8Array.slice(0, 4));
                                if (magic !== 'PAR1') {
                                    removeLoadingMessage();
                                    addMessage(`❌ Invalid parquet file: missing PAR1 magic number`, false);
                                    reject(new Error('Invalid parquet file'));
                                    return;
                                }
                            }
                            
                            // Use Data.import directly with array buffer (like Composer)
                            const dataType = fileExtension === 'geoparquet' ? 'geoparquet' : 'parquet';
                            Data.import({
                                source: arrayBuffer,
                                type: dataType,
                                success: function (dataTable) {
                                    handleDataLoaded(dataTable, file.name, dataType, resolve);
                                },
                                error: function (error) {
                                    removeLoadingMessage();
                                    addMessage(`❌ Error loading ${dataType} file: ${error}`, false);
                                    reject(error);
                                }
                            });
                        };
                        reader.onerror = () => {
                            removeLoadingMessage();
                            addMessage(`❌ **Error reading ${fileExtension} file:** The file could not be read. Make sure the file is not corrupted or in use by another application.`, false);
                            reject(new Error('Failed to read file'));
                        };
                        reader.readAsArrayBuffer(file);
                    });
                }
                
                if (fileExtension === 'gpkg') {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const arrayBuffer = e.target.result;
                            
                            // Verify it's a valid GeoPackage file (same validation as Composer)
                            const uint8Array = new Uint8Array(arrayBuffer);
                            if (uint8Array.length >= 16) {
                                const magic = String.fromCharCode(...uint8Array.slice(0, 16));
                                if (!magic.startsWith('SQLite format 3')) {
                                    console.warn('⚠️ Warning: Magic string is not "SQLite format 3": ' + magic);
                                    // Try to process anyway (like Composer does)
                                }
                            }
                            
                            // Use Data.import directly with array buffer (like Composer)
                            Data.import({
                                source: arrayBuffer,
                                type: "gpkg",
                                success: function (dataTable) {
                                    handleDataLoaded(dataTable, file.name, "gpkg", resolve);
                                },
                                error: function (error) {
                                    removeLoadingMessage();
                                    addMessage(`❌ Error loading gpkg file: ${error}`, false);
                                    reject(error);
                                }
                            });
                        };
                        reader.onerror = () => {
                            removeLoadingMessage();
                            addMessage(`❌ **Error reading GeoPackage file:** The file could not be read. Make sure the file is not corrupted or in use by another application.`, false);
                            reject(new Error('Failed to read file'));
                        };
                        reader.readAsArrayBuffer(file);
                    });
                }
                
                if (fileExtension === 'fgb' || fileExtension === 'flatgeobuf') {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const arrayBuffer = e.target.result;
                            
                            // Use Data.import directly with array buffer (like Composer)
                            Data.import({
                                source: arrayBuffer,
                                type: "flatgeobuf",
                                success: function (dataTable) {
                                    handleDataLoaded(dataTable, file.name, "flatgeobuf", resolve);
                                },
                                error: function (error) {
                                    removeLoadingMessage();
                                    addMessage(`❌ Error loading flatgeobuf file: ${error}`, false);
                                    reject(error);
                                }
                            });
                        };
                        reader.onerror = () => {
                            removeLoadingMessage();
                            addMessage(`❌ **Error reading FlatGeobuf file:** The file could not be read. Make sure the file is not corrupted or in use by another application.`, false);
                            reject(new Error('Failed to read file'));
                        };
                        reader.readAsArrayBuffer(file);
                    });
                }
                
                if (fileExtension === 'pbf' || fileExtension === 'geobuf') {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const arrayBuffer = e.target.result;
                            
                            // Use Data.import directly with array buffer (like Composer)
                            Data.import({
                                source: arrayBuffer,
                                type: "geobuf",
                                success: function (dataTable) {
                                    handleDataLoaded(dataTable, file.name, "geobuf", resolve);
                                },
                                error: function (error) {
                                    removeLoadingMessage();
                                    addMessage(`❌ Error loading geobuf file: ${error}`, false);
                                    reject(error);
                                }
                            });
                        };
                        reader.onerror = () => {
                            removeLoadingMessage();
                            addMessage(`❌ **Error reading Geobuf file:** The file could not be read. Make sure the file is not corrupted or in use by another application.`, false);
                            reject(new Error('Failed to read file'));
                        };
                        reader.readAsArrayBuffer(file);
                    });
                }
                
                // Handle text-based files (CSV, JSON, GeoJSON, KML, etc.)
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const text = e.target.result;
                        processTextData(text, file.name, resolve, reject);
                    };
                    reader.onerror = () => {
                        removeLoadingMessage();
                        addMessage(`❌ **Error reading file:** The file could not be read. Make sure the file is not corrupted or in use by another application.`, false);
                        reject(new Error('Failed to read file'));
                    };
                    reader.readAsText(file);
                });
            } catch (error) {
                removeLoadingMessage();
                addMessage(`❌ **Error loading data file:** ${error.message}\n\n💡 **Tip:** Check that the file format is supported and the file is not corrupted.`, false);
                throw error;
            }
        }

        // Analyze data and provide introduction using AI (Gemini or Mistral)
        // Returns the analysis text instead of adding it directly to chat
        async function analyzeAndIntroduceData(dataTable, url) {
            try {
                // Get data structure - Data.Table has: fields (array), records (array), table.records (count)
                const fields = dataTable.fields || [];
                const records = dataTable.records || [];
                const recordCount = dataTable.table?.records || records.length || 0;


                // Get sample data (first few records) - records are arrays of values
                const sampleRecords = records.slice(0, Math.min(5, records.length));

                // Build data summary
                const dataSummary = {
                    url: url,
                    fieldCount: fields.length,
                    recordCount: recordCount,
                    fields: fields.map(f => ({
                        id: f.id || f.name || (typeof f === 'string' ? f : 'unknown'),
                        type: f.type || f.typ || 'unknown'
                    })),
                    sampleRecords: sampleRecords
                };

                // Create prompt for Gemini
                const prompt = `You are analyzing a dataset that was just loaded.Here's the data structure:

                        ** Dataset Information:**
                            - Source URL: ${url}
                    - Number of fields: ${dataSummary.fieldCount}
                    - Number of records: ${dataSummary.recordCount}

** Fields:**
                        ${dataSummary.fields.map((f, i) => `${i + 1}. "${f.id}" (${f.type})`).join('\n')}

** Sample Records(first 5):**
                        ${JSON.stringify(sampleRecords, null, 2)}

Please provide:
                    1. A brief introduction to what this dataset contains
                    2. Key insights about the data structure
                    3. Suggestions on how to proceed with analysis or visualization
                    4. Potential questions the user might want to ask about this data

Format your response in a friendly, helpful way with clear sections.`;

                // Check if any AI provider is available
                const useGemini = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.useGemini;
                const hasGeminiKey = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.geminiApiKey;
                const useMistral = localStorage.getItem('useMistral') === 'true';
                const hasMistralKey = localStorage.getItem('mistralApiKey');
                const hasAnyAI = (useGemini && hasGeminiKey) || (useMistral && hasMistralKey);

                if (hasAnyAI) {
                    // Use AI (Gemini first, Mistral as fallback)
                    try {
                        const result = await askAIDirectly(prompt);
                        const response = result.response || result; // Support both old (string) and new (object) format
                        return response;
                    } catch (error) {

                        // Fallback to simple analysis
                        return generateSimpleAnalysis(dataSummary);
                    }
                } else {
                    // Use simple analysis
                    return generateSimpleAnalysis(dataSummary);
                }

            } catch (error) {

                return 'Data structure analysis completed. The data has been loaded successfully.';
            }
        }

        // Safe JSON stringify that handles circular references
        function safeStringify(obj, indent = 2) {
            const seen = new WeakSet();
            return JSON.stringify(obj, (key, value) => {
                // Skip geometry and other large/circular objects
                if (key === 'geometry' || key === 'Geometry' || key === 'GEOMETRY') {
                    return '[geometry object]';
                }
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) {
                        return '[Circular]';
                    }
                    seen.add(value);
                }
                // Convert functions to string representation
                if (typeof value === 'function') {
                    return '[Function]';
                }
                return value;
            }, indent);
        }

        // Analyze theme(s) - provides AI-powered analysis of theme configuration and visualization
        async function analyzeTheme(themeId = null) {
            try {
                if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                    return '⚠️ Map not ready. Please wait for the map to load.';
                }

                const map = ixmaps.embeddedSVG.window.map;
                const mapApi = map.Api;

                // Get all themes or specific theme
                let themes = [];
                if (themeId) {
                    const themeDef = mapApi.getMapThemeDefinitionObj ? mapApi.getMapThemeDefinitionObj(themeId) : null;
                    const themeObj = mapApi.getTheme ? mapApi.getTheme(themeId) : null;
                    if (themeDef || themeObj) {
                        themes.push({ id: themeId, def: themeDef, obj: themeObj });
                    }
                } else {
                    // Get all themes
                    const allThemes = mapApi.getAllThemes ? mapApi.getAllThemes() : [];
                    for (const tid of allThemes) {
                        const themeDef = mapApi.getMapThemeDefinitionObj ? mapApi.getMapThemeDefinitionObj(tid) : null;
                        const themeObj = mapApi.getTheme ? mapApi.getTheme(tid) : null;
                        themes.push({ id: tid, def: themeDef, obj: themeObj });
                    }
                }

                if (themes.length === 0) {
                    return '⚠️ No themes found on the map. Please load some data first.';
                }

                // Build theme analysis summary - extract only primitive values to avoid circular references
                const themeSummaries = themes.map(t => {
                    const def = t.def || {};
                    const style = def.style || {};

                    // Safely extract values from theme object (avoid circular refs)
                    let objTitle = '', objThemes = '', objFields = '', objField100 = '';
                    let objFlag = '', objOpacity = '', objSizeField = '', objUnits = '', objFilter = '';
                    let objColorScheme = '';

                    try {
                        const obj = t.obj;
                        if (obj) {
                            // Access properties directly on the theme object
                            objTitle = obj.szTitle || '';
                            objThemes = obj.szThemes || '';
                            objFields = obj.szFields || '';
                            objField100 = obj.szField100 || '';
                            objFlag = obj.szFlag || '';
                            objOpacity = obj.nOpacity != null ? String(obj.nOpacity) : '';
                            objSizeField = obj.szSizeField || '';
                            objUnits = obj.szUnits || '';
                            objFilter = obj.szFilter || '';
                            // ColorScheme might be an array or string - convert safely
                            if (obj.colorScheme) {
                                if (Array.isArray(obj.colorScheme)) {
                                    objColorScheme = obj.colorScheme.slice(0, 5).join(',');
                                } else if (typeof obj.colorScheme === 'string') {
                                    objColorScheme = obj.colorScheme;
                                }
                            }
                        }
                    } catch (e) {

                    }

                    return {
                        id: String(t.id || 'unknown'),
                        title: String(style.title || objTitle || t.id || 'Untitled'),
                        layer: String(def.layer || objThemes || 'unknown'),
                        field: String(def.field || objFields || 'none'),
                        field100: String(def.field100 || objField100 || 'none'),
                        type: String(style.type || objFlag || 'unknown'),
                        colorscheme: String(style.colorscheme || objColorScheme || 'default'),
                        fillopacity: String(style.fillopacity || objOpacity || 'default'),
                        tooltip: String(style.tooltip || 'default'),
                        sizefield: String(style.sizefield || objSizeField || 'none'),
                        aggregation: String(style.aggregation || 'none'),
                        units: String(style.units || objUnits || 'none'),
                        filter: String(style.filter || objFilter || 'none')
                    };
                });

                // Create AI prompt for theme analysis
                const prompt = `You are analyzing map visualization theme(s).Here are the theme configurations:

** Themes(${themes.length} total):**
                        ${JSON.stringify(themeSummaries, null, 2)}

** Theme Type Reference:**
                        - CHOROPLETH: Color - coded areas based on data values
                            - CHART | BUBBLE: Bubble / circle charts sized by data
                                - CHART | PIE: Pie charts showing proportions
                                    - CHART | BAR: Bar charts
                                        - FEATURES: Feature - based visualization(polygons / lines / points)
                                            - CATEGORICAL: Categorical / qualitative data
                                                - EQUIDISTANT: Equal interval classification
                                                    - QUANTILE: Quantile - based classification

Please provide:
                    1. ** Overview **: A brief description of what each theme visualizes
                    2. ** Visualization Analysis **: Analysis of the visualization type choices and their effectiveness
                    3. ** Style Assessment **: Assessment of color schemes, opacity, and visual settings
                    4. ** Suggestions **: Recommendations for improving the visualization
5. ** Potential Questions **: Questions the user might ask about the theme(s)

Format your response in a friendly, helpful way with clear sections.Use markdown formatting.`;

                // Check if AI is available
                const useGemini = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.useGemini;
                const hasGeminiKey = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.geminiApiKey;
                const useMistral = localStorage.getItem('useMistral') === 'true';
                const hasMistralKey = localStorage.getItem('mistralApiKey');
                const hasAnyAI = (useGemini && hasGeminiKey) || (useMistral && hasMistralKey);

                if (hasAnyAI) {
                    try {
                        const result = await askAIDirectly(prompt);
                        return result.response || result;
                    } catch (error) {

                        return generateSimpleThemeAnalysis(themeSummaries);
                    }
                } else {
                    return generateSimpleThemeAnalysis(themeSummaries);
                }

            } catch (error) {

                return `❌ Error analyzing theme: ${error.message} `;
            }
        }

        // Generate HTML for color patches
        function getColorPatchHtml(colorDef) {
            if (!colorDef || colorDef === 'default' || colorDef === 'none') return '';
            
            let html = '';
            
            // Handle multiple colors (comma separated)
            const colors = String(colorDef).split(',');
            
            // Limit to 10 colors to avoid clutter
            const displayColors = colors.slice(0, 10);
            
            displayColors.forEach(color => {
                // Skip numeric values (often used for counts in color schemes like "5,red,blue")
                if (!isNaN(parseFloat(color)) && isFinite(color) && !color.startsWith('#')) return;
                
                // Clean up color string
                let styleColor = color.trim();
                
                // Basic validation/sanitization to ensure it's likely a color
                // This isn't perfect but prevents totally validity text from being used as background
                const isValidColor = /^(#[0-9A-F]{3,8}|[a-zA-Z]+|rgb\(|rgba\(|hsl\(|hsla\()/.test(styleColor);
                
                if (isValidColor) {
                    html += `<span style="display:inline-block; width:12px; height:12px; background:${styleColor}; margin-left:4px; border:1px solid #ccc; vertical-align:middle;" title="${styleColor}"></span>`;
                }
            });
            
            return html;
        }

        // Generate simple theme analysis without AI
        function generateSimpleThemeAnalysis(themeSummaries) {
            let response = `## Theme Analysis\n\n`;
            response += `Found **${themeSummaries.length}** theme(s) on the map:\n\n`;

            themeSummaries.forEach((t, i) => {
                // Use header for each theme to break the numbering
                response += `#### ${i + 1}. ${t.title}\n\n`;
                response += `- **Type**: ${t.type}\n`;
                response += `- **Data Field**: ${t.field}\n`;
                response += `- **Color Scheme**: ${t.colorscheme} ${getColorPatchHtml(t.colorscheme)}\n`;
                response += `- **Layer**: ${t.layer}\n`;
                if (t.sizefield !== 'none') {
                    response += `- **Size Field**: ${t.sizefield}\n`;
                }
                if (t.fillopacity !== 'default') {
                    response += `- **Fill Opacity**: ${t.fillopacity}\n`;
                }
                response += `\n`;
            });

            return response;
        }

        // Analyze map settings - provides AI-powered analysis of map configuration
        async function analyzeMapSettings() {
            try {
                if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                    return '⚠️ Map not ready. Please wait for the map to load.';
                }

                const map = ixmaps.embeddedSVG.window.map;
                const mapApi = map.Api;

                // Gather map information
                const mapInfo = {
                    bounds: null,
                    center: null,
                    scale: null,
                    envelope: null,
                    layers: [],
                    basemap: null,
                    projection: null
                };

                // Get bounds
                try {
                    if (ixmaps.getBoundingBox) {
                        mapInfo.bounds = ixmaps.getBoundingBox();
                    } else if (mapApi && mapApi.getEnvelope) {
                        mapInfo.envelope = mapApi.getEnvelope();
                    }
                } catch (e) { }

                // Get scale
                try {
                    if (mapApi && mapApi.getMapScale) {
                        mapInfo.scale = mapApi.getMapScale();
                    }
                } catch (e) { }

                // Get center
                try {
                    if (mapApi && mapApi.getCenter) {
                        mapInfo.center = mapApi.getCenter();
                    }
                } catch (e) { }

                // Get layer information
                try {
                    if (map.Layer && map.Layer.listA) {
                        mapInfo.layers = Object.keys(map.Layer.listA).slice(0, 20);
                    }
                } catch (e) { }

                // Get theme count and extract theme information (avoid circular references)
                const allThemes = mapApi.getAllThemes ? mapApi.getAllThemes() : [];
                mapInfo.themeCount = allThemes.length;
                
                // Extract only relevant properties from themes to avoid circular references
                mapInfo.themes = allThemes.slice(0, 10).map(theme => {
                    try {
                        const themeId = theme.id || theme.szId || theme.szThemeId || 'unknown';
                        const def = theme.def || {};
                        const style = theme.style || {};
                        const obj = theme.obj || {};
                        
                        return {
                            id: String(themeId),
                            title: String(style.title || obj.szTitle || themeId || 'Untitled'),
                            layer: String(def.layer || obj.szThemes || 'unknown'),
                            field: String(def.field || obj.szFields || 'none'),
                            type: String(style.type || obj.szFlag || 'unknown'),
                            colorscheme: String(style.colorscheme || 'default'),
                            fillopacity: String(style.fillopacity || obj.nOpacity || 'default')
                        };
                    } catch (e) {
                        return {
                            id: 'error',
                            title: 'Error extracting theme info',
                            error: e.message
                        };
                    }
                });

                // Helper function to safely stringify with circular reference handling
                function safeStringify(obj, space) {
                    const seen = new WeakSet();
                    return JSON.stringify(obj, (key, value) => {
                        if (typeof value === 'object' && value !== null) {
                            if (seen.has(value)) {
                                return '[Circular]';
                            }
                            seen.add(value);
                        }
                        return value;
                    }, space);
                }

                // Create AI prompt for map analysis
                const prompt = `You are analyzing a web map's configuration and settings. Here is the map information:

                        ** Map Configuration:**
                            ${safeStringify(mapInfo, 2)}

Please provide:
                    1. ** Map Overview **: Description of the current map state(area shown, zoom level, etc.)
                    2. ** Layer Analysis **: Analysis of the map layers and their organization
                    3. ** Current View **: Description of what geographical area is being displayed
                    4. ** Active Themes **: Overview of data visualizations currently on the map
                    5. ** Suggestions **: Recommendations for map navigation or configuration
                    6. ** Potential Actions **: Things the user might want to do with the map

Format your response in a friendly, helpful way with clear sections.Use markdown formatting.`;

                // Check if AI is available
                const useGemini = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.useGemini;
                const hasGeminiKey = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.geminiApiKey;
                const useMistral = localStorage.getItem('useMistral') === 'true';
                const hasMistralKey = localStorage.getItem('mistralApiKey');
                const hasAnyAI = (useGemini && hasGeminiKey) || (useMistral && hasMistralKey);

                if (hasAnyAI) {
                    try {
                        const result = await askAIDirectly(prompt);
                        return result.response || result;
                    } catch (error) {

                        return generateSimpleMapAnalysis(mapInfo);
                    }
                } else {
                    return generateSimpleMapAnalysis(mapInfo);
                }

            } catch (error) {

                return `Error analyzing map: ${error.message} `;
            }
        }

        // Generate simple map analysis without AI
        function generateSimpleMapAnalysis(mapInfo) {
            let response = `## Map Analysis\n\n`;

            if (mapInfo.bounds) {
                response += `** Current Bounds:**\n`;
                response += `- SW: ${mapInfo.bounds[0]?.lat?.toFixed(4)}, ${mapInfo.bounds[0]?.lng?.toFixed(4)} \n`;
                response += `- NE: ${mapInfo.bounds[1]?.lat?.toFixed(4)}, ${mapInfo.bounds[1]?.lng?.toFixed(4)} \n\n`;
            }

            if (mapInfo.scale) {
                response += `** Scale **: 1:${Math.round(mapInfo.scale).toLocaleString()} \n\n`;
            }

            response += `** Active Themes **: ${mapInfo.themeCount} \n`;
            if (mapInfo.themes && mapInfo.themes.length > 0) {
                // Themes are now objects with extracted properties, format them nicely
                mapInfo.themes.forEach((theme, idx) => {
                    if (typeof theme === 'object') {
                        response += `- ${idx + 1}. ${theme.title || theme.id || 'Theme ' + (idx + 1)} (${theme.type || 'unknown'}) ${getColorPatchHtml(theme.colorscheme)}\n`;
                    } else {
                        response += `- ${theme} ${getColorPatchHtml(theme)}\n`;
                    }
                });
                response += `\n`;
            }

            if (mapInfo.layers && mapInfo.layers.length > 0) {
                response += `** Layers ** (${mapInfo.layers.length}): \n`;
                response += `- ${mapInfo.layers.slice(0, 10).join('\n- ')} \n`;
                if (mapInfo.layers.length > 10) {
                    response += `- ... and ${mapInfo.layers.length - 10} more\n`;
                }
            }

            return response;
        }

        // Normalize property name with synonyms
        function normalizePropertyName(propertyName) {
            if (!propertyName) return propertyName;
            
            const lowerName = propertyName.toLowerCase().trim();
            
            // Property name synonyms mapping
            const synonyms = {
                'normal size': 'normalsizevalue',
                'normal-size': 'normalsizevalue',
                'normal_size': 'normalsizevalue'
            };
            
            // Check if the property name (or any variation with spaces/hyphens/underscores) matches a synonym
            const normalized = lowerName.replace(/[\s_-]+/g, '');
            if (synonyms[normalized] || synonyms[lowerName]) {
                return synonyms[normalized] || synonyms[lowerName];
            }
            
            // Also check if the query contains "normal size" as separate words
            if (lowerName.includes('normal') && lowerName.includes('size')) {
                return 'normalsizevalue';
            }
            
            return lowerName;
        }

        // Get list of theme properties that can be changed via changeThemeStyle
        function getChangeableThemeProperties() {
            // Based on themeStyleTranslateA from maptheme.js
            // These are the properties that can be changed via changeThemeStyle()
            return [
                'type', 'classes', 'colorscheme', 'colorstyle', 'filter', 'dfilter', 'overviewchart', 'evidence',
                'opacity', 'fillopacity', 'autoopacity', 'shadow', 'blur', 'visible',
                'linecolor', 'linewidth', 'bordercolor', 'borderstyle', 'borderwidth', 'borderradius',
                'textcolor', 'textfont', 'textscale', 'textplacement',
                'scale', 'sizepow', 'rangescale', 'outlierscale', 'normalsizevalue', 'normalsizescale',
                'colorfield', 'sizefield', 'valuefield', 'labelfield', 'timefield', 'alphafield', 'titlefield',
                'markersize', 'gapsize', 'boxcolor', 'boxopacity', 'boxmargin',
                'minvalue', 'maxvalue', 'lowvalue', 'highvalue',
                'valuescale', 'valuecolor', 'valuedecimals', 'minvaluesize',
                'brightness', 'rotation', 'offsetx', 'offsety',
                'tooltip', 'title', 'snippet', 'description', 'name',
                'ranges', 'symbols', 'values', 'label', 'exclude',
                'nodatacolor', 'aggregationfield', 'aggregation',
                'gridx', 'gridwidth', 'gridwidthpx', 'gridoffsetx', 'gridoffsety',
                'minchartsize', 'maxcharts', 'clipframes', 'clipframerate'
            ];
        }

        // Get current value of a theme property
        async function getCurrentThemeProperty(propertyName, themeId = null) {
            try {
                if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                    return '⚠️ Map not ready. Please wait for the map to load.';
                }

                const map = ixmaps.embeddedSVG.window.map;
                const mapApi = map.Api;

                if (!mapApi) {
                    return '❌ Map API not available.';
                }

                // Normalize property name (with synonyms)
                const normalizedPropertyName = normalizePropertyName(propertyName);
                const validProperties = getChangeableThemeProperties();
                
                if (!validProperties.includes(normalizedPropertyName)) {
                    return `❌ Property "${propertyName}" is not a valid theme property.\n\nUse "how to change theme" to see available properties.`;
                }

                // Get themes
                let themes = [];
                if (themeId) {
                    const themeDef = mapApi.getMapThemeDefinitionObj ? mapApi.getMapThemeDefinitionObj(themeId) : null;
                    if (themeDef) {
                        themes.push({ id: themeId, def: themeDef });
                    } else {
                        return `❌ Theme "${themeId}" not found.`;
                    }
                } else {
                    // Get all themes
                    const allThemeIds = mapApi.getAllThemes ? mapApi.getAllThemes() : [];
                    for (const tid of allThemeIds) {
                        const themeDef = mapApi.getMapThemeDefinitionObj ? mapApi.getMapThemeDefinitionObj(tid) : null;
                        if (themeDef) {
                            themes.push({ id: tid, def: themeDef });
                        }
                    }
                }

                if (themes.length === 0) {
                    return '⚠️ No themes found on the map. Please load some data first.';
                }

                // Extract property values from themes
                const results = [];
                for (const theme of themes) {
                    const themeDef = theme.def || {};
                    const style = themeDef.style || {};
                    const themeId = theme.id;
                    
                    // Get property value - check various possible locations
                    let value = null;
                    
                    // Property name mapping: lowercase -> possible camelCase variants
                    const propertyNameMap = {
                        'fillopacity': ['fillopacity', 'fillOpacity', 'fill_opacity'],
                        'linecolor': ['linecolor', 'lineColor', 'line_color'],
                        'linewidth': ['linewidth', 'lineWidth', 'line_width'],
                        'bordercolor': ['bordercolor', 'borderColor', 'border_color'],
                        'borderwidth': ['borderwidth', 'borderWidth', 'border_width'],
                        'borderstyle': ['borderstyle', 'borderStyle', 'border_style'],
                        'borderradius': ['borderradius', 'borderRadius', 'border_radius'],
                        'textcolor': ['textcolor', 'textColor', 'text_color'],
                        'textfont': ['textfont', 'textFont', 'text_font'],
                        'textscale': ['textscale', 'textScale', 'text_scale'],
                        'textplacement': ['textplacement', 'textPlacement', 'text_placement'],
                        'colorscheme': ['colorscheme', 'colorScheme', 'color_scheme'],
                        'colorstyle': ['colorstyle', 'colorStyle', 'color_style'],
                        'colorfield': ['colorfield', 'colorField', 'color_field'],
                        'sizefield': ['sizefield', 'sizeField', 'size_field'],
                        'valuefield': ['valuefield', 'valueField', 'value_field'],
                        'labelfield': ['labelfield', 'labelField', 'label_field'],
                        'timefield': ['timefield', 'timeField', 'time_field'],
                        'alphafield': ['alphafield', 'alphaField', 'alpha_field'],
                        'titlefield': ['titlefield', 'titleField', 'title_field'],
                        'aggregationfield': ['aggregationfield', 'aggregationField', 'aggregation_field'],
                        'valuescale': ['valuescale', 'valueScale', 'value_scale'],
                        'valuecolor': ['valuecolor', 'valueColor', 'value_color'],
                        'valuedecimals': ['valuedecimals', 'valueDecimals', 'value_decimals'],
                        'minvaluesize': ['minvaluesize', 'minValueSize', 'min_value_size'],
                        'minvalue': ['minvalue', 'minValue', 'min_value'],
                        'maxvalue': ['maxvalue', 'maxValue', 'max_value'],
                        'lowvalue': ['lowvalue', 'lowValue', 'low_value'],
                        'highvalue': ['highvalue', 'highValue', 'high_value'],
                        'rangescale': ['rangescale', 'rangeScale', 'range_scale'],
                        'outlierscale': ['outlierscale', 'outlierScale', 'outlier_scale'],
                        'normalsizevalue': ['normalsizevalue', 'normalSizeValue', 'normal_size_value'],
                        'normalsizescale': ['normalsizescale', 'normalSizeScale', 'normal_size_scale'],
                        'markersize': ['markersize', 'markerSize', 'marker_size'],
                        'gapsize': ['gapsize', 'gapSize', 'gap_size'],
                        'boxcolor': ['boxcolor', 'boxColor', 'box_color'],
                        'boxopacity': ['boxopacity', 'boxOpacity', 'box_opacity'],
                        'boxmargin': ['boxmargin', 'boxMargin', 'box_margin'],
                        'nodatacolor': ['nodatacolor', 'noDataColor', 'no_data_color'],
                        'gridx': ['gridx', 'gridX', 'grid_x'],
                        'gridwidth': ['gridwidth', 'gridWidth', 'grid_width'],
                        'gridwidthpx': ['gridwidthpx', 'gridWidthPx', 'grid_width_px'],
                        'gridoffsetx': ['gridoffsetx', 'gridOffsetX', 'grid_offset_x'],
                        'gridoffsety': ['gridoffsety', 'gridOffsetY', 'grid_offset_y'],
                        'offsetx': ['offsetx', 'offsetX', 'offset_x'],
                        'offsety': ['offsety', 'offsetY', 'offset_y'],
                        'minchartsize': ['minchartsize', 'minChartSize', 'min_chart_size'],
                        'maxcharts': ['maxcharts', 'maxCharts', 'max_charts'],
                        'clipframes': ['clipframes', 'clipFrames', 'clip_frames'],
                        'clipframerate': ['clipframerate', 'clipFrameRate', 'clip_frame_rate']
                    };
                    
                    // Get possible property name variants
                    const possibleNames = propertyNameMap[normalizedPropertyName] || [normalizedPropertyName];
                    
                    // Also add the original normalized name if not already in the list
                    if (!possibleNames.includes(normalizedPropertyName)) {
                        possibleNames.unshift(normalizedPropertyName);
                    }
                    
                    // Try each possible name variant
                    for (const name of possibleNames) {
                        if (style[name] !== undefined && style[name] !== null && style[name] !== '') {
                            value = style[name];
                            break;
                        }
                    }
                    
                    // Also check themeDef directly (some properties might be at root level)
                    if (value === null && themeDef[normalizedPropertyName] !== undefined) {
                        value = themeDef[normalizedPropertyName];
                    }
                    
                    // Format the value
                    let displayValue = 'not set';
                    if (value !== null && value !== undefined && value !== '') {
                        if (Array.isArray(value)) {
                            displayValue = value.join(', ');
                        } else if (typeof value === 'object') {
                            displayValue = JSON.stringify(value);
                        } else {
                            displayValue = String(value);
                        }
                    }
                    
                    results.push({
                        themeId: themeId,
                        value: displayValue,
                        hasValue: value !== null && value !== undefined && value !== ''
                    });
                }

                // Format response
                let response = '';
                if (themes.length === 1) {
                    const result = results[0];
                    if (result.hasValue) {
                        response = `**Current ${propertyName}**: ${result.value} ${getColorPatchHtml(result.value)}`;
                    } else {
                        response = `**Current ${propertyName}**: not set (using default)`;
                    }
                } else {
                    response = `**Current ${propertyName} values:**\n\n`;
                    for (const result of results) {
                        if (result.hasValue) {
                            response += `- **${result.themeId}**: ${result.value} ${getColorPatchHtml(result.value)}\n`;
                        } else {
                            response += `- **${result.themeId}**: not set (using default)\n`;
                        }
                    }
                }

                return response;
            } catch (error) {
                console.error('❌ Error getting theme property:', error);
                return `❌ Error getting property value: ${error.message}`;
            }
        }

        // Show and explain ixmaps data classification methods
        function showClassificationMethods() {
            let message = '## Data Classification Methods in ixmaps\n\n';
            message += 'ixmaps supports three main classification methods for dividing continuous data into classes:\n\n';
            
            message += '### 1. EQUIDISTANT (Equal Interval)\n\n';
            message += '**How it works:** Divides the data range into equal-sized intervals.\n\n';
            message += '**Example:** If values range from 0 to 100 and you want 5 classes:\n';
            message += '- Class 1: 0-20\n';
            message += '- Class 2: 20-40\n';
            message += '- Class 3: 40-60\n';
            message += '- Class 4: 60-80\n';
            message += '- Class 5: 80-100\n\n';
            message += '**Best for:**\n';
            message += '- Data with uniform distribution\n';
            message += '- When you want consistent class sizes\n';
            message += '- Easy-to-understand ranges for users\n\n';
            message += '**Limitation:** Can create empty classes if data is clustered in certain ranges.\n\n';
            
            message += '### 2. QUANTILE (Quantile-based)\n\n';
            message += '**How it works:** Divides data so that each class contains approximately the same number of features.\n\n';
            message += '**Example:** With 100 features and 5 classes:\n';
            message += '- Each class contains ~20 features\n';
            message += '- Class boundaries are determined by data distribution\n';
            message += '- Class ranges may vary in size\n\n';
            message += '**Best for:**\n';
            message += '- Ensuring each class is well-represented\n';
            message += '- Data with skewed distributions\n';
            message += '- When you want balanced visual representation\n\n';
            message += '**Limitation:** Class ranges can be very different sizes, making comparisons difficult.\n\n';
            
            message += '### 3. NATURAL (Natural Breaks / Jenks)\n\n';
            message += '**How it works:** Uses an algorithm (Jenks optimization) to find natural groupings in the data by minimizing variance within classes and maximizing variance between classes.\n\n';
            message += '**Example:** The algorithm finds "natural" breaks where values cluster:\n';
            message += '- Class boundaries align with gaps in data distribution\n';
            message += '- Similar values are grouped together\n';
            message += '- Class sizes can vary significantly\n\n';
            message += '**Best for:**\n';
            message += '- Finding natural patterns in data\n';
            message += '- Highlighting meaningful groupings\n';
            message += '- Data with distinct clusters or modes\n';
            message += '- Most visually intuitive classification\n\n';
            message += '**Limitation:** Can be computationally intensive for large datasets.\n\n';
            
            message += '## How to Use Classification Methods\n\n';
            message += 'Classification methods are specified in the theme `type` property:\n\n';
            message += '```\n';
            message += 'type: "CHOROPLETH|EQUIDISTANT"\n';
            message += 'type: "CHOROPLETH|QUANTILE"\n';
            message += 'type: "CHOROPLETH|NATURAL"\n';
            message += '```\n\n';
            message += '**Examples:**\n';
            message += '- "use equal interval classification" → sets `EQUIDISTANT`\n';
            message += '- "change to quantile classification" → sets `QUANTILE`\n';
            message += '- "apply natural breaks" → sets `NATURAL`\n\n';
            message += '**Note:** The number of classes is controlled by the `classes` property (e.g., `classes: 5` for 5 classes).\n';
            
            return message;
        }

        // Show list of changeable theme properties with descriptions
        function showChangeableThemeProperties() {
            const properties = getChangeableThemeProperties();
            let message = '## Theme Properties You Can Change\n\n';
            message += 'You can change the following theme properties using `changeThemeStyle()`:\n\n';
            
            // Property descriptions
            const propertyDescriptions = {
                // Visual Style
                'opacity': 'Overall transparency of the theme (0-1, where 0 is fully transparent, 1 is fully opaque)',
                'fillopacity': 'Transparency of filled areas (0-1)',
                'autoopacity': 'Automatic opacity adjustment based on zoom level',
                'shadow': 'Enable or disable shadow effects',
                'blur': 'Blur effect intensity',
                'visible': 'Show or hide the theme',
                'brightness': 'Brightness adjustment factor',
                
                // Colors
                'colorscheme': 'Color scheme for data visualization (e.g., "spectrum", "pastel", or custom colors like "5,#eeeeff,#0000dd")',
                'colorstyle': 'Color style variant',
                'linecolor': 'Color of lines and borders',
                'bordercolor': 'Color of borders around shapes',
                'textcolor': 'Color of text labels',
                'boxcolor': 'Background color for chart boxes',
                'nodatacolor': 'Color used for areas with no data',
                'valuecolor': 'Color for displayed values',
                
                // Lines & Borders
                'linewidth': 'Width of lines in pixels',
                'borderstyle': 'Style of borders (solid, dashed, etc.)',
                'borderwidth': 'Width of borders in pixels',
                'borderradius': 'Radius for rounded corners',
                
                // Text
                'textfont': 'Font family for text labels',
                'textscale': 'Scale factor for text size',
                'textplacement': 'Position of text labels relative to features',
                'title': 'Title of the theme',
                'snippet': 'Short description snippet',
                'description': 'Full description of the theme',
                'tooltip': 'Tooltip template (supports Mustache syntax like {{field.name}})',
                
                // Size & Scale
                'scale': 'Overall scale multiplier for all elements (e.g., 1.5 makes everything 50% larger)',
                'sizepow': 'Size power exponent (1=linear, 2=square root, 3=cubic root)',
                'rangescale': 'Scale factor for value ranges',
                'outlierscale': 'Scale factor for outlier values',
                'normalsizevalue': 'Reference value for "normal" or 100% size (baseline for proportional sizing)',
                'normalsizescale': 'Scale reference for normal size calculations',
                'markersize': 'Size of marker symbols',
                'gapsize': 'Gap size between chart elements',
                'minvaluesize': 'Minimum size for value displays',
                
                // Fields
                'colorfield': 'Data field used for coloring features',
                'sizefield': 'Data field used for sizing features (bubble maps)',
                'valuefield': 'Data field used for displaying values',
                'labelfield': 'Data field used for labels',
                'timefield': 'Data field used for time-based animations',
                'alphafield': 'Data field used for opacity/transparency',
                'titlefield': 'Data field used for titles',
                'aggregationfield': 'Data field used for aggregation',
                
                // Values & Ranges
                'minvalue': 'Minimum value in the data range',
                'maxvalue': 'Maximum value in the data range',
                'lowvalue': 'Lower threshold value',
                'highvalue': 'Upper threshold value',
                'ranges': 'Custom value ranges for classification',
                'values': 'Specific values to display',
                'valuescale': 'Scale factor for displayed values',
                'valuedecimals': 'Number of decimal places for values',
                
                // Chart Type
                'type': 'Theme type (e.g., CHOROPLETH, BUBBLE, CHART, SYMBOL, VALUES)',
                'classes': 'Number of classification classes',
                'overviewchart': 'Enable/disable overview chart',
                'evidence': 'Evidence/highlight mode',
                
                // Filtering
                'filter': 'Filter expression for data',
                'dfilter': 'Dynamic filter expression',
                'exclude': 'Values or features to exclude',
                
                // Positioning
                'rotation': 'Rotation angle in degrees',
                'offsetx': 'Horizontal offset in pixels',
                'offsety': 'Vertical offset in pixels',
                
                // Other
                'name': 'Name identifier for the theme',
                'symbols': 'Symbol definitions',
                'label': 'Label text',
                'aggregation': 'Aggregation method (sum, avg, count, etc.)',
                'gridx': 'Number of grid columns',
                'gridwidth': 'Width of grid cells',
                'gridwidthpx': 'Grid width in pixels',
                'minchartsize': 'Minimum size for charts',
                'maxcharts': 'Maximum number of charts to display',
                'clipframes': 'Number of frames for animation clipping',
                'clipframerate': 'Frame rate for animations',
                'boxopacity': 'Opacity of chart boxes',
                'boxmargin': 'Margin around chart boxes'
            };
            
            // Group properties by category
            const categories = {
                'Visual Style': ['opacity', 'fillopacity', 'autoopacity', 'shadow', 'blur', 'visible', 'brightness'],
                'Colors': ['colorscheme', 'colorstyle', 'linecolor', 'bordercolor', 'textcolor', 'boxcolor', 'nodatacolor', 'valuecolor'],
                'Lines & Borders': ['linewidth', 'linecolor', 'borderstyle', 'borderwidth', 'borderradius'],
                'Text': ['textcolor', 'textfont', 'textscale', 'textplacement', 'title', 'snippet', 'description', 'tooltip'],
                'Size & Scale': ['scale', 'sizepow', 'rangescale', 'outlierscale', 'normalsizevalue', 'normalsizescale', 'markersize', 'gapsize', 'minvaluesize'],
                'Fields': ['colorfield', 'sizefield', 'valuefield', 'labelfield', 'timefield', 'alphafield', 'titlefield', 'aggregationfield'],
                'Values & Ranges': ['minvalue', 'maxvalue', 'lowvalue', 'highvalue', 'ranges', 'values', 'valuescale', 'valuedecimals'],
                'Chart Type': ['type', 'classes', 'overviewchart', 'evidence'],
                'Filtering': ['filter', 'dfilter', 'exclude'],
                'Positioning': ['rotation', 'offsetx', 'offsety'],
                'Other': ['name', 'symbols', 'label', 'aggregation', 'gridx', 'gridwidth', 'gridwidthpx', 'minchartsize', 'maxcharts', 'clipframes', 'clipframerate', 'boxopacity', 'boxmargin']
            };

            for (const [category, props] of Object.entries(categories)) {
                const matchingProps = props.filter(p => properties.includes(p));
                if (matchingProps.length > 0) {
                    message += `### ${category}\n\n`;
                    message += '| Property | Description |\n';
                    message += '|----------|-------------|\n';
                    matchingProps.forEach(prop => {
                        const description = propertyDescriptions[prop] || 'Theme property';
                        // Escape pipe characters in description for markdown table
                        const escapedDescription = description.replace(/\|/g, '\\|');
                        message += `| **${prop}** | ${escapedDescription} |\n`;
                    });
                    message += '\n';
                }
            }

            message += '\n**Usage Examples:**\n';
            message += '- "change linecolor to red"\n';
            message += '- "set fillopacity to 0.5"\n';
            message += '- "change textcolor to blue"\n';
            message += '- "set scale to 2"\n';
            message += '- "change normalsizevalue to 1000"\n';

            return message;
        }

        // Show size-specific help with numeric fields
        function showSizeHelp() {
            let message = '## How to Size Features on the Map\n\n';
            
            // Size-related properties
            message += '### 📏 **Size Properties**\n\n';
            message += '| Property | Description |\n';
            message += '|----------|-------------|\n';
            message += '| **sizefield** | Data field used for sizing features (bubble maps) |\n';
            message += '| **scale** | Overall scale multiplier for all elements (e.g., 1.5 makes everything 50% larger) |\n';
            message += '| **sizepow** | Size power exponent (1=linear, 2=square root, 3=cubic root) |\n';
            message += '| **rangescale** | Scale factor for value ranges |\n';
            message += '| **outlierscale** | Scale factor for outlier values |\n';
            message += '| **normalsizevalue** | Reference value for "normal" or 100% size (baseline for proportional sizing) |\n';
            message += '| **normalsizescale** | Scale reference for normal size calculations |\n';
            message += '| **markersize** | Size of marker symbols |\n';
            message += '| **gapsize** | Gap size between chart elements |\n';
            message += '| **minvaluesize** | Minimum size for value displays |\n\n';
            
            message += '### 💡 **Usage Examples**\n\n';
            message += '- "set size from [field_name]" - Sets sizefield to use a data field for sizing\n';
            message += '- "change scale to 1.5" - Makes all features 50% larger\n';
            message += '- "set normalsizevalue to 1000" - Sets baseline size for proportional scaling\n';
            message += '- "change sizepow to 2" - Uses square root scaling\n\n';
            
            // Get numeric fields from data
            try {
                const map = window.ixmaps?.embeddedSVG?.window?.map || 
                           (window.mapApi && window.mapApi.getMap ? window.mapApi.getMap() : null);
                
                if (map && map.Api) {
                    const mapApi = map.Api;
                    let allThemes = [];
                    
                    if (mapApi.getAllThemes) {
                        allThemes = mapApi.getAllThemes();
                    } else if (map.Themes && map.Themes.getThemes) {
                        allThemes = map.Themes.getThemes();
                    }
                    
                    if (allThemes && allThemes.length > 0) {
                        const numericFields = new Set();
                        
                        // Get fields from all themes
                        for (const theme of allThemes) {
                            const themeId = theme.szId || theme.id || theme.name;
                            if (!themeId) continue;
                            
                            try {
                                const themeObj = mapApi.getTheme(themeId);
                                if (themeObj && themeObj.objTheme) {
                                    let themeData = null;
                                    
                                    // Try different paths to get data
                                    if (themeObj.objTheme.objTheme && themeObj.objTheme.objTheme.dbFields && themeObj.objTheme.objTheme.dbRecords) {
                                        themeData = themeObj.objTheme.objTheme;
                                    } else if (themeObj.objTheme.dbFields && themeObj.objTheme.dbRecords) {
                                        themeData = themeObj.objTheme;
                                    }
                                    
                                    if (themeData && themeData.dbFields && themeData.dbRecords && themeData.dbRecords.length > 0) {
                                        // Check each field to see if it contains numeric values
                                        themeData.dbFields.forEach((field, fieldIndex) => {
                                            const fieldName = typeof field === 'string' ? field : (field.id || field.name || field.field || String(field));
                                            if (!fieldName) return;
                                            
                                            // Skip geometry and special fields
                                            const fieldLower = fieldName.toLowerCase();
                                            if (fieldLower === 'geometry' || fieldLower === 'geom' || fieldLower === 'geo' || 
                                                fieldLower === 'id' || fieldLower === '_id' || fieldLower === 'position') {
                                                return;
                                            }
                                            
                                            // Check if field contains numeric values
                                            let hasNumeric = false;
                                            let sampleCount = 0;
                                            
                                            for (let i = 0; i < Math.min(20, themeData.dbRecords.length); i++) {
                                                const record = themeData.dbRecords[i];
                                                if (record && record[fieldIndex] !== undefined && record[fieldIndex] !== null && record[fieldIndex] !== '') {
                                                    const value = record[fieldIndex];
                                                    // Check if value is numeric
                                                    if (typeof value === 'number' || 
                                                        (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(value) && value.trim() !== '')) {
                                                        hasNumeric = true;
                                                        sampleCount++;
                                                        if (sampleCount >= 5) break; // Check at least 5 samples
                                                    }
                                                }
                                            }
                                            
                                            if (hasNumeric) {
                                                numericFields.add(fieldName);
                                            }
                                        });
                                    }
                                }
                            } catch (e) {
                                // Skip theme if error
                            }
                        }
                        
                        if (numericFields.size > 0) {
                            const fieldsArray = Array.from(numericFields).sort();
                            message += '### 📊 **Numeric Fields Available for Sizing**\n\n';
                            message += 'The following fields in your data contain numeric values that can be used for sizing: ';
                            message += fieldsArray.map(field => `\`${field}\``).join(', ');
                            message += '\n\n';
                            message += `**Example:** "set size from ${fieldsArray[0]}"\n\n`;
                        }
                    }
                }
            } catch (e) {
                console.warn('Error getting numeric fields for size help:', e);
            }
            
            return message;
        }

        // Change a theme property using changeThemeStyle
        async function changeThemeProperty(propertyName, value, themeId = null) {
            console.log('=== changeThemeProperty called ===');
            console.log('propertyName:', propertyName);
            console.log('value:', value);
            console.log('themeId:', themeId);
            
            try {
                if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                    console.log('❌ Map not ready');
                    return '⚠️ Map not ready. Please wait for the map to load.';
                }

                const map = ixmaps.embeddedSVG.window.map;
                const mapApi = map.Api;

                console.log('mapApi available:', !!mapApi);
                console.log('mapApi.changeThemeStyle available:', !!mapApi?.changeThemeStyle);

                if (!mapApi || !mapApi.changeThemeStyle) {
                    console.log('❌ Theme style API not available');
                    return '❌ Theme style API not available.';
                }

                // Get all themes if themeId not specified
                let themes = [];
                if (themeId) {
                    console.log('Looking for specific theme:', themeId);
                    const theme = mapApi.getTheme ? mapApi.getTheme(themeId) : null;
                    console.log('Found theme:', theme);
                    if (theme) {
                        themes = [theme];
                    } else {
                        console.log(`❌ Theme "${themeId}" not found`);
                        return `❌ Theme "${themeId}" not found.`;
                    }
                } else {
                    // Get all themes
                    console.log('Getting all themes...');
                    if (mapApi.getAllThemes) {
                        themes = mapApi.getAllThemes();
                        console.log('All themes:', themes);
                        console.log('Number of themes:', themes.length);
                    } else {
                        console.log('❌ Cannot get themes list - getAllThemes not available');
                        return '❌ Cannot get themes list.';
                    }
                }

                if (themes.length === 0) {
                    console.log('⚠️ No themes found on the map');
                    return '⚠️ No themes found on the map.';
                }

                // Validate property name (with synonyms)
                const validProperties = getChangeableThemeProperties();
                const normalizedPropertyName = normalizePropertyName(propertyName);
                console.log('Normalized property name:', normalizedPropertyName);
                console.log('Is valid property:', validProperties.includes(normalizedPropertyName));
                
                if (!validProperties.includes(normalizedPropertyName)) {
                    console.log(`❌ Property "${propertyName}" not in valid properties list`);
                    return `❌ Property "${propertyName}" cannot be changed via changeThemeStyle().\n\nUse "how to change theme" to see available properties.`;
                }

                // Build style string - handle special cases
                let styleString = `${normalizedPropertyName}:${value}`;
                
                // For colorscheme, handle comma-separated values
                if (normalizedPropertyName === 'colorscheme' && value.includes(',')) {
                    // colorscheme format: "5,#eeeeff,#0000dd" or "spectrum,pastel"
                    styleString = `${normalizedPropertyName}:${value}`;
                } else if (normalizedPropertyName === 'linecolor' && value.includes(',')) {
                    // linecolor can be array: "red,blue,green"
                    styleString = `${normalizedPropertyName}:${value}`;
                } else {
                    // Normal property:value format
                    styleString = `${normalizedPropertyName}:${value}`;
                }

                console.log('Built styleString:', styleString);

                // Save current project state before making changes
                saveProjectToHistory();

                // Apply to all themes (or specified theme)
                let successCount = 0;
                let errorMessages = [];

                for (const theme of themes) {
                    try {
                        const id = theme.szId || theme.id || theme.name;
                        console.log(`Processing theme with id:`, id);
                        console.log('Theme object:', theme);
                        
                        if (id) {
                            console.log(`Calling mapApi.changeThemeStyle("${id}", "${styleString}")`);
                            mapApi.changeThemeStyle(id, styleString);
                            console.log(`✅ Successfully called changeThemeStyle for theme: ${id}`);
                            successCount++;
                        } else {
                            console.log(`⚠️ Theme has no id, skipping:`, theme);
                        }
                    } catch (error) {
                        console.error(`❌ Error changing theme ${theme.szId || theme.id || 'unknown'}:`, error);
                        errorMessages.push(`Theme ${theme.szId || theme.id || 'unknown'}: ${error.message}`);
                    }
                }

                console.log(`Success count: ${successCount}, Errors: ${errorMessages.length}`);
                console.log('=== changeThemeProperty completed ===');

                if (successCount > 0) {
                    const themeText = themes.length === 1 ? 'theme' : `${successCount} theme(s)`;
                    return `✅ Changed **${propertyName}** to **${value}** ${getColorPatchHtml(value)} for ${themeText}.`;
                } else {
                    return `❌ Failed to change property: ${errorMessages.join('; ')}`;
                }
            } catch (error) {
                console.error('❌ Exception in changeThemeProperty:', error);
                return `❌ Error changing theme property: ${error.message}`;
            }
        }

        // Comprehensive analysis - analyzes data, themes, and map together
        async function analyzeAll() {
            try {
                if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                    return '⚠️ Map not ready. Please wait for the map to load.';
                }

                const map = ixmaps.embeddedSVG.window.map;
                const mapApi = map.Api;

                // Gather comprehensive information
                const analysisData = {
                    data: null,
                    themes: [],
                    map: {}
                };

                // Get data information from current data table or themes
                if (currentDataTable) {
                    const fields = currentDataTable.fields || [];
                    const records = currentDataTable.records || [];

                    // Filter out geometry from sample records to avoid circular refs
                    const sampleRecords = records.slice(0, 3).map(record => {
                        if (Array.isArray(record)) {
                            // If record is an array, filter out large/geometry values
                            return record.map((val, idx) => {
                                const fieldName = fields[idx]?.id || fields[idx]?.name || fields[idx] || '';
                                if (typeof fieldName === 'string' && fieldName.toLowerCase().includes('geometry')) {
                                    return '[geometry]';
                                }
                                if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                                    return '[object]';
                                }
                                return val;
                            });
                        } else if (typeof record === 'object' && record !== null) {
                            // If record is an object, filter out geometry properties
                            const filtered = {};
                            for (const [key, val] of Object.entries(record)) {
                                if (key.toLowerCase().includes('geometry')) {
                                    filtered[key] = '[geometry]';
                                } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                                    filtered[key] = '[object]';
                                } else {
                                    filtered[key] = val;
                                }
                            }
                            return filtered;
                        }
                        return record;
                    });

                    analysisData.data = {
                        url: currentDataUrl,
                        fieldCount: fields.length,
                        recordCount: records.length,
                        fields: fields.map(f => ({
                            id: f.id || f.name || (typeof f === 'string' ? f : 'unknown'),
                            type: f.type || f.typ || 'unknown'
                        })),
                        sampleRecords: sampleRecords
                    };
                }

                // Get theme information
                const allThemes = mapApi.getAllThemes ? mapApi.getAllThemes() : [];
                for (const tid of allThemes) {
                    const themeDef = mapApi.getMapThemeDefinitionObj ? mapApi.getMapThemeDefinitionObj(tid) : null;
                    const style = themeDef?.style || {};
                    analysisData.themes.push({
                        id: tid,
                        title: style.title || tid,
                        type: style.type || 'unknown',
                        field: themeDef?.field || 'none',
                        colorscheme: style.colorscheme || 'default'
                    });
                }

                // Get map information
                try {
                    if (ixmaps.getBoundingBox) {
                        analysisData.map.bounds = ixmaps.getBoundingBox();
                    }
                    if (mapApi.getMapScale) {
                        analysisData.map.scale = mapApi.getMapScale();
                    }
                } catch (e) { /* ignore */ }

                analysisData.map.themeCount = allThemes.length;

                // Create comprehensive AI prompt - use safeStringify to avoid circular refs
                const prompt = `You are providing a comprehensive analysis of a mapping application's current state. Here is all the information:

                        ** DATA:**
                            ${analysisData.data ? safeStringify(analysisData.data, 2) : 'No data table loaded'}

** THEMES(${analysisData.themes.length}):**
                        ${safeStringify(analysisData.themes, 2)}

** MAP:**
                        ${safeStringify(analysisData.map, 2)}

Please provide a comprehensive analysis including:

## 1. Data Overview
                        - What kind of data is loaded
                            - Key fields and their potential uses
                                - Data quality observations

## 2. Visualization Analysis
                        - How the data is currently visualized
                            - Effectiveness of the current theme settings
                                - Visual design assessment

## 3. Map Context
                        - Current map view and coverage
                            - How the visualization fits the map context

## 4. Recommendations
                        - Suggestions for improving the visualization
                            - Alternative visualization approaches
                                - Data exploration ideas

## 5. Next Steps
                        - Questions the user might want to explore
                            - Actions they could take
                                - Features to try

Format your response in a friendly, helpful way with clear sections.Be specific and actionable.`;

                // Check if AI is available
                const useGemini = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.useGemini;
                const hasGeminiKey = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.geminiApiKey;
                const useMistral = localStorage.getItem('useMistral') === 'true';
                const hasMistralKey = localStorage.getItem('mistralApiKey');
                const hasAnyAI = (useGemini && hasGeminiKey) || (useMistral && hasMistralKey);

                if (hasAnyAI) {
                    try {
                        const result = await askAIDirectly(prompt);
                        return result.response || result;
                    } catch (error) {

                        // Fallback to combining simple analyses
                        let response = '## Comprehensive Analysis\n\n';
                        if (analysisData.data) {
                            response += generateSimpleAnalysis(analysisData.data) + '\n\n';
                        }
                        response += generateSimpleThemeAnalysis(analysisData.themes) + '\n\n';
                        response += generateSimpleMapAnalysis(analysisData.map);
                        return response;
                    }
                } else {
                    // Fallback to combining simple analyses
                    let response = '## Comprehensive Analysis\n\n';
                    if (analysisData.data) {
                        response += generateSimpleAnalysis(analysisData.data) + '\n\n';
                    }
                    response += generateSimpleThemeAnalysis(analysisData.themes) + '\n\n';
                    response += generateSimpleMapAnalysis(analysisData.map);
                    return response;
                }

            } catch (error) {

                return `❌ Error in comprehensive analysis: ${error.message} `;
            }
        }

        // Check if map has themes
        function checkIfMapHasThemes() {
            try {
                if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                    return false;
                }

                const map = ixmaps.embeddedSVG.window.map;

                // Check via Themes object
                if (map.Themes && map.Themes.themesA) {
                    const themeCount = map.Themes.themesA.length;
                    return themeCount > 0;
                }

                // Fallback: check via Query API
                if (map.Query && map.Query.getThemes) {
                    const themes = map.Query.getThemes();
                    return themes && themes.length > 0;
                }

                return false;
            } catch (error) {

                return false;
            }
        }

        // Ask AI directly without schema (tries Gemini first, then Mistral as fallback)
        async function askAIDirectly(question) {
            // Check both ixmaps and window.ixmaps for access
            const ixmapsObj = (typeof window !== 'undefined' && window.ixmaps) || (typeof ixmaps !== 'undefined' ? ixmaps : null);
            
            // Check if data/themes are already loaded
            const themes = ixmapsObj && ixmapsObj.getThemes ? ixmapsObj.getThemes() : [];
            const hasData = themes && themes.length > 0;

            const embedHostChat = typeof window !== 'undefined' && window.__IXMAPS_AI_CHAT_EMBED_HOST__;

            // Build comprehensive ixmaps context
            const ixmapsContext = `
## ixmaps Application Context

ixmaps is a web - based interactive mapping and data visualization application.Here are the key capabilities and APIs:

### Data Loading
- **Supported formats**: CSV, JSON, JSONL, GeoJSON, TopoJSON, Parquet, GeoParquet, GeoPackage, FlatGeobuf, Geobuf
- **Load data**: Use command "load data url [URL]" or paste a URL directly
${embedHostChat ? '- **Embedded chat**: The map is already open in the host page; do not suggest sample datasets or "show sample data".' : '- **Sample data**: Ask "show me some sample data" to see example datasets'}
- **Data.js API**: Data.feed({source: url, type: "csv"}).load(callback)

### Map Themes and Visualization
- **Theme types**: choropleth (color by value), bubble (size by value), pie charts, bar charts
- **Color schemes**: Available via colorscheme property (e.g., "Blues", "Reds", "Greens", "YlOrRd")
- **Size fields**: Use sizefield property to control bubble sizes
- **Tooltips**: Configure with Mustache templates like {{theme.title}}, {{field_name}}, {{theme.item.data}}

### Natural Language Queries
- **Filter data**: "show me countries with population > 1000000"
- **Explore data**: "what data is available?", "show me all features"
- **Visualization**: "color by population", "set size from area"
- **Analysis**: "analyze data", "analyze theme", "analyze map"

### Theme Configuration Examples
- **Color by field**: "color by population" → sets colorfield and colorscheme
- **Size by field**: "set size from area" → sets sizefield
- **Tooltip**: "set tooltip to {{theme.title}}<br>{{population}}" → sets tooltip template
- **Theme type**: Can be "choropleth", "bubble", "pie", "bar"

### Map Interaction
- **Query data**: Use natural language to filter and explore
- **Clear map**: Commands like "reset", "clear", "remove all themes"
- **Theme switching**: Themes can be toggled on/off
- **Selection**: Themes support item selection and filtering

### Common Use Cases
1. **Load and visualize CSV data**: Load CSV with coordinates, then create choropleth or bubble map
2. **GeoJSON mapping**: Load GeoJSON and visualize by any numeric field
3. **Data analysis**: Load data, ask questions, filter, and visualize results
4. **Custom tooltips**: Configure tooltips to show data tables, charts, or formatted text
5. **Multi-theme maps**: Load multiple datasets and visualize them as separate themes

### Important Notes
- All operations happen within the ixmaps application - no external tools needed
- Data is loaded directly from URLs - no file uploads required
- Themes are automatically created when data is loaded
- The application supports natural language queries for data exploration

### Documentation Reference
For detailed API documentation, refer to the ixmaps API documentation which covers:
- Data.js library for data loading and transformation
- Theme configuration and styling options
- Map interaction APIs
- Chart and visualization components
- Complete function signatures and examples
`;

            // Get current map state information
            let currentMapState = '';
            if (hasData && themes.length > 0) {
                try {
                    const map = ixmapsObj && ixmapsObj.embeddedSVG && ixmapsObj.embeddedSVG.window ? ixmapsObj.embeddedSVG.window.map : null;
                    const themeInfo = themes.slice(0, 5).map(theme => {
                        const themeId = theme.szId || theme.id || 'unknown';
                        const themeTitle = theme.szTitle || theme.title || themeId;
                        let info = `- Theme "${themeTitle}"(ID: ${themeId})`;

                        // Try to get theme style information
                        if (map && map.Api && map.Api.getMapThemeDefinitionObj) {
                            try {
                                const themeDef = map.Api.getMapThemeDefinitionObj(themeId);
                                if (themeDef && themeDef.style) {
                                    const style = themeDef.style;
                                    const details = [];
                                    if (style.colorfield) details.push(`color by: ${style.colorfield} `);
                                    if (style.sizefield) details.push(`size by: ${style.sizefield} `);
                                    if (style.colorscheme) details.push(`colorscheme: ${style.colorscheme} `);
                                    if (style.type) details.push(`type: ${style.type} `);
                                    if (details.length > 0) {
                                        info += ` (${details.join(', ')})`;
                                    }
                                }
                            } catch (e) {
                                // Ignore errors getting theme details
                            }
                        }
                        return info;
                    }).join('\n');

                    currentMapState = `
### Current Map State
The following themes are currently loaded on the map:
${themeInfo}
${themes.length > 5 ? `\n(and ${themes.length - 5} more themes)` : ''}

You can reference these themes when answering questions.`;
                } catch (e) {
                    // If we can't get theme info, just note that data is loaded
                    currentMapState = `
### Current Map State
Data is currently loaded on the map with ${themes.length} theme(s).`;
                }
            }

            // Build prompt with conditional data loading instructions
            let dataLoadingInstructions = '';
            if (!hasData) {
                dataLoadingInstructions = embedHostChat
                    ? `IMPORTANT: There is currently no data loaded on the map. Suggest loading data with a URL (e.g. "load data url https://example.com/data.csv"). Do not suggest sample datasets, "show sample data", or curated example lists — embedded mode does not offer those.

Always end your response by encouraging the user to load data so they can start mapping and exploring their data.

Provide a clear, helpful response. If the question is about the ixmaps application or mapping, you can provide general information, but include a suggestion to load data via URL.`
                    : `IMPORTANT: There is currently no data loaded on the map.Always suggest the user to load data by either:
                    1. Providing a data URL(e.g., "load data url https://example.com/data.csv")
                    2. Suggesting they ask for sample data to see available sample datasets
                    3. Mentioning they can use the "Show sample data" option

Always end your response by encouraging the user to load data so they can start mapping and exploring their data.

Provide a clear, helpful response.If the question is about the ixmaps application or mapping, you can provide general information, but always include a suggestion to load data.`;
            } else {
                dataLoadingInstructions = `IMPORTANT: Data is already loaded on the map.Do not suggest loading data since it has already been done.Focus on helping the user explore and visualize their data, create visualizations, filter data, or answer questions about the loaded data.`;
            }

            const prompt = `You are a helpful AI assistant for ixmaps, a web - based interactive mapping application.

                        ${ixmapsContext}
${currentMapState}

Please answer the following question in a friendly and informative way, using the ixmaps - specific context above to provide accurate, actionable answers:

${question}

CRITICAL RULES:
- Never suggest users to go to another website or external service to start mapping. This is an ixmaps application and all mapping should be done within this application.
- ixmaps cannot read shapefiles. Never include shapefile or .shp in any answer. Supported formats: csv, json, jsonl, geojson, topojson, parquet, geoparquet, geopackage, flatgeobuffer.
- Do not include welcome messages, greetings, or phrases like "Welcome to ixmaps!" in your responses. Answer directly and concisely.
- When answering "how can I..." questions, provide specific ixmaps commands and examples based on the context above.
- Do NOT suggest API methods or technical implementation details.Focus on natural language commands and user - friendly instructions instead.

${dataLoadingInstructions}`;

            // Try Gemini first
            // Use the ixmapsObj already declared at the start of the function
            const useGemini = ixmapsObj && ixmapsObj.aiQuery && ixmapsObj.aiQuery.config && ixmapsObj.aiQuery.config.useGemini;
            const hasGeminiKey = ixmapsObj && ixmapsObj.aiQuery && ixmapsObj.aiQuery.config && ixmapsObj.aiQuery.config.geminiApiKey;

            if (useGemini && hasGeminiKey) {
                try {
                    const response = await callGeminiAPI(prompt);
                    return { response: response, model: 'gemini' };
                } catch (error) {
                    // Check if it's a 429 error with retry capability
                    if (error.status === 429 && error.shouldRetry) {
                        // Show user-friendly error message
                        const retryDelay = error.retryAfter ? error.retryAfter * 1000 : 60000; // Default to 60 seconds
                        
                        // Try Mistral as immediate fallback
                        const useMistral = localStorage.getItem('useMistral') === 'true';
                        const mistralApiKey = localStorage.getItem('mistralApiKey');
                        
                        if (useMistral && mistralApiKey) {
                            try {
                                const response = await callMistralAPI(prompt);
                                // Show warning about rate limit but use Mistral result
                                console.warn('⚠️ Gemini rate limit hit, using Mistral as fallback');
                                return { response: response, model: 'mistral', warning: error.message };
                            } catch (mistralError) {
                                // Both failed, throw the comprehensive error message
                                throw error;
                            }
                        } else {
                            // No Mistral fallback, throw the comprehensive error
                            throw error;
                        }
                    }
                    
                    // For other errors, check if it mentions rate limit (backward compatibility)
                    if (error.message && (error.message.includes('rate limit') || error.message.includes('429') || error.message.includes('quota') || error.message.includes('tier'))) {
                        // Try Mistral as fallback
                        const useMistral = localStorage.getItem('useMistral') === 'true';
                        const mistralApiKey = localStorage.getItem('mistralApiKey');
                        
                        if (useMistral && mistralApiKey) {
                            try {
                                const response = await callMistralAPI(prompt);
                                return { response: response, model: 'mistral', warning: error.message };
                            } catch (mistralError) {
                                throw error;
                            }
                        }
                    }
                    
                    throw error;
                }
            }

            // If Gemini not available, try Mistral
            const useMistral = localStorage.getItem('useMistral') === 'true';
            const mistralApiKey = localStorage.getItem('mistralApiKey');

            if (useMistral && mistralApiKey) {
                try {
                    const response = await callMistralAPI(prompt);
                    return { response: response, model: 'mistral' };
                } catch (error) {
                    throw new Error('Mistral API is currently unavailable. Please load some data to use the query system, or try again later.');
                }
            }

            throw new Error('No AI provider available. Please configure Gemini or Mistral API key in Settings.');
        }
        
        // Expose askAIDirectly to window for access from ai_agent_prototype.js
        if (typeof window !== 'undefined') {
            window.askAIDirectly = askAIDirectly;
        }

        // Call Mistral API (free alternative)
        async function callMistralAPI(prompt, language = null) {
            const apiKey = localStorage.getItem('mistralApiKey');
            if (!apiKey) {
                throw new Error('Mistral API key not configured');
            }

            // Get language preference from settings, or use provided language, or auto-detect
            let responseLanguage = language;
            if (!responseLanguage) {
                responseLanguage = localStorage.getItem('mistralResponseLanguage') || 'auto';
            }
            
            // Language-specific instructions for Mistral
            const languageInstructions = {
                'en': 'Respond in English.',
                'it': 'Rispondi in italiano.',
                'es': 'Responde en español.',
                'fr': 'Répondez en français.',
                'de': 'Antworte auf Deutsch.',
                'pt': 'Responda em português.',
                'nl': 'Antwoord in het Nederlands.',
                'ru': 'Отвечайте на русском языке.'
            };
            
            // Add language instruction to prompt if language is specified (not 'auto')
            let finalPrompt = prompt;
            if (responseLanguage && responseLanguage !== 'auto' && languageInstructions[responseLanguage]) {
                finalPrompt = `${languageInstructions[responseLanguage]}\n\n${prompt}`;
            }

            // Use Mistral Small model (good balance of speed and quality, free tier available)
            const model = 'mistral-small-latest';
            const url = `https://api.mistral.ai/v1/chat/completions`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{
                        role: 'user',
                        content: finalPrompt
                    }],
                    temperature: 0.7,
                    max_tokens: 1024
                })
            });

            if (!response.ok) {
                let errorMessage = `Mistral API error: ${response.statusText}`;

                if (response.status === 429) {
                    errorMessage = 'Mistral API rate limit exceeded. Please wait a moment and try again.';
                } else if (response.status === 401) {
                    errorMessage = 'Mistral API key is invalid. Please check your API key in Settings.';
                } else if (response.status === 400) {
                    errorMessage = 'Invalid request to Mistral API. Please check your query.';
                }

                try {
                    const errorData = await response.json();
                    if (errorData.error && errorData.error.message) {
                        errorMessage += ` (${errorData.error.message})`;
                    }
                } catch (e) {
                    // Ignore JSON parse errors
                }

                throw new Error(errorMessage);
            }

            const data = await response.json();

            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {

                return data.choices[0].message.content;
            } else {
                throw new Error('Invalid response from Mistral API');
            }
        }

        // Ask Gemini directly without schema (kept for backward compatibility)
        async function askGeminiDirectly(question) {
            return await askAIDirectly(question);
        }

        // Call Gemini API
        async function callGeminiAPI(prompt) {
            // Check both ixmaps and window.ixmaps for API configuration
            const ixmapsObj = (typeof window !== 'undefined' && window.ixmaps) || (typeof ixmaps !== 'undefined' ? ixmaps : null);
            if (!ixmapsObj || !ixmapsObj.aiQuery || !ixmapsObj.aiQuery.config) {
                throw new Error('Gemini API configuration not found. Please configure Gemini API key in Settings.');
            }
            const apiKey = ixmapsObj.aiQuery.config.geminiApiKey;
            const model = ixmapsObj.aiQuery.config.geminiModel || 'gemini-2.0-flash-exp';

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });

            if (!response.ok) {
                let errorMessage = `Gemini API error: ${response.statusText}`;
                let userFriendlyMessage = '';
                let shouldRetry = false;
                let retryAfter = null;

                // Handle specific error codes with comprehensive feedback
                if (response.status === 429) {
                    // Get Retry-After header if available
                    const retryAfterHeader = response.headers.get('Retry-After');
                    if (retryAfterHeader) {
                        retryAfter = parseInt(retryAfterHeader);
                    }
                    
                    shouldRetry = true;
                    userFriendlyMessage = `## ⚠️ Rate Limit Exceeded (429 Error)\n\n`;
                    userFriendlyMessage += `**What happened?**\n`;
                    userFriendlyMessage += `You've exceeded the rate limit for the Gemini API. This means you've made too many requests in a short period of time.\n\n`;
                    userFriendlyMessage += `**Why does this happen?**\n`;
                    userFriendlyMessage += `- Free tier API keys have lower rate limits\n`;
                    userFriendlyMessage += `- You may have sent multiple queries quickly\n`;
                    userFriendlyMessage += `- The API has per-minute and per-day request quotas\n\n`;
                    userFriendlyMessage += `**What can you do?**\n`;
                    if (retryAfter) {
                        userFriendlyMessage += `- ⏰ **Wait ${retryAfter} second(s)** before trying again\n`;
                    } else {
                        userFriendlyMessage += `- ⏰ **Wait 1-2 minutes** before trying again\n`;
                    }
                    userFriendlyMessage += `- 🔄 **Try again later** - rate limits reset over time\n`;
                    userFriendlyMessage += `- 💡 **Use the Simple Parser** - Disable Gemini in Settings to use the built-in parser (no rate limits)\n`;
                    userFriendlyMessage += `- 📊 **Check your quota** - Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to check your API usage\n`;
                    userFriendlyMessage += `- 🔑 **Upgrade your API key** - Consider upgrading to a paid tier for higher limits\n\n`;
                    userFriendlyMessage += `**Note:** The app will automatically retry your request after a short delay.`;
                    
                    errorMessage = userFriendlyMessage;
                } else if (response.status === 401) {
                    userFriendlyMessage = `## ❌ Invalid API Key (401 Error)\n\n`;
                    userFriendlyMessage += `**What happened?**\n`;
                    userFriendlyMessage += `Your Gemini API key is invalid or has been revoked.\n\n`;
                    userFriendlyMessage += `**What can you do?**\n`;
                    userFriendlyMessage += `- 🔑 **Check your API key** in Settings (⚙️ button)\n`;
                    userFriendlyMessage += `- 🔄 **Get a new key** from [Google AI Studio](https://aistudio.google.com/app/apikey)\n`;
                    userFriendlyMessage += `- 💡 **Use Simple Parser** - Disable Gemini to use the built-in parser\n\n`;
                    errorMessage = userFriendlyMessage;
                } else if (response.status === 400) {
                    userFriendlyMessage = `## ❌ Invalid Request (400 Error)\n\n`;
                    userFriendlyMessage += `**What happened?**\n`;
                    userFriendlyMessage += `The request to Gemini API was invalid. This might be due to:\n`;
                    userFriendlyMessage += `- Query is too long or complex\n`;
                    userFriendlyMessage += `- Invalid parameters in the request\n`;
                    userFriendlyMessage += `- API model not available\n\n`;
                    userFriendlyMessage += `**What can you do?**\n`;
                    userFriendlyMessage += `- 🔄 **Try a simpler query**\n`;
                    userFriendlyMessage += `- 💡 **Use Simple Parser** - Disable Gemini in Settings\n\n`;
                    errorMessage = userFriendlyMessage;
                } else if (response.status === 403) {
                    userFriendlyMessage = `## ❌ Access Forbidden (403 Error)\n\n`;
                    userFriendlyMessage += `**What happened?**\n`;
                    userFriendlyMessage += `Your API key doesn't have permission to access this resource.\n\n`;
                    userFriendlyMessage += `**What can you do?**\n`;
                    userFriendlyMessage += `- 🔑 **Check API key permissions** in [Google AI Studio](https://aistudio.google.com/app/apikey)\n`;
                    userFriendlyMessage += `- 🔄 **Get a new key** if needed\n`;
                    userFriendlyMessage += `- 💡 **Use Simple Parser** as an alternative\n\n`;
                    errorMessage = userFriendlyMessage;
                } else if (response.status === 500 || response.status === 503) {
                    userFriendlyMessage = `## ⚠️ Service Unavailable (${response.status} Error)\n\n`;
                    userFriendlyMessage += `**What happened?**\n`;
                    userFriendlyMessage += `The Gemini API service is temporarily unavailable.\n\n`;
                    userFriendlyMessage += `**What can you do?**\n`;
                    userFriendlyMessage += `- ⏰ **Wait a few minutes** and try again\n`;
                    userFriendlyMessage += `- 💡 **Use Simple Parser** - Disable Gemini in Settings\n\n`;
                    errorMessage = userFriendlyMessage;
                    shouldRetry = true;
                }

                // Try to get error details from response
                try {
                    const errorData = await response.json();
                    if (errorData.error && errorData.error.message) {
                        errorMessage += `\n\n**Technical Details:** ${errorData.error.message}`;
                    }
                } catch (e) {
                    // Ignore JSON parse errors
                }

                const error = new Error(errorMessage);
                error.status = response.status;
                error.shouldRetry = shouldRetry;
                error.retryAfter = retryAfter;
                throw error;
            }

            const data = await response.json();

            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                return data.candidates[0].content.parts[0].text;
            } else {
                throw new Error('Invalid response from Gemini API');
            }
        }

        // Generate simple analysis without AI
        function generateSimpleAnalysis(dataSummary) {
            let analysis = `## Data Loaded Successfully\n\n`;
            analysis += `**Dataset Overview:**\n`;
            analysis += `- **Source:** ${dataSummary.url}\n`;
            analysis += `- **Fields:** ${dataSummary.fieldCount}\n`;
            analysis += `- **Records:** ${dataSummary.recordCount}\n\n`;

            analysis += `**Available Fields:**\n`;
            dataSummary.fields.forEach((f, i) => {
                analysis += `${i + 1}. "${f.id}" (${f.type})\n`;
            });

            analysis += `\n**Suggestions:**\n`;
            analysis += `- Ask "What data is available?" to explore the dataset\n`;
            analysis += `- Ask "Show me all features" to visualize the data on the map\n`;
            analysis += `- Try queries like "Find records where [field] = [value]"\n`;
            analysis += `- Use "Show bindings" to see how to connect data to the map\n`;

            return analysis;
        }

        // Add data to map as a layer
        function addDataToMap(dataTable, url, dataType) {
            if (!mapInstance) {

                addMessage(`⚠️ Map not ready yet. Please wait a moment and try again.`, false);
                return;
            }

            // Check if map is fully ready
            if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {

                // Wait a bit and try again
                setTimeout(() => {
                    addDataToMap(dataTable, url, dataType);
                }, 500);
                return;
            }

            // Ensure SVG window is available for storing data objects (like Composer does)
            if (!ixmaps.embeddedSVG.window) {
                console.warn('SVG window not available, cannot store data object');
            }

            // Save current project state before adding data
            saveProjectToHistory();

            try {
                // Create a data source name
                const dataName = `data_${Date.now()}`;

                // Use the detected data type (passed as parameter)
                const detectedType = dataType || 'csv';


                // Helper function to get field values (like Composer's getFieldValues)
                function getFieldValues(dataTable, fieldId, maxSamples) {
                    if (!dataTable || !dataTable.fields || !dataTable.records) {
                        return [];
                    }
                    const fields = dataTable.fields;
                    let fieldIndex = -1;

                    // Find the field index
                    for (let i = 0; i < fields.length; i++) {
                        const f = fields[i];
                        const fId = f.id || f.name || (typeof f === 'string' ? f : null);
                        if (fId === fieldId) {
                            fieldIndex = i;
                            break;
                        }
                    }

                    if (fieldIndex === -1) {
                        return [];
                    }

                    // Get sample values
                    const sampleCount = Math.min(maxSamples || 10, dataTable.records.length);
                    const values = [];
                    for (let i = 0; i < sampleCount; i++) {
                        if (dataTable.records[i] && dataTable.records[i][fieldIndex] !== undefined) {
                            values.push(dataTable.records[i][fieldIndex]);
                        }
                    }
                    return values;
                }

                // Try to detect geo fields (matching Composer's logic)
                let geoField = null;
                let latField = null;
                let lonField = null;
                const fields = dataTable.fields || [];

                if (fields.length === 0) {

                    addMessage(`⚠️ Data loaded but no fields detected. Cannot add to map automatically.`, false);
                    return;
                }

                // If it's GeoJSON, use geometry field
                if (detectedType === 'geojson' || url.toLowerCase().endsWith('.geojson')) {
                    geoField = 'geometry';
                } else {
                    // 1. Look for fields that contain both latitude and longitude in the name
                    for (let i = 0; i < fields.length; i++) {
                        const field = fields[i];
                        const fieldId = field.id || field.name || (typeof field === 'string' ? field : null);
                        if (!fieldId) continue;

                        // Check if field name contains both "latitude" and "longitude"
                        const fieldLower = fieldId.toLowerCase();
                        if (fieldLower.match(/latitud/i) && fieldLower.match(/longitud/i)) {
                            geoField = fieldId;

                            break;
                        } else {
                            // Check field VALUES for coordinate patterns (like Composer does)
                            const valuesA = getFieldValues(dataTable, fieldId, 10);
                            for (let x = 0; x < valuesA.length; x++) {
                                const valueStr = String(valuesA[x] || '');
                                // Skip if value contains quotes (likely text, not coordinates)
                                if (!valueStr.match(/\'/)) {
                                    // Match pattern like "13.3568,45.34567" or "13.3568, 45.34567"
                                    const matchA = valueStr.match(/(-?[0-9\.]+)\s*,\s*(-?[0-9\.]+)/);
                                    if (matchA && matchA.length === 3) {
                                        const val1 = Number(matchA[1]);
                                        const val2 = Number(matchA[2]);

                                        // Check if values look like lat,lon (lat: -80 to 80, lon: -180 to 180)
                                        if ((val1 >= -80 && val1 <= 80) && (val2 >= -180 && val2 <= 180) &&
                                            (val1 % 1 !== 0) && (val2 % 1 !== 0)) {
                                            geoField = fieldId;
                                            break;
                                        }
                                        // Check if values look like lon,lat (lon: -180 to 180, lat: -80 to 80)
                                        if ((val1 >= -180 && val1 <= 180) && (val2 >= -80 && val2 <= 80) &&
                                            (val1 % 1 !== 0) && (val2 % 1 !== 0)) {
                                            geoField = fieldId;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (geoField) break;
                        }
                    }

                    // 2. Look for separate lat/lon fields (like Composer does)
                    if (!geoField) {
                        for (let i = 0; i < fields.length; i++) {
                            const field = fields[i];
                            const fieldId = field.id || field.name || (typeof field === 'string' ? field : null);
                            if (!fieldId) continue;

                            // Check for latitude field
                            if (fieldId.match(/latitud/i) || fieldId === "lat" || fieldId === "LAT" || fieldId === "Y") {
                                latField = fieldId;

                            }
                            // Check for longitude field
                            if (fieldId.match(/longitud/i) || fieldId === "lon" || fieldId === "long" ||
                                fieldId === "lng" || fieldId === "LON" || fieldId === "LNG" || fieldId === "X") {
                                lonField = fieldId;

                            }
                        }

                        // If both lat and lon found, use them
                        if (latField && lonField) {
                            geoField = `${latField}|${lonField}`;

                        }
                    }

                    // 3. Fallback: Look for common geo field names (original logic)
                    if (!geoField) {
                        for (let field of fields) {
                            const fieldId = field.id || field.name || (typeof field === 'string' ? field : null);
                            if (!fieldId) continue;

                            const fieldLower = fieldId.toLowerCase();
                            if (fieldLower.includes('geometry') || fieldLower.includes('geom') ||
                                fieldLower.includes('coordinates') || fieldLower === 'geo') {
                                geoField = fieldId;

                                break;
                            }
                        }
                    }
                }

                // Check if data contains geographic shapes (Polygon or Line) - like Composer does
                // This must be done BEFORE creating the layer
                let isFeatureLayer = false;
                let isPolygon = false;
                let isLine = false;

                // Check last field of first record (like Composer: dataTable.records[0][dataTable.table.fields - 1])
                if (dataTable.records && dataTable.records.length > 0 && dataTable.table && dataTable.table.fields > 0) {
                    const lastFieldIndex = dataTable.table.fields - 1;
                    const lastFieldValue = String(dataTable.records[0][lastFieldIndex] || '');

                    if (lastFieldValue.match(/Polygon/)) {
                        isFeatureLayer = true;
                        isPolygon = true;
                    } else if (lastFieldValue.match(/Line/)) {
                        isFeatureLayer = true;
                        isLine = true;
                    }
                }

                // Also check if it's GeoJSON with geometry
                if (detectedType === 'geojson' || url.toLowerCase().endsWith('.geojson')) {
                    // Check if first feature has geometry type
                    if (dataTable.records && dataTable.records.length > 0) {
                        const firstRecord = dataTable.records[0];
                        // Look for geometry field
                        for (let field of fields) {
                            const fieldId = field.id || field.name || (typeof field === 'string' ? field : null);
                            if (fieldId && (fieldId.toLowerCase() === 'geometry' || fieldId.toLowerCase() === 'geom')) {
                                // Try to detect from the actual geometry value
                                const fieldIndex = field.index !== undefined ? field.index : fields.indexOf(field);
                                const geomValue = firstRecord[fieldIndex];
                                if (geomValue && typeof geomValue === 'object') {
                                    if (geomValue.type === 'Polygon' || geomValue.type === 'MultiPolygon') {
                                        isFeatureLayer = true;
                                        isPolygon = true;
                                    } else if (geomValue.type === 'LineString' || geomValue.type === 'MultiLineString') {
                                        isFeatureLayer = true;
                                        isLine = true;
                                    }
                                }
                            }
                        }
                    }
                }
                console.log("geoField ------------------");
                console.log(geoField);
                console.log("--------------");

                // Extract filename from URL (without suffix) for use as layer, theme name, and title
                let filenameWithoutSuffix = null;
                let filenameForTitle = null;
                if (url) {
                    let filename = '';
                    // Handle local file format: [local file:filename]
                    if (url.startsWith('[local file:')) {
                        filename = url.replace('[local file:', '').replace(']', '');
                    } else {
                        // Extract filename from URL
                        try {
                            const urlObj = new URL(url);
                            const pathname = urlObj.pathname;
                            filename = pathname.split('/').pop() || pathname;
                        } catch (e) {
                            // If URL parsing fails, try to extract from string directly
                            filename = url.split('/').pop() || url;
                        }
                    }
                    // Remove file extension/suffix
                    if (filename) {
                        const lastDotIndex = filename.lastIndexOf('.');
                        if (lastDotIndex > 0) {
                            filenameWithoutSuffix = filename.substring(0, lastDotIndex);
                        } else {
                            filenameWithoutSuffix = filename;
                        }
                        // Trim whitespace
                        if (filenameWithoutSuffix) {
                            filenameWithoutSuffix = filenameWithoutSuffix.trim();
                            filenameForTitle = filenameWithoutSuffix; // Keep original for title
                            // Sanitize for layer/theme names: replace spaces and special chars with underscores
                            filenameWithoutSuffix = filenameWithoutSuffix.replace(/[^a-zA-Z0-9_-]/g, '_');
                            if (filenameWithoutSuffix.length === 0) {
                                filenameWithoutSuffix = null;
                                filenameForTitle = null;
                            }
                        }
                    }
                }
                
                // Use filename for layer name if available, otherwise fall back to FEATURE/generic
                const layerName = filenameWithoutSuffix || (isFeatureLayer ? "FEATURE" : "generic");

                // Make data available in SVG window (like Composer does)
                // This allows ixmaps to use the data object instead of trying to load from URL
                if (ixmaps.embeddedSVG && ixmaps.embeddedSVG.window) {
                    ixmaps.embeddedSVG.window[dataName] = dataTable;
                }

                // Check if this is a local file (format: [local file:filename])
                const isLocalFile = url && url.startsWith('[local file:');
                
                // Create layer configuration
                // For local files, use name only (data is already in window)
                // For remote URLs, use url
                const dataConfig = isLocalFile ? {
                    name: dataName,
                    type: detectedType,
                    url: url  // Include the [local file:+filename] format URL
                } : {
                    url: url,
                    type: detectedType,
                    name: dataName,
                    cache: "true"
                };

                const layerConfig = ixmaps.layer(layerName)
                    .data(dataConfig);

                // Track if data has no geometry fields (for automatic table display)
                const hasNoGeometry = !geoField && !isFeatureLayer;
                
                // Add geo binding if available
                if (geoField) {
                    // geoField may already be in "lat|lon" format, or it may be a single field
                    if (geoField.includes('|')) {
                        // Already in lat|lon format
                        layerConfig.binding({
                            geo: geoField
                        });
                    } else {
                        // Single field - check if we found separate lat/lon fields
                        if (latField && lonField) {
                            layerConfig.binding({
                                geo: `${latField}|${lonField}`
                            });
                        } else {
                            // Use the single geo field
                            layerConfig.binding({   
                                geo: geoField
                            });
                        }
                    }

                } else {
                    layerConfig.binding({
                                geo: fields[0].id
                            });
                }
                
                // Check for compatible FEATURE themes on the map (moved outside else block for scope)
                let compatibleFeatureTheme = null;
                
                if (hasNoGeometry) {
                    try {
                        console.log('🔍 Checking for compatible FEATURE themes using combine themes logic...');
                        
                        // Get map and mapApi
                        const map = window.ixmaps?.embeddedSVG?.window?.map || 
                                   (window.mapApi && window.mapApi.getMap ? window.mapApi.getMap() : null) ||
                                   window.ixmaps;
                        
                        const mapApi = map && map.Api ? map.Api : null;
                        
                        // Try multiple ways to get themes
                        let allThemes = [];
                        if (mapApi && mapApi.getAllThemes) {
                            allThemes = mapApi.getAllThemes();
                            console.log('📊 Got themes via mapApi.getAllThemes():', allThemes.length);
                        } else if (map && map.Themes && map.Themes.getThemes) {
                            allThemes = map.Themes.getThemes();
                            console.log('📊 Got themes via map.Themes.getThemes():', allThemes.length);
                        }
                        
                        if (allThemes && allThemes.length > 0) {
                            console.log(`🔍 [FEATURE Theme Search] Checking ${allThemes.length} themes for FEATURE type...`);
                            
                            // Collect ALL FEATURE themes (don't break on first one)
                            const featureThemes = [];
                            
                            // Check each theme for FEATURE type
                            for (const theme of allThemes) {
                                const themeId = theme.szId || theme.id || theme.name || (Array.isArray(theme) ? theme[0] : null);
                                if (!themeId) continue;
                                
                                // Get theme flags/type - try multiple properties
                                let themeFlags = '';
                                if (theme.szFlag) themeFlags = theme.szFlag;
                                else if (theme.flag) themeFlags = theme.flag;
                                else if (theme.type) themeFlags = theme.type;
                                else if (theme.obj && theme.obj.szFlag) themeFlags = theme.obj.szFlag;
                                
                                // Check if it's a FEATURE theme
                                if (themeFlags && typeof themeFlags === 'string' && themeFlags.toUpperCase().includes('FEATURE')) {
                                    console.log(`✅ [FEATURE Theme Search] Found FEATURE theme: ${themeId}`);
                                    
                                    featureThemes.push({
                                        id: themeId,
                                        name: theme.szName || theme.name || themeId
                                    });
                                }
                            }
                            
                            console.log(`📊 [FEATURE Theme Search] Found ${featureThemes.length} FEATURE theme(s):`, featureThemes.map(t => t.name));
                            
                            // Store all FEATURE themes to check later (will find best match)
                            if (featureThemes.length > 0) {
                                compatibleFeatureTheme = {
                                    themes: featureThemes, // Store all themes
                                    id: featureThemes[0].id, // Keep first for backward compatibility
                                    name: featureThemes[0].name,
                                    willCheckAfterLoad: true
                                };
                                console.log(`✅ [FEATURE Theme Search] Will check all ${featureThemes.length} FEATURE theme(s) to find best match`);
                            }
                        } else {
                            console.log('⚠️ [FEATURE Theme Search] No themes found on map');
                        }
                    } catch (e) {
                        console.warn('Error checking for compatible FEATURE themes:', e);
                    }
                    
                    // Inform user that data doesn't contain geometry fields
                    // Only show message if no FEATURE theme found (otherwise wait for delayed check with matching fields)
                    if (!compatibleFeatureTheme) {
                        let message = `ℹ️ **Note:** The loaded data does not contain geometry fields (like coordinates or geographic identifiers).\n\n`;
                        message += `To visualize this data on the map, you need to **combine this theme with a FEATURE theme** that contains the geographic shapes.\n\n`;
                        message += `**Steps:**\n`;
                        message += `1. First, load a FEATURE theme with geographic data (e.g., country boundaries, regions)\n`;
                        message += `2. Then use the command: \`combine themes\` to link this data theme with the FEATURE theme\n\n`;
                        message += `The system will automatically match the data based on common field values.`;
                        addMessage(message, false);
                    }
                    // If compatibleFeatureTheme is found, wait for delayed check to show message with matching fields
                    
                    // Show overlay on map
                    const geometryWarningOverlay = document.getElementById('geometryWarningOverlay');
                    if (geometryWarningOverlay) {
                        geometryWarningOverlay.style.display = 'block';
                    }
                }

                // Determine default styles based on data type and record count (like Composer)
                const recordCount = dataTable.table?.records || dataTable.records?.length || 0;

                // Use filename for theme name if available, otherwise generate unique name (like Composer does)
                const uniqueThemeName = filenameWithoutSuffix || `theme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                // Store flag that this data has no geometry - will check after layer is added
                // Use the hasNoGeometry variable we set earlier
                if (hasNoGeometry) {
                    window._lastLoadedDataHasNoGeometry = true;
                    window._lastLoadedThemeName = uniqueThemeName;
                    console.log('📊 Flag set: data has no geometry, themeName:', uniqueThemeName, 'currentDataTable available:', !!currentDataTable);
                }

                const styleObj = {
                    name: uniqueThemeName, // Set unique theme name for replace operations
                    showdata: true,
                    tooltip: "{{theme.item.chart}}{{theme.item.data}}",
                    title: filenameForTitle || "[title]" // Use filename as title if available
                };

                // Set styles based on feature type (like Composer)
                // Use ZOOMTO flag to automatically zoom to extent when geographic data is loaded
                if (isFeatureLayer) {
                    if (isPolygon) {
                        // Polygon style (like Composer)
                        styleObj.type = "FEATURE|ZOOMTO";
                        styleObj.colorscheme = "#eeeeee";
                        styleObj.fillopacity = "0.1";
                        styleObj.linecolor = "#0088dd";
                        styleObj.linewidth = "0.5";
                    } else if (isLine) {
                        // Line style (like Composer)
                        styleObj.type = "FEATURE|ZOOMTO";
                        styleObj.colorscheme = "#0088dd";
                        styleObj.fillopacity = "1";
                        styleObj.linecolor = "#0088dd";
                        styleObj.linewidth = "1";
                    }
                } else {
                    // Chart styles for point data (like Composer)
                    styleObj.colorscheme = [1, "#0000dd", "#0000dd"]; // Blue only

                    // Determine theme type based on record count (like Composer)
                    if (recordCount > 250000) {
                        styleObj.type = "CHART|SYMBOL|GRIDSIZE|DOPACITY|AGGREGATE|SUM|ZOOMTO";
                        styleObj.gridwidth = "10px";
                        styleObj.symbols = ["hexagon"];
                        styleObj.dopacitypow = 2;
                        styleObj.dopacityscale = 2;
                    } else if (recordCount > 100000) {
                        styleObj.type = "CHART|BUBBLE|SIZE|AGGREGATE|RELOCATE|SUM|ZOOMTO";
                        styleObj.gridwidth = "2px";
                        styleObj.fillopacity = "0.3";
                    } else {
                        styleObj.type = "CHART|DOT|RAW|ZOOMTO";
                        styleObj.fillopacity = "0.2";
                    }
                }

                // Apply styles to layer before adding to map
                layerConfig.style(styleObj);

                // Add the layer to the map
                const layerDef = layerConfig.define();

                console.log("layerDef ------------------");
                console.log(layerDef);
                console.log("--------------");

                mapInstance.layer(layerDef);
                
                // If data has no geometry, do a delayed check for compatible FEATURE themes using findMatchingFields logic
                // (in case themes weren't available during initial check)
                if (hasNoGeometry && compatibleFeatureTheme && compatibleFeatureTheme.willCheckAfterLoad) {
                    const featureThemesToCheck = compatibleFeatureTheme.themes || [{ id: compatibleFeatureTheme.id, name: compatibleFeatureTheme.name }];
                    const newThemeId = uniqueThemeName;
                    
                    setTimeout(() => {
                        try {
                            console.log('🔍 [Best Match Search] Starting delayed check for compatible FEATURE themes using findMatchingFields logic...');
                            console.log(`📊 [Best Match Search] Will check ${featureThemesToCheck.length} FEATURE theme(s) against new theme: ${newThemeId}`);
                            
                            // Use the same findMatchingFields logic from ai_agent_prototype.js
                            const map = window.ixmaps?.embeddedSVG?.window?.map || 
                                       (window.mapApi && window.mapApi.getMap ? window.mapApi.getMap() : null);
                            
                            if (!map || !map.Api) {
                                console.warn('⚠️ [Best Match Search] Map not available for delayed check');
                                return;
                            }
                            
                            const mapApi = map.Api;
                            
                            // Get new theme data once (used for all comparisons)
                            let newThemeObj = null;
                            let newThemeData = null;
                            
                            try {
                                newThemeObj = mapApi.getTheme(newThemeId);
                                if (newThemeObj && newThemeObj.objTheme) {
                                    if (newThemeObj.objTheme.objTheme && newThemeObj.objTheme.objTheme.dbFields && newThemeObj.objTheme.objTheme.dbRecords) {
                                        newThemeData = newThemeObj.objTheme.objTheme;
                                    } else if (newThemeObj.objTheme.dbFields && newThemeObj.objTheme.dbRecords) {
                                        newThemeData = newThemeObj.objTheme;
                                    }
                                }
                            } catch (e) {
                                console.warn('⚠️ [Best Match Search] Could not get new theme data:', e);
                                return;
                            }
                            
                            if (!newThemeData || !newThemeData.dbFields || !newThemeData.dbRecords) {
                                console.warn('⚠️ [Best Match Search] New theme data not available or incomplete');
                                return;
                            }
                            
                            console.log(`✅ [Best Match Search] New theme data loaded: ${newThemeData.dbFields.length} fields, ${newThemeData.dbRecords.length} records`);
                            
                            // Extract fields from new theme
                            const excludedFields = new Set(['geometry', 'position', 'id', '_id', 'total', 'total_', 'sum']);
                            const fields2 = [];
                            const fields2Indices = {};
                            newThemeData.dbFields.forEach((field, index) => {
                                const fieldName = typeof field === 'string' ? field : (field.id || field.name || field.field || String(field));
                                if (fieldName && !excludedFields.has(fieldName.toLowerCase())) {
                                    fields2.push(fieldName);
                                    fields2Indices[fieldName] = index;
                                }
                            });
                            
                            // Extract unique values from new theme fields
                            const newThemeFieldValues = {};
                            fields2.forEach(fieldName => {
                                const fieldIndex = fields2Indices[fieldName];
                                const values = new Set();
                                newThemeData.dbRecords.forEach(record => {
                                    if (record && record[fieldIndex] !== undefined && record[fieldIndex] !== null && record[fieldIndex] !== '') {
                                        const normalizedValue = String(record[fieldIndex]).trim().toLowerCase();
                                        if (normalizedValue) {
                                            values.add(normalizedValue);
                                        }
                                    }
                                });
                                newThemeFieldValues[fieldName] = values;
                            });
                            
                            console.log(`📊 [Best Match Search] New theme has ${fields2.length} matchable fields`);
                            
                            // Check each FEATURE theme and collect results
                            const themeResults = [];
                            
                            for (const featureTheme of featureThemesToCheck) {
                                const featureThemeId = featureTheme.id;
                                const featureThemeName = featureTheme.name;
                                
                                console.log(`\n🔍 [Best Match Search] Checking FEATURE theme: ${featureThemeName} (${featureThemeId})`);
                                
                                try {
                                    // Get feature theme data
                                    let featureThemeObj = null;
                                    let featureThemeData = null;
                                    
                                    try {
                                        featureThemeObj = mapApi.getTheme(featureThemeId);
                                        if (featureThemeObj && featureThemeObj.objTheme) {
                                            if (featureThemeObj.objTheme.objTheme && featureThemeObj.objTheme.objTheme.dbFields && featureThemeObj.objTheme.objTheme.dbRecords) {
                                                featureThemeData = featureThemeObj.objTheme.objTheme;
                                            } else if (featureThemeObj.objTheme.dbFields && featureThemeObj.objTheme.dbRecords) {
                                                featureThemeData = featureThemeObj.objTheme;
                                            }
                                        }
                                    } catch (e) {
                                        console.warn(`⚠️ [Best Match Search] Could not get feature theme data for ${featureThemeName}:`, e);
                                        continue; // Skip this theme
                                    }
                                    
                                    if (!featureThemeData || !featureThemeData.dbFields || !featureThemeData.dbRecords) {
                                        console.warn(`⚠️ [Best Match Search] Feature theme ${featureThemeName} data not available or incomplete`);
                                        continue; // Skip this theme
                                    }
                                    
                                    console.log(`✅ [Best Match Search] Feature theme ${featureThemeName} data loaded: ${featureThemeData.dbFields.length} fields, ${featureThemeData.dbRecords.length} records`);
                                    
                                    // Check if feature theme has an itemfield set (prioritize themes with itemfield)
                                    let featureThemeItemField = null;
                                    try {
                                        const featureThemeDef = mapApi.getMapThemeDefinitionObj(featureThemeId);
                                        const mapThemeFeature = map.Themes ? map.Themes.getTheme(featureThemeId) : null;
                                        
                                        if (featureThemeDef) {
                                            featureThemeItemField = featureThemeDef.style?.itemfield || featureThemeDef.binding?.id || null;
                                        }
                                        if (!featureThemeItemField && mapThemeFeature) {
                                            featureThemeItemField = mapThemeFeature.szItemField || null;
                                        }
                                        if (featureThemeItemField) {
                                            console.log(`🔍 [Best Match Search] Feature theme ${featureThemeName} has itemfield set to: "${featureThemeItemField}"`);
                                        } else {
                                            console.log(`⚠️ [Best Match Search] Feature theme ${featureThemeName} has NO itemfield set`);
                                        }
                                    } catch (e) {
                                        console.warn(`⚠️ [Best Match Search] Could not get feature theme ${featureThemeName} itemfield:`, e);
                                    }
                                    
                                    // Extract fields from feature theme
                                    const fields1 = [];
                                    const fields1Indices = {};
                                    featureThemeData.dbFields.forEach((field, index) => {
                                        const fieldName = typeof field === 'string' ? field : (field.id || field.name || field.field || String(field));
                                        if (fieldName && !excludedFields.has(fieldName.toLowerCase())) {
                                            fields1.push(fieldName);
                                            fields1Indices[fieldName] = index;
                                        }
                                    });
                                    
                                    console.log(`📊 [Best Match Search] Feature theme ${featureThemeName} has ${fields1.length} matchable fields`);
                                    
                                    // Extract unique values from feature theme fields
                                    const featureThemeFieldValues = {};
                                    fields1.forEach(fieldName => {
                                        const fieldIndex = fields1Indices[fieldName];
                                        const values = new Set();
                                        featureThemeData.dbRecords.forEach(record => {
                                            if (record && record[fieldIndex] !== undefined && record[fieldIndex] !== null && record[fieldIndex] !== '') {
                                                const normalizedValue = String(record[fieldIndex]).trim().toLowerCase();
                                                if (normalizedValue) {
                                                    values.add(normalizedValue);
                                                }
                                            }
                                        });
                                        featureThemeFieldValues[fieldName] = values;
                                    });
                                    
                                    // Find matching fields by comparing values
                                    const matchingFields = [];
                                    fields1.forEach(field1 => {
                                        const values1 = featureThemeFieldValues[field1];
                                        if (!values1 || values1.size === 0) return;
                                        
                                        fields2.forEach(field2 => {
                                            const values2 = newThemeFieldValues[field2];
                                            if (!values2 || values2.size === 0) return;
                                            
                                            // Calculate overlap
                                            let matches = 0;
                                            values1.forEach(v => {
                                                if (values2.has(v)) matches++;
                                            });
                                            
                                            // Require at least 10% overlap and at least 3 matches
                                            const overlapRatio = matches / Math.min(values1.size, values2.size);
                                            if (overlapRatio >= 0.1 && matches >= 3) {
                                                matchingFields.push({
                                                    field1: field1,
                                                    field2: field2,
                                                    matches: matches,
                                                    overlapRatio: overlapRatio
                                                });
                                            }
                                        });
                                    });
                                    
                                    console.log(`📊 [Best Match Search] Found ${matchingFields.length} matching field pair(s) for ${featureThemeName}`);
                                    
                                    // Sort to prioritize matches using itemfield, then by match count
                                    matchingFields.sort((a, b) => {
                                        // If feature theme has an itemfield, prioritize matches that use it
                                        if (featureThemeItemField) {
                                            const aUsesItemField = a.field1 === featureThemeItemField;
                                            const bUsesItemField = b.field1 === featureThemeItemField;
                                            
                                            // If one uses itemfield and the other doesn't, prioritize the one that uses it
                                            if (aUsesItemField && !bUsesItemField) {
                                                return -1; // a comes first
                                            }
                                            if (!aUsesItemField && bUsesItemField) {
                                                return 1; // b comes first
                                            }
                                        }
                                        
                                        // Sort by match count (descending) to prioritize best matches
                                        return b.matches - a.matches;
                                    });
                                    
                                    if (matchingFields.length > 0) {
                                        const bestMatch = matchingFields[0];
                                        const usesItemField = featureThemeItemField && bestMatch.field1 === featureThemeItemField;
                                        
                                        console.log(`✅ [Best Match Search] Best match for ${featureThemeName}: ${bestMatch.field1} ↔ ${bestMatch.field2} (${bestMatch.matches} matches)`);
                                        if (usesItemField) {
                                            console.log(`   ✅ Uses itemfield: "${featureThemeItemField}"`);
                                        } else if (featureThemeItemField) {
                                            console.log(`   ⚠️ Does NOT use itemfield ("${featureThemeItemField}")`);
                                        } else {
                                            console.log(`   ⚠️ Theme has NO itemfield set`);
                                        }
                                        
                                        // Store result for comparison
                                        themeResults.push({
                                            themeId: featureThemeId,
                                            themeName: featureThemeName,
                                            itemfield: featureThemeItemField,
                                            hasItemfield: !!featureThemeItemField,
                                            bestMatch: bestMatch,
                                            usesItemField: usesItemField,
                                            matchCount: bestMatch.matches,
                                            matchingFields: matchingFields
                                        });
                                    } else {
                                        console.log(`⚠️ [Best Match Search] No valid matches found for ${featureThemeName}`);
                                    }
                                } catch (e) {
                                    console.warn(`⚠️ [Best Match Search] Error checking ${featureThemeName}:`, e);
                                }
                            }
                            
                            // Now find the best theme overall
                            console.log(`\n📊 [Best Match Search] Summary: Checked ${themeResults.length} theme(s) with matches`);
                            
                            if (themeResults.length > 0) {
                                // Sort themes: prioritize those with itemfield, then those using itemfield, then by match count
                                themeResults.sort((a, b) => {
                                    // First: prioritize themes that HAVE an itemfield
                                    if (a.hasItemfield && !b.hasItemfield) return -1;
                                    if (!a.hasItemfield && b.hasItemfield) return 1;
                                    
                                    // Second: if both have itemfield, prioritize the one USING it
                                    if (a.hasItemfield && b.hasItemfield) {
                                        if (a.usesItemField && !b.usesItemField) return -1;
                                        if (!a.usesItemField && b.usesItemField) return 1;
                                    }
                                    
                                    // Third: sort by match count
                                    return b.matchCount - a.matchCount;
                                });
                                
                                const bestTheme = themeResults[0];
                                console.log(`\n🏆 [Best Match Search] BEST THEME SELECTED: ${bestTheme.themeName}`);
                                console.log(`   - Has itemfield: ${bestTheme.hasItemfield ? `Yes ("${bestTheme.itemfield}")` : 'No'}`);
                                console.log(`   - Uses itemfield in match: ${bestTheme.usesItemField ? 'Yes' : 'No'}`);
                                console.log(`   - Match: ${bestTheme.bestMatch.field1} ↔ ${bestTheme.bestMatch.field2} (${bestTheme.matchCount} matches)`);
                                
                                // Show message to user
                                let message = `💡 **Update:** I found a compatible FEATURE theme on the map: **${bestTheme.themeName}**\n\n`;
                                message += `This theme can be combined with your data using matching field: \`${bestTheme.bestMatch.field1}\` ↔ \`${bestTheme.bestMatch.field2}\` (${bestTheme.matchCount} matching values)\n\n`;
                                
                                if (bestTheme.usesItemField) {
                                    message += `✅ **Excellent match:** This uses the feature theme's ID field (\`${bestTheme.itemfield}\`), which is ideal for reliable data combination.\n\n`;
                                } else if (bestTheme.hasItemfield) {
                                    message += `⚠️ **Note:** This theme has an ID field (\`${bestTheme.itemfield}\`) but the match doesn't use it. The match may be less reliable.\n\n`;
                                } else {
                                    message += `⚠️ **Note:** This feature theme has no ID field (itemfield) configured. The match may be less reliable. Consider using a feature theme with an ID field set.\n\n`;
                                }
                                
                                if (themeResults.length > 1) {
                                    message += `ℹ️ *Checked ${themeResults.length} FEATURE theme(s) and selected the best match.*\n\n`;
                                }
                                
                                message += `**To combine them:**\n`;
                                message += `- Use the command: \`combine themes\`\n`;
                                message += `- Or specify: \`combine ${bestTheme.themeName} with this data\`\n\n`;
                                message += `The system will automatically match the data based on the common field values.`;
                                
                                addMessage(message, false);
                            } else {
                                console.log(`⚠️ [Best Match Search] No valid matches found in any FEATURE theme`);
                            }
                        } catch (e) {
                            console.warn('⚠️ [Best Match Search] Error in delayed FEATURE theme check:', e);
                        }
                    }, 2000); // Wait for theme to be fully loaded
                }

                // If a theme with geometry (FEATURE) was added, close data table overlay if open and hide geometry warning
                // Note: Zoom to extent is handled automatically by the 'SHOW' flag in the theme type
                if (geoField || isFeatureLayer) {
                    setTimeout(() => {
                        if (typeof checkAndCloseDataTableIfThemeVisible === 'function') {
                            checkAndCloseDataTableIfThemeVisible();
                        } else {
                            // Fallback: direct check
                            const dataTableContainer = document.getElementById('dataTableContainer');
                            if (dataTableContainer && dataTableContainer.classList.contains('active')) {
                                console.log('📊 Theme with geometry added - closing data table overlay');
                                if (typeof closeDataTable === 'function') {
                                    closeDataTable();
                                } else {
                                    dataTableContainer.classList.remove('active');
                                    dataTableContainer.style.height = '';
                                }
                            }
                        }
                        
                        // Hide geometry warning overlay when theme with geometry is added
                        const geometryWarningOverlay = document.getElementById('geometryWarningOverlay');
                        if (geometryWarningOverlay) {
                            geometryWarningOverlay.style.display = 'none';
                        }
                    }, 1000); // Wait a bit to ensure theme is fully loaded
                }

                // Save project state after data is added (with a small delay to ensure project JSON is available)
                setTimeout(() => {
                    saveProjectToHistory();
                }, 500);

                // Check if data has no geometry fields - if so, check for themes and show table if needed
                if (window._lastLoadedDataHasNoGeometry && window._lastLoadedThemeName) {
                    const themeNameToCheck = window._lastLoadedThemeName;
                    const dataTableToUse = currentDataTable; // Capture currentDataTable in closure
                    
                    console.log('📊 Will check for automatic table display after map update. Theme:', themeNameToCheck, 'DataTable available:', !!dataTableToUse);
                    
                    // Wait a bit for the map to update, then check for themes
                    setTimeout(() => {
                        try {
                            const map = ixmaps.embeddedSVG && ixmaps.embeddedSVG.window && ixmaps.embeddedSVG.window.map;
                            if (map && map.Api) {
                                let themes = [];
                                if (map.Themes && map.Themes.getThemes) {
                                    themes = map.Themes.getThemes();
                                } else if (map.Api.getAllThemes) {
                                    themes = map.Api.getAllThemes();
                                }
                                
                                console.log('📊 Checking themes after loading data without geometry:', {
                                    themeName: themeNameToCheck,
                                    themesCount: themes.length,
                                    themes: themes.map(t => t.id || t.szName || t.name || 'unknown'),
                                    dataTableAvailable: !!dataTableToUse,
                                    currentDataTableAvailable: !!currentDataTable
                                });
                                
                                // If no themes on map (or only the one we just added), show data table automatically
                                // Check if there are any FEATURE themes (themes with geometry)
                                const hasFeatureThemes = themes.some(theme => {
                                    const themeId = theme.id || theme.szName || theme.name || '';
                                    const themeType = theme.type || theme.szFlag || '';
                                    return themeId !== themeNameToCheck && (
                                        themeType.includes('FEATURE') || 
                                        themeType.includes('SHAPE') ||
                                        themeId.includes('FEATURE')
                                    );
                                });
                                
                                // Check if there are any visible themes (not just FEATURE themes)
                                const hasVisibleThemes = themes.some(theme => {
                                    const isVisible = theme.visible !== false;
                                    const themeDef = map.Api.getMapThemeDefinitionObj ? map.Api.getMapThemeDefinitionObj(theme.id || theme.szName || theme.name) : null;
                                    const defVisible = themeDef?.style?.visible !== false;
                                    return isVisible && defVisible;
                                });
                                
                                if (!hasFeatureThemes && themes.length <= 1 && !hasVisibleThemes) {
                                    console.log('📊 No geometry fields and no themes on map - showing data table automatically on map pane');
                                    
                                    // Use captured dataTableToUse or fallback to currentDataTable
                                    const dataTable = dataTableToUse || currentDataTable;
                                    
                                    if (dataTable && typeof showDataTable === 'function') {
                                        console.log('📊 Calling showDataTable with null themeId, using dataTable');
                                        try {
                                            showDataTable(null);
                                        } catch (error) {
                                            console.error('❌ Error calling showDataTable:', error);
                                        }
                                    } else {
                                        console.warn('⚠️ Cannot show data table - dataTable:', !!dataTable, 'showDataTable:', typeof showDataTable);
                                        // Try to find the theme by name as fallback
                                        let themeId = null;
                                        if (themes.length > 0) {
                                            const foundTheme = themes.find(t => {
                                                const tId = t.id || t.szName || t.name || '';
                                                return tId === themeNameToCheck || tId.includes(themeNameToCheck.split('_')[1]);
                                            });
                                            if (foundTheme) {
                                                themeId = foundTheme.id || foundTheme.szName || foundTheme.name || themeNameToCheck;
                                            } else {
                                                themeId = themes[0].id || themes[0].szName || themes[0].name || themeNameToCheck;
                                            }
                                        }
                                        
                                        if (typeof showDataTable === 'function' && themeId) {
                                            console.log('📊 Calling showDataTable with themeId:', themeId);
                                            try {
                                                showDataTable(themeId);
                                            } catch (error) {
                                                console.error('❌ Error calling showDataTable with themeId:', error);
                                            }
                                        } else {
                                            console.warn('⚠️ showDataTable function not available or no themeId');
                                        }
                                    }
                                } else {
                                    console.log('📊 Not showing data table - hasFeatureThemes:', hasFeatureThemes, 'themes.length:', themes.length);
                                }
                                
                                // Clear the flag
                                window._lastLoadedDataHasNoGeometry = false;
                                window._lastLoadedThemeName = null;
                            } else {
                                console.warn('⚠️ Map not available for theme check');
                                // Even if map is not available, try to show table if we have dataTable
                                if (dataTableToUse && typeof showDataTable === 'function') {
                                    console.log('📊 Map not available, but showing data table anyway with dataTable');
                                    try {
                                        showDataTable(null);
                                    } catch (error) {
                                        console.error('❌ Error calling showDataTable:', error);
                                    }
                                }
                                window._lastLoadedDataHasNoGeometry = false;
                                window._lastLoadedThemeName = null;
                            }
                        } catch (e) {
                            console.warn('Could not check themes or show data table:', e);
                            // Even on error, try to show table if we have dataTable
                            if (dataTableToUse && typeof showDataTable === 'function') {
                                console.log('📊 Error occurred, but showing data table anyway with dataTable');
                                try {
                                    showDataTable(null);
                                } catch (error) {
                                    console.error('❌ Error calling showDataTable:', error);
                                }
                            }
                            window._lastLoadedDataHasNoGeometry = false;
                            window._lastLoadedThemeName = null;
                        }
                    }, 2000); // Wait 2 seconds for map to update
                }

            } catch (error) {


                addMessage(`⚠️ Data loaded but could not be automatically added to map: ${error.message}. You can manually add it using the map interface.`, false);
            }
        }

        // Format text with markdown rendering using marked library
        function formatMessage(text) {
            if (!text) return '';
            let formatted = text;

            // Preserve button elements by replacing them with placeholders before markdown processing
            const buttonPlaceholders = [];
            // Preserve show-more-results-btn buttons
            formatted = formatted.replace(/<button[^>]*class="show-more-results-btn"[^>]*>.*?<\/button>/gs, (match) => {
                const placeholder = `{BUTTON_PLACEHOLDER_${buttonPlaceholders.length}}`;
                buttonPlaceholders.push(match);
                return placeholder;
            });
            // Preserve action-button elements (with SVG content) - use multiline matching
            formatted = formatted.replace(/<button[^>]*class="action-button"[^>]*>[\s\S]*?<\/button>/g, (match) => {
                const placeholder = `{BUTTON_PLACEHOLDER_${buttonPlaceholders.length}}`;
                buttonPlaceholders.push(match);
                return placeholder;
            });

            // Check if marked library is available
            if (typeof marked !== 'undefined') {
                try {
                    // Configure marked options
                    marked.setOptions({
                        breaks: true,  // Convert line breaks to <br>
                        gfm: true,     // GitHub Flavored Markdown
                        headerIds: false,  // Don't add IDs to headers
                        mangle: false  // Don't mangle email addresses
                    });

                    // Convert markdown to HTML using marked
                    // Ensure text is treated as markdown string, not HTML
                    formatted = marked.parse(String(formatted));

                    // Sanitize HTML using DOMPurify if available
                    if (typeof DOMPurify !== 'undefined') {
                        formatted = DOMPurify.sanitize(formatted, {
                            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                                'ol', 'li', 'blockquote', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
                                'div', 'span', 'button', 'hr', 'svg', 'path', 'line', 'circle', 'polygon', 'polyline', 'rect', 'ellipse'],
                            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'style', 'target', 'rel', 'data-action', 'data-theme-id', 'data-query-id', 'data-shown', 'data-total', 'data-map-type', 'aria-label', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'cx', 'cy', 'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'd'],
                            ALLOW_DATA_ATTR: false
                        });
                    }

                    // Add markdown-table class to tables for styling
                    formatted = formatted.replace(/<table>/g, '<table class="markdown-table">');

                } catch (error) {
                    console.error('Marked parsing error:', error, 'Text sample:', formatted.substring(0, 200));
                    // Fall back to basic formatting if marked fails
                    formatted = formatted.replace(/\n/g, '<br>');
                }
            } else {
                // Fallback: basic markdown-like formatting if marked is not available
                formatted = formatted.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
                formatted = formatted.replace(/^### (.*$)/gim, '<h3>$1</h3>');
                formatted = formatted.replace(/^## (.*$)/gim, '<h2>$1</h2>');
                formatted = formatted.replace(/^# (.*$)/gim, '<h1>$1</h1>');
                formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
                formatted = formatted.replace(/\n/g, '<br>');
            }

            // Restore button placeholders AFTER markdown processing
            // Match the placeholder pattern (curly braces are not markdown syntax, so they'll be preserved)
            formatted = formatted.replace(/\{BUTTON_PLACEHOLDER_(\d+)\}/g, (match, index) => {
                return buttonPlaceholders[parseInt(index)] || match;
            });
            return formatted;
        }


        // Get AI model icon based on model used
        function getAIIcon(modelUsed) {
            // If modelUsed is specified, use it to determine icon
            // 'internal' means internal analysis/response but should use generic AI icon
            if (modelUsed === 'internal') {
                // Use generic AI icon for internal responses (analysis, etc.)
                return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#666"/>
                </svg>`;
            } else if (modelUsed === 'gemini') {
                // Gemini icon - twin stars representing Gemini constellation
                return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 4l1.5 3L13 8l-3.5 3.4L10.5 15 8 12.5 5.5 15l0.5-3.6L3 8l3.5-1L8 4z" fill="#666"/>
                    <path d="M16 4l1.5 3L21 8l-3.5 3.4L18.5 15 16 12.5 13.5 15l0.5-3.6L11 8l3.5-1L16 4z" fill="#666"/>
                </svg>`;
            } else if (modelUsed === 'mistral') {
                // Mistral icon - pixelated M representing Mistral's logo
                return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <!-- Pixelated M shape (5x7 grid) -->
                    <!-- Left leg -->
                    <rect x="5" y="5" width="2" height="2" fill="#666"/>
                    <rect x="5" y="7" width="2" height="2" fill="#666"/>
                    <rect x="5" y="9" width="2" height="2" fill="#666"/>
                    <rect x="5" y="11" width="2" height="2" fill="#666"/>
                    <rect x="5" y="13" width="2" height="2" fill="#666"/>
                    <rect x="5" y="15" width="2" height="2" fill="#666"/>
                    <rect x="5" y="17" width="2" height="2" fill="#666"/>
                    <!-- Left middle -->
                    <rect x="7" y="7" width="2" height="2" fill="#666"/>
                    <rect x="7" y="9" width="2" height="2" fill="#666"/>
                    <!-- Center -->
                    <rect x="9" y="9" width="2" height="2" fill="#666"/>
                    <rect x="9" y="11" width="2" height="2" fill="#666"/>
                    <!-- Right middle -->
                    <rect x="11" y="7" width="2" height="2" fill="#666"/>
                    <rect x="11" y="9" width="2" height="2" fill="#666"/>
                    <!-- Right leg -->
                    <rect x="13" y="5" width="2" height="2" fill="#666"/>
                    <rect x="13" y="7" width="2" height="2" fill="#666"/>
                    <rect x="13" y="9" width="2" height="2" fill="#666"/>
                    <rect x="13" y="11" width="2" height="2" fill="#666"/>
                    <rect x="13" y="13" width="2" height="2" fill="#666"/>
                    <rect x="13" y="15" width="2" height="2" fill="#666"/>
                    <rect x="13" y="17" width="2" height="2" fill="#666"/>
                </svg>`;
            }

            // If modelUsed is explicitly null, always use generic icon (non-AI response)
            if (modelUsed === null) {
                return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" fill="#666"/>
                </svg>`;
            }

            // If modelUsed is undefined (not passed), check configuration (for loading messages only)
            // This is used when we don't know yet which model will be used
            if (modelUsed === undefined) {
                // Check if Gemini is configured and active
                const useGemini = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config &&
                    ixmaps.aiQuery.config.useGemini &&
                    ixmaps.aiQuery.config.geminiApiKey;

                // Check if Mistral is configured and active
                const useMistralForAll = localStorage.getItem('useMistralForAll') === 'true';
                const mistralApiKey = localStorage.getItem('mistralApiKey');
                const useMistral = useMistralForAll && mistralApiKey;

                if (useGemini) {
                    // Gemini icon - twin stars representing Gemini constellation
                    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 4l1.5 3L13 8l-3.5 3.4L10.5 15 8 12.5 5.5 15l0.5-3.6L3 8l3.5-1L8 4z" fill="#666"/>
                        <path d="M16 4l1.5 3L21 8l-3.5 3.4L18.5 15 16 12.5 13.5 15l0.5-3.6L11 8l3.5-1L16 4z" fill="#666"/>
                    </svg>`;
                } else if (useMistral) {
                    // Mistral icon - pixelated M representing Mistral's logo
                    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <!-- Pixelated M shape (5x7 grid) -->
                        <!-- Left leg -->
                        <rect x="5" y="5" width="2" height="2" fill="#666"/>
                        <rect x="5" y="7" width="2" height="2" fill="#666"/>
                        <rect x="5" y="9" width="2" height="2" fill="#666"/>
                        <rect x="5" y="11" width="2" height="2" fill="#666"/>
                        <rect x="5" y="13" width="2" height="2" fill="#666"/>
                        <rect x="5" y="15" width="2" height="2" fill="#666"/>
                        <rect x="5" y="17" width="2" height="2" fill="#666"/>
                        <!-- Left middle -->
                        <rect x="7" y="7" width="2" height="2" fill="#666"/>
                        <rect x="7" y="9" width="2" height="2" fill="#666"/>
                        <!-- Center -->
                        <rect x="9" y="9" width="2" height="2" fill="#666"/>
                        <rect x="9" y="11" width="2" height="2" fill="#666"/>
                        <!-- Right middle -->
                        <rect x="11" y="7" width="2" height="2" fill="#666"/>
                        <rect x="11" y="9" width="2" height="2" fill="#666"/>
                        <!-- Right leg -->
                        <rect x="13" y="5" width="2" height="2" fill="#666"/>
                        <rect x="13" y="7" width="2" height="2" fill="#666"/>
                        <rect x="13" y="9" width="2" height="2" fill="#666"/>
                        <rect x="13" y="11" width="2" height="2" fill="#666"/>
                        <rect x="13" y="13" width="2" height="2" fill="#666"/>
                        <rect x="13" y="15" width="2" height="2" fill="#666"/>
                        <rect x="13" y="17" width="2" height="2" fill="#666"/>
                    </svg>`;
                }
            }

            // Default simple AI icon (fallback)
            return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" fill="#666"/>
            </svg>`;
        }

        // Add message to chat
        function addMessage(text, isUser = false, metadata = null, modelUsed = null) {
            const messagesContainer = document.getElementById('chatMessages');

            const emptyChat = messagesContainer.querySelector('.empty-chat');
            if (emptyChat) {
                emptyChat.remove();
            }

            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isUser ? 'user' : 'ai'}`;

            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const formattedText = formatMessage(text);

            let contentHtml = '';
            if (!isUser) {
                // Use modelUsed parameter if provided, otherwise use null (generic icon for non-AI responses)
                contentHtml += `<div class="message-avatar">${getAIIcon(modelUsed)}</div>`;
            }
            contentHtml += `<div class="message-content">`;
            contentHtml += `<span class="message-time">${time}</span> - `;
            // Insert formatted text directly (it's already HTML after formatMessage processing)
            contentHtml += formattedText;

            if (metadata) {
                const shouldShowCount = metadata.count !== undefined &&
                    metadata.query &&
                    metadata.query.method !== 'discover' &&
                    metadata.query.method !== 'sizefield' &&
                    (metadata.count > 0 || (metadata.items && metadata.items.length > 0));

                if (shouldShowCount) {
                    contentHtml += `<div class="message-result-count">Found ${metadata.count} result(s)</div>`;
                }

                if (metadata.query && metadata.query.method !== 'discover' && metadata.query.method !== 'sizefield') {
                    const method = metadata.query.method || 'simple';
                    let queryDetails = `Theme: ${metadata.query.theme || 'all'} | Method: ${method}`;
                    
                    // Check if no AI agent is defined and method is simple
                    const useGemini = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.useGemini;
                    const hasGeminiKey = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.geminiApiKey;
                    const hasAI = useGemini && hasGeminiKey;
                    
                    if (method === 'simple' && !hasAI) {
                        queryDetails += ' | <a href="#" class="open-settings-link" style="color: #ef4444; text-decoration: underline; cursor: pointer; font-weight: 600;">⚠️ Check the AI settings!</a>';
                    }
                    
                    contentHtml += `<div class="message-query-details">${queryDetails}</div>`;
                }
            }

            contentHtml += `</div>`;

            messageDiv.innerHTML = contentHtml;

            // Attach click handler to settings link if it exists
            const settingsLink = messageDiv.querySelector('.open-settings-link');
            if (settingsLink) {
                settingsLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Open settings panel - use function if available, otherwise click the toggle button
                    if (typeof openSettings === 'function') {
                        openSettings();
                    } else {
                        const settingsToggle = document.getElementById('settingsToggle');
                        if (settingsToggle) {
                            settingsToggle.click();
                        }
                    }
                    return false;
                });
            }

            if (metadata) {
                messageDiv.dataset.hasMetadata = 'true';
                if (metadata.items) {
                    messageDiv.dataset.itemsCount = metadata.items.length;
                }
            }

            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            // Add click handlers for data URLs in links (for sample data sources)
            if (!isUser) {
                const messageContent = messageDiv.querySelector('.message-content');
                if (messageContent) {
                    const links = messageContent.querySelectorAll('a[href]');
                    links.forEach(link => {
                        const href = link.getAttribute('href');
                        // Check if it's a data URL (sample data sources or data file URLs)
                        // Match common data file extensions or known data hosting domains
                        if (href && (
                            href.includes('s3.tebi.io') ||
                            href.includes('s3.eu-central-1.amazonaws.com') ||
                            href.includes('maps.ixmaps.com') ||
                            href.match(/\.(csv|json|jsonl|geojson|topojson|parquet|geoparquet|gpkg|fgb|flatgeobuf|pbf|geobuf)(\?|#|$)/i) ||
                            href.startsWith('http') && (href.includes('/data/') || href.includes('/dataset/'))
                        )) {
                            link.style.cursor = 'pointer';
                            link.style.color = '#0066cc';
                            link.style.textDecoration = 'underline';
                            link.title = 'Click to load this data file';
                            link.addEventListener('click', async (e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                // Show loading message
                                addMessage(`Loading: \`${href}\``, false);

                                try {
                                    await loadDataFromUrl(href);
                                } catch (error) {

                                    addMessage(`❌ Error loading data: ${error.message}`, false);
                                }

                                return false;
                            });
                        }
                    });

                    // Add click handlers for action buttons (e.g., "View Table" button, "Show details" button)
                    const actionButtons = messageContent.querySelectorAll('[data-action]');
                    actionButtons.forEach(button => {
                        const action = button.getAttribute('data-action');
                        if (action === 'view-table') {
                            const themeId = button.getAttribute('data-theme-id');
                            if (themeId) {
                                button.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    // Use the new showDataTable function to load in chat pane
                                    if (typeof showDataTable === 'function') {
                                        try {
                                            showDataTable(themeId);
                                        } catch (error) {

                                            addMessage(`❌ Error opening table for theme "${themeId}": ${error.message}`, false);
                                        }
                                    } else {

                                        addMessage('❌ Table viewer is not available. Please ensure the page is fully loaded.', false);
                                    }
                                });
                            }
                        } else if (action === 'show-map-details') {
                            button.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                // Trigger a query to show detailed map information
                                const chatInput = document.getElementById('chatInput');
                                if (chatInput) {
                                    chatInput.value = 'show map details';
                                    // Trigger the chat message handler
                                    const sendButton = document.getElementById('sendButton');
                                    if (sendButton) {
                                        sendButton.click();
                                    } else if (typeof handleChatMessage === 'function') {
                                        handleChatMessage();
                                    }
                                } else {
                                    addMessage('❌ Unable to show detailed information. Chat input not found.', false);
                                }
                            });
                        } else if (action === 'show-data') {
                            const themeId = button.getAttribute('data-theme-id');
                            if (themeId) {
                                button.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    // Use the showDataTable function to show data table
                                    if (typeof showDataTable === 'function') {
                                        try {
                                            showDataTable(themeId);
                                        } catch (error) {
                                            console.error('Error opening data table:', error);
                                            addMessage(`❌ Error opening data table for theme "${themeId}": ${error.message}`, false);
                                        }
                                    } else {
                                        console.error('showDataTable function not available');
                                        addMessage('❌ Data table viewer is not available. Please ensure the page is fully loaded.', false);
                                    }
                                });
                            }
                        } else if (action === 'show-facets') {
                            const themeId = button.getAttribute('data-theme-id');
                            if (themeId) {
                                button.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    // Use the showFacets function to show facets
                                    if (typeof showFacets === 'function') {
                                        try {
                                            showFacets(themeId);
                                        } catch (error) {
                                            console.error('Error opening facets:', error);
                                            addMessage(`❌ Error opening facets for theme "${themeId}": ${error.message}`, false);
                                        }
                                    } else {
                                        console.error('showFacets function not available');
                                        addMessage('❌ Facets viewer is not available. Please ensure the page is fully loaded.', false);
                                    }
                                });
                            }
                        } else if (action === 'edit-theme') {
                            const themeId = button.getAttribute('data-theme-id');
                            if (themeId) {
                                button.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    // Use the showThemeEditor function to open editor with specific theme
                                    if (typeof showThemeEditor === 'function') {
                                        try {
                                            showThemeEditor(themeId);
                                        } catch (error) {
                                            console.error('Error opening theme editor:', error);
                                            addMessage(`❌ Error opening theme editor for theme "${themeId}": ${error.message}`, false);
                                        }
                                    } else {
                                        console.error('showThemeEditor function not available');
                                        addMessage('❌ Theme editor is not available. Please ensure the page is fully loaded.', false);
                                    }
                                });
                            }
                        } else if (action === 'configure-theme') {
                            const themeId = button.getAttribute('data-theme-id');
                            if (themeId) {
                                button.addEventListener('click', async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    try {
                                        // Use the showConfigurator function to properly load and display the configurator
                                        // Pass the themeId so it opens with the correct theme
                                        if (typeof showConfigurator === 'function') {
                                            await showConfigurator(themeId);
                                        } else {
                                            // Fallback: manually open configurator
                                            const configuratorContainer = document.getElementById('configuratorContainer');
                                            if (configuratorContainer) {
                                                // Hide other tools
                                                const dataTableContainer = document.getElementById('dataTableContainer');
                                                const facetContainer = document.getElementById('facetContainer');
                                                const themeEditorContainer = document.getElementById('themeEditorContainer');
                                                
                                                if (dataTableContainer) dataTableContainer.classList.remove('active');
                                                if (facetContainer) facetContainer.classList.remove('active');
                                                if (themeEditorContainer) themeEditorContainer.classList.remove('active');
                                                
                                                // Show configurator
                                                configuratorContainer.classList.add('active');
                                                
                                                // Try to load configurator content if loadConfigurator exists
                                                setTimeout(() => {
                                                    if (typeof loadConfigurator === 'function') {
                                                        loadConfigurator(themeId);
                                                    } else if (typeof window.loadConfigurator === 'function') {
                                                        window.loadConfigurator(themeId);
                                                    }
                                                }, 500);
                                            } else {
                                                addMessage('❌ Configurator is not available. Please ensure the page is fully loaded.', false);
                                            }
                                        }
                                    } catch (error) {
                                        console.error('Error opening configurator:', error);
                                        addMessage(`❌ Error opening configurator for theme "${themeId}": ${error.message}`, false);
                                    }
                                });
                            }
                        } else if (action === 'more-actions') {
                            button.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                // Trigger the same behavior as when user types "more"
                                const chatInput = document.getElementById('chatInput');
                                if (chatInput) {
                                    chatInput.value = 'more';
                                    // Trigger the chat message handler
                                    const sendButton = document.getElementById('sendButton');
                                    if (sendButton) {
                                        sendButton.click();
                                    } else if (typeof handleChatMessage === 'function') {
                                        handleChatMessage();
                                    }
                                } else {
                                    addMessage('❌ Unable to show more information. Chat input not found.', false);
                                }
                            });
                        } else if (action === 'change-basemap') {
                            const mapTypeName = button.getAttribute('data-map-type');
                            if (mapTypeName) {
                                button.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    // Change basemap silently (no confirmation message) to avoid scrolling
                                    if (typeof changeBasemap === 'function') {
                                        try {
                                            changeBasemap(mapTypeName, true);
                                        } catch (error) {
                                            console.error('Error changing basemap:', error);
                                            addMessage(`❌ Error changing basemap: ${error.message}`, false);
                                        }
                                    } else {
                                        console.error('changeBasemap function not available');
                                        addMessage('❌ Basemap changer is not available. Please ensure the page is fully loaded.', false);
                                    }
                                });
                            }
                        }
                    });

                    // Add click handler for "Show more results" button
                    const showMoreButtons = messageContent.querySelectorAll('button.show-more-results-btn');
                    showMoreButtons.forEach(button => {
                        button.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            // Find the message div that contains this button
                            let messageDiv = button.closest('.message');
                            if (!messageDiv) {
                                messageDiv = button.closest('[data-has-metadata]');
                            }

                            // Get metadata from message history or dataset
                            let metadata = null;
                            if (messageDiv && messageDiv.dataset.hasMetadata === 'true') {
                                // Try to find metadata in messageHistory
                                const messageIndex = Array.from(messageDiv.parentElement.children).indexOf(messageDiv);
                                if (messageHistory[messageIndex]) {
                                    metadata = messageHistory[messageIndex].metadata;
                                }
                            }

                            if (!metadata || !metadata.items || !metadata.queryInfo) {
                                addMessage('❌ Unable to show more results. Query data not available.', false);
                                return;
                            }

                            const shown = parseInt(button.getAttribute('data-shown')) || 5;
                            const total = parseInt(button.getAttribute('data-total')) || metadata.items.length;
                            const items = metadata.items;
                            const fieldInfo = metadata.queryInfo.fieldInfo;

                            if (!fieldInfo || !ixmaps || !ixmaps.aiQuery) {
                                addMessage('❌ Unable to show more results. Field information not available.', false);
                                return;
                            }

                            // Calculate how many more to show (show next 10, or remaining if less)
                            const nextBatch = Math.min(10, total - shown);
                            const newShown = shown + nextBatch;

                            // Find the existing table in the message content
                            const messageContent = messageDiv.querySelector('.message-content');
                            let table = null;
                            if (messageContent) {
                                table = messageContent.querySelector('table');
                            }

                            if (table) {
                                // Append rows to existing table
                                // Use stored fieldOrder from fieldInfo if available
                                const fieldOrder = fieldInfo.fieldOrder || null;
                                for (let i = shown; i < newShown && i < items.length; i++) {
                                    const rowHtml = ixmaps.aiQuery.formatResultRow(items[i], i, fieldInfo, fieldOrder);
                                    // Create a temporary container to parse the HTML
                                    const tempDiv = document.createElement('div');
                                    tempDiv.innerHTML = rowHtml;
                                    const newRow = tempDiv.querySelector('tr');
                                    if (newRow) {
                                        table.appendChild(newRow);
                                    }
                                }
                            } else {
                                // Fallback: if no table found, format as before
                                let additionalResults = '';
                                for (let i = shown; i < newShown && i < items.length; i++) {
                                    additionalResults += ixmaps.aiQuery.formatResultRow(items[i], i, fieldInfo);
                                }

                                // Insert the additional results before the button
                                const buttonParent = button.parentElement;
                                if (buttonParent) {
                                    const resultsContainer = document.createElement('div');
                                    resultsContainer.style.marginTop = '8px';
                                    resultsContainer.innerHTML = additionalResults;
                                    
                                    if (buttonParent.tagName === 'P') {
                                        buttonParent.parentElement.insertBefore(resultsContainer, buttonParent);
                                    } else {
                                        buttonParent.insertBefore(resultsContainer, button);
                                    }
                                }
                            }

                            // Update button or remove it
                            if (newShown >= total) {
                                // All results shown, remove the button
                                button.remove();
                            } else {
                                // Update button to show remaining count
                                const remaining = total - newShown;
                                button.setAttribute('data-shown', newShown);
                                button.textContent = `Show ${remaining} more result${remaining !== 1 ? 's' : ''}`;
                            }
                        });
                    });
                }
            }

            messageHistory.push({
                text,
                isUser,
                timestamp: new Date(),
                metadata
            });

            return messageDiv;
        }

        // Add loading message
        function addLoadingMessage() {
            const messagesContainer = document.getElementById('chatMessages');
            const emptyChat = messagesContainer.querySelector('.empty-chat');
            if (emptyChat) {
                emptyChat.remove();
            }

            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ai';
            messageDiv.id = 'loadingMessage';
            messageDiv.innerHTML = `
                <div class="message-avatar">${getAIIcon()}</div>
                <div class="message-content">
                    <div class="message-loading">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            `;
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            return messageDiv;
        }

        // Remove loading message
        function removeLoadingMessage() {
            const loadingMsg = document.getElementById('loadingMessage');
            if (loadingMsg) {
                loadingMsg.remove();
            }
        }

        // Handle chat message
        async function handleChatMessage(skipMultiStepCheck = false) {
            const chatInput = document.getElementById('chatInput');
            const sendButton = document.getElementById('sendButton');
            const query = chatInput.value.trim();

            if (!query) {
                return;
            }
            
            // Add query to prompt history (if not empty and not duplicate of last item)
            if (query && (userPromptHistory.length === 0 || userPromptHistory[userPromptHistory.length - 1] !== query)) {
                userPromptHistory.push(query);
                // Limit history size (keep last 100 prompts)
                if (userPromptHistory.length > 100) {
                    userPromptHistory.shift();
                }
            }
            // Reset history index to end (current input)
            promptHistoryIndex = -1;
            tempInputValue = '';

            // Check for undo command
            const undoPatterns = [
                /^(undo|revert|back)$/i,
                /^(undo\s+last|revert\s+last|undo\s+action)$/i
            ];
            
            let isUndoCommand = false;
            for (let pattern of undoPatterns) {
                if (pattern.test(query)) {
                    isUndoCommand = true;
                    break;
                }
            }
            
            if (isUndoCommand) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = true;
                sendButton.disabled = true;
                addLoadingMessage();
                
                try {
                    if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                        removeLoadingMessage();
                        addMessage('⚠️ Map not ready. Please wait for the map to load.', false, null, 'internal');
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }
                    
                    const map = ixmaps.embeddedSVG.window.map;
                    const mapApi = map.Api;
                    
                    if (!mapApi || !mapApi.changeThemeStyle) {
                        removeLoadingMessage();
                        addMessage('❌ Theme API not available.', false, null, 'internal');
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }
                    
                    // Restore previous project JSON from history
                    if (projectHistory.length === 0) {
                        removeLoadingMessage();
                        addMessage('⚠️ No action to undo.', false, null, 'internal');
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }
                    
                    // Get the last saved project JSON
                    const previousProject = projectHistory.pop();
                    
                    // Restore the project using setProjectJSON
                    if (typeof ixmaps.setProjectJSON === 'function') {
                        try {
                            ixmaps.setProjectJSON(previousProject);
                            removeLoadingMessage();
                            addMessage('✅ Undone: Reverted to previous map state.', false, null, 'internal');
                        } catch (error) {
                            removeLoadingMessage();
                            addMessage(`❌ Error restoring previous state: ${error.message}`, false, null, 'internal');
                        }
                    } else {
                        removeLoadingMessage();
                        addMessage('❌ Cannot undo: setProjectJSON function not available.', false, null, 'internal');
                    }
                } catch (error) {
                    removeLoadingMessage();
                    addMessage(`❌ Error undoing action: ${error.message}`, false, null, 'internal');
                } finally {
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                }
                return;
            }
            
            // Check for multi-step commands (must come before single-command handlers)
            // Skip this check if we're already processing a step from a multi-step command
            if (!skipMultiStepCheck) {
                const multiStepPatterns = [
                    /(.+?)\s+(?:then|and then|after that|after|next|followed by)\s+(.+)/i,
                    /(.+?)\s*[,;]\s*(?:then\s+)?(.+)/i,  // "load data, then color" or "load data; color"
                    /(.+?)\s+-\s+(.+)/i,  // "load data - color by field" (only matches hyphen with spaces on both sides)
                    /(.+?)\s+and\s+(.+)/i  // "load data and color by field" (but be careful with this one)
                ];
                
                let multiStepMatch = null;
                for (let pattern of multiStepPatterns) {
                    const match = query.match(pattern);
                    if (match && match[1] && match[2]) {
                        // Avoid matching simple "and" in field names or URLs
                        // Only match if it looks like a command connector
                        const firstPart = match[1].trim();
                        const secondPart = match[2].trim();
                        
                        // Skip if it's just a URL with "and" in it or similar
                        if (pattern.source.includes('and') && 
                            (firstPart.includes('http') || secondPart.includes('http'))) {
                            continue;
                        }
                        
                        // Skip if "and" is used as a logical operator in filter/select queries
                        if (pattern.source.includes('and')) {
                            // Check if this looks like a filter/select query with "and" as a logical operator
                            const isFilterQuery = /\b(select|filter|where)\b.*\b(and|or)\b.*(=|>|<|>=|<=|!=)/i.test(query) ||
                                                 /(=|>|<|>=|<=|!=).*\band\b.*(=|>|<|>=|<=|!=)/i.test(query) ||
                                                 // Also check if "and" is between field/value pairs with operators
                                                 /\w+\s*(=|>|<|>=|<=|!=)\s*\w+\s+and\s+\w+\s*(=|>|<|>=|<=|!=)/i.test(query);
                            
                            if (isFilterQuery) {
                                continue; // Don't treat as multi-step
                            }
                            
                            // Only treat as multi-step if "and" is followed by a command verb
                            const isCommandSequence = /\s+and\s+(color|size|load|goto|show|open|view|display|change|set|zoom|navigate)/i.test(query);
                            if (!isCommandSequence) {
                                continue; // Don't treat as multi-step
                            }
                        }
                        
                        multiStepMatch = { first: firstPart, second: secondPart };
                        break;
                    }
                }
                
                if (multiStepMatch) {
                    // Handle multi-step command: split and execute each step as a single command
                    addMessage(query, true);
                    const originalQuery = query;
                    chatInput.value = '';
                    chatInput.disabled = true;
                    sendButton.disabled = true;
                    
                    try {
                        let steps = parseMultiStepCommand(originalQuery);
                        if (!steps || steps.length < 2) {
                            // Fallback: try to parse with AI if regex failed
                            const aiSteps = await parseComplexStepsWithAI(originalQuery);
                            if (aiSteps && aiSteps.length > 1) {
                                steps = aiSteps;
                            } else {
                                addMessage('⚠️ Could not parse multi-step command. Please try breaking it into separate commands.', false);
                                chatInput.disabled = false;
                                sendButton.disabled = false;
                                chatInput.focus();
                                return;
                            }
                        }
                        
                        // Execute each step as a single command, one after another
                        const totalSteps = steps.length;
                        addMessage(`📋 Executing ${totalSteps} step(s)...\n`, false);
                        
                        for (let i = 0; i < steps.length; i++) {
                            const stepText = steps[i].originalText || steps[i];
                            const stepNum = i + 1;
                            
                            addMessage(`\n**Step ${stepNum}/${totalSteps}:** ${stepText}`, false);
                            
                            try {
                                // Temporarily set the input to this step and process it as a single command
                                const originalValue = chatInput.value;
                                chatInput.value = stepText;
                                
                                // Process this step as a single command (skip multi-step check to avoid recursion)
                                await handleChatMessage(true);
                                
                                // Restore original value
                                chatInput.value = originalValue;
                                
                                addMessage(`✅ Step ${stepNum}/${totalSteps} completed successfully.`, false);
                            } catch (error) {
                                addMessage(`❌ Step ${stepNum}/${totalSteps} error: ${error.message}`, false);
                                // Stop on error - don't proceed with remaining steps
                                throw error;
                            }
                        }
                        
                        addMessage(`\n✅ **All ${totalSteps} step(s) completed successfully!**`, false);
                    } catch (error) {
                        // Error already reported in the step loop
                    } finally {
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                    }
                    return;
                }
            }

            // Check if user is responding positively to analysis offer
            // This check MUST come before any URL or load data pattern matching
            if (pendingAnalysisOffer && currentDataTable) {
                const positiveResponses = [
                    /^(yes|y|yeah|yep|sure|ok|okay|okey|alright|all right)$/i,  // English
                    /^(ja|j|jep|klar|ok|okay)$/i,                              // German
                    /^(si|sì|s|ok|va bene|perfetto)$/i,                       // Italian
                    /^(sí|s|ok|vale|perfecto)$/i,                              // Spanish
                    /^(oui|o|ok|d'accord|daccord)$/i,                          // French
                    /^(sim|s|ok|tudo bem)$/i,                                  // Portuguese
                    /^(ja|j|ok|prima)$/i,                                      // Dutch
                    /^(да|д|ок|хорошо)$/i,                                     // Russian
                    /^(はい|は|オーケー|了解)$/i,                                  // Japanese
                    /^(是|好|可以|行)$/i,                                        // Chinese
                    /^(tak|t|ok|dobrze)$/i                                     // Polish
                ];

                let isPositiveResponse = false;
                for (let pattern of positiveResponses) {
                    if (pattern.test(query.trim())) {
                        isPositiveResponse = true;
                        break;
                    }
                }

                if (isPositiveResponse) {
                    addMessage(query, true);
                    chatInput.value = '';
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    pendingAnalysisOffer = false;

                    // Show loading message and analyze data (DO NOT reload data)
                    addLoadingMessage();
                    try {
                        // Use existing data table - do NOT reload
                        const analysisText = await analyzeAndIntroduceData(currentDataTable, currentDataUrl);
                        removeLoadingMessage();
                        addMessage(analysisText, false);
                    } catch (error) {
                        removeLoadingMessage();
                        addMessage(`❌ Error analyzing data: ${error.message}`, false);
                    }
                    chatInput.focus();
                    return; // IMPORTANT: Return early to prevent any other processing
                }
            }

            // Check if this is a basemap opacity change request (must come BEFORE basemap change handler)
            const basemapOpacityPatterns = [
                /^(?:set|change|adjust)\s+(?:the\s+)?basemap\s+opacity\s+(?:to\s+)?(0?\.?\d+|1\.0|1)$/i,
                /^basemap\s+opacity\s+(?:to\s+)?(0?\.?\d+|1\.0|1)$/i,
                /^(?:set|change|adjust)\s+opacity\s+(?:of\s+)?(?:the\s+)?basemap\s+(?:to\s+)?(0?\.?\d+|1\.0|1)$/i,
                // Pattern for basemap opacity without value (to show help message)
                /^(?:set|change|adjust|show)\s+(?:the\s+)?basemap\s+opacity$/i,
                /^basemap\s+opacity$/i
            ];
            
            let isBasemapOpacityRequest = false;
            let requestedOpacity = null;
            let hasOpacityValue = false;
            
            for (const pattern of basemapOpacityPatterns) {
                const match = query.match(pattern);
                if (match) {
                    isBasemapOpacityRequest = true;
                    if (match[1]) {
                        hasOpacityValue = true;
                        requestedOpacity = parseFloat(match[1]);
                        // Validate opacity is between 0 and 1
                        if (!isNaN(requestedOpacity) && requestedOpacity >= 0 && requestedOpacity <= 1) {
                            break;
                        } else {
                            requestedOpacity = null;
                        }
                    }
                    break;
                }
            }
            
            if (isBasemapOpacityRequest) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = false;
                sendButton.disabled = false;
                chatInput.focus();
                
                if (hasOpacityValue && requestedOpacity !== null) {
                    await setBasemapOpacity(requestedOpacity);
                } else {
                    addMessage('❌ **Please provide an opacity value between 0.0 and 1.0.**\n\n💡 **Examples:**\n- "set basemap opacity to 0.5"\n- "change basemap opacity to 0.7"\n- "basemap opacity 1.0"', false);
                }
                return;
            }

            // Check if this is a basemap/maptype change request
            const basemapPatterns = [
                /^(?:change|set|switch|use)\s+(?:the\s+)?(?:basemap|maptype|map\s+type)(?:\s+to)?\s+(.+)/i,
                /^(?:show|list|display)\s+(?:available\s+)?(?:basemaps|maptypes|map\s+types)/i,
                /^(?:basemap|maptype|map\s+type)(?:\s+selection|\s+options)?/i
            ];
            
            let isBasemapRequest = false;
            let requestedMapType = null;
            
            for (const pattern of basemapPatterns) {
                const match = query.match(pattern);
                if (match) {
                    isBasemapRequest = true;
                    if (match[1]) {
                        requestedMapType = match[1].trim();
                    }
                    break;
                }
            }
            
            if (isBasemapRequest) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = false;
                sendButton.disabled = false;
                chatInput.focus();
                
                if (requestedMapType) {
                    // Try to change to specific maptype
                    await changeBasemap(requestedMapType);
                } else {
                    // Show available maptypes for selection
                    showBasemapSelector();
                }
                return;
            }

            // Check if this is a "load map" command (loads only maps, not data)
            const loadMapOnlyMatch = query.match(/^load\s+map(?:\s+(.+))?$/i);
            if (loadMapOnlyMatch) {
                const url = loadMapOnlyMatch[1] ? loadMapOnlyMatch[1].trim() : null;
                addMessage(query, true);
                chatInput.value = '';
                
                if (url) {
                    // URL provided, load the map
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                    await handleLoadMapFromHTML(url);
                } else {
                    // No URL provided, trigger file picker
                    const loadMapButton = document.getElementById('loadMapButton');
                    if (loadMapButton) {
                        loadMapButton.click();
                        addMessage('📁 Please select a map file (HTML or JSON) from the file picker.', false, null, 'internal');
                    } else {
                        addMessage('📁 To load a map, please provide a URL or use the "📁 Load Map" button in the settings panel.\n\nExample: "load map https://example.com/map.html"', false, null, 'internal');
                    }
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                }
                return;
            }

            // Check if this is a "load map from" command
            const loadMapMatch = query.match(/^load\s+map\s+from\s+(.+)/i);
            if (loadMapMatch) {
                const url = loadMapMatch[1].trim();
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = false;
                sendButton.disabled = false;
                chatInput.focus();
                await handleLoadMapFromHTML(url);
                return;
            }

            // Check if this is a "load data" command (with or without URL)
            // This MUST come before the generic "load" handler to avoid matching "load data" as "load [url]"
            const loadDataCommandMatch = query.match(/^load\s+data(?:\s+(?:url\s+)?(.+))?$/i);
            if (loadDataCommandMatch) {
                const urlOrEmpty = loadDataCommandMatch[1] ? loadDataCommandMatch[1].trim() : null;
                
                addMessage(query, true);
                chatInput.value = '';
                pendingAnalysisOffer = false; // Reset offer when loading new data
                
                // Check if URL is provided
                let url = null;
                if (urlOrEmpty && (urlOrEmpty.startsWith('http://') || urlOrEmpty.startsWith('https://'))) {
                    url = urlOrEmpty;
                }
                
                if (url) {
                    // URL provided, load from URL
                    try {
                        await loadDataFromUrl(url);
                    } catch (error) {
                        // Error already handled in loadDataFromUrl
                    }
                } else {
                    // No URL provided, open file picker
                    const dataFileInput = document.getElementById('dataFileInput');
                    if (dataFileInput) {
                        dataFileInput.click();
                        addMessage('📁 Please select a data file from the file picker.', false, null, 'internal');
                    } else {
                        addMessage('📁 To load data, please provide a URL or select a file.\n\nExample: "load data url https://example.com/data.csv"', false, null, 'internal');
                    }
                }
                
                chatInput.disabled = false;
                sendButton.disabled = false;
                chatInput.focus();
                return;
            }

            // Check if this is a "load" command (loads map or data based on URL/file type)
            const loadMatch = query.match(/^load\s+(.+)$/i);
            if (loadMatch) {
                const url = loadMatch[1].trim();
                
                // Determine if it's a map or data based on file extension
                const urlLower = url.toLowerCase();
                const isMapFile = urlLower.endsWith('.html') || urlLower.endsWith('.json');
                const isDataFile = urlLower.endsWith('.csv') || 
                                  urlLower.endsWith('.parquet') || 
                                  urlLower.endsWith('.geoparquet') || 
                                  urlLower.endsWith('.gpkg') || 
                                  urlLower.endsWith('.flatgeobuf') || 
                                  urlLower.endsWith('.geobuf') ||
                                  urlLower.endsWith('.geojson') ||
                                  urlLower.endsWith('.shp') ||
                                  urlLower.endsWith('.kml') ||
                                  urlLower.endsWith('.kmz');
                
                addMessage(query, true);
                chatInput.value = '';
                pendingAnalysisOffer = false;
                
                if (isMapFile) {
                    // Load as map
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                    await handleLoadMapFromHTML(url);
                } else if (isDataFile) {
                    // Load as data
                    try {
                        await loadDataFromUrl(url);
                    } catch (error) {
                        addMessage(`❌ Error loading data: ${error.message}`, false);
                    }
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                } else {
                    // Try to detect by checking if it's a URL
                    if (url.startsWith('http://') || url.startsWith('https://')) {
                        // Default to trying as data first (most common case)
                        // If it fails, user can try "load map [url]"
                        try {
                            await loadDataFromUrl(url);
                        } catch (error) {
                            addMessage(`❌ Error loading data: ${error.message}\n\n💡 If this is a map file, try: "load map ${url}"`, false);
                        }
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                    } else {
                        addMessage(`❌ Could not determine if "${url}" is a map or data file.\n\n💡 Try:\n- "load map ${url}" for map files (HTML/JSON)\n- "load data url ${url}" for data files`, false);
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                    }
                }
                return;
            }

            // Check if this is just a URL (fallback for direct URL pasting)
            const loadDataMatch2 = query.match(/^(https?:\/\/[^\s]+)$/i);
            if (loadDataMatch2) {
                const potentialUrl = loadDataMatch2[1];
                if (potentialUrl.startsWith('http://') || potentialUrl.startsWith('https://')) {
                    addMessage(query, true);
                    chatInput.value = '';
                    pendingAnalysisOffer = false;
                    
                    try {
                        await loadDataFromUrl(potentialUrl);
                    } catch (error) {
                        // Error already handled in loadDataFromUrl
                    }
                    
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                    return;
                }
            }

            // If user makes any other query (not a positive response), reset the offer
            if (pendingAnalysisOffer) {
                pendingAnalysisOffer = false;
            }

            // Route general "what", "why", and "how" questions to AI
            // This catches questions like "what does this mean?", "why is this happening?", "how do I...?", etc.
            // Note: Specific "what is X" patterns are handled later for known terms
            const specificWhatIsPatterns = [
                /^(?:what\s+is|what's|what\s+are|explain|define|tell\s+me\s+about|describe)\s+/i,  // English
                /^(?:cos\s+è|cosa\s+è|spiega|definisci|dimmi\s+di)\s+/i,                          // Italian
                /^(?:qué\s+es|qué\s+son|explica|define|dime\s+sobre|describe)\s+/i,                // Spanish
                /^(?:qu['']est[-]ce\s+que|explique|définir|parle[-]moi\s+de|décrire)\s+/i,         // French
                /^(?:was\s+ist|was\s+sind|erkläre|definiere|erzähl\s+mir\s+von|beschreibe)\s+/i,   // German
                /^(?:o\s+que\s+é|o\s+que\s+são|explique|definir|fale[-]me\s+sobre|descreva)\s+/i,  // Portuguese
                /^(?:wat\s+is|wat\s+zijn|leg\s+uit|definieer|vertel\s+me\s+over|beschrijf)\s+/i,  // Dutch
                /^(?:что\s+такое|объясни|определи|расскажи\s+о|опиши)\s+/i                        // Russian
            ];

            // Check if query starts with "what", "why", or "how" but doesn't match the specific "what is X" pattern
            // (which is handled later for known terms)
            let isGeneralQuestion = false;
            const lowerQuery = query.toLowerCase().trim();

            // First check if it matches a specific "what is X" pattern - if so, skip (handled later)
            let matchesSpecificWhatIs = false;
            for (let pattern of specificWhatIsPatterns) {
                if (pattern.test(query)) {
                    matchesSpecificWhatIs = true;
                    break;
                }
            }

            // Only route to AI if it's a general "what", "why", or "how" question that doesn't match specific patterns
            if (!matchesSpecificWhatIs) {
                const generalQuestionPatterns = [
                    /^what\s+(.+)$/i,                    // English: "what does this mean", "what are you", etc.
                    /^why\s+(.+)$/i,                     // English: "why is this", "why does this", etc.
                    /^how\s+(.+)$/i,                     // English: "how do I", "how can I", "how does this work", etc.
                    /^perché\s+(.+)$/i,                  // Italian: "perché"
                    /^come\s+(.+)$/i,                    // Italian: "come" (how)
                    /^por\s+qué\s+(.+)$/i,              // Spanish: "por qué"
                    /^cómo\s+(.+)$/i,                    // Spanish: "cómo" (how)
                    /^pourquoi\s+(.+)$/i,                // French: "pourquoi"
                    /^comment\s+(.+)$/i,                // French: "comment" (how)
                    /^warum\s+(.+)$/i,                   // German: "warum"
                    /^wie\s+(.+)$/i,                     // German: "wie" (how)
                    /^por\s+que\s+(.+)$/i,               // Portuguese: "por que"
                    /^como\s+(.+)$/i,                    // Portuguese: "como" (how)
                    /^waarom\s+(.+)$/i,                  // Dutch: "waarom"
                    /^hoe\s+(.+)$/i,                     // Dutch: "hoe" (how)
                    /^почему\s+(.+)$/i,                  // Russian: "почему"
                    /^как\s+(.+)$/i,                     // Russian: "как" (how)
                    /^что\s+(.+)$/i                      // Russian: "что" (what) - but not "что такое" which is handled above
                ];

                // Check if it's a general "what", "why", or "how" question
                for (let pattern of generalQuestionPatterns) {
                    if (pattern.test(query)) {
                        isGeneralQuestion = true;
                        break;
                    }
                }
            }

            if (isGeneralQuestion) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = true;
                sendButton.disabled = true;
                addLoadingMessage();

                try {
                    const result = await askAIDirectly(query);
                    removeLoadingMessage();
                    const aiResponse = result.response || result;
                    const modelUsed = result.model || null;
                    addMessage(aiResponse, false, null, modelUsed);
                } catch (error) {
                    removeLoadingMessage();

                    addMessage(`❌ Error: ${error.message}`, false);
                } finally {
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                }
                return;
            }

            // Check if user is asking for sample data (any query containing "sample data" or "data samples" in various languages)
            const sampleDataPatterns = [
                /sample\s+data/i,                    // English: "sample data"
                /data\s+samples?/i,                   // English: "data samples", "data sample"
                /samples?\s+data/i,                   // English: "samples data", "sample data"
                /dati\s+(di\s+)?esempio/i,         // Italian: "dati esempio", "dati di esempio"
                /esempio\s+(di\s+)?dati/i,          // Italian: "esempio dati", "esempio di dati"
                /ejemplo\s+de\s+datos/i,            // Spanish: "ejemplo de datos"
                /datos\s+de\s+ejemplo/i,           // Spanish: "datos de ejemplo"
                /données\s+(d[''])?exemple/i,       // French: "données exemple", "données d'exemple"
                /exemple\s+(de\s+)?données/i,      // French: "exemple données", "exemple de données"
                /beispieldaten/i,                   // German: "Beispieldaten"
                /exemplo\s+de\s+dados/i,             // Portuguese: "exemplo de dados"
                /dados\s+de\s+exemplo/i,            // Portuguese: "dados de exemplo"
                /voorbeeld\s+data/i,                // Dutch: "voorbeeld data"
                /data\s+voorbeeld/i,                // Dutch: "data voorbeeld"
                /przykładowe\s+dane/i,              // Polish: "przykładowe dane"
                /dane\s+przykładowe/i,              // Polish: "dane przykładowe"
                /пример\s+данных/i,                // Russian: "пример данных"
                /данных\s+пример/i,                 // Russian: "данных пример"
                /サンプル\s+データ/i,                // Japanese: "サンプルデータ"
                /データ\s+サンプル/i,                // Japanese: "データサンプル"
                /示例\s+数据|样本\s+数据/i,          // Chinese: "示例数据" or "样本数据"
                /数据\s+示例|数据\s+样本/i,          // Chinese: "数据示例" or "数据样本"
                /dati\s+campione/i,                 // Italian alternative: "dati campione"
                /campione\s+dati/i,                 // Italian alternative: "campione dati"
                /datos\s+de\s+muestra/i,           // Spanish alternative: "datos de muestra"
                /muestra\s+de\s+datos/i,          // Spanish alternative: "muestra de datos"
                /exemple\s+de\s+données/i          // French alternative: "exemple de données"
            ];

            let sampleDataMatch = false;
            for (let pattern of sampleDataPatterns) {
                if (pattern.test(query)) {
                    sampleDataMatch = true;
                    break;
                }
            }

            if (sampleDataMatch) {
                addMessage(query, true);
                chatInput.value = '';
                if (window.__IXMAPS_AI_CHAT_EMBED_HOST__) {
                    addMessage(
                        'Sample data lists are not available in embedded mode. Use the themes already on the map, or add data with `load data url [URL]`.',
                        false
                    );
                } else {
                    showSampleData();
                }
                return;
            }

            // Check if user wants to clear the map
            // Support: reset, clear, pulisci, remove all, remove themes, clean up
            const clearMapPatterns = [
                /^(reset|clear|pulisci|clean\s+up)(\s+(the\s+)?map)?$/i,
                /^remove\s+all(\s+themes)?(\s+(the\s+)?map)?$/i,
                /^remove\s+themes(\s+(the\s+)?map)?$/i
            ];

            let clearMapMatch = false;
            for (let pattern of clearMapPatterns) {
                if (pattern.test(query)) {
                    clearMapMatch = true;
                    break;
                }
            }

            if (clearMapMatch) {
                addMessage(query, true);
                chatInput.value = '';
                clearMap();
                return;
            }

            // Check if user wants to remove a specific theme
            // Patterns: "remove theme [name]", "delete theme [name]", "remove [theme name]"
            const removeThemePatterns = [
                /^remove\s+theme\s+(.+)$/i,
                /^delete\s+theme\s+(.+)$/i,
                /^remove\s+(.+?)\s+theme$/i,
                /^delete\s+(.+?)\s+theme$/i
            ];

            let removeThemeMatch = null;
            for (let pattern of removeThemePatterns) {
                const match = query.match(pattern);
                if (match) {
                    removeThemeMatch = match[1].trim();
                    break;
                }
            }

            if (removeThemeMatch) {
                addMessage(query, true);
                chatInput.value = '';
                removeTheme(removeThemeMatch);
                return;
            }

            // Check for projection change requests
            // Patterns for projection change requests (multilingual)
            const projectionChangePatterns = [
                // English
                /(?:change|switch|set|use|apply)\s+(?:to\s+)?(?:projection\s+)?(mercator|winkel|equalearth|equal\s+earth|albers|lambert|orthographic)/i,
                /(?:projection|map\s+projection)\s+(?:to\s+)?(mercator|winkel|equalearth|equal\s+earth|albers|lambert|orthographic)/i,
                /(?:show|display|view)\s+(?:in\s+)?(?:projection\s+)?(mercator|winkel|equalearth|equal\s+earth|albers|lambert|orthographic)/i,
                /(?:use|switch\s+to)\s+(mercator|winkel|equalearth|equal\s+earth|albers|lambert|orthographic)\s+projection/i,

                // Italian
                /(?:cambia|imposta|usa|applica)\s+(?:la\s+)?(?:proiezione\s+)?(?:a\s+)?(mercator|winkel|equalearth|albers|lambert|orthographic)/i,
                /(?:proiezione|mappa\s+proiezione)\s+(?:a\s+)?(mercator|winkel|equalearth|albers|lambert|orthographic)/i,
                /(?:usa|mostra)\s+(?:con\s+)?(?:proiezione\s+)?(mercator|winkel|equalearth|albers|lambert|orthographic)/i,

                // Spanish
                /(?:cambiar|cambia|establecer|usa|aplicar)\s+(?:la\s+)?(?:proyección\s+)?(?:a\s+)?(mercator|winkel|equalearth|albers|lambert|orthographic)/i,
                /(?:proyección|mapa\s+proyección)\s+(?:a\s+)?(mercator|winkel|equalearth|albers|lambert|orthographic)/i,
                /(?:usa|muestra)\s+(?:con\s+)?(?:proyección\s+)?(mercator|winkel|equalearth|albers|lambert|orthographic)/i,

                // German
                /(?:ändern|wechseln|setzen|verwenden|anwenden)\s+(?:die\s+)?(?:projektion\s+)?(?:zu\s+)?(mercator|winkel|equalearth|albers|lambert|orthographic)/i,
                /(?:projektion|kartenprojektion)\s+(?:zu\s+)?(mercator|winkel|equalearth|albers|lambert|orthographic)/i,
                /(?:verwende|zeige)\s+(?:mit\s+)?(?:projektion\s+)?(mercator|winkel|equalearth|albers|lambert|orthographic)/i,

                // French
                /(?:changer|modifier|définir|utiliser|appliquer)\s+(?:la\s+)?(?:projection\s+)?(?:en\s+)?(mercator|winkel|equalearth|albers|lambert|orthographic)/i,
                /(?:projection|projection\s+de\s+carte)\s+(?:en\s+)?(mercator|winkel|equalearth|albers|lambert|orthographic)/i,
                /(?:utilise|affiche)\s+(?:avec\s+)?(?:projection\s+)?(mercator|winkel|equalearth|albers|lambert|orthographic)/i
            ];

            // Check if user is asking for available projections (without specifying one)
            const projectionListPatterns = [
                /(?:show|list|what|which|available)\s+(?:are\s+)?(?:the\s+)?(?:available\s+)?projections?/i,
                /(?:set|change|switch)\s+projection/i,
                /projections?/i
            ];

            let isAskingForProjections = false;
            for (const pattern of projectionListPatterns) {
                if (pattern.test(query) && !query.match(/(?:mercator|winkel|equalearth|albers|lambert|orthographic)/i)) {
                    isAskingForProjections = true;
                    break;
                }
            }

            if (isAskingForProjections) {

                addMessage(query, true);
                chatInput.value = '';

                // Create list of available projections with clickable links
                const projections = [
                    { name: 'Mercator', value: 'mercator', description: 'Standard cylindrical projection' },
                    { name: 'Winkel Tripel', value: 'winkel', description: 'Compromise projection' },
                    { name: 'Equal Earth', value: 'equalearth', description: 'Equal-area projection' },
                    { name: 'Albers Equal Area', value: 'albers', description: 'Equal-area conic projection' },
                    { name: 'Lambert Azimuthal', value: 'lambert', description: 'Equal-area azimuthal projection' },
                    { name: 'Orthographic', value: 'orthographic', description: 'Globe-like view' }
                ];

                // Create HTML message with clickable links
                let messageHtml = '<strong>🗺️ Available Map Projections:</strong><br><br>';
                projections.forEach((proj, idx) => {
                    const linkId = `proj-link-${Date.now()}-${idx}`;
                    messageHtml += `${idx + 1}. <strong>${proj.name}</strong> - ${proj.description} `;
                    messageHtml += `<a href="#" class="projection-link" data-projection="${proj.value}" id="${linkId}" style="color: #0066cc; text-decoration: underline; cursor: pointer;">set</a><br><br>`;
                });
                messageHtml += '<em>💡 You can click on any projection link above, or type "set projection to [name]" in natural language.</em>';

                // Add message and set up click handlers
                const messagesContainer = document.getElementById('chatMessages');
                const emptyChat = messagesContainer.querySelector('.empty-chat');
                if (emptyChat) {
                    emptyChat.remove();
                }

                const messageDiv = document.createElement('div');
                messageDiv.className = 'message ai';
                const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                messageDiv.innerHTML = `
                    <div class="message-avatar">${getAIIcon(null)}</div>
                    <div class="message-content">
                        <span class="message-time">${time}</span> - ${messageHtml}
                    </div>
                `;

                messagesContainer.appendChild(messageDiv);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                // Add click handlers for projection links
                messageDiv.querySelectorAll('.projection-link').forEach(link => {
                    link.addEventListener('click', async (e) => {
                        e.preventDefault();
                        const projectionValue = link.getAttribute('data-projection');


                        // Disable input during processing
                        chatInput.disabled = true;
                        sendButton.disabled = true;
                        addLoadingMessage();

                        try {
                            const result = await changeProjection(projectionValue);
                            removeLoadingMessage();
                            addMessage(result.message, false);
                        } catch (error) {
                            removeLoadingMessage();

                            addMessage(`❌ Error: ${error.message}`, false);
                        } finally {
                            chatInput.disabled = false;
                            sendButton.disabled = false;
                            chatInput.focus();
                        }
                    });
                });

                return;
            }


            let projectionMatch = null;
            for (let i = 0; i < projectionChangePatterns.length; i++) {
                const pattern = projectionChangePatterns[i];
                const match = query.match(pattern);
                if (match) {
                    // Extract projection name and normalize "equal earth" to "equalearth"
                    let projectionName = match[1].toLowerCase().replace(/\s+/g, '');
                    projectionMatch = projectionName;



                    break;
                }
            }

            if (projectionMatch) {

                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = true;
                sendButton.disabled = true;
                addLoadingMessage();

                try {

                    const result = await changeProjection(projectionMatch);

                    removeLoadingMessage();
                    addMessage(result.message, false);
                } catch (error) {
                    removeLoadingMessage();


                    addMessage(`Error: ${error.message}`, false);
                } finally {
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                }
                return;
            } else {

            }

            // Check for tool commands: show/open data table, theme editor, or configurator
            const toolCommandPatterns = {
                dataTable: [
                    /^(?:show|open|view|display)\s+(?:the\s+)?(?:data\s+)?table$/i,
                    /^(?:show|open|view|display)\s+table$/i,
                    /^table$/i,
                    /^(?:show|open|view|display)\s+data\s+table$/i,
                    /^(?:mostra|apri|visualizza)\s+(?:la\s+)?(?:tabella\s+)?(?:dei\s+)?dati$/i,  // Italian
                    /^(?:mostrar|abrir|ver|mostrar)\s+(?:la\s+)?(?:tabla\s+)?(?:de\s+)?datos$/i,  // Spanish
                    /^(?:afficher|ouvrir|voir)\s+(?:le\s+)?(?:tableau\s+)?(?:de\s+)?données$/i,  // French
                    /^(?:zeige|öffne|anzeigen)\s+(?:die\s+)?(?:tabelle\s+)?(?:der\s+)?daten$/i,  // German
                    /^(?:mostrar|abrir|ver)\s+(?:a\s+)?(?:tabela\s+)?(?:de\s+)?dados$/i,        // Portuguese
                    /^(?:toon|open|weergeven)\s+(?:de\s+)?(?:tabel\s+)?(?:met\s+)?gegevens$/i,  // Dutch
                    /^(?:показать|открыть|показать)\s+(?:таблицу\s+)?(?:данных)?$/i              // Russian
                ],
                themeEditor: [
                    /^(?:show|open|view|display|edit)\s+(?:the\s+)?theme\s+editor$/i,
                    /^(?:show|open|view|display|edit)\s+editor$/i,
                    /^editor$/i,
                    /^(?:edit|modify)\s+(?:the\s+)?theme$/i,
                    /^(?:mostra|apri|visualizza|modifica)\s+(?:l[''])?editor\s+(?:del\s+)?tema$/i,  // Italian
                    /^(?:mostrar|abrir|ver|editar)\s+(?:el\s+)?editor\s+(?:de\s+)?tema$/i,          // Spanish
                    /^(?:afficher|ouvrir|voir|modifier)\s+(?:l[''])?éditeur\s+(?:de\s+)?thème$/i,  // French
                    /^(?:zeige|öffne|anzeigen|bearbeiten)\s+(?:den\s+)?(?:themen\s+)?editor$/i,     // German
                    /^(?:mostrar|abrir|ver|editar)\s+(?:o\s+)?editor\s+(?:de\s+)?tema$/i,          // Portuguese
                    /^(?:toon|open|weergeven|bewerken)\s+(?:de\s+)?(?:thema\s+)?editor$/i,          // Dutch
                    /^(?:показать|открыть|редактировать)\s+(?:редактор\s+)?(?:темы)?$/i            // Russian
                ],
                configurator: [
                    /^(?:show|open|view|display)\s+(?:the\s+)?(?:theme\s+)?configurator$/i,
                    /^(?:show|open|view|display)\s+configurator$/i,
                    /^configurator$/i,
                    /^(?:configure|config)\s+(?:the\s+)?theme$/i,
                    /^(?:mostra|apri|visualizza|configura)\s+(?:il\s+)?(?:configuratore\s+)?(?:del\s+)?tema$/i,  // Italian
                    /^(?:mostrar|abrir|ver|configurar)\s+(?:el\s+)?(?:configurador\s+)?(?:de\s+)?tema$/i,        // Spanish
                    /^(?:afficher|ouvrir|voir|configurer)\s+(?:le\s+)?(?:configurateur\s+)?(?:de\s+)?thème$/i,    // French
                    /^(?:zeige|öffne|anzeigen|konfigurieren)\s+(?:den\s+)?(?:themen\s+)?konfigurator$/i,        // German
                    /^(?:mostrar|abrir|ver|configurar)\s+(?:o\s+)?(?:configurador\s+)?(?:de\s+)?tema$/i,        // Portuguese
                    /^(?:toon|open|weergeven|configureren)\s+(?:de\s+)?(?:thema\s+)?configurator$/i,            // Dutch
                    /^(?:показать|открыть|настроить)\s+(?:конфигуратор\s+)?(?:темы)?$/i                          // Russian
                ],
                facets: [
                    /^(?:show|open|view|display)\s+(?:the\s+)?facets?$/i,
                    /^(?:show|open|view|display)\s+facet\s+filter(?:ing)?$/i,
                    /^facets?$/i,
                    /^(?:show|open|view|display)\s+facet\s+table$/i,
                    /^(?:mostra|apri|visualizza)\s+(?:i\s+)?(?:facet\s+)?(?:filtri\s+)?(?:dei\s+)?dati$/i,  // Italian
                    /^(?:mostrar|abrir|ver)\s+(?:los\s+)?(?:facet\s+)?(?:filtros\s+)?(?:de\s+)?datos$/i,        // Spanish
                    /^(?:afficher|ouvrir|voir)\s+(?:les\s+)?(?:facettes?\s+)?(?:filtres\s+)?(?:de\s+)?données$/i,    // French
                    /^(?:zeige|öffne|anzeigen)\s+(?:die\s+)?(?:facet\s+)?(?:filter\s+)?(?:der\s+)?daten$/i,        // German
                    /^(?:mostrar|abrir|ver)\s+(?:os\s+)?(?:facet\s+)?(?:filtros\s+)?(?:de\s+)?dados$/i,        // Portuguese
                    /^(?:toon|open|weergeven)\s+(?:de\s+)?(?:facet\s+)?(?:filters\s+)?(?:met\s+)?gegevens$/i,            // Dutch
                    /^(?:показать|открыть)\s+(?:фасеты\s+)?(?:фильтры\s+)?(?:данных)?$/i                          // Russian
                ],
                screenshot: [
                    /^(?:take|capture|save|get|make)\s+(?:a\s+)?(?:map\s+)?screenshot$/i,
                    /^(?:take|capture|save|get|make)\s+(?:a\s+)?screenshot$/i,
                    /^screenshot$/i,
                    /^(?:save|export)\s+(?:as\s+)?(?:image|png|picture)$/i,
                    /^(?:save|export)\s+(?:the\s+)?map\s+(?:as\s+)?(?:image|png|picture)$/i,
                    /^(?:capture|take)\s+(?:the\s+)?map$/i,
                    /^(?:fai|scatta|cattura|salva)\s+(?:uno\s+)?(?:screenshot|immagine|foto)$/i,  // Italian
                    /^(?:toma|captura|guarda|guarda)\s+(?:una\s+)?(?:captura|imagen|foto)$/i,        // Spanish
                    /^(?:prendre|capturer|enregistrer)\s+(?:une\s+)?(?:capture|image|photo)$/i,    // French
                    /^(?:mache|aufnehmen|speichern)\s+(?:ein\s+)?(?:screenshot|bild|foto)$/i,        // German
                    /^(?:tirar|capturar|salvar)\s+(?:uma\s+)?(?:captura|imagem|foto)$/i,        // Portuguese
                    /^(?:maak|neem|captureer|opslaan)\s+(?:een\s+)?(?:screenshot|afbeelding|foto)$/i,            // Dutch
                    /^(?:сделать|сохранить|захватить)\s+(?:скриншот|изображение|фото)$/i                          // Russian
                ]
            };

            // Check for data table command
            let isDataTableCommand = false;
            for (let pattern of toolCommandPatterns.dataTable) {
                if (pattern.test(query)) {
                    isDataTableCommand = true;
                    break;
                }
            }

            if (isDataTableCommand) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = true;
                sendButton.disabled = true;

                try {
                    // Try to get the last theme ID if available
                    let themeId = null;
                    if (typeof ixmaps !== 'undefined' && typeof ixmaps.getThemes === 'function') {
                        const themes = ixmaps.getThemes();
                        if (themes && themes.length > 0) {
                            const lastTheme = themes[themes.length - 1];
                            if (lastTheme && lastTheme.szId) {
                                themeId = lastTheme.szId;
                            }
                        }
                    }

                    await showDataTable(themeId);
                    addMessage('✅ Data table opened', false);
                } catch (error) {

                    addMessage(`❌ Error opening data table: ${error.message}`, false);
                } finally {
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                }
                return;
            }

            // Check for theme editor command
            let isThemeEditorCommand = false;
            for (let pattern of toolCommandPatterns.themeEditor) {
                if (pattern.test(query)) {
                    isThemeEditorCommand = true;
                    break;
                }
            }

            if (isThemeEditorCommand) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = true;
                sendButton.disabled = true;

                try {
                    await showThemeEditor();
                    addMessage('✅ Theme editor opened', false);
                } catch (error) {

                    addMessage(`❌ Error opening theme editor: ${error.message}`, false);
                } finally {
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                }
                return;
            }

            // Check for configurator command
            let isConfiguratorCommand = false;
            for (let pattern of toolCommandPatterns.configurator) {
                if (pattern.test(query)) {
                    isConfiguratorCommand = true;
                    break;
                }
            }

            if (isConfiguratorCommand) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = true;
                sendButton.disabled = true;

                try {
                    await showConfigurator();
                    addMessage('✅ Theme configurator opened', false);
                } catch (error) {

                    addMessage(`❌ Error opening configurator: ${error.message}`, false);
                } finally {
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                }
                return;
            }

            // Check for facets command
            let isFacetsCommand = false;
            for (let pattern of toolCommandPatterns.facets) {
                if (pattern.test(query)) {
                    isFacetsCommand = true;
                    break;
                }
            }

            if (isFacetsCommand) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = true;
                sendButton.disabled = true;

                try {
                    // Try to get the last theme ID if available
                    let themeId = null;
                    if (typeof ixmaps !== 'undefined' && typeof ixmaps.getThemes === 'function') {
                        const themes = ixmaps.getThemes();
                        if (themes && themes.length > 0) {
                            const lastTheme = themes[themes.length - 1];
                            if (lastTheme && lastTheme.szId) {
                                themeId = lastTheme.szId;
                            }
                        }
                    }

                    await showFacets(themeId);
                    addMessage('✅ Facets opened', false);
                } catch (error) {

                    addMessage(`❌ Error opening facets: ${error.message}`, false);
                } finally {
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                }
                return;
            }

            // Check for screenshot command
            let isScreenshotCommand = false;
            for (let pattern of toolCommandPatterns.screenshot) {
                if (pattern.test(query)) {
                    isScreenshotCommand = true;
                    break;
                }
            }

            if (isScreenshotCommand) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = true;
                sendButton.disabled = true;

                try {
                    await captureMapScreenshot();
                } catch (error) {
                    addMessage(`❌ Error capturing screenshot: ${error.message}`, false);
                } finally {
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                }
                return;
            }

            // Check for save map commands: "save map as filename.html" or "save map as filename.json"
            // Support multiple patterns: "save map as name.html", "save map as name.json", "save map as name"
            // Also support "save" or "save as filename" as shorthand for "save map as filename"
            // Also support multilingual: "salva mappa come nome.html" (Italian), "guardar mapa como nombre.html" (Spanish), etc.
            const saveMapPatterns = [
                /^(?:save|export|download)\s+(?:the\s+)?map\s+as\s+(.+)$/i,  // English: "save map as filename" or "save map as filename.html"
                /^(?:save|export|download)\s+as\s+(.+)$/i,  // English: "save as filename" (treats as "save map as filename")
                /^save\s+(.+)$/i,  // English: "save filename" (treats as "save map as filename")
                /^save$/i,  // English: just "save" (treats as "save map")
                /^(?:salva|esporta|scarica)\s+(?:la\s+)?mappa\s+come\s+(.+)$/i,  // Italian
                /^(?:guardar|exportar|descargar)\s+(?:el\s+)?mapa\s+como\s+(.+)$/i,  // Spanish
                /^(?:enregistrer|exporter|télécharger)\s+(?:la\s+)?carte\s+comme\s+(.+)$/i,  // French
                /^(?:speichern|exportieren|herunterladen)\s+(?:die\s+)?karte\s+als\s+(.+)$/i,  // German
                /^(?:salvar|exportar|baixar)\s+(?:o\s+)?mapa\s+como\s+(.+)$/i  // Portuguese
            ];
            
            let saveMapMatch = null;
            for (let pattern of saveMapPatterns) {
                const match = query.match(pattern);
                if (match) {
                    saveMapMatch = match;
                    break;
                }
            }
            
            if (saveMapMatch) {
                // Extract filename - take everything after "as" or "come" or "como" etc.
                // Handle "save" without filename - use default
                let filename = saveMapMatch[1] ? saveMapMatch[1].trim() : '';
                
                // Remove quotes if present
                filename = filename.replace(/^["']|["']$/g, '');
                
                // Check if user just said "save" without "as" and without filename
                const isJustSave = /^save$/i.test(query.trim());
                const hasAsKeyword = /save\s+as/i.test(query);
                
                if (isJustSave || (!hasAsKeyword && !filename)) {
                    // User just said "save" without "as" - show help message
                    addMessage(query, true);
                    chatInput.value = '';
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                    
                    addMessage(`💾 **How to save your map:**\n\n` +
                        `To save as **HTML** file:\n` +
                        `- \`save map as [filename].html\`\n` +
                        `- \`save map [filename].html\`\n\n` +
                        `To save as **JSON** file:\n` +
                        `- \`save map as [filename].json\`\n` +
                        `- \`save project as [filename].json\`\n` +
                        `- \`save map [filename].json\`\n\n` +
                        `**Examples:**\n` +
                        `- "save map as mymap.html"\n` +
                        `- "save map as mymap.json"\n` +
                        `- "save project as config.json"`, false);
                    return;
                }
                
                // If filename is empty, use default
                if (!filename) {
                    filename = 'map';
                }
                
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = true;
                sendButton.disabled = true;
                
                try {
                    // Determine file type from extension or default to JSON
                    const lowerFilename = filename.toLowerCase();
                    let result;
                    
                    if (lowerFilename.endsWith('.html')) {
                        result = await saveMapAsHTML(filename);
                    } else if (lowerFilename.endsWith('.json')) {
                        result = await saveMapAsJSON(filename);
                    } else {
                        // No extension specified, default to JSON
                        result = await saveMapAsJSON(filename);
                    }
                    
                    addMessage(result.message, false);
                } catch (error) {
                    addMessage(`❌ Error saving map: ${error.message}`, false);
                } finally {
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                }
                return;
            }

            // Check if user wants to analyze something (data, theme, map, or all)
            // This handles "analyze data", "analyze theme", "analyze map", "analyze all", etc.
            const analyzePatterns = {
                // Analyze data patterns (multilingual)
                data: [
                    /^(analyze|analyse)\s+(the\s+)?data$/i,                           // English
                    /^(analyze|analyse)\s+this\s+data$/i,                             // English
                    /^(analyze|analyse)\s+my\s+data$/i,                               // English
                    /^data\s+(analysis|analyze|analyse)$/i,                           // English
                    /^(analizza|analizzare)\s+(i\s+)?dati$/i,                         // Italian
                    /^(analiza|analizar)\s+(los\s+)?datos$/i,                         // Spanish
                    /^(analyser|analyse)\s+(les\s+)?données$/i,                       // French
                    /^(analysiere|analysieren)\s+(die\s+)?daten$/i,                   // German
                    /^(analisar|analise)\s+(os\s+)?dados$/i                           // Portuguese
                ],
                // Analyze theme patterns (multilingual)
                theme: [
                    /^(analyze|analyse)\s+(the\s+)?theme$/i,                          // English
                    /^(analyze|analyse)\s+(the\s+)?themes$/i,                         // English
                    /^(analyze|analyse)\s+(the\s+)?visualization$/i,                  // English
                    /^(analyze|analyse)\s+(the\s+)?visualisation$/i,                  // English (UK)
                    /^theme\s+(analysis|analyze|analyse)$/i,                          // English
                    /^(analizza|analizzare)\s+(il\s+)?tema$/i,                        // Italian
                    /^(analizza|analizzare)\s+(i\s+)?temi$/i,                         // Italian
                    /^(analizza|analizzare)\s+(la\s+)?visualizzazione$/i,             // Italian
                    /^(analiza|analizar)\s+(el\s+)?tema$/i,                           // Spanish
                    /^(analyser|analyse)\s+(le\s+)?thème$/i,                          // French
                    /^(analysiere|analysieren)\s+(das\s+)?thema$/i                    // German
                ],
                // Analyze map patterns (multilingual)
                map: [
                    /^(analyze|analyse)\s+(the\s+)?map$/i,                            // English
                    /^(analyze|analyse)\s+map\s+settings$/i,                          // English
                    /^(analyze|analyse)\s+(the\s+)?map\s+configuration$/i,            // English
                    /^map\s+(analysis|analyze|analyse)$/i,                            // English
                    /^(analizza|analizzare)\s+(la\s+)?mappa$/i,                       // Italian
                    /^(analiza|analizar)\s+(el\s+)?mapa$/i,                           // Spanish
                    /^(analyser|analyse)\s+(la\s+)?carte$/i,                          // French
                    /^(analysiere|analysieren)\s+(die\s+)?karte$/i                    // German
                ],
                // Analyze all / comprehensive analysis patterns (multilingual)
                all: [
                    /^(analyze|analyse)\s+all$/i,                                     // English
                    /^(analyze|analyse)\s+everything$/i,                              // English
                    /^full\s+(analysis|analyze|analyse)$/i,                           // English
                    /^comprehensive\s+(analysis|analyze|analyse)$/i,                  // English
                    /^complete\s+(analysis|analyze|analyse)$/i,                       // English
                    /^(analizza|analizzare)\s+tutto$/i,                               // Italian
                    /^analisi\s+completa$/i,                                          // Italian
                    /^(analiza|analizar)\s+todo$/i,                                   // Spanish
                    /^(analyser|analyse)\s+tout$/i,                                   // French
                    /^(analysiere|analysieren)\s+alles$/i                             // German
                ]
            };

            let analyzeTarget = null;
            for (const [target, patterns] of Object.entries(analyzePatterns)) {
                for (const pattern of patterns) {
                    if (pattern.test(query)) {
                        analyzeTarget = target;
                        break;
                    }
                }
                if (analyzeTarget) break;
            }

            if (analyzeTarget) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = true;
                sendButton.disabled = true;
                addLoadingMessage();

                try {
                    let analysisResult;
                    switch (analyzeTarget) {
                        case 'data':
                            // Use existing analyzeAndIntroduceData if we have data table
                            if (currentDataTable && currentDataUrl) {
                                analysisResult = await analyzeAndIntroduceData(currentDataTable, currentDataUrl);
                            } else {
                                // Try to get data from themes
                                analysisResult = await analyzeAll(); // Fall back to comprehensive
                            }
                            break;
                        case 'theme':
                            analysisResult = await analyzeTheme();
                            break;
                        case 'map':
                            analysisResult = await analyzeMapSettings();
                            break;
                        case 'all':
                            analysisResult = await analyzeAll();
                            break;
                        default:
                            analysisResult = await analyzeAll();
                    }

                    removeLoadingMessage();
                    // Pass 'internal' as modelUsed to indicate this is an internal analysis response
                    // This will use the generic AI icon instead of the internal warning icon
                    addMessage(analysisResult, false, null, 'internal');
                } catch (error) {
                    removeLoadingMessage();

                    addMessage(`❌ Error during analysis: ${error.message}`, false, null, 'internal');
                } finally {
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                }
                return;
            }

            // Check if user wants to go to a location (goto/zoom to place name)
            // But exclude queries about data fields, themes, or other non-geographic requests
            const queryLower = query.toLowerCase();
            const isDataFieldQuery = /(all\s+)?fields?|data\s+fields?|available\s+fields?|list\s+fields?|show\s+fields?|what\s+fields?|theme|themes|binding|bindings|statistics?|data\s+available|available\s+data/i.test(queryLower);
            
            // Only process as goto if it's not a data/field query
            if (!isDataFieldQuery) {
                const gotoPatterns = [
                    /^(goto|go\s+to|zoom\s+to|navigate\s+to|show\s+me|find)\s+(.+)/i,
                    /^(vai\s+a|vai\s+in|zoom\s+a|mostrami)\s+(.+)/i,  // Italian
                    /^(ve\s+a|ir\s+a|zoom\s+a|muéstrame)\s+(.+)/i,     // Spanish
                    /^(aller\s+à|va\s+à|zoom\s+sur|montre[-]moi)\s+(.+)/i,  // French
                    /^(gehe\s+nach|gehe\s+zu|zoom\s+zu|zeige\s+mir)\s+(.+)/i  // German
                ];

                let gotoMatch = null;
                for (let pattern of gotoPatterns) {
                    const match = query.match(pattern);
                    if (match && match[2]) {
                        gotoMatch = match[2].trim();
                        break;
                    }
                }

                if (gotoMatch) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = true;
                sendButton.disabled = true;
                addLoadingMessage();

                try {
                    // Ask AI for geographic coordinates or bounding box
                    const locationPrompt = `I need the geographic coordinates (latitude and longitude) or bounding box for the place: "${gotoMatch}"

Please respond with ONLY a JSON object in this exact format:
{
  "center": {
    "lat": latitude_as_number,
    "lng": longitude_as_number
  },
  "zoom": zoom_level_as_number (optional, default to 10 if not specified),
  "bounds": [optional, if available: [[south, west], [north, east]]]
}

If you cannot find the location, respond with:
{
  "error": "Location not found"
}

Examples:
- For "Rome, Italy": {"center": {"lat": 41.9028, "lng": 12.4964}, "zoom": 10}
- For "New York": {"center": {"lat": 40.7128, "lng": -74.0060}, "zoom": 10}
- For "Paris": {"center": {"lat": 48.8566, "lng": 2.3522}, "zoom": 10}

Location: "${gotoMatch}"`;

                    const aiResult = await askAIDirectly(locationPrompt);
                    const response = aiResult.response || aiResult;
                    
                    // Try to parse JSON from the response
                    let locationData = null;
                    
                    // Try to extract JSON from the response
                    const jsonMatch = response.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        try {
                            locationData = JSON.parse(jsonMatch[0]);
                        } catch (e) {
                            console.error('Failed to parse JSON from AI response:', e);
                        }
                    }
                    
                    removeLoadingMessage();

                    if (locationData && !locationData.error && locationData.center) {
                        // Use ixmaps.setView to zoom to the location
                        const center = locationData.center;
                        const zoom = locationData.zoom || 10;
                        
                        try {
                            if (ixmaps && ixmaps.setView) {
                                ixmaps.setView({
                                    center: {
                                        lat: String(center.lat),
                                        lng: String(center.lng)
                                    },
                                    zoom: String(zoom)
                                });
                                addMessage(`✅ Zoomed to **${gotoMatch}** (${center.lat.toFixed(4)}, ${center.lng.toFixed(4)})`, false, null, 'internal');
                            } else if (ixmaps && ixmaps.map && ixmaps.map().setView) {
                                ixmaps.map().setView({
                                    center: {
                                        lat: String(center.lat),
                                        lng: String(center.lng)
                                    },
                                    zoom: String(zoom)
                                });
                                addMessage(`✅ Zoomed to **${gotoMatch}** (${center.lat.toFixed(4)}, ${center.lng.toFixed(4)})`, false, null, 'internal');
                            } else {
                                addMessage(`❌ Map API not available. Cannot zoom to location.`, false, null, 'internal');
                            }
                        } catch (error) {
                            addMessage(`❌ Error zooming to location: ${error.message}`, false, null, 'internal');
                        }
                        
                        // Always re-enable input after goto (success or error)
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    } else {
                        // If location not found, try to interpret the query in other ways
                        removeLoadingMessage();
                        console.log('🔄 Location not found, trying to reinterpret query:', query);
                        
                        // Don't show error yet - let the query be processed normally
                        // Reset input state and let it fall through to normal query processing
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        
                        // Continue processing as a normal query instead of returning
                        // This will allow the query to be interpreted as discovery, filter, etc.
                    }
                } catch (error) {
                    removeLoadingMessage();
                    // On error, also try to process as normal query instead of showing error
                    console.log('🔄 Error getting location, trying to reinterpret query:', query);
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                    // Continue processing as a normal query instead of returning
                }
                // If we get here, location wasn't found - continue with normal query processing
                }
            }

            // Check if user is asking about application capabilities
            const helpPatterns = [
                /what\s+(can\s+I\s+)?(do\s+)?(with\s+)?(this\s+)?(application|app|tool|system|iXMaps\s+Chat)/i,
                /what\s+are\s+(the\s+)?(features|capabilities|functions)/i,
                /how\s+(can\s+I\s+)?(use|work\s+with)\s+(this\s+)?(application|app|tool|iXMaps\s+Chat)/i,
                /^(help|what\s+can\s+I\s+do|capabilities|features)$/i,
                /show\s+me\s+(what\s+I\s+can\s+do|the\s+features|the\s+capabilities)/i,
                /what\s+is\s+iXMaps\s+Chat/i,
                /tell\s+me\s+about\s+iXMaps\s+Chat/i
            ];

            let isHelpQuery = false;
            for (let pattern of helpPatterns) {
                if (pattern.test(query)) {
                    isHelpQuery = true;
                    break;
                }
            }

            if (isHelpQuery) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = false;
                sendButton.disabled = false;
                showApplicationCapabilities();
                return;
            }

            // Check if user wants to show/hide values (must come before property value queries)
            const valuesPatterns = [
                /^(show\s+value|show\s+values|display\s+value|display\s+values)$/i,
                /^(no\s+value|no\s+values|hide\s+value|hide\s+values|remove\s+value|remove\s+values)$/i,
                /^(mostra\s+valore|mostra\s+valori|nascondi\s+valore|nascondi\s+valori)$/i,  // Italian
                /^(mostrar\s+valor|mostrar\s+valores|ocultar\s+valor|ocultar\s+valores)$/i,  // Spanish
                /^(afficher\s+valeur|afficher\s+valeurs|masquer\s+valeur|masquer\s+valeurs)$/i,  // French
                /^(werte\s+anzeigen|werte\s+ausblenden)$/i  // German
            ];

            let valuesAction = null;
            for (let pattern of valuesPatterns) {
                const match = query.match(pattern);
                if (match) {
                    const command = match[1].toLowerCase();
                    if (command.match(/show|display|mostra|mostrar|afficher|anzeigen/i)) {
                        valuesAction = 'add';
                    } else if (command.match(/no|hide|remove|nascondi|ocultar|masquer|ausblenden/i)) {
                        valuesAction = 'remove';
                    }
                    break;
                }
            }

            if (valuesAction) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = true;
                sendButton.disabled = true;
                addLoadingMessage();

                try {
                    if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                        removeLoadingMessage();
                        addMessage('⚠️ Map not ready. Please wait for the map to load.', false, null, 'internal');
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }

                    const map = ixmaps.embeddedSVG.window.map;
                    const mapApi = map.Api;

                    if (!mapApi || !mapApi.getAllThemes || !mapApi.changeThemeStyle) {
                        removeLoadingMessage();
                        addMessage('❌ Theme API not available.', false, null, 'internal');
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }

                    // Get all themes
                    const themeObjects = mapApi.getAllThemes();
                    if (themeObjects.length === 0) {
                        removeLoadingMessage();
                        addMessage('⚠️ No themes found on the map.', false, null, 'internal');
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }

                    // Extract theme IDs from theme objects (getAllThemes returns objects, not IDs)
                    const themeIds = themeObjects.map(theme => {
                        // Try various properties to get the theme ID
                        return theme.szId || theme.id || theme.szName || theme.name || String(theme);
                    }).filter(Boolean);

                    if (themeIds.length === 0) {
                        removeLoadingMessage();
                        addMessage('⚠️ Could not extract theme IDs from themes.', false, null, 'internal');
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }

                    // Save current project state before making changes
                    saveProjectToHistory();
                    
                    let successCount = 0;
                    let errorMessages = [];

                    // Process each theme
                    for (const themeId of themeIds) {
                        // Ensure themeId is a string
                        const themeIdStr = String(themeId);
                        try {
                            // Use changeThemeStyle with 'add' or 'remove' flag (like themeconfigurator does)
                            // This will add or remove VALUES from the theme type
                            mapApi.changeThemeStyle(themeIdStr, 'type:VALUES;', valuesAction);
                            
                            // If adding VALUES and theme has sizefield, set valuefield = sizefield
                            if (valuesAction === 'add') {
                                try {
                                    // Get theme definition to check for sizefield
                                    const themeDef = mapApi.getThemeDefinitionObj ? mapApi.getThemeDefinitionObj(themeIdStr) : null;
                                    const themeObj = mapApi.getTheme ? mapApi.getTheme(themeIdStr) : null;
                                    
                                    // Check for sizefield in various possible locations
                                    let sizefield = null;
                                    if (themeDef) {
                                        sizefield = themeDef.style?.sizefield || themeDef.sizefield || null;
                                    }
                                    if (!sizefield && themeObj) {
                                        sizefield = themeObj.theme?.szSizeField || themeObj.szSizeField || null;
                                    }
                                    
                                    // If sizefield exists, set valuefield = sizefield
                                    if (sizefield && sizefield !== 'none' && sizefield !== '') {
                                        mapApi.changeThemeStyle(themeIdStr, `valuefield:${sizefield};`, 'set');
                                    }
                                } catch (e) {
                                    // If we can't get theme info, continue anyway (VALUES was already added)
                                    console.warn('Could not check/set valuefield for theme', themeIdStr, e);
                                }
                            }
                            
                            successCount++;
                        } catch (error) {
                            errorMessages.push(`Theme ${themeIdStr}: ${error.message}`);
                        }
                    }

                    removeLoadingMessage();

                    if (successCount > 0) {
                        const action = valuesAction === 'add' ? 'enabled' : 'disabled';
                        const themeText = successCount === 1 ? 'theme' : `${successCount} theme(s)`;
                        addMessage(`✅ Value display ${action} for ${themeText}.`, false, null, 'internal');
                    } else {
                        addMessage(`❌ Failed to change value display: ${errorMessages.join('; ')}`, false, null, 'internal');
                    }
                } catch (error) {
                    removeLoadingMessage();
                    addMessage(`❌ Error changing value display: ${error.message}`, false, null, 'internal');
                } finally {
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                }
                return;
            }

            // Check if user is asking how to change theme properties
            // Check if user is asking about current property values
            // First, get list of valid properties for matching
            const validProperties = getChangeableThemeProperties();
            
            // Build regex pattern for all valid property names
            // Also add synonyms like "normal size" for "normalsizevalue"
            const propertyNamesWithSynonyms = [...validProperties, 'normal size', 'normal-size', 'normal_size'];
            const propertyNamesPattern = propertyNamesWithSynonyms.join('|');
            
            // Patterns to detect property value queries
            const currentPropertyPatterns = [
                // "what is the current normalsizevalue" or "what is the current normal size"
                new RegExp(`(what\\s+is|what's|show|get|tell\\s+me|display)\\s+(the\\s+)?(current|actual|value\\s+of)?\\s*(${propertyNamesPattern})\\b`, 'i'),
                // "current normalsizevalue" or "current normal size" or "actual scale"
                new RegExp(`\\b(current|actual)\\s+(${propertyNamesPattern})\\b`, 'i'),
                // "what is the normalsizevalue" or "what is the normal size" (without "current")
                new RegExp(`(what\\s+is|what's)\\s+(the\\s+)?(${propertyNamesPattern})\\b`, 'i'),
                // "show me the normalsizevalue" or "show me the normal size"
                new RegExp(`(show|get|display)\\s+(me\\s+)?(the\\s+)?(${propertyNamesPattern})\\b`, 'i'),
                // "normalsizevalue value" or "normal size value" or "scale value"
                new RegExp(`\\b(${propertyNamesPattern})\\s+(value|is|equals?|set\\s+to)`, 'i')
            ];

            // Try to extract property name from query
            let propertyName = null;
            let themeId = null;
            
            for (let pattern of currentPropertyPatterns) {
                const match = query.match(pattern);
                if (match) {
                    // Extract property name from match groups
                    // Try different group positions depending on pattern
                    const possibleProperty = match[4] || match[2] || match[3] || match[1];
                    if (possibleProperty) {
                        // Normalize property name (with synonyms like "normal size" -> "normalsizevalue")
                        const normalized = normalizePropertyName(possibleProperty);
                        if (validProperties.includes(normalized)) {
                            propertyName = normalized;
                            break;
                        }
                    }
                }
            }

            // Check if theme is specified (e.g., "for theme X" or "in theme Y")
            const themeMatch = query.match(/(?:for|of|in)\s+(?:the\s+)?(?:theme\s+)?["']?([^"'\s]+)["']?/i);
            if (themeMatch) {
                themeId = themeMatch[1];
            }

            if (propertyName) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = false;
                sendButton.disabled = false;
                
                // Get current property value asynchronously
                getCurrentThemeProperty(propertyName, themeId).then(result => {
                    addMessage(result, false, null, 'internal');
                }).catch(error => {
                    addMessage(`❌ Error: ${error.message}`, false, null, 'internal');
                });
                return;
            }

            // Check if user is asking for max value of a data field
            const maxValuePatterns = [
                /(?:what\s+is|what's|show|get|tell\s+me|display)\s+(?:the\s+)?(?:max|maximum|highest)\s+(?:value\s+of\s+)?([a-z_][a-z0-9_]*)/i,
                /(?:max|maximum|highest)\s+(?:value\s+of\s+)?([a-z_][a-z0-9_]*)/i,
                /([a-z_][a-z0-9_]*)\s+(?:max|maximum|highest)\s+(?:value|is)/i,
                /(?:max|maximum)\s+of\s+([a-z_][a-z0-9_]*)/i
            ];

            let maxValueFieldName = null;
            let maxValueThemeId = null;

            for (let pattern of maxValuePatterns) {
                const match = query.match(pattern);
                if (match) {
                    const possibleField = match[1];
                    if (possibleField && possibleField.length > 1) {
                        maxValueFieldName = possibleField;
                        break;
                    }
                }
            }

            // Check if theme is specified for max value query
            if (maxValueFieldName) {
                const themeMatchForMax = query.match(/(?:for|of|in)\s+(?:the\s+)?(?:theme\s+)?["']?([^"'\s]+)["']?/i);
                if (themeMatchForMax) {
                    maxValueThemeId = themeMatchForMax[1];
                }
            }

            if (maxValueFieldName && ixmaps && ixmaps.aiQuery) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = false;
                sendButton.disabled = false;
                
                // Get max value asynchronously
                ixmaps.aiQuery.getMaxValue(maxValueFieldName, maxValueThemeId).then(result => {
                    if (result.success) {
                        addMessage(result.message, false, null, 'internal');
                    } else {
                        addMessage(result.message, false, null, 'internal');
                    }
                }).catch(error => {
                    addMessage(`❌ Error getting max value: ${error.message}`, false, null, 'internal');
                });
                return;
            }

            const themeChangeHelpPatterns = [
                /how\s+(to\s+)?(change|modify|set)\s+(theme\s+)?(properties|property|style|styles)/i,
                /what\s+(theme\s+)?(properties|property|style|styles)\s+(can\s+)?(be\s+)?(changed|modified|set)/i,
                /(list|show)\s+(theme\s+)?(properties|property|style|styles)/i,
                /(available|changeable)\s+(theme\s+)?(properties|property|style|styles)/i,
                /^size$/i,  // "size" alone should be treated as "how to size"
                /^how\s+(to\s+)?size/i  // "how to size" or "how size"
            ];

            let isThemeChangeHelpQuery = false;
            for (let pattern of themeChangeHelpPatterns) {
                if (pattern.test(query)) {
                    isThemeChangeHelpQuery = true;
                    break;
                }
            }

            if (isThemeChangeHelpQuery) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = false;
                sendButton.disabled = false;
                
                // Check if this is specifically a "size" query
                const isSizeQuery = /^size$/i.test(query.trim()) || /^how\s+(to\s+)?size/i.test(query.trim());
                
                if (isSizeQuery) {
                    // Show size-specific help with numeric fields
                    const sizeHelpText = showSizeHelp();
                    addMessage(sizeHelpText, false, null, 'internal');
                } else {
                    // Show full theme properties help
                    const helpText = showChangeableThemeProperties();
                    addMessage(helpText, false, null, 'internal');
                }
                return;
            }

            // Check if user wants to apply/change classification method (MUST come before help query check)
            // Patterns should match: "change to quantile classification", "apply natural breaks", "use equal interval", etc.
            // Use the already declared lowerQuery variable from earlier in the function
            
            // Check for classification method keywords directly in the query
            let classificationMethod = null;
            
            // Check for quantile (most specific first)
            if (lowerQuery.includes('quantile')) {
                classificationMethod = 'QUANTILE';
            }
            // Check for natural breaks/jenks
            else if (lowerQuery.includes('natural') && (lowerQuery.includes('break') || lowerQuery.includes('jenks'))) {
                classificationMethod = 'NATURAL';
            }
            // Check for equal interval/equidistant
            else if (lowerQuery.includes('equal') && lowerQuery.includes('interval') || lowerQuery.includes('equidistant')) {
                classificationMethod = 'EQUIDISTANT';
            }
            // Check for just "natural" (might be ambiguous, but if user says "apply natural" it's likely natural breaks)
            else if (lowerQuery.match(/(apply|use|set|change\s+to|switch\s+to)\s+natural/i)) {
                classificationMethod = 'NATURAL';
            }
            
            // Only proceed if we found a classification method AND the query contains action words
            if (classificationMethod) {
                const hasAction = /(apply|use|set|change\s+to|switch\s+to|enable)/i.test(query);
                if (hasAction) {
                    // This is a command to apply classification, not a question
                    addMessage(query, true);
                    chatInput.value = '';
                    chatInput.disabled = true;
                    sendButton.disabled = true;
                    addLoadingMessage();

                    try {
                        if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                            removeLoadingMessage();
                            addMessage('⚠️ Map not ready. Please wait for the map to load.', false, null, 'internal');
                            chatInput.disabled = false;
                            sendButton.disabled = false;
                            chatInput.focus();
                            return;
                        }

                        const map = ixmaps.embeddedSVG.window.map;
                        const mapApi = map.Api;

                        if (!mapApi || !mapApi.getAllThemes || !mapApi.changeThemeStyle) {
                            removeLoadingMessage();
                            addMessage('❌ Theme API not available.', false, null, 'internal');
                            chatInput.disabled = false;
                            sendButton.disabled = false;
                            chatInput.focus();
                            return;
                        }

                        // Get all themes
                        const themes = mapApi.getAllThemes();
                        if (themes.length === 0) {
                            removeLoadingMessage();
                            addMessage('⚠️ No themes found on the map.', false, null, 'internal');
                            chatInput.disabled = false;
                            sendButton.disabled = false;
                            chatInput.focus();
                            return;
                        }

                        // Save current project state before making changes
                        saveProjectToHistory();
                        
                        let successCount = 0;
                        let errorMessages = [];

                        // Process each theme
                        for (const themeId of themes) {
                            try {
                                // Get current theme definition to check existing type
                                const themeDef = mapApi.getMapThemeDefinitionObj ? mapApi.getMapThemeDefinitionObj(themeId) : null;
                                let currentType = '';
                                
                                if (themeDef && themeDef.style && themeDef.style.type) {
                                    currentType = themeDef.style.type;
                                }

                                // Build new type: preserve CHOROPLETH, CHART, etc., but replace classification method
                                let newType = currentType;
                                
                                // Remove existing classification methods
                                newType = newType.replace(/\|EQUIDISTANT|\|QUANTILE|\|NATURAL/g, '');
                                
                                // Ensure CHOROPLETH is present (needed for classification)
                                if (!newType.includes('CHOROPLETH') && !newType.includes('CHART')) {
                                    if (newType) {
                                        newType = 'CHOROPLETH|' + newType;
                                    } else {
                                        newType = 'CHOROPLETH';
                                    }
                                }
                                
                                // Add the new classification method
                                if (!newType.endsWith('|' + classificationMethod)) {
                                    newType = newType + '|' + classificationMethod;
                                }

                                // Apply the new type
                                // Use 'set' action to replace the type entirely
                                mapApi.changeThemeStyle(themeId, `type:${newType}`, 'set');
                                successCount++;
                            } catch (error) {
                                errorMessages.push(`Theme ${themeId}: ${error.message}`);
                            }
                        }

                        removeLoadingMessage();

                        if (successCount > 0) {
                            const methodName = classificationMethod === 'EQUIDISTANT' ? 'equal interval' : 
                                             classificationMethod === 'QUANTILE' ? 'quantile' : 'natural breaks';
                            const themeText = themes.length === 1 ? 'theme' : `${successCount} theme(s)`;
                            addMessage(`✅ Applied ${methodName} classification to ${themeText}.`, false, null, 'internal');
                        } else {
                            addMessage(`❌ Failed to apply classification: ${errorMessages.join('; ')}`, false, null, 'internal');
                        }
                    } catch (error) {
                        removeLoadingMessage();
                        addMessage(`❌ Error applying classification: ${error.message}`, false, null, 'internal');
                    } finally {
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                    }
                    return;
                }
                // If no action word, reset classificationMethod so it can be treated as a question
                classificationMethod = null;
            }

            // Check if user is asking about classification methods (only if not applying)
            const classificationPatterns = [
                /(what\s+are\s+)?(the\s+)?(data\s+)?(classification\s+)?(methods|types|modes)/i,
                /(explain|describe|show|tell\s+me\s+about)\s+(data\s+)?(classification\s+)?(methods|types|modes)/i,
                /(how\s+does\s+)?(equal\s+interval|equidistant|quantile|natural\s+breaks|jenks)\s+(classification|work)/i,
                /(classification\s+)?(equal\s+interval|equidistant|quantile|natural\s+breaks|jenks)/i,
                /(what\s+is|what's)\s+(equal\s+interval|equidistant|quantile|natural\s+breaks|jenks)/i,
                /(metodi|metodo)\s+(di\s+)?(classificazione|classificazione\s+dei\s+dati)/i,  // Italian
                /(métodos|método)\s+(de\s+)?(clasificación|clasificación\s+de\s+datos)/i,      // Spanish
                /(méthodes|méthode)\s+(de\s+)?(classification|classification\s+des\s+données)/i, // French
                /(klassifizierungsmethoden|klassifizierungsmethode)/i                           // German
            ];

            let isClassificationQuery = false;
            for (let pattern of classificationPatterns) {
                if (pattern.test(query)) {
                    isClassificationQuery = true;
                    break;
                }
            }

            if (isClassificationQuery) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = false;
                sendButton.disabled = false;
                const helpText = showClassificationMethods();
                addMessage(helpText, false, null, 'internal');
                return;
            }

            // Check if user wants to change scale (smaller/bigger)
            const scaleChangePatterns = [
                /^(smaller|make\s+smaller|reduce\s+size|zoom\s+out)$/i,
                /^(bigger|make\s+bigger|increase\s+size|zoom\s+in)$/i,
                /^(più\s+piccolo|riduci|ingrandisci|più\s+grande)$/i,  // Italian
                /^(más\s+pequeño|reducir|ampliar|más\s+grande)$/i,     // Spanish
                /^(plus\s+petit|réduire|agrandir|plus\s+grand)$/i,       // French
                /^(kleiner|verkleinern|vergrößern|größer)$/i            // German
            ];

            let scaleChangeMatch = null;
            for (let pattern of scaleChangePatterns) {
                const match = query.match(pattern);
                if (match) {
                    const command = match[1].toLowerCase();
                    if (command.match(/smaller|piccolo|pequeño|petit|kleiner|reduce|riduci|reducir|réduire|verkleinern|zoom\s+out/i)) {
                        scaleChangeMatch = 'smaller';
                    } else if (command.match(/bigger|grande|grand|größer|increase|ingrandisci|ampliar|agrandir|vergrößern|zoom\s+in/i)) {
                        scaleChangeMatch = 'bigger';
                    }
                    break;
                }
            }

            if (scaleChangeMatch) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = true;
                sendButton.disabled = true;
                addLoadingMessage();

                try {
                    if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                        removeLoadingMessage();
                        addMessage('⚠️ Map not ready. Please wait for the map to load.', false, null, 'internal');
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }

                    const map = ixmaps.embeddedSVG.window.map;
                    const mapApi = map.Api;

                    if (!mapApi || !mapApi.getAllThemes || !mapApi.changeThemeStyle || !mapApi.getMapThemeDefinitionObj) {
                        removeLoadingMessage();
                        addMessage('❌ Theme API not available.', false, null, 'internal');
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }

                    // Get all themes
                    const themes = mapApi.getAllThemes();
                    if (themes.length === 0) {
                        removeLoadingMessage();
                        addMessage('⚠️ No themes found on the map.', false, null, 'internal');
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }

                    // Save current project state before making changes
                    saveProjectToHistory();
                    
                    // Calculate scale factor
                    const scaleFactor = scaleChangeMatch === 'smaller' ? 3/4 : 5/4;
                    let successCount = 0;
                    let errorMessages = [];

                    // Process each theme
                    for (const themeId of themes) {
                        try {
                            // Get current theme definition
                            const themeDef = mapApi.getMapThemeDefinitionObj(themeId);
                            if (!themeDef || !themeDef.style) {
                                continue;
                            }

                            // Get current scale (default to 1 if not set)
                            const currentScale = themeDef.style.scale ? parseFloat(themeDef.style.scale) : 1;
                            const newScale = currentScale * scaleFactor;

                            // Apply new scale using changeThemeStyle
                            const styleString = `scale:${newScale}`;
                            mapApi.changeThemeStyle(themeId, styleString);
                            successCount++;
                        } catch (error) {
                            errorMessages.push(`Theme ${themeId}: ${error.message}`);
                        }
                    }

                    removeLoadingMessage();

                    if (successCount > 0) {
                        const action = scaleChangeMatch === 'smaller' ? 'reduced' : 'increased';
                        const themeText = themes.length === 1 ? 'theme' : `${successCount} theme(s)`;
                        addMessage(`✅ ${action.charAt(0).toUpperCase() + action.slice(1)} scale for ${themeText} (factor: ${scaleFactor}).`, false, null, 'internal');
                    } else {
                        addMessage(`❌ Failed to change scale: ${errorMessages.join('; ')}`, false, null, 'internal');
                    }
                } catch (error) {
                    removeLoadingMessage();
                    addMessage(`❌ Error changing scale: ${error.message}`, false, null, 'internal');
                } finally {
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                }
                return;
            }

            // Check if user wants to enable dynamic scaling
            const dynamicScalingPatterns = [
                /(enable|turn\s+on|activate|use)\s+(dynamic\s+)?scaling/i,
                /(dynamic\s+)?scaling\s+(on|enable|activate)/i,
                /set\s+(dynamic\s+)?scaling/i
            ];

            let enableDynamicScaling = false;
            for (let pattern of dynamicScalingPatterns) {
                if (pattern.test(query)) {
                    enableDynamicScaling = true;
                    break;
                }
            }

            if (enableDynamicScaling) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = true;
                sendButton.disabled = true;
                addLoadingMessage();

                try {
                    if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                        removeLoadingMessage();
                        addMessage('⚠️ Map not ready. Please wait for the map to load.', false, null, 'internal');
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }

                    const map = ixmaps.embeddedSVG.window.map;
                    const mapApi = map.Api;

                    if (!mapApi || !mapApi.getMapScale) {
                        removeLoadingMessage();
                        addMessage('❌ Map API not available.', false, null, 'internal');
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }

                    // Get current map scale
                    const mapScale = mapApi.getMapScale();
                    if (!mapScale) {
                        removeLoadingMessage();
                        addMessage('❌ Could not get current map scale.', false, null, 'internal');
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }

                    // Extract the part after the colon (e.g., "1:20000000" -> "20000000")
                    let scaleValue = mapScale;
                    if (typeof mapScale === 'string' && mapScale.includes(':')) {
                        scaleValue = mapScale.split(':')[1].trim();
                    } else if (typeof mapScale === 'string') {
                        // If it's already just a number string, use it as is
                        scaleValue = mapScale.trim();
                    } else {
                        // If it's a number, convert to string
                        scaleValue = String(mapScale);
                    }

                    // Get the map instance to set options
                    if (!mapInstance || !mapInstance.options) {
                        // Try to get map instance from ixmaps
                        if (ixmaps.map && typeof ixmaps.map === 'function') {
                            const currentMap = ixmaps.map();
                            if (currentMap && currentMap.options) {
                                // Set objectscaling to dynamic and normalSizeScale to the scale value
                                currentMap.options({
                                    objectscaling: "dynamic",
                                    normalSizeScale: scaleValue
                                });
                                
                                removeLoadingMessage();
                                addMessage(`✅ Dynamic scaling enabled. Set objectscaling to "dynamic" and normalSizeScale to ${scaleValue}.`, false, null, 'internal');
                            } else {
                                removeLoadingMessage();
                                addMessage('❌ Could not access map options.', false, null, 'internal');
                            }
                        } else {
                            removeLoadingMessage();
                            addMessage('❌ Could not access map instance.', false, null, 'internal');
                        }
                    } else {
                        // Use stored mapInstance
                        mapInstance.options({
                            objectscaling: "dynamic",
                            normalSizeScale: scaleValue
                        });
                        
                        removeLoadingMessage();
                        addMessage(`✅ Dynamic scaling enabled. Set objectscaling to "dynamic" and normalSizeScale to ${scaleValue}.`, false, null, 'internal');
                    }
                } catch (error) {
                    removeLoadingMessage();
                    addMessage(`❌ Error enabling dynamic scaling: ${error.message}`, false, null, 'internal');
                } finally {
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                }
                return;
            }

            // Check if user wants to change a theme property
            // Patterns: "change linecolor to red", "set fillopacity to 0.5", "change textcolor to blue", etc.
            // Also supports "normal size" as synonym for "normalsizevalue"
            const changePropertyPatterns = [
                /(change|set|modify)\s+([\w\s]+?)\s+(to|as|=\s*)\s*(.+?)(?:\s+for\s+theme\s+\w+)?$/i,
                /(change|set|modify)\s+([\w\s]+?)\s+(.+?)(?:\s+for\s+theme\s+\w+)?$/i
            ];

            let propertyChangeMatch = null;
            for (let pattern of changePropertyPatterns) {
                const match = query.match(pattern);
                if (match) {
                    // Check if the property is in our list of changeable properties
                    // Normalize property name (handles "normal size" -> "normalsizevalue")
                    const rawPropertyName = match[2].trim();
                    const propertyName = normalizePropertyName(rawPropertyName);
                    const validProperties = getChangeableThemeProperties();
                    if (validProperties.includes(propertyName)) {
                        // Extract value - handle "to" keyword
                        let value = match[4] || match[3];
                        // Remove "to" if it's still in the value
                        value = value.replace(/^\s*(to|as|=\s*)\s*/i, '').trim();
                        propertyChangeMatch = {
                            property: propertyName,
                            value: value
                        };
                        break;
                    }
                }
            }

            if (propertyChangeMatch) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = true;
                sendButton.disabled = true;
                addLoadingMessage();

                try {
                    // Try to extract theme ID if specified (e.g., "change linecolor to red for theme1")
                    const themeIdMatch = query.match(/for\s+(theme\s+)?([^\s]+)/i);
                    const themeId = themeIdMatch ? themeIdMatch[2] : null;

                    const result = await changeThemeProperty(
                        propertyChangeMatch.property,
                        propertyChangeMatch.value.trim(),
                        themeId
                    );
                    removeLoadingMessage();
                    addMessage(result, false, null, 'internal');
                } catch (error) {
                    removeLoadingMessage();
                    addMessage(`❌ Error: ${error.message}`, false, null, 'internal');
                } finally {
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                }
                return;
            }

            // Check if user is asking for project HTML code (check this BEFORE JSON code)
            const htmlCodePatterns = [
                /(show|get|display|give|send)\s+(me\s+)?(the\s+)?(html\s+)?code/i,      // English: "show html code", "show code html"
                /(html\s+code|code\s+html)/i,                                            // English: "html code" or "code html"
                /(mostra|mostrami|dammi)\s+(il\s+)?(codice\s+)?html/i,              // Italian: "mostra codice html"
                /(codice\s+html|html\s+codice)/i,                                       // Italian: "codice html"
                /(muestra|muéstrame|dame)\s+(el\s+)?(código\s+)?html/i,                  // Spanish: "muestra código html"
                /(código\s+html|html\s+código)/i,                                       // Spanish: "código html"
                /(montre|montre-moi|donne)\s+(le\s+)?(code\s+)?html/i,                  // French: "montre code html"
                /(code\s+html|html\s+code)/i,                                           // French: "code html"
                /(zeige|zeig|gib)\s+(mir\s+)?(den\s+)?(html\s+)?code/i,                  // German: "zeige html code"
                /(mostra|mostre|dá)\s+(o\s+)?(código\s+)?html/i,                        // Portuguese: "mostra código html"
                /(código\s+html|html\s+código)/i,                                       // Portuguese: "código html"
                /(toon|geef|laat)\s+(me\s+)?(de\s+)?(html\s+)?code/i,                    // Dutch: "toon html code"
                /(pokaż|pokaż\s+mi|daj)\s+(kod\s+)?html/i,                               // Polish: "pokaż kod html"
                /(покажи|покажи\s+мне|дай)\s+(код\s+)?html/i,                            // Russian: "покажи код html"
                /(表示|显示|给我)\s*(html\s*代码|代码\s*html)/i,                            // Chinese: "显示html代码"
                /(HTML\s*コード|コード\s*HTML)/i,                                         // Japanese: "HTMLコード"
                /^(html)$/i                                                             // Just "html"
            ];

            let isHtmlCodeQuery = false;
            for (let pattern of htmlCodePatterns) {
                if (pattern.test(query)) {
                    isHtmlCodeQuery = true;
                    break;
                }
            }

            if (isHtmlCodeQuery) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = false;
                sendButton.disabled = false;
                showProjectHTML();
                return;
            }

            // Check if user is asking for project code (JSON)
            const codePatterns = [
                /(show|get|display|give|send)\s+(me\s+)?(the\s+)?(project\s+)?code/i,  // English
                /(mostra|mostrami|dammi|visualizza)\s+(il\s+)?(codice|progetto)/i,      // Italian
                /(muestra|muéstrame|dame|visualiza)\s+(el\s+)?(código|proyecto)/i,      // Spanish
                /(montre|montre-moi|donne|affiche)\s+(le\s+)?(code|projet)/i,           // French
                /(zeige|zeig|gib)\s+(mir\s+)?(den\s+)?(code|projekt)/i,                 // German
                /(mostra|mostre|dá)\s+(o\s+)?(código|projeto)/i,                        // Portuguese
                /(toon|geef|laat)\s+(me\s+)?(de\s+)?(code|project)/i,                    // Dutch
                /(pokaż|pokaż\s+mi|daj)\s+(kod|projekt)/i,                               // Polish
                /(покажи|покажи\s+мне|дай)\s+(код|проект)/i,                            // Russian
                /(表示|显示|给我)\s*(代码|项目)/i,                                        // Chinese
                /コード|プロジェクト.*コード|コード.*表示/i,                                 // Japanese
                /^(code|codice|código|code|projekt)$/i                                  // Just "code" in various languages
            ];

            let isCodeQuery = false;
            for (let pattern of codePatterns) {
                if (pattern.test(query)) {
                    isCodeQuery = true;
                    break;
                }
            }

            if (isCodeQuery) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = false;
                sendButton.disabled = false;
                showProjectCode();
                return;
            }

            // Check if user is asking for theme JavaScript code
            const themeCodePatterns = [
                /(show|get|display|give|send)\s+(me\s+)?(the\s+)?(themes?\s+)?(javascript|js|code)/i,  // English: "show theme code", "show themes code", "show theme javascript"
                /(themes?\s+(javascript|js|code)|javascript\s+code\s+for\s+themes?)/i,                    // English: "theme code", "themes code", "javascript code for theme"
                /(mostra|mostrami|dammi)\s+(il\s+)?(codice|javascript)\s+(dei\s+|del\s+)?temi?/i,            // Italian
                /(muestra|muéstrame|dame)\s+(el\s+)?(código|javascript)\s+(de\s+|del\s+)?temas?/i,            // Spanish
                /(montre|montre-moi|donne)\s+(le\s+)?(code|javascript)\s+(des\s+|du\s+)?thèmes?/i,              // French
                /(zeige|zeig|gib)\s+(mir\s+)?(den\s+)?(code|javascript)\s+(des\s+)?themas?/i,          // German
                /(mostra|mostre|dá)\s+(o\s+)?(código|javascript)\s+(dos\s+|do\s+)?temas?/i,                    // Portuguese
                /(toon|geef|laat)\s+(me\s+)?(de\s+)?(code|javascript)\s+(van\s+)?(de\s+|het\s+)?themas?/i,    // Dutch
                /(покажи|покажи\s+мне|дай)\s+(код|javascript)\s+(темы|тема)/i                        // Russian
            ];

            let isThemeCodeQuery = false;
            let themeIdFromQuery = null;
            
            for (let pattern of themeCodePatterns) {
                if (pattern.test(query)) {
                    isThemeCodeQuery = true;
                    // Try to extract theme ID if specified (e.g., "show theme code for theme1")
                    const themeIdMatch = query.match(/(?:for|of|theme)\s+([^\s]+)/i);
                    if (themeIdMatch) {
                        themeIdFromQuery = themeIdMatch[1];
                    }
                    break;
                }
            }

            if (isThemeCodeQuery) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = false;
                sendButton.disabled = false;
                showThemeCode(themeIdFromQuery);
                return;
            }

            // Check if user wants to configure tooltip
            const tooltipPatterns = [
                /(set|configure|change|update|modify)\s+(the\s+)?tooltip/i,              // English: "set tooltip", "configure tooltip"
                /tooltip\s+(to|as|with|for)/i,                                            // English: "tooltip to show...", "tooltip with..."
                /(imposta|configura|cambia|aggiorna)\s+(il\s+)?tooltip/i,              // Italian: "imposta tooltip"
                /tooltip\s+(per|con|a)/i,                                                // Italian: "tooltip per..."
                /(establecer|configurar|cambiar|actualizar)\s+(el\s+)?tooltip/i,        // Spanish: "establecer tooltip"
                /tooltip\s+(para|con|a)/i,                                               // Spanish: "tooltip para..."
                /(définir|configurer|changer|mettre\s+à\s+jour)\s+(le\s+)?tooltip/i,     // French: "définir tooltip"
                /tooltip\s+(pour|avec|à)/i,                                               // French: "tooltip pour..."
                /(setze|konfiguriere|ändere|aktualisiere)\s+(den\s+)?tooltip/i,         // German: "setze tooltip"
                /tooltip\s+(für|mit|zu)/i,                                               // German: "tooltip für..."
                /(definir|configurar|alterar|atualizar)\s+(o\s+)?tooltip/i,             // Portuguese: "definir tooltip"
                /tooltip\s+(para|com|a)/i,                                               // Portuguese: "tooltip para..."
                /(stel|configureer|wijzig|update)\s+(de\s+)?tooltip/i,                  // Dutch: "stel tooltip"
                /tooltip\s+(voor|met|om)/i,                                              // Dutch: "tooltip voor..."
                /(ustaw|skonfiguruj|zmień|zaktualizuj)\s+(tooltip|podpowiedź)/i,        // Polish: "ustaw tooltip"
                /(установить|настроить|изменить|обновить)\s+(tooltip|подсказку)/i,      // Russian: "установить tooltip"
                /(设置|配置|更改|更新)\s*(tooltip|提示)/i,                                // Chinese: "设置tooltip"
                /(設定|設定|変更|更新)\s*(tooltip|ツールチップ)/i                          // Japanese: "設定tooltip"
            ];

            let isTooltipQuery = false;
            for (let pattern of tooltipPatterns) {
                if (pattern.test(query)) {
                    isTooltipQuery = true;
                    break;
                }
            }

            if (isTooltipQuery) {
                addMessage(query, true);
                chatInput.value = '';
                chatInput.disabled = false;
                sendButton.disabled = false;
                configureTooltip(query);
                return;
            }

            // Check if user is asking "what is X" or "explain X" where X is not a theme/field/map term
            const whatIsPatterns = [
                /^(?:what\s+is|what's|what\s+are|explain|define|tell\s+me\s+about|describe)\s+(.+)$/i,  // English
                /^(?:cos\s+è|cosa\s+è|spiega|definisci|dimmi\s+di)\s+(.+)$/i,                          // Italian
                /^(?:qué\s+es|qué\s+son|explica|define|dime\s+sobre|describe)\s+(.+)$/i,                // Spanish
                /^(?:qu['']est[-]ce\s+que|explique|définir|parle[-]moi\s+de|décrire)\s+(.+)$/i,         // French
                /^(?:was\s+ist|was\s+sind|erkläre|definiere|erzähl\s+mir\s+von|beschreibe)\s+(.+)$/i,   // German
                /^(?:o\s+que\s+é|o\s+que\s+são|explique|definir|fale[-]me\s+sobre|descreva)\s+(.+)$/i,  // Portuguese
                /^(?:wat\s+is|wat\s+zijn|leg\s+uit|definieer|vertel\s+me\s+over|beschrijf)\s+(.+)$/i,  // Dutch
                /^(?:что\s+такое|объясни|определи|расскажи\s+о|опиши)\s+(.+)$/i                        // Russian
            ];

            let extractedTerm = null;
            for (let pattern of whatIsPatterns) {
                const match = query.match(pattern);
                if (match && match[1]) {
                    extractedTerm = match[1].trim();
                    // Remove trailing question marks and common words
                    extractedTerm = extractedTerm.replace(/[?.,;:!]+$/g, '').trim();
                    break;
                }
            }

            // If we extracted a term, check if it's a known theme/field/map term
            if (extractedTerm) {
                let isKnownTerm = false;
                const termLower = extractedTerm.toLowerCase();

                // Check if it's a map-related term
                const mapTerms = ['map', 'theme', 'themes', 'layer', 'layers', 'data', 'field', 'fields',
                    'visualization', 'choropleth', 'chart', 'bubble', 'pie', 'bar',
                    'tooltip', 'legend', 'mappa', 'tema', 'temas', 'capa', 'capas',
                    'dati', 'campo', 'campi', 'visualizzazione', 'carta', 'cartes',
                    'karte', 'karten', 'thema', 'themen', 'mapa', 'mapas', 'tema', 'temas'];

                if (mapTerms.includes(termLower)) {
                    isKnownTerm = true;
                }

                // Check if it matches any theme names or titles
                if (!isKnownTerm && ixmaps && ixmaps.getThemes) {
                    try {
                        const themes = ixmaps.getThemes();
                        for (const theme of themes) {
                            const themeId = theme.szId || theme.id || theme.name || '';
                            const themeTitle = theme.szTitle || theme.title || '';
                            if (themeId.toLowerCase().includes(termLower) ||
                                themeTitle.toLowerCase().includes(termLower)) {
                                isKnownTerm = true;
                                break;
                            }
                        }
                    } catch (e) {

                    }
                }

                // Check if it matches any data fields
                if (!isKnownTerm && ixmaps && ixmaps.aiQuery) {
                    try {
                        const schemas = ixmaps.aiQuery.getAvailableSchemas();
                        for (const schema of schemas) {
                            if (schema.fields) {
                                for (const field of schema.fields) {
                                    const fieldName = typeof field === 'string' ? field : (field.name || field.field || field.id || '');
                                    if (fieldName.toLowerCase() === termLower ||
                                        fieldName.toLowerCase().includes(termLower) ||
                                        termLower.includes(fieldName.toLowerCase())) {
                                        isKnownTerm = true;
                                        break;
                                    }
                                }
                                if (isKnownTerm) break;
                            }
                        }
                    } catch (e) {

                    }
                }

                // If it's not a known term, ask AI to explain it
                if (!isKnownTerm) {
                    addMessage(query, true);
                    chatInput.value = '';
                    chatInput.disabled = true;
                    sendButton.disabled = true;
                    addLoadingMessage();

                    try {
                        const explanationPrompt = `The user is asking: "${query}"\n\nPlease provide a clear, helpful explanation of what "${extractedTerm}" means. If it's a technical term, explain it in simple terms. If it's related to mapping or data visualization, provide context. Be concise but informative.`;

                        const result = await askAIDirectly(explanationPrompt);
                        removeLoadingMessage();
                        const aiResponse = result.response || result;
                        const modelUsed = result.model || null;
                        addMessage(aiResponse, false, null, modelUsed);
                    } catch (error) {
                        removeLoadingMessage();

                        // Check if it's a comprehensive error message
                        if (error.status === 429 || (error.message && error.message.includes('## ⚠️ Rate Limit Exceeded'))) {
                            addMessage(error.message, false);
                        } else {
                            addMessage(`❌ I couldn't explain "${extractedTerm}" right now. Please try again later.`, false);
                        }
                    } finally {
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                    }
                    return;
                }
            }

            addMessage(query, true);
            chatInput.value = '';

            chatInput.disabled = true;
            sendButton.disabled = true;

            // Check if there are themes on the map BEFORE processing the query
            // If no themes, ask Gemini directly for a conversational response (not JSON parsing)
            setTimeout(async () => {
                const hasThemes = checkIfMapHasThemes();

                if (!hasThemes) {
                    const useGemini = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.useGemini;
                    const hasApiKey = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.geminiApiKey;

                    // Check if any AI provider is available
                    const useMistral = localStorage.getItem('useMistral') === 'true';
                    const mistralApiKey = localStorage.getItem('mistralApiKey');
                    const hasAnyAI = (useGemini && hasApiKey) || (useMistral && mistralApiKey);

                    if (hasAnyAI) {
                        addLoadingMessage();
                        // Ask AI directly without schema for conversational response (bypass JSON parsing)
                        // This will try Gemini first, then Mistral as fallback
                        askAIDirectly(query).then(result => {
                            removeLoadingMessage();
                            // result is now an object with { response, model }
                            const aiResponse = result.response || result; // Support both old (string) and new (object) format
                            const modelUsed = result.model || null; // Get model from result
                            addMessage(aiResponse, false, null, modelUsed);
                        }).catch(aiError => {
                            removeLoadingMessage();

                            // Check if it's a comprehensive error message (from our improved error handling)
                            if (aiError.status === 429 || (aiError.message && aiError.message.includes('## ⚠️ Rate Limit Exceeded'))) {
                                // Display the comprehensive error message directly
                                addMessage(aiError.message, false);
                            } else {
                                // Fallback message when AI fails (rate limit, tier restrictions, etc.)
                                let responseText = `I understand your question, but I'm currently unable to provide a direct answer. `;

                                if (aiError.message && (aiError.message.includes('rate limit') || aiError.message.includes('tier') || aiError.message.includes('quota') || aiError.message.includes('429'))) {
                                    responseText += `\n\n⚠️ **Note:** AI API has limitations (rate limits or quota restrictions).\n\n`;
                                }

                                responseText += `\n💡 **To use the full query capabilities:**\n`;
                                responseText += window.__IXMAPS_AI_CHAT_EMBED_HOST__
                                    ? `- Load data with \`load data url [URL]\` if you need another dataset\n`
                                    : `- Load some data first: \`load data url [URL]\` or \`show me some sample data\`\n`;
                                responseText += `- Then ask questions about your data\n`;
                                responseText += `- The query system works better when data is loaded on the map\n\n`;
                                responseText += `**Available commands:**\n`;
                                if (!window.__IXMAPS_AI_CHAT_EMBED_HOST__) {
                                    responseText += `- \`show me some sample data\` - See example datasets\n`;
                                }
                                responseText += `- \`load data url [URL]\` - Load a data file\n`;
                                responseText += `- \`what can I do\` - Learn about iXMaps Chat features`;

                                addMessage(responseText, false);
                            }
                        }).finally(() => {
                            chatInput.disabled = false;
                            sendButton.disabled = false;
                            chatInput.focus();
                        });
                        return;
                    } else {
                        // No Gemini, show helpful message
                        let responseText = `There are no data themes on the map yet.\n\n`;
                        responseText += `💡 **To get started:**\n`;
                        responseText += window.__IXMAPS_AI_CHAT_EMBED_HOST__
                            ? `- Load data with \`load data url [URL]\`\n`
                            : `- Load some data: \`load data url [URL]\` or \`show me some sample data\`\n`;
                        responseText += `- Then ask questions about your data\n\n`;
                        responseText += `**Available commands:**\n`;
                        if (!window.__IXMAPS_AI_CHAT_EMBED_HOST__) {
                            responseText += `- \`show me some sample data\` - See example datasets\n`;
                        }
                        responseText += `- \`load data url [URL]\` - Load a data file\n`;
                        responseText += `- \`what can I do\` - Learn about application features`;

                        addMessage(responseText, false);
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }
                }

                // If we have themes, proceed with normal query processing
                try {
                    if (!ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                        throw new Error('Map not ready yet. Please wait a moment and try again.');
                    }

                    addLoadingMessage();

                    // Check if any AI provider is available
                    const useGemini = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config &&
                        ixmaps.aiQuery.config.useGemini &&
                        ixmaps.aiQuery.config.geminiApiKey;
                    const useMistralForAll = localStorage.getItem('useMistralForAll') === 'true';
                    const mistralApiKey = localStorage.getItem('mistralApiKey');
                    const useMistral = useMistralForAll && mistralApiKey;
                    const hasAnyAI = useGemini || useMistral;

                    // Also check if ixmaps.aiQuery exists (needed for some features even with Mistral)
                    const hasAiQuery = ixmaps && ixmaps.aiQuery;

                    if (!hasAnyAI && !hasAiQuery) {
                        removeLoadingMessage();
                        let errorMsg = `**Error:** AI Query system is not available.\n\n`;
                        errorMsg += `💡 **To enable AI queries:**\n`;
                        errorMsg += `- Open Settings (⚙️) and configure your API keys:\n`;
                        errorMsg += `  - Gemini API key (from Google AI Studio)\n`;
                        errorMsg += `  - Or Mistral API key\n`;
                        errorMsg += `- Enable "Use Gemini" or "Use Mistral for all queries"\n\n`;
                        errorMsg += `**Note:** The system can work without API keys for simple queries, but AI features require an API key.`;
                        addMessage(errorMsg, false);
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }

                    // If only Mistral is configured but aiQuery doesn't exist, use direct Mistral call
                    if (useMistral && !hasAiQuery) {
                        try {
                            const response = await callMistralAPI(query);
                            removeLoadingMessage();
                            addMessage(response, false);
                        } catch (error) {
                            removeLoadingMessage();
                            addMessage(`❌ Error: ${error.message}`, false);
                        }
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }

                    // If aiQuery doesn't exist but we have Gemini, show error
                    if (!hasAiQuery && useGemini) {
                        removeLoadingMessage();
                        addMessage(`❌ Error: AI Query system (ai_agent_prototype.js) failed to load. Please check the browser console for errors and refresh the page.`, false);
                        chatInput.disabled = false;
                        sendButton.disabled = false;
                        chatInput.focus();
                        return;
                    }

                    // Use aiQuery if available
                    if (hasAiQuery) {
                        ixmaps.aiQuery.ask(query, {
                            theme: null
                        }).then(result => {
                            removeLoadingMessage();

                            // Get modelUsed from result (set by parseQuery) or determine from configuration
                            let modelUsed = result.modelUsed || null;
                            if (!modelUsed) {
                                // Fallback: determine from configuration if not in result
                                const useGemini = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config &&
                                    ixmaps.aiQuery.config.useGemini &&
                                    ixmaps.aiQuery.config.geminiApiKey;
                                const useMistralForAll = localStorage.getItem('useMistralForAll') === 'true';
                                const mistralApiKey = localStorage.getItem('mistralApiKey');
                                const useMistral = useMistralForAll && mistralApiKey;
                                modelUsed = useGemini ? 'gemini' : (useMistral ? 'mistral' : null);
                            }

                            let responseText = result.response || 'Query executed successfully.';

                            // For discover queries, use the response from discover() which already contains
                            // the correct format (definitions or data based on showData parameter)
                            // DO NOT override with hardcoded "Available Data Themes" - use result.response directly
                            // result.response already contains the properly formatted summary from discover()

                            const fieldInfo = result.queryInfo?.fieldInfo || result.fieldInfo;
                            addMessage(responseText, false, {
                                count: result.count,
                                query: result.query,
                                items: result.items,
                                queryInfo: {
                                    ...result.queryInfo,
                                    fieldInfo: fieldInfo
                                }
                            }, modelUsed);

                            // Check if result wants to show data table for a specific theme
                            if (result.showDataTable && result.themeId && typeof showDataTable === 'function') {
                                showDataTable(result.themeId).catch(error => {
                                    console.error('Error showing data table:', error);
                                    addMessage(`❌ Error opening data table: ${error.message}`, false);
                                });
                            }
                            
                            // Check if result wants to show theme editor for a specific theme
                            if (result.showThemeEditor && result.themeId && typeof showThemeEditor === 'function') {
                                showThemeEditor(result.themeId).catch(error => {
                                    console.error('Error showing theme editor:', error);
                                    addMessage(`❌ Error opening theme editor: ${error.message}`, false);
                                });
                            }

                            if (result.items && result.items.length > 0) {
                                ixmaps.aiQuery.visualizeResults(result.items, {
                                    highlight: true,
                                    zoomToResults: result.count <= 20
                                }, result.queryInfo);
                            }

                            setTimeout(updateResetButtonState, 200);
                        }).catch(error => {
                            removeLoadingMessage();

                            // Check if it's a comprehensive error message (from our improved error handling)
                            if (error.status === 429 || (error.message && error.message.includes('## ⚠️ Rate Limit Exceeded'))) {
                                // Display the comprehensive error message directly
                                addMessage(error.message, false);
                            } else if (error.message && (error.message.includes('rate limit') || error.message.includes('429') || error.message.includes('quota'))) {
                                // Show a helpful message for rate limit errors
                                let errorMsg = `## ⚠️ Rate Limit Exceeded\n\n`;
                                errorMsg += `**What happened?**\n`;
                                errorMsg += `You've exceeded the API rate limit. This means you've made too many requests in a short period.\n\n`;
                                errorMsg += `**What can you do?**\n`;
                                errorMsg += `- ⏰ **Wait 1-2 minutes** before trying again\n`;
                                errorMsg += `- 💡 **Use Simple Parser** - Disable Gemini in Settings (⚙️) to use the built-in parser\n`;
                                errorMsg += `- 📊 **Check your quota** - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)\n\n`;
                                addMessage(errorMsg, false);
                            } else {
                                addMessage('Sorry, I encountered an error: ' + error.message, false);
                            }
                        }).finally(() => {
                            chatInput.disabled = false;
                            sendButton.disabled = false;
                            chatInput.focus();
                        });
                    } // End if (hasAiQuery)
                } catch (error) {
                    removeLoadingMessage();

                    // Check if it's a comprehensive error message
                    if (error.status === 429 || (error.message && error.message.includes('## ⚠️ Rate Limit Exceeded'))) {
                        addMessage(error.message, false);
                    } else {
                        addMessage('Error: ' + error.message, false);
                    }
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                }
            }, 100);
        }

        // Update reset button state
        function updateResetButtonState() {
            const resetButton = document.getElementById('resetFilterButton');
            if (ixmaps && ixmaps.aiQuery) {
                const hasFilter = ixmaps.aiQuery.currentFilteredTheme !== null;
                resetButton.disabled = !hasFilter;
            } else {
                resetButton.disabled = true;
            }
        }

        // Update AI agent info text
        function updateAiAgentInfo() {
            const agentInfo = document.getElementById('aiAgentInfo');
            if (!agentInfo) return;

            const useGemini = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.useGemini;
            const hasGeminiKey = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.geminiApiKey;
            const useMistral = localStorage.getItem('useMistral') === 'true';
            const useMistralForAll = localStorage.getItem('useMistralForAll') === 'true';
            const hasMistralKey = localStorage.getItem('mistralApiKey');

            if (useMistralForAll && hasMistralKey) {
                agentInfo.textContent = 'Using Mistral (all queries)';
            } else if (useGemini && hasGeminiKey) {
                const model = ixmaps.aiQuery.config.geminiModel || 'Gemini';
                agentInfo.textContent = `Using ${model}${useMistral && hasMistralKey ? ' + Mistral' : ''}`;
            } else if (useMistral && hasMistralKey) {
                agentInfo.textContent = 'Using Mistral';
            } else {
                agentInfo.textContent = 'Using Simple Parser';
            }
        }

        // Settings management
        let settingsLoaded = false;
        let loadSettingsRetryCount = 0;
        const MAX_LOAD_SETTINGS_RETRIES = 200; // Try for up to 20 seconds (200 * 100ms)
        
        function loadSettings() {
            // If settings already loaded successfully, don't retry
            if (settingsLoaded && ixmaps && ixmaps.aiQuery && 
                ixmaps.aiQuery.config && ixmaps.aiQuery.config.geminiApiKey) {
                return;
            }
            
            if (!ixmaps || !ixmaps.aiQuery) {
                loadSettingsRetryCount++;
                if (loadSettingsRetryCount < MAX_LOAD_SETTINGS_RETRIES) {
                    setTimeout(loadSettings, 100);
                } else {
                    // Even if retries exhausted, set up a periodic check for when it becomes available
                    const checkInterval = setInterval(() => {
                        if (ixmaps && ixmaps.aiQuery) {
                            clearInterval(checkInterval);
                            loadSettingsRetryCount = 0; // Reset counter
                            loadSettings();
                        }
                    }, 1000); // Check every second
                }
                return;
            }

            // Check if DOM elements exist
            const geminiInput = document.getElementById('geminiApiKeyInput');
            const useGeminiCheck = document.getElementById('useGeminiCheck');
            const mistralInput = document.getElementById('mistralApiKeyInput');
            const useMistralCheck = document.getElementById('useMistralCheck');
            const useMistralForAllCheck = document.getElementById('useMistralForAllCheck');
            const mistralLanguageSelect = document.getElementById('mistralLanguageSelect');

            if (!geminiInput || !useGeminiCheck || !mistralInput || !useMistralCheck || !useMistralForAllCheck || !mistralLanguageSelect) {
                loadSettingsRetryCount++;
                if (loadSettingsRetryCount < MAX_LOAD_SETTINGS_RETRIES) {
                    setTimeout(loadSettings, 100);
                }
                return;
            }

            const savedKey = localStorage.getItem('geminiApiKey');
            const useGemini = localStorage.getItem('useGemini') === 'true';

            if (savedKey) {
                geminiInput.value = savedKey;
                ixmaps.aiQuery.setGeminiApiKey(savedKey);
            }

            useGeminiCheck.checked = useGemini;
            ixmaps.aiQuery.setUseGemini(useGemini);

            // Load Mistral settings
            const savedMistralKey = localStorage.getItem('mistralApiKey');
            const useMistral = localStorage.getItem('useMistral') === 'true';
            const useMistralForAll = localStorage.getItem('useMistralForAll') === 'true';

            if (savedMistralKey) {
                mistralInput.value = savedMistralKey;
            }

            useMistralCheck.checked = useMistral;
            useMistralForAllCheck.checked = useMistralForAll;

            // Load Mistral language setting
            const savedMistralLanguage = localStorage.getItem('mistralResponseLanguage') || 'auto';
            if (mistralLanguageSelect) {
                mistralLanguageSelect.value = savedMistralLanguage;
            }

            // Mark as loaded only if we successfully set the API key
            if (savedKey && ixmaps.aiQuery.config.geminiApiKey === savedKey) {
                settingsLoaded = true;
            }

            setTimeout(updateAiAgentInfo, 100);
        }
        
        // Also restore settings whenever ixmaps.aiQuery becomes available (defensive check)
        function ensureSettingsRestored() {
            if (ixmaps && ixmaps.aiQuery) {
                const savedKey = localStorage.getItem('geminiApiKey');
                const useGemini = localStorage.getItem('useGemini') === 'true';
                
                // Restore API key if it's missing or different from saved value
                if (savedKey && (!ixmaps.aiQuery.config.geminiApiKey || ixmaps.aiQuery.config.geminiApiKey !== savedKey)) {
                    ixmaps.aiQuery.setGeminiApiKey(savedKey);
                    settingsLoaded = true;
                }
                // Restore useGemini setting if it's different from saved value
                if (ixmaps.aiQuery.config.useGemini !== useGemini) {
                    ixmaps.aiQuery.setUseGemini(useGemini);
                }
            }
        }
        
        // Periodically check and restore settings (defensive mechanism)
        // This ensures settings are restored even if they get lost or reset
        setInterval(ensureSettingsRestored, 2000); // Check every 2 seconds

        function saveSettings() {
            if (!ixmaps) {

                alert('ixmaps library is not loaded yet. Please wait a moment and try again.');
                return;
            }

            if (!ixmaps.aiQuery) {
                alert('AI Query system is not loaded yet.\n\nThis usually means:\n1. The AI_AGENT_PROTOTYPE_EXAMPLE.js file failed to load\n2. There was a JavaScript error during initialization\n\nPlease check the browser console for errors and refresh the page.');
                return;
            }

            // Save Gemini settings
            const apiKey = document.getElementById('geminiApiKeyInput').value.trim();
            let useGemini = document.getElementById('useGeminiCheck').checked;

            if (apiKey) {
                localStorage.setItem('geminiApiKey', apiKey);
                ixmaps.aiQuery.setGeminiApiKey(apiKey);
                if (apiKey.length > 10) {
                    useGemini = true;
                    document.getElementById('useGeminiCheck').checked = true;
                }
            } else {
                localStorage.removeItem('geminiApiKey');
                ixmaps.aiQuery.setGeminiApiKey(null);
            }

            localStorage.setItem('useGemini', String(useGemini));
            ixmaps.aiQuery.setUseGemini(useGemini);
            
            // Mark settings as loaded after saving
            if (apiKey && apiKey.length > 10) {
                settingsLoaded = true;
            }

            // Save Mistral settings
            const mistralApiKey = document.getElementById('mistralApiKeyInput').value.trim();
            const useMistral = document.getElementById('useMistralCheck').checked;
            const useMistralForAll = document.getElementById('useMistralForAllCheck').checked;

            if (mistralApiKey) {
                localStorage.setItem('mistralApiKey', mistralApiKey);
            } else {
                localStorage.removeItem('mistralApiKey');
            }

            localStorage.setItem('useMistral', String(useMistral));
            localStorage.setItem('useMistralForAll', String(useMistralForAll));
            
            // Save Mistral language setting
            const mistralLanguageSelect = document.getElementById('mistralLanguageSelect');
            if (mistralLanguageSelect) {
                const mistralLanguage = mistralLanguageSelect.value || 'auto';
                localStorage.setItem('mistralResponseLanguage', mistralLanguage);
            }

            updateAiAgentInfo();

            document.getElementById('settingsPanel').classList.remove('active');
        }

        // Sidebar resize functionality
        function initSidebarResize() {
            const chatPane = document.getElementById('chatPane');
            const resizer = document.getElementById('resizer');
            const resizeOverlay = document.getElementById('resizeOverlay');
            const container = document.querySelector('.chat-container');
            
            if (!chatPane || !resizer || !resizeOverlay || !container) {

                return;
            }

            const CONSTANTS = {
                MIN_PANE_WIDTH: 20,
                MAX_PANE_WIDTH: 80,
                DEFAULT_PANE_WIDTH: 50
            };

            const savedWidth = localStorage.getItem('chatPanelWidth');
            if (savedWidth) {
                const widthPercent = parseFloat(savedWidth);
                if (widthPercent >= CONSTANTS.MIN_PANE_WIDTH && widthPercent <= CONSTANTS.MAX_PANE_WIDTH) {
                    chatPane.style.width = `${widthPercent}%`;
                    resizer.setAttribute('aria-valuenow', Math.round(widthPercent));
                }
            }

            let isResizing = false;

            function debounce(func, wait) {
                let timeout;
                return function executedFunction(...args) {
                    const later = () => {
                        clearTimeout(timeout);
                        func(...args);
                    };
                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait);
                };
            }

            const handleMouseMove = debounce((e) => {
                if (!isResizing) return;

                e.preventDefault();
                const containerWidth = container.offsetWidth;
                const newWidth = (e.clientX / containerWidth) * 100;

                if (newWidth >= CONSTANTS.MIN_PANE_WIDTH && newWidth <= CONSTANTS.MAX_PANE_WIDTH) {
                    chatPane.style.width = `${newWidth}%`;
                    resizer.setAttribute('aria-valuenow', Math.round(newWidth));

                    // Resize map when panes are resized
                    if (typeof ixmaps !== 'undefined' && typeof ixmaps.resizeMap === 'function') {
                        setTimeout(() => {
                            ixmaps.resizeMap(null, false);
                        }, 50);
                    }
                }
            }, 10);

            const handleMouseUp = () => {
                if (isResizing) {
                    isResizing = false;
                    resizer.classList.remove('resizing');
                    document.body.classList.remove('resizing');
                    resizeOverlay.classList.remove('active');

                    const currentWidthPercent = (chatPane.offsetWidth / container.offsetWidth) * 100;
                    localStorage.setItem('chatPanelWidth', currentWidthPercent);
                    resizer.setAttribute('aria-valuenow', Math.round(currentWidthPercent));

                    // Resize map after resize is complete
                    if (typeof ixmaps !== 'undefined' && typeof ixmaps.resizeMap === 'function') {
                        setTimeout(() => {
                            ixmaps.resizeMap(null, false);
                        }, 100);
                    }
                }
            };

            resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                resizer.classList.add('resizing');
                document.body.classList.add('resizing');
                resizeOverlay.classList.add('active');
                e.preventDefault();
            });

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            resizer.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    const containerWidth = container.offsetWidth;
                    const currentWidth = (chatPane.offsetWidth / containerWidth) * 100;
                    const step = e.shiftKey ? 10 : 1;
                    let newWidth = currentWidth + (e.key === 'ArrowRight' ? step : -step);

                    newWidth = Math.max(CONSTANTS.MIN_PANE_WIDTH,
                        Math.min(CONSTANTS.MAX_PANE_WIDTH, newWidth));

                    chatPane.style.width = `${newWidth}%`;
                    resizer.setAttribute('aria-valuenow', Math.round(newWidth));
                    localStorage.setItem('chatPanelWidth', newWidth);

                    // Resize map after keyboard resize
                    if (typeof ixmaps !== 'undefined' && typeof ixmaps.resizeMap === 'function') {
                        setTimeout(() => {
                            ixmaps.resizeMap(null, false);
                        }, 100);
                    }
                }
            });
        }

        // Facets functionality
        let currentFacetsThemeId = null; // Store current theme ID for facets refresh on zoom/pan

        // Configurator functionality
        let chatScrollPosition = 0;
        let configuratorLoaded = false;

        async function showConfigurator(themeId = null) {
            const chatMessages = document.getElementById('chatMessages');
            const configuratorContainer = document.getElementById('configuratorContainer');
            const configuratorContent = document.getElementById('configuratorContent');
            const themeEditorContainer = document.getElementById('themeEditorContainer');
            const dataTableContainer = document.getElementById('dataTableContainer');
            const facetContainer = document.getElementById('facetContainer');

            if (!chatMessages || !configuratorContainer || !configuratorContent) {

                return;
            }
            
            // If no themeId provided, get default (last edited or first theme)
            if (!themeId) {
                themeId = getDefaultThemeId();
            }
            
            // Set the theme ID if provided (for opening configurator with specific theme)
            // Use ixmaps.editor namespace - the configurator reads themeId from here
            if (themeId && window.ixmaps) {
                window.ixmaps.editor = window.ixmaps.editor || {};
                window.ixmaps.editor.themeId = themeId;
                // Store as last edited theme
                localStorage.setItem('lastEditedThemeId', themeId);
                console.log("showConfigurator: Set editor.themeId to:", themeId);
            } else {
                // Try to get active theme if no themeId provided and getDefaultThemeId returned null
                if (window.ixmaps) {
                    window.ixmaps.editor = window.ixmaps.editor || {};
                    var activeThemeObj = window.ixmaps.getThemeObj();
                    if (activeThemeObj) {
                        const activeThemeId = activeThemeObj.szId || activeThemeObj.szName;
                        window.ixmaps.editor.themeId = activeThemeId;
                        localStorage.setItem('lastEditedThemeId', activeThemeId);
                        console.log("showConfigurator: Set editor.themeId from active theme:", activeThemeId);
                    } else {
                        console.log("showConfigurator: No themeId provided and no active theme found");
                    }
                }
            }

            // Hide other tools if they're open
            if (themeEditorContainer && themeEditorContainer.classList.contains('active')) {
                themeEditorContainer.classList.remove('active');
            }
            if (dataTableContainer && dataTableContainer.classList.contains('active')) {
                dataTableContainer.classList.remove('active');
            }
            if (facetContainer && facetContainer.classList.contains('active')) {
                facetContainer.classList.remove('active');
            }

            // Store chat scroll position
            if (chatMessages) {
                chatScrollPosition = chatMessages.scrollTop;
            }

            // Hide chat messages visually but keep it in flex layout
            chatMessages.style.opacity = '0';
            chatMessages.style.pointerEvents = 'none';

            // Calculate container height to fill available space
            const chatInputArea = document.querySelector('.chat-input-area');
            const chatPanel = document.getElementById('chatPanel');
            if (chatInputArea && chatPanel) {
                const inputHeight = chatInputArea.offsetHeight;
                const panelHeight = chatPanel.offsetHeight;
                configuratorContainer.style.height = `${panelHeight - inputHeight}px`;
            }

            // Show configurator container
            configuratorContainer.classList.add('active');

            // Load configurator HTML if not already loaded
            if (!configuratorLoaded) {
                try {
                    const configuratorUrl = ixmaps && ixmaps.szResourceBase
                        ? ixmaps.szResourceBase + 'ui/html/tools/theme_configurator.html'
                        : '../../ui/html/tools/theme_configurator.html';

                    const response = await fetch(configuratorUrl);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const html = await response.text();

                    // Extract body content (jQuery .load() style - only body content)
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const bodyContent = doc.body.innerHTML;

                    // Insert body content into configurator
                    configuratorContent.innerHTML = bodyContent;

                    // Execute scripts in loaded content
                    const scripts = configuratorContent.querySelectorAll('script');
                    scripts.forEach(script => {
                        const newScript = document.createElement('script');
                        Array.from(script.attributes).forEach(attr => {
                            newScript.setAttribute(attr.name, attr.value);
                        });
                        if (script.src) {
                            newScript.src = script.src;
                        } else {
                            newScript.textContent = script.textContent;
                        }
                        script.parentNode.replaceChild(newScript, script);
                    });

                    configuratorLoaded = true;
                } catch (error) {

                    configuratorContent.innerHTML = `
                        <div style="padding: 40px; text-align: center; color: #dc3545;">
                            <div style="margin-bottom: 20px; font-size: 48px;">⚠️</div>
                            <h3>Error Loading Configurator</h3>
                            <p>${error.message}</p>
                            <button onclick="closeConfigurator()" 
                                    style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px;">
                                Close
                            </button>
                        </div>
                    `;
                }
            } else {
                // Configurator is already loaded - reload the theme if themeId was provided
                // Wait a bit for the configurator to be visible, then trigger theme loading
                if (window.ixmaps && window.ixmaps.editor && window.ixmaps.editor.themeId) {
                    setTimeout(() => {
                        const themeIdToLoad = window.ixmaps.editor.themeId;
                        console.log("showConfigurator: Reloading theme in already-loaded configurator:", themeIdToLoad);
                        
                        // Check if loadTheme function exists and call it
                        if (window.ixmaps.editor && typeof window.ixmaps.editor.loadTheme === 'function') {
                            try {
                                // Get the theme object to verify it exists
                                const themeObj = window.ixmaps.getThemeObj(themeIdToLoad);
                                if (themeObj) {
                                    // Set mapId (required by configurator, same as in theme_configurator.html)
                                    window.ixmaps.editor.mapId = themeIdToLoad;
                                    
                                    // Load the theme
                                    window.ixmaps.editor.loadTheme(themeIdToLoad);
                                    console.log("showConfigurator: Theme reloaded successfully");
                                } else {
                                    console.warn("showConfigurator: Theme not found:", themeIdToLoad);
                                }
                            } catch (error) {
                                console.error("showConfigurator: Error reloading theme:", error);
                            }
                        } else {
                            console.warn("showConfigurator: loadTheme function not available yet, retrying...");
                            // Retry after a longer delay if loadTheme is not available yet
                            setTimeout(() => {
                                if (window.ixmaps.editor && typeof window.ixmaps.editor.loadTheme === 'function') {
                                    const themeIdToLoad = window.ixmaps.editor.themeId;
                                    const themeObj = window.ixmaps.getThemeObj(themeIdToLoad);
                                    if (themeObj) {
                                        window.ixmaps.editor.mapId = themeIdToLoad;
                                        window.ixmaps.editor.loadTheme(themeIdToLoad);
                                    }
                                }
                            }, 500);
                        }
                    }, 100);
                }
            }
        }

        function closeConfigurator() {
            const chatMessages = document.getElementById('chatMessages');
            const configuratorContainer = document.getElementById('configuratorContainer');

            if (!chatMessages || !configuratorContainer) {
                return;
            }

            // Hide configurator container
            configuratorContainer.classList.remove('active');
            configuratorContainer.style.height = '';

            // Show chat messages
            chatMessages.classList.remove('hidden');
            chatMessages.style.opacity = '';
            chatMessages.style.pointerEvents = '';

            // Restore chat scroll position
            if (chatMessages && chatScrollPosition > 0) {
                setTimeout(() => {
                    chatMessages.scrollTop = chatScrollPosition;
                }, 100);
            }

            // Resize map after restoring chat
            if (typeof ixmaps !== 'undefined' && typeof ixmaps.resizeMap === 'function') {
                setTimeout(() => {
                    ixmaps.resizeMap(null, false);
                }, 200);
            }
        }

        // Theme Editor functionality
        let themeEditorLoaded = false;

        /**
         * Size a full-bleed tool overlay in the chat column to the area above the input bar.
         * offsetHeight math often returns 0 in embed iframes before layout — use geometry instead.
         * @param {function} [onResize] optional callback (e.g. ACE resize for theme editor)
         */
        function layoutChatPaneToolOverlayHeight(overlayContainer, chatPanel, chatInputArea, onResize) {
            if (!overlayContainer || !chatPanel) {
                return;
            }
            const ph = chatPanel.clientHeight || chatPanel.offsetHeight || 0;
            let h = null;
            if (chatInputArea && chatPanel.contains(chatInputArea)) {
                const pr = chatPanel.getBoundingClientRect();
                const ir = chatInputArea.getBoundingClientRect();
                const spaceAboveInput = ir.top - pr.top;
                const inputH = chatInputArea.offsetHeight || 72;
                if (spaceAboveInput > 80) {
                    h = spaceAboveInput;
                } else if (ph > inputH + 40) {
                    h = ph - inputH;
                } else {
                    h = Math.max(200, ph * 0.85);
                }
            } else {
                h = Math.max(200, ph > 0 ? ph - 80 : 400);
            }
            h = Math.max(160, Math.min(h, 20000));
            overlayContainer.style.top = '0';
            overlayContainer.style.left = '0';
            overlayContainer.style.right = '0';
            overlayContainer.style.height = `${Math.round(h)}px`;
            if (typeof onResize === 'function') {
                try {
                    onResize();
                } catch (e) {}
            }
        }

        /**
         * Size the theme editor overlay to the chat area above the input bar.
         */
        function layoutThemeEditorOverlayHeight(themeEditorContainer, chatPanel, chatInputArea) {
            layoutChatPaneToolOverlayHeight(themeEditorContainer, chatPanel, chatInputArea, window.__ixmapsThemeEditorResize);
        }

        /**
         * Always-visible toolbar (Apply + Close). The static .theme-editor-header is often covered
         * by ACE layers in the iframe; this bar is inserted first with sticky + max z-index.
         */
        function ensureThemeEditorChromeBar() {
            const container = document.getElementById('themeEditorContainer');
            if (!container || !container.classList.contains('active')) {
                return;
            }
            let bar = document.getElementById('themeEditorChromeBar');
            if (bar) {
                bar.style.display = 'flex';
                if (typeof window.__ixmapsThemeEditorResize === 'function') {
                    try {
                        window.__ixmapsThemeEditorResize();
                    } catch (e) {}
                }
                return;
            }
            bar = document.createElement('div');
            bar.id = 'themeEditorChromeBar';
            bar.setAttribute('role', 'toolbar');
            bar.setAttribute('aria-label', 'Theme editor actions');
            bar.style.cssText = [
                'box-sizing:border-box',
                'position:sticky',
                'top:0',
                'left:0',
                'right:0',
                'z-index:2147483646',
                'display:flex',
                'flex-shrink:0',
                'align-items:center',
                'justify-content:space-between',
                'gap:12px',
                'min-height:44px',
                'padding:10px 14px',
                'background:#f9fafb',
                'border-bottom:1px solid #e5e5e5',
                'font-family:system-ui,-apple-system,sans-serif'
            ].join(';');

            const title = document.createElement('span');
            title.textContent = 'Theme Editor';
            title.style.cssText = 'font-weight:600;font-size:16px;color:#374151;flex:1;min-width:0';

            const right = document.createElement('div');
            right.style.cssText = 'display:flex;gap:10px;align-items:center;flex-shrink:0';

            const applyBtn = document.createElement('button');
            applyBtn.type = 'button';
            applyBtn.textContent = 'Apply changes';
            applyBtn.style.cssText = 'padding:8px 16px;background:#10a37f;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer';
            applyBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                try {
                    if (window.ixmaps && typeof window.ixmaps.applyEditorTheme === 'function') {
                        window.ixmaps.applyEditorTheme();
                    }
                } catch (err) {
                    console.warn('applyEditorTheme:', err);
                }
            });

            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.textContent = 'Close';
            closeBtn.style.cssText = 'padding:8px 16px;background:transparent;color:#374151;border:1px solid #d1d5db;border-radius:6px;font-size:14px;cursor:pointer';
            closeBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.closeThemeEditor === 'function') {
                    window.closeThemeEditor();
                }
            });

            right.appendChild(applyBtn);
            right.appendChild(closeBtn);
            bar.appendChild(title);
            bar.appendChild(right);

            container.insertBefore(bar, container.firstChild);

            const legacyHeader = container.querySelector('.theme-editor-header');
            if (legacyHeader) {
                legacyHeader.style.display = 'none';
            }
        }

        function removeThemeEditorChromeBar() {
            const bar = document.getElementById('themeEditorChromeBar');
            if (bar && bar.parentNode) {
                bar.parentNode.removeChild(bar);
            }
            const container = document.getElementById('themeEditorContainer');
            if (container) {
                const legacyHeader = container.querySelector('.theme-editor-header');
                if (legacyHeader) {
                    legacyHeader.style.display = '';
                }
            }
        }

        /** Clone #editor-apply into .theme-editor-header (idempotent). */
        function ensureThemeEditorApplyInHeader(themeEditorContent) {
            if (!themeEditorContent) {
                return;
            }
            const header = document.querySelector('.theme-editor-header');
            if (!header) {
                return;
            }
            if (header.querySelector('.theme-editor-apply-button')) {
                return;
            }
            const applyButtonDiv = themeEditorContent.querySelector('#editor-apply');
            if (!applyButtonDiv) {
                return;
            }
            const applyButton = applyButtonDiv.querySelector('button, a');
            if (!applyButton) {
                return;
            }
            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'theme-editor-apply-button';
            buttonWrapper.style.display = 'flex';
            buttonWrapper.style.alignItems = 'center';
            const buttonClone = applyButton.cloneNode(true);
            if (buttonClone.tagName === 'A') {
                const innerButton = buttonClone.querySelector('button');
                if (innerButton) {
                    innerButton.className = 'theme-editor-apply-btn';
                    innerButton.style.padding = '6px 12px';
                    innerButton.style.background = '#10a37f';
                    innerButton.style.color = 'white';
                    innerButton.style.border = 'none';
                    innerButton.style.borderRadius = '6px';
                    innerButton.style.fontSize = '14px';
                    innerButton.style.fontWeight = '500';
                    innerButton.style.cursor = 'pointer';
                    innerButton.style.transition = 'all 0.2s';
                }
            } else if (buttonClone.tagName === 'BUTTON') {
                buttonClone.className = 'theme-editor-apply-btn';
                buttonClone.style.padding = '6px 12px';
                buttonClone.style.background = '#10a37f';
                buttonClone.style.color = 'white';
                buttonClone.style.border = 'none';
                buttonClone.style.borderRadius = '6px';
                buttonClone.style.fontSize = '14px';
                buttonClone.style.fontWeight = '500';
                buttonClone.style.cursor = 'pointer';
                buttonClone.style.transition = 'all 0.2s';
            }
            buttonWrapper.appendChild(buttonClone);
            const closeButton = header.querySelector('#themeEditorClose');
            if (closeButton) {
                header.insertBefore(buttonWrapper, closeButton);
            } else {
                header.appendChild(buttonWrapper);
            }
            applyButtonDiv.style.display = 'none';
        }

        // Helper function to get default theme ID (last edited or first theme)
        function getDefaultThemeId() {
            // First, try to get last edited theme from localStorage
            const lastEditedThemeId = localStorage.getItem('lastEditedThemeId');
            if (lastEditedThemeId && window.ixmaps && window.ixmaps.getThemeObj) {
                const themeObj = window.ixmaps.getThemeObj(lastEditedThemeId);
                if (themeObj) {
                    return lastEditedThemeId;
                }
            }
            
            // If no last edited theme or it doesn't exist, get first theme from list
            if (window.ixmaps && typeof window.ixmaps.getThemes === 'function') {
                const themes = window.ixmaps.getThemes();
                if (themes && themes.length > 0) {
                    const firstTheme = themes[0];
                    return firstTheme.szId || firstTheme.szName || firstTheme.id || null;
                }
            }
            
            return null;
        }

        async function showThemeEditor(themeId = null) {
            const chatMessages = document.getElementById('chatMessages');
            const themeEditorContainer = document.getElementById('themeEditorContainer');
            const themeEditorContent = document.getElementById('themeEditorContent');
            const configuratorContainer = document.getElementById('configuratorContainer');
            const dataTableContainer = document.getElementById('dataTableContainer');
            const facetContainer = document.getElementById('facetContainer');
            const chatInputArea = document.querySelector('.chat-input-area');

            if (!chatMessages || !themeEditorContainer || !themeEditorContent) {

                return;
            }
            
            // If no themeId provided, get default (last edited or first theme)
            if (!themeId) {
                themeId = getDefaultThemeId();
            }
            
            // Set the theme ID if provided (for opening editor with specific theme)
            // Use ixmaps.editor namespace - the editor reads themeId from here
            if (themeId && window.ixmaps) {
                window.ixmaps.editor = window.ixmaps.editor || {};
                window.ixmaps.editor.themeId = themeId;
                // Store as last edited theme
                localStorage.setItem('lastEditedThemeId', themeId);
            }

            // Hide other tools if they're open
            if (configuratorContainer && configuratorContainer.classList.contains('active')) {
                configuratorContainer.classList.remove('active');
            }
            if (dataTableContainer && dataTableContainer.classList.contains('active')) {
                dataTableContainer.classList.remove('active');
            }
            if (facetContainer && facetContainer.classList.contains('active')) {
                facetContainer.classList.remove('active');
            }

            // Store chat scroll position
            if (chatMessages) {
                chatScrollPosition = chatMessages.scrollTop;
            }

            // Hide chat messages visually but keep it in flex layout
            chatMessages.style.opacity = '0';
            chatMessages.style.pointerEvents = 'none';
            chatMessages.style.visibility = 'hidden';

            const chatPanel = document.getElementById('chatPanel');
            const applyOverlayHeight = () => {
                layoutThemeEditorOverlayHeight(themeEditorContainer, chatPanel, chatInputArea);
            };
            applyOverlayHeight();

            // Show theme editor container
            themeEditorContainer.classList.add('active');
            ensureThemeEditorChromeBar();
            themeEditorContainer.scrollTop = 0;
            const teHeaderEl = themeEditorContainer.querySelector('.theme-editor-header');
            if (teHeaderEl) {
                try {
                    teHeaderEl.scrollIntoView({ block: 'start', inline: 'nearest' });
                } catch (e) {}
            }
            try {
                window.dispatchEvent(new Event('resize'));
            } catch (e) {}

            requestAnimationFrame(() => {
                applyOverlayHeight();
                ensureThemeEditorChromeBar();
                requestAnimationFrame(function () {
                    applyOverlayHeight();
                    ensureThemeEditorChromeBar();
                });
            });
            setTimeout(applyOverlayHeight, 50);
            setTimeout(applyOverlayHeight, 250);
            setTimeout(ensureThemeEditorChromeBar, 0);

            // Load theme editor HTML if not already loaded
            if (!themeEditorLoaded) {
                try {
                    const editorUrl = ixmaps && ixmaps.szResourceBase
                        ? ixmaps.szResourceBase + 'ui/html/tools/theme_editor.html'
                        : '../../ui/html/tools/theme_editor.html';

                    const response = await fetch(editorUrl);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const html = await response.text();

                    // Extract body content (jQuery .load() style - only body content)
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const bodyContent = doc.body.innerHTML;

                    // Insert body content into theme editor
                    themeEditorContent.innerHTML = bodyContent;

                    // Execute scripts in loaded content
                    const scripts = themeEditorContent.querySelectorAll('script');
                    scripts.forEach(script => {
                        const newScript = document.createElement('script');
                        Array.from(script.attributes).forEach(attr => {
                            newScript.setAttribute(attr.name, attr.value);
                        });
                        if (script.src) {
                            newScript.src = script.src;
                        } else {
                            newScript.textContent = script.textContent;
                        }
                        script.parentNode.replaceChild(newScript, script);
                    });

                    // After injected scripts run, move apply into header (deferred so DOM is stable)
                    setTimeout(() => {
                        ensureThemeEditorApplyInHeader(themeEditorContent);
                        applyOverlayHeight();
                    }, 0);

                    themeEditorLoaded = true;
                    // theme_editor.html loadEditor() already fills the ACE editor with
                    // newStyleThemeJson(getThemeDefinitionObj(...)) — do not setValue here or
                    // the flat internal theme shape overwrites the structured JSON.
                } catch (error) {

                    themeEditorContent.innerHTML = `
                        <div style="padding: 40px; text-align: center; color: #dc3545;">
                            <div style="margin-bottom: 20px; font-size: 48px;">⚠️</div>
                            <h3>Error Loading Theme Editor</h3>
                            <p>${error.message}</p>
                            <button onclick="closeThemeEditor()" 
                                    style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px;">
                                Close
                            </button>
                        </div>
                    `;
                }
            } else {
                // Editor already in DOM (scripts did not re-run); refresh content for themeId
                if (themeId && window.ixmaps && window.ixmaps.editor && window.ixmaps.getThemeObj) {
                    setTimeout(() => {
                        const themeObj = window.ixmaps.getThemeObj(themeId);
                        if (themeObj && window.ixmaps.editor.setValue) {
                            try {
                                let themeDef = window.ixmaps.getThemeDefinitionObj ? window.ixmaps.getThemeDefinitionObj(themeId) : null;
                                if (themeDef && typeof window.ixmaps.newStyleThemeJson === 'function') {
                                    themeDef = window.ixmaps.newStyleThemeJson(themeDef);
                                }
                                if (themeDef && window.Config) {
                                    window.ixmaps.editor.setValue(new window.Config(themeDef).getPrettyString());
                                    if (window.ixmaps.editor.gotoLine) {
                                        window.ixmaps.editor.gotoLine(1);
                                    }
                                }
                            } catch (e) {
                                console.warn('Could not load theme in editor:', e);
                            }
                        }
                    }, 100);
                }
            }

            // First open or revisit: ensure apply clone exists in header (covers late script init)
            setTimeout(() => {
                ensureThemeEditorApplyInHeader(themeEditorContent);
            }, 0);
            setTimeout(() => {
                applyOverlayHeight();
                ensureThemeEditorChromeBar();
                ensureThemeEditorApplyInHeader(themeEditorContent);
                const hdr = document.querySelector('.theme-editor-header');
                const hasApplyInHeader = hdr && hdr.querySelector('.theme-editor-apply-button');
                const origApply = themeEditorContent && themeEditorContent.querySelector('#editor-apply');
                if (origApply && !hasApplyInHeader) {
                    origApply.style.display = '';
                }
            }, 150);
        }

        function closeThemeEditor() {
            const chatMessages = document.getElementById('chatMessages');
            const themeEditorContainer = document.getElementById('themeEditorContainer');

            if (!chatMessages || !themeEditorContainer) {
                return;
            }

            removeThemeEditorChromeBar();

            try {
                delete window.__ixmapsThemeEditorResize;
            } catch (e) {
                window.__ixmapsThemeEditorResize = undefined;
            }

            // Hide theme editor container
            themeEditorContainer.classList.remove('active');
            themeEditorContainer.style.height = '';
            themeEditorContainer.style.top = '';
            themeEditorContainer.style.left = '';
            themeEditorContainer.style.right = '';

            // Show chat messages
            chatMessages.classList.remove('hidden');
            chatMessages.style.opacity = '';
            chatMessages.style.pointerEvents = '';
            chatMessages.style.visibility = '';

            // Restore chat scroll position
            if (chatMessages && chatScrollPosition > 0) {
                setTimeout(() => {
                    chatMessages.scrollTop = chatScrollPosition;
                }, 100);
            }

            // Resize map after restoring chat
            if (typeof ixmaps !== 'undefined' && typeof ixmaps.resizeMap === 'function') {
                setTimeout(() => {
                    ixmaps.resizeMap(null, false);
                }, 200);
            }
        }

        // Data Table functionality
        let dataTableLoaded = false;

        async function showDataTable(themeId = null) {
            const dataTableContainer = document.getElementById('dataTableContainer');
            const dataTableContent = document.getElementById('dataTableContent');
            const themeEditorContainer = document.getElementById('themeEditorContainer');
            const configuratorContainer = document.getElementById('configuratorContainer');
            const facetContainer = document.getElementById('facetContainer');

            if (!dataTableContainer || !dataTableContent) {
                console.warn('⚠️ Data table container or content not found');
                return;
            }

            // Hide other tools if they're open
            if (themeEditorContainer && themeEditorContainer.classList.contains('active')) {
                themeEditorContainer.classList.remove('active');
            }
            if (configuratorContainer && configuratorContainer.classList.contains('active')) {
                configuratorContainer.classList.remove('active');
            }
            if (facetContainer && facetContainer.classList.contains('active')) {
                facetContainer.classList.remove('active');
            }

            // Check if there are themes on the map to decide where to show the table
            let hasThemesOnMap = false;
            try {
                const map = ixmaps.embeddedSVG && ixmaps.embeddedSVG.window && ixmaps.embeddedSVG.window.map;
                if (map && map.Api) {
                    let themes = [];
                    if (map.Themes && map.Themes.getThemes) {
                        themes = map.Themes.getThemes();
                    } else if (map.Api.getAllThemes) {
                        themes = map.Api.getAllThemes();
                    }
                    // Check if there are any visible themes (excluding the one we might be showing data for)
                    hasThemesOnMap = themes.some(theme => {
                        const isVisible = theme.visible !== false;
                        const themeDef = map.Api.getMapThemeDefinitionObj ? map.Api.getMapThemeDefinitionObj(theme.id || theme.szName || theme.name) : null;
                        const defVisible = themeDef?.style?.visible !== false;
                        return isVisible && defVisible;
                    });
                }
            } catch (e) {
                console.warn('Could not check themes on map:', e);
            }

            // Determine where to show the table: chat pane if themes exist, map pane if no themes
            const chatPanel = document.getElementById('chatPanel');
            const mapContainer = document.querySelector('.map-container');
            const currentParent = dataTableContainer.parentElement;

            const chatInputArea = document.querySelector('.chat-input-area');

            if (hasThemesOnMap) {
                // Show in chat pane
                if (currentParent !== chatPanel && chatPanel) {
                    chatPanel.appendChild(dataTableContainer);
                    console.log('📊 Moving data table to chat pane (themes exist on map)');
                }
            } else {
                // Show in map pane
                if (currentParent !== mapContainer && mapContainer) {
                    mapContainer.appendChild(dataTableContainer);
                    console.log('📊 Moving data table to map pane (no themes on map)');
                }
            }

            // Show data table container
            dataTableContainer.classList.add('active');

            // Size overlay (same strategy as theme editor: geometry above input bar; map pane uses rect)
            const applyDataTableLayout = () => {
                if (hasThemesOnMap && chatPanel) {
                    layoutChatPaneToolOverlayHeight(dataTableContainer, chatPanel, chatInputArea, null);
                } else if (mapContainer) {
                    const mr = mapContainer.getBoundingClientRect();
                    const mh = Math.max(
                        200,
                        Math.round(mr.height || mapContainer.clientHeight || mapContainer.offsetHeight || 0)
                    );
                    if (mh > 0) {
                        dataTableContainer.style.top = '0';
                        dataTableContainer.style.left = '0';
                        dataTableContainer.style.right = '0';
                        dataTableContainer.style.height = `${mh}px`;
                    }
                }
            };
            applyDataTableLayout();
            requestAnimationFrame(() => {
                applyDataTableLayout();
                requestAnimationFrame(applyDataTableLayout);
            });
            
            // Update header with theme ID if available
            const dataTableHeader = dataTableContainer.querySelector('.data-table-header h2');
            if (dataTableHeader) {
                if (themeId) {
                    dataTableHeader.textContent = `Data Table - Theme: ${themeId}`;
                } else {
                    dataTableHeader.textContent = 'Data Table';
                }
            }

            // Prepare theme data BEFORE loading HTML
            // This ensures usePreparedTable flag is set before $(document).ready() runs
            if (themeId && typeof ixmaps !== 'undefined') {
                try {
                    const map = ixmaps.embeddedSVG && ixmaps.embeddedSVG.window ? ixmaps.embeddedSVG.window.map : null;
                    if (map && map.Api && map.Api.getTheme) {
                        const themeObj = map.Api.getTheme(themeId);
                        if (themeObj && themeObj.objTheme) {
                            // Store theme data for table_new.html to use
                            if (!window.ixmaps) {
                                window.ixmaps = {};
                            }
                            if (!window.ixmaps.tmp) {
                                window.ixmaps.tmp = {};
                            }

                            const tableObj = new Data.Table(null);
                            tableObj.table = themeObj.objTheme.dbTable;
                            tableObj.fields = themeObj.objTheme.dbFields;
                            tableObj.records = themeObj.objTheme.dbRecords;

                            window.ixmaps.tmp.tableObj = tableObj;
                            window.ixmaps.tmp.themeId = themeId;
                            window.ixmaps.tmp.usePreparedTable = true;
                            
                            console.log('📊 Prepared table data for theme:', themeId);

                        } else {
                            console.warn('⚠️ Theme object or objTheme not found for themeId:', themeId);
                            // Don't proceed if we can't get the theme data
                            addMessage(`❌ Could not find theme data for "${themeId}"`, false);
                            return;
                        }
                    } else {
                        console.warn('⚠️ Map or map.Api.getTheme not available');
                        // Don't proceed if we can't access the map
                        addMessage(`❌ Could not access map to get theme data`, false);
                        return;
                    }
                } catch (error) {
                    console.error('❌ Error preparing theme data:', error);
                    // Don't proceed if there's an error
                    addMessage(`❌ Error loading theme data: ${error.message}`, false);
                    return;
                }
            } else if (!themeId) {
                // If no themeId provided, try to use currentDataTable if available
                if (currentDataTable && typeof Data !== 'undefined' && Data.Table) {
                    try {
                        if (!window.ixmaps) {
                            window.ixmaps = {};
                        }
                        if (!window.ixmaps.tmp) {
                            window.ixmaps.tmp = {};
                        }
                        
                        // Create a Data.Table object from currentDataTable
                        const tableObj = new Data.Table(null);
                        tableObj.table = currentDataTable.table || { fields: currentDataTable.fields?.length || 0, records: currentDataTable.records?.length || 0 };
                        tableObj.fields = currentDataTable.fields || [];
                        tableObj.records = currentDataTable.records || [];
                        
                        window.ixmaps.tmp.tableObj = tableObj;
                        window.ixmaps.tmp.usePreparedTable = true;
                        console.log('📊 Prepared data table from currentDataTable for showDataTable');
                    } catch (error) {
                        console.warn('Could not prepare data table from currentDataTable:', error);
                        if (window.ixmaps && window.ixmaps.tmp) {
                            window.ixmaps.tmp.usePreparedTable = false;
                        }
                    }
                } else {
                    // Clear usePreparedTable flag so it uses default behavior
                    if (window.ixmaps && window.ixmaps.tmp) {
                        window.ixmaps.tmp.usePreparedTable = false;
                    }
                }
            }

            // Load data table HTML if not already loaded
            if (!dataTableLoaded) {
                // Set flag early to prevent $(document).ready() from auto-initializing
                window.__skipTableAutoInit = true;
                
                try {
                    const tableUrl = ixmaps && ixmaps.szResourceBase
                        ? ixmaps.szResourceBase + 'ui/html/tools/table_new.html'
                        : '../../ui/html/tools/table_new.html';

                    const response = await fetch(tableUrl);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const html = await response.text();

                    // Extract body content and head scripts
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const bodyContent = doc.body.innerHTML;
                    const headScripts = doc.head.querySelectorAll('script');

                    // Execute head scripts FIRST (they set up ixmaps.__showTable)
                    // These must run before body content is inserted
                    for (const script of headScripts) {
                        const newScript = document.createElement('script');
                        Array.from(script.attributes).forEach(attr => {
                            newScript.setAttribute(attr.name, attr.value);
                        });
                        if (script.src) {
                            // For external scripts, we need to wait
                            await new Promise((resolve, reject) => {
                                newScript.onload = resolve;
                                newScript.onerror = reject;
                                newScript.src = script.src;
                                document.head.appendChild(newScript);
                            });
                        } else {
                            // Inline scripts execute immediately
                            newScript.textContent = script.textContent;
                            document.head.appendChild(newScript);
                        }
                    }

                    // Now insert body content (after head scripts have run)
                    dataTableContent.innerHTML = bodyContent;

                    // Execute body scripts and manually trigger initialization
                    // Since $(document).ready() won't fire for dynamically loaded content
                    setTimeout(() => {
                        const scripts = dataTableContent.querySelectorAll('script');
                        const scriptPromises = [];

                        scripts.forEach(script => {
                            const newScript = document.createElement('script');
                            Array.from(script.attributes).forEach(attr => {
                                newScript.setAttribute(attr.name, attr.value);
                            });

                            if (script.src) {
                                // For external scripts, create a promise
                                const scriptPromise = new Promise((resolve, reject) => {
                                    newScript.onload = () => {

                                        resolve();
                                    };
                                    newScript.onerror = () => {

                                        reject(new Error(`Failed to load: ${script.src}`));
                                    };
                                });
                                scriptPromises.push(scriptPromise);
                                document.head.appendChild(newScript);
                            } else {
                                // For inline scripts, execute immediately
                                newScript.textContent = script.textContent;
                                document.head.appendChild(newScript);
                            }
                            script.remove();
                        });

                        // Wait for all external scripts to load, then manually trigger initialization
                        Promise.all(scriptPromises).then(() => {
                            // Manually trigger table initialization since $(document).ready() won't fire
                            setTimeout(() => {
                                if (typeof window.ixmaps === 'undefined' || !window.ixmaps) {

                                    return;
                                }



                                // Check if we have prepared table data
                                if (window.ixmaps.tmp && window.ixmaps.tmp.tableObj && window.ixmaps.tmp.usePreparedTable) {

                                    const tableObj = window.ixmaps.tmp.tableObj;
                                    const numRows = tableObj.records ? tableObj.records.length : (tableObj.table ? tableObj.table.records : 0);

                                    // Update the data name element
                                    const ftDataName = document.getElementById('ft-data-name');
                                    if (ftDataName) {
                                        ftDataName.innerHTML = String(numRows) + " records <span style='font-size:smaller'>(please give me some time ...)</span>";
                                    }

                                    // Load required resources and show table
                                    if (typeof window.ixmaps.loadResources === 'function') {
                                        // Relative to ixmaps.szResourceBase (same as table_new.html); do not duplicate path segments.
                                        const _fileUrls = [
                                            { url: 'ui/js/tools/dataprocess.js', type: 'js' },
                                            { url: 'ui/js/tools/datafacets.js', type: 'js' }
                                        ];

                                        window.ixmaps.loadResources(_fileUrls, null, () => {
                                            if (typeof window.ixmaps.__showTable === 'function') {
                                                window.ixmaps.__showTable();
                                            }
                                        });
                                    } else {

                                        // Try calling directly if resources might already be loaded
                                        setTimeout(() => {
                                            if (typeof window.ixmaps.__showTable === 'function') {
                                                window.ixmaps.__showTable();
                                            } else {

                                            }
                                        }, 1000);
                                    }
                                } else {
                                    // Use default behavior - get last theme

                                    if (typeof window.ixmaps.getThemes === 'function') {
                                        const themes = window.ixmaps.getThemes();
                                        if (themes && themes.length > 0) {
                                            const themeObj = themes[themes.length - 1];
                                            if (themeObj && themeObj.objTheme) {
                                                const tableObj = new Data.Table(null);
                                                tableObj.table = themeObj.objTheme.dbTable;
                                                tableObj.fields = themeObj.objTheme.dbFields;
                                                tableObj.records = themeObj.objTheme.dbRecords;

                                                if (!window.ixmaps.tmp) {
                                                    window.ixmaps.tmp = {};
                                                }
                                                window.ixmaps.tmp.tableObj = tableObj;

                                                if (typeof window.ixmaps.loadResources === 'function') {
                                                    const _fileUrls = [
                                                        { url: 'ui/js/tools/dataprocess.js', type: 'js' },
                                                        { url: 'ui/js/tools/datafacets.js', type: 'js' }
                                                    ];

                                                    window.ixmaps.loadResources(_fileUrls, null, () => {
                                                        if (typeof window.ixmaps.__showTable === 'function') {
                                                            window.ixmaps.__showTable();
                                                        }
                                                    });
                                                }
                                            } else {

                                            }
                                        } else {

                                        }
                                    } else {

                                    }
                                }
                            }, 500);
                        }).catch(error => {

                        });
                    }, 200);

                    dataTableLoaded = true;
                } catch (error) {

                    dataTableContent.innerHTML = `
                        <div style="padding: 40px; text-align: center; color: #dc3545;">
                            <div style="margin-bottom: 20px; font-size: 48px;">⚠️</div>
                            <h3>Error Loading Data Table</h3>
                            <p>${error.message}</p>
                            <button onclick="closeDataTable()" 
                                    style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px;">
                                Close
                            </button>
                        </div>
                    `;
                }
            } else {
                // If already loaded, update header with theme ID if available
                const dataTableHeader = dataTableContainer.querySelector('.data-table-header h2');
                if (dataTableHeader) {
                    if (themeId) {
                        dataTableHeader.textContent = `Data Table - Theme: ${themeId}`;
                    } else if (window.ixmaps && window.ixmaps.tmp && window.ixmaps.tmp.themeId) {
                        dataTableHeader.textContent = `Data Table - Theme: ${window.ixmaps.tmp.themeId}`;
                    } else {
                        dataTableHeader.textContent = 'Data Table';
                    }
                }
                
                // If already loaded, we need to reinitialize with new theme data
                // Clear and reload to trigger initialization
                if (themeId && window.ixmaps && window.ixmaps.tmp && window.ixmaps.tmp.usePreparedTable) {
                    // Force reinitialization by clearing content and reloading
                    dataTableContent.innerHTML = '';
                    dataTableLoaded = false;
                    // Reload
                    await showDataTable(themeId);
                    return;
                }
            }
        }

        function closeDataTable() {
            const dataTableContainer = document.getElementById('dataTableContainer');

            if (!dataTableContainer) {
                return;
            }

            // Hide data table container
            dataTableContainer.classList.remove('active');
            dataTableContainer.style.height = '';

            // Resize map after restoring chat
            if (typeof ixmaps !== 'undefined' && typeof ixmaps.resizeMap === 'function') {
                setTimeout(() => {
                    ixmaps.resizeMap(null, false);
                }, 200);
            }
        }
        
        // Helper function to close data table if a theme with geometry is visible on map
        function checkAndCloseDataTableIfThemeVisible() {
            try {
                const dataTableContainer = document.getElementById('dataTableContainer');
                if (!dataTableContainer || !dataTableContainer.classList.contains('active')) {
                    return; // Table not open, nothing to do
                }
                
                const map = ixmaps.embeddedSVG && ixmaps.embeddedSVG.window && ixmaps.embeddedSVG.window.map;
                if (!map || !map.Api) {
                    return; // Map not available
                }
                
                // Get all themes
                let themes = [];
                if (map.Themes && map.Themes.getThemes) {
                    themes = map.Themes.getThemes();
                } else if (map.Api.getAllThemes) {
                    themes = map.Api.getAllThemes();
                }
                
                // Check if there are any FEATURE themes (themes with geometry that are visible on map)
                const hasVisibleFeatureTheme = themes.some(theme => {
                    const themeType = theme.type || theme.szFlag || '';
                    const themeDef = map.Api.getMapThemeDefinitionObj ? map.Api.getMapThemeDefinitionObj(theme.id || theme.szName || theme.name) : null;
                    const hasGeometry = themeType.includes('FEATURE') || 
                                       themeType.includes('SHAPE') ||
                                       (themeDef && (themeDef.binding?.geo || themeDef.data?.type === 'geojson'));
                    const isVisible = theme.visible !== false && themeDef?.style?.visible !== false;
                    return hasGeometry && isVisible;
                });
                
                if (hasVisibleFeatureTheme) {
                    console.log('📊 Theme with geometry is visible on map - closing data table overlay');
                    closeDataTable();
                }
            } catch (e) {
                console.warn('Could not check and close data table:', e);
            }
        }

        async function showFacets(themeId = null) {
            const chatMessages = document.getElementById('chatMessages');
            const facetContainer = document.getElementById('facetContainer');
            const facetContent = document.getElementById('facetContent');
            const dataTableContainer = document.getElementById('dataTableContainer');
            const themeEditorContainer = document.getElementById('themeEditorContainer');
            const configuratorContainer = document.getElementById('configuratorContainer');
            const chatInputArea = document.querySelector('.chat-input-area');

            if (!chatMessages || !facetContainer || !facetContent) {
                return;
            }

            // Hide other tools if they're open
            if (dataTableContainer && dataTableContainer.classList.contains('active')) {
                dataTableContainer.classList.remove('active');
            }
            if (themeEditorContainer && themeEditorContainer.classList.contains('active')) {
                themeEditorContainer.classList.remove('active');
            }
            if (configuratorContainer && configuratorContainer.classList.contains('active')) {
                configuratorContainer.classList.remove('active');
            }

            // Store chat scroll position
            if (chatMessages) {
                chatScrollPosition = chatMessages.scrollTop;
            }

            // Hide chat messages visually but keep it in flex layout
            chatMessages.style.opacity = '0';
            chatMessages.style.pointerEvents = 'none';

            // Calculate container height to fill available space
            const chatPanel = document.getElementById('chatPanel');
            if (chatInputArea && chatPanel) {
                const inputHeight = chatInputArea.offsetHeight;
                const panelHeight = chatPanel.offsetHeight;
                facetContainer.style.height = `${panelHeight - inputHeight}px`;
            }

            // Show facet container
            facetContainer.classList.add('active');

            // Show loading state
            facetContent.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #666;">
                    <div style="margin-bottom: 20px;">
                        <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                    </div>
                    <div>Loading facets...</div>
                </div>
            `;

            try {
                // Determine themeId - use same logic as showDataTable
                // 1. Check window.ixmaps.tmp.themeId first (set by table view)
                // 2. Check currentDataTable (like showDataTable does)
                // 3. Fall back to getThemes()
                if (!themeId) {
                    // First, check if table view set a themeId
                    if (window.ixmaps && window.ixmaps.tmp && window.ixmaps.tmp.themeId) {
                        themeId = window.ixmaps.tmp.themeId;
                    }
                    // If still no themeId, check currentDataTable (like showDataTable does)
                    if (!themeId && currentDataTable && typeof Data !== 'undefined' && Data.Table) {
                        // currentDataTable exists but we need a themeId, so we'll use getThemes fallback
                        // But we can prepare the tableObj from currentDataTable
                    }
                    // If still no themeId, get from getThemes (same as showDataTable)
                    if (!themeId && typeof ixmaps !== 'undefined' && typeof ixmaps.getThemes === 'function') {
                        const themes = ixmaps.getThemes();
                        if (themes && themes.length > 0) {
                            const lastTheme = themes[themes.length - 1];
                            if (lastTheme && lastTheme.szId) {
                                themeId = lastTheme.szId;
                            }
                        }
                    }
                }

                // Prepare theme data BEFORE calling getFacets - EXACTLY like showDataTable does
                // This ensures the data structure is set up correctly
                if (themeId && typeof ixmaps !== 'undefined') {
                    try {
                        const map = ixmaps.embeddedSVG && ixmaps.embeddedSVG.window ? ixmaps.embeddedSVG.window.map : null;
                        if (map && map.Api && map.Api.getTheme) {
                            const themeObj = map.Api.getTheme(themeId);
                            if (themeObj && themeObj.objTheme) {
                                // Store theme data - EXACTLY like showDataTable does
                                // Always create a fresh Data.Table object to ensure correct state
                                if (!window.ixmaps) {
                                    window.ixmaps = {};
                                }
                                if (!window.ixmaps.tmp) {
                                    window.ixmaps.tmp = {};
                                }

                                const tableObj = new Data.Table(null);
                                tableObj.table = themeObj.objTheme.dbTable;
                                tableObj.fields = themeObj.objTheme.dbFields;
                                tableObj.records = themeObj.objTheme.dbRecords;

                                window.ixmaps.tmp.tableObj = tableObj;
                                window.ixmaps.tmp.themeId = themeId;
                                window.ixmaps.tmp.usePreparedTable = true;
                            }
                        }
                    } catch (error) {
                        // Continue even if preparation fails
                        console.warn('Could not prepare theme data for facets:', error);
                    }
                } else if (!themeId && currentDataTable && typeof Data !== 'undefined' && Data.Table) {
                    // If no themeId but currentDataTable exists, prepare from currentDataTable (like showDataTable)
                    try {
                        if (!window.ixmaps) {
                            window.ixmaps = {};
                        }
                        if (!window.ixmaps.tmp) {
                            window.ixmaps.tmp = {};
                        }
                        
                        // Create a Data.Table object from currentDataTable
                        const tableObj = new Data.Table(null);
                        tableObj.table = currentDataTable.table || { fields: currentDataTable.fields?.length || 0, records: currentDataTable.records?.length || 0 };
                        tableObj.fields = currentDataTable.fields || [];
                        tableObj.records = currentDataTable.records || [];
                        
                        window.ixmaps.tmp.tableObj = tableObj;
                        window.ixmaps.tmp.usePreparedTable = true;
                        console.log('📊 Prepared data table from currentDataTable for showFacets');
                    } catch (error) {
                        console.warn('Could not prepare data table from currentDataTable:', error);
                        if (window.ixmaps && window.ixmaps.tmp) {
                            window.ixmaps.tmp.usePreparedTable = false;
                        }
                    }
                } else {
                    // Clear usePreparedTable flag so it uses default behavior
                    if (window.ixmaps && window.ixmaps.tmp) {
                        window.ixmaps.tmp.usePreparedTable = false;
                    }
                }

                if (!themeId) {
                    throw new Error('No theme available. Please load data first.');
                }

                // Store themeId for refresh on zoom/pan
                currentFacetsThemeId = themeId;

                // Get theme object to access fields - use same approach as showDataTable
                const map = ixmaps.embeddedSVG && ixmaps.embeddedSVG.window ? ixmaps.embeddedSVG.window.map : null;
                if (!map || !map.Api || !map.Api.getTheme) {
                    throw new Error('Map API not available.');
                }

                const themeObj = map.Api.getTheme(themeId);
                if (!themeObj || !themeObj.objTheme) {
                    throw new Error('Theme not found.');
                }

                // Get field names
                const fields = themeObj.objTheme.dbFields || [];
                if (fields.length === 0) {
                    throw new Error('No fields found in theme.');
                }

                const fieldNames = fields.map(f => typeof f === 'string' ? f : (f.name || f.field || f.id || String(f)));

                // Check if ixmaps.data.getFacets exists
                if (!window.ixmaps || !window.ixmaps.data || typeof window.ixmaps.data.getFacets !== 'function') {
                    throw new Error('Facets API not available. Please ensure data.js is loaded.');
                }

                // Get facets data using facet.js signature:
                // getFacets(szFilter, szDiv, szFieldsA, szId, szMap, fFlag)
                // The function gets the data from the theme itself using ixmaps.getThemeObj(themeId)
                const facets = window.ixmaps.data.getFacets('', '', fieldNames, themeId, 'map', true);

                if (!facets || facets.length === 0) {
                    throw new Error('No facets data available.');
                }

                // Render facet table
                let tableHTML = `
                    <table class="facet-table">
                        <thead>
                            <tr>
                                <th>Field Name</th>
                                <th>Statistics</th>
                                <th>Unique Values</th>
                                <th>Distribution</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                facets.forEach(facet => {
                    const fieldName = facet.id || 'Unknown';
                    const fieldType = facet.type || (facet.min !== undefined ? 'numeric' : 'textual');
                    
                    let statsHTML = '';
                    let uniqueValuesHTML = '';
                    let distributionHTML = '';

                    if (fieldType === 'numeric' || facet.min !== undefined) {
                        // Numeric field
                        const count = facet.nCount || (facet.values ? facet.values.length : 0) || (facet.data ? facet.data.length : 0) || 0;
                        const mean = facet.sum !== undefined && count > 0 ? (facet.sum / count) : null;
                        
                        // Check if min/max are valid (not MAX_VALUE/MIN_VALUE)
                        const isValidMin = facet.min !== undefined && facet.min !== null && 
                                          facet.min !== Number.MAX_VALUE && facet.min !== -Number.MAX_VALUE &&
                                          !isNaN(facet.min);
                        const isValidMax = facet.max !== undefined && facet.max !== null && 
                                          facet.max !== Number.MAX_VALUE && facet.max !== -Number.MAX_VALUE &&
                                          !isNaN(facet.max);
                        
                        statsHTML = `
                            <div class="facet-stats">
                                <div class="stat-item"><span class="stat-label">Min:</span> ${isValidMin ? formatNumber(facet.min) : 'N/A'}</div>
                                <div class="stat-item"><span class="stat-label">Max:</span> ${isValidMax ? formatNumber(facet.max) : 'N/A'}</div>
                                ${mean !== null ? `<div class="stat-item"><span class="stat-label">Mean:</span> ${formatNumber(mean)}</div>` : ''}
                                <div class="stat-item"><span class="stat-label">Count:</span> ${formatNumber(count)}</div>
                            </div>
                        `;
                        
                        uniqueValuesHTML = count > 0 ? count : 'N/A';
                        // Create histogram for numeric distribution
                        distributionHTML = createNumericHistogram(facet, 200, 80);
                    } else {
                        // Textual/categorical field
                        const uniqueCount = facet.uniqueValues || 
                                          (facet.valuesCount ? Object.keys(facet.valuesCount).length : 0) ||
                                          (facet.values ? new Set(facet.values).size : 0) ||
                                          0;
                        
                        const totalCount = facet.nCount || 
                                         (facet.values ? facet.values.length : 0) ||
                                         (facet.data ? facet.data.length : 0) ||
                                         (facet.valuesCount ? Object.values(facet.valuesCount).reduce((sum, val) => sum + (Number(val) || 0), 0) : 0) ||
                                         0;

                        statsHTML = `
                            <div class="facet-stats">
                                <div class="stat-item"><span class="stat-label">Total:</span> ${formatNumber(totalCount)}</div>
                            </div>
                        `;
                        
                        uniqueValuesHTML = formatNumber(uniqueCount);
                        
                        // Show top values with counts
                        if (facet.valuesCount && typeof facet.valuesCount === 'object') {
                            const sortedValues = Object.entries(facet.valuesCount)
                                .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
                                .slice(0, 10); // Top 10
                            
                            if (sortedValues.length > 0) {
                                distributionHTML = `
                                    <div class="facet-values">
                                        ${sortedValues.map(([value, count]) => `
                                            <div class="facet-value-item">
                                                <span class="facet-value-name">${escapeHtml(String(value))}</span>
                                                <span class="facet-value-count">${formatNumber(count)}</span>
                                            </div>
                                        `).join('')}
                                        ${Object.keys(facet.valuesCount).length > 10 ? `<div style="padding: 8px 0; color: #9ca3af; font-size: 11px;">... and ${Object.keys(facet.valuesCount).length - 10} more</div>` : ''}
                                    </div>
                                `;
                            } else {
                                distributionHTML = 'No distribution data';
                            }
                        } else if (facet.values && facet.values.length > 0) {
                            // Count values manually if valuesCount not available
                            const valueCounts = {};
                            facet.values.forEach(v => {
                                const key = String(v);
                                valueCounts[key] = (valueCounts[key] || 0) + 1;
                            });
                            
                            const sortedValues = Object.entries(valueCounts)
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 10);
                            
                            if (sortedValues.length > 0) {
                                distributionHTML = `
                                    <div class="facet-values">
                                        ${sortedValues.map(([value, count]) => `
                                            <div class="facet-value-item">
                                                <span class="facet-value-name">${escapeHtml(value)}</span>
                                                <span class="facet-value-count">${formatNumber(count)}</span>
                                            </div>
                                        `).join('')}
                                        ${Object.keys(valueCounts).length > 10 ? `<div style="padding: 8px 0; color: #9ca3af; font-size: 11px;">... and ${Object.keys(valueCounts).length - 10} more</div>` : ''}
                                    </div>
                                `;
                            } else {
                                distributionHTML = 'No distribution data';
                            }
                        } else {
                            distributionHTML = 'No distribution data';
                        }
                    }

                    tableHTML += `
                        <tr>
                            <td class="facet-field-name">${escapeHtml(fieldName)}</td>
                            <td>${statsHTML}</td>
                            <td>${uniqueValuesHTML}</td>
                            <td>${distributionHTML}</td>
                        </tr>
                    `;
                });

                tableHTML += `
                        </tbody>
                    </table>
                `;

                facetContent.innerHTML = tableHTML;
                
                // Attach tooltip event listeners to histograms (immediate display)
                setTimeout(() => {
                    attachHistogramTooltips();
                }, 50);

            } catch (error) {
                facetContent.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: #dc3545;">
                        <div style="margin-bottom: 20px; font-size: 48px;">⚠️</div>
                        <h3>Error Loading Facets</h3>
                        <p>${escapeHtml(error.message)}</p>
                        <button onclick="closeFacets()" 
                                style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px;">
                            Close
                        </button>
                    </div>
                `;
            }
        }

        function closeFacets() {
            const chatMessages = document.getElementById('chatMessages');
            const facetContainer = document.getElementById('facetContainer');

            if (!chatMessages || !facetContainer) {
                return;
            }

            // Clear stored themeId when closing
            currentFacetsThemeId = null;

            // Hide facet container
            facetContainer.classList.remove('active');
            facetContainer.style.height = '';

            // Show chat messages
            chatMessages.classList.remove('hidden');
            chatMessages.style.opacity = '';
            chatMessages.style.pointerEvents = '';

            // Restore chat scroll position
            if (chatMessages && chatScrollPosition > 0) {
                setTimeout(() => {
                    chatMessages.scrollTop = chatScrollPosition;
                }, 100);
            }

            // Resize map after restoring chat
            if (typeof ixmaps !== 'undefined' && typeof ixmaps.resizeMap === 'function') {
                setTimeout(() => {
                    ixmaps.resizeMap(null, false);
                }, 200);
            }
        }

        // Multi-step command parsing and execution
        
        /**
         * Parse a multi-step command into individual steps
         * @param {string} query - The full command query
         * @returns {Array} Array of step objects
         */
        function parseMultiStepCommand(query) {
            const steps = [];
            
            // First, try to split by explicit connectors
            const explicitConnectors = [
                /\s+then\s+/i,
                /\s+and then\s+/i,
                /\s+after that\s+/i,
                /\s+after\s+/i,
                /\s+next\s+/i,
                /\s+followed by\s+/i
            ];
            
            let parts = [query];
            
            // Split by explicit connectors first
            for (let connector of explicitConnectors) {
                const newParts = [];
                for (let part of parts) {
                    const split = part.split(connector);
                    newParts.push(...split);
                }
                parts = newParts;
            }
            
            // Then split by comma/semicolon/hyphen if no explicit connector was found
            if (parts.length === 1) {
                // Try splitting by punctuation first
                // For hyphen (-), only split if it's surrounded by whitespace (e.g., "cmd1 - cmd2" but not "cmd-1" or "command-1")
                // Use a regex that matches hyphen only when it has whitespace before and after
                parts = query.split(/[,;]|\s+-\s+/);
                
                // If still only one part, try splitting by "and" (but be careful)
                if (parts.length === 1) {
                    // Check if this looks like a filter/select query with "and" as a logical operator
                    // Patterns that indicate "and" is a logical operator, not a step separator:
                    // - "select ... and ..." (where "and" is between conditions)
                    // - "... where ... and ..." (where "and" is between conditions)
                    // - "... = ... and ..." (where "and" is between conditions)
                    // - "... > ... and ..." (where "and" is between conditions)
                    // - "... < ... and ..." (where "and" is between conditions)
                    const isFilterQuery = /\b(select|filter|where)\b.*\b(and|or)\b.*(=|>|<|>=|<=|!=)/i.test(query) ||
                                         /(=|>|<|>=|<=|!=).*\band\b.*(=|>|<|>=|<=|!=)/i.test(query);
                    
                    if (!isFilterQuery) {
                        // Split by "and" but only if it's between command-like phrases
                        // Pattern: look for "and" that's followed by command verbs
                        // This ensures we split "size by X and color by Y" but not "select where A = X and B > Y"
                        const andPattern = /\s+and\s+(?=color|size|load|goto|show|open|view|display|change|set|zoom|navigate)/i;
                        if (andPattern.test(query)) {
                            parts = query.split(andPattern);
                        }
                    }
                }
            }
            
            // Clean up and create step objects
            for (let i = 0; i < parts.length; i++) {
                const stepText = parts[i].trim();
                if (stepText) {
                    steps.push({
                        originalText: stepText,
                        stepIndex: i,
                        type: null,
                        parameters: {}
                    });
                }
            }
            
            return steps.length > 1 ? steps : null;
        }
        
        /**
         * Identify the type of a step and extract parameters
         * @param {string} stepText - The step text to identify
         * @returns {Object} Step metadata with type and parameters
         */
        function identifyStepType(stepText) {
            const step = {
                type: 'unknown',
                originalText: stepText,
                parameters: {}
            };
            
            // Load data patterns
            const loadDataPatterns = [
                /^load\s+data(?:\s+(?:from|url)\s+)?(.+)$/i,
                /^load\s+data\s+from\s+(.+)$/i
            ];
            
            for (let pattern of loadDataPatterns) {
                const match = stepText.match(pattern);
                if (match && match[1]) {
                    const url = match[1].trim();
                    if (url.startsWith('http://') || url.startsWith('https://')) {
                        step.type = 'loadData';
                        step.parameters.url = url;
                        return step;
                    }
                }
            }
            
            // Load map patterns
            const loadMapPatterns = [
                /^load\s+map(?:\s+(?:from|url)\s+)?(.+)$/i,
                /^load\s+map\s+from\s+(.+)$/i
            ];
            
            for (let pattern of loadMapPatterns) {
                const match = stepText.match(pattern);
                if (match && match[1]) {
                    const url = match[1].trim();
                    step.type = 'loadMap';
                    step.parameters.url = url;
                    return step;
                }
            }
            
            // Color by patterns
            const colorByPatterns = [
                /^color\s+(?:the\s+map\s+)?by\s+(.+)$/i,
                /^color\s+by\s+(.+)$/i,
                /^colorize\s+(?:the\s+map\s+)?by\s+(.+)$/i,
                /^colour\s+(?:the\s+map\s+)?by\s+(.+)$/i
            ];
            
            for (let pattern of colorByPatterns) {
                const match = stepText.match(pattern);
                if (match && match[1]) {
                    step.type = 'colorBy';
                    step.parameters.field = match[1].trim().replace(/['"]/g, '');
                    return step;
                }
            }
            
            // Size by patterns
            const sizeByPatterns = [
                /^size\s+(?:the\s+map\s+)?by\s+(.+)$/i,
                /^resize\s+(?:the\s+map\s+)?by\s+(.+)$/i,
                /^scale\s+(?:the\s+map\s+)?by\s+(.+)$/i
            ];
            
            for (let pattern of sizeByPatterns) {
                const match = stepText.match(pattern);
                if (match && match[1]) {
                    step.type = 'sizeBy';
                    step.parameters.field = match[1].trim().replace(/['"]/g, '');
                    return step;
                }
            }
            
            // Goto/zoom to patterns
            const gotoPatterns = [
                /^(?:goto|go\s+to|zoom\s+to|navigate\s+to|show\s+me|find)\s+(.+)$/i,
                /^(?:vai\s+a|vai\s+in|zoom\s+a|mostrami)\s+(.+)$/i,  // Italian
                /^(?:ve\s+a|ir\s+a|zoom\s+a|muéstrame)\s+(.+)$/i,     // Spanish
                /^(?:aller\s+à|va\s+à|zoom\s+sur|montre[-]moi)\s+(.+)$/i,  // French
                /^(?:gehe\s+nach|gehe\s+zu|zoom\s+zu|zeige\s+mir)\s+(.+)$/i  // German
            ];
            
            for (let pattern of gotoPatterns) {
                const match = stepText.match(pattern);
                if (match && match[1]) {
                    step.type = 'goto';
                    step.parameters.location = match[1].trim();
                    return step;
                }
            }
            
            // Generic "load" pattern (fallback)
            const loadPattern = /^load\s+(.+)$/i;
            const loadMatch = stepText.match(loadPattern);
            if (loadMatch && loadMatch[1]) {
                const url = loadMatch[1].trim();
                // Try to determine if it's data or map based on extension
                const urlLower = url.toLowerCase();
                if (urlLower.endsWith('.html') || urlLower.endsWith('.json')) {
                    step.type = 'loadMap';
                    step.parameters.url = url;
                } else if (urlLower.match(/\.(csv|parquet|geojson|topojson|gpkg|fgb|kml|kmz|shp)$/)) {
                    step.type = 'loadData';
                    step.parameters.url = url;
                } else if (url.startsWith('http://') || url.startsWith('https://')) {
                    // Default to data for URLs
                    step.type = 'loadData';
                    step.parameters.url = url;
                }
                if (step.type !== 'unknown') {
                    return step;
                }
            }
            
            return step;
        }
        
        /**
         * Execute steps sequentially with progress feedback
         * @param {Array} steps - Array of step objects
         */
        async function executeStepsSequentially(steps) {
            if (!steps || steps.length === 0) {
                addMessage('⚠️ No steps to execute.', false);
                return;
            }
            
            const totalSteps = steps.length;
            let successCount = 0;
            let failCount = 0;
            
            addMessage(`📋 Executing ${totalSteps} step(s)...\n`, false);
            
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                const stepNum = i + 1;
                
                // Identify step type if not already identified
                if (!step.type || step.type === 'unknown') {
                    const identified = identifyStepType(step.originalText);
                    step.type = identified.type;
                    step.parameters = identified.parameters;
                }
                
                addMessage(`\n**Step ${stepNum}/${totalSteps}:** ${step.originalText}`, false);
                
                try {
                    let result = null;
                    
                    switch (step.type) {
                        case 'loadData':
                            result = await executeLoadDataStep(step);
                            break;
                        case 'loadMap':
                            result = await executeLoadMapStep(step);
                            break;
                        case 'colorBy':
                            result = await executeColorByStep(step);
                            break;
                        case 'sizeBy':
                            result = await executeSizeByStep(step);
                            break;
                        case 'goto':
                            result = await executeGotoStep(step);
                            break;
                        default:
                            addMessage(`⚠️ Unknown step type: "${step.type}". Skipping.`, false);
                            failCount++;
                            continue;
                    }
                    
                    if (result && result.success !== false) {
                        addMessage(`✅ Step ${stepNum}/${totalSteps} completed successfully.`, false);
                        successCount++;
                    } else {
                        addMessage(`❌ Step ${stepNum}/${totalSteps} failed.`, false);
                        failCount++;
                    }
                } catch (error) {
                    addMessage(`❌ Step ${stepNum}/${totalSteps} error: ${error.message}`, false);
                    failCount++;
                }
            }
            
            // Final summary
            if (successCount === totalSteps) {
                addMessage(`\n✅ **All ${totalSteps} step(s) completed successfully!**`, false);
            } else {
                addMessage(`\n⚠️ **Completed ${successCount}/${totalSteps} step(s) successfully.** ${failCount > 0 ? `${failCount} step(s) failed.` : ''}`, false);
            }
        }
        
        /**
         * Execute a load data step
         */
        async function executeLoadDataStep(step) {
            const url = step.parameters.url;
            if (!url) {
                throw new Error('No URL provided for load data step');
            }
            
            try {
                await loadDataFromUrl(url);
                // Wait a bit for data to be fully processed
                await new Promise(resolve => setTimeout(resolve, 500));
                return { success: true };
            } catch (error) {
                throw new Error(`Failed to load data: ${error.message}`);
            }
        }
        
        /**
         * Execute a load map step
         */
        async function executeLoadMapStep(step) {
            const url = step.parameters.url;
            if (!url) {
                throw new Error('No URL provided for load map step');
            }
            
            try {
                await handleLoadMapFromHTML(url);
                // Wait a bit for map to be fully loaded
                await new Promise(resolve => setTimeout(resolve, 1000));
                return { success: true };
            } catch (error) {
                throw new Error(`Failed to load map: ${error.message}`);
            }
        }
        
        /**
         * Execute a color by step
         */
        async function executeColorByStep(step) {
            const field = step.parameters.field;
            if (!field) {
                throw new Error('No field name provided for color by step');
            }
            
            // Check if map is ready
            if (!ixmaps || !ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                throw new Error('Map not ready. Please ensure data is loaded first.');
            }
            
            // Use the AI agent's color by functionality
            if (typeof ixmaps.aiQuery !== 'undefined' && typeof ixmaps.aiQuery.ask === 'function') {
                try {
                    const colorQuery = `color by ${field}`;
                    const result = await ixmaps.aiQuery.ask(colorQuery);
                    
                    if (result && result.response) {
                        // The AI agent handles the actual coloring
                        return { success: true, response: result.response };
                    } else {
                        throw new Error('Color by command did not return a response');
                    }
                } catch (error) {
                    throw new Error(`Failed to color by field: ${error.message}`);
                }
            } else {
                throw new Error('AI agent not available for color by command');
            }
        }
        
        /**
         * Execute a size by step
         */
        async function executeSizeByStep(step) {
            const field = step.parameters.field;
            if (!field) {
                throw new Error('No field name provided for size by step');
            }
            
            // Check if map is ready
            if (!ixmaps || !ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window || !ixmaps.embeddedSVG.window.map) {
                throw new Error('Map not ready. Please ensure data is loaded first.');
            }
            
            // Use the AI agent's size by functionality
            if (typeof ixmaps.aiQuery !== 'undefined' && typeof ixmaps.aiQuery.ask === 'function') {
                try {
                    const sizeQuery = `size by ${field}`;
                    const result = await ixmaps.aiQuery.ask(sizeQuery);
                    
                    if (result && result.response) {
                        return { success: true, response: result.response };
                    } else {
                        throw new Error('Size by command did not return a response');
                    }
                } catch (error) {
                    throw new Error(`Failed to size by field: ${error.message}`);
                }
            } else {
                throw new Error('AI agent not available for size by command');
            }
        }
        
        /**
         * Execute a goto step
         */
        async function executeGotoStep(step) {
            const location = step.parameters.location;
            if (!location) {
                throw new Error('No location provided for goto step');
            }
            
            try {
                // Ask AI for geographic coordinates or bounding box
                const locationPrompt = `I need the geographic coordinates (latitude and longitude) or bounding box for the place: "${location}"

Please respond with ONLY a JSON object in this exact format:
{
  "center": {
    "lat": latitude_as_number,
    "lng": longitude_as_number
  },
  "zoom": zoom_level_as_number (optional, default to 10 if not specified),
  "bounds": [optional, if available: [[south, west], [north, east]]]
}

If you cannot find the location, respond with:
{
  "error": "Location not found"
}

Examples:
- For "Rome, Italy": {"center": {"lat": 41.9028, "lng": 12.4964}, "zoom": 10}
- For "New York": {"center": {"lat": 40.7128, "lng": -74.0060}, "zoom": 10}
- For "Paris": {"center": {"lat": 48.8566, "lng": 2.3522}, "zoom": 10}

Location: "${location}"`;

                const aiResult = await askAIDirectly(locationPrompt);
                const response = aiResult.response || aiResult;
                
                // Try to parse JSON from the response
                let locationData = null;
                
                // Try to extract JSON from the response
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        locationData = JSON.parse(jsonMatch[0]);
                    } catch (e) {
                        console.error('Failed to parse JSON from AI response:', e);
                        throw new Error('Failed to parse location data from AI response');
                    }
                } else {
                    throw new Error('No valid location data found in AI response');
                }
                
                if (locationData && !locationData.error && locationData.center) {
                    // Use ixmaps.setView to zoom to the location
                    const center = locationData.center;
                    const zoom = locationData.zoom || 10;
                    
                    if (ixmaps && ixmaps.setView) {
                        ixmaps.setView({
                            center: {
                                lat: String(center.lat),
                                lng: String(center.lng)
                            },
                            zoom: String(zoom)
                        });
                    } else if (ixmaps && ixmaps.map && ixmaps.map().setView) {
                        ixmaps.map().setView({
                            center: {
                                lat: String(center.lat),
                                lng: String(center.lng)
                            },
                            zoom: String(zoom)
                        });
                    } else {
                        throw new Error('Map API not available. Cannot zoom to location.');
                    }
                    
                    return { 
                        success: true, 
                        message: `Zoomed to ${location} (${center.lat.toFixed(4)}, ${center.lng.toFixed(4)})` 
                    };
                } else {
                    throw new Error(locationData?.error || 'Location not found');
                }
            } catch (error) {
                throw new Error(`Failed to goto location: ${error.message}`);
            }
        }
        
        /**
         * Parse complex commands using AI when regex fails
         */
        async function parseComplexStepsWithAI(query) {
            // Check if AI is available
            const useGemini = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.useGemini;
            const hasGeminiKey = ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.config && ixmaps.aiQuery.config.geminiApiKey;
            const useMistral = localStorage.getItem('useMistral') === 'true';
            const hasMistralKey = localStorage.getItem('mistralApiKey');
            const hasAnyAI = (useGemini && hasGeminiKey) || (useMistral && hasMistralKey);
            
            if (!hasAnyAI) {
                return null;
            }
            
            try {
                const prompt = `Parse this command into sequential steps: "${query}"

Return ONLY a valid JSON array of step objects. Each step should have:
- "type": one of "loadData", "loadMap", "colorBy", "sizeBy", "goto", or "unknown"
- "originalText": the original step text
- "parameters": an object with relevant parameters (e.g., {"url": "..."}, {"field": "..."}, or {"location": "..."})

Example format:
[
  {"type": "loadData", "originalText": "load data from https://example.com/data.json", "parameters": {"url": "https://example.com/data.json"}},
  {"type": "colorBy", "originalText": "color by country name", "parameters": {"field": "country name"}}
]

Return ONLY the JSON array, no other text.`;
                
                let aiResponse = null;
                
                if (useGemini && hasGeminiKey) {
                    // Use Gemini API
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${ixmaps.aiQuery.config.geminiApiKey}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: prompt
                                }]
                            }]
                        })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        aiResponse = data.candidates[0].content.parts[0].text;
                    }
                } else if (useMistral && hasMistralKey) {
                    // Use Mistral API
                    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${hasMistralKey}`
                        },
                        body: JSON.stringify({
                            model: 'mistral-small',
                            messages: [{
                                role: 'user',
                                content: prompt
                            }]
                        })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        aiResponse = data.choices[0].message.content;
                    }
                }
                
                if (aiResponse) {
                    // Extract JSON from response (might have markdown code blocks)
                    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        const steps = JSON.parse(jsonMatch[0]);
                        return steps;
                    }
                }
            } catch (error) {
                console.error('Error parsing with AI:', error);
            }
            
            return null;
        }

        // Screenshot functionality
        async function captureMapScreenshot() {
            // Check if html2canvas is available
            if (typeof html2canvas !== 'function') {
                addMessage('❌ Screenshot feature not available: html2canvas library not loaded.', false);
                return;
            }

            // Check if map div exists
            const mapDiv = document.getElementById('map-div');
            if (!mapDiv) {
                addMessage('⚠️ Map container not found.', false);
                return;
            }

            const screenshotButton = document.getElementById('screenshotButton');
            if (screenshotButton) {
                screenshotButton.disabled = true;
            }

            try {
                addMessage('📷 Capturing screenshot...', false);

                // Capture the visible map div using html2canvas
                const captureCanvas = await html2canvas(mapDiv, {
                    backgroundColor: '#ffffff',
                    useCORS: true,
                    logging: false,
                    scale: window.devicePixelRatio || 1
                });

                if (!captureCanvas.width || !captureCanvas.height) {
                    throw new Error('Captured canvas is empty.');
                }

                // Convert canvas to data URL
                const dataUrl = captureCanvas.toDataURL('image/png');
                
                // Create download link with timestamped filename
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const downloadLink = document.createElement('a');
                downloadLink.href = dataUrl;
                downloadLink.download = `ixmaps-screenshot-${timestamp}.png`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                downloadLink.remove();

                addMessage('✅ Screenshot captured and downloaded successfully!', false);
            } catch (error) {
                const message = error && error.message ? error.message : 'Unknown error';
                console.error('Error capturing screenshot:', error);
                addMessage(`❌ Error capturing screenshot: ${message}`, false);
                
                if (message.includes('cross-origin')) {
                    addMessage('💡 Tip: If the map is from another domain, browser security restrictions may prevent screenshots.', false);
                }
            } finally {
                if (screenshotButton) {
                    screenshotButton.disabled = false;
                }
            }
        }

        // Refresh facets when map view changes (zoom/pan)
        let facetsRefreshTimeout = null;
        let isRefreshingFacets = false;
        
        async function refreshFacetsOnMapChange() {
            const facetContainer = document.getElementById('facetContainer');
            
            // Only refresh if facets are currently active
            if (!facetContainer || !facetContainer.classList.contains('active')) {
                return;
            }

            // Only refresh if we have a stored themeId
            if (!currentFacetsThemeId) {
                return;
            }

            // Prevent multiple simultaneous refreshes
            if (isRefreshingFacets) {
                return;
            }

            // Debounce the refresh to avoid too many updates
            if (facetsRefreshTimeout) {
                clearTimeout(facetsRefreshTimeout);
            }

            facetsRefreshTimeout = setTimeout(async () => {
                if (isRefreshingFacets) {
                    return;
                }

                isRefreshingFacets = true;
                const facetContent = document.getElementById('facetContent');
                
                try {
                    // Get current scroll position to restore it after refresh
                    const scrollPosition = facetContent ? facetContent.scrollTop : 0;

                    // Get theme object to access fields
                    const map = ixmaps.embeddedSVG && ixmaps.embeddedSVG.window ? ixmaps.embeddedSVG.window.map : null;
                    if (!map || !map.Api || !map.Api.getTheme) {
                        return;
                    }

                    const themeObj = map.Api.getTheme(currentFacetsThemeId);
                    if (!themeObj || !themeObj.objTheme) {
                        return;
                    }

                    // Get field names
                    const fields = themeObj.objTheme.dbFields || [];
                    if (fields.length === 0) {
                        return;
                    }

                    const fieldNames = fields.map(f => typeof f === 'string' ? f : (f.name || f.field || f.id || String(f)));

                    // Check if ixmaps.data.getFacets exists
                    if (!window.ixmaps || !window.ixmaps.data || typeof window.ixmaps.data.getFacets !== 'function') {
                        return;
                    }

                    // Get facets data (this will use collectRecords which gets visible records)
                    const facets = window.ixmaps.data.getFacets('', '', fieldNames, currentFacetsThemeId, 'map', true);

                    if (!facets || facets.length === 0) {
                        return;
                    }

                    // Render facet table (reuse the same rendering logic from showFacets)
                    let tableHTML = `
                        <table class="facet-table">
                            <thead>
                                <tr>
                                    <th>Field Name</th>
                                    <th>Type</th>
                                    <th>Statistics</th>
                                    <th>Unique Values</th>
                                    <th>Distribution</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    facets.forEach(facet => {
                        const fieldName = facet.id || 'Unknown';
                        const fieldType = facet.type || (facet.min !== undefined ? 'numeric' : 'textual');
                        
                        let statsHTML = '';
                        let uniqueValuesHTML = '';
                        let distributionHTML = '';

                        if (fieldType === 'numeric' || facet.min !== undefined) {
                            // Numeric field
                            const count = facet.nCount || (facet.values ? facet.values.length : 0) || (facet.data ? facet.data.length : 0) || 0;
                            const mean = facet.sum !== undefined && count > 0 ? (facet.sum / count) : null;
                            
                            // Check if min/max are valid (not MAX_VALUE/MIN_VALUE)
                            const isValidMin = facet.min !== undefined && facet.min !== null && 
                                              facet.min !== Number.MAX_VALUE && facet.min !== -Number.MAX_VALUE &&
                                              !isNaN(facet.min);
                            const isValidMax = facet.max !== undefined && facet.max !== null && 
                                              facet.max !== Number.MAX_VALUE && facet.max !== -Number.MAX_VALUE &&
                                              !isNaN(facet.max);
                            
                            statsHTML = `
                                <div class="facet-stats">
                                    <div class="stat-item"><span class="stat-label">Min:</span> ${isValidMin ? formatNumber(facet.min) : 'N/A'}</div>
                                    <div class="stat-item"><span class="stat-label">Max:</span> ${isValidMax ? formatNumber(facet.max) : 'N/A'}</div>
                                    ${mean !== null ? `<div class="stat-item"><span class="stat-label">Mean:</span> ${formatNumber(mean)}</div>` : ''}
                                    <div class="stat-item"><span class="stat-label">Count:</span> ${formatNumber(count)}</div>
                                </div>
                            `;
                            
                            uniqueValuesHTML = count > 0 ? count : 'N/A';
                            // Create histogram for numeric distribution
                            distributionHTML = createNumericHistogram(facet, 200, 80);
                        } else {
                            // Textual/categorical field
                            const uniqueCount = facet.uniqueValues || 
                                              (facet.valuesCount ? Object.keys(facet.valuesCount).length : 0) ||
                                              (facet.values ? new Set(facet.values).size : 0) ||
                                              0;
                            
                            const totalCount = facet.nCount || 
                                             (facet.values ? facet.values.length : 0) ||
                                             (facet.data ? facet.data.length : 0) ||
                                             (facet.valuesCount ? Object.values(facet.valuesCount).reduce((sum, val) => sum + (Number(val) || 0), 0) : 0) ||
                                             0;

                            statsHTML = `
                                <div class="facet-stats">
                                    <div class="stat-item"><span class="stat-label">Total:</span> ${formatNumber(totalCount)}</div>
                                </div>
                            `;
                            
                            uniqueValuesHTML = formatNumber(uniqueCount);
                            
                            // Show top values with counts
                            if (facet.valuesCount && typeof facet.valuesCount === 'object') {
                                const sortedValues = Object.entries(facet.valuesCount)
                                    .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
                                    .slice(0, 10); // Top 10
                                
                                if (sortedValues.length > 0) {
                                    distributionHTML = `
                                        <div class="facet-values">
                                            ${sortedValues.map(([value, count]) => `
                                                <div class="facet-value-item">
                                                    <span class="facet-value-name">${escapeHtml(String(value))}</span>
                                                    <span class="facet-value-count">${formatNumber(count)}</span>
                                                </div>
                                            `).join('')}
                                            ${Object.keys(facet.valuesCount).length > 10 ? `<div style="padding: 8px 0; color: #9ca3af; font-size: 11px;">... and ${Object.keys(facet.valuesCount).length - 10} more</div>` : ''}
                                        </div>
                                    `;
                                } else {
                                    distributionHTML = 'No distribution data';
                                }
                            } else if (facet.values && facet.values.length > 0) {
                                // Count values manually if valuesCount not available
                                const valueCounts = {};
                                facet.values.forEach(v => {
                                    const key = String(v);
                                    valueCounts[key] = (valueCounts[key] || 0) + 1;
                                });
                                
                                const sortedValues = Object.entries(valueCounts)
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 10);
                                
                                if (sortedValues.length > 0) {
                                    distributionHTML = `
                                        <div class="facet-values">
                                            ${sortedValues.map(([value, count]) => `
                                                <div class="facet-value-item">
                                                    <span class="facet-value-name">${escapeHtml(value)}</span>
                                                    <span class="facet-value-count">${formatNumber(count)}</span>
                                                </div>
                                            `).join('')}
                                            ${Object.keys(valueCounts).length > 10 ? `<div style="padding: 8px 0; color: #9ca3af; font-size: 11px;">... and ${Object.keys(valueCounts).length - 10} more</div>` : ''}
                                        </div>
                                    `;
                                } else {
                                    distributionHTML = 'No distribution data';
                                }
                            } else {
                                distributionHTML = 'No distribution data';
                            }
                        }

                        tableHTML += `
                            <tr>
                                <td class="facet-field-name">${escapeHtml(fieldName)}</td>
                                <td class="facet-field-type">${escapeHtml(fieldType)}</td>
                                <td>${statsHTML}</td>
                                <td>${uniqueValuesHTML}</td>
                                <td>${distributionHTML}</td>
                            </tr>
                        `;
                    });

                    tableHTML += `
                            </tbody>
                        </table>
                    `;

                    // Update content and restore scroll position
                    if (facetContent) {
                        facetContent.innerHTML = tableHTML;
                
                // Attach tooltip event listeners to histograms (immediate display)
                setTimeout(() => {
                    attachHistogramTooltips();
                }, 50);
                        // Restore scroll position after a brief delay to ensure content is rendered
                        setTimeout(() => {
                            if (facetContent) {
                                facetContent.scrollTop = scrollPosition;
                            }
                        }, 50);
                    }
                } catch (error) {
                    console.error('Error refreshing facets on map change:', error);
                } finally {
                    isRefreshingFacets = false;
                }
            }, 300); // Wait 300ms after last map change event
        }

        // Helper functions for formatting
        function formatNumber(num) {
            if (num === null || num === undefined || isNaN(num)) {
                return 'N/A';
            }
            if (Number.isInteger(num)) {
                return num.toLocaleString();
            }
            return Number(num).toLocaleString(undefined, { maximumFractionDigits: 2 });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Create histogram SVG for numeric distribution
        function createNumericHistogram(facet, width = 200, height = 80) {
            // Check if min/max are valid (not MAX_VALUE/MIN_VALUE)
            const isValidMin = facet?.min !== undefined && facet.min !== null && 
                              facet.min !== Number.MAX_VALUE && facet.min !== -Number.MAX_VALUE &&
                              !isNaN(facet.min);
            const isValidMax = facet?.max !== undefined && facet.max !== null && 
                              facet.max !== Number.MAX_VALUE && facet.max !== -Number.MAX_VALUE &&
                              !isNaN(facet.max);
            
            if (!facet || !isValidMin || !isValidMax) {
                return '<div style="color: #9ca3af; font-size: 12px;">No data</div>';
            }

            // Get numeric values
            let values = [];
            if (facet.values && facet.values.length > 0) {
                values = facet.values.map(v => parseFloat(v)).filter(v => !isNaN(v));
            } else if (facet.data && facet.data.length > 0) {
                values = facet.data.map(v => parseFloat(v)).filter(v => !isNaN(v));
            }

            if (values.length === 0) {
                return '<div style="color: #9ca3af; font-size: 12px;">No values</div>';
            }

            const min = facet.min;
            const max = facet.max;
            const range = max - min;

            if (range === 0) {
                // All values are the same
                return `<div style="color: #6b7280; font-size: 11px;">All values: ${formatNumber(min)}</div>`;
            }

            // Create bins (use 10-30 bins depending on data size - doubled for more detail)
            const numBins = Math.min(30, Math.max(10, Math.floor(Math.sqrt(values.length)) * 2));
            const binWidth = range / numBins;
            const bins = new Array(numBins).fill(0);

            // Count values in each bin
            values.forEach(value => {
                let binIndex = Math.floor((value - min) / binWidth);
                // Handle edge case where value equals max
                if (binIndex >= numBins) {
                    binIndex = numBins - 1;
                }
                bins[binIndex]++;
            });

            const maxCount = Math.max(...bins);
            if (maxCount === 0) {
                return '<div style="color: #9ca3af; font-size: 12px;">No valid values</div>';
            }

            // Create SVG histogram
            const padding = { top: 5, right: 5, bottom: 20, left: 30 };
            const chartWidth = width - padding.left - padding.right;
            const chartHeight = height - padding.top - padding.bottom;
            const barWidth = chartWidth / numBins;

            let svg = `<svg width="${width}" height="${height}" style="display: block; margin: 0 auto;">
                <defs>
                    <linearGradient id="histogramGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.8" />
                        <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:0.6" />
                    </linearGradient>
                </defs>`;

            // Draw axes FIRST (so they appear behind the bars)
            // Y-axis line
            svg += `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartHeight}" 
                stroke="#9ca3af" stroke-width="1"/>`;

            // X-axis line (horizontal zero line at baseline) - make it more prominent
            svg += `<line x1="${padding.left - 2}" y1="${padding.top + chartHeight}" x2="${width - padding.right + 2}" y2="${padding.top + chartHeight}" 
                stroke="#374151" stroke-width="2"/>`;

            // Draw bars (on top of axes)
            bins.forEach((count, index) => {
                const barHeight = maxCount > 0 ? (count / maxCount) * chartHeight : 0;
                const x = padding.left + (index * barWidth);
                const y = padding.top + chartHeight - barHeight;
                
                // Calculate bin range for tooltip
                const binStart = min + index * binWidth;
                const binEnd = min + (index + 1) * binWidth;

                svg += `<rect x="${x}" y="${y}" width="${barWidth - 1}" height="${barHeight}" 
                    fill="url(#histogramGradient)" stroke="#1e40af" stroke-width="0.5" opacity="0.8"
                    style="cursor: pointer;"
                    data-bin-start="${binStart}" data-bin-end="${binEnd}" data-count="${count}"></rect>`;
            });

            // X-axis labels (min and max)
            svg += `<text x="${padding.left}" y="${height - 5}" fill="#6b7280" font-size="9" text-anchor="start">${formatNumber(min)}</text>`;
            svg += `<text x="${width - padding.right}" y="${height - 5}" fill="#6b7280" font-size="9" text-anchor="end">${formatNumber(max)}</text>`;

            // Y-axis label (max count)
            if (maxCount > 0) {
                svg += `<text x="${padding.left - 5}" y="${padding.top + 4}" fill="#6b7280" font-size="9" text-anchor="end">${formatNumber(maxCount)}</text>`;
            }

            svg += `</svg>`;

            // Add tooltip container
            const histogramId = `histogram-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            return `<div class="facet-histogram" id="${histogramId}">
                ${svg}
                <div class="facet-histogram-tooltip" id="${histogramId}-tooltip"></div>
            </div>`;
        }
        
        // Add event listeners for histogram tooltips after rendering (immediate display, no delay)
        function attachHistogramTooltips() {
            // Find all histogram containers
            const histograms = document.querySelectorAll('.facet-histogram');
            histograms.forEach(histogram => {
                const svg = histogram.querySelector('svg');
                const tooltip = histogram.querySelector('.facet-histogram-tooltip');
                
                if (!svg || !tooltip) return;
                
                const rects = svg.querySelectorAll('rect');
                
                // Get total count from all bars
                let totalCount = 0;
                rects.forEach(r => {
                    totalCount += parseInt(r.getAttribute('data-count') || 0);
                });
                
                rects.forEach(rect => {
                    const updateTooltipPosition = (e) => {
                        const binStart = parseFloat(rect.getAttribute('data-bin-start'));
                        const binEnd = parseFloat(rect.getAttribute('data-bin-end'));
                        const count = parseInt(rect.getAttribute('data-count'));
                        
                        const percentage = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : 0;
                        const tooltipText = `Range: ${formatNumber(binStart)} - ${formatNumber(binEnd)}\nCount: ${formatNumber(count)} (${percentage}%)`;
                        
                        tooltip.textContent = tooltipText;
                        tooltip.classList.add('show');
                        
                        // Get mouse position relative to histogram container
                        const histogramBounds = histogram.getBoundingClientRect();
                        const mouseX = e.clientX - histogramBounds.left;
                        const mouseY = e.clientY - histogramBounds.top;
                        
                        // Get tooltip dimensions (after it's shown)
                        const tooltipRect = tooltip.getBoundingClientRect();
                        const tooltipWidth = tooltipRect.width || 100; // fallback
                        const tooltipHeight = tooltipRect.height || 40; // fallback
                        
                        // Position tooltip below mouse cursor by default
                        let left = mouseX;
                        let top = mouseY + 10;
                        
                        // Check if tooltip would go off screen
                        const histogramWidth = histogramBounds.width;
                        const histogramHeight = histogramBounds.height;
                        
                        // Adjust horizontal position if needed
                        if (left + (tooltipWidth / 2) > histogramWidth) {
                            left = histogramWidth - (tooltipWidth / 2) - 5;
                        } else if (left - (tooltipWidth / 2) < 0) {
                            left = (tooltipWidth / 2) + 5;
                        }
                        
                        // If tooltip would go below container, show above mouse instead
                        if (top + tooltipHeight > histogramHeight) {
                            top = mouseY - tooltipHeight - 10;
                        }
                        
                        tooltip.style.left = left + 'px';
                        tooltip.style.top = top + 'px';
                    };
                    
                    rect.addEventListener('mouseenter', updateTooltipPosition);
                    rect.addEventListener('mousemove', updateTooltipPosition);
                    rect.addEventListener('mouseleave', () => {
                        tooltip.classList.remove('show');
                    });
                });
            });
        }

        // Make functions globally accessible
        window.showConfigurator = showConfigurator;
        window.closeConfigurator = closeConfigurator;
        window.showThemeEditor = showThemeEditor;
        window.closeThemeEditor = closeThemeEditor;
        window.showDataTable = showDataTable;
        window.closeDataTable = closeDataTable;

        /**
         * Toggles the map roles display for a data table.
         * @function __dataMapRoles
         * @param {string} dataName - The name of the data.
         */
        function __dataMapRoles(dataName) {
            if (!dataName) {
                console.warn('[MAP ROLES] No dataName provided');
                return;
            }

            // Get the DataSink object
            const dataSink = window.dataSinks && window.dataSinks.get ? window.dataSinks.get(dataName) : null;
            if (!dataSink) {
                console.warn(`[MAP ROLES] No DataSink found for dataName: ${dataName}`);
                return;
            }

            // Only show if map exists
            if (!dataSink.map) {
                console.warn(`[MAP ROLES] No map associated with dataName: ${dataName}`);
                return;
            }

            const headerButton = document.getElementById(`input-table-header-${dataName}-map-roles`);
            const wasActive = dataSink.fShowMapRoles || false;
            dataSink.fShowMapRoles = !wasActive;
            
            if (headerButton) {
                if (dataSink.fShowMapRoles) {
                    headerButton.classList.add('active');
                } else {
                    headerButton.classList.remove('active');
                }
            }

            // Refresh the table to show/hide map roles row
            // Try to find the table container in the Chat app context
            const dataTableContent = document.getElementById('dataTableContent');
            if (dataTableContent) {
                // Find the ft-data element within the dataTableContent
                const tableContainer = dataTableContent.querySelector('#ft-data') || dataTableContent;
                if (tableContainer && dataSink) {
                    const height = dataSink.height || 500;
                    const newTableHtml = dataSink.makeDataTable(height);
                    
                    // Use jQuery if available, otherwise use vanilla JS
                    if (typeof $ !== 'undefined' && $(tableContainer).length) {
                        $(tableContainer).html(newTableHtml);
                    } else {
                        tableContainer.innerHTML = newTableHtml;
                    }
                    
                    // Re-setup event listeners
                    if (dataSink.setupTableEventListeners) {
                        dataSink.setupTableEventListeners(dataName);
                    }
                }
            } else {
                // Fallback: try to find ft-data directly
                const tableContainer = document.getElementById('ft-data');
                if (tableContainer && dataSink) {
                    const height = dataSink.height || 500;
                    const newTableHtml = dataSink.makeDataTable(height);
                    
                    // Use jQuery if available, otherwise use vanilla JS
                    if (typeof $ !== 'undefined' && $(tableContainer).length) {
                        $(tableContainer).html(newTableHtml);
                    } else {
                        tableContainer.innerHTML = newTableHtml;
                    }
                    
                    // Re-setup event listeners
                    if (dataSink.setupTableEventListeners) {
                        dataSink.setupTableEventListeners(dataName);
                    }
                }
            }
        }

        /**
         * Updates the map theme when a column role is changed.
         * @function __updateMapRole
         * @param {string} dataName - The name of the data.
         * @param {string} columnName - The name of the column.
         * @param {string} role - The role to assign ('-', 'lat', 'lon', 'geometry', 'color', 'size').
         */
        function __updateMapRole(dataName, columnName, role) {
            console.log(`[MAP ROLES] __updateMapRole called: dataName=${dataName}, columnName=${columnName}, role=${role}`);
            
            // Get the DataSink object
            const dataSink = window.dataSinks && window.dataSinks.get ? window.dataSinks.get(dataName) : null;
            if (!dataSink || !dataSink.map) {
                console.warn(`[MAP ROLES] No DataSink or map found for ${dataName}`);
                return;
            }
            console.log(`[MAP ROLES] DataSink and map found`);

            // Get the current theme
            const map = dataSink.map;
            let themesA = [];
            if (typeof map.getThemes === 'function') {
                themesA = map.getThemes();
            } else if (map.Api && typeof map.Api.getAllThemes === 'function') {
                themesA = map.Api.getAllThemes();
            } else if (map.Themes && typeof map.Themes.getThemes === 'function') {
                themesA = map.Themes.getThemes();
            }
            
            if (!themesA || !themesA.length) {
                console.warn(`[MAP ROLES] No themes found`);
                return;
            }
            console.log(`[MAP ROLES] Themes found: ${themesA.length}`);

            const themeObj = themesA[0];
            const themeId = themeObj.id || themeObj.szId || themeObj.szThemeId;
            console.log(`[MAP ROLES] Theme ID: ${themeId}`);
            
            let themeDefinition = null;
            if (typeof map.getThemeDefinitionObj === 'function') {
                themeDefinition = map.getThemeDefinitionObj(themeId);
            } else if (map.Api && typeof map.Api.getMapThemeDefinitionObj === 'function') {
                themeDefinition = map.Api.getMapThemeDefinitionObj(themeId);
            }

            if (!themeDefinition || !themeDefinition.style) {
                console.warn(`[MAP ROLES] No themeDefinition or style found`);
                return;
            }
            console.log(`[MAP ROLES] ThemeDefinition found, proceeding with role update`);

            // Remove the column from all roles first
            const lookupfield = themeDefinition.style.lookupfield || "";
            const sizefield = themeDefinition.style.sizefield || "";
            const colorfield = themeDefinition.style.colorfield || "";
            const themeField = themeDefinition.field || "";
            const themeType = themeDefinition.style.type || "";
            const isCategorical = themeType.includes("CATEGORICAL");

            // Handle lookupfield (can be geometry field or lat|lon)
            if (lookupfield === columnName) {
                themeDefinition.style.lookupfield = " ";
            } else if (lookupfield.includes("|")) {
                const [lat, lon] = lookupfield.split("|");
                if (lat === columnName || lon === columnName) {
                    themeDefinition.style.lookupfield = " ";
                }
            }

            // Remove from other roles
            if (sizefield === columnName) {
                themeDefinition.style.sizefield = null;
                // Remove SIZE modifier from type if present
                const currentType = themeDefinition.style.type || "";
                if (currentType.includes("SIZE")) {
                    const typeParts = currentType.split("|").filter(p => p.trim() !== "" && p.trim() !== "SIZE");
                    themeDefinition.style.type = typeParts.join("|");
                    console.log(`[MAP ROLES] Removed SIZE modifier from type: ${themeDefinition.style.type}`);
                }
            }
            // If field is used for color (with CATEGORICAL), clear it and remove CATEGORICAL if no other color field
            if (themeField === columnName && themeField !== "$item$") {
                themeDefinition.field = "$item$"; // Reset to default
                // Remove CATEGORICAL from type if no colorfield is set
                if (!themeDefinition.style.colorfield) {
                    const currentType = themeDefinition.style.type || "";
                    if (currentType.includes("CATEGORICAL")) {
                        const typeParts = currentType.split("|").filter(p => p.trim() !== "" && p.trim() !== "CATEGORICAL");
                        themeDefinition.style.type = typeParts.join("|");
                        console.log(`[MAP ROLES] Removed CATEGORICAL modifier from type: ${themeDefinition.style.type}`);
                    }
                }
            }
            if (colorfield === columnName) {
                themeDefinition.style.colorfield = null;
                // Remove CATEGORICAL from type if field is $item$ (no color field active)
                if (themeField === "$item$") {
                    const currentType = themeDefinition.style.type || "";
                    if (currentType.includes("CATEGORICAL")) {
                        const typeParts = currentType.split("|").filter(p => p.trim() !== "" && p.trim() !== "CATEGORICAL");
                        themeDefinition.style.type = typeParts.join("|");
                        console.log(`[MAP ROLES] Removed CATEGORICAL modifier from type: ${themeDefinition.style.type}`);
                    }
                }
            }

            // Set the new role
            if (role === '-') {
                // Already removed above
            } else if (role === 'geometry') {
                themeDefinition.style.lookupfield = columnName;
            } else if (role === 'lat') {
                const currentLookup = themeDefinition.style.lookupfield || "";
                if (currentLookup.includes("|")) {
                    const [, lon] = currentLookup.split("|");
                    themeDefinition.style.lookupfield = columnName + "|" + lon;
                } else {
                    themeDefinition.style.lookupfield = columnName + "|";
                }
            } else if (role === 'lon') {
                const currentLookup = themeDefinition.style.lookupfield || "";
                if (currentLookup.includes("|")) {
                    const [lat] = currentLookup.split("|");
                    themeDefinition.style.lookupfield = lat + "|" + columnName;
                } else {
                    themeDefinition.style.lookupfield = "|" + columnName;
                }
            } else if (role === 'color') {
                console.log(`[MAP ROLES] Setting color role for ${columnName}`);
                // Color role: if field is $item$, set it with the column name and add CATEGORICAL to type
                if (themeField === "$item$") {
                    themeDefinition.field = columnName;
                    console.log(`[MAP ROLES] Set field to ${columnName} for color`);
                    // Add CATEGORICAL to type if not already present
                    const currentType = themeDefinition.style.type || "";
                    let isCategoricalNow = currentType.includes("CATEGORICAL");
                    if (!isCategoricalNow) {
                        const typeParts = currentType.split("|").filter(p => p.trim() !== "");
                        if (typeParts.length === 0 || !typeParts[0].match(/^CHART|RAW|FAST/)) {
                            typeParts.unshift("CHART");
                        }
                        typeParts.push("CATEGORICAL");
                        themeDefinition.style.type = typeParts.join("|");
                        isCategoricalNow = true;
                        console.log(`[MAP ROLES] Added CATEGORICAL to type: ${themeDefinition.style.type}`);
                    }
                    // Set colorscheme to tableau with number of colors
                    // For CATEGORICAL themes, first parameter must be "1"
                    themeDefinition.style.colorscheme = ["1", "tableau"];
                    console.log(`[MAP ROLES] Set colorscheme to ["1", "tableau"]`);
                } else {
                    // If field is already set, use colorfield instead
                    themeDefinition.style.colorfield = columnName;
                    console.log(`[MAP ROLES] Set colorfield to ${columnName} for color`);
                    // Check if type is CATEGORICAL
                    const currentType = themeDefinition.style.type || "";
                    const isCategoricalNow = currentType.includes("CATEGORICAL");
                    // Set colorscheme to tableau with number of colors
                    // For CATEGORICAL themes, first parameter must be "1"
                    if (isCategoricalNow) {
                        themeDefinition.style.colorscheme = ["1", "tableau"];
                        console.log(`[MAP ROLES] Set colorscheme to ["1", "tableau"] (CATEGORICAL)`);
                    } else {
                        themeDefinition.style.colorscheme = ["1", "tableau"];
                        console.log(`[MAP ROLES] Set colorscheme to ["1", "tableau"]`);
                    }
                }
            } else if (role === 'size') {
                console.log(`[MAP ROLES] Setting size role for ${columnName}`);
                // Size role: always use sizefield
                themeDefinition.style.sizefield = columnName;
                console.log(`[MAP ROLES] Set sizefield to ${columnName} for size`);
                
                // Add SIZE modifier to type and change DOT to BUBBLE if needed
                const currentType = themeDefinition.style.type || "";
                const typeParts = currentType.split("|").filter(p => p.trim() !== "");
                
                // Ensure CHART is present at the beginning
                if (typeParts.length === 0 || !typeParts[0].match(/^CHART|RAW|FAST/)) {
                    typeParts.unshift("CHART");
                }
                
                // Replace DOT with BUBBLE if present
                let hasBubble = false;
                let hasSize = false;
                const newParts = [];
                
                for (let i = 0; i < typeParts.length; i++) {
                    const part = typeParts[i].trim();
                    if (part === "DOT") {
                        // Replace DOT with BUBBLE
                        if (!hasBubble) {
                            newParts.push("BUBBLE");
                            hasBubble = true;
                        }
                    } else if (part === "BUBBLE") {
                        if (!hasBubble) {
                            newParts.push(part);
                            hasBubble = true;
                        }
                    } else if (part === "SIZE") {
                        hasSize = true;
                        newParts.push(part);
                    } else {
                        // Keep all other parts (CHART, RAW, FAST, CATEGORICAL, etc.)
                        newParts.push(part);
                    }
                }
                
                // Add SIZE modifier if not present
                if (!hasSize) {
                    newParts.push("SIZE");
                }
                
                themeDefinition.style.type = newParts.join("|");
                console.log(`[MAP ROLES] Updated type to: ${themeDefinition.style.type}`);
            }

            // Apply the changes to the map
            try {
                console.log(`[MAP ROLES] Updating map role: ${dataName}, column: ${columnName}, role: ${role}`);
                console.log(`[MAP ROLES] Theme ID: ${themeId}`);
                console.log(`[MAP ROLES] Type: ${themeDefinition.style.type}`);
                console.log(`[MAP ROLES] Sizefield: ${themeDefinition.style.sizefield}`);
                console.log(`[MAP ROLES] Field: ${themeDefinition.field}`);
                
                // Update the theme using the map API
                // Try replaceTheme first, then newMapThemeByObj, then changeThemeStyle
                
                if (map && typeof map.replaceTheme === 'function') {
                    console.log(`[MAP ROLES] Using replaceTheme`);
                    try {
                        // replaceTheme(szTheme, theme, flag)
                        map.replaceTheme(themeId, themeDefinition);
                        console.log(`[MAP ROLES] replaceTheme called successfully`);
                    } catch (e) {
                        console.error(`[MAP ROLES] Error calling replaceTheme:`, e);
                        // Try newMapThemeByObj as fallback
                        if (map && typeof map.newMapThemeByObj === 'function') {
                            console.log(`[MAP ROLES] Trying newMapThemeByObj as fallback`);
                            try {
                                map.clearAll();
                                map.newMapThemeByObj(themeDefinition);
                                console.log(`[MAP ROLES] newMapThemeByObj called successfully`);
                            } catch (e2) {
                                console.error(`[MAP ROLES] Error calling newMapThemeByObj:`, e2);
                                console.log(`[MAP ROLES] Falling back to changeThemeStyle`);
                                _updateThemeWithChangeThemeStyle(map, themeId, themeDefinition);
                            }
                        } else {
                            console.log(`[MAP ROLES] Falling back to changeThemeStyle`);
                            _updateThemeWithChangeThemeStyle(map, themeId, themeDefinition);
                        }
                    }
                } else if (map && typeof map.newMapThemeByObj === 'function') {
                    console.log(`[MAP ROLES] Using newMapThemeByObj (replaceTheme not available)`);
                    try {
                        map.clearAll();
                        map.newMapThemeByObj(themeDefinition);
                        console.log(`[MAP ROLES] newMapThemeByObj called successfully`);
                    } catch (e) {
                        console.error(`[MAP ROLES] Error calling newMapThemeByObj:`, e);
                        console.log(`[MAP ROLES] Falling back to changeThemeStyle`);
                        _updateThemeWithChangeThemeStyle(map, themeId, themeDefinition);
                    }
                } else {
                    console.log(`[MAP ROLES] replaceTheme and newMapThemeByObj not available, using changeThemeStyle fallback`);
                    _updateThemeWithChangeThemeStyle(map, themeId, themeDefinition);
                }
                
                function _updateThemeWithChangeThemeStyle(map, themeId, themeDefinition) {
                    // Try to get changeThemeStyle function from various locations
                    let changeThemeStyleFunc = null;
                    if (typeof map.changeThemeStyle === 'function') {
                        changeThemeStyleFunc = map.changeThemeStyle;
                    } else if (map.Api && typeof map.Api.changeThemeStyle === 'function') {
                        changeThemeStyleFunc = map.Api.changeThemeStyle.bind(map.Api);
                    } else if (typeof window.ixmaps !== 'undefined' && typeof window.ixmaps.changeThemeStyle === 'function') {
                        changeThemeStyleFunc = window.ixmaps.changeThemeStyle;
                    }
                    
                    if (changeThemeStyleFunc) {
                        // Update type if it was changed
                        if (themeDefinition.style.type) {
                            console.log(`[MAP ROLES] Updating type to: ${themeDefinition.style.type}`);
                            changeThemeStyleFunc(themeId, "type:" + themeDefinition.style.type, "set");
                        }
                        // Update field if it was changed
                        if (themeDefinition.field && themeDefinition.field !== "$item$") {
                            console.log(`[MAP ROLES] Updating field to: ${themeDefinition.field}`);
                            changeThemeStyleFunc(themeId, "field:" + themeDefinition.field, "set");
                        }
                        // Update lookupfield
                        if (themeDefinition.style.lookupfield && themeDefinition.style.lookupfield !== " ") {
                            changeThemeStyleFunc(themeId, "lookupfield:" + themeDefinition.style.lookupfield, "set");
                        }
                        // Update sizefield
                        if (themeDefinition.style.sizefield) {
                            changeThemeStyleFunc(themeId, "sizefield:" + themeDefinition.style.sizefield, "set");
                        } else {
                            changeThemeStyleFunc(themeId, "sizefield", "remove");
                        }
                        // Update colorfield or valuefield (color)
                        if (themeDefinition.style.colorfield) {
                            changeThemeStyleFunc(themeId, "colorfield:" + themeDefinition.style.colorfield, "set");
                        } else {
                            changeThemeStyleFunc(themeId, "colorfield", "remove");
                        }
                        if (themeDefinition.style.valuefield) {
                            changeThemeStyleFunc(themeId, "valuefield:" + themeDefinition.style.valuefield, "set");
                        } else {
                            changeThemeStyleFunc(themeId, "valuefield", "remove");
                        }
                    } else {
                        console.error(`[MAP ROLES] changeThemeStyle function not found`);
                    }
                }
            } catch (e) {
                console.error("Error updating map theme:", e);
            }
        }

        // Make functions globally accessible
        window.__dataMapRoles = __dataMapRoles;
        window.__updateMapRole = __updateMapRole;
        window.checkAndCloseDataTableIfThemeVisible = checkAndCloseDataTableIfThemeVisible;
        
        // Handle geometry warning overlay close button
        const geometryWarningClose = document.getElementById('geometryWarningClose');
        if (geometryWarningClose) {
            geometryWarningClose.addEventListener('click', () => {
                const geometryWarningOverlay = document.getElementById('geometryWarningOverlay');
                if (geometryWarningOverlay) {
                    geometryWarningOverlay.style.display = 'none';
                }
            });
        }
        
        // Handle geometry warning table link
        const geometryWarningTableLink = document.getElementById('geometryWarningTableLink');
        if (geometryWarningTableLink) {
            geometryWarningTableLink.addEventListener('click', () => {
                // Close the warning overlay
                const geometryWarningOverlay = document.getElementById('geometryWarningOverlay');
                if (geometryWarningOverlay) {
                    geometryWarningOverlay.style.display = 'none';
                }
                // Show data table
                if (typeof showDataTable === 'function') {
                    showDataTable(null);
                }
            });
        }
        
        // Monitor map for theme additions and close data table if theme with geometry becomes visible
        // This is a fallback to catch any theme additions that might not trigger the explicit checks
        if (typeof MutationObserver !== 'undefined') {
            // Observe the map SVG for changes that might indicate theme additions
            const observeMapForThemes = () => {
                try {
                    const mapSvg = document.querySelector('#map-div svg');
                    if (mapSvg) {
                        const observer = new MutationObserver((mutations) => {
                            // Debounce checks
                            clearTimeout(window._themeCheckTimeout);
                            window._themeCheckTimeout = setTimeout(() => {
                                if (typeof checkAndCloseDataTableIfThemeVisible === 'function') {
                                    checkAndCloseDataTableIfThemeVisible();
                                }
                            }, 1000);
                        });
                        
                        observer.observe(mapSvg, {
                            childList: true,
                            subtree: true,
                            attributes: false
                        });
                        
                        console.log('📊 Started observing map for theme additions');
                    }
                } catch (e) {
                    console.warn('Could not set up map observer:', e);
                }
            };
            
            // Start observing after map is loaded
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    setTimeout(observeMapForThemes, 2000);
                });
            } else {
                setTimeout(observeMapForThemes, 2000);
            }
        }
        window.showFacets = showFacets;
        window.closeFacets = closeFacets;

        // Mobile functionality
        function initMobile() {
            const isMobile = window.innerWidth <= 768;
            const chatPane = document.getElementById('chatPane');
            const mapPane = document.querySelector('.pane.right');
            const mobileViewToggle = document.getElementById('mobileViewToggle');
            const mobileViewChat = document.getElementById('mobileViewChat');
            const mobileViewMap = document.getElementById('mobileViewMap');
            const mobileNavToggle = document.getElementById('mobileNavToggle');
            const mobileSidebarMenu = document.getElementById('mobileSidebarMenu');
            const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');
            const mobileSidebarClose = document.getElementById('mobileSidebarClose');
            const mobileBottomNav = document.getElementById('mobileBottomNav');
            const mobileBottomChat = document.getElementById('mobileBottomChat');
            const mobileBottomMap = document.getElementById('mobileBottomMap');
            const mobileBottomMenu = document.getElementById('mobileBottomMenu');
            const resizer = document.getElementById('resizer');

            // Check if mobile
            function checkMobile() {
                return window.innerWidth <= 768;
            }

            // Set initial view state
            let currentView = 'chat'; // 'chat' or 'map'

                // Switch between chat and map views
            function switchView(view) {
                if (!checkMobile()) return; // Only on mobile

                const chatContainer = document.querySelector('.chat-container');
                const header = document.querySelector('.header');
                const headerHeight = header ? header.offsetHeight : 60;
                const bottomNav = document.getElementById('mobileBottomNav');
                const bottomNavHeight = bottomNav ? bottomNav.offsetHeight : 0;
                const containerHeight = window.innerHeight - headerHeight - bottomNavHeight;
                const paneHeight = containerHeight + 'px';

                currentView = view;
                
                if (view === 'chat') {
                    if (chatPane) {
                        chatPane.classList.remove('hidden');
                        chatPane.style.height = paneHeight;
                        chatPane.style.minHeight = paneHeight;
                        chatPane.style.maxHeight = paneHeight;
                    }
                    if (mapPane) {
                        mapPane.classList.add('hidden');
                        // Keep height even when hidden to prevent layout shift
                        mapPane.style.height = paneHeight;
                        mapPane.style.minHeight = paneHeight;
                        mapPane.style.maxHeight = paneHeight;
                    }
                    if (mobileViewChat) mobileViewChat.classList.add('active');
                    if (mobileViewMap) mobileViewMap.classList.remove('active');
                    if (mobileBottomChat) mobileBottomChat.classList.add('active');
                    if (mobileBottomMap) mobileBottomMap.classList.remove('active');
                } else {
                    if (chatPane) {
                        chatPane.classList.add('hidden');
                        // Keep height even when hidden to prevent layout shift
                        chatPane.style.height = paneHeight;
                        chatPane.style.minHeight = paneHeight;
                        chatPane.style.maxHeight = paneHeight;
                    }
                    if (mapPane) {
                        mapPane.classList.remove('hidden');
                        mapPane.style.height = paneHeight;
                        mapPane.style.minHeight = paneHeight;
                        mapPane.style.maxHeight = paneHeight;
                        
                        // CRITICAL: Set explicit height on map-div and map-container
                        // so ixmaps.resizeMap reads the correct parent height
                        const mapContainer = mapPane.querySelector('.map-container');
                        const mapDiv = document.getElementById('map-div');
                        if (mapContainer) {
                            mapContainer.style.height = paneHeight;
                            mapContainer.style.maxHeight = paneHeight;
                        }
                        if (mapDiv) {
                            mapDiv.style.height = paneHeight;
                            mapDiv.style.maxHeight = paneHeight;
                        }
                    }
                    if (mobileViewChat) mobileViewChat.classList.remove('active');
                    if (mobileViewMap) mobileViewMap.classList.add('active');
                    if (mobileBottomChat) mobileBottomChat.classList.remove('active');
                    if (mobileBottomMap) mobileBottomMap.classList.add('active');
                }

                // Resize map when switching views - then force correct dimensions
                requestAnimationFrame(() => {
                    if (typeof ixmaps !== 'undefined' && typeof ixmaps.resizeMap === 'function') {
                        ixmaps.resizeMap(null, false);
                        // After ixmaps resizes, force the SVG to respect our container height
                        setTimeout(() => {
                            const mapDiv = document.getElementById('map-div');
                            const mapSvg = mapDiv ? mapDiv.querySelector('svg') : null;
                            if (mapSvg && mapPane) {
                                const paneHeight = mapPane.offsetHeight;
                                mapSvg.style.maxHeight = paneHeight + 'px';
                                mapSvg.style.height = paneHeight + 'px';
                                mapDiv.style.maxHeight = paneHeight + 'px';
                                mapDiv.style.height = paneHeight + 'px';
                            }
                            // Try resize again to let ixmaps adjust
                            ixmaps.resizeMap(null, false);
                        }, 100);
                    }
                });
            }

            // Toggle mobile sidebar menu
            function toggleMobileSidebar() {
                if (mobileSidebarMenu && mobileSidebarOverlay) {
                    const isActive = mobileSidebarMenu.classList.contains('active');
                    if (isActive) {
                        // Close
                        closeMobileSidebar();
                    } else {
                        // Open - use !important to override CSS
                        // CRITICAL: Ensure parent elements are visible
                        document.documentElement.style.visibility = '';
                        document.body.style.visibility = '';
                        
                        // Remove transition temporarily to force immediate change
                        mobileSidebarMenu.style.setProperty('transition', 'none', 'important');
                        mobileSidebarMenu.style.setProperty('visibility', 'visible', 'important');
                        mobileSidebarMenu.style.setProperty('transform', 'translateX(0px)', 'important');
                        mobileSidebarMenu.style.setProperty('left', '0px', 'important');
                        mobileSidebarMenu.style.setProperty('display', 'block', 'important');
                        
                        mobileSidebarOverlay.style.setProperty('transition', 'none', 'important');
                        mobileSidebarOverlay.style.setProperty('visibility', 'visible', 'important');
                        mobileSidebarOverlay.style.setProperty('opacity', '1', 'important');
                        mobileSidebarOverlay.style.setProperty('pointer-events', 'auto', 'important');
                        mobileSidebarOverlay.style.setProperty('display', 'block', 'important');
                        
                        mobileSidebarMenu.classList.add('active');
                        mobileSidebarOverlay.classList.add('active');
                        document.body.style.overflow = 'hidden';
                        
                        // Re-enable transition after a frame, but keep the open state
                        requestAnimationFrame(() => {
                            mobileSidebarMenu.style.setProperty('transform', 'translateX(0px)', 'important');
                            mobileSidebarMenu.style.setProperty('visibility', 'visible', 'important');
                            mobileSidebarMenu.style.setProperty('transition', 'transform 0.3s ease', 'important');
                            
                            mobileSidebarOverlay.style.setProperty('opacity', '1', 'important');
                            mobileSidebarOverlay.style.setProperty('visibility', 'visible', 'important');
                            mobileSidebarOverlay.style.setProperty('transition', 'opacity 0.3s ease', 'important');
                        });
                    }
                }
            }

            // Close mobile sidebar
            function closeMobileSidebar() {
                if (mobileSidebarMenu && mobileSidebarOverlay) {
                    // Set closing styles with !important
                    mobileSidebarMenu.style.setProperty('transition', 'transform 0.3s ease', 'important');
                    mobileSidebarMenu.style.setProperty('transform', 'translateX(-100%)', 'important');
                    mobileSidebarMenu.style.setProperty('visibility', 'hidden', 'important');
                    
                    mobileSidebarOverlay.style.setProperty('transition', 'opacity 0.3s ease', 'important');
                    mobileSidebarOverlay.style.setProperty('opacity', '0', 'important');
                    mobileSidebarOverlay.style.setProperty('visibility', 'hidden', 'important');
                    mobileSidebarOverlay.style.setProperty('pointer-events', 'none', 'important');
                    
                    mobileSidebarMenu.classList.remove('active');
                    mobileSidebarOverlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            }

            // Handle mobile menu item clicks
            function setupMobileMenuItems() {
                const mobileLoadMapButton = document.getElementById('mobileLoadMapButton');
                const mobileLoadDataButton = document.getElementById('mobileLoadDataButton');
                const mobileDataTableButton = document.getElementById('mobileDataTableButton');
                const mobileThemeEditorButton = document.getElementById('mobileThemeEditorButton');
                const mobileConfiguratorButton = document.getElementById('mobileConfiguratorButton');
                const mobileScreenshotButton = document.getElementById('mobileScreenshotButton');
                const mobileSettingsButton = document.getElementById('mobileSettingsButton');

                if (mobileLoadMapButton) {
                    mobileLoadMapButton.addEventListener('click', () => {
                        const sidebarButton = document.getElementById('sidebarLoadMapButton');
                        if (sidebarButton) sidebarButton.click();
                        closeMobileSidebar();
                    });
                }

                if (mobileLoadDataButton) {
                    mobileLoadDataButton.addEventListener('click', () => {
                        const sidebarButton = document.getElementById('sidebarLoadDataButton');
                        if (sidebarButton) sidebarButton.click();
                        closeMobileSidebar();
                    });
                }

                if (mobileDataTableButton) {
                    mobileDataTableButton.addEventListener('click', () => {
                        const tableButton = document.getElementById('dataTableToggle');
                        if (tableButton) tableButton.click();
                        closeMobileSidebar();
                    });
                }

                if (mobileThemeEditorButton) {
                    mobileThemeEditorButton.addEventListener('click', () => {
                        closeMobileSidebar();
                        const defaultThemeId = getDefaultThemeId();
                        showThemeEditor(defaultThemeId);
                    });
                }

                if (mobileConfiguratorButton) {
                    mobileConfiguratorButton.addEventListener('click', () => {
                        closeMobileSidebar();
                        const defaultThemeId = getDefaultThemeId();
                        showConfigurator(defaultThemeId);
                    });
                }

                if (mobileScreenshotButton) {
                    mobileScreenshotButton.addEventListener('click', () => {
                        const screenshotBtn = document.getElementById('screenshotButton');
                        if (screenshotBtn) screenshotBtn.click();
                        closeMobileSidebar();
                    });
                }

                if (mobileSettingsButton) {
                    mobileSettingsButton.addEventListener('click', () => {
                        const settingsBtn = document.getElementById('settingsToggle');
                        if (settingsBtn) settingsBtn.click();
                        closeMobileSidebar();
                    });
                }
            }

            // Event listeners
            if (mobileViewChat) {
                mobileViewChat.addEventListener('click', () => switchView('chat'));
            }

            if (mobileViewMap) {
                mobileViewMap.addEventListener('click', () => switchView('map'));
            }

            if (mobileNavToggle) {
                mobileNavToggle.addEventListener('click', toggleMobileSidebar);
            }

            if (mobileSidebarClose) {
                mobileSidebarClose.addEventListener('click', closeMobileSidebar);
            }

            if (mobileSidebarOverlay) {
                mobileSidebarOverlay.addEventListener('click', closeMobileSidebar);
            }

            if (mobileBottomChat) {
                mobileBottomChat.addEventListener('click', () => switchView('chat'));
            }

            if (mobileBottomMap) {
                mobileBottomMap.addEventListener('click', () => switchView('map'));
            }

            if (mobileBottomMenu) {
                mobileBottomMenu.addEventListener('click', toggleMobileSidebar);
            }

            // Setup menu items
            setupMobileMenuItems();

            // Disable resizer on mobile
            function handleResize() {
                const isMobileNow = checkMobile();
                const chatContainer = document.querySelector('.chat-container');
                
                if (resizer) {
                    if (isMobileNow) {
                        resizer.style.display = 'none';
                        resizer.style.pointerEvents = 'none';
                    } else {
                        resizer.style.display = '';
                        resizer.style.pointerEvents = '';
                    }
                }

                // Initialize view on mobile
                if (isMobileNow && chatPane && mapPane && chatContainer) {
                    // Calculate and set explicit height for container
                    const header = document.querySelector('.header');
                    const headerHeight = header ? header.offsetHeight : 60;
                    const bottomNav = document.getElementById('mobileBottomNav');
                    const bottomNavHeight = bottomNav ? bottomNav.offsetHeight : 0;
                    const containerHeight = window.innerHeight - headerHeight - bottomNavHeight;
                    
                    chatContainer.style.height = containerHeight + 'px';
                    chatContainer.style.minHeight = containerHeight + 'px';
                    chatContainer.style.maxHeight = containerHeight + 'px';
                    
                    // Ensure panes have explicit height matching container
                    const paneHeight = containerHeight + 'px';
                    chatPane.style.height = paneHeight;
                    chatPane.style.minHeight = paneHeight;
                    chatPane.style.maxHeight = paneHeight;
                    mapPane.style.height = paneHeight;
                    mapPane.style.minHeight = paneHeight;
                    mapPane.style.maxHeight = paneHeight;
                    
                    switchView('chat');
                } else if (!isMobileNow && chatPane && mapPane && chatContainer) {
                    // Reset to desktop view
                    chatPane.classList.remove('hidden');
                    mapPane.classList.remove('hidden');
                    chatPane.style.height = '';
                    chatPane.style.minHeight = '';
                    chatPane.style.maxHeight = '';
                    mapPane.style.height = '';
                    mapPane.style.minHeight = '';
                    mapPane.style.maxHeight = '';
                    chatContainer.style.height = '';
                    chatContainer.style.minHeight = '';
                    chatContainer.style.maxHeight = '';
                }
            }

            // Initial setup - skip if already set by showPage()
            // handleResize(); // Disabled - heights are set by showPage() in head script

            // Handle window resize
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    handleResize();
                    // Ensure current view maintains height after resize
                    if (checkMobile()) {
                        if (currentView === 'chat' && chatPane) {
                            chatPane.style.height = '100%';
                            chatPane.style.minHeight = '100%';
                        } else if (currentView === 'map' && mapPane) {
                            mapPane.style.height = '100%';
                            mapPane.style.minHeight = '100%';
                        }
                    }
                }, 250);
            });

            // Prevent zoom on double tap (iOS)
            let lastTouchEnd = 0;
            document.addEventListener('touchend', (e) => {
                const now = Date.now();
                if (now - lastTouchEnd <= 300) {
                    e.preventDefault();
                }
                lastTouchEnd = now;
            }, false);
        }

        // Event listeners
        // Height initialization is now handled by showPage() in head script
        
        window.addEventListener('load', () => {
            // Clear lastEditedThemeId from localStorage on page load
            localStorage.removeItem('lastEditedThemeId');
            
            // Heights already set by showPage() in head script
            loadSettings();
            applyEmbedChatUiHints();
            initMap();
            initSidebarResize();
            initMobile();

            // Handle window resize to update map size
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    if (typeof ixmaps !== 'undefined' && typeof ixmaps.resizeMap === 'function') {
                        ixmaps.resizeMap(null, false);
                    }
                }, 250);
            });

            // Set up map zoom/pan event listeners to refresh facets
            let mapEventListenersSetup = false;
            
            function setupMapEventListeners() {
                if (mapEventListenersSetup) {
                    return; // Already set up
                }

                try {
                    // Wait for map to be ready
                    if (!ixmaps || !ixmaps.embeddedSVG || !ixmaps.embeddedSVG.window) {
                        setTimeout(setupMapEventListeners, 500);
                        return;
                    }

                    const mapWindow = ixmaps.embeddedSVG.window;
                    const svgElement = mapWindow.document?.documentElement || mapWindow.document?.querySelector('svg');
                    
                    if (!svgElement) {
                        setTimeout(setupMapEventListeners, 500);
                        return;
                    }

                    // Listen to SVG transform events (zoom/pan)
                    // Use MutationObserver to detect transform changes on the main SVG group
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            if (mutation.type === 'attributes' && 
                                (mutation.attributeName === 'transform' || mutation.attributeName === 'viewBox')) {
                                refreshFacetsOnMapChange();
                            }
                        });
                    });

                    // Find the main map group (usually a g element with transform)
                    const mapGroup = svgElement.querySelector('g[transform]') || svgElement.querySelector('g') || svgElement;
                    
                    // Observe the SVG element and map group for transform changes
                    observer.observe(svgElement, {
                        attributes: true,
                        attributeFilter: ['transform', 'viewBox'],
                        subtree: true
                    });

                    if (mapGroup !== svgElement) {
                        observer.observe(mapGroup, {
                            attributes: true,
                            attributeFilter: ['transform']
                        });
                    }

                    // Also listen to wheel events (zoom) on the map container
                    const mapDiv = document.getElementById('map-div');
                    if (mapDiv) {
                        let wheelTimeout = null;
                        mapDiv.addEventListener('wheel', () => {
                            if (wheelTimeout) {
                                clearTimeout(wheelTimeout);
                            }
                            wheelTimeout = setTimeout(() => {
                                refreshFacetsOnMapChange();
                            }, 200);
                        }, { passive: true });
                    }

                    // Listen to mouse/touch events for panning
                    let isPanning = false;
                    let panStartTime = 0;
                    let panTimeout = null;

                    const handlePanStart = () => {
                        isPanning = true;
                        panStartTime = Date.now();
                    };

                    const handlePanEnd = () => {
                        if (isPanning && Date.now() - panStartTime > 100) {
                            if (panTimeout) {
                                clearTimeout(panTimeout);
                            }
                            panTimeout = setTimeout(() => {
                                refreshFacetsOnMapChange();
                            }, 200);
                        }
                        isPanning = false;
                    };

                    // Listen to events on the map container
                    if (mapDiv) {
                        mapDiv.addEventListener('mousedown', handlePanStart);
                        mapDiv.addEventListener('mouseup', handlePanEnd);
                        mapDiv.addEventListener('touchstart', handlePanStart, { passive: true });
                        mapDiv.addEventListener('touchend', handlePanEnd, { passive: true });
                    }

                    mapEventListenersSetup = true;

                } catch (error) {
                    console.warn('Could not set up map event listeners for facets refresh:', error);
                }
            }

            // Set up map event listeners after a short delay to ensure map is initialized
            setTimeout(setupMapEventListeners, 1000);
            
            // Also try to set up when map is ready (if initMap function exists)
            if (typeof initMap === 'function') {
                const originalInitMap = initMap;
                window.initMap = function() {
                    originalInitMap();
                    setTimeout(setupMapEventListeners, 500);
                };
            }

            const apiKeyInput = document.getElementById('geminiApiKeyInput');
            const useGeminiCheck = document.getElementById('useGeminiCheck');

            if (apiKeyInput && useGeminiCheck) {
                apiKeyInput.addEventListener('input', () => {
                    const key = apiKeyInput.value.trim();
                    if (key && key.length > 10) {
                        useGeminiCheck.checked = true;
                        if (ixmaps && ixmaps.aiQuery) {
                            ixmaps.aiQuery.setGeminiApiKey(key);
                            ixmaps.aiQuery.setUseGemini(true);
                        }
                    }
                    updateAiAgentInfo();
                });

                useGeminiCheck.addEventListener('change', () => {
                    if (ixmaps && ixmaps.aiQuery) {
                        ixmaps.aiQuery.setUseGemini(useGeminiCheck.checked);
                    }
                    updateAiAgentInfo();
                });
            }
        });

        // Data Table toggle
        document.getElementById('dataTableToggle').addEventListener('click', (e) => {
            e.stopPropagation();
            showDataTable();
        });

        // Data Table close button
        document.getElementById('dataTableClose').addEventListener('click', (e) => {
            e.stopPropagation();
            closeDataTable();
        });

        // Theme Editor toggle
        document.getElementById('themeEditorToggle').addEventListener('click', (e) => {
            e.stopPropagation();
            const defaultThemeId = getDefaultThemeId();
            showThemeEditor(defaultThemeId);
        });

        // Theme Editor close button
        document.getElementById('themeEditorClose').addEventListener('click', (e) => {
            e.stopPropagation();
            closeThemeEditor();
        });

        // Configurator toggle
        document.getElementById('configuratorToggle').addEventListener('click', (e) => {
            e.stopPropagation();
            const defaultThemeId = getDefaultThemeId();
            showConfigurator(defaultThemeId);
        });

        // Configurator close button
        document.getElementById('configuratorClose').addEventListener('click', (e) => {
            e.stopPropagation();
            closeConfigurator();
        });

        // Facet close button
        document.getElementById('facetClose').addEventListener('click', (e) => {
            e.stopPropagation();
            closeFacets();
        });

        // Screenshot button
        document.getElementById('screenshotButton').addEventListener('click', (e) => {
            e.stopPropagation();
            captureMapScreenshot();
        });

        // Settings toggle
        // Available maps for the selector
        const AVAILABLE_MAPS = [
            {
                type: 'chapter',
                title: 'Minimal Maps'
            },
            {
                id: 'minimal_map_World_blueprint',
                title: 'World Blueprint',
                description: 'World Blueprint map',
                url: './maps/minimal_map_World_blueprint.html'
            },
            {
                id: 'minimal_map_EU_NUTS_lambert',
                title: 'minimal_map_EU_NUTS_lambert',
                description: 'minimal_map_EU_NUTS_lambert',
                url: './maps/minimal_map_EU_NUTS_lambert.html'
            },
            {
                id: 'minimal_map_Italy_comuni_blueprint',
                title: 'Amminitrative boundaries Italy - 2025 - Comuni',
                description: 'Italy Comuni 2025 geobase',
                url: './maps/minimal_map_Italy_comuni_2025.html'
            },
            {
                type: 'chapter',
                title: 'Demo Maps'
            },
            {
                id: 'demo_blurr_and_text_GHS_equal_earth',
                title: 'GHS Equal Earth',
                description: 'Global Human Settlement with Equal Earth projection',
                url: './maps/demo_blurr_and_text_GHS_equal_earth.html'
            },
            {
                id: 'demo_composecolor_USA_counties_albers',
                title: 'USA Counties Albers',
                description: 'USA counties with Albers projection',
                url: './maps/demo_composecolor_USA_counties_albers.html'
            },
            {
                id: 'index_embed_terremoti_ultima_settimana',
                title: 'Terremoti Ultima Settimana',
                description: 'Recent earthquakes visualization',
                url: './maps/index_embed_terremoti_ultima_settimana.html'
            },
            {
                id: 'minimal_map_EU_fullscreen_lambert',
                title: 'minimal_map_EU_fullscreen_lambert',
                description: 'minimal_map_EU_fullscreen_lambert',
                url: './maps/minimal_map_EU_fullscreen_lambert.html'
            },
            {
                id: 'palestine',
                title: 'palestine',
                description: 'palestine',
                url: './maps/palestine.html'
            },
            {
                type: 'separator'
            }
        ];

        // Map selector overlay state
        let isMapSelectorOpen = false;
        let lastFocusedElement = null;

        // Map selector overlay functions
        function renderMapOptions() {
            const grid = document.getElementById('mapSelectorGrid');
            if (!grid) return;

            grid.innerHTML = '';

            AVAILABLE_MAPS.forEach((item) => {
                // Handle separator
                if (item.type === 'separator') {
                    const separator = document.createElement('hr');
                    separator.className = 'map-selector-separator';
                    grid.appendChild(separator);
                    return;
                }

                // Handle chapter/heading
                if (item.type === 'chapter') {
                    const chapter = document.createElement('div');
                    chapter.className = 'map-selector-chapter';
                    const title = document.createElement('h2');
                    title.className = 'map-selector-chapter-title';
                    title.textContent = item.title || item.text || '';
                    chapter.appendChild(title);
                    grid.appendChild(chapter);
                    return;
                }

                // Handle regular map card
                const card = document.createElement('button');
                card.className = 'map-selector-card';
                card.type = 'button';
                card.setAttribute('data-url', item.url);
                card.setAttribute('aria-label', `${item.title}: ${item.description}`);

                const preview = document.createElement('div');
                preview.className = 'map-selector-card__preview';
                
                // Create thumbnail URL (same path as map URL but with .png extension)
                const thumbnailUrl = item.url.replace(/\.html$/i, '.png');
                
                // Set initial gradient background (fallback if thumbnail doesn't load)
                preview.style.background = 'linear-gradient(135deg, rgba(0, 123, 255, 0.6), rgba(40, 167, 69, 0.6))';
                
                // Create img element for thumbnail
                const thumbnailImg = document.createElement('img');
                thumbnailImg.src = thumbnailUrl;
                thumbnailImg.alt = `${item.title} thumbnail`;
                
                // Fallback to gradient if image fails to load
                thumbnailImg.onerror = () => {
                    thumbnailImg.style.display = 'none';
                    preview.style.background = 'linear-gradient(135deg, rgba(0, 123, 255, 0.6), rgba(40, 167, 69, 0.6))';
                };
                
                // Hide gradient and show image if it loads successfully
                thumbnailImg.onload = () => {
                    preview.style.background = 'none';
                };
                
                preview.appendChild(thumbnailImg);

                const body = document.createElement('div');
                body.className = 'map-selector-card__body';

                const title = document.createElement('h3');
                title.className = 'map-selector-card__title';
                title.textContent = item.title;

                const description = document.createElement('p');
                description.className = 'map-selector-card__description';
                description.textContent = item.description;

                body.appendChild(title);
                body.appendChild(description);

                card.appendChild(preview);
                card.appendChild(body);

                card.addEventListener('click', () => handleMapSelection(item.url));
                grid.appendChild(card);
            });

            // Add "Load from file" option
            const fileCard = document.createElement('button');
            fileCard.className = 'map-selector-card';
            fileCard.type = 'button';
            fileCard.setAttribute('aria-label', 'Load map from file');

            const filePreview = document.createElement('div');
            filePreview.className = 'map-selector-card__preview';
            filePreview.style.background = 'linear-gradient(135deg, rgba(156, 163, 175, 0.6), rgba(107, 114, 128, 0.6))';
            filePreview.style.display = 'flex';
            filePreview.style.alignItems = 'center';
            filePreview.style.justifyContent = 'center';
            filePreview.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>';

            const fileBody = document.createElement('div');
            fileBody.className = 'map-selector-card__body';

            const fileTitle = document.createElement('h3');
            fileTitle.className = 'map-selector-card__title';
            fileTitle.textContent = 'Load from File';

            const fileDescription = document.createElement('p');
            fileDescription.className = 'map-selector-card__description';
            fileDescription.textContent = 'Choose an HTML or JSON file from your computer';

            fileBody.appendChild(fileTitle);
            fileBody.appendChild(fileDescription);

            fileCard.appendChild(filePreview);
            fileCard.appendChild(fileBody);

            fileCard.addEventListener('click', () => {
                closeMapSelector();
                const mapFileInput = document.getElementById('mapFileInput');
                if (mapFileInput) {
                    mapFileInput.click();
                }
            });
            grid.appendChild(fileCard);
        }

        function openMapSelector() {
            const overlay = document.getElementById('mapSelectorOverlay');
            const toggle = document.getElementById('loadMapButton');
            if (!overlay || isMapSelectorOpen) return;

            lastFocusedElement = document.activeElement;
            requestAnimationFrame(() => {
                overlay.classList.add('open');
                overlay.setAttribute('aria-hidden', 'false');
                if (toggle) toggle.setAttribute('aria-expanded', 'true');
                isMapSelectorOpen = true;

                const closeBtn = document.getElementById('mapSelectorClose');
                if (closeBtn) {
                    requestAnimationFrame(() => closeBtn.focus());
                }
            });
        }

        function closeMapSelector() {
            const overlay = document.getElementById('mapSelectorOverlay');
            const toggle = document.getElementById('loadMapButton');
            if (!overlay || !isMapSelectorOpen) return;

            overlay.classList.remove('open');
            overlay.setAttribute('aria-hidden', 'true');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
            isMapSelectorOpen = false;

            if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
                lastFocusedElement.focus();
            }
        }

        async function handleMapSelection(url) {
            closeMapSelector();
            await handleLoadMapFromHTML(url);
        }

        // Initialize map selector
        function initializeMapSelector() {
            renderMapOptions();

            const closeBtn = document.getElementById('mapSelectorClose');
            const overlay = document.getElementById('mapSelectorOverlay');

            if (closeBtn) {
                closeBtn.addEventListener('click', closeMapSelector);
            }

            if (overlay) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        closeMapSelector();
                    }
                });
            }

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && isMapSelectorOpen) {
                    closeMapSelector();
                }
            });
        }

        // Load map from file
        const mapFileInput = document.getElementById('mapFileInput');
        const loadMapButton = document.getElementById('loadMapButton');
        const sidebarLoadMapButton = document.getElementById('sidebarLoadMapButton');

        if (loadMapButton && mapFileInput) {
            // Initialize map selector on page load
            initializeMapSelector();

            loadMapButton.addEventListener('click', () => {
                openMapSelector();
            });
        }

        // Sidebar load map button
        if (sidebarLoadMapButton) {
            sidebarLoadMapButton.addEventListener('click', () => {
                openMapSelector();
            });
        }

        if (mapFileInput) {
            mapFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const isJSON = file.name.toLowerCase().endsWith('.json');
                    const fileType = isJSON ? 'JSON' : 'HTML';
                    addMessage(`🔄 Loading map from ${fileType} file: ${file.name}`, false);
                    addLoadingMessage();

                    try {
                        const result = await loadMapFromFile(file);

                        removeLoadingMessage();

                        if (result.success) {
                            const config = result.config;
                            let message = `✅ **Map loaded successfully from ${fileType} file!**\n\n`;
                            message += `**Map Configuration:**\n`;
                            
                            if (isJSON) {
                                // For JSON files, show project structure
                                message += `- Layers: ${result.layersAdded || 0}\n`;
                                message += `- Themes: ${result.themesAdded || 0}\n`;
                                if (config.embed && config.embed.mapService) {
                                    message += `- Map Service: ${config.embed.mapService}\n`;
                                }
                                if (config.embed && config.embed.mapType) {
                                    message += `- Map Type: ${config.embed.mapType}\n`;
                                }
                            } else {
                                // For HTML files, show extracted configuration
                                if (config.embed && config.embed.mapService) {
                                    message += `- Map Service: ${config.embed.mapService}\n`;
                                }
                                if (config.embed && config.embed.mapType) {
                                    message += `- Map Type: ${config.embed.mapType}\n`;
                                }
                                if (config.embed && config.embed.mapProjection) {
                                    message += `- Map Projection: ${config.embed.mapProjection}\n`;
                                }
                                if (result.layersAdded > 0 || config.layers.length > 0) {
                                    message += `- Geometric Layers: ${result.layersAdded || 0} added (${config.layers.length} found)\n`;
                                }
                                message += `- Theme Layers: ${result.themesAdded || 0} added (${config.themes.length} found)\n`;
                            }

                            // Show details about extracted layers
                            if (config.layers.length > 0) {
                                message += `\n**Extracted Layers:**\n`;
                                config.layers.forEach((layer, idx) => {
                                    message += `${idx + 1}. **${layer.name}**\n`;
                                    if (layer.data) {
                                        if (layer.data.url) {
                                            message += `   - Data URL: ${layer.data.url}\n`;
                                        }
                                        if (layer.data.type) {
                                            message += `   - Data Type: ${layer.data.type}\n`;
                                        }
                                        if (layer.data.name) {
                                            message += `   - Data Name: ${layer.data.name}\n`;
                                        }
                                    }
                                    if (layer.type) {
                                        message += `   - Type: ${layer.type}\n`;
                                    }
                                    if (layer.filter) {
                                        message += `   - Filter: ${layer.filter}\n`;
                                    }
                                    if (layer.binding) {
                                        const bindingKeys = Object.keys(layer.binding);
                                        if (bindingKeys.length > 0) {
                                            message += `   - Binding: ${bindingKeys.map(k => `${k}: ${layer.binding[k]}`).join(', ')}\n`;
                                        }
                                    } else {
                                        message += `   - Binding: none (geometric layer)\n`;
                                    }
                                    if (layer.style) {
                                        const styleKeys = Object.keys(layer.style);
                                        if (styleKeys.length > 0) {
                                            message += `   - Style properties: ${styleKeys.slice(0, 3).join(', ')}${styleKeys.length > 3 ? '...' : ''}\n`;
                                        }
                                    }
                                });
                            }

                            if (config.view) {
                                const center = config.view.center || {};
                                message += `\n- View: zoom ${config.view.zoom || 'N/A'}, center (${center.lat || 'N/A'}, ${center.lng || 'N/A'})\n`;
                            }

                            if (config.options) {
                                message += `- Options: applied\n`;
                            }

                            if (result.layersAdded === 0 && result.themesAdded === 0) {
                                message += `\n⚠️ **Note:** No layers were added. The map configuration was found but may need manual adjustment. Check the browser console for details.`;
                            }

                            // Tell user they can ask about the data and show code
                            message += `\n\n💡 **Tip:** You can view the project code by saying "show project code" or "show code". You can also ask me about the data, themes, or map configuration. For example: "show available themes" or "what data is available?".`;

                            addMessage(message, false);
                        } else {
                            addMessage(`❌ **Error loading map:** ${result.error}`, false);
                        }
                    } catch (error) {
                        removeLoadingMessage();
                        addMessage(`❌ **Error:** ${error.message}`, false);
                    }

                    // Reset input
                    mapFileInput.value = '';
                }
            });
        }

        // Load data from file
        const dataFileInput = document.getElementById('dataFileInput');
        const sidebarLoadDataButton = document.getElementById('sidebarLoadDataButton');
        
        if (dataFileInput) {
            dataFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        await loadDataFromFile(file);
                    } catch (error) {
                        // Error already handled in loadDataFromFile
                    }
                    // Reset file input so same file can be selected again
                    dataFileInput.value = '';
                }
            });
        }

        // Sidebar load data button
        if (sidebarLoadDataButton && dataFileInput) {
            sidebarLoadDataButton.addEventListener('click', () => {
                dataFileInput.click();
            });
        }

        // Function to open settings panel
        function openSettings() {
            const panel = document.getElementById('settingsPanel');
            const toggle = document.getElementById('settingsToggle');
            if (panel && toggle) {
                // Calculate position relative to the settings button
                const rect = toggle.getBoundingClientRect();
                panel.style.top = (rect.bottom + 8) + 'px';
                panel.style.right = (window.innerWidth - rect.right) + 'px';
                panel.classList.add('active');
            }
        }
        
        // Make openSettings available globally for onclick handlers
        window.openSettings = openSettings;
        
        document.getElementById('settingsToggle').addEventListener('click', (e) => {
            e.stopPropagation();
            const panel = document.getElementById('settingsPanel');
            const toggle = document.getElementById('settingsToggle');
            
            // Calculate position relative to the settings button
            if (toggle) {
                const rect = toggle.getBoundingClientRect();
                panel.style.top = (rect.bottom + 8) + 'px';
                panel.style.right = (window.innerWidth - rect.right) + 'px';
            }
            
            panel.classList.toggle('active');
        });
        
        // Handle clicks on "open settings" links (using event delegation)
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.open-settings-link');
            if (link) {
                e.preventDefault();
                e.stopPropagation();
                openSettings();
                return false;
            }
        });

        // Close settings when clicking outside
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('settingsPanel');
            const toggle = document.getElementById('settingsToggle');
            if (!panel.contains(e.target) && !toggle.contains(e.target)) {
                panel.classList.remove('active');
            }
        });

        // Chat input handlers
        document.getElementById('sendButton').addEventListener('click', handleChatMessage);
        
        const chatInput = document.getElementById('chatInput');
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleChatMessage();
            }
        });
        
        // Arrow key navigation for prompt history
        chatInput.addEventListener('keydown', (e) => {
            // Only handle arrow keys when input is not empty or when navigating history
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                
                // If we're at the end of history (current input), save current value
                if (promptHistoryIndex === -1) {
                    tempInputValue = chatInput.value;
                }
                
                // Move to previous item in history
                if (userPromptHistory.length > 0) {
                    if (promptHistoryIndex > 0) {
                        promptHistoryIndex--;
                    } else if (promptHistoryIndex === -1) {
                        // Start from the last item
                        promptHistoryIndex = userPromptHistory.length - 1;
                    }
                    
                    chatInput.value = userPromptHistory[promptHistoryIndex];
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                
                // Move to next item in history (toward current input)
                if (promptHistoryIndex >= 0) {
                    promptHistoryIndex++;
                    
                    if (promptHistoryIndex >= userPromptHistory.length) {
                        // Reached the end, restore current input
                        promptHistoryIndex = -1;
                        chatInput.value = tempInputValue;
                        tempInputValue = '';
                    } else {
                        chatInput.value = userPromptHistory[promptHistoryIndex];
                    }
                }
            }
        });

        // Reset filter button
        const resetFilterButton = document.getElementById('resetFilterButton');
        resetFilterButton.addEventListener('click', () => {
            if (ixmaps && ixmaps.aiQuery && ixmaps.aiQuery.resetFilter) {
                const reset = ixmaps.aiQuery.resetFilter();
                if (reset) {
                    addMessage('Filter reset successfully', false);
                    resetFilterButton.disabled = true;
                } else {
                    addMessage('No active filter to reset', false);
                }
            }
        });

        // Periodically check reset button state
        setInterval(updateResetButtonState, 500);
        
        // ============================================
        // BASEMAP SELECTION FUNCTIONS
        // ============================================
        
        // Available maptypes with descriptions
        // Vector Tiles (VT_*)
        const vectorTileTypes = [
            { id: 'VT_OPENSTREETMAP', name: 'OpenStreetMap', description: 'Standard OpenStreetMap style', type: 'vector' },
            { id: 'VT_TONER', name: 'Toner', description: 'High contrast black and white style', type: 'vector' },
            { id: 'VT_TONER_LITE', name: 'Toner Lite', description: 'Light version of toner style', type: 'vector' },
            { id: 'VT_DATAVIZ', name: 'DataViz', description: 'Optimized for data visualization', type: 'vector' },
            { id: 'VT_DATAVIZ_LIGHT', name: 'DataViz Light', description: 'Light version for data visualization', type: 'vector' },
            { id: 'VT_DATAVIZ_DARK', name: 'DataViz Dark', description: 'Dark version for data visualization', type: 'vector' },
            { id: 'VT_BACKDROP', name: 'Backdrop', description: 'Subtle background style', type: 'vector' },
            { id: 'VT_BACKDROP_LIGHT', name: 'Backdrop Light', description: 'Light backdrop style', type: 'vector' },
            { id: 'VT_BASIC', name: 'Basic', description: 'Simple basic style', type: 'vector' },
            { id: 'VT_BASIC_LIGHT', name: 'Basic Light', description: 'Light basic style', type: 'vector' },
            { id: 'VT_BRIGHT', name: 'Bright', description: 'Bright colorful style', type: 'vector' },
            { id: 'VT_BRIGHT_LIGHT', name: 'Bright Light', description: 'Light bright style', type: 'vector' },
            { id: 'VT_VOYAGER', name: 'Voyager', description: 'Voyager style with labels', type: 'vector' },
            { id: 'VT_VOYAGER_LIGHT', name: 'Voyager Light', description: 'Light voyager style', type: 'vector' },
            { id: 'VT_TOPO', name: 'Topo', description: 'Topographic style', type: 'vector' },
            { id: 'VT_TOPO_SHINY', name: 'Topo Shiny', description: 'Shiny topographic style', type: 'vector' },
            { id: 'VT_TOPO_TOPOGRAPHIQUE', name: 'Topo Topographique', description: 'French topographic style', type: 'vector' }
        ];
        
        // Image Tiles
        const imageTileTypes = [
            // OpenStreetMap variants
            { id: 'OpenStreetMap - Osmarenderer', name: 'OpenStreetMap', description: 'Standard OpenStreetMap tiles', type: 'image' },
            { id: 'OpenStreetMap - wikipedia', name: 'OpenStreetMap Wikipedia', description: 'Wikipedia style OpenStreetMap', type: 'image' },
            //{ id: 'OpenStreetMap - gray', name: 'OpenStreetMap Gray', description: 'Gray style OpenStreetMap', type: 'image' },
            //{ id: 'OpenStreetMap - roads', name: 'OpenStreetMap Roads', description: 'Roads only OpenStreetMap', type: 'image' },
            //{ id: 'OpenStreetMap - admin', name: 'OpenStreetMap Admin', description: 'Administrative boundaries', type: 'image' },
            //{ id: 'OpenStreetMap - admin - dark', name: 'OpenStreetMap Admin Dark', description: 'Dark administrative boundaries', type: 'image' },
            { id: 'OpenStreetMap - FR', name: 'OpenStreetMap FR', description: 'French OpenStreetMap style', type: 'image' },
            //{ id: 'OpenStreetMap - Transport', name: 'OpenStreetMap Transport', description: 'Transport focused OpenStreetMap', type: 'image' },
            
            // Stamen
            { id: 'Stamen - toner', name: 'Stamen Toner', description: 'High contrast black and white', type: 'image' },
            { id: 'Stamen - toner-lite', name: 'Stamen Toner Lite', description: 'Light toner style', type: 'image' },
            //{ id: 'Stamen - toner-hybrid', name: 'Stamen Toner Hybrid', description: 'Toner with satellite imagery', type: 'image' },
            { id: 'Stamen - watercolor', name: 'Stamen Watercolor', description: 'Artistic watercolor style', type: 'image' },
            { id: 'Stamen - terrain', name: 'Stamen Terrain', description: 'Terrain style with elevation', type: 'image' },
            
            // ArcGIS
            { id: 'ArcGIS - Topo', name: 'ArcGIS Topo', description: 'Topographic map from ArcGIS', type: 'image' },
            { id: 'ArcGIS - Light Gray Base', name: 'ArcGIS Light Gray', description: 'Light gray base map', type: 'image' },
            //{ id: 'ArcGIS - Ocean Basemap', name: 'ArcGIS Ocean', description: 'Ocean focused basemap', type: 'image' },
            { id: 'ArcGIS - Hillshade', name: 'ArcGIS Hillshade', description: 'Hillshade elevation map', type: 'image' },
            
            // CartoDB
            { id: 'CartoDB - Positron', name: 'CartoDB Positron', description: 'Light minimal style', type: 'image' },
            { id: 'CartoDB - Dark matter', name: 'CartoDB Dark Matter', description: 'Dark minimal style', type: 'image' },
            
            // MapTiler
            { id: 'MapTiler - Positron', name: 'MapTiler Positron', description: 'Light style from MapTiler', type: 'image' },
            { id: 'MapTiler - Dark Matter', name: 'MapTiler Dark Matter', description: 'Dark style from MapTiler', type: 'image' },
            
            // Nokia/HERE
            //{ id: 'NOKIA', name: 'Nokia/HERE', description: 'Nokia HERE maps', type: 'image' },
            //{ id: 'NOKIA OVI - transit', name: 'Nokia Transit', description: 'Transit focused Nokia maps', type: 'image' },
            //{ id: 'NOKIA - satellite', name: 'Nokia Satellite', description: 'Satellite imagery from Nokia', type: 'image' },
            //{ id: 'NOKIA - terrain', name: 'Nokia Terrain', description: 'Terrain style from Nokia', type: 'image' },
            
            // Other
            { id: 'WAZE', name: 'Waze', description: 'Waze map tiles', type: 'image' },
            //{ id: 'MapBox - OSM', name: 'MapBox OSM', description: 'MapBox OpenStreetMap style', type: 'image' },
            //{ id: 'MapQuest - OSM (EU)', name: 'MapQuest OSM', description: 'MapQuest OpenStreetMap', type: 'image' },
            { id: 'OpenTopoMap', name: 'OpenTopoMap', description: 'Open source topographic map', type: 'image' },
            //{ id: 'OpenPtMap', name: 'OpenPtMap', description: 'Public transport map', type: 'image' },
            //{ id: 'Openpistemap landschaded', name: 'OpenPisteMap', description: 'Ski resort map', type: 'image' },
            //{ id: 'RaceDotMap', name: 'Race Dot Map', description: 'Demographic dot map', type: 'image' },
            
            // Solid colors
            { id: 'Black', name: 'Black', description: 'Solid black background', type: 'image' },
            { id: 'White', name: 'White', description: 'Solid white background', type: 'image' },
            { id: 'Gray', name: 'Gray', description: 'Solid gray background', type: 'image' },
            { id: 'transparent', name: 'Transparent', description: 'Transparent background', type: 'image' }
        ];
        
        // Combined list
        const availableMapTypes = [...vectorTileTypes, ...imageTileTypes];
        
        /**
         * Get available maptypes
         */
        function getAvailableMapTypes() {
            return availableMapTypes;
        }
        
        /**
         * Find maptype by name or ID (fuzzy matching)
         */
        function findMapType(searchTerm) {
            const term = searchTerm.toLowerCase().trim();
            
            // Exact match first
            let match = availableMapTypes.find(mt => 
                mt.id.toLowerCase() === term || 
                mt.name.toLowerCase() === term
            );
            
            if (match) return match;
            
            // Partial match on name
            match = availableMapTypes.find(mt => 
                mt.name.toLowerCase().includes(term) ||
                mt.id.toLowerCase().includes(term.replace(/vt_/i, ''))
            );
            
            if (match) return match;
            
            // Remove common prefixes and try again
            const cleanTerm = term.replace(/^(vt_|vector\s*tile|map\s*type)/i, '').trim();
            match = availableMapTypes.find(mt => 
                mt.name.toLowerCase().includes(cleanTerm) ||
                mt.id.toLowerCase().replace(/^vt_/i, '').includes(cleanTerm)
            );
            
            return match || null;
        }
        
        /**
         * Change basemap/maptype
         * @param {string} mapTypeName - Name or ID of the map type
         * @param {boolean} silent - If true, suppress success message (errors still shown)
         */
        async function changeBasemap(mapTypeName, silent = false) {
            const mapType = findMapType(mapTypeName);
            
            if (!mapType) {
                addMessage(`❌ **Map type not found:** "${mapTypeName}"\n\n💡 **Tip:** Try "show basemaps" to see available options.`, false);
                return;
            }
            
            try {
                if (!mapInstance) {
                    throw new Error('Map not initialized');
                }
                
                // Change the basemap using setMapTypeId
                // Try multiple methods to ensure compatibility
                let changed = false;
                
                if (mapInstance.setMapTypeId) {
                    mapInstance.setMapTypeId(mapType.id);
                    changed = true;
                } else if (mapInstance.setMapType) {
                    mapInstance.setMapType(mapType.id);
                    changed = true;
                } else if (ixmaps && ixmaps.setMapTypeId) {
                    ixmaps.setMapTypeId(mapType.id);
                    changed = true;
                } else if (ixmaps && ixmaps.setMapType) {
                    ixmaps.setMapType(mapType.id);
                    changed = true;
                } else if (ixmaps && ixmaps.htmlMap_setMapTypeId) {
                    ixmaps.htmlMap_setMapTypeId(mapType.id);
                    changed = true;
                } else if (ixmaps && ixmaps.embeddedSVG && ixmaps.embeddedSVG.window && ixmaps.embeddedSVG.window.map && ixmaps.embeddedSVG.window.map.Api) {
                    // Try through the SVG map API
                    if (ixmaps.embeddedSVG.window.map.Api.setMapTypeId) {
                        ixmaps.embeddedSVG.window.map.Api.setMapTypeId(mapType.id);
                        changed = true;
                    }
                }
                
                if (!changed) {
                    throw new Error('Cannot change basemap: setMapTypeId method not available');
                }
                
                if (!silent) {
                    addMessage(`✅ **Basemap changed to:** ${mapType.name}\n\n${mapType.description}`, false);
                }
            } catch (error) {
                console.error('Error changing basemap:', error);
                addMessage(`❌ **Error changing basemap:** ${error.message}`, false);
            }
        }
        
        /**
         * Set basemap opacity (0.0 to 1.0)
         * Uses api.setHTMLMapOpacity() method as shown in popuptools_line_v2.html
         * @param {number|string} opacity - Opacity value between 0.0 and 1.0
         * @param {boolean} silent - If true, suppress success message (errors still shown)
         */
        async function setBasemapOpacity(opacity, silent = false) {
            try {
                // Validate opacity value
                const opacityNum = parseFloat(opacity);
                if (isNaN(opacityNum) || opacityNum < 0 || opacityNum > 1) {
                    throw new Error('Opacity must be a number between 0.0 and 1.0');
                }
                
                if (!mapInstance) {
                    throw new Error('Map not initialized');
                }
                
                // Try to set opacity using api.setHTMLMapOpacity() method
                // This is the same method used in popuptools_line_v2.html (line 435-441)
                let changed = false;
                
                // Try through mapInstance API
                if (mapInstance.Api && mapInstance.Api.setHTMLMapOpacity) {
                    // For absolute value, we need to get current opacity first
                    // Since we don't have getHTMLMapOpacity, try setting absolute value directly
                    // If that doesn't work, we'll use relative adjustments
                    try {
                        // Try absolute mode if available
                        mapInstance.Api.setHTMLMapOpacity(opacityNum, 'absolute');
                        changed = true;
                    } catch (e) {
                        // Fallback: reset to 0 then add desired value
                        mapInstance.Api.setHTMLMapOpacity(-1, 'relative'); // Reset to 0
                        mapInstance.Api.setHTMLMapOpacity(opacityNum, 'relative'); // Set to desired value
                        changed = true;
                    }
                } else if (mapInstance.setHTMLMapOpacity) {
                    try {
                        mapInstance.setHTMLMapOpacity(opacityNum, 'absolute');
                        changed = true;
                    } catch (e) {
                        mapInstance.setHTMLMapOpacity(-1, 'relative');
                        mapInstance.setHTMLMapOpacity(opacityNum, 'relative');
                        changed = true;
                    }
                } else if (ixmaps && ixmaps.setHTMLMapOpacity) {
                    try {
                        ixmaps.setHTMLMapOpacity(opacityNum, 'absolute');
                        changed = true;
                    } catch (e) {
                        ixmaps.setHTMLMapOpacity(-1, 'relative');
                        ixmaps.setHTMLMapOpacity(opacityNum, 'relative');
                        changed = true;
                    }
                } else if (ixmaps && ixmaps.embeddedSVG && ixmaps.embeddedSVG.window && ixmaps.embeddedSVG.window.map) {
                    const map = ixmaps.embeddedSVG.window.map;
                    if (map.Api && map.Api.setHTMLMapOpacity) {
                        try {
                            map.Api.setHTMLMapOpacity(opacityNum, 'absolute');
                            changed = true;
                        } catch (e) {
                            map.Api.setHTMLMapOpacity(-1, 'relative');
                            map.Api.setHTMLMapOpacity(opacityNum, 'relative');
                            changed = true;
                        }
                    } else if (map.setHTMLMapOpacity) {
                        try {
                            map.setHTMLMapOpacity(opacityNum, 'absolute');
                            changed = true;
                        } catch (e) {
                            map.setHTMLMapOpacity(-1, 'relative');
                            map.setHTMLMapOpacity(opacityNum, 'relative');
                            changed = true;
                        }
                    }
                }
                
                if (!changed) {
                    throw new Error('Cannot set basemap opacity: setHTMLMapOpacity method not available');
                }
                
                if (!silent) {
                    addMessage(`✅ **Basemap opacity set to:** ${opacityNum.toFixed(2)}`, false);
                }
            } catch (error) {
                console.error('Error setting basemap opacity:', error);
                addMessage(`❌ **Error setting basemap opacity:** ${error.message}`, false);
            }
        }
        
        /**
         * Get thumbnail path for a map type
         */
        function getBasemapThumbnail(mapType) {
            const basePath = 'basemap_screenshots/';
            let filename = '';
            
            // Vector tiles
            if (mapType.type === 'vector') {
                const id = mapType.id.toLowerCase();
                if (id === 'vt_openstreetmap') filename = 'openstreetmap.png';
                else if (id === 'vt_toner') filename = 'toner.png';
                else if (id === 'vt_toner_lite') filename = 'toner_lite.png';
                else if (id === 'vt_dataviz') filename = 'dataviz.png';
                else if (id === 'vt_dataviz_light') filename = 'dataviz_light.png';
                else if (id === 'vt_dataviz_dark') filename = 'dataviz_dark.png';
                else if (id === 'vt_backdrop') filename = 'backdrop.png';
                else if (id === 'vt_backdrop_light') filename = 'backdrop_light.png';
                else if (id === 'vt_basic') filename = 'basic.png';
                else if (id === 'vt_basic_light') filename = 'basic_light.png';
                else if (id === 'vt_bright') filename = 'bright.png';
                else if (id === 'vt_bright_light') filename = 'bright_light.png';
                else if (id === 'vt_voyager') filename = 'voyager.png';
                else if (id === 'vt_voyager_light') filename = 'voyager_light.png';
                else if (id === 'vt_topo') filename = 'topo.png';
                else if (id === 'vt_topo_shiny') filename = 'topo_shiny.png';
                else if (id === 'vt_topo_topographique') filename = 'topo_topographique.png';
            } 
            // Image tiles
            else if (mapType.type === 'image') {
                const name = mapType.name.toLowerCase();
                const id = mapType.id.toLowerCase();
                
                // OpenStreetMap variants
                if (name.includes('openstreetmap')) {
                    if (name.includes('wikipedia')) filename = 'openstreetmap_wikipedia.png';
                    else if (name.includes('gray')) filename = 'openstreetmap_gray.png';
                    else if (name.includes('roads')) filename = 'openstreetmap_roads.png';
                    else if (name.includes('admin dark')) filename = 'openstreetmap_admin_dark.png';
                    else if (name.includes('admin')) filename = 'openstreetmap_admin.png';
                    else if (name.includes('fr')) filename = 'openstreetmap_fr.png';
                    else if (name.includes('transport')) filename = 'openstreetmap_transport.png';
                    else filename = 'openstreetmap.png';
                }
                // Stamen
                else if (name.includes('stamen')) {
                    if (name.includes('toner hybrid')) filename = 'stamen_toner_hybrid.png';
                    else if (name.includes('toner lite')) filename = 'stamen_toner_lite.png';
                    else if (name.includes('toner')) filename = 'stamen_toner.png';
                    else if (name.includes('watercolor')) filename = 'stamen_watercolor.png';
                    else if (name.includes('terrain')) filename = 'stamen_terrain.png';
                }
                // ArcGIS
                else if (name.includes('arcgis')) {
                    if (name.includes('topo')) filename = 'arcgis_topo.png';
                    else if (name.includes('light gray')) filename = 'arcgis_light_gray.png';
                    else if (name.includes('ocean')) filename = 'arcgis_ocean.png';
                    else if (name.includes('hillshade')) filename = 'arcgis_hillshade.png';
                }
                // CartoDB
                else if (name.includes('cartodb')) {
                    if (name.includes('dark matter')) filename = 'cartodb_dark_matter.png';
                    else if (name.includes('positron')) filename = 'cartodb_positron.png';
                }
                // MapTiler
                else if (name.includes('maptiler')) {
                    if (name.includes('dark matter')) filename = 'maptiler_dark_matter.png';
                    else if (name.includes('positron')) filename = 'maptiler_positron.png';
                }
                // Nokia
                else if (name.includes('nokia') || id.includes('nokia')) {
                    if (name.includes('satellite')) filename = 'nokia_satellite.png';
                    else if (name.includes('terrain')) filename = 'nokia_terrain.png';
                    else if (name.includes('transit')) filename = 'nokia_transit.png';
                    else filename = 'nokia_here.png';
                }
                // Solid colors
                else if (name === 'black') filename = 'black.png';
                else if (name === 'white') filename = 'white.png';
                else if (name === 'gray') filename = 'gray.png';
                else if (name === 'transparent') filename = 'transparent.png';
                // Other services
                else if (name.includes('waze')) filename = 'waze.png';
                else if (name.includes('mapbox')) filename = 'mapbox_osm.png';
                else if (name.includes('mapquest')) filename = 'mapquest_osm.png';
                else if (name.includes('opentopomap')) filename = 'opentopomap.png';
                else if (name.includes('openpistemap')) filename = 'openpistemap.png';
                else if (name.includes('race dot')) filename = 'race_dot_map.png';
            }
            
            return filename ? basePath + filename : null;
        }
        
        /**
         * Show basemap selector UI
         */
        function showBasemapSelector() {
            // Get current maptype
            let currentMapType = null;
            if (mapInstance && mapInstance.getMapTypeId) {
                currentMapType = mapInstance.getMapTypeId();
            } else if (ixmaps && ixmaps.getMapTypeId) {
                currentMapType = ixmaps.getMapTypeId();
            } else if (ixmaps && ixmaps.htmlMap_getMapTypeId) {
                currentMapType = ixmaps.htmlMap_getMapTypeId();
            } else if (ixmaps && ixmaps.embeddedSVG && ixmaps.embeddedSVG.window && ixmaps.embeddedSVG.window.map && ixmaps.embeddedSVG.window.map.Api && ixmaps.embeddedSVG.window.map.Api.getMapTypeId) {
                currentMapType = ixmaps.embeddedSVG.window.map.Api.getMapTypeId();
            }
            
            let message = `## Available Basemaps\n\n`;
            message += `Select a basemap to change the map style:\n\n`;
            
            // Vector Tiles section
            message += `### Vector Tiles\n\n`;
            const vectorTiles = availableMapTypes.filter(mt => mt.type === 'vector');
            const vectorCategories = {
                'Standard': ['VT_OPENSTREETMAP'],
                'Toner': ['VT_TONER', 'VT_TONER_LITE'],
                'Data Visualization': ['VT_DATAVIZ', 'VT_DATAVIZ_LIGHT', 'VT_DATAVIZ_DARK'],
                'Backdrop': ['VT_BACKDROP', 'VT_BACKDROP_LIGHT'],
                'Basic': ['VT_BASIC', 'VT_BASIC_LIGHT'],
                'Bright': ['VT_BRIGHT', 'VT_BRIGHT_LIGHT'],
                'Voyager': ['VT_VOYAGER', 'VT_VOYAGER_LIGHT'],
                'Topographic': ['VT_TOPO', 'VT_TOPO_SHINY', 'VT_TOPO_TOPOGRAPHIQUE']
            };
            
            for (const [category, typeIds] of Object.entries(vectorCategories)) {
                message += `#### ${category}\n\n`;
                typeIds.forEach(typeId => {
                    const mapType = vectorTiles.find(mt => mt.id === typeId);
                    if (mapType) {
                        const isCurrent = currentMapType === mapType.id;
                        const currentMark = isCurrent ? ' ✓ (current)' : '';
                        const thumbnail = getBasemapThumbnail(mapType);
                        message += `<div style="margin-bottom: 8px; margin-left: 20px; display: flex; align-items: flex-start; gap: 12px;">`;
                        if (thumbnail) {
                            message += `<div class="crop-container"><img src="${thumbnail}" alt="${mapType.name}" data-action="change-basemap" data-map-type="${mapType.name}" /></div>`;
                        }
                        message += `<div style="flex: 1;">`;
                        message += `<strong>${mapType.name}</strong>${currentMark} <button data-action="change-basemap" data-map-type="${mapType.name}" style="margin-left: 8px; padding: 4px 12px; background: #f5f5f5; color: #666; border: 0.5px solid #e0e0e0; border-radius: 12px; cursor: pointer; font-size: 12px;">Set as Basemap</button><br>`;
                        message += `<span style="color: #666; font-size: 0.9em;">${mapType.description}</span>`;
                        message += `</div></div>\n\n`;
                    }
                });
            }
            
            // Image Tiles section
            message += `### Image Tiles\n\n`;
            const imageTiles = availableMapTypes.filter(mt => mt.type === 'image');
            const imageCategories = {
                'OpenStreetMap': imageTiles.filter(mt => mt.name.includes('OpenStreetMap')),
                'Stamen': imageTiles.filter(mt => mt.name.includes('Stamen')),
                'ArcGIS': imageTiles.filter(mt => mt.name.includes('ArcGIS')),
                'CartoDB': imageTiles.filter(mt => mt.name.includes('CartoDB')),
                'MapTiler': imageTiles.filter(mt => mt.name.includes('MapTiler')),
                'Nokia/HERE': imageTiles.filter(mt => mt.name.includes('Nokia') || mt.name.includes('NOKIA')),
                'Other Services': imageTiles.filter(mt => 
                    !mt.name.includes('OpenStreetMap') && 
                    !mt.name.includes('Stamen') && 
                    !mt.name.includes('ArcGIS') && 
                    !mt.name.includes('CartoDB') && 
                    !mt.name.includes('MapTiler') && 
                    !mt.name.includes('Nokia') && 
                    !mt.name.includes('NOKIA') &&
                    !['Black', 'White', 'Gray', 'Transparent'].includes(mt.name)
                ),
                'Solid Colors': imageTiles.filter(mt => 
                    ['Black', 'White', 'Gray', 'Transparent'].includes(mt.name)
                )
            };
            
            for (const [category, tiles] of Object.entries(imageCategories)) {
                if (tiles.length > 0) {
                    message += `#### ${category}\n\n`;
                    tiles.forEach(mapType => {
                        const isCurrent = currentMapType === mapType.id;
                        const currentMark = isCurrent ? ' ✓ (current)' : '';
                        const thumbnail = getBasemapThumbnail(mapType);
                        message += `<div style="margin-bottom: 8px; margin-left: 20px; display: flex; align-items: flex-start; gap: 12px;">`;
                        if (thumbnail) {
                            message += `<div class="crop-container"><img src="${thumbnail}" alt="${mapType.name}" data-action="change-basemap" data-map-type="${mapType.name}" /></div>`;
                        }
                        message += `<div style="flex: 1;">`;
                        message += `<strong>${mapType.name}</strong>${currentMark} <button data-action="change-basemap" data-map-type="${mapType.name}" style="margin-left: 8px; padding: 4px 12px; background: #f5f5f5; color: #666; border: 0.5px solid #e0e0e0; border-radius: 12px; cursor: pointer; font-size: 12px;">Set as Basemap</button><br>`;
                        message += `<span style="color: #666; font-size: 0.9em;">${mapType.description}</span>`;
                        message += `</div></div>\n\n`;
                    });
                }
            }
            
            message += `\n💡 **Tip:** Say "set basemap to [name]" to change the basemap.`;
            
            addMessage(message, false);
        }
