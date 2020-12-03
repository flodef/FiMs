const workInProgress = false;
const ownEmail = "fdefroco@gmail.com";

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
  const userId = e && e.parameter && e.parameter.id ? e.parameter.id : "";
  const isMain = userId == "Flodef";
  const favIcon = 'https://raw.githubusercontent.com/flodef/FiMS/master/Img/Favicon2.png';
  const pageTitle = isMain ? 'FiMs Main' : 'FiMs Associate';
  const fileName = !workInProgress ? 'Index' : 'WorkInProgress';
  const spreadsheetId = isMain ? '1JJ7zW4GD7MzMBTatntdnojX5bZYcqI1kxMWIvc0_LTw' : '1pMnJel8OYtwk1Zu4YgTG3JwmTA-WLIMf6OnCQlSgprU';

  setProperty("userId", userId);
  setProperty("pageTitle", pageTitle);
  setProperty("spreadsheetId", spreadsheetId);

  var template = HtmlService.createTemplateFromFile(fileName);

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

function sendRecapEmail(subject) {
  MailApp.sendEmail(ownEmail, subject, "");
}

function sendEmail(recipient, subject, message, options) {
  MailApp.sendEmail(recipient, subject, message, options);
}

/**
 */
function getSheetValues(range, filter, column = 0) {
  const spreadsheetId = getProperty("spreadsheetId");
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
  const spreadsheetId = getProperty("spreadsheetId");
  return Sheets.Spreadsheets.Values.update({
    "range": range,
    "majorDimension": 'ROWS',
    "values": values,
  }, spreadsheetId, range, { valueInputOption: 'USER_ENTERED' });
}

/**
 */
function clearSheetValues(range) {
  const spreadsheetId = getProperty("spreadsheetId");
  return Sheets.Spreadsheets.Values.clear({}, spreadsheetId, range);
}

/**
 */
function insertRows(sheetId, values, range) {
  const spreadsheetId = getProperty("spreadsheetId");
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
  const spreadsheetId = getProperty("spreadsheetId");
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
  const spreadsheetId = getProperty("spreadsheetId");
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
