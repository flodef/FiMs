/* global GmailApp, FR, FC, SS, FM, _getSheet, _isCurrentMonth, _copyFirstRow,
_sendMessage, _toDate, _insertFirstRow, _round*/
/* exported updateAssociate, sendCharity */



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



function updateAssociate() {
  // Retrieve associate main data
  const associateSheet = _getSheet(ASSOCIATE);
  const associateArray = associateSheet.getSheetValues(FR, FC, -1, ASSTOTAL_COL);

  for (let i = 0; i < associateArray.length; ++i) {
    // Retrieve associate account data
    const depo = associateArray[i][ASSDEPO_COL-1];
    const total = associateArray[i][ASSTOTAL_COL-1];

    if (depo > 0) {
      const name = associateArray[i][ASSNAME_COL-1];
      const recu = associateArray[i][ASSRECU_COL-1];

      // If the sheet does not exist, create a new associate sheet from the model
      let sheet = _getSheet(name);
      if (!sheet) {
        const modelSheet = _getSheet(ASSMODEL);
        sheet = modelSheet.copyTo(SS);
        const lc = modelSheet.getMaxColumns();

        sheet.setName(name);
        const index = sheet.getIndex();
        SS.setActiveSheet(sheet);
        SS.moveActiveSheet(index - 1);
        sheet.getRange(FR, lc).setValue('=IF(ROW()=2,"' + name + '",INDEX(O:O,ROW()-1))');
        sheet.hideColumns(lc);
        sheet.setFrozenRows(1);
        sheet.showSheet();
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
          const d = _toDate();      // Get date without hours to match range's date
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
    const sheet = _getSheet(ASSOCIATE);
    const array = sheet.getSheetValues(FR, FC, -1, -1);

    const object = 'Don annuel à une oeuvre de charité';
    let recap = 'Liste des dons :\n';
    let total = 0;
    for (let i = 0; i < array.length; ++i) {
      // Retrieve associate account data
      const name = array[i][ASSNAME_COL-1];
      const char = array[i][ASSCHAR_COL-1];
      const mail = array[i][ASSMAIL_COL-1];

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
