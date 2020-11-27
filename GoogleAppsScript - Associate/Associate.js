// MAIN SPREADSHEET
const SS = SpreadsheetApp.getActiveSpreadsheet();

// ASSOCIATE COLS
const ASSNAME_COL = 2;          // Should be the "ID" column
const ASSRECU_COL = 3;          // Should be the "Recurrent" column
const ASSCHAR_COL = 4;          // Should be the "Charity" column
const ASSDEPO_COL = 10;          // Should be the "Deposit" column
const ASSMAIL_COL = 15;          // Should be the "EMail" column
const ASSASSO_COL = 25;          // Should be the "Association" column
const ASSLINK_COL = 26;          // Should be the "Web Page" column

// SHEET NAMES
const ASSOCIATE = "Associate";      // The "Associate" sheet name
const ASSMODEL = "AssociateModel";  // The "AssociateModel" sheet name
const ASSHISTO = "AssociateHistoric";  // The "AssociateHistoric" sheet name

// VARIOUS
const MAIL = "fdefroco@gmail.com";
const LOADING = "Loading...";
const DUMMY = "XXXXXX";
const OK = "OK";
const FR = 2;     // First Row
const FC = 1;     // First Column
const FH = 9;     // First working Hour
const LH = 17;    // Last working hour
const FD = 1;     // First working day
const LD = 5;     // Last working day
const FM = 0;     // First month (january)


function updateAssociate() {
  // Retrieve associate main data
  var associateSheet = this._getSheet(ASSOCIATE);
  var associateArray = associateSheet.getSheetValues(FR, FC, -1, ASSDEPO_COL);

  for (var i = 0; i < associateArray.length; ++i) {
    // Retrieve associate account data
    var depo = associateArray[i][ASSDEPO_COL-1];

    if (depo > 0) {
      var name = associateArray[i][ASSNAME_COL-1];
      var recu = associateArray[i][ASSRECU_COL-1];

      // If the sheet does not exist, create a new associate sheet from the model
      var sheet = this._getSheet(name);
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
}

function sendCharity() {
  const x = new Date();
  const m = x.getMonth();
  if (m == FM) {
    // Retrieve associate main data
    var associateSheet = this._getSheet(ASSOCIATE);
    var associateArray = associateSheet.getSheetValues(FR, FC, -1, -1);
    
    var object = "Don annuel à une oeuvre de charité";
    var recap = "Liste des dons :\n";
    for (var i = 0; i < associateArray.length; ++i) {
      // Retrieve associate account data
      var name = associateArray[i][ASSNAME_COL-1];
      var char = associateArray[i][ASSCHAR_COL-1];
      var mail = associateArray[i][ASSMAIL_COL-1];
      var assoc = associateArray[i][ASSASSO_COL-1];
      var link = associateArray[i][ASSLINK_COL-1];
      
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
