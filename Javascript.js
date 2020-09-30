var src = ["Lib/jquery.min.js",
           "Lib/jquery-ui.js",
           "Lib/jquery.easy-autocomplete.min.js",
           "Lib/jquery.csv-0.71.min.js",
           "Lib/sorttable.js",
           "Lib/xlsx.full.min.js",
           "FiMS.js",
           "Google.js",
         ];

src.forEach(element => {
  var imp = document.createElement('script');
  imp.src = element;
  document.head.appendChild(imp);
});
