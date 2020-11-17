  GLOBAL.translation = "translation";
  GLOBAL.translationFormula = "Translation!A:C";
  GLOBAL.displayData = {
    "account": {id:"account", title:"Compte", formula:"!A:N", updateTable:updateAccountTable, loadOnce:true},
    "historic": {id:"historic", title:"Historique", formula:"AssociateHistoric!A:C", updateTable:updateHistoricTable, loadOnce:true, filter:1},
    "personal": {id:"personal", title:"Données personnelles", formula:"Associate!A:X", updateTable:updatePersonalTable, loadOnce:true, filter:1},
    "FAQ": {id:"FAQ", formula:"FAQ!A:B", updateTable:updateFaqTable, loadOnce:true }
  };
  GLOBAL.personalData = [
    { index:1, type:"text", minlength:3, maxLength:10, required:true },
    { index:12, type:"text", required:true },
    { index:13, type:"text", required:true },
    { index:11, type:"email", required:true, pattern:"^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$" },
    { index:14, type:"date", required:true },
    { index:15, type:"text", required:true },
    { index:16, type:"text", required:true, maxLength:50 },
    { index:17, type:"text", required:true, pattern:"[0-9]{5}" },
    { index:18, type:"text", required:true },
    { index:19, type:"iban", required:true, pattern:"^([A-Z]{2}[ \-]?[0-9]{2})(?=(?:[ \-]?[A-Z0-9]){9,30}$)((?:[ \-]?[A-Z0-9]{3,5}){2,7})([ \-]?[A-Z0-9]{1,3})?$" },
    { index:20, type:"text", required:true },
    { index:21, type:"text", required:true },
    { index:22, type:"url", pattern:"https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)" },
    { index:2, type:"money", min:-1000, max:0, precision:2 },
    { index:3 },
    { index:4 },
    { index:5 },
    { index:23, type:"url", readonly:true }
  ]
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
          tableHTML += getTranslatedContent(contents[i][j], i == 0);
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
          tableHTML += getTranslatedContent(contents[i][j], i == 0);
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
    if (contents && contents.length > 1) {
      const baseFormula = GLOBAL.displayData[id].formula.split('!')[0] + '!';
      var tableHTML = getTableTitle(id);
      GLOBAL.personalData.forEach(item => {
        const i = item.index;
        item.id = id;
        item.range = baseFormula + convertNumberToColumn(i) + contents[1][0];

        tableHTML += '<tr>';
        tableHTML += getTranslatedContent(contents[0][i], true);
        tableHTML += item.type != "url" ? getTranslatedContent(contents[1][i]) : getTableReadOnlyContent(getLink(contents[1][i]));
        tableHTML += '</tr>';
      });

      tableHTML += '<tr id="' + id + 'Footer"></tr></tfoot>'
      processTable(id, tableHTML);
      openTabAfterConnect(id);


      // Set the scrolling panel
      tableHTML = '<marquee direction="down" scrollamount="1" behavior="scroll" style="width:250px;height:60px;margin:15px"><table>';
      for (var i = 10; i > 5; --i) {
        tableHTML += '<tr>';
        tableHTML += getTranslatedContent(contents[0][i]);
        tableHTML += getTranslatedContent(contents[1][i]);
        tableHTML += '</tr>';
      }

      tableHTML += '</table></marquee>';
      $("#scrollDiv").prop("innerHTML", tableHTML);
    }
  }

  function updateFaqTable(id, contents) {
    var row = contents.length;
    var col = contents[0].length;
    var tableHTML = getTableTitle(id, false, GLOBAL.showAllButtonToolTip, col-1);
    tableHTML += '<div style="padding: 5px 25px;">';
    for (var i = 1; i < row; ++i) {     // Skip the header
      for (var j = 0; j < col; ++j) {
        var con = contents[i][j];
        var isQuestion = j == 0;
        var str = '';
        con.split(' ').forEach(a => str += getLink(a) + ' ');
        tableHTML += (isQuestion ? '<b>' : '') + str + (isQuestion ? '</b>' : '') + '<br>';
      }
      tableHTML += '<br><br>';
    }
    tableHTML += '</div>';

    processTable(id, tableHTML);

    openTabAfterConnect(id)                 // Activate first tab as open by default
    displayElement("#connectButton", true); // Show the connect button
  }

  function connect() {
    // var innerHTML = '<span class="closebtn" onclick="closePopup()">&times;</span>';
    var innerHTML = '<div align="center" style="margin:15px 0px 0px 0px;">'
      + '<h2 style="cursor:default">Veuillez saisir votre identifiant :</h2>'
      + '<div class="tooltip">'
      + '<input id="userId" size="10" minlength="3" maxLength="10" placeholder="Identifiant"'
      + getEditCellHandler(GLOBAL.userId) + ' style="width:104px;text-align:center;line-height:45px">'
      + '<span class="tooltiptext">Echap pour réinitialiser la saisie<br>Entrée pour valider</span></div>'
      + '<span id="userErase" style="float:none;color:black;visibility:hidden" class="closebtn" onclick="$(\'#userId\').val(\'\');GLOBAL.tempInput[\'userId\']=\'\';updateUserId();">&times;</span>'
      + '<br><br><button id="userIdButton" style="margin:0px 5px 0px 5px; width:62px" onclick="closeConnectionPopup()"></button>'
      + '</div>';

    openPopup(innerHTML);

    $("#userId").keyup((event) => { if (event.keyCode == 13) { closeConnectionPopup(); } $("#userIdButton").html($("#userId").val() ? "OK" : "CANCEL"); $("#userErase").css("visibility", $("#userId").val() ? "visible" : "hidden") });
    updateUserId();
  }

  function updateUserId() {
    $("#userId").keyup();   // Trigger the Keyup event to display correct button text (OK or CANCEL)
    $("#userId").focus();   // Set the focus to the input text
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
      $("#scrollDiv").prop("innerHTML", "");                                     // Clear the scroll marquee content
      GLOBAL.displayId.forEach(id => { if (id != faqId) { $("#" + id + "Div").prop("innerHTML", ""); } }); // Clear all tab content except faq
      displayElement("#" + faqId + "Button", true, 0);                           // Display only the faq
      if (!GLOBAL.data[faqId]) {                                                 // Don't load twice the faq
        updateValues(faqId);                                                     // Load only the faq
      }
    }
  }

  function openTabAfterConnect(id) {
    if (!GLOBAL.currentDisplayedId || GLOBAL.currentDisplayedId == GLOBAL.displayData.FAQ.id) {
      displayElement("#loaderBar", false, 0); // Hide the loader bar
      openTab(id);
    }
  }

  function getTranslatedContent(content, isHeader, data)
  {
    const d = getTranslateData(content);

    return (isHeader || !data || !data.type || data.readonly)
      ? getTableReadOnlyContent(content, isHeader).replace(content, isHeader
        ? '<div class="tooltip">' + (d.text ?? content) + (d.tooltip ? '<span class="tooltiptext">' + d.tooltip + '</span>' : '') + '</div>'
        : translate(content))
      : getTableEditableContent(content, data);
    //(id, content, range, precision, min, max)
  }

  function translate(content) {
    return content.includes("€") || content.includes("%") ? content.replace(',', ' ').replace('.', ',')
      : content.includes("month") || content.includes("year") ? content.replace('months', 'mois').replace('month', 'mois').replace('year', 'an')
      : getTranslateData(content).text ?? content;
  }

  function getTranslateData(content) {
    const a = GLOBAL.data[GLOBAL.translation];
    const i = indexOf(a, content, 0, 1);

    return {text:i ? a[i][1] : null, tooltip:i ? a[i][2] : null};
  }

  function getLink(content) {
    return content.slice(0, 4) == 'http' ? '<a href=' + content + ' target="_blank">' + content + '</a>' : content;
  }

  function convertNumberToColumn(number){
    var t;
    var s = '';
    while (number > 0) {
      t = (number - 1) % 26;
      s = String.fromCharCode(65 + t) + s;
      number = (number - t)/26 | 0;
    }

    return s || undefined;
  }

  function validateIbanChecksum(iban) {
    const ibanStripped = iban.replace(/[^A-Z0-9]+/gi,'') //keep numbers and letters only
                             .toUpperCase(); //calculation expects upper-case
    const m = ibanStripped.match(/^([A-Z]{2})([0-9]{2})([A-Z0-9]{9,30})$/);
    if(!m) return false;

    const numbericed = (m[3] + m[1] + m[2]).replace(/[A-Z]/g,function(ch){
                          //replace upper-case characters by numbers 10 to 35
                          return (ch.charCodeAt(0)-55);
                      });
    //The resulting number would be to long for javascript to handle without loosing precision.
    //So the trick is to chop the string up in smaller parts.
    const mod97 = numbericed.match(/\d{1,7}/g)
                            .reduce(function(total, curr){ return Number(total + curr)%97},'');

    return (mod97 === 1);
  };
