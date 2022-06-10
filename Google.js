/* global XLSX */
/* exported google, getProperty */

// USE EXAMPLE :
// google.script.run
//              .withSuccessHandler(function(contents) {
//                updateDashboardTable(contents);
//              })
//              .withFailureHandler(displayError)
//              .getSheetValues("Dashboard!A:B");

const workInProgress = false;
const favIcon = "Img/Image/Favicon.png";

function doGet(e) {
  let fileName, pageTitle;

  if (!workInProgress) {
    const project = {
      TradFi: "TradFi",
      Pay: "Pay",
      Associate: "Associate",
      // DeFi:"Defi"  // Not implemented yet
    };
    const userId = getUrlParams(e, "id");
    const currentProject =
      userId == project.TradFi
        ? project.TradFi
        : userId && !isNaN(userId)
          ? project.Pay
          : project.Associate;
    const spreadsheetId = getSpreadsheetId(currentProject);

    fileName = "Index";
    pageTitle = "FiMs " + currentProject;

    setProperty("userId", userId);
    setProperty("pageTitle", pageTitle);
    setProperty("spreadsheetId", spreadsheetId);
  } else {
    fileName = "WorkInProgress";
    pageTitle = fileName;
  }

  var template = HtmlService.createTemplateFromFile(fileName);

  // Build and return HTML in IFRAME sandbox mode.
  return template.evaluate().setTitle(pageTitle).setFaviconUrl(favIcon);
}

function getUrlParams(e, param) {
  return e.get(param);
}

function getSpreadsheetId(currentProject) {
  return "Data/FiMs " + currentProject + ".xlsx";
}

function setProperty(key, value) {
  property[key] = value;
}

function getProperty(key) {
  return property[key];
}

class google {
  static get script() {
    return Script;
  }
}

class Script {
  static #singleton;
  static get run() {
    if (!Script.#singleton) {
      Script.#singleton = new Run();
    }
    return Script.#singleton;
  }
}

let property = [];

class Run {
  #workbook;
  #sh = () => {};
  #fh = () => {};
  constructor() {
    doGet(new URLSearchParams(location.search));
  }
  withSuccessHandler(func) {
    this.#sh = func ?? (() => {});
    return this;
  }
  withFailureHandler(func) {
    this.#fh = func ?? (() => {});
    return this;
  }
  getProperty(key) {
    let p;
    try {
      p = getProperty(key);
    } catch (error) {
      this.#fh(error);
    }
    this.#sh(p);
  }
  setProperty(key, value) {
    try {
      setProperty(key, value);
    } catch (error) {
      this.#fh(error);
    }
    this.#sh();
  }
  sendRecapEmail(subject) {
    try {
      alert("Mail sent to myself !\n\nSubject = " + subject);
    } catch (error) {
      this.#fh(error);
    }
    this.#sh();
  }
  sendEmail(recipient, subject, message, options) {
    try {
      alert(
        "Mail sent to " +
          recipient +
          " !\n\nSubject = " +
          subject +
          (message ? "\nMessage = " + message : "") +
          (options ? "\nOptions = " + options.htmlBody : "")
      );
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
    } catch (e) {
      // Don't send error in case that the sheet asked does not exist
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
    if (!this.#workbook) {
      await fetch(property["spreadsheetId"])
        .then((response) => {
          if (response.ok) {
            return response.arrayBuffer();
          }
          throw new Error("Network response was not ok.");
        })
        .then((buffer) => {
          const data = new Uint8Array(buffer);
          this.#workbook = XLSX.read(data, {
            type: "array",
          });
        })
        .catch(this.#fh);
    }

    await new Promise((r) => setTimeout(r, 2000)); // Simulate loading data on spreadsheet

    return this._getData(range);
  }

  _getData(range) {
    var a = range.split("!");
    var sheetName = a[0];
    var sheet = this.#workbook.Sheets[sheetName];
    if (sheet) {
      var fullRange = sheet["!ref"];
      var r = a.length >= 2 ? a[1] : fullRange;
      var ar = r.split(":");
      var sr = ar[0];
      var er = ar[1] || ar[0]; // Set the starting range as the ending range if none (eg : sheet!A1)
      var dr = XLSX.utils.decode_range(fullRange);
      sr += !this._hasNumber(sr) ? dr.s.r + 1 : "";
      er += !this._hasNumber(er) ? dr.e.r + 1 : "";
      range = sr + ":" + er;
      var array = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        range: range,
        defval: "",
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
    var link =
      document.querySelector("link[rel*='icon']") ||
      document.createElement("link");
    link.type = "image/png";
    link.rel = "icon";
    link.href = url;
    document.head.appendChild(link);
    return this;
  }
}
