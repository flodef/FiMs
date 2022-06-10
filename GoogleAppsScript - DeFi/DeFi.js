/* global _getSheet, _deleteOlderThanAYear, _copyFirstRow, _AreRowsDifferent,
_toDate, _isCurrentMonth, _isSubHour, _isLoading, _isError, _sendMessage,
_toPercent, FR, FC, CacheService, _updateFormula */
/* exported nightlyUpdate, monthlyUpdate, updatePrice, cachePrice */

// SHEET NAMES
const DASHBOARD = "Dashboard"; // The "Dashboard" sheet name
const EVOLUTION = "Evolution"; // The "Evolution" sheet name
const PRICE = "Price"; // The "Price" sheet name
const HISTORIC = "Historic"; // The "Historic" sheet name
const PRICECACHE = "PriceCache"; // The "Price" sheet name

// CACHEPRICE COLS
const PRICE_COL = 2; // Should be the "Price" column
const FORMULA_COL = 5; // Should be the "Formula" column

// DASHBOARD ROWS
const LENDING_ROW = 4; // Should be the "Apricot borrow" row ! FROM THE BOTTOM !

// MISC
const PRICE_UPDATE = 10; // Number of minutes between price updates
const LENDING_ALERT = 0.95; // Percentage above when an alert should be send

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

    // Send an alert if the lending ratio reached a certain amount
    const sheet = _getSheet(DASHBOARD);
    const lr = sheet.getMaxRows();
    const lc = sheet.getMaxColumns();
    const l = sheet.getRange(lr - LENDING_ROW + 1, lc).getValue();
    if (Math.abs(l) > LENDING_ALERT) {
      _sendMessage(
        "Lending ratio limit reached",
        "The Lending ratio is at " + _toPercent(l, 1) + ". Check it out !!",
        true
      );
    }
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
      if (v && !_isLoading(v) && !_isError(v)) {
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
  if (!_isCurrentMonth(array)) {
    _copyFirstRow(sheet, array);

    const date = _toDate(); // Get date without hours
    date.setMonth(date.getMonth() - 1, 1); // Set the date at the first of previous month
    sheet.getRange(FR + 1, FC).setValue(date); // Update the previous month date
  }
}
