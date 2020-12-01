const src = ["Lib/jquery.min",                       // https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
             "Lib/jquery-ui",                        // https://code.jquery.com/ui/1.12.1/jquery-ui.js
             "Lib/jquery.csv.min",                   // https://raw.githubusercontent.com/typeiii/jquery-csv/master/src/jquery.csv.min.js
             "Lib/sorttable",                        // https://www.kryogenix.org/code/browser/sorttable/sorttable.js
             // "Lib/jquery.easy-autocomplete.min",  // https://raw.githubusercontent.com/pawelczak/EasyAutocomplete/master/dist/jquery.easy-autocomplete.min.js
             "Lib/xlsx.full.min",                    // https://raw.githubusercontent.com/SheetJS/sheetjs/master/dist/xlsx.full.min.js
             "Google",
             "Common",
            ];

// Load every script one after the other
loadScript(0);
function loadScript(i) {
  addScript(src[i]);

  // Load next library, and the main app script as last one
  if (++i < src.length) {
    setTimeout(() => loadScript(i), 100); // Hack to avoid script loading in wrong order
  } else {
    const fn = pageTitle => addScript(pageTitle.replace('FiMs ', ''));
    setTimeout(() => google.script.run
      .withSuccessHandler(fn)
      .withFailureHandler(alert)
      .getProperty("pageTitle"), 100);     // Hack to avoid script loading in wrong order
  }
}
