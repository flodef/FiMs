GLOBAL.translation = 'translation';
GLOBAL.translationFormula = 'Translation!A:D';
GLOBAL.depositAmount = 'depositAmount';
GLOBAL.withdrawAmount = 'withdrawAmount';
GLOBAL.withdrawPeriod = 'withdrawPeriod';
GLOBAL.withdrawDate = 'withdrawDate';
GLOBAL.withdrawCost = 'withdrawCost';
GLOBAL.withdrawRecurrent = 'withdrawRecurrent';
GLOBAL.confirmation = 'confirmation';
GLOBAL.newDeposit = 'New deposit';
GLOBAL.nextDeposit = 'Next deposit';
GLOBAL.validatePopupButton = 'validatePopupButton';
GLOBAL.personalGID = 911574160;
GLOBAL.Status = 'Status';
GLOBAL.completedStatus = 'Completed !';
GLOBAL.pendingStatus = 'Pending ...';
GLOBAL.DonationStatus = 'Donation';
GLOBAL.withdrawPeriodOption = ['Unique', 'Recurrent'];
GLOBAL.withdrawDateOption = ['Start of next month', 'Immediat'];

GLOBAL.displayData = {
  'account': {id:'account', formula:'!A:N', updateTable:updateAccountTable, loadOnce:true},
  'historic': {id:'historic', formula:'AssociateHistoric!A:D', updateTable:updateHistoricTable, loadOnce:true, filter:1},
  'personal': {id:'personal', formula:'Associate!A:AA', updateTable:updatePersonalTable, loadOnce:true, filter:1},
  'FAQ': {id:'FAQ', formula:'FAQ!A:B', updateTable:updateFaqTable, loadOnce:true }
};
GLOBAL.menuButton = ['deposit', 'withdraw', 'connect'];
GLOBAL.personalData = [
  { index:1, readonly:true, type:'name', minLength:5, maxLength:10, required:true }, // ID
  { index:15, readonly:true, type:'name', required:true },                           // First name
  { index:16, readonly:true, type:'name', required:true },                           // Family name
  { index:14, readonly:true, type:'email', required:true },                          // Email
  { index:17, disabled:true, type:'date', required:true },                           // Birth date
  { index:18, readonly:true, type:'text', required:true },                           // Birth city
  { index:19, readonly:true, type:'text', required:true, maxLength:100 },            // Address
  { index:20, readonly:true, type:'text', required:true, pattern:'^[0-9]{5}$' },     // Postal code
  { index:21, readonly:true, type:'name', required:true },                           // City
  { index:22, readonly:true, type:'iban', required:true },                           // IBAN
  { index:23, readonly:true, type:'name', required:true },                           // Bank
  { index:24, readonly:true, type:'name', required:true },                           // Association
  { index:25, readonly:true, type:'url' },                            // Web page
  { index:2, type:'euro', min:-1000, max:0 },                         // Recurrent
  { index:6, disabled:true },                                         // Estimate rate
  { index:7, disabled:true },                                         // Estimate gain
  { index:5, disabled:true },                                         // Financed project
  { index:3, disabled:true },                                         // Charity
  { index:4, disabled:true },                                         // Donated
  { index:8, disabled:true },                                         // Duration
  { index:26, type:'url', disabled:true }                             // Debt recognition
];

GLOBAL.totalValue = 0;
GLOBAL.recurrentValue = 0;

//THIS PAGE SHORTENED URL : https://bit.ly/3eiucSP

/**
 * Run initializations on web app load.
 */
$(() => {
  getValue({ id:GLOBAL.translation, formula:GLOBAL.translationFormula }, null, true, loadPage);
});

function init() {
  GLOBAL.displayId.forEach(id => displayElement('#' + id + 'Button', false, 0));  // Hide all tab on init

  google.script.run
    .withSuccessHandler(setUserId)
    .withFailureHandler(displayError)
    .getProperty('userId');
}

function onKeyUp(e) {}

function updateAccountTable(id, contents) {
  const hasContent = contents;
  if (hasContent) {
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
    tableHTML += '<tr id="' + id + 'Footer"></tr></tfoot>';

    processTable(id, tableHTML);
    openTabAfterConnect(id);
  }

  displayElement('#' + id + 'Button', hasContent, 0);  // Hide this tab if empty
}

function updateHistoricTable(id, contents) {
  const hasContent = contents && contents.length > 1;
  if (hasContent) {
    var row = contents.length;
    var col = contents[0].length;
    var tableHTML = getTableTitle(id);

    for (var i = 0; i < row; ++i) {
      tableHTML += i==0 ? '<thead>' : '';
      tableHTML += '<tr>';
      for (var j = 0; j < col; ++j) {
        tableHTML += j != 1 ? getTranslatedContent(contents[i][j], i == 0) : '';  // Don't add the ID column
        tableHTML += j == col-1
          ? i == 0 ? getTranslatedContent(GLOBAL.Status, true)                    // Add a status column
            : contents[i][0] && new Date(toStringDate(contents[i][0], true)) <= new Date()
              ? parseFloat(contents[i][j]) <= 0
                ? getTableCheckmark(GLOBAL.completedStatus)                       // Completed
                : getTableImage(GLOBAL.DonationStatus)                              // Donation
              : getTableLoaderBar(GLOBAL.pendingStatus)                             // Pending
          : '';
      }
      tableHTML += '</tr>';
      tableHTML += i==0 ? '</thead><tbody>'
        : i==contents.length-1 ? '</tbody><tfoot>' : '';
    }
    tableHTML += '<tr id="' + id + 'Footer"></tr></tfoot>';

    processTable(id, tableHTML);
    openTabAfterConnect(id);
  }

  displayElement('#' + id + 'Button', hasContent, 0);  // Hide this tab if empty
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
      item.value = item.readonly || item.disabled ? translate(contents[1][i]) : contents[1][i];

      tableHTML += '<tr>';
      tableHTML += getTranslatedContent(contents[0][i], false, item);
      tableHTML += '</tr>';
    });

    tableHTML += '<tr id="' + id + 'Footer"></tr></tfoot>';
    processTable(id, tableHTML);
    openTabAfterConnect(id);

    // Set the scrolling panel
    tableHTML = '<marquee direction="down" scrollamount="1" behavior="scroll" style="width:250px;height:60px;margin:15px"><table>';
    const totalCol = indexOf(contents[0], 'Total');
    const depositCol = indexOf(contents[0], 'Deposit');
    for (var i = totalCol; i >= depositCol; --i) {
      tableHTML += '<tr>';
      tableHTML += getTranslatedContent(contents[0][i]);
      tableHTML += getTranslatedContent(contents[1][i]);
      tableHTML += '</tr>';
    }

    tableHTML += '</table></marquee>';
    setHtml('#scrollDiv', tableHTML);

    GLOBAL.totalValue = toValue(contents[1][totalCol]);
    GLOBAL.recurrentValue = contents[1][indexOf(contents[0], 'Recurrent')];
    GLOBAL.userEmail = contents[1][indexOf(contents[0], 'Email')];
    GLOBAL.userFullName = contents[1][indexOf(contents[0], 'Family Name')].toUpperCase()
      + ' ' + contents[1][indexOf(contents[0], 'First Name')];
  }

  displayElement('#depositButton', hasContent); // Show the deposit button
  displayElement('#withdrawButton', GLOBAL.totalValue > 0); // Show the withdraw button
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

  openTabAfterConnect(id);                // Activate first tab as open by default
  displayElement('#connectButton', true); // Show the connect button
}

function openTabAfterConnect(id) {
  if (!GLOBAL.currentDisplayedId || GLOBAL.currentDisplayedId == GLOBAL.displayData.FAQ.id) {
    displayElement('#loaderBar', false, 0); // Hide the loader bar
    openTab(id);
  }
}

function connect() {
  const d = GLOBAL.personalData[0];
  const id = 'userId';
  const content = getTranslatedContent('Enter your user id', false,
    {inputId:id, type:d.type, minLength:d.minLength, maxLength:d.maxLength, value:GLOBAL.userId,
      erase:true, placeholder:translate('User Id')});
  const innerHTML = getPopupContent(id, content);

  openPopup(innerHTML);
  addPopupButtonEvent(id, true);
}

function userIdValidation(result) {
  const id = 'userId';
  if ((result == translate('OK') && !$('#' + id).data('error')) || result == translate('CANCEL')) {
    setUserId($('#' + id).val());
    closePopup();
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
        $('#' + id + 'Div').html('');                         // Clear all tab content except faq
      }
      displayElement('#' + id + 'Button', GLOBAL.userId, 0);  // Display/Hide all tab depending on the connection state
    });
    GLOBAL.currentDisplayedId = null;                         // Unselect the current displayed tab

    if (id) {
      GLOBAL.displayData.account.formula = id + '!' + GLOBAL.displayData.account.formula.split('!')[1];   // Create user account formula
      updateAllValues();                                      // Load all data
    } else {    // No user
      openTab(faqId);                                         // Open first the faq tab (in case of disconnection)
      $('#scrollDiv').html('');                               // Clear the scroll marquee content
      displayElement('#' + faqId + 'Button', true, 0);        // Display only the faq
      if (!GLOBAL.data[faqId]) {                              // Don't load twice the faq
        updateValues(faqId);                                  // Load only the faq
      }
      displayElement('#depositButton', false, 0);             // Hide the deposit button
      displayElement('#withdrawButton', false, 0);            // Hide the withdraw button
    }
  }
}

function deposit() {
  const id = GLOBAL.depositAmount;
  const content = getTranslatedContent('Amount to deposit', false,
    {inputId:id, type:'euro', min:100, max:100000, erase:true, placeholder:translate('deposit')});
  const innerHTML = getPopupContent(id, content);

  openPopup(innerHTML);
  addPopupButtonEvent(id, true);
}

function depositAmountValidation(result) {
  const id = GLOBAL.depositAmount;
  if (result == translate('OK') && !$('#' + id).data('error')) {
    const value = toCurrency($('#' + id).val());
    const content = '<table><tr>'
      + getTranslatedContent('Amount to deposit', true) + getTranslatedContent(value) + '</tr><tr>'
      + getTranslatedContent('Recipient', true) + getTableReadOnlyContent('DE FROCOURT F.') + '</tr><tr>'
      + getTranslatedContent('IBAN', true) + getTableReadOnlyContent('FR76 4061 8802 5000 0403 8167 244') + '</tr><tr>'
      + getTranslatedContent('BIC', true) + getTableReadOnlyContent('BOUS FRPP XXX') + '</tr><tr>'
      + getTranslatedContent('Bank', true) + getTableReadOnlyContent('Boursorama Banque') + '</tr><tr>'
      + getTranslatedContent('Bank Address', true) + getTableReadOnlyContent('18, quai du Point du Jour 92659 Boulogne-Billancourt Cedex') + '</tr></table>';

    const innerHTML = getPopupContent(deposit.name, content, updateDeposit.name);

    openPopup(innerHTML);
    addPopupButtonEvent(GLOBAL.validatePopupButton, false);

    $('#popup').data(id, {value:value, content:content});
  } else if (result == translate('CANCEL')) {
    closePopup();
  }
}

function updateDeposit() {
  // Get overall data
  const id = GLOBAL.depositAmount;
  const title = toFirstUpperCase(id.replace('Amount', ''));
  const popup = $('#popup').data(id);
  const value = popup.value;
  const data = {movement:value};

  // Get confirmation data ready
  const contents = GLOBAL.data[GLOBAL.displayData.historic.id];
  const hasContent = contents && contents.length > 1;

  const a = getTranslateData(title + ' ' + GLOBAL.confirmation);
  const b = getTranslateData(!hasContent ? GLOBAL.newDeposit : GLOBAL.nextDeposit);
  const content = {ope:title, title:a.text, main:b.tooltip, inst:a.tooltip, content:popup.content};

  confirmation(content);

  // Send email reminder to myself
  const subject = title + ': ' + value + ' for ' + GLOBAL.userId;
  google.script.run
    .withSuccessHandler(contents => insertHistoricRow(data))
    .withFailureHandler(displayError)
    .sendRecapEmail(subject);
}

function withdraw() {
  const id = GLOBAL.withdrawAmount;
  const content = getTranslatedContent('Amount to withdraw', false,
    {inputId:id, type:'euro', min:Math.min(100, GLOBAL.totalValue), max:GLOBAL.totalValue, erase:true, placeholder:translate('withdraw')})
      + getTranslatedContent('Withdraw period', false,
        {inputId:GLOBAL.withdrawPeriod, type:'checkbox', class:'toggle', label:GLOBAL.withdrawPeriodOption, checked:true})
      + getDiv(GLOBAL.withdrawDate + 'All', null, null,
        getTranslatedContent('Withdraw date', false,
          {inputId:GLOBAL.withdrawDate, type:'checkbox', class:'toggle', label:GLOBAL.withdrawDateOption, checked:true}))
      + getDiv(GLOBAL.withdrawCost + 'All', null, null,
        getTranslatedContent('Operation cost', false,
          {inputId:GLOBAL.withdrawCost, disabled:true}))
      + getDiv(GLOBAL.withdrawRecurrent + 'All', null, null,
        getTranslatedContent('Current recurrent amount', false,
          {inputId:GLOBAL.withdrawRecurrent, disabled:true, value:translate(GLOBAL.recurrentValue)}));

  const innerHTML = getPopupContent(id, content);

  openPopup(innerHTML);
  addPopupButtonEvent(id, true);

  // Events
  const fnc = () => $('#' + GLOBAL.withdrawCost).val(() =>
    translate(toCurrency(getDaysBetweenDate(new Date(), getNextMonthDate()) * 4/100/365 * $('#' + id).val() || 0)));
  $('#' + GLOBAL.withdrawAmount).keyup(fnc);
  fnc();
  const fnb = () => displayElement('#' + GLOBAL.withdrawCost + 'All',
    !$('#' + GLOBAL.withdrawDate).is(':checked') && $('#' + GLOBAL.withdrawPeriod).is(':checked'), 0);
  $('#' + GLOBAL.withdrawDate).change(fnb);
  fnb();
  const fna = () => {
    const isChecked = $('#' + GLOBAL.withdrawPeriod).is(':checked');
    [GLOBAL.withdrawDate, GLOBAL.withdrawRecurrent].forEach(item =>
      displayElement('#' + item + 'All', (item == GLOBAL.withdrawRecurrent && !isChecked) || (item != GLOBAL.withdrawRecurrent && isChecked), 0));
    fnb();
  };
  $('#' + GLOBAL.withdrawPeriod).change(fna);
  fna();
}

function withdrawAmountValidation(result) {
  const id = GLOBAL.withdrawAmount;
  if (result == translate('OK') && !$('#' + id).data('error')) {
    const value = toCurrency($('#' + id).val());
    const period = GLOBAL.withdrawPeriodOption[$('#' + GLOBAL.withdrawPeriod).is(':checked') ? 0 : 1];
    if (period != GLOBAL.withdrawPeriodOption[1] || -parseFloat(toValue(value)) != parseFloat(toValue(GLOBAL.recurrentValue))) {
      const isNextMonth = $('#' + GLOBAL.withdrawDate).is(':checked') || !$('#' + GLOBAL.withdrawPeriod).is(':checked');
      const date = toStringDate(!isNextMonth ? new Date(Math.min(addDaysToDate(5), getNextMonthDate(0))) : getNextMonthDate(5));
      const cost = !isNextMonth ? $('#' + GLOBAL.withdrawCost).val() : toCurrency(0);

      const data = GLOBAL.data[GLOBAL.displayData.personal.id];

      const content = '<table><tr>'
      + getTranslatedContent('Amount to withdraw', true) + getTranslatedContent(value) + '</tr><tr>'
      + getTranslatedContent('Withdraw period', true) + getTranslatedContent(period) + '</tr><tr>'
      + getTranslatedContent('Withdraw date', true) + getTableReadOnlyContent(date) + '</tr><tr>'
      + getTranslatedContent('Operation cost', true) + getTableReadOnlyContent(cost) + '</tr><tr>'
      + getTranslatedContent('Recipient', true) + getTableReadOnlyContent(GLOBAL.userFullName) + '</tr><tr>'
      + getTranslatedContent('IBAN', true) + getTableReadOnlyContent(data[1][indexOf(data[0], 'IBAN')]) + '</tr><tr>'
      + getTranslatedContent('Bank', true) + getTableReadOnlyContent(data[1][indexOf(data[0], 'Bank')]) + '</tr></table>';

      const innerHTML = getPopupContent(withdraw.name, content, updateWithdraw.name);

      openPopup(innerHTML);
      addPopupButtonEvent(GLOBAL.validatePopupButton, false);

      $('#popup').data(id, {value:value, period:period, date:date, cost:cost, content:content});
    } else {
      showSnackBar('The asked recurrent withdraw amount is the same as the current one !');
    }
  } else if (result == translate('CANCEL')) {
    closePopup();
  }
}

function updateWithdraw() {
  // Get overall data
  const id = GLOBAL.withdrawAmount;
  const title = toFirstUpperCase(id.replace('Amount', ''));
  const popup = $('#popup').data(id);
  const value = '-' + popup.value;   // Withdraw value should be negative
  const period = popup.period;
  const date = popup.date;
  const cost = popup.cost;

  // Get confirmation data ready
  const a = getTranslateData(title + ' ' + GLOBAL.confirmation);
  const content = {ope:title, title:a.text, inst:a.tooltip, content:popup.content};

  confirmation(content);

  // Send email reminder to myself
  const data = {date:date, movement:value, cost:cost};
  const isUnique = period == GLOBAL.withdrawPeriodOption[0];

  if (isUnique) {
    // Display modified value in the personal tab
    const id = GLOBAL.displayData.personal.id;
    var d = GLOBAL.data[id];
    const i = indexOf(d[0], 'Total');
    d[1][i] = toCurrency(roundDown(toValue(d[1][i]) + toValue(value), 2));
    updatePersonalTable(id, GLOBAL.data[id]);
  }

  const subject = period + ' ' + title + ': ' + value + ' for ' + GLOBAL.userId + ' for the ' + date;
  google.script.run
    .withSuccessHandler(contents => isUnique ? insertHistoricRow(data) : changeRecurrent(value))
    .withFailureHandler(displayError)
    .sendRecapEmail(subject);
}

function confirmation(content) {
  // Display confirmation message on popup with a close button
  const id = GLOBAL.confirmation;

  const text = '<h2>' + content.title + '</h2><br>' + (content.main ? content.main + '<br><br>' : '') + content.inst
    .replace('<' + GLOBAL.completedStatus.split(' ')[0] + '>', '<div style="position:relative;left:80px;top:13px;height:13px;">' + getTableCheckmark() + '</div><br>')
    .replace('<' + GLOBAL.pendingStatus.split(' ')[0] + '>', getTableLoaderBar());
  const innerHTML = getPopupContent(id, text);
  openPopup(innerHTML);
  setEvents();

  $('#' + id + 'Button').html(translate('OK'));
  $('#' + id + 'Button').focus();

  // Send explicit Email to user
  const details = content.content
    ? content.content
      .replace(getTranslateData('Enter your user id').tooltip, '')
      .replace(getTranslateData('IBAN').tooltip, '')
      .replace(getTranslateData('Bank').tooltip, '')
      .replace(getTranslateData('Operation cost').tooltip, '')
    : '';
  const subject = content.title;
  const html = (content.main ? '<p>' + content.main + '</p>' : '') + '<p>'
    + getTranslateData(content.ope + ' mail').tooltip + ' :</p>' + details;
  var message = html
    .replace(/(<\/p>)/ig, '\n\n')
    .replace(/(<\/tr>)/ig, '\n')
    .replace(/(<\/th>)/ig, ' : ')
    .replace(/(<([^>]+)>)/ig, '');
  google.script.run
    .withSuccessHandler()
    .withFailureHandler(displayError)
    .sendEmail(GLOBAL.userEmail, subject, message, {htmlBody:html});
}

function confirmationValidation(result) {
  closePopup();
}

function insertHistoricRow(data) {
  if (data && data.movement) {
    data = [[data.date ?? '', GLOBAL.userId, toCurrency(data.movement), data.cost ?? toCurrency(0)]];

    // Display added data in the historic tab
    const id = GLOBAL.displayData.historic.id;
    openTab(id);
    var d = [];
    data[0].forEach(item => d.push(item));  // Make a copy of data to not be modified by other operation on data
    GLOBAL.data[id].splice(1, 0, d);
    updateHistoricTable(id, GLOBAL.data[id]);
    setEvents();

    // Add data to the database
    data[0][0] = data[0][0] ? toStringDate(data[0][0], true) : '';    // Reverse date as the format is incorrect
    google.script.run
      .withSuccessHandler(contents => setValue(GLOBAL.displayData.historic.formula.split('!')[0] + '!A2', data))
      .withFailureHandler(displayError)
      .insertRows(GLOBAL.personalGID, data, {startRow:1, endCol:data.length});
  } else {
    throw 'data is not set or incomplete';
  }
}

function changeRecurrent(value) {
  // Display modified value in the personal tab
  const id = GLOBAL.displayData.personal.id;
  var d = GLOBAL.data[id];
  const i = indexOf(d[0], 'Recurrent');
  d[1][i] = toCurrency(value);
  updatePersonalTable(id, GLOBAL.data[id]);

  // Add data to the database
  const baseFormula = GLOBAL.displayData[id].formula.split('!')[0] + '!';
  setValue(baseFormula + convertNumberToColumn(i) + d[1][0], [[toValue(value)]]);
}

function getTranslatedContent(content, isHeader, data) {
  const isReadOnly = !data || isHeader;
  const d = getTranslateData(content);
  if (!isReadOnly) {
    data.tooltip = d.tooltip;
    data.style = (isEditableInput(data.type) ? 'width:104px;' : '')
      + (data.readonly || data.disabled ? 'background:transparent;' : '')
      + 'text-align:center;line-height:45px;border:transparent;' + (data.style ?? '');
  }

  return isReadOnly
    ? getTableReadOnlyContent(content, isHeader).replace(content, isHeader
      ? '<div class="tooltip">' + d.text + (d.tooltip ? '<span class="tooltiptext">' + d.tooltip + '</span>' : '') + '</div>'
      : d.text)
    : '<td><h2 style="cursor:default">' + d.text + '</h2></td>' + getTableEditableContent(data.value, data);
}

function convertNumberToColumn(number) {    // 0 => A, 1 => B, etc
  var t;
  var s = '';
  while (number > 0) {
    t = (number - 1) % 26;
    s = String.fromCharCode(66 + t) + s;
    number = (number - t)/26 | 0;
  }

  return s;
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
    .reduce(function(total, curr){ return Number(total + curr)%97;},'');

  return (mod97 === 1);
}
