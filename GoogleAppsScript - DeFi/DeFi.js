/* global _getSheet, _deleteOlderThanAYear, _copyFirstRow, _AreRowsDifferent,
_toDate, _isCurrentMonth, FR, FC */
/* exported nightlyUpdate, monthlyUpdate */



// SHEET NAMES
const EVOLUTION = 'Evolution';   // The "Evolution" sheet name
const PRICE = 'Price';           // The "Price" sheet name
const HISTORIC = 'Historic';     // The "Historic" sheet name



function nightlyUpdate() {
  _updateEvolution();
}

function monthlyUpdate() {
  _updateHistoric();
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

function _updateHistoric() {
  // Search if entries have already been added
  const sheet = _getSheet(HISTORIC);
  const array = sheet.getSheetValues(FR, FC, 2, -1);
  if (!_isCurrentMonth(array)) {
    _copyFirstRow(sheet, array);

    const date = _toDate();                 // Get date without hours
    date.setMonth(date.getMonth() + 1, 1);  // Set the date at the first of next month
    sheet.getRange(FR+1, FC).setValue(date);
  }
}
