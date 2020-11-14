  GLOBAL.account = "account";
  GLOBAL.personal = "personal";
  GLOBAL.faq = "FAQ";
  GLOBAL.faqFormula = "FAQ!A:B";
  GLOBAL.displayId = [GLOBAL.faq];
  GLOBAL.displayFormula = [GLOBAL.faqFormula];
  GLOBAL.userId;

//THIS PAGE SHORTENED URL : https://bit.ly/3eiucSP

  /**
   * Run initializations on web app load.
   */
  $(() => {
    init();

    updateAllValues();

    GLOBAL.userId = new URLSearchParams(location.search).get("id") ?? "";

    google.script.run
                 .withSuccessHandler(contents => { alert(contents); })
                 .withFailureHandler(displayError)
                 .getUserId();

     google.script.run
                  .withSuccessHandler(contents => { alert(contents); })
                  .withFailureHandler(displayError)
                  .setUserId("Toto");
  });

  function onKeyUp(e) {}

  function updateTable(id, contents) {
    var fn = id == GLOBAL.account ? () => updateAccountTable(id, contents)
           : id == GLOBAL.personal ? () => updatePersonalTable(id, contents)
           : id == GLOBAL.faq ? () => updateFaqTable(id, contents)
           : displayError("Update table id not recognised: " + id, false);
    fn();
  }

  function updateFaqTable(id, contents) {
    var isFirstLoading = $("#" + id + "Button").prop('disabled');

    var row = contents.length;
    var col = contents[0].length;
    var tableHTML = getTableTitle(id, false, GLOBAL.showAllButtonToolTip, col-1);
    tableHTML += '<div style="padding: 5px 25px;">';
    for (var i = 1; i < row; ++i) {     // Skip the header
      for (var j = 0; j < col; ++j) {
        var con = contents[i][j];
        var isQuestion = j == 0;
        var str = '';
        con.split(' ').forEach(a => str += (a.slice(0, 4) == 'http' ? '<a href=' + a +  ' target="_blank">' + a + '</a>' : a) + ' ');
        tableHTML += (isQuestion ? '<b>' : '') + str + (isQuestion ? '</b>' : '') + '<br>';
      }
      tableHTML += '<br><br>';
    }
    tableHTML += '</div>';

    setTable(id, tableHTML);
    activateButton(id);

    if (isFirstLoading) {
      displayElement("#loaderBar", false, 0); // Hide the loader bar
      openTab(id, true);                      // Activate first tab as open by default
      displayElement("#connectButton", true); // Show the connect button
    }
  }

  function connect() {
    var closing = 'displayElement(\'#popupOverlay\', false, () => { $(\'.contentOverlay\').removeClass(\'blur-filter\');$(\'#mainFocus\').focus(); });';

    // var innerHTML = '<span class="closebtn" onclick="' + closing + '">&times;</span>';
    var innerHTML = '<div align="center" style="margin:15px 0px 0px 0px;">'
      + '<h2 style="cursor:default">Veuillez saisir votre identifiant :</h2>'
      + '<div class="tooltip">'
      + '<input id="userId" size="10" minlength="3" maxLength="10" placeholder="Identifiant"'
      + getEditCellHandler(GLOBAL.userId) + ' style="width:104px;text-align:center">'
      + '<span class="tooltiptext">Echap pour effacer la saisie<br>Entrée pour valider</span></div>'
      + '<br><br><button id="userIdButton" style="margin:0px 5px 0px 5px; width:62px" onclick="setId()"></button>'
      + '</div>';
    // for (var i = 0; i < contents.length; i++) {
    //   tableHTML += '<div ' + (i != 0 ? 'class="hidden"' : '') + 'id="rebal' + i + '">';
    //   tableHTML += '<table>';
    //
    //   var row = Object.entries(contents[i]);
    //   for (const [key, value] of row) {
    //       tableHTML += '<tr>';
    //
    //       var style = key == "Name" || key == "Rebalance" || (key == "Tendency" && shouldRebalance(value))
    //                 ? 'font-weight:900;' : '';
    //       style += key == "Action"
    //                       ? 'background-color:' + (value ? "#a2c642" : "#da4a4a") + ';color:white;"'
    //                       : '';
    //       var val = key == "Action" ? (value ? "BUY" : "SELL") : value;
    //       tableHTML += '<th align="center">' + key + '</th>'
    //                  + '<td align="center" style="' + style + '" padding="10px">' + val + '</td>'
    //
    //       tableHTML += '</tr>';
    //   }
    //
    //   tableHTML += '</table>';
    //
    //   var isLast = i == contents.length-1;
    //   var skiping = 'overDisplay(\'#rebal' + i + '\', \'#rebal' + (i+1) + '\');';
    //   var next = isLast ? closing : skiping;
    //   var label = isLast ? "CLOSE" : "NEXT ORDER";
    //   tableHTML += '<div align="center" style="margin:15px 0px 0px 0px;">'
    //              + '<button style="margin:0px 5px 0px 5px;" onclick="' + next + '" class="rebalButton">' + label + '</button>'
    //              + '</div>';
    //
    //   tableHTML += '</div>';
    // }

    openPopup(innerHTML);

    $("#userId").keyup((event) => { if (event.keyCode == 13) { setId(); } $("#userIdButton").html($("#userId").val() ? "OK" : "CANCEL") });
    $("#userId").keyup();
    $("#userId").focus();
  }

  function setId() {
    GLOBAL.userId = $("#userId").val();
    window.history.pushState('', '', GLOBAL.userId ? '?id=' + GLOBAL.userId : '');
    closePopup();
  }

  // function updateDashboardTable(id, contents) {
  //   var settings = GLOBAL.data[GLOBAL.settings];
  //   var tableHTML = getTableTitle(id);
  //
  //   var isFirstLoading = $("#" + id + "Button").prop('disabled');
  //
  //   // Set the dashboard table
  //   var allocation = contents[indexOf(contents, GLOBAL.requestedAllocation, 0)][1];   // Requested allocation
  //   var ln = settings.length/2;      // Take the full sheet row count, don't count the miror with numbers (/2)
  //   for (var i = 0; i < ln-2; i++) { // Remove the two last row for scroll (-2)
  //     tableHTML += getSubTableTitle(GLOBAL.settings, settings[i][0], "Settings!A" + (i+1));
  //     tableHTML += '<tr>';
  //     for (var j = 1; j < settings[i].length; j++) {
  //       tableHTML += i != 4 || j != 3
  //       ? getTableReadOnlyCell(contents, settings[i+ln][j])
  //       : getTableValidatableCell(id, contents, settings[i+ln][j], GLOBAL.allocationFormula, allocation);
  //     }
  //     tableHTML += '</tr>';
  //   }
  //   setTable(id, tableHTML);
  //   activateButton(id);
  //
  //   // Set the scrolling panel
  //   tableHTML = '<marquee direction="down" scrollamount="1" behavior="scroll" style="width:250px;height:60px;margin:15px"><table>';
  //   tableHTML += '<tr>' + getTableReadOnlyCell(contents, contents.length-1) + '</tr>';  // Dirty way to display the "Time since last update"
  //   for (var i = 0; i < settings[ln-2].length; ++i) {
  //     tableHTML += '<tr>';
  //     tableHTML += getTableReadOnlyContent(settings[ln-2][i], false);
  //     tableHTML += getTableReadOnlyContent(contents[settings[ln*2-1][i]-1][1], false);
  //     tableHTML += '</tr>';
  //   }
  //
  //   tableHTML += '</table></marquee>';
  //   $("#scrollDiv").prop("innerHTML", tableHTML);
  //
  //   if (isFirstLoading) {
  //     displayElement("#loaderBar", false, 0); // Hide the loader bar
  //     openTab(id, true);                      // Activate first tab as open by default
  //   }
  // }

//   function updateInvestmentTable(id, contents) {
//     displayElement("#rebalanceButton", shouldRebalance(contents[contents.length-1][GLOBAL.rebalCol]));
//
//     clearTransactionName();
//
//     var tags = [];
//
//     var row = contents.length;
//     var col = contents[0].length;
//     var tableHTML = getTableTitle(id, false, GLOBAL.rebalanceButtonToolTip, col-1);
//     for (var i = 0; i < row; ++i) {
//       var bgcolor = i == row-1 ? null
//                   : contents[i][GLOBAL.tendencyCol].includes("BUY") ? "lightgreen"
//                   : contents[i][GLOBAL.tendencyCol].includes("SELL") ? "lightcoral"
//                   : null;
//       var color = bgcolor ? "black" : null;
//       tableHTML += i==0 ? '<thead>' : '';
//       tableHTML += i==0 ? '<tr>' : '<tr title="' + contents[i][0] + '"' +
//         (bgcolor ? 'style="background-color:' + bgcolor + ';color:' + color + ';font-weight:bold;"' : '') + '>';
//       //for (var j = 0; j < contents[i].length; ++j)
//       for (var j of [7, 10, 12, 14, 18, 19, 22, 32, 23, 29, 34, 36, 45]) {   // Select only the interesting columns
//         // Name = 7, Shares = 10, Price = 12, Sell = 14, Rebalance = 18, Provision = 19, Tendency = 22,
//         // Daily result	Rate	Dividend	Rate	Stock	Rate	Total	Rate = 23 to 29, Trans profit = 32,
//         // Dist gap = 33, Avg price = 34, Avg gap = 35, Avg lm price = 36, Avg lm progress = 37, Next div dur = 45
//         var con =  i == 0 || j != 12
//                     ? i == 0 || j < 23 || j > 37
//                       ? contents[i][j]
//                       : (contents[i][j] ? toCurrency(contents[i][j], 3) : "") + ' (' + contents[i][j+1] + ')'
//                     : contents[i][12]
//                       ? toCurrency(contents[i][j], 4) : "";
//         var isDisabled = (j == 18 || j == 19 || j == GLOBAL.tendencyCol)
//           && !shouldRebalance(contents[i][GLOBAL.tendencyCol]);
//         tableHTML += j != 12 || i == 0 || i == row-1
//           ? getTableReadOnlyContent(con, i == 0, isDisabled, j == 32 ? getColor(contents[i][j]) : color)
//           : getTableEditableContent(id, con, "Investment!M" + (i+1), 3, toValue(con)*0.75, toValue(con)*1.25);
//         // tableHTML += getTableReadOnlyContent(con, i == 0, isDisabled, j == 32 ? getColor(contents[i][j]) : color);
//       }
//       tableHTML += '</tr>';
//       tableHTML += i == 0 ? '</thead><tbody>'
//       : i == row-2 ? '</tbody><tfoot>'
//       : i == row-1 ? '</tfoot>' : '';
//
//       if (i != 0 && i != row-1) {
//         tags.push(contents[i][7]);
//         addTransactionName(contents[i][0], contents[i][7]);
//       }
//     }
//
//     addTransactionName("", GLOBAL.cost);
//     addTransactionName("", GLOBAL.approv);
//
//     applyFilter(id, tableHTML);
//
// //    $("#" + id + "Table th:first").addClass("sorttable_sorted");
//     // sorttable.innerSortFunction.apply($("#" + id + "Table th:first")[0], []);
//
//     // $("#" + id + "Search").easyAutocomplete({ data: tags, list: { match: { enabled: true } } });
//     // $("#" + id + "Search").autocomplete({ source: tags });
//   }

  // function updateHistoricTable(id, contents) {
  //   $(".validateButton").prop('disabled', true);
  //
  //   displayElement("#uploadButton", true);
  //   displayElement("#addButton", true);
  //   displayElement("#deleteButton", indexOf(contents, GLOBAL.dummy, GLOBAL.histoIdCol));
  //
  //   var row = contents.length;
  //   var col = contents[0].length;
  //   var tableHTML = getTableTitle(id, false, GLOBAL.showAllButtonToolTip, col-1);
  //   for (var i = 0; i < row; ++i) {
  //     var isDummy = contents[i][GLOBAL.histoIdCol] == GLOBAL.dummy;
  //     tableHTML += i==0 ? '<thead>' : '';
  //     tableHTML += !isDummy
  //       ? '<tr>'
  //       : '<tr style="background-color: red;">'; // Row becomes red if it is a dummy
  //     for (var j = 0; j < col; ++j) {
  //       var value = j < contents[i].length && contents[i][j]
  //         ? j != 5 || i == 0
  //           ? contents[i][j]
  //           : toCurrency(contents[i][j], 4)
  //         : "";
  //       tableHTML += j != GLOBAL.histoIdCol   // Don't display the Historic ID
  //         ? getTableReadOnlyContent(value, i == 0, false, isDummy ? "black" : null)
  //         : '';
  //     }
  //     tableHTML += '</tr>';
  //     tableHTML += i==0 ? '</thead><tbody>'
  //     : i==contents.length-1 ? '</tbody><tfoot>' : '';
  //   }
  //   tableHTML += '<tr id="' + id + 'Footer"></tr></tfoot>'
  //
  //   applyFilter(id, tableHTML);
  //
  //   $(".validateButton").prop('disabled', false);
  // }
  //
  // function updateEvolutionTable(id, contents) {
  //   var row = contents.length;
  //   var col = contents[0].length;
  //   var tableHTML = getTableTitle(id, false, GLOBAL.showAllButtonToolTip, col-1);
  //   for (var i = 0; i < row; ++i) {
  //     tableHTML += i==0 ? '<thead>' : '';
  //     tableHTML += '<tr>';
  //     for (var j = 0; j < col; ++j) {
  //       tableHTML += getTableReadOnlyContent(contents[i][j], i == 0);
  //     }
  //     tableHTML += '</tr>';
  //     tableHTML += i==0 ? '</thead><tbody>'
  //     : i==contents.length-1 ? '</tbody><tfoot>' : '';
  //   }
  //   tableHTML += '<tr id="' + id + 'Footer"></tr></tfoot>'
  //
  //   applyFilter(id, tableHTML);
  // }
