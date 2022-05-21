/* global GmailApp, FR, FC, SS, FM, _getSheet, _isCurrentMonth, _copyFirstRow,
_sendMessage, _toDate, _insertFirstRow, _round*/
/* exported updateAssociate, sendCharity */



// ASSOCIATE COLS
const ID_COL = 2;               // Should be the "ID" column
const EMAIL_COL = 3;            // Should be the "EMail" column
const BIRTHDAY_COL = 7;         // Should be the "Newsletter" column
const NEWSLETTER_COL = 15;      // Should be the "Newsletter" column

// SHEET NAMES
const ID = 'ID';                // The "ID" sheet name

// MISC
const YES = 'Oui';            


// SHOULD RUN ONCE A MONTH
function reminderNewsLetter() {
  // Retrieve associate main data
  const sheet = _getSheet(ID);
  const array = sheet.getSheetValues(FR, FC, -1, -1);

  // List all newsletter subscribers
  const object = 'Associate Mail Reminder /!\\ BCC /!\\';
  let list = '';
  for (let i = 0; i < array.length; ++i) {
    list += array[i][NEWSLETTER_COL-1].toString().toLowerCase() == YES.toLowerCase() 
      ? array[i][EMAIL_COL-1] + ',' : '';
  }

  // Message with list send to myself
  if (list != '') {
    _sendMessage(object, list.slice(0, -1));  // Remove last comma at the end of the list
  }
}

// SHOULD RUN ONCE A DAY
function reminderBirthday() {
  // Retrieve associate main data
  const sheet = _getSheet(ID);
  const array = sheet.getSheetValues(FR, FC, -1, -1);

  // Send a reminder for FiMs Associate whose birthday is today
  for (let i = 0; i < array.length; ++i) {
    const birthday = [[array[i][BIRTHDAY_COL-1]]];

    if (_isCurrentMonth(birthday) && _isCurrentDay(birthday)) {
      const name = array[i][ID_COL-1];
      const email = array[i][EMAIL_COL-1];
      const object = name + '\'s Birthday (FiMs Associate)';
      _sendMessage(object, 'Happy Birthday ' + name + ' !!!\n\nWish her/him by email at ' + email);
    }
  }
}