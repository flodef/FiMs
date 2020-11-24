var src = ["Lib/jquery.min.js",                       // https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
           "Lib/jquery-ui.js",                        // https://code.jquery.com/ui/1.12.1/jquery-ui.js
           "Lib/jquery.csv.min.js",                   // https://raw.githubusercontent.com/typeiii/jquery-csv/master/src/jquery.csv.min.js
           "Lib/sorttable.js",                        // https://www.kryogenix.org/code/browser/sorttable/sorttable.js
           // "Lib/jquery.easy-autocomplete.min.js",  // https://raw.githubusercontent.com/pawelczak/EasyAutocomplete/master/dist/jquery.easy-autocomplete.min.js
           "Lib/xlsx.full.min.js",                    // https://raw.githubusercontent.com/SheetJS/sheetjs/master/dist/xlsx.full.min.js
           "Google.js",
           "Common.js",
           "FiMS.js",
         ];

var url = document.URL.split('/');
var page = url[url.length-1].split('.')[0];

// src.forEach(element => {
//   var imp = document.createElement('script');
//   imp.src = page == "index" ? element : element.replace("FiMS", "Associate");
//   document.head.appendChild(imp);
// });

loadScript(0);

function loadScript(i) {
    const link = src[i];
    var element = document.createElement('script');
    element.src = page == "index" ? link : link.replace("FiMS", "Associate");
    document.head.appendChild(element);

    if (++i < src.length) {
      setTimeout(() => loadScript(i), 100);
    }
}
