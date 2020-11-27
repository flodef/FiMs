  GLOBAL.translation = "translation";
  GLOBAL.translationFormula = "Translation!A:D";
  GLOBAL.depositAmount = "depositAmount";
  GLOBAL.withdrawAmount = "withdrawAmount";
  GLOBAL.personalGID = 911574160;
  GLOBAL.pendingStatus = "Pending ...";
  GLOBAL.completedStatus = "Completed !";
  GLOBAL.displayData = {
    "account": {id:"account", formula:"!A:N", updateTable:updateAccountTable, loadOnce:true},
    "historic": {id:"historic", formula:"AssociateHistoric!A:E", updateTable:updateHistoricTable, loadOnce:true, filter:1},
    "personal": {id:"personal", formula:"Associate!A:AA", updateTable:updatePersonalTable, loadOnce:true, filter:1},
    "FAQ": {id:"FAQ", formula:"FAQ!A:B", updateTable:updateFaqTable, loadOnce:true }
  };
  GLOBAL.menuButton = ["deposit", "withdraw", "connect"];
  GLOBAL.personalData = [
    { index:1, label:"ID", type:"name", minLength:5, maxLength:10, required:true }, // ID
    { index:15, label:"First name", type:"name", required:true },                   // First name
    { index:16, label:"Family name", type:"name", required:true },                  // Family name
    { index:14, label:"Email", type:"email", required:true },                       // Email
    { index:17, label:"Birth date", type:"date", required:true },                   // Birth date
    { index:18, label:"Birth city", type:"name", required:true },                   // Birth city
    { index:19, label:"Adress", type:"text", required:true, maxLength:55 },         // Adress
    { index:20, label:"Postal code", type:"text", required:true, pattern:"[0-9]{5}" }, // Postal code
    { index:21, label:"City", type:"name", required:true },                         // City
    { index:22, label:"IBAN", type:"iban", required:true },                         // IBAN
    { index:23, label:"Bank", type:"name", required:true },                         // Bank
    { index:24, label:"Association", type:"name", required:true },                  // Association
    { index:25, label:"Web page", type:"url", maxLength:55 },                       // Web page
    { index:2, label:"Recurrent", type:"euro", min:-1000, max:0 },                  // Recurrent
    { index:6, label:"Estimate rate" },                                             // Estimate rate
    { index:7, label:"Estimate gain" },                                             // Estimate gain
    { index:5, label:"Financed project" },                                          // Financed project
    { index:3, label:"Charity" },                                                   // Charity
    { index:4, label:"Donated" },                                                   // Donated
    { index:8, label:"Duration" },                                                  // Duration
    { index:26, label:"Debt recognition", type:"url", readonly:true }               // Debt recognition
  ]
  GLOBAL.depositCol = 9;
  GLOBAL.totalCol = 13;

  GLOBAL.totalValue = 0;
  GLOBAL.userId;
  GLOBAL.userFullName;
  GLOBAL.userEmail;
  GLOBAL.ownMail = "fdefroco@gmail.com";

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
          tableHTML += j == col-1 && i != 0
            ? !contents[i][j] ? getTableCheckmark(GLOBAL.completedStatus) : getTableLoaderBar(contents[i][j])
          : j != 1 ? getTranslatedContent(contents[i][j], i == 0) : '';  // Don't add the ID column
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
    const hasContent = contents && contents.length > 1;
    if (hasContent) {
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
      for (var i = GLOBAL.totalCol; i >= GLOBAL.depositCol; --i) {
        tableHTML += '<tr>';
        tableHTML += getTranslatedContent(contents[0][i]);
        tableHTML += getTranslatedContent(contents[1][i]);
        tableHTML += '</tr>';
      }

      tableHTML += '</table></marquee>';
      $("#scrollDiv").html(tableHTML);

      GLOBAL.totalValue = toValue(contents[1][GLOBAL.totalCol]);
      GLOBAL.userEmail = contents[1][indexOf(contents[0], "Email")];
      GLOBAL.userFullName = contents[1][indexOf(contents[0], "Family Name")].toUpperCase()
        + ' ' + contents[1][indexOf(contents[0], "First Name")];
    }

    displayElement("#depositButton", hasContent); // Show the deposit button
    displayElement("#withdrawButton", GLOBAL.totalValue > 0); // Show the withdraw button
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
    const d = GLOBAL.personalData[0];
    const id = "userId";
    const content = getTranslatedContent("Enter your user id", false,
        {inputId:id, type:d.type, minLength:d.minLength, maxLength:d.maxLength, value:GLOBAL.userId, erase:true,
        style:"width:104px;text-align:center;line-height:45px", placeholder:translate("User Id")});
    const innerHTML = getPopupContent(id, content);

    openPopup(innerHTML);
    addPopupButtonEvent(id, true);
  }

  function userIdValidation(result) {
    const id = "userId";
    if ((result == translate("OK") && !$("#" + id).data("error")) || result == translate("CANCEL")) {
      setUserId($("#" + id).val());
      closePopup();
    }
  }

  function deposit() {
    const id = GLOBAL.depositAmount;
    const content = getTranslatedContent("Amount to deposit", false,
        {inputId:id, type:"euro", min:100, max:100000, erase:true,
        style:"width:104px;text-align:center;line-height:45px", placeholder:translate("deposit")});
    const innerHTML = getPopupContent(id, content);

    openPopup(innerHTML);
    addPopupButtonEvent(id, true);
  }

  function depositAmountValidation(result) {
    const id = GLOBAL.depositAmount;
    if (result == translate("OK") && !$("#" + id).data("error")) {
      const value = $("#" + id).val();
      const content = '<table><tr>'
        + getTranslatedContent("Amount to deposit", true) + getTranslatedContent(value + ' €') + '</tr><tr>'
        + getTranslatedContent("Recipient", true) + getTableReadOnlyContent("DE FROCOURT F.") + '</tr><tr>'
        + getTranslatedContent("IBAN", true) + getTableReadOnlyContent("FR76 4061 8802 5000 0403 8167 244") + '</tr><tr>'
        + getTranslatedContent("BIC", true) + getTableReadOnlyContent("BOUS FRPP XXX") + '</tr><tr>'
        + getTranslatedContent("Bank", true) + getTableReadOnlyContent("Boursorama Banque") + '</tr><tr>'
        + getTranslatedContent("Bank Adress", true) + getTableReadOnlyContent("18, quai du Point du Jour 92659 Boulogne-Billancourt Cedex") + '</tr></table>'

      const innerHTML = getPopupContent(deposit.name, content, updateDeposit.name);

      openPopup(innerHTML);
      addPopupButtonEvent("validatePopupButton", false);

      $("#popup").data(id, value);

    } else if (result == translate("CANCEL")) {
      closePopup();
    }
  }

  function updateDeposit() {
    confirmation();

    const id = GLOBAL.depositAmount;
    const title = toFirstUpperCase(id.replace("Amount", ""));
    const value = $("#popup").data(id);

    const data = {movement:value};

    const subject = title + ": " + value + " € for " + GLOBAL.userId;
    google.script.run
          .withSuccessHandler(contents => insertHistoricRow(data))
          .withFailureHandler(displayError)
          .sendEmail(GLOBAL.ownMail, subject);
  }

  function withdraw() {
    const id = GLOBAL.withdrawAmount;
    const style = "margin:15px 10px;width:auto;";
    const content = getTranslatedContent("Amount to withdraw", false,
        {inputId:id, type:"euro", min:100, max:GLOBAL.totalValue, erase:true,
        style:"width:104px;text-align:center;line-height:45px", placeholder:translate("withdraw")})
        + getTranslatedContent("Withdraw period", false,
            {name:"withdrawPeriod", type:"radio", value:translate("Periodic"), checked:true, style:style})
        + getTranslatedContent(null, false,
            {name:"withdrawPeriod", type:"radio", value:translate("Recurrent"), style:style})
        + getTranslatedContent("Withdraw date", false,
            {name:"withdrawDate", type:"radio", value:translate("Start of next month"), checked:true, style:style})
        + getTranslatedContent(null, false,
            {name:"withdrawDate", type:"radio", value:translate("Immediat"), style:style});

    const innerHTML = getPopupContent(id, content);

    openPopup(innerHTML);
    addPopupButtonEvent(id, true);
  }

  function withdrawAmountValidation(result) {
    const id = GLOBAL.withdrawAmount;
    if (result == translate("OK") && !$("#" + id).data("error")) {
      const value = $("#" + id).val();
      const period = $("input[name='withdrawPeriod']:checked").val();
      const date =  $("input[name='withdrawDate']:checked").val();
      const cost = 0;

      const data = GLOBAL.data[GLOBAL.displayData.personal.id];

      const content = '<table><tr>'
        + getTranslatedContent("Amount to withdraw", true) + getTranslatedContent(value + ' €') + '</tr><tr>'
        + getTranslatedContent("Withdraw period", true) + getTableReadOnlyContent(period) + '</tr><tr>'
        + getTranslatedContent("Withdraw date", true) + getTableReadOnlyContent(date) + '</tr><tr>'
        + getTranslatedContent("Operation cost", true) + getTranslatedContent(cost + ' €') + '</tr><tr>'
        + getTranslatedContent("Recipient", true) + getTableReadOnlyContent(GLOBAL.userFullName) + '</tr><tr>'
        + getTranslatedContent("IBAN", true) + getTableReadOnlyContent(data[1][indexOf(data[0], "IBAN")]) + '</tr><tr>'
        + getTranslatedContent("Bank", true) + getTableReadOnlyContent(data[1][indexOf(data[0], "Bank")]) + '</tr></table>'

      const innerHTML = getPopupContent(withdraw.name, content, updateWithdraw.name);

      openPopup(innerHTML);
      addPopupButtonEvent("validatePopupButton", false);

      $("#popup").data(id, value);

    } else if (result == translate("CANCEL")) {
      closePopup();
    }
  }

  function updateWithdraw() {
    confirmation();

    const id = GLOBAL.withdrawAmount;
    const title = toFirstUpperCase(id.replace("Amount", ""));
    const value = '-' + $("#popup").data(id);   // Withdraw value should be negative

    const data = {movement:value};

    const subject = title + ": " + value + " € for " + GLOBAL.userId;
    google.script.run
          .withSuccessHandler(contents => insertHistoricRow(data))
          .withFailureHandler(displayError)
          .sendEmail(GLOBAL.ownMail, subject);
  }

  function confirmation(text) {
    // Display confirmation message on popup with a close button
    closePopup();

    // Send explicit Email to user
    const subject = "";
    const message = "";

    // google.script.run
    //       .withSuccessHandler()
    //       .withFailureHandler(displayError)
    //       .sendEmail(GLOBAL.userEmail, subject, message);
  }

  function insertHistoricRow(data) {
    if (data && data.movement) {
      data = [[data.date ?? toStringDate(), GLOBAL.userId, toCurrency(data.movement), data.cost ?? toCurrency(0), GLOBAL.pendingStatus]];

      const id = GLOBAL.displayData.historic.id;
      openTab(id);
      data[0][0] = toStringDate(data[0][0]);    // Reverse date as the format is incorrect
      GLOBAL.data[id].splice(1, 0, data[0]);
      updateHistoricTable(id, GLOBAL.data[id]);

      google.script.run
      .withSuccessHandler(contents => setValue(GLOBAL.displayData.historic.formula.split('!')[0] + "!A2", data))
      .withFailureHandler(displayError)
      .insertRows(GLOBAL.personalGID, data, {startRow:1, endCol:data.length});
    } else {
      throw 'data is not set or incomplete';
    }
  }

  function setUserId(id) {
    if (id != GLOBAL.userId) {
      const faqId = GLOBAL.displayData.FAQ.id;
      GLOBAL.userId = id;
      GLOBAL.userEmail = null;
      GLOBAL.userFullName = null;

      GLOBAL.displayId.forEach(id => {
        if (id != faqId) {
          $("#" + id + "Div").html("");                         // Clear all tab content except faq
        }
        displayElement("#" + id + "Button", GLOBAL.userId, 0);  // Display/Hide all tab depending on the connection state
      });
      GLOBAL.currentDisplayedId = null;                         // Unselect the current displayed tab

      if (id) {
        GLOBAL.displayData.account.formula = id + '!' + GLOBAL.displayData.account.formula.split('!')[1];   // Create user account formula
        updateAllValues();                                      // Load all data
      } else {    // No user
        openTab(faqId);                                         // Open first the faq tab (in case of disconnection)
        $("#scrollDiv").html("");                               // Clear the scroll marquee content
        displayElement("#" + faqId + "Button", true, 0);        // Display only the faq
        if (!GLOBAL.data[faqId]) {                              // Don't load twice the faq
          updateValues(faqId);                                  // Load only the faq
        }
        displayElement("#depositButton", false, 0);             // Hide the deposit button
        displayElement("#withdrawButton", false, 0);            // Hide the withdraw button
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
      : (d.text ? '<h2 style="cursor:default">' + d.text + '</h2>' : '') + getTableEditableContent(data.value, data);
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
