  window.GLOBAL = {};
  GLOBAL.cost = "COST";
  GLOBAL.approv = "APPROVISIONNEMENT";
  GLOBAL.dashb = [];
  GLOBAL.histo = [];
  GLOBAL.invest = [];
  GLOBAL.dummy = "XXXXXX";

  /**
   * Run initializations on web app load.
   */
  $(function()
  {
    jQuery.fx.off = false;
    updateAllValues(false);
    setInterval(function(){ updateAllValues(false, true); }, 60 * 1000); // run update every minute

    $(document).keyup(onKeyUp);  // The event listener for the key press (action buttons)
  });

  function updateAllValues(shouldRefresh, isBackgroundUpdate)
  {
    if ($("#loading").text() == "") {
      if (!isBackgroundUpdate) {
        showLoader(shouldRefresh);
      }

      $("#loading").text("Loading Dashboard ... (1/3)");

      google.script.run
                   .withSuccessHandler(function(contents) {
                     if (shouldRefresh)
                     {
                       updateValue(3, false, contents);
                       updateValue(2, false, contents);
                       updateValue(1, true, contents);
                       updateValue(4, false, contents);
                     }

                     updateDashboardTable(contents);

                     updateInvestmentValues();  // Next step
                   })
                   .withFailureHandler(displayError)
                   .getSheetValues("Dashboard!A:B");
    }
  }

  function updateInvestmentValues()
  {
    $("#loading").text("Loading Investment ... (2/3)");

    google.script.run
                 .withSuccessHandler(function(contents) {
                   updateInvestmentTable(contents);

                   updateHistoricValues();  // Next step
                 })
                 .withFailureHandler(displayError)
                 .getSheetValues("Investment!D:X");
  }

  function updateHistoricValues()
  {
    $(".validateButton").prop('disabled', true);

    $("#loading").text("Loading Historic ... (3/3)");

    google.script.run
                 .withSuccessHandler(function(contents) {
                   updateHistoricTable(contents);

                   $("input").each(function()
                   {
                     if ($(this).hasClass("auto"))
                     {
                       autoAdaptWidth(this);
                     }
                   });

                   hideLoader();
                   $("#loading").text("");
                   $(".validateButton").prop('disabled', false);
                 })
                 .withFailureHandler(displayError)
                 .getSheetValues("Historic!A:H");
  }

  function rebalanceStocks() {
    updateInvestmentValues();

    var tRebal = parseFloat((toValue(GLOBAL.invest[6][10])
                          - toValue(GLOBAL.invest[6][9])).toFixed(2));
    var tRest = toValue(GLOBAL.invest[6][13]);
    var contents = [];
    var rank = 0;
    for (var i = 1; i < GLOBAL.invest.length-1; i++) { // Take only the value (no header, footer)
      var index = indexOf(GLOBAL.invest, rank.toString(), 12);

      var nr = rank;
      while (!index) {
        index = indexOf(GLOBAL.invest, (--nr).toString(), 12);
      }

      ++rank;

      if (toValue(GLOBAL.invest[index][13]) != 0
       && toValue(GLOBAL.invest[index][14]) < tRebal) {
        var price = toValue(GLOBAL.invest[index][7]);
        var num = tRest/price;
        var bonus = num >= 0 ? Math.floor(num) : Math.ceil(num);
        var rebal = toValue(GLOBAL.invest[index][13]) + bonus;
        var prov = (rebal * price).toFixed(2);
        var action = prov > 0;

        var array = [];
        for (var j of [0, 1, GLOBAL.invest[index][6] != "" ? 6 : 7, 13, 14]) {
          array[GLOBAL.invest[0][j]] = j == 13 ? rebal
                                     : j == 14 ? prov + " €"
                                     : GLOBAL.invest[index][j];
        }
        array["Action"] = action;

        contents.push(array);

        tRebal -= prov;
        tRest -= price * bonus;
      }
    };

    if (contents.length > 0) {
      updateRebalanceTable(contents);
    } else {
      displayError("No stock to rebalance", true);
    }
  }

  function updateRebalanceTable(contents) {
    var closing = '$(\'#popupOverlay\').fadeOut(1000);$(\'#menu\').removeClass(\'blur-filter\');$(\'#content\').removeClass(\'blur-filter\');$(\'#mainFocus\').focus();'
    var tableHTML = '<span class="closebtn" onclick="' + closing + '">&times;</span>';
    for (var i = 0; i < contents.length; i++) {
      tableHTML += '<div ' + (i != 0 ? 'class="hidden"' : '') + 'id="rebal' + i + '">';
      tableHTML += '<table>';

      var row = Object.entries(contents[i]);
      var j = 0;
      for (const [key, value] of row) {
          tableHTML += '<tr>';

          var style = j == 0 || j == 3 ? 'font-weight:900;' : '';

          style += j == 5 ? 'background-color:' + (value ? "#a2c642" : "#da4a4a") + ';color:white;"'
                          : '';
          var val = j == 5 ? (value ? "Buy" : "Sell") : value
          tableHTML += '<th align="center">' + key + '</th>'
                     + '<td align="center" style="' + style + '" padding="10px">' + val + '</td>'

          tableHTML += '</tr>';

          ++j;
      }

      tableHTML += '</table>';

      var tName = row[0][1];
      var tQty = toValue(row[3][1]);
      var tVal = -toValue(row[4][1]);
      var tOpe = row[5][1] ? "BUY" : "SELL";
      var tUnit = tQty && tVal && tName ? -tVal/tQty : "";
      var tId = tName + "@" + tOpe + "@" + tQty + "@" + tVal;

      var isLast = i == contents.length-1;
      var label = isLast ? "CLOSE" : "NEXT ORDER";
      var action = isLast ? closing : '$(\'#rebal' + i + '\').hide();$(\'#rebal' + (i+1) + '\').fadeIn(1000);';
      action += 'insertHistoricRow([[\'' + GLOBAL.dummy + '\', \''
                                       + row[1][1] + '\', \''
                                       + tName + '\', \''
                                       + tOpe + '\', \''
                                       + tQty + '\', \''
                                       + tUnit + '\', \''
                                       + tVal + '\', \''
                                       + tId + '\']], \'Historic\', true);';
      tableHTML += '<div align="center" style="margin:15px 0px 0px 0px;"><button onclick="'
                 + action + '">' + label + '</button></div>';

      tableHTML += '</div>';
    }

    $("#popup").prop("innerHTML", tableHTML);

    $('#popupOverlay').fadeIn(1000);
    $('#menu').addClass("blur-filter");
    $('#content').addClass("blur-filter");
  }

  function addTransaction() {
    updateHistoricValues();
    $('#actionButton').hide("fade", null, 500, function()
    { $('#addTransactionForm').show("fade", null, 500, function()
    { $('#transactionName').focus(); }); });
  }

  function deleteTransaction() {
    updateHistoricValues();
    $('#actionButton').hide("fade", null, 500, function()
    { $('#deleteTransactionForm').show("fade", null, 500); });
  }

  function uploadAccountFile() {
    updateHistoricValues();
    $('#actionButton').hide("fade", null, 500, function()
    { $('#uploadFileForm').show("fade", null, 500, function()
    { $('#fileUpload').focus(); }); });
  }

  function validateAddForm() {
//    var today = new Date();
//    var dd = today.getDate();
//    var mm = today.getMonth()+1; //January is 0!
//    var yyyy = today.getFullYear();
//    dd = dd<10 ? '0' + dd : dd;
//    mm = mm<10 ? '0' + mm : mm;
//    var tDate = mm + '/' + dd + '/' + yyyy;
    var tDate = GLOBAL.dummy;

    var tType = $("#transactionName").children(":selected").attr("title");

    var name = $("#transactionName").prop("value");
    var tName = tType ? name : "";

    var qty = parseInt($("#transactionQuantity").val(), 10);
    var tQty = tName && !isNaN(qty) && qty != 0 ? qty : "";

    var tOpe = !tType ? name
             : tQty<0 ? "SELL"
             : tQty>0 ? "BUY"
             : "DIVIDEND";

    var val = parseFloat($("#transactionValue").val());
    var tVal = !isNaN(val) && val != 0 ? val : "";

    var tUnit = tQty && tVal && tName ? -tVal/tQty : "";

    var errorMsg = tQty && isNaN(tQty) ? "Quantity should be an Integer."
                 : tVal && isNaN(tVal) ? "Value should be a Number."
                 : tName && !tQty && (!tVal || tVal<=0) ? "Coupon value should be positive."
                 : !tName && !tVal ? "Approvisionnement/Cost Value should be set."
                 : tQty && !tVal ? "The Value should be set if the Quantity is set."
                 : tUnit && tUnit<0 ? "Quantity should have an opposite sign as Value."
                 : "";

    if (!errorMsg)
    {
      insertHistoricRow([[tDate, tType, tName, tOpe, tQty, tUnit, tVal,
        tName + "@" + tOpe + "@" + tQty + "@" + tVal]], "Historic");
    }
    else
    {
      displayError(errorMsg, true);
    }
  }

  function insertHistoricRow(data, id, isBackgroundUpdate)
  {
    var index = 1;
    var rowCnt = data.length;

    if (rowCnt > 0) {
      $("#snackbar").text((rowCnt == 1 ? "Transaction" : rowCnt + " Transactions") + " added");

      if (!isBackgroundUpdate) {
        showLoader(true);
      }

      gid = id == "Historic" ? 9
          : id == "ExpensesHistoric" ? 298395308
          : null;
      endCol = id == "Historic" ? 11
             : id == "ExpensesHistoric" ? 4
             : null;

      if (gid && endCol) {
        google.script.run
                    //.withSuccessHandler(function(contents) { setValue("Historic!A2", data, sortTransactionValues) })
                     .withSuccessHandler(function(contents) { setValue(id + "!A2", data, executionSuccess) })
                     .withFailureHandler(displayError)
                     .insertRows(gid, data, {startRow:index, endCol:endCol});
      } else {
        displayError("Unknow spreadsheet: " + id);
      }
    } else {
      displayError("No transaction added.", true);
    }
  }

  function sortTransactionValues()
  {
    google.script.run
                 .withSuccessHandler(function(contents) { executionSuccess(); })
                 .withFailureHandler(displayError)
                 .sortColumn(9, 0, true);
  }

  function validateDeleteForm(index, rowCnt)
  {
    var index = index ? index : indexOf(GLOBAL.histo, GLOBAL.dummy, 0);
    var rowCnt = rowCnt ? rowCnt : 1;

    if (index*rowCnt > 0) {
      $("#snackbar").text((rowCnt == 1 ? "Transaction" : rowCnt + " Transactions") + " deleted");

      showLoader(true);

      google.script.run
                   .withSuccessHandler(function(contents) { executionSuccess(); })
                   .withFailureHandler(displayError)
                   .deleteRows(9, index, index + rowCnt);
    } else {
      displayError("No transaction deleted.", true);
    }
  }

  function validateUploadForm()
  {
    showLoader(true);

    var data = null;
    var file = $("#fileUpload").prop("files")[0];
    if (file)
    {
      var reader = new FileReader();
      reader.readAsText(file);
      reader.onload = function(event) {
        var csvData = event.target.result;
        try {
          data = $.csv.toArrays(csvData.includes(";")
            ? csvData.replace(new RegExp(',', 'g'), '.').replace(new RegExp(';', 'g'), ',')
            : csvData);

          if (data && data.length > 1)
          {
            if (data[0][0] == "Date" && data[0][1] == "Heure") {
              google.script.run
                    .withSuccessHandler(function(contents) {
                      setValue("Account!A1", data);

                      compareResultData();
                    })
                    .withFailureHandler(displayError)
                    .clearSheetValues("Account!A:J");
            } else {
              google.script.run
                    .withSuccessHandler(function(contents) {
                      insertExpensesRow(data, contents);
                    })
                    .withFailureHandler(displayError)
                    .getSheetValues("ExpensesHistoric!A:C");
            }
          } else {
            displayError("No data to import: the file is empty.", true);
          }
        }
        catch (err) {
          displayError(err.message);
        }
      };
      reader.onerror = function() { displayError("Unable to read the file."); };
    } else {
      displayError("No file had been selected.", true);
    }
  }

  function compareResultData()
  {
    google.script.run
                 .withSuccessHandler(function(contents) {
                   if (contents.length > 1) {
                     // Preparing data
                     var dupCnt = 0;
                     var errCnt = 0;
                     var data = [];
                     for (var i = contents.length - 1; i > 0; --i) {   // Don't insert the header
                       var index = indexOf(GLOBAL.histo, contents[i][7], 7);

                       if (!index || (index && contents[i][0] != toDate(GLOBAL.histo[index][0]))) {
                         if (!indexOf(contents[i], "#N/A")) {
                           data.push(contents[i]);
                         } else {
                           ++errCnt;
                         }
                       } else {
                         ++dupCnt;
                       }
                     }

                     // Removing dummy data
                     var prevIndex;
                     var index = indexOf(GLOBAL.histo, GLOBAL.dummy, 0);
                     var dai = [];
                     while (index) {
                       if (index-1 == prevIndex) {
                         dai[dai.length-1][1] += 1;
                       } else {
                         dai.push([index, 1]);
                       }
                       prevIndex = index;

                       index = indexOf(GLOBAL.histo, GLOBAL.dummy, 0, index+1);
                     }

                     for (var i = dai.length-1; i >= 0; --i) { // Reverse loop
                       validateDeleteForm(dai[i][0], dai[i][1]);
                     }

                     // Adding data
                     insertRows(data, "Historic", dupCnt, errCnt, contents.length - 1);
                   } else {
                     compareResultData();
                   }
                 })
                 .withFailureHandler(displayError)
                 .getSheetValues("Result!A:H");
  }

  function insertExpensesRow(contents, expenses) {
    // Preparing data
    var dupCnt = 0;
    var errCnt = 0;
    var data = [];

    for (var i = 1; i < contents.length; i++) { // Don't insert the header
      var row = contents[i];
      var date = row[0];
      var label = row[2];
      var val = toCurrency(row[6], "€");

      if (!indexOf(expenses, date, 0) ||
          !indexOf(expenses, label, 1) ||
          !indexOf(expenses, val, 2)) {
        data.push([date, label, val]);
      } else {
        ++dupCnt;
      }
    }

    // Adding data
    insertRows(data, "ExpensesHistoric", dupCnt, errCnt, contents.length - 1);
  }

  function insertRows(data, id, dupCnt, errCnt, total) {
    if (dupCnt + errCnt != total) {
      insertHistoricRow(data, id);

      if (dupCnt > 0) {
        var msg = errCnt == 0
            ? dupCnt + " duplicate(s) found, " + (total - dupCnt) + " row(s) added."
            : dupCnt + " duplicate(s) found, " + (total - dupCnt - errCnt) + " row(s) added and " + errCnt + " row(s) in error.";
        displayError(msg, errCnt == 0);
      }
    } else {
      var msg = errCnt == 0
          ? "The imported file contains only duplicates (" + dupCnt + " found)."
          : dupCnt + " duplicate(s) found and " + errCnt + " row(s) in error.";
      displayError(msg, errCnt == 0);
    }
  }

  function cancelForm() {
    if ($('#addTransactionForm').is(":visible"))
    {
      $('#addTransactionForm').hide("fade", null, 500, function()
      { $('#actionButton').show("fade", null, 500);
        selectName($('#transactionName').get(0), 0);
        $('#transactionQuantity').val("");
        $('#transactionValue').val(""); });
    }
    else if ($('#deleteTransactionForm').is(":visible"))
    {
      $('#deleteTransactionForm').hide("fade", null, 500, function()
      { $('#actionButton').show("fade", null, 500); });
    }
    else if ($('#uploadFileForm').is(":visible"))
    {
      $('#uploadFileForm').hide("fade", null, 500, function()
      { $('#actionButton').show("fade", null, 500);
        $('#fileUpload').val("")});
    }

    $('#mainFocus').focus();
  }

  function onKeyUp(e)
  {
    if (!$('#addTransactionForm').is(":animated")
     && !$('#deleteTransactionForm').is(":animated")
     && !$('#uploadFileForm').is(":animated")
     && !$('#actionButton').is(":animated")
     && !$('#loaderOverlay').is(':visible'))
    {
      if ($('#alertOverlay').is(':visible'))
      {
        $('#alertOverlay').fadeOut(1000);
      }
      else if (!$('#actionButton').is(':visible'))
      {
        if (e.keyCode === 13) // Enter
        {
          if ($('#addTransactionForm').is(':visible'))
          {
            validateAddForm();
          }
          else if ($('#deleteTransactionForm').is(':visible'))
          {
            validateDeleteForm();
          }
          else if ($('#uploadFileForm').is(':visible'))
          {
            validateUploadForm();
          }
        }
        else if (e.keyCode === 27) // Esc
        {
          cancelForm();
        }
      }
      else
      {
        if (!$('input[type="number"]').is(':focus') && !$('input[type="text"]').is(':focus'))// && $('#actionButton').is(':visible'))
        {
          if (e.keyCode === 186) // $
          {
            rebalanceStocks();
          }
          if (e.keyCode === 107 || e.keyCode === 187) // +
          {
            addTransaction();
          }
          else if (e.keyCode === 109 || e.keyCode === 189) // -
          {
            deleteTransaction();
          }
          else if (e.keyCode === 85) // U
          {
            uploadAccountFile();
          }
          else if (e.keyCode === 82) // R
          {
            updateAllValues(true);
          }
        }
      }
    }
  }

  function addTransactionName(title, text)
  {
    $('#transactionName').append($('<option>', {
      title: title,
      text: text
    }));
  }

  function clearTransactionName()
  {
    $('#transactionName').children('option').remove();
  }

  function updateDashboardTable(contents)
  {
    GLOBAL.dashb = contents;

    google.script.run
                 .withSuccessHandler(function(contents) {
                   var id = "dashboard";
                   var tableHTML = '<div style="margin:20px 0px 0px 25px">' + getTitle(id) + '</div>';
                   tableHTML += getMainTableHead(id);
                   tableHTML += getSubTableTitle(contents[0][0], "Settings!A1");
                   tableHTML += '<tr>';
                   for (var item of contents[1]) {
                     tableHTML+= getTableReadOnlyCell(GLOBAL.dashb, item);
                   }
                   tableHTML += '</tr>';

                   tableHTML += getSubTableTitle(contents[0][1], "Settings!B1");
                   tableHTML += '<tr>';
                   for (var item of contents[2]) {
                     tableHTML += getTableReadOnlyCell(GLOBAL.dashb, item);
                   }
                   tableHTML += '</tr>';

                   tableHTML += getSubTableTitle(contents[0][2], "Settings!C1");
                   tableHTML += '<tr>';
                   for (var item of contents[3]) {
                     tableHTML += getTableReadOnlyCell(GLOBAL.dashb, item);
                   }
                   tableHTML += '</tr>';

                   tableHTML += getSubTableTitle(contents[0][3], "Settings!D1");
                   tableHTML += '<tr>';
                   for (var item of contents[4]) {
                     tableHTML += getTableReadOnlyCell(GLOBAL.dashb, item);
                   }
                   tableHTML += '</tr>';

                   tableHTML += getSubTableTitle(contents[0][4], "Settings!E1");
                   tableHTML += '<tr>';
                   for (var item of contents[5]) {
                     tableHTML += item != 44
                                ? getTableReadOnlyCell(GLOBAL.dashb, item)
                                : getTableEditableCell(GLOBAL.dashb, item, "Allocation!B14")
                   }
                   tableHTML += '</tr>';

                   tableHTML += '</table>';

                   $("#dashboardDiv").prop("innerHTML", tableHTML);
                 })
                 .withFailureHandler(displayError)
                 .getSheetValues("Settings!A:E");

    // Rebalance is not available if rebalance is not needed
    $("#rebalanceButton").prop('disabled', GLOBAL.dashb[50][1] == "FALSE");
  }

  function updateInvestmentTable(contents)
  {
    GLOBAL.invest = contents;

    clearTransactionName();

    var id = "investment";
    var tableHTML = getTableTitle(id, "Rebalance", contents[0].length-1, "filterRebalance(this.checked)", 0);
    for (var i = 0; i < contents.length; ++i) {
      tableHTML += i==0 ? '<thead>' : '';
      tableHTML += i==0 ? '<tr>' : '<tr title="' + contents[i][1] + '">';
      //for (var j = 0; j < contents[i].length; ++j)
      for (var j of [0, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {   // Select only the interesting columns
        tableHTML += getTableReadOnlyContent(contents[i][j], i == 0);
      }
      tableHTML += '</tr>';
      tableHTML += i==0 ? '</thead><tbody>'
      : i==contents.length-2 ? '</tbody><tfoot>'
      : i==contents.length-1 ? '</tfoot>' : '';

      if (i != 0 && i != contents.length-1) {
        addTransactionName(contents[i][1], contents[i][0]);
      }
    }
    tableHTML += '</table>';

    addTransactionName("", GLOBAL.cost);
    addTransactionName("", GLOBAL.approv);

    applyFilter(id, tableHTML, filterRebalance);
  }

  function updateHistoricTable(contents)
  {
    GLOBAL.histo = contents;

    var id = "historic";
    var tableHTML = getTableTitle(id, "Show all", contents[0].length-1, "showAllHistoric(this.checked)", 1);
    for (var i = 0; i < contents.length; ++i) {
      tableHTML += i==0 ? '<thead>' : '';
      tableHTML += '<tr>';
      for (var j = 0; j < contents[i].length - 1; ++j) {   // Don't display the ID at the end
        tableHTML += getTableReadOnlyContent(contents[i][j], i == 0);
      }
      tableHTML += '</tr>';
      tableHTML += i==0 ? '</thead><tbody>'
      : i==contents.length-1 ? '</tbody>' : '';
    }
    tableHTML += '</table>';

    applyFilter(id, tableHTML, showAllHistoric);
  }

  function applyFilter(id, tableHTML, func) {
    $("#" + id + "Div").prop("innerHTML", tableHTML);
    sorttable.makeSortable($("#" + id + "Table").get(0));
    func($('#' + id + 'Limit').val() == "");
  }

  function getTableEditableCell(contents, index, rangeName, limit) {
    return getTableReadOnlyContent(contents[index-1][0], false) +
           getTableEditableContent(contents[index-1][1], rangeName, limit);
  }

  function getTableReadOnlyCell(contents, index) {
    return getTableReadOnlyContent(contents[index-1][0], false) +
           getTableReadOnlyContent(contents[index-1][1], false);
  }

  function getTableReadOnlyContent(content, isHeader) {
    return isHeader ? '<th align="center">' + content + '</th>'
                    : '<td align="center">' + content + '</td>';
  }

  function getTableEditableContent(content, rangeName, limit) {
    return '<td align="center"><input class="auto" min="-' + limit + '" max="' + limit + '"'
         + ' oninput="autoAdaptWidth(this);setValue(\'' + rangeName + '\', [[this.value]])"'
         + ' style="border:0px;width:100px;min-width:15px;" type="number" value="'
         + this.toValue(content) + '">€</input></td>';
  }

  function getSubTableTitle(title, rangeName) {
    return '<tr><td colspan="10"><input class="tableTitle" type="text"'
         + ' oninput=";setValue(\'' + rangeName + '\', [[this.value]])"'
         + ' style="border:0px;min-width:55px;min-width:200px;font-size:16px;line-height:33px;color:#b1b1b1;margin:6px;"'
         + ' value="' + title + '"></input></td></tr>';
  }

  function getTitle(id) {
    return '<h2 onclick="$(\'#' + id + 'Table\').fadeToggle(\'slow\');">'
          + id.charAt(0).toUpperCase() + id.slice(1) + '</h2>';
  }

  function getTableTitle(id, tooltip, colspan, func, searchIndex) {
    return '<table><tr style="background-color:white"><td><table style="border:0px;padding:0px;width:auto">'
         + '<tr style="background-color:white;"><td>' + getTitle(id) + '</td>'
         + '<td><div class="tooltip"><label class="switch" style="border:30px;margin:7px 0px 0px 0px;">'
         + '<input type="checkbox" ' + ($('#' + id + 'Limit').val() == "" ? 'checked' : '') + ' onclick="' + func + '">'
         + '<div class="slider round"></div></label><span class="tooltiptext">' + tooltip + '</span></div></td></tr></table>'
         + '<div id="' + id + 'Limit" class="hidden"></div>'
         + '<td colspan="' + colspan + '" align="right">'
         + '<input id="searchInput" type="text" placeholder="Search"'
         + 'onkeyup="searchTable(this, \'' + id + 'Table\', ' + searchIndex + ', $(\'#' + id + 'Limit\').val())"></tr></table>'
         + getMainTableHead(id);
  }

  function getMainTableHead(id) {
    return '<table id="' + id + 'Table" class="sortable '
         + ($("#" + id + "Table").is(":visible") ? '' : 'hidden') + '">';
  }

  function autoAdaptWidth(e) {
    var step = 7.23;
    var index = 10;
    var precision = 2;
    var maxLength = Math.max(String(e.min).length, String(e.max).length) + precision;

    var val = parseFloat(e.value);
    if (!isNaN(val)) {
      if (val > e.max) {
        e.value = e.max;
      } else if (val < e.min) {
        e.value = e.min;
      } else if (val * 100 % 1 !== 0 || String(e.value).length > maxLength) {
        e.value = val.toFixed(precision);
      }

      e.style = "border-color:transparent";
      e.style.width = Math.ceil(Math.max(String(e.value).length, 1) * step + index) + "px";
    } else {
      e.style = !e.placeholder || e.value != ""
              ? "border-color:red"
              : "border-color:transparent";
    }
  }

  function selectName(e, index) {
    if (index !== undefined) {
      $('#transactionName').prop("selectedIndex", index);
    } else {
      index = e.selectedIndex;
    }

    if (e.options[index].title) {
      $("#transactionQuantityLabel").fadeIn();
    } else {
      $("#transactionQuantityLabel").fadeOut();
    }
  }

  function updateValue(row, isPercent, contents) {
    var col = 1;
    var index = contents.length - 5;
    var a = toValue(contents[row-1][col]);
    var ax = toValue(contents[row-1 + index][col]);
    var ar = isPercent ? (a + ax) / 100 : a + ax;

    setValue("Dashboard!B" + row, [[ar]]);
  }

  function setValue(name, value, func) {
    google.script.run
                 .withSuccessHandler(function(contents) { if (func) { func(); } })
                 .withFailureHandler(displayError)
                 .setSheetValues(name, value);
  }

  function filterRebalance(isChecked) {
    // Loop through all table rows, and hide those who don't match the search query
    $("#investmentLimit").val(isChecked ? null : "10");
    $("#investmentTable tbody tr").each(function(i) {
      var td = $(this).children("td")[7];
      if (!isChecked || (td && td.innerHTML != 0)) {
        $(this).show();
      } else {
        $(this).hide();
      }
    });
  }

  function showAllHistoric(isChecked) {
    // Loop through all table rows, and hide those who don't match the search query
    $("#historicLimit").val(isChecked ? null : "10");
    $("#historicTable tbody tr").each(function(i) {
      if (isChecked || i <= $("#historicLimit").val()) {
        $(this).show();
      } else {
        $(this).hide();
      }
    });
  }

  function searchTable(searchElement, tableName, index, limit) {
    var filter = searchElement.value.toUpperCase();
    var max = limit ? parseInt(limit) : null;

    $("#" + tableName + " tbody tr").each(function(i) {
      var td = $(this).children("td")[index];
      if ((!max || i < max) && td
      && td.innerHTML.toUpperCase().indexOf(filter) > -1) {
        $(this).show();
      } else {
        $(this).hide();
      }
    });
  }

  function showSnackBar() {
    if ($("#snackbar").text()) {
      $("#snackbar").addClass("show");

      // After 3 seconds, remove the show class from DIV
      setTimeout(function(){ $("#snackbar").removeClass("show"); $("#snackbar").text(""); }, 3000);
    }
  }

  function showLoader(isRefreshing) {
    $('#loaderOverlay').fadeIn(1000);
    $('#content').fadeTo(1000, isRefreshing ? 0.3 : 0);
    $('#menu').fadeTo(1000, isRefreshing ? 0.3 : 0);
  }

  function hideLoader() {
    $('#loaderOverlay').fadeOut(1000);
    $('#content').fadeTo(1000, 1);
    $('#menu').fadeTo(1000, 1);
  }

  function executionSuccess() {
    updateAllValues(false, true);
    cancelForm();
    showSnackBar();
  }

  function displayError(msg, isWarning) {
    hideLoader();

    $("#alert").css("background-color", isWarning ? "#ff9800" : "#f44336");
    $("#alert").prop("innerHTML", '<span class="closebtn" onclick="$(\'#alertOverlay\').fadeOut(1000);$(\'#transactionName\').focus();">&times;</span>'
                                + '<strong>' + (isWarning ? "WARNING" : "ALERT") + ':</strong> ' + msg);
    $('#alertOverlay').fadeIn(1000);
  }

  function toValue(content) {
    return content ? parseFloat(String(content).replace(",", "")
                                               .replace(" ", "")
                                               .replace("$", "")
                                               .replace("€", ""))
                   : 0;
  }

  function toCurrency(content, symbol) {
    return (content
      ? String(content).includes(",") || String(content).includes(".")
        ? String(content).replace(",", ".")
        : String(content) + ".00"
      : "0").replace(" ", ",") + " " + symbol;
  }

  function toDate(content) {
    return content && content.split("/").length == 3
         ? content.replace(/(^|\/)0+/g, "$1").split("/")[1] + "/"
         + content.replace(/(^|\/)0+/g, "$1").split("/")[0] + "/"
         + content.split("/")[2]
         : null;
  }

  function indexOf(array, value, index, start) {
    var index = index >= 0 ? index : null;
    var x = Number.isInteger(start) ? start : 0;

    var i;
    if (Array.isArray(array)) {
      while(x < array.length
         && ((index == null && array[x] != value)
          || (index != null && array[x][index] != value))) { ++x; }

      i = x < array.length ? x : null;
    }

    return i;
  }
