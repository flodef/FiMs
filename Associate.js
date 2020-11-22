  GLOBAL.translation = "translation";
  GLOBAL.translationFormula = "Translation!A:D";
  GLOBAL.displayData = {
    "account": {id:"account", formula:"!A:N", updateTable:updateAccountTable, loadOnce:true},
    "historic": {id:"historic", formula:"AssociateHistoric!A:D", updateTable:updateHistoricTable, loadOnce:true, filter:1},
    "personal": {id:"personal", formula:"Associate!A:Y", updateTable:updatePersonalTable, loadOnce:true, filter:1},
    "FAQ": {id:"FAQ", formula:"FAQ!A:B", updateTable:updateFaqTable, loadOnce:true }
  };
  GLOBAL.personalData = [
    { index:1, type:"text", maxLength:10, required:true },
    { index:13, type:"text", required:true },
    { index:14, type:"date", required:true },
    { index:12, type:"text", required:true },
    { index:15, type:"text", required:true },
    { index:16, type:"text", required:true, maxLength:55 },
    { index:17, type:"text", required:true, pattern:"[0-9]{5}" },
    { index:18, type:"text", required:true },
    { index:19, type:"iban", required:true },
    { index:20, type:"text", required:true },
    { index:21, type:"text", required:true },
    { index:22, type:"url", maxLength:55 },
    { index:23, type:"url", maxLength:55 },
    { index:2, type:"euro", min:-1000, max:0 },
    { index:3 },
    { index:4 },
    { index:5 },
    { index:6 },
    { index:24, type:"url", readonly:true }
  ]
  GLOBAL.userId;

//THIS PAGE SHORTENED URL : https://bit.ly/3eiucSP

  /**
   * Run initializations on web app load.
   */
  $(() => {
    getValue({ id:GLOBAL.translation, formula:GLOBAL.translationFormula }, null, true, onLoad);
  });

  function onLoad() {
    init();

    GLOBAL.displayId.forEach(id => displayElement("#" + id + "Button", false, 0));  // Hide all tab on init

    google.script.run
      .withSuccessHandler(setUserId)
      .withFailureHandler(displayError)
      .getProperty("userId");
  }

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
        for (var j = 0; j < col; ++j) {
          tableHTML += j != 1 ? getTranslatedContent(contents[i][j], i == 0) : '';  // Don't add the ID column
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
        // tableHTML += item.type != "url" ? getTranslatedContent(contents[1][i], false, item) : getTableReadOnlyContent(getLink(contents[1][i]));
        tableHTML += '</tr>';
      });

      tableHTML += '<tr id="' + id + 'Footer"></tr></tfoot>'
      processTable(id, tableHTML);
      openTabAfterConnect(id);

      // Set the scrolling panel
      tableHTML = '<marquee direction="down" scrollamount="1" behavior="scroll" style="width:250px;height:60px;margin:15px"><table>';
      for (var i = 11; i > 6; --i) {
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
    // const d = getTranslateData("Enter your user id:");
    const innerHTML = '<div align="center" style="margin:15px 0px 0px 0px;">'
      + getTranslatedContent("Enter your user id:", false,
          {inputId:"userId", type:"text", minLength:3, maxLength:10, value:GLOBAL.userId, erase:true,
          style:"width:104px;text-align:center;line-height:45px", placeholder:translate("User Id")})
      + '<br><br><button id="userIdButton" style="margin:0px 5px 0px 5px; width:76px" onclick="closeConnectionPopup()"></button>'
      + '</div>';

    openPopup(innerHTML);

    $("#userId").keyup((event) => { if (event.keyCode == 13) { closeConnectionPopup(); }
      $("#userIdButton").html($("#userId").val() ? translate("OK") : translate("CANCEL")); });
      $("#userId").keyup();   // Trigger the Keyup event to display correct button text (OK or CANCEL)
      $("#userId").focus();   // Set the focus to the input text
  }

  function closeConnectionPopup() {
    setUserId($("#userId").val());
    closePopup();
  }

  function setUserId(id) {
    if (id != GLOBAL.userId) {
      GLOBAL.userId = id;
      GLOBAL.displayId.forEach(id => displayElement("#" + id + "Button", GLOBAL.userId, 0));  // Display/Hide all tab depending on the connection state
      if (id) {
        GLOBAL.displayData.account.formula = id + '!' + GLOBAL.displayData.account.formula.split('!')[1];   // Create user account formula
        updateAllValues();    // Load all data
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
    if (data) {
      data.tooltip = d.tooltip;
    }

    return (isHeader || !data || !data.type || data.readonly)
      ? getTableReadOnlyContent(content, isHeader).replace(content, isHeader
        ? '<div class="tooltip">' + (d.text ?? content) + (d.tooltip ? '<span class="tooltiptext">' + d.tooltip + '</span>' : '') + '</div>'
        : translate(content))
      : '<h2 style="cursor:default">' + d.text + '</h2>' + getTableEditableContent(data.value, data);
  }

  function getLink(content) {
    return content && content.slice(0, 4) == 'http'
      ? '<a href=' + content + ' target="_blank">' + content + '</a>'
      : content;
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
