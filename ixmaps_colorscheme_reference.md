# iXMaps colorscheme reference

A complete, source-verified reference for every parameter and function in iXMaps that creates or
modifies colors. This goes well beyond the public docs (`colors_classification.qmd`), which cover
only a subset of what the engine actually implements.

All line references are relative to this repo. Two independent color engines exist:

- **`maps/svg/js-source/colorscheme.js`** — runs inside the SVG map document; this is the one
  `maptheme.js` actually calls (exported as `window.ColorScheme`).
- **`ui/js/tools/colorscheme.js`** — an older, separately-maintained copy used only by the
  authoring UI's color picker (`ui/js/tools/colorselect.js`). Same 14 named palettes and gradient
  algorithm, but diverged: the newer copy parses `rgb()`/`rgba()` with a real regex
  (`maps/svg/js-source/colorscheme.js:774`); the UI copy only recognizes literal `RGB(...)` via a
  fragile `eval()` splice (`ui/js/tools/colorscheme.js:756-761`).

This document covers the engine copy (`maps/svg/js-source/colorscheme.js`) plus how `maptheme.js`
consumes it, and the authoring-UI copy (`ui/js/tools/colorscheme.js` + `colorselect.js`) where it
differs or adds something.

---

## 1. Quick reference — every color-related style property

| Property | Internal field | Where handled | Purpose |
|---|---|---|---|
| `colorscheme` | `origColorScheme` / `colorScheme` | `maptheme.js:1175-1176` (init), `:4734-4767` (runtime) | The color array/string — see §2 |
| `colorstyle` | `origColorScheme[2]` | `maptheme.js:1251-1255`, `:4715-4723` | Style preset for `spectrum` colorscheme — see §2.3 |
| `colordef` | `origColorScheme` (raw) | `maptheme.js:4724-4733` | Runtime-only: set the raw resolved color array directly, bypassing all generation |
| `colorschemegeneration` | `origColorScheme[4]` | `maptheme.js:4769-4793` | Runtime-only: live-update the gradient mid-color/`warm`/`cold` parameter |
| `classes` | `origColorScheme[0]` | `maptheme.js:1243-1250`, `:4693-4709` | Runtime-only: change class count, preserving the rest of the colorscheme definition |
| `values` | `szValuesA` | `maptheme.js:199-202`, `:4798-4818` | Categorical label→color/position pinning — see §3.1 |
| `colorfield` | `szColorField` | `maptheme.js:290-291`, `:1489-1490` | Bind color to a raw data-field value instead of the display field — see §3.2 |
| `colorvalues` | `szColorValuesA` | `maptheme.js:204-207`, `:1412-1413` | Fixes value→color order for `colorfield` (the `colorfield` analogue of `values`) — see §3.2 |
| `rangecentervalue` | `nRangeCenterValue` | `maptheme.js:190-191`, `:12607-12612` | Diverging-scale symmetrization point — see §4 |
| `nodatacolor` | `szNoDataColor` | `maptheme.js:424-425` | Fallback fill for items with no matching class/value |
| `brightness` | `nBrightness` | `maptheme.js:329-330` | Tunes `COMPOSECOLOR`/`SUBTRACTIVE` blending — see §5 |
| `alphafield` / `alphafield100` | `szAlphaField` / `szAlphaField100` | `maptheme.js:308-312` | Explicit data field driving `DOPACITY*` opacity instead of value-derived opacity |
| `dopacitypow` | `nDopacityPow` | `maptheme.js:320-321` | Power-curve exponent for `DOPACITY*` opacity — see §6 |
| `dopacityscale` | `nDopacityScale` | `maptheme.js:326-327` | Linear scale factor for `DOPACITY*` opacity |
| `dopacityramp` | `szDopacityRamp` | `maptheme.js:323-324` | **Dead property** — parsed and assigned but never read anywhere else in the file |
| `linecolor` | `szLineColor` / `szLineColorA` | `maptheme.js:369-374` | Flow-line color; two-element array enables `GRADIENT`/`FADEIN` — see §7 |

Type-string flags that affect color: `CATEGORICAL`, `CATEGORICAL|ORDER`, `DOMINANT`,
`COMPOSECOLOR`, `SUBTRACTIVE`, `DOPACITY`, `DOPACITYMIN`, `DOPACITYMAX`, `DOPACITYLOG`,
`DOPACITYMINMAX` (alias `BIPOLAR`), `DOPACITYMEAN`, `DOPACITYLOGMEAN`, `DOPACITYPOWMEAN`,
`DOPACITYLOGMAX`, `DOPACITYPOWMAX`, `GRADIENT`, `FADEIN`.

---

## 2. `colorscheme` — the gradient/palette engine

### 2.1 Array layout

The value passed to `.style({ colorscheme: ... })` is parsed positionally. When consumed by
`maptheme.js`, the call is:

```js
// maptheme.js:12395
this.colorScheme = ColorScheme.createColorScheme(
    this.origColorScheme[1],  // cc1
    this.origColorScheme[2],  // cc2
    this.origColorScheme[0],  // nSteps (class count)
    this.origColorScheme[3],  // nParam1
    this.origColorScheme[4]   // nParam2
);
```

So the real layout of the array (or comma/pipe-delimited string) is:

```
colorscheme: [classCount, colorA_or_paletteName, colorB_or_offset, param1, param2]
```

Delimiter rule (`ixMap.Themes.prototype.toArray`, `maptheme.js:999-1013`): a *string* value splits
on `,` — unless it contains `|` or the substring `RGB`, in which case it splits on `|` instead:

```js
ixMap.Themes.prototype.toArray = function (obj) {
    if (this.isObject(obj)) { /* flattens {k:v,...} to [k,v,k,v,...] */ }
    else if (this.isArray(obj)) { return obj; }
    else {
        return (String(obj).match(/\|/) || String(obj).match(/\RGB/))
            ? String(obj).split('|') : String(obj).split(',');
    }
};
```

This means an `RGB(...)` value **must** use `|` as the outer delimiter, e.g.
`"RGB(74,74,255)|RGB(245,41,38)|dynamic"` — the internal commas inside `RGB(74,74,255)` would
otherwise corrupt a comma-delimited split. This restriction disappears entirely if you pass a real
JS array instead of a string. Passing a plain object instead of an array also works — it's
flattened to `[key0, value0, key1, value1, ...]`, a side effect of a shared coercion helper rather
than a deliberate colorscheme feature.

### 2.2 Gradient generation (`_circ_createColorScheme`, `colorscheme.js:123-623`)

Edge cases and shape keywords, read directly from the algorithm:

- **`nSteps < 2`** → returns `[cc2]` — **the second color, not the first.**
  `colorscheme: ["1", "red", "blue"]` yields a solid **blue**, not red.
- **`nSteps < 3`** → returns `[cc1, cc2]` verbatim. No interpolation happens for exactly 2 classes.
- **`nSteps >= 3`** → real gradient generation, branching on `param1`:

  | `param1` | Behavior |
  |---|---|
  | `linear` | Straight linear RGB interpolation cc1→cc2 |
  | `dynamic` / `auto` (default) | Non-linear "expanding" sweep — low end compressed (`colorscheme.js:341-376`) |
  | `2colors` | Two-color sweep, midpoint auto-derived from cc1/cc2 (same split ratio as `3colors`; see note below) |
  | `3colors` | **Author-intended naming convention** — signals that an explicit third/middle color follows in `param2`, rather than one being auto-derived. Mechanically shares the same 50/50 split-ratio branch as `2colors` (`colorscheme.js:379-380`) — the `2`/`3` prefix documents intent (whether a middle color follows), it isn't itself what changes the split shape. |
  | `2low` / `3low` | Sweep with low range expanded (75%/25% split) — same `2`/`3` intent distinction as above |
  | `2high` / `3high` | Sweep with high range expanded (23%/77% split) — same `2`/`3` intent distinction as above |
  | `2narrow` / `3narrow` | Compressed mid-range sweep — same `2`/`3` intent distinction as above |
  | `2wide` / `3wide` | Expanded mid-range sweep — same `2`/`3` intent distinction as above |
  | *(anything else)* | Treated as an **explicit middle color** — the string is parsed as a hex/named/rgb color and `param1` is reset to `'auto'` (`colorscheme.js:266-272`) |

  This last rule is one way to get an explicit middle color (folding it into `param1` itself), e.g.
  `["24", "#c94f35", "#4f9153", "#f2d16b"]` — `"#f2d16b"` becomes the sweep's mid color. The more
  explicit, author-intended way is to pair a `3xxx` keyword in `param1` with the actual color in
  `param2`, e.g. `["24", "#c94f35", "#4f9153", "3colors", "#f2d16b"]` — same result, but the `3xxx`
  keyword documents that a middle color is coming rather than relying on param1 not matching any
  known keyword.

- **`param2`** accepts: `"shift"` (nudges the dynamic ramp by one step), `"warm"` (mid-color
  `#FFFDD8`), `"cold"` (mid-color `#FFFFFF`), any of the same shape keywords (promotes into
  `param1`), or — default case — **any other string is itself parsed as an explicit mid-color
  hex**, and if both `param1` and `param2` resolve to explicit colors, **`param2`'s wins** because
  it's processed second (`colorscheme.js:277-308`).

- **Color resolution** (`_circ_getHexaColor`, `colorscheme.js:767-786`): `#hex` passed through
  as-is; `rgb(...)`/`rgba(...)` parsed via regex; any of 147 CSS named colors
  (`colorscheme.js:625-765`); else silent fallback to white (`#ffffff`) — no error is thrown for an
  unrecognized color name.

### 2.3 Named palette library (`_circ_createPaletteColorScheme`, `colorscheme.js:1164-1178`)

Dispatched by exact string match on `cc1` (`colorscheme.js:133-197`) — **only 3 literal casings
recognized per name** (e.g. `tableau`/`TABLEAU`/`Tableau`), not general case-insensitivity:

`office`, `mineral`, `pastel`, `harvest`, `fruit`, `kmeans`, `kmeansp`, `pimp`, `intense`, `fluo`,
`tableau`, `tableau10`, `tableau20` — plus `spectrum`/`spectral` (§2.4). None of these except
`tableau`/`tableau10`/`tableau20` are documented in `colors_classification.qmd`.

```js
colorscheme: ["5", "tableau10", "3"]   // 5 colors from tableau10, starting at index 3
```

The third array slot is `Number(cc2)` → an **offset** into the palette
(`_circ_createPaletteColorScheme(szPalette, nColors, nOffset)`). Requesting more colors than the
palette has repeats it cyclically:

```js
// colorscheme.js:1169-1177
if (nOffset + nColors <= colorPalette.length) {
    return colorPalette.slice(nOffset, nOffset + nColors);
} else {
    for (var i = 0; i < nColors; i++) xA.push(colorPalette[(nOffset + i) % colorPalette.length]);
}
```

**`viridis`/`plasma`/`magma` — now real, sequential (perceptually uniform) colormaps** (added in
v1.0.13, `_circ_createSequentialPaletteColorScheme`, `colorscheme.js`, right after
`_circ_createPaletteColorScheme`). Each is a 32-stop lookup table resampled evenly from the
original matplotlib/BIDS colormap data (https://github.com/BIDS/colormap), linearly interpolated
between adjacent stops to produce exactly the requested class count for any `n`. Credit: viridis,
plasma, and magma were created by Nathaniel J. Smith, Stéfan van der Walt, and Eric Firing, and
released under CC0 (public domain) — attribution isn't legally required, but is appreciated by
the creators.

```js
colorscheme: ["9", "viridis"]   // 9-class viridis, dark purple → teal → yellow
colorscheme: ["9", "plasma"]    // 9-class plasma, indigo → magenta → yellow
colorscheme: ["9", "magma"]     // 9-class magma, black → purple/red → pale yellow
```

Unlike the qualitative palettes above (`office`/`tableau`/etc.), these are dispatched through a
dedicated resampling function rather than `_circ_createPaletteColorScheme`'s contiguous-slice
logic — a plain slice would be wrong for a sequential scale (it would return `n` near-identical
colors clustered at one end of the colormap instead of `n` colors spanning the full range).

Before this fix, `"viridis"` only existed as a hardcoded 3-stop hex *approximation* in the
authoring-UI color-picker's recipe library (`ui/js/tools/colorselect.js`, keys `viridis-a`/
`viridis-b` — note the dash, and not reachable via `colorscheme:"viridis"` at all), and `"plasma"`/
`"magma"` didn't exist anywhere in the engine, despite a JSDoc comment in `ixmaps.js`/
`htmlgui_flat.js` already (incorrectly, at the time) documenting `"viridis"` as a supported named
scheme — that comment is now accurate and extended to mention `plasma`/`magma` too.

**Related bug found and fixed while shipping this**: `closure-compiler/compile-all.sh` never
included `colorscheme.js` in its `--js` file list, so the compiled production bundle
(`mapscript.min.js`) never actually defined `window.ColorScheme` — every consumer
(`ColorScheme.createColorScheme`, named palettes, spectrum, `COMPOSECOLOR`'s
`ColorScheme.getHexaColor`, border/text-color derivation) would silently fall back to a fixed
5-color default or throw, wherever a page genuinely ran in pure production mode instead of the
development-mode script fallback. Fixed by adding `colorscheme.js` to that file list (outside this
repo, in the local build tool) and rebuilding.

### 2.4 Spectrum / hue-wheel generator (`_circ_createSpectrumColorScheme`, `colorscheme.js:788-815`)

```js
colorscheme: ["24", "spectrum", "pastel", "0", "300"]
//             classCount, "spectrum", stylePreset, hueStart, hueEnd
```

Walks a 24-point hue wheel (`__colWheel`, `colorscheme.js:1185-1209`) between two hue angles
(default `270°`→`0°`, i.e. `nHueStart`/`nHueEnd` default to 270/0 when omitted). Aliases:
`spectrum`/`Spectrum`/`SPECTRUM`/`spectral`/`Spectral`/`SPECTRAL` (`colorscheme.js:125-132`).

Style presets (`__varPresets`, `colorscheme.js:1211-1218`), selected via `szMode` — fed by the
`colorstyle` style property:

```js
// maptheme.js:1251-1255 (init), :4715-4723 (runtime)
if (mapTheme.origColorScheme[1] == 'spectrum') {
    mapTheme.origColorScheme[2] = styleObj.colorstyle;
}
```

| Preset | Status |
|---|---|
| `default` | OK |
| `pastel` | OK |
| `soft` | OK |
| `hard` | OK |
| `light` | OK |
| `pale` | OK |
| `work` | **Broken** — `__varPresets['work'] = []` is an empty array (`colorscheme.js:1218`); selecting it leaves `S`/`V` undefined for every variant, and `getHex()`'s `v = V * 255` becomes `NaN`, producing an invalid hex color string |

### 2.5 Runtime colorscheme changes (`changeThemeStyle`)

Four style properties are recognized only at runtime (via `map.Api.changeThemeStyle(...)`), not at
initial `.style({...})` definition time:

- **`colorscheme`** (`maptheme.js:4734-4767`) — same grammar as §2.1, but the class count
  (`origColorScheme[0]`) is preserved from the existing theme unless it's currently `NaN`; the new
  value only replaces slots 1-4.
- **`colorstyle`** (`maptheme.js:4715-4723`) — only takes effect if the theme's current scheme is
  `spectrum`.
- **`colordef`** (`maptheme.js:4724-4733`) — sets `origColorScheme` **directly** to a raw literal
  array (split on `|` or `,`), completely bypassing `ColorScheme.createColorScheme` — no
  palette/gradient logic runs at all.
- **`colorschemegeneration`** (`maptheme.js:4769-4793`) — live-updates just the mid-color parameter
  (`origColorScheme[4]`, accepting `warm`/`cold`/an explicit color) and regenerates via
  `ColorScheme.createColorScheme(...)` without restarting the theme.
- **`classes`** (`maptheme.js:4693-4709`, and at init time `:1243-1250`) — changes class count.
  Note the compatibility shim: if the current `origColorScheme[0]` isn't numeric (i.e. the theme
  currently uses a named palette/spectrum, which doesn't carry an explicit count the same way),
  changing `classes` first reshuffles the array back into the standard `[count, cc1, cc2, ...]`
  numeric-count shape before applying the new count.

The built-in JSDoc for `changeThemeStyle` (`maptheme.js:4444-4470`) documents this with a sample:

```js
map.Api.changeThemeStyle("type:CHOROPLETH|EQUIDISTANT;classes:10;colorscheme:spectrum,pastel;overviewchart:PIE|3D");
```

---

## 3. Categorical binding

Two independent mechanisms:

### 3.1 `values` (position-based)

Parallel array pinning label→color by position — the documented mechanism
(`colors_classification.qmd`). Handled at both init (`maptheme.js:199-202`) and runtime
(`maptheme.js:4798-4818`, which additionally rebuilds `nStringToValueA`/`szLabelA`/`szOrigLabelA`
from scratch).

### 3.2 `colorfield` + `colorvalues` (data-field-based, undocumented)

Binds color assignment directly to the **raw value of a data field**, independent of whatever
field is used for display/labeling:

```js
style: {
    colorfield: "region_type",
    colorvalues: ["urban", "rural", "coastal"],
    colorscheme: [...]
}
```

- `colorfield` → `szColorField` (`maptheme.js:290-291`). Special token **`colorfield: "$index$"`**
  uses the row's numeric index directly as the color-class key.
- `colorvalues` → `szColorValuesA` (`maptheme.js:204-207`), fixing the value→color order the same
  way `values` does for `CATEGORICAL`, but scoped to `colorfield`.
- Class count auto-corrects to the number of distinct color-field values found in the data
  (`maptheme.js:12382-12388`):
  ```js
  if (this.szColorField) {
      var l = 0;
      for (a in this.colorFieldA) l++;
      this.origColorScheme[0] = l;
  }
  ```
- Colors/classes are then assigned directly to items (`maptheme.js:12433-12443`), bypassing the
  normal value-based classification path entirely.

### 3.3 `CATEGORICAL|ORDER` (alphabetical color assignment)

When both `CATEGORICAL` and `ORDER` are present in `type`, distinct values are alphabetically
sorted before colors are assigned, instead of using data-encounter order:

```js
// maptheme.js:12403-12422
if (this.szFlag.match(/CATEGORICAL/) && this.szFlag.match(/ORDER/)) {
    var myValuesA = this.szValuesA ? this.szValuesA.slice() : this.szLabelA.slice();
    if (this.szColorField) { /* ... build myValuesA from colorFieldA instead ... */ }
    myValuesA.sort();
    this.colorScheme = [];
    for (var i = 0; i < myValuesA.length; i++) {
        this.colorScheme[this.nStringToValueA[myValuesA[i]] - 1] = myColoscheme[i];
    }
}
```

Also, for any `CATEGORICAL` theme, whatever class count is in `colorscheme[0]` is **ignored and
force-corrected** to the actual number of distinct values found in the data
(`maptheme.js:12375-12377`): `this.origColorScheme[0] = this.szExactA.length || 1;`

---

## 4. Diverging scales — `rangecentervalue`

```js
// maptheme.js:12607-12612
if ((this.nRangeCenterValue != null) && !isNaN(this.nRangeCenterValue)) {
    var nSymRange = Math.max(Math.abs(this.nRangeCenterValue - nMin), Math.abs(nMax - this.nRangeCenterValue));
    nMin = this.nRangeCenterValue - nSymRange;
    nMax = this.nRangeCenterValue + nSymRange;
}
```

Symmetrizes the classification range around the center value **regardless of class-count
parity** — an odd class count still works (one class will simply straddle the center); using an
even color count for a clean visual split either side of the center is a design choice, not a code
requirement.

---

## 5. Data-driven / functional colorschemes

Three distinct, independently-triggered mechanisms, all inside one try/catch block
(`maptheme.js:12457-12509`):

### 5.1 Named/namespaced function reference (documented, with an undocumented nuance)

```js
.style({ colorscheme: "ixmaps.colorScheme_speedmap" })
```

```js
// maptheme.js:12461-12485
if (this.colorScheme[0] && /^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(this.colorScheme[0])) {
    if (this.colorScheme[0].indexOf('.') !== -1) {
        // dotted path: walked starting at the SVG engine's OWN window
        var obj = window;
        for (...) { obj = obj[pathParts[i]]; }
        if (obj && typeof obj === 'function') colorSchemeFunc = obj;
    } else {
        // bare/undotted name: resolved off map.HTMLWindow (the OUTER embedding page)
        if (map.HTMLWindow && map.HTMLWindow[this.colorScheme[0]]) colorSchemeFunc = map.HTMLWindow[this.colorScheme[0]];
    }
    if (colorSchemeFunc) {
        window.__defineColorScheme = colorSchemeFunc;
        window.__defineColorScheme(this);
        window.__defineColorScheme = null;
    }
}
```

**Important undocumented nuance**: a **dotted** reference (`"ixmaps.foo"`) is resolved against the
SVG engine's own internal `window` — not the outer HTML page. A **bare/undotted** name (no dot) is
resolved against `map.HTMLWindow` (the outer embedding page) instead. Since users typically define
their callback in the outer page (as in the shipping `colorScheme_speedmap` example), this
distinction matters: a dotted reference to a function that only exists in the outer page will
silently fail to resolve.

The code comment above this block (`// GR 03/02/2024 user defined color function as function name
in theme ?`) and inline comment `// Use safe property access instead of eval` indicate this
replaced an older `eval`-based implementation for security — walking the path via property access
rather than evaluating a string.

### 5.2 Inline function-literal string (fully undocumented, fragile)

```js
colorscheme: ["function(theme){ theme.colorScheme = [...]; }"]
```

```js
// maptheme.js:12495-12504
if (this.colorScheme[0] && (this.colorScheme[0]).match(/function||\=\>/)) {
    try {
        var src = this.colorScheme[0];
        var colorSchemeFunc = (0, eval)('(' + src + ')');
        if (typeof colorSchemeFunc === 'function') colorSchemeFunc(this);
    } catch (e) { }
}
```

**Bug**: the guard regex `/function||\=\>/` has an accidental extra `|`, creating an empty-string
alternative that **always matches** — every truthy `colorScheme[0]` reaches the `eval()` attempt,
not just ones containing `"function"` or `"=>"`. In practice this is harmless for ordinary
hex/named colors (`eval("(#ffffff)")` throws a `SyntaxError`, silently caught) — the try/catch is
doing all the real filtering, not the regex. This mechanism only works if the function source is
passed as a single array element (bypassing `toArray`'s comma/pipe string-splitting); as a plain
string it would be corrupted by that split first, matching the docs' existing general warning about
inline function bodies.

### 5.3 Unconditional global hook (fully undocumented, no shipped default)

```js
// maptheme.js:12506-12509
try {
    map.HTMLWindow.ixmaps.htmlgui_colorScheme(this);
} catch (e) { }
```

Calls `ixmaps.htmlgui_colorScheme(theme)` on **every single theme**, unconditionally, after its
`colorScheme` is resolved — regardless of what `colorscheme` value was used. No such function is
defined anywhere in `ui/js/htmlgui.js` or `ui/js/htmlgui_flat.js` (zero hits for
`htmlgui_colorScheme` outside this call site), so today it's a silent no-op — but a page author can
define `window.ixmaps.htmlgui_colorScheme` to override colors for every theme on the map at once,
independent of each theme's own colorscheme syntax.

---

## 6. Opacity / alpha — the `DOPACITY*` family

Fully separate from `colorscheme` but visually entangled with it: the class fill color gets its
`fill-opacity`/`stroke-opacity` independently modulated by a `DOPACITY*` type flag family, computed
in several near-duplicated code paths (`maptheme.js:13313-13524`, `:17821-17929`,
`:21297-21709`, `:19146` for `changeThemeStyle`).

Flags and their opacity formula (relative to value/min/max/mean/median as noted):

| Flag | Formula basis |
|---|---|
| `DOPACITY` (bare, default fallback) | `log(value) / log(max)` (single range) or `(value-min)/(median-min)*0.5` (single-range non-log branch) |
| `DOPACITYMIN` | `((max - value) / (max - min)) ^ (1/dopacitypow)` |
| `DOPACITYMAX` | `((value - min) / (max - min)) ^ (1/dopacitypow)` |
| `DOPACITYLOG` | `log(value - min) / log(median - min)` |
| `DOPACITYMINMAX` (alias `BIPOLAR`) | Distance from median toward whichever extreme (min or max) the value is closer to, power-curved |
| `DOPACITYMEAN` | `(dopacityscale * (percentOfMean - 100)) ^ (1/dopacitypow) / 100 ^ (1/dopacitypow)` |
| `DOPACITYLOGMEAN` | `log(dopacityscale * (percentOfMean - 100)) / log(100)` |
| `DOPACITYPOWMEAN` | Same shape as `DOPACITYMEAN` (both branches are identical in the source, `maptheme.js:13340-13348`) |
| `DOPACITYLOGMAX` | `log(value) / log(max)` (component-count context, `DOMINANT`-style) |
| `DOPACITYPOWMAX` | `dopacityscale * (value ^ (1/dopacitypow)) / (max ^ (1/dopacitypow))` |

Modifiers:
- **`alphafield`** — if set, opacity is computed from this explicit field's value instead of any of
  the above value-derived formulas (`maptheme.js:13330-13336`).
- **`dopacitypow`** (`nDopacityPow`) — exponent applied as `1/dopacitypow` in every power-curve
  formula above.
- **`dopacityscale`** (`nDopacityScale`) — linear multiplier on the raw ratio before power-curving.
- Result is always clipped: values below `0.0001` snap to `0`; result is capped at
  `this.nOpacity || 0.9` (`maptheme.js:13369-13370`).
- **`autoOpacity`** — an independent, zoom-driven opacity fade layered on top of whatever
  `DOPACITY*` computed (`maptheme.js:13373-13376`), not gated by any `DOPACITY*` flag itself.
- **`dopacityramp`** (`szDopacityRamp`) — parsed and assigned (`maptheme.js:1804`, `:4942`) but
  **never read anywhere else in the file** — dead/inert property, has no effect regardless of
  value.

---

## 7. Multi-field color composition — `COMPOSECOLOR` / `SUBTRACTIVE`

A substantial, fully-implemented, completely undocumented feature: blends *multiple field values*
into a single color, treating `colorscheme` as one base color per field.

```js
type: "CHOROPLETH|DOMINANT|COMPOSECOLOR|SUBTRACTIVE"
style: { colorscheme: [...], brightness: 0.7 }
```

```js
// maptheme.js:13057-13094
var __maptheme_getComposedColor_additive = function (nValuesA, szColorsA, nMax, nBrightness) {
    // light-mixing: sums each field's color weighted by its value/max ratio, then normalizes
};
var __maptheme_getComposedColor_subtractive = function (nValuesA, szColorsA, nMax, nBrightness) {
    // pigment-mixing: sums (255 - channel) weighted by value/max ratio, inverted back
};
```

Selected at paint time (`maptheme.js:13221-13224`, and duplicated at `:19281-19284`,
`:20356-20359`, `:21012-21015`):

```js
if (this.szFlag.match(/SUBTRACTIVE/)) {
    szColor = __maptheme_getComposedColor_subtractive(this.itemA[a].nValuesA, this.colorScheme, this.nMax, Math.floor(this.nBrightness * 255));
} else {
    szColor = __maptheme_getComposedColor_additive(this.itemA[a].nValuesA, this.colorScheme, this.nMax, Math.floor(this.nBrightness * 255));
}
```

Tunable via the `brightness` style property (`nBrightness`, `maptheme.js:329-330`). Requires
`DOMINANT` (or `COMPOSECOLOR` alone, per the type-match guard at `maptheme.js:5533`,
`:13996`, `:19146`) alongside `COMPOSECOLOR` in the type string.

---

## 8. Special tokens & per-class overrides

- **`"none"`** — passed straight through as an SVG paint value. At the whole-scheme level (e.g.
  `colorscheme: "none"`) it disables fill for `FEATURE` layers. `_circ_getDerivateColor`
  special-cases it directly (`colorscheme.js:48-50`) so brightness/border/text-color derivations
  don't choke on it. Per-class, inside an explicit color array, a part colored `"none"` renders
  outline-only (e.g. a donut/pie slice: `if (this.colorScheme[i] == "none") { donut.setLine(...); }`,
  `maptheme.js:19955-19957`).
- **`nodatacolor`** (`szNoDataColor`) — fallback fill for items with no matching class/value,
  default varies by chart type (`maptheme.js:13537`, `:16983`, `:19773`, `:25380`).
- **Padding/repetition**: if a `colorscheme` array has fewer entries than needed classes/fields,
  the **last color is auto-repeated** (`maptheme.js:12514-12534`); `DOMINANT` type forces enough
  colors for every field, defaulting unfilled slots to `#dddddd` (`maptheme.js:12513-12518`).

---

## 9. Derived-color helper functions (`ColorScheme` public API)

Exported from `maps/svg/js-source/colorscheme.js:1358-1369` as `window.ColorScheme`:

| Function | Purpose | Source |
|---|---|---|
| `ColorScheme.createColorScheme(cc1, cc2, nSteps, param1, param2)` | The full gradient/palette engine described in §2 | `colorscheme.js:123-623` |
| `ColorScheme.getHexaColor(color)` | Normalize any accepted color syntax (`#hex`, `rgb()`/`rgba()`, CSS name) to `#hex` | `colorscheme.js:767-786` |
| `ColorScheme.getDerivateColor(color, factor)` | Return a lighter (`factor > 1`) or darker (`factor < 1`) variant of a color; passes `"none"` through unchanged | `colorscheme.js:46-76` |
| `ColorScheme.getBorderColor(color)` | Pick a visually-appropriate border color (darkens light colors by 0.7, lightens dark colors by 1.4) | `colorscheme.js:82-96` |
| `ColorScheme.getTextColor(color)` | Pick a visually-appropriate text/label color for a given fill (thresholds on perceived brightness) | `colorscheme.js:101-115` |

These are used internally throughout `maptheme.js` (e.g. border colors for choropleth outlines,
label contrast) but are also valid to call from a custom colorscheme function (§5.1/§5.2) — a
user-defined `theme.colorScheme[i]` assignment can call `ColorScheme.getBorderColor(...)` etc. to
derive complementary colors.

---

## 10. Authoring-UI color picker (`ui/js/tools/colorselect.js` + `ui/js/tools/colorscheme.js`)

This is a **separate, older subsystem** used only by the legacy visual theme-configurator pages
(`ui/html/tools/theme_configurator.html`, `theme_configurator_test.html`,
`popuptools_line_v2.html`) — not part of the runtime map-rendering path.

### 10.1 Curated preset library (`ui/js/tools/colorselect.js:30-160`)

A large table (`colorSchemesA`) of named, ready-made `cc1,cc2,param1,param2` recipe strings (note:
**no leading class count** — these are previews only), including many combinations not mentioned
anywhere in the docs: `red`, `green`, `blue`, `gray`, `warmgray`, `greengray`, `darkred`, `petrol`,
`darkblue`, `petrol2`, `inkblue`, `density1`-`density5`, `heatmap`, `heatmap0`/`01`/`1`-`5`,
`viridis-a`/`viridis-b`, `magma-a`/`magma-b`, a large family of two-tone diverging pairs
(`blue-red`/`red-blue` and numbered variants `2`-`A`), `green-brown`, `blue-orange` (and reversed
pairs), `green-dark`, `spectral`/`rev-spec.`, plus one entry per named palette from §2.3
(`office`, `mineral`, `pastel`, etc.).

These are exposed to the picker UI via:

- `ixmaps.getColorSwatches(colorSelect, flag)` / `ixmaps.getColors(colorSelect)` — render an HTML
  swatch list, each swatch generated by actually running `_circ_createColorScheme(...)` with a
  hardcoded preview class count of **7** (`colorselect.js:246`), regardless of what the eventual
  theme will use.
- `ixmaps.getColorsOption(colorSelect)` — render the same list as `<option>` tags.
- `ixmaps.getColorsFromColorScheme(szColorScheme)` — resolve a full colorscheme string (with
  leading count) to its actual hex array, for programmatic use.

**Dead wiring found**: the swatch list's click handler is wired to
`javascript:ixmaps.setColorScheme('...')` (`colorselect.js:192`), but `ixmaps.setColorScheme` is
**never defined anywhere in the repository** — clicking a swatch in the picker currently throws
(or silently no-ops, depending on the page's error handling), so the picker's selection mechanism
appears to be broken/unmaintained. The color recipe **strings themselves** are still valid
`colorscheme` values a user can copy directly into `.style({colorscheme: ...})` (just prepend the
desired class count), independent of this broken click-handler wiring.

### 10.2 Divergence from the SVG-engine copy

| Aspect | `maps/svg/js-source/colorscheme.js` (runtime) | `ui/js/tools/colorscheme.js` (authoring UI) |
|---|---|---|
| `rgb()`/`rgba()` parsing | Real regex (`:774`) | Only literal `RGB(...)`, via `eval("__rgb2hex" + szColorName.slice(3))` (`:756-761`) — breaks on `rgba()` or lowercase `rgb(` |
| Export style | IIFE, `'use strict'` | Legacy global-function style, no IIFE |
| Named palettes | Same 14 | Same 14 |
| Gradient algorithm | Same | Same |

---

## 11. Known dead/broken code (not user-facing capabilities, but worth knowing)

| Item | Location | Issue |
|---|---|---|
| `dopacityramp` style property | `maptheme.js:323-324`, `:1804`, `:4942` | Parsed and assigned, never read anywhere else — no effect |
| Colorblind simulation (`CBMode` 1-6) | `colorscheme.js:1332-1336` | Calls `getColorBlindColor(r,g,b,CBMode)`, which is **never defined anywhere in the repo** — would throw if reached; the only call site always passes `CBMode = 0`, so it's unreachable in practice |
| `colorstyle: "work"` preset | `colorscheme.js:1218` | Empty preset array → `NaN` colors if ever selected (see §2.4) |
| Function-literal guard regex | `maptheme.js:12495` | `/function||\=\>/` has an accidental empty alternative from the double `\|\|`, making the guard match unconditionally (see §5.2) |
| `ixmaps.setColorScheme` | Referenced at `ui/js/tools/colorselect.js:192` | Never defined anywhere in the repo — the picker's swatch click handler is broken |
| ~~`viridis`/`plasma` colorscheme keywords~~ | N/A | **Fixed in v1.0.13** — real sequential colormaps now implemented, see §2.3 |
| `colorscheme.js` missing from production bundle | `closure-compiler/compile-all.sh` (outside this repo) | **Fixed in v1.0.13** — `window.ColorScheme` was never defined in `mapscript.min.js` prior to this; see §2.3 |

---

*This document was produced by direct source inspection (no code changes made). It is intended as
raw material for updating `colors_classification.qmd` and related public docs — the actual
capability surface is roughly 3x what's currently documented there.*
