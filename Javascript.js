const src = ["Lib/jquery.min.js",                       // https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
           "Lib/jquery-ui.js",                        // https://code.jquery.com/ui/1.12.1/jquery-ui.js
           "Lib/jquery.csv.min.js",                   // https://raw.githubusercontent.com/typeiii/jquery-csv/master/src/jquery.csv.min.js
           "Lib/sorttable.js",                        // https://www.kryogenix.org/code/browser/sorttable/sorttable.js
           // "Lib/jquery.easy-autocomplete.min.js",  // https://raw.githubusercontent.com/pawelczak/EasyAutocomplete/master/dist/jquery.easy-autocomplete.min.js
           "Lib/xlsx.full.min.js",                    // https://raw.githubusercontent.com/SheetJS/sheetjs/master/dist/xlsx.full.min.js
           "Google.js",
           "Common.js",
          ];

const serverUrl = !document.URL.includes(":8080") ? "https://raw.githubusercontent.com/flodef/FiMS/master/" : ''; // Remove the server URL if in local mode
const fn = src => {
  var element = document.createElement('script');
  element.src = serverUrl + src;
  document.head.appendChild(element);
}

// Load every script one after the other
loadScript(0);
function loadScript(i) {
  fn(src[i]);

  // Load next library
  if (++i < src.length) {
    setTimeout(() => loadScript(i), 100);  // Hack to avoid script loading in wrong order
  } else {
    google.script.run
                 .withSuccessHandler(pageTitle => setTimeout(() => fn(pageTitle.replace("FiMs ", "") + ".js"), 100))
                 .withFailureHandler(alert)
                 .getProperty("pageTitle");
  }
}
