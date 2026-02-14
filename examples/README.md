# iXMaps Examples

Questa cartella contiene esempi HTML pronti all'uso per iniziare con iXMaps.

## 📁 Elenco degli Esempi

### 01-basic-map.html
**Mappa base minima**
- Mappa fullscreen semplice
- Vista centrata su Roma
- Basemap OpenStreetMap standard
- Ideale per iniziare

### 02-projection-basemap.html
**Mappa con proiezione e basemap personalizzata**
- Proiezione Winkel Tripel
- Basemap Stamen Toner Lite
- Pulsanti di controllo
- Funzione di ricerca attiva

### 03-different-projections.html
**Confronto proiezioni cartografiche**
- Pulsanti per cambiare proiezione in tempo reale
- 6 proiezioni disponibili:
  - Mercator
  - Winkel Tripel
  - Equal Earth
  - Albers Equal Area
  - Lambert Azimuthal Equal Area
  - Orthographic
- Perfetto per capire le differenze tra proiezioni

### 04-fixed-layout.html
**Layout fisso con design personalizzato**
- Dimensioni fisse (600px altezza)
- Design accattivante con gradiente
- Vista sulla Toscana
- Basemap Stamen Watercolor
- Informazioni di utilizzo

### 05-layer-geojson.html
**Layer GeoJSON con punti**
- Dati GeoJSON inline (Roma, Milano, Napoli)
- Visualizzazione bubble chart
- Dati sulla popolazione
- Esempio di come aggiungere layer personalizzati

### 06-multiple-basemaps.html
**Selector di basemap interattivo**
- Cambio basemap dinamico
- 5 basemap disponibili
- Interfaccia con pulsanti
- Esempio di interattività

## 🚀 Come Utilizzare gli Esempi

### Metodo 1: Aprire direttamente nel browser

```bash
# Dalla cartella ixmaps_flat/examples
open 01-basic-map.html
# oppure
firefox 01-basic-map.html
# oppure
google-chrome 01-basic-map.html
```

### Metodo 2: Con un server locale

Per evitare problemi CORS quando carichi dati esterni:

```bash
# Python 3
python -m http.server 8000

# oppure Python 2
python -m SimpleHTTPServer 8000

# oppure Node.js (se hai npx)
npx http-server -p 8000
```

Poi apri nel browser: `http://localhost:8000/examples/01-basic-map.html`

### Metodo 3: Con PHP

```bash
php -S localhost:8000
```

## 📝 Personalizzare gli Esempi

Ogni esempio può essere facilmente personalizzato:

### Cambiare la posizione iniziale

```javascript
map.view([latitudine, longitudine], zoom);

// Esempi:
map.view([41.9028, 12.4964], 10);  // Roma
map.view([45.4642, 9.1900], 12);   // Milano
map.view([40.8518, 14.2681], 11);  // Napoli
```

### Cambiare il basemap

```javascript
ixmaps.Map("map_div", {
    mapType: "OpenStreetMap"          // Standard
    // oppure
    mapType: "Stamen - toner-lite"    // Minimal
    // oppure
    mapType: "Stamen - watercolor"    // Artistico
    // oppure
    mapType: "CartoDB - light"        // Chiaro
});
```

### Cambiare la proiezione

```javascript
ixmaps.Map("map_div", {
    mapProjection: "mercator"      // Standard web
    // oppure
    mapProjection: "winkel"        // Winkel Tripel (bilanciato)
    // oppure
    mapProjection: "equalearth"    // Equal Earth (area corretta)
});
```

### Posizione della legenda

```javascript
ixmaps.Map("map_div", {
    align: "right"    // Destra
    // oppure
    align: "left"     // Sinistra
    // oppure
    align: "center"   // Centro
    // oppure
    align: "bottom"   // Basso
});
```

## 🎨 Tipi di Visualizzazione

Negli esempi con layer, puoi cambiare il tipo di visualizzazione:

```javascript
.type("FEATURE")                    // Semplici feature geometriche
.type("CHOROPLETH")                 // Mappa coropletica
.type("CHART|BUBBLE")              // Bubble chart
.type("CHART|BAR")                 // Bar chart
.type("SYMBOL")                     // Simboli
.type("FEATURE|NOLEGEND")          // Feature senza legenda
```

## 🛠️ Requisiti

- Browser moderno (Chrome, Firefox, Safari, Edge)
- Connessione internet (per caricare le tile delle mappe e le librerie)
- File `ixmaps.js` nella cartella parent (`../ixmaps.js`)

## 📚 Documentazione Completa

Per maggiori informazioni consulta:
- `API_DOCUMENTATION.md` - Documentazione API completa
- `EXAMPLES.md` - Esempi avanzati
- `GETTING_STARTED.md` - Guida introduttiva

## 💡 Suggerimenti

1. **Inizia da 01-basic-map.html** per capire la struttura base
2. **Esplora 03-different-projections.html** per vedere le proiezioni
3. **Usa 05-layer-geojson.html** come template per i tuoi dati
4. **Personalizza 04-fixed-layout.html** per integrare la mappa nel tuo sito

## 🐛 Problemi Comuni

**La mappa non si carica:**
- Verifica che il percorso a `ixmaps.js` sia corretto
- Apri la console del browser (F12) per vedere eventuali errori
- Controlla la connessione internet

**Errori CORS:**
- Usa un server locale invece di aprire il file direttamente
- Vedi "Metodo 2" sopra

**Basemap non visibile:**
- Alcuni basemap richiedono API keys
- Prova con OpenStreetMap che è sempre disponibile

## 📧 Supporto

Per problemi o domande, consulta la documentazione principale del progetto.

Buon mapping! 🗺️
