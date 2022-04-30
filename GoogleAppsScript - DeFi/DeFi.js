/* global _getSheet, _deleteOlderThanAYear, _copyFirstRow, _AreRowsDifferent,
_toDate, _isCurrentMonth, _isSubHour, _isLoading, _isError, FR, FC, CacheService */
/* exported nightlyUpdate, monthlyUpdate, updatePrice, cachePrice */



// SHEET NAMES
const EVOLUTION = 'Evolution';    // The "Evolution" sheet name
const PRICE = 'Price';            // The "Price" sheet name
const HISTORIC = 'Historic';      // The "Historic" sheet name
const PRICECACHE = 'PriceCache';  // The "Price" sheet name

// CACHEPRICE COLS
const FORMULA_COL = 3;            // Should be the "Formula" column
const PRICE_COL = 5;              // Should be the "Price" column

// MISC
const PRICE_UPDATE = 10;          // Number of minutes between price updates


function nightlyUpdate() {
  _updateEvolution();
}

function monthlyUpdate() {
  _updateHistoric();
}


function updatePrice() {
  if (_isSubHour(PRICE_UPDATE, 0)) {
    const cache = CacheService.getScriptCache();
    cache.remove('offset');

    const range = _getSheet(PRICECACHE).getRange(FR, FORMULA_COL-1);
    range.setValue(range.getValue() == '' ? ' ' : '');  // Modify the cell to update the formula and load data
  }
}

function cachePrice() {
  const cache = CacheService.getScriptCache();
  const offset = cache.get('offset') ?? 1;
  if (_isSubHour(PRICE_UPDATE, offset)) {
    const sheet = _getSheet(PRICECACHE);
    const lr = sheet.getMaxRows();
    const range = sheet.getRange(FR, PRICE_COL, lr, 1);
    const val = range.getValues();
    const x = new Date();
    let cached = 0;

    for (let i = 0; i < lr-1; ++i) {
      const v = val[i][0];
      if (v && !_isLoading(v) && !_isError(v)) {
        sheet.getRange(i+FR, PRICE_COL+1).setValue(v);  // Cache the value
        sheet.getRange(i+FR, PRICE_COL+2).setValue(x);  // Set the last updated date
        ++cached;
      }
    }

    // If not values have been cached, set the offset to cache Price again,
    // otherwise remove the manual cache, set in case of loading error
    if (cached != lr-1) {
      cache.put('offset', offset+1);
    } else {
      _getSheet(PRICECACHE).getRange(1, FORMULA_COL-1).clearContent();
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
  if (!_isCurrentMonth(array)) {
    _copyFirstRow(sheet, array);

    const date = _toDate();                 // Get date without hours
    date.setMonth(date.getMonth() + 1, 1);  // Set the date at the first of next month
    sheet.getRange(FR+1, FC).setValue(date);
  }
}
