/**
 * AI Agent Integration Prototype for ixmaps
 * 
 * This demonstrates how natural language queries could be integrated
 * with the existing ixmaps query system.
 * 
 * NOTE: This is a conceptual prototype. Actual implementation would require
 * integration with an LLM API (OpenAI, Anthropic, etc.)
 */

(function(ixmaps) {
    'use strict';

    // Ensure ixmaps exists (fallback to window.ixmaps or create it)
    if (!ixmaps) {
        ixmaps = window.ixmaps = window.ixmaps || {};
    }

    /**
     * AI Query Interface for ixmaps
     * Provides natural language query capabilities
     */
    ixmaps.aiQuery = {
        
        /**
         * Configuration for AI services
         * Set your Gemini API key here or via ixmaps.aiQuery.config.geminiApiKey
         */
        config: {
            geminiApiKey: null, // Set your API key here or via: ixmaps.aiQuery.config.geminiApiKey = 'YOUR_KEY'
            useGemini: false,   // Set to true to enable Gemini, false for simple parser
            geminiModel: null, // Auto-detect available model, or set manually: 'gemini-2.5-flash', 'gemini-2.5-pro', etc.
            fallbackToSimple: true // Fall back to simple parser if Gemini fails
        },
        
        /**
         * Track the currently filtered theme ID
         */
        currentFilteredTheme: null,
        
        /**
         * Process a natural language query
         * @param {String} query - Natural language question
         * @param {Object} options - Query options (theme, context, etc.)
         * @returns {Promise} Results with features and formatted response
         */
        ask: function(query, options) {
            options = options || {};
            
            return new Promise(async (resolve, reject) => {
                try {
                    // Step 0: Normalize layer queries to theme queries
                    // Treat "layer", "show layer", "show layer info" as "themes", "show themes", "show themes info"
                    let normalizedQuery = query;
                    
                    // Pattern 1: "show layer", "list layer", "display layer", etc. -> "show theme", "list theme", etc.
                    normalizedQuery = normalizedQuery.replace(/\b(show|list|display|view|what|which|available)\s+layer\b/gi, (match, verb) => {
                        return `${verb} theme`;
                    });
                    
                    // Pattern 2: "show layers", "list layers", etc. -> "show themes", "list themes", etc.
                    normalizedQuery = normalizedQuery.replace(/\b(show|list|display|view|what|which|available)\s+layers\b/gi, (match, verb) => {
                        return `${verb} themes`;
                    });
                    
                    // Pattern 3: "layer info", "layer information", "layer details" -> "theme info", etc.
                    normalizedQuery = normalizedQuery.replace(/\blayer\s+(info|information|details?)\b/gi, (match, detailType) => {
                        return `theme ${detailType}`;
                    });
                    
                    // Pattern 4: "layers info", "layers information", etc. -> "themes info", etc.
                    normalizedQuery = normalizedQuery.replace(/\blayers\s+(info|information|details?)\b/gi, (match, detailType) => {
                        return `themes ${detailType}`;
                    });
                    
                    // Pattern 5: Just "layer" or "layers" by itself -> "themes"
                    normalizedQuery = normalizedQuery.replace(/^layer$/i, 'themes');
                    normalizedQuery = normalizedQuery.replace(/^layers$/i, 'themes');
                    
                    // Pattern 6: "show layer info", "show layer information" -> "show theme info", etc.
                    normalizedQuery = normalizedQuery.replace(/\b(show|list|display|view)\s+layer\s+(info|information|details?)\b/gi, (match, verb, detailType) => {
                        return `${verb} theme ${detailType}`;
                    });
                    
                    // Only update query if it was actually changed
                    if (normalizedQuery !== query) {
                        console.log(`🔄 Normalized layer query: "${query}" → "${normalizedQuery}"`);
                        query = normalizedQuery;
                    }
                    
                    // Step 0.5: Resolve theme identifiers (theme0, theme1, theme IDs, layer names) in query
                    const map = this.getMap();
                    if (map && map.Api) {
                        try {
                            let allThemes = [];
                            if (map.Themes && map.Themes.getThemes) {
                                allThemes = map.Themes.getThemes();
                            } else if (map.Api && map.Api.getAllThemes) {
                                allThemes = map.Api.getAllThemes();
                            }
                            
                            if (allThemes.length > 0) {
                                // Build theme mapping: index -> themeId, themeId -> themeId, layerName -> themeId
                                const themeMap = new Map();
                                const layerMap = new Map();
                                
                                for (let i = 0; i < allThemes.length; i++) {
                                    const theme = allThemes[i];
                                    const themeId = theme.szId || theme.id || theme.name || '';
                                    if (themeId) {
                                        // Map 1-based index to themeId (theme1, theme2, etc. - user-facing)
                                        const themeNumber = i + 1;
                                        themeMap.set(`theme${themeNumber}`, themeId);
                                        themeMap.set(`theme ${themeNumber}`, themeId);
                                        // Also support 0-based for backward compatibility (only theme0, not theme1+ to avoid conflicts)
                                        if (i === 0) {
                                            themeMap.set(`theme${i}`, themeId);
                                            themeMap.set(`theme ${i}`, themeId);
                                        }
                                        // Map themeId to itself
                                        themeMap.set(themeId, themeId);
                                        
                                        // Get layer name and map it
                                        try {
                                            const themeDef = map.Api.getMapThemeDefinitionObj(themeId);
                                            const layerName = themeDef?.layer || '';
                                            if (layerName) {
                                                layerMap.set(layerName.toLowerCase(), themeId);
                                            }
                                        } catch (e1) {
                                            try {
                                                const themeObj = map.Api.getTheme(themeId);
                                                const layerName = themeObj?.theme?.szLayer || themeObj?.szLayer || 
                                                                  themeObj?.theme?.layer || themeObj?.layer || '';
                                                if (layerName) {
                                                    layerMap.set(String(layerName).toLowerCase(), themeId);
                                                }
                                            } catch (e2) {
                                                // Ignore
                                            }
                                        }
                                    }
                                }
                                
                                // Replace theme identifiers in query
                                let resolvedQuery = query;
                                
                                // Replace theme1, theme2, theme3, etc. (with or without space) - 1-based indexing
                                // Also supports 0-based for backward compatibility
                                resolvedQuery = resolvedQuery.replace(/\btheme\s*(\d+)\b/gi, (match, indexStr) => {
                                    const themeId = themeMap.get(`theme${indexStr}`);
                                    if (themeId) {
                                        console.log(`🔄 Resolved theme identifier: "${match}" → "${themeId}"`);
                                        return themeId;
                                    }
                                    return match;
                                });
                                
                                // Replace layer names (case-insensitive, whole word)
                                // Replace when layer name appears as a standalone word (not part of another word)
                                for (const [layerName, themeId] of layerMap.entries()) {
                                    // Escape special regex characters in layer name
                                    const escapedLayerName = layerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                    // Match whole word (word boundaries) - case insensitive
                                    const layerPattern = new RegExp(`\\b${escapedLayerName}\\b`, 'gi');
                                    
                                    // Only replace if:
                                    // 1. The layer name is not already a theme ID
                                    // 2. The match is not part of a quoted string (to avoid replacing in field names)
                                    if (layerPattern.test(resolvedQuery) && !themeMap.has(layerName)) {
                                        resolvedQuery = resolvedQuery.replace(layerPattern, (match, offset, string) => {
                                            // Check if we're inside quotes (simple check)
                                            const beforeMatch = string.substring(0, offset);
                                            const afterMatch = string.substring(offset + match.length);
                                            const quotesBefore = (beforeMatch.match(/['"]/g) || []).length;
                                            const quotesAfter = (afterMatch.match(/['"]/g) || []).length;
                                            
                                            // Only replace if not inside quotes (even number of quotes before means we're outside)
                                            if (quotesBefore % 2 === 0) {
                                                console.log(`🔄 Resolved layer name: "${match}" → "${themeId}"`);
                                                return themeId;
                                            }
                                            return match;
                                        });
                                    }
                                }
                                
                                if (resolvedQuery !== query) {
                                    console.log(`🔄 Resolved theme identifiers: "${query}" → "${resolvedQuery}"`);
                                    query = resolvedQuery;
                                }
                            }
                        } catch (e) {
                            console.warn('Could not resolve theme identifiers:', e);
                        }
                    }
                    
                    // Step 1: Get available schema
                    const schemas = this.getAvailableSchemas(options.theme);
                    
                    // Step 1.5: Check for quick action queries (edit theme, show data of theme) BEFORE parsing
                    // These need to be checked before parsing to avoid being treated as filter queries
                    const queryLower = query.toLowerCase();
                    
                    // Handle "edit theme X" queries (must have a theme identifier, not just "edit theme")
                    // Pattern matches: "edit theme 1", "edit theme1", "edit 1", "open theme 2", etc.
                    // Match "edit theme X" or "edit X" where X is the identifier
                    const editThemePattern = /^(?:edit|open)\s+(?:theme\s+)?([^\s]+)$/i;
                    const editThemeMatch = query.match(editThemePattern);
                    if (editThemeMatch && editThemeMatch[1] && editThemeMatch[1].toLowerCase().trim() !== 'editor') {
                        const themeIdentifier = editThemeMatch[1].trim();
                        // Only proceed if it looks like a theme identifier (not a full sentence)
                        if (themeIdentifier.length < 100) {
                            const parsedForEdit = await this.parseQuery(query, schemas);
                            const result = await this.handleEditTheme(themeIdentifier, query, parsedForEdit);
                            if (result) {
                                resolve(result);
                                return;
                            }
                        }
                    }
                    
                    // Handle "show data of theme X" queries
                    const showDataOfThemePattern = /^(?:show|open|view|display)\s+data\s+(?:of|for)\s+(?:theme\s+)?([^\s]+)$/i;
                    const showDataOfThemeMatch = query.match(showDataOfThemePattern);
                    if (showDataOfThemeMatch && showDataOfThemeMatch[1]) {
                        const themeIdentifier = showDataOfThemeMatch[1].trim();
                        if (themeIdentifier.length < 100) {
                            const parsedForShowData = await this.parseQuery(query, schemas);
                            const result = await this.handleShowDataOfTheme(themeIdentifier, query, parsedForShowData);
                            if (result) {
                                resolve(result);
                                return;
                            }
                        }
                    }
                    
                    // Step 1.5.5: Check for color matching queries BEFORE parsing
                    // Patterns for color matching requests (only for categorical themes)
                    const colorMatchingPatterns = [
                        /\b(match|assign|suggest|recommend|choose)\s+colors?\s+(to|for|by)\s+(the\s+)?(values?|categories?|meaning|signification)/i,
                        /\bcolors?\s+(to|for|by)\s+(the\s+)?(values?|categories?|meaning|signification)/i,
                        /\bmatch\s+colors?/i,
                        /\bassign\s+colors?/i,
                        /\bcolor\s+by\s+meaning/i,
                        /\bsuggest\s+colors?/i
                    ];
                    
                    let isColorMatchingQuery = false;
                    for (const pattern of colorMatchingPatterns) {
                        if (pattern.test(query)) {
                            isColorMatchingQuery = true;
                            break;
                        }
                    }
                    
                    if (isColorMatchingQuery) {
                        const result = await this.handleColorMatching(query, schemas);
                        if (result) {
                            resolve(result);
                            return;
                        }
                    }
                    
                    // Step 1.6: Check for summary/aggregation queries BEFORE parsing
                    // Patterns for summary queries
                    const summaryPatterns = [
                        /\b(total|sum|aggregate|add up|summarize)\s+(of\s+)?(the\s+)?(.+?)(\s+in\s+|\s+from\s+|\s+of\s+)?(.+)?$/i,
                        /\bshow\s+me\s+(the\s+)?(total|sum)\s+(of\s+)?(.+?)(\s+in\s+|\s+from\s+)?(.+)?$/i,
                        /\bwhat\s+is\s+(the\s+)?(total|sum)\s+(of\s+)?(.+?)(\s+in\s+|\s+from\s+)?(.+)?$/i,
                        /\bhow\s+many\s+(.+?)(\s+in\s+|\s+from\s+)?(.+)?$/i,
                        /\bcount\s+(the\s+)?(.+?)(\s+in\s+|\s+from\s+)?(.+)?$/i
                    ];
                    
                    let isSummaryQuery = false;
                    for (const pattern of summaryPatterns) {
                        if (pattern.test(query)) {
                            isSummaryQuery = true;
                            break;
                        }
                    }
                    
                    if (isSummaryQuery) {
                        const result = await this.handleSummaryQuery(query, schemas);
                        if (result) {
                            resolve(result);
                            return;
                        }
                    }
                    
                    // Step 2: Check for theme modification requests (size/color by field) BEFORE parsing
                    // This must happen first to avoid misinterpreting "color by X" as a filter
                    
                    // Check for size-related words
                    const sizeWords = {
                        'en': ['size', 'sized', 'sizing', 'dimension', 'dimensions'],
                        'it': ['grandezza', 'dimensione', 'dimensioni', 'taglia'],
                        'es': ['tamaño', 'tamaños', 'dimensión', 'dimensiones'],
                        'fr': ['taille', 'tailles', 'dimension', 'dimensions'],
                        'de': ['größe', 'größen', 'dimension', 'dimensionen'],
                        'pt': ['tamanho', 'tamanhos', 'dimensão', 'dimensões'],
                        'nl': ['grootte', 'groottes', 'dimensie', 'dimensies'],
                        'ru': ['размер', 'размеры', 'размерность']
                    };
                    
                    // Check for color-related words (including "color by" pattern)
                    const colorWords = {
                        'en': ['color', 'colour', 'colored', 'coloured', 'coloring', 'colouring'],
                        'it': ['colore', 'colori', 'colorato', 'colorata'],
                        'es': ['color', 'colores', 'coloreado', 'coloreada'],
                        'fr': ['couleur', 'couleurs', 'coloré', 'colorée'],
                        'de': ['farbe', 'farben', 'gefärbt'],
                        'pt': ['cor', 'cores', 'colorido', 'colorida'],
                        'nl': ['kleur', 'kleuren', 'gekleurd'],
                        'ru': ['цвет', 'цвета', 'цветной']
                    };
                    
                    // Check for tooltip-related words - ONLY explicit tooltip requests
                    // CRITICAL: Only match explicit tooltip requests, not general "info" queries
                    const tooltipWords = {
                        'en': ['tooltip', 'tooltips'],
                        'it': ['tooltip', 'tooltips'],
                        'es': ['tooltip', 'tooltips'],
                        'fr': ['tooltip', 'tooltips'],
                        'de': ['tooltip', 'tooltips'],
                        'pt': ['tooltip', 'tooltips'],
                        'nl': ['tooltip', 'tooltips'],
                        'ru': ['подсказка', 'подсказки']
                    };
                    
                    // Check for id-related words (for setting id binding)
                    const idWords = {
                        'en': ['id', 'identifier', 'itemfield', 'item field'],
                        'it': ['id', 'identificatore', 'campo elemento'],
                        'es': ['id', 'identificador', 'campo elemento'],
                        'fr': ['id', 'identifiant', 'champ élément'],
                        'de': ['id', 'identifikator', 'elementfeld'],
                        'pt': ['id', 'identificador', 'campo elemento'],
                        'nl': ['id', 'identificator', 'elementveld'],
                        'ru': ['id', 'идентификатор', 'поле элемента']
                    };
                    
                    // Explicit tooltip patterns - only match these
                    const explicitTooltipPatterns = [
                        /tooltip/i,
                        /info\s+on\s+click/i,
                        /show\s+info\s+on\s+click/i,
                        /display\s+info\s+on\s+click/i,
                        /hover\s+info/i,
                        /popup\s+info/i
                    ];
                    
                    // Check for colorscheme/color list queries (NOT "color by field")
                    const colorschemeQueryPattern = /(show|list|what|which|available|possible).*(colorscheme|color\s+scheme|color\s+palette|palette)/i;
                    const hasColorschemeQuery = colorschemeQueryPattern.test(query) && !/(?:color|colour|colorize|colourise)\s+by\s+\w+/i.test(query);
                    
                    // Check for "color by" / "colorize by" or "size by" or "tooltip by" or "set id" patterns first (highest priority)
                    const colorByPattern = /(?:color|colour|colorize|colourise)\s+by\s+\w+/i;
                    const sizeByPattern = /(?:size\s+by|set\s+size\s+from)\s+\w+/i;
                    const tooltipByPattern = /tooltip\s+by\s+\w+|show\s+tooltip\s+(\w+)|tooltip\s+(\w+)/i;
                    // Improved pattern to match "set id by ISO3_CODE", "set id ISO3_CODE", etc.
                    // Matches: "set id by X", "id by X", "set id to X", "set id X", "id X", etc.
                    const idByPattern = /(?:set\s+)?id\s+(?:(?:to|by|is|as)\s+)?([A-Z][A-Z0-9_]+|\w+)/i;
                    const hasColorBy = colorByPattern.test(query);
                    const hasSizeBy = sizeByPattern.test(query);
                    // Only match explicit tooltip requests
                    const hasTooltipBy = tooltipByPattern.test(query) || explicitTooltipPatterns.some(pattern => pattern.test(query));
                    const hasIdBy = idByPattern.test(query);
                    if (hasIdBy) {
                        console.log('✅ [Id Binding] Pattern matched for query:', query);
                        console.log('✅ [Id Binding] Pattern details:', idByPattern.toString());
                    } else {
                        // Also check for simpler patterns like "set id FIELD" without "to" or "by"
                        const simpleIdPattern = /(?:set\s+)?id\s+([A-Z][A-Z0-9_]+|\w+)/i;
                        if (simpleIdPattern.test(query)) {
                            console.log('✅ [Id Binding] Simple pattern matched for query:', query);
                            // Override hasIdBy to true
                            const hasIdBySimple = true;
                            // We'll handle this in the handler itself
                        }
                    }
                    
                    // If user asks about colorschemes (not "color by field"), show available schemes
                    if (hasColorschemeQuery) {
                        const parsed = await this.parseQuery(query, schemas);
                        const result = await this.handleShowColorSchemes(query, parsed);
                        if (result) {
                            resolve(result);
                            return;
                        }
                    }
                    
                    // If we have explicit "by" pattern, handle it immediately and return
                    if (hasColorBy) {
                        const parsed = await this.parseQuery(query, schemas);
                        const result = await this.handleColorByField(query, queryLower, colorWords, schemas, parsed);
                        if (result) {
                            resolve(result);
                            return;
                        }
                    }
                    
                    if (hasSizeBy) {
                        const parsed = await this.parseQuery(query, schemas);
                        const result = await this.handleSizeByField(query, queryLower, sizeWords, schemas, parsed);
                        if (result) {
                            resolve(result);
                            return;
                        }
                    }
                    
                    if (hasTooltipBy) {
                        const parsed = await this.parseQuery(query, schemas);
                        const result = await this.handleTooltipByField(query, queryLower, tooltipWords, schemas, parsed);
                        if (result) {
                            resolve(result);
                            return;
                        }
                    }
                    
                    // Also check for simple "set id FIELD" pattern if main pattern didn't match
                    let hasIdByFinal = hasIdBy;
                    if (!hasIdByFinal) {
                        const simpleIdPattern = /(?:set\s+)?id\s+([A-Z][A-Z0-9_]+|\w+)/i;
                        hasIdByFinal = simpleIdPattern.test(query);
                        if (hasIdByFinal) {
                            console.log('✅ [Id Binding] Simple pattern matched, treating as id binding request');
                        }
                    }
                    
                    if (hasIdByFinal) {
                        console.log('🔍 [Id Binding] Processing id binding request early in flow');
                        const parsed = await this.parseQuery(query, schemas);
                        const result = await this.handleIdByField(query, queryLower, idWords, schemas, parsed);
                        if (result) {
                            console.log('✅ [Id Binding] Id binding handler returned result');
                            resolve(result);
                            return;
                        } else {
                            console.warn('⚠️ [Id Binding] Id binding handler returned null/undefined');
                            // Even if handler returns null, if pattern matched, return an error instead of continuing
                            // This prevents the query from being processed as a filter
                            const errorMsg = `❌ Could not process id binding request. Please ensure:\n- The field name is correct (e.g., "set id to ISO3_CODE")\n- The theme is a FEATURE type theme\n- The field exists in your data`;
                            resolve({
                                items: [],
                                response: errorMsg,
                                count: 0,
                                query: { method: 'idfield', sql: '' },
                                modelUsed: parsed.modelUsed || null
                            });
                            return;
                        }
                    }
                    
                    // Check for theme combination requests
                    // Pattern 1: "combine/connect theme1 and theme2" or "combine/connect layer1 and layer2" (with theme/layer names)
                    const combinePattern = /(?:combine|connect)\s+(?:theme\s*|layer\s*)?(\w+)\s+(?:and|with|&)\s+(?:theme\s*|layer\s*)?(\w+)/i;
                    // Pattern 2: "combine/connect themes/layers" (auto-detect themes)
                    const combineThemesPattern = /(?:combine|connect)\s+(?:themes?|layers?)/i;
                    // Pattern 3: Just "combine" or "connect" (treat as "combine themes")
                    const combineOnlyPattern = /^(?:combine|connect)$/i;
                    const hasCombine = combinePattern.test(query) || combineThemesPattern.test(query) || combineOnlyPattern.test(query.trim());
                    if (hasCombine) {
                        console.log('🔍 [Theme Combination] Pattern matched for query:', query);
                        const parsed = await this.parseQuery(query, schemas);
                        const result = await this.handleThemeCombination(query, queryLower, schemas, parsed);
                        if (result) {
                            console.log('✅ [Theme Combination] Handler returned result');
                            resolve(result);
                            return;
                        } else {
                            console.warn('⚠️ [Theme Combination] Handler returned null/undefined');
                            // Return error to prevent query from being processed as filter
                            const errorMsg = `❌ Could not process theme combination request. Please ensure:\n- Both themes exist\n- First theme is FEATURE type\n- Second theme is CHART or CHOROPLETH type\n- Both themes have the same layer name`;
                            resolve({
                                items: [],
                                response: errorMsg,
                                count: 0,
                                query: { method: 'combine', sql: '' },
                                modelUsed: parsed.modelUsed || null
                            });
                            return;
                        }
                    }
                    
                    // Step 2: Parse natural language query (now async)
                    const parsed = await this.parseQuery(query, schemas);
                    
                    // Check for colorscheme queries again (after parsing, in case pattern wasn't caught earlier)
                    const colorschemeQueryPattern2 = /(show|list|what|which|available|possible).*(colorscheme|color\s+scheme|color\s+palette|palette)/i;
                    const hasColorschemeQuery2 = colorschemeQueryPattern2.test(query) && !hasColorBy;
                    
                    // Check for size/color/tooltip words (for queries without explicit "by" pattern)
                    let sizeWordFound = null;
                    let colorWordFound = null;
                    let tooltipWordFound = null;
                    
                    // Check for size words
                    for (const [lang, words] of Object.entries(sizeWords)) {
                        for (const word of words) {
                            if (queryLower.includes(word)) {
                                sizeWordFound = word;
                                break;
                            }
                        }
                        if (sizeWordFound) break;
                    }
                    
                    // Check for color words
                    for (const [lang, words] of Object.entries(colorWords)) {
                        for (const word of words) {
                            if (queryLower.includes(word)) {
                                colorWordFound = word;
                                break;
                            }
                        }
                        if (colorWordFound) break;
                    }
                    
                    // Check for tooltip words - ONLY if explicitly asking for tooltip
                    // Don't match general "info" queries - only explicit tooltip requests
                    const hasExplicitTooltipRequest = explicitTooltipPatterns.some(pattern => pattern.test(query));
                    if (hasExplicitTooltipRequest) {
                        for (const [lang, words] of Object.entries(tooltipWords)) {
                            for (const word of words) {
                                if (queryLower.includes(word)) {
                                    tooltipWordFound = word;
                                    break;
                                }
                            }
                            if (tooltipWordFound) break;
                        }
                    }
                    
                    // Step 3.5: Check if query can be matched to a filter query
                    // If parsed.type === 'filter' and has valid conditions, we'll execute it normally
                    // Otherwise, check if it's a theme modification request (size/color by field)
                    const isFilterQuery = parsed.type === 'filter' && 
                                         parsed.conditions && 
                                         parsed.conditions.length > 0 &&
                                         parsed.conditions.some(cond => {
                                             // Valid condition: has operator and value that's not a default
                                             // Also exclude cases where field equals itself (e.g., "Location" = "Location")
                                             const fieldName = cond.field ? cond.field.toLowerCase() : '';
                                             const valueStr = String(cond.value || '').toLowerCase();
                                             
                                             return cond.operator && 
                                                    cond.value !== null && 
                                                    cond.value !== undefined &&
                                                    fieldName !== valueStr && // Exclude field = field
                                                    !(cond.operator === '>' && cond.value === 0) &&
                                                    !(cond.operator === '>=' && cond.value === 0) &&
                                                    !(cond.operator === '!=' && cond.value === null);
                                         });
                    
                    // If NOT a valid filter query, check for size/color/tooltip by field requests
                    if (!isFilterQuery) {
                        // Check for colorscheme queries (not "color by field")
                        if (hasColorschemeQuery2) {
                            const result = await this.handleShowColorSchemes(query, parsed);
                            if (result) {
                                resolve(result);
                                return;
                            }
                        }
                        
                        // Handle size by field
                        if (sizeWordFound) {
                            const result = await this.handleSizeByField(query, queryLower, sizeWords, schemas, parsed);
                            if (result) {
                                resolve(result);
                                return;
                            }
                        }
                        
                        // Handle color by field (but not if it's a colorscheme query)
                        if (colorWordFound && !hasColorschemeQuery2) {
                            const result = await this.handleColorByField(query, queryLower, colorWords, schemas, parsed);
                            if (result) {
                                resolve(result);
                                return;
                            }
                        }
                        
                        // Handle tooltip by field
                        if (tooltipWordFound) {
                            const result = await this.handleTooltipByField(query, queryLower, tooltipWords, schemas, parsed);
                            if (result) {
                                resolve(result);
                                return;
                            }
                        }
                        
                        // Handle id by field (check for id-related words)
                        let idWordFound = false;
                        const detectedLanguageForId = parsed.detectedLanguage || 'en';
                        const idWordsForLang = idWords[detectedLanguageForId] || idWords['en'];
                        for (const idWord of idWordsForLang) {
                            if (queryLower.includes(idWord) && (queryLower.includes('set') || queryLower.includes('to') || queryLower.includes('by'))) {
                                idWordFound = true;
                                break;
                            }
                        }
                        
                        if (idWordFound) {
                            const result = await this.handleIdByField(query, queryLower, idWords, schemas, parsed);
                            if (result) {
                                resolve(result);
                                return;
                            }
                        }
                    }
                    
                    // Step 3: Handle special query types
                    // Check binding BEFORE discover (since "show bindings" could match both patterns)
                    const detectedLanguage = parsed.detectedLanguage || 'en';
                    
                    if (parsed.type === 'binding' || parsed.type === 'bindings') {
                        const bindingInfo = ixmaps.aiQuery.getBindingInfo(schemas, detectedLanguage);
                        resolve({
                            items: [],
                            response: bindingInfo.summary,
                            count: 0,
                            query: { method: 'bindings', sql: '' },
                            bindings: bindingInfo,
                            modelUsed: parsed.modelUsed || null
                        });
                        return;
                    }
                    
                    if (parsed.type === 'datasources' || parsed.type === 'data_sources' || parsed.type === 'datasource') {
                        const rawQ = parsed.originalQuery || query || '';
                        const includeProcessCode = parsed.showProcess === true ||
                            (typeof ixmaps.aiQuery.wantsDataSourceProcessCode === 'function' &&
                                ixmaps.aiQuery.wantsDataSourceProcessCode(rawQ));
                        const dataSourcesInfo = ixmaps.aiQuery.getDataSourcesInfo(schemas, detectedLanguage, {
                            includeProcessCode: includeProcessCode
                        });
                        resolve({
                            items: [],
                            response: dataSourcesInfo.summary,
                            count: 0,
                            query: { method: 'datasources', sql: '', includeProcessCode: includeProcessCode },
                            dataSources: dataSourcesInfo,
                            modelUsed: parsed.modelUsed || null
                        });
                        return;
                    }
                    
                    if (parsed.type === 'discover') {
                        // CRITICAL: Check if this is actually an analysis request that should be mapinfo
                        // "analyze the data" should NOT be classified as "discover" - it should be "mapinfo" with showDetails=true
                        const queryLower = (parsed.originalQuery || query || '').toLowerCase();
                        const isAnalysisQuery = queryLower.includes('analyze this data') ||
                            queryLower.includes('analyze the data') ||
                            queryLower.includes('analyze data') ||
                            queryLower.includes('analyse this data') ||
                            queryLower.includes('analyse the data') ||
                            queryLower.includes('analyse data') ||
                            (queryLower.includes('analyze') && queryLower.includes('data')) ||
                            (queryLower.includes('analyse') && queryLower.includes('data'));
                        
                        if (isAnalysisQuery) {
                            // This should be mapinfo with showDetails=true, not discover
                            console.log('⚠️ Analysis query misclassified as discover, converting to mapinfo');
                            parsed.type = 'mapinfo';
                            parsed.showDetails = true;
                            // Fall through to mapinfo handler below
                        } else {
                            // STRICT LOGIC: "show themes" = definitions only (like "show layer")
                            // Only show data if query explicitly contains the word "data"
                            // Examples:
                            // - "show themes" → definitions only
                            // - "show themes data" → data
                            // - "themes data" → data
                            // - "show themes" → definitions (NO data)
                            
                            // Check if query explicitly contains "data" (must be present to show data)
                            const hasExplicitData = queryLower.includes(' data') || 
                                                   queryLower.includes('data ') ||
                                                   queryLower.includes('themes data') ||
                                                   queryLower.includes('theme data') ||
                                                   queryLower.includes('data fields') ||
                                                   queryLower.includes('data available') ||
                                                   queryLower.includes('available data');
                            
                            // For "show themes" or similar queries WITHOUT "data" → show definitions only
                            // For queries WITH "data" → show data
                            const showData = hasExplicitData;
                            
                            console.log('🔍 Discover query analysis (STRICT):', {
                                query: queryLower,
                                hasExplicitData,
                                showData: showData,
                                willShow: showData ? 'DATA (fields)' : 'DEFINITIONS (type, binding, style) - like "show layer"'
                            });
                            
                            const discovery = ixmaps.aiExplorer.discover(schemas, detectedLanguage, showData);
                            resolve({
                                items: [],
                                response: discovery.summary,
                                count: 0,
                                query: { method: 'discover', sql: '' },
                                discovery: discovery,
                                modelUsed: parsed.modelUsed || null
                            });
                            return;
                        }
                    }
                    
                    if (parsed.type === 'statistics') {
                        const statisticsInfo = await this.getStatistics(schemas, detectedLanguage);
                        resolve({
                            items: [],
                            response: statisticsInfo.summary,
                            count: 0,
                            query: { method: 'statistics', sql: '' },
                            statistics: statisticsInfo,
                            modelUsed: parsed.modelUsed || null
                        });
                        return;
                    }
                    
                    // Handle simple "themes" query - show list with buttons
                    if (parsed.type === 'themes' || (queryLower.trim() === 'themes' || queryLower.trim() === 'theme')) {
                        const result = await this.handleThemesList(query, queryLower, schemas, parsed);
                        if (result) {
                            resolve(result);
                            return;
                        }
                    }
                    
                    if (parsed.type === 'mapinfo' || parsed.type === 'map info') {
                        // Combine discovery and binding info
                        // Check if this is specifically a "show themes" query - if so, show definitions only
                        const queryLowerForMapinfo = (parsed.originalQuery || query || '').toLowerCase();
                        const isThemeOnlyQuery = (queryLowerForMapinfo.includes('show themes') || 
                                                 queryLowerForMapinfo.includes('show theme') ||
                                                 queryLowerForMapinfo.includes('list themes') ||
                                                 queryLowerForMapinfo.includes('theme info')) &&
                                                 !queryLowerForMapinfo.includes('data') &&
                                                 !queryLowerForMapinfo.includes('fields');
                        
                        // STRICT LOGIC: For mapinfo, show definitions by default (like "show layer")
                        // Only show data if query explicitly contains the word "data"
                        const hasExplicitDataForMapinfo = queryLowerForMapinfo.includes(' data') || 
                                                         queryLowerForMapinfo.includes('data ') ||
                                                         queryLowerForMapinfo.includes('themes data') ||
                                                         queryLowerForMapinfo.includes('theme data') ||
                                                         queryLowerForMapinfo.includes('data fields');
                        
                        const showDataForMapinfo = hasExplicitDataForMapinfo;
                        
                        console.log('🔍 mapinfo handler (STRICT) - query:', queryLowerForMapinfo, 'hasExplicitDataForMapinfo:', hasExplicitDataForMapinfo, 'showDataForMapinfo:', showDataForMapinfo, '→ Will show:', showDataForMapinfo ? 'DATA' : 'DEFINITIONS (like show layer)');
                        
                        const discovery = ixmaps.aiExplorer.discover(schemas, detectedLanguage, showDataForMapinfo);
                        const bindingInfo = ixmaps.aiQuery.getBindingInfo(schemas, detectedLanguage);
                        
                        // Store schemas in discovery object for use in formatMapInfo
                        discovery.schemas = schemas;
                        
                        // Check if user wants details (from query or previous context)
                        const wantsDetails = parsed.showDetails || 
                                           parsed.originalQuery.toLowerCase().includes('details') ||
                                           parsed.originalQuery.toLowerCase().includes('detailed') ||
                                           parsed.originalQuery.toLowerCase().includes('more info') ||
                                           parsed.originalQuery.toLowerCase().includes('yes');
                        
                        // Check if user explicitly requested statistics
                        const wantsStatistics = queryLowerForMapinfo.includes('statistics') ||
                                             queryLowerForMapinfo.includes('statistiche') ||
                                             queryLowerForMapinfo.includes('stats') ||
                                             queryLowerForMapinfo.includes('statistical info') ||
                                             queryLowerForMapinfo.includes('statistical information') ||
                                             queryLowerForMapinfo.includes('data statistics') ||
                                             queryLowerForMapinfo.includes('show statistics');
                        
                        console.log('🔍 mapinfo handler - parsed.showDetails:', parsed.showDetails, 'wantsDetails:', wantsDetails, 'wantsStatistics:', wantsStatistics, 'query:', parsed.originalQuery);
                        
                        // Combine both responses (summary or full details)
                        // Note: formatMapInfo is now async, so we need to await it
                        const combinedResponse = await this.formatMapInfo(discovery, bindingInfo, detectedLanguage, wantsDetails, wantsStatistics);
                        
                        console.log('📝 formatMapInfo returned response length:', combinedResponse?.length, 'first 200 chars:', combinedResponse?.substring(0, 200));
                        
                        resolve({
                            items: [],
                            response: combinedResponse,
                            count: 0,
                            query: { method: 'mapinfo', sql: '', showDetails: wantsDetails },
                            discovery: discovery,
                            bindings: bindingInfo,
                            modelUsed: parsed.modelUsed || null
                        });
                        return;
                    }
                    
                    // Step 4: Check if query is just a field name (no real operators or values)
                    // If Gemini generated a condition with ">" and value 0 (or similar), treat it as "show field"
                    // If so, and theme has sizefield capability, set sizefield
                    let isFieldOnlyQuery = false;
                    let fieldName = null;
                    
                    if (parsed.conditions && parsed.conditions.length > 0 && parsed.theme) {
                        // Check if all conditions are just "field > 0" or similar default conditions
                        const allDefaultConditions = parsed.conditions.every(cond => {
                            return (cond.operator === '>' && (cond.value === 0 || cond.value === null || cond.value === false)) ||
                                   (cond.operator === '>=' && cond.value === 0) ||
                                   (cond.operator === '!=' && cond.value === null);
                        });
                        
                        if (allDefaultConditions && parsed.conditions.length === 1) {
                            // This looks like Gemini's default interpretation - treat as field name only
                            isFieldOnlyQuery = true;
                            fieldName = parsed.conditions[0].field;
                        }
                    }
                    
                    // Also check if query has no conditions at all
                    if (!isFieldOnlyQuery && parsed.conditions && parsed.conditions.length === 0 && parsed.theme) {
                        // Check if query looks like just a field name (no operators like >, <, ==, LIKE, etc.)
                        const queryLower = parsed.originalQuery.toLowerCase().trim();
                        const hasOperator = /[><=!]|like|contains|matches/i.test(queryLower);
                        
                        if (!hasOperator) {
                            isFieldOnlyQuery = true;
                        }
                    }
                    
                    if (isFieldOnlyQuery && parsed.theme) {
                        // Try to find the field in the schema
                        const schema = schemas.find(s => s.theme === parsed.theme);
                        if (schema && schema.fields) {
                            // If we already have a field name from conditions, use it
                            let matchingField = null;
                            
                            if (fieldName) {
                                // Find the field by name
                                matchingField = schema.fields.find(f => {
                                    const fName = typeof f === 'string' ? f : (f.name || f.field || f.id || '');
                                    return fName.toLowerCase() === fieldName.toLowerCase();
                                });
                            } else {
                                // Try to match the query to a field name
                                const queryLower = parsed.originalQuery.toLowerCase().trim();
                                matchingField = schema.fields.find((f) => {
                                    const fName = typeof f === 'string' ? f : (f.name || f.field || f.id || '');
                                    return fName.toLowerCase() === queryLower || 
                                           fName.toLowerCase().includes(queryLower) ||
                                           queryLower.includes(fName.toLowerCase());
                                });
                            }
                            
                            if (matchingField) {
                                const finalFieldName = fieldName || (typeof matchingField === 'string' ? matchingField : (matchingField.name || matchingField.field || matchingField.id));
                                
                                // Check if theme supports sizefield
                                const map = this.getMap();
                                if (map && map.Api) {
                                    try {
                                        const themeDef = map.Api.getMapThemeDefinitionObj(parsed.theme);
                                        const themeObj = map.Api.getTheme(parsed.theme);
                                        
                                        // Check if theme has sizefield capability (check if type supports size)
                                        const themeType = themeDef?.style?.type || themeObj?.theme?.szFlag || '';
                                        const supportsSize = themeType && (
                                            themeType.includes('symbol') || 
                                            themeType.includes('bubble') ||
                                            themeType.includes('chart') ||
                                            themeType === 'symbol' ||
                                            themeType === 'bubble'
                                        );
                                        
                                        if (supportsSize || themeDef?.style?.sizefield !== undefined || themeObj?.theme?.szSizeField !== undefined) {
                                            // Set sizefield using changeThemeStyle
                                            const mapApi = map.Api;
                                            if (mapApi && mapApi.changeThemeStyle) {
                                                // Create a human-readable title from the field name
                                                let newTitle = finalFieldName
                                                    .replace(/_/g, ' ')
                                                    .replace(/([A-Z])/g, ' $1')
                                                    .replace(/^./, str => str.toUpperCase())
                                                    .trim();
                                                
                                                // If the original query was more descriptive, use that
                                                const originalQuery = parsed.originalQuery.trim();
                                                if (originalQuery.length > 0 && originalQuery.length < 50 && !/[><=!]/.test(originalQuery)) {
                                                    // Use the original query as title if it's reasonable
                                                    newTitle = originalQuery.charAt(0).toUpperCase() + originalQuery.slice(1);
                                                }
                                                
                                                // Combine sizefield and title in a single changeThemeStyle call
                                                // Multiple style properties can be separated by semicolon
                                                const combinedStyle = `sizefield:${finalFieldName};title:${newTitle}`;
                                                
                                                try {
                                                    mapApi.changeThemeStyle(parsed.theme, combinedStyle, "set");
                                                    console.log('✅ Applied sizefield and title to theme:', parsed.theme, 'Style:', combinedStyle);
                                                } catch (e) {
                                                    console.error('❌ Error applying sizefield and title:', e);
                                                    // Try setting them separately as fallback
                                                    try {
                                                        mapApi.changeThemeStyle(parsed.theme, `sizefield:${finalFieldName}`, "set");
                                                        mapApi.changeThemeStyle(parsed.theme, `title:${newTitle}`, "set");
                                                        console.log('✅ Applied sizefield and title separately as fallback');
                                                    } catch (e2) {
                                                        console.error('❌ Error in fallback:', e2);
                                                    }
                                                }
                                                
                                                const themeTitle = schema.themeTitle || parsed.theme;
                                                const responseMsg = detectedLanguage === 'it'
                                                    ? `✅ Campo dimensione configurato con successo!\n\nHo impostato il campo dimensione a "${finalFieldName}" e aggiornato il titolo a "${newTitle}" per il tema "${themeTitle}". Le bolle sul tema ora riflettono i valori numerici del campo "${finalFieldName}", con valori più grandi rappresentati da bolle più grandi.`
                                                    : detectedLanguage === 'de'
                                                    ? `✅ Größenfeld erfolgreich konfiguriert!\n\nIch habe das Größenfeld auf "${finalFieldName}" gesetzt und den Titel auf "${newTitle}" für das Theme "${themeTitle}" aktualisiert. Die Blasen im Theme spiegeln nun die numerischen Werte des Feldes "${finalFieldName}" wider, wobei größere Werte durch größere Blasen dargestellt werden.`
                                                    : detectedLanguage === 'fr'
                                                    ? `✅ Champ de taille configuré avec succès!\n\nJ'ai défini le champ de taille sur "${finalFieldName}" et mis à jour le titre sur "${newTitle}" pour le thème "${themeTitle}". Les bulles du thème reflètent maintenant les valeurs numériques du champ "${finalFieldName}", les valeurs plus grandes étant représentées par des bulles plus grandes.`
                                                    : detectedLanguage === 'es'
                                                    ? `✅ ¡Campo de tamaño configurado con éxito!\n\nHe establecido el campo de tamaño en "${finalFieldName}" y actualizado el título a "${newTitle}" para el tema "${themeTitle}". Las burbujas en el tema ahora reflejan los valores numéricos del campo "${finalFieldName}", con valores más grandes representados por burbujas más grandes.`
                                                    : `✅ Size field configured successfully!\n\nI've set the size field to "${finalFieldName}" and updated the title to "${newTitle}" for the theme "${themeTitle}". The bubbles on the theme now reflect the numeric values of the "${finalFieldName}" field, with larger values represented by larger bubbles.`;
                                                
                                                resolve({
                                                    items: [],
                                                    response: responseMsg,
                                                    count: 0,
                                                    query: { method: 'sizefield', sql: '', field: finalFieldName, theme: parsed.theme, title: newTitle }
                                                });
                                                return;
                                            }
                                        }
                                    } catch (e) {
                                        console.warn('Error checking theme for sizefield:', e);
                                    }
                                }
                            }
                        }
                    }
                    
                    // Step 4: Translate to ixmaps query syntax
                    const ixmapsQuery = this.translateToIxmapsQuery(parsed, schemas);
                    
                    // Step 5: Execute query
                    // Check if this is a data query (needs Data.Table) or feature query (uses map.Query)
                    // For 'all' theme, try to find first schema with data
                    let schema = null;
                    if (ixmapsQuery.theme === 'all') {
                        schema = schemas.find(s => s.hasData);
                    } else {
                        schema = schemas.find(s => s.theme === ixmapsQuery.theme);
                    }
                    
                    const isDataQuery = schema && schema.hasData && (ixmapsQuery.method === 'advanced' || (ixmapsQuery.method === 'simple' && ixmapsQuery.sql && !ixmapsQuery.sql.match(/^\*$/)));
                    
                    let results;
                    if (isDataQuery) {
                        results = this.executeDataQuery(ixmapsQuery, schema);
                    } else {
                        results = this.executeQuery(ixmapsQuery);
                    }
                    
                    // Step 6: If no results found, try to reinterpret the query
                    if (results.length === 0 && parsed.type === 'filter') {
                        const queryLower = (query || '').toLowerCase();
                        
                        // Check if query might be asking for fields/data information instead of filtering
                        if (queryLower.includes('all fields') || 
                            queryLower.includes('show fields') || 
                            queryLower.includes('what fields') ||
                            queryLower.includes('available fields') ||
                            queryLower.includes('list fields') ||
                            (queryLower.includes('show me') && queryLower.includes('fields'))) {
                            // Reinterpret as discovery query - these are asking for data fields, so showData=true
                            console.log('🔄 Reinterpreting query as discovery request');
                            const discovery = ixmaps.aiExplorer.discover(schemas, detectedLanguage, true);
                            resolve({
                                items: [],
                                response: discovery.summary,
                                count: 0,
                                query: { method: 'discover', sql: '' },
                                discovery: discovery,
                                modelUsed: parsed.modelUsed || null
                            });
                            return;
                        }
                    }
                    
                    // Step 6: Format results (pass parsed query info and schema for sorting)
                    const formatted = this.formatResults(results, query, { 
                        parsed: parsed, 
                        schema: schema 
                    });
                    
                    // Prepare query info for visualization
                    let whereClause = null;
                    if (isDataQuery && results._queryMetadata) {
                        whereClause = results._queryMetadata.whereClause;
                    } else if (isDataQuery) {
                        // Fallback: construct whereClause from query
                        if (ixmapsQuery.method === 'advanced' && ixmapsQuery.sql) {
                            whereClause = `WHERE ${ixmapsQuery.sql}`;
                        } else if (ixmapsQuery.method === 'simple' && ixmapsQuery.sql && ixmapsQuery.sql !== '*') {
                            // For simple queries, create a LIKE clause
                            const firstField = schema && schema.fields && schema.fields.length > 0 ? schema.fields[0] : 'name';
                            whereClause = `WHERE "${firstField}" LIKE "%${ixmapsQuery.sql}%"`;
                        }
                    }
                    
                    // Check if query contains "goto", "go to", or "focus on" - these should always zoom to results
                    const hasGotoOrFocus = /(?:goto|go\s+to|focus\s+on)/i.test(queryLower || query);
                    
                    const queryInfo = {
                        isDataQuery: isDataQuery,
                        theme: schema ? schema.theme : ixmapsQuery.theme,
                        whereClause: whereClause,
                        parsed: parsed,
                        schema: schema,
                        fieldInfo: formatted.fieldInfo, // Include fieldInfo from formatResults
                        originalQuery: query, // Store original query for "goto"/"focus on" detection
                        hasGotoOrFocus: hasGotoOrFocus // Flag for zoom behavior
                    };
                    
                    resolve({
                        items: formatted.items, // Use sorted results from formatResults
                        response: formatted.response,
                        count: formatted.count, // Use count from formatResults
                        query: ixmapsQuery,
                        queryInfo: queryInfo,
                        fieldInfo: formatted.fieldInfo, // Also include fieldInfo at top level for convenience
                        modelUsed: parsed.modelUsed || null // Include which model was used for parsing
                    });
                } catch (error) {
                    console.error('❌ AI Query error:', error);
                    reject(error);
                }
            });
        },
        
        /**
         * Handle "size by field" requests
         * @param {String} query - Original query
         * @param {String} queryLower - Lowercase query
         * @param {Object} sizeWords - Size words dictionary
         * @param {Array} schemas - Available schemas
         * @param {Object} parsed - Parsed query result
         * @returns {Promise<Object|null>} Result object or null if not handled
         */
        handleSizeByField: async function(query, queryLower, sizeWords, schemas, parsed) {
            const map = this.getMap();
            if (!map || !map.Api) {
                return null;
            }
            
            // Get all themes to find CHART themes
            let allThemes = [];
            try {
                if (map.Themes && map.Themes.getThemes) {
                    allThemes = map.Themes.getThemes();
                } else if (map.Api && map.Api.getAllThemes) {
                    allThemes = map.Api.getAllThemes();
                }
            } catch (e) {
                console.warn('Could not get themes:', e);
                return null;
            }
            
            // Find CHART themes
            const chartThemes = [];
            console.log('🔍 Checking themes for CHART type. Total themes:', allThemes.length);
            
            for (const theme of allThemes) {
                try {
                    const themeId = theme.szId || theme.id || theme.name;
                    if (!themeId) {
                        console.warn('⚠️ Theme without ID:', theme);
                        continue;
                    }
                    
                    let themeDef = null;
                    let themeType = '';
                    
                    // Try multiple methods to get theme definition
                    try {
                        themeDef = map.Api.getMapThemeDefinitionObj(themeId);
                        themeType = themeDef?.style?.type || '';
                    } catch (e1) {
                        try {
                            const themeObj = map.Api.getTheme(themeId);
                            themeType = themeObj?.theme?.szFlag || themeObj?.theme?.type || '';
                        } catch (e2) {
                            themeType = theme.szFlag || theme.type || '';
                        }
                    }
                    
                    if (themeType && themeType.includes('CHART')) {
                        chartThemes.push({
                            id: themeId,
                            def: themeDef,
                            type: themeType
                        });
                        console.log('✅ Found CHART theme:', themeId);
                    }
                } catch (e) {
                    console.warn('⚠️ Error checking theme:', theme, e);
                }
            }
            
            if (chartThemes.length === 0) {
                console.warn('⚠️ No CHART themes found on map');
                return null;
            }
            
            // Extract field name directly from patterns like "size by X" or "set size from X"
            // Support field names with underscores, e.g., "percBU_km2_rate"
            let fieldNameCandidate = null;
            // Try to match quoted field names first (e.g., "size by 'percBU_km2_rate'")
            const sizeByPatternQuoted = /(?:size\s+by|set\s+size\s+from)\s+['"]([^'"]+)['"]/i;
            let match = query.match(sizeByPatternQuoted);
            if (match && match[1]) {
                fieldNameCandidate = match[1].trim();
            } else {
                // Try unquoted field name - match word characters and underscores
                // Patterns: "size by X", "set size from X"
                const sizeByPattern = /(?:size\s+by|set\s+size\s+from)\s+([\w_]+)/i;
                match = query.match(sizeByPattern);
                if (match && match[1]) {
                    fieldNameCandidate = match[1].trim();
                }
            }
            
            console.log('🔍 Extracted field name candidate:', fieldNameCandidate, 'from query:', query);
            
            // Try to find matching field in schemas
            let matchingField = null;
            let targetTheme = null;
            
            // CRITICAL: Prioritize exact matches to avoid partial matches (e.g., "BU_km2" matching "percBU_km2_rate")
            if (fieldNameCandidate) {
                const candidateLower = fieldNameCandidate.toLowerCase();
                const candidateNormalized = candidateLower.replace(/[_\s]/g, '');
                
                // First pass: try exact matches only (highest priority)
                for (const schema of schemas) {
                    if (schema.fields) {
                        const field = schema.fields.find(f => {
                            const fName = typeof f === 'string' ? f : (f.name || f.field || f.id || '');
                            const fNameLower = fName.toLowerCase();
                            const fNameNormalized = fNameLower.replace(/[_\s]/g, '');
                            
                            // Exact match (case-insensitive) - highest priority
                            return fNameLower === candidateLower || 
                                   fNameNormalized === candidateNormalized;
                        });
                        
                        if (field) {
                            matchingField = typeof field === 'string' ? field : (field.name || field.field || field.id);
                            console.log('✅ Found exact matching field:', matchingField);
                            
                            // Find a CHART theme for this schema
                            const chartTheme = chartThemes.find(ct => {
                                return ct.id === schema.theme || 
                                       schema.themeTitle?.toLowerCase().includes(ct.id.toLowerCase()) ||
                                       ct.id.toLowerCase().includes(schema.theme?.toLowerCase());
                            });
                            if (chartTheme) {
                                targetTheme = chartTheme;
                            } else if (chartThemes.length > 0) {
                                targetTheme = chartThemes[0];
                            }
                            break;
                        }
                    }
                }
                
                // Second pass: if no exact match, try substring match where field name contains the candidate
                // Prefer longer field names to avoid partial matches
                if (!matchingField) {
                    let bestMatch = null;
                    let bestMatchLength = 0;
                    
                    for (const schema of schemas) {
                        if (schema.fields) {
                            schema.fields.forEach(f => {
                                const fName = typeof f === 'string' ? f : (f.name || f.field || f.id || '');
                                const fNameLower = fName.toLowerCase();
                                
                                // Check if field name contains the candidate (not the other way around)
                                // This ensures "percBU_km2_rate" matches "percBU_km2_rate", not "BU_km2"
                                if (fNameLower.includes(candidateLower) && fName.length > bestMatchLength) {
                                    bestMatch = f;
                                    bestMatchLength = fName.length;
                                }
                            });
                        }
                    }
                    
                    if (bestMatch) {
                        matchingField = typeof bestMatch === 'string' ? bestMatch : (bestMatch.name || bestMatch.field || bestMatch.id);
                        console.log('✅ Found substring matching field:', matchingField, '(longest match)');
                        
                        // Find a CHART theme
                        const schema = schemas.find(s => s.fields && s.fields.includes(bestMatch));
                        if (schema) {
                            const chartTheme = chartThemes.find(ct => {
                                return ct.id === schema.theme || 
                                       schema.themeTitle?.toLowerCase().includes(ct.id.toLowerCase()) ||
                                       ct.id.toLowerCase().includes(schema.theme?.toLowerCase());
                            });
                            if (chartTheme) {
                                targetTheme = chartTheme;
                            } else if (chartThemes.length > 0) {
                                targetTheme = chartThemes[0];
                            }
                        }
                    }
                }
            }
            
            // If no field found and no field was specified, provide helpful suggestions
            if (!matchingField || !targetTheme) {
                console.warn('⚠️ Cannot apply size: matchingField =', matchingField, 'targetTheme =', targetTheme);
                
                // If user asked to set size but no field was nominated, provide helpful suggestions
                const detectedLanguage = parsed.detectedLanguage || 'en';
                const languageMessages = {
                    'en': {
                        title: 'How to Set Bubble Size',
                        intro: 'To set bubble size, you need to specify which numeric data field to use. Here are some options:',
                        examples: [
                            'Say "set size by [field name]" - for example: "set size by population" or "set size by area"',
                            'Specify a numeric field from a CHART layer (e.g., "set size by population", "set size by value")'
                        ],
                        availableFields: 'Available numeric fields from CHART layers:',
                        noFields: 'No numeric fields are currently available in CHART layers. Please load data with CHART themes first.'
                    },
                    'de': {
                        title: 'Wie man die Blasengröße einstellt',
                        intro: 'Um die Blasengröße einzustellen, müssen Sie angeben, welches numerische Datenfeld verwendet werden soll. Hier sind einige Optionen:',
                        examples: [
                            'Sagen Sie "Größe nach [Feldname]" - zum Beispiel: "Größe nach Bevölkerung" oder "Größe nach Fläche"',
                            'Geben Sie ein numerisches Feld aus einer CHART-Ebene an (z.B. "Größe nach Bevölkerung", "Größe nach Wert")'
                        ],
                        availableFields: 'Verfügbare numerische Felder aus CHART-Ebenen:',
                        noFields: 'Derzeit sind keine numerischen Felder in CHART-Ebenen verfügbar. Bitte laden Sie zuerst Daten mit CHART-Themen.'
                    },
                    'it': {
                        title: 'Come impostare la dimensione delle bolle',
                        intro: 'Per impostare la dimensione delle bolle, è necessario specificare quale campo dati numerico utilizzare. Ecco alcune opzioni:',
                        examples: [
                            'Dì "dimensione per [nome campo]" - ad esempio: "dimensione per popolazione" o "dimensione per area"',
                            'Specifica un campo numerico da un livello CHART (es. "dimensione per popolazione", "dimensione per valore")'
                        ],
                        availableFields: 'Campi numerici disponibili dai livelli CHART:',
                        noFields: 'Attualmente non ci sono campi numerici disponibili nei livelli CHART. Si prega di caricare prima i dati con temi CHART.'
                    },
                    'fr': {
                        title: 'Comment définir la taille des bulles',
                        intro: 'Pour définir la taille des bulles, vous devez spécifier quel champ de données numériques utiliser. Voici quelques options:',
                        examples: [
                            'Dites "taille par [nom du champ]" - par exemple: "taille par population" ou "taille par superficie"',
                            'Spécifiez un champ numérique d\'une couche CHART (ex. "taille par population", "taille par valeur")'
                        ],
                        availableFields: 'Champs numériques disponibles des couches CHART:',
                        noFields: 'Aucun champ numérique n\'est actuellement disponible dans les couches CHART. Veuillez d\'abord charger des données avec des thèmes CHART.'
                    },
                    'es': {
                        title: 'Cómo establecer el tamaño de las burbujas',
                        intro: 'Para establecer el tamaño de las burbujas, debe especificar qué campo de datos numérico usar. Aquí hay algunas opciones:',
                        examples: [
                            'Diga "tamaño por [nombre del campo]" - por ejemplo: "tamaño por población" o "tamaño por área"',
                            'Especifique un campo numérico de una capa CHART (ej. "tamaño por población", "tamaño por valor")'
                        ],
                        availableFields: 'Campos numéricos disponibles de las capas CHART:',
                        noFields: 'Actualmente no hay campos numéricos disponibles en las capas CHART. Por favor, cargue primero datos con temas CHART.'
                    }
                };
                
                const messages = languageMessages[detectedLanguage] || languageMessages['en'];
                
                // Get numeric fields from CHART layer schemas only
                const numericFields = [];
                const chartThemeIds = chartThemes.map(ct => ct.id.toLowerCase());
                
                for (const schema of schemas) {
                    // Only include schemas that belong to CHART themes
                    const schemaThemeId = (schema.theme || '').toLowerCase();
                    const isChartSchema = chartThemeIds.some(ctId => 
                        ctId === schemaThemeId || 
                        schemaThemeId.includes(ctId) || 
                        ctId.includes(schemaThemeId)
                    );
                    
                    if (isChartSchema && schema.fields && schema.fields.length > 0) {
                        for (const field of schema.fields) {
                            const fieldName = typeof field === 'string' ? field : (field.name || field.field || field.id || '');
                            if (fieldName && fieldName !== 'geometry' && fieldName !== 'Geometry' && fieldName !== 'GEOMETRY') {
                                // Check if field is numeric by checking schema type or field name pattern
                                const fieldInfo = typeof field === 'string' ? null : field;
                                const fieldType = fieldInfo?.type || fieldInfo?.typ || '';
                                const typeLower = fieldType.toLowerCase();
                                
                                // Consider numeric if:
                                // 1. Type indicates numeric (number, int, float, double, etc.)
                                // 2. Type doesn't indicate textual (string, text, varchar, char)
                                // 3. Field name suggests numeric (has common numeric keywords)
                                const isNumericType = typeLower && (
                                    typeLower.includes('number') || 
                                    typeLower.includes('int') || 
                                    typeLower.includes('float') || 
                                    typeLower.includes('double') || 
                                    typeLower.includes('decimal')
                                );
                                const isTextualType = typeLower && (
                                    typeLower.includes('string') || 
                                    typeLower.includes('text') || 
                                    typeLower.includes('varchar') || 
                                    typeLower.includes('char')
                                );
                                
                                // Only add if it's numeric or if type is not specified (we'll let the user try)
                                // But prefer fields that are clearly numeric
                                if (!isTextualType && (isNumericType || !fieldType)) {
                                    // Avoid duplicates
                                    if (!numericFields.includes(fieldName)) {
                                        numericFields.push(fieldName);
                                    }
                                }
                            }
                        }
                    }
                }
                
                let response = `📏 **${messages.title}**\n\n${messages.intro}\n\n`;
                
                for (const example of messages.examples) {
                    response += `• ${example}\n`;
                }
                
                response += `\n${messages.availableFields}\n`;
                
                if (numericFields.length > 0) {
                    // Show up to 10 numeric fields as examples
                    const fieldsToShow = numericFields.slice(0, 10);
                    response += fieldsToShow.map(f => `  • ${f}`).join('\n');
                    if (numericFields.length > 10) {
                        response += `\n  ... and ${numericFields.length - 10} more fields`;
                    }
                    response += `\n\n💡 **Example:** Try saying "set size by ${fieldsToShow[0]}"`;
                } else {
                    response += `\n${messages.noFields}`;
                }
                
                return {
                    items: [],
                    response: response,
                    count: 0,
                    query: { method: 'sizefield', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Apply size to CHART theme
            if (matchingField && targetTheme) {
                try {
                    const mapApi = map.Api;
                    const themeId = targetTheme.id;
                    const currentType = targetTheme.type || '';
                    
                    console.log('🎨 Applying size to theme:', themeId);
                    console.log('🎨 Current type:', currentType);
                    console.log('🎨 Matching field:', matchingField);
                    
                    // Add SIZE to type if not already present and ensure it's BUBBLE
                    let newType = currentType;
                    if (!newType.includes('SIZE')) {
                        if (newType.includes('CHART|DOT')) {
                            newType = newType.replace('CHART|DOT', 'CHART|BUBBLE|SIZE');
                        } else if (newType.includes('CHART')) {
                            if (newType.includes('CHART|BUBBLE')) {
                                newType = newType.replace('CHART|BUBBLE', 'CHART|BUBBLE|SIZE');
                            } else if (newType.includes('CHART|SYMBOL')) {
                                newType = newType.replace('CHART|SYMBOL', 'CHART|BUBBLE|SIZE');
                            } else {
                                newType = newType.replace(/CHART(\|)?/, 'CHART|BUBBLE|SIZE$1');
                            }
                        }
                    }
                    
                    // Apply changes
                    try {
                        if (newType !== currentType) {
                            mapApi.changeThemeStyle(themeId, `type:${newType}`, "set");
                        }
                        mapApi.changeThemeStyle(themeId, `sizefield:${matchingField}`, "set");
                        mapApi.changeThemeStyle(themeId, `fillopacity:0.7`, "set");
                    } catch (styleError) {
                        console.error('❌ Error applying styles:', styleError);
                        const combinedStyle = `type:${newType};sizefield:${matchingField};fillopacity:0.7`;
                        mapApi.changeThemeStyle(themeId, combinedStyle, "set");
                    }
                    
                    // Get theme title for comprehensive message
                    let themeTitle = themeId;
                    try {
                        const themeObj = mapApi.getTheme(themeId);
                        if (themeObj && themeObj.szTitle) {
                            themeTitle = themeObj.szTitle;
                        } else if (targetTheme && targetTheme.def && targetTheme.def.szTitle) {
                            themeTitle = targetTheme.def.szTitle;
                        }
                    } catch (e) {
                        // Use themeId if title not available
                    }
                    
                    const detectedLanguage = this.detectLanguage(query);
                    const responseMsg = detectedLanguage === 'it' 
                        ? `✅ Dimensione configurata con successo!\n\nHo configurato le bolle dimensionate sul tema "${themeTitle}" utilizzando il campo "${matchingField}". La dimensione delle bolle ora riflette i valori numerici di questo campo, con valori più grandi rappresentati da bolle più grandi.`
                        : detectedLanguage === 'de'
                        ? `✅ Größe erfolgreich konfiguriert!\n\nIch habe größenbasierte Blasen auf dem Theme "${themeTitle}" konfiguriert, das das Feld "${matchingField}" verwendet. Die Blasengröße spiegelt nun die numerischen Werte dieses Feldes wider, wobei größere Werte durch größere Blasen dargestellt werden.`
                        : detectedLanguage === 'fr'
                        ? `✅ Taille configurée avec succès!\n\nJ'ai configuré des bulles dimensionnées sur le thème "${themeTitle}" en utilisant le champ "${matchingField}". La taille des bulles reflète maintenant les valeurs numériques de ce champ, les valeurs plus grandes étant représentées par des bulles plus grandes.`
                        : detectedLanguage === 'es'
                        ? `✅ ¡Tamaño configurado con éxito!\n\nHe configurado burbujas dimensionadas en el tema "${themeTitle}" utilizando el campo "${matchingField}". El tamaño de las burbujas ahora refleja los valores numéricos de este campo, con valores más grandes representados por burbujas más grandes.`
                        : `✅ Size configured successfully!\n\nI've configured sized bubbles on the theme "${themeTitle}" using the field "${matchingField}". The bubble size now reflects the numeric values of this field, with larger values represented by larger bubbles.`;
                    
                    return {
                        items: [],
                        response: responseMsg,
                        count: 0,
                        query: { method: 'sizefield', sql: '', field: matchingField, theme: themeId },
                        modelUsed: parsed.modelUsed || null // Include which model was used for parsing
                    };
                } catch (e) {
                    console.error('❌ Error applying size to CHART theme:', e);
                    return null;
                }
            }
            
            return null;
        },
        
        /**
         * Handle "themes" query - show list of themes with action buttons
         * @param {String} query - Original query
         * @param {String} queryLower - Lowercase query
         * @param {Array} schemas - Available schemas
         * @param {Object} parsed - Parsed query result
         * @returns {Promise<Object|null>} Result object or null if not handled
         */
        handleThemesList: async function(query, queryLower, schemas, parsed) {
            const map = this.getMap();
            const detectedLanguage = parsed.detectedLanguage || 'en';
            
            if (!map || !map.Api) {
                const noMapMsg = detectedLanguage === 'it' 
                    ? '⚠️ Impossibile elencare i temi: la mappa non è disponibile.'
                    : detectedLanguage === 'de'
                    ? '⚠️ Kann Themen nicht auflisten: Karte ist nicht verfügbar.'
                    : detectedLanguage === 'fr'
                    ? '⚠️ Impossible de lister les thèmes: la carte n\'est pas disponible.'
                    : detectedLanguage === 'es'
                    ? '⚠️ No se pueden listar los temas: el mapa no está disponible.'
                    : '⚠️ Cannot list themes: map is not available.';
                return {
                    items: [],
                    response: noMapMsg,
                    count: 0,
                    query: { method: 'themes', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Get all themes - ALWAYS use map API (not project JSON) to ensure consistent list
            // This ensures the same themes list regardless of AI API status
            let allThemes = [];
            try {
                if (map.Themes && map.Themes.getThemes) {
                    allThemes = map.Themes.getThemes();
                } else if (map.Api && map.Api.getAllThemes) {
                    allThemes = map.Api.getAllThemes();
                }
            } catch (e) {
                console.warn('Could not get themes:', e);
                return null;
            }
            
            if (allThemes.length === 0) {
                const noThemesMsg = detectedLanguage === 'it' 
                    ? 'ℹ️ Nessun tema disponibile sulla mappa.'
                    : detectedLanguage === 'de'
                    ? 'ℹ️ Keine Themen auf der Karte verfügbar.'
                    : detectedLanguage === 'fr'
                    ? 'ℹ️ Aucun thème disponible sur la carte.'
                    : detectedLanguage === 'es'
                    ? 'ℹ️ No hay temas disponibles en el mapa.'
                    : 'ℹ️ No themes available on the map.';
                return {
                    items: [],
                    response: noThemesMsg,
                    count: 0,
                    query: { method: 'themes', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Build theme list with buttons
            const languageMessages = {
                'en': {
                    title: 'Available Themes',
                    name: 'Name',
                    titleLabel: 'Title',
                    type: 'Type',
                    noTitle: '(no title)'
                },
                'de': {
                    title: 'Verfügbare Themen',
                    name: 'Name',
                    titleLabel: 'Titel',
                    type: 'Typ',
                    noTitle: '(kein Titel)'
                },
                'it': {
                    title: 'Temi Disponibili',
                    name: 'Nome',
                    titleLabel: 'Titolo',
                    type: 'Tipo',
                    noTitle: '(nessun titolo)'
                },
                'fr': {
                    title: 'Thèmes Disponibles',
                    name: 'Nom',
                    titleLabel: 'Titre',
                    type: 'Type',
                    noTitle: '(pas de titre)'
                },
                'es': {
                    title: 'Temas Disponibles',
                    name: 'Nombre',
                    titleLabel: 'Título',
                    type: 'Tipo',
                    noTitle: '(sin título)'
                }
            };
            
            const messages = languageMessages[detectedLanguage] || languageMessages['en'];
            
            let response = `🎨 **${messages.title}**\n\n`;
            
            // Add themes structure at the top
            const themesStructure = this.generateThemesStructure(detectedLanguage);
            if (themesStructure) {
                response += themesStructure;
                response += `\n\n`;
            }
            
            for (let i = 0; i < allThemes.length; i++) {
                const theme = allThemes[i];
                try {
                    const themeId = theme.szId || theme.id || theme.name || 'unknown';
                    
                    // Get theme definition to extract title, type, and layer name
                    let themeTitle = themeId;
                    let themeType = '';
                    let layerName = '';
                    
                    try {
                        const themeDef = map.Api.getMapThemeDefinitionObj(themeId);
                        if (themeDef && themeDef.szTitle) {
                            themeTitle = themeDef.szTitle;
                        }
                        themeType = themeDef?.style?.type || themeDef?.type || theme.szFlag || theme.type || '';
                        layerName = themeDef?.layer || '';
                    } catch (e1) {
                        try {
                            const themeObj = map.Api.getTheme(themeId);
                            if (themeObj && themeObj.szTitle) {
                                themeTitle = themeObj.szTitle;
                            } else if (themeObj && themeObj.theme && themeObj.theme.szTitle) {
                                themeTitle = themeObj.theme.szTitle;
                            }
                            themeType = themeObj?.theme?.szFlag || themeObj?.theme?.type || theme.szFlag || theme.type || '';
                            
                            // Get layer name from theme object
                            if (themeObj.theme && themeObj.theme.szLayer) {
                                layerName = themeObj.theme.szLayer;
                            } else if (themeObj.szLayer) {
                                layerName = themeObj.szLayer;
                            } else if (themeObj.theme && themeObj.theme.layer) {
                                layerName = themeObj.theme.layer;
                            } else if (themeObj.layer) {
                                layerName = themeObj.layer;
                            }
                        } catch (e2) {
                            themeType = theme.szFlag || theme.type || '';
                        }
                    }
                    
                    // Format theme type for display
                    const typeDisplay = themeType ? themeType.replace(/\|/g, ' | ') : '(no type)';
                    
                    // Use theme ID as the title, with 1-based index reference (theme 1, theme 2, etc.)
                    const themeNumber = i + 1;
                    response += `### ${themeNumber}. ${themeId} (theme ${themeNumber})\n`;
                    if (layerName) {
                        response += `- **Layer:** \`${layerName}\`\n`;
                    }
                    if (themeTitle !== themeId) {
                        response += `- **${messages.titleLabel}:** ${themeTitle}\n`;
                    }
                    response += `- **${messages.type}:** ${typeDisplay}\n`;
                    
                    // Add action buttons with small monochrome icons and text (gray, no tooltips)
                    const buttons = [];
                    buttons.push(`<button class="action-button" data-action="show-data" data-theme-id="${themeId}" aria-label="Show Data"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"></path></svg><span>Show Data</span></button>`);
                    buttons.push(`<button class="action-button" data-action="show-facets" data-theme-id="${themeId}" aria-label="Show Facets"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg><span>Show Facets</span></button>`);
                    buttons.push(`<button class="action-button" data-action="edit-theme" data-theme-id="${themeId}" aria-label="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg><span>Edit</span></button>`);
                    buttons.push(`<button class="action-button" data-action="configure-theme" data-theme-id="${themeId}" aria-label="Configure"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="16" y2="16"></line><line x1="8" y1="20" x2="12" y2="20"></line></svg><span>Configure</span></button>`);
                    
                    response += buttons.join(' ');
                    response += `\n\n`;
                } catch (e) {
                    console.warn('Error processing theme:', theme, e);
                }
            }
            
            return {
                items: [],
                response: response,
                count: allThemes.length,
                query: { method: 'themes', sql: '' },
                modelUsed: parsed.modelUsed || null
            };
        },
        
        /**
         * Handle "show data of theme X" requests
         * @param {String} themeIdentifier - Theme identifier (theme0, theme1, theme ID, or layer name)
         * @param {String} query - Original query
         * @param {Object} parsed - Parsed query result
         * @returns {Promise<Object|null>} Result object or null if not handled
         */
        handleShowDataOfTheme: async function(themeIdentifier, query, parsed) {
            const map = this.getMap();
            const detectedLanguage = parsed.detectedLanguage || 'en';
            
            if (!map || !map.Api) {
                const noMapMsg = detectedLanguage === 'it' 
                    ? '⚠️ Impossibile mostrare i dati: la mappa non è disponibile.'
                    : detectedLanguage === 'de'
                    ? '⚠️ Kann Daten nicht anzeigen: Karte ist nicht verfügbar.'
                    : detectedLanguage === 'fr'
                    ? '⚠️ Impossible d\'afficher les données: la carte n\'est pas disponible.'
                    : detectedLanguage === 'es'
                    ? '⚠️ No se pueden mostrar los datos: el mapa no está disponible.'
                    : '⚠️ Cannot show data: map is not available.';
                return {
                    items: [],
                    response: noMapMsg,
                    count: 0,
                    query: { method: 'showdata', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Get all themes to resolve the identifier
            let allThemes = [];
            try {
                if (map.Themes && map.Themes.getThemes) {
                    allThemes = map.Themes.getThemes();
                } else if (map.Api && map.Api.getAllThemes) {
                    allThemes = map.Api.getAllThemes();
                }
            } catch (e) {
                console.warn('Could not get themes:', e);
                return null;
            }
            
            if (allThemes.length === 0) {
                const noThemesMsg = detectedLanguage === 'it' 
                    ? '⚠️ Nessun tema disponibile sulla mappa.'
                    : detectedLanguage === 'de'
                    ? '⚠️ Keine Themen auf der Karte verfügbar.'
                    : detectedLanguage === 'fr'
                    ? '⚠️ Aucun thème disponible sur la carte.'
                    : detectedLanguage === 'es'
                    ? '⚠️ No hay temas disponibles en el mapa.'
                    : '⚠️ No themes available on the map.';
                return {
                    items: [],
                    response: noThemesMsg,
                    count: 0,
                    query: { method: 'showdata', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Resolve theme identifier to theme ID
            let themeId = null;
            const identifierLower = themeIdentifier.toLowerCase();
            
            // Check if it's a numeric index (theme1, theme2, etc. or just "1", "2", etc.) - 1-based indexing
            // Also supports 0-based for backward compatibility
            const indexMatch = identifierLower.match(/^theme\s*(\d+)$|^(\d+)$/);
            if (indexMatch) {
                let index = parseInt(indexMatch[1] || indexMatch[2], 10);
                // Convert 1-based to 0-based (theme1 -> index 0, theme2 -> index 1, etc.)
                // But also support 0-based for backward compatibility (theme0 -> index 0)
                if (index > 0 && index <= allThemes.length) {
                    index = index - 1; // Convert 1-based to 0-based
                }
                if (index >= 0 && index < allThemes.length) {
                    const theme = allThemes[index];
                    themeId = theme.szId || theme.id || theme.name || null;
                }
            } else {
                // Try to match as theme ID or layer name
                for (const theme of allThemes) {
                    const candidateId = theme.szId || theme.id || theme.name || '';
                    if (candidateId.toLowerCase() === identifierLower) {
                        themeId = candidateId;
                        break;
                    }
                    
                    // Check layer name
                    try {
                        const themeDef = map.Api.getMapThemeDefinitionObj(candidateId);
                        const layerName = themeDef?.layer || '';
                        if (layerName && layerName.toLowerCase() === identifierLower) {
                            themeId = candidateId;
                            break;
                        }
                    } catch (e1) {
                        try {
                            const themeObj = map.Api.getTheme(candidateId);
                            const layerName = themeObj?.theme?.szLayer || themeObj?.szLayer || 
                                             themeObj?.theme?.layer || themeObj?.layer || '';
                            if (layerName && String(layerName).toLowerCase() === identifierLower) {
                                themeId = candidateId;
                                break;
                            }
                        } catch (e2) {
                            // Ignore
                        }
                    }
                }
            }
            
            if (!themeId) {
                const notFoundMsg = detectedLanguage === 'it' 
                    ? `⚠️ Tema "${themeIdentifier}" non trovato. Usa "themes" per vedere l'elenco dei temi disponibili.`
                    : detectedLanguage === 'de'
                    ? `⚠️ Theme "${themeIdentifier}" nicht gefunden. Verwenden Sie "themes", um die Liste der verfügbaren Themes anzuzeigen.`
                    : detectedLanguage === 'fr'
                    ? `⚠️ Thème "${themeIdentifier}" introuvable. Utilisez "themes" pour voir la liste des thèmes disponibles.`
                    : detectedLanguage === 'es'
                    ? `⚠️ Tema "${themeIdentifier}" no encontrado. Use "themes" para ver la lista de temas disponibles.`
                    : `⚠️ Theme "${themeIdentifier}" not found. Use "themes" to see the list of available themes.`;
                return {
                    items: [],
                    response: notFoundMsg,
                    count: 0,
                    query: { method: 'showdata', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Return a result that will trigger showDataTable in the chat handler
            // We'll use a special format that the chat handler can recognize
            const successMsg = detectedLanguage === 'it' 
                ? `✅ Apertura tabella dati per il tema "${themeId}"...`
                : detectedLanguage === 'de'
                ? `✅ Öffne Datentabelle für Theme "${themeId}"...`
                : detectedLanguage === 'fr'
                ? `✅ Ouverture du tableau de données pour le thème "${themeId}"...`
                : detectedLanguage === 'es'
                ? `✅ Abriendo tabla de datos para el tema "${themeId}"...`
                : `✅ Opening data table for theme "${themeId}"...`;
            
            return {
                items: [],
                response: successMsg,
                count: 0,
                query: { method: 'showdata', sql: '', theme: themeId },
                showDataTable: true, // Flag to trigger showDataTable
                themeId: themeId,
                modelUsed: parsed.modelUsed || null
            };
        },
        
        /**
         * Handle summary/aggregation queries
         * @param {String} query - User query
         * @param {Array} schemas - Available schemas
         * @returns {Promise<Object|null>} Aggregation results or null if not handled
         */
        handleSummaryQuery: async function(query, schemas) {
            const map = this.getMap();
            if (!map || !map.Api) {
                return null;
            }
            
            // Extract field name and theme name from query
            // Patterns: "total population in Palestinian Localities", "show me the total population", etc.
            const queryLower = query.toLowerCase();
            
            // Try to extract field name (e.g., "population", "pop")
            let fieldName = null;
            let themeName = null;
            
            // Pattern 1: "total X in Y" or "sum of X in Y"
            const pattern1 = /\b(total|sum|aggregate|add up)\s+(of\s+)?(the\s+)?(.+?)(\s+in\s+|\s+from\s+)(.+)$/i;
            const match1 = query.match(pattern1);
            if (match1) {
                fieldName = match1[4].trim();
                themeName = match1[6].trim();
            }
            
            // Pattern 2: "what is the total X in Y" or "show me the total X in Y"
            if (!fieldName) {
                const pattern2 = /\b(what\s+is\s+)?(show\s+me\s+)?(the\s+)?(total|sum)\s+(of\s+)?(the\s+)?(.+?)(\s+in\s+|\s+from\s+)(.+)$/i;
                const match2 = query.match(pattern2);
                if (match2) {
                    fieldName = match2[6].trim();
                    themeName = match2[8].trim();
                }
            }
            
            // Pattern 2b: "what is the total X in Y" - more specific pattern
            if (!fieldName) {
                const pattern2b = /\b(what\s+is\s+the\s+)?(total|sum)\s+(.+?)\s+in\s+(.+)$/i;
                const match2b = query.match(pattern2b);
                if (match2b) {
                    fieldName = match2b[3].trim();
                    themeName = match2b[4].trim();
                }
            }
            
            // Pattern 3: "show me the total X" or "what is the total X" (without theme)
            if (!fieldName) {
                const pattern3 = /\b(show\s+me\s+)?(what\s+is\s+)?(the\s+)?(total|sum)\s+(of\s+)?(the\s+)?(.+?)$/i;
                const match3 = query.match(pattern3);
                if (match3) {
                    fieldName = match3[6].trim();
                }
            }
            
            // Pattern 4: "how many X" or "count X"
            if (!fieldName) {
                const pattern4 = /\b(how\s+many|count)\s+(.+?)(\s+in\s+|\s+from\s+)?(.+)?$/i;
                const match4 = query.match(pattern4);
                if (match4) {
                    // For count queries, we count items, not a specific field
                    fieldName = '_count';
                    if (match4[4]) {
                        themeName = match4[4].trim();
                    } else {
                        themeName = match4[2].trim();
                    }
                }
            }
            
            // Get all themes
            let allThemes = [];
            try {
                if (map.Themes && map.Themes.getThemes) {
                    allThemes = map.Themes.getThemes();
                } else if (map.Api && map.Api.getAllThemes) {
                    allThemes = map.Api.getAllThemes();
                }
            } catch (e) {
                console.warn('Could not get themes:', e);
                return null;
            }
            
            if (allThemes.length === 0) {
                return {
                    items: [],
                    response: '⚠️ No themes available on the map.',
                    count: 0,
                    query: { method: 'summary', sql: '' }
                };
            }
            
            // Find matching theme ID (not the theme object yet)
            let targetThemeId = null;
            
            if (themeName) {
                // Try to match theme by name/title
                const themeNameLower = themeName.toLowerCase();
                for (const theme of allThemes) {
                    const themeId = theme.szId || theme.id || theme.name || '';
                    try {
                        const themeObj = map.Api.getTheme(themeId);
                        const themeTitle = themeObj?.szTitle || themeObj?.theme?.szTitle || '';
                        const themeDef = map.Api.getMapThemeDefinitionObj(themeId);
                        const defTitle = themeDef?.meta?.title || themeDef?.szTitle || '';
                        
                        if (themeTitle.toLowerCase().includes(themeNameLower) ||
                            defTitle.toLowerCase().includes(themeNameLower) ||
                            themeId.toLowerCase().includes(themeNameLower)) {
                            targetThemeId = themeId;
                            break;
                        }
                    } catch (e) {
                        // Continue searching
                    }
                }
            }
            
            // If no theme specified or not found, use the first CHART|BUBBLE theme
            if (!targetThemeId) {
                for (const theme of allThemes) {
                    const themeId = theme.szId || theme.id || theme.name || '';
                    try {
                        const themeObj = map.Api.getTheme(themeId);
                        const themeType = themeObj?.theme?.szFlag || themeObj?.szFlag || '';
                        if (themeType && themeType.match(/CHART|BUBBLE/)) {
                            targetThemeId = themeId;
                            break;
                        }
                    } catch (e) {
                        // Continue searching
                    }
                }
            }
            
            // If still no theme, use the first available theme
            if (!targetThemeId && allThemes.length > 0) {
                targetThemeId = allThemes[0].szId || allThemes[0].id || allThemes[0].name || '';
            }
            
            if (!targetThemeId) {
                return {
                    items: [],
                    response: '⚠️ No suitable theme found for aggregation.',
                    count: 0,
                    query: { method: 'summary', sql: '' }
                };
            }
            
            // Get theme data using ixmaps.getThemeObj (same as facet.js)
            try {
                // Use ixmaps.getThemeObj to get the proper theme object structure
                let objTheme = null;
                if (typeof ixmaps !== 'undefined' && ixmaps.getThemeObj) {
                    objTheme = ixmaps.getThemeObj(targetThemeId);
                } else {
                    return {
                        items: [],
                        response: '⚠️ Theme data access not available. Please ensure ixmaps is loaded.',
                        count: 0,
                        query: { method: 'summary', sql: '' }
                    };
                }
                
                if (!objTheme || !objTheme.objTheme) {
                    return {
                        items: [],
                        response: '⚠️ Theme data structure not available. Theme may still be loading.',
                        count: 0,
                        query: { method: 'summary', sql: '' }
                    };
                }
                
                const dbRecords = objTheme.objTheme.dbRecords;
                if (!dbRecords || !Array.isArray(dbRecords) || dbRecords.length === 0) {
                    return {
                        items: [],
                        response: '⚠️ No data records available for this theme.',
                        count: 0,
                        query: { method: 'summary', sql: '' }
                    };
                }
                
                // Collect records from theme (similar to facet.js collectRecords)
                const records = [];
                if (objTheme.indexA && objTheme.itemA) {
                    for (const index of objTheme.indexA) {
                        const item = objTheme.itemA[index];
                        if (item?.dbIndex != null && dbRecords[item.dbIndex]) {
                            records.push(dbRecords[item.dbIndex]);
                        }
                        if (Array.isArray(item?.dbIndexA)) {
                            for (const dbIndex of item.dbIndexA) {
                                if (dbRecords[dbIndex]) {
                                    records.push(dbRecords[dbIndex]);
                                }
                            }
                        }
                    }
                } else {
                    // Fallback: use all records
                    records.push(...dbRecords);
                }
                
                if (records.length === 0) {
                    return {
                        items: [],
                        response: '⚠️ No visible data items found in this theme.',
                        count: 0,
                        query: { method: 'summary', sql: '' }
                    };
                }
                
                // Get the value field from theme binding
                const binding = objTheme.objTheme.theme?.binding || objTheme.objTheme.binding || {};
                const valueField = binding.value || binding.size || null;
                
                // Get all available field names from first record
                const availableFields = records.length > 0 ? Object.keys(records[0]) : [];
                
                // Helper function to find matching field name
                const findMatchingField = (searchName, fields, preferredField = null) => {
                    if (!searchName) return preferredField;
                    
                    const searchLower = searchName.toLowerCase();
                    const exactMatches = [];
                    const partialMatches = [];
                    
                    // First, try exact match
                    for (const field of fields) {
                        if (field.toLowerCase() === searchLower) {
                            return field;
                        }
                    }
                    
                    // Then try contains match (both directions)
                    for (const field of fields) {
                        const fieldLower = field.toLowerCase();
                        if (fieldLower.includes(searchLower)) {
                            exactMatches.push(field);
                        } else if (searchLower.includes(fieldLower)) {
                            partialMatches.push(field);
                        }
                    }
                    
                    // Return first exact match, then first partial match, then preferred field
                    if (exactMatches.length > 0) {
                        return exactMatches[0];
                    }
                    if (partialMatches.length > 0) {
                        return partialMatches[0];
                    }
                    
                    return preferredField;
                };
                
                // Helper function to check if a field is numeric
                const isNumericField = (fieldName) => {
                    let numericCount = 0;
                    let totalCount = 0;
                    for (const record of records.slice(0, Math.min(100, records.length))) {
                        const value = record[fieldName];
                        if (value !== null && value !== undefined && value !== '') {
                            totalCount++;
                            const str = String(value);
                            const cleaned = str.replace(/[,\s]/g, '');
                            if (!isNaN(parseFloat(cleaned)) && isFinite(parseFloat(cleaned))) {
                                numericCount++;
                            }
                        }
                    }
                    return totalCount > 0 && numericCount / totalCount > 0.7; // 70% numeric threshold
                };
                
                // If fieldName was specified, try to match it to a field
                let actualFieldName = valueField;
                if (fieldName && fieldName !== '_count') {
                    // Try to find matching field name
                    actualFieldName = findMatchingField(fieldName, availableFields, valueField);
                    
                    // If still no match, try common variations
                    if (!actualFieldName) {
                        const fieldNameLower = fieldName.toLowerCase();
                        // Try common field name patterns
                        if (fieldNameLower.includes('pop')) {
                            actualFieldName = findMatchingField('population', availableFields, null) ||
                                            findMatchingField('pop', availableFields, null);
                        }
                    }
                }
                
                // If still no field, try to find any numeric field
                if (!actualFieldName || actualFieldName === null) {
                    // Try to find a numeric field
                    for (const field of availableFields) {
                        if (isNumericField(field)) {
                            actualFieldName = field;
                            break;
                        }
                    }
                }
                
                // Extract and aggregate values
                let sum = 0;
                let count = 0;
                let min = null;
                let max = null;
                const values = [];
                
                // Helper function to parse numeric values (from facet.js scanValue)
                const scanValue = (value) => {
                    const str = String(value);
                    if (str.match(/:/)) {
                        return null; // Skip dates
                    }
                    if (str.match(/,/)) {
                        return parseFloat(str.replace(/\./g, "").replace(/,/g, "."));
                    }
                    return parseFloat(str.replace(/ /g, ""));
                };
                
                if (fieldName === '_count') {
                    // Count query: just count records
                    count = records.length;
                } else if (actualFieldName) {
                    // Extract numeric values from the field
                    for (const record of records) {
                        const value = record[actualFieldName];
                        if (value !== null && value !== undefined && value !== '') {
                            const numValue = scanValue(value);
                            if (!isNaN(numValue) && isFinite(numValue)) {
                                values.push(numValue);
                                sum += numValue;
                                count++;
                                if (min === null || numValue < min) {
                                    min = numValue;
                                }
                                if (max === null || numValue > max) {
                                    max = numValue;
                                }
                            }
                        }
                    }
                } else {
                    // Last resort: list available fields for debugging
                    const fieldList = availableFields.slice(0, 10).join(', ');
                    return {
                        items: [],
                        response: `⚠️ Could not identify numeric field for aggregation.\n\nAvailable fields: ${fieldList}${availableFields.length > 10 ? '...' : ''}\n\nPlease specify the field name in your query (e.g., "total [field name] in [theme]").`,
                        count: 0,
                        query: { method: 'summary', sql: '' }
                    };
                }
                
                // Get theme title
                let themeTitle = targetThemeId;
                try {
                    const themeObj = map.Api.getTheme(targetThemeId);
                    if (themeObj?.szTitle) {
                        themeTitle = themeObj.szTitle;
                    } else if (themeObj?.theme?.szTitle) {
                        themeTitle = themeObj.theme.szTitle;
                    } else {
                        const themeDef = map.Api.getMapThemeDefinitionObj(targetThemeId);
                        if (themeDef?.meta?.title) {
                            themeTitle = themeDef.meta.title;
                        } else if (themeDef?.szTitle) {
                            themeTitle = themeDef.szTitle;
                        }
                    }
                } catch (e) {
                    // Use themeId as fallback
                }
                let response = `📊 **Summary: ${themeTitle}**\n\n`;
                
                if (fieldName === '_count') {
                    response += `Total Count: **${count.toLocaleString()}** items\n`;
                } else {
                    if (count > 0) {
                        const average = sum / count;
                        response += `Total ${actualFieldName || fieldName}: **${sum.toLocaleString()}**\n`;
                        response += `Number of Items: **${count.toLocaleString()}**\n`;
                        response += `Average: **${average.toLocaleString(undefined, { maximumFractionDigits: 2 })}**\n`;
                        if (min !== null && max !== null) {
                            response += `Range: **${min.toLocaleString()}** - **${max.toLocaleString()}**\n`;
                        }
                    } else {
                        response += `⚠️ No valid numeric values found in field "${actualFieldName || fieldName}".\n`;
                    }
                }
                
                // Get units from theme style if available
                const style = objTheme.objTheme.theme?.style || objTheme.objTheme.style || {};
                const units = style.units || '';
                if (units && fieldName !== '_count') {
                    response += `\n*Units: ${units}*`;
                }
                
                return {
                    items: [],
                    response: response,
                    count: count,
                    query: { method: 'summary', sql: '', theme: targetThemeId, field: actualFieldName },
                    summary: {
                        sum: sum,
                        count: count,
                        average: count > 0 ? sum / count : 0,
                        min: min,
                        max: max
                    }
                };
                
            } catch (error) {
                console.error('Error in handleSummaryQuery:', error);
                return {
                    items: [],
                    response: `⚠️ Error processing summary query: ${error.message}`,
                    count: 0,
                    query: { method: 'summary', sql: '' }
                };
            }
        },
        
        /**
         * Handle color matching requests for categorical themes
         * @param {String} query - User query
         * @param {Array} schemas - Available schemas
         * @returns {Promise<Object|null>} Color matching results or null if not handled
         */
        handleColorMatching: async function(query, schemas) {
            const map = this.getMap();
            if (!map || !map.Api) {
                return null;
            }
            
            // Extract theme name from query if specified
            const queryLower = query.toLowerCase();
            let themeName = null;
            
            // Pattern 1: "match colors to values in [theme]"
            const pattern1 = /(?:match|assign|suggest|recommend|choose)\s+colors?\s+(?:to|for|by)\s+(?:the\s+)?(?:values?|categories?|meaning|signification)(?:\s+in\s+|\s+for\s+|\s+of\s+)(.+)$/i;
            const match1 = query.match(pattern1);
            if (match1) {
                themeName = match1[1].trim();
            }
            
            // Pattern 2: "match colors in [theme]"
            if (!themeName) {
                const pattern2 = /(?:match|assign|suggest|recommend|choose)\s+colors?\s+(?:in\s+|for\s+|of\s+)(.+)$/i;
                const match2 = query.match(pattern2);
                if (match2) {
                    themeName = match2[1].trim();
                }
            }
            
            // Get all themes
            let allThemes = [];
            try {
                if (map.Themes && map.Themes.getThemes) {
                    allThemes = map.Themes.getThemes();
                } else if (map.Api && map.Api.getAllThemes) {
                    allThemes = map.Api.getAllThemes();
                }
            } catch (e) {
                console.warn('Could not get themes:', e);
                return null;
            }
            
            if (allThemes.length === 0) {
                return {
                    items: [],
                    response: '⚠️ No themes available on the map.',
                    count: 0,
                    query: { method: 'colormatching', sql: '' }
                };
            }
            
            // Find matching theme ID
            let targetThemeId = null;
            
            if (themeName) {
                // Try to match theme by name/title
                const themeNameLower = themeName.toLowerCase();
                for (const theme of allThemes) {
                    const themeId = theme.szId || theme.id || theme.name || '';
                    try {
                        const themeObj = map.Api.getTheme(themeId);
                        const themeTitle = themeObj?.szTitle || themeObj?.theme?.szTitle || '';
                        const themeDef = map.Api.getMapThemeDefinitionObj(themeId);
                        const defTitle = themeDef?.meta?.title || themeDef?.szTitle || '';
                        
                        if (themeTitle.toLowerCase().includes(themeNameLower) ||
                            defTitle.toLowerCase().includes(themeNameLower) ||
                            themeId.toLowerCase().includes(themeNameLower)) {
                            targetThemeId = themeId;
                            break;
                        }
                    } catch (e) {
                        // Continue searching
                    }
                }
            }
            
            // If no theme specified or not found, look for CATEGORICAL themes
            if (!targetThemeId) {
                for (const theme of allThemes) {
                    const themeId = theme.szId || theme.id || theme.name || '';
                    try {
                        const themeObj = map.Api.getTheme(themeId);
                        const themeType = themeObj?.theme?.szFlag || themeObj?.szFlag || '';
                        const themeDef = map.Api.getMapThemeDefinitionObj(themeId);
                        const defType = themeDef?.style?.type || '';
                        const combinedType = themeType + '|' + defType;
                        
                        if (combinedType.toUpperCase().includes('CATEGORICAL')) {
                            targetThemeId = themeId;
                            break;
                        }
                    } catch (e) {
                        // Continue searching
                    }
                }
            }
            
            // If still no theme, use the first available theme
            if (!targetThemeId && allThemes.length > 0) {
                targetThemeId = allThemes[0].szId || allThemes[0].id || allThemes[0].name || '';
            }
            
            if (!targetThemeId) {
                return {
                    items: [],
                    response: '⚠️ No suitable theme found for color matching.',
                    count: 0,
                    query: { method: 'colormatching', sql: '' }
                };
            }
            
            // Validate that the theme is CATEGORICAL
            try {
                const themeObj = map.Api.getTheme(targetThemeId);
                const themeType = themeObj?.theme?.szFlag || themeObj?.szFlag || '';
                const themeDef = map.Api.getMapThemeDefinitionObj(targetThemeId);
                const defType = themeDef?.style?.type || '';
                const combinedType = themeType + '|' + defType;
                
                if (!combinedType.toUpperCase().includes('CATEGORICAL')) {
                    return {
                        items: [],
                        response: '⚠️ Color matching is only available for categorical themes. This theme is not categorical.',
                        count: 0,
                        query: { method: 'colormatching', sql: '' }
                    };
                }
                
                // Get the categorical field - check multiple sources
                let categoricalField = themeDef?.field || 
                                     themeDef?.style?.colorfield || 
                                     themeDef?.binding?.color || 
                                     themeDef?.binding?.value ||
                                     themeObj?.theme?.field || 
                                     themeObj?.theme?.szField ||
                                     null;
                
                // If still not found, check binding structure
                if (!categoricalField && themeDef?.binding) {
                    const binding = themeDef.binding;
                    categoricalField = binding.color || binding.value || binding.field || null;
                }
                
                if (!categoricalField) {
                    // Try to get from style binding
                    if (themeDef?.style?.binding) {
                        const styleBinding = themeDef.style.binding;
                        categoricalField = styleBinding.color || styleBinding.value || styleBinding.field || null;
                    }
                }
                
                if (!categoricalField) {
                    return {
                        items: [],
                        response: '⚠️ Could not identify the categorical field for this theme. Please ensure the theme has a field configured for coloring.',
                        count: 0,
                        query: { method: 'colormatching', sql: '' }
                    };
                }
                
                // Get theme data using ixmaps.getThemeObj
                let objTheme = null;
                if (typeof ixmaps !== 'undefined' && ixmaps.getThemeObj) {
                    objTheme = ixmaps.getThemeObj(targetThemeId);
                } else {
                    return {
                        items: [],
                        response: '⚠️ Theme data access not available. Please ensure ixmaps is loaded.',
                        count: 0,
                        query: { method: 'colormatching', sql: '' }
                    };
                }
                
                if (!objTheme || !objTheme.objTheme) {
                    return {
                        items: [],
                        response: '⚠️ Theme data structure not available. Theme may still be loading.',
                        count: 0,
                        query: { method: 'colormatching', sql: '' }
                    };
                }
                
                const dbRecords = objTheme.objTheme.dbRecords;
                if (!dbRecords || !Array.isArray(dbRecords) || dbRecords.length === 0) {
                    return {
                        items: [],
                        response: '⚠️ No data records available for this theme.',
                        count: 0,
                        query: { method: 'colormatching', sql: '' }
                    };
                }
                
                // Collect records from theme (similar to handleSummaryQuery)
                const records = [];
                if (objTheme.indexA && objTheme.itemA) {
                    for (const index of objTheme.indexA) {
                        const item = objTheme.itemA[index];
                        if (item?.dbIndex != null && dbRecords[item.dbIndex]) {
                            records.push(dbRecords[item.dbIndex]);
                        }
                        if (Array.isArray(item?.dbIndexA)) {
                            for (const dbIndex of item.dbIndexA) {
                                if (dbRecords[dbIndex]) {
                                    records.push(dbRecords[dbIndex]);
                                }
                            }
                        }
                    }
                } else {
                    // Fallback: use all records
                    records.push(...dbRecords);
                }
                
                if (records.length === 0) {
                    return {
                        items: [],
                        response: '⚠️ No visible data items found in this theme.',
                        count: 0,
                        query: { method: 'colormatching', sql: '' }
                    };
                }
                
                // Extract unique values from the categorical field
                // Records might be arrays (indexed by field position) or objects (with field names as keys)
                const dbFields = objTheme.objTheme.dbFields || [];
                
                console.log('[Color Matching] Categorical field:', categoricalField);
                console.log('[Color Matching] DB Fields:', dbFields);
                console.log('[Color Matching] Records sample:', records.length > 0 ? records[0] : 'no records');
                
                // Create field index map (for array-based records)
                const fieldIndexMap = {};
                dbFields.forEach((field, idx) => {
                    const fieldName = typeof field === 'string' ? field : (field.id || field.name || field.field || String(field));
                    fieldIndexMap[fieldName] = idx;
                    // Also map case-insensitive
                    fieldIndexMap[fieldName.toLowerCase()] = idx;
                });
                
                // Find the field index - try exact match first, then case-insensitive
                let fieldIndex = fieldIndexMap[categoricalField];
                if (fieldIndex === undefined) {
                    fieldIndex = fieldIndexMap[categoricalField.toLowerCase()];
                }
                
                // Check if records are arrays or objects
                const isArrayBased = records.length > 0 && Array.isArray(records[0]);
                
                console.log('[Color Matching] Field index:', fieldIndex, 'isArrayBased:', isArrayBased);
                
                // Use Map to preserve insertion order (first appearance order)
                const uniqueValues = new Map(); // Map<value, firstIndex>
                const originalOrderValues = []; // Array to preserve original order
                let foundValues = 0;
                let checkedRecords = 0;
                
                for (const record of records) {
                    checkedRecords++;
                    let value = null;
                    
                    if (isArrayBased) {
                        // Records are arrays, access by index
                        if (fieldIndex !== undefined && fieldIndex >= 0 && record[fieldIndex] !== undefined) {
                            value = record[fieldIndex];
                        }
                    } else {
                        // Records are objects, access by field name
                        value = record[categoricalField];
                        // Try case-insensitive if direct access fails
                        if (value === undefined || value === null) {
                            const recordKeys = Object.keys(record);
                            for (const key of recordKeys) {
                                if (key.toLowerCase() === categoricalField.toLowerCase()) {
                                    value = record[key];
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (value !== null && value !== undefined && value !== '') {
                        const strValue = String(value).trim();
                        if (strValue.length > 0) {
                            // Only add if we haven't seen this value before (preserve first appearance order)
                            if (!uniqueValues.has(strValue)) {
                                uniqueValues.set(strValue, foundValues);
                                originalOrderValues.push(strValue);
                            }
                            foundValues++;
                        }
                    }
                }
                
                // Use original order of values (as they first appear in data), not sorted
                const sortedValues = originalOrderValues;
                
                if (sortedValues.length === 0) {
                    // Provide more detailed error message
                    const availableFields = isArrayBased 
                        ? dbFields.map((f, i) => typeof f === 'string' ? f : (f.id || f.name || f.field || `field${i}`)).slice(0, 10)
                        : (records.length > 0 ? Object.keys(records[0]).slice(0, 10) : []);
                    
                    let errorMsg = `⚠️ No unique values found in field "${categoricalField}".\n\n`;
                    errorMsg += `Checked ${checkedRecords} records, found ${foundValues} non-empty values.\n\n`;
                    
                    if (isArrayBased && fieldIndex === undefined) {
                        errorMsg += `Field "${categoricalField}" not found in field list.\n`;
                    }
                    
                    if (availableFields.length > 0) {
                        errorMsg += `Available fields: ${availableFields.join(', ')}${availableFields.length >= 10 ? '...' : ''}`;
                    }
                    
                    return {
                        items: [],
                        response: errorMsg,
                        count: 0,
                        query: { method: 'colormatching', sql: '' }
                    };
                }
                
                // Limit to reasonable number (max 50)
                if (sortedValues.length > 50) {
                    return {
                        items: [],
                        response: `⚠️ Too many unique values (${sortedValues.length}). Color matching is limited to 50 values. Please filter your data first.`,
                        count: 0,
                        query: { method: 'colormatching', sql: '' }
                    };
                }
                
                // Get theme title
                let themeTitle = targetThemeId;
                try {
                    if (themeObj?.szTitle) {
                        themeTitle = themeObj.szTitle;
                    } else if (themeObj?.theme?.szTitle) {
                        themeTitle = themeObj.theme.szTitle;
                    } else if (themeDef?.meta?.title) {
                        themeTitle = themeDef.meta.title;
                    } else if (themeDef?.szTitle) {
                        themeTitle = themeDef.szTitle;
                    }
                } catch (e) {
                    // Use themeId as fallback
                }
                
                // Build AI prompt with semantic color guidance
                const valuesList = sortedValues.map(v => `"${v}"`).join(', ');
                
                // Analyze values to provide context-specific guidance
                const valueLower = sortedValues.map(v => String(v).toLowerCase()).join(' ');
                let semanticGuidance = '';
                
                // Energy sources
                if (valueLower.match(/\b(hydro|water|solar|sun|coal|nuclear|wind|gas|oil|petroleum|fossil|renewable|geothermal|biomass)\b/)) {
                    semanticGuidance = `\n**IMPORTANT: These appear to be energy sources. Use semantically meaningful colors:**
- Hydro/Water → Blue (#0066CC, #0080FF, or similar blue tones)
- Solar/Sun → Yellow/Orange (#FFD700, #FFA500, #FF8C00)
- Coal → Black/Dark Gray (#1C1C1C, #2F2F2F, #000000)
- Nuclear → Yellow/Amber (#FFD700, #FFA500) or Green (#00AA00) for clean energy context
- Wind → Light Blue/Cyan (#87CEEB, #00CED1)
- Gas → Orange/Red (#FF6600, #FF4500)
- Oil/Petroleum → Dark Brown/Black (#654321, #2F1B14)
- Geothermal → Red/Orange (#FF4500, #FF6347)
- Biomass → Green (#228B22, #32CD32)
- Renewable → Green tones (#00AA00, #32CD32)
- Fossil → Brown/Gray (#8B7355, #696969)

**CRITICAL: Do NOT use arbitrary or monochrome colors. Each energy source must have a distinct, semantically meaningful color that people would naturally associate with that source.**`;
                }
                // Geographic features
                else if (valueLower.match(/\b(ocean|sea|coast|mountain|desert|forest|river|lake|island|urban|rural)\b/)) {
                    semanticGuidance = `\n**IMPORTANT: These appear to be geographic features. Use semantically meaningful colors:**
- Ocean/Sea/Coast → Blue (#0066CC, #0080FF)
- Mountain → Brown/Gray (#8B7355, #696969)
- Desert → Yellow/Tan (#F4A460, #D2B48C)
- Forest → Green (#228B22, #006400)
- River/Lake → Blue/Cyan (#00CED1, #4682B4)
- Island → Green/Blue (#32CD32, #00CED1)
- Urban → Gray/Red (#808080, #DC143C)
- Rural → Green/Brown (#90EE90, #8B7355)`;
                }
                // Political/Administrative
                else if (valueLower.match(/\b(conflict|war|peace|democratic|republican|conservative|liberal|left|right)\b/)) {
                    semanticGuidance = `\n**IMPORTANT: These appear to be political/administrative categories. Use semantically meaningful colors:**
- Conflict/War → Red/Orange (#DC143C, #FF4500)
- Peace → Green/Blue (#00AA00, #0066CC)
- Democratic → Blue (#0000FF, #0066CC)
- Republican → Red (#DC143C, #FF0000)
- Conservative → Blue (#0000FF)
- Liberal → Red/Orange (#FF4500, #FF6347)`;
                }
                // Temperature/Climate
                else if (valueLower.match(/\b(hot|warm|cold|cool|tropical|arctic|temperate|freezing|boiling)\b/)) {
                    semanticGuidance = `\n**IMPORTANT: These appear to be temperature/climate related. Use semantically meaningful colors:**
- Hot/Warm/Boiling → Red/Orange/Yellow (#FF0000, #FF4500, #FFD700)
- Cold/Cool/Freezing/Arctic → Blue/Cyan (#0000FF, #00CED1, #87CEEB)
- Tropical → Green/Yellow (#32CD32, #FFD700)
- Temperate → Green (#228B22)`;
                }
                // Status/State
                else if (valueLower.match(/\b(active|inactive|on|off|enabled|disabled|open|closed|success|error|warning)\b/)) {
                    semanticGuidance = `\n**IMPORTANT: These appear to be status indicators. Use semantically meaningful colors:**
- Active/On/Enabled/Open/Success → Green (#00AA00, #32CD32)
- Inactive/Off/Disabled/Closed/Error → Red (#DC143C, #FF0000)
- Warning → Yellow/Orange (#FFD700, #FFA500)`;
                }
                // Default guidance
                else {
                    semanticGuidance = `\n**IMPORTANT: Use semantically meaningful colors based on the meaning of each value:**
- If values represent types of resources, use colors associated with those resources (e.g., water → blue, fire → red, earth → brown)
- If values represent categories, use distinct, easily distinguishable colors that have natural associations
- Avoid arbitrary or monochrome color schemes - each color should have a clear semantic meaning
- Consider cultural associations (e.g., danger → red, nature → green, sky → blue)`;
                }
                
                const aiPrompt = `You are a color expert specializing in semantic color associations for data visualization. I need you to suggest semantically appropriate colors for categorical values in a map visualization.

Theme: "${themeTitle}"
Field: "${categoricalField}"
Number of values: ${sortedValues.length}

Values to assign colors to:
${sortedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}
${semanticGuidance}

**CRITICAL REQUIREMENTS:**
1. Each color MUST be semantically meaningful and naturally associated with its value
2. Do NOT use arbitrary, random, or monochrome colors
3. Use distinct colors that are easily distinguishable
4. Consider common associations (e.g., water → blue, sun → yellow, coal → black, nuclear → yellow/amber)
5. If a value has multiple possible associations, choose the most commonly recognized one

**Examples of good semantic associations:**
- "Hydro" → Blue (#0066CC or #0080FF)
- "Solar" or "Sun" → Yellow/Orange (#FFD700 or #FFA500)
- "Coal" → Black/Dark Gray (#1C1C1C or #2F2F2F)
- "Nuclear" → Yellow/Amber (#FFD700 or #FFA500) or Green (#00AA00) depending on context
- "Wind" → Light Blue/Cyan (#87CEEB or #00CED1)
- "High" → Red/Orange (warm colors)
- "Low" → Blue/Cyan (cool colors)

Return ONLY a valid JSON object in this exact format:
{
  "value1": "#HEXCOLOR",
  "value2": "#HEXCOLOR",
  ...
}

Use hex color codes (e.g., "#FF5733", "#0066CC"). Make sure each color is semantically meaningful and distinct from others.`;

                try {
                    // Try to access askAIDirectly from various scopes
                    // It's defined in index.html, so it should be accessible in the same scope
                    let aiFunction = null;
                    
                    // Try direct access (same scope as index.html)
                    if (typeof askAIDirectly === 'function') {
                        aiFunction = askAIDirectly;
                    }
                    // Try window scope
                    else if (typeof window !== 'undefined' && typeof window.askAIDirectly === 'function') {
                        aiFunction = window.askAIDirectly;
                    }
                    // Try parent window (if in iframe)
                    else if (typeof window !== 'undefined' && window.parent && typeof window.parent.askAIDirectly === 'function') {
                        aiFunction = window.parent.askAIDirectly;
                    }
                    // Try to find it via eval (last resort, for same-origin only)
                    else {
                        try {
                            // This is safe because we're in the same origin
                            const func = eval('typeof askAIDirectly !== "undefined" ? askAIDirectly : null');
                            if (typeof func === 'function') {
                                aiFunction = func;
                            }
                        } catch (e) {
                            // Ignore eval errors
                        }
                    }
                    
                    if (!aiFunction) {
                        return {
                            items: [],
                            response: '⚠️ AI API not available. Please ensure the chat interface is properly loaded and AI is configured.',
                            count: 0,
                            query: { method: 'colormatching', sql: '' }
                        };
                    }
                    
                    // Call the AI function - it should handle API key checking internally
                    console.log('[Color Matching] Calling AI function with prompt length:', aiPrompt.length);
                    const aiResult = await aiFunction(aiPrompt);
                    console.log('[Color Matching] AI result:', aiResult);
                    const aiResponse = aiResult.response || aiResult;
                    
                    // Parse JSON from AI response
                    // The AI might return JSON wrapped in markdown code blocks or plain text
                    let jsonStr = aiResponse;
                    
                    // Try to extract JSON from markdown code blocks
                    const jsonMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
                    if (jsonMatch) {
                        jsonStr = jsonMatch[1];
                    } else {
                        // Try to find JSON object in the response
                        const jsonObjMatch = aiResponse.match(/\{[\s\S]*\}/);
                        if (jsonObjMatch) {
                            jsonStr = jsonObjMatch[0];
                        }
                    }
                    
                    let colorMap = {};
                    try {
                        colorMap = JSON.parse(jsonStr);
                    } catch (parseError) {
                        return {
                            items: [],
                            response: `⚠️ Could not parse AI response as JSON. AI returned: ${aiResponse.substring(0, 200)}...`,
                            count: 0,
                            query: { method: 'colormatching', sql: '' }
                        };
                    }
                    
                    // Validate and convert colors
                    const colorNameToHex = {
                        'red': '#FF0000', 'green': '#00FF00', 'blue': '#0000FF',
                        'yellow': '#FFFF00', 'orange': '#FFA500', 'purple': '#800080',
                        'pink': '#FFC0CB', 'brown': '#A52A2A', 'black': '#000000',
                        'white': '#FFFFFF', 'gray': '#808080', 'grey': '#808080',
                        'cyan': '#00FFFF', 'magenta': '#FF00FF', 'lime': '#00FF00',
                        'navy': '#000080', 'maroon': '#800000', 'olive': '#808000',
                        'teal': '#008080', 'aqua': '#00FFFF', 'silver': '#C0C0C0'
                    };
                    
                    // Build colors array in the EXACT order of sortedValues (original order of values)
                    // This ensures colors[i] corresponds to sortedValues[i]
                    const finalColors = [];
                    const valueColorPairs = [];
                    
                    console.log('[Color Matching] Ordering colors to match values array order');
                    console.log('[Color Matching] Values array (original order):', sortedValues);
                    console.log('[Color Matching] AI colorMap keys:', Object.keys(colorMap));
                    
                    // Iterate through sortedValues in order to ensure colors match values order
                    for (let i = 0; i < sortedValues.length; i++) {
                        const value = sortedValues[i];
                        let color = colorMap[value];
                        
                        if (!color) {
                            // Try case-insensitive match
                            const valueLower = value.toLowerCase();
                            for (const key in colorMap) {
                                if (key.toLowerCase() === valueLower) {
                                    color = colorMap[key];
                                    break;
                                }
                            }
                        }
                        
                        if (!color) {
                            // Fallback: use a default color palette
                            const defaultColors = ['#FF5733', '#33FF57', '#3357FF', '#FF33FF', '#FFFF33', '#33FFFF', '#FF8C33', '#8C33FF', '#33FF8C', '#FF338C'];
                            const index = i % defaultColors.length;
                            color = defaultColors[index];
                            valueColorPairs.push(`${value}: ${color} (default)`);
                        } else {
                            // Convert color name to hex if needed
                            const colorLower = String(color).toLowerCase().trim();
                            if (colorNameToHex[colorLower]) {
                                color = colorNameToHex[colorLower];
                            } else if (!color.match(/^#[0-9A-Fa-f]{6}$/)) {
                                // Invalid color format, use default
                                const defaultColors = ['#FF5733', '#33FF57', '#3357FF', '#FF33FF', '#FFFF33', '#33FFFF', '#FF8C33', '#8C33FF', '#33FF8C', '#FF338C'];
                                const index = i % defaultColors.length;
                                color = defaultColors[index];
                                valueColorPairs.push(`${value}: ${color} (default - invalid format)`);
                            } else {
                                valueColorPairs.push(`${value}: ${color}`);
                            }
                        }
                        
                        // Add color at position i to match value at position i
                        finalColors.push(color);
                        console.log(`[Color Matching] Position ${i}: value="${value}" → color="${color}"`);
                    }
                    
                    console.log('[Color Matching] Final colors array (ordered to match values):', finalColors);
                    
                    // Format colorscheme: for categorical themes with exact discrete colors,
                    // use colordef:colors where colors is a string with n colors
                    const colorsString = finalColors.join(',');
                    // Format values: for color matching, we need to set the values that correspond to each color
                    const valuesString = sortedValues.join(',');
                    
                    console.log('[Color Matching] Applying colorscheme with colordef:', colorsString);
                    console.log('[Color Matching] Applying values with values:', valuesString);
                    console.log('[Color Matching] Number of colors:', finalColors.length, 'Number of values:', sortedValues.length);
                    
                    // Apply colorscheme to theme using changeThemeStyle with colordef:colors
                    try {
                        const mapApi = map.Api || map;
                        if (!mapApi || !mapApi.changeThemeStyle) {
                            throw new Error('changeThemeStyle not available');
                        }
                        
                        // Use changeThemeStyle with 'colordef:colors' format
                        mapApi.changeThemeStyle(targetThemeId, `colordef:${colorsString}`, "set");
                        console.log('[Color Matching] Applied colorscheme using changeThemeStyle with colordef');
                        
                        // Also set the values that correspond to each color
                        mapApi.changeThemeStyle(targetThemeId, `values:${valuesString}`, "set");
                        console.log('[Color Matching] Applied values using changeThemeStyle with values');
                        
                        // Build response message
                        let response = `✅ **Applied semantic colors to ${sortedValues.length} values in "${themeTitle}"**\n\n`;
                        response += `**Color assignments:**\n`;
                        response += valueColorPairs.slice(0, 10).map(pair => `- ${pair}`).join('\n');
                        if (valueColorPairs.length > 10) {
                            response += `\n... and ${valueColorPairs.length - 10} more`;
                        }
                        
                        return {
                            items: [],
                            response: response,
                            count: sortedValues.length,
                            query: { method: 'colormatching', sql: '', theme: targetThemeId },
                            colorscheme: colorsString
                        };
                        
                    } catch (applyError) {
                        console.error('Error applying colorscheme:', applyError);
                        return {
                            items: [],
                            response: `⚠️ Error applying colorscheme: ${applyError.message}`,
                            count: 0,
                            query: { method: 'colormatching', sql: '' }
                        };
                    }
                    
                } catch (aiError) {
                    console.error('Error calling AI for color matching:', aiError);
                    return {
                        items: [],
                        response: `⚠️ Error getting color suggestions from AI: ${aiError.message}`,
                        count: 0,
                        query: { method: 'colormatching', sql: '' }
                    };
                }
                
            } catch (error) {
                console.error('Error in handleColorMatching:', error);
                return {
                    items: [],
                    response: `⚠️ Error processing color matching request: ${error.message}`,
                    count: 0,
                    query: { method: 'colormatching', sql: '' }
                };
            }
        },
        
        /**
         * Handle "edit theme X" requests
         * @param {String} themeIdentifier - Theme identifier (theme0, theme1, theme ID, or layer name)
         * @param {String} query - Original query
         * @param {Object} parsed - Parsed query result
         * @returns {Promise<Object|null>} Result object or null if not handled
         */
        handleEditTheme: async function(themeIdentifier, query, parsed) {
            const map = this.getMap();
            const detectedLanguage = parsed.detectedLanguage || 'en';
            
            if (!map || !map.Api) {
                const noMapMsg = detectedLanguage === 'it' 
                    ? '⚠️ Impossibile modificare il tema: la mappa non è disponibile.'
                    : detectedLanguage === 'de'
                    ? '⚠️ Kann Theme nicht bearbeiten: Karte ist nicht verfügbar.'
                    : detectedLanguage === 'fr'
                    ? '⚠️ Impossible de modifier le thème: la carte n\'est pas disponible.'
                    : detectedLanguage === 'es'
                    ? '⚠️ No se puede editar el tema: el mapa no está disponible.'
                    : '⚠️ Cannot edit theme: map is not available.';
                return {
                    items: [],
                    response: noMapMsg,
                    count: 0,
                    query: { method: 'edittheme', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Get all themes to resolve the identifier
            let allThemes = [];
            try {
                if (map.Themes && map.Themes.getThemes) {
                    allThemes = map.Themes.getThemes();
                } else if (map.Api && map.Api.getAllThemes) {
                    allThemes = map.Api.getAllThemes();
                }
            } catch (e) {
                console.warn('Could not get themes:', e);
                return null;
            }
            
            if (allThemes.length === 0) {
                const noThemesMsg = detectedLanguage === 'it' 
                    ? '⚠️ Nessun tema disponibile sulla mappa.'
                    : detectedLanguage === 'de'
                    ? '⚠️ Keine Themen auf der Karte verfügbar.'
                    : detectedLanguage === 'fr'
                    ? '⚠️ Aucun thème disponible sur la carte.'
                    : detectedLanguage === 'es'
                    ? '⚠️ No hay temas disponibles en el mapa.'
                    : '⚠️ No themes available on the map.';
                return {
                    items: [],
                    response: noThemesMsg,
                    count: 0,
                    query: { method: 'edittheme', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Resolve theme identifier to theme ID (same logic as handleShowDataOfTheme)
            let themeId = null;
            const identifierLower = themeIdentifier.toLowerCase();
            
            // Check if it's a numeric index (theme1, theme2, etc. or just "1", "2", etc.) - 1-based indexing
            // Also supports 0-based for backward compatibility
            const indexMatch = identifierLower.match(/^theme\s*(\d+)$|^(\d+)$/);
            if (indexMatch) {
                let index = parseInt(indexMatch[1] || indexMatch[2], 10);
                // Convert 1-based to 0-based (theme1 -> index 0, theme2 -> index 1, etc.)
                // But also support 0-based for backward compatibility (theme0 -> index 0)
                if (index > 0 && index <= allThemes.length) {
                    index = index - 1; // Convert 1-based to 0-based
                }
                if (index >= 0 && index < allThemes.length) {
                    const theme = allThemes[index];
                    themeId = theme.szId || theme.id || theme.name || null;
                }
            } else {
                // Try to match as theme ID or layer name
                for (const theme of allThemes) {
                    const candidateId = theme.szId || theme.id || theme.name || '';
                    if (candidateId.toLowerCase() === identifierLower) {
                        themeId = candidateId;
                        break;
                    }
                    
                    // Check layer name
                    try {
                        const themeDef = map.Api.getMapThemeDefinitionObj(candidateId);
                        const layerName = themeDef?.layer || '';
                        if (layerName && layerName.toLowerCase() === identifierLower) {
                            themeId = candidateId;
                            break;
                        }
                    } catch (e1) {
                        try {
                            const themeObj = map.Api.getTheme(candidateId);
                            const layerName = themeObj?.theme?.szLayer || themeObj?.szLayer || 
                                             themeObj?.theme?.layer || themeObj?.layer || '';
                            if (layerName && String(layerName).toLowerCase() === identifierLower) {
                                themeId = candidateId;
                                break;
                            }
                        } catch (e2) {
                            // Ignore
                        }
                    }
                }
            }
            
            if (!themeId) {
                const notFoundMsg = detectedLanguage === 'it' 
                    ? `⚠️ Tema "${themeIdentifier}" non trovato. Usa "themes" per vedere l'elenco dei temi disponibili.`
                    : detectedLanguage === 'de'
                    ? `⚠️ Theme "${themeIdentifier}" nicht gefunden. Verwenden Sie "themes", um die Liste der verfügbaren Themes anzuzeigen.`
                    : detectedLanguage === 'fr'
                    ? `⚠️ Thème "${themeIdentifier}" introuvable. Utilisez "themes" pour voir la liste des thèmes disponibles.`
                    : detectedLanguage === 'es'
                    ? `⚠️ Tema "${themeIdentifier}" no encontrado. Use "themes" para ver la lista de temas disponibles.`
                    : `⚠️ Theme "${themeIdentifier}" not found. Use "themes" to see the list of available themes.`;
                return {
                    items: [],
                    response: notFoundMsg,
                    count: 0,
                    query: { method: 'edittheme', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Return a result that will trigger showThemeEditor in the chat handler
            const successMsg = detectedLanguage === 'it' 
                ? `✅ Apertura editor tema per il tema "${themeId}"...`
                : detectedLanguage === 'de'
                ? `✅ Öffne Theme-Editor für Theme "${themeId}"...`
                : detectedLanguage === 'fr'
                ? `✅ Ouverture de l'éditeur de thème pour le thème "${themeId}"...`
                : detectedLanguage === 'es'
                ? `✅ Abriendo editor de tema para el tema "${themeId}"...`
                : `✅ Opening theme editor for theme "${themeId}"...`;
            
            return {
                items: [],
                response: successMsg,
                count: 0,
                query: { method: 'edittheme', sql: '', theme: themeId },
                showThemeEditor: true, // Flag to trigger showThemeEditor
                themeId: themeId,
                modelUsed: parsed.modelUsed || null
            };
        },
        
        /**
         * Handle "color by field" requests
         * @param {String} query - Original query
         * @param {String} queryLower - Lowercase query
         * @param {Object} colorWords - Color words dictionary
         * @param {Array} schemas - Available schemas
         * @param {Object} parsed - Parsed query result
         * @returns {Promise<Object|null>} Result object or null if not handled
         */
        handleColorByField: async function(query, queryLower, colorWords, schemas, parsed) {
            const map = this.getMap();
            const detectedLanguage = parsed.detectedLanguage || 'en';
            
            if (!map || !map.Api) {
                const noMapMsg = detectedLanguage === 'it' 
                    ? '⚠️ Impossibile colorare: la mappa non è disponibile. Assicurati che la mappa sia caricata correttamente.'
                    : detectedLanguage === 'de'
                    ? '⚠️ Kann nicht einfärben: Karte ist nicht verfügbar. Stellen Sie sicher, dass die Karte korrekt geladen ist.'
                    : detectedLanguage === 'fr'
                    ? '⚠️ Impossible de colorer: la carte n\'est pas disponible. Assurez-vous que la carte est chargée correctement.'
                    : detectedLanguage === 'es'
                    ? '⚠️ No se puede colorear: el mapa no está disponible. Asegúrese de que el mapa esté cargado correctamente.'
                    : '⚠️ Cannot colorize: map is not available. Please ensure the map is loaded correctly.';
                
                return {
                    items: [],
                    response: noMapMsg,
                    count: 0,
                    query: { method: 'color', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Get all themes
            let allThemes = [];
            try {
                if (map.Themes && map.Themes.getThemes) {
                    allThemes = map.Themes.getThemes();
                } else if (map.Api && map.Api.getAllThemes) {
                    allThemes = map.Api.getAllThemes();
                }
            } catch (e) {
                console.warn('Could not get themes:', e);
                const errorMsg = detectedLanguage === 'it'
                    ? '⚠️ Impossibile ottenere i temi dalla mappa. Assicurati che i dati siano caricati.'
                    : detectedLanguage === 'de'
                    ? '⚠️ Kann keine Themes von der Karte abrufen. Stellen Sie sicher, dass Daten geladen sind.'
                    : detectedLanguage === 'fr'
                    ? '⚠️ Impossible d\'obtenir les thèmes de la carte. Assurez-vous que les données sont chargées.'
                    : detectedLanguage === 'es'
                    ? '⚠️ No se pueden obtener los temas del mapa. Asegúrese de que los datos estén cargados.'
                    : '⚠️ Cannot get themes from map. Please ensure data is loaded.';
                
                return {
                    items: [],
                    response: errorMsg,
                    count: 0,
                    query: { method: 'color', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            if (allThemes.length === 0) {
                console.warn('⚠️ No themes found on map');
                const noThemesMsg = detectedLanguage === 'it'
                    ? '⚠️ Nessun tema trovato sulla mappa. Per colorare la mappa, devi prima caricare i dati. Prova a dire "carica dati" o "mostra dati di esempio".'
                    : detectedLanguage === 'de'
                    ? '⚠️ Keine Themes auf der Karte gefunden. Um die Karte einzufärben, müssen Sie zuerst Daten laden. Versuchen Sie "Daten laden" oder "Beispieldaten anzeigen" zu sagen.'
                    : detectedLanguage === 'fr'
                    ? '⚠️ Aucun thème trouvé sur la carte. Pour colorer la carte, vous devez d\'abord charger des données. Essayez de dire "charger des données" ou "afficher des données d\'exemple".'
                    : detectedLanguage === 'es'
                    ? '⚠️ No se encontraron temas en el mapa. Para colorear el mapa, primero debe cargar datos. Intente decir "cargar datos" o "mostrar datos de ejemplo".'
                    : (typeof window !== 'undefined' && window.__IXMAPS_AI_CHAT_EMBED_HOST__
                        ? '⚠️ No themes found on map. To colorize the map, you need to load data first. Use `load data url [URL]` to add a dataset.'
                        : '⚠️ No themes found on map. To colorize the map, you need to load data first. Try saying "load data" or "show sample data".');
                
                return {
                    items: [],
                    response: noThemesMsg,
                    count: 0,
                    query: { method: 'color', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Extract field name directly after "color by" / "colorize by" / "colour by" patterns
            // Support field names with underscores, e.g., "percBU_km2_rate"
            let fieldNameCandidate = null;
            const colorByVerb = '(?:color|colour|colorize|colourise)';
            // Try to match quoted field names first (e.g., "color by 'percBU_km2_rate'")
            const colorByPatternQuoted = new RegExp(colorByVerb + '\\s+by\\s+[\'"]([^\'"]+)[\'"]', 'i');
            let match = query.match(colorByPatternQuoted);
            if (match && match[1]) {
                fieldNameCandidate = match[1].trim();
            } else {
                // Try unquoted field name - match word characters and underscores
                // Note: \w+ matches [a-zA-Z0-9_], so "percBU_km2_rate" will match correctly
                const colorByPattern = new RegExp(colorByVerb + '\\s+by\\s+([\\w_]+)', 'i');
                match = query.match(colorByPattern);
                if (match && match[1]) {
                    fieldNameCandidate = match[1].trim();
                }
            }
            
            console.log('🔍 Extracted field name candidate:', fieldNameCandidate, 'from query:', query);
            
            // Try to find matching field in schemas
            let matchingField = null;
            let targetTheme = null;
            let fieldSchema = null;
            
            // First, try direct matching with the extracted field name
            // CRITICAL: Prioritize exact matches to avoid partial matches (e.g., "BU_km2" matching "percBU_km2_rate")
            if (fieldNameCandidate) {
                const candidateLower = fieldNameCandidate.toLowerCase();
                const candidateNormalized = candidateLower.replace(/[_\s]/g, '');
                
                // First pass: try exact matches only (highest priority)
                for (const schema of schemas) {
                    if (schema.fields) {
                        const field = schema.fields.find(f => {
                            const fName = typeof f === 'string' ? f : (f.name || f.field || f.id || '');
                            const fNameLower = fName.toLowerCase();
                            const fNameNormalized = fNameLower.replace(/[_\s]/g, '');
                            
                            // Exact match (case-insensitive) - highest priority
                            return fNameLower === candidateLower || 
                                   fNameNormalized === candidateNormalized;
                        });
                        
                        if (field) {
                            matchingField = typeof field === 'string' ? field : (field.name || field.field || field.id);
                            fieldSchema = schema;
                            
                            // Find a theme for this schema
                            const theme = allThemes.find(t => {
                                const tId = t.szId || t.id || t.name;
                                return tId === schema.theme || 
                                       schema.themeTitle?.toLowerCase().includes(tId.toLowerCase()) ||
                                       tId.toLowerCase().includes(schema.theme?.toLowerCase());
                            });
                            if (theme) {
                                targetTheme = theme;
                            } else if (allThemes.length > 0) {
                                targetTheme = allThemes[0];
                            }
                            break;
                        }
                    }
                    if (matchingField) break;
                }
                
                // Second pass: if no exact match, try substring matches but prefer longer field names
                // This prevents "BU_km2" from matching when user wants "percBU_km2_rate"
                // Only match if the field name contains the candidate (not the other way around)
                if (!matchingField) {
                    let bestMatch = null;
                    let bestMatchLength = 0;
                    
                    for (const schema of schemas) {
                        if (schema.fields) {
                            for (const field of schema.fields) {
                                const fName = typeof field === 'string' ? field : (field.name || field.field || field.id || '');
                                const fNameLower = fName.toLowerCase();
                                
                                // Only match if field name contains the candidate (not the other way around)
                                // This ensures "percBU_km2_rate" matches "percBU_km2_rate" not "BU_km2"
                                // Prefer longer field names when multiple matches exist
                                if (fNameLower.includes(candidateLower) && fName.length > bestMatchLength) {
                                    bestMatch = field;
                                    bestMatchLength = fName.length;
                                    fieldSchema = schema;
                                }
                            }
                        }
                    }
                    
                    if (bestMatch) {
                        matchingField = typeof bestMatch === 'string' ? bestMatch : (bestMatch.name || bestMatch.field || bestMatch.id);
                        
                        // Find a theme for this schema
                        const theme = allThemes.find(t => {
                            const tId = t.szId || t.id || t.name;
                            return tId === fieldSchema.theme || 
                                   fieldSchema.themeTitle?.toLowerCase().includes(tId.toLowerCase()) ||
                                   tId.toLowerCase().includes(fieldSchema.theme?.toLowerCase());
                        });
                        if (theme) {
                            targetTheme = theme;
                        } else if (allThemes.length > 0) {
                            targetTheme = allThemes[0];
                        }
                    }
                }
            }
            
            // If no field found, try using Gemini to match the field name
            if (!matchingField && fieldNameCandidate) {
                try {
                    const matchedField = await this.matchFieldNameWithAI(fieldNameCandidate, schemas);
                    if (matchedField) {
                        matchingField = matchedField.fieldName;
                        fieldSchema = matchedField.schema;
                        targetTheme = allThemes.find(t => {
                            const tId = t.szId || t.id || t.name;
                            return tId === matchedField.schema.theme;
                        }) || allThemes[0];
                    }
                } catch (e) {
                    console.warn('⚠️ AI field matching failed:', e);
                }
            }
            
            // Fallback: try searching all words in query
            if (!matchingField) {
                const queryWords = queryLower.split(/\s+/);
                const commonWords = ['show', 'me', 'by', 'with', 'the', 'a', 'an', 'per', 'con', 'mit', 'avec', 'par', 'por', 'com'];
                const colorWordsList = Object.values(colorWords).flat();
                
                for (const schema of schemas) {
                    if (schema.fields) {
                        for (const word of queryWords) {
                            if (colorWordsList.includes(word) || commonWords.includes(word) || word.length < 3) continue;
                            
                            const field = schema.fields.find(f => {
                                const fName = typeof f === 'string' ? f : (f.name || f.field || f.id || '');
                                const fNameLower = fName.toLowerCase();
                                const wordLower = word.toLowerCase();
                                
                                if (fNameLower === wordLower || fNameLower.includes(wordLower)) {
                                    return true;
                                }
                                // Avoid false positives: e.g. field "lat" must not match the word "population"
                                // (substring "lat" appears inside "population"). Only allow reverse substring
                                // when the field name is long enough to be unlikely to be an accidental overlap.
                                if (fName.length > 3 && wordLower.includes(fNameLower)) {
                                    return true;
                                }
                                return false;
                            });
                            
                            if (field) {
                                matchingField = typeof field === 'string' ? field : (field.name || field.field || field.id);
                                fieldSchema = schema;
                                targetTheme = allThemes[0];
                                break;
                            }
                        }
                        if (matchingField) break;
                    }
                }
            }
            
            if (!matchingField || !targetTheme) {
                console.warn('⚠️ Cannot apply color: matchingField =', matchingField, 'targetTheme =', targetTheme);
                
                // If user asked to colorize but no field was nominated, provide helpful suggestions
                const detectedLanguage = parsed.detectedLanguage || 'en';
                const languageMessages = {
                    'en': {
                        title: 'How to Colorize the Map',
                        intro: 'To colorize the map, you need to specify which data field to use for coloring. Here are some options:',
                        examples: [
                            'Say "color by [field name]" - for example: "color by population" or "color by country"',
                            'Specify a numeric field for gradient coloring (e.g., "color by population", "color by area")',
                            'Specify a text field for categorical coloring (e.g., "color by region", "color by type")'
                        ],
                        availableFields: 'Available data fields you can use:',
                        noFields: 'No data fields are currently available. Please load data first.'
                    },
                    'de': {
                        title: 'Wie man die Karte einfärbt',
                        intro: 'Um die Karte einzufärben, müssen Sie angeben, welches Datenfeld für die Farbgebung verwendet werden soll. Hier sind einige Optionen:',
                        examples: [
                            'Sagen Sie "Farbe nach [Feldname]" - zum Beispiel: "Farbe nach Bevölkerung" oder "Farbe nach Land"',
                            'Geben Sie ein numerisches Feld für Farbverlauf an (z.B. "Farbe nach Bevölkerung", "Farbe nach Fläche")',
                            'Geben Sie ein Textfeld für kategorische Farbgebung an (z.B. "Farbe nach Region", "Farbe nach Typ")'
                        ],
                        availableFields: 'Verfügbare Datenfelder, die Sie verwenden können:',
                        noFields: 'Derzeit sind keine Datenfelder verfügbar. Bitte laden Sie zuerst Daten.'
                    },
                    'it': {
                        title: 'Come colorare la mappa',
                        intro: 'Per colorare la mappa, è necessario specificare quale campo dati utilizzare per la colorazione. Ecco alcune opzioni:',
                        examples: [
                            'Dì "colore per [nome campo]" - ad esempio: "colore per popolazione" o "colore per paese"',
                            'Specifica un campo numerico per la colorazione a gradiente (es. "colore per popolazione", "colore per area")',
                            'Specifica un campo di testo per la colorazione categorica (es. "colore per regione", "colore per tipo")'
                        ],
                        availableFields: 'Campi dati disponibili che puoi utilizzare:',
                        noFields: 'Attualmente non ci sono campi dati disponibili. Si prega di caricare prima i dati.'
                    },
                    'fr': {
                        title: 'Comment colorer la carte',
                        intro: 'Pour colorer la carte, vous devez spécifier quel champ de données utiliser pour la coloration. Voici quelques options:',
                        examples: [
                            'Dites "couleur par [nom du champ]" - par exemple: "couleur par population" ou "couleur par pays"',
                            'Spécifiez un champ numérique pour la coloration en dégradé (ex. "couleur par population", "couleur par superficie")',
                            'Spécifiez un champ texte pour la coloration catégorielle (ex. "couleur par région", "couleur par type")'
                        ],
                        availableFields: 'Champs de données disponibles que vous pouvez utiliser:',
                        noFields: 'Aucun champ de données n\'est actuellement disponible. Veuillez d\'abord charger des données.'
                    },
                    'es': {
                        title: 'Cómo colorear el mapa',
                        intro: 'Para colorear el mapa, debe especificar qué campo de datos usar para la coloración. Aquí hay algunas opciones:',
                        examples: [
                            'Diga "color por [nombre del campo]" - por ejemplo: "color por población" o "color por país"',
                            'Especifique un campo numérico para la coloración de gradiente (ej. "color por población", "color por área")',
                            'Especifique un campo de texto para la coloración categórica (ej. "color por región", "color por tipo")'
                        ],
                        availableFields: 'Campos de datos disponibles que puede usar:',
                        noFields: 'Actualmente no hay campos de datos disponibles. Por favor, cargue los datos primero.'
                    }
                };
                
                const messages = languageMessages[detectedLanguage] || languageMessages['en'];
                
                // Get available fields from schemas
                const availableFields = [];
                for (const schema of schemas) {
                    if (schema.fields && schema.fields.length > 0) {
                        for (const field of schema.fields) {
                            const fieldName = typeof field === 'string' ? field : (field.name || field.field || field.id || '');
                            if (fieldName && fieldName !== 'geometry' && fieldName !== 'Geometry' && fieldName !== 'GEOMETRY') {
                                availableFields.push(fieldName);
                            }
                        }
                    }
                }
                
                let response = `🎨 **${messages.title}**\n\n${messages.intro}\n\n`;
                
                for (const example of messages.examples) {
                    response += `• ${example}\n`;
                }
                
                response += `\n${messages.availableFields}\n`;
                
                if (availableFields.length > 0) {
                    // Show up to 10 fields as examples
                    const fieldsToShow = availableFields.slice(0, 10);
                    response += fieldsToShow.map(f => `  • ${f}`).join('\n');
                    if (availableFields.length > 10) {
                        response += `\n  ... and ${availableFields.length - 10} more fields`;
                    }
                    response += `\n\n💡 **Example:** Try saying "color by ${fieldsToShow[0]}"`;
                } else {
                    response += `\n${messages.noFields}`;
                }
                
                // Add information about special field $item$
                const itemFieldInfo = detectedLanguage === 'it'
                    ? `\n\n📌 **Campo speciale \`$item$\`:** \`$item$\` è un campo predefinito che non corrisponde a una colonna nei tuoi dati. Quando lo usi, ogni elemento della mappa riceve automaticamente il valore 1, indipendentemente dai dati. Questo è utile quando vuoi visualizzare solo la geometria senza colorare o dimensionare in base a dati specifici. Esempio: "color by $item$" mostrerà tutti gli elementi con lo stesso colore.`
                    : detectedLanguage === 'de'
                    ? `\n\n📌 **Spezielles Feld \`$item$\`:** \`$item$\` ist ein vordefiniertes Feld, das keiner Spalte in Ihren Daten entspricht. Wenn Sie es verwenden, erhält jedes Kartenelement automatisch den Wert 1, unabhängig von den Daten. Dies ist nützlich, wenn Sie nur die Geometrie anzeigen möchten, ohne nach spezifischen Daten zu färben oder zu dimensionieren. Beispiel: "Farbe nach $item$" zeigt alle Elemente in derselben Farbe.`
                    : detectedLanguage === 'fr'
                    ? `\n\n📌 **Champ spécial \`$item$\`:** \`$item$\` est un champ prédéfini qui ne correspond à aucune colonne dans vos données. Lorsque vous l'utilisez, chaque élément de la carte reçoit automatiquement la valeur 1, indépendamment des données. C'est utile lorsque vous voulez afficher uniquement la géométrie sans colorer ou dimensionner selon des données spécifiques. Exemple: "couleur par $item$" affichera tous les éléments dans la même couleur.`
                    : detectedLanguage === 'es'
                    ? `\n\n📌 **Campo especial \`$item$\`:** \`$item$\` es un campo predefinido que no corresponde a ninguna columna en sus datos. Cuando lo usa, cada elemento del mapa recibe automáticamente el valor 1, independientemente de los datos. Esto es útil cuando desea mostrar solo la geometría sin colorear o dimensionar según datos específicos. Ejemplo: "color por $item$" mostrará todos los elementos en el mismo color.`
                    : `\n\n📌 **Special field \`$item$\`:** \`$item$\` is a predefined field that doesn't correspond to any column in your data. When you use it, every map element automatically receives the value 1, regardless of the data. This is useful when you want to display just the geometry without coloring or sizing based on specific data. Example: "color by $item$" will show all elements in the same color.`;
                response += itemFieldInfo;
                
                return {
                    items: [],
                    response: response,
                    count: 0,
                    query: { method: 'color', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Determine if field is textual or numeric
            // A field is textual if:
            // 1. The field type in schema is textual (string, text, etc.)
            // 2. ANY sample value is non-numeric (even if some values contain numbers)
            // Textual fields must always use categorical coloring, never gradients
            let isTextual = false;
            let sampleValues = [];
            
            console.log(`\n🔍 [Colorize Algorithm] Field "${matchingField}" - Starting textual/numeric determination`);
            
            // First, check field type from schema
            if (fieldSchema && fieldSchema.fields) {
                try {
                    const fieldInfo = fieldSchema.fields.find(f => {
                        const fName = typeof f === 'string' ? f : (f.name || f.field || f.id || '');
                        return fName === matchingField;
                    });
                    
                    if (fieldInfo) {
                        const fieldType = typeof fieldInfo === 'string' ? null : (fieldInfo.type || fieldInfo.typ || '');
                        console.log(`🔍 [Colorize Algorithm] Field "${matchingField}" - Schema field type: ${fieldType || 'not specified'}`);
                        
                        // If field type indicates textual (string, text, varchar, etc.), it's textual
                        if (fieldType && typeof fieldType === 'string') {
                            const typeLower = fieldType.toLowerCase();
                            if (typeLower.includes('string') || typeLower.includes('text') || 
                                typeLower.includes('varchar') || typeLower.includes('char')) {
                                isTextual = true;
                                console.log(`⚠️ [Colorize Algorithm] Field "${matchingField}" - Set to TEXTUAL from schema type: "${fieldType}"`);
                            } else {
                                console.log(`✅ [Colorize Algorithm] Field "${matchingField}" - Schema type "${fieldType}" does not indicate textual`);
                            }
                        }
                    } else {
                        console.log(`🔍 [Colorize Algorithm] Field "${matchingField}" - No field info found in schema`);
                    }
                } catch (e) {
                    console.warn('⚠️ Error checking field type from schema:', e);
                }
            } else {
                console.log(`🔍 [Colorize Algorithm] Field "${matchingField}" - No schema or fields available`);
            }
            
            // If not determined from schema type, check sample values
            // If ANY value is non-numeric, treat as textual (categorical)
            if (!isTextual && fieldSchema && fieldSchema.hasData && fieldSchema.dataTable) {
                try {
                    const fieldIndex = fieldSchema.fields.findIndex(f => {
                        const fName = typeof f === 'string' ? f : (f.name || f.field || f.id || '');
                        return fName === matchingField;
                    });
                    
                    if (fieldIndex >= 0 && fieldSchema.dataTable.records) {
                        // Get sample values (check more to be sure)
                        const allSampleValues = fieldSchema.dataTable.records
                            .slice(0, 100)
                            .map(r => r[fieldIndex]);
                        
                        console.log(`🔍 [Colorize Algorithm] Field "${matchingField}" - Raw sample values (first 50):`, allSampleValues.slice(0, 50));
                        console.log(`🔍 [Colorize Algorithm] Field "${matchingField}" - Total records checked: ${Math.min(100, fieldSchema.dataTable.records.length)}`);
                        
                        const beforeFilter = allSampleValues.length;
                        
                        // First pass: filter out only null, undefined, empty strings (keep NaN for now to analyze)
                        const afterBasicFilter = allSampleValues.filter(v => v !== null && v !== undefined && v !== '');
                        
                        console.log(`🔍 [Colorize Algorithm] Field "${matchingField}" - After basic filtering (null/undefined/empty):`);
                        console.log(`   - Before filter: ${beforeFilter} values`);
                        console.log(`   - After basic filter: ${afterBasicFilter.length} values`);
                        console.log(`   - Sample after basic filter (first 30):`, afterBasicFilter.slice(0, 30));
                        
                        // Count NaN values (both numeric and string)
                        const nanCount = afterBasicFilter.filter(v => {
                            if (typeof v === 'number' && isNaN(v)) return true;
                            if (typeof v === 'string' && v.trim().toLowerCase() === 'nan') return true;
                            return false;
                        }).length;
                        
                        const validValueCount = afterBasicFilter.length - nanCount;
                        console.log(`   - NaN values (numeric or string): ${nanCount}`);
                        console.log(`   - Valid (non-NaN) values: ${validValueCount}`);
                        
                        // If we have valid values, use them. If not, check more records (maybe NaN is at the start)
                        if (validValueCount > 0) {
                            // Filter out NaN values and take valid ones
                            sampleValues = afterBasicFilter
                                .filter(v => {
                                    if (typeof v === 'number' && isNaN(v)) return false;
                                    if (typeof v === 'string' && v.trim().toLowerCase() === 'nan') return false;
                                    return true;
                                })
                                .slice(0, 20);
                            console.log(`   ✅ Found ${validValueCount} valid values - using them for analysis`);
                        } else {
                            // All values are NaN - check if we can find valid values by checking more records
                            console.log(`   ⚠️ First ${afterBasicFilter.length} values are all NaN - checking more records...`);
                            const extendedSample = fieldSchema.dataTable.records
                                .slice(0, 500) // Check more records
                                .map(r => r[fieldIndex])
                                .filter(v => v !== null && v !== undefined && v !== '');
                            
                            const extendedValid = extendedSample.filter(v => {
                                if (typeof v === 'number' && isNaN(v)) return false;
                                if (typeof v === 'string' && v.trim().toLowerCase() === 'nan') return false;
                                return true;
                            });
                            
                            if (extendedValid.length > 0) {
                                sampleValues = extendedValid.slice(0, 20);
                                console.log(`   ✅ Found ${extendedValid.length} valid values in extended check (out of ${extendedSample.length} total)`);
                            } else {
                                // Really all NaN - but don't filter them out yet, we'll handle in the check
                                sampleValues = afterBasicFilter.slice(0, 20);
                                console.log(`   ⚠️ Even after checking ${extendedSample.length} records, all values are NaN`);
                            }
                        }
                        
                        console.log(`   - Final sample values for analysis (${sampleValues.length}):`, sampleValues);
                        console.log(`   - Value types:`, sampleValues.map(v => ({ value: v, type: typeof v, isNaN: typeof v === 'number' ? isNaN(v) : 'N/A' })));
                        
                        // Check if ANY value is non-numeric - if so, treat as textual/categorical
                        // Even if a field contains some numbers, if it has ANY text, it's categorical
                        // BUT: exclude NaN and undefined - they are not proof of categorical data
                        const textualCheckResults = sampleValues.map(v => {
                            // Skip NaN and undefined - they don't prove the field is categorical
                            if (v === undefined || v === null || (typeof v === 'number' && isNaN(v))) {
                                return { value: v, isTextual: false, reason: 'NaN/undefined/null' };
                            }
                            
                            if (typeof v === 'string') {
                                const trimmed = v.trim();
                                // Empty strings are considered numeric (will be filtered)
                                if (trimmed === '') {
                                    return { value: v, isTextual: false, reason: 'empty string' };
                                }
                                // Check if string is "NaN" or "undefined" - these are not categorical
                                if (trimmed.toLowerCase() === 'nan' || trimmed.toLowerCase() === 'undefined') {
                                    return { value: v, isTextual: false, reason: 'string "NaN" or "undefined"' };
                                }
                                // Try to parse as number - handle comma as decimal separator (European format)
                                // Replace comma with dot for parsing, but only if it's not a thousands separator
                                // Check if it looks like a number with comma decimal (e.g., "103,321" = 103.321)
                                // or dot decimal (e.g., "103.321" = 103.321)
                                let normalizedForParsing = trimmed;
                                let parsingDetails = { original: trimmed, normalized: trimmed, parsed: null, isFinite: false };
                                
                                // If there's a comma and it's likely a decimal separator (not thousands separator)
                                // Check: if comma is followed by digits and there's no dot, or if comma is at position > 3 from end
                                if (trimmed.includes(',') && !trimmed.includes('.')) {
                                    // Likely comma as decimal separator - replace with dot
                                    normalizedForParsing = trimmed.replace(',', '.');
                                    parsingDetails.normalized = normalizedForParsing;
                                }
                                
                                const parsed = parseFloat(normalizedForParsing);
                                parsingDetails.parsed = parsed;
                                parsingDetails.isFinite = isFinite(parsed);
                                
                                // If it can be parsed as a number and is finite, it's numeric (not textual)
                                if (!isNaN(parsed) && isFinite(parsed)) {
                                    return { 
                                        value: v, 
                                        isTextual: false, 
                                        reason: `numeric string (parsed as ${parsed})`,
                                        parsingDetails: parsingDetails
                                    };
                                }
                                
                                // If it can't be parsed as a number, it's textual
                                return { 
                                    value: v, 
                                    isTextual: true, 
                                    reason: `non-numeric string (parseFloat returned ${isNaN(parsed) ? 'NaN' : parsed}, isFinite: ${isFinite(parsed)})`,
                                    parsingDetails: parsingDetails
                                };
                            }
                            
                            // Non-string values that are NaN are not textual (they're invalid)
                            if (typeof v === 'number' && isNaN(v)) {
                                return { value: v, isTextual: false, reason: 'numeric NaN' };
                            }
                            
                            // Other non-numeric types are textual
                            const isNonNumeric = typeof v !== 'number';
                            return { 
                                value: v, 
                                isTextual: isNonNumeric, 
                                reason: isNonNumeric ? `non-numeric type: ${typeof v}` : 'numeric'
                            };
                        });
                        
                        console.log(`🔍 [Colorize Algorithm] Field "${matchingField}" - Detailed textual check results:`);
                        textualCheckResults.forEach((result, idx) => {
                            console.log(`   [${idx + 1}] Value: ${JSON.stringify(result.value)} (type: ${typeof result.value})`);
                            console.log(`       → isTextual: ${result.isTextual}, reason: ${result.reason}`);
                            if (result.parsingDetails) {
                                console.log(`       → Parsing: "${result.parsingDetails.original}" → "${result.parsingDetails.normalized}" → ${result.parsingDetails.parsed} (isFinite: ${result.parsingDetails.isFinite})`);
                            }
                        });
                        
                        const textualValues = textualCheckResults.filter(r => r.isTextual);
                        const numericValues = textualCheckResults.filter(r => !r.isTextual);
                        
                        console.log(`\n📊 [Colorize Algorithm] Field "${matchingField}" - Sample values analysis:`);
                        console.log(`   - Total sample values checked: ${sampleValues.length}`);
                        console.log(`   - Textual values found: ${textualValues.length}`);
                        if (textualValues.length > 0) {
                            console.log(`   ⚠️ TEXTUAL VALUES THAT CAUSED CATEGORICAL CLASSIFICATION:`);
                            textualValues.forEach((tv, idx) => {
                                console.log(`      [${idx + 1}] ${JSON.stringify(tv.value)} → ${tv.reason}`);
                                if (tv.parsingDetails) {
                                    console.log(`          Parsing: "${tv.parsingDetails.original}" → "${tv.parsingDetails.normalized}" → ${tv.parsingDetails.parsed} (isFinite: ${tv.parsingDetails.isFinite})`);
                                }
                            });
                        } else {
                            console.log(`   ✅ NO TEXTUAL VALUES FOUND - All values are numeric or NaN/undefined`);
                        }
                        console.log(`   - Numeric values found: ${numericValues.length}`);
                        if (numericValues.length > 0 && numericValues.length <= 10) {
                            console.log(`   ✅ Numeric values:`, numericValues.map(nv => `${JSON.stringify(nv.value)} (${nv.reason})`));
                        }
                        
                        // Only set isTextual if we actually found textual values
                        const hasTextualValues = textualCheckResults.some(r => r.isTextual);
                        if (hasTextualValues) {
                            isTextual = true;
                            console.log(`   ⚠️ Setting isTextual = true because ${textualValues.length} textual value(s) found`);
                        } else {
                            console.log(`   ✅ Keeping isTextual = false (no textual values found)`);
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Error checking field type from sample values:', e);
                }
            }
            
            // If still not determined and we have no valid sample values, try to infer from field name
            // But first, check if facets are available (they would show if field is numeric)
            if (!isTextual && sampleValues.length === 0) {
                console.log(`\n⚠️ [Colorize Algorithm] Field "${matchingField}" - No valid sample values after filtering NaN/null/undefined/empty`);
                console.log(`   - This could mean:`);
                console.log(`     1. All values in sample are NaN/null/undefined/empty`);
                console.log(`     2. OR values exist but were filtered out incorrectly`);
                console.log(`   - Checking if we can infer from field name or other sources...`);
                
                // Try to check if facets exist for this field (would indicate it's numeric)
                // getFacets signature: (szFilter, szDiv, szFieldsA, szId, szMap, fFlag)
                let hasFacets = false;
                try {
                    if (window.ixmaps && window.ixmaps.data && typeof window.ixmaps.data.getFacets === 'function') {
                        // Get theme ID from fieldSchema or targetTheme
                        const themeId = fieldSchema?.theme || targetTheme?.szId || targetTheme?.id || targetTheme?.name;
                        if (themeId) {
                            console.log(`   🔍 Checking facets for field "${matchingField}" in theme "${themeId}"...`);
                            const facets = window.ixmaps.data.getFacets('', '', [matchingField], themeId, 'map', true);
                            if (facets && facets.length > 0 && facets[0]) {
                                const facet = facets[0];
                                // If facet has min/max, it's likely numeric
                                if ((facet.min !== undefined && facet.min !== null && !isNaN(facet.min)) ||
                                    (facet.max !== undefined && facet.max !== null && !isNaN(facet.max))) {
                                    hasFacets = true;
                                    console.log(`   ✅ Found facets with min/max for "${matchingField}" - field is NUMERIC`);
                                    console.log(`      - Min: ${facet.min}, Max: ${facet.max}`);
                                    isTextual = false;
                                } else {
                                    console.log(`   ℹ️ Facets found but no min/max - facet:`, facet);
                                }
                            } else {
                                console.log(`   ℹ️ No facets returned for field "${matchingField}"`);
                            }
                        } else {
                            console.log(`   ⚠️ No theme ID available to check facets (fieldSchema.theme: ${fieldSchema?.theme}, targetTheme: ${targetTheme?.szId || targetTheme?.id || targetTheme?.name})`);
                        }
                    }
                } catch (e) {
                    console.warn(`   ⚠️ Could not check facets:`, e);
                }
                
                if (!hasFacets) {
                    // If we can't determine from facets, we need to rely on actual data analysis
                    // Don't make assumptions based on field names - that's unreliable
                    // If we have no valid sample values after filtering, we can't determine the type
                    // In this case, default to textual (categorical) as it's safer
                    if (sampleValues.length === 0) {
                        console.log(`   ⚠️ Cannot determine field type: no valid sample values and no facets available`);
                        console.log(`   ⚠️ Defaulting to TEXTUAL (categorical) - this may be incorrect if field is numeric`);
                        console.log(`   💡 Suggestion: Check if facets are available for this field, or ensure data is loaded correctly`);
                        isTextual = true;
                    } else {
                        // We have sample values - the textual check should have already determined isTextual
                        // This branch shouldn't normally be reached, but if it is, trust the sample analysis
                        console.log(`   ℹ️ No facets available, but sample values exist - using sample analysis result`);
                    }
                }
            }
            
            console.log(`\n🎯 [Colorize Algorithm] Field "${matchingField}" - FINAL isTextual value: ${isTextual}`);
            if (isTextual) {
                console.log(`   ⚠️ DECISION: Field will use CATEGORICAL color scheme`);
            } else {
                console.log(`   ✅ DECISION: Field will use NUMERIC color scheme`);
            }
            
            try {
                const mapApi = map.Api;
                const themeId = targetTheme.szId || targetTheme.id || targetTheme.name;
                
                // Get current theme definition (like Composer does)
                let themeDef = null;
                let currentType = '';
                try {
                    // Try getThemeDefinitionObj first (like Composer)
                    if (map.getThemeDefinitionObj) {
                        themeDef = map.getThemeDefinitionObj(themeId);
                    } else if (mapApi.getMapThemeDefinitionObj) {
                        themeDef = mapApi.getMapThemeDefinitionObj(themeId);
                    } else if (mapApi.getThemeDefinitionObj) {
                        themeDef = mapApi.getThemeDefinitionObj(themeId);
                    }
                    
                    if (themeDef) {
                        currentType = themeDef.style?.type || themeDef.type || '';
                    } else {
                        // Fallback: try to get type from theme object
                        try {
                            const themeObj = mapApi.getTheme(themeId);
                            currentType = themeObj?.theme?.szFlag || themeObj?.theme?.type || '';
                        } catch (e2) {
                            currentType = targetTheme.szFlag || targetTheme.type || '';
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Error getting theme definition:', e);
                    // Fallback: try to get type from theme object
                    try {
                        const themeObj = mapApi.getTheme(themeId);
                        currentType = themeObj?.theme?.szFlag || themeObj?.theme?.type || '';
                    } catch (e2) {
                        currentType = targetTheme.szFlag || targetTheme.type || '';
                    }
                }
                
                // If we don't have themeDef, try to get it again or create a minimal one
                if (!themeDef) {
                    // Try alternative methods
                    if (mapApi.getMapThemeDefinitionObj) {
                        try {
                            themeDef = mapApi.getMapThemeDefinitionObj(themeId);
                        } catch (e) {
                            // If still no themeDef, we'll use changeThemeStyle as fallback
                        }
                    }
                }
                
                // Use replaceTheme to modify the existing theme (like Composer does)
                // CRITICAL: replaceTheme uses szId to find and replace the theme
                // We MUST use the actual theme's szId, not themeDef.style.name
                try {
                    // Get the actual theme object to find its szId
                    let actualThemeId = themeId;
                    let actualTheme = null;
                    
                    try {
                        actualTheme = mapApi.getTheme(themeId);
                        if (actualTheme) {
                            // Get szId from the theme object (this is what replaceTheme uses to find the theme)
                            if (actualTheme.szId) {
                                actualThemeId = actualTheme.szId;
                            } else if (actualTheme.theme && actualTheme.theme.szId) {
                                actualThemeId = actualTheme.theme.szId;
                            }
                        }
                    } catch (e) {
                        console.warn('⚠️ Could not get actual theme, using themeId:', e);
                    }
                    
                    console.log('🔄 Replacing theme with szId:', actualThemeId, 'original themeId:', themeId);
                    
                    // If we don't have themeDef, we need to create a minimal one from the actual theme
                    if (!themeDef) {
                        try {
                            // Try to get theme definition again
                            if (mapApi.getMapThemeDefinitionObj) {
                                themeDef = mapApi.getMapThemeDefinitionObj(actualThemeId);
                            }
                            
                            // If still no themeDef, create minimal one from actual theme
                            if (!themeDef && actualTheme) {
                                themeDef = {
                                    layer: actualTheme.theme?.szLayer || actualTheme.szLayer || '',
                                    field: matchingField,
                                    style: {
                                        id: actualThemeId,
                                        name: actualThemeId,
                                        type: currentType || 'CHART|DOT'
                                    }
                                };
                            }
                        } catch (e) {
                            console.warn('⚠️ Could not create themeDef, will use minimal one:', e);
                        }
                    }
                    
                    // Ensure themeDef exists
                    if (!themeDef) {
                        throw new Error('Could not get or create theme definition');
                    }
                    
                    // Ensure themeDef.style exists
                    if (!themeDef.style) {
                        themeDef.style = {};
                    }
                    
                    // CRITICAL: Set the id/name to match the actual theme's szId
                    // This ensures replaceTheme finds and replaces the correct theme
                    themeDef.style.id = actualThemeId;
                    themeDef.style.name = actualThemeId;
                    
                    // Modify field property (main theme field for coloring)
                    themeDef.field = matchingField;
                    
                    // Determine new type and colorscheme based on data type
                    let newType = currentType;
                    
                    // Check if current type includes FEATURES/FEATURE - must be preserved
                    const hasFeatures = newType && (newType.includes('FEATURES') || newType.includes('FEATURE'));
                    
                    console.log(`🎨 [Colorize Algorithm] Field "${matchingField}" - Color scheme selection:`);
                    console.log(`   - isTextual: ${isTextual}`);
                    console.log(`   - Current type: ${currentType}`);
                    console.log(`   - Has FEATURES: ${hasFeatures}`);
                    
                    if (isTextual) {
                        // Textual data: use CATEGORICAL
                        console.log(`   ✅ Choosing CATEGORICAL color scheme (field is textual/categorical)`);
                        
                        if (!newType || !newType.includes('CATEGORICAL')) {
                            // Add CATEGORICAL to type
                            if (hasFeatures) {
                                // Preserve FEATURES and add CATEGORICAL
                                newType = newType + '|CATEGORICAL';
                            } else if (newType && newType.includes('CHART')) {
                                newType = newType + '|CATEGORICAL';
                            } else {
                                newType = 'CHART|CATEGORICAL';
                            }
                        }
                        themeDef.style.type = newType;
                        themeDef.style.colorscheme = '100|tableau';
                        
                        console.log(`   - New type: ${newType}`);
                        console.log(`   - Color scheme: 100|tableau`);
                        
                        // For FEATURE themes, ensure fillopacity is at least 0.7
                        if (hasFeatures) {
                            const currentFillOpacity = parseFloat(themeDef.style.fillopacity) || 0;
                            if (currentFillOpacity < 0.7) {
                                themeDef.style.fillopacity = '0.7';
                            }
                        }
                    } else {
                        // Numeric data: use colorscheme with gradient
                        console.log(`   ✅ Choosing NUMERIC color scheme (field is numeric)`);
                        console.log(`   ✅ Choosing NUMERIC color scheme (field is numeric)`);
                        if (hasFeatures) {
                            // FEATURES theme: must add CHOROPLETH while preserving FEATURES
                            if (!newType || !newType.includes('CHOROPLETH')) {
                                newType = (newType || '') + '|CHOROPLETH|EQUIDISTANT';
                            } else if (!newType.includes('EQUIDISTANT')) {
                                // CHOROPLETH already present, just add EQUIDISTANT if missing
                                newType = newType + '|EQUIDISTANT';
                            }
                            // If both CHOROPLETH and EQUIDISTANT are already present, keep as is
                        } else if (!newType || (!newType.includes('CHART') && !newType.includes('CHOROPLETH'))) {
                            // No FEATURES: standard CHOROPLETH logic
                            newType = 'CHOROPLETH|EQUIDISTANT';
                        }
                        themeDef.style.type = newType;
                        themeDef.style.colorscheme = '7|#ffffff|#ff0000';
                        
                        console.log(`   - New type: ${newType}`);
                        console.log(`   - Color scheme: 7|#ffffff|#ff0000`);
                        
                        // For FEATURE themes, ensure fillopacity is at least 0.7
                        if (hasFeatures) {
                            const currentFillOpacity = parseFloat(themeDef.style.fillopacity) || 0;
                            if (currentFillOpacity < 0.7) {
                                themeDef.style.fillopacity = '0.7';
                            }
                        }
                    }
                    
                    // Replace theme on map using replaceTheme (like Composer does)
                    // replaceTheme finds theme by szId, removes it, and creates new one with same szId
                    if (map.replaceTheme) {
                        map.replaceTheme(actualThemeId, themeDef);
                        console.log('✅ Theme replaced successfully using map.replaceTheme');
                    } else if (map.replace) {
                        map.replace(actualThemeId, themeDef);
                        console.log('✅ Theme replaced successfully using map.replace');
                    } else if (mapApi.replaceTheme) {
                        mapApi.replaceTheme(actualThemeId, themeDef);
                        console.log('✅ Theme replaced successfully using mapApi.replaceTheme');
                    } else {
                        // Fallback: use ixmaps.replaceTheme
                        if (window.ixmaps && window.ixmaps.replaceTheme) {
                            window.ixmaps.replaceTheme(actualThemeId, themeDef);
                            console.log('✅ Theme replaced successfully using ixmaps.replaceTheme');
                        } else {
                            throw new Error('replaceTheme method not available');
                        }
                    }
                    
                    // Close data table overlay if theme has geometry and is visible
                    setTimeout(() => {
                        if (typeof checkAndCloseDataTableIfThemeVisible === 'function') {
                            checkAndCloseDataTableIfThemeVisible();
                        }
                    }, 500);
                } catch (replaceError) {
                    console.warn('⚠️ Error replacing theme:', replaceError);
                    // Fallback: try changeThemeStyle as last resort
                    try {
                        console.warn('⚠️ Falling back to changeThemeStyle');
                        mapApi.changeThemeStyle(themeId, `field:${matchingField}`, "set");
                        const newType = isTextual ? 'CHART|CATEGORICAL' : 'CHOROPLETH|EQUIDISTANT';
                        mapApi.changeThemeStyle(themeId, `type:${newType}`, "set");
                        const csStr = isTextual ? '100|tableau' : '7|#ffffff|#ff0000';
                        mapApi.changeThemeStyle(themeId, `colorscheme:${csStr}`, "set");
                    } catch (e2) {
                        console.error('❌ Failed to replace or change theme:', e2);
                    }
                }
                
                // Get theme title for comprehensive message
                let themeTitle = themeId;
                try {
                    const themeObj = mapApi.getTheme(themeId);
                    if (themeObj && themeObj.szTitle) {
                        themeTitle = themeObj.szTitle;
                    } else if (fieldSchema && fieldSchema.themeTitle) {
                        themeTitle = fieldSchema.themeTitle;
                    }
                } catch (e) {
                    // Use themeId if title not available
                }
                
                const detectedLanguage = this.detectLanguage(query);
                const visualizationType = isTextual 
                    ? (detectedLanguage === 'it' ? 'visualizzazione categorica' 
                       : detectedLanguage === 'de' ? 'kategorische Visualisierung'
                       : detectedLanguage === 'fr' ? 'visualisation catégorielle'
                       : detectedLanguage === 'es' ? 'visualización categórica'
                       : 'categorical visualization')
                    : (detectedLanguage === 'it' ? 'visualizzazione a gradiente di colore'
                       : detectedLanguage === 'de' ? 'Farbverlauf-Visualisierung'
                       : detectedLanguage === 'fr' ? 'visualisation en dégradé de couleur'
                       : detectedLanguage === 'es' ? 'visualización de gradiente de color'
                       : 'color gradient visualization');
                
                const responseMsg = detectedLanguage === 'it' 
                    ? `✅ Colore configurato con successo!\n\nHo applicato una ${visualizationType} al tema "${themeTitle}" utilizzando il campo "${matchingField}". ${isTextual ? 'I colori sono assegnati in base alle categorie del campo.' : 'I colori variano in base ai valori numerici del campo, con un gradiente dal bianco al rosso.'}`
                    : detectedLanguage === 'de'
                    ? `✅ Farbe erfolgreich konfiguriert!\n\nIch habe eine ${visualizationType} auf das Theme "${themeTitle}" angewendet, das das Feld "${matchingField}" verwendet. ${isTextual ? 'Die Farben werden basierend auf den Kategorien des Feldes zugewiesen.' : 'Die Farben variieren basierend auf den numerischen Werten des Feldes mit einem Farbverlauf von weiß zu rot.'}`
                    : detectedLanguage === 'fr'
                    ? `✅ Couleur configurée avec succès!\n\nJ'ai appliqué une ${visualizationType} au thème "${themeTitle}" en utilisant le champ "${matchingField}". ${isTextual ? 'Les couleurs sont attribuées en fonction des catégories du champ.' : 'Les couleurs varient en fonction des valeurs numériques du champ, avec un dégradé du blanc au rouge.'}`
                    : detectedLanguage === 'es'
                    ? `✅ ¡Color configurado con éxito!\n\nHe aplicado una ${visualizationType} al tema "${themeTitle}" utilizando el campo "${matchingField}". ${isTextual ? 'Los colores se asignan según las categorías del campo.' : 'Los colores varían según los valores numéricos del campo, con un gradiente de blanco a rojo.'}`
                    : `✅ Color configured successfully!\n\nI've applied a ${visualizationType} to the theme "${themeTitle}" using the field "${matchingField}". ${isTextual ? 'Colors are assigned based on the field categories.' : 'Colors vary based on the field\'s numeric values, with a gradient from white to red.'}`;
                
                return {
                    items: [],
                    response: responseMsg,
                    count: 0,
                    query: { method: 'colorfield', sql: '', field: matchingField, theme: themeId, isTextual: isTextual },
                    modelUsed: parsed.modelUsed || null // Include which model was used for parsing
                };
            } catch (e) {
                console.error('❌ Error applying color to theme:', e);
                return null;
            }
        },
        
        /**
         * Show available color schemes from colorscheme.js
         * Called when user asks about colorschemes/colors (not "color by field")
         */
        handleShowColorSchemes: async function(query, parsed) {
            const detectedLanguage = parsed.detectedLanguage || 'en';
            
            // List of available named color schemes from colorscheme.js
            const namedSchemes = [
                { name: 'spectrum', description: 'Spectral color scheme (rainbow-like)' },
                { name: 'office', description: 'Office color palette' },
                { name: 'mineral', description: 'Mineral color palette' },
                { name: 'pastel', description: 'Pastel color palette' },
                { name: 'harvest', description: 'Harvest color palette' },
                { name: 'fruit', description: 'Fruit color palette' },
                { name: 'kmeans', description: 'K-means color palette' },
                { name: 'kmeansp', description: 'K-means plus color palette' },
                { name: 'pimp', description: 'Pimp color palette' },
                { name: 'intense', description: 'Intense color palette' },
                { name: 'fluo', description: 'Fluorescent color palette' },
                { name: 'tableau', description: 'Tableau color palette' },
                { name: 'tableau10', description: 'Tableau 10-color palette' },
                { name: 'tableau20', description: 'Tableau 20-color palette' }
            ];
            
            // Common gradient examples
            const gradientExamples = [
                { example: '7|#ffffff|#ff0000', description: 'White to red gradient (7 classes)' },
                { example: '5|#ffffff|#0000ff', description: 'White to blue gradient (5 classes)' },
                { example: '7|#ffffff|#00ff00', description: 'White to green gradient (7 classes)' },
                { example: '5|#ffeeee|#dd0000', description: 'Light red to dark red gradient' },
                { example: '10|#eeeeff|#0000cc', description: 'Light blue to dark blue gradient' }
            ];
            
            const languageMessages = {
                'en': {
                    title: 'Available Color Schemes',
                    intro: 'ixmaps supports the following color schemes:',
                    namedSchemes: '**Named Color Schemes:**',
                    gradients: '**Gradient Color Schemes:**',
                    gradientFormat: 'You can also create custom gradients using the format: `[number of classes]|[start color]|[end color]`',
                    examples: 'Examples:',
                    usage: 'To use a color scheme, say "color by [field name]" and the system will automatically select an appropriate scheme, or you can specify a scheme in your query.'
                },
                'de': {
                    title: 'Verfügbare Farbschemata',
                    intro: 'ixmaps unterstützt die folgenden Farbschemata:',
                    namedSchemes: '**Benannte Farbschemata:**',
                    gradients: '**Farbverlauf-Schemata:**',
                    gradientFormat: 'Sie können auch benutzerdefinierte Farbverläufe mit dem Format erstellen: `[Anzahl der Klassen]|[Startfarbe]|[Endfarbe]`',
                    examples: 'Beispiele:',
                    usage: 'Um ein Farbschema zu verwenden, sagen Sie "Farbe nach [Feldname]" und das System wählt automatisch ein geeignetes Schema aus, oder Sie können ein Schema in Ihrer Abfrage angeben.'
                },
                'it': {
                    title: 'Schemi di Colore Disponibili',
                    intro: 'ixmaps supporta i seguenti schemi di colore:',
                    namedSchemes: '**Schemi di Colore Nominati:**',
                    gradients: '**Schemi di Colore a Gradiente:**',
                    gradientFormat: 'Puoi anche creare gradienti personalizzati usando il formato: `[numero di classi]|[colore iniziale]|[colore finale]`',
                    examples: 'Esempi:',
                    usage: 'Per usare uno schema di colore, dì "colore per [nome campo]" e il sistema selezionerà automaticamente uno schema appropriato, oppure puoi specificare uno schema nella tua richiesta.'
                },
                'fr': {
                    title: 'Schémas de Couleurs Disponibles',
                    intro: 'ixmaps prend en charge les schémas de couleurs suivants:',
                    namedSchemes: '**Schémas de Couleurs Nommés:**',
                    gradients: '**Schémas de Couleurs en Dégradé:**',
                    gradientFormat: 'Vous pouvez également créer des dégradés personnalisés en utilisant le format: `[nombre de classes]|[couleur de départ]|[couleur de fin]`',
                    examples: 'Exemples:',
                    usage: 'Pour utiliser un schéma de couleurs, dites "couleur par [nom du champ]" et le système sélectionnera automatiquement un schéma approprié, ou vous pouvez spécifier un schéma dans votre requête.'
                },
                'es': {
                    title: 'Esquemas de Color Disponibles',
                    intro: 'ixmaps admite los siguientes esquemas de color:',
                    namedSchemes: '**Esquemas de Color Nombrados:**',
                    gradients: '**Esquemas de Color en Gradiente:**',
                    gradientFormat: 'También puede crear gradientes personalizados usando el formato: `[número de clases]|[color inicial]|[color final]`',
                    examples: 'Ejemplos:',
                    usage: 'Para usar un esquema de color, diga "color por [nombre del campo]" y el sistema seleccionará automáticamente un esquema apropiado, o puede especificar un esquema en su consulta.'
                }
            };
            
            const messages = languageMessages[detectedLanguage] || languageMessages['en'];
            
            let response = `🎨 **${messages.title}**\n\n${messages.intro}\n\n`;
            
            // Add named schemes
            response += `${messages.namedSchemes}\n`;
            for (const scheme of namedSchemes) {
                response += `  • **${scheme.name}** - ${scheme.description}\n`;
            }
            
            // Add gradient information
            response += `\n${messages.gradients}\n`;
            response += `${messages.gradientFormat}\n\n`;
            response += `${messages.examples}\n`;
            for (const example of gradientExamples) {
                response += `  • \`${example.example}\` - ${example.description}\n`;
            }
            
            response += `\n💡 ${messages.usage}`;
            
            return {
                items: [],
                response: response,
                count: 0,
                query: { method: 'showcolorschemes', sql: '' },
                modelUsed: parsed.modelUsed || null
            };
        },
        
        /**
         * Handle tooltip configuration by field - similar to handleColorByField
         * Sets tooltip template using Mustache syntax
         */
        handleTooltipByField: async function(query, queryLower, tooltipWords, schemas, parsed) {
            const map = this.getMap();
            const detectedLanguage = parsed.detectedLanguage || 'en';
            
            if (!map || !map.Api) {
                const noMapMsg = detectedLanguage === 'it' 
                    ? '⚠️ Impossibile configurare il tooltip: la mappa non è disponibile. Assicurati che la mappa sia caricata correttamente.'
                    : detectedLanguage === 'de'
                    ? '⚠️ Kann Tooltip nicht konfigurieren: Karte ist nicht verfügbar. Stellen Sie sicher, dass die Karte korrekt geladen ist.'
                    : detectedLanguage === 'fr'
                    ? '⚠️ Impossible de configurer le tooltip: la carte n\'est pas disponible. Assurez-vous que la carte est chargée correctement.'
                    : detectedLanguage === 'es'
                    ? '⚠️ No se puede configurar el tooltip: el mapa no está disponible. Asegúrese de que el mapa esté cargado correctamente.'
                    : '⚠️ Cannot configure tooltip: map is not available. Please ensure the map is loaded correctly.';
                
                return {
                    items: [],
                    response: noMapMsg,
                    count: 0,
                    query: { method: 'tooltip', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Get all themes
            let allThemes = [];
            try {
                if (map.Themes && map.Themes.getThemes) {
                    allThemes = map.Themes.getThemes();
                } else if (map.Api && map.Api.getAllThemes) {
                    allThemes = map.Api.getAllThemes();
                }
            } catch (e) {
                console.warn('Could not get themes:', e);
                const errorMsg = detectedLanguage === 'it'
                    ? '⚠️ Impossibile ottenere i temi dalla mappa. Assicurati che i dati siano caricati.'
                    : detectedLanguage === 'de'
                    ? '⚠️ Kann keine Themes von der Karte abrufen. Stellen Sie sicher, dass Daten geladen sind.'
                    : detectedLanguage === 'fr'
                    ? '⚠️ Impossible d\'obtenir les thèmes de la carte. Assurez-vous que les données sont chargées.'
                    : detectedLanguage === 'es'
                    ? '⚠️ No se pueden obtener los temas del mapa. Asegúrese de que los datos estén cargados.'
                    : '⚠️ Cannot get themes from map. Please ensure data is loaded.';
                
                return {
                    items: [],
                    response: errorMsg,
                    count: 0,
                    query: { method: 'tooltip', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            if (allThemes.length === 0) {
                console.warn('⚠️ No themes found on map');
                const noThemesMsg = detectedLanguage === 'it'
                    ? '⚠️ Nessun tema trovato sulla mappa. Per configurare il tooltip, devi prima caricare i dati. Prova a dire "carica dati" o "mostra dati di esempio".'
                    : detectedLanguage === 'de'
                    ? '⚠️ Keine Themes auf der Karte gefunden. Um den Tooltip zu konfigurieren, müssen Sie zuerst Daten laden. Versuchen Sie "Daten laden" oder "Beispieldaten anzeigen" zu sagen.'
                    : detectedLanguage === 'fr'
                    ? '⚠️ Aucun thème trouvé sur la carte. Pour configurer le tooltip, vous devez d\'abord charger des données. Essayez de dire "charger des données" ou "afficher des données d\'exemple".'
                    : detectedLanguage === 'es'
                    ? '⚠️ No se encontraron temas en el mapa. Para configurar el tooltip, primero debe cargar datos. Intente decir "cargar datos" o "mostrar datos de ejemplo".'
                    : (typeof window !== 'undefined' && window.__IXMAPS_AI_CHAT_EMBED_HOST__
                        ? '⚠️ No themes found on map. To configure tooltip, you need to load data first. Use `load data url [URL]` to add a dataset.'
                        : '⚠️ No themes found on map. To configure tooltip, you need to load data first. Try saying "load data" or "show sample data".');
                
                return {
                    items: [],
                    response: noThemesMsg,
                    count: 0,
                    query: { method: 'tooltip', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Extract field name from patterns like "tooltip by X", "show tooltip X", "tooltip X"
            let fieldNameCandidate = null;
            const tooltipByPattern = /tooltip\s+by\s+(\w+)/i;
            const showTooltipPattern = /show\s+tooltip\s+(\w+)/i;
            const tooltipFieldPattern = /tooltip\s+(\w+)/i;
            
            let match = query.match(tooltipByPattern);
            if (!match) match = query.match(showTooltipPattern);
            if (!match) match = query.match(tooltipFieldPattern);
            
            if (match && match[1]) {
                fieldNameCandidate = match[1].trim();
            }
            
            // Try to find matching field in schemas
            let matchingField = null;
            let targetTheme = null;
            let fieldSchema = null;
            
            // First, try direct matching with the extracted field name
            // CRITICAL: Prioritize exact matches to avoid partial matches (e.g., "BU_km2" matching "percBU_km2_rate")
            if (fieldNameCandidate) {
                const candidateLower = fieldNameCandidate.toLowerCase();
                const candidateNormalized = candidateLower.replace(/[_\s]/g, '');
                
                // First pass: try exact matches only (highest priority)
                for (const schema of schemas) {
                    if (schema.fields) {
                        const field = schema.fields.find(f => {
                            const fName = typeof f === 'string' ? f : (f.name || f.field || f.id || '');
                            const fNameLower = fName.toLowerCase();
                            const fNameNormalized = fNameLower.replace(/[_\s]/g, '');
                            
                            // Exact match (case-insensitive) - highest priority
                            return fNameLower === candidateLower || 
                                   fNameNormalized === candidateNormalized;
                        });
                        
                        if (field) {
                            matchingField = typeof field === 'string' ? field : (field.name || field.field || field.id);
                            fieldSchema = schema;
                            
                            // Find a theme for this schema
                            const theme = allThemes.find(t => {
                                const tId = t.szId || t.id || t.name;
                                return tId === schema.theme || 
                                       schema.themeTitle?.toLowerCase().includes(tId.toLowerCase()) ||
                                       tId.toLowerCase().includes(schema.theme?.toLowerCase());
                            });
                            if (theme) {
                                targetTheme = theme;
                            } else if (allThemes.length > 0) {
                                targetTheme = allThemes[0];
                            }
                            break;
                        }
                    }
                    if (matchingField) break;
                }
                
                // Second pass: if no exact match, try substring matches but prefer longer field names
                // This prevents "BU_km2" from matching when user wants "percBU_km2_rate"
                // Only match if the field name contains the candidate (not the other way around)
                if (!matchingField) {
                    let bestMatch = null;
                    let bestMatchLength = 0;
                    
                    for (const schema of schemas) {
                        if (schema.fields) {
                            for (const field of schema.fields) {
                                const fName = typeof field === 'string' ? field : (field.name || field.field || field.id || '');
                                const fNameLower = fName.toLowerCase();
                                
                                // Only match if field name contains the candidate (not the other way around)
                                // This ensures "percBU_km2_rate" matches "percBU_km2_rate" not "BU_km2"
                                // Prefer longer field names when multiple matches exist
                                if (fNameLower.includes(candidateLower) && fName.length > bestMatchLength) {
                                    bestMatch = field;
                                    bestMatchLength = fName.length;
                                    fieldSchema = schema;
                                }
                            }
                        }
                    }
                    
                    if (bestMatch) {
                        matchingField = typeof bestMatch === 'string' ? bestMatch : (bestMatch.name || bestMatch.field || bestMatch.id);
                        console.log('✅ Found matching field via substring match:', matchingField, 'for candidate:', fieldNameCandidate);
                        
                        // Find a theme for this schema
                        const theme = allThemes.find(t => {
                            const tId = t.szId || t.id || t.name;
                            return tId === fieldSchema.theme || 
                                   fieldSchema.themeTitle?.toLowerCase().includes(tId.toLowerCase()) ||
                                   tId.toLowerCase().includes(fieldSchema.theme?.toLowerCase());
                        });
                        if (theme) {
                            targetTheme = theme;
                        } else if (allThemes.length > 0) {
                            targetTheme = allThemes[0];
                        }
                    } else {
                        console.log('⚠️ No substring match found for candidate:', fieldNameCandidate);
                    }
                }
            }
            
            console.log('🎯 Final matchingField:', matchingField, 'for candidate:', fieldNameCandidate);
            
            // If no field found, try using AI to match the field name
            if (!matchingField && fieldNameCandidate) {
                try {
                    const matchedField = await this.matchFieldNameWithAI(fieldNameCandidate, schemas);
                    if (matchedField) {
                        matchingField = matchedField.fieldName;
                        fieldSchema = matchedField.schema;
                        targetTheme = allThemes.find(t => {
                            const tId = t.szId || t.id || t.name;
                            return tId === matchedField.schema.theme;
                        }) || allThemes[0];
                    }
                } catch (e) {
                    console.warn('⚠️ AI field matching failed:', e);
                }
            }
            
            // Fallback: try searching all words in query
            if (!matchingField) {
                const queryWords = queryLower.split(/\s+/);
                const commonWords = ['show', 'me', 'by', 'with', 'the', 'a', 'an', 'per', 'con', 'mit', 'avec', 'par', 'por', 'com'];
                const tooltipWordsList = Object.values(tooltipWords).flat();
                
                for (const schema of schemas) {
                    if (schema.fields) {
                        for (const word of queryWords) {
                            if (tooltipWordsList.includes(word) || commonWords.includes(word) || word.length < 3) continue;
                            
                            const field = schema.fields.find(f => {
                                const fName = typeof f === 'string' ? f : (f.name || f.field || f.id || '');
                                const fNameLower = fName.toLowerCase();
                                const wordLower = word.toLowerCase();
                                
                                if (fNameLower === wordLower || fNameLower.includes(wordLower)) {
                                    return true;
                                }
                                if (fName.length > 3 && wordLower.includes(fNameLower)) {
                                    return true;
                                }
                                return false;
                            });
                            
                            if (field) {
                                matchingField = typeof field === 'string' ? field : (field.name || field.field || field.id);
                                fieldSchema = schema;
                                targetTheme = allThemes[0];
                                break;
                            }
                        }
                        if (matchingField) break;
                    }
                }
            }
            
            if (!matchingField || !targetTheme) {
                console.warn('⚠️ Cannot configure tooltip: matchingField =', matchingField, 'targetTheme =', targetTheme);
                
                // If user asked to configure tooltip but no field was nominated, provide helpful suggestions
                const languageMessages = {
                    'en': {
                        title: 'How to Configure Tooltips',
                        intro: 'To configure tooltips, you need to specify which data field to show in the tooltip. Here are some options:',
                        examples: [
                            'Say "tooltip by [field name]" - for example: "tooltip by population" or "tooltip by country"',
                            'Say "show tooltip [field name]" - for example: "show tooltip name"',
                            'The tooltip will display when you hover over map features'
                        ],
                        availableFields: 'Available data fields you can use:',
                        noFields: 'No data fields are currently available. Please load data first.'
                    },
                    'de': {
                        title: 'Wie man Tooltips konfiguriert',
                        intro: 'Um Tooltips zu konfigurieren, müssen Sie angeben, welches Datenfeld im Tooltip angezeigt werden soll. Hier sind einige Optionen:',
                        examples: [
                            'Sagen Sie "Tooltip nach [Feldname]" - zum Beispiel: "Tooltip nach Bevölkerung" oder "Tooltip nach Land"',
                            'Sagen Sie "Tooltip [Feldname] zeigen" - zum Beispiel: "Tooltip Name zeigen"',
                            'Der Tooltip wird angezeigt, wenn Sie über Kartenfeatures fahren'
                        ],
                        availableFields: 'Verfügbare Datenfelder, die Sie verwenden können:',
                        noFields: 'Derzeit sind keine Datenfelder verfügbar. Bitte laden Sie zuerst Daten.'
                    },
                    'it': {
                        title: 'Come configurare i tooltip',
                        intro: 'Per configurare i tooltip, è necessario specificare quale campo dati mostrare nel tooltip. Ecco alcune opzioni:',
                        examples: [
                            'Dì "tooltip per [nome campo]" - ad esempio: "tooltip per popolazione" o "tooltip per paese"',
                            'Dì "mostra tooltip [nome campo]" - ad esempio: "mostra tooltip nome"',
                            'Il tooltip verrà visualizzato quando passi il mouse sulle feature della mappa'
                        ],
                        availableFields: 'Campi dati disponibili che puoi utilizzare:',
                        noFields: 'Attualmente non ci sono campi dati disponibili. Si prega di caricare prima i dati.'
                    },
                    'fr': {
                        title: 'Comment configurer les tooltips',
                        intro: 'Pour configurer les tooltips, vous devez spécifier quel champ de données afficher dans le tooltip. Voici quelques options:',
                        examples: [
                            'Dites "tooltip par [nom du champ]" - par exemple: "tooltip par population" ou "tooltip par pays"',
                            'Dites "afficher tooltip [nom du champ]" - par exemple: "afficher tooltip nom"',
                            'Le tooltip s\'affichera lorsque vous survolerez les éléments de la carte'
                        ],
                        availableFields: 'Champs de données disponibles que vous pouvez utiliser:',
                        noFields: 'Aucun champ de données n\'est actuellement disponible. Veuillez d\'abord charger des données.'
                    },
                    'es': {
                        title: 'Cómo configurar tooltips',
                        intro: 'Para configurar tooltips, debe especificar qué campo de datos mostrar en el tooltip. Aquí hay algunas opciones:',
                        examples: [
                            'Diga "tooltip por [nombre del campo]" - por ejemplo: "tooltip por población" o "tooltip por país"',
                            'Diga "mostrar tooltip [nombre del campo]" - por ejemplo: "mostrar tooltip nombre"',
                            'El tooltip se mostrará cuando pase el mouse sobre las características del mapa'
                        ],
                        availableFields: 'Campos de datos disponibles que puede usar:',
                        noFields: 'Actualmente no hay campos de datos disponibles. Por favor, cargue los datos primero.'
                    }
                };
                
                const messages = languageMessages[detectedLanguage] || languageMessages['en'];
                
                // Get available fields from schemas
                const availableFields = [];
                for (const schema of schemas) {
                    if (schema.fields && schema.fields.length > 0) {
                        for (const field of schema.fields) {
                            const fieldName = typeof field === 'string' ? field : (field.name || field.field || field.id || '');
                            if (fieldName && fieldName !== 'geometry' && fieldName !== 'Geometry' && fieldName !== 'GEOMETRY') {
                                availableFields.push(fieldName);
                            }
                        }
                    }
                }
                
                let response = `💬 **${messages.title}**\n\n${messages.intro}\n\n`;
                
                for (const example of messages.examples) {
                    response += `• ${example}\n`;
                }
                
                response += `\n${messages.availableFields}\n`;
                
                if (availableFields.length > 0) {
                    // Show up to 10 fields as examples
                    const fieldsToShow = availableFields.slice(0, 10);
                    response += fieldsToShow.map(f => `  • ${f}`).join('\n');
                    if (availableFields.length > 10) {
                        response += `\n  ... and ${availableFields.length - 10} more fields`;
                    }
                    response += `\n\n💡 **Example:** Try saying "tooltip by ${fieldsToShow[0]}"`;
                } else {
                    response += `\n${messages.noFields}`;
                }
                
                // Add information about special field $item$
                const itemFieldInfo = detectedLanguage === 'it'
                    ? `\n\n📌 **Campo speciale \`$item$\`:** \`$item$\` è un campo predefinito che non corrisponde a una colonna nei tuoi dati. Quando lo usi, ogni elemento della mappa riceve automaticamente il valore 1, indipendentemente dai dati. Questo è principalmente utile per la colorazione quando vuoi visualizzare solo la geometria senza colorare in base a dati specifici.`
                    : detectedLanguage === 'de'
                    ? `\n\n📌 **Spezielles Feld \`$item$\`:** \`$item$\` ist ein vordefiniertes Feld, das keiner Spalte in Ihren Daten entspricht. Wenn Sie es verwenden, erhält jedes Kartenelement automatisch den Wert 1, unabhängig von den Daten. Dies ist hauptsächlich für die Farbgebung nützlich, wenn Sie nur die Geometrie anzeigen möchten, ohne nach spezifischen Daten zu färben.`
                    : detectedLanguage === 'fr'
                    ? `\n\n📌 **Champ spécial \`$item$\`:** \`$item$\` est un champ prédéfini qui ne correspond à aucune colonne dans vos données. Lorsque vous l'utilisez, chaque élément de la carte reçoit automatiquement la valeur 1, indépendamment des données. C'est principalement utile pour la coloration lorsque vous voulez afficher uniquement la géométrie sans colorer selon des données spécifiques.`
                    : detectedLanguage === 'es'
                    ? `\n\n📌 **Campo especial \`$item$\`:** \`$item$\` es un campo predefinido que no corresponde a ninguna columna en sus datos. Cuando lo usa, cada elemento del mapa recibe automáticamente el valor 1, independientemente de los datos. Esto es principalmente útil para la coloración cuando desea mostrar solo la geometría sin colorear según datos específicos.`
                    : `\n\n📌 **Special field \`$item$\`:** \`$item$\` is a predefined field that doesn't correspond to any column in your data. When you use it, every map element automatically receives the value 1, regardless of the data. This is mainly useful for coloring when you want to display just the geometry without coloring based on specific data.`;
                response += itemFieldInfo;
                
                return {
                    items: [],
                    response: response,
                    count: 0,
                    query: { method: 'tooltip', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            try {
                const mapApi = map.Api;
                const themeId = targetTheme.szId || targetTheme.id || targetTheme.name;
                
                // Get current theme definition (like Composer does)
                let themeDef = null;
                let currentType = '';
                try {
                    // Try getThemeDefinitionObj first (like Composer)
                    if (map.getThemeDefinitionObj) {
                        themeDef = map.getThemeDefinitionObj(themeId);
                    } else if (mapApi.getMapThemeDefinitionObj) {
                        themeDef = mapApi.getMapThemeDefinitionObj(themeId);
                    } else if (mapApi.getThemeDefinitionObj) {
                        themeDef = mapApi.getThemeDefinitionObj(themeId);
                    }
                    
                    if (themeDef) {
                        currentType = themeDef.style?.type || themeDef.type || '';
                    } else {
                        // Fallback: try to get type from theme object
                        try {
                            const themeObj = mapApi.getTheme(themeId);
                            currentType = themeObj?.theme?.szFlag || themeObj?.theme?.type || '';
                        } catch (e2) {
                            currentType = targetTheme.szFlag || targetTheme.type || '';
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Error getting theme definition:', e);
                    // Fallback: try to get type from theme object
                    try {
                        const themeObj = mapApi.getTheme(themeId);
                        currentType = themeObj?.theme?.szFlag || themeObj?.theme?.type || '';
                    } catch (e2) {
                        currentType = targetTheme.szFlag || targetTheme.type || '';
                    }
                }
                
                // If we don't have themeDef, try to get it again or create a minimal one
                if (!themeDef) {
                    // Try alternative methods
                    if (mapApi.getMapThemeDefinitionObj) {
                        try {
                            themeDef = mapApi.getMapThemeDefinitionObj(themeId);
                        } catch (e) {
                            // If still no themeDef, we'll use changeThemeStyle as fallback
                        }
                    }
                }
                
                // Use replaceTheme to modify the existing theme (like Composer does)
                // CRITICAL: replaceTheme uses szId to find and replace the theme
                // We MUST use the actual theme's szId, not themeDef.style.name
                try {
                    // Get the actual theme object to find its szId
                    let actualThemeId = themeId;
                    let actualTheme = null;
                    
                    try {
                        actualTheme = mapApi.getTheme(themeId);
                        if (actualTheme) {
                            // Get szId from the theme object (this is what replaceTheme uses to find the theme)
                            if (actualTheme.szId) {
                                actualThemeId = actualTheme.szId;
                            } else if (actualTheme.theme && actualTheme.theme.szId) {
                                actualThemeId = actualTheme.theme.szId;
                            }
                        }
                    } catch (e) {
                        console.warn('⚠️ Could not get actual theme, using themeId:', e);
                    }
                    
                    console.log('🔄 Replacing theme with szId:', actualThemeId, 'original themeId:', themeId);
                    
                    // If we don't have themeDef, we need to create a minimal one from the actual theme
                    if (!themeDef) {
                        try {
                            // Try to get theme definition again
                            if (mapApi.getMapThemeDefinitionObj) {
                                themeDef = mapApi.getMapThemeDefinitionObj(actualThemeId);
                            }
                            
                            // If still no themeDef, create minimal one from actual theme
                            if (!themeDef && actualTheme) {
                                themeDef = {
                                    layer: actualTheme.theme?.szLayer || actualTheme.szLayer || '',
                                    field: matchingField,
                                    style: {
                                        id: actualThemeId,
                                        name: actualThemeId,
                                        type: currentType || 'CHART|DOT'
                                    }
                                };
                            }
                        } catch (e) {
                            console.warn('⚠️ Could not create themeDef, will use minimal one:', e);
                        }
                    }
                    
                    // Ensure themeDef exists
                    if (!themeDef) {
                        throw new Error('Could not get or create theme definition');
                    }
                    
                    // Ensure themeDef.style exists
                    if (!themeDef.style) {
                        themeDef.style = {};
                    }
                    
                    // CRITICAL: Set the id/name to match the actual theme's szId
                    // This ensures replaceTheme finds and replaces the correct theme
                    themeDef.style.id = actualThemeId;
                    themeDef.style.name = actualThemeId;
                    
                    // Set tooltip template using Mustache syntax
                    // Default tooltip template shows theme title and the field value
                    const tooltipTemplate = `<span style='white-space:nowrap;font-size:1.5em'>{{theme.title}}</span><br>{{${matchingField}}}`;
                    themeDef.style.tooltip = tooltipTemplate;
                    
                    // Replace theme on map using replaceTheme (like Composer does)
                    // replaceTheme finds theme by szId, removes it, and creates new one with same szId
                    if (map.replaceTheme) {
                        map.replaceTheme(actualThemeId, themeDef);
                        console.log('✅ Theme replaced successfully using map.replaceTheme');
                    } else if (map.replace) {
                        map.replace(actualThemeId, themeDef);
                        console.log('✅ Theme replaced successfully using map.replace');
                    } else if (mapApi.replaceTheme) {
                        mapApi.replaceTheme(actualThemeId, themeDef);
                        console.log('✅ Theme replaced successfully using mapApi.replaceTheme');
                    } else {
                        // Fallback: use ixmaps.replaceTheme
                        if (window.ixmaps && window.ixmaps.replaceTheme) {
                            window.ixmaps.replaceTheme(actualThemeId, themeDef);
                            console.log('✅ Theme replaced successfully using ixmaps.replaceTheme');
                        } else {
                            throw new Error('replaceTheme method not available');
                        }
                    }
                    
                    // Close data table overlay if theme has geometry and is visible
                    setTimeout(() => {
                        if (typeof checkAndCloseDataTableIfThemeVisible === 'function') {
                            checkAndCloseDataTableIfThemeVisible();
                        }
                    }, 500);
                } catch (replaceError) {
                    console.warn('⚠️ Error replacing theme:', replaceError);
                    // Fallback: try changeThemeStyle as last resort
                    try {
                        console.warn('⚠️ Falling back to changeThemeStyle');
                        const tooltipTemplate = `<span style='white-space:nowrap;font-size:1.5em'>{{theme.title}}</span><br>{{${matchingField}}}`;
                        mapApi.changeThemeStyle(themeId, `tooltip:${tooltipTemplate}`, "set");
                    } catch (e2) {
                        console.error('❌ Failed to replace or change theme:', e2);
                    }
                }
                
                // Get theme title for comprehensive message
                let themeTitle = themeId;
                try {
                    const themeObj = mapApi.getTheme(themeId);
                    if (themeObj && themeObj.szTitle) {
                        themeTitle = themeObj.szTitle;
                    } else if (fieldSchema && fieldSchema.themeTitle) {
                        themeTitle = fieldSchema.themeTitle;
                    }
                } catch (e) {
                    // Use themeId if title not available
                }
                
                const responseMsg = detectedLanguage === 'it' 
                    ? `✅ Tooltip configurato con successo!\n\nHo configurato il tooltip per il tema "${themeTitle}" per mostrare il campo "${matchingField}". Il tooltip verrà visualizzato quando passi il mouse sulle feature della mappa.`
                    : detectedLanguage === 'de'
                    ? `✅ Tooltip erfolgreich konfiguriert!\n\nIch habe den Tooltip für das Theme "${themeTitle}" konfiguriert, um das Feld "${matchingField}" anzuzeigen. Der Tooltip wird angezeigt, wenn Sie über Kartenfeatures fahren.`
                    : detectedLanguage === 'fr'
                    ? `✅ Tooltip configuré avec succès!\n\nJ'ai configuré le tooltip pour le thème "${themeTitle}" pour afficher le champ "${matchingField}". Le tooltip s'affichera lorsque vous survolerez les éléments de la carte.`
                    : detectedLanguage === 'es'
                    ? `✅ ¡Tooltip configurado con éxito!\n\nHe configurado el tooltip para el tema "${themeTitle}" para mostrar el campo "${matchingField}". El tooltip se mostrará cuando pase el mouse sobre las características del mapa.`
                    : `✅ Tooltip configured successfully!\n\nI've configured the tooltip for the theme "${themeTitle}" to show the field "${matchingField}". The tooltip will display when you hover over map features.`;
                
                return {
                    items: [],
                    response: responseMsg,
                    count: 0,
                    query: { method: 'tooltipfield', sql: '', field: matchingField, theme: themeId },
                    modelUsed: parsed.modelUsed || null // Include which model was used for parsing
                };
            } catch (e) {
                console.error('❌ Error applying tooltip to theme:', e);
                return null;
            }
        },
        
        /**
         * Handle id binding configuration by field - only for FEATURE themes
         * Sets itemfield binding to allow other themes to reference features by id
         */
        handleIdByField: async function(query, queryLower, idWords, schemas, parsed) {
            const map = this.getMap();
            const detectedLanguage = parsed.detectedLanguage || 'en';
            
            if (!map || !map.Api) {
                const noMapMsg = detectedLanguage === 'it' 
                    ? '⚠️ Impossibile configurare il binding id: la mappa non è disponibile.'
                    : detectedLanguage === 'de'
                    ? '⚠️ Kann ID-Bindung nicht konfigurieren: Karte ist nicht verfügbar.'
                    : detectedLanguage === 'fr'
                    ? '⚠️ Impossible de configurer la liaison id: la carte n\'est pas disponible.'
                    : detectedLanguage === 'es'
                    ? '⚠️ No se puede configurar el enlace id: el mapa no está disponible.'
                    : '⚠️ Cannot configure id binding: map is not available.';
                
                return {
                    items: [],
                    response: noMapMsg,
                    count: 0,
                    query: { method: 'idfield', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Get all themes
            let allThemes = [];
            try {
                if (map.Themes && map.Themes.getThemes) {
                    allThemes = map.Themes.getThemes();
                } else if (map.Api && map.Api.getAllThemes) {
                    allThemes = map.Api.getAllThemes();
                }
            } catch (e) {
                console.warn('Could not get themes:', e);
                return {
                    items: [],
                    response: '⚠️ Cannot get themes from map. Please ensure data is loaded.',
                    count: 0,
                    query: { method: 'idfield', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            if (allThemes.length === 0) {
                return {
                    items: [],
                    response: '⚠️ No themes found on map. Please load data first.',
                    count: 0,
                    query: { method: 'idfield', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Extract field name from patterns like "set id to X", "id to X", "set id X", "set itemfield to X"
            let fieldNameCandidate = null;
            const idPatterns = [
                /(?:set\s+)?id\s+to\s+([A-Z][A-Z0-9_]+|\w+)/i,
                /(?:set\s+)?id\s+by\s+([A-Z][A-Z0-9_]+|\w+)/i,
                /(?:set\s+)?id\s+is\s+([A-Z][A-Z0-9_]+|\w+)/i,
                /(?:set\s+)?id\s+as\s+([A-Z][A-Z0-9_]+|\w+)/i,
                // Pattern for "set id FIELD_NAME" (without "to" or "by")
                /(?:set\s+)?id\s+([A-Z][A-Z0-9_]+|\w+)(?:\s|$)/i,
                /(?:set\s+)?itemfield\s+to\s+([A-Z][A-Z0-9_]+|\w+)/i,
                /(?:set\s+)?item\s+field\s+to\s+([A-Z][A-Z0-9_]+|\w+)/i
            ];
            
            for (const pattern of idPatterns) {
                const match = query.match(pattern);
                if (match && match[1]) {
                    fieldNameCandidate = match[1].trim();
                    console.log('✅ [Id Binding] Extracted field name from pattern:', fieldNameCandidate, 'using pattern:', pattern);
                    break;
                }
            }
            
            // Also try to extract from the query if pattern didn't match but we know it's an id request
            if (!fieldNameCandidate && queryLower.includes('id') && (queryLower.includes('set') || queryLower.includes('to') || queryLower.includes('by'))) {
                // Try to find field name after "id" keyword - improved pattern to handle underscores
                const idKeywordMatch = query.match(/id\s+(?:to|by|is|as)\s+([A-Z][A-Z0-9_]+|\w+)/i);
                if (idKeywordMatch && idKeywordMatch[1]) {
                    fieldNameCandidate = idKeywordMatch[1].trim();
                    console.log('✅ [Id Binding] Extracted field name from keyword match:', fieldNameCandidate);
                } else {
                    // Try "set id FIELD_NAME" pattern (without "to" or "by")
                    const setIdMatch = query.match(/set\s+id\s+([A-Z][A-Z0-9_]+|\w+)/i);
                    if (setIdMatch && setIdMatch[1]) {
                        fieldNameCandidate = setIdMatch[1].trim();
                        console.log('✅ [Id Binding] Extracted field name from "set id FIELD" pattern:', fieldNameCandidate);
                    } else {
                        // Try to extract any word that looks like a field name (uppercase with underscores)
                        const fieldNameMatch = query.match(/([A-Z][A-Z0-9_]+)/);
                        if (fieldNameMatch && fieldNameMatch[1]) {
                            fieldNameCandidate = fieldNameMatch[1].trim();
                            console.log('✅ [Id Binding] Extracted field name from uppercase pattern:', fieldNameCandidate);
                        }
                    }
                }
            }
            
            if (!fieldNameCandidate) {
                console.log('⚠️ [Id Binding] Could not extract field name from query:', query);
                // Since we know this is an id binding request (hasIdBy was true), 
                // try one more time with a more flexible pattern
                const flexibleMatch = query.match(/id\s+(?:to|by|is|as)?\s*([A-Z][A-Z0-9_]+|[a-zA-Z_][\w_]*)/i);
                if (flexibleMatch && flexibleMatch[1]) {
                    fieldNameCandidate = flexibleMatch[1].trim();
                    console.log('✅ [Id Binding] Extracted field name with flexible pattern:', fieldNameCandidate);
                } else {
                    // Try to find any uppercase field name after "id"
                    const afterIdMatch = query.match(/id\s+([A-Z][A-Z0-9_]+)/i);
                    if (afterIdMatch && afterIdMatch[1]) {
                        fieldNameCandidate = afterIdMatch[1].trim();
                        console.log('✅ [Id Binding] Extracted field name after "id":', fieldNameCandidate);
                    } else {
                        // Return error response instead of null so the query doesn't continue as a filter
                        const errorMsg = detectedLanguage === 'it'
                            ? `❌ Impossibile estrarre il nome del campo dalla richiesta. Prova: "set id to [nome_campo]" o "set id [nome_campo]".`
                            : detectedLanguage === 'de'
                            ? `❌ Feldname konnte nicht aus der Anfrage extrahiert werden. Versuchen Sie: "set id to [feldname]" oder "set id [feldname]".`
                            : detectedLanguage === 'fr'
                            ? `❌ Impossible d'extraire le nom du champ de la requête. Essayez: "set id to [nom_champ]" ou "set id [nom_champ]".`
                            : detectedLanguage === 'es'
                            ? `❌ No se pudo extraer el nombre del campo de la solicitud. Intente: "set id to [nombre_campo]" o "set id [nombre_campo]".`
                            : `❌ Could not extract field name from request. Try: "set id to [field_name]" or "set id [field_name]".`;
                        
                        return {
                            items: [],
                            response: errorMsg,
                            count: 0,
                            query: { method: 'idfield', sql: '' },
                            modelUsed: parsed.modelUsed || null
                        };
                    }
                }
            }
            
            console.log('🔍 [Id Binding] Processing id binding request for field:', fieldNameCandidate);
            
            // Try to find matching field in schemas
            let matchingField = null;
            let targetTheme = null;
            let fieldSchema = null;
            
            // Find matching field
            if (fieldNameCandidate) {
                const candidateLower = fieldNameCandidate.toLowerCase();
                
                for (const schema of schemas) {
                    if (schema.fields) {
                        const field = schema.fields.find(f => {
                            const fName = typeof f === 'string' ? f : (f.name || f.field || f.id || '');
                            return fName.toLowerCase() === candidateLower;
                        });
                        
                        if (field) {
                            matchingField = typeof field === 'string' ? field : (field.name || field.field || field.id);
                            fieldSchema = schema;
                            
                            // Find theme for this schema
                            const theme = allThemes.find(t => {
                                const tId = t.szId || t.id || t.name;
                                return tId === schema.theme;
                            });
                            if (theme) {
                                targetTheme = theme;
                            } else if (allThemes.length > 0) {
                                targetTheme = allThemes[0];
                            }
                            break;
                        }
                    }
                }
            }
            
            // If no exact match, try AI matching
            if (!matchingField && fieldNameCandidate) {
                try {
                    const matchedField = await this.matchFieldNameWithAI(fieldNameCandidate, schemas);
                    if (matchedField) {
                        matchingField = matchedField.fieldName;
                        fieldSchema = matchedField.schema;
                        targetTheme = allThemes.find(t => {
                            const tId = t.szId || t.id || t.name;
                            return tId === matchedField.schema.theme;
                        }) || allThemes[0];
                    }
                } catch (e) {
                    console.warn('⚠️ AI field matching failed:', e);
                }
            }
            
            if (!matchingField) {
                const errorMsg = detectedLanguage === 'it'
                    ? `❌ Campo "${fieldNameCandidate}" non trovato. Verifica che il campo esista nei dati caricati.`
                    : detectedLanguage === 'de'
                    ? `❌ Feld "${fieldNameCandidate}" nicht gefunden. Stellen Sie sicher, dass das Feld in den geladenen Daten vorhanden ist.`
                    : detectedLanguage === 'fr'
                    ? `❌ Champ "${fieldNameCandidate}" introuvable. Assurez-vous que le champ existe dans les données chargées.`
                    : detectedLanguage === 'es'
                    ? `❌ Campo "${fieldNameCandidate}" no encontrado. Asegúrese de que el campo existe en los datos cargados.`
                    : `❌ Field "${fieldNameCandidate}" not found. Please ensure the field exists in the loaded data.`;
                
                return {
                    items: [],
                    response: errorMsg,
                    count: 0,
                    query: { method: 'idfield', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Get theme ID
            const themeId = targetTheme ? (targetTheme.szId || targetTheme.id || targetTheme.name) : allThemes[0]?.szId || allThemes[0]?.id || allThemes[0]?.name;
            
            if (!themeId) {
                return {
                    items: [],
                    response: '❌ Could not determine theme ID.',
                    count: 0,
                    query: { method: 'idfield', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // CRITICAL: Check if theme type is FEATURE
            const mapApi = map.Api;
            let themeType = '';
            try {
                const themeDef = mapApi.getMapThemeDefinitionObj(themeId);
                if (themeDef && themeDef.style && themeDef.style.type) {
                    themeType = themeDef.style.type;
                } else {
                    const themeObj = mapApi.getTheme(themeId);
                    if (themeObj && themeObj.theme && themeObj.theme.szFlag) {
                        themeType = themeObj.theme.szFlag;
                    }
                }
            } catch (e) {
                console.warn('Could not get theme type:', e);
            }
            
            // Check if theme type is FEATURE (case-insensitive)
            const isFeatureTheme = themeType && themeType.toUpperCase().includes('FEATURE');
            
            if (!isFeatureTheme) {
                const errorMsg = detectedLanguage === 'it'
                    ? `❌ **Impossibile impostare il binding id per questo tema.**\n\nIl binding id (itemfield) è disponibile solo per temi di tipo **FEATURE**. Questo tema ha tipo "${themeType || 'unknown'}" che non supporta il binding id.\n\n**Perché?** Il binding id consente ad altri temi di posizionare grafici o colorare elementi facendo riferimento alle feature di questo tema tramite l'id. Questa funzionalità è disponibile solo per temi FEATURE.`
                    : detectedLanguage === 'de'
                    ? `❌ **Kann ID-Bindung für dieses Theme nicht setzen.**\n\nDie ID-Bindung (itemfield) ist nur für Themes vom Typ **FEATURE** verfügbar. Dieses Theme hat den Typ "${themeType || 'unknown'}", der die ID-Bindung nicht unterstützt.\n\n**Warum?** Die ID-Bindung ermöglicht es anderen Themes, Diagramme zu positionieren oder Elemente zu färben, indem sie auf die Features dieses Themes über die ID verweisen. Diese Funktionalität ist nur für FEATURE-Themes verfügbar.`
                    : detectedLanguage === 'fr'
                    ? `❌ **Impossible de définir la liaison id pour ce thème.**\n\nLa liaison id (itemfield) n'est disponible que pour les thèmes de type **FEATURE**. Ce thème a le type "${themeType || 'unknown'}" qui ne prend pas en charge la liaison id.\n\n**Pourquoi?** La liaison id permet à d'autres thèmes de positionner des graphiques ou de colorer des éléments en référençant les éléments de ce thème via l'id. Cette fonctionnalité n'est disponible que pour les thèmes FEATURE.`
                    : detectedLanguage === 'es'
                    ? `❌ **No se puede establecer el enlace id para este tema.**\n\nEl enlace id (itemfield) solo está disponible para temas de tipo **FEATURE**. Este tema tiene tipo "${themeType || 'unknown'}" que no admite el enlace id.\n\n**¿Por qué?** El enlace id permite que otros temas posicionen gráficos o coloreen elementos haciendo referencia a las características de este tema a través del id. Esta funcionalidad solo está disponible para temas FEATURE.`
                    : `❌ **Cannot set id binding for this theme.**\n\nId binding (itemfield) is only available for themes of type **FEATURE**. This theme has type "${themeType || 'unknown'}" which does not support id binding.\n\n**Why?** Id binding allows other themes to position charts or colorize feature elements by referencing this theme's features through the id. This functionality is only available for FEATURE themes.`;
                
                return {
                    items: [],
                    response: errorMsg,
                    count: 0,
                    query: { method: 'idfield', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Set the id binding - itemfield in style becomes id in binding
            // This is equivalent to setting binding.id in the theme definition
            // The user provides the column/field name to set as the id property in the binding
            try {
                const mapApi = map.Api;
                
                // First, try to get the theme definition and set itemfield directly
                // itemfield in style.itemfield becomes binding.id in the theme definition
                let themeDef = null;
                try {
                    themeDef = mapApi.getMapThemeDefinitionObj(themeId);
                    if (themeDef) {
                        // Set itemfield in style - this will be reflected in binding.id
                        if (!themeDef.style) {
                            themeDef.style = {};
                        }
                        themeDef.style.itemfield = matchingField;
                        
                        // Also ensure binding.id is set if binding object exists
                        if (!themeDef.binding) {
                            themeDef.binding = {};
                        }
                        themeDef.binding.id = matchingField;
                        
                        console.log('✅ [Id Binding] Set itemfield in theme definition:', matchingField);
                    }
                } catch (e) {
                    console.warn('Could not access theme definition directly:', e);
                }
                
                // Use changeThemeStyle to apply the change - this should process itemfield
                // The format "itemfield:fieldName" sets the itemfield property in the theme style
                mapApi.changeThemeStyle(themeId, `itemfield:${matchingField}`, "set");
                
                // Also try to set it on the theme object directly if accessible
                try {
                    const themeObj = mapApi.getTheme(themeId);
                    if (themeObj && themeObj.szItemField !== matchingField) {
                        // Set szItemField directly (this is what itemfield maps to)
                        themeObj.szItemField = matchingField;
                        console.log('✅ [Id Binding] Set szItemField on theme object:', matchingField);
                    }
                } catch (e) {
                    console.warn('Could not set szItemField directly on theme:', e);
                }
                
                // Get theme title for message
                let themeTitle = themeId;
                try {
                    const themeObj = mapApi.getTheme(themeId);
                    if (themeObj && themeObj.szTitle) {
                        themeTitle = themeObj.szTitle;
                    } else if (fieldSchema && fieldSchema.themeTitle) {
                        themeTitle = fieldSchema.themeTitle;
                    }
                } catch (e) {
                    // Use themeId if title not available
                }
                
                const responseMsg = detectedLanguage === 'it'
                    ? `✅ Binding id configurato con successo!\n\nHo impostato il campo id (itemfield) su "${matchingField}" per il tema FEATURE "${themeTitle}". Ora altri temi possono posizionare grafici o colorare elementi facendo riferimento alle feature di questo tema tramite l'id "${matchingField}".`
                    : detectedLanguage === 'de'
                    ? `✅ ID-Bindung erfolgreich konfiguriert!\n\nIch habe das ID-Feld (itemfield) auf "${matchingField}" für das FEATURE-Theme "${themeTitle}" gesetzt. Andere Themes können nun Diagramme positionieren oder Elemente färben, indem sie auf die Features dieses Themes über die ID "${matchingField}" verweisen.`
                    : detectedLanguage === 'fr'
                    ? `✅ Liaison id configurée avec succès!\n\nJ'ai défini le champ id (itemfield) sur "${matchingField}" pour le thème FEATURE "${themeTitle}". D'autres thèmes peuvent maintenant positionner des graphiques ou colorer des éléments en référençant les éléments de ce thème via l'id "${matchingField}".`
                    : detectedLanguage === 'es'
                    ? `✅ ¡Enlace id configurado con éxito!\n\nHe establecido el campo id (itemfield) en "${matchingField}" para el tema FEATURE "${themeTitle}". Otros temas ahora pueden posicionar gráficos o colorear elementos haciendo referencia a las características de este tema a través del id "${matchingField}".`
                    : `✅ Id binding configured successfully!\n\nI've set the id field (itemfield) to "${matchingField}" for the FEATURE theme "${themeTitle}". Other themes can now position charts or colorize feature elements by referencing this theme's features through the id "${matchingField}".`;
                
                return {
                    items: [],
                    response: responseMsg,
                    count: 0,
                    query: { method: 'idfield', sql: '', field: matchingField, theme: themeId },
                    modelUsed: parsed.modelUsed || null
                };
            } catch (e) {
                console.error('❌ Error setting id binding:', e);
                const errorMsg = detectedLanguage === 'it'
                    ? `❌ Errore durante l'impostazione del binding id: ${e.message}`
                    : detectedLanguage === 'de'
                    ? `❌ Fehler beim Setzen der ID-Bindung: ${e.message}`
                    : detectedLanguage === 'fr'
                    ? `❌ Erreur lors de la définition de la liaison id: ${e.message}`
                    : detectedLanguage === 'es'
                    ? `❌ Error al establecer el enlace id: ${e.message}`
                    : `❌ Error setting id binding: ${e.message}`;
                
                return {
                    items: [],
                    response: errorMsg,
                    count: 0,
                    query: { method: 'idfield', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
        },
        
        /**
         * Get theme type from theme definition or theme object
         * @param {String} themeId - Theme ID
         * @returns {String} Theme type (uppercase, normalized)
         */
        getThemeType: function(themeId) {
            const map = this.getMap();
            if (!map || !map.Api) {
                return '';
            }
            
            try {
                const mapApi = map.Api;
                let themeType = '';
                
                // Try to get from theme definition first
                const themeDef = mapApi.getMapThemeDefinitionObj(themeId);
                if (themeDef && themeDef.style && themeDef.style.type) {
                    themeType = themeDef.style.type;
                } else {
                    // Try to get from theme object
                    const themeObj = mapApi.getTheme(themeId);
                    if (themeObj) {
                        if (themeObj.theme && themeObj.theme.szFlag) {
                            themeType = themeObj.theme.szFlag;
                        } else if (themeObj.szFlag) {
                            themeType = themeObj.szFlag;
                        } else if (themeObj.theme && themeObj.theme.type) {
                            themeType = themeObj.theme.type;
                        } else if (themeObj.type) {
                            themeType = themeObj.type;
                        }
                    }
                }
                
                return themeType ? String(themeType).toUpperCase() : '';
            } catch (e) {
                console.warn('Could not get theme type for', themeId, ':', e);
                return '';
            }
        },
        
        /**
         * Get layer name from theme definition or theme object
         * @param {String} themeId - Theme ID
         * @returns {String} Layer name
         */
        getThemeLayerName: function(themeId) {
            const map = this.getMap();
            if (!map || !map.Api) {
                return '';
            }
            
            try {
                const mapApi = map.Api;
                let layerName = '';
                
                // Try to get from theme definition first
                const themeDef = mapApi.getMapThemeDefinitionObj(themeId);
                if (themeDef && themeDef.layer) {
                    layerName = themeDef.layer;
                } else {
                    // Try to get from theme object
                    const themeObj = mapApi.getTheme(themeId);
                    if (themeObj) {
                        if (themeObj.theme && themeObj.theme.szLayer) {
                            layerName = themeObj.theme.szLayer;
                        } else if (themeObj.szLayer) {
                            layerName = themeObj.szLayer;
                        } else if (themeObj.theme && themeObj.theme.layer) {
                            layerName = themeObj.theme.layer;
                        } else if (themeObj.layer) {
                            layerName = themeObj.layer;
                        }
                    }
                }
                
                return layerName ? String(layerName) : '';
            } catch (e) {
                console.warn('Could not get layer name for', themeId, ':', e);
                return '';
            }
        },
        
        /**
         * Find matching fields between two themes' data by comparing actual values
         * @param {String} theme1Id - First theme ID
         * @param {String} theme2Id - Second theme ID
         * @returns {Array} Array of matching field pairs: [{field1: string, field2: string, matchCount: number}, ...]
         */
        findMatchingFields: function(theme1Id, theme2Id) {
            console.log('🔍 [findMatchingFields] Looking for matching fields by comparing values between:', theme1Id, 'and', theme2Id);
            
            const map = this.getMap();
            if (!map || !map.Api) {
                console.warn('⚠️ [findMatchingFields] Map not available');
                return [];
            }
            
            const mapApi = map.Api;
            const matchingFields = [];
            
            // Get theme1's itemfield if it exists (prioritize this for matching)
            let theme1ItemField = null;
            try {
                const theme1Def = mapApi.getMapThemeDefinitionObj(theme1Id);
                const mapTheme1 = map.Themes ? map.Themes.getTheme(theme1Id) : null;
                
                // Check multiple sources for itemfield
                if (theme1Def) {
                    theme1ItemField = theme1Def.style?.itemfield || theme1Def.binding?.id || null;
                }
                if (!theme1ItemField && mapTheme1) {
                    theme1ItemField = mapTheme1.szItemField || null;
                }
                if (theme1ItemField) {
                    console.log(`🔍 [findMatchingFields] Theme1 has itemfield set to: "${theme1ItemField}" - will prioritize this for matching`);
                }
            } catch (e) {
                console.warn('Could not get theme1 itemfield:', e);
            }
            
            // Get theme2's itemfield if it exists (also prioritize this for matching)
            let theme2ItemField = null;
            try {
                const theme2Def = mapApi.getMapThemeDefinitionObj(theme2Id);
                const mapTheme2 = map.Themes ? map.Themes.getTheme(theme2Id) : null;
                
                // Check multiple sources for itemfield
                if (theme2Def) {
                    theme2ItemField = theme2Def.style?.itemfield || theme2Def.binding?.id || null;
                }
                if (!theme2ItemField && mapTheme2) {
                    theme2ItemField = mapTheme2.szItemField || null;
                }
                if (theme2ItemField) {
                    console.log(`🔍 [findMatchingFields] Theme2 has itemfield set to: "${theme2ItemField}" - will prioritize this for matching`);
                }
            } catch (e) {
                console.warn('Could not get theme2 itemfield:', e);
            }
            
            // Get theme objects to access data
            let theme1Obj = null;
            let theme2Obj = null;
            let theme1Data = null;
            let theme2Data = null;
            
            try {
                theme1Obj = mapApi.getTheme(theme1Id);
                console.log('🔍 [findMatchingFields] Theme1 object structure:', {
                    hasObjTheme: !!theme1Obj?.objTheme,
                    hasObjThemeObjTheme: !!theme1Obj?.objTheme?.objTheme,
                    hasDbFields: !!theme1Obj?.objTheme?.dbFields,
                    hasDbRecords: !!theme1Obj?.objTheme?.dbRecords,
                    hasNestedDbFields: !!theme1Obj?.objTheme?.objTheme?.dbFields,
                    hasNestedDbRecords: !!theme1Obj?.objTheme?.objTheme?.dbRecords,
                    theme1ObjKeys: theme1Obj ? Object.keys(theme1Obj) : null
                });
                
                // Try different paths to access data (based on how getAvailableSchemas does it)
                if (theme1Obj && theme1Obj.objTheme) {
                    // Path 1: objTheme.objTheme (nested structure - used in executeDataQuery)
                    if (theme1Obj.objTheme.objTheme && theme1Obj.objTheme.objTheme.dbFields && theme1Obj.objTheme.objTheme.dbRecords) {
                        theme1Data = theme1Obj.objTheme.objTheme;
                        console.log('✅ [findMatchingFields] Theme1 data found via objTheme.objTheme path');
                    }
                    // Path 2: objTheme (direct structure - used in getAvailableSchemas line 3543)
                    else if (theme1Obj.objTheme.dbFields && theme1Obj.objTheme.dbRecords) {
                        theme1Data = theme1Obj.objTheme;
                        console.log('✅ [findMatchingFields] Theme1 data found via objTheme path');
                    }
                    // Path 3: Check if objTheme itself has the data structure
                    else if (theme1Obj.objTheme.dbTable && theme1Obj.objTheme.dbFields && theme1Obj.objTheme.dbRecords) {
                        theme1Data = theme1Obj.objTheme;
                        console.log('✅ [findMatchingFields] Theme1 data found via objTheme (with dbTable) path');
                    }
                }
            } catch (e) {
                console.warn('Could not get theme1 data:', e);
            }
            
            try {
                theme2Obj = mapApi.getTheme(theme2Id);
                console.log('🔍 [findMatchingFields] Theme2 object structure:', {
                    hasObjTheme: !!theme2Obj?.objTheme,
                    hasObjThemeObjTheme: !!theme2Obj?.objTheme?.objTheme,
                    hasDbFields: !!theme2Obj?.objTheme?.dbFields,
                    hasDbRecords: !!theme2Obj?.objTheme?.dbRecords,
                    hasNestedDbFields: !!theme2Obj?.objTheme?.objTheme?.dbFields,
                    hasNestedDbRecords: !!theme2Obj?.objTheme?.objTheme?.dbRecords,
                    theme2ObjKeys: theme2Obj ? Object.keys(theme2Obj) : null
                });
                
                // Try different paths to access data
                if (theme2Obj && theme2Obj.objTheme) {
                    // Path 1: objTheme.objTheme (nested structure - used in executeDataQuery)
                    if (theme2Obj.objTheme.objTheme && theme2Obj.objTheme.objTheme.dbFields && theme2Obj.objTheme.objTheme.dbRecords) {
                        theme2Data = theme2Obj.objTheme.objTheme;
                        console.log('✅ [findMatchingFields] Theme2 data found via objTheme.objTheme path');
                    }
                    // Path 2: objTheme (direct structure - used in getAvailableSchemas line 3543)
                    else if (theme2Obj.objTheme.dbFields && theme2Obj.objTheme.dbRecords) {
                        theme2Data = theme2Obj.objTheme;
                        console.log('✅ [findMatchingFields] Theme2 data found via objTheme path');
                    }
                    // Path 3: Check if objTheme itself has the data structure
                    else if (theme2Obj.objTheme.dbTable && theme2Obj.objTheme.dbFields && theme2Obj.objTheme.dbRecords) {
                        theme2Data = theme2Obj.objTheme;
                        console.log('✅ [findMatchingFields] Theme2 data found via objTheme (with dbTable) path');
                    }
                }
            } catch (e) {
                console.warn('Could not get theme2 data:', e);
            }
            
            if (!theme1Data || !theme1Data.dbFields || !theme1Data.dbRecords) {
                console.warn('⚠️ [findMatchingFields] Theme1 data not available or incomplete', {
                    hasTheme1Data: !!theme1Data,
                    hasDbFields: !!theme1Data?.dbFields,
                    hasDbRecords: !!theme1Data?.dbRecords,
                    theme1ObjKeys: theme1Obj ? Object.keys(theme1Obj) : null,
                    theme1ObjThemeKeys: theme1Obj?.objTheme ? Object.keys(theme1Obj.objTheme) : null
                });
                return [];
            }
            
            if (!theme2Data || !theme2Data.dbFields || !theme2Data.dbRecords) {
                console.warn('⚠️ [findMatchingFields] Theme2 data not available or incomplete', {
                    hasTheme2Data: !!theme2Data,
                    hasDbFields: !!theme2Data?.dbFields,
                    hasDbRecords: !!theme2Data?.dbRecords,
                    theme2ObjKeys: theme2Obj ? Object.keys(theme2Obj) : null,
                    theme2ObjThemeKeys: theme2Obj?.objTheme ? Object.keys(theme2Obj.objTheme) : null
                });
                return [];
            }
            
            // Fields to exclude from matching (special/reserved fields that shouldn't be used as itemfield/lookupfield)
            const excludedFields = new Set(['geometry', 'position', 'id', '_id', 'total', 'total_', 'sum']);
            
            // Extract field names and indices (excluding special fields)
            const fields1 = [];
            const fields1Indices = {};
            theme1Data.dbFields.forEach((field, index) => {
                const fieldName = typeof field === 'string' ? field : (field.id || field.name || field.field || String(field));
                if (fieldName && !excludedFields.has(fieldName.toLowerCase())) {
                    fields1.push(fieldName);
                    fields1Indices[fieldName] = index;
                }
            });
            
            const fields2 = [];
            const fields2Indices = {};
            theme2Data.dbFields.forEach((field, index) => {
                const fieldName = typeof field === 'string' ? field : (field.id || field.name || field.field || String(field));
                if (fieldName && !excludedFields.has(fieldName.toLowerCase())) {
                    fields2.push(fieldName);
                    fields2Indices[fieldName] = index;
                }
            });
            
            console.log('📊 [findMatchingFields] Theme1 fields:', fields1, 'records:', theme1Data.dbRecords.length);
            console.log('📊 [findMatchingFields] Theme2 fields:', fields2, 'records:', theme2Data.dbRecords.length);
            
            // Extract unique values from each field in theme1
            const theme1FieldValues = {};
            fields1.forEach(fieldName => {
                const fieldIndex = fields1Indices[fieldName];
                const values = new Set();
                theme1Data.dbRecords.forEach(record => {
                    if (record && record[fieldIndex] !== undefined && record[fieldIndex] !== null && record[fieldIndex] !== '') {
                        // Normalize value for comparison (convert to string, trim, lowercase)
                        const normalizedValue = String(record[fieldIndex]).trim().toLowerCase();
                        if (normalizedValue) {
                            values.add(normalizedValue);
                        }
                    }
                });
                theme1FieldValues[fieldName] = values;
                console.log(`📊 [findMatchingFields] Theme1 field "${fieldName}": ${values.size} unique values`);
            });
            
            // Extract unique values from each field in theme2
            const theme2FieldValues = {};
            fields2.forEach(fieldName => {
                const fieldIndex = fields2Indices[fieldName];
                const values = new Set();
                theme2Data.dbRecords.forEach(record => {
                    if (record && record[fieldIndex] !== undefined && record[fieldIndex] !== null && record[fieldIndex] !== '') {
                        // Normalize value for comparison (convert to string, trim, lowercase)
                        const normalizedValue = String(record[fieldIndex]).trim().toLowerCase();
                        if (normalizedValue) {
                            values.add(normalizedValue);
                        }
                    }
                });
                theme2FieldValues[fieldName] = values;
                console.log(`📊 [findMatchingFields] Theme2 field "${fieldName}": ${values.size} unique values`);
            });
            
            // Compare all field combinations to find matching values
            fields1.forEach(field1 => {
                const values1 = theme1FieldValues[field1];
                if (!values1 || values1.size === 0) {
                    return;
                }
                
                fields2.forEach(field2 => {
                    const values2 = theme2FieldValues[field2];
                    if (!values2 || values2.size === 0) {
                        return;
                    }
                    
                    // Find intersection of values (matching values)
                    const matchingValues = new Set();
                    values1.forEach(val => {
                        if (values2.has(val)) {
                            matchingValues.add(val);
                        }
                    });
                    
                    // If we have matching values, this is a potential match
                    // Require at least 1 matching value (or a threshold like 10% of values)
                    if (matchingValues.size > 0) {
                        const matchPercentage = (matchingValues.size / Math.min(values1.size, values2.size)) * 100;
                        const minMatches = Math.max(1, Math.min(values1.size, values2.size) * 0.1); // At least 10% or 1 match
                        
                        if (matchingValues.size >= minMatches) {
                            matchingFields.push({
                                field1: field1,
                                field2: field2,
                                matchCount: matchingValues.size,
                                matchPercentage: matchPercentage.toFixed(1),
                                sampleValues: Array.from(matchingValues).slice(0, 5) // Sample of matching values
                            });
                            console.log(`✅ [findMatchingFields] Match found: "${field1}" <-> "${field2}" (${matchingValues.size} matching values, ${matchPercentage.toFixed(1)}%)`);
                        }
                    }
                });
            });
            
            // Sort to prioritize matches using itemfields from either theme, then by match count
            matchingFields.sort((a, b) => {
                // Check if either field in the match is an itemfield (prioritize these)
                const aUsesTheme1ItemField = theme1ItemField && a.field1 === theme1ItemField;
                const aUsesTheme2ItemField = theme2ItemField && a.field2 === theme2ItemField;
                const aUsesAnyItemField = aUsesTheme1ItemField || aUsesTheme2ItemField;
                
                const bUsesTheme1ItemField = theme1ItemField && b.field1 === theme1ItemField;
                const bUsesTheme2ItemField = theme2ItemField && b.field2 === theme2ItemField;
                const bUsesAnyItemField = bUsesTheme1ItemField || bUsesTheme2ItemField;
                
                // If one uses itemfield and the other doesn't, prioritize the one that uses it
                if (aUsesAnyItemField && !bUsesAnyItemField) {
                    return -1; // a comes first
                }
                if (!aUsesAnyItemField && bUsesAnyItemField) {
                    return 1; // b comes first
                }
                
                // If both use itemfield, prioritize the one that uses both itemfields
                if (aUsesAnyItemField && bUsesAnyItemField) {
                    const aUsesBothItemFields = aUsesTheme1ItemField && aUsesTheme2ItemField;
                    const bUsesBothItemFields = bUsesTheme1ItemField && bUsesTheme2ItemField;
                    
                    if (aUsesBothItemFields && !bUsesBothItemFields) {
                        return -1; // a comes first (uses both itemfields)
                    }
                    if (!aUsesBothItemFields && bUsesBothItemFields) {
                        return 1; // b comes first (uses both itemfields)
                    }
                }
                
                // Sort by match count (descending) to prioritize best matches
                return b.matchCount - a.matchCount;
            });
            
            if ((theme1ItemField || theme2ItemField) && matchingFields.length > 0) {
                const itemFieldMatch = matchingFields.find(m => 
                    (theme1ItemField && m.field1 === theme1ItemField) || 
                    (theme2ItemField && m.field2 === theme2ItemField)
                );
                if (itemFieldMatch) {
                    console.log(`✅ [findMatchingFields] Prioritized match using itemfield: "${itemFieldMatch.field1}" <-> "${itemFieldMatch.field2}"`);
                    if (theme1ItemField && itemFieldMatch.field1 === theme1ItemField) {
                        console.log(`   - Theme1 itemfield: "${theme1ItemField}"`);
                    }
                    if (theme2ItemField && itemFieldMatch.field2 === theme2ItemField) {
                        console.log(`   - Theme2 itemfield: "${theme2ItemField}"`);
                    }
                }
            }
            
            console.log('✅ [findMatchingFields] Found', matchingFields.length, 'matching field pairs:', matchingFields);
            
            return matchingFields;
        },
        
        /**
         * Validate if two themes can be combined
         * @param {String} theme1Id - First theme ID (must be FEATURE type)
         * @param {String} theme2Id - Second theme ID (must be CHART or CHOROPLETH type)
         * @param {String} detectedLanguage - Language for error messages
         * @returns {Object} Validation result with valid, errors, warnings, matchingFields, etc.
         */
        validateThemeCombination: async function(theme1Id, theme2Id, detectedLanguage = 'en') {
            const map = this.getMap();
            const result = {
                valid: false,
                errors: [],
                warnings: [],
                matchingFields: [],
                layerName: '',
                theme1Type: '',
                theme2Type: ''
            };
            
            if (!map || !map.Api) {
                const errorMsg = detectedLanguage === 'it'
                    ? '⚠️ Mappa non disponibile. Assicurati che la mappa sia caricata.'
                    : detectedLanguage === 'de'
                    ? '⚠️ Karte nicht verfügbar. Stellen Sie sicher, dass die Karte geladen ist.'
                    : detectedLanguage === 'fr'
                    ? '⚠️ Carte non disponible. Assurez-vous que la carte est chargée.'
                    : detectedLanguage === 'es'
                    ? '⚠️ Mapa no disponible. Asegúrese de que el mapa esté cargado.'
                    : '⚠️ Map not available. Please ensure the map is loaded.';
                result.errors.push(errorMsg);
                return result;
            }
            
            const mapApi = map.Api;
            
            // Check if themes exist
            let theme1Def = null;
            let theme1Obj = null;
            let theme2Def = null;
            let theme2Obj = null;
            
            try {
                theme1Def = mapApi.getMapThemeDefinitionObj(theme1Id);
                theme1Obj = mapApi.getTheme(theme1Id);
            } catch (e) {
                const errorMsg = detectedLanguage === 'it'
                    ? `❌ Tema "${theme1Id}" non trovato.`
                    : detectedLanguage === 'de'
                    ? `❌ Theme "${theme1Id}" nicht gefunden.`
                    : detectedLanguage === 'fr'
                    ? `❌ Thème "${theme1Id}" introuvable.`
                    : detectedLanguage === 'es'
                    ? `❌ Tema "${theme1Id}" no encontrado.`
                    : `❌ Theme "${theme1Id}" not found.`;
                result.errors.push(errorMsg);
                return result;
            }
            
            try {
                theme2Def = mapApi.getMapThemeDefinitionObj(theme2Id);
                theme2Obj = mapApi.getTheme(theme2Id);
            } catch (e) {
                const errorMsg = detectedLanguage === 'it'
                    ? `❌ Tema "${theme2Id}" non trovato.`
                    : detectedLanguage === 'de'
                    ? `❌ Theme "${theme2Id}" nicht gefunden.`
                    : detectedLanguage === 'fr'
                    ? `❌ Thème "${theme2Id}" introuvable.`
                    : detectedLanguage === 'es'
                    ? `❌ Tema "${theme2Id}" no encontrado.`
                    : `❌ Theme "${theme2Id}" not found.`;
                result.errors.push(errorMsg);
                return result;
            }
            
            // Check 1: Theme Type Validation
            const theme1Type = this.getThemeType(theme1Id);
            const theme2Type = this.getThemeType(theme2Id);
            
            result.theme1Type = theme1Type;
            result.theme2Type = theme2Type;
            
            // First theme must be FEATURE
            if (!theme1Type || !theme1Type.includes('FEATURE')) {
                const errorMsg = detectedLanguage === 'it'
                    ? `❌ Il primo tema deve essere di tipo FEATURE. Il tema "${theme1Id}" ha tipo "${theme1Type || 'unknown'}".`
                    : detectedLanguage === 'de'
                    ? `❌ Das erste Theme muss vom Typ FEATURE sein. Das Theme "${theme1Id}" hat den Typ "${theme1Type || 'unknown'}".`
                    : detectedLanguage === 'fr'
                    ? `❌ Le premier thème doit être de type FEATURE. Le thème "${theme1Id}" a le type "${theme1Type || 'unknown'}".`
                    : detectedLanguage === 'es'
                    ? `❌ El primer tema debe ser de tipo FEATURE. El tema "${theme1Id}" tiene tipo "${theme1Type || 'unknown'}".`
                    : `❌ First theme must be of type FEATURE. Theme "${theme1Id}" has type "${theme1Type || 'unknown'}".`;
                result.errors.push(errorMsg);
            }
            
            // Second theme must be CHART or CHOROPLETH
            if (!theme2Type || (!theme2Type.includes('CHART') && !theme2Type.includes('CHOROPLETH'))) {
                const errorMsg = detectedLanguage === 'it'
                    ? `❌ Il secondo tema deve essere di tipo CHART o CHOROPLETH. Il tema "${theme2Id}" ha tipo "${theme2Type || 'unknown'}".`
                    : detectedLanguage === 'de'
                    ? `❌ Das zweite Theme muss vom Typ CHART oder CHOROPLETH sein. Das Theme "${theme2Id}" hat den Typ "${theme2Type || 'unknown'}".`
                    : detectedLanguage === 'fr'
                    ? `❌ Le deuxième thème doit être de type CHART ou CHOROPLETH. Le thème "${theme2Id}" a le type "${theme2Type || 'unknown'}".`
                    : detectedLanguage === 'es'
                    ? `❌ El segundo tema debe ser de tipo CHART o CHOROPLETH. El tema "${theme2Id}" tiene tipo "${theme2Type || 'unknown'}".`
                    : `❌ Second theme must be of type CHART or CHOROPLETH. Theme "${theme2Id}" has type "${theme2Type || 'unknown'}".`;
                result.errors.push(errorMsg);
            }
            
            // Check 2: Layer Name Matching
            let layer1Name = this.getThemeLayerName(theme1Id);
            let layer2Name = this.getThemeLayerName(theme2Id);

            if (!layer1Name || !layer2Name) {
                const errorMsg = detectedLanguage === 'it'
                    ? '❌ Impossibile determinare il nome del layer per uno o entrambi i temi.'
                    : detectedLanguage === 'de'
                    ? '❌ Layer-Name für ein oder beide Themes konnte nicht bestimmt werden.'
                    : detectedLanguage === 'fr'
                    ? '❌ Impossible de déterminer le nom de la couche pour un ou les deux thèmes.'
                    : detectedLanguage === 'es'
                    ? '❌ No se pudo determinar el nombre de la capa para uno o ambos temas.'
                    : '❌ Could not determine layer name for one or both themes.';
                result.errors.push(errorMsg);
            } else if (layer1Name.toLowerCase() !== layer2Name.toLowerCase()) {
                // Special case: If theme2 has layer 'generic', automatically set it to theme1's layer
                if (layer2Name.toLowerCase() === 'generic') {
                    try {
                        const mapApi = map.Api;
                        const theme2Obj = mapApi.getTheme(theme2Id);
                        
                        // Get the actual theme's szId (CRITICAL for replaceTheme)
                        let actualTheme2Id = theme2Id;
                        if (theme2Obj) {
                            if (theme2Obj.szId) {
                                actualTheme2Id = theme2Obj.szId;
                            } else if (theme2Obj.theme && theme2Obj.theme.szId) {
                                actualTheme2Id = theme2Obj.theme.szId;
                            }
                        }
                        
                        // Get or create theme definition
                        let theme2Def = mapApi.getMapThemeDefinitionObj(actualTheme2Id);
                        
                        // If theme definition doesn't exist, create it from theme object
                        if (!theme2Def) {
                            if (theme2Obj && theme2Obj.objTheme && theme2Obj.objTheme.objTheme) {
                                const objTheme2 = theme2Obj.objTheme.objTheme;
                                theme2Def = {
                                    layer: layer1Name,
                                    style: objTheme2.style ? Object.assign({}, objTheme2.style) : {},
                                    binding: objTheme2.binding ? Object.assign({}, objTheme2.binding) : {}
                                };
                            } else {
                                theme2Def = {
                                    layer: layer1Name,
                                    style: {},
                                    binding: {}
                                };
                            }
                        } else {
                            // Update layer in existing theme definition
                            theme2Def.layer = layer1Name;
                        }
                        
                        // CRITICAL: Ensure style.id and style.name match the actual theme's szId
                        // This is required for replaceTheme to find and replace the correct theme
                        if (!theme2Def.style) {
                            theme2Def.style = {};
                        }
                        theme2Def.style.id = actualTheme2Id;
                        theme2Def.style.name = actualTheme2Id;
                        
                        console.log(`✅ [validateThemeCombination] Set theme2Def.layer from "generic" to "${layer1Name}" (szId: ${actualTheme2Id})`);
                        
                        // Also try to update in theme object if accessible
                        if (theme2Obj) {
                            if (theme2Obj.theme) {
                                theme2Obj.theme.szLayer = layer1Name;
                                console.log(`✅ [validateThemeCombination] Updated theme2Obj.theme.szLayer to "${layer1Name}"`);
                            }
                            if (theme2Obj.szLayer !== undefined) {
                                theme2Obj.szLayer = layer1Name;
                                console.log(`✅ [validateThemeCombination] Updated theme2Obj.szLayer to "${layer1Name}"`);
                            }
                        }
                        
                        // Update mapTheme directly (this is the actual runtime object)
                        const mapTheme2 = map.Themes ? map.Themes.getTheme(actualTheme2Id) : null;
                        if (mapTheme2) {
                            mapTheme2.szLayer = layer1Name;
                            console.log(`✅ [validateThemeCombination] Updated mapTheme2.szLayer to "${layer1Name}"`);
                        }
                        
                        // Use replaceTheme to persist the change (like handleColorByField does)
                        try {
                            if (map.replaceTheme) {
                                map.replaceTheme(actualTheme2Id, theme2Def);
                                console.log(`✅ [validateThemeCombination] Used map.replaceTheme to persist layer change`);
                            } else if (mapApi.replaceTheme) {
                                mapApi.replaceTheme(actualTheme2Id, theme2Def);
                                console.log(`✅ [validateThemeCombination] Used mapApi.replaceTheme to persist layer change`);
                            } else if (window.ixmaps && window.ixmaps.replaceTheme) {
                                window.ixmaps.replaceTheme(actualTheme2Id, theme2Def);
                                console.log(`✅ [validateThemeCombination] Used ixmaps.replaceTheme to persist layer change`);
                            } else {
                                console.warn('⚠️ [validateThemeCombination] replaceTheme not available, change may not persist');
                            }
                        } catch (e) {
                            console.warn('⚠️ [validateThemeCombination] Could not use replaceTheme, change may not persist:', e);
                        }
                        
                        // Update layer2Name to reflect the change
                        layer2Name = layer1Name;
                        result.layerName = layer1Name;
                        
                        const infoMsg = detectedLanguage === 'it'
                            ? `ℹ️ Il layer del secondo tema è stato automaticamente impostato da "generic" a "${layer1Name}" per corrispondere al primo tema.`
                            : detectedLanguage === 'de'
                            ? `ℹ️ Der Layer des zweiten Themes wurde automatisch von "generic" auf "${layer1Name}" gesetzt, um dem ersten Theme zu entsprechen.`
                            : detectedLanguage === 'fr'
                            ? `ℹ️ La couche du deuxième thème a été automatiquement définie de "generic" à "${layer1Name}" pour correspondre au premier thème.`
                            : detectedLanguage === 'es'
                            ? `ℹ️ La capa del segundo tema se ha establecido automáticamente de "generic" a "${layer1Name}" para que coincida con el primer tema.`
                            : `ℹ️ Second theme's layer has been automatically set from "generic" to "${layer1Name}" to match the first theme.`;
                        result.warnings.push(infoMsg);
                    } catch (e) {
                        console.warn('Could not update theme2 layer:', e);
                        const errorMsg = detectedLanguage === 'it'
                            ? `❌ I temi devono avere lo stesso nome di layer per essere combinati. Layer 1: "${layer1Name}", Layer 2: "${layer2Name}". Impossibile aggiornare automaticamente il layer del secondo tema.`
                            : detectedLanguage === 'de'
                            ? `❌ Themes müssen denselben Layer-Namen haben, um kombiniert zu werden. Layer 1: "${layer1Name}", Layer 2: "${layer2Name}". Layer des zweiten Themes konnte nicht automatisch aktualisiert werden.`
                            : detectedLanguage === 'fr'
                            ? `❌ Les thèmes doivent avoir le même nom de couche pour être combinés. Couche 1: "${layer1Name}", Couche 2: "${layer2Name}". Impossible de mettre à jour automatiquement la couche du deuxième thème.`
                            : detectedLanguage === 'es'
                            ? `❌ Los temas deben tener el mismo nombre de capa para combinarse. Capa 1: "${layer1Name}", Capa 2: "${layer2Name}". No se pudo actualizar automáticamente la capa del segundo tema.`
                            : `❌ Themes must have the same layer name to be combined. Layer 1: "${layer1Name}", Layer 2: "${layer2Name}". Could not automatically update second theme's layer.`;
                        result.errors.push(errorMsg);
                    }
                } else {
                    const errorMsg = detectedLanguage === 'it'
                        ? `❌ I temi devono avere lo stesso nome di layer per essere combinati. Layer 1: "${layer1Name}", Layer 2: "${layer2Name}".`
                        : detectedLanguage === 'de'
                        ? `❌ Themes müssen denselben Layer-Namen haben, um kombiniert zu werden. Layer 1: "${layer1Name}", Layer 2: "${layer2Name}".`
                        : detectedLanguage === 'fr'
                        ? `❌ Les thèmes doivent avoir le même nom de couche pour être combinés. Couche 1: "${layer1Name}", Couche 2: "${layer2Name}".`
                        : detectedLanguage === 'es'
                        ? `❌ Los temas deben tener el mismo nombre de capa para combinarse. Capa 1: "${layer1Name}", Capa 2: "${layer2Name}".`
                        : `❌ Themes must have the same layer name to be combined. Layer 1: "${layer1Name}", Layer 2: "${layer2Name}".`;
                    result.errors.push(errorMsg);
                }
            } else {
                result.layerName = layer1Name;
            }
            
            // Check 3: Matching Column Detection
            const matchingFields = this.findMatchingFields(theme1Id, theme2Id);
            result.matchingFields = matchingFields;
            
            if (matchingFields.length === 0) {
                const errorMsg = detectedLanguage === 'it'
                    ? '❌ Nessuna colonna corrispondente trovata tra i dati dei due temi. I temi devono avere almeno una colonna con valori corrispondenti per essere combinati.'
                    : detectedLanguage === 'de'
                    ? '❌ Keine übereinstimmenden Spalten zwischen den Daten der beiden Themes gefunden. Themes müssen mindestens eine Spalte mit übereinstimmenden Werten haben, um kombiniert zu werden.'
                    : detectedLanguage === 'fr'
                    ? '❌ Aucune colonne correspondante trouvée entre les données des deux thèmes. Les thèmes doivent avoir au moins une colonne avec des valeurs correspondantes pour être combinés.'
                    : detectedLanguage === 'es'
                    ? '❌ No se encontraron columnas coincidentes entre los datos de los dos temas. Los temas deben tener al menos una columna con valores coincidentes para combinarse.'
                    : '❌ No matching columns found between the two themes\' data. Themes must have at least one column with matchable values to be combined.';
                result.errors.push(errorMsg);
            } else if (matchingFields.length > 1) {
                // Warning if multiple matching fields found
                const warningMsg = detectedLanguage === 'it'
                    ? `⚠️ Trovate ${matchingFields.length} colonne corrispondenti. Verrà utilizzata la prima: "${matchingFields[0].field1}".`
                    : detectedLanguage === 'de'
                    ? `⚠️ ${matchingFields.length} übereinstimmende Spalten gefunden. Die erste wird verwendet: "${matchingFields[0].field1}".`
                    : detectedLanguage === 'fr'
                    ? `⚠️ ${matchingFields.length} colonnes correspondantes trouvées. La première sera utilisée: "${matchingFields[0].field1}".`
                    : detectedLanguage === 'es'
                    ? `⚠️ Se encontraron ${matchingFields.length} columnas coincidentes. Se usará la primera: "${matchingFields[0].field1}".`
                    : `⚠️ Found ${matchingFields.length} matching columns. Will use the first: "${matchingFields[0].field1}".`;
                result.warnings.push(warningMsg);
            }
            
            // Set valid to true if no errors
            result.valid = result.errors.length === 0;
            
            return result;
        },
        
        /**
         * Handle theme combination request
         * @param {String} query - Original query
         * @param {String} queryLower - Lowercase query
         * @param {Array} schemas - Available schemas
         * @param {Object} parsed - Parsed query object
         * @returns {Promise<Object|null>} Result object or null
         */
        handleThemeCombination: async function(query, queryLower, schemas, parsed) {
            const map = this.getMap();
            const detectedLanguage = parsed.detectedLanguage || 'en';
            
            if (!map || !map.Api) {
                const noMapMsg = detectedLanguage === 'it' 
                    ? '⚠️ Impossibile combinare i temi: la mappa non è disponibile.'
                    : detectedLanguage === 'de'
                    ? '⚠️ Kann Themes nicht kombinieren: Karte ist nicht verfügbar.'
                    : detectedLanguage === 'fr'
                    ? '⚠️ Impossible de combiner les thèmes: la carte n\'est pas disponible.'
                    : detectedLanguage === 'es'
                    ? '⚠️ No se pueden combinar los temas: el mapa no está disponible.'
                    : '⚠️ Cannot combine themes: map is not available.';
                
                return {
                    items: [],
                    response: noMapMsg,
                    count: 0,
                    query: { method: 'combine', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            // Extract theme names/IDs from query or auto-detect
            let theme1Candidate = null;
            let theme2Candidate = null;
            
            // Pattern 1: "combine theme1 and theme2" (with theme names)
            const combinePattern = /(?:combine|connect)\s+(?:theme\s*|layer\s*)?(\w+)\s+(?:and|with|&)\s+(?:theme\s*|layer\s*)?(\w+)/i;
            const match = query.match(combinePattern);
            
            if (match && match[1] && match[2]) {
                // Theme names provided in query
                theme1Candidate = match[1].trim();
                theme2Candidate = match[2].trim();
                console.log('🔍 [Theme Combination] Extracted theme candidates from query:', theme1Candidate, 'and', theme2Candidate);
            } else {
                // Auto-detect themes: find BEST matching FEATURE theme and CHART/CHOROPLETH theme
                console.log('🔍 [Theme Combination] Auto-detecting themes using best-match algorithm...');
                
                let allThemes = [];
                try {
                    if (map.Themes && map.Themes.getThemes) {
                        allThemes = map.Themes.getThemes();
                    } else if (map.Api && map.Api.getAllThemes) {
                        allThemes = map.Api.getAllThemes();
                    }
                } catch (e) {
                    console.warn('Could not get themes for auto-detection:', e);
                }
                
                // Collect ALL FEATURE themes and ALL CHART/CHOROPLETH themes
                const featureThemes = [];
                const chartThemes = [];
                
                for (const theme of allThemes) {
                    const themeId = theme.szId || theme.id || theme.name;
                    if (!themeId) continue;
                    
                    const themeType = this.getThemeType(themeId);
                    
                    if (themeType && themeType.includes('FEATURE')) {
                        featureThemes.push(theme);
                        console.log('✅ [Theme Combination] Found FEATURE theme:', themeId);
                    }
                    
                    if (themeType && (themeType.includes('CHART') || themeType.includes('CHOROPLETH'))) {
                        chartThemes.push(theme);
                        console.log('✅ [Theme Combination] Found CHART/CHOROPLETH theme:', themeId);
                    }
                }
                
                console.log(`📊 [Theme Combination] Found ${featureThemes.length} FEATURE theme(s) and ${chartThemes.length} CHART/CHOROPLETH theme(s)`);
                
                if (featureThemes.length === 0 || chartThemes.length === 0) {
                    const errorMsg = detectedLanguage === 'it'
                        ? `❌ Impossibile trovare automaticamente i temi. ${featureThemes.length === 0 ? 'Nessun tema FEATURE trovato. ' : ''}${chartThemes.length === 0 ? 'Nessun tema CHART o CHOROPLETH trovato.' : ''}Specifica i nomi dei temi: "combine theme1 and theme2".`
                        : detectedLanguage === 'de'
                        ? `❌ Themes konnten nicht automatisch gefunden werden. ${featureThemes.length === 0 ? 'Kein FEATURE-Theme gefunden. ' : ''}${chartThemes.length === 0 ? 'Kein CHART- oder CHOROPLETH-Theme gefunden.' : ''}Geben Sie die Theme-Namen an: "combine theme1 and theme2".`
                        : detectedLanguage === 'fr'
                        ? `❌ Impossible de trouver automatiquement les thèmes. ${featureThemes.length === 0 ? 'Aucun thème FEATURE trouvé. ' : ''}${chartThemes.length === 0 ? 'Aucun thème CHART ou CHOROPLETH trouvé.' : ''}Spécifiez les noms des thèmes: "combine theme1 and theme2".`
                        : detectedLanguage === 'es'
                        ? `❌ No se pudieron encontrar automáticamente los temas. ${featureThemes.length === 0 ? 'No se encontró ningún tema FEATURE. ' : ''}${chartThemes.length === 0 ? 'No se encontró ningún tema CHART o CHOROPLETH.' : ''}Especifique los nombres de los temas: "combine theme1 and theme2".`
                        : `❌ Could not automatically find themes. ${featureThemes.length === 0 ? 'No FEATURE theme found. ' : ''}${chartThemes.length === 0 ? 'No CHART or CHOROPLETH theme found.' : ''}Please specify theme names: "combine theme1 and theme2".`;
                    
                    return {
                        items: [],
                        response: errorMsg,
                        count: 0,
                        query: { method: 'combine', sql: '' },
                        modelUsed: parsed.modelUsed || null
                    };
                }
                
                // Find the best combination by checking all pairs
                console.log('🔍 [Theme Combination] Checking all theme combinations to find best match...');
                const combinationResults = [];
                
                for (const featureTheme of featureThemes) {
                    const featureThemeId = featureTheme.szId || featureTheme.id || featureTheme.name;
                    
                    for (const chartTheme of chartThemes) {
                        const chartThemeId = chartTheme.szId || chartTheme.id || chartTheme.name;
                        
                        console.log(`🔍 [Theme Combination] Checking combination: ${featureThemeId} (FEATURE) + ${chartThemeId} (CHART/CHOROPLETH)`);
                        
                        // Find matching fields for this combination
                        const matchingFields = this.findMatchingFields(featureThemeId, chartThemeId);
                        
                        if (matchingFields.length > 0) {
                            // Get itemfield info for feature theme
                            let featureItemField = null;
                            try {
                                const mapApi = map.Api;
                                const featureThemeDef = mapApi.getMapThemeDefinitionObj(featureThemeId);
                                const mapThemeFeature = map.Themes ? map.Themes.getTheme(featureThemeId) : null;
                                
                                if (featureThemeDef) {
                                    featureItemField = featureThemeDef.style?.itemfield || featureThemeDef.binding?.id || null;
                                }
                                if (!featureItemField && mapThemeFeature) {
                                    featureItemField = mapThemeFeature.szItemField || null;
                                }
                            } catch (e) {
                                // Ignore errors
                            }
                            
                            const bestMatch = matchingFields[0]; // Already sorted by findMatchingFields
                            const usesItemField = featureItemField && bestMatch.field1 === featureItemField;
                            
                            combinationResults.push({
                                featureTheme: featureTheme,
                                chartTheme: chartTheme,
                                featureThemeId: featureThemeId,
                                chartThemeId: chartThemeId,
                                matchingFields: matchingFields,
                                bestMatch: bestMatch,
                                matchCount: bestMatch.matchCount,
                                hasItemfield: !!featureItemField,
                                usesItemField: usesItemField,
                                itemfield: featureItemField
                            });
                            
                            console.log(`✅ [Theme Combination] Found ${matchingFields.length} matching field(s), best: ${bestMatch.field1} ↔ ${bestMatch.field2} (${bestMatch.matchCount} matches)`);
                            if (usesItemField) {
                                console.log(`   ✅ Uses itemfield: "${featureItemField}"`);
                            } else if (featureItemField) {
                                console.log(`   ⚠️ Does NOT use itemfield ("${featureItemField}")`);
                            } else {
                                console.log(`   ⚠️ No itemfield set`);
                            }
                        } else {
                            console.log(`⚠️ [Theme Combination] No matching fields found for ${featureThemeId} + ${chartThemeId}`);
                        }
                    }
                }
                
                if (combinationResults.length === 0) {
                    const errorMsg = detectedLanguage === 'it'
                        ? '❌ Nessuna combinazione valida trovata tra i temi FEATURE e CHART/CHOROPLETH. I temi devono avere almeno una colonna con valori corrispondenti.'
                        : detectedLanguage === 'de'
                        ? '❌ Keine gültige Kombination zwischen FEATURE- und CHART/CHOROPLETH-Themes gefunden. Themes müssen mindestens eine Spalte mit übereinstimmenden Werten haben.'
                        : detectedLanguage === 'fr'
                        ? '❌ Aucune combinaison valide trouvée entre les thèmes FEATURE et CHART/CHOROPLETH. Les thèmes doivent avoir au moins une colonne avec des valeurs correspondantes.'
                        : detectedLanguage === 'es'
                        ? '❌ No se encontró ninguna combinación válida entre los temas FEATURE y CHART/CHOROPLETH. Los temas deben tener al menos una columna con valores coincidentes.'
                        : '❌ No valid combination found between FEATURE and CHART/CHOROPLETH themes. Themes must have at least one column with matchable values.';
                    
                    return {
                        items: [],
                        response: errorMsg,
                        count: 0,
                        query: { method: 'combine', sql: '' },
                        modelUsed: parsed.modelUsed || null
                    };
                }
                
                // Sort to find best combination: prioritize themes with itemfield, then those using itemfield, then by match count
                combinationResults.sort((a, b) => {
                    // First: prioritize combinations where feature theme HAS an itemfield
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
                
                const bestCombination = combinationResults[0];
                console.log(`\n🏆 [Theme Combination] BEST COMBINATION SELECTED:`);
                console.log(`   - Feature theme: ${bestCombination.featureThemeId}`);
                console.log(`   - Chart theme: ${bestCombination.chartThemeId}`);
                console.log(`   - Has itemfield: ${bestCombination.hasItemfield ? `Yes ("${bestCombination.itemfield}")` : 'No'}`);
                console.log(`   - Uses itemfield: ${bestCombination.usesItemField ? 'Yes' : 'No'}`);
                console.log(`   - Match: ${bestCombination.bestMatch.field1} ↔ ${bestCombination.bestMatch.field2} (${bestCombination.matchCount} matches)`);
                
                theme1Candidate = bestCombination.featureThemeId;
                theme2Candidate = bestCombination.chartThemeId;
                
                console.log('✅ [Theme Combination] Auto-detected best themes:', theme1Candidate, '(FEATURE) and', theme2Candidate, '(CHART/CHOROPLETH)');
            }
            
            // Get all available themes to match names/IDs
            let allThemes = [];
            try {
                if (map.Themes && map.Themes.getThemes) {
                    allThemes = map.Themes.getThemes();
                } else if (map.Api && map.Api.getAllThemes) {
                    allThemes = map.Api.getAllThemes();
                }
            } catch (e) {
                console.warn('Could not get themes:', e);
            }
            
            // Find matching themes by ID or name
            const findTheme = (candidate) => {
                const candidateLower = candidate.toLowerCase();
                return allThemes.find(theme => {
                    const themeId = theme.szId || theme.id || theme.name || '';
                    const themeTitle = theme.szTitle || theme.title || '';
                    const themeName = theme.szName || theme.name || '';
                    
                    return themeId.toLowerCase() === candidateLower ||
                           themeId.toLowerCase().includes(candidateLower) ||
                           candidateLower.includes(themeId.toLowerCase()) ||
                           themeTitle.toLowerCase().includes(candidateLower) ||
                           themeName.toLowerCase().includes(candidateLower);
                });
            };
            
            const theme1Obj = findTheme(theme1Candidate);
            const theme2Obj = findTheme(theme2Candidate);
            
            if (!theme1Obj) {
                const errorMsg = detectedLanguage === 'it'
                    ? `❌ Tema "${theme1Candidate}" non trovato. Verifica che il tema esista sulla mappa.`
                    : detectedLanguage === 'de'
                    ? `❌ Theme "${theme1Candidate}" nicht gefunden. Stellen Sie sicher, dass das Theme auf der Karte vorhanden ist.`
                    : detectedLanguage === 'fr'
                    ? `❌ Thème "${theme1Candidate}" introuvable. Assurez-vous que le thème existe sur la carte.`
                    : detectedLanguage === 'es'
                    ? `❌ Tema "${theme1Candidate}" no encontrado. Asegúrese de que el tema existe en el mapa.`
                    : `❌ Theme "${theme1Candidate}" not found. Please ensure the theme exists on the map.`;
                
                return {
                    items: [],
                    response: errorMsg,
                    count: 0,
                    query: { method: 'combine', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            if (!theme2Obj) {
                const errorMsg = detectedLanguage === 'it'
                    ? `❌ Tema "${theme2Candidate}" non trovato. Verifica che il tema esista sulla mappa.`
                    : detectedLanguage === 'de'
                    ? `❌ Theme "${theme2Candidate}" nicht gefunden. Stellen Sie sicher, dass das Theme auf der Karte vorhanden ist.`
                    : detectedLanguage === 'fr'
                    ? `❌ Thème "${theme2Candidate}" introuvable. Assurez-vous que le thème existe sur la carte.`
                    : detectedLanguage === 'es'
                    ? `❌ Tema "${theme2Candidate}" no encontrado. Asegúrese de que el tema existe en el mapa.`
                    : `❌ Theme "${theme2Candidate}" not found. Please ensure the theme exists on the map.`;
                
                return {
                    items: [],
                    response: errorMsg,
                    count: 0,
                    query: { method: 'combine', sql: '' },
                    modelUsed: parsed.modelUsed || null
                };
            }
            
            const theme1Id = theme1Obj.szId || theme1Obj.id || theme1Obj.name;
            const theme2Id = theme2Obj.szId || theme2Obj.id || theme2Obj.name;
            
            console.log('✅ [Theme Combination] Found themes:', theme1Id, 'and', theme2Id);
            
            // Validate combination
            const validation = await this.validateThemeCombination(theme1Id, theme2Id, detectedLanguage);
            
            // Build response message
            let responseMsg = '';
            
            if (validation.valid) {
                // Perform the actual combination
                try {
                    const mapApi = map.Api;
                    const theme1Title = theme1Obj.szTitle || theme1Obj.title || theme1Id;
                    const theme2Title = theme2Obj.szTitle || theme2Obj.title || theme2Id;
                    
                    // Get the best matching field (first one, sorted by match count)
                    const bestMatch = validation.matchingFields.length > 0 ? validation.matchingFields[0] : null;
                    
                    if (!bestMatch) {
                        throw new Error('No matching field found for combination');
                    }
                    
                    const matchingField1 = bestMatch.field1; // Field from theme1 (FEATURE)
                    const matchingField2 = bestMatch.field2; // Field from theme2 (CHART/CHOROPLETH)
                    
                    console.log('🔧 [Theme Combination] Starting combination process...');
                    console.log('🔧 [Theme Combination] Theme1 field:', matchingField1, 'Theme2 field:', matchingField2);
                    
                    // Step 1: Set layer of theme2 to match theme1
                    const layer1Name = validation.layerName || this.getThemeLayerName(theme1Id);
                    if (layer1Name) {
                        try {
                            // Get the actual theme object to find its szId (CRITICAL for replaceTheme)
                            const theme2ObjForUpdate = mapApi.getTheme(theme2Id);
                            let actualTheme2Id = theme2Id;
                            
                            if (theme2ObjForUpdate) {
                                if (theme2ObjForUpdate.szId) {
                                    actualTheme2Id = theme2ObjForUpdate.szId;
                                } else if (theme2ObjForUpdate.theme && theme2ObjForUpdate.theme.szId) {
                                    actualTheme2Id = theme2ObjForUpdate.theme.szId;
                                }
                            }
                            
                            console.log(`🔧 [Theme Combination] Step 1: Updating theme2 layer from "${this.getThemeLayerName(theme2Id)}" to "${layer1Name}" (szId: ${actualTheme2Id})`);
                            
                            // Get current theme definition to update it
                            let theme2Def = mapApi.getMapThemeDefinitionObj(actualTheme2Id);
                            
                            // If theme definition doesn't exist or is incomplete, try to get it from theme object
                            if (!theme2Def) {
                                if (theme2ObjForUpdate && theme2ObjForUpdate.objTheme && theme2ObjForUpdate.objTheme.objTheme) {
                                    const objTheme2 = theme2ObjForUpdate.objTheme.objTheme;
                                    theme2Def = {
                                        layer: layer1Name,
                                        style: objTheme2.style ? Object.assign({}, objTheme2.style) : {},
                                        binding: objTheme2.binding ? Object.assign({}, objTheme2.binding) : {}
                                    };
                                } else {
                                    theme2Def = {
                                        layer: layer1Name,
                                        style: {},
                                        binding: {}
                                    };
                                }
                            } else {
                                // Update layer in existing theme definition
                                theme2Def.layer = layer1Name;
                            }
                            
                            // CRITICAL: Ensure style.id and style.name match the actual theme's szId
                            // This is required for replaceTheme to find and replace the correct theme
                            if (!theme2Def.style) {
                                theme2Def.style = {};
                            }
                            theme2Def.style.id = actualTheme2Id;
                            theme2Def.style.name = actualTheme2Id;
                            
                            console.log(`✅ [Theme Combination] Updated theme2Def.layer to "${layer1Name}" (szId: ${actualTheme2Id})`);
                            
                            // Also update runtime objects
                            if (theme2ObjForUpdate) {
                                if (theme2ObjForUpdate.theme) {
                                    theme2ObjForUpdate.theme.szLayer = layer1Name;
                                    console.log(`✅ [Theme Combination] Updated theme2Obj.theme.szLayer to "${layer1Name}"`);
                                }
                                if (theme2ObjForUpdate.szLayer !== undefined) {
                                    theme2ObjForUpdate.szLayer = layer1Name;
                                    console.log(`✅ [Theme Combination] Updated theme2Obj.szLayer to "${layer1Name}"`);
                                }
                            }
                            
                            // Update mapTheme directly
                            const mapTheme = map.Themes ? map.Themes.getTheme(actualTheme2Id) : null;
                            if (mapTheme) {
                                mapTheme.szLayer = layer1Name;
                                console.log(`✅ [Theme Combination] Updated mapTheme.szLayer to "${layer1Name}"`);
                            }
                            
                            // Use replaceTheme to persist the change (like handleColorByField does)
                            try {
                                if (map.replaceTheme) {
                                    map.replaceTheme(actualTheme2Id, theme2Def);
                                    console.log(`✅ [Theme Combination] Used map.replaceTheme to persist layer change`);
                                } else if (mapApi.replaceTheme) {
                                    mapApi.replaceTheme(actualTheme2Id, theme2Def);
                                    console.log(`✅ [Theme Combination] Used mapApi.replaceTheme to persist layer change`);
                                } else if (window.ixmaps && window.ixmaps.replaceTheme) {
                                    window.ixmaps.replaceTheme(actualTheme2Id, theme2Def);
                                    console.log(`✅ [Theme Combination] Used ixmaps.replaceTheme to persist layer change`);
                                } else {
                                    console.warn('⚠️ [Theme Combination] replaceTheme not available, change may not persist');
                                }
                            } catch (e) {
                                console.warn('⚠️ [Theme Combination] Could not use replaceTheme for layer update:', e);
                            }
                        } catch (e) {
                            console.warn('Could not update theme2 layer:', e);
                        }
                    }
                    
                    // Step 2: Set itemfield (binding.id) of theme1 to matching field from theme1
                    try {
                        // Get the actual theme object to find its szId (CRITICAL for replaceTheme)
                        const theme1ObjForUpdate = mapApi.getTheme(theme1Id);
                        let actualTheme1Id = theme1Id;
                        
                        if (theme1ObjForUpdate) {
                            if (theme1ObjForUpdate.szId) {
                                actualTheme1Id = theme1ObjForUpdate.szId;
                            } else if (theme1ObjForUpdate.theme && theme1ObjForUpdate.theme.szId) {
                                actualTheme1Id = theme1ObjForUpdate.theme.szId;
                            }
                        }
                        
                        console.log(`🔧 [Theme Combination] Step 2: Setting theme1 itemfield to "${matchingField1}" (szId: ${actualTheme1Id})`);
                        
                        // Get current theme definition using actual szId
                        let theme1Def = mapApi.getMapThemeDefinitionObj(actualTheme1Id);
                        
                        // Get the actual mapTheme object using actual szId
                        const mapTheme1 = map.Themes ? map.Themes.getTheme(actualTheme1Id) : null;
                        
                        // Ensure theme definition exists and has required structure
                        if (!theme1Def) {
                            // Create theme definition from current theme
                            theme1Def = {
                                layer: this.getThemeLayerName(theme1Id),
                                style: {},
                                binding: {}
                            };
                            if (theme1ObjForUpdate && theme1ObjForUpdate.objTheme && theme1ObjForUpdate.objTheme.objTheme) {
                                const objTheme1 = theme1ObjForUpdate.objTheme.objTheme;
                                if (objTheme1.style) {
                                    theme1Def.style = Object.assign({}, objTheme1.style);
                                }
                                if (objTheme1.binding) {
                                    theme1Def.binding = Object.assign({}, objTheme1.binding);
                                }
                            }
                        }
                        
                        // Set itemfield in style and binding
                        if (!theme1Def.style) {
                            theme1Def.style = {};
                        }
                        theme1Def.style.itemfield = matchingField1;
                        
                        // Also set binding.id
                        if (!theme1Def.binding) {
                            theme1Def.binding = {};
                        }
                        theme1Def.binding.id = matchingField1;
                        console.log(`✅ [Theme Combination] Updated theme1Def: itemfield="${matchingField1}", binding.id="${matchingField1}"`);
                        
                        // CRITICAL: Ensure style.id and style.name match the actual theme's szId
                        // This is required for replaceTheme to find and replace the correct theme
                        theme1Def.style.id = actualTheme1Id;
                        theme1Def.style.name = actualTheme1Id;
                        
                        // Update mapTheme directly (this is the actual runtime object)
                        if (mapTheme1) {
                            mapTheme1.szItemField = matchingField1;
                            console.log(`✅ [Theme Combination] Updated mapTheme1.szItemField to "${matchingField1}"`);
                            
                            // CRITICAL: Set reload/realize flags so theme1 refreshes with new itemfield
                            // This is necessary because theme2 depends on theme1's itemfield for lookup
                            mapTheme1.fReload = true;
                            mapTheme1.fRealize = true;
                            console.log(`✅ [Theme Combination] Set fReload and fRealize flags on mapTheme1 (needed for theme2 dependency)`);
                            
                            // Also update in objTheme if accessible (this is the data binding structure)
                            if (theme1ObjForUpdate && theme1ObjForUpdate.objTheme) {
                                // Update objTheme.objTheme.theme structure
                                if (theme1ObjForUpdate.objTheme.objTheme && theme1ObjForUpdate.objTheme.objTheme.theme) {
                                    theme1ObjForUpdate.objTheme.objTheme.theme.szItemField = matchingField1;
                                    console.log(`✅ [Theme Combination] Updated objTheme1.theme.szItemField to "${matchingField1}"`);
                                }
                                // Also check direct objTheme.theme
                                if (theme1ObjForUpdate.objTheme.theme) {
                                    theme1ObjForUpdate.objTheme.theme.szItemField = matchingField1;
                                }
                            }
                        }
                        
                        // Use replaceTheme to persist the changes (like handleColorByField does)
                        try {
                            if (map.replaceTheme) {
                                map.replaceTheme(actualTheme1Id, theme1Def);
                                console.log(`✅ [Theme Combination] Used map.replaceTheme to persist theme1 itemfield changes`);
                            } else if (mapApi.replaceTheme) {
                                mapApi.replaceTheme(actualTheme1Id, theme1Def);
                                console.log(`✅ [Theme Combination] Used mapApi.replaceTheme to persist theme1 itemfield changes`);
                            } else if (window.ixmaps && window.ixmaps.replaceTheme) {
                                window.ixmaps.replaceTheme(actualTheme1Id, theme1Def);
                                console.log(`✅ [Theme Combination] Used ixmaps.replaceTheme to persist theme1 itemfield changes`);
                            }
                        } catch (e) {
                            console.warn('Could not use replaceTheme for theme1, will use changeThemeStyle:', e);
                        }
                        
                        // Also use changeThemeStyle to apply (this should trigger the themeStyleTranslateA mechanism)
                        mapApi.changeThemeStyle(actualTheme1Id, `itemfield:${matchingField1}`, "set");
                        console.log(`✅ [Theme Combination] Called changeThemeStyle for theme1 itemfield`);
                    } catch (e) {
                        console.warn('Could not set theme1 itemfield:', e);
                        throw new Error(`Failed to set itemfield on theme1: ${e.message}`);
                    }
                    
                    // Step 3: Set lookupfield (binding.geo) of theme2 to matching field from theme2
                    try {
                        // Get the actual theme object to find its szId (CRITICAL for replaceTheme)
                        const theme2ObjForUpdate = mapApi.getTheme(theme2Id);
                        let actualTheme2Id = theme2Id;
                        
                        if (theme2ObjForUpdate) {
                            if (theme2ObjForUpdate.szId) {
                                actualTheme2Id = theme2ObjForUpdate.szId;
                            } else if (theme2ObjForUpdate.theme && theme2ObjForUpdate.theme.szId) {
                                actualTheme2Id = theme2ObjForUpdate.theme.szId;
                            }
                        }
                        
                        console.log(`🔧 [Theme Combination] Step 3: Setting theme2 lookupfield to "${matchingField2}" (szId: ${actualTheme2Id})`);
                        
                        // Get current theme definition using actual szId
                        let theme2Def = mapApi.getMapThemeDefinitionObj(actualTheme2Id);
                        
                        // Get the actual mapTheme object using actual szId
                        const mapTheme2 = map.Themes ? map.Themes.getTheme(actualTheme2Id) : null;
                        
                        // Ensure theme definition exists and has required structure
                        if (!theme2Def) {
                            // Create theme definition from current theme
                            theme2Def = {
                                layer: layer1Name, // Use the updated layer name
                                style: {},
                                binding: {}
                            };
                            if (theme2ObjForUpdate && theme2ObjForUpdate.objTheme && theme2ObjForUpdate.objTheme.objTheme) {
                                const objTheme2 = theme2ObjForUpdate.objTheme.objTheme;
                                if (objTheme2.style) {
                                    theme2Def.style = Object.assign({}, objTheme2.style);
                                }
                                if (objTheme2.binding) {
                                    theme2Def.binding = Object.assign({}, objTheme2.binding);
                                }
                            }
                        }
                        
                        // Update layer in theme definition (from Step 1)
                        theme2Def.layer = layer1Name;
                        
                        // Set lookupfield in style and binding
                        if (!theme2Def.style) {
                            theme2Def.style = {};
                        }
                        
                        // Preserve existing theme type - DO NOT CHANGE IT
                        if (theme2Def.style.type) {
                            const currentType = theme2Def.style.type;
                            // Keep the existing type as-is, do not modify it
                            console.log(`✅ [Theme Combination] Preserving theme2 type: "${currentType}" (no changes)`);
                        }
                        
                        theme2Def.style.lookupfield = matchingField2;
                        
                        // Also set binding.geo
                        if (!theme2Def.binding) {
                            theme2Def.binding = {};
                        }
                        theme2Def.binding.geo = matchingField2;
                        
                        // CRITICAL: Ensure style.id and style.name match the actual theme's szId
                        // This is required for replaceTheme to find and replace the correct theme
                        theme2Def.style.id = actualTheme2Id;
                        theme2Def.style.name = actualTheme2Id;
                        
                        console.log(`✅ [Theme Combination] Updated theme2Def: layer="${layer1Name}", lookupfield="${matchingField2}", binding.geo="${matchingField2}" (szId: ${actualTheme2Id})`);
                        
                        // Update mapTheme directly (this is the actual runtime object)
                        if (mapTheme2) {
                            // Update layer
                            mapTheme2.szLayer = layer1Name;
                            
                            // lookupfield maps to szSelectionField (from themeStyleTranslateA line 144-145)
                            mapTheme2.szSelectionField = matchingField2;
                            console.log(`✅ [Theme Combination] Updated mapTheme2: szLayer="${layer1Name}", szSelectionField="${matchingField2}"`);
                            
                            // Also update in objTheme if accessible (this is the data binding structure)
                            if (theme2ObjForUpdate && theme2ObjForUpdate.objTheme) {
                                // Update objTheme.objTheme.theme structure
                                if (theme2ObjForUpdate.objTheme.objTheme && theme2ObjForUpdate.objTheme.objTheme.theme) {
                                    theme2ObjForUpdate.objTheme.objTheme.theme.szLayer = layer1Name;
                                    theme2ObjForUpdate.objTheme.objTheme.theme.szSelectionField = matchingField2;
                                    console.log(`✅ [Theme Combination] Updated objTheme2.theme: szLayer="${layer1Name}", szSelectionField="${matchingField2}"`);
                                }
                                // Also check direct objTheme.theme
                                if (theme2ObjForUpdate.objTheme.theme) {
                                    theme2ObjForUpdate.objTheme.theme.szLayer = layer1Name;
                                    theme2ObjForUpdate.objTheme.theme.szSelectionField = matchingField2;
                                }
                            }
                            
                            // Trigger reload if lookupfield changes (affects data binding)
                            // This is critical - changing lookupfield requires reloading the data
                            mapTheme2.fReload = true;
                            mapTheme2.fRealize = true;
                            console.log(`✅ [Theme Combination] Set fReload and fRealize flags on mapTheme2`);
                        }
                        
                        // Use replaceTheme to persist the changes (like handleColorByField does)
                        try {
                            if (map.replaceTheme) {
                                map.replaceTheme(actualTheme2Id, theme2Def);
                                console.log(`✅ [Theme Combination] Used map.replaceTheme to persist theme2 lookupfield changes`);
                            } else if (mapApi.replaceTheme) {
                                mapApi.replaceTheme(actualTheme2Id, theme2Def);
                                console.log(`✅ [Theme Combination] Used mapApi.replaceTheme to persist theme2 lookupfield changes`);
                            } else if (window.ixmaps && window.ixmaps.replaceTheme) {
                                window.ixmaps.replaceTheme(actualTheme2Id, theme2Def);
                                console.log(`✅ [Theme Combination] Used ixmaps.replaceTheme to persist theme2 lookupfield changes`);
                            } else {
                                console.warn('⚠️ [Theme Combination] replaceTheme not available, will use changeThemeStyle');
                            }
                        } catch (e) {
                            console.warn('⚠️ [Theme Combination] Could not use replaceTheme for theme2, will use changeThemeStyle:', e);
                        }
                        
                        // Also use changeThemeStyle to apply
                        // Note: lookupfield might not be handled in doChangeThemeStyle for runtime changes,
                        // but we've set it directly on mapTheme2.szSelectionField and used replaceTheme above
                        mapApi.changeThemeStyle(actualTheme2Id, `lookupfield:${matchingField2}`, "set");
                        console.log(`✅ [Theme Combination] Called changeThemeStyle for theme2 lookupfield`);
                    } catch (e) {
                        console.warn('Could not set theme2 lookupfield:', e);
                        throw new Error(`Failed to set lookupfield on theme2: ${e.message}`);
                    }
                    
                    // Step 4: Trigger theme execution to apply all changes
                    // This is important to ensure changes are persisted and applied
                    // Note: changeThemeStyle already calls map.Themes.execute() at the end,
                    // but we call it again to ensure fReload flags are processed
                    try {
                        if (map.Themes && map.Themes.execute) {
                            // Small delay to ensure all property updates are complete before execution
                            setTimeout(() => {
                                try {
                                    map.Themes.execute();
                                    console.log(`✅ [Theme Combination] Triggered map.Themes.execute() to apply changes`);
                                } catch (e) {
                                    console.warn('Could not execute themes:', e);
                                }
                            }, 200);
                        }
                    } catch (e) {
                        console.warn('Could not trigger theme execution:', e);
                    }
                    
                    // Step 5: Verify changes were applied
                    try {
                        setTimeout(() => {
                            const verifyTheme1 = mapApi.getTheme(theme1Id);
                            const verifyTheme2 = mapApi.getTheme(theme2Id);
                            const verifyMapTheme1 = map.Themes ? map.Themes.getTheme(theme1Id) : null;
                            const verifyMapTheme2 = map.Themes ? map.Themes.getTheme(theme2Id) : null;
                            
                            console.log('🔍 [Theme Combination] Verification:');
                            if (verifyMapTheme1) {
                                console.log(`  Theme1 szItemField: ${verifyMapTheme1.szItemField} (expected: ${matchingField1})`);
                            }
                            if (verifyMapTheme2) {
                                console.log(`  Theme2 szSelectionField: ${verifyMapTheme2.szSelectionField} (expected: ${matchingField2})`);
                                console.log(`  Theme2 szLayer: ${verifyMapTheme2.szLayer} (expected: ${layer1Name})`);
                            }
                            if (verifyTheme1 && verifyTheme1.objTheme && verifyTheme1.objTheme.objTheme) {
                                const def1 = mapApi.getMapThemeDefinitionObj(theme1Id);
                                console.log(`  Theme1 def itemfield: ${def1?.style?.itemfield} (expected: ${matchingField1})`);
                                console.log(`  Theme1 def binding.id: ${def1?.binding?.id} (expected: ${matchingField1})`);
                            }
                            if (verifyTheme2 && verifyTheme2.objTheme && verifyTheme2.objTheme.objTheme) {
                                const def2 = mapApi.getMapThemeDefinitionObj(theme2Id);
                                console.log(`  Theme2 def lookupfield: ${def2?.style?.lookupfield} (expected: ${matchingField2})`);
                                console.log(`  Theme2 def binding.geo: ${def2?.binding?.geo} (expected: ${matchingField2})`);
                                console.log(`  Theme2 def layer: ${def2?.layer} (expected: ${layer1Name})`);
                            }
                        }, 500);
                    } catch (e) {
                        console.warn('Could not verify changes:', e);
                    }
                    
                    // Success message
                    responseMsg = detectedLanguage === 'it'
                        ? `✅ **Temi combinati con successo!**\n\nI temi sono stati combinati:\n- **Tema 1:** ${theme1Title} (${validation.theme1Type})\n- **Tema 2:** ${theme2Title} (${validation.theme2Type})\n- **Layer:** ${validation.layerName}\n- **Campo corrispondente:** ${matchingField1} ↔ ${matchingField2}\n\n**Modifiche applicate:**\n- Layer del tema 2 impostato a "${validation.layerName}"\n- Itemfield (binding.id) del tema 1 impostato a "${matchingField1}"\n- Lookupfield (binding.geo) del tema 2 impostato a "${matchingField2}"\n\n${validation.warnings.length > 0 ? '\n⚠️ ' + validation.warnings.join('\n') : ''}`
                        : detectedLanguage === 'de'
                        ? `✅ **Themes erfolgreich kombiniert!**\n\nDie Themes wurden kombiniert:\n- **Theme 1:** ${theme1Title} (${validation.theme1Type})\n- **Theme 2:** ${theme2Title} (${validation.theme2Type})\n- **Layer:** ${validation.layerName}\n- **Übereinstimmendes Feld:** ${matchingField1} ↔ ${matchingField2}\n\n**Angewendete Änderungen:**\n- Layer von Theme 2 auf "${validation.layerName}" gesetzt\n- Itemfield (binding.id) von Theme 1 auf "${matchingField1}" gesetzt\n- Lookupfield (binding.geo) von Theme 2 auf "${matchingField2}" gesetzt\n\n${validation.warnings.length > 0 ? '\n⚠️ ' + validation.warnings.join('\n') : ''}`
                        : detectedLanguage === 'fr'
                        ? `✅ **Thèmes combinés avec succès!**\n\nLes thèmes ont été combinés:\n- **Thème 1:** ${theme1Title} (${validation.theme1Type})\n- **Thème 2:** ${theme2Title} (${validation.theme2Type})\n- **Couche:** ${validation.layerName}\n- **Champ correspondant:** ${matchingField1} ↔ ${matchingField2}\n\n**Modifications appliquées:**\n- Couche du thème 2 définie à "${validation.layerName}"\n- Itemfield (binding.id) du thème 1 défini à "${matchingField1}"\n- Lookupfield (binding.geo) du thème 2 défini à "${matchingField2}"\n\n${validation.warnings.length > 0 ? '\n⚠️ ' + validation.warnings.join('\n') : ''}`
                        : detectedLanguage === 'es'
                        ? `✅ **¡Temas combinados con éxito!**\n\nLos temas se han combinado:\n- **Tema 1:** ${theme1Title} (${validation.theme1Type})\n- **Tema 2:** ${theme2Title} (${validation.theme2Type})\n- **Capa:** ${validation.layerName}\n- **Campo coincidente:** ${matchingField1} ↔ ${matchingField2}\n\n**Cambios aplicados:**\n- Capa del tema 2 establecida en "${validation.layerName}"\n- Itemfield (binding.id) del tema 1 establecido en "${matchingField1}"\n- Lookupfield (binding.geo) del tema 2 establecido en "${matchingField2}"\n\n${validation.warnings.length > 0 ? '\n⚠️ ' + validation.warnings.join('\n') : ''}`
                        : `✅ **Themes combined successfully!**\n\nThemes have been combined:\n- **Theme 1:** ${theme1Title} (${validation.theme1Type})\n- **Theme 2:** ${theme2Title} (${validation.theme2Type})\n- **Layer:** ${validation.layerName}\n- **Matching field:** ${matchingField1} ↔ ${matchingField2}\n\n**Changes applied:**\n- Theme 2 layer set to "${validation.layerName}"\n- Theme 1 itemfield (binding.id) set to "${matchingField1}"\n- Theme 2 lookupfield (binding.geo) set to "${matchingField2}"\n\n${validation.warnings.length > 0 ? '\n⚠️ ' + validation.warnings.join('\n') : ''}`;
                    
                } catch (e) {
                    console.error('❌ Error combining themes:', e);
                    responseMsg = detectedLanguage === 'it'
                        ? `❌ **Errore durante la combinazione dei temi.**\n\n${e.message}\n\nLa validazione è passata, ma si è verificato un errore durante l'applicazione delle modifiche.`
                        : detectedLanguage === 'de'
                        ? `❌ **Fehler beim Kombinieren der Themes.**\n\n${e.message}\n\nDie Validierung war erfolgreich, aber beim Anwenden der Änderungen ist ein Fehler aufgetreten.`
                        : detectedLanguage === 'fr'
                        ? `❌ **Erreur lors de la combinaison des thèmes.**\n\n${e.message}\n\nLa validation a réussi, mais une erreur s'est produite lors de l'application des modifications.`
                        : detectedLanguage === 'es'
                        ? `❌ **Error al combinar los temas.**\n\n${e.message}\n\nLa validación pasó, pero ocurrió un error al aplicar los cambios.`
                        : `❌ **Error combining themes.**\n\n${e.message}\n\nValidation passed, but an error occurred while applying the changes.`;
                }
            } else {
                responseMsg = detectedLanguage === 'it'
                    ? `❌ **Impossibile combinare i temi.**\n\n${validation.errors.join('\n')}\n\nVerifica che:\n- Il primo tema sia di tipo FEATURE\n- Il secondo tema sia di tipo CHART o CHOROPLETH\n- Entrambi i temi abbiano lo stesso nome di layer\n- Entrambi i temi abbiano almeno una colonna corrispondente nei dati`
                    : detectedLanguage === 'de'
                    ? `❌ **Themes können nicht kombiniert werden.**\n\n${validation.errors.join('\n')}\n\nStellen Sie sicher, dass:\n- Das erste Theme vom Typ FEATURE ist\n- Das zweite Theme vom Typ CHART oder CHOROPLETH ist\n- Beide Themes denselben Layer-Namen haben\n- Beide Themes mindestens eine übereinstimmende Spalte in den Daten haben`
                    : detectedLanguage === 'fr'
                    ? `❌ **Impossible de combiner les thèmes.**\n\n${validation.errors.join('\n')}\n\nAssurez-vous que:\n- Le premier thème est de type FEATURE\n- Le deuxième thème est de type CHART ou CHOROPLETH\n- Les deux thèmes ont le même nom de couche\n- Les deux thèmes ont au moins une colonne correspondante dans les données`
                    : detectedLanguage === 'es'
                    ? `❌ **No se pueden combinar los temas.**\n\n${validation.errors.join('\n')}\n\nAsegúrese de que:\n- El primer tema sea de tipo FEATURE\n- El segundo tema sea de tipo CHART o CHOROPLETH\n- Ambos temas tengan el mismo nombre de capa\n- Ambos temas tengan al menos una columna coincidente en los datos`
                    : `❌ **Cannot combine themes.**\n\n${validation.errors.join('\n')}\n\nPlease ensure:\n- First theme is FEATURE type\n- Second theme is CHART or CHOROPLETH type\n- Both themes have the same layer name\n- Both themes have at least one matching column in their data`;
            }
            
            return {
                items: [],
                response: responseMsg,
                count: 0,
                query: { method: 'combine', sql: '', theme1: theme1Id, theme2: theme2Id, validation: validation },
                modelUsed: parsed.modelUsed || null
            };
        },
        
        /**
         * Use AI (Gemini or Mistral) to match a field name from user input to actual field names in schemas
         * @param {String} fieldNameCandidate - Field name from user query (e.g., "Country", "country")
         * @param {Array} schemas - Available schemas with fields
         * @returns {Promise<Object|null>} Object with fieldName and schema, or null if not found
         */
        matchFieldNameWithAI: async function(fieldNameCandidate, schemas) {
            // Collect all available field names from all schemas
            const allFields = [];
            schemas.forEach(schema => {
                if (schema.fields) {
                    schema.fields.forEach(field => {
                        const fName = typeof field === 'string' ? field : (field.name || field.field || field.id || '');
                        if (fName && !allFields.find(f => f.name === fName)) {
                            allFields.push({
                                name: fName,
                                schema: schema
                            });
                        }
                    });
                }
            });
            
            if (allFields.length === 0) {
                return null;
            }
            
            // Try Gemini first
            if (this.config.geminiApiKey) {
                try {
                    const apiKey = this.config.geminiApiKey;
                    const model = this.config.geminiModel || 'gemini-2.0-flash-exp';
                    
                    const prompt = `You are a field name matcher. The user wants to find a data field that matches "${fieldNameCandidate}".

Available field names:
${allFields.map(f => `- ${f.name}`).join('\n')}

Find the best matching field name for "${fieldNameCandidate}". Consider:
- Exact matches (case-insensitive)
- Partial matches (e.g., "Country" matches "Country_Name", "country_code")
- Common variations (e.g., "Country" matches "Nation", "State" if context suggests it)

Return ONLY a JSON object with this exact structure:
{
  "fieldName": "exact_field_name_from_list",
  "confidence": "high" | "medium" | "low"
}

If no good match is found, return:
{
  "fieldName": null,
  "confidence": "none"
}`;

                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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
                        let errorMessage = `Gemini API error: ${response.status}`;
                        let userFriendlyMessage = '';
                        
                        if (response.status === 429) {
                            const retryAfter = response.headers.get('Retry-After');
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
                            errorMessage = userFriendlyMessage;
                        }
                        
                        const error = new Error(errorMessage);
                        error.status = response.status;
                        throw error;
                    }
                    
                    const data = await response.json();
                    
                    // Extract text from Gemini response
                    let generatedText = null;
                    if (data.candidates && data.candidates[0]) {
                        const candidate = data.candidates[0];
                        if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
                            generatedText = candidate.content.parts[0].text;
                        } else if (candidate.parts && candidate.parts[0]) {
                            generatedText = candidate.parts[0].text;
                        } else if (candidate.text) {
                            generatedText = candidate.text;
                        }
                    }
                    
                    if (generatedText) {
                        // Extract JSON from response (may be wrapped in markdown)
                        let jsonText = String(generatedText).trim();
                        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                        
                        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            try {
                                const result = JSON.parse(jsonMatch[0]);
                                if (result.fieldName && result.confidence !== 'none') {
                                    const matchedField = allFields.find(f => f.name === result.fieldName);
                                    if (matchedField) {
                                        return {
                                            fieldName: matchedField.name,
                                            schema: matchedField.schema
                                        };
                                    }
                                }
                            } catch (parseError) {
                                console.warn('⚠️ Failed to parse Gemini field matching response:', parseError);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Gemini field matching failed:', e);
                }
            }
            
            // Fallback: try simple fuzzy matching
            const candidateLower = fieldNameCandidate.toLowerCase();
            for (const field of allFields) {
                const fNameLower = field.name.toLowerCase();
                if (fNameLower === candidateLower || 
                    fNameLower.includes(candidateLower) ||
                    candidateLower.includes(fNameLower)) {
                    return {
                        fieldName: field.name,
                        schema: field.schema
                    };
                }
            }
            
            return null;
        },
        
        /**
         * Get available data schemas
         * @param {String} themeFilter - Optional theme filter
         * @returns {Array} Array of schema objects
         */
        getAvailableSchemas: function(themeFilter) {
            const map = this.getMap();
            
            if (!map || !map.Query) {
                return [];
            }
            
            let themes = [];
            let themeObjects = [];
            try {
                // MUST USE getThemes() to get all themes
                if (themeFilter) {
                    // If filtering, still use getThemes() and filter
                    if (map.Themes && map.Themes.getThemes) {
                        themeObjects = map.Themes.getThemes();
                        themeObjects = themeObjects.filter(t => (t.szId || t.szName || t.id || t.name) === themeFilter);
                    } else if (map.Api && map.Api.getAllThemes) {
                        themeObjects = map.Api.getAllThemes();
                        themeObjects = themeObjects.filter(t => (t.szId || t.szName || t.id || t.name) === themeFilter);
                    }
                } else {
                    // Method 1: Use map.Themes.getThemes() - returns theme objects
                    if (map.Themes && map.Themes.getThemes) {
                        themeObjects = map.Themes.getThemes();
                    }
                    
                    // Method 2: Try map.Api.getAllThemes() if available
                    if ((!themeObjects || themeObjects.length === 0) && map.Api && map.Api.getAllThemes) {
                        themeObjects = map.Api.getAllThemes();
                    }
                }
                
                // Extract theme IDs from theme objects
                if (themeObjects && themeObjects.length > 0) {
                    themes = themeObjects.map(theme => theme.szId || theme.szName || theme.id || theme.name).filter(Boolean);
                }
            } catch (e) {
                console.warn('Could not get themes:', e);
                return [];
            }
            
            if (!themes || themes.length === 0) {
                console.warn('⚠️ No themes found. Map may still be loading or no layers have been added.');
                return [];
            }
            
            const schemas = [];
            
            // Process theme objects (if we have them) or theme IDs
            const themesToProcess = themeObjects && themeObjects.length > 0 ? themeObjects : themes.map(id => ({ szId: id }));
            
            themesToProcess.forEach(themeObj => {
                try {
                    const themeId = themeObj.szId || themeObj.szName || themeObj.id || themeObj.name;
                    
                    // NEW APPROACH: Get theme object using map.Api.getTheme() for data themes
                    let objTheme = null;
                    let fields = [];
                    let hasData = false;
                    
                    // Try new API first (for themes with data visualization)
                    if (map.Api && map.Api.getTheme) {
                        try {
                            objTheme = map.Api.getTheme(themeId);
                            if (objTheme && objTheme.objTheme) {
                                hasData = true;
                                // Get fields from theme data
                                if (objTheme.objTheme.dbFields) {
                                    const rawFields = objTheme.objTheme.dbFields;
                                    // Extract field names - dbFields can be array of objects with 'id' property or array of strings
                                    fields = rawFields.map(field => {
                                        if (typeof field === 'string') {
                                            return field;
                                        } else if (field && typeof field === 'object') {
                                            return field.id || field.name || field.field || String(field);
                                        }
                                        return String(field);
                                    }).filter(Boolean);
                                }
                            }
                        } catch (e) {
                            // Theme not available via Api.getTheme()
                        }
                    }
                    
                    // Fallback: Try old Query API for feature-only themes
                    if (!hasData && map.Query && map.Query.getFieldsOfTheme) {
                        try {
                            fields = map.Query.getFieldsOfTheme(themeId);
                        } catch (e) {
                            // Could not get fields via Query API
                        }
                    }
                    
                    // Additional fallback: Try to get fields from theme definition
                    if ((!fields || fields.length === 0) && map.Api && map.Api.getMapThemeDefinitionObj) {
                        try {
                            const themeDef = map.Api.getMapThemeDefinitionObj(themeId);
                            if (themeDef) {
                                // Try to extract fields from binding
                                if (themeDef.binding) {
                                    const bindingFields = [];
                                    if (themeDef.binding.value) bindingFields.push(themeDef.binding.value);
                                    if (themeDef.binding.size) bindingFields.push(themeDef.binding.size);
                                    if (themeDef.binding.title) bindingFields.push(themeDef.binding.title);
                                    if (themeDef.binding.text) bindingFields.push(themeDef.binding.text);
                                    if (themeDef.binding.geo) {
                                        // Geo binding can be "lat|lng" format
                                        const geoFields = themeDef.binding.geo.split('|');
                                        bindingFields.push(...geoFields);
                                    }
                                    if (bindingFields.length > 0) {
                                        fields = bindingFields;
                                    }
                                }
                                
                                // Also try to get from style properties
                                if ((!fields || fields.length === 0) && themeDef.style) {
                                    const styleFields = [];
                                    if (themeDef.style.valuefield) styleFields.push(themeDef.style.valuefield);
                                    if (themeDef.style.sizefield) styleFields.push(themeDef.style.sizefield);
                                    if (themeDef.style.titlefield) styleFields.push(themeDef.style.titlefield);
                                    if (themeDef.style.labelfield) styleFields.push(themeDef.style.labelfield);
                                    if (themeDef.style.colorfield) styleFields.push(themeDef.style.colorfield);
                                    if (styleFields.length > 0) {
                                        fields = styleFields;
                                    }
                                }
                            }
                        } catch (e) {
                            // Could not get fields from theme definition
                        }
                    }
                    
                    // Include theme even if no fields found (for label-only themes, etc.)
                    // But still try to get at least some basic info
                    if (!fields || fields.length === 0) {
                        // For themes without accessible fields, create empty fields array
                        // This allows the theme to still be listed
                        fields = [];
                    }
                    
                    // Get theme title from theme object if available
                    let themeTitle = themeId;
                    if (objTheme && objTheme.szTitle) {
                        themeTitle = objTheme.szTitle;
                    } else if (themeObj.szTitle) {
                        themeTitle = themeObj.szTitle;
                    } else if (objTheme && objTheme.theme && objTheme.theme.szTitle) {
                        themeTitle = objTheme.theme.szTitle;
                    } else if (map.Api && map.Api.getMapThemeDefinitionObj) {
                        try {
                            const themeDef = map.Api.getMapThemeDefinitionObj(themeId);
                            if (themeDef && themeDef.meta && themeDef.meta.title) {
                                themeTitle = themeDef.meta.title;
                            }
                        } catch (e) {
                            // Could not get title from definition
                        }
                    }
                    
                    schemas.push({
                        theme: themeId,
                        themeTitle: themeTitle, // Human-readable title
                        fields: fields,
                        hasData: hasData, // Flag to indicate if theme has data visualization
                        objTheme: objTheme, // Store theme object for data queries
                        sampleValues: hasData && fields.length > 0 ? this.getSampleValuesFromTheme(objTheme, fields) : (fields.length > 0 ? this.getSampleValues(themeId, fields) : {})
                    });
                } catch (e) {
                    console.warn(`Could not get schema for theme ${themeId}:`, e);
                }
            });
            return schemas;
        },
        
        /**
         * Get sample values from theme data object
         * @param {Object} objTheme - Theme object from map.Api.getTheme()
         * @param {Array} fields - Field names
         * @returns {Object} Sample values by field
         */
        getSampleValuesFromTheme: function(objTheme, fields) {
            const samples = {};
            if (!objTheme || !objTheme.objTheme || !objTheme.objTheme.dbRecords) {
                return samples;
            }
            
            const records = objTheme.objTheme.dbRecords;
            const rawFields = objTheme.objTheme.dbFields || [];
            
            // Create a map of field name to index
            const fieldIndexMap = {};
            rawFields.forEach((field, idx) => {
                const fieldName = typeof field === 'string' ? field : (field.id || field.name || field.field || String(field));
                fieldIndexMap[fieldName] = idx;
            });
            
            // Get first few non-null values for each field
            fields.forEach(field => {
                const fieldIdx = fieldIndexMap[field];
                if (fieldIdx !== undefined && fieldIdx >= 0) {
                    const values = [];
                    for (let i = 0; i < Math.min(10, records.length); i++) {
                        if (records[i] && records[i][fieldIdx] !== undefined && records[i][fieldIdx] !== null && records[i][fieldIdx] !== '') {
                            values.push(records[i][fieldIdx]);
                            if (values.length >= 5) break;
                        }
                    }
                    if (values.length > 0) {
                        samples[field] = values;
                    }
                }
            });
            
            return samples;
        },
        
        /**
         * Get the map object from embedded SVG
         * @returns {Object} Map object or null
         */
        getMap: function() {
            // Try multiple ways to access the map
            if (ixmaps.embeddedSVG && ixmaps.embeddedSVG.window && ixmaps.embeddedSVG.window.map) {
                return ixmaps.embeddedSVG.window.map;
            }
            
            // Try alternative access patterns
            const iframes = document.querySelectorAll('iframe');
            for (let iframe of iframes) {
                try {
                    if (iframe.contentWindow && iframe.contentWindow.map) {
                        return iframe.contentWindow.map;
                    }
                } catch (e) {
                    // Cross-origin or other access issues
                }
            }
            
            return null;
        },
        
        /**
         * Verify map API methods are available and working
         * @returns {Object} Verification report
         */
        verifyMapAPI: function() {
            const map = this.getMap();
            const report = {
                mapFound: !!map,
                mapQuery: !!map?.Query,
                methods: {},
                themes: null,
                error: null
            };
            
            if (!map) {
                report.error = 'Map object not found';
                return report;
            }
            
            if (!map.Query) {
                report.error = 'map.Query not available';
                return report;
            }
            
            // Test each method we use
            const methodsToTest = [
                'getThemes',
                'getFieldsOfTheme',
                'getValuesOfFieldAndTheme',
                'searchItem',
                'searchItemAdvanced',
                'getThemesWithInfo'
            ];
            
            methodsToTest.forEach(methodName => {
                try {
                    const exists = typeof map.Query[methodName] === 'function';
                    report.methods[methodName] = {
                        exists: exists,
                        type: typeof map.Query[methodName]
                    };
                    
                    // Try calling getThemes to see what it returns
                    if (methodName === 'getThemes' && exists) {
                        try {
                            const themes = map.Query.getThemes();
                            report.themes = {
                                result: themes,
                                length: themes ? themes.length : 0,
                                type: Array.isArray(themes) ? 'array' : typeof themes
                            };
                        } catch (e) {
                            report.themes = {
                                error: e.message,
                                stack: e.stack
                            };
                        }
                    }
                } catch (e) {
                    report.methods[methodName] = {
                        exists: false,
                        error: e.message
                    };
                }
            });
            
            // Check map structure
            report.mapStructure = {
                hasSVGDocument: !!map.SVGDocument,
                hasLayer: !!map.Layer,
                hasThemes: !!map.Themes,
                hasApi: !!map.Api,
                layerListA: map.Layer?.listA?.length || 0,
                themesListA: map.Themes?.listA?.length || 0
            };
            
            // Try to get themes from SVG document directly
            if (map.SVGDocument) {
                try {
                    // Check for szMapNs namespace
                    const szMapNs = map.SVGDocument.documentElement.getAttribute('xmlns:ixmaps') || 
                                   'http://www.medienobjekte.de/ixmaps';
                    
                    const themeNodes = map.SVGDocument.getElementsByTagNameNS(szMapNs, 'theme');
                    report.svgThemes = {
                        found: themeNodes ? themeNodes.length : 0,
                        names: []
                    };
                    
                    if (themeNodes && themeNodes.length > 0) {
                        for (let i = 0; i < themeNodes.length; i++) {
                            const name = themeNodes[i].getAttribute('name') || themeNodes[i].getAttribute('id');
                            if (name) {
                                report.svgThemes.names.push(name);
                            }
                        }
                    }
                } catch (e) {
                    report.svgThemes = { error: e.message };
                }
            }
            
            return report;
        },
        
        /**
         * Get sample values for fields (for understanding data types)
         * @param {String} theme - Theme name
         * @param {Array} fields - Field names
         * @returns {Object} Sample values by field
         */
        getSampleValues: function(theme, fields) {
            const map = this.getMap();
            if (!map || !map.Query) {
                return {};
            }
            
            const samples = {};
            fields.slice(0, 5).forEach(field => { // Limit to first 5 fields
                try {
                    const values = map.Query.getValuesOfFieldAndTheme(theme, field, 10);
                    samples[field] = values;
                } catch (e) {
                    // Ignore errors
                }
            });
            
            return samples;
        },
        
        /**
         * Detect language from query text (simple heuristic)
         * @param {String} query - Query text
         * @returns {String} Language code (e.g., 'en', 'de', 'fr', 'it', 'es')
         */
        detectLanguage: function(query) {
            if (!query || typeof query !== 'string') return 'en';
            
            const text = query.toLowerCase();
            
            // Common words/patterns for different languages
            // Note: English patterns should be checked last to avoid false positives
            const languagePatterns = {
                'de': [/\b(zeige|finde|suche|alle|daten|felder|bindungen|wie|was|welche|wo)\b/i,
                       /\b(über|unter|größer|kleiner|gleich|und|oder)\b/i,
                       /\b(bevölkerung|gebiet|region)\b/i],  // Removed "population" and "land" as they're ambiguous
                'fr': [/\b(montre|trouve|cherche|tous|données|champs|liens|comment|quoi|quels|où)\b/i,
                       /\b(supérieur|inférieur|plus|moins|égal|et|ou)\b/i],
                'it': [/\b(mostra|trova|cerca|tutti|dati|campi|collegamenti|come|cosa|quali|dove)\b/i,
                       /\b(superiore|inferiore|maggiore|minore|uguale|e|o)\b/i],
                'es': [/\b(muestra|encuentra|busca|todos|datos|campos|enlaces|cómo|qué|cuáles|dónde)\b/i,
                       /\b(superior|inferior|mayor|menor|igual|y|o)\b/i],
                'pt': [/\b(mostra|encontra|busca|todos|dados|campos|ligações|como|o que|quais|onde)\b/i],
                'nl': [/\b(toon|vind|zoek|alle|gegevens|velden|verbindingen|hoe|wat|welke|waar)\b/i],
                'ru': [/\b(покажи|найди|ищи|все|данные|поля|связи|как|что|какие|где)\b/i],
                'en': [/\b(show|find|search|all|data|fields|bindings|how|what|which|where)\b/i,
                       /\b(over|under|greater|less|equal|and|or|as|by|with|the|a|an)\b/i,
                       /\b(population|area|land|region|size|color|colour)\b/i]
            };
            
            // Score each language
            const scores = {};
            Object.keys(languagePatterns).forEach(lang => {
                scores[lang] = 0;
                languagePatterns[lang].forEach(pattern => {
                    if (pattern.test(text)) {
                        scores[lang]++;
                    }
                });
            });
            
            // Find language with highest score
            let maxScore = 0;
            let detectedLang = 'en'; // Default to English
            Object.keys(scores).forEach(lang => {
                if (scores[lang] > maxScore) {
                    maxScore = scores[lang];
                    detectedLang = lang;
                }
            });
            
            // If no strong match, default to English
            // Also, if English has a score and it's tied with another language, prefer English
            if (maxScore === 0) {
                detectedLang = 'en';
            } else if (scores['en'] > 0 && scores['en'] === maxScore) {
                // If English has the same score as another language, prefer English
                detectedLang = 'en';
            }
            
            console.log(`🌐 Detected language: ${detectedLang} (score: ${maxScore})`);
            return detectedLang;
        },
        
        /**
         * Parse natural language query using Gemini API or simple parser
         * @param {String} query - Natural language question
         * @param {Array} schemas - Available schemas
         * @returns {Promise<Object>} Parsed query structure
         */
        parseQuery: async function(query, schemas) {
            // Detect language first
            const detectedLanguage = this.detectLanguage(query);
            
            // Check if Mistral for all is enabled
            const useMistralForAll = localStorage.getItem('useMistralForAll') === 'true';
            const mistralApiKey = localStorage.getItem('mistralApiKey');
            
            // Use Mistral if "Mistral for all" is enabled
            if (useMistralForAll && mistralApiKey) {
                try {
                    const parsed = await this.parseQueryWithMistral(query, schemas, detectedLanguage);
                    parsed.detectedLanguage = detectedLanguage;
                    parsed.modelUsed = 'mistral'; // Track which model was used
                    return parsed;
                } catch (error) {
                    console.warn('Mistral parsing failed, falling back to simple parser:', error);
                    if (!this.config.fallbackToSimple) {
                        throw error;
                    }
                    // Fall through to simple parser
                }
            }
            
            // Use Gemini if configured and available
            if (this.config.useGemini && this.config.geminiApiKey) {
                try {
                    const parsed = await this.parseQueryWithGemini(query, schemas, detectedLanguage);
                    // Add detected language to parsed result
                    parsed.detectedLanguage = detectedLanguage;
                    parsed.modelUsed = 'gemini'; // Track which model was used
                    return parsed;
                } catch (error) {
                    console.warn('Gemini parsing failed, falling back to simple parser:', error);
                    if (!this.config.fallbackToSimple) {
                        throw error;
                    }
                    // Fall through to simple parser
                }
            }
            
            // Use simple pattern matching parser
            const parsed = this.parseQuerySimple(query, schemas);
            parsed.detectedLanguage = detectedLanguage;
            parsed.modelUsed = null; // Simple parser, no AI model
            return parsed;
        },
        
        /**
         * Parse query using Google Gemini API
         * @param {String} query - Natural language question
         * @param {Array} schemas - Available schemas
         * @param {String} detectedLanguage - Detected language code (e.g., 'en', 'de', 'fr')
         * @returns {Promise<Object>} Parsed query structure
         */
        parseQueryWithGemini: async function(query, schemas, detectedLanguage = 'en') {
            const apiKey = this.config.geminiApiKey;
            if (!apiKey) {
                throw new Error('Gemini API key not configured');
            }
            
            // Helper function to safely stringify objects with BigInt values
            const safeStringify = (obj, space = null) => {
                return JSON.stringify(obj, (key, value) => {
                    // Convert BigInt to string
                    if (typeof value === 'bigint') {
                        return value.toString();
                    }
                    return value;
                }, space);
            };
            
            // Prepare enhanced schema information for the prompt
            const schemaInfo = schemas.map(schema => {
                const schemaObj = {
                    theme: schema.theme,
                    themeTitle: schema.themeTitle || schema.theme, // Include human-readable title
                    fieldCount: schema.fields.length,
                    fields: []
                };
                
                // Include fields with sample values and metadata (exclude geometry fields)
                schema.fields
                    .filter(field => field !== 'geometry' && field !== 'Geometry' && field !== 'GEOMETRY')
                    .slice(0, 30)
                    .forEach(field => { // Increased to 30 fields
                        const fieldInfo = {
                            name: field
                        };
                        
                        // Add sample values if available
                        if (schema.sampleValues && schema.sampleValues[field]) {
                            const samples = schema.sampleValues[field];
                            fieldInfo.samples = samples.slice(0, 5); // First 5 sample values
                            
                            // Infer data type from samples
                            if (samples.length > 0) {
                                const firstSample = samples[0];
                                if (typeof firstSample === 'number' || !isNaN(parseFloat(firstSample))) {
                                    fieldInfo.type = 'numeric';
                                } else if (typeof firstSample === 'string') {
                                    // Check if it looks like a date
                                    if (firstSample.match(/\d{4}[-/]\d{2}[-/]\d{2}/) || firstSample.match(/\d{4}/)) {
                                        fieldInfo.type = 'date';
                                    } else {
                                        fieldInfo.type = 'text';
                                    }
                                } else {
                                    fieldInfo.type = typeof firstSample;
                                }
                            }
                        }
                        
                        schemaObj.fields.push(fieldInfo);
                    });
                
                return schemaObj;
            }).filter(s => s.fields.length > 0);
            
            // Language-specific instructions
            const languageInstructions = {
                'en': 'Respond in English.',
                'de': 'Antworte auf Deutsch.',
                'fr': 'Répondez en français.',
                'it': 'Rispondi in italiano.',
                'es': 'Responde en español.',
                'pt': 'Responda em português.',
                'nl': 'Antwoord in het Nederlands.',
                'ru': 'Отвечайте на русском языке.'
            };
            
            const languageInstruction = languageInstructions[detectedLanguage] || languageInstructions['en'];
            
            // Create the enhanced prompt for Gemini
            const prompt = `You are a query parser for a geographic map system. Parse the user's natural language query into a structured format.

IMPORTANT: The user's query is in ${detectedLanguage === 'en' ? 'English' : detectedLanguage.toUpperCase()}. ${languageInstruction} When generating responses or explanations, use the same language as the user's query.

CRITICAL: Never suggest users to go to another website or external service to start mapping. This is an ixmaps application and all mapping should be done within this application. Do not redirect users to other mapping platforms or websites.

CRITICAL: ixmaps cannot read shapefiles. Never include shapefile or .shp in any answer or suggestion. Supported data formats are: csv, json, jsonl, geojson, topojson, parquet, geoparquet, geopackage and flatgeobuffer. If a user asks about shapefiles, inform them that ixmaps does not support shapefiles and suggest they convert their data to one of the supported formats (e.g., GeoJSON or GeoPackage).

Available data schemas (themes with their fields and sample data):
${safeStringify(schemaInfo, 2)}

User query: "${query}"

Parse this query and return a JSON object with this structure:
{
  "type": "filter" | "all" | "discover" | "aggregate" | "spatial" | "binding" | "mapinfo" | "statistics" | "themes" | "datasources",
  "theme": "theme_id" or null (use theme ID, not title),
  "conditions": [
    {
      "field": "field_name",
      "operator": ">" | "<" | "==" | ">=" | "<=" | "like",
      "value": value
    }
  ],
  "intent": "lowercase version of query",
  "showDetails": true | false (only for mapinfo type - true if user wants detailed information),
  "showProcess": true | false (only for type "datasources" — true if the user asks to see the JavaScript for the external data provider / dbtableProcess, e.g. "show process code", "show JavaScript")
}

Rules (IMPORTANT - check in this order):
1. FIRST: If query is exactly "themes", "theme", "show themes", "list themes", "available themes", or asks to list/show available themes (without asking for data fields or bindings), set type to "themes". This should show a simple list of themes with their IDs, types, and layer names - NOT a detailed analysis with style information.
2. SECOND: If query asks about data sources, URLs, how/where data is loaded, SQL or query text for loading data, dbtable, external data provider, or file/format of the loaded data (NOT field bindings), set type to "datasources". Examples: "data source", "where does the data come from", "how is data loaded", "what URL", "data query". If the user also asks to list/show the process code, JavaScript, or dbtableProcess (e.g. "show process code"), set showProcess to true; otherwise omit showProcess or set it false (the app hides long JavaScript unless requested).
3. THIRD: If query mentions "analyze", "analyse", "analyze the data", "analyze this data", "analyze data", "please analyze", or asks to analyze/analyse data, set type to "mapinfo" and showDetails to true (full analysis with themes, statistics, and bindings).
4. FOURTH: If query mentions "map info", "map information", "about the map", "show all map", "map details", "map overview", "what is on the map", "yes", "more info", "show details", or asks for general information about the map (themes + bindings), set type to "mapinfo". If query is "yes", "more info", "show details", or contains "detailed"/"full info", also set showDetails to true.
5. FIFTH: If query mentions "statistics", "statistiche", "stats", "statistical info", "statistical information", "show statistics", "data statistics", or asks for statistical information about the data, set type to "statistics".
6. SIXTH: If query mentions "binding", "bindings", "data binding", "show bindings", "data usage", "how is data used", "field mapping", "which fields are used", "how are fields bound", "data bindings", "theme bindings", or asks how fields are mapped/used, set type to "binding"
7. SEVENTH: If query asks to "show all", "show all features", "show me all features", "all features", "display all", "visualize all", or similar phrases that mean showing all data without filtering, set type to "all". IMPORTANT: "show all features" is NOT a filter query - it means display all data on the map without any conditions.
8. EIGHTH: If query asks "what data" or "available data" or "show me all data fields" (but NOT about bindings, statistics, or data sources/URLs), set type to "discover"
9. Otherwise: set type to "filter"

Examples:
- "themes" → type: "themes"
- "show themes" → type: "themes"
- "list themes" → type: "themes"
- "available themes" → type: "themes"
- "data source" → type: "datasources"
- "how is data loaded" → type: "datasources"
- "where does the data come from" → type: "datasources"
- "show process code" → type: "datasources", showProcess: true
- "analyze the data" → type: "mapinfo", showDetails: true
- "please analyze this data" → type: "mapinfo", showDetails: true
- "show bindings" → type: "binding"
- "how are fields bound" → type: "binding"
- "data bindings" → type: "binding"
- "show statistics" → type: "statistics"
- "statistiche" → type: "statistics"
- "statistical info" → type: "statistics"
- "what data is available" → type: "discover"
- "show all features" → type: "all" (NOT filter - means display all data)
- "show me all features" → type: "all" (NOT filter - means display all data)
- For numeric comparisons (population > 1000000, area < 500, etc.), use operators: >, <, >=, <=
- For text matching (name == "Italy", country like "France"), use operator: "like" or "=="
- Match field names from the schemas (case-insensitive, try to match common synonyms)
- Extract numeric values from the query (e.g., "over 10 million" = 10000000)
- Use theme ID (not themeTitle) in the "theme" field
- Look at sample values to understand what kind of data each field contains
- Return ONLY valid JSON, no markdown, no explanations`;

            try {
                // List of models to try in order (most common first)
                // Updated with actual available models from API
                const modelsToTry = [
                    { name: 'gemini-2.5-flash', version: 'v1' },           // Latest and fastest
                    { name: 'gemini-2.5-pro', version: 'v1' },            // Latest and most capable
                    { name: 'gemini-2.0-flash', version: 'v1' },          // Fast
                    { name: 'gemini-2.0-flash-001', version: 'v1' },      // Stable version
                    { name: 'gemini-2.0-flash-lite-001', version: 'v1' },  // Lightweight
                    { name: 'gemini-2.5-flash-lite', version: 'v1' },      // Latest lite
                    // Fallback to older models if needed
                    { name: 'gemini-1.5-flash-latest', version: 'v1' },
                    { name: 'gemini-1.5-pro-latest', version: 'v1' },
                    { name: 'gemini-1.0-pro-latest', version: 'v1' }
                ];
                
                // Use configured model if provided, otherwise try all
                const modelName = this.config.geminiModel;
                const models = modelName 
                    ? [{ name: modelName, version: 'v1' }]
                    : modelsToTry;
                
                let lastError = null;
                
                // Try each model until one works
                for (const model of models) {
                    try {
                        // Model names from API include "models/" prefix, but API endpoint doesn't need it
                        const modelName = model.name.replace(/^models\//, '');
                        const apiUrl = `https://generativelanguage.googleapis.com/${model.version}/models/${modelName}:generateContent?key=${apiKey}`;
                        
                        const response = await fetch(apiUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [{
                                        text: prompt
                                    }]
                                }],
                                generationConfig: {
                                    temperature: 0.1,
                                    topK: 1,
                                    topP: 1,
                                    maxOutputTokens: 1024,
                                }
                            })
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            try {
                                const parsed = this.processGeminiResponse(data, query);
                                return parsed;
                            } catch (processError) {
                                // If processing fails, try next model instead of throwing
                                console.warn(`Model ${model.name} response processing failed:`, processError.message);
                                lastError = processError;
                                continue; // Try next model
                            }
                        } else {
                            const errorData = await response.json().catch(() => ({}));
                            lastError = new Error(`Model ${model.name} (${model.version}): ${response.status} - ${errorData.error?.message || response.statusText}`);
                            console.warn(`Model ${model.name} failed, trying next...`);
                            continue; // Try next model
                        }
                    } catch (err) {
                        lastError = err;
                        console.warn(`Error with model ${model.name}:`, err.message);
                        continue; // Try next model
                    }
                }
                
                // If all models failed, throw the last error
                if (lastError) {
                    throw new Error(`All Gemini models failed. Last error: ${lastError.message}. Please check your API key and available models.`);
                }
                
                throw new Error('No Gemini models available');
                
            } catch (error) {
                console.error('Gemini API call failed:', error);
                throw new Error(`Failed to parse query with Gemini: ${error.message}`);
            }
        },
        
        /**
         * Parse query using Mistral API
         * @param {String} query - Natural language question
         * @param {Array} schemas - Available schemas
         * @param {String} detectedLanguage - Detected language code (e.g., 'en', 'de', 'fr')
         * @returns {Promise<Object>} Parsed query structure
         */
        parseQueryWithMistral: async function(query, schemas, detectedLanguage = 'en') {
            console.log('🌬️ Using Mistral API to parse query');
            const apiKey = localStorage.getItem('mistralApiKey');
            if (!apiKey) {
                throw new Error('Mistral API key not configured');
            }
            
            // Helper function to safely stringify objects with BigInt values
            const safeStringify = (obj, space = null) => {
                return JSON.stringify(obj, (key, value) => {
                    // Convert BigInt to string
                    if (typeof value === 'bigint') {
                        return value.toString();
                    }
                    return value;
                }, space);
            };
            
            // Prepare enhanced schema information for the prompt (same as Gemini)
            const schemaInfo = schemas.map(schema => {
                const schemaObj = {
                    theme: schema.theme,
                    themeTitle: schema.themeTitle || schema.theme,
                    fieldCount: schema.fields.length,
                    fields: []
                };
                
                schema.fields
                    .filter(field => field !== 'geometry' && field !== 'Geometry' && field !== 'GEOMETRY')
                    .slice(0, 30)
                    .forEach(field => {
                        const fieldInfo = { name: field };
                        
                        if (schema.sampleValues && schema.sampleValues[field]) {
                            const samples = schema.sampleValues[field];
                            fieldInfo.samples = samples.slice(0, 5);
                            
                            if (samples.length > 0) {
                                const firstSample = samples[0];
                                if (typeof firstSample === 'number' || !isNaN(parseFloat(firstSample))) {
                                    fieldInfo.type = 'numeric';
                                } else if (typeof firstSample === 'string') {
                                    if (firstSample.match(/\d{4}[-/]\d{2}[-/]\d{2}/) || firstSample.match(/\d{4}/)) {
                                        fieldInfo.type = 'date';
                                    } else {
                                        fieldInfo.type = 'text';
                                    }
                                } else {
                                    fieldInfo.type = typeof firstSample;
                                }
                            }
                        }
                        
                        schemaObj.fields.push(fieldInfo);
                    });
                
                return schemaObj;
            }).filter(s => s.fields.length > 0);
            
            // Language-specific instructions
            const languageInstructions = {
                'en': 'Respond in English.',
                'de': 'Antworte auf Deutsch.',
                'fr': 'Répondez en français.',
                'it': 'Rispondi in italiano.',
                'es': 'Responde en español.',
                'pt': 'Responda em português.',
                'nl': 'Antwoord in het Nederlands.',
                'ru': 'Отвечайте на русском языке.'
            };
            
            // Check if user has configured a preferred language for Mistral responses
            let responseLanguage = detectedLanguage;
            try {
                const savedLanguage = localStorage.getItem('mistralResponseLanguage');
                if (savedLanguage && savedLanguage !== 'auto' && languageInstructions[savedLanguage]) {
                    responseLanguage = savedLanguage;
                }
            } catch (e) {
                // If localStorage is not available, use detected language
            }
            
            const languageInstruction = languageInstructions[responseLanguage] || languageInstructions['en'];
            
            // Create the same prompt as Gemini
            const prompt = `You are a query parser for a geographic map system. Parse the user's natural language query into a structured format.

IMPORTANT: ${languageInstruction} When generating responses or explanations, use ${responseLanguage === 'en' ? 'English' : responseLanguage.toUpperCase()}.

CRITICAL: Never suggest users to go to another website or external service to start mapping. This is an ixmaps application and all mapping should be done within this application. Do not redirect users to other mapping platforms or websites.

CRITICAL: ixmaps cannot read shapefiles. Never include shapefile or .shp in any answer or suggestion. Supported data formats are: csv, json, jsonl, geojson, topojson, parquet, geoparquet, geopackage and flatgeobuffer. If a user asks about shapefiles, inform them that ixmaps does not support shapefiles and suggest they convert their data to one of the supported formats (e.g., GeoJSON or GeoPackage).

Available data schemas (themes with their fields and sample data):
${safeStringify(schemaInfo, 2)}

User query: "${query}"

Parse this query and return a JSON object with this structure:
{
  "type": "filter" | "all" | "discover" | "aggregate" | "spatial" | "binding" | "mapinfo" | "statistics" | "themes" | "datasources",
  "theme": "theme_id" or null (use theme ID, not title),
  "conditions": [
    {
      "field": "field_name",
      "operator": ">" | "<" | "==" | ">=" | "<=" | "like",
      "value": value
    }
  ],
  "intent": "lowercase version of query",
  "showDetails": true | false (only for mapinfo type - true if user wants detailed information),
  "showProcess": true | false (only for type "datasources" — true if the user asks to see the JavaScript for the external data provider / dbtableProcess, e.g. "show process code", "show JavaScript")
}

Rules (IMPORTANT - check in this order):
1. FIRST: If query is exactly "themes", "theme", "show themes", "list themes", "available themes", or asks to list/show available themes (without asking for data fields or bindings), set type to "themes". This should show a simple list of themes with their IDs, types, and layer names - NOT a detailed analysis with style information.
2. SECOND: If query asks about data sources, URLs, how/where data is loaded, SQL or query text for loading data, dbtable, external data provider, or file/format of the loaded data (NOT field bindings), set type to "datasources". Examples: "data source", "where does the data come from", "how is data loaded", "what URL", "data query". If the user also asks to list/show the process code, JavaScript, or dbtableProcess (e.g. "show process code"), set showProcess to true; otherwise omit showProcess or set it false (the app hides long JavaScript unless requested).
3. THIRD: If query mentions "analyze", "analyse", "analyze the data", "analyze this data", "analyze data", "please analyze", or asks to analyze/analyse data, set type to "mapinfo" and showDetails to true (full analysis with themes, statistics, and bindings).
4. FOURTH: If query mentions "map info", "map information", "about the map", "show all map", "map details", "map overview", "what is on the map", "yes", "more info", "show details", or asks for general information about the map (themes + bindings), set type to "mapinfo". If query is "yes", "more info", "show details", or contains "detailed"/"full info", also set showDetails to true.
5. FIFTH: If query mentions "statistics", "statistiche", "stats", "statistical info", "statistical information", "show statistics", "data statistics", or asks for statistical information about the data, set type to "statistics".
6. SIXTH: If query mentions "binding", "bindings", "data binding", "show bindings", "data usage", "how is data used", "field mapping", "which fields are used", "how are fields bound", "data bindings", "theme bindings", or asks how fields are mapped/used, set type to "binding"
7. SEVENTH: If query asks to "show all", "show all features", "show me all features", "all features", "display all", "visualize all", or similar phrases that mean showing all data without filtering, set type to "all". IMPORTANT: "show all features" is NOT a filter query - it means display all data on the map without any conditions.
8. EIGHTH: If query asks "what data" or "available data" or "show me all data fields" (but NOT about bindings, statistics, or data sources/URLs), set type to "discover"
9. Otherwise: set type to "filter"

Examples:
- "themes" → type: "themes"
- "show themes" → type: "themes"
- "list themes" → type: "themes"
- "available themes" → type: "themes"
- "data source" → type: "datasources"
- "how is data loaded" → type: "datasources"
- "where does the data come from" → type: "datasources"
- "show process code" → type: "datasources", showProcess: true
- "analyze the data" → type: "mapinfo", showDetails: true
- "please analyze this data" → type: "mapinfo", showDetails: true
- "show bindings" → type: "binding"
- "how are fields bound" → type: "binding"
- "data bindings" → type: "binding"
- "show statistics" → type: "statistics"
- "statistiche" → type: "statistics"
- "statistical info" → type: "statistics"
- "what data is available" → type: "discover"
- "show all features" → type: "all" (NOT filter - means display all data)
- "show me all features" → type: "all" (NOT filter - means display all data)
- For numeric comparisons (population > 1000000, area < 500, etc.), use operators: >, <, >=, <=
- For text matching (name == "Italy", country like "France"), use operator: "like" or "=="
- Match field names from the schemas (case-insensitive, try to match common synonyms)
- Extract numeric values from the query (e.g., "over 10 million" = 10000000)
- Use theme ID (not themeTitle) in the "theme" field
- Look at sample values to understand what kind of data each field contains
- Return ONLY valid JSON, no markdown, no explanations`;

            try {
                const url = `https://api.mistral.ai/v1/chat/completions`;
                console.log('🌬️ Calling Mistral API:', { model: 'mistral-small-latest', url: url.substring(0, 30) + '...' });
                console.log('🌬️ Mistral Prompt:', prompt);
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'mistral-small-latest',
                        messages: [{
                            role: 'user',
                            content: prompt
                        }],
                        temperature: 0.1,
                        max_tokens: 1024
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`Mistral API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
                }
                
                const data = await response.json();
                console.log('🌬️ Mistral API raw response:', JSON.stringify(data, null, 2));
                
                const generatedText = data.choices?.[0]?.message?.content || '';
                console.log('🌬️ Mistral API response received');
                console.log('🌬️ Mistral generated text:', generatedText);
                
                if (!generatedText) {
                    throw new Error('No response from Mistral API');
                }
                
                // Parse the JSON response (same logic as Gemini)
                let jsonText = generatedText.trim();
                jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                
                // Try to extract JSON from the text
                const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    jsonText = jsonMatch[0];
                }
                
                console.log('🌬️ Mistral extracted JSON text:', jsonText);
                
                let parsed;
                try {
                    parsed = JSON.parse(jsonText);
                    console.log('🌬️ Mistral parsed JSON:', JSON.stringify(parsed, null, 2));
                } catch (parseError) {
                    console.error('🌬️ JSON Parse Error:', parseError);
                    console.error('🌬️ Failed to parse JSON text:', jsonText);
                    throw new Error(`Failed to parse Mistral response as JSON: ${parseError.message}`);
                }
                
                // Ensure required fields (same as processGeminiResponse)
                parsed.originalQuery = query;
                parsed.type = parsed.type || 'filter';
                parsed.conditions = parsed.conditions || [];
                parsed.intent = parsed.intent || query.toLowerCase();
                parsed.showProcess = parsed.showProcess === true;
                
                // Extract search term from original query if it's a simple search pattern
                if (!parsed.searchTerm) {
                    const searchPatterns = [
                        /^(show me|find|search for|display|show|get|list|where is|where are)\s+(.+)$/i,
                        /^(find all|show all|list all|get all)\s+(.+)$/i,
                    ];
                    
                    for (const pattern of searchPatterns) {
                        const match = query.match(pattern);
                        if (match && match[2]) {
                            let extractedTerm = match[2].trim();
                            extractedTerm = extractedTerm.replace(/\s+(please|now|here)?\s*[?]?$/i, '').trim();
                            if (extractedTerm.length > 0) {
                                parsed.searchTerm = extractedTerm;
                                break;
                            }
                        }
                    }
                    
                    // If no pattern matched, try cleaning the query
                    if (!parsed.searchTerm && query.trim().length < 50) {
                        let cleanQuery = query.trim();
                        cleanQuery = cleanQuery.replace(/^(show me|find|search for|display|show|get|list|where is|where are)\s+/i, '');
                        cleanQuery = cleanQuery.replace(/\s+(please|now|here)?\s*[?]?$/i, '');
                        if (cleanQuery.length > 0 && cleanQuery.length < 50) {
                            parsed.searchTerm = cleanQuery.trim();
                        }
                    }
                }
                
                return parsed;
                
            } catch (error) {
                console.error('Mistral API call failed:', error);
                throw new Error(`Failed to parse query with Mistral: ${error.message}`);
            }
        },
        
        /**
         * Process Gemini API response
         * @param {Object} data - Response data from Gemini API
         * @param {String} query - Original query
         * @returns {Object} Parsed query structure
         */
        processGeminiResponse: function(data, query) {
            // Extract the generated text - try multiple possible structures
            let generatedText = null;
            
            if (data.candidates && data.candidates[0]) {
                const candidate = data.candidates[0];
                
                // Standard structure: candidate.content.parts[0].text
                if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
                    generatedText = candidate.content.parts[0].text;
                }
                // Alternative: candidate.parts[0].text
                else if (candidate.parts && candidate.parts[0]) {
                    generatedText = candidate.parts[0].text;
                }
                // Direct text property
                else if (candidate.text) {
                    generatedText = candidate.text;
                }
            }
            
            if (!generatedText) {
                console.error('❌ No text in Gemini response. Response structure:', {
                    hasCandidates: !!data.candidates,
                    candidatesLength: data.candidates?.length,
                    firstCandidateKeys: data.candidates?.[0] ? Object.keys(data.candidates[0]) : null,
                    fullResponse: data
                });
                throw new Error('No response from Gemini API');
            }
            
            generatedText = String(generatedText).trim();
            console.log('📝 Raw Gemini Generated Text:', generatedText);
            
            // Parse the JSON response (may be wrapped in markdown code blocks)
            let jsonText = generatedText.trim();
            
            // Remove markdown code blocks if present
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            
            // Try to extract JSON if it's embedded in text
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonText = jsonMatch[0];
            }
            
            let parsed;
            try {
                parsed = JSON.parse(jsonText);
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError);
                throw new Error(`Failed to parse Gemini response as JSON: ${parseError.message}`);
            }
            
            // Ensure required fields
            parsed.originalQuery = query;
            parsed.type = parsed.type || 'filter';
            parsed.conditions = parsed.conditions || [];
            parsed.intent = parsed.intent || query.toLowerCase();
            parsed.showProcess = parsed.showProcess === true;
            
            // Extract search term from original query if it's a simple search pattern
            // This ensures "Show me Italy" uses simple search even if Gemini creates field conditions
            if (!parsed.searchTerm) {
                const searchPatterns = [
                    /^(show me|find|search for|display|show|get|list|where is|where are)\s+(.+)$/i,
                    /^(find all|show all|list all|get all)\s+(.+)$/i,
                ];
                
                for (const pattern of searchPatterns) {
                    const match = query.match(pattern);
                    if (match && match[2]) {
                        let extractedTerm = match[2].trim();
                        extractedTerm = extractedTerm.replace(/\s+(please|now|here)?\s*[?]?$/i, '').trim();
                        if (extractedTerm.length > 0) {
                            parsed.searchTerm = extractedTerm;
                            break;
                        }
                    }
                }
                
                // If no pattern matched, try cleaning the query
                if (!parsed.searchTerm && query.trim().length < 50) {
                    let cleanQuery = query.trim();
                    cleanQuery = cleanQuery.replace(/^(show me|find|search for|display|show|get|list|where is|where are)\s+/i, '');
                    cleanQuery = cleanQuery.replace(/\s+(please|now|here)?\s*[?]?$/i, '');
                    if (cleanQuery.length > 0 && cleanQuery.length < 50) {
                        parsed.searchTerm = cleanQuery.trim();
                    }
                }
            }
            
            return parsed;
        },
        
        /**
         * Simple pattern matching parser (fallback)
         * @param {String} query - Natural language question
         * @param {Array} schemas - Available schemas
         * @returns {Object} Parsed query structure
         */
        parseQuerySimple: function(query, schemas) {
            // This is a simplified parser - in production, use LLM
            
            const parsed = {
                type: 'filter', // filter, aggregate, spatial, etc.
                conditions: [],
                theme: null,
                intent: query.toLowerCase(),
                originalQuery: query,
                searchTerm: null // Extracted search term for simple queries
            };
            
            // Simple pattern matching (production would use LLM)
            const lowerQuery = query.toLowerCase();
            
            // Special queries - "show all features" should NOT be interpreted as a filter
            // It means display all data on the map without any filtering conditions
            if (lowerQuery.includes('all features') || 
                lowerQuery.includes('show all') || 
                lowerQuery.includes('show me all') ||
                lowerQuery.includes('display all') ||
                lowerQuery.includes('visualize all') ||
                lowerQuery === '*') {
                parsed.type = 'all';
                return parsed;
            }
            
            // Detect binding/data usage queries FIRST (before discover, as "show bindings" could match both)
            if (lowerQuery.includes('binding') || 
                lowerQuery.includes('bindings') ||
                lowerQuery.includes('data binding') ||
                lowerQuery.includes('show bindings') ||
                lowerQuery.includes('how is data used') ||
                lowerQuery.includes('data usage') ||
                lowerQuery.includes('theme binding') ||
                lowerQuery.includes('field binding') ||
                lowerQuery.includes('which fields are used') ||
                lowerQuery.includes('what fields are mapped') ||
                lowerQuery.includes('data mapping') ||
                lowerQuery.includes('how are fields bound') ||
                lowerQuery.includes('theme bindings') ||
                lowerQuery.includes('data bindings')) {
                parsed.type = 'binding';
                return parsed;
            }
            
            // Detect statistics queries
            if (lowerQuery.includes('statistics') ||
                lowerQuery.includes('statistiche') ||
                lowerQuery.includes('stats') ||
                lowerQuery.includes('statistiche') ||
                lowerQuery.includes('show statistics') ||
                lowerQuery.includes('data statistics') ||
                lowerQuery.includes('statistical info') ||
                lowerQuery.includes('statistical information')) {
                parsed.type = 'statistics';
                return parsed;
            }
            
            // Data sources: URLs, SQL/query, dbtable descriptor, process (not field bindings)
            const isDataSourcesQuery =
                lowerQuery.includes('data source') ||
                lowerQuery.includes('data sources') ||
                lowerQuery.includes('source of data') ||
                lowerQuery.includes('sources of data') ||
                lowerQuery.includes('data-url') ||
                lowerQuery.includes('data url') ||
                lowerQuery.includes('where does the data come') ||
                lowerQuery.includes('where does data come') ||
                lowerQuery.includes('where is the data from') ||
                lowerQuery.includes('where does the data load') ||
                lowerQuery.includes('how is data loaded') ||
                lowerQuery.includes('how data is loaded') ||
                lowerQuery.includes('how was data loaded') ||
                lowerQuery.includes('how is the data loaded') ||
                (lowerQuery.includes('how') && lowerQuery.includes('data') && lowerQuery.includes('loaded')) ||
                lowerQuery.includes('dbtable') ||
                (lowerQuery.includes('url') && (lowerQuery.includes('data') || lowerQuery.includes('theme') || lowerQuery.includes('layer'))) ||
                (lowerQuery.includes('sql') && (lowerQuery.includes('data') || lowerQuery.includes('theme') || lowerQuery.includes('layer'))) ||
                lowerQuery.includes('external data') ||
                lowerQuery.includes('data provider') ||
                (lowerQuery.includes('what type') && lowerQuery.includes('data') && (lowerQuery.includes('load') || lowerQuery.includes('source') || lowerQuery.includes('file') || lowerQuery.includes('format'))) ||
                lowerQuery.includes('datenquelle') ||
                lowerQuery.includes('quelle der daten') ||
                lowerQuery.includes('sorgente dati') ||
                lowerQuery.includes('origine dei dati') ||
                lowerQuery.includes('origen de los datos') ||
                lowerQuery.includes('proveedor de datos') ||
                lowerQuery.includes('process code') ||
                lowerQuery.includes('show process') ||
                lowerQuery.includes('dbtableprocess') ||
                (lowerQuery.includes('javascript') && /\b(show|list|display|source|code|provider|external)\b/.test(lowerQuery)) ||
                (lowerQuery.includes('external') && lowerQuery.includes('provider') && /\b(show|list|code|javascript|js|source)\b/.test(lowerQuery));
            
            if (isDataSourcesQuery) {
                parsed.type = 'datasources';
                return parsed;
            }
            
            // CRITICAL: Check for "info about data" FIRST to ensure data info is returned, not tooltip suggestions
            // This must be checked BEFORE mapinfo to avoid confusion
            const isDataInfoQuery = lowerQuery.includes('info about data') ||
                lowerQuery.includes('more info about the data') ||
                lowerQuery.includes('more info about data') ||
                lowerQuery.includes('information about data') ||
                lowerQuery.includes('info on data') ||
                lowerQuery.includes('data info') ||
                (lowerQuery.includes('info') && lowerQuery.includes('data') && !lowerQuery.includes('map'));
            
            if (isDataInfoQuery) {
                parsed.type = 'discover';
                return parsed;
            }
            
            // Detect analysis requests - "analyze this data", "analyze data", etc.
            // These should be treated as mapinfo with showDetails=true (full analysis like "yes" after data load)
            const isAnalysisQuery = lowerQuery.includes('analyze this data') ||
                lowerQuery.includes('analyze the data') ||
                lowerQuery.includes('analyze data') ||
                lowerQuery.includes('analyse this data') ||
                lowerQuery.includes('analyse the data') ||
                lowerQuery.includes('analyse data') ||
                (lowerQuery.includes('analyze') && lowerQuery.includes('data')) ||
                (lowerQuery.includes('analyse') && lowerQuery.includes('data'));
            
            if (isAnalysisQuery) {
                parsed.type = 'mapinfo';
                parsed.showDetails = true; // Always show full analysis for analyze requests
                return parsed;
            }
            
            // Detect map info queries - asking about the map (themes + bindings)
            // This should be checked AFTER data info queries to avoid confusion
            // Also detect follow-up requests for details (yes, more info, etc.)
            const isMapInfoQuery = lowerQuery.includes('map info') ||
                lowerQuery.includes('map information') ||
                lowerQuery.includes('about the map') ||
                lowerQuery.includes('show all map') ||
                lowerQuery.includes('map details') ||
                lowerQuery.includes('map overview') ||
                lowerQuery.includes('what is on the map') ||
                lowerQuery.includes('what\'s on the map') ||
                (lowerQuery.includes('map') && (lowerQuery.includes('info') || lowerQuery.includes('about') || lowerQuery.includes('show')));
            
            // Detect requests for more details (yes, more info, show details, etc.)
            // But exclude "more info about data" which is handled above
            const wantsDetails = (lowerQuery === 'yes' ||
                               lowerQuery === 'y' ||
                               lowerQuery.includes('show details') ||
                               lowerQuery.includes('detailed') ||
                               lowerQuery.includes('full info') ||
                               lowerQuery.includes('complete info')) &&
                               !isDataInfoQuery;
            
            if (isMapInfoQuery || wantsDetails) {
                parsed.type = 'mapinfo';
                // Check if user explicitly wants details
                parsed.showDetails = wantsDetails || 
                                   lowerQuery.includes('details') || 
                                   lowerQuery.includes('detailed') || 
                                   (lowerQuery.includes('more info') && !isDataInfoQuery) ||
                                   lowerQuery === 'show map details';
                return parsed;
            }
            
            // Detect theme queries - "show themes", "list themes", "show theme info", etc.
            // Also handles normalized "layer" queries (already converted to "theme")
            if (lowerQuery.includes('show theme') ||
                lowerQuery.includes('show themes') ||
                lowerQuery.includes('list theme') ||
                lowerQuery.includes('list themes') ||
                lowerQuery.includes('theme info') ||
                lowerQuery.includes('themes info') ||
                lowerQuery.includes('theme information') ||
                lowerQuery.includes('themes information') ||
                lowerQuery.includes('theme details') ||
                lowerQuery.includes('themes details') ||
                lowerQuery.includes('available theme') ||
                lowerQuery.includes('available themes') ||
                (lowerQuery.includes('theme') && (lowerQuery.includes('show') || lowerQuery.includes('list') || lowerQuery.includes('info') || lowerQuery.includes('information')))) {
                parsed.type = 'discover';
                return parsed;
            }
            
            // Detect discovery queries - asking about available data/fields
            if (lowerQuery.includes('what data') || 
                lowerQuery.includes('available data') || 
                lowerQuery.includes('schema') ||
                lowerQuery.includes('data fields') ||
                lowerQuery.includes('show me all data') ||
                lowerQuery.includes('list data') ||
                lowerQuery.includes('what fields') ||
                lowerQuery.includes('show fields')) {
                parsed.type = 'discover';
                return parsed;
            }
            
            // Extract search term from common query patterns
            // Patterns like: "show me X", "find X", "search for X", "display X", etc.
            const searchPatterns = [
                /^(show me|find|search for|display|show|get|list|where is|where are)\s+(.+)$/i,
                /^(find all|show all|list all|get all)\s+(.+)$/i,
                /^(.+?)\s+(in|on|at|for)\s+(.+)$/i  // "AD in countries" -> extract "AD"
            ];
            
            let extractedTerm = null;
            for (const pattern of searchPatterns) {
                const match = query.match(pattern);
                if (match && match[2]) {
                    extractedTerm = match[2].trim();
                    // Remove trailing question words
                    extractedTerm = extractedTerm.replace(/\s+(please|now|here)?\s*[?]?$/i, '').trim();
                    if (extractedTerm.length > 0) {
                        parsed.searchTerm = extractedTerm;
                        parsed.intent = extractedTerm.toLowerCase();
                        break;
                    }
                }
            }
            
            // If no pattern matched but query is short (likely a direct search term)
            if (!extractedTerm && query.trim().length < 50 && !query.match(/\b(more than|less than|over|under|greater|smaller)\b/i)) {
                // Remove common question words from start/end
                let cleanQuery = query.trim();
                const originalClean = cleanQuery;
                cleanQuery = cleanQuery.replace(/^(show me|find|search for|display|show|get|list|where is|where are)\s+/i, '');
                cleanQuery = cleanQuery.replace(/\s+(please|now|here)?\s*[?]?$/i, '');
                if (cleanQuery.length > 0 && cleanQuery.length < 50 && cleanQuery !== originalClean) {
                    parsed.searchTerm = cleanQuery.trim();
                    parsed.intent = cleanQuery.toLowerCase();
                } else if (query.trim().length < 30) {
                    // Very short query, likely just the search term itself
                    parsed.searchTerm = query.trim();
                    parsed.intent = query.toLowerCase();
                }
            }
            
            // Detect comparison operators with numbers
            const numberMatch = lowerQuery.match(/\b(more than|greater than|over|above|larger than)\s+(\d[\d,]*)/);
            if (numberMatch) {
                const value = parseInt(numberMatch[2].replace(/,/g, ''));
                parsed.conditions.push({
                    operator: '>',
                    value: value
                });
            }
            
            const lessMatch = lowerQuery.match(/\b(less than|under|below|smaller than)\s+(\d[\d,]*)/);
            if (lessMatch) {
                const value = parseInt(lessMatch[2].replace(/,/g, ''));
                parsed.conditions.push({
                    operator: '<',
                    value: value
                });
            }
            
            // Detect field names from schemas
            // Only if we haven't extracted a simple search term
            if (!parsed.searchTerm) {
                schemas.forEach(schema => {
                    schema.fields.forEach(field => {
                        const fieldLower = field.toLowerCase();
                        // Check if query mentions this field (but not as part of a simple search)
                        // Skip if the field name is the entire query or most of it
                        const searchTermLower = parsed.searchTerm ? parsed.searchTerm.toLowerCase() : '';
                        if (fieldLower === lowerQuery.trim() || fieldLower === searchTermLower) {
                            // Field name IS the search term, don't treat it as a field condition
                            return;
                        }
                        
                        if (lowerQuery.includes(fieldLower) || 
                            lowerQuery.includes(fieldLower.replace(/_/g, ' ')) ||
                            lowerQuery.includes(fieldLower.replace(/_/g, ''))) {
                            if (!parsed.conditions.find(c => c.field === field)) {
                                parsed.conditions.push({
                                    field: field,
                                    theme: schema.theme
                                });
                            }
                        }
                    });
                    
                    // Check for common field synonyms
                    const commonFields = {
                        'population': ['pop', 'people', 'inhabitants', 'residents'],
                        'area': ['size', 'surface'],
                        'name': ['title', 'label'],
                        'country': ['nation', 'state'],
                        'region': ['province', 'state']
                    };
                    
                    Object.keys(commonFields).forEach(standardField => {
                        if (schema.fields.some(f => f.toLowerCase().includes(standardField))) {
                            commonFields[standardField].forEach(synonym => {
                                if (lowerQuery.includes(synonym) && !parsed.conditions.find(c => c.field && c.field.toLowerCase().includes(standardField))) {
                                    const matchingField = schema.fields.find(f => f.toLowerCase().includes(standardField));
                                    if (matchingField) {
                                        parsed.conditions.push({
                                            field: matchingField,
                                            theme: schema.theme
                                        });
                                    }
                                }
                            });
                        }
                    });
                });
            }
            
            // Detect theme names
            schemas.forEach(schema => {
                const themeLower = schema.theme.toLowerCase();
                if (lowerQuery.includes(themeLower) || lowerQuery.includes(themeLower.replace(/_/g, ' '))) {
                    parsed.theme = schema.theme;
                }
            });
            
            return parsed;
        },
        
        /**
         * Set Gemini API key
         * @param {String} apiKey - Your Gemini API key
         */
        setGeminiApiKey: function(apiKey) {
            this.config.geminiApiKey = apiKey;
        },
        
        /**
         * Enable or disable Gemini
         * @param {Boolean} enable - True to enable Gemini, false to use simple parser
         */
        setUseGemini: function(enable) {
            this.config.useGemini = enable;
        },
        
        /**
         * List available Gemini models for debugging
         * @returns {Promise<Array>} List of available models
         */
        listAvailableModels: async function() {
            const apiKey = this.config.geminiApiKey;
            if (!apiKey) {
                throw new Error('Gemini API key not configured');
            }
            
            try {
                // Try v1 first
                const v1Url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
                const v1Response = await fetch(v1Url);
                
                if (v1Response.ok) {
                    const v1Data = await v1Response.json();
                    console.log('Available v1 models:', v1Data);
                    return v1Data.models || [];
                }
                
                // Try v1beta
                const v1betaUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
                const v1betaResponse = await fetch(v1betaUrl);
                
                if (v1betaResponse.ok) {
                    const v1betaData = await v1betaResponse.json();
                    console.log('Available v1beta models:', v1betaData);
                    return v1betaData.models || [];
                }
                
                throw new Error('Could not fetch model list');
            } catch (error) {
                console.error('Error listing models:', error);
                throw error;
            }
        },
        
        /**
         * Translate parsed query to ixmaps query syntax
         * @param {Object} parsed - Parsed query structure
         * @param {Array} schemas - Available schemas
         * @returns {Object} Ixmaps query object
         */
        translateToIxmapsQuery: function(parsed, schemas) {
            const query = {
                theme: parsed.theme || 'all',
                sql: '',
                method: 'simple'
            };
            
            // Handle special query types
            if (parsed.type === 'all') {
                query.method = 'simple';
                query.sql = '*';
                return query;
            }
            
            if (parsed.type === 'discover') {
                query.method = 'discover';
                query.sql = '';
                return query;
            }
            
            // Build SQL-like query string
            const conditions = [];
            
            // Group conditions by field
            const fieldConditions = {};
            parsed.conditions.forEach(cond => {
                if (cond.field) {
                    if (!fieldConditions[cond.field]) {
                        fieldConditions[cond.field] = [];
                    }
                    // Only add conditions that have both operator and value
                    if (cond.operator && cond.value !== undefined) {
                        fieldConditions[cond.field].push({
                            operator: cond.operator,
                            value: cond.value
                        });
                    }
                }
            });
            
            // Build query string
            // If multiple == conditions for the same field, combine into IN clause
            Object.keys(fieldConditions).forEach(field => {
                const fieldConds = fieldConditions[field];
                
                // Check if all conditions for this field are == (equality)
                const allEquality = fieldConds.every(cond => cond.operator === '==');
                
                if (allEquality && fieldConds.length > 1) {
                    // Multiple equality conditions for same field -> use IN clause
                    // Standard SQL syntax: WHERE "field" IN (value1,value2,value3)
                    const values = fieldConds.map(cond => String(cond.value));
                    conditions.push(`${field} IN (${values.join(',')})`);
                } else {
                    // Single condition or mixed operators -> use individual conditions
                    fieldConds.forEach(cond => {
                        conditions.push(`${field} ${cond.operator} ${cond.value}`);
                    });
                }
            });
            
            // Prioritize explicit conditions over search term
            // If Gemini generated explicit field conditions (==, !=, >, <, etc.), use those
            // Only use simple search if there are no explicit conditions
            if (conditions.length > 0) {
                // We have explicit conditions from Gemini - use them (this includes ==, !=, >, <, >=, <=)
                query.method = 'advanced';
                query.sql = conditions.join(' and ');
            } else if (parsed.searchTerm) {
                // No explicit conditions, but we have a search term - use simple text search
                query.method = 'simple';
                query.sql = parsed.searchTerm;
            } else {
                // Fallback to simple search
                query.method = 'simple';
                // Use extracted search term if available, otherwise use original query
                query.sql = parsed.searchTerm || parsed.originalQuery || parsed.intent;
            }
            
            return query;
        },
        
        /**
         * Execute the ixmaps query
         * @param {Object} queryObj - Query object
         * @returns {Array} Found nodes/features
         */
        executeQuery: function(queryObj) {
            console.log('🎯 executeQuery called with:', queryObj);
            
            const map = this.getMap();
            if (!map) {
                console.error('❌ Map object not found');
                throw new Error('Map not available. Please wait for the map to load.');
            }
            
            if (!map.Query) {
                console.error('❌ map.Query not available');
                throw new Error('Map Query API not available. Please wait for the map to load.');
            }
            
            console.log('✅ Map and Query API available');
            console.log('📋 map.Query methods:', Object.getOwnPropertyNames(map.Query).filter(name => typeof map.Query[name] === 'function'));
            
            try {
                if (queryObj.method === 'advanced' && queryObj.sql) {
                    console.log('🔍 Calling map.Query.searchItemAdvanced("' + queryObj.sql + '", "' + queryObj.theme + '")');
                    const results = map.Query.searchItemAdvanced(queryObj.sql, queryObj.theme);
                    console.log('✅ searchItemAdvanced returned', results ? results.length : 0, 'results');
                    return results;
                } else {
                    console.log('🔍 Calling map.Query.searchItem("' + queryObj.sql + '", "any", "' + queryObj.theme + '")');
                    const results = map.Query.searchItem(queryObj.sql, 'any', queryObj.theme);
                    console.log('✅ searchItem returned', results ? results.length : 0, 'results');
                    return results;
                }
            } catch (e) {
                console.error('❌ Query execution error:', e);
                console.error('Error stack:', e.stack);
                throw new Error('Query execution failed: ' + e.message);
            }
        },
        
        /**
         * Execute data query using Data.Table and theme data API
         * This is the NEW approach for themes with data visualization
         * @param {Object} queryObj - Query object
         * @param {Object} schema - Schema object with objTheme
         * @returns {Array} Found items with map references
         */
        executeDataQuery: function(queryObj, schema) {
            const map = this.getMap();
            if (!map) {
                throw new Error('Map not available. Please wait for the map to load.');
            }
            
            if (!schema || !schema.objTheme || !schema.objTheme.objTheme) {
                throw new Error('Theme data not available. Theme may not have data visualization.');
            }
            
            const objTheme = schema.objTheme;
            const themeId = schema.theme;
            
            try {
                // Create Data.Table from theme data (following facets.js pattern)
                const mydata = new Data.Table(null);
                mydata.table = objTheme.objTheme.dbTable;
                mydata.fields = objTheme.objTheme.dbFields;
                mydata.records = objTheme.objTheme.dbRecords;
                
                console.log('📊 Created Data.Table with', mydata.records.length, 'records');
                
                // Build WHERE clause from query
                let whereClause = '';
                if (queryObj.method === 'advanced' && queryObj.sql) {
                    // Convert query conditions to WHERE clause
                    // Format: "field operator value" or "field IN (val1, val2, ...)" -> WHERE "field" operator value
                    const conditions = queryObj.sql.split(' and ').map(cond => {
                        const trimmedCond = cond.trim();
                        
                        // Check for IN clause: "field IN (val1,val2,...)" (standard SQL syntax with parentheses)
                        // Also support old syntax: "field IN "val1,val2,..."" for backward compatibility
                        const inMatchParens = trimmedCond.match(/^(\w+)\s+IN\s+\((.+)\)$/i);
                        if (inMatchParens) {
                            const [, field, valuesStr] = inMatchParens;
                            return `"${field}" IN (${valuesStr})`;
                        }
                        const inMatchQuotes = trimmedCond.match(/^(\w+)\s+IN\s+"(.+)"$/i);
                        if (inMatchQuotes) {
                            const [, field, valuesStr] = inMatchQuotes;
                            // Convert old syntax to new syntax with parentheses
                            return `"${field}" IN (${valuesStr})`;
                        }
                        
                        // Parse regular condition like "name == Italy" or "population > 1000000" or "Year == 2000"
                        const match = trimmedCond.match(/^(\w+)\s*(==|!=|>|<|>=|<=|like)\s*(.+)$/i);
                        if (match) {
                            const [, field, operator, value] = match;
                            // Convert == to =, like to LIKE
                            const sqlOp = operator === '==' ? '=' : (operator.toLowerCase() === 'like' ? 'LIKE' : operator);
                            // Determine if value is numeric (handle both string and number)
                            const trimmedValue = String(value).trim();
                            const isNumeric = !isNaN(trimmedValue) && !isNaN(parseFloat(trimmedValue)) && isFinite(trimmedValue);
                            // Quote value if not numeric
                            const sqlValue = isNumeric ? trimmedValue : `"${trimmedValue}"`;
                            return `"${field}" ${sqlOp} ${sqlValue}`;
                        }
                        return cond;
                    });
                    whereClause = `WHERE ${conditions.join(' AND ')}`;
                } else if (queryObj.method === 'simple' && queryObj.sql && queryObj.sql !== '*') {
                    // Simple text search - search in all fields
                    const searchTerm = queryObj.sql;
                    // Extract field names - handle both string arrays and object arrays
                    const fieldNames = mydata.fields.map(field => {
                        // If field is an object, extract the id/name property, otherwise use as string
                        return typeof field === 'object' && field !== null ? (field.id || field.name || String(field)) : String(field);
                    });
                    const fieldConditions = fieldNames.map(fieldName => `"${fieldName}" LIKE "%${searchTerm}%"`).join(' OR ');
                    whereClause = `WHERE ${fieldConditions}`;
                }
                
                console.log('🔍 Applying filter:', whereClause);
                
                // Apply filter to data
                let filteredData = mydata;
                if (whereClause) {
                    filteredData = mydata.select(whereClause);
                    console.log('✅ Filtered to', filteredData.records.length, 'records');
                }
                
                // Map filtered data back to map items using objTheme.indexA and itemA
                // Strategy: Create a Set of filtered record indices by comparing field values
                // Since Data.Table.select() creates new objects, we compare by field values
                const results = [];
                const filteredIndices = new Set();
                
                // Create a lookup: for each filtered record, find its index in original data
                // Compare records by their field values (more reliable than JSON.stringify)
                filteredData.records.forEach((filteredRecord) => {
                    // Find matching record in original data by comparing all field values
                    for (let i = 0; i < mydata.records.length; i++) {
                        const originalRecord = mydata.records[i];
                        // Compare records field by field
                        let matches = true;
                        for (let j = 0; j < mydata.fields.length; j++) {
                            if (originalRecord[j] !== filteredRecord[j]) {
                                matches = false;
                                break;
                            }
                        }
                        if (matches) {
                            filteredIndices.add(i);
                            break; // Found match, move to next filtered record
                        }
                    }
                });
                
                console.log('🔍 Filtered indices:', filteredIndices.size, 'out of', mydata.records.length);
                if (filteredIndices.size > 0) {
                    console.log('🔍 Sample filtered indices:', Array.from(filteredIndices).slice(0, 5));
                }
                
                // Find map items that correspond to filtered data
                if (objTheme.indexA && objTheme.indexA.length > 0) {
                    console.log('🔍 Checking', objTheme.indexA.length, 'map items');
                    let checkedItems = 0;
                    let matchedItems = 0;
                    
                    objTheme.indexA.forEach((itemId) => {
                        const item = objTheme.itemA[itemId];
                        if (item) {
                            checkedItems++;
                            // Check if this item's data matches
                            if (item.dbIndex !== undefined && item.dbIndex !== null) {
                                if (filteredIndices.has(item.dbIndex)) {
                                    matchedItems++;
                                    results.push({
                                        node: null, // Will be found by map item ID
                                        id: itemId,
                                        theme: themeId,
                                        dbIndex: item.dbIndex,
                                        data: mydata.records[item.dbIndex],
                                        itemA: mydata.records[item.dbIndex] // Add itemA for compatibility
                                    });
                                }
                            }
                            // Check array of indices
                            if (item.dbIndexA && Array.isArray(item.dbIndexA)) {
                                item.dbIndexA.forEach(dbIdx => {
                                    if (dbIdx !== undefined && dbIdx !== null && filteredIndices.has(dbIdx)) {
                                        // Avoid duplicates
                                        if (!results.find(r => r.id === itemId && r.dbIndex === dbIdx)) {
                                            matchedItems++;
                                            results.push({
                                                node: null,
                                                id: itemId,
                                                theme: themeId,
                                                dbIndex: dbIdx,
                                                data: mydata.records[dbIdx],
                                                itemA: mydata.records[dbIdx] // Add itemA for compatibility
                                            });
                                        }
                                    }
                                });
                            }
                        }
                    });
                    console.log('🔍 Checked', checkedItems, 'items, matched', matchedItems);
                } else {
                    console.warn('⚠️ objTheme.indexA is not available or empty');
                    console.log('🔍 objTheme structure:', {
                        hasIndexA: !!objTheme.indexA,
                        indexALength: objTheme.indexA ? objTheme.indexA.length : 0,
                        hasItemA: !!objTheme.itemA,
                        itemAKeys: objTheme.itemA ? Object.keys(objTheme.itemA).length : 0
                    });
                }
                
                console.log('✅ Data query returned', results.length, 'matching items');
                
                // Store whereClause in results for visualization
                // Don't apply filter directly here - let visualizeDataQueryResults handle it
                // by cloning the theme
                
                // Return results with metadata
                results._queryMetadata = {
                    whereClause: whereClause,
                    themeId: themeId
                };
                
                return results;
            } catch (e) {
                console.error('❌ Data query execution error:', e);
                console.error('Error stack:', e.stack);
                throw new Error('Data query execution failed: ' + e.message);
            }
        },
        
        /**
         * Format query results into natural language response
         * @param {Array} results - Query results
         * @param {String} originalQuery - Original user query
         * @param {Object} queryInfo - Query information (parsed query, conditions, etc.)
         * @returns {Object} Formatted response
         */
        /**
         * Format a single result row (reusable function)
         * @param {Object} result - Result object with itemA array
         * @param {number} index - Index of the result (0-based, will be displayed as index+1)
         * @param {Object} fieldInfo - Object with titleFieldIndex, valueFieldIndex, sortFieldIndex, titleField, valueField, sortField, fieldNames
         * @returns {string} Formatted result row string
         */
        /**
         * Check if a field is a geographic position/coordinate field
         * @param {number} fieldIdx - Field index
         * @param {string} fieldName - Field name
         * @param {*} value - Field value
         * @returns {boolean} - True if field appears to be a geographic position
         */
        isGeoPositionField: function(fieldIdx, fieldName, value) {
            if (!fieldName) return false;
            
            const fieldNameLower = String(fieldName).toLowerCase();
            const geoKeywords = ['geometry', 'coord', 'latitude', 'longitude', 'lat', 'lon', 'lng', 'position', 'point', 'location', 'wkt', 'geojson'];
            
            // Check if field name contains geographic keywords
            if (geoKeywords.some(keyword => fieldNameLower.includes(keyword))) {
                return true;
            }
            
            // Check if value looks like coordinates (e.g., "(45.47, 9.19)" or "POINT(...)")
            if (value !== null && value !== undefined) {
                const valueStr = String(value);
                // Pattern for coordinates like "(45.47412787406752, 9.19728432348191)"
                if (/^\([\d\.\-\s]+,\s*[\d\.\-\s]+\)$/.test(valueStr.trim())) {
                    return true;
                }
                // Pattern for WKT like "POINT(...)"
                if (/^(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON)\s*\(/i.test(valueStr)) {
                    return true;
                }
            }
            
            return false;
        },
        
        formatResultRow: function(result, index, fieldInfo, fieldOrderOverride) {
            // Use result.data (full record) if available, otherwise fall back to result.itemA
            // result.data contains the full record array with all fields in schema order
            const info = result.data || result.itemA || [];
            const { titleFieldIndex, valueFieldIndex, sortFieldIndex, titleField, valueField, sortField, fieldNames, queryFieldIndex, queryField2Index, queryField3Index, mostSignificantFieldIndex, fieldOrder: storedFieldOrder } = fieldInfo || {};
            
            // Use fieldOrderOverride if provided (from formatResults), otherwise use stored fieldOrder, otherwise determine order
            let fieldOrder = fieldOrderOverride || storedFieldOrder;
            if (!fieldOrder) {
                // Determine which fields to show and in what order
                const fieldsToShow = new Set();
                fieldOrder = [];
                
                // Helper function to check if field should be excluded (geo positions)
                const shouldExcludeField = (fieldIdx) => {
                    if (fieldIdx < 0 || fieldIdx >= info.length) return true;
                    const fieldName = fieldNames && fieldNames[fieldIdx] ? fieldNames[fieldIdx] : '';
                    const value = info[fieldIdx];
                    return this.isGeoPositionField(fieldIdx, fieldName, value);
                };
                
                // 1. First: query field (first condition)
                // This is the most important field - the one the user queried on
                if (queryFieldIndex >= 0 && queryFieldIndex < info.length && !shouldExcludeField(queryFieldIndex)) {
                    fieldsToShow.add(queryFieldIndex);
                    fieldOrder.push(queryFieldIndex);
                }
                
                // 2. Second: second query field (second condition with AND)
                if (queryField2Index >= 0 && queryField2Index < info.length && 
                    !fieldsToShow.has(queryField2Index) && !shouldExcludeField(queryField2Index)) {
                    fieldsToShow.add(queryField2Index);
                    fieldOrder.push(queryField2Index);
                }
                
                // 3. Third: third query field (third condition with AND)
                if (queryField3Index >= 0 && queryField3Index < info.length && 
                    !fieldsToShow.has(queryField3Index) && !shouldExcludeField(queryField3Index)) {
                    fieldsToShow.add(queryField3Index);
                    fieldOrder.push(queryField3Index);
                }
                
                // 4. Then: most significant text field (if available and not already shown)
                if (mostSignificantFieldIndex >= 0 && mostSignificantFieldIndex < info.length && 
                    !fieldsToShow.has(mostSignificantFieldIndex) && !shouldExcludeField(mostSignificantFieldIndex)) {
                    fieldsToShow.add(mostSignificantFieldIndex);
                    fieldOrder.push(mostSignificantFieldIndex);
                }
                
                // 5. Then: value field (if available and not already shown)
                if (valueFieldIndex >= 0 && valueFieldIndex < info.length && 
                    !fieldsToShow.has(valueFieldIndex) && !shouldExcludeField(valueFieldIndex)) {
                    fieldsToShow.add(valueFieldIndex);
                    fieldOrder.push(valueFieldIndex);
                }
                
                // 4. Finally: add other fields up to max 5 total (excluding query, most significant, and value fields)
                // Skip the first field (index 0) if it's an ID field and not the query field
                const maxFields = 5;
                for (let i = 0; i < info.length && fieldOrder.length < maxFields; i++) {
                    // Skip if already shown or is a geo position
                    if (!fieldsToShow.has(i) && !shouldExcludeField(i)) {
                        // Skip index 0 (ID field) if it's not the query field and we already have query field
                        if (i === 0 && queryFieldIndex >= 0 && queryFieldIndex !== 0) {
                            continue; // Skip ID field if we have a query field
                        }
                        // Skip title field if it's not the query field
                        if (i === titleFieldIndex && queryFieldIndex !== titleFieldIndex && queryFieldIndex >= 0) {
                            continue; // Skip title field if it's not the query field
                        }
                        fieldsToShow.add(i);
                        fieldOrder.push(i);
                    }
                }
            }
            
            // Build HTML table row
            let rowHtml = '<tr>';
            for (const fieldIdx of fieldOrder) {
                // Ensure fieldIdx is valid and within bounds
                if (fieldIdx >= 0 && fieldIdx < info.length) {
                    const value = info[fieldIdx];
                    let displayValue = '';
                    
                    // Check if value exists and is not empty
                    if (value !== undefined && value !== null && value !== '') {
                        const numValue = parseFloat(value);
                        const fieldName = fieldNames && fieldNames[fieldIdx] ? fieldNames[fieldIdx] : '';
                        
                        // Check if this is a year (4-digit number between 1000-3000, or field name contains "year")
                        const isYear = (!isNaN(numValue) && numValue >= 1000 && numValue <= 3000 && numValue % 1 === 0 && String(numValue).length === 4) ||
                                      (fieldName && fieldName.toLowerCase().includes('year'));
                        
                        if (!isNaN(numValue) && !isYear) {
                            // Format numeric values with thousand separators (but not years)
                            displayValue = numValue.toLocaleString();
                        } else {
                            // Don't format years or non-numeric values
                            displayValue = String(value);
                        }
                    }
                    
                    rowHtml += `<td style="padding: 0; border: none;">${displayValue}</td>`;
                } else {
                    rowHtml += `<td style="padding: 0; border: none;"></td>`;
                }
            }
            rowHtml += '</tr>';
            
            return rowHtml;
        },
        
        formatResults: function(results, originalQuery, queryInfo) {
            const count = results.length;
            
            let response = '';
            if (count === 0) {
                // Try to reinterpret the query in alternative ways
                const queryLower = (originalQuery || '').toLowerCase();
                
                // Check if query might be asking for fields/data information
                if (queryLower.includes('all fields') || 
                    queryLower.includes('show fields') || 
                    queryLower.includes('what fields') ||
                    queryLower.includes('available fields') ||
                    queryLower.includes('list fields') ||
                    queryLower.includes('show me fields')) {
                    // This looks like a request for field information, not a filter query
                    response = "It looks like you're asking about available fields. Try asking: \"what data is available?\" or \"show available themes\" to see all data fields.";
                } else if (queryLower.includes('show me') && (queryLower.includes('all') || queryLower.includes('every'))) {
                    // "show me all X" might be misinterpreted - suggest alternatives
                    response = "I couldn't find any features matching your query. Did you mean:\n- \"show me all features\" (to display all data on the map)\n- \"what data is available?\" (to see available fields)\n- \"show available themes\" (to see all themes)";
                } else {
                    response = "I couldn't find any features matching your query. Try:\n- \"show me all features\" (to display all data)\n- \"what data is available?\" (to see available fields)\n- Or refine your search criteria.";
                }
            } else if (count === 1) {
                response = `I found 1 feature matching your query.`;
            } else {
                response = `I found ${count} features matching your query.`;
            }
            
            // Sort results by data if available
            let sortedResults = [...results];
            let sortField = null;
            let sortFieldIndex = -1;
            let sortDescending = false;
            
            if (count > 0) {
                // Try to determine sort field from query conditions
                if (queryInfo && queryInfo.parsed && queryInfo.parsed.conditions) {
                    // Look for numeric conditions (>, <, >=, <=) to determine sort field
                    const numericConditions = queryInfo.parsed.conditions.filter(c => 
                        c.operator && (c.operator === '>' || c.operator === '<' || c.operator === '>=' || c.operator === '<='));
                    
                    if (numericConditions.length > 0) {
                        sortField = numericConditions[0].field;
                        // If operator is '>', sort descending (highest first), otherwise ascending
                        sortDescending = numericConditions[0].operator === '>' || numericConditions[0].operator === '>=';
                    }
                }
                
                // Sort results
                if (sortField && queryInfo && queryInfo.schema) {
                    // Sort by the specified field value - find field index in schema
                    const schema = queryInfo.schema;
                    // Handle both string arrays and object arrays
                    sortFieldIndex = schema.fields ? schema.fields.findIndex(f => {
                        const fieldName = typeof f === 'string' ? f : (f.id || f.name || f.field || String(f));
                        return fieldName.toLowerCase() === sortField.toLowerCase() || fieldName === sortField;
                    }) : -1;
                    
                    if (sortFieldIndex >= 0) {
                        // Sort by the field at the specified index
                        sortedResults.sort((a, b) => {
                            const infoA = a.itemA || [];
                            const infoB = b.itemA || [];
                            
                            const valueA = infoA[sortFieldIndex];
                            const valueB = infoB[sortFieldIndex];
                            
                            // Try numeric comparison first
                            const numA = parseFloat(valueA);
                            const numB = parseFloat(valueB);
                            
                            if (!isNaN(numA) && !isNaN(numB)) {
                                return sortDescending ? numB - numA : numA - numB;
                            }
                            
                            // Fallback to string comparison
                            const strA = (valueA || '').toString().toLowerCase();
                            const strB = (valueB || '').toString().toLowerCase();
                            return sortDescending ? strB.localeCompare(strA) : strA.localeCompare(strB);
                        });
                    } else {
                        // Field not found in schema, try to find numeric values
                        sortedResults.sort((a, b) => {
                            const infoA = a.itemA || [];
                            const infoB = b.itemA || [];
                            
                            // Find first numeric value
                            let valueA = null;
                            let valueB = null;
                            
                            for (let i = 0; i < infoA.length; i++) {
                                const val = parseFloat(infoA[i]);
                                if (!isNaN(val)) {
                                    valueA = val;
                                    break;
                                }
                            }
                            for (let i = 0; i < infoB.length; i++) {
                                const val = parseFloat(infoB[i]);
                                if (!isNaN(val)) {
                                    valueB = val;
                                    break;
                                }
                            }
                            
                            if (valueA !== null && valueB !== null) {
                                return sortDescending ? valueB - valueA : valueA - valueB;
                            }
                            
                            // Fallback to string comparison
                            const strA = (infoA[0] || a.item || '').toString();
                            const strB = (infoB[0] || b.item || '').toString();
                            return sortDescending ? strB.localeCompare(strA) : strA.localeCompare(strB);
                        });
                    }
                } else {
                    // Default: sort alphabetically by name
                    sortedResults.sort((a, b) => {
                        const infoA = a.itemA || [];
                        const infoB = b.itemA || [];
                        const nameA = (infoA[0] || a.item || a.feature || '').toString().toLowerCase();
                        const nameB = (infoB[0] || b.item || b.feature || '').toString().toLowerCase();
                        return nameA.localeCompare(nameB);
                    });
                }
            }
            
            // Get title field from schema if available
            let titleField = null;
            let titleFieldIndex = -1;
            if (queryInfo && queryInfo.schema) {
                const schema = queryInfo.schema;
                const map = this.getMap();
                
                // Try to get title field from theme definition
                if (map && map.Api) {
                    // Try getMapThemeDefinitionObj first (more reliable)
                    if (map.Api.getMapThemeDefinitionObj) {
                        try {
                            const themeDef = map.Api.getMapThemeDefinitionObj(schema.theme);
                            if (themeDef && themeDef.style && themeDef.style.titlefield) {
                                titleField = themeDef.style.titlefield;
                            }
                        } catch (e) {
                            // Continue to fallback
                        }
                    }
                    
                    // Fallback: try getThemeDefinitionObj
                    if (!titleField && map.Api.getThemeDefinitionObj) {
                        try {
                            const themeDef = map.Api.getThemeDefinitionObj(schema.theme);
                            if (themeDef && themeDef.style && themeDef.style.titlefield) {
                                titleField = themeDef.style.titlefield;
                            }
                        } catch (e) {
                            // Continue to fallback
                        }
                    }
                }
                
                // Fallback: check objTheme.theme.szTitleField
                if (!titleField && schema.objTheme && schema.objTheme.objTheme && schema.objTheme.objTheme.theme && schema.objTheme.objTheme.theme.szTitleField) {
                    titleField = schema.objTheme.objTheme.theme.szTitleField;
                }
                
                // Find index of title field in schema.fields
                // Handle both string arrays and object arrays (same as showMoreResults)
                if (titleField && schema.fields) {
                    titleFieldIndex = schema.fields.findIndex(f => {
                        const fieldName = typeof f === 'string' ? f : (f.id || f.name || f.field || String(f));
                        return fieldName.toLowerCase() === titleField.toLowerCase() || fieldName === titleField;
                    });
                }
            }
            
            // Get value field from schema if available (same logic as getBindingInfo)
            let valueField = null;
            let valueFieldIndex = -1;
            if (queryInfo && queryInfo.schema) {
                const schema = queryInfo.schema;
                const map = this.getMap();
                
                // Try to get value field from theme definition (matching getBindingInfo logic exactly)
                if (map && map.Api) {
                    // Try getMapThemeDefinitionObj first (more reliable)
                    if (map.Api.getMapThemeDefinitionObj) {
                        try {
                            const themeDef = map.Api.getMapThemeDefinitionObj(schema.theme);
                            if (themeDef) {
                                // Check new binding object structure first (same as getBindingInfo)
                                if (themeDef.binding && themeDef.binding.value) {
                                    valueField = themeDef.binding.value;
                                }
                                // Check root level (same as getBindingInfo)
                                if (!valueField && themeDef.valuefield) {
                                    valueField = themeDef.valuefield;
                                }
                                // Check old style structure (same as getBindingInfo)
                                if (!valueField && themeDef.style && themeDef.style.valuefield) {
                                    valueField = themeDef.style.valuefield;
                                }
                                // Also check binding.field as fallback (getBindingInfo uses both value and field)
                                if (!valueField && themeDef.binding && themeDef.binding.field) {
                                    valueField = themeDef.binding.field;
                                }
                                if (!valueField && themeDef.field) {
                                    valueField = themeDef.field;
                                }
                            }
                        } catch (e) {
                            // Continue to fallback
                        }
                    }
                    
                    // Fallback: try getThemeDefinitionObj
                    if (!valueField && map.Api.getThemeDefinitionObj) {
                        try {
                            const themeDef = map.Api.getThemeDefinitionObj(schema.theme);
                            if (themeDef) {
                                // Check new binding object structure first
                                if (themeDef.binding && themeDef.binding.value) {
                                    valueField = themeDef.binding.value;
                                }
                                // Check root level
                                if (!valueField && themeDef.valuefield) {
                                    valueField = themeDef.valuefield;
                                }
                                // Check old style structure
                                if (!valueField && themeDef.style && themeDef.style.valuefield) {
                                    valueField = themeDef.style.valuefield;
                                }
                                // Also check binding.field as fallback
                                if (!valueField && themeDef.binding && themeDef.binding.field) {
                                    valueField = themeDef.binding.field;
                                }
                                if (!valueField && themeDef.field) {
                                    valueField = themeDef.field;
                                }
                            }
                        } catch (e) {
                            // Continue to fallback
                        }
                    }
                }
                
                // Fallback: check objTheme.theme.szValueField (same as getBindingInfo)
                if (!valueField && schema.objTheme && schema.objTheme.objTheme && schema.objTheme.objTheme.theme) {
                    const theme = schema.objTheme.objTheme.theme;
                    if (theme.szValueField) {
                        valueField = theme.szValueField;
                    }
                }
                
                // Find index of value field in schema.fields
                // Handle both string arrays and object arrays (same as showMoreResults)
                if (valueField && schema.fields) {
                    valueFieldIndex = schema.fields.findIndex(f => {
                        const fieldName = typeof f === 'string' ? f : (f.id || f.name || f.field || String(f));
                        return fieldName.toLowerCase() === valueField.toLowerCase() || fieldName === valueField;
                    });
                }
            }
            
            // Get field names from schema for displaying in results
            let fieldNames = [];
            if (queryInfo && queryInfo.schema && queryInfo.schema.fields) {
                const schema = queryInfo.schema;
                fieldNames = schema.fields.map(f => {
                    return typeof f === 'string' ? f : (f.id || f.name || f.field || String(f));
                });
            }
            
            // Determine query fields (fields used in filter conditions - support multiple AND conditions)
            let queryFieldIndex = -1;
            let queryField = null;
            let queryField2Index = -1;
            let queryField2 = null;
            let queryField3Index = -1;
            let queryField3 = null;
            
            if (queryInfo && queryInfo.parsed && queryInfo.parsed.conditions && queryInfo.parsed.conditions.length > 0) {
                // Get the first field used in conditions
                queryField = queryInfo.parsed.conditions[0].field;
                if (queryField && queryInfo.schema && queryInfo.schema.fields) {
                    queryFieldIndex = queryInfo.schema.fields.findIndex(f => {
                        const fieldName = typeof f === 'string' ? f : (f.id || f.name || f.field || String(f));
                        return fieldName.toLowerCase() === queryField.toLowerCase() || fieldName === queryField;
                    });
                }
                
                // Get second field from conditions (if available)
                if (queryInfo.parsed.conditions.length > 1) {
                    queryField2 = queryInfo.parsed.conditions[1].field;
                    if (queryField2 && queryInfo.schema && queryInfo.schema.fields) {
                        queryField2Index = queryInfo.schema.fields.findIndex(f => {
                            const fieldName = typeof f === 'string' ? f : (f.id || f.name || f.field || String(f));
                            return fieldName.toLowerCase() === queryField2.toLowerCase() || fieldName === queryField2;
                        });
                    }
                }
                
                // Get third field from conditions (if available)
                if (queryInfo.parsed.conditions.length > 2) {
                    queryField3 = queryInfo.parsed.conditions[2].field;
                    if (queryField3 && queryInfo.schema && queryInfo.schema.fields) {
                        queryField3Index = queryInfo.schema.fields.findIndex(f => {
                            const fieldName = typeof f === 'string' ? f : (f.id || f.name || f.field || String(f));
                            return fieldName.toLowerCase() === queryField3.toLowerCase() || fieldName === queryField3;
                        });
                    }
                }
            }
            
            // Find most significant text field (field with most unique values)
            let mostSignificantFieldIndex = -1;
            if (count > 0 && queryInfo && queryInfo.schema && queryInfo.schema.fields && sortedResults.length > 0) {
                const fieldUniqueCounts = {};
                const schema = queryInfo.schema;
                
                // Count unique values for each text field
                schema.fields.forEach((field, fieldIdx) => {
                    const fieldName = typeof field === 'string' ? field : (field.id || field.name || field.field || String(field));
                    const uniqueValues = new Set();
                    
                    // Check first 100 results to determine if field is text-based
                    const sampleSize = Math.min(100, sortedResults.length);
                    let isTextField = false;
                    
                    for (let i = 0; i < sampleSize; i++) {
                        const result = sortedResults[i];
                        // Use result.data (full record) if available, otherwise fall back to result.itemA
                        const info = result.data || result.itemA || [];
                        if (fieldIdx < info.length && info[fieldIdx] !== undefined && info[fieldIdx] !== null) {
                            const value = String(info[fieldIdx]);
                            // Check if it's not a pure number (text field)
                            const numValue = parseFloat(value);
                            if (isNaN(numValue) || value !== String(numValue)) {
                                isTextField = true;
                                uniqueValues.add(value);
                            }
                        }
                    }
                    
                    // Only consider text fields with multiple unique values
                    if (isTextField && uniqueValues.size > 1 && fieldIdx !== queryFieldIndex && fieldIdx !== titleFieldIndex) {
                        fieldUniqueCounts[fieldIdx] = uniqueValues.size;
                    }
                });
                
                // Find field with most unique values
                let maxUnique = 0;
                for (const [fieldIdx, uniqueCount] of Object.entries(fieldUniqueCounts)) {
                    if (uniqueCount > maxUnique) {
                        maxUnique = uniqueCount;
                        mostSignificantFieldIndex = parseInt(fieldIdx);
                    }
                }
            }
            
            // Add summary of first few results
            if (count > 0) {
                const maxResults = Math.min(5, count);
                response += '\n\nResults:\n';
                // Prepare field info object for formatResultRow
                const fieldInfo = {
                    titleFieldIndex,
                    valueFieldIndex,
                    sortFieldIndex,
                    titleField,
                    valueField,
                    sortField,
                    fieldNames,
                    queryFieldIndex,
                    queryField,
                    queryField2Index,
                    queryField2,
                    queryField3Index,
                    queryField3,
                    mostSignificantFieldIndex
                };
                
                // Build HTML table with headers
                let tableHtml = '<table style="border: none; border-collapse: collapse; width: 100%;">';
                
                // Get field indices that will be displayed (from first result to determine structure)
                const firstResult = sortedResults[0];
                const firstInfo = firstResult.data || firstResult.itemA || [];
                const fieldsToShow = new Set();
                const fieldOrder = [];
                
                // Determine which fields to show (same logic as formatResultRow)
                // Helper function to check if field should be excluded (geo positions)
                const shouldExcludeField = (fieldIdx) => {
                    if (fieldIdx < 0 || fieldIdx >= firstInfo.length) return true;
                    const fieldName = fieldNames && fieldNames[fieldIdx] ? fieldNames[fieldIdx] : '';
                    const value = firstInfo[fieldIdx];
                    return this.isGeoPositionField(fieldIdx, fieldName, value);
                };
                
                // 1. First: query field (first condition)
                if (queryFieldIndex >= 0 && queryFieldIndex < firstInfo.length && !shouldExcludeField(queryFieldIndex)) {
                    fieldsToShow.add(queryFieldIndex);
                    fieldOrder.push(queryFieldIndex);
                }
                
                // 2. Second: second query field (second condition with AND)
                if (queryField2Index >= 0 && queryField2Index < firstInfo.length && 
                    !fieldsToShow.has(queryField2Index) && !shouldExcludeField(queryField2Index)) {
                    fieldsToShow.add(queryField2Index);
                    fieldOrder.push(queryField2Index);
                }
                
                // 3. Third: third query field (third condition with AND)
                if (queryField3Index >= 0 && queryField3Index < firstInfo.length && 
                    !fieldsToShow.has(queryField3Index) && !shouldExcludeField(queryField3Index)) {
                    fieldsToShow.add(queryField3Index);
                    fieldOrder.push(queryField3Index);
                }
                
                // 4. Then: most significant text field (if available and not already shown)
                if (mostSignificantFieldIndex >= 0 && mostSignificantFieldIndex < firstInfo.length && 
                    !fieldsToShow.has(mostSignificantFieldIndex) && !shouldExcludeField(mostSignificantFieldIndex)) {
                    fieldsToShow.add(mostSignificantFieldIndex);
                    fieldOrder.push(mostSignificantFieldIndex);
                }
                
                // 5. Then: value field (if available and not already shown)
                if (valueFieldIndex >= 0 && valueFieldIndex < firstInfo.length && 
                    !fieldsToShow.has(valueFieldIndex) && !shouldExcludeField(valueFieldIndex)) {
                    fieldsToShow.add(valueFieldIndex);
                    fieldOrder.push(valueFieldIndex);
                }
                const maxFields = 5;
                for (let i = 0; i < firstInfo.length && fieldOrder.length < maxFields; i++) {
                    if (!fieldsToShow.has(i) && !shouldExcludeField(i)) {
                        if (i === 0 && queryFieldIndex >= 0 && queryFieldIndex !== 0) {
                            continue;
                        }
                        if (i === titleFieldIndex && queryFieldIndex !== titleFieldIndex && queryFieldIndex >= 0) {
                            continue;
                        }
                        fieldsToShow.add(i);
                        fieldOrder.push(i);
                    }
                }
                
                // Create table header row
                tableHtml += '<tr>';
                fieldOrder.forEach(fieldIdx => {
                    const fieldName = fieldNames && fieldNames[fieldIdx] ? fieldNames[fieldIdx] : `Field ${fieldIdx + 1}`;
                    tableHtml += `<th style="padding: 0; text-align: left; border: none; font-weight: 600;">${fieldName}</th>`;
                });
                tableHtml += '</tr>';
                
                // Add data rows
                sortedResults.slice(0, maxResults).forEach((result, idx) => {
                    tableHtml += this.formatResultRow(result, idx, fieldInfo, fieldOrder);
                });
                
                tableHtml += '</table>';
                response += tableHtml;
                
                if (count > 5) {
                    const remaining = count - 5;
                    // Add a button to show more results (will be handled by the chat interface)
                    const buttonHtml = `<button class="show-more-results-btn" data-query-id="${Date.now()}" data-shown="5" data-total="${count}">Show ${remaining} more result${remaining !== 1 ? 's' : ''}</button>`;
                    response += `\n\n${buttonHtml}`;
                }
            }
            
            // Calculate fieldOrder for reuse (from first result if available)
            let calculatedFieldOrder = null;
            if (count > 0 && sortedResults.length > 0) {
                const firstResult = sortedResults[0];
                const firstInfo = firstResult.data || firstResult.itemA || [];
                const fieldsToShow = new Set();
                calculatedFieldOrder = [];
                
                // Helper function to check if field should be excluded (geo positions)
                const shouldExcludeField = (fieldIdx) => {
                    if (fieldIdx < 0 || fieldIdx >= firstInfo.length) return true;
                    const fieldName = fieldNames && fieldNames[fieldIdx] ? fieldNames[fieldIdx] : '';
                    const value = firstInfo[fieldIdx];
                    return this.isGeoPositionField(fieldIdx, fieldName, value);
                };
                
                // 1. First: query field (first condition)
                if (queryFieldIndex >= 0 && queryFieldIndex < firstInfo.length && !shouldExcludeField(queryFieldIndex)) {
                    fieldsToShow.add(queryFieldIndex);
                    calculatedFieldOrder.push(queryFieldIndex);
                }
                
                // 2. Second: second query field (second condition with AND)
                if (queryField2Index >= 0 && queryField2Index < firstInfo.length && 
                    !fieldsToShow.has(queryField2Index) && !shouldExcludeField(queryField2Index)) {
                    fieldsToShow.add(queryField2Index);
                    calculatedFieldOrder.push(queryField2Index);
                }
                
                // 3. Third: third query field (third condition with AND)
                if (queryField3Index >= 0 && queryField3Index < firstInfo.length && 
                    !fieldsToShow.has(queryField3Index) && !shouldExcludeField(queryField3Index)) {
                    fieldsToShow.add(queryField3Index);
                    calculatedFieldOrder.push(queryField3Index);
                }
                
                // 4. Then: most significant text field (if available and not already shown)
                if (mostSignificantFieldIndex >= 0 && mostSignificantFieldIndex < firstInfo.length && 
                    !fieldsToShow.has(mostSignificantFieldIndex) && !shouldExcludeField(mostSignificantFieldIndex)) {
                    fieldsToShow.add(mostSignificantFieldIndex);
                    calculatedFieldOrder.push(mostSignificantFieldIndex);
                }
                
                // 5. Then: value field (if available and not already shown)
                if (valueFieldIndex >= 0 && valueFieldIndex < firstInfo.length && 
                    !fieldsToShow.has(valueFieldIndex) && !shouldExcludeField(valueFieldIndex)) {
                    fieldsToShow.add(valueFieldIndex);
                    calculatedFieldOrder.push(valueFieldIndex);
                }
                const maxFields = 5;
                for (let i = 0; i < firstInfo.length && calculatedFieldOrder.length < maxFields; i++) {
                    if (!fieldsToShow.has(i) && !shouldExcludeField(i)) {
                        if (i === 0 && queryFieldIndex >= 0 && queryFieldIndex !== 0) {
                            continue;
                        }
                        if (i === titleFieldIndex && queryFieldIndex !== titleFieldIndex && queryFieldIndex >= 0) {
                            continue;
                        }
                        fieldsToShow.add(i);
                        calculatedFieldOrder.push(i);
                    }
                }
            }
            
            // Prepare field info object for reuse in showMoreResults
            const fieldInfo = {
                titleFieldIndex,
                valueFieldIndex,
                sortFieldIndex,
                titleField,
                valueField,
                sortField,
                fieldNames,
                queryFieldIndex,
                queryField,
                queryField2Index,
                queryField2,
                queryField3Index,
                queryField3,
                mostSignificantFieldIndex,
                fieldOrder: calculatedFieldOrder // Store fieldOrder for consistency
            };
            
            return {
                response: response,
                count: count,
                items: sortedResults, // Return all sorted results
                hasMore: count > 5,
                shownCount: Math.min(5, count),
                fieldInfo: fieldInfo // Include field info for showMoreResults
            };
        },
        
        /**
         * Visualize query results on the map
         * @param {Array} results - Query results
         * @param {Object} options - Visualization options
         * @param {Object} queryInfo - Query information (theme, whereClause, etc.)
         */
        visualizeResults: function(results, options, queryInfo) {
            options = options || {};
            queryInfo = queryInfo || {};
            const map = this.getMap();
            
            if (!map || !results || results.length === 0) {
                return;
            }
            
            // Check if query contains "goto", "go to", or "focus on" - these should always zoom to results
            const originalQuery = queryInfo.originalQuery || queryInfo.parsed?.originalQuery || queryInfo.query?.originalQuery || '';
            const hasGotoOrFocus = queryInfo.hasGotoOrFocus || /(?:goto|go\s+to|focus\s+on)/i.test(originalQuery);
            
            // Override zoomToResults if "goto" or "focus on" is detected
            if (hasGotoOrFocus) {
                options.zoomToResults = true;
                console.log('🔍 [Visualize] Detected "goto" or "focus on" in query - will zoom to results');
            }
            
            try {
                // For data queries, clone theme and apply filter with red color scheme
                if (queryInfo.isDataQuery && queryInfo.theme && queryInfo.whereClause) {
                    this.visualizeDataQueryResults(results, queryInfo, hasGotoOrFocus);
                    return;
                }
                
                // Original visualization for feature queries
                // Clear previous highlights
                if (map.removeAllHighlights) {
                    map.removeAllHighlights();
                }
                
                // Highlight results
                if (options.highlight !== false && map.highLightList) {
                    results.forEach(result => {
                        if (result.node) {
                            try {
                                map.highLightList.add(result.node);
                            } catch (e) {
                                console.warn('Could not highlight node:', e);
                            }
                        }
                    });
                }
                
                // Zoom to results
                if (options.zoomToResults && results.length > 0) {
                    if (results.length === 1) {
                        // Zoom to single result
                        const itemId = this.getItemId(results[0]);
                        if (itemId) {
                            try {
                                ixmaps.zoomMapToItem(itemId);
                            } catch (e) {
                                console.warn('Could not zoom to item:', e);
                            }
                        }
                    } else if (map.Query && map.Query.gotoFoundItem) {
                        // Zoom to extent of all results
                        try {
                            map.Query.gotoFoundItem(-1, 'zoomto');
                        } catch (e) {
                            console.warn('Could not zoom to results:', e);
                        }
                    }
                }
            } catch (e) {
                console.warn('Error visualizing results:', e);
            }
        },
        
        /**
         * Visualize data query results by applying filter and color scheme to the existing theme
         * @param {Array} results - Query results
         * @param {Object} queryInfo - Query information with theme, whereClause, etc.
         */
        visualizeDataQueryResults: function(results, queryInfo, shouldZoom = false) {
            const map = this.getMap();
            if (!map) {
                console.warn('⚠️ Map not available');
                return;
            }
            
            try {
                const sourceThemeId = queryInfo.theme;
                let whereClause = queryInfo.whereClause;
                
                console.log('🎨 Applying filter to theme:', sourceThemeId);
                console.log('🔍 Filter:', whereClause);
                
                // If "goto" or "focus on" was detected, zoom to results after applying filter
                if (shouldZoom && results.length > 0) {
                    // Use setTimeout to ensure filter is applied before zooming
                    setTimeout(() => {
                        try {
                            if (results.length === 1) {
                                // Zoom to single result
                                const itemId = this.getItemId(results[0]);
                                if (itemId) {
                                    ixmaps.zoomMapToItem(itemId);
                                    console.log('✅ [Visualize] Zoomed to single result:', itemId);
                                }
                            } else if (map.Query && map.Query.gotoFoundItem) {
                                // Zoom to extent of all results
                                map.Query.gotoFoundItem(-1, 'zoomto');
                                console.log('✅ [Visualize] Zoomed to results extent');
                            }
                        } catch (e) {
                            console.warn('Could not zoom to results:', e);
                        }
                    }, 300); // Small delay to ensure filter is applied
                }
                
                // Validate inputs
                if (!sourceThemeId || typeof sourceThemeId !== 'string') {
                    console.warn('⚠️ No valid theme ID provided:', sourceThemeId);
                    return;
                }
                
                // Apply filter directly to the existing theme using ixmaps.map().changeThemeStyle
                // Following the pattern from show_facets.js:
                // ixmaps.map().changeThemeStyle(objTheme.szId, "filter:" + (szFilter || " "), "set");
                if (ixmaps && ixmaps.map) {
                    const mapApi = ixmaps.map();
                    if (!mapApi || !mapApi.changeThemeStyle) {
                        console.warn('⚠️ mapApi.changeThemeStyle not available');
                        return;
                    }
                    
                    // Prepare filter string - ensure it includes WHERE and is never null
                    let szFilter = null;
                    if (whereClause && typeof whereClause === 'string' && whereClause.trim().length > 0) {
                        // Ensure whereClause has WHERE prefix
                        let filterClause = String(whereClause).trim();
                        if (!filterClause.toUpperCase().startsWith('WHERE')) {
                            filterClause = 'WHERE ' + filterClause;
                        }
                        szFilter = filterClause;
                    }
                    
                    // Apply filter using the same pattern as show_facets.js
                    // Escape quotes in field names only when passing to changeThemeStyle()
                    if (szFilter) {
                        // Escape quotes in field names: "field" -> \"field\"
                        // Also handle unquoted field names by adding escaped quotes
                        // This is done only for the changeThemeStyle() call string
                        console.log("!!! szFilter", szFilter);
                        let escapedFilter = szFilter;
                        // First, escape existing quotes around field names: "field" -> \"field\"
                        //escapedFilter = escapedFilter.replace(/"(\w+)"/g, '\\"$1\\"');
                        // Then, add escaped quotes to unquoted field names that appear before operators
                        // Pattern: field operator -> \"field\" operator (but not if already quoted)
                        //escapedFilter = escapedFilter.replace(/(\s|^)(\w+)\s*(like|=|!=|>|<|>=|<=|BETWEEN|IN|IS)/gi, '$1\\"$2\\" $3');
                        // Use double quotes for filter parameter: "filter:WHERE \"field\" > value"
                        const filterStyle = "filter:" + (escapedFilter || " ");
                        console.log('🔍 Applying filter style:', filterStyle, 'to theme:', sourceThemeId);
                        try {
                            mapApi.changeThemeStyle(sourceThemeId, filterStyle, "set");
                            // Store the filtered theme ID for reset functionality
                            this.currentFilteredTheme = sourceThemeId;
                            console.log('✅ Applied filter to theme:', sourceThemeId);
                        } catch (e) {
                            console.error('❌ Error applying filter:', e);
                            console.error('Parameters were:', { sourceThemeId, filterStyle, flag: "set" });
                        }
                    } else {
                        console.warn('⚠️ No valid whereClause provided, skipping filter');
                    }
                    /*** 
                    // Set color scheme to red (always apply, even without filter)
                    const colorStyle = 'colorscheme:red';
                    console.log('🎨 Applying color style:', colorStyle, 'to theme:', sourceThemeId);
                    try {
                        mapApi.changeThemeStyle(sourceThemeId, colorStyle, "set");
                        console.log('✅ Applied red color scheme to theme:', sourceThemeId);
                    } catch (e) {
                        console.error('❌ Error applying color scheme:', e);
                        console.error('Parameters were:', { sourceThemeId, colorStyle, flag: "set" });
                    }
                    ***/
                } else {
                    console.warn('⚠️ ixmaps.map() not available');
                }
                
            } catch (e) {
                console.error('❌ Error visualizing data query results:', e);
                console.error('Error stack:', e.stack);
            }
        },
        
        /**
         * Reset/remove the current filter from the theme
         * @returns {Boolean} True if filter was reset, false if no filter was active
         */
        resetFilter: function() {
            if (!this.currentFilteredTheme) {
                console.log('ℹ️ No active filter to reset');
                return false;
            }
            
            if (!ixmaps || !ixmaps.map) {
                console.warn('⚠️ ixmaps.map() not available');
                return false;
            }
            
            const mapApi = ixmaps.map();
            if (!mapApi || !mapApi.changeThemeStyle) {
                console.warn('⚠️ mapApi.changeThemeStyle not available');
                return false;
            }
            
            try {
                const themeId = this.currentFilteredTheme;
                // Remove filter using the same pattern as show_facets.js
                mapApi.changeThemeStyle(themeId, "filter", "remove");
                console.log('✅ Reset filter from theme:', themeId);
                this.currentFilteredTheme = null;
                return true;
            } catch (e) {
                console.error('❌ Error resetting filter:', e);
                return false;
            }
        },
        
        /**
         * Get item ID from result
         * @param {Object} result - Query result
         * @returns {String} Item ID
         */
        getItemId: function(result) {
            if (result.id) {
                return result.id;
            }
            if (result.node) {
                return result.node.getAttributeNS(null, 'id') || 
                       result.node.parentNode?.getAttributeNS(null, 'id');
            }
            return null;
        },
        
        /**
         * True when the user explicitly asked to see the external data provider / dbtableProcess JavaScript.
         * @param {String} queryText
         * @returns {Boolean}
         */
        wantsDataSourceProcessCode: function(queryText) {
            if (!queryText || typeof queryText !== 'string') {
                return false;
            }
            const q = queryText.toLowerCase();
            if (/\b(show\s+(the\s+)?process(\s+code)?|process\s+code|dbtable\s*process|dbtableprocess)\b/.test(q)) {
                return true;
            }
            if (/\b(mostra|zeige|montrez|afficher)\b/.test(q) && /\b(process|prozess|processo)\b/.test(q) && /\b(code|codice|quellcode)\b/.test(q)) {
                return true;
            }
            if (/\b(javascript|js)\b/.test(q) && /\b(show|list|display|source|code|full)\b/.test(q)) {
                return true;
            }
            if (/\b(external\s+)?(data\s+)?provider\b/.test(q) && /\b(show|list|display|code|javascript|js|source)\b/.test(q)) {
                return true;
            }
            return false;
        },
        
        /**
         * For data.type "ext", the loader calls ixmaps.&lt;name&gt;(theme, options) (see htmlgui_loadExternalData).
         * @param {String} name - Theme style dbtable (data name)
         * @returns {{ ref: string, code: string } | null}
         */
        resolveExternalExtProviderSource: function(name) {
            if (!name || typeof name !== 'string') {
                return null;
            }
            const n = name.trim();
            if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(n)) {
                return null;
            }
            const stringify = function(fn) {
                try {
                    return typeof fn.toString === 'function' ? fn.toString() : String(fn);
                } catch (e) {
                    return null;
                }
            };
            const tryFn = function(obj, refPrefix) {
                if (!obj || typeof obj[n] !== 'function') {
                    return null;
                }
                const code = stringify(obj[n]);
                return code ? { ref: refPrefix + n, code: code } : null;
            };
            const globalIx = typeof window !== 'undefined' && window.ixmaps ? window.ixmaps :
                (typeof ixmaps !== 'undefined' ? ixmaps : null);
            let r = tryFn(globalIx, 'ixmaps.');
            if (r) {
                return r;
            }
            if (globalIx && globalIx.parentApi) {
                r = tryFn(globalIx.parentApi, 'ixmaps.parentApi.');
                if (r) {
                    return r;
                }
                if (globalIx.parentApi.parentApi) {
                    r = tryFn(globalIx.parentApi.parentApi, 'ixmaps.parentApi.parentApi.');
                    if (r) {
                        return r;
                    }
                }
            }
            return null;
        },
        
        /**
         * Summarize how each theme loads data: URLs, SQL/query, dbtable descriptor, process hook.
         * @param {Array} schemas - Available schemas
         * @param {String} language - UI language code
         * @param {{ includeProcessCode?: boolean }} [options] - If includeProcessCode is false (default), dbtableProcess body is not listed (only a hint).
         * @returns {{ summary: string, themes: Array }} Markdown summary and structured rows
         */
        getDataSourcesInfo: function(schemas, language = 'en', options) {
            const opts = options && typeof options === 'object' ? options : {};
            const includeProcessCode = !!opts.includeProcessCode;
            const map = this.getMap();
            const L = {
                en: {
                    title: 'Data resources',
                    intro: 'How each theme loads its data (from the map theme definition):',
                    theme: 'Theme',
                    fmt: 'Format / type',
                    url: 'URL',
                    query: 'Query / SQL',
                    dbtable: 'Descriptor (dbtable)',
                    ext: 'Extension / external',
                    process: 'External data provider (JavaScript)',
                    processDeferred: 'Configured (`dbtableProcess`). Source code is hidden unless you ask to **show process code** or **show JavaScript**.',
                    extFn: 'External data provider function',
                    extFnMissing: 'Function not found in memory yet (script may still load). Expected:',
                    extFnMissingNoScript: 'no `ext` path in theme; JavaScript may be inlined in the HTML page.',
                    none: 'No explicit URL, query, or descriptor found in theme style.',
                    unavailable: 'Unable to access the map API to read theme definitions.',
                    truncated: '(truncated)'
                },
                de: {
                    title: 'Datenressourcen',
                    intro: 'Wie jedes Theme seine Daten lädt (aus der Theme-Definition):',
                    theme: 'Thema',
                    fmt: 'Format / Typ',
                    url: 'URL',
                    query: 'Abfrage / SQL',
                    dbtable: 'Deskriptor (dbtable)',
                    ext: 'Erweiterung / extern',
                    process: 'Externer Datenanbieter (JavaScript)',
                    processDeferred: 'Vorhanden (`dbtableProcess`). Quellcode wird nur auf Anfrage angezeigt — z. B. **Prozesscode anzeigen** oder **JavaScript anzeigen**.',
                    extFn: 'Externe Datenanbieter-Funktion',
                    extFnMissing: 'Funktion im Speicher noch nicht gefunden (Skript lädt möglicherweise noch). Erwartet:',
                    extFnMissingNoScript: 'kein ext-Pfad im Theme; JavaScript kann inline in der HTML-Seite stehen.',
                    none: 'Keine URL, Abfrage oder Deskriptor in den Theme-Styles gefunden.',
                    unavailable: 'Karten-API nicht erreichbar; Theme-Definitionen können nicht gelesen werden.',
                    truncated: '(gekürzt)'
                },
                it: {
                    title: 'Risorse dati',
                    intro: 'Come ogni tema carica i dati (dalla definizione del tema):',
                    theme: 'Tema',
                    fmt: 'Formato / tipo',
                    url: 'URL',
                    query: 'Query / SQL',
                    dbtable: 'Descrittore (dbtable)',
                    ext: 'Estensione / esterno',
                    process: 'Provider dati esterno (JavaScript)',
                    processDeferred: 'Presente (`dbtableProcess`). Il codice non è mostrato di default — chiedi **mostra codice processo** o **mostra JavaScript**.',
                    extFn: 'Funzione provider dati esterno',
                    extFnMissing: 'Funzione non ancora in memoria (lo script potrebbe caricarsi ancora). Atteso:',
                    extFnMissingNoScript: 'nessun percorso ext nel tema; il JavaScript può essere incluso nella pagina HTML.',
                    none: 'Nessun URL, query o descrittore esplicito negli stili del tema.',
                    unavailable: 'Impossibile accedere all\'API della mappa per leggere le definizioni dei temi.',
                    truncated: '(troncato)'
                },
                fr: {
                    title: 'Ressources de données',
                    intro: 'Comment chaque thème charge ses données (d’après la définition du thème) :',
                    theme: 'Thème',
                    fmt: 'Format / type',
                    url: 'URL',
                    query: 'Requête / SQL',
                    dbtable: 'Descripteur (dbtable)',
                    ext: 'Extension / externe',
                    process: 'Fournisseur de données externe (JavaScript)',
                    processDeferred: 'Défini (`dbtableProcess`). Le code source est masqué — demandez **afficher le code du processus** ou **afficher le JavaScript**.',
                    extFn: 'Fonction fournisseur de données externe',
                    extFnMissing: 'Fonction introuvable en mémoire (le script peut encore charger). Attendu :',
                    extFnMissingNoScript: 'pas de chemin ext dans le thème ; le JavaScript peut être inclus dans la page HTML.',
                    none: 'Aucune URL, requête ou descripteur explicite dans le style du thème.',
                    unavailable: 'Impossible d’accéder à l’API de la carte pour lire les définitions des thèmes.',
                    truncated: '(tronqué)'
                }
            };
            const tr = L[language] || L.en;
            
            if (!map || !map.Api) {
                return {
                    summary: '❌ ' + tr.unavailable,
                    themes: []
                };
            }
            
            const themes = [];
            const blocks = [];
            blocks.push('### ' + tr.title);
            blocks.push('');
            blocks.push(tr.intro);
            blocks.push('');
            
            (schemas || []).forEach(schema => {
                const themeId = schema.theme;
                let themeDef = null;
                try {
                    themeDef = map.Api.getMapThemeDefinitionObj(themeId);
                } catch (e) {
                    console.warn('getDataSourcesInfo: theme definition failed for', themeId, e);
                }
                const style = themeDef && themeDef.style ? themeDef.style : {};
                const row = {
                    theme: themeId,
                    themeTitle: schema.themeTitle || themeId,
                    dbtableType: style.dbtableType != null && style.dbtableType !== '' ? String(style.dbtableType) : null,
                    dbtableUrl: style.dbtableUrl != null && style.dbtableUrl !== '' ? String(style.dbtableUrl) : null,
                    dbtableQuery: style.dbtableQuery != null && style.dbtableQuery !== '' ? String(style.dbtableQuery) : null,
                    dbtable: style.dbtable != null && style.dbtable !== '' ? String(style.dbtable) : null,
                    dbtableExt: style.dbtableExt != null && style.dbtableExt !== '' ? String(style.dbtableExt) : null,
                    dbtableProcess: style.dbtableProcess != null && style.dbtableProcess !== '' ? String(style.dbtableProcess) : null,
                    externalProviderRef: null,
                    externalProviderCode: null
                };
                const isExtType = row.dbtableType && String(row.dbtableType).toLowerCase() === 'ext';
                if (isExtType && row.dbtable) {
                    const extResolved = typeof this.resolveExternalExtProviderSource === 'function'
                        ? this.resolveExternalExtProviderSource(row.dbtable)
                        : null;
                    row.externalProviderRef = extResolved ? extResolved.ref : ('ixmaps.' + row.dbtable);
                    row.externalProviderCode = extResolved ? extResolved.code : null;
                }
                themes.push(row);
                
                const lines = [];
                lines.push('**' + tr.theme + ':** ' + row.themeTitle + ' (`' + themeId + '`)');
                let hasAny = false;
                if (row.dbtableType) {
                    lines.push('- **' + tr.fmt + ':** `' + row.dbtableType + '`');
                    hasAny = true;
                }
                if (row.dbtableUrl) {
                    lines.push('- **' + tr.url + ':** ' + row.dbtableUrl);
                    hasAny = true;
                }
                if (row.dbtableQuery) {
                    let q = row.dbtableQuery;
                    if (q.length > 2000) {
                        q = q.slice(0, 2000) + '\n… ' + tr.truncated;
                    }
                    lines.push('- **' + tr.query + ':**');
                    lines.push('```sql');
                    lines.push(q);
                    lines.push('```');
                    hasAny = true;
                }
                if (row.dbtable) {
                    let d = row.dbtable;
                    if (d.length > 1200) {
                        d = d.slice(0, 1200) + '…';
                    }
                    lines.push('- **' + tr.dbtable + ':** `' + d + '`');
                    hasAny = true;
                }
                if (isExtType && row.dbtable) {
                    if (row.dbtableExt) {
                        lines.push('- **' + tr.ext + ':** `' + row.dbtableExt + '`');
                    }
                    lines.push('- **' + tr.extFn + ':** `' + (row.externalProviderRef || ('ixmaps.' + row.dbtable)) + '`');
                    if (row.externalProviderCode) {
                        let c = row.externalProviderCode;
                        if (c.length > 12000) {
                            c = c.slice(0, 12000) + '\n… ' + tr.truncated;
                        }
                        lines.push('```javascript');
                        lines.push(c);
                        lines.push('```');
                    } else {
                        const ref = '`' + (row.externalProviderRef || ('ixmaps.' + row.dbtable)) + '`';
                        const tail = row.dbtableExt
                            ? (' — script: `' + row.dbtableExt + '`')
                            : (' — ' + tr.extFnMissingNoScript);
                        lines.push('- ' + tr.extFnMissing + ' ' + ref + tail);
                    }
                    hasAny = true;
                } else if (row.dbtableExt) {
                    lines.push('- **' + tr.ext + ':** `' + row.dbtableExt + '`');
                    hasAny = true;
                }
                if (row.dbtableProcess) {
                    if (includeProcessCode) {
                        let p = row.dbtableProcess;
                        if (p.length > 12000) {
                            p = p.slice(0, 12000) + '\n… ' + tr.truncated;
                        }
                        lines.push('- **' + tr.process + ':**');
                        lines.push('```javascript');
                        lines.push(p);
                        lines.push('```');
                    } else {
                        lines.push('- **' + tr.process + ':** ' + tr.processDeferred);
                    }
                    hasAny = true;
                }
                if (!hasAny) {
                    lines.push('- ' + tr.none);
                }
                blocks.push(lines.join('\n'));
                blocks.push('');
            });
            
            return {
                summary: blocks.join('\n').trim(),
                themes: themes,
                includeProcessCode: includeProcessCode
            };
        },
        
        /**
         * Get binding information for themes (how data fields are used/mapped)
         * @param {Array} schemas - Available schemas
         * @returns {Object} Binding information with summary
         */
        getBindingInfo: function(schemas, language = 'en') {
            const map = this.getMap();
            if (!map || !map.Api) {
                return {
                    summary: "❌ Unable to access map API to retrieve binding information.",
                    themes: []
                };
            }
            
            const bindingInfo = {
                themes: [],
                summary: ""
            };
            
            schemas.forEach(schema => {
                try {
                    const themeId = schema.theme;
                    const themeTitle = schema.themeTitle || themeId;
                    
                    // Get theme definition object which contains binding information
                    let themeDef = null;
                    let themeObj = null;
                    
                    try {
                        themeDef = map.Api.getMapThemeDefinitionObj(themeId);
                        themeObj = map.Api.getTheme(themeId);
                        console.log(`🔍 [Binding] Theme ${themeId} - themeDef:`, themeDef);
                        console.log(`🔍 [Binding] Theme ${themeId} - themeObj:`, themeObj);
                    } catch (e) {
                        console.warn(`Could not get theme definition for ${themeId}:`, e);
                    }
                    
                    const bindings = {
                        theme: themeId,
                        themeTitle: themeTitle,
                        dataSource: null,
                        bindings: {},
                        style: {}
                    };
                    
                    // Extract data source information
                    if (themeDef && themeDef.style) {
                        if (themeDef.style.dbtableUrl) {
                            bindings.dataSource = themeDef.style.dbtableUrl;
                        } else if (themeDef.style.dbtable) {
                            bindings.dataSource = themeDef.style.dbtable;
                        } else if (themeDef.style.dbtableExt) {
                            bindings.dataSource = themeDef.style.dbtableExt;
                        }
                    }
                    
                    // Extract binding information from theme definition
                    if (themeDef) {
                        // New binding object structure
                        if (themeDef.binding) {
                            console.log(`✅ [Binding] Found binding object for ${themeId}:`, themeDef.binding);
                            Object.assign(bindings.bindings, themeDef.binding);
                        }
                        
                        // Check at root level
                        if (themeDef.itemfield || themeDef.lookupfield || themeDef.valuefield || themeDef.field) {
                            console.log(`✅ [Binding] Found binding properties at root level for ${themeId}`);
                            if (themeDef.itemfield) bindings.bindings.item = themeDef.itemfield;
                            if (themeDef.lookupfield) bindings.bindings.geo = themeDef.lookupfield;
                            if (themeDef.valuefield) bindings.bindings.value = themeDef.valuefield;
                            if (themeDef.field) bindings.bindings.field = themeDef.field;
                        }
                        
                        // Old style structure
                        if (themeDef.style) {
                            console.log(`✅ [Binding] Checking style object for ${themeId}:`, Object.keys(themeDef.style));
                            if (themeDef.style.itemfield) {
                                bindings.bindings.item = themeDef.style.itemfield;
                                console.log(`  → itemfield: ${themeDef.style.itemfield}`);
                            }
                            if (themeDef.style.lookupfield) {
                                bindings.bindings.geo = themeDef.style.lookupfield;
                                console.log(`  → lookupfield: ${themeDef.style.lookupfield}`);
                            }
                            if (themeDef.style.lookupfield2) {
                                bindings.bindings.geo2 = themeDef.style.lookupfield2;
                                console.log(`  → lookupfield2: ${themeDef.style.lookupfield2}`);
                            }
                            if (themeDef.style.valuefield) {
                                bindings.bindings.value = themeDef.style.valuefield;
                                console.log(`  → valuefield: ${themeDef.style.valuefield}`);
                            }
                            if (themeDef.style.field) {
                                bindings.bindings.field = themeDef.style.field;
                                console.log(`  → field: ${themeDef.style.field}`);
                            }
                            if (themeDef.style.field100) {
                                bindings.bindings.field100 = themeDef.style.field100;
                                console.log(`  → field100: ${themeDef.style.field100}`);
                            }
                            if (themeDef.style.colorfield) {
                                bindings.bindings.color = themeDef.style.colorfield;
                                console.log(`  → colorfield: ${themeDef.style.colorfield}`);
                            }
                            if (themeDef.style.sizefield) {
                                bindings.bindings.size = themeDef.style.sizefield;
                                console.log(`  → sizefield: ${themeDef.style.sizefield}`);
                            }
                            if (themeDef.style.alphafield) {
                                bindings.bindings.alpha = themeDef.style.alphafield;
                                console.log(`  → alphafield: ${themeDef.style.alphafield}`);
                            }
                            if (themeDef.style.alphafield100) {
                                bindings.bindings.alpha100 = themeDef.style.alphafield100;
                                console.log(`  → alphafield100: ${themeDef.style.alphafield100}`);
                            }
                            if (themeDef.style.titlefield) {
                                bindings.bindings.title = themeDef.style.titlefield;
                                console.log(`  → titlefield: ${themeDef.style.titlefield}`);
                            }
                            if (themeDef.style.valuefield && !bindings.bindings.text) {
                                bindings.bindings.text = themeDef.style.valuefield;
                            }
                            if (themeDef.style.type) {
                                bindings.style.type = themeDef.style.type;
                            }
                            if (themeDef.style.colorscheme) {
                                bindings.style.colorscheme = themeDef.style.colorscheme;
                            }
                            if (themeDef.style.classes) {
                                bindings.style.classes = themeDef.style.classes;
                            }
                            if (themeDef.style.ranges) {
                                bindings.style.ranges = themeDef.style.ranges;
                            }
                        }
                    }
                    
                    // Check theme object
                    if (themeObj && themeObj.theme) {
                        const theme = themeObj.theme;
                        console.log(`✅ [Binding] Checking themeObj.theme for ${themeId}:`, Object.keys(theme));
                        if (theme.szValueField && !bindings.bindings.value) {
                            bindings.bindings.value = theme.szValueField;
                            console.log(`  → szValueField: ${theme.szValueField}`);
                        }
                        if (theme.szColorField && !bindings.bindings.color) {
                            bindings.bindings.color = theme.szColorField;
                            console.log(`  → szColorField: ${theme.szColorField}`);
                        }
                        if (theme.szSizeField && !bindings.bindings.size) {
                            bindings.bindings.size = theme.szSizeField;
                            console.log(`  → szSizeField: ${theme.szSizeField}`);
                        }
                        if (theme.szTitleField && !bindings.bindings.title) {
                            bindings.bindings.title = theme.szTitleField;
                            console.log(`  → szTitleField: ${theme.szTitleField}`);
                        }
                        if (theme.szLabelField && !bindings.bindings.text) {
                            bindings.bindings.text = theme.szLabelField;
                            console.log(`  → szLabelField: ${theme.szLabelField}`);
                        }
                        if (theme.szSelectionField && !bindings.bindings.item) {
                            bindings.bindings.item = theme.szSelectionField;
                            console.log(`  → szSelectionField: ${theme.szSelectionField}`);
                        }
                        if (theme.szField && !bindings.bindings.field) {
                            bindings.bindings.field = theme.szField;
                            console.log(`  → szField: ${theme.szField}`);
                        }
                        // Get type from szFlag if not already set
                        if (theme.szFlag && !bindings.style.type) {
                            bindings.style.type = theme.szFlag;
                            console.log(`  → szFlag (type): ${theme.szFlag}`);
                        }
                    }
                    
                    if (themeObj && themeObj.objTheme && themeObj.objTheme.theme) {
                        const theme = themeObj.objTheme.theme;
                        console.log(`✅ [Binding] Checking objTheme.objTheme.theme for ${themeId}`);
                        if (theme.szValueField && !bindings.bindings.value) {
                            bindings.bindings.value = theme.szValueField;
                        }
                        if (theme.szColorField && !bindings.bindings.color) {
                            bindings.bindings.color = theme.szColorField;
                        }
                        if (theme.szSizeField && !bindings.bindings.size) {
                            bindings.bindings.size = theme.szSizeField;
                        }
                        // Get type from szFlag if not already set
                        if (theme.szFlag && !bindings.style.type) {
                            bindings.style.type = theme.szFlag;
                            console.log(`  → szFlag (type) from objTheme: ${theme.szFlag}`);
                        }
                    }
                    
                    console.log(`📋 [Binding] Final bindings for ${themeId}:`, bindings.bindings);
                    bindingInfo.themes.push(bindings);
                } catch (e) {
                    console.warn(`Error getting binding info for theme ${schema.theme}:`, e);
                }
            });
            
            // Language-specific translations
            const translations = {
                'en': {
                    title: 'Data Bindings and Usage',
                    found: 'Found binding information for',
                    themes: 'theme(s)',
                    dataSource: 'Data Source',
                    fieldBindings: 'Field Bindings',
                    visualizationSettings: 'Visualization Settings',
                    setting: 'Setting',
                    value: 'Value',
                    type: 'Type',
                    colorScheme: 'Color Scheme',
                    notAvailable: 'Not available',
                    itemField: 'Item/ID Field - used to match data to map features',
                    geoField: 'Georeferencing - used to locate features on the map',
                    valueField: 'Value Field - used for visualization and calculations',
                    colorField: 'Color Field - used to determine color',
                    sizeField: 'Size Field - used to determine size',
                    titleField: 'Title Field - used for labels and tooltips',
                    textField: 'Text/Label Field - used for display text',
                    noBindings: 'No field bindings found for this theme. Check browser console for detailed binding extraction logs.',
                    noThemeInfo: 'No theme binding information available.'
                },
                'de': {
                    title: 'Datenbindungen und Verwendung',
                    found: 'Bindungsinformationen gefunden für',
                    themes: 'Theme(s)',
                    dataSource: 'Datenquelle',
                    fieldBindings: 'Feldbindungen',
                    visualizationSettings: 'Visualisierungseinstellungen',
                    setting: 'Einstellung',
                    value: 'Wert',
                    type: 'Typ',
                    colorScheme: 'Farbschema',
                    notAvailable: 'Nicht verfügbar',
                    itemField: 'Element/ID-Feld - wird verwendet, um Daten mit Kartenfeatures abzugleichen',
                    geoField: 'Georeferenzierung - wird verwendet, um Features auf der Karte zu lokalisieren',
                    valueField: 'Wertfeld - wird für Visualisierung und Berechnungen verwendet',
                    colorField: 'Farbfeld - wird verwendet, um die Farbe zu bestimmen',
                    sizeField: 'Größenfeld - wird verwendet, um die Größe zu bestimmen',
                    titleField: 'Titelfeld - wird für Beschriftungen und Tooltips verwendet',
                    textField: 'Text/Beschriftungsfeld - wird für Anzeigetext verwendet',
                    noBindings: 'Keine Feldbindungen für dieses Theme gefunden. Überprüfen Sie die Browser-Konsole für detaillierte Bindungs-Extraktionsprotokolle.',
                    noThemeInfo: 'Keine Theme-Bindungsinformationen verfügbar.'
                },
                'fr': {
                    title: 'Liaisons de données et utilisation',
                    found: 'Informations de liaison trouvées pour',
                    themes: 'thème(s)',
                    dataSource: 'Source de données',
                    fieldBindings: 'Liaisons de champs',
                    visualizationSettings: 'Paramètres de visualisation',
                    setting: 'Paramètre',
                    value: 'Valeur',
                    type: 'Type',
                    colorScheme: 'Schéma de couleurs',
                    notAvailable: 'Non disponible',
                    itemField: 'Champ Élément/ID - utilisé pour faire correspondre les données aux éléments de la carte',
                    geoField: 'Géoréférencement - utilisé pour localiser les éléments sur la carte',
                    valueField: 'Champ de valeur - utilisé pour la visualisation et les calculs',
                    colorField: 'Champ de couleur - utilisé pour déterminer la couleur',
                    sizeField: 'Champ de taille - utilisé pour déterminer la taille',
                    titleField: 'Champ de titre - utilisé pour les étiquettes et les info-bulles',
                    textField: 'Champ Texte/Étiquette - utilisé pour le texte d\'affichage',
                    noBindings: 'Aucune liaison de champ trouvée pour ce thème. Vérifiez la console du navigateur pour les journaux d\'extraction de liaison détaillés.',
                    noThemeInfo: 'Aucune information de liaison de thème disponible.'
                },
                'it': {
                    title: 'Collegamenti dati e utilizzo',
                    found: 'Informazioni di collegamento trovate per',
                    themes: 'tema/i',
                    dataSource: 'Fonte dati',
                    fieldBindings: 'Collegamenti campi',
                    visualizationSettings: 'Impostazioni visualizzazione',
                    setting: 'Impostazione',
                    value: 'Valore',
                    type: 'Tipo',
                    colorScheme: 'Schema colori',
                    notAvailable: 'Non disponibile',
                    itemField: 'Campo Elemento/ID - utilizzato per abbinare i dati alle caratteristiche della mappa',
                    geoField: 'Georeferenziazione - utilizzato per localizzare le caratteristiche sulla mappa',
                    valueField: 'Campo valore - utilizzato per visualizzazione e calcoli',
                    colorField: 'Campo colore - utilizzato per determinare il colore',
                    sizeField: 'Campo dimensione - utilizzato per determinare la dimensione',
                    titleField: 'Campo titolo - utilizzato per etichette e tooltip',
                    textField: 'Campo Testo/Etichetta - utilizzato per il testo di visualizzazione',
                    noBindings: 'Nessun collegamento campo trovato per questo tema. Controllare la console del browser per i log di estrazione dettagliati.',
                    noThemeInfo: 'Nessuna informazione di collegamento tema disponibile.'
                },
                'es': {
                    title: 'Enlaces de datos y uso',
                    found: 'Información de enlace encontrada para',
                    themes: 'tema(s)',
                    dataSource: 'Fuente de datos',
                    fieldBindings: 'Enlaces de campos',
                    visualizationSettings: 'Configuración de visualización',
                    setting: 'Configuración',
                    value: 'Valor',
                    type: 'Tipo',
                    colorScheme: 'Esquema de colores',
                    notAvailable: 'No disponible',
                    itemField: 'Campo Elemento/ID - utilizado para hacer coincidir datos con características del mapa',
                    geoField: 'Georreferenciación - utilizado para localizar características en el mapa',
                    valueField: 'Campo de valor - utilizado para visualización y cálculos',
                    colorField: 'Campo de color - utilizado para determinar el color',
                    sizeField: 'Campo de tamaño - utilizado para determinar el tamaño',
                    titleField: 'Campo de título - utilizado para etiquetas y tooltips',
                    textField: 'Campo Texto/Etiqueta - utilizado para texto de visualización',
                    noBindings: 'No se encontraron enlaces de campo para este tema. Verifique la consola del navegador para registros de extracción detallados.',
                    noThemeInfo: 'No hay información de enlace de tema disponible.'
                }
            };
            
            const t = translations[language] || translations['en'];
            
            // Generate summary
            if (bindingInfo.themes.length === 0) {
                bindingInfo.summary = `❌ ${t.noThemeInfo}`;
            } else {
                let summaryParts = [`# ${t.title}\n\n${t.found} ${bindingInfo.themes.length} ${t.themes}.\n\n`];
                
                bindingInfo.themes.forEach((binding, themeIndex) => {
                    // Get theme name and replace [title] placeholder with actual theme name
                    let themeTitle = binding.themeTitle || binding.theme;
                    // Replace [title] placeholder with actual theme name or ID
                    if (themeTitle === '[title]' || themeTitle.includes('[title]')) {
                        themeTitle = binding.theme || 'Theme';
                    }
                    // Clean up any remaining [title] references
                    themeTitle = themeTitle.replace(/\[title\]/g, binding.theme || 'Theme');
                    
                    // Use HTML h4 tag to prevent markdown from interpreting as numbered list
                    // This ensures proper nesting and prevents continuous numbering
                    summaryParts.push(`<h4>${themeIndex + 1}. ${themeTitle}</h4>\n\n`);
                    // Indent the content that follows the theme title
                    summaryParts.push(`<div style="margin-left: 20px;">\n`);
                    
                    // Level 3: Data Source
                    if (binding.dataSource) {
                        summaryParts.push(`### ${t.dataSource}\n\n${binding.dataSource}\n\n`);
                    }
                    
                    // Level 3: Field Bindings
                    summaryParts.push(`### ${t.fieldBindings}\n\n`);
                    const bindingCount = Object.keys(binding.bindings).length;
                    console.log(`📊 [Binding Summary] Theme ${binding.theme} has ${bindingCount} bindings:`, binding.bindings);
                    
                    if (bindingCount > 0) {
                        // Build simple text lines with property name first (bold)
                        const textLines = [];
                        
                        if (binding.bindings.item) {
                            textLines.push(`**itemfield:** ${binding.bindings.item}`);
                        }
                        if (binding.bindings.geo || binding.bindings.geo2) {
                            const geoFields = [binding.bindings.geo, binding.bindings.geo2].filter(Boolean).join(', ');
                            textLines.push(`**lookupfield:** ${geoFields}`);
                        }
                        if (binding.bindings.value || binding.bindings.field) {
                            const valueFields = [binding.bindings.value, binding.bindings.field].filter(Boolean).join(', ');
                            textLines.push(`**valuefield:** ${valueFields}`);
                        }
                        if (binding.bindings.field100) {
                            textLines.push(`**field100:** ${binding.bindings.field100}`);
                        }
                        if (binding.bindings.color) {
                            textLines.push(`**colorfield:** ${binding.bindings.color}`);
                        }
                        if (binding.bindings.size) {
                            textLines.push(`**sizefield:** ${binding.bindings.size}`);
                        }
                        if (binding.bindings.alpha || binding.bindings.alpha100) {
                            const alphaFields = [binding.bindings.alpha, binding.bindings.alpha100].filter(Boolean).join(', ');
                            textLines.push(`**alphafield:** ${alphaFields}`);
                        }
                        if (binding.bindings.title) {
                            textLines.push(`**titlefield:** ${binding.bindings.title}`);
                        }
                        if (binding.bindings.text) {
                            textLines.push(`**textfield:** ${binding.bindings.text}`);
                        }
                        
                        // Add any other bindings that weren't categorized
                        const knownBindings = ['item', 'geo', 'geo2', 'value', 'field', 'field100', 'color', 'size', 'alpha', 'alpha100', 'title', 'text'];
                        const otherBindings = Object.keys(binding.bindings).filter(key => !knownBindings.includes(key));
                        if (otherBindings.length > 0) {
                            otherBindings.forEach(key => {
                                textLines.push(`**${key}:** ${binding.bindings[key]}`);
                            });
                        }
                        
                        if (textLines.length > 0) {
                            summaryParts.push(textLines.join('\n'));
                            summaryParts.push(`\n\n`);
                        } else {
                            summaryParts.push(`*Found ${bindingCount} binding(s) but could not categorize them.*\n\n`);
                        }
                    } else {
                        summaryParts.push(`*⚠️ ${t.noBindings}*\n\n`);
                    }
                    
                    // Level 3: Visualization Settings
                    // Always show visualization settings section
                    summaryParts.push(`### ${t.visualizationSettings}\n\n`);
                    
                    if (binding.style.type) {
                        summaryParts.push(`**type:** ${binding.style.type}\n`);
                    } else {
                        summaryParts.push(`**type:** *${t.notAvailable}*\n`);
                    }
                    
                    // Store colorscheme for classification check
                    const colorscheme = binding.style.colorscheme;
                    let colorschemeStr = '';
                    
                    if (binding.style.colorscheme) {
                        const cs = binding.style.colorscheme;
                        if (Array.isArray(cs)) {
                            // Format colorscheme array properly - show all colors or first few with ellipsis
                            const colorList = cs.map(c => {
                                // Convert to string if needed
                                const colorStr = String(c);
                                // Format color codes properly
                                return colorStr.startsWith('#') ? colorStr : (colorStr.includes(' ') ? `"${colorStr}"` : colorStr);
                            });
                            // Show all colors if 5 or fewer, otherwise show first 4 with ellipsis
                            if (colorList.length <= 5) {
                                colorschemeStr = colorList.join(', ');
                                summaryParts.push(`**colorscheme:** ${colorschemeStr}\n`);
                            } else {
                                colorschemeStr = colorList.join(', ');
                                summaryParts.push(`**colorscheme:** ${colorList.slice(0, 4).join(', ')}, ... (${colorList.length} total)\n`);
                            }
                        } else {
                            colorschemeStr = String(cs);
                            summaryParts.push(`**colorscheme:** ${colorschemeStr}\n`);
                        }
                    } else {
                        summaryParts.push(`**colorscheme:** *${t.notAvailable}*\n`);
                    }
                    
                    // Classification information (if applicable)
                    // Show classification if: more than one color, not categorical
                    // Default to EQUIDISTANT if not explicitly specified
                    
                    // Check if categorical first
                    const isCategorical = binding.style.type && (
                        binding.style.type.toUpperCase().includes('CATEGORICAL') ||
                        binding.style.type.toUpperCase().includes('CATEGORY')
                    );
                    
                    let hasMultipleColors = false;
                    let numColors = 0;
                    let numColorsFromColorscheme = null; // Track if we explicitly parsed a number from colorscheme
                    
                    // Use the colorscheme string we just formatted for parsing
                    const csToParse = colorschemeStr || (colorscheme ? String(colorscheme) : '');
                    
                    if (csToParse) {
                        if (Array.isArray(colorscheme)) {
                            // Check if first element is a number (explicit class count)
                            const firstElem = colorscheme[0];
                            const firstElemNum = typeof firstElem === 'number' ? firstElem : parseInt(firstElem);
                            if (!isNaN(firstElemNum) && firstElemNum > 0 && colorscheme.length > 1) {
                                // First element is explicitly the number of classes
                                numColors = firstElemNum;
                                numColorsFromColorscheme = firstElemNum;
                                hasMultipleColors = numColors > 1;
                            } else {
                                // Count array length as number of colors
                                numColors = colorscheme.length;
                                hasMultipleColors = numColors > 1;
                            }
                        } else {
                            // Handle pipe-separated format: "7|#ffffff|#ff0000"
                            if (csToParse.includes('|')) {
                                const parts = csToParse.split('|');
                                const firstPartNum = parseInt(parts[0]);
                                if (!isNaN(firstPartNum) && firstPartNum > 0 && parts.length > 1) {
                                    // First part is explicitly the number of classes
                                    numColors = firstPartNum;
                                    numColorsFromColorscheme = firstPartNum;
                                    hasMultipleColors = numColors > 1 || parts.length > 2;
                                } else {
                                    numColors = parts.length > 1 ? parts.length - 1 : 1;
                                    hasMultipleColors = numColors > 1 || parts.length > 2;
                                }
                            } else if (csToParse.includes(',')) {
                                // Handle comma-separated format: "7, #ffffff, #ff0000"
                                const parts = csToParse.split(',').map(p => p.trim());
                                // First part might be the number of classes
                                const firstPart = parts[0];
                                const firstPartNum = parseInt(firstPart);
                                if (!isNaN(firstPartNum) && firstPartNum > 0) {
                                    // First part is explicitly the number of classes
                                    numColors = firstPartNum;
                                    numColorsFromColorscheme = firstPartNum;
                                    hasMultipleColors = numColors > 1;
                                } else {
                                    // Count actual color values (hex colors or rgb)
                                    const colorParts = parts.filter(p => 
                                        p.startsWith('#') || 
                                        /^rgb/i.test(p) ||
                                        /^[a-f0-9]{3,6}$/i.test(p)
                                    );
                                    numColors = colorParts.length;
                                    hasMultipleColors = numColors > 1;
                                }
                            } else {
                                // Single value - not multiple colors
                                hasMultipleColors = false;
                                numColors = 1;
                            }
                        }
                    }
                    
                    // Debug log to help diagnose issues
                    console.log(`[Classification] Theme ${binding.theme}: colorscheme="${csToParse}", hasMultipleColors=${hasMultipleColors}, numColors=${numColors}, numColorsFromColorscheme=${numColorsFromColorscheme}, isCategorical=${isCategorical}, type="${binding.style.type}", binding.style.classes=${binding.style.classes}`);
                    
                    // Check if type explicitly mentions classification methods
                    const typeStr = binding.style.type ? binding.style.type.toUpperCase() : '';
                    const hasExplicitClassification = typeStr.includes('CHOROPLETH') ||
                        typeStr.includes('EQUIDISTANT') ||
                        typeStr.includes('QUANTILE') ||
                        typeStr.includes('JENKS') ||
                        typeStr.includes('NATURAL');
                    
                    // Show classification if: has multiple colors and not categorical
                    // Default to EQUIDISTANT if classification type not explicitly specified
                    if (hasMultipleColors && !isCategorical) {
                        summaryParts.push(`\n### Classification\n\n`);
                        
                        // Classification type
                        let classificationType = 'Equal Interval'; // Default
                        if (binding.style.type) {
                            const typeUpper = binding.style.type.toUpperCase();
                            // Map common types to readable names
                            if (typeUpper.includes('EQUIDISTANT') || 
                                typeUpper.includes('EQUAL_INTERVAL')) {
                                classificationType = 'Equal Interval';
                            } else if (typeUpper.includes('QUANTILE')) {
                                classificationType = 'Quantile';
                            } else if (typeUpper.includes('JENKS') ||
                                      typeUpper.includes('NATURAL')) {
                                classificationType = 'Natural Breaks (Jenks)';
                            } else if (hasExplicitClassification) {
                                // If type mentions classification but we don't recognize it, use the type as-is
                                classificationType = binding.style.type;
                            }
                            // If no explicit classification found, default to 'Equal Interval' (already set)
                        }
                        summaryParts.push(`**type:** ${classificationType}\n`);
                        
                        // Number of classes
                        // Prioritize numColorsFromColorscheme (explicitly parsed from colorscheme) 
                        // over binding.style.classes, then fall back to numColors
                        console.log(`[Classes Display] Theme ${binding.theme}: numColorsFromColorscheme=${numColorsFromColorscheme}, binding.style.classes=${binding.style.classes}, numColors=${numColors}`);
                        if (numColorsFromColorscheme !== null && numColorsFromColorscheme > 1) {
                            console.log(`[Classes Display] Using numColorsFromColorscheme: ${numColorsFromColorscheme}`);
                            summaryParts.push(`**classes:** ${numColorsFromColorscheme}\n`);
                        } else if (binding.style.classes) {
                            console.log(`[Classes Display] Using binding.style.classes: ${binding.style.classes}`);
                            summaryParts.push(`**classes:** ${binding.style.classes}\n`);
                        } else if (numColors > 1) {
                            console.log(`[Classes Display] Using numColors: ${numColors}`);
                            summaryParts.push(`**classes:** ${numColors}\n`);
                        }
                        
                        // Ranges (if defined)
                        if (binding.style.ranges) {
                            let rangesText = '';
                            if (Array.isArray(binding.style.ranges)) {
                                rangesText = binding.style.ranges.map((range, idx) => {
                                    if (Array.isArray(range) && range.length >= 2) {
                                        return `${range[0]} - ${range[1]}`;
                                    } else if (typeof range === 'number' || typeof range === 'string') {
                                        return String(range);
                                    }
                                    return String(range);
                                }).join(', ');
                            } else if (typeof binding.style.ranges === 'string') {
                                rangesText = binding.style.ranges;
                            } else {
                                rangesText = String(binding.style.ranges);
                            }
                            if (rangesText) {
                                summaryParts.push(`**ranges:** ${rangesText}\n`);
                            }
                        }
                        
                        summaryParts.push(`\n`);
                    }
                    
                    summaryParts.push(`\n`);
                    // Close the indent div
                    summaryParts.push(`</div>\n\n`);
                });
                
                bindingInfo.summary = summaryParts.join('');
            }
            
            return bindingInfo;
        },
        
        /**
         * Get statistics for themes using ixmaps.data.getFacets
         * @param {Array} schemas - Array of schema objects
         * @param {String} language - Language code (e.g., 'en', 'de', 'fr')
         * @returns {Object} Statistics information with summary
         */
        // Get max value of a specific field
        getMaxValue: async function(fieldName, themeId = null) {
            const map = this.getMap();
            if (!map || !map.Api) {
                return {
                    success: false,
                    message: "❌ Unable to access map API."
                };
            }

            // Get schemas
            const schemas = this.getAvailableSchemas();
            if (schemas.length === 0) {
                return {
                    success: false,
                    message: "❌ No data available. Please load some data first."
                };
            }

            // Filter schemas by theme if specified
            let relevantSchemas = schemas;
            if (themeId) {
                relevantSchemas = schemas.filter(s => s.theme === themeId);
                if (relevantSchemas.length === 0) {
                    return {
                        success: false,
                        message: `❌ Theme "${themeId}" not found.`
                    };
                }
            }

            // Check if ixmaps.data.getFacets exists
            if (!window.ixmaps || !window.ixmaps.data || typeof window.ixmaps.data.getFacets !== 'function') {
                return {
                    success: false,
                    message: "❌ Statistics API not available."
                };
            }

            const results = [];

            // Search for the field in all relevant schemas
            for (const schema of relevantSchemas) {
                const fields = schema.fields || [];
                const fieldNames = fields.map(f => typeof f === 'string' ? f : (f.name || f.field || f.id || String(f)));
                
                // Check if field exists (case-insensitive)
                const fieldIndex = fieldNames.findIndex(f => f.toLowerCase() === fieldName.toLowerCase());
                if (fieldIndex === -1) {
                    continue; // Field not found in this schema
                }

                const actualFieldName = fieldNames[fieldIndex];
                const themeIdForSchema = schema.theme;
                const themeTitle = schema.themeTitle || themeIdForSchema;

                // Get facets for this field
                const facets = window.ixmaps.data.getFacets('', '', [actualFieldName], themeIdForSchema, 'map', true);
                
                if (facets && facets.length > 0) {
                    const facet = facets[0]; // Should be the field we requested
                    if (facet && (facet.type === 'numeric' || facet.max !== undefined)) {
                        const maxValue = facet.max;
                        results.push({
                            theme: themeIdForSchema,
                            themeTitle: themeTitle,
                            field: actualFieldName,
                            maxValue: maxValue,
                            isNumeric: true
                        });
                    } else {
                        // Textual field - can't have a "max" value in numeric sense
                        results.push({
                            theme: themeIdForSchema,
                            themeTitle: themeTitle,
                            field: actualFieldName,
                            maxValue: null,
                            isNumeric: false,
                            message: "This is a text field, not numeric."
                        });
                    }
                }
            }

            if (results.length === 0) {
                return {
                    success: false,
                    message: `❌ Field "${fieldName}" not found in any available data.`
                };
            }

            // Format response
            let response = '';
            if (results.length === 1) {
                const result = results[0];
                if (result.isNumeric && result.maxValue !== null && result.maxValue !== undefined) {
                    response = `**Maximum value of "${result.field}"**: ${result.maxValue}`;
                    if (result.themeTitle && result.themeTitle !== result.theme) {
                        response += ` (theme: ${result.themeTitle})`;
                    }
                } else {
                    response = `❌ Field "${result.field}" is not numeric. Cannot determine maximum value.`;
                }
            } else {
                response = `**Maximum values of "${fieldName}":**\n\n`;
                for (const result of results) {
                    if (result.isNumeric && result.maxValue !== null && result.maxValue !== undefined) {
                        response += `- **${result.themeTitle || result.theme}**: ${result.maxValue}\n`;
                    } else {
                        response += `- **${result.themeTitle || result.theme}**: Not numeric\n`;
                    }
                }
            }

            return {
                success: true,
                message: response,
                results: results
            };
        },

        getStatistics: async function(schemas, language = 'en') {
            const map = this.getMap();
            if (!map || !map.Api) {
                return {
                    summary: "❌ Unable to access map API to retrieve statistics.",
                    themes: []
                };
            }
            
            const statisticsInfo = {
                themes: [],
                summary: ""
            };
            
            // Language-specific translations
            const translations = {
                'en': {
                    title: 'Statistics',
                    found: 'Statistics for',
                    themes: 'theme(s)',
                    field: 'Field',
                    type: 'Type',
                    min: 'Min',
                    max: 'Max',
                    mean: 'Mean',
                    deviation: 'Std Dev',
                    uniqueValues: 'Unique Values',
                    totalRecords: 'Total Records',
                    records: 'Records',
                    numeric: 'Numeric',
                    textual: 'Textual',
                    noStatistics: 'No statistics available for this theme.',
                    noThemes: 'No themes available for statistics.'
                },
                'it': {
                    title: 'Statistiche',
                    found: 'Statistiche per',
                    themes: 'tema/i',
                    field: 'Campo',
                    type: 'Tipo',
                    min: 'Min',
                    max: 'Max',
                    mean: 'Media',
                    deviation: 'Dev Std',
                    uniqueValues: 'Valori Unici',
                    totalRecords: 'Record Totali',
                    records: 'Record',
                    numeric: 'Numerico',
                    textual: 'Testuale',
                    noStatistics: 'Nessuna statistica disponibile per questo tema.',
                    noThemes: 'Nessun tema disponibile per le statistiche.'
                },
                'de': {
                    title: 'Statistiken',
                    found: 'Statistiken für',
                    themes: 'Theme(s)',
                    field: 'Feld',
                    type: 'Typ',
                    min: 'Min',
                    max: 'Max',
                    mean: 'Mittelwert',
                    deviation: 'Std Abw',
                    uniqueValues: 'Eindeutige Werte',
                    totalRecords: 'Gesamt Datensätze',
                    records: 'Datensätze',
                    numeric: 'Numerisch',
                    textual: 'Textuell',
                    noStatistics: 'Keine Statistiken für dieses Theme verfügbar.',
                    noThemes: 'Keine Themes für Statistiken verfügbar.'
                },
                'fr': {
                    title: 'Statistiques',
                    found: 'Statistiques pour',
                    themes: 'thème(s)',
                    field: 'Champ',
                    type: 'Type',
                    min: 'Min',
                    max: 'Max',
                    mean: 'Moyenne',
                    deviation: 'Écart-type',
                    uniqueValues: 'Valeurs Uniques',
                    totalRecords: 'Enregistrements Totaux',
                    records: 'Enregistrements',
                    numeric: 'Numérique',
                    textual: 'Textuel',
                    noStatistics: 'Aucune statistique disponible pour ce thème.',
                    noThemes: 'Aucun thème disponible pour les statistiques.'
                }
            };
            
            const t = translations[language] || translations['en'];
            
            if (schemas.length === 0) {
                statisticsInfo.summary = `❌ ${t.noThemes}`;
                return statisticsInfo;
            }
            
            // Process each schema/theme
            for (const schema of schemas) {
                try {
                    const themeId = schema.theme;
                    const themeTitle = schema.themeTitle || themeId;
                    
                    // Check if ixmaps.data.getFacets exists
                    if (!window.ixmaps || !window.ixmaps.data || typeof window.ixmaps.data.getFacets !== 'function') {
                        console.warn('⚠️ ixmaps.data.getFacets is not available');
                        continue;
                    }
                    
                    // Get all fields for this theme
                    const fields = schema.fields || [];
                    if (fields.length === 0) {
                        console.warn(`⚠️ No fields found for theme ${themeId}`);
                        continue;
                    }
                    
                    // Convert fields array to array of field names
                    const fieldNames = fields.map(f => typeof f === 'string' ? f : f.name || f.field || f.id);
                    
                    // Call getFacets to get statistics
                    // Parameters: szFilter, szDiv, szFieldsA, szId, szMap, fFlag
                    const facets = window.ixmaps.data.getFacets('', '', fieldNames, themeId, 'map', true);
                    
                    console.log(`📊 [Statistics] Facets for theme ${themeId} (${themeTitle}):`, facets);
                    console.log(`📊 [Statistics] Facets count:`, facets ? facets.length : 0);
                    
                    if (facets && facets.length > 0) {
                        facets.forEach((facet, index) => {
                            console.log(`📊 [Statistics] Facet ${index + 1} (${facet.id}):`, {
                                id: facet.id,
                                type: facet.type,
                                min: facet.min,
                                max: facet.max,
                                sum: facet.sum,
                                nCount: facet.nCount,
                                uniqueValues: facet.uniqueValues,
                                valuesLength: facet.values ? facet.values.length : null,
                                dataLength: facet.data ? facet.data.length : null,
                                valuesCount: facet.valuesCount ? Object.keys(facet.valuesCount).length : null,
                                hasValuesCount: !!facet.valuesCount,
                                fullFacet: facet
                            });
                        });
                    }
                    
                    if (!facets || facets.length === 0) {
                        console.warn(`⚠️ No facets returned for theme ${themeId}`);
                        statisticsInfo.themes.push({
                            theme: themeId,
                            themeTitle: themeTitle,
                            statistics: [],
                            error: t.noStatistics
                        });
                        continue;
                    }
                    
                    // Get total record count from schema for comparison
                    let totalTableRecords = null;
                    if (schema.objTheme && schema.objTheme.objTheme && schema.objTheme.objTheme.dbRecords) {
                        totalTableRecords = schema.objTheme.objTheme.dbRecords.length;
                    }
                    
                    // Format statistics
                    const themeStats = {
                        theme: themeId,
                        themeTitle: themeTitle,
                        totalTableRecords: totalTableRecords, // Store for comparison
                        statistics: facets.map(facet => {
                            const stat = {
                                field: facet.id,
                                type: facet.type || (facet.min !== undefined ? 'numeric' : 'textual')
                            };
                            
                            if (facet.type === 'numeric' || facet.min !== undefined) {
                                stat.min = facet.min;
                                stat.max = facet.max;
                                
                                // Get count from various sources
                                const count = facet.nCount || 
                                             (facet.values ? facet.values.length : 0) ||
                                             (facet.data ? facet.data.length : 0) ||
                                             0;
                                stat.count = count;
                                
                                // Calculate mean if we have sum and count
                                if (facet.sum !== undefined && count > 0) {
                                    stat.mean = facet.sum / count;
                                }
                                
                                // Calculate standard deviation if we have values/data
                                if (facet.values && facet.values.length > 1) {
                                    const values = facet.values.map(v => typeof v === 'number' ? v : parseFloat(v)).filter(v => !isNaN(v));
                                    if (values.length > 1 && stat.mean !== undefined) {
                                        const variance = values.reduce((acc, val) => acc + Math.pow(val - stat.mean, 2), 0) / values.length;
                                        stat.deviation = Math.sqrt(variance);
                                    }
                                } else if (facet.data && facet.data.length > 1) {
                                    const values = facet.data.map(v => typeof v === 'number' ? v : parseFloat(v)).filter(v => !isNaN(v));
                                    if (values.length > 1 && stat.mean !== undefined) {
                                        const variance = values.reduce((acc, val) => acc + Math.pow(val - stat.mean, 2), 0) / values.length;
                                        stat.deviation = Math.sqrt(variance);
                                    }
                                }
                            } else {
                                stat.uniqueValues = facet.uniqueValues || 0;
                                stat.valuesCount = facet.valuesCount || {};
                                
                                // Try multiple sources for count on textual fields
                                // 1. nCount (if available)
                                // 2. values.length (if values array exists)
                                // 3. data.length (if data array exists)
                                // 4. Count from valuesCount object (sum of all counts)
                                let count = facet.nCount;
                                
                                if (!count && facet.values && facet.values.length > 0) {
                                    count = facet.values.length;
                                }
                                
                                if (!count && facet.data && facet.data.length > 0) {
                                    count = facet.data.length;
                                }
                                
                                // If we have valuesCount, sum all the counts
                                if (!count && facet.valuesCount && typeof facet.valuesCount === 'object') {
                                    count = Object.values(facet.valuesCount).reduce((sum, val) => sum + (Number(val) || 0), 0);
                                }
                                
                                stat.count = count || 0;
                                
                                // If uniqueValues is 0 or not set, try to calculate it from valuesCount or values
                                if (stat.uniqueValues === 0 || stat.uniqueValues === undefined) {
                                    if (facet.valuesCount && typeof facet.valuesCount === 'object') {
                                        stat.uniqueValues = Object.keys(facet.valuesCount).length;
                                    } else if (facet.values && facet.values.length > 0) {
                                        // Get unique values from values array
                                        const uniqueSet = new Set(facet.values);
                                        stat.uniqueValues = uniqueSet.size;
                                    } else if (facet.data && facet.data.length > 0) {
                                        const uniqueSet = new Set(facet.data);
                                        stat.uniqueValues = uniqueSet.size;
                                    }
                                }
                            }
                            
                            return stat;
                        })
                    };
                    
                    statisticsInfo.themes.push(themeStats);
                } catch (e) {
                    console.error(`Error getting statistics for theme ${schema.theme}:`, e);
                    statisticsInfo.themes.push({
                        theme: schema.theme,
                        themeTitle: schema.themeTitle || schema.theme,
                        statistics: [],
                        error: `Error: ${e.message}`
                    });
                }
            }
            
            // Generate summary
            if (statisticsInfo.themes.length === 0) {
                statisticsInfo.summary = `❌ ${t.noThemes}`;
            } else {
                let summaryParts = [`# ${t.title}\n\n${t.found} ${statisticsInfo.themes.length} ${t.themes}.\n\n`];
                
                statisticsInfo.themes.forEach((themeStat, themeIndex) => {
                    // Use HTML h4 tag to prevent markdown from interpreting as numbered list
                    // This ensures proper nesting and prevents continuous numbering
                    summaryParts.push(`<h4>${themeIndex + 1}. ${themeStat.themeTitle || themeStat.theme}</h4>\n\n`);
                    // Indent the content that follows the theme title
                    summaryParts.push(`<div style="margin-left: 20px;">\n`);
                    
                    // Show table records count if available
                    if (themeStat.totalTableRecords !== null && themeStat.totalTableRecords !== undefined) {
                        summaryParts.push(`**${t.totalRecords}**: ${themeStat.totalTableRecords}\n\n`);
                    }
                    
                    if (themeStat.error) {
                        summaryParts.push(`*⚠️ ${themeStat.error}*\n\n`);
                    } else if (themeStat.statistics && themeStat.statistics.length > 0) {
                        // Get total table records for comparison
                        const totalTableRecords = themeStat.totalTableRecords;
                        
                        themeStat.statistics.forEach(stat => {
                            if (stat.type === 'numeric') {
                                // Format numeric statistics - Records always on 2nd line
                                const statParts = [];
                                statParts.push(`${t.min}: ${stat.min}`);
                                statParts.push(`${t.max}: ${stat.max}`);
                                if (stat.mean !== undefined) {
                                    statParts.push(`${t.mean}: ${stat.mean.toFixed(2)}`);
                                }
                                if (stat.deviation !== undefined) {
                                    statParts.push(`${t.deviation}: ${stat.deviation.toFixed(2)}`);
                                }
                                
                                // Build first line with stats (without Records)
                                const statsLine = statParts.join(' | ');
                                
                                // Check if Records should be shown (differs from table count)
                                const showRecords = totalTableRecords === null || stat.count !== totalTableRecords;
                                
                                // Always put Records on second line if it should be shown
                                summaryParts.push(`**${stat.field}** (${t.numeric}): ${statsLine}\n`);
                                if (showRecords) {
                                    summaryParts.push(`  ${t.records}: ${stat.count}\n`);
                                }
                                summaryParts.push(`\n`);
                            } else {
                                // Format textual statistics - Records always on 2nd line
                                const statParts = [];
                                if (stat.uniqueValues > 0) {
                                    statParts.push(`${t.uniqueValues}: ${stat.uniqueValues}`);
                                }
                                
                                // Build first line with stats (without Records)
                                const statsLine = statParts.join(' | ');
                                
                                // Check if Records should be shown (differs from table count)
                                const showRecords = totalTableRecords === null || stat.count !== totalTableRecords;
                                
                                // Always put Records on second line if it should be shown
                                summaryParts.push(`**${stat.field}** (${t.textual}): ${statsLine}\n`);
                                if (showRecords) {
                                    summaryParts.push(`  ${t.records}: ${stat.count}\n`);
                                }
                                summaryParts.push(`\n`);
                            }
                        });
                    } else {
                        summaryParts.push(`*${t.noStatistics}*\n\n`);
                    }
                    // Close the indent div
                    summaryParts.push(`</div>\n\n`);
                });
                
                statisticsInfo.summary = summaryParts.join('');
            }
            
            return statisticsInfo;
        },
        
        /**
         * Get complete map project JSON
         * @returns {Object} Complete project JSON or null
         */
        getMapProjectJSON: function() {
            try {
                // Try to get project from ixmaps global using getProjectString()
                if (window.ixmaps && typeof window.ixmaps.getProjectString === 'function') {
                    try {
                        const projectString = window.ixmaps.getProjectString();
                        if (projectString) {
                            console.log('📊 Got project string from ixmaps.getProjectString(), length:', projectString.length);
                            try {
                                const project = JSON.parse(projectString);
                                console.log('✅ Parsed project JSON, keys:', Object.keys(project));
                                return project;
                            } catch (e) {
                                console.warn('Could not parse project string:', e);
                            }
                        }
                    } catch (e) {
                        console.warn('Error calling getProjectString():', e);
                    }
                }
                
                // Try to get from embedded SVG window
                if (window.ixmaps && window.ixmaps.embeddedSVG && window.ixmaps.embeddedSVG.window && window.ixmaps.embeddedSVG.window.ixmaps) {
                    const embeddedIxmaps = window.ixmaps.embeddedSVG.window.ixmaps;
                    if (embeddedIxmaps && typeof embeddedIxmaps.getProjectString === 'function') {
                        try {
                            const projectString = embeddedIxmaps.getProjectString();
                            if (projectString) {
                                return JSON.parse(projectString);
                            }
                        } catch (e) {
                            console.warn('Error getting project from embedded SVG:', e);
                        }
                    }
                }
                
                console.warn('⚠️ Could not get project JSON - getProjectString() not available');
                return null;
            } catch (e) {
                console.warn('Error getting project JSON:', e);
                return null;
            }
        },
        
        /**
         * Get map definition as JSON object
         * @returns {Object} Map definition object
         */
        getMapDefinition: function() {
            const map = this.getMap();
            if (!map || !map.Api) {
                return null;
            }
            
            const mapDef = {
                themes: [],
                center: null,
                zoom: null,
                attribution: null,
                options: {}
            };
            
            try {
                // Get all themes
                let themes = [];
                if (map.Themes && map.Themes.getThemes) {
                    themes = map.Themes.getThemes();
                } else if (map.Api && map.Api.getAllThemes) {
                    themes = map.Api.getAllThemes();
                }
                
                // Extract theme information
                themes.forEach(theme => {
                    const themeId = theme.szId || theme.szName || theme.id || theme.name;
                    if (!themeId) return;
                    
                    try {
                        const themeDef = map.Api.getMapThemeDefinitionObj ? map.Api.getMapThemeDefinitionObj(themeId) : null;
                        const themeObj = map.Api.getTheme ? map.Api.getTheme(themeId) : null;
                        
                        const themeInfo = {
                            id: themeId,
                            title: theme.szTitle || theme.title || themeId,
                            definition: themeDef,
                            hasData: !!(themeObj && themeObj.objTheme && themeObj.objTheme.dbRecords),
                            fieldCount: 0
                        };
                        
                        // Get field count
                        if (themeObj && themeObj.objTheme && themeObj.objTheme.dbFields) {
                            themeInfo.fieldCount = themeObj.objTheme.dbFields.length;
                        } else if (map.Query && map.Query.getFieldsOfTheme) {
                            try {
                                const fields = map.Query.getFieldsOfTheme(themeId);
                                themeInfo.fieldCount = fields ? fields.length : 0;
                            } catch (e) {}
                        }
                        
                        mapDef.themes.push(themeInfo);
                    } catch (e) {
                        // Skip themes that can't be accessed
                    }
                });
                
                // Get map center and zoom if available
                if (map.Api && map.Api.getMapCenter) {
                    try {
                        mapDef.center = map.Api.getMapCenter();
                    } catch (e) {}
                }
                
                if (map.Api && map.Api.getMapZoom) {
                    try {
                        mapDef.zoom = map.Api.getMapZoom();
                    } catch (e) {}
                }
                
                // Get attribution if available
                if (map.attribution) {
                    mapDef.attribution = map.attribution;
                }
                
            } catch (e) {
                console.warn('Error getting map definition:', e);
            }
            
            return mapDef;
        },
        
        /**
         * Generate map description using Gemini AI
         * @param {String} language - Language code (e.g., 'en', 'de', 'fr')
         * @returns {Promise<String>} AI-generated description
         */
        generateMapDescription: async function(language = 'en') {
            console.log('🔍 generateMapDescription called', { useGemini: this.config.useGemini, hasApiKey: !!this.config.geminiApiKey, language });
            
            if (!this.config.useGemini || !this.config.geminiApiKey) {
                console.warn('⚠️ Gemini not configured or API key missing');
                return null;
            }
            
            try {
                // Try to get complete project JSON first
                let projectJSON = this.getMapProjectJSON();
                console.log('📊 Project JSON retrieved:', { hasProject: !!projectJSON, projectKeys: projectJSON ? Object.keys(projectJSON) : null });
                
                // Get map definition as fallback or supplement
                const mapDef = this.getMapDefinition();
                console.log('📊 Map definition retrieved:', { themeCount: mapDef?.themes?.length, hasThemes: !!(mapDef && mapDef.themes && mapDef.themes.length > 0) });
                
                // Use project JSON if available, otherwise use map definition
                let dataToSend = null;
                
                if (projectJSON) {
                    // Use complete project JSON but simplify it significantly to avoid token limits
                    // Extract only the most essential information
                    const simplifiedThemes = projectJSON.themes ? projectJSON.themes.map(t => {
                        const theme = {
                            title: t.title || t.szTitle || t.name || t.style?.title || t.style?.name || 'Untitled Theme',
                            description: t.description || t.snippet || t.style?.description || t.style?.snippet || null
                        };
                        
                        // Only include essential style info
                        if (t.style) {
                            theme.type = t.style.type || null;
                            theme.titlefield = t.style.titlefield || null;
                            theme.valuefield = t.style.valuefield || null;
                            // Don't include colorscheme, values, or other large arrays
                        }
                        
                        return theme;
                    }) : null;
                    
                    dataToSend = {
                        metadata: projectJSON.metadata ? {
                            title: projectJSON.metadata.title || null,
                            description: projectJSON.metadata.description || null,
                            snippet: projectJSON.metadata.snippet || null
                        } : null,
                        map: projectJSON.map ? {
                            center: projectJSON.map.center,
                            zoom: projectJSON.map.zoom,
                            attribution: projectJSON.map.attribution || null
                        } : null,
                        themes: simplifiedThemes,
                        themeCount: simplifiedThemes ? simplifiedThemes.length : 0
                    };
                    console.log('📊 Using simplified project JSON (essential info only)');
                } else if (mapDef && mapDef.themes && mapDef.themes.length > 0) {
                    // Fallback to simplified map definition
                    dataToSend = {
                        themeCount: mapDef.themes.length,
                        themes: mapDef.themes.map(t => ({
                            id: t.id,
                            title: t.title,
                            fieldCount: t.fieldCount,
                            hasData: t.hasData,
                            bindings: t.definition && t.definition.binding ? {
                                value: t.definition.binding.value,
                                color: t.definition.binding.color,
                                size: t.definition.binding.size
                            } : null,
                            type: t.definition && t.definition.style ? t.definition.style.type : null
                        })),
                        center: mapDef.center,
                        zoom: mapDef.zoom,
                        attribution: mapDef.attribution
                    };
                    console.log('📊 Using simplified map definition (fallback)');
                } else {
                    console.warn('⚠️ No project JSON or map definition available');
                    return null;
                }
                
                // Language-specific instructions
                const languageInstructions = {
                    'en': 'Write in English.',
                    'de': 'Schreibe auf Deutsch.',
                    'fr': 'Écris en français.',
                    'it': 'Scrivi in italiano.',
                    'es': 'Escribe en español.',
                    'pt': 'Escreva em português.',
                    'nl': 'Schrijf in het Nederlands.',
                    'ru': 'Пишите на русском языке.'
                };
                
                const languageInstruction = languageInstructions[language] || languageInstructions['en'];
                
                // Map language codes to language names
                const languageNames = {
                    'en': 'English',
                    'de': 'German',
                    'fr': 'French',
                    'it': 'Italian',
                    'es': 'Spanish',
                    'pt': 'Portuguese',
                    'nl': 'Dutch',
                    'ru': 'Russian'
                };
                
                const languageName = languageNames[language] || 'English';
                
                // Create prompt for Gemini - keep it concise
                const jsonString = JSON.stringify(dataToSend, null, 2);
                console.log('📊 JSON string length:', jsonString.length);
                console.log('🌐 Language for description:', language, '→', languageName);
                
                const prompt = `Analyze this map configuration and write a 2-3 sentence description in ${languageName}.

${languageInstruction} IMPORTANT: The entire description must be written in ${languageName}, not in English.

Map configuration:
${jsonString}

Describe what geographic area or topic the map covers and what data themes are available. Return only plain text in ${languageName}, no markdown, no JSON.`;

                // Call Gemini API
                const modelsToTry = [
                    { name: 'gemini-2.5-flash', version: 'v1' },
                    { name: 'gemini-2.5-pro', version: 'v1' },
                    { name: 'gemini-2.0-flash-exp', version: 'v1' },
                    { name: 'gemini-1.5-flash', version: 'v1' },
                    { name: 'gemini-1.5-pro', version: 'v1' }
                ];
                
                let lastError = null;
                for (const model of modelsToTry) {
                    try {
                        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model.name}:generateContent?key=${this.config.geminiApiKey}`;
                        const response = await fetch(apiUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [{
                                        text: prompt
                                    }]
                                }],
                                generationConfig: {
                                    temperature: 0.7,
                                    topK: 40,
                                    topP: 0.95,
                                    maxOutputTokens: 1000,
                                }
                            })
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            console.log('✅ Gemini API response received for model:', model.name);
                            console.log('📋 Response keys:', Object.keys(data));
                            
                            // Try different response structures (same as processGeminiResponse)
                            let description = null;
                            
                            if (data.candidates && data.candidates[0]) {
                                const candidate = data.candidates[0];
                                console.log('📋 Candidate keys:', Object.keys(candidate));
                                console.log('📋 Finish reason:', candidate.finishReason);
                                
                                // Check if response was truncated
                                if (candidate.finishReason === 'MAX_TOKENS') {
                                    console.warn('⚠️ Response truncated due to MAX_TOKENS limit');
                                }
                                
                                // Standard structure: candidate.content.parts[0].text
                                if (candidate.content) {
                                    console.log('📋 Content keys:', Object.keys(candidate.content));
                                    console.log('📋 Content object:', JSON.stringify(candidate.content, null, 2));
                                    console.log('📋 Content has parts?', !!candidate.content.parts);
                                    console.log('📋 Parts length:', candidate.content.parts?.length);
                                    
                                    if (candidate.content.parts && candidate.content.parts.length > 0) {
                                        console.log('📋 Part keys:', Object.keys(candidate.content.parts[0]));
                                        console.log('📋 Part object:', JSON.stringify(candidate.content.parts[0], null, 2));
                                        console.log('📋 Part has text?', !!candidate.content.parts[0].text);
                                        description = candidate.content.parts[0].text;
                                    } else {
                                        console.warn('⚠️ Content has no parts or parts array is empty');
                                        // Maybe parts is at a different level or the response structure is different
                                        // Try to find text anywhere in the candidate
                                        const candidateStr = JSON.stringify(candidate);
                                        if (candidateStr.includes('"text"')) {
                                            console.warn('⚠️ Found "text" in candidate but not in expected location');
                                        }
                                    }
                                }
                                // Alternative: candidate.parts[0].text
                                else if (candidate.parts && candidate.parts[0]) {
                                    console.log('📋 Direct parts keys:', Object.keys(candidate.parts[0]));
                                    description = candidate.parts[0].text;
                                }
                                
                                if (description) {
                                    description = String(description).trim();
                                    console.log('✅ Found description text, length:', description.length);
                                } else {
                                    console.warn('⚠️ No text found in candidate. Full candidate:', JSON.stringify(candidate, null, 2));
                                }
                            } else {
                                console.warn('⚠️ No candidates in response');
                            }
                            
                            if (description && description.length > 0) {
                                console.log('✅ Description generated successfully:', description.substring(0, 100) + '...');
                                return description;
                            } else {
                                // Log the full structure for debugging
                                console.warn('⚠️ Could not extract text from response. Full response structure:', {
                                    hasCandidates: !!data.candidates,
                                    candidatesLength: data.candidates?.length,
                                    firstCandidateKeys: data.candidates?.[0] ? Object.keys(data.candidates[0]) : null
                                });
                            }
                        } else {
                            const errorData = await response.json().catch(() => ({}));
                            console.warn(`⚠️ Gemini API error for ${model.name}:`, response.status, errorData);
                            
                            // Create comprehensive error message for 429
                            if (response.status === 429) {
                                const retryAfter = response.headers.get('Retry-After');
                                let errorMsg = `## ⚠️ Rate Limit Exceeded (429 Error)\n\n`;
                                errorMsg += `**What happened?**\n`;
                                errorMsg += `You've exceeded the rate limit for the Gemini API. This means you've made too many requests in a short period of time.\n\n`;
                                errorMsg += `**What can you do?**\n`;
                                if (retryAfter) {
                                    errorMsg += `- ⏰ **Wait ${retryAfter} second(s)** before trying again\n`;
                                } else {
                                    errorMsg += `- ⏰ **Wait 1-2 minutes** before trying again\n`;
                                }
                                errorMsg += `- 💡 **Use the Simple Parser** - Disable Gemini in Settings\n`;
                                errorMsg += `- 📊 **Check your quota** - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)\n\n`;
                                lastError = new Error(errorMsg);
                                lastError.status = 429;
                            } else {
                            lastError = new Error(`Model ${model.name}: ${response.status} - ${errorData.error?.message || response.statusText}`);
                                lastError.status = response.status;
                            }
                            continue;
                        }
                    } catch (err) {
                        lastError = err;
                        continue;
                    }
                }
                
                if (lastError) {
                    console.error('❌ All Gemini models failed:', lastError);
                    // Don't throw, try fallback instead
                }
                
                // Fallback: generate a simple description manually
                console.warn('⚠️ No description generated by Gemini, using fallback');
                try {
                    const mapDef = this.getMapDefinition();
                    if (mapDef && mapDef.themes && mapDef.themes.length > 0) {
                        const themeTitles = mapDef.themes.map(t => t.title || 'Unknown').join(', ');
                        const fallbackDescription = language === 'en' 
                            ? `This map contains ${mapDef.themes.length} data theme(s): ${themeTitles}.`
                            : language === 'de'
                            ? `Diese Karte enthält ${mapDef.themes.length} Datenthema(s): ${themeTitles}.`
                            : language === 'fr'
                            ? `Cette carte contient ${mapDef.themes.length} thème(s) de données : ${themeTitles}.`
                            : language === 'it'
                            ? `Questa mappa contiene ${mapDef.themes.length} tema/i di dati: ${themeTitles}.`
                            : `This map contains ${mapDef.themes.length} data theme(s): ${themeTitles}.`;
                        console.log('📝 Using fallback description:', fallbackDescription);
                        return fallbackDescription;
                    }
                } catch (e) {
                    console.warn('Could not generate fallback description:', e);
                }
                
                return null;
            } catch (error) {
                console.error('❌ Error generating map description with Gemini:', error);
                console.error('Error details:', error.message, error.stack);
                
                // Fallback: generate a simple description manually
                try {
                    const mapDef = this.getMapDefinition();
                    if (mapDef && mapDef.themes && mapDef.themes.length > 0) {
                        const themeTitles = mapDef.themes.map(t => t.title || 'Unknown').join(', ');
                        const fallbackDescription = language === 'en' 
                            ? `This map contains ${mapDef.themes.length} data theme(s): ${themeTitles}.`
                            : language === 'de'
                            ? `Diese Karte enthält ${mapDef.themes.length} Datenthema(s): ${themeTitles}.`
                            : language === 'fr'
                            ? `Cette carte contient ${mapDef.themes.length} thème(s) de données : ${themeTitles}.`
                            : language === 'it'
                            ? `Questa mappa contiene ${mapDef.themes.length} tema/i di dati: ${themeTitles}.`
                            : `This map contains ${mapDef.themes.length} data theme(s): ${themeTitles}.`;
                        console.log('📝 Using fallback description:', fallbackDescription);
                        return fallbackDescription;
                    }
                } catch (e) {
                    console.warn('Could not generate fallback description:', e);
                }
                
                return null;
            }
        },
        
        /**
         * Generate dependency list graph showing map structure (projection, layers, themes)
         * @param {String} language - Language code (e.g., 'en', 'de', 'fr')
         * @returns {String} HTML string with dependency list visualization
         */
        generateMapDependencyGraph: function(language = 'en') {
            const translations = {
                'en': {
                    mapProperties: 'Map Properties',
                    projection: 'Projection',
                    mapService: 'Map Service',
                    mapType: 'Map Type',
                    layers: 'Layers',
                    themes: 'Themes',
                    noData: 'No data available'
                },
                'de': {
                    mapProperties: 'Karteneigenschaften',
                    projection: 'Projektion',
                    mapService: 'Kartendienst',
                    mapType: 'Kartentyp',
                    layers: 'Ebenen',
                    themes: 'Themes',
                    noData: 'Keine Daten verfügbar'
                },
                'fr': {
                    mapProperties: 'Propriétés de la carte',
                    projection: 'Projection',
                    mapService: 'Service de carte',
                    mapType: 'Type de carte',
                    layers: 'Couches',
                    themes: 'Thèmes',
                    noData: 'Aucune donnée disponible'
                },
                'it': {
                    mapProperties: 'Proprietà della mappa',
                    projection: 'Proiezione',
                    mapService: 'Servizio mappa',
                    mapType: 'Tipo di mappa',
                    layers: 'Livelli',
                    themes: 'Temi',
                    noData: 'Nessun dato disponibile'
                },
                'es': {
                    mapProperties: 'Propiedades del mapa',
                    projection: 'Proyección',
                    mapService: 'Servicio de mapa',
                    mapType: 'Tipo de mapa',
                    layers: 'Capas',
                    themes: 'Temas',
                    noData: 'No hay datos disponibles'
                }
            };
            
            const t = translations[language] || translations['en'];
            
            try {
                const project = this.getMapProjectJSON();
                const map = this.getMap();
                
                if (!project && !map) {
                    return '';
                }
                
                let html = `<div class="map-dependency-graph" style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff; font-family: 'Courier New', monospace; font-size: 13px;">\n`;
                html += `<div style="font-weight: bold; margin-bottom: 10px; color: #007bff;">📊 ${t.mapProperties}</div>\n`;
                
                // Map properties (projection, service, type)
                // All map properties are in project.map according to user
                const mapConfig = project?.map || {};
                
                // Get projection - try different possible property names
                let projection = mapConfig.mapProjection || 
                                mapConfig.projection || 
                                mapConfig.map || // Sometimes projection is stored as 'map' property
                                null;
                
                // Extract projection from map path if it's a path (e.g., "resources/maps/map_mercator.svg")
                if (projection && typeof projection === 'string' && projection.includes('/')) {
                    // Try to extract projection name from path
                    const match = projection.match(/(mercator|winkel|equalearth|albersequalarea|albers|robinson|mollweide)/i);
                    if (match) {
                        projection = match[1].toLowerCase();
                    }
                }
                
                // Get map service
                let mapService = mapConfig.mapService || 
                               mapConfig.service || 
                               null;
                
                // Get map type
                let mapType = mapConfig.mapType || 
                            mapConfig.maptype || 
                            mapConfig.type ||
                            mapConfig.basemap || // Sometimes basemap is used instead of mapType
                            null;
                
                // Fallback to N/A if still not found
                projection = projection || 'N/A';
                mapService = mapService || 'N/A';
                mapType = mapType || 'N/A';
                
                // Debug: log what we found
                if (project && project.map) {
                    console.log('🔍 Map dependency graph - project.map keys:', Object.keys(project.map));
                    console.log('🔍 Map dependency graph - project.map content:', project.map);
                } else {
                    console.log('🔍 Map dependency graph - No project.map found');
                }
                console.log('🔍 Map dependency graph - Final values:', { projection, mapService, mapType });
                
                html += `<div style="margin-left: 20px; margin-bottom: 8px;">\n`;
                html += `  <div style="color: #28a745;">├─ ${t.projection}: <span style="color: #333;">${projection}</span></div>\n`;
                html += `  <div style="color: #28a745;">├─ ${t.mapService}: <span style="color: #333;">${mapService}</span></div>\n`;
                html += `  <div style="color: #28a745;">└─ ${t.mapType}: <span style="color: #333;">${mapType}</span></div>\n`;
                html += `</div>\n`;
                
                // Layers
                const layers = project?.layers || [];
                if (layers.length > 0) {
                    html += `<div style="font-weight: bold; margin-top: 15px; margin-bottom: 10px; color: #007bff;">📁 ${t.layers} (${layers.length})</div>\n`;
                    html += `<div style="margin-left: 20px;">\n`;
                    layers.forEach((layer, idx) => {
                        const isLast = idx === layers.length - 1;
                        const prefix = isLast ? '└─' : '├─';
                        const layerName = layer.name || layer.id || `Layer ${idx + 1}`;
                        html += `  <div style="color: #ff9800;">${prefix} ${layerName}</div>\n`;
                    });
                    html += `</div>\n`;
                }
                
                // Themes are now shown in the "Available Themes" section, not here
                
                html += `</div>\n`;
                return html;
            } catch (e) {
                console.warn('Error generating dependency graph:', e);
                return '';
            }
        },
        
        /**
         * Generate themes structure (list of themes with types, 1-based numbering)
         * @param {String} language - Language code (e.g., 'en', 'de', 'fr')
         * @returns {String} HTML string with themes structure
         */
        generateThemesStructure: function(language = 'en') {
            const translations = {
                'en': {
                    themes: 'Themes'
                },
                'de': {
                    themes: 'Themes'
                },
                'fr': {
                    themes: 'Thèmes'
                },
                'it': {
                    themes: 'Temi'
                },
                'es': {
                    themes: 'Temas'
                }
            };
            
            const t = translations[language] || translations['en'];
            
            try {
                const map = this.getMap();
                
                if (!map) {
                    return '';
                }
                
                // Get themes - ALWAYS use map API (not project JSON) to ensure consistent list
                // This ensures the same themes list regardless of AI API status
                let themes = [];
                if (map && map.Api) {
                    try {
                        if (map.Themes && map.Themes.getThemes) {
                            themes = map.Themes.getThemes();
                        } else if (map.Api && map.Api.getAllThemes) {
                            themes = map.Api.getAllThemes();
                        }
                    } catch (e) {
                        console.warn('Error getting themes from map API:', e);
                    }
                }
                
                let html = `<div class="themes-structure" style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #9c27b0; font-family: 'Courier New', monospace; font-size: 13px;">\n`;
                html += `<div style="font-weight: bold; margin-bottom: 10px; color: #9c27b0;">🎨 ${t.themes} (${themes.length})</div>\n`;
                
                if (themes.length > 0) {
                    html += `<div style="margin-left: 20px;">\n`;
                    themes.forEach((theme, idx) => {
                        const isLast = idx === themes.length - 1;
                        const prefix = isLast ? '└─' : '├─';
                        
                        // Get theme type
                        let themeType = '';
                        if (theme.style && theme.style.type) {
                            themeType = theme.style.type;
                        } else if (theme.type) {
                            themeType = theme.type;
                        } else {
                            // Try to get from map API
                            try {
                                const themeId = theme.szId || theme.id || theme.name;
                                if (themeId && map && map.Api) {
                                    const themeDef = map.Api.getMapThemeDefinitionObj(themeId);
                                    if (themeDef && themeDef.style && themeDef.style.type) {
                                        themeType = themeDef.style.type;
                                    }
                                }
                            } catch (e) {
                                // Ignore
                            }
                        }
                        
                        // Use 1-based indexing (Theme 1, Theme 2, etc.)
                        const themeNumber = idx + 1;
                        html += `  <div style="color: #9c27b0;">${prefix} Theme ${themeNumber}`;
                        if (themeType) {
                            html += ` <span style="color: #666; font-size: 11px;">(${themeType})</span>`;
                        }
                        html += `</div>\n`;
                    });
                    html += `</div>\n`;
                } else {
                    html += `<div style="margin-left: 20px; color: #999;">No themes available</div>\n`;
                }
                
                html += `</div>\n`;
                return html;
            } catch (e) {
                console.warn('Error generating themes structure:', e);
                return '';
            }
        },
        
        /**
         * Format combined map info (themes + bindings)
         * @param {Object} discovery - Discovery object from ixmaps.aiExplorer.discover()
         * @param {Object} bindingInfo - Binding info object from getBindingInfo()
         * @param {String} language - Language code (e.g., 'en', 'de', 'fr')
         * @param {Boolean} showDetails - If true, show full details; if false, show summary only
         * @param {Boolean} showStatistics - If true, include data statistics section; if false, omit statistics (default: false)
         * @returns {String} Combined formatted response
         */
        formatMapInfo: async function(discovery, bindingInfo, language = 'en', showDetails = false, showStatistics = false) {
            console.log('📊 formatMapInfo called with showDetails:', showDetails, 'showStatistics:', showStatistics);
            console.log('📊 discovery.summary:', discovery?.summary?.substring(0, 100));
            console.log('📊 bindingInfo.summary:', bindingInfo?.summary?.substring(0, 100));
            
            const translations = {
                'en': {
                    title: 'Map Information',
                    themesSection: 'Available Themes',
                    bindingsSection: 'Data Bindings and Usage',
                    intro: 'Here is an overview of the map, including all available themes and how data fields are used.',
                    summaryIntro: 'Here is a summary of the map:',
                    themeCount: 'theme(s)',
                    fieldCount: 'field(s)',
                    askForDetails: 'Would you like to see detailed information about themes and data bindings?',
                    showDetails: 'Show detailed information',
                    yes: 'Yes',
                    no: 'No'
                },
                'de': {
                    title: 'Karteninformationen',
                    themesSection: 'Verfügbare Themes',
                    bindingsSection: 'Datenbindungen und Verwendung',
                    intro: 'Hier ist eine Übersicht über die Karte, einschließlich aller verfügbaren Themes und wie Datenfelder verwendet werden.',
                    summaryIntro: 'Hier ist eine Zusammenfassung der Karte:',
                    themeCount: 'Theme(s)',
                    fieldCount: 'Feld(er)',
                    askForDetails: 'Möchten Sie detaillierte Informationen zu Themes und Datenbindungen sehen?',
                    showDetails: 'Detaillierte Informationen anzeigen',
                    yes: 'Ja',
                    no: 'Nein'
                },
                'fr': {
                    title: 'Informations sur la carte',
                    themesSection: 'Thèmes disponibles',
                    bindingsSection: 'Liaisons de données et utilisation',
                    intro: 'Voici un aperçu de la carte, y compris tous les thèmes disponibles et comment les champs de données sont utilisés.',
                    summaryIntro: 'Voici un résumé de la carte:',
                    themeCount: 'thème(s)',
                    fieldCount: 'champ(s)',
                    askForDetails: 'Souhaitez-vous voir des informations détaillées sur les thèmes et les liaisons de données?',
                    showDetails: 'Afficher les informations détaillées',
                    yes: 'Oui',
                    no: 'Non'
                },
                'it': {
                    title: 'Informazioni sulla mappa',
                    themesSection: 'Temi disponibili',
                    bindingsSection: 'Collegamenti dati e utilizzo',
                    intro: 'Ecco una panoramica della mappa, inclusi tutti i temi disponibili e come vengono utilizzati i campi dati.',
                    summaryIntro: 'Ecco un riepilogo della mappa:',
                    themeCount: 'tema/i',
                    fieldCount: 'campo/i',
                    askForDetails: 'Vuoi vedere informazioni dettagliate su temi e collegamenti dati?',
                    showDetails: 'Mostra informazioni dettagliate',
                    yes: 'Sì',
                    no: 'No'
                },
                'es': {
                    title: 'Información del mapa',
                    themesSection: 'Temas disponibles',
                    bindingsSection: 'Enlaces de datos y uso',
                    intro: 'Aquí hay una descripción general del mapa, incluidos todos los temas disponibles y cómo se utilizan los campos de datos.',
                    summaryIntro: 'Aquí hay un resumen del mapa:',
                    themeCount: 'tema(s)',
                    fieldCount: 'campo(s)',
                    askForDetails: '¿Le gustaría ver información detallada sobre temas y enlaces de datos?',
                    showDetails: 'Mostrar información detallada',
                    yes: 'Sí',
                    no: 'No'
                },
                'pt': {
                    title: 'Informações do mapa',
                    themesSection: 'Temas disponíveis',
                    bindingsSection: 'Ligações de dados e uso',
                    intro: 'Aqui está uma visão geral do mapa, incluindo todos os temas disponíveis e como os campos de dados são usados.',
                    summaryIntro: 'Aqui está um resumo do mapa:',
                    themeCount: 'tema(s)',
                    fieldCount: 'campo(s)',
                    askForDetails: 'Gostaria de ver informações detalhadas sobre temas e ligações de dados?',
                    showDetails: 'Mostrar informações detalhadas',
                    yes: 'Sim',
                    no: 'Não'
                },
                'nl': {
                    title: 'Kaartinformatie',
                    themesSection: 'Beschikbare thema\'s',
                    bindingsSection: 'Gegevenskoppelingen en gebruik',
                    intro: 'Hier is een overzicht van de kaart, inclusief alle beschikbare thema\'s en hoe gegevensvelden worden gebruikt.',
                    summaryIntro: 'Hier is een samenvatting van de kaart:',
                    themeCount: 'thema(\'s)',
                    fieldCount: 'veld(en)',
                    askForDetails: 'Wilt u gedetailleerde informatie over thema\'s en gegevenskoppelingen zien?',
                    showDetails: 'Gedetailleerde informatie tonen',
                    yes: 'Ja',
                    no: 'Nee'
                },
                'ru': {
                    title: 'Информация о карте',
                    themesSection: 'Доступные темы',
                    bindingsSection: 'Привязки данных и использование',
                    intro: 'Вот обзор карты, включая все доступные темы и то, как используются поля данных.',
                    summaryIntro: 'Вот краткое описание карты:',
                    themeCount: 'тема(ы)',
                    fieldCount: 'поле(я)',
                    askForDetails: 'Хотите ли вы увидеть подробную информацию о темах и привязках данных?',
                    showDetails: 'Показать подробную информацию',
                    yes: 'Да',
                    no: 'Нет'
                }
            };
            
            const t = translations[language] || translations['en'];
            
            // If showing summary only
            if (!showDetails) {
                let summary = `# ${t.title}\n\n`;
                
                // Try to get AI-generated description
                try {
                    console.log('🔍 Attempting to generate map description with Gemini...');
                    const aiDescription = await this.generateMapDescription(language);
                    console.log('📝 Generated description:', aiDescription);
                    if (aiDescription) {
                        summary += `${aiDescription}\n\n`;
                    } else {
                        console.warn('⚠️ No description generated by Gemini');
                    }
                } catch (e) {
                    console.error('❌ Error generating AI description:', e);
                    // If AI description fails, continue with manual summary
                }
                
                summary += `${t.summaryIntro}\n\n`;
                
                // Add dependency graph showing map structure
                const dependencyGraph = this.generateMapDependencyGraph(language);
                if (dependencyGraph) {
                    summary += dependencyGraph;
                    summary += `\n\n`;
                }
                
                // Count themes and total fields
                const themeCount = discovery && discovery.themes ? discovery.themes.length : 0;
                let totalFields = 0;
                const themeNames = [];
                
                if (discovery && discovery.themes) {
                    discovery.themes.forEach(theme => {
                        totalFields += theme.fieldCount || 0;
                        const themeName = theme.name || 'Unknown';
                        themeNames.push(themeName);
                    });
                }
                
                summary += `- **${themeCount}** ${t.themeCount} available\n`;
                summary += `- **${totalFields}** total data ${t.fieldCount}\n\n`;
                
                if (themeNames.length > 0) {
                    summary += `**Themes:** ${themeNames.slice(0, 5).join(', ')}`;
                    if (themeNames.length > 5) {
                        summary += `, and ${themeNames.length - 5} more`;
                    }
                    summary += `\n\n`;
                }
                
                // Add button to show details
                summary += `${t.askForDetails}\n\n`;
                summary += `<button data-action="show-map-details" class="show-map-details-btn" style="margin: 5px; padding: 6px 16px; background: #f5f5f5; color: #666; border: 0.5px solid #e0e0e0; border-radius: 12px; cursor: pointer; font-size: 13px;">${t.showDetails}</button>\n\n`;
                summary += `*Or type "yes" or "more info" to see detailed information.*`;
                
                return summary;
            }
            
            // Build full detailed response
            let response = `# ${t.title}\n\n`;
            
            // Try to get AI-generated description for detailed view too
            try {
                console.log('🔍 Attempting to generate map description with Gemini for detailed view...');
                const aiDescription = await this.generateMapDescription(language);
                console.log('📝 Generated description for detailed view:', aiDescription);
                if (aiDescription) {
                    response += `${aiDescription}\n\n`;
                }
            } catch (e) {
                console.error('❌ Error generating AI description for detailed view:', e);
                // Continue without AI description
            }
            
            response += `${t.intro}\n\n`;
            
            // Add dependency graph showing map structure
            const dependencyGraph = this.generateMapDependencyGraph(language);
            if (dependencyGraph) {
                response += `## Map Structure\n\n`;
                response += dependencyGraph;
                response += `\n\n`;
            }
            
            // Add themes section (from discovery) - include full details
            // Regenerate discovery summary with isFullContext=true to hide "more ..." button
            response += `## ${t.themesSection}\n\n`;
            
            if (discovery && discovery.schemas) {
                // Regenerate the summary with isFullContext=true to hide "more ..." button
                const showDataForThemes = discovery.summary && discovery.summary.includes('data field');
                
                // Only add themes structure when using generateSummary (not generateThemeDefinitions, which includes it already)
                if (showDataForThemes) {
                    const themesStructure = this.generateThemesStructure(language);
                    if (themesStructure) {
                        response += themesStructure;
                        response += `\n\n`;
                    }
                }
                
                const themesContent = showDataForThemes 
                    ? ixmaps.aiExplorer.generateSummary(discovery.schemas, language, true)
                    : ixmaps.aiExplorer.generateThemeDefinitions(discovery.schemas, language, true);
                // Remove the "I found X data theme(s)" or "I found X theme(s)" header if present
                let cleanedContent = themesContent.replace(/^#.*\n\n/, '');
                cleanedContent = cleanedContent.replace(/^I found \d+ (data )?theme\(s\)( available)?( on this map)?:\n\n/i, '');
                cleanedContent = cleanedContent.replace(/^I found.*\n\n/, '');
                response += cleanedContent;
            } else if (discovery && discovery.summary) {
                // Fallback: use existing summary if schemas not available
                let themesContent = discovery.summary;
                // Remove the "I found X data theme(s)" or "I found X theme(s)" header if present
                themesContent = themesContent.replace(/^#.*\n\n/, '');
                themesContent = themesContent.replace(/^I found \d+ (data )?theme\(s\)( available)?( on this map)?:\n\n/i, '');
                themesContent = themesContent.replace(/^I found.*\n\n/, '');
                // Remove "more ..." buttons from existing summary
                themesContent = themesContent.replace(/<button[^>]*data-action="more-actions"[^>]*>.*?<\/button>/gi, '');
                response += themesContent;
            } else {
                response += '*No theme information available.*\n\n';
            }
            
            // Add statistics section ONLY if explicitly requested
            if (showStatistics) {
                try {
                    const statisticsInfo = await this.getStatistics(discovery.schemas || [], language);
                    if (statisticsInfo && statisticsInfo.summary) {
                        response += `\n## Data Statistics\n\n`;
                        // Remove header from statistics summary if present
                        let statsContent = statisticsInfo.summary;
                        statsContent = statsContent.replace(/^#.*\n\n/, '');
                        statsContent = statsContent.replace(/^##.*\n\n/, '');
                        response += statsContent;
                    }
                } catch (e) {
                    console.warn('⚠️ Could not get statistics for detailed view:', e);
                    // Continue without statistics
                }
            }
            
            // Add bindings section
            response += `\n## ${t.bindingsSection}\n\n`;
            if (bindingInfo && bindingInfo.summary) {
                // Extract bindings part from binding summary (skip the header if present)
                let bindingsContent = bindingInfo.summary;
                // Remove the "# Data Bindings and Usage" header if present
                bindingsContent = bindingsContent.replace(/^#.*\n\n/, '');
                bindingsContent = bindingsContent.replace(/^Found.*\n\n/, '');
                response += bindingsContent;
            } else {
                response += '*No binding information available.*\n\n';
            }
            
            return response;
        },
        
        /**
         * Show detailed map information (called when user clicks "Show details" button)
         * This will trigger a new query to get full details
         */
        showMapDetails: function() {
            // Trigger a new query to get full map info with details
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                chatInput.value = 'show map details';
                // Trigger the chat message handler
                const sendButton = document.getElementById('sendButton');
                if (sendButton) {
                    sendButton.click();
                } else if (typeof handleChatMessage === 'function') {
                    handleChatMessage();
                } else if (window.handleChatMessage) {
                    window.handleChatMessage();
                }
            } else {
                // Fallback: try to find chat input by other means
                const inputs = document.querySelectorAll('input[type="text"], textarea');
                for (let input of inputs) {
                    if (input.placeholder && (input.placeholder.toLowerCase().includes('message') || input.placeholder.toLowerCase().includes('query'))) {
                        input.value = 'show map details';
                        const event = new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
                        input.dispatchEvent(event);
                        break;
                    }
                }
            }
        },
        
        /**
         * Open table view for a specific theme
         * @param {String} themeId - Theme ID to show in table
         */
        openThemeTable: function(themeId) {
            const map = this.getMap();
            if (!map || !map.Api) {
                console.warn('⚠️ Map API not available');
                return;
            }
            
            try {
                // Get the theme object
                const themeObj = map.Api.getTheme(themeId);
                if (!themeObj || !themeObj.objTheme) {
                    console.warn('⚠️ Theme not found or has no data:', themeId);
                    return;
                }
                
                // Store theme in temporary variable for table_new.html to access
                // table_new.html uses ixmaps.getThemes().at(-1), so we need to ensure this theme is accessible
                // We'll store it in a temporary location that table_new.html can use
                if (!window.ixmaps) {
                    window.ixmaps = {};
                }
                if (!window.ixmaps.tmp) {
                    window.ixmaps.tmp = {};
                }
                
                // Create a Data.Table object from theme data (following table_new.html pattern)
                const tableObj = new Data.Table(null);
                tableObj.table = themeObj.objTheme.dbTable;
                tableObj.fields = themeObj.objTheme.dbFields;
                tableObj.records = themeObj.objTheme.dbRecords;
                
                // Store in temporary location with a flag to indicate it's pre-prepared
                // This will be used by table_new.html to skip the default theme selection
                window.ixmaps.tmp.tableObj = tableObj;
                window.ixmaps.tmp.themeId = themeId;
                window.ixmaps.tmp.usePreparedTable = true; // Flag to tell table_new.html to use our prepared table
                
                // Open the table dialog
                // After opening, we need to ensure the table object is set after document.ready
                // We'll use a delayed callback to override the default behavior
                const setTableAfterReady = () => {
                    setTimeout(() => {
                        if (window.ixmaps && window.ixmaps.tmp && window.ixmaps.tmp.tableObj && window.ixmaps.tmp.usePreparedTable) {
                            // Override the table object that might have been set by document.ready
                            // The __showTable function will use this
                            console.log('✅ Using prepared table object for theme:', themeId);
                        }
                    }, 100);
                };
                
                if (window.ixmaps && window.ixmaps.viewTable) {
                    window.ixmaps.viewTable('dialog', '10,103');
                    setTableAfterReady();
                } else if (window.ixmaps && window.ixmaps.embeddedSVG && window.ixmaps.embeddedSVG.window && window.ixmaps.embeddedSVG.window.ixmaps) {
                    // Try accessing through embedded SVG
                    const embeddedIxmaps = window.ixmaps.embeddedSVG.window.ixmaps;
                    if (embeddedIxmaps.viewTable) {
                        embeddedIxmaps.viewTable('dialog', '10,103');
                        setTableAfterReady();
                    } else {
                        console.warn('⚠️ viewTable function not available');
                    }
                } else {
                    console.warn('⚠️ ixmaps.viewTable not available');
                }
            } catch (e) {
                console.error('❌ Error opening theme table:', e);
            }
        }
    };
    
    /**
     * Conversational AI Interface
     * Maintains context across multiple queries
     */
    ixmaps.aiConversation = {
        context: {
            currentView: null,
            selectedItems: [],
            queryHistory: [],
            activeThemes: []
        },
        
        /**
         * Ask a question in conversational context
         * @param {String} question - Natural language question
         * @param {Object} options - Query options
         * @returns {Promise} Response with results
         */
        ask: function(question, options) {
            options = options || {};
            
            return new Promise((resolve, reject) => {
                try {
                    // Enhance query with context
                    const contextualQuery = this.enhanceWithContext(question);
                    
                    // Execute query
                    ixmaps.aiQuery.ask(contextualQuery, {
                        ...options,
                        theme: this.context.activeThemes[0]
                    }).then(result => {
                        // Update context
                        this.context.selectedItems = result.items;
                        this.context.queryHistory.push({
                            question: question,
                            query: contextualQuery,
                            results: result
                        });
                        
                        // Check if query contains "goto", "go to", or "focus on" - these should always zoom
                        const questionLower = (question || '').toLowerCase();
                        const hasGotoOrFocus = /(?:goto|go\s+to|focus\s+on)/i.test(question);
                        
                        // Visualize results
                        if (options.visualize !== false) {
                            ixmaps.aiQuery.visualizeResults(result.items, {
                                highlight: true,
                                zoomToResults: hasGotoOrFocus || result.count <= 10
                            }, {
                                originalQuery: question,
                                hasGotoOrFocus: hasGotoOrFocus
                            });
                        }
                        
                        resolve(result);
                    }).catch(reject);
                } catch (error) {
                    reject(error);
                }
            });
        },
        
        /**
         * Enhance query with conversation context
         * @param {String} question - Original question
         * @returns {String} Enhanced query
         */
        enhanceWithContext: function(question) {
            // In production, use LLM to understand context
            // For now, simple enhancement
            
            let enhanced = question;
            
            // If previous query selected items, reference them
            if (this.context.selectedItems.length > 0) {
                if (question.toLowerCase().includes('these') || 
                    question.toLowerCase().includes('them') ||
                    question.toLowerCase().includes('selected')) {
                    // User is referring to previously selected items
                    // In production, would expand query to include selected item IDs
                }
            }
            
            return enhanced;
        },
        
        /**
         * Clear conversation context
         */
        clear: function() {
            this.context = {
                currentView: null,
                selectedItems: [],
                queryHistory: [],
                activeThemes: []
            };
        }
    };
    
    /**
     * Data Exploration Assistant
     * Helps users discover available data
     */
    ixmaps.aiExplorer = {
        /**
         * Discover available data
         * @param {Array} schemas - Optional schemas to use (if already retrieved)
         * @returns {Object} Discovery report
         */
        discover: function(schemas, language = 'en', showData = false) {
            if (!schemas) {
                schemas = ixmaps.aiQuery.getAvailableSchemas();
            }
            
            if (schemas.length === 0) {
                return {
                    themes: [],
                    summary: "No data themes available. The map may still be loading, or no data layers have been added."
                };
            }
            
            // Log for debugging
            console.log('🔍 aiExplorer.discover called with showData:', showData);
            console.log('🔍 Will generate:', showData ? 'DATA (fields)' : 'DEFINITIONS (type, binding, style)');
            
            const report = {
                themes: schemas.map(schema => ({
                    name: schema.theme,
                    fieldCount: schema.fields.length,
                    fields: schema.fields,
                    sampleData: schema.sampleValues,
                    hasData: schema.hasData || false
                })),
                summary: showData ? this.generateSummary(schemas, language, false) : this.generateThemeDefinitions(schemas, language, false)
            };
            
            console.log('🔍 Generated summary preview:', report.summary.substring(0, 200));
            
            return report;
        },
        
        /**
         * Generate theme definitions summary (type, style, binding, etc.)
         * @param {Array} schemas - Available schemas
         * @param {String} language - Language code (e.g., 'en', 'de', 'fr')
         * @returns {String} Summary text
         */
        generateThemeDefinitions: function(schemas, language = 'en', isFullContext = false) {
            const map = ixmaps.aiQuery.getMap();
            if (!map || !map.Api) {
                return "❌ Unable to access map API to retrieve theme definitions.";
            }

            const translations = {
                'en': {
                    found: 'I found',
                    themes: 'theme(s)',
                    type: 'Type',
                    binding: 'Binding',
                    style: 'Style',
                    layer: 'Layer',
                    filter: 'Filter',
                    visualizationSettings: 'Visualization Settings',
                    dataSource: 'Data Source',
                    noDefinition: 'No definition available'
                },
                'it': {
                    found: 'Ho trovato',
                    themes: 'tema/i',
                    type: 'Tipo',
                    binding: 'Binding',
                    style: 'Stile',
                    layer: 'Layer',
                    filter: 'Filtro',
                    visualizationSettings: 'Impostazioni visualizzazione',
                    dataSource: 'Fonte Dati',
                    noDefinition: 'Nessuna definizione disponibile'
                },
                'de': {
                    found: 'Ich habe',
                    themes: 'Theme(s)',
                    type: 'Typ',
                    binding: 'Binding',
                    style: 'Stil',
                    layer: 'Layer',
                    filter: 'Filter',
                    visualizationSettings: 'Visualisierungseinstellungen',
                    dataSource: 'Datenquelle',
                    noDefinition: 'Keine Definition verfügbar'
                },
                'fr': {
                    found: 'J\'ai trouvé',
                    themes: 'thème(s)',
                    type: 'Type',
                    binding: 'Binding',
                    style: 'Style',
                    layer: 'Couche',
                    filter: 'Filtre',
                    visualizationSettings: 'Paramètres de visualisation',
                    dataSource: 'Source de données',
                    noDefinition: 'Aucune définition disponible'
                },
                'es': {
                    found: 'Encontré',
                    themes: 'tema(s)',
                    type: 'Tipo',
                    binding: 'Binding',
                    style: 'Estilo',
                    layer: 'Capa',
                    filter: 'Filtro',
                    visualizationSettings: 'Configuración de visualización',
                    dataSource: 'Fuente de datos',
                    noDefinition: 'No hay definición disponible'
                }
            };

            const t = translations[language] || translations['en'];
            let summary = `${t.found} ${schemas.length} ${t.themes}:\n\n`;
            
            // Add themes structure at the top
            const themesStructure = ixmaps.aiQuery.generateThemesStructure(language);
            if (themesStructure) {
                summary += themesStructure;
                summary += `\n\n`;
            }

            schemas.forEach((schema, idx) => {
                // Get theme ID (szId) - this is what users need to reference themes
                const themeId = schema.theme;
                
                // Get theme name and replace [title] placeholder with actual theme name
                let themeName = schema.themeTitle || schema.theme;
                // Replace [title] placeholder with actual theme name or ID
                if (themeName === '[title]' || themeName.includes('[title]')) {
                    themeName = schema.theme || 'Theme';
                }
                // Clean up any remaining [title] references
                themeName = themeName.replace(/\[title\]/g, schema.theme || 'Theme');
                
                // Show theme ID as the title, with theme name in parentheses if different
                const titleDisplay = themeName !== themeId 
                    ? `${themeId} (${themeName})` 
                    : themeId;
                
                // Use 1-based indexing for theme references (theme1, theme2, etc.)
                const themeNumber = idx + 1;
                summary += `<h4>${themeNumber}. ${titleDisplay} (\`theme${themeNumber}\` or \`theme ${themeNumber}\`)</h4>\n\n`;
                summary += `<div style="margin-left: 20px; margin-bottom: 20px;">\n`;

                try {
                    const themeDef = map.Api.getMapThemeDefinitionObj ? map.Api.getMapThemeDefinitionObj(schema.theme) : null;
                    
                    if (themeDef) {
                        // Layer
                        let layerName = '';
                        if (themeDef.layer) {
                            layerName = themeDef.layer;
                        } else {
                            // Try to get from theme object using getThemeLayerName method
                            try {
                                layerName = ixmaps.aiQuery.getThemeLayerName ? ixmaps.aiQuery.getThemeLayerName(schema.theme) : '';
                            } catch (e) {
                                // Fallback: try to get from theme object directly
                                const themeObj = map.Api.getTheme ? map.Api.getTheme(schema.theme) : null;
                                if (themeObj) {
                                    if (themeObj.theme && themeObj.theme.szLayer) {
                                        layerName = themeObj.theme.szLayer;
                                    } else if (themeObj.szLayer) {
                                        layerName = themeObj.szLayer;
                                    }
                                }
                            }
                        }
                        if (layerName && layerName !== 'unknown' && layerName !== '') {
                            summary += `<strong>${t.layer}</strong>: ${layerName}\n\n`;
                        }

                        // Type
                        if (themeDef.style && themeDef.style.type) {
                            summary += `<strong>${t.type}</strong>: ${themeDef.style.type}\n\n`;
                        }

                        // Binding
                        if (themeDef.binding) {
                            const bindingParts = [];
                            if (themeDef.binding.geo) bindingParts.push(`geo: ${themeDef.binding.geo}`);
                            if (themeDef.binding.value) bindingParts.push(`value: ${themeDef.binding.value}`);
                            if (themeDef.binding.size) bindingParts.push(`size: ${themeDef.binding.size}`);
                            if (themeDef.binding.title) bindingParts.push(`title: ${themeDef.binding.title}`);
                            if (themeDef.binding.text) bindingParts.push(`text: ${themeDef.binding.text}`);
                            if (bindingParts.length > 0) {
                                summary += `<strong>${t.binding}</strong>: ${bindingParts.join(', ')}\n\n`;
                            }
                        }

                        // Style properties (key ones)
                        if (themeDef.style) {
                            const styleParts = [];
                            if (themeDef.style.colorscheme) {
                                const cs = themeDef.style.colorscheme;
                                if (Array.isArray(cs)) {
                                    // Format colorscheme array properly for markdown
                                    const colorList = cs.map(c => {
                                        // Convert to string if needed
                                        const colorStr = String(c);
                                        // If color starts with #, keep it; otherwise wrap in quotes if needed
                                        return colorStr.startsWith('#') ? colorStr : (colorStr.includes(' ') ? `"${colorStr}"` : colorStr);
                                    }).join(', ');
                                    styleParts.push(`colorscheme: [${colorList}]`);
                                } else {
                                    styleParts.push(`colorscheme: ${cs}`);
                                }
                            }
                            if (themeDef.style.fillopacity) styleParts.push(`fillopacity: ${themeDef.style.fillopacity}`);
                            if (themeDef.style.scale) styleParts.push(`scale: ${themeDef.style.scale}`);
                            if (themeDef.style.visible !== undefined) styleParts.push(`visible: ${themeDef.style.visible}`);
                            if (styleParts.length > 0) {
                                summary += `<strong>${t.style}</strong>: ${styleParts.join(', ')}\n\n`;
                            }
                        }

                        // Visualization Settings - only show in long version (isFullContext)
                        if (isFullContext) {
                            const visualizationParts = [];
                            
                            // Filter
                            if (themeDef.filter) {
                                visualizationParts.push(`filter: ${themeDef.filter}`);
                            }
                            // Also check style.filter (some themes store filter in style)
                            if (themeDef.style && themeDef.style.filter && !themeDef.filter) {
                                visualizationParts.push(`filter: ${themeDef.style.filter}`);
                            }

                            // Chart upper and lower bounds
                            if (themeDef.style && themeDef.style.chartupper !== undefined) {
                                visualizationParts.push(`chartupper: ${themeDef.style.chartupper}`);
                            }
                            if (themeDef.style && themeDef.style.chartlower !== undefined) {
                                visualizationParts.push(`chartlower: ${themeDef.style.chartlower}`);
                            }
                            
                            if (visualizationParts.length > 0) {
                                summary += `<strong>${t.visualizationSettings}</strong>: ${visualizationParts.join(', ')}\n\n`;
                            }
                        }

                        // Data source
                        if (themeDef.data && themeDef.data.url) {
                            summary += `<strong>${t.dataSource}</strong>: ${themeDef.data.url}\n\n`;
                        }
                        
                        // Add action buttons (include "more" button only if NOT in full context)
                        const themeId = schema.theme;
                        summary += `<button data-action="show-data" data-theme-id="${themeId}" style="margin: 2px; padding: 4px 12px; background: #f5f5f5; color: #666; border: 0.5px solid #e0e0e0; border-radius: 12px; cursor: pointer; font-size: 12px;">📊 Show Data</button> `;
                        summary += `<button data-action="show-facets" data-theme-id="${themeId}" style="margin: 2px; padding: 4px 12px; background: #f5f5f5; color: #666; border: 0.5px solid #e0e0e0; border-radius: 12px; cursor: pointer; font-size: 12px;">📈 Show Facets</button> `;
                        summary += `<button data-action="edit-theme" data-theme-id="${themeId}" style="margin: 2px; padding: 4px 12px; background: #f5f5f5; color: #666; border: 0.5px solid #e0e0e0; border-radius: 12px; cursor: pointer; font-size: 12px;">✏️ Edit</button>`;
                        if (!isFullContext) {
                            summary += ` <button data-action="more-actions" data-theme-id="${themeId}" style="margin: 2px; padding: 4px 12px; background: #f5f5f5; color: #666; border: 0.5px solid #e0e0e0; border-radius: 12px; cursor: pointer; font-size: 12px;">more ...</button>`;
                        }
                        summary += `\n\n`;
                    } else {
                        summary += `${t.noDefinition}\n\n`;
                    }
                } catch (e) {
                    console.warn(`Could not get definition for theme ${schema.theme}:`, e);
                    summary += `${t.noDefinition}\n\n`;
                }

                summary += `</div>\n\n`;
            });

            return summary;
        },

        /**
         * Generate natural language summary of available data with full field lists
         * @param {Array} schemas - Available schemas
         * @param {String} language - Language code (e.g., 'en', 'de', 'fr')
         * @returns {String} Summary text
         */
        generateSummary: function(schemas, language = 'en', isFullContext = false) {
            const translations = {
                'en': {
                    found: 'I found',
                    dataThemes: 'data theme(s) available',
                    dataFields: 'data field(s)',
                    dataFieldsList: 'Data fields',
                    sampleValues: 'Sample values'
                },
                'de': {
                    found: 'Ich habe',
                    dataThemes: 'Daten-Theme(s) gefunden',
                    dataFields: 'Datenfeld(er)',
                    dataFieldsList: 'Datenfelder',
                    sampleValues: 'Beispielwerte'
                },
                'fr': {
                    found: 'J\'ai trouvé',
                    dataThemes: 'thème(s) de données disponible(s)',
                    dataFields: 'champ(s) de données',
                    dataFieldsList: 'Champs de données',
                    sampleValues: 'Valeurs d\'exemple'
                },
                'it': {
                    found: 'Ho trovato',
                    dataThemes: 'tema/i di dati disponibili',
                    dataFields: 'campo/i di dati',
                    dataFieldsList: 'Campi di dati',
                    sampleValues: 'Valori di esempio'
                },
                'es': {
                    found: 'Encontré',
                    dataThemes: 'tema(s) de datos disponible(s)',
                    dataFields: 'campo(s) de datos',
                    dataFieldsList: 'Campos de datos',
                    sampleValues: 'Valores de ejemplo'
                }
            };
            
            const t = translations[language] || translations['en'];
            let summary = `${t.found} ${schemas.length} ${t.dataThemes}:\n\n`;
            
            schemas.forEach((schema, idx) => {
                // Get theme name and replace [title] placeholder with actual theme name
                let themeName = schema.themeTitle || schema.theme;
                // Replace [title] placeholder with actual theme name or ID
                if (themeName === '[title]' || themeName.includes('[title]')) {
                    themeName = schema.theme || 'Theme';
                }
                // Clean up any remaining [title] references
                themeName = themeName.replace(/\[title\]/g, schema.theme || 'Theme');
                
                // Use HTML h4 tag to prevent markdown from interpreting as numbered list
                // This ensures proper nesting and prevents continuous numbering
                // The HTML will be preserved by DOMPurify (h4 is in ALLOWED_TAGS)
                summary += `<h4>${idx + 1}. ${themeName}</h4>\n\n`;
                // Indent the content that follows the theme title
                summary += `<div style="margin-left: 20px;">\n`;
                summary += `${schema.fields.length} ${t.dataFields}\n\n`;
                
                if (schema.fields.length > 0) {
                    const themeId = schema.theme;
                    summary += `**${t.dataFieldsList}:** ${schema.fields.join(', ')}\n\n`;
                    summary += `<button data-action="show-data" data-theme-id="${themeId}" style="margin: 2px; padding: 4px 12px; background: #f5f5f5; color: #666; border: 0.5px solid #e0e0e0; border-radius: 12px; cursor: pointer; font-size: 12px;">📊 Show Data</button> `;
                    summary += `<button data-action="show-facets" data-theme-id="${themeId}" style="margin: 2px; padding: 4px 12px; background: #f5f5f5; color: #666; border: 0.5px solid #e0e0e0; border-radius: 12px; cursor: pointer; font-size: 12px;">📈 Show Facets</button> `;
                    summary += `<button data-action="edit-theme" data-theme-id="${themeId}" style="margin: 2px; padding: 4px 12px; background: #f5f5f5; color: #666; border: 0.5px solid #e0e0e0; border-radius: 12px; cursor: pointer; font-size: 12px;">✏️ Edit</button>`;
                    if (!isFullContext) {
                        summary += ` <button data-action="more-actions" data-theme-id="${themeId}" style="margin: 2px; padding: 4px 12px; background: #f5f5f5; color: #666; border: 0.5px solid #e0e0e0; border-radius: 12px; cursor: pointer; font-size: 12px;">more ...</button>`;
                    }
                    summary += `\n\n`;
                }
                
                // Show sample values for first few fields if available
                if (schema.sampleValues && Object.keys(schema.sampleValues).length > 0) {
                    const sampleFields = Object.keys(schema.sampleValues).slice(0, 3);
                    if (sampleFields.length > 0) {
                        summary += `${t.sampleValues}:\n\n`;
                        sampleFields.forEach(field => {
                            const samples = schema.sampleValues[field];
                            if (samples && samples.length > 0) {
                                const sampleStr = samples.slice(0, 3).join(', ');
                                summary += `• ${field}: ${sampleStr}`;
                                if (samples.length > 3) {
                                    summary += `, ...`;
                                }
                                summary += `\n`;
                            }
                        });
                        summary += `\n`;
                    }
                }
                
                summary += `</div>\n\n`;
            });
            
            return summary;
        },
        
        /**
         * Suggest queries based on available data
         * @returns {Array} Suggested queries
         */
        suggestQueries: function() {
            const schemas = ixmaps.aiQuery.getAvailableSchemas();
            const suggestions = [];
            
            schemas.forEach(schema => {
                // Look for numeric fields for comparison queries
                schema.fields.forEach(field => {
                    const fieldLower = field.toLowerCase();
                    if (fieldLower.includes('population') || 
                        fieldLower.includes('pop')) {
                        suggestions.push({
                            query: `Show me all ${schema.theme} with population over 100,000`,
                            description: `Find features with high population`
                        });
                    }
                    if (fieldLower.includes('area') || 
                        fieldLower.includes('size')) {
                        suggestions.push({
                            query: `Which ${schema.theme} has the largest area?`,
                            description: `Find the largest feature by area`
                        });
                    }
                });
            });
            
            return suggestions.slice(0, 5); // Return top 5 suggestions
        }
    };

})(window.ixmaps || (window.ixmaps = {}));

/**
 * Usage Examples:
 * 
 * // Simple query
 * ixmaps.aiQuery.ask("Show me all cities with population over 100,000")
 *     .then(result => {
 *         console.log(result.response);
 *         ixmaps.aiQuery.visualizeResults(result.items);
 *     });
 * 
 * // Conversational query
 * ixmaps.aiConversation.ask("What regions have high unemployment?")
 *     .then(result => {
 *         console.log(result.response);
 *     });
 * 
 * // Follow-up query
 * ixmaps.aiConversation.ask("Show me more details about these")
 *     .then(result => {
 *         console.log(result.response);
 *     });
 * 
 * // Data exploration
 * const discovery = ixmaps.aiExplorer.discover();
 * console.log(discovery.summary);
 * 
 * const suggestions = ixmaps.aiExplorer.suggestQueries();
 * console.log("You could ask:", suggestions);
 */

