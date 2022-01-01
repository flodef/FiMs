/* global SpreadsheetApp, GmailApp */
/* exported updateAssociate, sendCharity */


// MAIN SPREADSHEET
const SS = SpreadsheetApp.getActiveSpreadsheet();

// ASSOCIATE COLS
const ASSNAME_COL = 2;          // Should be the "ID" column
const ASSRECU_COL = 3;          // Should be the "Recurrent" column
const ASSCHAR_COL = 4;          // Should be the "Charity" column
const ASSDEPO_COL = 10;          // Should be the "Deposit" column
const ASSTOTAL_COL = 14;         // Should be the "Total" column
const ASSMAIL_COL = 15;          // Should be the "EMail" column

// SHEET NAMES
const ASSOCIATE = 'Associate';      // The "Associate" sheet name
const ASSMODEL = 'AssociateModel';  // The "AssociateModel" sheet name
const ASSHISTO = 'AssociateHistoric';  // The "AssociateHistoric" sheet name

// VARIOUS
const MAIL = 'fdefroco@gmail.com';
const FR = 2;     // First Row
const FC = 1;     // First Column
const FM = 0;     // First month (january)


function updateAssociate() {
  // Retrieve associate main data
  const associateSheet = _getSheet(ASSOCIATE);
  const associateArray = associateSheet.getSheetValues(FR, FC, -1, ASSTOTAL_COL);

  for (var i = 0; i < associateArray.length; ++i) {
    // Retrieve associate account data
    const depo = associateArray[i][ASSDEPO_COL-1];
    const total = associateArray[i][ASSTOTAL_COL-1];

    if (depo > 0) {
      const name = associateArray[i][ASSNAME_COL-1];
      const recu = associateArray[i][ASSRECU_COL-1];

      // If the sheet does not exist, create a new associate sheet from the model
      var sheet = _getSheet(name);
      if (!sheet) {
        const modelSheet = _getSheet(ASSMODEL);
        sheet = modelSheet.copyTo(SS);
        const lc = modelSheet.getMaxColumns();

        sheet.setName(name);
        const index = sheet.getIndex();
        SS.setActiveSheet(sheet);
        SS.moveActiveSheet(index - 1);
        const range = sheet.getRange(FR, lc);
        const value = range.getValue();
        range.setValue(value.replace('SheetName', name));
        sheet.getRange(FR, lc).setValue('=IF(ROW()=2,"' + name + '",ROW()-1)');
        sheet.hideColumns(lc);
        sheet.setFrozenRows(1);
        sheet.protect().setWarningOnly(true);
      }

      const array = sheet.getSheetValues(FR, FC, 1, -1);

      // Add monthly associate profit
      if (!_isCurrentMonth(array)) {
        _copyFirstRow(sheet, array);

        // Add recurrent withdrawal to associate historic
        if (recu < 0) {
          if (recu < -total) {
            _sendMessage('STOP RECURRENT WITHDRAW FOR ' + name + ' !!',
              name + ' asked for ' + -recu + ' € but there is only ' + total + ' € left in the bank !');
          }

          const histoSheet = _getSheet(ASSHISTO);
          var d = _toDate();      // Get date without hours to match range's date
          d.setDate(d.getDate() + 5);  // Take around 5 days to make a bank transfer

          const data = [[d, name, Math.max(recu, -total), 0]];
          _insertFirstRow(histoSheet, data);
        }
      }
    }
  }
}

function sendCharity() {
  const x = new Date();
  const m = x.getMonth();
  if (m == FM) {
    // Retrieve associate main data
    const associateSheet = _getSheet(ASSOCIATE);
    const associateArray = associateSheet.getSheetValues(FR, FC, -1, -1);

    const object = 'Don annuel à une oeuvre de charité';
    var recap = 'Liste des dons :\n';
    var total = 0;
    for (var i = 0; i < associateArray.length; ++i) {
      // Retrieve associate account data
      const name = associateArray[i][ASSNAME_COL-1];
      const char = associateArray[i][ASSCHAR_COL-1];
      const mail = associateArray[i][ASSMAIL_COL-1];

      // Send charity message if amount <= -1
      if (char <= -1) {
        const money = _round(-char, 2, ' €');
        const message = 'Cher(e) ' + name + ',\n\n'
        + 'Tout d\'abord, mes meilleurs voeux pour cette nouvelle année qui commence, je l\'espère, le plus magnifiquement pour toi.\n\n'
        + 'Comme chaque année, je tiens tout particulièrement à reverser 10% des gains récoltés par notre projet de financement participatif.\n'
        + 'Cette année, ce pourcentage représente la somme de ' + money + ' !\n\n'
        + 'Tu recevras donc très prochainement cet argent sur ton compte.\n'
        + 'Libre à toi de le verser ou non à l\'association ou personne de ton choix.\n\n'
        + 'Enfin, toute ma reconnaissance pour ta confiance et ton investissement qui aide, à notre échelle, l\'épanouissement de l\'économie locale et solidaire.\n\n'
        + 'Je te renouvelle tous mes voeux de bonheur, de joie et de prosperité.\n\n'
        + 'Flo';

        GmailApp.sendEmail(mail, object, message);

        total += -char;
        recap += ' - ' + name + ' (' + mail + ') : don de '+ money + '\n';
      }
    }

    // Recap message send to myself
    recap += '\nTOTAL = ' + _round(total, 2, ' €');
    _sendMessage(object, recap);
  }
}



// ************************************
// ***** COMMON LIBRARY FUNCTIONS *****
// ************************************

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

// function _copyFormula(formula, range) {
//   formula.copyTo(range, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
// }

function _insertFirstRow(sheet, data, isFast, lc) {
  var lr = sheet.getMaxRows();
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

// function _isMarketOpen() {
//   var x = new Date();
//   var d = x.getDay();
//   var h = x.getHours();
//
//   return d >= FD && d <= LD && h >= FH && h <= LH;
// }


function _toFixed(value, precision) {
  var str = value.toString();
  str += (str.indexOf('.') != -1 ? '' : '.') + Array(precision+1).join('0');
  return str.slice(0, str.indexOf('.') + precision + Math.min(precision, 1));
}

function _round(value, precision, symbol) {
  var mult = Math.pow(10, precision);
  var sup = symbol == '%' ? 100 : 1;
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
    var day = date.getDate();
    var month = date.getMonth() + 1;
    var year = date.getFullYear();
    return month + '/' + day + '/' + year;
  } else {
    return _toStringDate(new Date());
  }
}

// function _indexOf(array, value, index, start) {
//   index = index >= 0 ? index : null;
//   var x = parseInt(start) ? parseInt(start) : 0;
//
//   var i = null;
//   if (Array.isArray(array)) {
//     while(x < array.length
//           && ((index == null && array[x] != value)
//       || (index != null && array[x][index] != value))) { ++x; }
//
//     i = x < array.length ? x : null;
//   }
//
//   return i;
// }

// function _isLoading(value) {
//   return typeof(value) === 'string' && (value == LOADING || value == '');
// }
//
// function _isError(value) {
//   return typeof(value) === 'string' && value.substring(0, 1) === '#';
// }
//
// function _archiveMessage(thread, shouldDelete) {
//   if (thread) {
//     thread = thread.markRead();
//     if (shouldDelete) {
//       thread.moveToTrash();
//     } else {
//       thread.moveToArchive();
//     }
//   }
// }

function _sendMessage(object, message) {
  GmailApp.sendEmail(MAIL, object, message);
}
