		/**************************************************************** 
		 *
		 * Config 
		 *
		 ****************************************************************/

		/**
		 * This is the Config class.  
		 * It realizes an object to configure and realize a map theme 
		 * @constructor
		 * @throws 
		 * @return A new Config object
		 */

        if (typeof(Config) === 'undefined'){
            Config = function(definition) {
                this.obj = null;
                this.szConfig = null;

                if (typeof(definition) == "string") {
                    this.szConfig = definition;
                    this.parse(definition);
                } else {
                    this.obj = definition;
                    //this.szConfig = JSON.stringify(definition);
                }
            };
		}

		Config.prototype.parse = function(szConfigDef) {
			var szRaw = szConfigDef.replace(/\n\t+/g, '');
			try {
				this.obj = JSON.parse(szRaw);
			} catch (e) {
				ixmaps.parentApi.error("Code: " + e);
			}
		};
		Config.prototype.getString = function() {
			if (!this.szConfig) {
				this.szConfig = JSON.stringify(this.obj);
			}
			return this.szConfig;
		};
		Config.prototype.getObj = function() {
			if (!this.obj) {
				this.parse(definition);
			}
			return this.obj;
		};
		Config.prototype.getPrettyString = function() {
			var omitKeys = { parent: 1, listItem: 1, gOverlayObject: 1, gOverlayObjectPartsA: 1, setLine: 1, setPolygon: 1, setPosition: 1 };
			function sanitize(o) {
				if (o === null || o === undefined) {
					return undefined;
				}
				if (typeof o !== "object") {
					return o;
				}
				if (Object.prototype.toString.call(o) === "[object Date]") {
					return o;
				}
				if (Object.prototype.toString.call(o) === "[object Array]") {
					var arr = [];
					for (var i = 0; i < o.length; i++) {
						var ev = sanitize(o[i]);
						if (ev !== undefined) {
							arr.push(ev);
						}
					}
					return arr;
				}
				var out = {};
				for (var k in o) {
					if (!Object.prototype.hasOwnProperty.call(o, k)) {
						continue;
					}
					if (omitKeys[k]) {
						continue;
					}
					if (o[k] === null || o[k] === undefined) {
						continue;
					}
					if (typeof o[k] === "function") {
						continue;
					}
					var v = sanitize(o[k]);
					if (v !== undefined) {
						out[k] = v;
					}
				}
				return out;
			}
			try {
				if (this.obj === null || this.obj === undefined) {
					return "";
				}
				var cleaned = sanitize(this.obj);
				if (cleaned === undefined) {
					return "";
				}
				return JSON.stringify(cleaned, null, "\t");
			} catch (e) {
				this.szPrettyString = "";
				this.tab = 1;
				this.recurs = 0;
				this.formatObj(this.obj);
				return this.szPrettyString;
			}
		};
		Config.prototype.isArray = function(obj) {
			return Object.prototype.toString.call(obj) === '[object Array]';
		};
		Config.prototype.formatObj = function(obj) {

			if (++this.recurs > 10) {
				return;
			}
			if (this.isArray(obj)) {

				this.szPrettyString += '[';
				var n = 0;
				for (var a in obj) {
					if (obj[a]) {
						if (typeof(obj[a]) == "object") {
							this.szPrettyString += (n ? ',' : '');
							this.tab++;
							this.formatObj(obj[a]);
							this.tab--;
						} else {
							this.szPrettyString += (n ? ',\n' : '\n') + (this.getIndent()) + '"' + String(obj[a]).replace(/\"/g, "\\\"").replace(/\s\s+/g, ' ') + '"';
						}
						n++;
					}
				}
				this.szPrettyString += ']';

			} else {

				this.szPrettyString += '{';

				var n = 0;
				for (var a in obj) {
					if (a == "parent" || a == "listItem" || a == "gOverlayObject" || a == "gOverlayObjectPartsA" || a == "setLine" || a == "setPolygon" || a == "setPosition") {
						continue;
					}
					if (obj[a] == null) {
						continue;
					}
					if (typeof(obj[a]) == "object") {
						this.szPrettyString += (n ? ',\n' : '\n') + (this.getIndent()) + '"' + a + '": ';
						this.tab++;
						this.formatObj(obj[a]);
						this.tab--;
						n++;
					} else {
						this.szPrettyString += (n ? ',\n' : '\n') + (this.getIndent()) + '"' + a + '": "' + String(obj[a]).replace(/\"/g, "\\\"").replace(/\s\s+/g, ' ') + '"';
						n++;
					}
				}
				this.szPrettyString += '\n' + (this.getIndent()) + '}';
			}

			this.recurs--;
		};
		Config.prototype.getIndent = function() {
			var szTab = "";
			for (var i = 0; i < this.tab; i++) {
				szTab += "\t";
			}
			return szTab;
		};

