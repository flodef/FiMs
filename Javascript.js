var src = ["Lib/jquery.min.js",
           "Lib/jquery-ui.js",
           "Lib/jquery.easy-autocomplete.min.js",
           "Lib/jquery.csv-0.71.min.js",
           "Lib/sorttable.js",
           "Lib/xlsx.full.min.js",
           "Common.js",
           "FiMS.js",
           "Google.js",
         ];

var url = document.URL.split('/');
var page = url[url.length-1].split('.')[0];

src.forEach(element => {
  var imp = document.createElement('script');
  imp.src = page == "index" ? element : element.replace("FiMS", "Associate");
  document.head.appendChild(imp);
});
