// USE EXAMPLE :
// google.script.run
//              .withSuccessHandler(function(contents) {
//                updateDashboardTable(contents);
//              })
//              .withFailureHandler(displayError)
//              .getSheetValues("Dashboard!A:B");

// WARNING !! WORK IN PROGRESS
// WARNING !! WORK IN PROGRESS
// WARNING !! WORK IN PROGRESS


class google {
  static get script() {
    return Script;
  }
}

class Script {
  static get run() {
    return new Run();
  }
}

spreadsheetId = '1JJ7zW4GD7MzMBTatntdnojX5bZYcqI1kxMWIvc0_LTw';

class Run {
  withSuccessHandler(func) {
    this.sh = func;
    return this;
  }
  withFailureHandler(func) {
    this.fh = func;
    return this;
  }

  getSheetValues(range) {
    return Sheets.Spreadsheets.Values.get(spreadsheetId, range).values;
    gapi.client.sheets.spreadsheets.values.get({
  spreadsheetId: spreadsheetId,
  range: range
}).then((response) => {
  var result = response.result;
  var numRows = result.values ? result.values.length : 0;
  console.log(`${numRows} rows retrieved.`);
});
  }

  function doGet(e) {
  //  const output = 'Hello ' + userId;
  //  return ContentService.createTextOutput(output);

    setProperty("userId", e && e.parameter && e.parameter.id ? e.parameter.id : "");

    var template = HtmlService.createTemplateFromFile('Index');

    // Build and return HTML in IFRAME sandbox mode.
    return template.evaluate()
                   .setTitle('FiMs Associé')
                   .setFaviconUrl('https://raw.githubusercontent.com/flodef/FiMS/master/Img/Favicon2.png');
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

  /**
   */
  function getSheetValues(range) {
    return Sheets.Spreadsheets.Values.get(spreadsheetId, range).values;
  }

  /**
   */
  function getSheetValuesWithFilter(range, filter = userId, column = 0) {
    var content = [];
    var temp = getSheetValues(range);

    content.push(temp[0]);
    for (var i = 1; i < temp.length; ++i) {
      if (temp[i][column] == filter) {
        var filterRow = [];
        for (var j = 0; j < temp[i].length; ++j) {
          filterRow.push(temp[i][j]);
        }
        content.push(filterRow);
      }
    }

    return content;
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
