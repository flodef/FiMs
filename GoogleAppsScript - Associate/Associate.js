/* global GmailApp, FR, FC, FM, CacheService, _getSheet, _sendMessage, _toDate, 
_insertFirstRow, _round, _copySheetFromModel, _toStringDate, _setRangeValues,
_isSubHour, _isLoading, _isError, _updateFormula */
/* exported updateAssociate, sendCharity, reminderNewsLetter, updateValue, checkValue */

// ASSOCIATE COLS
const NAME_COL = 2; // Should be the "NAME" column
const CHARITY_COL = 4; // Should be the "Charity" column
const DEPOSIT_COL = 7; // Should be the "Deposit" column
const TOTAL_COL = 11; // Should be the "Total" column
const EMAIL_COL = 12; // Should be the "EMail" column

// PORTFOLIO COLS
const CACHE_COL = 15; // Should be the "" column

// SHEET NAMES
const ASSOCIATE = "Associate"; // The "Associate" sheet name
const ASSMODEL = "AssociateModel"; // The "AssociateModel" sheet name
const PORTFOLIO = "Portfolio"; // The "Portfolio" sheet name

// MISC
const CACHE_UPDATE = 10; // Number of minutes between price updates

// SHOULD RUN ONCE A DAY
function updateValue() {
  if (_isSubHour(CACHE_UPDATE, 0)) {
    // Remove the offset to avoid caching if it failed until there
    const cache = CacheService.getScriptCache();
    cache.remove("offset");

    // Modify the cell to update the formula and load data
    const sheet = _getSheet(PORTFOLIO);
    _updateFormula(sheet, 1, CACHE_COL);
  }
}

// SHOULD RUN ONCE A MINUTE
function checkValue() {
  const sheet = _getSheet(PORTFOLIO);
  const lr = sheet.getMaxRows();
  const val = sheet.getRange(FR, CACHE_COL, lr, 1).getValues();
  for (let i = 0; i < lr - 1; ++i) {
    const v = val[i][0];
    if (v.toString() && (_isLoading(v) || _isError(v))) {
      _updateFormula(sheet, 1, CACHE_COL);
      return;
    }
  }
}

// SHOULD RUN ONCE A MONTH
function updateAssociate() {
  // Retrieve associate main data
  const associateSheet = _getSheet(ASSOCIATE);
  const associateArray = associateSheet.getSheetValues(FR, FC, -1, -1);

  for (let i = 0; i < associateArray.length; ++i) {
    // Retrieve associate account data
    const depo = associateArray[i][DEPOSIT_COL - 1];

    if (depo > 0) {
      const name = associateArray[i][NAME_COL - 1];

      // If the sheet does not exist, create a new associate sheet from the model
      const sheet = _copySheetFromModel(name, ASSMODEL);
      const lc = sheet.getMaxColumns();
      sheet.getRange(FR, lc).setValue(name);
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
      const char = array[i][CHARITY_COL - 1];
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
