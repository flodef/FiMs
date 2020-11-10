// MAIN SPREADSHEET
var SS = SpreadsheetApp.getActiveSpreadsheet();

// DASHBOARD ROWS
var MONPAY_ROW = 20;          // Should be the "Monthly payment" row
var PORVAL_ROW = 37;          // Should be the "Current portfolio value" row
var EONIA_ROW = 55;           // Should be the "EONIA" row
var INTRAT_ROW = 56;          // Should be the "Interest rate (EONIA+1.25%)" row
var MONINT_ROW = 57;          // Should be the "Monthly interest" row

// INVESTMENT COLS
var TYPE_COL = 1;             // Should be the "Type" column
var TITLE_COL = 5;            // Should be the "Title" column
var ISIN_COL = 6;             // Should be the "Isin" column
var LABEL_COL = 8;            // Should be the "Label" column
var PRICE_COL = 12;           // Should be the "Price" column
var LASTUPD_COL = 43;         // Should be the "Last upd" column
var NEXTDIV_COL = 45;         // Should be the "Next div" column
var ESTDIV_COL = 47;          // Should be the "Est div" column

// ALLOCATION ROWS
var CURALL_ROW = 12;          // Should be the "Current allocation" row
var AVAALL_ROW = 13;          // Should be the "Available allocation" row
var REQALL_ROW = 14;          // Should be the "Requested allocation" row

// SHEET NAMES
var DASHBOARD = "Dashboard";   // The "Dashboard" sheet name
var INVESTMENT = "Investment"; // The "Investment" sheet name
var EXPENSES = "Expenses";     // The "Expenses" sheet name
var EXPHISTO = "ExpensesHistoric"; // The "ExpensesHistoric" sheet name
var HISTORIC = "Historic";     // The "Historic" sheet name
var ALLOCATION = "Allocation"; // The "Allocation" sheet name
var ALLOCHIST = "AllocationHistoric"; // The "AllocationHistoric" sheet name
var EVOLUTION = "Evolution";   // The "Evolution" sheet name
var SELECTION = "Selection";   // The "Selection" sheet name
var ASSOCIATE = "Associate";      // The "Associate" sheet name
var BANKACC = "BankAccount";   // The "BankAccount" sheet name
var INTEREST = "Interest";     // The "Interest" sheet name
var ALERT = "Alert";           // The "Alert" sheet name
var PRICE = "Price";           // The "Price" sheet name
var ASSMODEL = "AssociateModel";  // The "AssociateModel" sheet name
var ASSHISTO = "AssociateHistoric";  // The "AssociateHistoric" sheet name

// WEB LINKS
var SSLINK = "https://docs.google.com/spreadsheets/d/1JJ7zW4GD7MzMBTatntdnojX5bZYcqI1kxMWIvc0_LTw/edit#gid=";
var DEGLINK = "https://trader.degiro.nl/login/fr#/login";
var APPLINK = "https://goo.gl/amjmSv";
var BLGLINK = "https://www.bloomberg.com/quote/";

// VARIOUS
var MAIL = "fdefroco@gmail.com";
var LOADING = "Loading...";
var DUMMY = "XXXXXX";
var OK = "OK";
var FR = 2;
var FC = 1;
var FH = 9;
var LH = 17;
var FD = 1;
var LD = 5;
var FM = 0;


function dailyUpdate() {
  // Update only during the week
  var x = new Date();
  var d = x.getDay();
  if (d >= FD && d <= LD) {
    this._updateClosePrice();
    this._sendEvolution();
  }
}

function nightlyUpdate() {
  // Update only during the week
  var x = new Date();
  var d = x.getDay();
  if (d >= FD && d <= LD) {      // dividend update should be processed on morning of the current day
      this._updateDividend();
  }
  if (d >= FD+1 && d <= LD+1) {  // add one day as the script is executed on the next night
    this._updateEvolution();
    this._updateInterest();
    this._updateValues();
  }
};

function monthlyUpdate() {
  this._updateAllocation();
  this._updateExpense();
  this._updateAssociate();
}

function yearlyUpdate() {
  var x = new Date();
  var m = x.getMonth();
  if (m = FM) {
    this._sendCharity();
  }
}

function updatePrice() {
  var cache = CacheService.getScriptCache();
  var values = cache.getAll(["mr", "updateArray"]);
  if ((this._isMarketOpen()) && values["mr"]) {
    cache.removeAll(["mr", "updateArray"]);
    var mr = Number(values["mr"]);
    var updateArray = values["updateArray"] ? values["updateArray"].split(",") : [];

    var sheet = this._getSheet(INVESTMENT);
    var formula = sheet.getRange(1, PRICE_COL);
    if (updateArray.length == 0 || updateArray.length >= mr) {
      this._copyFormula(formula, sheet.getRange(FR, PRICE_COL, mr, 1));  // Update by copying the main formula into all cells
    } else {
      for (var i = 0; i < updateArray.length; ++i) {
        this._copyFormula(formula, sheet.getRange(Number(updateArray[i])+FR, PRICE_COL));  // Update by copying the main formula into individual cells
      }
    }
  }
}

//=IMPORTXML("https://www.investing.com/etfs/"&$D2,"//title")
//=TRIM(INDEX(IMPORTXML("https://www.investing.com/etfs/"&$D2,"//span[@class='elp']"),4,1))
function cachePrice() {
  if (this._isMarketOpen()) {
    var sheet = this._getSheet(INVESTMENT);
    var lr = sheet.getMaxRows();
    var mr = lr-FR;
    var isUpdateFreezed = sheet.getRange(lr, PRICE_COL+1).getValue() != "";
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

      if (!this._isLoading(v)) {
        sheet.getRange(i+FR, PRICE_COL).clearContent();   // Clear costly formula to update
        if (v && !this._isError(v) && !isUpdateFreezed) {
          sheet.getRange(i+FR, PRICE_COL+1).setValue(v);  // Cache the value
          sheet.getRange(i+FR, LASTUPD_COL).setValue(x);  // Set the last updated date
        }
      }
    }

    if ((isEmpty || updateArray.length > 0) && !isUpdateFreezed) {
      cache.putAll({ "mr" : mr.toString(), "updateArray" : updateArray.join() });
    }
  }
}

function processMail() {
  var x = new Date();
  var h = x.getHours();
  if (h >= FH && h <= LH) {
    var sheet = this._getSheet(ALERT);
    var array = sheet.getSheetValues(FR, FC, -1, 5);

    var alertThread = [];
    var unread = GmailApp.getInboxUnreadCount();
    if (unread > 0) {
      var thread = GmailApp.getInboxThreads(0, unread);   // Get the first unread mails to speed up things
      for (var i = 0 ; i < thread.length; i++) {
        if (thread[i].isUnread()) {
          var thr = thread[i];
          var sub = thr.getFirstMessageSubject();
          if (sub) {
            var id = this._indexOf(array, sub, 3);
            var fn = id != null ? function x(thr, id) { if (!alertThread[id]) { alertThread[id] = thr; } else { this._archiveMessage(thr); } }
            : sub == "Rapport du solde de vos comptes" ? function x(thr) { this._processAccountBalance(thr); }
            : sub == "Alerte sur opération recherchée" ? function x(thr) { this._processAccountTransaction(thr); }
            : sub.substring(0, 21) == "DEGIRO - Avis d’opéré" ? function x(thr) { this._processStockTrade(thr); }
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
    for (var i = 0 ; i < array.length; i++) {
      var row = array[i];
      var value = row[0];
      var shouldDelete = false;
      var t = [row[1], row[2]];

      var time = row[2] ? (x.getTime() - row[2].getTime())/1000/60 : 60;
      if (value > 0) {
        if (time >= 60 || value != row[1]) {
          t = [value, x];
          shouldDelete = true;
          this._sendMessage(row[3], row[4].replace("$X", value).replace("$DEGLINK", DEGLINK).replace("$APPLINK", APPLINK));
        }
      } else {
        t = [null, null];
        shouldDelete = true;
      }

      a.push(t);

      this._archiveMessage(shouldDelete ? alertThread[i] : null, true);
    }

    this._setRangeValues(sheet, FR, FC+1, a);
  }
}

function _processAccountBalance(thread) {
  var sheet = this._getSheet(BANKACC);
  var range = sheet.getDataRange();
  var label = range.getNotes();
  var lr = label.length;
  var lc = label[0].length;

  var messages = thread.getMessages();
  for (var j = 0 ; j < messages.length; j++) {
    var cnt = messages[j].getPlainBody();
    var a = cnt.split("\n");
    for (var k = 0; k < a.length; k++) {
      var b = a[k].split(" ");
      if (b[3] == "-" && b[b.length-1] == "EUR") {
        var val = b[b.length-2];
        var name = b[4];

        // Update bank account
        var index = this._indexOf(label, name, 0);
        if (index != null) {
          sheet.getRange(index+1, lc).setValue(val);
        } else {
          throw("Bank name not found in BankAccount sheet : " + name);
        }
      }
    }
  }

  this._archiveMessage(thread, true);
}

function _processAccountTransaction(thread) {
  var sheet = this._getSheet(EXPHISTO);
  var array = sheet.getSheetValues(FR, FC, -1, 3);

  var messages = thread.getMessages();
  for (var j = 0 ; j < messages.length; j++) {
    var cnt = messages[j].getPlainBody();
    var a = cnt.split("\n");
    for (var k = 0; k < a.length; k++) {
      var b = a[k].split(" ");

      if (b[3] == "-" && b[b.length-1] == "EUR") {
        var val = b[b.length-2];
        var date = this._toStringDate(b[4]);
        var label = b.slice(6, b.length-2).join(" ");
        var slab = b.slice(6, b.length-4).join(" ");

        var index = this._indexOf(array, parseFloat(val), 2);

        // Check for duplicate
        var color;
        if (index != null && array[index][1].toString().indexOf(slab) != -1) {
          if (date != this._toStringDate(array[index][0])) {
            // Compare date with one week difference
            var d1 = new Date(date);
            var d2 = array[index][0];
            d2.setDate(d2.getDate()+7);

            // Over one week, no problem otherwise signal it
            if (d1 > d2) {
              color = "white";
            } else {
              color = "red";

              var msg = "Date: " + _toStringDate(date)
              + "\nLabel: " + label
              + "\nValue: " + this._round(val, 2, " €")
              + "\n" + SSLINK + "298395308";
              this._sendMessage("Expense duplicate", msg);
            }
          }
        } else {
          color = "white";
        }

        if (color) {
          var data = [[date, label, val]];
          this._insertFirstRow(sheet, data, true);
          sheet.getRange(FR, FC, 1, array[0].length).setBackground(color);
        }
      }
    }
  }

  this._archiveMessage(thread, true);
}

function _processStockTrade(thread) {
  // Get ids from investment table
  var sheet = this._getSheet(INVESTMENT);
  var array = sheet.getSheetValues(FR, FC, -1, Math.max(TYPE_COL, ISIN_COL, LABEL_COL));

  // Add historic from stock trade mail
  var sheet = this._getSheet(HISTORIC);
  var pdl = 15;     // Length of data to process
  var hea = 6;      // Length of the header
  var foo = 28;     // Length of the footer
  var ta = 0        // Number of transaction added

  var messages = thread.getMessages();
  for (var j = 0 ; j < messages.length; j++) {
    var message = messages[j];
    var date = _toDate(message.getDate());
    var cnt = message.getPlainBody();
    var a = cnt.split("\n");
    var tc = Math.round((a.length-hea-foo)/pdl);  // Number of transaction to process

    var k = hea+1;    // Skip first rows as it is mail crap
    while(k < a.length) {
      var b = a[k].split("*");
      if (b[0].split(" ")[0] == "Date") {
        var isin = a[k+1].split("*")[1];                                                                    // Code ISIN *JE00B1VS3770*
        var qty = a[k+6].split("*")[1];                                                                     // Quantité *190*
        var cur = a[k+8].split("*")[1].substr(0, 3);                                                        // Montant devise locale *USD 8 434,10*
        var amount = Number(a[k+9].split("*")[1].replace(new RegExp("[A-Z ]", 'g'),"").replace(",", "."));  // Montant *EUR 8 434,10*
        var cost = Number(a[k+11].split("*")[1].replace(new RegExp("[A-Z ]", 'g'),"").replace(",", "."));   // Frais *EUR -3,69*

        var row = this._indexOf(array, isin, ISIN_COL-1);
        if (row >= 0) {
          var label = array[row][LABEL_COL-1];
          var type = array[row][TYPE_COL-1];

          if (cost != 0) {
            this._insertHistoricRow(date, type, label, null, null, null, cost);  //(date, type, label, trans, quantity, price, value, tag)
          }

          var trans = amount < 0 ? "BUY" : "SELL";
          var quantity = amount < 0 ? qty : -qty;
          var price = this._round(Math.abs(amount / quantity), 4);
          var value = amount;
          var tag = cur == "EUR" ? null : DUMMY;  // Add dummy if currency is not Euro, as the exchange rate fee is not known
          this._insertHistoricRow(date, type, label, trans, quantity, price, value, tag);  //(date, type, label, trans, quantity, price, value, tag)

          ++ta;
        } else {
          throw("ISIN not found in Investment sheet : " + isin);
        }

        k += pdl;                      // Skip all the processed data
      } else {
        k += k <= pdl ? 1 : a.length;  // Go to the next line if data has not been processed, otherwise strait at the end of the array,
      }
    }

    if (ta != tc) {
      throw("All stock transaction has not been processed : " + ta + " transaction(s) added insead of " + tc);
    }
  }

  this._archiveMessage(thread);
}

function _updateClosePrice() {
  var sheet = this._getSheet(INVESTMENT);
  var lr = sheet.getMaxRows();
  var mr = lr-FR;
  var formula = sheet.getRange(lr, PRICE_COL);
  var range = sheet.getRange(FR, PRICE_COL, mr, 1);

  sheet.getRange(lr, PRICE_COL+1).setValue("");   // Unfreeze update process in case it's still there

  this._copyFormula(formula, range);

  var j = 0;
  for (var i = 0; i < mr; ++i) {
    var v;
    var r = sheet.getRange(i+FR, PRICE_COL);

    do  {
      v = r.getValue();
    } while (this._isLoading(v));

    if (!this._isError(v)) {
      sheet.getRange(i+FR, PRICE_COL+1).setValue(v);  // Cache the value
    }
  }

  range.clearContent();   // Clear costly formula to update
}

function _sendEvolution() {
  // Get values
  var sheet = this._getSheet(PRICE);
  var array = sheet.getSheetValues(FR, FC, 2, -1);

  // Check for difference
  if (this._checkPriceDiff(array)) {
    // Daily Performance mail
    var sheet = this._getSheet(EVOLUTION);
    var array = sheet.getSheetValues(1, FC, 2, -1);

    var msg = "";
    for (var i = 5; i < array[0].length; ++i) {
      msg += array[0][i] + ": " + this._round(array[1][i], 2, " €") + "\n";
    }
    msg += APPLINK;

    this._sendMessage("Daily Stock report", msg);
  } else {
    var msg = "If today is bank holiday, delete the message, otherwise check spreadsheet.";
    this._sendMessage("No update for Evolution/Price", msg);
  }
}

function _updateEvolution() {
  // Get values
  var sheet = this._getSheet(PRICE);
  var array = sheet.getSheetValues(FR, FC, 2, -1);

  // Delete last price if older than one year
  var lr = sheet.getMaxRows();
  var lyd = _toDate();
  lyd.setFullYear(lyd.getFullYear()-1);
  lyd.setMonth(lyd.getMonth()-1);
  do {
    var oldDate = sheet.getRange(lr, FC).getValue();
    var shouldDelete = oldDate < lyd;
    if (shouldDelete) {
      sheet.deleteRow(lr);
      --lr;
    }
  } while (shouldDelete);

  // Check for difference
  if (this._checkPriceDiff(array)) {
    // Update price
    this._copyFirstRow(sheet, array);

    // Update evolution
    var sheet = this._getSheet(EVOLUTION);
    var array = sheet.getSheetValues(FR, FC, 1, -1);
    this._copyFirstRow(sheet, array);
  }
}

function _updateInterest() {
  // Get dashboard mandatory data
  var sheet = this._getSheet(DASHBOARD);
  var lc = sheet.getMaxColumns();
  var rate = sheet.getRange(INTRAT_ROW, lc).getValue();

  // Get current date
  var sheet = this._getSheet(INTEREST);
  var array = sheet.getSheetValues(FR, FC, -1, 1);
  var d = this._toDate();      // Get date without hours to match range's date
  d.setDate(d.getDate() - 1);  // Yesterday's date as script is executed the next night

  // Retrieve current & last columns
  var i = -1;
  var col = 0;
  var end = 0;
  var v;
  while (v != "" && ++i < array.length) {
    v = array[i][0];
    var isEmpty = v == "";
    col = !isEmpty && v <= d ? i : col;
    end = !isEmpty ? i : end;
  }

  // Update interest data
  var fr = FR+col;
  var mr = FR+end-fr+1;
  var lr = array.length+FR-(mr+fr);
  sheet.getRange(fr, 4, mr).setValue(rate);
  if (lr) {
    sheet.getRange(mr+fr, 4, lr).setValue(null);
  }
}

function _updateDividend() {
  // Get dividend from investment table
  var sheet = this._getSheet(INVESTMENT);
  var array = sheet.getSheetValues(FR, FC, -1, Math.max(TYPE_COL, LABEL_COL, NEXTDIV_COL, ESTDIV_COL));
  var today = this._toDate();
  var x = [];

  for (var i = 0; i < array.length; ++i) {
    if (array[i][NEXTDIV_COL-1] && array[i][NEXTDIV_COL-1] <= today) {
      x.push([today, array[i][TYPE_COL-1], array[i][LABEL_COL-1], "DIVIDEND", "", "", this._round(array[i][ESTDIV_COL-1], 2), DUMMY]);
    }
  }

  // Insert the monthly interest into the historic
  if (x.length > 0) {
    var sheet = this._getSheet(HISTORIC);
    for (var i = 0; i < x.length; ++i) {
      var data = [x[i]];
      this._insertFirstRow(sheet, data, true);
    }
  }
}

function _updateValues() {
  //'=TO_PERCENT(VALUE(SUBSTITUTE(SUBSTITUTE(query(importhtml("http://www.global-rates.com/interest-rates/eonia/eonia.aspx","table",19), "select Col2 limit 1 offset 0", 1),"%",""),",",".")/100))'
  //'=TO_PERCENT(VALUE(SUBSTITUTE(SUBSTITUTE(query(importhtml("https://www.cbanque.com/placement/taux_livreta.php","table",1), "select Col2 limit 1 offset 1", 1),"%",""),",",".")/100))';
  var col = 2;
  var sheet = this._getSheet(DASHBOARD);
  this._copyValue(sheet, EONIA_ROW, col, "http://www.global-rates.com/interest-rates/eonia/eonia.aspx", 19, 0);
}

function _copyValue(sheet, row, col, url, table, offset) {
  var value = '=TO_PERCENT(VALUE(SUBSTITUTE(SUBSTITUTE(QUERY(IMPORTHTML("' + url + '","table",' + table + '), "select Col2 limit 1 offset ' + offset + '", 1),"%",""),",",".")/100))';
  var range = sheet.getRange(row, col);

  range.setValue(value);
  do  {
    value = range.getValue();
  } while (this._isLoading(value));

  if (!this._isError(value)) {
    range.setValue(value);  // Copy only the value
  }
}

function _updateAllocation() {
  // Search if entries have already been added
  var allocSheet = this._getSheet(ALLOCHIST);
  var lr = Math.min(allocSheet.getMaxRows(), 3);
  var allocArray = allocSheet.getSheetValues(FR, FC, lr, -1);
  if (!_isCurrentMonth(allocArray)) {
    // Retrieve values from the dashboard
    var sheet = this._getSheet(DASHBOARD);
    var lc = sheet.getMaxColumns();
    var array = sheet.getSheetValues(FR, lc, -1, 1);
    var portValue = this._toFixed(array[PORVAL_ROW-FR][0], 2);
    var monint = this._toFixed(array[MONINT_ROW-FR][0], 2);
    var monpay = this._toFixed(array[MONPAY_ROW-FR][0], 0);

    // Set the new requested allocation as the current one
    var sheet = this._getSheet(ALLOCATION);
    var lc = sheet.getMaxColumns();
    var array = sheet.getSheetValues(FR, lc, -1, 1);
    var alloc = array[REQALL_ROW-FR][0];
    if (alloc) {
      sheet.getRange(CURALL_ROW, lc).setValue(alloc); // copy requested alloc into current alloc
      sheet.getRange(REQALL_ROW, lc).clearContent();  // erase requested alloc
    } else {
      alloc = array[CURALL_ROW-FR][0];                // get the alloc from current if not set
    }

    // Set the values into the allocation historic
    this._setRangeValues(allocSheet, 3, FC, [allocArray[1]]);    // Copy only values into previous row (archive)

    var date = _toStringDate();
    var data = [[date, portValue, alloc]];
    this._insertFirstRow(allocSheet, data);

    // Insert the monthly interest into the historic
    var date = _toDate();              // Get date without hours
    date.setDate(date.getDate() - 1);  // Yesterday's date as interest are added for the last day of the previous month
    this._insertHistoricRow(date, null, null, null, null, null, monint);  //(date, type, label, trans, quantity, price, value)

    // Insert the monthly interest into the historic
    if (monpay > 0) {
      var date = _toDate();              // Get date without hours
      this._insertHistoricRow(date, null, null, "APPROVISIONNEMENT", null, null, monpay);  //(date, type, label, trans, quantity, price, value)
      this._sendMessage("Account withdrawal: " + monpay + " €", "");
    }
  }
}

function _updateExpense() {
  var sheet = this._getSheet(EXPENSES);
  var array = sheet.getSheetValues(FR, FC, 2, -1);
  if (!_isCurrentMonth(array)) {
    // Add new month
    var data = [[this._toDate()]];
    this._insertFirstRow(sheet, data);

    // Archive previous month
    this._setRangeValues(sheet, FR+2, FC, [array[1]]);    // Copy only values into previous row (archive)

    // Archive expenses historic
    var sheet = this._getSheet(EXPHISTO);
    var lc = sheet.getMaxColumns();
    var array = sheet.getSheetValues(FR+1, lc, -1, 1);
    this._setRangeValues(sheet, FR+1, lc, array);    // Copy only values into previous row (archive)
 }
}

function _updateAssociate() {
  // Retrieve associate main data
  var associateSheet = this._getSheet(ASSOCIATE);
  var associateArray = associateSheet.getSheetValues(FR, FC, -1, 2);

  for (var i = 0; i < associateArray.length; ++i) {
    // Retrieve associate account data
    var name = associateArray[i][0];
    var recu = associateArray[i][1];
    var sheet = this._getSheet(name);

    // If the sheet does not exist, create a new associate sheet from the model
    if (!sheet) {
      var modelSheet = this._getSheet(ASSMODEL);
      var sheet = modelSheet.copyTo(SS);
      sheet.setName(name);
      var index = sheet.getIndex();
      SS.setActiveSheet(sheet);
      SS.moveActiveSheet(index - 1);
      sheet.setFrozenRows(1);
      sheet.protect().setWarningOnly(true);
    }

    var array = sheet.getSheetValues(FR, FC, 1, -1);

    // Add monthly associate profit
    if (!_isCurrentMonth(array)) {
      this._copyFirstRow(sheet, array);

      // Add recurrent withdrawal to associate historic
      if (recu < 0) {
        var histoSheet = this._getSheet(ASSHISTO);
        var d = this._toDate();      // Get date without hours to match range's date
        d.setDate(d.getDate() + 10); // Take around 10 days to make a bank transfer

        var data = [[d, name, recu]];
        this._insertFirstRow(histoSheet, data);
      }
    }
  }
}

function _sendCharity() {
  // Retrieve associate main data
  var associateSheet = this._getSheet(ASSOCIATE);
  var associateArray = associateSheet.getSheetValues(FR, FC, -1, -1);

  var object = "Don annuel à une oeuvre de charité";
  var recap = "Liste des dons :\n";
  for (var i = 0; i < associateArray.length; ++i) {
    // Retrieve associate account data
    var name = associateArray[i][0];
    var char = associateArray[i][2];
    var mail = associateArray[i][10];
    var assoc = associateArray[i][20];
    var link = associateArray[i][21];

    // Send charity message if amount < 1
    if (char <= -1) {
      var money = this._round(-char, 2, " €");
      var message = "Cher(e) " + name + ",\n\n"
        + "Tout d'abord, mes meilleurs voeux pour cette nouvelle année qui commence, je l'espère, le plus magnifiquement pour toi.\n\n"
        + "Comme chaque année, je tiens tout particulièrement à reverser 5,5% des gains récoltés par notre projet de financement participatif.\n"
        + "Cette année, ce pourcentage représente la somme de " + money + " !\n\n"
        + (assoc
          ? "C'est déjà ça de gagné pour l'association \"" + assoc + "\", que tu as choisie. Un énorme merci pour elle.\n"
          + "J'attends le justificatif de ton don, don que tu peux faire grâce au lien suivant : " + link + "\n"
          : "Malheureusement, tu n'as pas (encore) choisie d'association à qui effectuer un don ... N'hésite pas à me contacter sous peu afin de changer ça !\n")
        + "Sans réponse de ta part, je ferai ce don à ta place pour l'association de mon choix (Les Restos du Coeur) d'ici le 31 janvier.\n\n"
        + "Enfin, toute ma reconnaissance pour ta confiance et ton investissement qui aide, à notre échelle, l'épanouissement de l'économie locale et solidaire.\n\n"
        + "Je te renouvelle tous mes voeux de bonheur, de joie et de prosperité.\n\n"
        + "Flo"

      MailApp.sendEmail(mail, object, message);

      recap += " - " + name + " (" + mail + ") : don de "+ money + (assoc ? " à \"" + assoc + "\" (" + link + ")" : "") + "\n";
    }
  }

  // Recap message send to myself
  this._sendMessage(object, recap);
}



function _getSheet(sheetName) {
//  var sheet = SpreadsheetApp.getActiveSheet();
//  return sheet && sheet.getName() == sheetName
//  ? sheet
//  : SpreadsheetApp.setActiveSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName));
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
  var lr = sheet.getMaxRows();
  var lc = lc ? lc : sheet.getMaxColumns();

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

  this._setRangeValues(sheet, FR, FC, data);
}

function _insertHistoricRow(date, type, label, trans, quantity, price, value, tag) {
  var sheet = this._getSheet(HISTORIC);

  date = date ? date : this._toDate();
  type = type ? type : "";
  label = label ? label : "";
  trans = trans ? trans : "COST";
  quantity = quantity ? quantity : "";
  price = price ? price : "";
  value = value ? value : 0;
  tag = tag ? tag : label + "@" + trans + "@" + quantity + "@" + value; //Vanguard S&P 500 UCITS ETF@COST@@-3.69

  var data = [[date, type, label, trans, quantity, price, value, tag]];
  this._insertFirstRow(sheet, data, true);
}

function _importXml(row, table) {
  return '=IMPORTXML("' + BLGLINK + '" & A' + row + ' & ":" & C' + row + ', "' + table + '")';
}

function _checkPriceDiff(array) {
  // Check for difference
  var lc = (array[0].length-1)/2;
  var i = 0;    // Skip first column which is the date
  var isDiff = false;
  while (!isDiff && ++i <= lc) {
    isDiff = array[0][i] != array[1][i] ? true : isDiff;
  }

  return isDiff;
}

function _copyFirstRow(sheet, array) {
  if (!this._isCurrentDay(array)) {
    this._insertFirstRow(sheet, null, true);
    this._setRangeValues(sheet, FR + 1, FC, [array[0]]);    // Copy only values into previous row (archive)
  }
}

function _isMarketOpen() {
  var x = new Date();
  var d = x.getDay();
  var h = x.getHours();

  return d >= FD && d <= LD && h >= FH && h <= LH;
}



function _toFixed(value, precision) {
  var str = value.toString();
  str += (str.indexOf(".") != -1 ? "" : ".") + Array(precision+1).join('0');
  return str.slice(0, str.indexOf(".") + precision + Math.min(precision, 1));
}

function _round(value, precision, symbol) {
  var mult = Math.pow(10, precision);
  var sup = symbol == "%" ? 100 : 1;
  var symbol = typeof(symbol) === "string" ? symbol : 0;

  return this._toFixed(Math.round(value * sup * mult) / mult, precision) + symbol;
}

function _isCurrentDay(array) {
  return array && array.length > 0 ? _toStringDate() == _toStringDate(array[0][0]) : false;
}

function _isCurrentMonth(array) {
  return array && array.length > 0 ? new Date().getMonth() == array[0][0].getMonth() : false;
}

function _toDate(date) {
  date = typeof(date) == "object" ? date : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function _toStringDate(date) {
  if (typeof(date) == "string") {
    return date && date.split("/").length == 3
    ? date.replace(/(^|\/)0+/g, "$1").split("/")[1] + "/"
    + date.replace(/(^|\/)0+/g, "$1").split("/")[0] + "/"
    + date.split("/")[2]
    : null;
  } else if (typeof(date) == "object") {
    var day = date.getDate();
    var month = date.getMonth() + 1;
    var year = date.getFullYear();
    return month + "/" + day + "/" + year;
  } else {
    return _toStringDate(new Date());
  }
}

function _indexOf(array, value, index, start) {
  var index = index >= 0 ? index : null;
  var x = parseInt(start) ? parseInt(start) : 0;

  var i = null;
  if (Array.isArray(array)) {
    while(x < array.length
          && ((index == null && array[x] != value)
      || (index != null && array[x][index] != value))) { ++x; }

    i = x < array.length ? x : null;
  }

  return i;
}

function _isNumber(number) {
  return typeof(number) === "number" && !isNaN(number);
}

function _isLoading(value) {
  return typeof(value) === "string" && (value == LOADING || value == "");
}

function _isError(value) {
  return typeof(value) === "string" && value.substring(0, 1) === '#';
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

function _sendMessage(object, message) {
  MailApp.sendEmail(MAIL, object, message);
}

/**
 * Gets the current sheet name.
 *
 * @return The current sheet name.
 * @customfunction
 */
function SHEETNAME() {
  return SS.getActiveSheet().getSheetName();
}

/**
 * Gets the interest rate.
 *
 * @return The interest rate.
 * @customfunction
 */
function INTERESTRATE() {
  return 1.25/100;
}
