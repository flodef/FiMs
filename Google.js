/* global XLSX */
/* exported google */

// USE EXAMPLE :
// google.script.run
//              .withSuccessHandler(function(contents) {
//                updateDashboardTable(contents);
//              })
//              .withFailureHandler(displayError)
//              .getSheetValues("Dashboard!A:B");


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

class Run {
  static #workInProgress = false;
  static #singleton;
  static #data = [];
  static #workbook;
  #sh = () => {};
  #fh = () => {};
  constructor() {
    if (!Run.#singleton) { // Run only once
      Run.#singleton = true;
      this.doGet(new URLSearchParams(location.search));
    }
  }
  withSuccessHandler(func) {
    this.#sh = func ?? (() => {});
    return this;
  }
  withFailureHandler(func) {
    this.#fh = func ?? (() => {});
    return this;
  }
  doGet(e) {
    const userId = e.get('id') ?? '';
    const isMain = userId == 'TradFi';
    const favIcon = 'Img/Favicon.png';
    const pageTitle = isMain ? 'FiMs TradFi' : 'FiMs Associate';
    const fileName = !Run.#workInProgress ? 'Index' : 'WorkInProgress';
    const spreadsheetId = isMain ? 'Data/FiMs TradFi.xlsx' : 'Data/FiMs Associate.xlsx';

    this.setProperty('userId', userId);
    this.setProperty('pageTitle', pageTitle);
    this.setProperty('spreadsheetId', spreadsheetId);

    var template = HtmlService.createTemplateFromFile(fileName);

    // Build and return HTML in IFRAME sandbox mode.
    return template.evaluate()
      .setTitle(pageTitle)
      .setFaviconUrl(favIcon);
  }
  sendRecapEmail(subject) {
    try {
      alert('Mail sent to myself !\n\nSubject = ' + subject);
    } catch (error) {
      this.#fh(error);
    }
    this.#sh();
  }
  sendEmail(recipient, subject, message, options) {
    try {
      alert('Mail sent to ' + recipient + ' !\n\nSubject = ' + subject +
        (message ? '\nMessage = ' + message : '') + (options ? '\nOptions = ' + options.htmlBody : ''));
    } catch (error) {
      this.#fh(error);
    }
    this.#sh();
  }
  getProperty(key) {
    var p;
    try {
      p = Run.#data[key];
    } catch (error) {
      this.#fh(error);
    }
    this.#sh(p);
  }
  setProperty(key, value) {
    try {
      Run.#data[key] = value;
    } catch (error) {
      this.#fh(error);
    }
    this.#sh();
  }
  async getSheetValues(range, filter, column = 0) {
    var content;
    try {
      content = await this._getSheetValues(range);
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
    } catch (e) { // Don't send error in case that the sheet asked does not exist
      content = null;
    }

    this.#sh(content);
  }

  async setSheetValues(/*range, values*/) {
    this.#sh();
  }
  async clearSheetValues(/*range*/) {
    this.#sh();
  }
  async insertRows(/*sheetId, values, range*/) {
    this.#sh();
  }
  async deleteRows(/*sheetId, startIndex, endIndex*/) {
    this.#sh();
  }
  async sortColumn(/*sheetId, index, descending*/) {
    this.#sh();
  }

  async _getSheetValues(range) {
    if (!Run.#workbook) {
      await fetch(Run.#data['spreadsheetId'])
        .then((response) => {
          if (response.ok) {
            return response.arrayBuffer();
          }
          throw new Error('Network response was not ok.');
        }).then((buffer) => {
          var data = new Uint8Array(buffer);
          Run.#workbook = XLSX.read(data, {
            type: 'array'
          });
        }).catch(this.#fh);
    }

    await new Promise(r => setTimeout(r, 2000)); // Simulate loading data on spreadsheet

    return this._getData(range);
  }

  _getData(range) {
    var a = range.split('!');
    var sheetName = a[0];
    var sheet = Run.#workbook.Sheets[sheetName];
    if (sheet) {
      var fullRange = sheet['!ref'];
      var r = a.length >= 2 ? a[1] : fullRange;
      var ar = r.split(':');
      var sr = ar[0];
      var er = ar[1] || ar[0]; // Set the starting range as the ending range if none (eg : sheet!A1)
      var dr = XLSX.utils.decode_range(fullRange);
      sr += !this._hasNumber(sr) ? (dr.s.r + 1) : '';
      er += !this._hasNumber(er) ? (dr.e.r + 1) : '';
      range = sr + ':' + er;
      var array = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        range: range,
        defval: ''
      });

      return array;
    } else {
      return null;
    }
  }
  _hasNumber(string) {
    return /\d/.test(string);
  }
}

class HtmlService {
  static createTemplateFromFile() {
    return new Template();
  }
}

class Template {
  evaluate() {
    // SET HERE ALL THE STUFF RELATIVE TO GOOGLE APP SCRIPT INIT
    // var url = document.URL.split('/');
    // window.history.pushState('', '', url[url.length-1].split('?')[0]);   // Reset passed value to simulate google server behavior
    return this;
  }
  setTitle(title) {
    document.title = title;
    return this;
  }
  setFaviconUrl(url) {
    var link = document.querySelector('link[rel*=\'icon\']') || document.createElement('link');
    link.type = 'image/png';
    link.rel = 'icon';
    link.href = url;
    document.head.appendChild(link);
    return this;
  }
}
