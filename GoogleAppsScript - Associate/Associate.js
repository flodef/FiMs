/* global GmailApp, FR, FC, FM, _getSheet, _sendMessage, _toDate, 
_insertFirstRow, _round, _copySheetFromModel, _toStringDate, _setRangeValues*/
/* exported updateAssociate, sendCharity */

// ASSOCIATE COLS
const ID_COL = 2; // Should be the "ID" column
const CHARITY_COL = 4; // Should be the "Charity" column
const DEPOSIT_COL = 10; // Should be the "Deposit" column
const EMAIL_COL = 15; // Should be the "EMail" column

// SHEET NAMES
const ASSOCIATE = "Associate"; // The "Associate" sheet name
const ASSMODEL = "AssociateModel"; // The "AssociateModel" sheet name

// SHOULD RUN ONCE A MONTH
function updateAssociate() {
  // Retrieve associate main data
  const associateSheet = _getSheet(ASSOCIATE);
  const associateArray = associateSheet.getSheetValues(FR, FC, -1, -1);

  for (let i = 0; i < associateArray.length; ++i) {
    // Retrieve associate account data
    const depo = associateArray[i][DEPOSIT_COL - 1];

    if (depo > 0) {
      const name = associateArray[i][ID_COL - 1];

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

      // Add monthly associate profit
      //   if (!_isCurrentMonth(array)) {
      //     _copyFirstRow(sheet, array);

      //     // Add recurrent withdrawal to associate historic
      //     if (recu < 0) {
      //       if (recu < -total) {
      //         _sendMessage(
      //           "STOP RECURRENT WITHDRAW FOR " + name + " !!",
      //           name +
      //             " asked for " +
      //             -recu +
      //             " € but there is only " +
      //             total +
      //             " € left in the bank !"
      //         );
      //       }

      //       const histoSheet = _getSheet(ASSHISTO);
      //       const d = _toDate(); // Get date without hours to match range's date
      //       d.setDate(d.getDate() + 5); // Take around 5 days to make a bank transfer

    //       const data = [[d, name, Math.max(recu, -total), 0]];
    //       _insertFirstRow(histoSheet, data);
    //     }
    //   }
    }
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
      const name = array[i][ID_COL - 1];
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
