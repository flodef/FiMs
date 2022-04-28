/* global CacheService, GmailApp, FR, FC, FH, LH, FD, LD, LOADING,
_isMarketOpen, _getSheet, _copyFormula, _isLoading, _isError, _indexOf, _toDate
_archiveMessage, _sendMessage, _setRangeValues, _toStringDate, _round, _toFixed
_insertFirstRow, _copyFirstRow, _isCurrentMonth, _deleteOlderThanAYear,
_AreRowsDifferent */
/* exported dailyUpdate, nightlyUpdate, monthlyUpdate, updatePrice, cachePrice,
processMail, IMPORTURL */



// DASHBOARD ROWS
const MONPAY_ROW = 19;          // Should be the "Monthly payment" row
const ASSVAL_ROW = 33;          // Should be the "Associates" row
const PORVAL_ROW = 38;          // Should be the "Current portfolio value" row
const MONINT_ROW = 58;          // Should be the "Degiro interest" row

// INVESTMENT COLS
const TYPE_COL = 1;             // Should be the "Type" column
const ISIN_COL = 5;             // Should be the "Isin" column
const LABEL_COL = 7;            // Should be the "Label" column
const PRICE_COL = 9;            // Should be the " " column (formula in title)
const LASTUPD_COL = 39;         // Should be the "Last upd" column
const NEXTDIV_COL = 41;         // Should be the "Next div" column
const ESTDIV_COL = 43;          // Should be the "Est div" column

// ALLOCATION ROWS
const CURALL_ROW = 12;          // Should be the "Current allocation" row
const REQALL_ROW = 14;          // Should be the "Requested allocation" row

// SHEET NAMES
const DASHBOARD = 'Dashboard';   // The "Dashboard" sheet name
const INVESTMENT = 'Investment'; // The "Investment" sheet name
const EXPENSES = 'Expenses';     // The "Expenses" sheet name
const EXPHISTO = 'ExpensesHistoric'; // The "ExpensesHistoric" sheet name
const HISTORIC = 'Historic';     // The "Historic" sheet name
const ALLOCATION = 'Allocation'; // The "Allocation" sheet name
const ALLOCHIST = 'AllocationHistoric'; // The "AllocationHistoric" sheet name
const EVOLUTION = 'Evolution';   // The "Evolution" sheet name
const BANKACC = 'BankAccount';   // The "BankAccount" sheet name
const ALERT = 'Alert';           // The "Alert" sheet name
const PRICE = 'Price';           // The "Price" sheet name

// WEB LINKS
const SSLINK = 'https://docs.google.com/spreadsheets/d/1JJ7zW4GD7MzMBTatntdnojX5bZYcqI1kxMWIvc0_LTw/edit#gid=';
const DEGLINK = 'https://trader.degiro.nl/login/fr#/login';
const APPLINK = 'https://bit.ly/FiMsMain';

// VARIOUS
const DUMMY = 'XXXXXX';



function dailyUpdate() {
  // Update only during the week
  const x = new Date();
  const d = x.getDay();
  if (d >= FD && d <= LD) {
    _updateClosePrice();
    _sendEvolution();
  }
}

function nightlyUpdate() {
  // Update only during the week
  const x = new Date();
  const d = x.getDay();
  if (d >= FD && d <= LD) {      // dividend update should be processed on morning of the current day
    _updateDividend();
  }
  if (d >= FD+1 && d <= LD+1) {  // add one day as the script is executed on the next night
    _updateEvolution();
  }
}

function monthlyUpdate() {
  _updateAllocation();
  _updateExpense();
}

function updatePrice() {
  var cache = CacheService.getScriptCache();
  var values = cache.getAll(['mr', 'updateArray']);
  if ((_isMarketOpen()) && values['mr']) {
    cache.removeAll(['mr', 'updateArray']);
    var mr = Number(values['mr']);
    var updateArray = values['updateArray'] ? values['updateArray'].split(',') : [];

    var sheet = _getSheet(INVESTMENT);
    var formula = sheet.getRange(1, PRICE_COL);
    if (updateArray.length == 0 || updateArray.length >= mr) {
      _copyFormula(formula, sheet.getRange(FR, PRICE_COL, mr, 1));  // Update by copying the main formula into all cells
    } else {
      for (var i = 0; i < updateArray.length; ++i) {
        _copyFormula(formula, sheet.getRange(Number(updateArray[i])+FR, PRICE_COL));  // Update by copying the main formula into individual cells
      }
    }
  }
}

function cachePrice() {
  if (_isMarketOpen()) {
    var sheet = _getSheet(INVESTMENT);
    var lr = sheet.getMaxRows();
    var mr = lr-FR;
    var isUpdateFreezed = sheet.getRange(lr, PRICE_COL+1).getValue() != '';
    var range = sheet.getRange(FR, PRICE_COL, mr, 1);
    var val = range.getValues();
    var cache = CacheService.getScriptCache();
    var x = new Date();
    var isEmpty = true;
    var updateArray = [];

    var j = 0;
    for (var i = 0; i < mr; ++i) {
      var v = val[i][j];
      isEmpty = !v && isEmpty;
      if (v != LOADING) {
        updateArray.push(i);  // Add index of values to update into an array
      }

      if (!_isLoading(v)) {
        sheet.getRange(i+FR, PRICE_COL).clearContent();   // Clear costly formula to update
        if (v && !_isError(v) && !isUpdateFreezed) {
          sheet.getRange(i+FR, PRICE_COL+1).setValue(v);  // Cache the value
          sheet.getRange(i+FR, LASTUPD_COL).setValue(x);  // Set the last updated date
        }
      }
    }

    if ((isEmpty || updateArray.length > 0) && !isUpdateFreezed) {
      cache.putAll({ 'mr' : mr.toString(), 'updateArray' : updateArray.join() });
    }
  }
}

function processMail() {
  var x = new Date();
  var h = x.getHours();
  if (h >= FH && h <= LH) {
    var sheet = _getSheet(ALERT);
    var array = sheet.getSheetValues(FR, FC, -1, 5);

    var alertThread = [];
    var unread = GmailApp.getInboxUnreadCount();
    if (unread > 0) {
      var thread = GmailApp.search('is:unread label:inbox');  // Get first unread mails
      for (var i = 0 ; i < thread.length; i++) {
        if (thread[i].isUnread()) {
          var thr = thread[i];
          var sub = thr.getFirstMessageSubject();
          if (sub) {
            var id = _indexOf(array, sub, 3);
            var fn = id != null ? function x(thr, id) { if (!alertThread[id]) { alertThread[id] = thr; } else { _archiveMessage(thr); } }
              : sub == 'Rapport du solde de vos comptes' ? function x(thr) { _processAccountBalance(thr); }
                : sub == 'Alerte sur opération recherchée' ? function x(thr) { _processAccountTransaction(thr); }
                  : sub.substring(0, 21) == 'DEGIRO - Avis d’opéré' ? function x(thr) { _processStockTrade(thr); }
                    : null;

            if (fn) {
              fn(thr, id);
            }
          }
        }
      }
    }

    // Send mails
    var a = [];
    for (i = 0 ; i < array.length; i++) {
      var row = array[i];
      var value = row[0];
      var shouldDelete = false;
      var t = [row[1], row[2]];

      var time = row[2] ? (x.getTime() - row[2].getTime())/1000/60 : 60;
      if (value > 0) {
        if (time >= 60 || value != row[1]) {
          t = [value, x];
          shouldDelete = true;
          _sendMessage(row[3], row[4].replace('$X', value).replace('$DEGLINK', DEGLINK).replace('$APPLINK', APPLINK), true);
        }
      } else {
        t = [null, null];
        shouldDelete = true;
      }

      a.push(t);

      _archiveMessage(shouldDelete ? alertThread[i] : null, true);
    }

    _setRangeValues(sheet, FR, FC+1, a);
  }
}

function _processAccountBalance(thread) {
  var sheet = _getSheet(BANKACC);
  var range = sheet.getDataRange();
  var label = range.getNotes();
  var lc = label[0].length;

  var messages = thread.getMessages();
  for (var j = 0 ; j < messages.length; j++) {
    var cnt = messages[j].getPlainBody();
    var a = cnt.split('\n');
    for (var k = 0; k < a.length; k++) {
      var b = a[k].split(' ');
      if (b[3] == '-' && b[b.length-1] == 'EUR') {
        var val = b[b.length-2];
        var name = b[4];

        // Update bank account
        var index = _indexOf(label, name, 0);
        if (index != null) {
          sheet.getRange(index+1, lc).setValue(val);
        } else {
          throw('Bank name not found in BankAccount sheet : ' + name);
        }
      }
    }
  }

  _archiveMessage(thread, true);
}

function _processAccountTransaction(thread) {
  var sheet = _getSheet(EXPHISTO);
  var array = sheet.getSheetValues(FR, FC, -1, 3);

  var messages = thread.getMessages();
  for (var j = 0 ; j < messages.length; j++) {
    var cnt = messages[j].getPlainBody();
    var a = cnt.split('\n');
    for (var k = 0; k < a.length; k++) {
      var b = a[k].split(' ');

      if (b[3] == '-' && b[b.length-1] == 'EUR') {
        var val = b[b.length-2];
        var date = _toStringDate(b[4]);
        var label = b.slice(6, b.length-2).join(' ');
        var slab = b.slice(6, b.length-4).join(' ');

        var index = _indexOf(array, parseFloat(val), 2);

        // Check for duplicate
        var color;
        if (index != null && array[index][1].toString().indexOf(slab) != -1) {
          if (date != _toStringDate(array[index][0])) {
            // Compare date with one week difference
            var d1 = new Date(date);
            var d2 = array[index][0];
            d2.setDate(d2.getDate()+7);

            // Over one week, no problem otherwise signal it
            if (d1 > d2) {
              color = 'white';
            } else {
              color = 'red';

              var msg = 'Date: ' + _toStringDate(date)
              + '\nLabel: ' + label
              + '\nValue: ' + _round(val, 2, ' €')
              + '\n' + SSLINK + '298395308';
              _sendMessage('Expense duplicate', msg);
            }
          }
        } else {
          color = 'white';
        }

        if (color) {
          var data = [[date, label, val]];
          _insertFirstRow(sheet, data, true);
          sheet.getRange(FR, FC, 1, array[0].length).setBackground(color);
        }
      }
    }
  }

  _archiveMessage(thread, true);
}

function _processStockTrade(thread) {
  // Get ids from investment table
  var sheet = _getSheet(INVESTMENT);
  var array = sheet.getSheetValues(FR, FC, -1, Math.max(TYPE_COL, ISIN_COL, LABEL_COL));

  // Add historic from stock trade mail
  var pdl = 15;     // Length of data to process
  var hea = 6;      // Length of the header
  var foo = 28;     // Length of the footer
  var ta = 0;       // Number of transaction added

  var messages = thread.getMessages();
  for (var j = 0 ; j < messages.length; j++) {
    var message = messages[j];
    var date = _toDate(message.getDate());
    var cnt = message.getPlainBody();
    var a = cnt.split('\n');
    var tc = Math.round((a.length-hea-foo)/pdl);  // Number of transaction to process

    var k = hea+1;    // Skip first rows as it is mail crap
    while(k < a.length) {
      var b = a[k].split('*');
      if (b[0].split(' ')[0] == 'Date') {
        //TODO
        //isin = 179 / 400 / 621  " <strong>IE00B3XXRP09</strong> "
        //quantity = 239 / 460   " <strong>15</strong> "
        //Montant devise locale = 263 / 484  <strong>EUR 922,05</strong> "
        //amount = 275 / 496 " <strong>EUR 922,05</strong> "
        //cost = 323 / 544" <strong>EUR 0,00</strong> "  //Cout total
        var isin = a[k+1].split('*')[1];                                                                    // Code ISIN *JE00B1VS3770*
        var qty = a[k+6].split('*')[1];                                                                     // Quantité *190*
        var cur = a[k+8].split('*')[1].substr(0, 3);                                                        // Montant devise locale *USD 8 434,10*
        var amount = Number(a[k+9].split('*')[1].replace(new RegExp('[A-Z ]', 'g'),'').replace(',', '.'));  // Montant *EUR 8 434,10*
        var cost = Number(a[k+11].split('*')[1].replace(new RegExp('[A-Z ]', 'g'),'').replace(',', '.'));   // Frais *EUR -3,69*

        var row = _indexOf(array, isin, ISIN_COL-1);
        if (row >= 0) {
          var label = array[row][LABEL_COL-1];
          var type = array[row][TYPE_COL-1];

          if (cost != 0) {
            _insertHistoricRow(date, type, label, null, null, null, cost);
          }

          var trans = amount < 0 ? 'BUY' : 'SELL';
          var quantity = amount < 0 ? qty : -qty;
          var price = _round(Math.abs(amount / quantity), 4);
          var value = amount;
          var tag = cur == 'EUR' ? null : DUMMY;  // Add dummy if currency is not Euro, as the exchange rate fee is not known
          _insertHistoricRow(date, type, label, trans, quantity, price, value, tag);

          ++ta;
        } else {
          throw('ISIN not found in Investment sheet : ' + isin);
        }

        k += pdl;                      // Skip all the processed data
      } else {
        k += k <= pdl ? 1 : a.length;  // Go to the next line if data has not been processed, otherwise strait at the end of the array,
      }
    }

    if (ta != tc) {
      throw('All stock transaction has not been processed : ' + ta + ' transaction(s) added insead of ' + tc);
    }
  }

  _archiveMessage(thread);
}

function _updateClosePrice() {
  var sheet = _getSheet(INVESTMENT);
  var lr = sheet.getMaxRows();
  var mr = lr-FR;
  var formula = sheet.getRange(lr, PRICE_COL);
  var range = sheet.getRange(FR, PRICE_COL, mr, 1);

  sheet.getRange(lr, PRICE_COL+1).setValue('');   // Unfreeze update process in case it's still there

  _copyFormula(formula, range);

  for (var i = 0; i < mr; ++i) {
    var v;
    var r = sheet.getRange(i+FR, PRICE_COL);

    do  {
      v = r.getValue();
    } while (_isLoading(v));

    if (!_isError(v)) {
      sheet.getRange(i+FR, PRICE_COL+1).setValue(v);  // Cache the value
    }
  }

  range.clearContent();   // Clear costly formula to update
}

function _sendEvolution() {
  // Get values
  var sheet = _getSheet(PRICE);
  var array = sheet.getSheetValues(FR, FC, 2, -1);
  var msg = '';

  // Check for difference
  if (_AreRowsDifferent(array)) {
    // Daily Performance mail
    sheet = _getSheet(EVOLUTION);
    array = sheet.getSheetValues(1, FC, 2, -1);

    for (var i = 5; i < array[0].length; ++i) {
      const label = array[0][i];
      const value = array[1][i];
      const isRate = label.toLowerCase().includes('rate')
        || label.toLowerCase().includes('ratio');
      msg += label + ': '
        + (isRate ? _round(value*100, 0, ' %') : _round(value, 2, ' €')) + '\n';
    }
    msg += APPLINK;

    _sendMessage('Daily Stock report', msg);
  } else {
    msg = 'If today is bank holiday, delete the message, otherwise check spreadsheet.';
    _sendMessage('No update for Evolution/Price', msg);
  }
}

function _updateEvolution() {
  // Get values
  let sheet = _getSheet(PRICE);
  let array = sheet.getSheetValues(FR, FC, 2, -1);

  // Delete last price if older than one year
  _deleteOlderThanAYear(sheet);

  // Check for difference
  if (_AreRowsDifferent(array)) {
    // Update price
    _copyFirstRow(sheet, array);

    // Update evolution
    sheet = _getSheet(EVOLUTION);
    array = sheet.getSheetValues(FR, FC, 1, -1);
    _copyFirstRow(sheet, array);
  }
}

function _updateDividend() {
  // Get dividend from investment table
  let sheet = _getSheet(INVESTMENT);
  const array = sheet.getSheetValues(FR, FC, -1, Math.max(TYPE_COL, LABEL_COL, NEXTDIV_COL, ESTDIV_COL));
  const today = _toDate();
  // const x = [];

  for (var i = 0; i < array.length; ++i) {
    if (array[i][NEXTDIV_COL-1] && array[i][NEXTDIV_COL-1] <= today) {
      const div = _round(array[i][ESTDIV_COL-1], 2);
      if (div >= 0) {
        _insertHistoricRow(today, array[i][TYPE_COL-1], array[i][LABEL_COL-1],
          'DIVIDEND', '', '', div, div > 0 ? DUMMY : '');
      } else {
        _sendMessage('Negative Dividend',
          'There is a problem with a dividend. It should always be positive!');
      }
    }
  }
}

// function _updateValues() {
//'=TO_PERCENT(VALUE(SUBSTITUTE(SUBSTITUTE(query(importhtml("http://www.global-rates.com/interest-rates/eonia/eonia.aspx","table",19), "select Col2 limit 1 offset 0", 1),"%",""),",",".")/100))'
//var col = 2;
//var sheet = _getSheet(DASHBOARD);
//_copyValue(sheet, EONIA_ROW, col, 'http://www.global-rates.com/interest-rates/eonia/eonia.aspx', 19, 0);
// }

// function _copyValue(sheet, row, col, url, table, offset) {
//   var range = sheet.getRange(row, col);
//
//   range.setValue(value);
//   do  {
//     value = range.getValue();
//   } while (_isLoading(value));
//
//   if (!_isError(value)) {
//     range.setValue(value);  // Copy only the value
//   }
// }

function _updateAllocation() {
  // Search if entries have already been added
  var allocSheet = _getSheet(ALLOCHIST);
  var lr = Math.min(allocSheet.getMaxRows(), 3);
  var allocArray = allocSheet.getSheetValues(FR, FC, lr, -1);
  if (!_isCurrentMonth(allocArray)) {
    // Retrieve values from the dashboard
    var sheet = _getSheet(DASHBOARD);
    var lc = sheet.getMaxColumns();
    var array = sheet.getSheetValues(FR, lc, -1, 1);
    var portValue = array[PORVAL_ROW-FR][0];
    var assValue = array[ASSVAL_ROW-FR][0];
    var monint = array[MONINT_ROW-FR][0];
    var monpay = array[MONPAY_ROW-FR][0];

    // Set the new requested allocation as the current one
    sheet = _getSheet(ALLOCATION);
    lc = sheet.getMaxColumns();
    array = sheet.getSheetValues(FR, lc, -1, 1);
    var alloc = array[REQALL_ROW-FR][0];
    if (alloc) {
      sheet.getRange(CURALL_ROW, lc).setValue(alloc); // copy requested alloc into current alloc
      sheet.getRange(REQALL_ROW, lc).clearContent();  // erase requested alloc
    } else {
      alloc = array[CURALL_ROW-FR][0];                // get the alloc from current if not set
    }

    // Set the values into the allocation historic
    _setRangeValues(allocSheet, 3, FC, [allocArray[1]]);    // Copy only values into previous row (archive)

    var date = _toStringDate();
    var data = [[date, _toFixed(portValue+assValue), _toFixed(portValue), alloc]];
    _insertFirstRow(allocSheet, data);

    // Insert the monthly interest into the historic
    date = _toDate();              // Get date without hours
    date.setDate(date.getDate() - 1);  // Yesterday's date as interest are added for the last day of the previous month
    _insertHistoricRow(date, null, null, null, null, null, _toFixed(monint));

    // Insert the monthly approvisionnement into the historic
    if (monpay < 0) {
      date = _toDate();              // Get date without hours
      _insertHistoricRow(date, null, null, 'APPROVISIONNEMENT', null, null,
        _toFixed(monpay, 0), DUMMY);
    }
  }
}

function _updateExpense() {
  var sheet = _getSheet(EXPENSES);
  var array = sheet.getSheetValues(FR, FC, 2, -1);
  if (!_isCurrentMonth(array)) {
    // Add new month
    var data = [[_toDate()]];
    _insertFirstRow(sheet, data);

    // Archive previous month
    _setRangeValues(sheet, FR+2, FC, [array[1]]);    // Copy only values into previous row (archive)

    // Archive expenses historic
    sheet = _getSheet(EXPHISTO);
    var lc = sheet.getMaxColumns();
    array = sheet.getSheetValues(FR+1, lc, -1, 1);
    _setRangeValues(sheet, FR+1, lc, array);    // Copy only values into previous row (archive)
  }
}

function _insertHistoricRow(date, type, label, trans, quantity, price, value, tag) {
  var sheet = _getSheet(HISTORIC);

  date = date ? date : _toDate();
  type = type ? type : '';
  label = label ? label : '';
  trans = trans ? trans : 'COST';
  quantity = quantity ? quantity : '';
  price = price ? price : '';
  value = value ? value : 0;
  tag = tag ? tag : label + '@' + trans + '@' + quantity + '@' + value; //Vanguard S&P 500 UCITS ETF@COST@@-3.69

  var data = [[date, type, label, trans, quantity, price, value, tag]];
  _insertFirstRow(sheet, data, true);
}