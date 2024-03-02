/* global _getSheet, _deleteOlderThanAYear, _copyFirstRow, _AreRowsDifferent,
_toDate, _isSubHour, _isLoading, _isError, FR, FC, CacheService, _updateFormula, 
_toStringDate, _insertFirstRow, _setRangeValues */
/* exported nightlyUpdate, monthlyUpdate, updatePrice, cachePrice */

// SHEET NAMES
const EVOLUTION = "Evolution"; // The "Evolution" sheet name
const PRICE = "Price"; // The "Price" sheet name
const HISTORIC = "Historic"; // The "Historic" sheet name
const PRICECACHE = "PriceCache"; // The "PriceCache" sheet name
const TOKEN = "Token"; // The "Token" sheet name
const WALLET = "Wallet"; // The "Wallet" sheet name

// CACHEPRICE COLS
const PRICE_COL = 2; // Should be the "Price" column

// TOKEN COLS
const AVAILABLE_COL = 5; // Should be the "Available" column

// WALLET COLS
const CACHE_COL = 8; // Should be the "Cache" column

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
    const sheet = _getSheet(PRICECACHE);
    const lc = sheet.getMaxColumns();
    _updateFormula(sheet, FR, lc - 1);
  }
}

function cachePrice() {
  const cache = CacheService.getScriptCache();
  const cv = cache.get("offset");
  const offset = cv ? Number(cv) : 1;
  if (_isSubHour(PRICE_UPDATE, offset)) {
    _doCache(_getSheet(TOKEN), AVAILABLE_COL);
    _doCache(_getSheet(WALLET), CACHE_COL);

    const sheet = _getSheet(PRICECACHE);
    const lr = sheet.getMaxRows();
    const lc = sheet.getMaxColumns();
    const cached = _doCache(sheet, PRICE_COL, true);

    // If all values has not been cached, set the offset to cache Price again,
    if (cached < lr - 1) {
      cache.put("offset", offset + 1);
      _updateFormula(sheet, FR, lc - 1);
    }
  }
}

function _doCache(sheet, column, hasDate) {
  const lr = sheet.getMaxRows();
  const lc = sheet.getMaxColumns();
  const range = sheet.getRange(FR, lc, lr, 1);
  const val = range.getValues();
  const x = hasDate ? new Date() : null;
  let cached = 0;

  for (let i = 0; i < lr - 1; ++i) {
    const v = val[i][0];
    if (v.toString() && !_isLoading(v) && !_isError(v)) {
      sheet.getRange(i + FR, column).setValue(v); // Cache the value
      if (x) {
        sheet.getRange(i + FR, column + 1).setValue(x); // Set the last updated date
      }
      ++cached;
    }
  }

  return cached;
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
