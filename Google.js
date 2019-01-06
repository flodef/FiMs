// google.script.run
//              .withSuccessHandler(function(contents) {
//                updateDashboardTable(contents);
//
//                updateInvestmentValues();  // Next step
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
    return Run;
  }
}

class Run {
  static withSuccessHandler(func) {
    this.sh = func;
    return this;
  }
  static withFailureHandler(func) {
    this.fh = func;
    return this;
  }
  static getSheetValues(range) {
    if (!this._workbook) {
      var url = "Data/Finance.xlsx";
      // var url  = "https://rawgit.com/flodef/FM/master/Data/Finance.xlsx";
      var run = this;

      fetch(url).then(function(response) {
        if(response.ok) {
          return response.arrayBuffer();
        }
        throw new Error('Network response was not ok.');
      }).then(function(buffer) {
        var data = new Uint8Array(buffer);
        run._workbook = XLSX.read(data, {type:"array"});
        run.sh(run._getData(range));
      }).catch(this.fh);
    } else {
      this.sh(this._getData(range));
    }
  }
  static setSheetValues(range, values) { this.sh(); }
  static clearSheetValues(range) { this.sh(); }
  static insertRows(sheetId, values, range) { this.sh(); }
  static deleteRows(sheetId, startIndex, endIndex) { this.sh(); }
  static sortColumn(sheetId, index, descending) { this.sh(); }

  static _getData(range) {
    var a = range.split("!");
    var sheetName = a[0];
    var sheet = this._workbook.Sheets[sheetName];
    var fullRange = sheet["!ref"];
    var r = a.length >= 2 ? a[1] : fullRange;
    var ar = r.split(':');
    var sr = ar[0];
    var er = ar[1];
    var dr = XLSX.utils.decode_range(fullRange);
    sr += !this._hasNumber(sr) ? (dr.s.r+1) : "";
    er += !this._hasNumber(er) ? (dr.e.r+1) : "";
    range = sr + ':' + er;
    var array = XLSX.utils.sheet_to_json(sheet, {header:1, raw:false, range:range, defval:""});

    return array;
  }
  static _hasNumber(string) {
    return /\d/.test(string);
  }
}
