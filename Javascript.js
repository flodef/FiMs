window.GLOBAL = {};
GLOBAL.isLocal = document.URL.includes(':8080');                                                  // Whether the app is running in local mode
GLOBAL.serverUrl = GLOBAL.isLocal ? '' : 'https://raw.githubusercontent.com/flodef/FiMS/master/'; // Remove the server URL if in local mode
GLOBAL.scriptUrl = GLOBAL.isLocal ? '' : 'https://flodef.github.io/FiMS/';                        // Remove the server URL if in local mode

// [src, isLocal]
const javascriptScriptSouce = [
  ['Lib/jquery.min'],                       // https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
  ['Lib/jquery-ui'],                        // https://code.jquery.com/ui/1.12.1/jquery-ui.js
  ['Lib/jquery.csv.min'],                   // https://raw.githubusercontent.com/typeiii/jquery-csv/master/src/jquery.csv.min.js
  ['Lib/xlsx.full.min', true],              // https://raw.githubusercontent.com/SheetJS/sheetjs/master/dist/xlsx.full.min.js
  ['Google', true],
  ['Common'],
  // ['Lib/html2pdf.bundle.min'],              // https://raw.githubusercontent.com/eKoopmans/html2pdf.js/master/dist/html2pdf.bundle.min.js
  // ['Lib/jspdf.umd.min'],                    // https://raw.githubusercontent.com/MrRio/jsPDF/master/dist/jspdf.umd.min.js
  // ["Lib/jquery.easy-autocomplete.min"],     // https://raw.githubusercontent.com/pawelczak/EasyAutocomplete/master/dist/jquery.easy-autocomplete.min.js
];

addScript('Init');
function addScript(scriptName) {
  var element = document.createElement('script');
  element.src = GLOBAL.scriptUrl + scriptName + '.js';
  document.head.appendChild(element);
}
