/* global GmailApp, FR, FC, FM, SpreadsheetApp, CacheService, _getSheet, _sendMessage, 
_toDate, _insertFirstRow, _round, _copySheetFromModel, _toStringDate, _setRangeValues,
_isLoading, _isError, _updateFormula, _copyFormula, _isSubHour */
/* exported onOpen, updateAssociate, sendCharity, reminderNewsLetter, updateValue, 
checkValue */

// ASSOCIATE COLS
const INDEX_COL = 1; // Should be the "Index" column
const NAME_COL = 2; // Should be the "Name" column
const DONATED_COL = 3; // Should be the "Donated" column
const DEPOSIT_COL = 5; // Should be the "Deposit" column
const TOTAL_COL = 9; // Should be the "Total" column
const EMAIL_COL = 10; // Should be the "EMail" column

// PORTFOLIO COLS
const DATA_COL = 16; // Should be the column containing the formula to copy
const FORMULA_COL = 17; // Should be the column containing the formula update space

// SHEET NAMES
const ASSOCIATE = "Associate"; // The "Associate" sheet name
const ASSMODEL = "AssociateModel"; // The "AssociateModel" sheet name
const PORTFOLIO = "Portfolio"; // The "Portfolio" sheet name

// MISC
const PRICE_UPDATE = 10; // Number of minutes between price updates

// Add a menu into the spreadsheet to manually trigger functions
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Update")
    .addItem("Update values", "updateValue")
    .addItem("Update associates", "updateAssociate")
    .addToUi();
}

// SHOULD RUN ONCE AN HOUR
function updateValue() {
  // Modify the cell to update the formula and load fresh data
  const sheet = _getSheet(PORTFOLIO);
  _updateFormula(sheet, 1, FORMULA_COL);

  // Set an update flag into the cache
  const cache = CacheService.getScriptCache();
  cache.put("update", true);
}

// SHOULD RUN ONCE A MINUTE
function checkValue() {
  // Check if there is an update flag indicating to update
  const cache = CacheService.getScriptCache();
  const shouldUpdate = cache.get("update");

  if (_isSubHour(PRICE_UPDATE, 0) || shouldUpdate) {
    cache.remove("update");

    const sheet = _getSheet(PORTFOLIO);
    const lr = sheet.getMaxRows();
    const lc = sheet.getMaxColumns();

    // Cache the data previously fetched
    const cols = lc - DATA_COL + 1;
    const rows = lr - 1;
    const val = sheet.getRange(FR, DATA_COL, rows, cols).getValues();
    for (let i = 0; i < rows; ++i) {
      const v = val[i][0];
      if (v.toString().trim() && !_isLoading(v) && !_isError(v)) {
        const dataCache = [];
        for (let j = 0; j < cols; ++j) {
          const data = val[i][j];
          if (data) {
            dataCache.push(data);
          }
        }
        sheet.getRange(FR + i, DATA_COL - 1).setValue(dataCache.join("|"));
      } else {
        const range = sheet.getRange(FR + i, DATA_COL);
        const formula = range.getFormula();
        if (formula) {
          range.setValue(v);
        } else {
          _copyFormula(sheet.getRange(1, DATA_COL), range);
        }
      }
    }
  }
}

// SHOULD RUN ONCE A DAY
function updateAssociate() {
  // Update the associates from the db
  const portfolioSheet = _getSheet(PORTFOLIO);
  _updateFormula(portfolioSheet, 1, FORMULA_COL + 1);

  // Retrieve associate main data
  const associateSheet = _getSheet(ASSOCIATE);
  const associateArray = associateSheet.getSheetValues(FR, FC, -1, -1);

  for (let i = 0; i < associateArray.length; ++i) {
    // Retrieve associate account data
    const depo = associateArray[i][DEPOSIT_COL - 1];

    if (depo > 0) {
      const index = associateArray[i][INDEX_COL - 1];

      // If the sheet does not exist, create a new associate sheet from the model
      const sheet = _copySheetFromModel(index, ASSMODEL);
      const lc = sheet.getMaxColumns();
      sheet.getRange(FR, lc).setValue(index);
      // sheet.hideColumns(lc);

      const array = sheet.getSheetValues(FR, FC, 2, -1);

      // Do a copy only if it is the first day of the month and the copy has not already been done
      if (array[0][0].getDate() == 1 && _toStringDate(array[0][0]) != _toStringDate(array[1][0])) {
        _insertFirstRow(sheet, null, true);
        _setRangeValues(sheet, FR + 1, FC, [array[0]]); // Copy only values into previous row (archive)

        const date = _toDate(); // Get date without hours
        sheet.getRange(FR + 1, FC).setValue(date); // Update the previous month date
      }
    }
  }
}

// SHOULD RUN ONCE A MONTH
function reminderNewsLetter() {
  // Retrieve associate main data
  const sheet = _getSheet(ASSOCIATE);
  const array = sheet.getSheetValues(FR, FC, -1, -1);

  // List all newsletter subscribers
  const object = "Associate Mail Reminder /!\\ BCC /!\\";
  let list = "";
  for (let i = 0; i < array.length; ++i) {
    list += parseInt(array[i][TOTAL_COL - 1]) > 0 ? array[i][EMAIL_COL - 1] + "," : "";
  }

  // Message with list send to myself
  if (list != "") {
    _sendMessage(object, list.slice(0, -1)); // Remove last comma at the end of the list
  }
}

// SHOULD RUN ONCE A MONTH
function sendCharity() {
  const x = new Date();
  const m = x.getMonth();
  if (m == FM) {
    // Retrieve associate main data
    const sheet = _getSheet(ASSOCIATE);
    const array = sheet.getSheetValues(FR, FC, -1, -1);

    const object = "Don annuel à une oeuvre de charité";
    let recap = "Liste des dons :\n";
    let total = 0;
    for (let i = 0; i < array.length; ++i) {
      // Retrieve associate account data
      const name = array[i][NAME_COL - 1];
      const char = array[i][DONATED_COL - 1];
      const mail = array[i][EMAIL_COL - 1];

      // Send charity message if amount <= -1
      if (char <= -1) {
        const money = _round(-char, 2, " €");
        const message =
          "Cher(e) " +
          name +
          ",\n\n" +
          "Tout d'abord, mes meilleurs voeux pour cette nouvelle année qui commence, je l'espère, le plus magnifiquement pour toi.\n\n" +
          "Comme chaque année, je tiens tout particulièrement à reverser 10% des gains récoltés par notre projet de financement participatif.\n" +
          "Cette année, ce pourcentage représente la somme de " +
          money +
          " !\n\n" +
          "Tu recevras donc très prochainement cet argent sur ton compte.\n" +
          "Libre à toi de le verser ou non à l'association ou personne de ton choix.\n\n" +
          "Enfin, toute ma reconnaissance pour ta confiance et ton investissement qui aide, à notre échelle, l'épanouissement de l'économie locale et solidaire.\n\n" +
          "Je te renouvelle tous mes voeux de bonheur, de joie et de prosperité.\n\n" +
          "Flo";

        GmailApp.sendEmail(mail, object, message);

        total += -char;
        recap += " - " + name + " (" + mail + ") : don de " + money + "\n";
      }
    }

    // Recap message send to myself
    recap += "\nTOTAL = " + _round(total, 2, " €");
    _sendMessage(object, recap);
  }
}
