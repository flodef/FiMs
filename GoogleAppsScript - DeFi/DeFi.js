/* global _getSheet, _deleteOlderThanAYear, _copyFirstRow, _AreRowsDifferent,
FR, FC */
/* exported nightlyUpdate */



// SHEET NAMES
const EVOLUTION = 'Evolution';   // The "Evolution" sheet name
const PRICE = 'Price';           // The "Price" sheet name



function nightlyUpdate() {
  _updateEvolution();
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
