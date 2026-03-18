/** 
 * @fileoverview This file provides functions for facet filtering
 *
 * @author Guenter Richter guenter.richter@medienobjekte.de
 * @version 2.0 
 * @copyright CC BY SA
 * @license MIT
 */

ixmaps = ixmaps || {};
ixmaps.data = ixmaps.data || {};

(function () {

	// ===========================================
	//
	// C O N F I G U R A T I O N
	//
	// ===========================================

	const FACET_CONFIG = {
		MAX_SAMPLE_SIZE: 250,
		MAX_UNIQUE_FOR_TEXT_FACET: 50,
		MAX_VALUES_TO_DISPLAY: 200,
		UNIQUE_THRESHOLD_RATIO: 0.5,
		RETRY_DELAY_MS: 1000
	};

	// ===========================================
	//
	// M O D U L E   S T A T E
	//
	// ===========================================

	let facetFilters = [];
	let ranges = new Map();

	// ===========================================
	//
	// H E L P E R   F U N C T I O N S
	//
	// ===========================================

	/**
	 * Get unique values from array using Set (O(n) complexity)
	 * @param {Array} array - Input array
	 * @returns {Array} Array of unique values
	 */
	const getUniqueValues = (array) => {
		return [...new Set(array)];
	};

	/**
	 * Parse formatted number values (handles various formats)
	 * @param {*} value - Value to parse
	 * @returns {number|string} Parsed number or "date" string
	 */
	const scanValue = (value) => {
		const str = String(value);

		if (str.match(/:/)) {
			return "date";
		}

		// Handle comma as decimal separator (e.g., European format)
		if (str.match(/,/)) {
			return parseFloat(str.replace(/\./g, "").replace(/,/g, "."));
		}

		// Handle space as thousand separator
		return parseFloat(str.replace(/ /g, ""));
	};

	/**
	 * Count occurrences of values with optional weights
	 * @param {Array} values - Array of values to count
	 * @param {Array|null} weights - Optional weights for each value
	 * @returns {Object} Object with counts Map, sum, and total
	 */
	const countValues = (values, weights = null) => {
		const counts = new Map();
		let sum = 0;

		values.forEach((value, index) => {
			const weight = weights ? Number(weights[index]) || 0 : 1;
			counts.set(value, (counts.get(value) || 0) + weight);
			sum += weight;
		});

		return {
			counts,
			sum,
			total: values.length
		};
	};

	/**
	 * Check if all values in array are numeric
	 * @param {Array} values - Array of values to check
	 * @returns {boolean} True if all values are numeric
	 */
	const isNumericField = (values) => {
		return values.every(value => {
			const str = String(value);

			// Skip empty or special values
			if (!str.length || str === "undefined" || str === '""' ||
				str === "''" || str === "NaN" || str === "NULL") {
				return true;
			}

			return !isNaN(scanValue(value));
		});
	};

	/**
	 * Collect records from theme index
	 * @param {Object} theme - Theme object with indexA and itemA
	 * @param {Array} dataRecords - All available data records
	 * @returns {Array} Collected records
	 */
	const collectRecords = (theme, dataRecords) => {
		if (!theme?.indexA || !theme?.itemA) {
			return [];
		}

		const records = [];

		for (const index of theme.indexA) {
			const item = theme.itemA[index];

			if (item?.dbIndex != null) {
				records.push(dataRecords[item.dbIndex]);
			}

			if (Array.isArray(item?.dbIndexA)) {
				for (const dbIndex of item.dbIndexA) {
					records.push(dataRecords[dbIndex]);
				}
			}
		}

		return records;
	};

	/**
	 * Check if field is already in active filters and get the filter
	 * @param {string} field - Field name to check
	 * @returns {Object} Object with isActive flag and activeFilter string
	 */
	const getActiveFilterInfo = (field) => {
		for (const filter of facetFilters) {
			if (typeof filter !== 'string') continue;
			const parts = filter.split('"');
			if (parts[1] === field) {
				return {
					isActive: true,
					activeFilter: filter.trim()
				};
			}
		}
		return {
			isActive: false,
			activeFilter: null
		};
	};

	// ===========================================
	//
	// F A C E T   C R E A T I O N
	//
	// ===========================================

	/**
	 * Create numeric range facet (min/max slider)
	 * @param {string} field - Field name
	 * @param {Array} values - Array of values
	 * @param {Object} filterInfo - Active filter information
	 * @returns {Object} Numeric facet object
	 */
	const createNumericRangeFacet = (field, values, filterInfo = null) => {
		let min = Number.MAX_VALUE;
		let max = -Number.MAX_VALUE;
		let sum = 0;
		let hasValidValues = false;

		const numericValues = values.map(value => {
			const num = scanValue(value);
			if (num !== "date" && !isNaN(num) && num !== null && num !== undefined) {
				hasValidValues = true;
				min = Math.min(min, num);
				max = Math.max(max, num);
				sum += num;
			}
			return num;
		});

		// If no valid numeric values were found, set min/max to null
		if (!hasValidValues || min === Number.MAX_VALUE || max === -Number.MAX_VALUE) {
			min = null;
			max = null;
		}

		const uniqueCount = getUniqueValues(values).length;

		const facet = {
			id: field,
			type: 'numeric',
			min,
			max,
			sum,
			data: numericValues,
			values: numericValues,
			uniqueValues: uniqueCount,
			// Filter generator function
			getFilter: (minVal, maxVal) => {
				if (minVal === undefined && maxVal === undefined) {
					return null;
				}
				const min = minVal !== undefined ? minVal : min;
				const max = maxVal !== undefined ? maxVal : max;
				return `"${field}" BETWEEN ${min} AND ${max}`;
			}
		};

		// Add active filter info if provided
		if (filterInfo) {
			facet.isActive = filterInfo.isActive;
			facet.activeFilter = filterInfo.activeFilter;
		}

		return facet;
	};

	/**
	 * Create textual facet with value counts
	 * @param {string} field - Field name
	 * @param {Array} values - Array of values
	 * @param {Array|null} weights - Optional weights
	 * @param {Object} options - Additional options
	 * @returns {Object} Textual facet object
	 */
	const createTextualFacet = (field, values, weights = null, options = {}) => {
		const { counts, sum, total } = countValues(values, weights);
		const uniqueValues = [...counts.keys()];

		// Sort by count descending
		uniqueValues.sort((a, b) => counts.get(b) - counts.get(a));

		const facet = {
			id: field,
			type: 'textual',
			values: uniqueValues,
			valuesCount: Object.fromEntries(counts),
			uniqueValues: uniqueValues.length,
			nCount: total,
			nValuesSum: sum,
			// Filter generator function
			getFilter: (selectedValues) => {
				if (!selectedValues || selectedValues.length === 0) {
					return null;
				}
				if (selectedValues.length === 1) {
					// Single value - use equals
					return `"${field}" = "${selectedValues[0]}"`;
				} else {
					// Multiple values - use IN
					const valueList = selectedValues.map(v => `"${v}"`).join(',');
					return `"${field}" IN (${valueList})`;
				}
			}
		};

		if (options.example) {
			facet.example = options.example;
		}

		// Add active filter info if provided
		if (options.filterInfo) {
			facet.isActive = options.filterInfo.isActive;
			facet.activeFilter = options.filterInfo.activeFilter;
		}

		return facet;
	};

	/**
	 * Create categorical facet (many unique values)
	 * @param {string} field - Field name
	 * @param {Array} values - Array of values
	 * @param {Array} uniqueValues - Unique values array
	 * @param {boolean} includeValueList - Whether to include full value list
	 * @param {Object} filterInfo - Active filter information
	 * @returns {Object} Categorical facet object
	 */
	const createCategoricalFacet = (field, values, uniqueValues, includeValueList, filterInfo = null) => {
		const facet = {
			id: field,
			type: 'categorical',
			uniqueValues: uniqueValues.length,
			// Filter generator function
			getFilter: (selectedValues) => {
				if (!selectedValues || selectedValues.length === 0) {
					return null;
				}
				if (selectedValues.length === 1) {
					// Single value - use equals
					return `"${field}" = "${selectedValues[0]}"`;
				} else {
					// Multiple values - use IN
					const valueList = selectedValues.map(v => `"${v}"`).join(',');
					return `"${field}" IN (${valueList})`;
				}
			}
		};

		if (includeValueList && uniqueValues.length < FACET_CONFIG.MAX_VALUES_TO_DISPLAY) {
			const { counts, total } = countValues(values);

			uniqueValues.sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));

			facet.values = uniqueValues;
			facet.valuesCount = Object.fromEntries(counts);
			facet.nCount = total;
		}

		// Add active filter info if provided
		if (filterInfo) {
			facet.isActive = filterInfo.isActive;
			facet.activeFilter = filterInfo.activeFilter;
		}

		return facet;
	};

	/**
	 * Process a single field and create appropriate facet
	 * @param {Object} dataTable - Data table object
	 * @param {string} field - Field name
	 * @param {Array|null} weights - Optional weights for values
	 * @param {Object} options - Processing options
	 * @returns {Object|null} Facet object or null
	 */
	const processField = (dataTable, field, weights, options) => {
		const column = dataTable.column(field);
		if (!column) {
			return null;
		}

		let values = column.values();
		const totalCount = values.length;
		
		// Get active filter information for this field
		const filterInfo = getActiveFilterInfo(field);

		// Test for numeric values
		let fNumeric = isNumericField(values);
		if (options.flags?.match(/NONUMERIC/)) {
			fNumeric = false;
		}

		// Sample first N values to check uniqueness
		const sample = values.slice(0, FACET_CONFIG.MAX_SAMPLE_SIZE);
		const uniqueSample = getUniqueValues(sample);

		// Many unique values in sample
		if (sample.length >= FACET_CONFIG.MAX_SAMPLE_SIZE &&
			uniqueSample.length >= (sample.length * FACET_CONFIG.UNIQUE_THRESHOLD_RATIO)) {

		if (fNumeric) {
			// Numeric range facet
			return createNumericRangeFacet(field, values, filterInfo);
		} else {
			// Textual input field facet
			const facet = {
				id: field,
				type: 'textual',
				example: values[0],
				nCount: totalCount,
				// Filter generator for text input (supports pattern matching)
				getFilter: (inputValue, usePattern = false) => {
					if (!inputValue) {
						return null;
					}
					if (usePattern) {
						// Pattern matching with wildcards
						return `"${field}" LIKE "${inputValue}"`;
					} else {
						// Exact match or list
						if (Array.isArray(inputValue)) {
							if (inputValue.length === 1) {
								return `"${field}" = "${inputValue[0]}"`;
							}
							const valueList = inputValue.map(v => `"${v}"`).join(',');
							return `"${field}" IN (${valueList})`;
						}
						return `"${field}" = "${inputValue}"`;
					}
				}
			};

			if (filterInfo.isActive) {
				facet.values = values;
				facet.valuesCount = Object.fromEntries(countValues(values).counts);
				facet.uniqueValues = values.length;
			}

			// Add active filter info
			facet.isActive = filterInfo.isActive;
			facet.activeFilter = filterInfo.activeFilter;

			return facet;
		}
		}

		// Get all unique values
		const uniqueValues = getUniqueValues(values);

		// Few unique values - create value list facet
		if (uniqueValues.length < FACET_CONFIG.MAX_UNIQUE_FOR_TEXT_FACET &&
			!ranges.has(field) && !fNumeric) {

			return createTextualFacet(field, values, weights, { filterInfo });
		}

		// Many unique values
		if (fNumeric) {
			if (uniqueValues.length > 0) {
				// Numeric range facet
				return createNumericRangeFacet(field, values, filterInfo);
			} else {
				// Categorical facet with optional value list
				return createCategoricalFacet(field, values, uniqueValues, true, filterInfo);
			}
		} else {
			// Text categorical facet
			return createTextualFacet(field, values, weights, { filterInfo });
		}
	};

	/**
	 * Parse existing filter query into filter parts
	 * @param {string|Array} filterQuery - SQL-like filter query (string) or array of filter parts
	 * @returns {Array} Array of filter parts
	 */
	const parseFilterQuery = (filterQuery) => {
		if (filterQuery == null) {
			return [];
		}
		// Theme filter can be stored as array (e.g. from facet UI); normalize to string
		if (Array.isArray(filterQuery)) {
			if (filterQuery.length === 0) return [];
			// Join with AND and wrap in WHERE for consistent parsing
			filterQuery = 'WHERE ' + filterQuery.map(p => (typeof p === 'string' ? p : String(p)).trim()).filter(Boolean).join(' AND ');
		}
		if (typeof filterQuery !== 'string' || !filterQuery.match(/WHERE/)) {
			return [];
		}

		let parts = filterQuery.split('WHERE ')[1].split('AND');

		// Handle BETWEEN x AND y (join two parts around AND)
		for (let i = 0; i < parts.length; i++) {
			if (parts[i].match(/BETWEEN/)) {
				parts[i] = parts[i] + "AND" + parts[i + 1];
				parts.splice(i + 1, 1);
			}
		}

		return parts;
	};

	// ===========================================
	//
	// M A I N   A P I
	//
	// ===========================================

	/**
	 * Create filter facets from theme data
	 * @param {string} szFilter - Current filter query
	 * @param {string} szDiv - Target div for facets
	 * @param {Array} szFieldsA - Array of field names to process
	 * @param {string} szId - Theme ID
	 * @param {string} szMap - Map ID (optional)
	 * @param {string} fFlag - Processing flags (optional)
	 * @returns {Array} Array of facet objects
	 */
	ixmaps.data.getFacets = function (szFilter, szDiv, szFieldsA, szId, szMap, fFlag) {

		// Convert fFlag to string (handles boolean true/false and other types)
		fFlag = String(fFlag) || "";

		// Validate required parameters
		if (!szId) {
			console.error('getFacets: szId is required');
			return [];
		}

		// Get theme objects
		const szThemeId = ixmaps.filterThemeId = szId;
		const objTheme = ixmaps.data.objTheme = ixmaps.getThemeObj(szId);
		const objThemeDefinition = ixmaps.data.objThemeDefinition = ixmaps.getThemeDefinitionObj(szThemeId);

		if (!objTheme?.objTheme?.dbTable) {
			console.error('getFacets: Invalid theme or no data');
			return [];
		}

		// Create data table from theme data
		let dataTable = new Data.Table(null);
		dataTable.table = objTheme.objTheme.dbTable;
		dataTable.fields = objTheme.objTheme.dbFields;
		dataTable.records = objTheme.objTheme.dbRecords;

		// Collect only records that are on the map
		let records = [];
		try {
			records = collectRecords(objTheme, dataTable.records);
		} catch (error) {
			console.error("Data not ready:", error);
			setTimeout(() => {
				ixmaps.data.getFacets(szFilter, szDiv, szFieldsA, szId, szMap, fFlag);
			}, FACET_CONFIG.RETRY_DELAY_MS);
			return [];
		}

		if (records.length === 0) {
			console.warn('getFacets: No records found');
			return [];
		}

		dataTable.records = records;

		// Reset filter array
		facetFilters = [];

		// Normalize szFilter (theme can store filter as string or array)
		let filterStr = '';
		if (szFilter != null) {
			if (Array.isArray(szFilter)) {
				const parts = szFilter.map(p => (typeof p === 'string' ? p : String(p)).trim()).filter(Boolean);
				filterStr = parts.length ? ('WHERE ' + parts.join(' AND ')) : '';
			} else if (typeof szFilter === 'string') {
				filterStr = szFilter;
			}
		}

		// Parse existing filter
		if (filterStr) {
			facetFilters = parseFilterQuery(filterStr);

			// Apply filter to data
			if (facetFilters.length > 0 && filterStr) {
				try {
					dataTable = dataTable.select(filterStr);
				} catch (error) {
					console.error("Error applying filter:", error);
				}
			}
		}

		// Get optional value weights
		let valueWeights = null;
		if (objThemeDefinition.style.sizefield && ixmaps.data.fShowFacetValues) {
			const sizeColumn = dataTable.column(objThemeDefinition.style.sizefield);
			if (sizeColumn) {
				valueWeights = sizeColumn.values().map(value => {
					const num = scanValue(value);
					return isNaN(num) ? 0 : num;
				});
				$("#facets-counts-values").show();
			}
		}

		// Determine fields to process
		let fieldsToProcess = szFieldsA || dataTable.columnNames();

		// Remove geometry field
		fieldsToProcess = fieldsToProcess.filter(field => field !== "geometry");

		// Process each field and create facets
		const facetsA = [];

		try {
			for (const field of fieldsToProcess) {
				const facet = processField(dataTable, field, valueWeights, {
					flags: fFlag
				});

				if (facet) {
					facetsA.push(facet);
				}
			}
		} catch (error) {
			console.error("Error processing fields:", error.message);
			console.error(error.stack);
		}

		return facetsA;
	};

	// ===========================================
	//
	// F I L T E R   U T I L I T I E S
	//
	// ===========================================

	/**
	 * Combine multiple facet filters into a WHERE clause
	 * @param {Array} filterParts - Array of filter strings
	 * @returns {string} Complete WHERE clause or empty string
	 */
	ixmaps.data.buildFilterQuery = function(filterParts) {
		const validFilters = filterParts.filter(f => f && f.trim());
		if (validFilters.length === 0) {
			return '';
		}
		return 'WHERE ' + validFilters.join(' AND ');
	};

	/**
	 * Apply filters from multiple facets
	 * @param {Array} facets - Array of facet objects with selections
	 * @returns {string} Complete WHERE clause
	 */
	ixmaps.data.buildFilterFromFacets = function(facets) {
		const filterParts = [];
		
		for (const facet of facets) {
			if (facet.getFilter && facet.selection) {
				const filter = facet.getFilter(facet.selection);
				if (filter) {
					filterParts.push(filter);
				}
			}
		}
		
		return this.buildFilterQuery(filterParts);
	};

	// ===========================================
	//
	// E X P O R T   H E L P E R S   F O R   T E S T I N G
	//
	// ===========================================

	// Expose some helpers for external use (e.g., testing)
	ixmaps.data.facetHelpers = {
		getUniqueValues,
		scanValue,
		countValues,
		isNumericField
	};

	/**
	 * end of namespace
	 */

})();

// -----------------------------
// EOF
// -----------------------------
