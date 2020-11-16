  GLOBAL.translation = "translation";
  GLOBAL.translationFormula = "Translation!A:C";
  GLOBAL.displayData =
  { "account": {id:"account", title:"Compte", formula:"!A:N", updateTable:updateAccountTable, loadOnce:true},
    "historic": {id:"historic", title:"Historique", formula:"AssociateHistoric!A:C", updateTable:updateHistoricTable, loadOnce:true, filter:1},
    "personal": {id:"personal", title:"Données personnelles", formula:"Associate!A:V", updateTable:updatePersonalTable, loadOnce:true, filter:0},
    "FAQ": {id:"FAQ", formula:"FAQ!A:B", updateTable:updateFaqTable, loadOnce:true } };
  GLOBAL.userId;

//THIS PAGE SHORTENED URL : https://bit.ly/3eiucSP

  /**
   * Run initializations on web app load.
   */
  $(() => {
    init();

    GLOBAL.displayId.forEach(id => displayElement("#" + id + "Button", false, 0));  // Display/Hide all tab depending on the connection state

    google.script.run
      .withSuccessHandler(setUserId)
      .withFailureHandler(displayError)
      .getProperty("userId");
  });

  function onKeyUp(e) {}

  function updateAccountTable(id, contents) {
    if (contents) {
      var row = contents.length;
      var col = contents[0].length;
      var tableHTML = getTableTitle(id);
      for (var i = 0; i < row; ++i) {
        tableHTML += i==0 ? '<thead>' : '';
        tableHTML += '<tr>';
        for (var j = 0; j < col; ++j) {
          const fn = i == 0 ? getTableHeader : getTableReadOnlyContent;
          const con = i != 0 ? translate(contents[i][j]) : contents[i][j];
          tableHTML += fn(con);
        }
        tableHTML += '</tr>';
        tableHTML += i==0 ? '</thead><tbody>'
        : i==contents.length-1 ? '</tbody><tfoot>' : '';
      }
      tableHTML += '<tr id="' + id + 'Footer"></tr></tfoot>'

      processTable(id, tableHTML);
      openTabAfterConnect(id);
    } else {
      displayElement("#" + id + "Button", false, 0);  // Hide this tab if empty
    }
  }

  function updateHistoricTable(id, contents) {
    if (contents && contents.length > 1) {
      var row = contents.length;
      var col = contents[0].length;
      var tableHTML = getTableTitle(id);
      for (var i = 0; i < row; ++i) {
        tableHTML += i==0 ? '<thead>' : '';
        tableHTML += '<tr>';
        for (var j of [0, 2]) {
          const fn = i == 0 ? getTableHeader : getTableReadOnlyContent;
          const con = i != 0 ? translate(contents[i][j]) : contents[i][j];
          tableHTML += fn(con);
        }
        tableHTML += '</tr>';
        tableHTML += i==0 ? '</thead><tbody>'
        : i==contents.length-1 ? '</tbody><tfoot>' : '';
      }
      tableHTML += '<tr id="' + id + 'Footer"></tr></tfoot>'

      processTable(id, tableHTML);
      openTabAfterConnect(id);
    } else {
      displayElement("#" + id + "Button", false, 0);  // Hide this tab if empty
    }

  }

  function updatePersonalTable(id, contents) {
    var row = contents.length;
    var col = contents[0].length;
    var tableHTML = getTableTitle(id);
    for (var i = 0; i < row; ++i) {
      tableHTML += i==0 ? '<thead>' : '';
      tableHTML += '<tr>';
      for (var j = 0; j < col; ++j) {
        const fn = i == 0 ? getTableHeader : getTableReadOnlyContent;
        const con = i != 0 ? translate(contents[i][j]) : contents[i][j];
        tableHTML += fn(con);
      }
      tableHTML += '</tr>';
      tableHTML += i==0 ? '</thead><tbody>'
      : i==contents.length-1 ? '</tbody><tfoot>' : '';
    }
    tableHTML += '<tr id="' + id + 'Footer"></tr></tfoot>'

    processTable(id, tableHTML);
    openTabAfterConnect(id);
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

    processTable(id, tableHTML);

    if (isFirstLoading) {
      displayElement("#loaderBar", false, 0); // Hide the loader bar
      openTabAfterConnect(id)                 // Activate first tab as open by default
      displayElement("#connectButton", true); // Show the connect button
    }
  }

  function connect() {
    // var innerHTML = '<span class="closebtn" onclick="closePopup()">&times;</span>';
    var innerHTML = '<div align="center" style="margin:15px 0px 0px 0px;">'
      + '<h2 style="cursor:default">Veuillez saisir votre identifiant :</h2>'
      + '<div class="tooltip">'
      + '<input id="userId" size="10" minlength="3" maxLength="10" placeholder="Identifiant"'
      + getEditCellHandler(GLOBAL.userId) + ' style="width:104px;text-align:center;line-height:45px">'
      + '<span class="tooltiptext">Echap pour réinitialiser la saisie<br>Entrée pour valider</span></div>'
      + '<span id="userErase" style="float:none;color:black;visibility:hidden" class="closebtn" onclick="$(\'#userId\').val(\'\');GLOBAL.tempInput[\'userId\']=\'\';$(\'#userId\').keyup();">&times;</span>'
      + '<br><br><button id="userIdButton" style="margin:0px 5px 0px 5px; width:62px" onclick="closeConnectionPopup()"></button>'
      + '</div>';

    openPopup(innerHTML);

    $("#userId").keyup((event) => { if (event.keyCode == 13) { closeConnectionPopup(); } $("#userIdButton").html($("#userId").val() ? "OK" : "CANCEL"); $("#userErase").css("visibility", $("#userId").val() ? "visible" : "hidden") });
    $("#userId").keyup();   // Trigger the Keyup event to display correct button text (OK or CANCEL)
    $("#userId").focus();
  }

  function closeConnectionPopup() {
    setUserId($("#userId").val());
    closePopup();
  }

  function setUserId(id) {
    GLOBAL.userId = id;
    GLOBAL.displayId.forEach(id => displayElement("#" + id + "Button", GLOBAL.userId, 0));  // Display/Hide all tab depending on the connection state
    if (id) {
      GLOBAL.displayData.account.formula = id + '!' + GLOBAL.displayData.account.formula.split('!')[1];
      if (!GLOBAL.data[GLOBAL.translation]) {
        getValue({ id:GLOBAL.translation, formula:GLOBAL.translationFormula }, null, true, updateAllValues)
      } else {
        updateAllValues();
      }
    } else {    // No user
      const faqId = GLOBAL.displayData.FAQ.id;
      openTab(faqId);                                                            // Open first the faq tab (in case of disconnection)
      GLOBAL.displayId.forEach(id => { if (id != faqId) { $("#" + id + "Div").prop("innerHTML", ""); } }); // Clear all tab content except faq
      displayElement("#" + faqId + "Button", true, 0);                           // Display only the faq
      if (!GLOBAL.data[faqId]) {                                                 // Don't load twice the faq
        updateValues(faqId);                                                     // Load only the faq
      }
    }
  }

  function openTabAfterConnect(id) {
    if (!GLOBAL.currentDisplayedId || GLOBAL.currentDisplayedId == GLOBAL.displayData.FAQ.id) {
      openTab(id);
    }
  }

  function getTableHeader(content) {
    const a = GLOBAL.data[GLOBAL.translation];
    const i = indexOf(a, content, 0, 1);

    return '<th align="center"><div class="tooltip">' + (i ? a[i][1] : content)
      + (i && a[i][2] ? '<span class="tooltiptext">' + a[i][2] + '</span>' : '') + '</div></th>'
  }

  function translate(value) {
    return value.includes("€") || value.includes("%") ? value.replace(',', ' ').replace(',', '.')
      : value.includes("month") || value.includes("year") ? value.replace('months', 'mois').replace('month', 'mois').replace('year', 'an')
      : value;
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
//     processTable(id, tableHTML);
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
  //   processTable(id, tableHTML);
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
  //   processTable(id, tableHTML);
  // }
