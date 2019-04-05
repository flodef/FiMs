  window.GLOBAL = {};
  GLOBAL.cost = "COST";
  GLOBAL.approv = "APPROVISIONNEMENT";
  GLOBAL.dashboardData = [];
  GLOBAL.investmentData = [];
  GLOBAL.historicData = [];
  GLOBAL.evolutionData = [];
  GLOBAL.dummy = "XXXXXX";
  GLOBAL.dataPreloadRowLimit = 10;
  GLOBAL.timeBetweenReload = 60;
  GLOBAL.rebalCol = 18;
  GLOBAL.dashboard = "dashboard";
  GLOBAL.investment = "investment";
  GLOBAL.historic = "historic";
  GLOBAL.evolution = "evolution";
  GLOBAL.dashboardFormula = "Dashboard!A:B";
  GLOBAL.investmentFormula = "Investment!D:AE";
  GLOBAL.historicFormula = "Historic!A:J";
  GLOBAL.evolutionFormula = "Evolution!A:I";
  GLOBAL.resultFormula = "Result!A:H";
  GLOBAL.accountFormula = "Account!A:K";
  GLOBAL.expHistoFormula = "ExpensesHistoric!A:C";
  GLOBAL.settingsFormula = "Settings!A:F";
  GLOBAL.rebalanceButtonToolTip = "Rebalance";
  GLOBAL.showAllButtonToolTip = "Show all";
  GLOBAL.hasAlreadyUpdated = [];
  GLOBAL.hasLoadingQueue = false;

  /**
   * Run initializations on web app load.
   */
   // document.addEventListener('visibilitychange', () => GLOBAL.doVisualUpdates = !document.hidden);
  $(() => {
    jQuery.fx.off = false;  // if false, display jQuery viesual effect like "fade"

    displayElement('.contentOverlay', true, 0);
    displayElement(".actionButton", false, 0);
    // $(".actionButton").prop('disabled', true);

    $(document).on('visibilitychange', () => GLOBAL.doVisualUpdates = !document.hidden);
    $(document).keyup(onKeyUp);  // The event listener for the key press (action buttons)

    for (ids of [GLOBAL.dashboard, GLOBAL.investment, GLOBAL.historic, GLOBAL.evolution]) {
      var tableHTML = getTableTitle(ids, true);
      setTable(ids, tableHTML);
    }

    updateAllValues();
  });

  function updateAllValues() {
    dashboardValuesUpdate();
    investmentValuesUpdate();
    historicValuesUpdate();
    evolutionValuesUpdate();
  }

  function dashboardValuesUpdate() {
    getValue(GLOBAL.dashboardFormula, updateDashboardTable, GLOBAL.dashboard);
  }

  function investmentValuesUpdate() {
    getValue(GLOBAL.investmentFormula, updateInvestmentTable, GLOBAL.investment);
  }

  function historicValuesUpdate() {
    getValue(GLOBAL.historicFormula, updateHistoricTable, GLOBAL.historic);
  }

  function evolutionValuesUpdate() {
    getValue(GLOBAL.evolutionFormula, updateEvolutionTable, GLOBAL.evolution);
  }

  function rebalanceStocks() {
    investmentValuesUpdate();

    var tRow = GLOBAL.investmentData.length - 1;
    var contents = [];
    var rank = 0;
    for (var i = 1; i < tRow; i++) { // Take only the value (no header, footer)
      var index = indexOf(GLOBAL.investmentData, rank.toString(), 13);

      var nr = rank;
      while (index === null) {
        index = indexOf(GLOBAL.investmentData, (--nr).toString(), 13);
      }

      ++rank;
      if(shouldRebalance(GLOBAL.investmentData[index][18])) {
        var array = [];
        for (var j of [0, 10, 6, GLOBAL.investmentData[index][7] != "" ? 7 : 8, 14, 15, 27]) {
          array[GLOBAL.investmentData[0][j]] = GLOBAL.investmentData[index][j];
        }
        array["Action"] = GLOBAL.investmentData[index][j] > 0;

        contents.push(array);
      }
    };

    if (contents.length > 0) {
      updateRebalanceTable(contents);
    } else {
      displayError("No stock to rebalance", true);
    }
  }

  function updateRebalanceTable(contents) {
    var closing = 'displayElement(\'#popupOverlay\', false, () => { $(\'.contentOverlay\').removeClass(\'blur-filter\');$(\'#mainFocus\').focus(); });';

    var tableHTML = '<span class="closebtn" onclick="' + closing + '">&times;</span>';
    for (var i = 0; i < contents.length; i++) {
      tableHTML += '<div ' + (i != 0 ? 'class="hidden"' : '') + 'id="rebal' + i + '">';
      tableHTML += '<table>';

      var row = Object.entries(contents[i]);
      for (const [key, value] of row) {
          tableHTML += '<tr>';

          var style = key == "Name" || key == "Rebalance" || (key == "Tendency" && shouldRebalance(value))
                    ? 'font-weight:900;' : '';
          style += key == "Action"
                          ? 'background-color:' + (value ? "#a2c642" : "#da4a4a") + ';color:white;"'
                          : '';
          var val = key == "Action" ? (value ? "Buy" : "Sell") : value;
          tableHTML += '<th align="center">' + key + '</th>'
                     + '<td align="center" style="' + style + '" padding="10px">' + val + '</td>'

          tableHTML += '</tr>';
      }

      tableHTML += '</table>';

      var isLast = i == contents.length-1;
      var skiping = 'overDisplay(\'#rebal' + i + '\', \'#rebal' + (i+1) + '\');';
      var next = isLast ? closing : skiping;
      var label = isLast ? "CLOSE" : "NEXT ORDER";
      tableHTML += '<div align="center" style="margin:15px 0px 0px 0px;">'
                 + '<button style="margin:0px 5px 0px 5px;" onclick="' + next + '" class="rebalButton">' + label + '</button>'
                 + '</div>';

      tableHTML += '</div>';
    }

    $("#popup").prop("innerHTML", tableHTML);

    $('.contentOverlay').addClass("blur-filter");
    displayElement('#popupOverlay', true);
  }

  function addTransaction() {
    historicValuesUpdate();
    overDisplay('#actionButton', '#addTransactionForm', () => $('#transactionName').focus());
  }

  function deleteTransaction() {
    historicValuesUpdate();
    overDisplay('#actionButton', '#deleteTransactionForm');
  }

  function uploadAccountFile() {
    historicValuesUpdate();
    overDisplay('#actionButton', '#uploadFileForm', () => $('#fileUpload').focus());
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

    if (!errorMsg) {
      insertHistoricRow([[tDate, tType, tName, tOpe, tQty, tUnit, tVal,
        tName + "@" + tOpe + "@" + tQty + "@" + tVal]], "Historic");
    } else {
      displayError(errorMsg, true);
    }
  }

  function insertHistoricRow(data, id) {
    var index = 1;
    var rowCnt = data.length;

    if (rowCnt > 0) {
      $("#snackbar").text((rowCnt == 1 ? "Transaction" : rowCnt + " Transactions") + " added");

      // showLoader(true);

      gid = id == "Historic" ? 9
          : id == "ExpensesHistoric" ? 298395308
          : null;
      endCol = id == "Historic" ? 15
             : id == "ExpensesHistoric" ? 4
             : null;

      if (gid && endCol) {
        google.script.run
                    //.withSuccessHandler(function(contents) { setValue(id + "!A2", data, sortTransactionValues) })
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

  function sortTransactionValues() {
    google.script.run
                 .withSuccessHandler(function(contents) { executionSuccess(); })
                 .withFailureHandler(displayError)
                 .sortColumn(9, 0, true);
  }

  function validateDeleteForm(index, rowCnt, func = () => {}) {
    var index = index ? index : indexOf(GLOBAL.historicData, GLOBAL.dummy, 0);
    var rowCnt = rowCnt ? rowCnt : 1;

    if (index !== null && index*rowCnt > 0) {
      $("#snackbar").text((rowCnt == 1 ? "Transaction" : rowCnt + " Transactions") + " deleted");

      // showLoader(true);

      google.script.run
                   .withSuccessHandler(function(contents) { func(); executionSuccess(); })
                   .withFailureHandler(displayError)
                   .deleteRows(9, index, index + rowCnt);
    } else {
      displayError("No transaction deleted.", true);
    }
  }

  function validateUploadForm() {
    // showLoader(true);

    var data = null;
    var file = $("#fileUpload").prop("files")[0];
    if (file) {
      var reader = new FileReader();
      reader.onload = function(event) {
        var csvData = event.target.result;
        try {
          data = $.csv.toArrays(csvData.includes(";")
            ? csvData.replace(new RegExp(',', 'g'), '.').replace(new RegExp(';', 'g'), ',')
            : csvData);

          if (data && data.length > 1) {
            if (data[0][0] == "Date" && data[0][1] == "Heure") {
              google.script.run
                    .withSuccessHandler(function(contents) {
                      setValue("Account!A1", data);
                      getValue(GLOBAL.resultFormula, compareResultData);
                    })
                    .withFailureHandler(displayError)
                    .clearSheetValues(GLOBAL.accountFormula);
            } else if (data[0][0] == "dateOp" && data[0][1] == "dateVal") {
              getValue(GLOBAL.expHistoFormula, contents => insertExpensesRow(data, contents));
            } else if (data[0][0] == "CA ID" && data[0][1] == "Produit") {
              insertDividendRow(data);
            } else {
              displayError("File type not recognised.");
            }
          } else {
            displayError("No data to import: the file is empty.", true);
          }
        }
        catch (err) {
          displayError(err.message);
        }
      };
      reader.onerror = () => displayError("Unable to read the file.");
      reader.readAsText(file);
    } else {
      displayError("No file had been selected.", true);
    }
  }

  function compareResultData(contents) {
    if (contents.length > 1) {
      // Preparing data
      var dupCnt = 0;
      var errCnt = 0;
      var data = [];
      for (var i = contents.length - 1; i > 0; --i) {   // Don't insert the header and reverse loop
        var row = contents[i];
        var isEmpty = toValue(row[6]) == 0;
        var index = !isEmpty ? indexOf(GLOBAL.historicData, row[7], 7) : null;

        if (!isEmpty
        && (index === null
        || (index !== null && row[0] != toDate(GLOBAL.historicData[index][0])))) {
          if (indexOf(row, "#N/A") === null
          && indexOf(row, "#VALUE!") === null
          && indexOf(row, "#REF!") === null) {
            data.push(row);
          } else {
            ++errCnt;
          }
        } else {
          ++dupCnt;
        }
      }

      // Removing dummy data
      var prevIndex;
      var index = indexOf(GLOBAL.historicData, GLOBAL.dummy, 0);
      var dai = [];
      while (index !== null) {
        if (index-1 == prevIndex) {
          dai[dai.length-1][1] += 1;
        } else {
          dai.push([index, 1]);
        }
        prevIndex = index;

        index = indexOf(GLOBAL.historicData, GLOBAL.dummy, 0, index+1);
      }

      var f = count => {
        if (count <= 0) {
          insertRows(data, "Historic", dupCnt, errCnt, contents.length - 1);
        }
      };

      // Adding data
      if (dai.length == 0) {
        f(dai.length);
      } else {
        for (var i = dai.length-1; i >= 0; --i) { // Reverse loop
          validateDeleteForm(dai[i][0], dai[i][1], () => f(i));
        }
      }
    } else {
      getValue(GLOBAL.resultFormula, compareResultData);
    }
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
      var val = toCurrency(row[6]);

      if (indexOf(expenses, date, 0) === null ||
          indexOf(expenses, label, 1) === null ||
          indexOf(expenses, val, 2) === null) {
        data.push([date, label, val]);
      } else {
        ++dupCnt;
      }
    }

    // Adding data
    insertRows(data, "ExpensesHistoric", dupCnt, errCnt, contents.length - 1);
  }

  function insertDividendRow(contents) {
    // Preparing data
    var dupCnt = 0;
    var errCnt = 0;
    var data = [];
    var isError;

    for (var i = 1; i < contents.length; i++) { // Don't insert the header
      var row = contents[i];
      var type;
      var label;
      if (row[1].includes("EXT")) {
        type = "Long term US bonds (20-25 year)";
        label = "Vanguard Extended Duration ETF";
      } else if (row[1].includes("INT")) {
        type = "Intermediate US bonds (7-10 year)";
        label = "Vanguard Intmdte Tm Govt Bd ETF";
      } else if (row[1].includes("20+")) {
        type = "Long term US bonds (20-25 year)";
        label = "ISHARES IV PLC ISHS $ TRSRY BD 20+YR UCITS ETF USD DIST";
      } else if (row[1].includes("7-10")) {
        type = "Intermediate US bonds (7-10 year)";
        label = "ISHARES US T 7-10";
      } else if (row[1].includes("S&P")) {
        type = "Stocks";
        label = "VANGUARD S&P500"
      } else {
        isError = true;
      }

      var transaction = "DIVIDEND";
      var value = toCurrency(row[5]);
      var id = label + "@" + transaction + "@@" + row[5].replace(",", ".");

      if (!isError) {
        var index = indexOf(GLOBAL.historicData, value, 6);

        if (index === null || (index !== null &&
                              (GLOBAL.historicData[index][0] != GLOBAL.dummy
                            || GLOBAL.historicData[index][7] != id))) {
            data.push([GLOBAL.dummy, type, label, transaction, "", "", value, id]);
        } else {
            ++dupCnt;
        }
      } else {
        ++errCnt;
        isError = false;
      }
    }

    // Adding data
    insertRows(data, "Historic", dupCnt, errCnt, contents.length - 1);
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
    if ($('#addTransactionForm').is(":visible")) {
      overDisplay('#addTransactionForm', '#actionButton', () => {
        selectName($('#transactionName').get(0), 0);
        $('#transactionQuantity').val("");
        $('#transactionValue').val(""); });
    } else if ($('#deleteTransactionForm').is(":visible")) {
      overDisplay('#deleteTransactionForm', '#actionButton');
    } else if ($('#uploadFileForm').is(":visible")) {
      overDisplay('#uploadFileForm', '#actionButton', () => $('#fileUpload').val(""));
    } else if ($('#popupOverlay').is(":visible")) {
      $(".rebalButton").prop('disabled', false);
    }

    $('#mainFocus').focus();
  }

  function onKeyUp(e) {
    if (!$('#addTransactionForm').is(":animated")
     && !$('#deleteTransactionForm').is(":animated")
     && !$('#uploadFileForm').is(":animated")
     && !$('#actionButton').is(":animated")) {
     // && !$('#loaderOverlay').is(':visible')) {
      if ($('#alertOverlay').is(':visible')) {
        displayElement('#alertOverlay', false);
      } else if (!$('#actionButton').is(':visible')) {
        if (e.keyCode === 13) { // Enter
          if ($('#addTransactionForm').is(':visible')) {
            validateAddForm();
          }
          else if ($('#deleteTransactionForm').is(':visible')) {
            validateDeleteForm();
          }
          else if ($('#uploadFileForm').is(':visible')) {
            validateUploadForm();
          }
        }
        else if (e.keyCode === 27) { // Esc
          cancelForm();
        }
      } else {
        if (!$('input[type="number"]').is(':focus') && !$('input[type="text"]').is(':focus'))  {
          if (e.keyCode === 186) { // $
            rebalanceStocks();
          } else if (e.keyCode === 107 || e.keyCode === 187) { // +
            addTransaction();
          }
          else if (e.keyCode === 109 || e.keyCode === 189) { // -
            deleteTransaction();
          }
          else if (e.keyCode === 85) { // U
            uploadAccountFile();
          }
          else if (e.keyCode === 82) { // R
            updateAllValues();
          }
        }
      }
    }
  }

  function addTransactionName(title, text) {
    $('#transactionName').append($('<option>', {
      title: title,
      text: text
    }));
  }

  function clearTransactionName() {
    $('#transactionName').children('option').remove();
  }

  function updateDashboardTable(contents) {
    GLOBAL.dashboardData = contents;

    getValue(GLOBAL.settingsFormula, contents => {
      var id = GLOBAL.dashboard;
      var tableHTML = getTableTitle(id);

      var ln = contents.length/2;      // Take the full sheet row count, don't count the miror with numbers (/2)
      for (var i = 0; i < ln-2; i++) { // Remove the two last row for scroll (-2)
        tableHTML += getSubTableTitle(contents[i][0], "Settings!A" + (i+1));
        tableHTML += '<tr>';
        for (var j = 1; j < contents[i].length; j++) {
          tableHTML += i != 4 || j != 3
          ? getTableReadOnlyCell(GLOBAL.dashboardData, contents[i+ln][j])
          : getTableEditableCell(GLOBAL.dashboardData, contents[i+ln][j], "Allocation!B14", 1000000)
        }
        tableHTML += '</tr>';
      }
      setTable(id, tableHTML);

      tableHTML = '<marquee direction="down" scrollamount="1" behavior="scroll" style="width:250px;height:60px;margin:15px"><table>';
      tableHTML += '<tr>' + getTableReadOnlyCell(GLOBAL.dashboardData, GLOBAL.dashboardData.length-1) + '</tr>';  // Dirty way to display the "Time since last update"
      for (var i = 0; i < contents[ln-2].length; ++i) {
        tableHTML += '<tr>';
        tableHTML += getTableReadOnlyContent(contents[ln-2][i], false);
        tableHTML += getTableReadOnlyContent(GLOBAL.dashboardData[contents[ln*2-1][i]-1][1], false);
        tableHTML += '</tr>';
      }

      tableHTML += '</table></marquee>';
      $("#scrollDiv").prop("innerHTML", tableHTML);

      $("input").each((i, item) => {
        if ($(item).hasClass("auto")) {
          autoAdaptWidth(item);
        }
      });
    });
  }

  function updateInvestmentTable(contents) {
    GLOBAL.investmentData = contents;

    displayElement("#rebalanceButton", shouldRebalance(GLOBAL.investmentData[GLOBAL.investmentData.length-1][GLOBAL.rebalCol]));

    clearTransactionName();

    var tags = [];

    var id = GLOBAL.investment;
    var row = contents.length;
    var col = contents[0].length;
    var tableHTML = getTableTitle(id, false, GLOBAL.rebalanceButtonToolTip, col-1);
    for (var i = 0; i < row; ++i) {
      tableHTML += i==0 ? '<thead>' : '';
      tableHTML += i==0 ? '<tr>' : '<tr title="' + contents[i][1] + '">';
      //for (var j = 0; j < contents[i].length; ++j)
      for (var j of [0, 6, 8, 10, 14, 15, 18, 19, 21, 23, 25]) {   // Select only the interesting columns
        // Name = 0, Shares = 6, Price = 8, Sell = 10, Rebalance = 14, Provision = 15, Tendency = 18, Daily result	Rate	Dividend	Rate	Stock	Rate	Total	Rate = 20 to 26
        var con =  i == 0 || j != 8
                    ? i == 0 || j < 19
                      ? contents[i][j]
                      : contents[i][j] + ' (' + contents[i][j+1] + ')'
                    : !contents[i][7] || !contents[i][8] || contents[i][7] == contents[i][8]
                      ? contents[i][8] ? toCurrency(contents[i][j], 4) : ""
                      : toCurrency(contents[i][j], 4) + ' (' + toCurrency(contents[i][j-1], 4, "$") + ')';
        var isDisabled = (j == 14 || j == 15) && !shouldRebalance(contents[i][18]);
        tableHTML += getTableReadOnlyContent(con, i == 0, isDisabled);
      }
      tableHTML += '</tr>';
      tableHTML += i==0 ? '</thead><tbody>'
      : i==row-2 ? '</tbody><tfoot>'
      : i==row-1 ? '</tfoot>' : '';

      if (i != 0 && i != row-1) {
        tags.push(contents[i][0]);
        addTransactionName(contents[i][1], contents[i][0]);
      }
    }

    addTransactionName("", GLOBAL.cost);
    addTransactionName("", GLOBAL.approv);

    applyFilter(id, tableHTML);

//    $("#" + id + "Table th:first").addClass("sorttable_sorted");
    sorttable.innerSortFunction.apply($("#" + id + "Table th:first")[0], []);

    // $("#" + id + "Search").easyAutocomplete({ data: tags, list: { match: { enabled: true } } });
    // $("#" + id + "Search").autocomplete({ source: tags });
    // Rebalance is not available if rebalance is not needed
  }

  function updateHistoricTable(contents) {
    GLOBAL.historicData = contents;

    $(".validateButton").prop('disabled', true);

    displayElement("#uploadButton", true);
    displayElement("#addButton", true);
    displayElement("#deleteButton", indexOf(GLOBAL.historicData, GLOBAL.dummy, 0));

    var id = GLOBAL.historic;
    var row = contents.length;
    var col = contents[0].length;
    var tableHTML = getTableTitle(id, false, GLOBAL.showAllButtonToolTip, col-1);
    for (var i = 0; i < row; ++i) {
      tableHTML += i==0 ? '<thead>' : '';
      tableHTML += '<tr>';
      for (var j = 0; j < col; ++j) {
        var value = j < contents[i].length && contents[i][j]
          ? j != 5 || i == 0
            ? contents[i][j]
            : toCurrency(contents[i][j], 4)
          : "";
        tableHTML += j != 7   // Don't display the ID at row 7
          ? getTableReadOnlyContent(value, i == 0)
          : '';
      }
      tableHTML += '</tr>';
      tableHTML += i==0 ? '</thead><tbody>'
      : i==contents.length-1 ? '</tbody><tfoot>' : '';
    }
    tableHTML += '<tr id="' + id + 'Footer"></tr></tfoot>'

    applyFilter(id, tableHTML);

    $(".validateButton").prop('disabled', false);
  }

  function updateEvolutionTable(contents) {
    GLOBAL.evolutionData = contents;

    var id = GLOBAL.evolution;
    var row = contents.length;
    var col = contents[0].length;
    var tableHTML = getTableTitle(id, false, GLOBAL.showAllButtonToolTip, col-1);
    for (var i = 0; i < row; ++i) {
      tableHTML += i==0 ? '<thead>' : '';
      tableHTML += '<tr>';
      for (var j = 0; j < col; ++j) {
        tableHTML += getTableReadOnlyContent(contents[i][j], i == 0);
      }
      tableHTML += '</tr>';
      tableHTML += i==0 ? '</thead><tbody>'
      : i==contents.length-1 ? '</tbody><tfoot>' : '';
    }
    tableHTML += '<tr id="' + id + 'Footer"></tr></tfoot>'

    applyFilter(id, tableHTML);
  }

  function applyFilter(id, tableHTML) {
    setTable(id, tableHTML);
    sorttable.makeSortable($("#" + id + "Table").get(0));
    filterTable(id);
  }

  function getTableEditableCell(contents, index, rangeName, limit) {
    return getTableReadOnlyContent(contents[index-1][0], false) +
           getTableEditableContent(contents[index-1][1], rangeName, limit);
  }

  function getTableReadOnlyCell(contents, index) {
    return getTableReadOnlyContent(contents[index-1][0], false) +
           getTableReadOnlyContent(contents[index-1][1], false);
  }

  function getTableReadOnlyContent(content, isHeader, isDisabled) {
    var content = content ? content : "";
    var matches = /\(([^)]+)\)/.exec(content);
    var value = matches ? matches[matches.length-1] : content;
    var isCur = /(€|%|\$)/.test(value);
    var number = toValue(value);
    var isDisabled = isDisabled || (!isNaN(number) && number == 0);
    var color = isDisabled ? "wheat"
                : isCur ? number > 0 ? "green" : "red"
                : "black";
    return isHeader ? '<th align="center">' + content + '</th>'
                    : '<td align="center" style="color:' + color + '">' + content + '</td>';
  }

  function getTableEditableContent(content, rangeName, limit) {
    return '<td align="center"><input class="auto" min="-' + limit + '" max="' + limit + '"'
         + ' oninput="autoAdaptWidth(this);setValue(\'' + rangeName + '\', [[this.value]])"'
         + ' style="border:0px;width:100px;min-width:15px;font-style:italic;" type="number" value="'
         + toValue(content) + '">€</input></td>';
  }

  function getSubTableTitle(title, rangeName) {
    return '<tr><td colspan="10"><input class="tableTitle" type="text"'
         + ' oninput=";setValue(\'' + rangeName + '\', [[this.value]])"'
         + ' style="border:0px;min-width:55px;min-width:200px;font-size:16px;line-height:33px;color:#b1b1b1;margin:6px;"'
         + ' value="' + title + '"></input></td></tr>';
  }

  function getTitle(id, disabled) {
    return '<h2'
          + (!disabled ? ' onclick="var shouldDisplay = !$(\'#' + id + 'Table\').is(\':visible\');'
          + 'if(shouldDisplay){' + id + 'ValuesUpdate();};'
          + 'for (suffix of [\'Table\', \'Switch\', \'Search\']) {'
          + '$(\'.main\' + suffix).each((i, item) => toggleItem(\'' + id + '\' + suffix, item, shouldDisplay)); }"' : '')
          + '>' + id.charAt(0).toUpperCase() + id.slice(1) + '</h2>';
  }

  function getTableTitle(id, disabled, tooltip, colspan) {
    return '<table><tr style="background-color:white"><td><table style="border:0px;padding:0px;width:auto">'
         + '<tr style="background-color:white;"><td>' + getTitle(id, disabled) + '</td>'
         + (tooltip ? '<td id="' + id + 'Switch" class="mainSwitch '
         + ($("#" + id + "Switch").is(":visible") ? '' : 'hidden') + '">'
         + '<div class="tooltip"><label class="switch" style="border:30px;margin:7px 0px 0px 0px;">'
         + '<input id="' + id + 'Filter" type="checkbox" ' + ($('#' + id + 'Filter').is(':checked') ? 'checked' : '') + ' onclick="filterTable(\'' + id + '\')">'
         + '<div class="slider round"></div></label><span class="tooltiptext">' + tooltip + '</span></div></td></tr></table>'
         + '<td colspan="' + colspan + '" align="right">'
         + '<input id="' + id + 'Search" type="text" placeholder="Search" class="mainSearch '
         + ($("#" + id + "Search").is(":visible") ? '' : 'hidden') + '" '
         + 'onkeyup="filterTable(\'' + id + '\');" onchange="filterTable(\'' + id + '\');"'
         + 'value="' + ($('#' + id + 'Search').val() || "") + '">' : '')
         + '</tr></table>' + getMainTableHead(id);
  }

  function getMainTableHead(id) {
    return '<table id="' + id + 'Table" class="sortable mainTable '
         + ($("#" + id + "Table").is(":visible") ? '' : 'hidden') + '">';
  }

  function setTable(id, tableHTML) {
    tableHTML += '</table>';
    $("#" + id + "Div").prop("innerHTML", tableHTML);
  }

  function toggleItem(id, item, shouldDisplay) {
    var isCurrentId = item.id == id;
    var shouldDisplay = shouldDisplay && isCurrentId;
    displayElement(item, shouldDisplay, isCurrentId ? 1000 : 0)
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

      e.style.borderColor = "transparent";
      e.style.width = Math.ceil(Math.max(String(e.value).length, 1) * step + index) + "px";
    } else {
      e.style.borderColor = !e.placeholder || e.value != ""
              ? "red"
              : "transparent";
    }
  }

  function selectName(e, index) {
    if (index !== undefined) {
      $('#transactionName').prop("selectedIndex", index);
    } else {
      index = e.selectedIndex;
    }

    displayElement("#transactionQuantityLabel", e.options[index].title);
  }

  function getValue(formula, func, id) {
    if (!id || (id && $("#loading").text() == "")) {
      if (!id || !GLOBAL.hasAlreadyUpdated[id]) {
        displayLoading(id, true);

        google.script.run
                     .withSuccessHandler(contents => {
                       if (func) {
                         func(contents);
                         GLOBAL.hasLoadingQueue = false;
                         displayLoading(id, false);
                       } })
                     .withFailureHandler(displayError)
                     .getSheetValues(formula);
      }
    } else {
      GLOBAL.hasLoadingQueue = true;
      setTimeout(() => getValue(formula, func, id), 100);
    }
  }

  function setValue(name, value, func) {
    google.script.run
                 .withSuccessHandler(contents => { if (func) { func(); } })
                 .withFailureHandler(displayError)
                 .setSheetValues(name, value);
  }

  function filterTable(id) {
    var isChecked = $("#" + id + "Filter").is(':checked');
    var search = $('#' + id + 'Search').val() ? $('#' + id + 'Search').val().toUpperCase() : "";
    var index = id == GLOBAL.historic ? 2 : 0;
    var searchFunc = item => $(item).children("td")[index] && $(item).children("td")[index].innerHTML.toUpperCase().includes(search);
    var filterFunc = id == GLOBAL.investment ? (i, item) => (!isChecked || shouldRebalance($(item).children("td")[6] ? $(item).children("td")[6].innerHTML : null)) && searchFunc(item)
                   : id == GLOBAL.historic || id == GLOBAL.evolution ? (i, item) => (isChecked || i < GLOBAL.dataPreloadRowLimit) && searchFunc(item)
                   : (i, item) => true;
    var displayFunc = (i, item) => { var fn = filterFunc(i, item) ? a => $(a).show() : a => $(a).hide(); fn(item); };

    $("#" + id + "Table tbody tr").each(displayFunc);

    refreshTotal(id);
  }

  function refreshTotal(id) {
    if (id == GLOBAL.historic) {
      var calculateFunc = (i, item) => {
        item = $(item).children("td");
        for (var j = 0; j < item.length; ++j) {
          a[j] += j == 0 ? 1
                : j == 1 ? item[5].innerHTML ? 1 : 0
                : j == 2 ? item[7].innerHTML ? 1 : 0
                : j == 3 ? item[8].innerHTML ? 1 : 0
                : toValue(item[j].innerHTML);
        }
      };
      var footerFunc = () =>
        '<td colspan="3" align="center">' + a[0] + ' rows</td>'
         + '<td>' + a[4].toFixed(0) + '</td>'
         + '<td>' + toCurrency(a[5]/a[1]) + '</td>'
         + '<td title="' + toCurrency(a[6]/a[0]) + '">' + toCurrency(a[6]) + '</td>'
         + '<td title="' + toCurrency(a[7]/a[2]) + '">' + toCurrency(a[7]) + '</td>'
         + '<td title="' + toCurrency(a[8]/a[3]) + '">' + toCurrency(a[8]) + '</td>';
    } else if (id == GLOBAL.evolution) {
      var calculateFunc = (i, item) => {
        item = $(item).children("td");
        for (var j = 0; j < item.length; ++j) {
          a[j] += j == 0 ? 1 : toValue(item[j].innerHTML);
        }
      };
      var footerFunc = () => {
        var footer = "";
        for (var i = 1; i < a.length; i++) {
          footer += '<td>' + toCurrency(a[i]/a[0], 2, i < 5 ? '%' :'€') + '</td>';
        }
        return footer;
      }
    }

    if (calculateFunc) {
      var item;
      var a = new Array(9).fill(0);

      var max = !$('#' + id + 'Filter').is(':checked')
        ? GLOBAL.dataPreloadRowLimit : $("#" + id + "Table tbody tr").length;
      var elem = $("#" + id + "Table tbody tr:visible").length == 0
               ? $("#" + id + "Table tbody tr:lt(" + max + ")")
               : $("#" + id + "Table tbody tr:visible");
      elem.each(calculateFunc);
      $("#" + id + "Footer").prop("innerHTML", '<td>TOTAL</td>' + footerFunc());
    }
  }

  function showSnackBar() {
    if ($("#snackbar").text()) {
      $("#snackbar").addClass("show");

      // After 3 seconds, remove the show class from DIV
      setTimeout(() => { $("#snackbar").removeClass("show"); $("#snackbar").text(""); }, 3000);
    }
  }

  function displayLoading(id, isDisplayed) {
    if (id) {
      $("#loading").text(isDisplayed ? "Loading " + id + " ..." : "");
      if (isDisplayed || GLOBAL.hasLoadingQueue) {
        GLOBAL.hasAlreadyUpdated[id] = true;
        displayElement("#updateButton", false);
      } else {
        setTimeout(() => GLOBAL.hasAlreadyUpdated[id] = false,GLOBAL.timeBetweenReload*1000);
        setTimeout(() => displayElement("#updateButton", !GLOBAL.hasLoadingQueue), 300);
      }
    }
  }

  function displayElement(id, isDisplayed, duration = "slow", complete) {
    var fn = isDisplayed
      ? () => $(id).fadeIn(duration, complete)
      : () => $(id).fadeOut(duration, complete);
    fn();
  }

  function overDisplay(idToHide, idToShow, complete) {
    displayElement(idToHide, false, () => displayElement(idToShow, true, complete));
  }

  // function showLoader(isRefreshing) {
  //   displayElement('#loaderOverlay', true);
  //   $('.contentOverlay').fadeTo(1000, isRefreshing ? 0.3 : 0);
  // }
  //
  // function hideLoader() {
  //   displayElement('#loaderOverlay', false);
  //   $('.contentOverlay').fadeTo(1000, 1);
  // }

  function executionSuccess() {
    updateAllValues();
    cancelForm();
    showSnackBar();
  }

  function displayError(msg, isWarning) {
    // hideLoader();

    $("#alert").css("background-color", isWarning ? "#ff9800" : "#f44336");
    $("#alert").prop("innerHTML", '<span class="closebtn" onclick="displayElement(\'#alertOverlay\', false, () => $(\'#transactionName\').focus());">&times;</span>'
                                + '<strong>' + (isWarning ? "WARNING" : "ALERT") + ':</strong> ' + msg);
    displayElement('#alertOverlay', true);
  }

  function shouldRebalance(value) {
    return value && value.substring(0, 4) != "HOLD";
  }

  function toValue(content) {
    return content ? parseFloat(String(content).replace(",", "")
                                               .replace(" ", "")
                                               .replace("$", "")
                                               .replace("€", "")
                                               .replace("%", ""))
                   : 0;
  }

  function toCurrency(content, precision = 2, symbol = '€') {
    var val = toValue(content);
    var str = (val != 0
      ? String(content).includes(".") && !String(content).includes(",")
        ? String(val)
        : String(content).includes(",")
          ? String(toValue(String(content).replace(".", "").replace(",", ".")))
          : String(val) + "."
      : "0.") + "00";

    var neg = str.substring(0,1) == '-' ? -1 : 0;
    var i = str.indexOf(".");
    str = i != -1 ? str.slice(0, i+precision+1).replace(/0+$/g, '') : str + ".";
    var j = str.length-str.indexOf(".")-1;
    str = (j < 2 ? str + '0'.repeat(2-j) : str) + " " + symbol;

    return i + neg > 9 ? str.slice(0, i-9) + "," + str.slice(i-9, i-6) + "," + str.slice(i-6, i-3) + "," + str.slice(i-3)
         : i + neg > 6 ? str.slice(0, i-6) + "," + str.slice(i-6, i-3) + "," + str.slice(i-3)
         : i + neg > 3 ? str.slice(0, i-3) + "," + str.slice(i-3)
         : str;
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
