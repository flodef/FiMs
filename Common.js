/**
* Functions that are shared between main app and associate app.
*/

window.GLOBAL = {};
GLOBAL.data = [];
GLOBAL.formula = [];
GLOBAL.loadingQueueCount = 0;
GLOBAL.hasAlreadyUpdated = [];
GLOBAL.currentLoadingId;
GLOBAL.currentDisplayedId;

function animateLoaderBar() {
  $("#loaderBar").prop("innerHTML", "<span></span>");
  $("#loaderBar > span")
      .data("origWidth", $("#loaderBar > span").width())
      .width(0)
      .animate({width: $("#loaderBar > span").data("origWidth")}, 3000);
}

function openTab(id, isFirstLoading) {
  if (GLOBAL.currentDisplayedId != id) {
    GLOBAL.currentDisplayedId = id;
    GLOBAL.displayId.forEach(id => displayElement("#" + id + "Div", false, 0)); // Hide all tab content
    // $(".tabLinks").each((i, item) => $(item).removeClass("active"));            // Remove the class "active" from all tabLinks"
    $(".tabLinks").removeClass("active");                                       // Remove the class "active" from all tabLinks"
    displayElement("#" + id + "Div", true);                                     // Show the current tab
    $("#" + id + "Button").addClass("active");                                  // Add an "active" class to the button that opened the tab

    if (!isFirstLoading) {
      updateValues(id);
    }
  }
}

function updateAllValues() {
  GLOBAL.displayId.forEach(id => updateValues(id, true));
}

function updateValues(id, forceReload, success) {
  getValue(GLOBAL.formula[id], updateTable, id, forceReload, success);
}

function applyFilter(id, tableHTML) {
  setTable(id, tableHTML);
  activateButton(id);
  // sorttable.makeSortable($("#" + id + "Table").get(0));
  filterTable(id);
}

function getTableEditableCell(id, contents, index, range, precision, min, max) {
  return getTableReadOnlyContent(contents[index-1][0], false)
       + getTableEditableContent(id, contents[index-1][1], range, precision, min, max);
}

function getTableValidatableCell(id, contents, index, range, expected) {
  return getTableReadOnlyContent(contents[index-1][0], false)
       + getTableValidatableContent(id, contents[index-1][1], range, expected);
}

function getTableReadOnlyCell(contents, index) {
  return getTableReadOnlyContent(contents[index-1][0], false)
       + getTableReadOnlyContent(contents[index-1][1], false);
}

function getTableReadOnlyContent(content = "", isHeader, isDisabled, color) {
  var matches = /\(([^)]+)\)/.exec(content);
  var value = matches ? matches[matches.length-1] : content;
  var isCur = /(€|%|\$)/.test(value);
  var color = getColor(value, isDisabled, isCur, color);
  return isHeader ? '<th align="center">' + content + '</th>'
                  : '<td align="center" style="color:' + color + '">' + content + '</td>';
}

function getTableEditableContent(id, content, range, precision, min, max) {
  return '<td align="center"><input class="auto" min="' + min + '" max="' + max + '"'
       + getEditCellHandler(id, range, toValue(content), precision) + '"> €</input></td>';
}

function getTableValidatableContent(id, content, range, expected) {
  return '<td class="validateContent" align="center" style="font-style:italic;background-color:'
       + (!expected ||content == expected ? 'transparent' : 'pink') + '">'
       + '<div style="position:relative"><span>' + content + '</span>'
       + '<div style="position:absolute;left:35%;top:50%;" class="checkmark" value="' + toValue(content) + '"'
       + 'onclick="if(!$(this).hasClass(\'draw\')) { ' + getUpdateContent(id, range, GLOBAL.dummy) + ' }">'
       + '</div></div></td>';
}

function getEditCellHandler(id, range, expected, precision = 0) {
  return ' onfocusout="' + getUpdateContent(id, range, expected) + '"'
       + ' onkeyup="if (event.keyCode == 13) { $(this).blur() } else if (event.keyCode == 27) { this.value = \'' + expected + '\'; } autoAdaptWidth(this, ' + precision + ');"'
       + ' oninput="autoAdaptWidth(this, ' + precision + ');" type="text" value="' + expected + '"'
}

function getUpdateContent(id, range, expected) {
  return 'if (this.value != \'' + expected + '\') '
       + '{ setValue(\'' + range + '\', [[this.value || this.getAttribute(\'value\')]]'
       + (id ? id  != GLOBAL.settings ? ', () => updateValues(\'' + id + '\', true)'
       : ', () => getValue(GLOBAL.settingsFormula, null, GLOBAL.settings, true, updateAllValues)'
       : '') + '); }';
}

function getSubTableTitle(id, title, range) {
  return '<tr><td colspan="10"><input class="tableTitle auto" max="30" style="font-size:16px;"'
       + getEditCellHandler(id, range, title) + '"></input></td></tr>';
}

function getTitle(id) {
  return '<button disabled id="' + id + 'Button" class="tabLinks" onclick="openTab(\'' + id + '\')">'
        + id.charAt(0).toUpperCase() + id.slice(1) + '</button>';
}

function getTableTitle(id, disabled, tooltip, colspan) {
  return '<table id="' + id + 'Content" class="tabContent"><tr style="background-color:white"><td><table style="border:0px;padding:0px;width:auto">'
       + '<tr style="background-color:white;"><td></td>'
       + (false ? '<td id="' + id + 'Switch" class="mainSwitch '
       + ($("#" + id + "Switch").is(":visible") ? '' : 'hidden') + '">'
       + '<div class="tooltip"><label class="switch" style="border:30px;margin:7px 0px 0px 0px;">'
       + '<input id="' + id + 'Filter" type="checkbox" ' + ($('#' + id + 'Filter').is(':checked') ? 'checked' : '')
       + ' onclick="filterTable(\'' + id + '\', true)">'
       + '<div class="slider round"></div></label><span class="tooltiptext">' + tooltip + '</span></div></td></tr></table>'
       + '<td colspan="' + colspan + '" align="right">'
       + '<input id="' + id + 'Search" type="text" placeholder="Search" class="mainSearch '
       + ($("#" + id + "Search").is(":visible") ? '' : 'hidden') + '" '
       + 'onkeyup="filterTable(\'' + id + '\');" onchange="filterTable(\'' + id + '\');"'
       + 'value="' + ($('#' + id + 'Search').val() || "") + '">' : '')
       + '</tr></table>' + getMainTableHead(id);
}

function getMainTableHead(id) {
  return '<table id="' + id + 'Table" class="sortable mainTable">';
}

// function getTitle(id, disabled) {
//   return '<h2'
//         + (!disabled ? ' onclick="var shouldDisplay = !$(\'#' + id + 'Table\').is(\':visible\');'
//         + 'if(shouldDisplay){updateValues(\'' + id + '\');};'
//         + 'for (suffix of [\'Table\', \'Switch\', \'Search\']) {'
//         + '$(\'.main\' + suffix).each((i, item) => toggleItem(\'' + id + '\' + suffix, item, shouldDisplay)); }"' : '')
//         + '>' + id.charAt(0).toUpperCase() + id.slice(1) + '</h2>';
// }

// function getTableTitle(id, disabled, tooltip, colspan) {
//   return '<table><tr style="background-color:white"><td><table style="border:0px;padding:0px;width:auto">'
//        + '<tr style="background-color:white;"><td>' + getTitle(id, disabled) + '</td>'
//        + (false ? '<td id="' + id + 'Switch" class="mainSwitch '
//        + ($("#" + id + "Switch").is(":visible") ? '' : 'hidden') + '">'
//        + '<div class="tooltip"><label class="switch" style="border:30px;margin:7px 0px 0px 0px;">'
//        + '<input id="' + id + 'Filter" type="checkbox" ' + ($('#' + id + 'Filter').is(':checked') ? 'checked' : '')
//        + ' onclick="filterTable(\'' + id + '\', true)">'
//        + '<div class="slider round"></div></label><span class="tooltiptext">' + tooltip + '</span></div></td></tr></table>'
//        + '<td colspan="' + colspan + '" align="right">'
//        + '<input id="' + id + 'Search" type="text" placeholder="Search" class="mainSearch '
//        + ($("#" + id + "Search").is(":visible") ? '' : 'hidden') + '" '
//        + 'onkeyup="filterTable(\'' + id + '\');" onchange="filterTable(\'' + id + '\');"'
//        + 'value="' + ($('#' + id + 'Search').val() || "") + '">' : '')
//        + '</tr></table>' + getMainTableHead(id);
// }

// function getMainTableHead(id) {
//   return '<table id="' + id + 'Table" class="sortable mainTable '
//        + ($("#" + id + "Table").is(":visible") ? '' : 'hidden') + '">';
// }

function getColor(value, isDisabled = false, isCur = true, forcedColor) {
  var number = toValue(value);
  return forcedColor ? forcedColor
                     : isDisabled || (!isNaN(number) && number == 0) ? "wheat"
                     : isCur ? number > 0 ? "green" : "red"
                     : "black";
}

function setTable(id, tableHTML) {
  tableHTML += '</table>';
  $("#" + id + "Div").prop("innerHTML", tableHTML);
}

function setEvents() {
  $(".auto").each((i, item) => autoAdaptWidth(item, 3));

  $(".checkmark")
    .on("click", e => $(e.target).addClass('draw'))
    .on("animationend", e => $(e.target).removeClass('draw'));

  $(".validateContent").hover(
    e => { var c = $(e.target).children().children(); c.first().fadeOut(); c.last().fadeIn(); },
    e => { var c = $(e.target).children().children(); c.last().fadeOut(); c.first().fadeIn(); });
}

function setTabContainer(innerHTML) {
  $("#tabContainer").prop("innerHTML", innerHTML);  // Set the tab buttons content
  $(".tabLinks").css("width", 100/GLOBAL.displayId.length + "%");   // Tab buttons should be centered
}

function toggleItem(id, item, shouldDisplay) {
  var isCurrentId = item.id == id;
  var shouldDisplay = shouldDisplay && isCurrentId;
  displayElement(item, shouldDisplay, isCurrentId ? 1000 : 0)
}

function autoAdaptWidth(e, precision = 0) {
  var size = e.style.fontSize ? e.style.fontSize : "13.33px";
  var step = parseFloat(size)/1.8;
  var index = 1;

  // Filter the entered value through a regular expression if it's a number
  if (e.max && e.min) {
    var maxLength = Math.max(String(e.min).length, String(e.max).length) + precision;
    var val = parseFloat(e.value);
    var patt = new RegExp("^" + (e.min < 0 ? e.max < 0 ? "-+" : "-?" : "") + "([0-9]*$"
      + (precision > 0 ? "|[0-9]+\\.?[0-9]{0," + precision + "}$" : "") + ")");
    while (e.value && (!patt.test(e.value) ||
      (!isNaN(val) && (val > e.max || val < e.min || val * Math.pow(10, precision) % 1 !== 0 || String(e.value).length > maxLength)))) {
      e.value = e.value.slice(0, -1);
      var val = parseFloat(e.value);
    }
  } else if (e.max) {
    var patt = new RegExp("^\\w{0," + e.max+ "}$");
    while (e.value && !patt.test(e.value)) {
      e.value = e.value.slice(0, -1);
    }
  }

  e.style.width = Math.ceil(Math.max(String(e.value).length, 1) * step + index) + "px";
}

function selectName(e, index) {
  if (index !== undefined) {
    $('#transactionName').prop("selectedIndex", index);
  } else {
    index = e.selectedIndex;
  }

  displayElement("#transactionQuantityLabel", e.options[index].title);
}

function getValue(range, func, id, forceReload, success) {
  if (!id || (id && $("#loading").text() == "")) {
    if (!id || forceReload || !GLOBAL.hasAlreadyUpdated[id]) {
      displayLoading(id, true);

      google.script.run
                   .withSuccessHandler(contents => {
                     if (id) {
                       GLOBAL.data[id] = contents;
                     }
                     if (func) {
                       func(id, contents);
                     }
                     if (success) {
                       success();
                     }
                     displayLoading(id, false);

                     if (id && !GLOBAL.loadingQueueCount) {
                       setEvents();  // Set events when everything has been loaded

                       if (GLOBAL.currentDisplayedId != id) {
                         updateValues(GLOBAL.currentDisplayedId, true);   // Refresh current displayed tab if displayed before events has been set
                       }
                     }
                   })
                   .withFailureHandler(displayError)
                   .getSheetValues(range);
    }
  } else {
    ++GLOBAL.loadingQueueCount;
    setTimeout(() => {
      GLOBAL.loadingQueueCount = Math.max(GLOBAL.loadingQueueCount-1, 0);
      getValue(range, func, id, forceReload, success)
    }, 100);
  }
}

function setValue(range, value, success) {
  google.script.run
               .withSuccessHandler(contents => { if (success) { success(); } showSnackBar("Value has been updated !"); })
               .withFailureHandler(displayError)
               .setSheetValues(range, value);
}

function filterTable(id, shouldReload) {
  var isChecked = $("#" + id + "Filter").is(':checked');
  var search = $('#' + id + 'Search').val() ? $('#' + id + 'Search').val().toUpperCase() : "";
  var index = id == GLOBAL.historic ? 2 : 0;
  var searchFunc = item => $(item).children("td")[index] && $(item).children("td")[index].innerHTML.toUpperCase().includes(search);
  var filterFunc = id == GLOBAL.investment ? (i, item) => (!isChecked || shouldRebalance($(item).children("td")[6] ? $(item).children("td")[6].innerHTML : null)) && searchFunc(item)
                 : id == GLOBAL.historic || id == GLOBAL.evolution ? (i, item) => (isChecked || i < GLOBAL.dataPreloadRowLimit) && searchFunc(item)
                 : (i, item) => true;
  var displayFunc = (i, item) => { var fn = filterFunc(i, item) ? a => $(a).show() : a => $(a).hide(); fn(item); };
  var loadFunc = (id == GLOBAL.historic || id == GLOBAL.evolution) && shouldReload && isChecked
  ? null
  : null;

  // $("#" + id + "Table tbody tr").each(displayFunc);

  refreshTotal(id);
}

function refreshTotal(id) {
  if (id == GLOBAL.historic) {
    var calculateFunc = (i, item) => {
      item = $(item).children("td");
      for (var j = 0; j < item.length; ++j) {
        a[j] += j == 0 ? 1
              : j == 1 ? item[5].innerHTML ? 1 : 0
              : j == 2 ? item[7].innerHTML ? 1 : 0
              : j == 3 ? item[8].innerHTML ? 1 : 0
              : toValue(item[j].innerHTML);
      }
    };
    var footerFunc = () =>
      '<td colspan="3" align="center">' + a[0] + ' rows</td>'
       + '<td>' + a[4].toFixed(0) + '</td>'
       + '<td>' + toCurrency(a[5]/a[1]) + '</td>'
       + '<td title="' + toCurrency(a[6]/a[0]) + '">' + toCurrency(a[6]) + '</td>'
       + '<td title="' + toCurrency(a[7]/a[2]) + '">' + toCurrency(a[7]) + '</td>'
       + '<td title="' + toCurrency(a[8]/a[3]) + '">' + toCurrency(a[8]) + '</td>';
  } else if (id == GLOBAL.evolution) {
    var calculateFunc = (i, item) => {
      item = $(item).children("td");
      for (var j = 0; j < item.length; ++j) {
        a[j] += j == 0 ? 1 : toValue(item[j].innerHTML);
      }
    };
    var footerFunc = () => {
      var footer = "";
      for (var i = 1; i < a.length; i++) {
        footer += '<td>' + toCurrency(a[i]/a[0], 2, i < 5 ? '%' :'€') + '</td>';
      }
      return footer;
    }
  }

  if (calculateFunc) {
    var max = !$('#' + id + 'Filter').is(':checked')
      ? GLOBAL.dataPreloadRowLimit : $("#" + id + "Table tbody tr").length;
    var elem = $("#" + id + "Table tbody tr:visible").length == 0
             ? $("#" + id + "Table tbody tr:lt(" + max + ")")
             : $("#" + id + "Table tbody tr:visible");
    var a = new Array(elem.length).fill(0);
    elem.each(calculateFunc);
    $("#" + id + "Footer").prop("innerHTML", '<td>TOTAL</td>' + footerFunc());
  }
}

function showSnackBar(text) {
  if (text) {
    $("#snackbar").text(text);
  }

  // Shows the snackbar only if has text and is not already displayed
  if ($("#snackbar").text() && !$("#snackbar").hasClass("show")) {
    $("#snackbar").addClass("show");

    // After 3 seconds, remove the show class from DIV
    setTimeout(() => { $("#snackbar").removeClass("show"); $("#snackbar").text(""); }, 3000);
  }
}

function displayLoading(id, isDisplayed) {
  if (id) {
    GLOBAL.currentLoadingId = isDisplayed ? id : null;
    $("#loading").text(isDisplayed ? "Loading " + id + " ..." : null);
    if (isDisplayed || GLOBAL.loadingQueueCount) {
      GLOBAL.hasAlreadyUpdated[id] = true;
      setTimeout(() => GLOBAL.hasAlreadyUpdated[id] = false, GLOBAL.timeBetweenReload*1000);
      displayElement("#updateButton", false);
    } else {
      setTimeout(() => displayElement("#updateButton", !GLOBAL.loadingQueueCount), 100);  // Hack for local refresh because it loads everything in the same function
    }
  }
}

function displayElement(id, isDisplayed, duration = "slow", complete) {
  var fn = isDisplayed
    ? () => $(id).fadeIn(duration, complete)
    : () => $(id).fadeOut(duration, complete);
  fn();
}

function overDisplay(idToHide, idToShow, complete) {
  displayElement(idToHide, false, () => displayElement(idToShow, true, complete));
}

function showLoader(isDisplayed) {
  displayElement('#loaderOverlay', isDisplayed);
  $('.contentOverlay').fadeTo(1000, isDisplayed ? 0.3 : 1);
}

function executionSuccess() {
  // updateAllValues();
  showLoader(false);
  cancelForm();
  showSnackBar();
}

function displayError(msg, isWarning) {
  showLoader(false);
  displayLoading(GLOBAL.currentLoadingId, false);

  $("#alert").css("background-color", isWarning ? "#ff9800" : "#f44336");
  $("#alert").prop("innerHTML", '<span class="closebtn" onclick="displayElement(\'#alertOverlay\', false, () => $(\'#transactionName\').focus());">&times;</span>'
                              + '<strong>' + (isWarning ? "WARNING" : "ALERT") + ':</strong> ' + msg);
  displayElement('#alertOverlay', true);
  displayElement("#updateButton", true);
}

function activateButton(id, isActivated = true) {
  $("#" + id + "Button").prop('disabled', !isActivated);
}

function shouldRebalance(value) {
  return value && !value.startsWith("HOLD");
}

function toValue(content) {
  return content ? parseFloat(String(content).replace(",", "")
                                             .replace(" ", "")
                                             .replace("$", "")
                                             .replace("€", "")
                                             .replace("%", ""))
                 : 0;
}

function toCurrency(content, precision = 2, symbol = '€') {
  var str = String(toValue(content));
  var ln = str.length;
  var neg = str.startsWith("-") ? -1 : 0;
  var i = str.indexOf(".") != -1 ? str.indexOf(".") : ln;
  str = i != ln ? str.slice(0, i+precision+1).replace(/0+$/g, '') : str + ".";
  var j = str.length-str.indexOf(".")-1;
  str = (j < 2 ? str + '0'.repeat(2-j) : str) + " " + symbol;

  return i + neg > 9 ? str.slice(0, i-9) + "," + str.slice(i-9, i-6) + "," + str.slice(i-6, i-3) + "," + str.slice(i-3)
       : i + neg > 6 ? str.slice(0, i-6) + "," + str.slice(i-6, i-3) + "," + str.slice(i-3)
       : i + neg > 3 ? str.slice(0, i-3) + "," + str.slice(i-3)
       : str;
}

function toStringDate(date) {
  if (typeof(date) == "string") {
    return date && date.split("/").length == 3
    ? date.replace(/(^|\/)0+/g, "$1").split("/")[1] + "/"
    + date.replace(/(^|\/)0+/g, "$1").split("/")[0] + "/"
    + date.split("/")[2]
    : null;
  } else if (typeof(date) == "object") {
    var day = date.getDate();
    var month = date.getMonth() + 1;   //January is 0!
    var year = date.getFullYear();
    day = day < 10 ? '0' + day : day;
    month = month < 10 ? '0' + month : month;
    return month + "/" + day + "/" + year;
  } else {
    return toStringDate(new Date());
  }
}

function indexOf(array, value, index, start, compare) {
  var index = index >= 0 ? index : null;
  var x = Number.isInteger(start) ? start : 0;
  var fn = compare ? compare : (a, b) => a == b;

  var i;
  if (Array.isArray(array)) {
    while(x < array.length
       && ((index == null && !fn(array[x], value))
        || (index != null && !fn(array[x][index], value)))) { ++x; }

    i = x < array.length ? x : null;
  }

  return i;
}

function restrainFormula(formula, low, high) {
  formula = formula.replace(/\d+/g, '');
  if (low != -1 && high != -1) {
    var a = formula.split(':');
    a[0] += low > 1 ? low : 1;
    a[1] += high > 1 ? high : GLOBAL.dataPreloadRowLimit+1;
    formula = a[0] + ':' + a[1];
  }

  return formula;
}

function roundDown(value, precision = 0) {
  return (value * Math.pow(10, precision) | 0) / Math.pow(10, precision);
}
