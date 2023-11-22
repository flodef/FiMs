/* global GLOBAL, google, $, displayError, getTableTitle, displayElement, 
toStringDate, getTableCheckmark, getTableImage, getTableLoaderBar, indexOf, 
toValue, translate, setHtml, getLink, openTab, getPopupContent, openPopup,
addPopupButtonEvent, closePopup, animateLoaderBar, updateAllValues, updateValues,
toCurrency, getTableReadOnlyContent, toFirstUpperCase, getTranslateData, getDiv,
getDaysBetweenDate, getNextMonthDate, showSnackBar, addDaysToDate, roundDown,
setEvents, setValue, isEditableInput, getTableEditableContent, finishLoading,
processTable, getTooltip, restrainFormula, initCommon, sendRecapEmail, getValue */
/* exported init, onKeyUp, connect, userIdValidation, depositAmountValidation, 
withdrawAmountValidation, confirmationValidation, printHtml, translationLoaded */

GLOBAL.hasTranslation = true;
GLOBAL.language = "Français";

GLOBAL.depositAmount = "depositAmount";
GLOBAL.withdrawAmount = "withdrawAmount";
GLOBAL.withdrawPeriod = "withdrawPeriod";
GLOBAL.withdrawDate = "withdrawDate";
GLOBAL.withdrawCost = "withdrawCost";
GLOBAL.withdrawRecurrent = "withdrawRecurrent";
GLOBAL.confirmation = "confirmation";
GLOBAL.newDeposit = "New deposit";
GLOBAL.nextDeposit = "Next deposit";
GLOBAL.validatePopupButton = "validatePopupButton";
GLOBAL.personalGID = 911574160;
GLOBAL.Status = "Status";
GLOBAL.completedStatus = "Completed !";
GLOBAL.pendingStatus = "Pending ...";
GLOBAL.DonationStatus = "Donation";
GLOBAL.ackDebt = "Acknowledgment Of Debt";
GLOBAL.withdrawPeriodOption = ["Unique", "Recurrent"];
GLOBAL.withdrawDateOption = ["Start of next month", "Immediat"];

GLOBAL.displayData = {
  account: {
    id: "account",
    formula: "DeFi!A:L",
    updateTable: updateAccountTable,
    loadOnce: true,
    filter: 1,
  },
  historic: {
    id: "historic",
    formula: "!A:K",
    updateTable: updateHistoricTable,
    loadOnce: true,
  },
  transactions: {
    id: "transactions",
    formula: "Transactions!A:D",
    updateTable: updateTransactionsTable,
    loadOnce: true,
    filter: 1,
  },
  // personal: {
  //   id: "personal",
  //   formula: "Associate!A:O",
  //   updateTable: updatePersonalTable,
  //   loadOnce: true,
  //   filter: 1,
  // },
  // global: {
  //   id: "global",
  //   formula: "Dashboard!A:B",
  //   updateTable: updateGlobalTable,
  //   loadOnce: true,
  // },
  FAQ: {
    id: "FAQ",
    formula: "FAQ!A:B",
    updateTable: updateFaqTable,
    loadOnce: true,
  },
};
GLOBAL.menuButton = ["deposit", "withdraw", "connect"];
GLOBAL.personalData = [
  {
    index: 1,
    readonly: true,
    type: "name",
    minLength: 5,
    maxLength: 10,
    required: true,
  }, // ID
  {
    index: 14,
    readonly: true,
    type: "email",
    required: true,
  }, // Email
  // {
  //   index: 2,
  //   type: "euro",
  //   max: 0,
  //   required: true,
  // }, // Recurrent
  {
    index: 6,
    disabled: true,
  }, // Estimate rate
  {
    index: 7,
    disabled: true,
  }, // Estimate gain
  {
    index: 5,
    disabled: true,
  }, // Financed project
  {
    index: 3,
    disabled: true,
  }, // Charity
  {
    index: 4,
    disabled: true,
  }, // Donated
  {
    index: 8,
    disabled: true,
  }, // Duration
  /*{
  index: 15,
  readonly: true,
  type: 'name',
  required: true
}, // Civility
{
  index: 16,
  readonly: true,
  type: 'name',
  required: true
}, // First name
{
  index: 17,
  readonly: true,
  type: 'name',
  required: true
}, // Family name
{
  index: 18,
  disabled: true,
  type: 'date',
  required: true
}, // Birth date
{
  index: 19,
  readonly: true,
  type: 'text',
  required: true
}, // Birth city
{
  index: 20,
  readonly: true,
  type: 'text',
  required: true,
  maxLength: 100
}, // Address
{
  index: 21,
  readonly: true,
  type: 'text',
  required: true,
  pattern: '^[0-9]{5}$'
}, // Postal code
{
  index: 22,
  readonly: true,
  type: 'name',
  required: true
}, // City
{
  index: 23,
  readonly: true,
  type: 'iban',
  required: true
}, // IBAN
{
  index: 24,
  readonly: true,
  type: 'name',
  required: true
}, // Bank
{
  index: 25,
  readonly: true,
  type: 'name'
}, // Succession
{
  index: 26,
  type: 'name',  //type: 'radio'
  required: true
}, // Newsletter*/
];
GLOBAL.globalData = [36, 37, 33, 1, 58, 56, 21, 31, 32, 35, 39, 40, 52, 59, 60, 63, 64, 65, 71];

GLOBAL.user = [];

//THIS PAGE SHORTENED URL : https://bit.ly/3eiucSP

$(() => {
  initCommon();
});

function init(id) {
  if (id != GLOBAL.user.ID || GLOBAL.user.ID === undefined) {
    const faqId = GLOBAL.displayData.FAQ.id;
    GLOBAL.user = [];
    GLOBAL.user.ID = id;

    GLOBAL.currentDisplayedId = null; // Unselect the current displayed tab
    GLOBAL.displayId.forEach((displayId) => {
      if (displayId != faqId) {
        setHtml("#" + displayId + "Div", ""); // Clear all tab content except faq
        GLOBAL.data[displayId] = null; // Delete data in order to reload it
      }
      displayElement(displayId + "Button", false, 0); // Hide all tab
    });
    setHtml("#scrollDiv", ""); // Clear the scrollDiv
    displayElement(faqId + "Div", false, 0); // Hide Faq content
    if ($("#loaderBar").is(":hidden")) {
      displayElement("loaderBar", true, 0); // Display the loader bar
      animateLoaderBar(); // Animate the loader bar
    }

    if (id) {
      displayElement("tabContainer", false, 0); // Hide the tab container
      try {
        GLOBAL.displayData.historic.formula = restrainFormula(
          id + "!" + GLOBAL.displayData.historic.formula.split("!")[1],
          0,
          12
        ); // Create user account formula
      } catch {
        GLOBAL.displayData.historic.formula = null; // Reset formula if it is incorrect
      }
      updateAllValues();
    } else {
      // No user
      displayElement("depositButton", false, 0); // Hide the deposit button
      displayElement("withdrawButton", false, 0); // Hide the withdraw button
      updateValues(faqId); // Load only the faq
    }
  }
}

function translationLoaded() {}

function updateAccountTable(id, contents) {
  const hasContent = contents && contents.length > 1;
  if (hasContent) {
    const func = (a, token) => {
      let tableHTML = getTableTitle(id);
  
      const col = contents[0].length;
      for (let i = 1; i < col; ++i) {
        const content = contents[0][i];
        const value = contents[1][i];
        if (value && parseInt(value) != 0) {
          const x = indexOf(token, content, 0);
          const price = x ? token[x][1] : null;
          const text = translate(value) + (x ? " x " + translate(price) + " = " + translate(toCurrency(toValue(value) * toValue(price))) : "");
          tableHTML += "<tr>";
          tableHTML += getTranslatedContent(content, false, {value:text, readonly:true});
          tableHTML += "</tr>";
        }
      }
  
      processTable(id, tableHTML);
    };

    openTabAfterConnect(id);

    getValue({id:"token", formula:"Token!B:C"}, func);
  }
}

function updateHistoricTable(id, contents) {
  const hasContent = contents;
  if (hasContent) {
    const row = contents.length;
    const col = contents[0].length;
    let tableHTML = getTableTitle(id);
    for (let i = 0; i < row; ++i) {
      tableHTML += i == 0 ? "<thead>" : "";
      tableHTML += "<tr>";
      for (let j = 0; j < col; ++j) {
        tableHTML += getTranslatedContent(contents[i][j], i == 0);
      }
      tableHTML += "</tr>";
      tableHTML += i == 0 ? "</thead><tbody>" : i == row - 1 ? "</tbody>" : "";
    }

    processTable(id, tableHTML);
    openTabAfterConnect(id);
  }

  displayElement(id + "Button", hasContent, 0); // Hide this tab if empty
}

function updateTransactionsTable(id, contents) {
  const hasContent = contents && contents.length > 1;
  if (hasContent) {
    const row = contents.length;
    const col = contents[0].length;
    let tableHTML = getTableTitle(id);

    for (let i = 0; i < row; ++i) {
      tableHTML += i == 0 ? "<thead>" : "";
      tableHTML += "<tr>";
      for (let j = 0; j < col; ++j) {
        tableHTML += j != 1 ? getTranslatedContent(contents[i][j], i == 0) : ""; // Don't add the ID column
        tableHTML +=
          j == col - 1
            ? i == 0
              ? getTranslatedContent(GLOBAL.Status, true) // Add a status column
              : contents[i][0] && new Date(toStringDate(contents[i][0], true)) <= new Date()
                ? parseFloat(contents[i][j]) <= 0
                  ? getTableCheckmark(GLOBAL.completedStatus) // Completed
                  : getTableImage(GLOBAL.DonationStatus) // Donation
                : getTableLoaderBar(GLOBAL.pendingStatus) // Pending
            : "";
      }
      tableHTML += "</tr>";
      tableHTML += i == 0 ? "</thead><tbody>" : i == row - 1 ? "</tbody>" : "";
    } 

    processTable(id, tableHTML);
    openTabAfterConnect(id);
  }

  displayElement(id + "Button", hasContent, 0); // Hide this tab if empty
}

function updatePersonalTable(id, contents) {
  const hasContent = contents && contents.length > 1;
  if (hasContent) {
    const baseFormula = GLOBAL.displayData[id].formula.split("!")[0] + "!";
    let tableHTML = getTableTitle(id);
    const totalCol = indexOf(contents[0], "Total");
    const depositCol = indexOf(contents[0], "Deposit");
    const recurrentCol = indexOf(contents[0], "Recurrent");

    GLOBAL.totalValue = toValue(contents[1][totalCol]);
    GLOBAL.maxRecurrent = Math.max(GLOBAL.totalValue / 12, 100);

    GLOBAL.personalData.forEach((item) => {
      const i = item.index;
      item.range = baseFormula + convertNumberToColumn(i) + contents[1][0];
      item.value = item.readonly || item.disabled ? translate(contents[1][i]) : contents[1][i];
      item.min = recurrentCol ? -GLOBAL.maxRecurrent : null;

      GLOBAL.user[contents[0][i].replaceAll(" ", "")] = contents[1][i];

      tableHTML += "<tr>";
      tableHTML += getTranslatedContent(contents[0][i], false, item);
      tableHTML += "</tr>";
    });

    // Add an Acknowledgment Of Debt row at the end
    const ackDebt = GLOBAL.ackDebt;
    const ackDebtId = ackDebt.replaceAll(" ", "") + "Link";
    const hasHistoric = false & (GLOBAL.data.historic.length > 1);
    if (hasHistoric) {
      tableHTML += "<tr>";
      tableHTML += getTranslatedContent(ackDebt, false, {
        value: translate(ackDebt),
        inputId: ackDebtId,
        type: "url",
      });
      tableHTML += "</tr>";
    }

    processTable(id, tableHTML);
    openTabAfterConnect(id);

    // Acknowledgment of Debt creation when clicking on the link
    if (hasHistoric) {
      $("#" + ackDebtId).click((e) => {
        e.preventDefault();
        CreateAckDebt();
        return false;
      });
    }

    // Set the scrolling panel
    tableHTML = "<marquee direction=\"down\" scrollamount=\"1\" behavior=\"scroll\"><table>";
    for (let i = totalCol; i >= depositCol; --i) {
      tableHTML += "<tr>";
      tableHTML += getTranslatedContent(contents[0][i]);
      tableHTML += getTranslatedContent(contents[1][i]);
      tableHTML += "</tr>";
    }

    tableHTML += "</table></marquee>";
    setHtml("#scrollDiv", tableHTML);
  } else {
    GLOBAL.totalValue = 0;
    GLOBAL.maxRecurrent = 0;
  }

  displayElement(id + "Button", hasContent, 0); // Hide this tab if empty
  displayElement("depositButton", hasContent); // Show the deposit button
  displayElement("withdrawButton", GLOBAL.totalValue > 0); // Show the withdraw button
}

// function updateGlobalTable(id, contents) {
//   const hasContent = contents && contents.length > 1;
//   if (hasContent) {
//     const tableHTML = getTableTitle(id);

//     GLOBAL.globalData.forEach((i) => {
//       --i; // Hack to handle the difference between spreadsheet column and array index
//       const item = {
//         value: translate(contents[i][1]),
//         readonly: true,
//       };

//       tableHTML += "<tr>";
//       tableHTML += getTranslatedContent(contents[i][0], false, item);
//       tableHTML += "</tr>";
//     });

//     processTable(id, tableHTML);
//     openTabAfterConnect(id);
//   }

//   displayElement(id + "Button", hasContent, 0); // Hide this tab if empty
// }

function updateFaqTable(id, contents) {
  // const row = contents.length;
  const col = contents[0].length;
  let tableHTML = getTableTitle(id, false, GLOBAL.showAllButtonToolTip, col - 1);
  tableHTML += "<div style=\"padding: 5px 25px;text-align: center;\">";
  // for (const i = 1; i < row; ++i) {
  //   // Skip the header
  //   for (const j = 0; j < col; ++j) {
  //     const con = contents[i][j];
  //     const isQuestion = j == 0;
  //     const str = "";
  //     con.split(" ").forEach((a) => (str += (a.includes("http") ? getLink(a) : a) + " "));
  //     tableHTML += (isQuestion ? "<b>" : "") + str + (isQuestion ? "</b>" : "") + "<br>";
  //   }
  //   tableHTML += "<br><br>";
  // }
  tableHTML += getLink("http://fims.fi", "<b>Nouveau site : FiMs.fi</b>");
  tableHTML += "</div>";

  processTable(id, tableHTML);
  openTabAfterConnect(id);

  displayElement(id + "Button", true, 0); // Display tab when loaded
  displayElement("connectButton", true); // Show the connect button
}

function openTabAfterConnect(id) {
  if (!GLOBAL.currentDisplayedId || GLOBAL.currentDisplayedId == GLOBAL.displayData.FAQ.id) {
    finishLoading(id);
  }
}

function connect() {
  const d = GLOBAL.personalData[0];
  const id = "userId";
  const content = getTranslatedContent("Enter your user id", false, {
    inputId: id,
    type: d.type,
    minLength: d.minLength,
    maxLength: d.maxLength,
    value: GLOBAL.user.ID,
    erase: true,
    placeholder: translate("User Id"),
  });
  const innerHTML = getPopupContent(id, content);

  openPopup(innerHTML);
  addPopupButtonEvent(id, true);
}

function userIdValidation(result) {
  const id = "userId";
  if ((result == translate("OK") && !$("#" + id).data("error")) || result == translate("CANCEL")) {
    init($("#" + id).val());
    closePopup();
  }
}

function deposit() {
  const id = GLOBAL.depositAmount;
  const content = getTranslatedContent("Amount to deposit", false, {
    inputId: id,
    type: "euro",
    min: 100,
    max: 100000,
    erase: true,
    placeholder: translate("deposit"),
  });
  const innerHTML = getPopupContent(id, content);

  openPopup(innerHTML);
  addPopupButtonEvent(id, true);
}

function depositAmountValidation(result) {
  const id = GLOBAL.depositAmount;
  if (result == translate("OK") && !$("#" + id).data("error")) {
    const value = toCurrency($("#" + id).val());
    const content =
      "<table><tr>" +
      getTranslatedContent("Amount to deposit", true) +
      getTranslatedContent(value) +
      "</tr><tr>" +
      getTranslatedContent("Recipient", true) +
      getTableReadOnlyContent("DE FROCOURT F.") +
      "</tr><tr>" +
      getTranslatedContent("IBAN", true) +
      getTableReadOnlyContent("FR76 4061 8802 5000 0403 8167 244") +
      "</tr><tr>" +
      getTranslatedContent("BIC", true) +
      getTableReadOnlyContent("BOUS FRPP XXX") +
      "</tr><tr>" +
      getTranslatedContent("Bank", true) +
      getTableReadOnlyContent("Boursorama Banque") +
      "</tr><tr>" +
      getTranslatedContent("Bank Address", true) +
      getTableReadOnlyContent("18, quai du Point du Jour 92659 Boulogne-Billancourt Cedex") +
      "</tr></table>";

    const innerHTML = getPopupContent(deposit.name, content, updateDeposit.name);

    openPopup(innerHTML);
    addPopupButtonEvent(GLOBAL.validatePopupButton, false);

    $("#popup").data(id, {
      value: value,
      content: content,
    });
  } else if (result == translate("CANCEL")) {
    closePopup();
  }
}

function updateDeposit() {
  // Get overall data
  const id = GLOBAL.depositAmount;
  const title = toFirstUpperCase(id.replace("Amount", ""));
  const popup = $("#popup").data(id);
  const value = popup.value;
  const data = {
    movement: value,
  };

  // Get confirmation data ready
  const contents = GLOBAL.data[GLOBAL.displayData.historic.id];
  const hasContent = contents && contents.length > 1;

  const a = getTranslateData(title + " " + GLOBAL.confirmation);
  const b = getTranslateData(!hasContent ? GLOBAL.newDeposit : GLOBAL.nextDeposit);
  const content = {
    ope: title,
    title: a.text,
    main: b.tooltip,
    inst: a.tooltip,
    content: popup.content,
  };

  confirmation(content);

  // Send email reminder to myself
  const subject = title + ": " + value + " for " + GLOBAL.user.ID;
  sendRecapEmail(subject, () => insertHistoricRow(data));
}

function withdraw() {
  const id = GLOBAL.withdrawAmount;
  const content =
    getTranslatedContent("Amount to withdraw", false, {
      inputId: id,
      type: "euro",
      min: Math.min(100, GLOBAL.totalValue),
      max: GLOBAL.totalValue,
      erase: true,
      placeholder: translate("withdraw"),
    }) +
    getTranslatedContent("Withdraw period", false, {
      inputId: GLOBAL.withdrawPeriod,
      type: "checkbox",
      class: "toggle",
      label: GLOBAL.withdrawPeriodOption,
      checked: true,
    }) +
    getDiv(
      GLOBAL.withdrawDate + "All",
      null,
      null,
      getTranslatedContent("Withdraw date", false, {
        inputId: GLOBAL.withdrawDate,
        type: "checkbox",
        class: "toggle",
        label: GLOBAL.withdrawDateOption,
        checked: true,
      })
    ) +
    getDiv(
      GLOBAL.withdrawCost + "All",
      null,
      null,
      getTranslatedContent("Operation cost", false, {
        inputId: GLOBAL.withdrawCost,
        disabled: true,
      })
    ) +
    getDiv(
      GLOBAL.withdrawRecurrent + "All",
      null,
      null,
      getTranslatedContent("Current recurrent amount", false, {
        inputId: GLOBAL.withdrawRecurrent,
        disabled: true,
        value: translate(GLOBAL.user.Recurrent),
      })
    );

  const innerHTML = getPopupContent(id, content);

  openPopup(innerHTML);
  addPopupButtonEvent(id, true);

  // Events
  const fnc = () =>
    $("#" + GLOBAL.withdrawCost).val(() =>
      translate(toCurrency(((getDaysBetweenDate(new Date(), getNextMonthDate()) * 4) / 100 / 365) * $("#" + id).val() || 0))
    );
  $("#" + GLOBAL.withdrawAmount).keyup(fnc);
  fnc();
  const fnb = () =>
    displayElement(
      "#" + GLOBAL.withdrawCost + "All",
      !$("#" + GLOBAL.withdrawDate).is(":checked") && $("#" + GLOBAL.withdrawPeriod).is(":checked"),
      0
    );
  $("#" + GLOBAL.withdrawDate).change(fnb);
  fnb();
  const fna = () => {
    const isChecked = $("#" + GLOBAL.withdrawPeriod).is(":checked");
    [GLOBAL.withdrawDate, GLOBAL.withdrawRecurrent].forEach((item) =>
      displayElement(
        "#" + item + "All",
        (item == GLOBAL.withdrawRecurrent && !isChecked) || (item != GLOBAL.withdrawRecurrent && isChecked),
        0
      )
    );
    fnb();
  };
  $("#" + GLOBAL.withdrawPeriod).change(fna);
  fna();
}

function withdrawAmountValidation(result) {
  const id = GLOBAL.withdrawAmount;
  if (result == translate("OK") && !$("#" + id).data("error")) {
    const value = toCurrency($("#" + id).val());
    const period = GLOBAL.withdrawPeriodOption[$("#" + GLOBAL.withdrawPeriod).is(":checked") ? 0 : 1];
    const isRecurrent = period == GLOBAL.withdrawPeriodOption[1];
    if (isRecurrent && -parseFloat(toValue(value)) == parseFloat(toValue(GLOBAL.user.Recurrent))) {
      showSnackBar("The asked recurrent withdraw amount is the same as the current one !");
    } else if (isRecurrent && parseFloat(toValue(value)) > GLOBAL.maxRecurrent) {
      showSnackBar(
        "The asked recurrent withdraw amount can't be more than " + translate(toCurrency(GLOBAL.maxRecurrent)) + " !"
      );
    } else {
      const isNextMonth = $("#" + GLOBAL.withdrawDate).is(":checked") || !$("#" + GLOBAL.withdrawPeriod).is(":checked");
      const date = toStringDate(
        !isNextMonth ? new Date(Math.min(addDaysToDate(5), getNextMonthDate(0))) : getNextMonthDate(5)
      );
      const cost = !isNextMonth ? $("#" + GLOBAL.withdrawCost).val() : toCurrency(0);

      const content =
        "<table><tr>" +
        getTranslatedContent("Amount to withdraw", true) +
        getTranslatedContent(value) +
        "</tr><tr>" +
        getTranslatedContent("Withdraw period", true) +
        getTranslatedContent(period) +
        "</tr><tr>" +
        getTranslatedContent("Withdraw date", true) +
        getTableReadOnlyContent(date) +
        "</tr><tr>" +
        getTranslatedContent("Operation cost", true) +
        getTableReadOnlyContent(cost) +
        "</tr><tr>" +
        getTranslatedContent("Recipient", true) +
        getTableReadOnlyContent(getFullName(GLOBAL.user)) +
        "</tr><tr>" +
        getTranslatedContent("IBAN", true) +
        getTableReadOnlyContent(GLOBAL.user.IBAN) +
        "</tr><tr>" +
        getTranslatedContent("Bank", true) +
        getTableReadOnlyContent(GLOBAL.user.Bank) +
        "</tr></table>";

      const innerHTML = getPopupContent(withdraw.name, content, updateWithdraw.name);

      openPopup(innerHTML);
      addPopupButtonEvent(GLOBAL.validatePopupButton, false);

      $("#popup").data(id, {
        value: value,
        period: period,
        date: date,
        cost: cost,
        content: content,
      });
    }
  } else if (result == translate("CANCEL")) {
    closePopup();
  }
}

function updateWithdraw() {
  // Get overall data
  const id = GLOBAL.withdrawAmount;
  const title = toFirstUpperCase(id.replace("Amount", ""));
  const popup = $("#popup").data(id);
  const value = "-" + popup.value; // Withdraw value should be negative
  const period = popup.period;
  const date = popup.date;
  const cost = popup.cost;

  // Get confirmation data ready
  const a = getTranslateData(title + " " + GLOBAL.confirmation);
  const content = {
    ope: title,
    title: a.text,
    inst: a.tooltip,
    content: popup.content,
  };

  confirmation(content);

  // Send email reminder to myself
  const data = {
    date: date,
    movement: value,
    cost: cost,
  };
  const isUnique = period == GLOBAL.withdrawPeriodOption[0];

  if (isUnique) {
    // Display modified value in the personal tab
    const id = GLOBAL.displayData.personal.id;
    const d = GLOBAL.data[id];
    const i = indexOf(d[0], "Total");
    d[1][i] = toCurrency(roundDown(toValue(d[1][i]) + toValue(value), 2));
    updatePersonalTable(id, GLOBAL.data[id]);
  }

  const subject = period + " " + title + ": " + value + " for " + GLOBAL.user.ID + " for the " + date;
  sendRecapEmail(subject, () => (isUnique ? insertHistoricRow(data) : changeRecurrent(value)));
}

function confirmation(content) {
  // Display confirmation message on popup with a close button
  const id = GLOBAL.confirmation;

  const text =
    "<h2>" +
    content.title +
    "</h2><br>" +
    (content.main ? content.main + "<br><br>" : "") +
    content.inst
      .replace(
        "<" + GLOBAL.completedStatus.split(" ")[0] + ">",
        "<div style=\"position:relative;left:80px;top:13px;height:13px;\">" + getTableCheckmark() + "</div><br>"
      )
      .replace("<" + GLOBAL.pendingStatus.split(" ")[0] + ">", getTableLoaderBar());
  const innerHTML = getPopupContent(id, text);
  openPopup(innerHTML);
  setEvents();

  $("#" + id + "Button").html(translate("OK"));
  $("#" + id + "Button").focus();

  // Send explicit Email to user
  const details = content.content
    ? content.content
      .replace(getTranslateData("Enter your user id").tooltip, "")
      .replace(getTranslateData("IBAN").tooltip, "")
      .replace(getTranslateData("Bank").tooltip, "")
      .replace(getTranslateData("Operation cost").tooltip, "")
    : "";
  const subject = content.title;
  const html =
    (content.main ? "<p>" + content.main + "</p>" : "") +
    "<p>" +
    getTranslateData(content.ope + " mail").tooltip +
    " :</p>" +
    details;
  const message = html
    .replace(/(<\/p>)/gi, "\n\n")
    .replace(/(<\/tr>)/gi, "\n")
    .replace(/(<\/th>)/gi, " : ")
    .replace(/(<([^>]+)>)/gi, "");
  google.script.run.withSuccessHandler().withFailureHandler(displayError).sendEmail(GLOBAL.user.Email, subject, message, {
    htmlBody: html,
  });
}

function confirmationValidation() {
  closePopup();
}

function insertHistoricRow(data) {
  if (data && data.movement) {
    data = [[data.date ?? "", GLOBAL.user.ID, toCurrency(data.movement), data.cost ?? toCurrency(0)]];

    // Display added data in the historic tab
    const id = GLOBAL.displayData.historic.id;
    openTab(id);
    const d = [];
    data[0].forEach((item) => d.push(item)); // Make a copy of data to not be modified by other operation on data
    GLOBAL.data[id].splice(1, 0, d);
    updateHistoricTable(id, GLOBAL.data[id]);
    setEvents();

    // Add data to the database
    data[0][0] = data[0][0] ? toStringDate(data[0][0], true) : ""; // Reverse date as the format is incorrect
    google.script.run
      .withSuccessHandler(() => setValue(GLOBAL.displayData.historic.formula.split("!")[0] + "!A2", data))
      .withFailureHandler(displayError)
      .insertRows(GLOBAL.personalGID, data, {
        startRow: 1,
        endCol: data.length,
      });
  } else {
    throw "data is not set or incomplete";
  }
}

function changeRecurrent(value) {
  // Display modified value in the personal tab
  const id = GLOBAL.displayData.personal.id;
  const d = GLOBAL.data[id];
  const i = indexOf(d[0], "Recurrent");
  d[1][i] = toCurrency(value);
  updatePersonalTable(id, GLOBAL.data[id]);

  // Add data to the database
  const baseFormula = GLOBAL.displayData[id].formula.split("!")[0] + "!";
  setValue(baseFormula + convertNumberToColumn(i) + d[1][0], [[toValue(value)]]);
}

function getTranslatedContent(content, isHeader, data) {
  const isReadOnly = !data || isHeader;
  const d = getTranslateData(content);
  if (!isReadOnly) {
    data.tooltip = d.tooltip;
    data.style =
      (isEditableInput(data.type) ? "width:104px;" : "") +
      (data.type != "checkbox" ? "text-align:center;border:transparent;" : "") +
      (data.style ?? "");
  }

  return isReadOnly
    ? getTableReadOnlyContent(content, isHeader).replace(content, isHeader ? getTooltip(d.text, d.tooltip) : d.text)
    : "<td><h2 style=\"cursor:default;line-height:45px;\">" +
        getTooltip(d.text, d.tooltip) +
        "</h2></td>" +
        (data.readonly || data.disabled
          ? getTableReadOnlyContent(data.value, null, null, null, data.tooltip)
          : getTableEditableContent(data.value, data));
}

function CreateAckDebt() {
  let total = 0;
  const deposit = [];
  GLOBAL.data.historic.forEach((item) => {
    const date = item[0];
    const value = toValue(item[2]);
    if (value > 0 && date) {
      total += value;
      deposit.unshift([date, value]);
    }
  });
  const length = deposit.length;

  // TODO : HAND WRITING
  // montant de la dette (somme à payer) en chiffres
  // montant de la dette en toutes lettres
  // signature et date

  if (length > 0) {
    const signDate = deposit[length - 1][0];
    // const { jsPDF } = window.jspdf;
    // const doc = new jsPDF();
    // doc.setFontSize(20);
    // doc.text(105, 30, 'Reconnaissance de dette', null, null, 'center');
    // doc.setFontSize(11);
    // doc.text(20, 50, 'Je soussigné, DE FROCOURT Florian Henri Olivier, né le 06/04/1982, à Toulouse (31), \n'
    // + 'résidant à ce jour, 5 route de Pentrez - 78550 SAINT-NIC, reconnais avoir reçu de \n'
    // + getFullName(GLOBAL.user) + ', né(e) le ' + GLOBAL.user.BirthDate + ', à ' + GLOBAL.user.BirthCity + ', \n'
    // + 'demeurant à ce jour ' + GLOBAL.user.Address + ' - ' + GLOBAL.user.PostalCode + ' ' + GLOBAL.user.City + ', \n'
    // + 'la somme de ' + total + ' euros à titre de prêt sous la forme du :');
    // deposit.forEach((item, i) => {
    //   doc.circle(30, 77 + i * 5, 0.5, 'FD');
    //   doc.text(33, 78 + i * 5, 'Virement bancaire SEPA de ' + item[1] + ' euros, émis le ' + item[0]);
    // });
    // doc.text(20, 87 + length * 5, 'Le remboursement de ce prêt interviendra de la façon suivante :');
    // doc.circle(30, 94 + length * 5, 0.5, 'FD');
    // doc.text(33, 95 + length * 5, 'il sera remboursé immédiatement (moyennant le temps de virement de compte à compte\n'
    // + 'pouvant aller jusqu\'à 5 jours ouvrés), sur simple demande écrite (courrier électronique, \n'
    // + 'lettre ou autre moyen informatique), en une ou plusieurs fois, à la convenance du prêteur.');
    // doc.text(20, 118 + length * 5, 'Ce prêt est consenti moyennant un intérêt de :');
    // doc.circle(30, 125 + length * 5, 0.5, 'FD');
    // doc.text(33, 126 + length * 5, 'pourcentage librement choisi par l\'emprunteur, ne pouvant pas être en deça de 1,25% l\'an \n'
    // + 'intérêt qui, s\'il n\'est pas réclamé, viendra s\'ajouter mensuellement au capital emprunté.');
    // doc.text(20, 160 + length * 5, 'L\'emprunteur, DE FROCOURT Florian, \n                    Daté et signé');
    // doc.text(190, 160 + length * 5, 'Le prêteur, ' + getFullName(GLOBAL.user) + '\nDaté et signé               ', null, null, 'right');
    // doc.addImage(imgPath + 'Signature.png', 'PNG', 20, 170 + length * 5);

    const isMale = GLOBAL.user.Civility == "Mr";
    let doc =
      "<h2 align=\"center\" style=\"color:black\">Reconnaissance de dette</h2><br>" +
      "<p>Je soussigné, DE FROCOURT Florian Henri Olivier, né le 06/04/1982, à Toulouse (31), " +
      "résidant à ce jour, 5 route de Pentrez - 29550 SAINT-NIC, reconnais avoir reçu de " +
      getFullName(GLOBAL.user) +
      ", né" +
      (isMale ? "" : "e") +
      " le " +
      GLOBAL.user.BirthDate +
      ", à " +
      GLOBAL.user.BirthCity +
      ", demeurant à ce jour, " +
      GLOBAL.user.Address +
      " - " +
      GLOBAL.user.PostalCode +
      " " +
      GLOBAL.user.City +
      ", la somme de " +
      getImgFromNumber(total) +
      getImgTag("€", 15) +
      getImgTag("", 15) +
      getImgTag("(", 15) +
      getImgFromText(numberToText(total)) +
      getImgTag("euros", 15) +
      getImgTag(")", 15) +
      " à titre de prêt sous la forme du :</p><ul>";
    deposit.forEach((item) => (doc += "<li>Virement bancaire SEPA de " + item[1] + " euros, reçu le " + item[0] + "</li>"));
    doc +=
      "</ul><p>Le remboursement de ce prêt interviendra de la façon suivante :</p>" +
      "<ul><li>il sera remboursé immédiatement (moyennant le temps de virement de compte à compte " +
      "pouvant aller jusqu'à 5 jours ouvrés), sur simple demande écrite (courrier électronique, " +
      "lettre ou autre moyen informatique), en une ou plusieurs fois, à la convenance du prêteur.</li></ul>" +
      "<p>Ce prêt est consenti moyennant un intérêt de :</p>" +
      "<ul><li>pourcentage librement choisi par l'emprunteur, à minima 1,2% l'an et à maxima le taux d'usure en vigueur au moment de la signature de la présente reconnaissance de dette. " +
      "En l'absence de reclamation de la part du prêteur, l'intérêt viendra s'ajouter au capital emprunté à la fin de chaque mois calendaire.</li></ul><br><br>" +
      "<span>&emsp;&emsp;L'emprunteur,</span>" +
      "<span style=\"float:right\">&emsp;&emsp;&nbsp;" +
      (isMale ? "&nbsp;Le" : "La") +
      " prêteu" +
      (isMale ? "r" : "se") +
      ",<br>" +
      getFullName(GLOBAL.user) +
      "<br>&emsp;&emsp;Daté et signé</span>" +
      "<br>DE FROCOURT Florian,<br>&emsp;&emsp;Daté et signé<br><br>" +
      "&emsp;&emsp;&emsp;" +
      getImgTag("Le", 15) +
      "&emsp;" +
      getImgFromNumber(signDate) +
      "<br>" +
      getImgTag("Signature");

    const title = translate(GLOBAL.ackDebt) + " - FiMs " + GLOBAL.user.ID;
    // const data = doc.output('bloburl', title + '.pdf');
    // This piece of code doesn't work on Google App Script
    // const html = '<span style="color:black; font-size:33px; padding:0px 0px 15px 0px;" '
    //   + 'class="closebtn" onclick="closePopup(() => $(\'#popup\').removeAttr(\'style\'));">&times;</span>'
    //   + '<iframe src="' + data + '" style="border:none; top:0px; left:0px; bottom:0px;'
    //   + ' right:0px; width:100%; height:100%;" allowfullscreen></iframe>';
    const html =
      "<span style=\"font-size:33px; padding:0px 0px 15px 0px;\" " +
      "class=\"closebtn\" onclick=\"closePopup(() => $('#popup').removeAttr('style'));\">&times;</span>" +
      "<button onclick=\"printHtml('#ackDebtDiv', '" +
      title +
      "')\">" +
      translate("Print") +
      "</button>" +
      "<div id=\"ackDebtDiv\" style=\"width:560px; position:relative; margin:25px auto; padding:25px; background:white;\">" +
      doc +
      "</div>";

    openPopup(html);
    $("#popup").css({
      margin: "5%",
      height: "auto",
      width: "auto",
      minWidth: "650px",
      minHeight: "500px",
      overflow: "auto",
      background: "slategray",
    });

    // let mywindow = window.open('', 'PRINT', 'height=650,width=900,top=100,left=150');
    //
    //   mywindow.document.write(`<html><head><title>${title}</title>`);
    //   mywindow.document.write('</head><body >');
    //   mywindow.document.write($('#ackDebtDiv').html());
    //   mywindow.document.write('</body></html>');
    //
    //   mywindow.document.close(); // necessary for IE >= 10
    //   mywindow.focus(); // necessary for IE >= 10*/
    //
    //   mywindow.print();
    //   mywindow.close();

    // const html = '<span style="color:black; font-size:33px; padding:0px 0px 15px 0px; font-weight:bold; float:right; cursor:pointer;" '
    //   + 'class="closebtn" onclick="window.close();">&times;</span>'
    //   + '<button id="download">' + translate('Download') + '</button>'
    //   + '<iframe id="jsPDF" src="' + data + '" style="border:none; top:0px; left:0px; bottom:0px;'
    //   + ' right:0px; width:100%; height:100%;" allowfullscreen></iframe>';

    // const newWindow = window.open();
    // newWindow.document.open();
    // newWindow.document.write(html);
    // newWindow.document.getElementById("download").onclick = () =>  doc.save(title + '.pdf');
    // newWindow.document.close();
    // newWindow.addEventListener('load', event => newWindow.document.title = title);
  }
}

function getImgTag(name, height) {
  return (
    "<img style=\"cursor:default; filter:none; " +
    (height ? "height:" + height + "px;" : "") +
    "\" src=\"" +
    GLOBAL.serverUrl +
    "Img/AckDebt/" +
    name +
    ".png\">"
  );
}

function getImgFromNumber(number) {
  let html = "";
  const text = number.toString();
  for (let i = 0; i < text.length; ++i) {
    html += getImgTag(text[i].replace("/", "slash"), 15);
  }

  return html;
}

function getImgFromText(text) {
  let html = "";
  const height = 20;
  text = text.replaceAll("-", " - ");
  const array = text.split(" ");
  array.forEach(
    (item, i) => (html += getImgTag(item, height) + (item != "-" && array[i + 1] != "-" ? getImgTag("", height) : ""))
  );

  return html;
}

function numberToText(number) {
  const ones = [
    "",
    "un ",
    "deux ",
    "trois ",
    "quatre ",
    "cinq ",
    "six ",
    "sept ",
    "huit ",
    "neuf ",
    "dix ",
    "onze ",
    "douze ",
    "treize ",
    "quatorze ",
    "quinze ",
    "seize ",
    "dix-sept ",
    "dix-huit ",
    "dix-neuf ",
  ];
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "", "quatre-vingt", ""];
  const hundred = "cent";
  const thousand = "mille ";
  const text = number.toString();
  if (text.length <= 6) {
    const n = ("000000" + text).substr(-6).match(/^(\d{1})(\d{2})(\d{1})(\d{2})$/);
    if (n) {
      const junc = (i) => {
        const a = i[0];
        const b = tens[a] ? i[1] : Number(i[1]) + 10;
        return a == 8 && b == 0 ? "s" : a < 8 && (b == 1 || b == 11) ? " et " : b >= 1 ? "-" : "";
      };
      let str = "";
      str += n[1] != 0 ? (n[1] > 1 ? ones[Number(n[1])] : "") + hundred + (n[1] > 1 ? "s " : " ") : "";
      str +=
        (n[2] != 0 ? (n[2] > 1 ? ones[Number(n[2])] || tens[n[2][0]] + " " + ones[n[2][1]] : "") : "") +
        (n[1] + n[2] != 0 ? thousand : "");
      str += n[3] != 0 ? (n[3] > 1 ? ones[Number(n[3])] : "") + hundred + (n[3] > 1 ? "s " : " ") : "";
      str +=
        n[4] != 0
          ? ones[Number(n[4])] ||
            (tens[n[4][0]]
              ? tens[n[4][0]] + junc(n[4]) + ones[n[4][1]]
              : tens[Number(n[4][0]) - 1] + junc(n[4]) + ones[Number(n[4][1]) + 10])
          : "";
      return str.trim();
    }
  } else {
    throw "number is too high to be processed: " + text;
  }
}

function printHtml(id, title) {
  const html =
    "<html><head><link rel=\"stylesheet\" href=\"" +
    GLOBAL.scriptUrl +
    "Stylesheet.css\"><title>" +
    title +
    "</title>" +
    "</head><body style=\"margin:0% 20%;\">" +
    $(id).html() +
    "</body></html>";
  const printWindow = window.open("", "", "width=" + screen.width + ",height=" + screen.height);
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
  setTimeout(() => printWindow.close(), 100);
}

function getFullName(person) {
  return person.FamilyName.toUpperCase() + " " + person.FirstName;
}

function convertNumberToColumn(number) {
  // 0 => A, 1 => B, etc
  let t = 0;
  let s = "";
  while (number > 0) {
    t = (number - 1) % 26;
    s = String.fromCharCode(66 + t) + s;
    number = ((number - t) / 26) | 0;
  }

  return s;
}

// function validateIbanChecksum(iban) {
//   const ibanStripped = iban.replace(/[^A-Z0-9]+/gi, '') //keep numbers and letters only
//     .toUpperCase(); //calculation expects upper-case
//   const m = ibanStripped.match(/^([A-Z]{2})([0-9]{2})([A-Z0-9]{9,30})$/);
//   if (!m) return false;
//
//   const numbericed = (m[3] + m[1] + m[2]).replace(/[A-Z]/g, function(ch) {
//     //replace upper-case characters by numbers 10 to 35
//     return (ch.charCodeAt(0) - 55);
//   });
//   //The resulting number would be to long for javascript to handle without loosing precision.
//   //So the trick is to chop the string up in smaller parts.
//   const mod97 = numbericed.match(/\d{1,7}/g)
//     .reduce(function(total, curr) {
//       return Number(total + curr) % 97;
//     }, '');
//
//   return (mod97 === 1);
// }
