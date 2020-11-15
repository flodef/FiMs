  GLOBAL.cost = "COST";
  GLOBAL.approv = "APPROVISIONNEMENT";
  GLOBAL.dummy = "XXXXXX";
  GLOBAL.dataPreloadRowLimit = 10;
  GLOBAL.timeBetweenReload = 60;
  GLOBAL.histoIdCol = 7;
  GLOBAL.rebalCol = 18;
  GLOBAL.tendencyCol = 22;
  GLOBAL.settings = "settings";
  GLOBAL.account = "account";
  GLOBAL.resultFormula = "Result!A:H";
  GLOBAL.accountFormula = "Account!A:L";
  GLOBAL.expHistoFormula = "ExpensesHistoric!A:C";
  GLOBAL.allocationFormula = "Allocation!B14";
  GLOBAL.settingsFormula = "Settings!A:F";
  GLOBAL.displayData =
  { "dashboard": { id:"dashboard", formula:"Dashboard!A:B",updateTable:updateDashboardTable },
    "investment": { id:"investment", formula:"Investment!A:AT",updateTable:updateInvestmentTable },
    "historic": { id:"historic", formula:restrainFormula("Historic!A:J"),updateTable:updateHistoricTable },
    "evolution": { id:"evolution", formula:restrainFormula("Evolution!A:J"),updateTable:updateEvolutionTable } };
  GLOBAL.rebalanceButtonToolTip = "Rebalance";
  GLOBAL.showAllButtonToolTip = "Show all";
  GLOBAL.requestedAllocation = "Requested allocation";

  /**
   * Run initializations on web app load.
   */
  $(() => {
    init();

    getValue({ id:GLOBAL.settings, formula:GLOBAL.settingsFormula }, null, true, updateAllValues);
  });

  function rebalanceStocks() {
  //   updateValues(GLOBAL.investment);
  //
  //   var investmentData = GLOBAL.data[GLOBAL.investment];
  //   var tRow = investmentData.length - 1;
  //   var contents = [];
  //   var rank = 0;
  //   for (var i = 1; i < tRow; i++) { // Take only the value (no header, footer)
  //     var index = indexOf(investmentData, rank.toString(), 13);
  //
  //     var nr = rank;
  //     while (index === null) {
  //       index = indexOf(investmentData, (--nr).toString(), 13);
  //     }
  //
  //     ++rank;
  //     if(shouldRebalance(investmentData[index][18])) {
  //       var array = [];
  //       for (var j of [0, 10, 6, investmentData[index][7] != "" ? 7 : 8, 14, 15, 27]) {
  //         array[investmentData[0][j]] = investmentData[index][j];
  //       }
  //       array["Action"] = investmentData[index][j] > 0;
  //
  //       contents.push(array);
  //     }
  //   };
  //
  //   if (contents.length > 0) {
  //     updateRebalanceTable(contents);
  //   } else {
  //     displayError("No stock to rebalance", true);
  //   }
  }

  // function updateRebalanceTable(contents) {
  //   var closing = 'displayElement(\'#popupOverlay\', false, () => { $(\'.contentOverlay\').removeClass(\'blur-filter\');$(\'#mainFocus\').focus(); });';
  //
  //   var tableHTML = '<span class="closebtn" onclick="' + closing + '">&times;</span>';
  //   for (var i = 0; i < contents.length; i++) {
  //     tableHTML += '<div ' + (i != 0 ? 'class="hidden"' : '') + 'id="rebal' + i + '">';
  //     tableHTML += '<table>';
  //
  //     var row = Object.entries(contents[i]);
  //     for (const [key, value] of row) {
  //         tableHTML += '<tr>';
  //
  //         var style = key == "Name" || key == "Rebalance" || (key == "Tendency" && shouldRebalance(value))
  //                   ? 'font-weight:900;' : '';
  //         style += key == "Action"
  //                         ? 'background-color:' + (value ? "#a2c642" : "#da4a4a") + ';color:white;"'
  //                         : '';
  //         var val = key == "Action" ? (value ? "BUY" : "SELL") : value;
  //         tableHTML += '<th align="center">' + key + '</th>'
  //                    + '<td align="center" style="' + style + '" padding="10px">' + val + '</td>'
  //
  //         tableHTML += '</tr>';
  //     }
  //
  //     tableHTML += '</table>';
  //
  //     var isLast = i == contents.length-1;
  //     var skiping = 'overDisplay(\'#rebal' + i + '\', \'#rebal' + (i+1) + '\');';
  //     var next = isLast ? closing : skiping;
  //     var label = isLast ? "CLOSE" : "NEXT ORDER";
  //     tableHTML += '<div align="center" style="margin:15px 0px 0px 0px;">'
  //                + '<button style="margin:0px 5px 0px 5px;" onclick="' + next + '" class="rebalButton">' + label + '</button>'
  //                + '</div>';
  //
  //     tableHTML += '</div>';
  //   }
  //
  //   $("#popup").prop("innerHTML", tableHTML);
  //
  //   $('.contentOverlay').addClass("blur-filter");
  //   displayElement('#popupOverlay', true);
  // }

  function addTransaction() {
    overDisplay('#actionButton', '#addTransactionForm', () => $('#transactionName').focus());
  }

  function deleteTransaction() {
    overDisplay('#actionButton', '#deleteTransactionForm');
  }

  function uploadAccountFile() {
    overDisplay('#actionButton', '#uploadFileForm', () => $('#fileUpload').focus());
  }

  function validateAddForm() {
    var tDate = toStringDate();

    var tType = $("#transactionName").children(":selected").attr("title");

    var name = $("#transactionName").prop("value");
    var tName = tType ? name : "";

    var qty = parseInt($("#transactionQuantity").val(), 10);
    var tQty = tName && !isNaN(qty) && qty != 0 ? qty : "";

    var tOpe = !tType ? name
             : tQty < 0 ? "SELL"
             : tQty > 0 ? "BUY"
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
      insertHistoricRow([[tDate, tType, tName, tOpe, tQty, tUnit, tVal, GLOBAL.dummy]], "Historic");
    } else {
      displayError(errorMsg, true);
    }
  }

  function insertHistoricRow(data, sid) {
    var index = 1;
    var rowCnt = data.length;

    if (rowCnt > 0) {
      $("#snackbar").text((rowCnt == 1 ? "Transaction" : rowCnt + " Transactions") + " added");

      // showLoader(true);

      var id;
      var gid;
      var endCol;
      if (sid == "Historic") {
        id = GLOBAL.historic;
        gid = 9;
        endCol = 15;
      } else if (sid == "ExpensesHistoric") {
        id = GLOBAL.dashboard;
        gid = 298395308;
        endCol = 4;
      }

      if (id && gid && endCol) {
        google.script.run
                    //.withSuccessHandler(contents => setValue(id + "!A2", data, sortTransactionValues))
                     .withSuccessHandler(contents => setValue(sid + "!A2", data,
                        () => { executionSuccess(); updateValues(id, true); }))
                     .withFailureHandler(displayError)
                     .insertRows(gid, data, {startRow:index, endCol:endCol});
      } else {
        displayError("Unknow spreadsheet: " + sid);
      }
    } else {
      displayError("No transaction added.", true);
    }
  }

  function sortTransactionValues() {
    google.script.run
                 .withSuccessHandler(contents => executionSuccess())
                 .withFailureHandler(displayError)
                 .sortColumn(9, 0, true);
  }

  function validateDeleteForm(index, rowCnt, func = () => {}) {
    var index = index ? index : indexOf(GLOBAL.data[GLOBAL.historic], GLOBAL.dummy, GLOBAL.histoIdCol);
    var rowCnt = rowCnt ? rowCnt : 1;

    if (index !== null && index*rowCnt > 0) {
      $("#snackbar").text((rowCnt == 1 ? "Transaction" : rowCnt + " Transactions") + " deleted");

      // showLoader(true);

      google.script.run
                   .withSuccessHandler(contents => { func(); executionSuccess(); updateValues(GLOBAL.historic, true); })
                   .withFailureHandler(displayError)
                   .deleteRows(9, index, index + rowCnt);
    } else {
      displayError("No transaction deleted.", true);
    }
  }

  function validateUploadForm() {
    var data = null;
    var file = $("#fileUpload").prop("files")[0];
    if (file) {
      showLoader(true);

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

                      const histoData = { id:GLOBAL.displayData.historic.id, formula:restrainFormula(GLOBAL.displayData.historic.formula, -1, -1) };
                      const resultData = { id:GLOBAL.account, formula:GLOBAL.resultFormula };
                      getValue(histoData, null, true, () => getValue(resultData, compareResultData, true, executionSuccess));
                    })
                    .withFailureHandler(displayError)
                    .clearSheetValues(GLOBAL.accountFormula);
            } else if (data[0][0] == "dateOp" && data[0][1] == "dateVal") {
              const data = { id:GLOBAL.account, formula:GLOBAL.expHistoFormula };
              getValue(data, (id, contents) => insertExpensesRow(data, contents), true, executionSuccess);
            } else if (data[0][0] == "CA ID" && data[0][1] == "Produit") {
              insertDividendRow(data);
              executionSuccess();
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

  function compareResultData(id, contents) {
    if (contents.length > 1) {
      // Preparing data
      var dupCnt = 0;
      var errCnt = 0;
      var historicData = GLOBAL.data[GLOBAL.historic];
      var data = [];
      for (var i = contents.length - 1; i > 0; --i) {   // Don't insert the header and reverse loop
        var row = contents[i];
        var isEmpty = toValue(row[GLOBAL.histoIdCol-1]) == 0;
        var start = 0;
        var isFound = false;

        if (!isEmpty) {
          do {
            var index = indexOf(historicData, row[GLOBAL.histoIdCol], GLOBAL.histoIdCol, start);
            if (index == null) {
              if (indexOf(row, "#", null, null, (a, b) => a.startsWith(b)) == null) {  // Check for error in spreadsheet (starts with #)
                data.push(row);
              } else {
                ++errCnt;
              }
              isFound = true;
            } else if (row[0] == toStringDate(historicData[index][0])) {
              ++dupCnt;
              isFound = true;
            } else {
              start = index + 1;
            }
          } while(!isFound);
        } else {
          ++dupCnt;
        }
      }

      // Removing dummy data
      var prevIndex;
      var index = indexOf(historicData, GLOBAL.dummy, GLOBAL.histoIdCol);
      var dai = [];
      while (index !== null) {
        if (index-1 == prevIndex) {
          dai[dai.length-1][1] += 1;
        } else {
          dai.push([index, 1]);
        }
        prevIndex = index;

        index = indexOf(historicData, GLOBAL.dummy, GLOBAL.histoIdCol, index+1);
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
      getValue({ formula:GLOBAL.resultFormula }, compareResultData, true);
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
        var historicData = GLOBAL.data[GLOBAL.historic];
        var index = indexOf(historicData, value, 6);

        if (index === null || (index !== null &&
                              (historicData[index][GLOBAL.histoIdCol] != GLOBAL.dummy
                            || historicData[index][GLOBAL.histoIdCol] != id))) {
            data.push([toStringDate(), type, label, transaction, "", "", value, GLOBAL.dummy]);
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
     && !$('#actionButton').is(":animated")
     && !$('#loaderOverlay').is(':visible')) {
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

  function addTransactionName(type, label) {
    $('#transactionName').append($('<option>', {
      title: type,
      text: label
    }));
  }

  function clearTransactionName() {
    $('#transactionName').children('option').remove();
  }

  function updateDashboardTable(id, contents) {
    var settings = GLOBAL.data[GLOBAL.settings];
    var tableHTML = getTableTitle(id);

    var isFirstLoading = $("#" + id + "Button").prop('disabled');

    // Set the dashboard table
    var allocation = contents[indexOf(contents, GLOBAL.requestedAllocation, 0)][1];   // Requested allocation
    var ln = settings.length/2;      // Take the full sheet row count, don't count the miror with numbers (/2)
    for (var i = 0; i < ln-2; i++) { // Remove the two last row for scroll (-2)
      tableHTML += getSubTableTitle(GLOBAL.settings, settings[i][0], "Settings!A" + (i+1));
      tableHTML += '<tr>';
      for (var j = 1; j < settings[i].length; j++) {
        tableHTML += i != 4 || j != 3
        ? getTableReadOnlyCell(contents, settings[i+ln][j])
        : getTableValidatableCell(id, contents, settings[i+ln][j], GLOBAL.allocationFormula, allocation);
      }
      tableHTML += '</tr>';
    }

    processTable(id, tableHTML);

    // Set the scrolling panel
    tableHTML = '<marquee direction="down" scrollamount="1" behavior="scroll" style="width:250px;height:60px;margin:15px"><table>';
    tableHTML += '<tr>' + getTableReadOnlyCell(contents, contents.length-1) + '</tr>';  // Dirty way to display the "Time since last update"
    for (var i = 0; i < settings[ln-2].length; ++i) {
      tableHTML += '<tr>';
      tableHTML += getTableReadOnlyContent(settings[ln-2][i], false);
      tableHTML += getTableReadOnlyContent(contents[settings[ln*2-1][i]-1][1], false);
      tableHTML += '</tr>';
    }

    tableHTML += '</table></marquee>';
    $("#scrollDiv").prop("innerHTML", tableHTML);

    if (isFirstLoading) {
      displayElement("#loaderBar", false, 0); // Hide the loader bar
      openTab(id, true);                      // Activate first tab as open by default
    }
  }

  function updateInvestmentTable(id, contents) {
    displayElement("#rebalanceButton", shouldRebalance(contents[contents.length-1][GLOBAL.rebalCol]));

    clearTransactionName();

    var tags = [];

    var row = contents.length;
    var col = contents[0].length;
    var tableHTML = getTableTitle(id, false, GLOBAL.rebalanceButtonToolTip, col-1);
    for (var i = 0; i < row; ++i) {
      var bgcolor = i == row-1 ? null
                  : contents[i][GLOBAL.tendencyCol].includes("BUY") ? "lightgreen"
                  : contents[i][GLOBAL.tendencyCol].includes("SELL") ? "lightcoral"
                  : null;
      var color = bgcolor ? "black" : null;
      tableHTML += i==0 ? '<thead>' : '';
      tableHTML += i==0 ? '<tr>' : '<tr title="' + contents[i][0] + '"' +
        (bgcolor ? 'style="background-color:' + bgcolor + ';color:' + color + ';font-weight:bold;"' : '') + '>';
      //for (var j = 0; j < contents[i].length; ++j)
      for (var j of [7, 10, 12, 14, 18, 19, 22, 32, 23, 29, 34, 36, 45]) {   // Select only the interesting columns
        // Name = 7, Shares = 10, Price = 12, Sell = 14, Rebalance = 18, Provision = 19, Tendency = 22,
        // Daily result	Rate	Dividend	Rate	Stock	Rate	Total	Rate = 23 to 29, Trans profit = 32,
        // Dist gap = 33, Avg price = 34, Avg gap = 35, Avg lm price = 36, Avg lm progress = 37, Next div dur = 45
        var con =  i == 0 || j != 12
                    ? i == 0 || j < 23 || j > 37
                      ? contents[i][j]
                      : (contents[i][j] ? toCurrency(contents[i][j], 3) : "") + ' (' + contents[i][j+1] + ')'
                    : contents[i][12]
                      ? toCurrency(contents[i][j], 4) : "";
        var isDisabled = (j == 18 || j == 19 || j == GLOBAL.tendencyCol)
          && !shouldRebalance(contents[i][GLOBAL.tendencyCol]);
        tableHTML += j != 12 || i == 0 || i == row-1
          ? getTableReadOnlyContent(con, i == 0, isDisabled, j == 32 ? getColor(contents[i][j]) : color)
          : getTableEditableContent(id, con, "Investment!M" + (i+1), 3, 0, toValue(con)*1.25);
        // tableHTML += getTableReadOnlyContent(con, i == 0, isDisabled, j == 32 ? getColor(contents[i][j]) : color);
      }
      tableHTML += '</tr>';
      tableHTML += i == 0 ? '</thead><tbody>'
      : i == row-2 ? '</tbody><tfoot>'
      : i == row-1 ? '</tfoot>' : '';

      if (i != 0 && i != row-1) {
        tags.push(contents[i][7]);
        addTransactionName(contents[i][0], contents[i][7]);
      }
    }

    addTransactionName("", GLOBAL.cost);
    addTransactionName("", GLOBAL.approv);

    processTable(id, tableHTML, true);

//    $("#" + id + "Table th:first").addClass("sorttable_sorted");
    // sorttable.innerSortFunction.apply($("#" + id + "Table th:first")[0], []);

    // $("#" + id + "Search").easyAutocomplete({ data: tags, list: { match: { enabled: true } } });
    // $("#" + id + "Search").autocomplete({ source: tags });
  }

  function updateHistoricTable(id, contents) {
    $(".validateButton").prop('disabled', true);

    displayElement("#uploadButton", true);
    displayElement("#addButton", true);
    displayElement("#deleteButton", indexOf(contents, GLOBAL.dummy, GLOBAL.histoIdCol));

    var row = contents.length;
    var col = contents[0].length;
    var tableHTML = getTableTitle(id, false, GLOBAL.showAllButtonToolTip, col-1);
    for (var i = 0; i < row; ++i) {
      var isDummy = contents[i][GLOBAL.histoIdCol] == GLOBAL.dummy;
      tableHTML += i==0 ? '<thead>' : '';
      tableHTML += !isDummy
        ? '<tr>'
        : '<tr style="background-color: red;">'; // Row becomes red if it is a dummy
      for (var j = 0; j < col; ++j) {
        var value = j < contents[i].length && contents[i][j]
          ? j != 5 || i == 0
            ? contents[i][j]
            : toCurrency(contents[i][j], 4)
          : "";
        tableHTML += j != GLOBAL.histoIdCol   // Don't display the Historic ID
          ? getTableReadOnlyContent(value, i == 0, false, isDummy ? "black" : null)
          : '';
      }
      tableHTML += '</tr>';
      tableHTML += i==0 ? '</thead><tbody>'
      : i==contents.length-1 ? '</tbody><tfoot>' : '';
    }
    tableHTML += '<tr id="' + id + 'Footer"></tr></tfoot>'

    processTable(id, tableHTML, true);

    $(".validateButton").prop('disabled', false);
  }

  function updateEvolutionTable(id, contents) {
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

    processTable(id, tableHTML, true);
  }
