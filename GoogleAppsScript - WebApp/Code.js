const pageTitle = 'Finance Manager';
const spreadsheetId = '1JJ7zW4GD7MzMBTatntdnojX5bZYcqI1kxMWIvc0_LTw';
const favIcon = 'https://raw.githubusercontent.com/flodef/FiMS/master/Img/Favicon2.png'

/**
 * https://script.google.com/macros/s/AKfycbw1nj4Vi29hGeU9Ju74r_hTfX1ZwwsJiW86ygvqguyQ/dev
 * Serves HTML of the application for HTTP GET requests.
 *
 * @param {Object} e event parameter that can contain information
 *     about any URL parameters provided.
 */
function doGet(e) {
//  const output = 'Hello ' + userId;
//  return ContentService.createTextOutput(output);

  setProperty("userId", e && e.parameter && e.parameter.id ? e.parameter.id : "");

  var template = HtmlService.createTemplateFromFile('Index');

  // Build and return HTML in IFRAME sandbox mode.
  return template.evaluate()
                 .setTitle(pageTitle)
                 .setFaviconUrl(favIcon);
}

/**
 */
function getProperty(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

/**
 */
function setProperty(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

function sendEmail(recipient, subject, message) {
  MailApp.sendEmail(recipient, subject, message);
}

/**
 */
function getSheetValues(range, filter, column = 0) {
  try {
    var content = Sheets.Spreadsheets.Values.get(spreadsheetId, range).values;
    if (filter) {
      var temp = content;

      content = [];
      content.push(temp[0]);
      for (var i = 1; i < temp.length; ++i) {
        if (temp[i][column] == filter) {
          content.push(temp[i]);
        }
      }
    }

    return content;
  } catch (e) {
    return null;
  }
}

/**
 */
function setSheetValues(range, values) {
  return Sheets.Spreadsheets.Values.update({
    "range": range,
    "majorDimension": 'ROWS',
    "values": values,
  }, spreadsheetId, range, { valueInputOption: 'USER_ENTERED' });
}

/**
 */
function clearSheetValues(range) {
  return Sheets.Spreadsheets.Values.clear({}, spreadsheetId, range);
}

/**
 */
function insertRows(sheetId, values, range) {
  return Sheets.Spreadsheets.batchUpdate({
    "requests": [{
      "insertDimension": {
        "range": {
          "sheetId": sheetId,
          "dimension": "ROWS",
          "startIndex": range.startRow,
          "endIndex": range.startRow+values.length
        },
        "inheritFromBefore": false,
      }
    }, {
      "copyPaste": {
        "source": {
          "sheetId": sheetId,
          "startRowIndex": range.startRow+values.length,
          "endRowIndex": range.startRow+values.length+1,
          "startColumnIndex": 0,
          "endColumnIndex": range.endCol,
        },
        "destination": {
          "sheetId": sheetId,
          "startRowIndex": range.startRow,
          "endRowIndex":range.startRow+values.length,
          "startColumnIndex": 0,
          "endColumnIndex": range.endCol,
        },
        "pasteType": 'PASTE_NORMAL',
        "pasteOrientation": 'NORMAL'
      }
//    },{
//      "updateCells": {
//        "rows": [{
//            "values": [{
//                "userEnteredValue": {
//                  "stringValue": ""
//                }
//              }
//            ]
//        }],
//        "fields": "*",
//        "start": {
//          "sheetId": sheetId,
//          "rowIndex": range.startRow,
//          "columnIndex": 0
//        },
//        "range": {
//          "sheetId": sheetId,
//          "startRowIndex": range.startRow,
//          "endRowIndex": range.startRow+values.length,
////          "startColumnIndex": 0,
////          "endColumnIndex": 0
//        }
//      }
    }],
    //      "includeSpreadsheetInResponse": false,
    //      "responseRanges": [string],
    //      "responseIncludeGridData": false,
  }, spreadsheetId);
}

/**
 */
function deleteRows(sheetId, startIndex, endIndex) {
  return Sheets.Spreadsheets.batchUpdate({
    "requests": [{
      "deleteDimension": {
        "range": {
          "sheetId": sheetId,
          "dimension": "ROWS",
          "startIndex": startIndex,
          "endIndex": endIndex
        }
      }
    }],
    //      "includeSpreadsheetInResponse": false,
    //      "responseRanges": [string],
    //      "responseIncludeGridData": false,
  }, spreadsheetId);
}

/**
 */
function sortColumn(sheetId, index, descending) {
  return Sheets.Spreadsheets.batchUpdate({
    "requests": [{
      "sortRange": {
        "range": {
          "sheetId": sheetId,
          "startRowIndex": 1,
//          "endRowIndex": 0,
//          "startColumnIndex": 0,
//          "endColumnIndex": 0
        },
        "sortSpecs": [
          {
            "dimensionIndex": index,
            "sortOrder": descending ? "DESCENDING" : "ASCENDING"
          }
        ]
      }
    }],
    //      "includeSpreadsheetInResponse": false,
    //      "responseRanges": [string],
    //      "responseIncludeGridData": false,
  }, spreadsheetId);
}
