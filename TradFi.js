/* global GLOBAL, $, google, restrainFormula, updateAllValues, getMenuButton, 
displayElement, getValue, overDisplay, toStringDate, displayError, setValue, 
executionSuccess, updateValues, indexOf, showLoader, toValue, toCurrency, 
getTableTitle, getSubTableTitle, getTableReadOnlyCell, getTableValidatableCell,
processTable, getTableReadOnlyContent, openTab, shouldRebalance, getColor,
getTableEditableContent, selectName, finishLoading, initCommon */
/* exported init, onKeyUp */

GLOBAL.cost = "COST";
GLOBAL.approv = "APPROVISIONNEMENT";
GLOBAL.dummy = "XXXXXX";
GLOBAL.dataPreloadRowLimit = 10;
GLOBAL.timeBetweenReload = 60;
GLOBAL.histoIdCol = 7;
GLOBAL.rebalCol = 16;
GLOBAL.tendencyCol = 21;
GLOBAL.settings = "settings";
GLOBAL.account = "account";
GLOBAL.resultFormula = "Result!A:H";
GLOBAL.accountFormula = "Account!A:L,Account!X:AK";
GLOBAL.expHistoFormula = "ExpensesHistoric!A:C";
GLOBAL.allocationFormula = "Allocation!B14";
GLOBAL.settingsFormula = "Settings!A:F";
GLOBAL.displayData = {
  "dashboard": {
    id: "dashboard",
    formula: "Dashboard!A:B",
    updateTable: updateDashboardTable
  },
  "investment": {
    id: "investment",
    formula: "Investment!A:AW",
    updateTable: updateInvestmentTable
  },
  "historic": {
    id: "historic",
    formula: restrainFormula("Historic!A:J", 0, 300),
    updateTable: updateHistoricTable
  },
  "evolution": {
    id: "evolution",
    formula: restrainFormula("Evolution!A:L", 0, 300),
    updateTable: updateStandardTable
  },
  "price": {
    id: "price",
    formula: restrainFormula("Price!A:G", 0, 500),
    updateTable: updateStandardTable
  },
  "allocation": {
    id: "allocation",
    formula: restrainFormula("AllocationHistoric!A:Q", 0, 12),
    updateTable: updateStandardTable
  }
};
GLOBAL.menuButton = [
  // {id:"rebalance", fn:rebalanceStocks},
  {
    id: "refresh",
    fn: updateAllValues
  },
  {
    id: "remove",
    fn: deleteTransaction
  },
  {
    id: "add",
    fn: addTransaction
  },
  {
    id: "upload",
    fn: uploadAccountFile
  },
];

GLOBAL.rebalanceButtonToolTip = "Rebalance";
GLOBAL.showAllButtonToolTip = "Show all";
GLOBAL.requestedAllocation = "Requested allocation";

/**
 * Run initializations on web app load.
 */
$(() => {
  initCommon();  

  $(document).keyup(onKeyUp); // The event listener for the key press (action buttons)    
});

function init() {
  let tableHTML = "<table id=\"addTransactionForm\" class=\"topMenu hidden\"><tr>" +
    "<td>Name:     <select id=\"transactionName\" onchange=\"selectName(this)\"></select></td>" +
    "<td style=\"width:150px;\" id=\"transactionQuantityLabel\">Quantity: <input id=\"transactionQuantity\" class=\"auto\" oninput=\"autoAdaptWidth(this)\"" +
    " min=\"-20000\" max=\"20000\" type=\"text\" data-type=\"number\" value=\"0\"></td>" +
    "<td style=\"width:150px;\" id=\"transactionValueLabel\">   Value:    <input id=\"transactionValue\"    class=\"auto\" oninput=\"autoAdaptWidth(this)\"" +
    " min=\"-100000\" max=\"100000\" type=\"text\" data-type=\"euro\" value=\"0\"> €</td>" +
    getMenuButton({
      id: "validateAdd",
      img: "validate",
      fn: validateAddForm
    }) +
    getMenuButton({
      id: "cancelAdd",
      img: "cancel",
      fn: cancelForm
    }) +
    "</tr></table>" +
    "<table id=\"deleteTransactionForm\" class=\"topMenu hidden\"><tr>" +
    "<td style=\"padding: 0px 10px 0px 10px; width:260px;\"><strong style=\"font-size:larger\">Are you sure you want to delete ?</strong></td>" +
    getMenuButton({
      id: "validateDelete",
      img: "validate",
      fn: validateDeleteForm
    }) +
    getMenuButton({
      id: "cancelDelete",
      img: "cancel",
      fn: cancelForm
    }) +
    "</tr></table>" +
    "<table id=\"uploadFileForm\" class=\"topMenu hidden\"><tr>" +
    "<td><strong>Upload Account CSV File:</strong></td>" +
    "<td><input id=\"fileUpload\" type=\"file\" accept=\".csv\" style=\"width:250px\" /></td>" +
    getMenuButton({
      id: "validateUpload",
      img: "validate",
      fn: validateUploadForm
    }) +
    getMenuButton({
      id: "cancelDelete",
      img: "cancel",
      fn: cancelForm
    }) +
    "</tr></table>";

  $("#menuDiv").html($("#menuDiv").html() + tableHTML);
  displayElement(".actionButton", false, 0);
  displayElement("[id^=validate]", true, 0);
  displayElement("[id^=cancel]", true, 0);

  getValue({
    id: GLOBAL.settings,
    formula: GLOBAL.settingsFormula
  }, null, true, updateAllValues);
}

function onKeyUp(e) {
  if (!$("#addTransactionForm").is(":animated") &&
    !$("#deleteTransactionForm").is(":animated") &&
    !$("#uploadFileForm").is(":animated") &&
    !$("#actionButton").is(":animated") &&
    !$("#loaderOverlay").is(":visible")) {
    if ($("#alertOverlay").is(":visible")) {
      displayElement("#alertOverlay", false);
    } else if (!$("#actionButton").is(":visible")) {
      if (e.keyCode === 13) { // Enter
        if ($("#addTransactionForm").is(":visible")) {
          validateAddForm();
        } else if ($("#deleteTransactionForm").is(":visible")) {
          validateDeleteForm();
        } else if ($("#uploadFileForm").is(":visible")) {
          validateUploadForm();
        }
      } else if (e.keyCode === 27) { // Esc
        cancelForm();
      }
    } else {
      if (!$("input[type=\"number\"]").is(":focus") && !$("input[type=\"text\"]").is(":focus")) {
        if (e.keyCode === 186) { // $
          rebalanceStocks();
        } else if (e.keyCode === 107 || e.keyCode === 187) { // +
          addTransaction();
        } else if (e.keyCode === 109 || e.keyCode === 189) { // -
          deleteTransaction();
        } else if (e.keyCode === 85) { // U
          uploadAccountFile();
        } else if (e.keyCode === 82) { // R
          updateAllValues();
        }
      }
    }
  }
}

function updateDashboardTable(id, contents) {
  var settings = GLOBAL.data[GLOBAL.settings];
  var tableHTML = getTableTitle(id);

  var isFirstLoading = $("#" + id + "Button").is(":hidden");

  // Set the dashboard table
  var allocation = contents[indexOf(contents, GLOBAL.requestedAllocation, 0)][1]; // Requested allocation
  var ln = settings.length / 2; // Take the full sheet row count, don't count the miror with numbers (/2)
  for (var i = 0; i < ln - 2; i++) { // Remove the two last row for scroll (-2)
    tableHTML += getSubTableTitle(GLOBAL.settings, settings[i][0], "Settings!A" + (i + 1));
    tableHTML += "<tr>";
    for (var j = 1; j < settings[i].length; j++) {
      tableHTML += i != 4 || j != 3 ?
        getTableReadOnlyCell(contents, settings[i + ln][j]) :
        getTableValidatableCell(id, contents, settings[i + ln][j], GLOBAL.allocationFormula, allocation);
    }
    tableHTML += "</tr>";
  }

  processTable(id, tableHTML);

  // Set the scrolling panel
  tableHTML = "<marquee direction=\"down\" scrollamount=\"1\" behavior=\"scroll\"><table>";
  tableHTML += "<tr>" + getTableReadOnlyCell(contents, contents.length - 1) + "</tr>"; // Dirty way to display the "Time since last update"
  for (let i = 0; i < settings[ln - 2].length; ++i) {
    tableHTML += "<tr>";
    tableHTML += getTableReadOnlyContent(settings[ln - 2][i], false);
    tableHTML += getTableReadOnlyContent(contents[settings[ln * 2 - 1][i] - 1][1], false);
    tableHTML += "</tr>";
  }

  tableHTML += "</table></marquee>";
  $("#scrollDiv").html(tableHTML);

  if (isFirstLoading) {
    finishLoading(id, isFirstLoading);
  }
}

function updateInvestmentTable(id, contents) {
  displayElement("#rebalanceButton", shouldRebalance(contents[contents.length - 1][GLOBAL.rebalCol]));

  clearTransactionName();

  var tags = [];

  var row = contents.length;
  var col = contents[0].length;
  var tableHTML = getTableTitle(id, false, GLOBAL.rebalanceButtonToolTip, col - 1);
  for (var i = 0; i < row; ++i) {
    var bgcolor = i == row - 1 ? null :
      contents[i][GLOBAL.tendencyCol].includes("BUY") ? "lightgreen" :
        contents[i][GLOBAL.tendencyCol].includes("SELL") ? "lightcoral" :
          null;
    var color = bgcolor ? "black" : null;
    tableHTML += i == 0 ? "<thead>" : "";
    tableHTML += i == 0 ? "<tr>" : "<tr title=\"" + contents[i][7] + "\"" +
      (bgcolor ? "style=\"background-color:" + bgcolor + ";color:" + color + ";font-weight:bold;\"" : "") + ">";
    //for (var j = 0; j < contents[i].length; ++j)
    for (var j of [0, 10, 12, 14, 15, 16, 17, 21, 30, 22, 28, 32, 34, 36, 44, 45, 46]) { // Select only the interesting columns (to check them, use the formula "=COLUMN()-1")
      // Type = 0, Shares = 10, Price = 12, Sell = 14, Estimation = 15, Rebalance = 16,
      // Provision = 17, Tendency = 21, Trans profit + Dist gap = 30,
      // Daily result + Rate = 22, Total + Rate = 28,
      // Avg price + Avg gap = 32, Avg lm price + Avg lm prog = 34,
      // Price rate = 36, Next div dur = 44, Est div = 45, Div / month = 46
      var con = i == 0 || j != 12 ?
        i == 0 || j <= 21 || j >= 36 ?  // Solo values (without percentage)
          contents[i][j] :
          (contents[i][j] ? toCurrency(contents[i][j], 3) : "") + " (" + contents[i][j + 1] + ")" :
        contents[i][12] ?
          toCurrency(contents[i][j], 4) : "";
      var isDisabled = (j == 16 || j == 17 || j == GLOBAL.tendencyCol) &&
        !shouldRebalance(contents[i][GLOBAL.tendencyCol]);
      tableHTML += j != 12 || i == 0 || i == row - 1
        ? getTableReadOnlyContent(con, i == 0, isDisabled, j == 30 ? getColor(contents[i][j]) : color)  // HACK: Don't display Trans profit
        : getTableEditableContent(con, {
          id: id,
          range: "Investment!M" + (i + 1),
          required: true,
          precision: 3,
          min: toValue(con) * 0.75,
          max: toValue(con) * 1.25,
          type: "euro"
        });
    }
    tableHTML += "</tr>";
    tableHTML += i == 0 ? "</thead><tbody>" : i == row - 2 ? "</tbody><tfoot>" : i == row - 1 ? "</tfoot>" : "";

    if (i != 0 && i != row - 1) {
      tags.push(contents[i][7]);
      addTransactionName(contents[i][0], contents[i][7]);
    }
  }

  addTransactionName("", GLOBAL.cost);
  addTransactionName("", GLOBAL.approv);

  processTable(id, tableHTML, true);

  // $("#" + id + "Search").easyAutocomplete({ data: tags, list: { match: { enabled: true } } });
  // $("#" + id + "Search").autocomplete({ source: tags });
}

function updateHistoricTable(id, contents) {
  $(".validateButton").prop("disabled", true);

  displayElement("#uploadButton", true);
  displayElement("#addButton", true);
  displayElement("#removeButton", indexOf(contents, GLOBAL.dummy, GLOBAL.histoIdCol));

  var row = contents.length;
  var col = contents[0].length;
  var tableHTML = getTableTitle(id, false, GLOBAL.showAllButtonToolTip, col - 1);
  for (var i = 0; i < row; ++i) {
    var isDummy = contents[i][GLOBAL.histoIdCol] == GLOBAL.dummy;
    tableHTML += i == 0 ? "<thead>" : "";
    tableHTML += !isDummy ?
      "<tr>" :
      "<tr style=\"background-color: red;\">"; // Row becomes red if it is a dummy
    for (var j = 0; j < col; ++j) {
      var value = j < contents[i].length && contents[i][j] ?
        j != 5 || i == 0 ?
          contents[i][j] :
          toCurrency(contents[i][j], 4) :
        "";
      tableHTML += j != GLOBAL.histoIdCol ? // Don't display the Historic ID
        getTableReadOnlyContent(value, i == 0, false, isDummy ? "black" : null) :
        "";
    }
    tableHTML += "</tr>";
    tableHTML += i == 0 ? "</thead><tbody>" : i == row - 2 ? "</tbody>" : "";
  }

  processTable(id, tableHTML, true);

  $(".validateButton").prop("disabled", false);
}

function updateStandardTable(id, contents) {
  const row = contents.length;
  const col = contents[0].length;
  var tableHTML = getTableTitle(id, false, GLOBAL.showAllButtonToolTip, col - 1);
  for (var i = 0; i < row; ++i) {
    tableHTML += i == 0 ? "<thead>" : "";
    tableHTML += "<tr>";
    for (var j = 0; j < col; ++j) {
      const c = contents[i][j];
      const t = /(€|%|\$|\/|[^.\d])/.test(c) ? c : toCurrency(c, 4); // Transform to currency numbers without currency symbol
      tableHTML += getTableReadOnlyContent(t, i == 0);
    }
    tableHTML += "</tr>";
    tableHTML += i == 0 ? "</thead><tbody>" : i == row - 1 ? "</tbody>" : "";
  }

  processTable(id, tableHTML, true);
}

function rebalanceStocks() {
  //   updateValues(GLOBAL.displayData.investment.id);
  //
  //   var investmentData = GLOBAL.data[GLOBAL.displayData.investment.id];
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
//   $("#popup").html(tableHTML);
//
//   $('.contentOverlay').addClass("blur-filter");
//   displayElement('#popupOverlay', true);
// }

function addTransaction() {
  overDisplay("#actionButton", "#addTransactionForm", () => $("#transactionName").focus());
}

function deleteTransaction() {
  overDisplay("#actionButton", "#deleteTransactionForm");
}

function uploadAccountFile() {
  overDisplay("#actionButton", "#uploadFileForm", () => $("#fileUpload").focus());
}

function validateAddForm() {
  var tDate = toStringDate(null, true); // Current date, reversed

  var tType = $("#transactionName").children(":selected").attr("title");

  var name = $("#transactionName").prop("value");
  var tName = tType ? name : "";

  var qty = parseInt($("#transactionQuantity").val(), 10);
  var tQty = tName && !isNaN(qty) && qty != 0 ? qty : "";

  var tOpe = !tType ? name :
    tQty < 0 ? "SELL" :
      tQty > 0 ? "BUY" :
        "DIVIDEND";

  var val = parseFloat($("#transactionValue").val());
  var tVal = !isNaN(val) && val != 0 ? val : "";

  var tUnit = tQty && tVal && tName ? -tVal / tQty : "";

  var errorMsg = tQty && isNaN(tQty) ? "Quantity should be an Integer." :
    tVal && isNaN(tVal) ? "Value should be a Number." :
      tName && !tQty && (!tVal || tVal <= 0) ? "Coupon value should be positive." :
        !tName && !tVal ? "Approvisionnement/Cost Value should be set." :
          tQty && !tVal ? "The Value should be set if the Quantity is set." :
            tUnit && tUnit < 0 ? "Quantity should have an opposite sign as Value." :
              "";

  if (!errorMsg) {
    insertHistoricRow([
      [tDate, tType, tName, tOpe, tQty, tUnit, tVal, GLOBAL.dummy]
    ], "Historic");
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
      id = GLOBAL.displayData.historic.id;
      gid = 9;
      endCol = 10;
    } else if (sid == "ExpensesHistoric") {
      id = GLOBAL.displayData.dashboard.id;
      gid = 298395308;
      endCol = 4;
    }

    if (id && gid && endCol) {
      google.script.run
        //.withSuccessHandler(contents => setValue(id + "!A2", data, sortTransactionValues))
        .withSuccessHandler(() => setValue(sid + "!A2", data,
          () => {
            executionSuccess();
            updateValues(id, true);
          }))
        .withFailureHandler(displayError)
        .insertRows(gid, data, {
          startRow: index,
          endCol: endCol
        });
    } else {
      displayError("Unknow spreadsheet: " + sid);
    }
  } else {
    displayError("No transaction added.", true);
  }
}

// function sortTransactionValues() {
//   google.script.run
//     .withSuccessHandler(contents => executionSuccess())
//     .withFailureHandler(displayError)
//     .sortColumn(9, 0, true);
// }

function validateDeleteForm(index, rowCnt, func = () => {}) {
  index = index ? index : indexOf(GLOBAL.data[GLOBAL.displayData.historic.id], GLOBAL.dummy, GLOBAL.histoIdCol);
  rowCnt = rowCnt ? rowCnt : 1;

  if (index !== null && index * rowCnt > 0) {
    $("#snackbar").text((rowCnt == 1 ? "Transaction" : rowCnt + " Transactions") + " deleted");

    // showLoader(true);

    google.script.run
      .withSuccessHandler(() => {
        func();
        executionSuccess();
        updateValues(GLOBAL.displayData.historic.id, true);
      })
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
        data = $.csv.toArrays(csvData.includes(";") ?
          csvData.replace(new RegExp(",", "g"), ".").replace(new RegExp(";", "g"), ",") :
          csvData);

        if (data && data.length > 1) {
          if (data[0][0] == "Date" && data[0][1] == "Heure") {
            const af = GLOBAL.accountFormula.split(",");
            google.script.run
              .withSuccessHandler(() => {
                google.script.run
                  .withSuccessHandler(() => {
                    openTab(GLOBAL.displayData.historic.id);

                    setValue("Account!A1", data);

                    const histoData = {
                      id: GLOBAL.displayData.historic.id,
                      formula: restrainFormula(GLOBAL.displayData.historic.formula, -1, -1)
                    };
                    const resultData = {
                      id: GLOBAL.account,
                      formula: GLOBAL.resultFormula
                    };
                    getValue(histoData, null, true, () => getValue(resultData, compareResultData, true, executionSuccess));
                  })
                  .withFailureHandler(displayError)
                  .clearSheetValues(af[0]);
              })
              .withFailureHandler(displayError)
              .clearSheetValues(af[1]);
          } else if (data[0][0] == "dateOp" && data[0][1] == "dateVal") {
            const data = {
              id: GLOBAL.account,
              formula: GLOBAL.expHistoFormula
            };
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
      } catch (err) {
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
    var historicData = GLOBAL.data[GLOBAL.displayData.historic.id];
    var data = [];
    for (let i = contents.length - 1; i > 0; --i) { // Don't insert the header and reverse loop
      var row = contents[i];
      var isEmpty = toValue(row[GLOBAL.histoIdCol - 1]) == 0;
      var start = 0;
      var isFound = false;

      if (!isEmpty) {
        do {
          const index = indexOf(historicData, row[GLOBAL.histoIdCol], GLOBAL.histoIdCol, start);
          if (index == null) {
            if (indexOf(row, "#", null, null, (a, b) => a.startsWith(b)) == null) { // Check for error in spreadsheet (starts with #)
              data.push(row);
            } else {
              ++errCnt;
            }
            isFound = true;
          } else if (row[0] == toStringDate(historicData[index][0], true)) {
            ++dupCnt;
            isFound = true;
          } else {
            start = index + 1;
          }
        } while (!isFound);
      } else {
        ++dupCnt;
      }
    }

    // Removing dummy data
    var prevIndex;
    var index = indexOf(historicData, GLOBAL.dummy, GLOBAL.histoIdCol);
    var dai = [];
    while (index !== null) {
      if (index - 1 == prevIndex) {
        dai[dai.length - 1][1] += 1;
      } else {
        dai.push([index, 1]);
      }
      prevIndex = index;

      index = indexOf(historicData, GLOBAL.dummy, GLOBAL.histoIdCol, index + 1);
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
      const fn = i => f(i);
      for (let i = dai.length - 1; i >= 0; --i) { // Reverse loop
        validateDeleteForm(dai[i][0], dai[i][1], fn(i));
      }
    }
  } else {
    getValue({
      formula: GLOBAL.resultFormula
    }, compareResultData, true);
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
      label = "VANGUARD S&P500";
    } else {
      isError = true;
    }

    var transaction = "DIVIDEND";
    var value = toCurrency(row[5]);
    var id = label + "@" + transaction + "@@" + row[5].replace(",", ".");

    if (!isError) {
      var historicData = GLOBAL.data[GLOBAL.displayData.historic.id];
      const index = indexOf(historicData, value, 6);

      if (!index || (index && (historicData[index][GLOBAL.histoIdCol] != GLOBAL.dummy ||
          historicData[index][GLOBAL.histoIdCol] != id))) {
        data.push([toStringDate(null, true), type, label, transaction, "", "", value, GLOBAL.dummy]);
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
      const msg = errCnt == 0 ?
        dupCnt + " duplicate(s) found, " + (total - dupCnt) + " row(s) added." :
        dupCnt + " duplicate(s) found, " + (total - dupCnt - errCnt) + " row(s) added and " + errCnt + " row(s) in error.";
      displayError(msg, errCnt == 0);
    }
  } else {
    const msg = errCnt == 0 ?
      "The imported file contains only duplicates (" + dupCnt + " found)." :
      dupCnt + " duplicate(s) found and " + errCnt + " row(s) in error.";
    displayError(msg, errCnt == 0);
  }
}

function cancelForm() {
  if ($("#addTransactionForm").is(":visible")) {
    overDisplay("#addTransactionForm", "#actionButton", () => {
      selectName($("#transactionName").get(0), 0);
      $("#transactionQuantity").val("");
      $("#transactionValue").val("");
    });
  } else if ($("#deleteTransactionForm").is(":visible")) {
    overDisplay("#deleteTransactionForm", "#actionButton");
  } else if ($("#uploadFileForm").is(":visible")) {
    overDisplay("#uploadFileForm", "#actionButton", () => $("#fileUpload").val(""));
  } else if ($("#popupOverlay").is(":visible")) {
    $(".rebalButton").prop("disabled", false);
  }

  $("#mainFocus").focus();
}

function addTransactionName(type, label) {
  $("#transactionName").append($("<option>", {
    title: type,
    text: label
  }));
}

function clearTransactionName() {
  $("#transactionName").children("option").remove();
}
