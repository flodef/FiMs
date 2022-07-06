/* global XLSX */
/* exported google, getProperty */

// USE EXAMPLE :
// google.script.run
//              .withSuccessHandler(function(contents) {
//                updateDashboardTable(contents);
//              })
//              .withFailureHandler(displayError)
//              .getSheetValues("Dashboard!A:B");

const loadingDataSimulation = 0; // Simulation to fake loading data

const workInProgress = false;
const favIcon = "Img/Image/Favicon.png";

function doGet(e) {
  let fileName, pageTitle;

  if (!workInProgress) {
    const app = getUrlParams(e, "app");
    const userId = getUrlParams(e, "id");
    const project = ["Associate", "TradFi", "Pay", "Defi"];
    const currentProject = project.includes(app) ? app : project[0];
    const spreadsheetId = getSpreadsheetId(currentProject);

    setProperty("userId", userId);
    setProperty("pageTitle", pageTitle);
    setProperty("spreadsheetId", spreadsheetId);

    fileName = "Index";
    pageTitle = "FiMs " + currentProject;
  } else {
    fileName = "WorkInProgress";
    pageTitle = fileName;
  }

  const template = HtmlService.createTemplateFromFile(fileName);

  // Build and return HTML in IFRAME sandbox mode.
  return template.evaluate().setTitle(pageTitle).setFaviconUrl(favIcon);
}

// WARNING : THESE PRIVATE FUNCTIONS ARE NOT MEANT TO BE CALLED DIRECTLY
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
// WARNING : THESE PRIVATE FUNCTIONS ARE NOT MEANT TO BE CALLED DIRECTLY

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

let property = [];

class Run {
  static #loaded = false;
  #sh = () => {};
  #fh = () => {};
  constructor() {
    if (!Run.#loaded) {
      Run.#loaded = true;
      doGet(new URLSearchParams(location.search));
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
  getProperty(key) {
    let p;
    try {
      p = getProperty(key);
      this.#sh(p);
    } catch (error) {
      this.#fh(error);
    }
  }
  setProperty(key, value) {
    try {
      setProperty(key, value);
      this.#sh();
    } catch (error) {
      this.#fh(error);
    }
  }
  sendRecapEmail(subject) {
    try {
      alert("Mail sent to myself !\n\nSubject = " + subject);
      this.#sh();
    } catch (error) {
      this.#fh(error);
    }
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
      this.#sh();
    } catch (error) {
      this.#fh(error);
    }
  }
  async getSheetValues(range, filter, column = 0) {
    try {
      if (loadingDataSimulation > 0) {
        await new Promise((r) => setTimeout(r, loadingDataSimulation)); // Simulate loading data on spreadsheet
      }

      const spreadsheetId = property["spreadsheetId"];
      await fetch(spreadsheetId)
        .then((response) => {
          if (response.ok) {
            return response.arrayBuffer();
          }
          throw new Error("Invalid spreadsheet: " + spreadsheetId);
        })
        .then((buffer) => {
          const data = new Uint8Array(buffer);
          return XLSX.read(data, {
            type: "array",
          });
        })
        .then((data) => {
          let content = this._getData(data, range);
          if (filter) {
            const temp = content;
            content = [temp[0]];
            for (let i = 1; i < temp.length; ++i) {
              if (temp[i][column] == filter) {
                content.push(temp[i]);
              }
            }
          }
          this.#sh(content);
        })
        .catch(this.#fh);
    } catch (e) {
      // Don't send error in case that the sheet asked does not exist
    }
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

  _getData(data, range) {
    const a = range.split("!");
    const sheetName = a[0];
    const sheet = data.Sheets[sheetName];
    if (sheet) {
      const fullRange = sheet["!ref"];
      const r = a.length >= 2 ? a[1] : fullRange;
      const ar = r.split(":");
      let sr = ar[0];
      let er = ar[1] || ar[0]; // Set the starting range as the ending range if none (eg : sheet!A1)
      const dr = XLSX.utils.decode_range(fullRange);
      sr += !this._hasNumber(sr) ? dr.s.r + 1 : "";
      er += !this._hasNumber(er) ? dr.e.r + 1 : "";
      range = sr + ":" + er;
      const array = XLSX.utils.sheet_to_json(sheet, {
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
    // const url = document.URL.split('/');
    // window.history.pushState('', '', url[url.length-1].split('?')[0]);   // Reset passed value to simulate google server behavior
    return this;
  }
  setTitle(title) {
    document.title = title;
    return this;
  }
  setFaviconUrl(url) {
    const link = document.querySelector("link[rel*='icon']") || document.createElement("link");
    link.type = "image/png";
    link.rel = "icon";
    link.href = url;
    document.head.appendChild(link);
    return this;
  }
}
