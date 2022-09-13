/* global _getSheet, _deleteOlderThanAYear, _copyFirstRow, _AreRowsDifferent,
_toDate, _isSubHour, _isLoading, _isError, FR, FC, CacheService, _updateFormula, 
_toStringDate, _insertFirstRow, _setRangeValues */
/* exported nightlyUpdate, monthlyUpdate, updatePrice, cachePrice */

// SHEET NAMES
const EVOLUTION = "Evolution"; // The "Evolution" sheet name
const PRICE = "Price"; // The "Price" sheet name
const HISTORIC = "Historic"; // The "Historic" sheet name
const PRICECACHE = "PriceCache"; // The "Price" sheet name

// CACHEPRICE COLS
const PRICE_COL = 2; // Should be the "Price" column
const FORMULA_COL = 5; // Should be the "Formula" column

// MISC
const PRICE_UPDATE = 10; // Number of minutes between price updates

function nightlyUpdate() {
  _updateEvolution();
}

function monthlyUpdate() {
  _updateHistoric();
}

function updatePrice() {
  if (_isSubHour(PRICE_UPDATE, 0)) {
    // Remove the offset to avoid caching if it failed until there
    const cache = CacheService.getScriptCache();
    cache.remove("offset");

    // Modify the cell to update the formula and load data
    _updateFormula(_getSheet(PRICECACHE), FR, FORMULA_COL - 1);
  }
}

function cachePrice() {
  const cache = CacheService.getScriptCache();
  const cv = cache.get("offset");
  const offset = cv ? Number(cv) : 1;
  if (_isSubHour(PRICE_UPDATE, offset)) {
    const sheet = _getSheet(PRICECACHE);
    const lr = sheet.getMaxRows();
    const lc = sheet.getMaxColumns();
    const range = sheet.getRange(FR, lc, lr, 1);
    const val = range.getValues();
    const x = new Date();
    let cached = 0;

    for (let i = 0; i < lr - 1; ++i) {
      const v = val[i][0];
      if (v.toString() && !_isLoading(v) && !_isError(v)) {
        sheet.getRange(i + FR, PRICE_COL).setValue(v); // Cache the value
        sheet.getRange(i + FR, PRICE_COL + 1).setValue(x); // Set the last updated date
        ++cached;
      }
    }

    // If not values have been cached, set the offset to cache Price again,
    // otherwise remove the manual cache, set in case of loading error
    if (cached != lr - 1) {
      cache.put("offset", offset + 1);
      _updateFormula(sheet, FR, FORMULA_COL - 1);
    } else {
      sheet.getRange(1, FORMULA_COL - 1).clearContent();
    }
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

function _updateHistoric() {
  // Search if entries have already been added
  const sheet = _getSheet(HISTORIC);
  const array = sheet.getSheetValues(FR, FC, 2, -1);

  // Do a copy only if it is the first day of the month and the copy has not already been done
  if (array[0][0].getDate() == 1 && _toStringDate(array[0][0]) != _toStringDate(array[1][0])) {
    _insertFirstRow(sheet, null, true);
    _setRangeValues(sheet, FR + 1, FC, [array[0]]); // Copy only values into previous row (archive)

    const date = _toDate(); // Get date without hours
    sheet.getRange(FR + 1, FC).setValue(date); // Update the previous month date
  }
}
