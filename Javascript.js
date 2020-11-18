var src = ["Lib/jquery.min.js",
           "Lib/jquery-ui.js",
           // "Lib/jquery.easy-autocomplete.min.js",
           "Lib/jquery.csv-0.71.min.js",
           "Lib/sorttable.js",
           "Lib/xlsx.full.min.js",
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
    const link = src[i]
    var element = document.createElement('script');
    element.src = page == "index" ? link : link.replace("FiMS", "Associate");
    document.head.appendChild(element);

    if (++i < src.length) {
      setTimeout(() => loadScript(i), 100);
    }
}
