/* global SpreadsheetApp, GmailApp, UrlFetchApp */
/* exported _getSheet,_copyFormula, _copyFirstRow, _isMarketOpen, _round,
_isCurrentDay, _isCurrentMonth, _toDate, _indexOf, _isLoading, _isError, 
_archiveMessage, _sendMessage, _deleteOlderThanAYear, _AreRowsDifferent, 
_isSubHour, _toPercent, _toCurrency, _toStringTime, _copySheetFromModel,
_updateFormula, _isCurrentHour, TO_PURE_DATE, TO_TIMESTAMP, IMPORTURL, 
SHEETNAME, FM, LM */

// MAIN SPREADSHEET
const SS = SpreadsheetApp.getActiveSpreadsheet();

// VARIOUS
const MAIL = "fdefroco@gmail.com";
const URGMAIL = "flodef@pm.me";
const LOADING = "Loading...";
const FR = 2; // First Row
const FC = 1; // First Column
const FH = 9; // First working Hour
const LH = 17; // Last working hour
const FD = 1; // First working day
const LD = 5; // Last working day
const FM = 0; // First month (january)
const LM = 11; // Last month (december)

function _getSheet(sheetName, sheet) {
  return sheet ? sheet : SS.getSheetByName(sheetName);
}

function _copySheetFromModel(newSheetName, modelSheetName) {
  let sheet = _getSheet(newSheetName);
  if (!sheet) {
    const modelSheet = _getSheet(modelSheetName);
    sheet = modelSheet.copyTo(SS);
    const index = sheet.getIndex();

    modelSheet.hideSheet();
    sheet.setName(newSheetName);
    SS.setActiveSheet(sheet);
    SS.moveActiveSheet(index - 1);
    sheet.showSheet();
    sheet.setFrozenRows(1);
    sheet.protect().setWarningOnly(true);
  }

  return sheet;
}

function _setRangeValues(sheet, row, column, data) {
  if (data && data.length > 0 && data[0].length > 0) {
    sheet.getRange(row, column, data.length, data[0].length).setValues(data);
  }
}

function _copyFormula(formula, range) {
  formula.copyTo(range, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
}

// Modify the cell to update the formula and load data
function _updateFormula(sheet, row, col) {
  const range = sheet.getRange(row, col);
  range.setValue(range.getValue() == "" ? " " : "");
}

function _insertFirstRow(sheet, data, isFast, lc) {
  const lr = sheet.getMaxRows();
  lc = lc ? lc : sheet.getMaxColumns();

  if (lr >= FR) {
    if (!isFast) {
      // Insert a row at the end, then copy all the data with an offset
      sheet.insertRowAfter(lr);
      sheet.getRange(FR, FC, lr - 1, lc).copyTo(sheet.getRange(FR + 1, FC));
    } else {
      // Insert a row at the begin, then copy the second row to the first row
      sheet.insertRowBefore(FR);
      sheet.getRange(FR + 1, FC, 1, lc).copyTo(sheet.getRange(FR, FC));
    }
  } else {
    sheet.insertRowAfter(lr);
    sheet.getRange(lr + 1, FC, 1, lc).clearFormat();
  }

  _setRangeValues(sheet, FR, FC, data);
}

function _copyFirstRow(sheet, array) {
  if (!_isToday(array)) {
    _insertFirstRow(sheet, null, true);
    _setRangeValues(sheet, FR + 1, FC, [array[0]]); // Copy only values into previous row (archive)
  }
}

function _AreRowsDifferent(array) {
  let isDiff = false;

  if (array.length == 2) {
    // Check for difference
    const lc = array[0].length - 1;
    let i = 0; // Skip first column which is the date
    while (!isDiff && ++i <= lc) {
      isDiff = array[0][i] != array[1][i] ? true : isDiff;
    }
  } else {
    throw "Array should have 2 rows but have " + array.length + " instead.";
  }

  return isDiff;
}

function _deleteOlderThanAYear(sheet) {
  let lr = sheet.getMaxRows();
  const lyd = _toDate();
  lyd.setFullYear(lyd.getFullYear() - 1);
  lyd.setMonth(lyd.getMonth() - 1);
  let shouldDelete;
  do {
    const oldDate = sheet.getRange(lr, FC).getValue();
    shouldDelete = oldDate < lyd;
    if (shouldDelete) {
      sheet.deleteRow(lr);
      --lr;
    }
  } while (shouldDelete);
}

function _isMarketOpen(firstDay = FD, lastDay = LD, firstHour = FH, lastHour = LH) {
  const x = new Date();
  const d = x.getDay();
  const h = x.getHours();

  return d >= firstDay && d <= lastDay && h >= firstHour && h <= lastHour;
}

function _isSubHour(period = 1, offset = 0) {
  const x = new Date();
  const m = x.getMinutes();

  return period == 1 || m % period == offset;
}

function _toFixed(value, precision = 2) {
  let str = value.toString();
  str += (str.indexOf(".") != -1 ? "" : ".") + Array(precision + 1).join("0");
  return str.slice(0, str.indexOf(".") + precision + Math.min(precision, 1));
}

function _round(value, precision, symbol) {
  const mult = Math.pow(10, precision);
  const sup = symbol == "%" ? 100 : 1;
  symbol = typeof symbol == "string" ? symbol : "";

  return _toFixed(Math.round(value * sup * mult) / mult, precision) + symbol;
}

function _isToday(array, i = 0, j = 0) {
  return array && array.length > 0 ? _toStringDate() == _toStringDate(array[i][j]) : false;
}

function _isCurrentHour(array, i = 0, j = 0) {
  return array && array.length > 0 ? new Date().getHours() == array[i][j].getHours() : false;
}

function _isCurrentDay(array, i = 0, j = 0) {
  return array && array.length > 0 ? new Date().getDate() == array[i][j].getDate() : false;
}

function _isCurrentMonth(array, i = 0, j = 0) {
  return array && array.length > 0 ? new Date().getMonth() == array[i][j].getMonth() : false;
}

//
/**
 * Take a date and remove the hours part
 * @param {Date} date to transform or null for current date
 * @return {Date} date without hours
 */
function _toDate(date) {
  date = date && typeof date == "object" ? date : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function _toStringDate(date, locale = "FR") {
  if (date && typeof date == "string") {
    return date.split("/").length == 3
      ? locale == "FR"
        ? date.replace(/(^|\/)0+/g, "$1").split("/")[0] +
          "/" +
          date.replace(/(^|\/)0+/g, "$1").split("/")[1] +
          "/" +
          date.split("/")[2]
        : date.replace(/(^|\/)0+/g, "$1").split("/")[1] +
          "/" +
          date.replace(/(^|\/)0+/g, "$1").split("/")[0] +
          "/" +
          date.split("/")[2]
      : null;
  } else if (date && typeof date == "object") {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return locale == "FR" ? day + "/" + month + "/" + year : month + "/" + day + "/" + year;
  } else {
    return _toStringDate(new Date(), locale);
  }
}

function _toStringTime(date, locale = "FR") {
  if (typeof date == "string") {
    return _toStringDate(date, locale);
  } else if (typeof date == "object") {
    const day = ("0" + date.getDate()).slice(-2);
    const month = ("0" + (date.getMonth() + 1)).slice(-2);
    const year = date.getFullYear();
    const hours = ("0" + date.getHours()).slice(-2);
    const min = ("0" + date.getMinutes()).slice(-2);
    const sec = ("0" + date.getSeconds()).slice(-2);

    return locale == "FR"
      ? day + "/" + month + "/" + year + " " + hours + ":" + min + ":" + sec
      : month + "/" + day + "/" + year + " " + hours + ":" + min + ":" + sec;
  } else {
    return _toStringTime(new Date(), locale);
  }
}

function _toPercent(value, precision = 0) {
  return _round(value * 100, precision, " %");
}

function _toCurrency(value, precision = 2, locale = "FR") {
  return (locale == "FR" ? "" : "$") + _round(value, precision, locale == "FR" ? " €" : "");
}

function _indexOf(array, value, index, start) {
  index = index >= 0 ? index : null;
  let x = parseInt(start) ? parseInt(start) : 0;

  let i = null;
  if (Array.isArray(array)) {
    while (x < array.length && ((index == null && array[x] != value) || (index != null && array[x][index] != value))) {
      ++x;
    }

    i = x < array.length ? x : null;
  }

  return i;
}

function _isLoading(value) {
  return typeof value == "string" && (value == LOADING || value == "");
}

function _isError(value) {
  return typeof value == "string" && value.substring(0, 1) == "#";
}

function _archiveMessage(thread, shouldDelete) {
  if (thread) {
    thread = thread.markRead();
    if (shouldDelete) {
      thread.moveToTrash();
    } else {
      thread.moveToArchive();
    }
  }
}

function _sendMessage(object, message, isUrgent) {
  GmailApp.sendEmail(MAIL + (isUrgent ? "," + URGMAIL : ""), object, message);
}

/**
 * Imports a URL content and parse it to return a specific value
 * @param {string} url          The URL to import
 * @param {string} xpath_query  The XPath query to run on the structured data.
 * @param {bool} isMulti        Indicates whether the parsed content has multiple lines
 * @customfunction
 *
 * @return The value parsed from the URL content
 **/
function IMPORTURL(url, xpath_query, isMulti) {
  //url = "https://www.investing.com/etfs/ishares-usd-treasury-bond-20yr-de?cid=956312";
  //xpath_query = "//span[@id='last_last']";        //input
  //xpath_query = '<span.*id="last_last".*>(.*)<';  //output
  //url = "https://www.zonebourse.com/cours/etf/ISHARES-TREASURY-BOND-2-24002505/";
  //xpath_query = "//td[@id='zbjsfv_dr']";          //input
  //xpath_query = '<td.*id="zbjsfv_dr".*>\n*(.*)';  //output
  //isMulti = true;
  let content = "";
  const format = xpath_query
    .replaceAll("'", "\"")
    .replaceAll("//", "<")
    .replaceAll("[@", ".*")
    .replaceAll("]", isMulti ? ".*>\\n*(.*)" : ".*>(.*)<");
  const regex = new RegExp(format);
  const response = UrlFetchApp.fetch(url);
  if (response) {
    const html = response.getContentText();
    if (html) {
      const exec = regex.exec(html);
      content = exec ? exec[1].trim() : "#ERROR: regex pattern not found.";
    } else {
      content = "#ERROR: html content is empty.";
    }
  }
  return content;
}

/**
 * Converts a unix timestamp to date
 * @param {number} timestamp The unix timestamp to convert
 * @param {number} hourShift The hours shift from UTC.
 * @customfunction
 *
 * @return The date corresponding to the unix timestamp with shifted hours from UTC
 **/
function TO_PURE_DATE(timestamp, hourShift = 0) {
  return new Date((parseFloat(timestamp) + parseFloat(hourShift) * 3600) * 1000);
}

/**
 * Converts a date to unix timestamp
 * @param {date} date        The date to convert
 * @param {number} hourShift The hours shift from UTC.
 * @customfunction
 *
 * @return The unix timestamp corresponding to the date with shifted hours from UTC
 **/
function TO_TIMESTAMP(date, hourShift = 0) {
  return Math.floor(new Date(date).getTime() / 1000 - parseFloat(hourShift) * 3600);
}

/**
 * Gets the current sheet name
 * @customfunction
 *
 * @return The current sheet name
 **/
function SHEETNAME() {
  return SpreadsheetApp.getActiveSheet().getName();
}
