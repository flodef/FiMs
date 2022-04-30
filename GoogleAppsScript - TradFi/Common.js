/* global SpreadsheetApp, GmailApp, UrlFetchApp */
/* exported _getSheet,_copyFormula, _copyFirstRow, _isMarketOpen, _round,
_isCurrentMonth, _toDate, _indexOf, _isLoading, _isError, _archiveMessage,
_sendMessage, _deleteOlderThanAYear, _AreRowsDifferent, _isSubHour, _toPercent,
_toCurrency, IMPORTURL, SHEETNAME, FM, LM */

// MAIN SPREADSHEET
const SS = SpreadsheetApp.getActiveSpreadsheet();

// VARIOUS
const MAIL = 'fdefroco@gmail.com';
const URGMAIL = 'flodef@pm.me';
const LOADING = 'Loading...';
const FR = 2;     // First Row
const FC = 1;     // First Column
const FH = 9;     // First working Hour
const LH = 17;    // Last working hour
const FD = 1;     // First working day
const LD = 5;     // Last working day
const FM = 0;     // First month (january)
const LM = 11;    // Last month (december)


function _getSheet(sheetName) {
  return SS.getSheetByName(sheetName);
}

function _setRangeValues(sheet, row, column, data) {
  if (data) {
    sheet.getRange(row, column, data.length, data[0].length).setValues(data);
  }
}

function _copyFormula(formula, range) {
  formula.copyTo(range, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
}

function _insertFirstRow(sheet, data, isFast, lc) {
  const lr = sheet.getMaxRows();
  lc = lc ? lc : sheet.getMaxColumns();

  if (lr >= FR) {
    if (!isFast) {  // Insert a row at the end, then copy all the data with an offset
      sheet.insertRowAfter(lr);
      sheet.getRange(FR, FC, lr-1, lc).copyTo(sheet.getRange(FR + 1, FC));
    } else {        // Insert a row at the begin, then copy the second row to the first row
      sheet.insertRowBefore(FR);
      sheet.getRange(FR+1, FC, 1, lc).copyTo(sheet.getRange(FR, FC));
    }
  } else {
    sheet.insertRowAfter(lr);
    sheet.getRange(lr+1, FC, 1, lc).clearFormat();
  }

  _setRangeValues(sheet, FR, FC, data);
}

function _copyFirstRow(sheet, array) {
  if (!_isCurrentDay(array)) {
    _insertFirstRow(sheet, null, true);
    _setRangeValues(sheet, FR + 1, FC, [array[0]]);    // Copy only values into previous row (archive)
  }
}

function _AreRowsDifferent(array) {
  let isDiff = false;

  if (array.length == 2) {
    // Check for difference
    const lc = array[0].length-1;
    let i = 0;    // Skip first column which is the date
    while (!isDiff && ++i <= lc) {
      isDiff = array[0][i] != array[1][i] ? true : isDiff;
    }
  } else {
    throw('Array should have 2 rows but have ' + array.length + ' instead.');
  }

  return isDiff;
}

function _deleteOlderThanAYear(sheet) {
  let lr = sheet.getMaxRows();
  const lyd = _toDate();
  lyd.setFullYear(lyd.getFullYear()-1);
  lyd.setMonth(lyd.getMonth()-1);
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

function _isMarketOpen() {
  const x = new Date();
  const d = x.getDay();
  const h = x.getHours();

  return d >= FD && d <= LD && h >= FH && h <= LH;
}



function _isSubHour(period = 1, offset = 0) {
  const x = new Date();
  const m = x.getMinutes();

  return m%period == offset;
}

function _toFixed(value, precision = 2) {
  let str = value.toString();
  str += (str.indexOf('.') != -1 ? '' : '.') + Array(precision+1).join('0');
  return str.slice(0, str.indexOf('.') + precision + Math.min(precision, 1));
}

function _round(value, precision, symbol) {
  const mult = Math.pow(10, precision);
  const sup = symbol == '%' ? 100 : 1;
  symbol = typeof(symbol) === 'string' ? symbol : '';

  return _toFixed(Math.round(value * sup * mult) / mult, precision) + symbol;
}

function _isCurrentDay(array) {
  return array && array.length > 0 ? _toStringDate() == _toStringDate(array[0][0]) : false;
}

function _isCurrentMonth(array) {
  return array && array.length > 0 ? new Date().getMonth() == array[0][0].getMonth() : false;
}

function _toDate(date) {
  date = typeof(date) == 'object' ? date : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function _toStringDate(date) {
  if (typeof(date) == 'string') {
    return date && date.split('/').length == 3
      ? date.replace(/(^|\/)0+/g, '$1').split('/')[1] + '/'
    + date.replace(/(^|\/)0+/g, '$1').split('/')[0] + '/'
    + date.split('/')[2]
      : null;
  } else if (typeof(date) == 'object') {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return month + '/' + day + '/' + year;
  } else {
    return _toStringDate(new Date());
  }
}

function _toPercent(value, precision = 0) {
  return _round(value*100, precision, ' %');
}

function _toCurrency(value, precision = 2) {
  return _round(value, precision, ' €');
}

function _indexOf(array, value, index, start) {
  index = index >= 0 ? index : null;
  let x = parseInt(start) ? parseInt(start) : 0;

  let i = null;
  if (Array.isArray(array)) {
    while(x < array.length
          && ((index == null && array[x] != value)
      || (index != null && array[x][index] != value))) { ++x; }

    i = x < array.length ? x : null;
  }

  return i;
}

function _isLoading(value) {
  return typeof(value) === 'string' && (value == LOADING || value == '');
}

function _isError(value) {
  return typeof(value) === 'string' && value.substring(0, 1) === '#';
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
  GmailApp.sendEmail(MAIL + (isUrgent ? ',' + URGMAIL : ''), object, message);
}


function IMPORTURL(url, str, isMulti) {
  //const url = "https://www.investing.com/etfs/ishares-usd-treasury-bond-20yr-de?cid=956312";
  //const str = "//span[@id='last_last']";        //input
  //const str = '<span.*id="last_last".*>(.*)<';  //output
  //const url = "https://www.zonebourse.com/cours/etf/ISHARES-TREASURY-BOND-2-24002505/";
  //const str = "//td[@id='zbjsfv_dr']";          //input
  //const str = '<td.*id="zbjsfv_dr".*>\n*(.*)';  //output
  //const isMulti = true;
  let content = '';
  const format = str
    .replaceAll('\'','"')
    .replaceAll('//','<')
    .replaceAll('[@','.*')
    .replaceAll(']',(isMulti ? '.*>\\n*(.*)' : '.*>(.*)<'));
  const regex = new RegExp(format);
  const response = UrlFetchApp.fetch(url);
  if (response) {
    const html = response.getContentText();
    if (html) {
      content = regex.exec(html)[1].trim();
    }
  }
  return content;
}

function SHEETNAME() {
  return SpreadsheetApp.getActiveSheet().getName();
}
