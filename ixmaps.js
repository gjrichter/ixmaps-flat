/**
 * ixmaps core library
 * 
 * This file loads the ixmaps API and makes it available to the ixmaps user
 * The ixmaps user has 2 options to load the ixmaps API:
 * 
 * 1. load the ixmaps API explicitly
 * 2. load the ixmaps API inplicity
 */

// Define the ixmaps object
// This is the global object that will be used to access the ixmaps API

var ixmaps = {
  version: "1.0",
  JSON_Schema: "https://gjrichter.github.io/ixmaps/schema/ixmaps/v1.json"
};

// Load a script
// This function loads a script from a given URL
// It returns a promise that resolves when the script is loaded
// It rejects if the script fails to load
// @param src - The URL of the script to load
// @returns A promise that resolves when the script is loaded
// @returns A promise that rejects if the script fails to load
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Define the script to load
// This is the script that will be used to load the ixmaps API
let szScript2 = "ui/js/htmlgui_flat.js";

// Find the script object that contains this ixmaps.js file
// and use the URL of the script to build the complete URL to load the ixmaps API
let scriptsA = document.querySelectorAll("script");
for (var i in scriptsA) {
  let scr = scriptsA[i].getAttribute("src");
  if (scr && scr.match(/ixmaps.js/)) {
    szScript2 = (scr.split("ixmaps.js")[0]) + szScript2;
    break;
  }
}

// Create a promise that resolves when script2 is ready
// the ixmaps user has 2 options to load the ixmaps API:
// 1. load the ixmaps API directly
// 2. load the ixmaps API through a script tag
//
// The first option is to load the ixmaps API explicitly 
// and then load a map by calling ixmaps.Map
//
// The second option is to load the ixmaps API inplicity
// by calling ixmaps.map(div, options, callback)
// where div is the HTML element to load the map into
// options is an object with the options for the map
// callback is a function that will be called when the map is loaded
//
// The second option is the default option
// The first option is used when the ixmaps user wants to load the ixmaps API explicitly

window.ixmaps = ixmaps || {};

// first option: load the ixmaps API explicitly
window.ixmaps.init = function () {
  return loadScript(szScript2);
}
// second option: load the ixmaps API inplicity
window.ixmaps.Map = function (div, options, callback) {
  return new Promise((resolve, reject) => {
    loadScript(szScript2).then(() => {
      ixmaps.Map(div, options, (map) => {
        if (callback) {
          callback(map);
        }else{
          resolve(map);
        }
      });
    }).catch(reject);
  });
};

// log a message to the console
// this message is displayed when the ixmaps.js file is loaded
console.log("ixmaps.js loaded and waiting for initialization");
