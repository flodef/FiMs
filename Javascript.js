const src = ["Lib/jquery.min.js",                       // https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
           "Lib/jquery-ui.js",                        // https://code.jquery.com/ui/1.12.1/jquery-ui.js
           "Lib/jquery.csv.min.js",                   // https://raw.githubusercontent.com/typeiii/jquery-csv/master/src/jquery.csv.min.js
           "Lib/sorttable.js",                        // https://www.kryogenix.org/code/browser/sorttable/sorttable.js
           // "Lib/jquery.easy-autocomplete.min.js",  // https://raw.githubusercontent.com/pawelczak/EasyAutocomplete/master/dist/jquery.easy-autocomplete.min.js
           "Lib/xlsx.full.min.js",                    // https://raw.githubusercontent.com/SheetJS/sheetjs/master/dist/xlsx.full.min.js
           "Google.js",
           "Common.js",
          ];

// Load every script one after the other
loadScript(0);
function loadScript(i) {
  var element = document.createElement('script');
  element.src = GLOBAL.serverUrl + src[i];
  document.head.appendChild(element);

  // Load next library
  if (++i < src.length) {
    setTimeout(() => loadScript(i), 100);  // Hack to avoid script loading in wrong order
  }
}
