/* global FR, FC, _getSheet, _isCurrentMonth, _isCurrentDay, _sendMessage*/
/* exported reminderBirthday */

// How to add new merchant
// 1. Go to Solflare:
//   - add a new wallet
//   - send 0.01 sol
//   - add agEUR
// 2. Go to FiMs ID > Merchant:
//   - Add a new row with merchant details
// 3. Go to FiMs Pay code:
//   - Add a new entry with merchant details in point-of-sale>src>server>data>merchant.json
// 4. Go to FiMs code:
//   - Add a logo to FiMs>Img>Merchant named <id>.jpg (eg: 5.jpg for merchant whose id is 5)
// 5. Go to FiMs web site:
//   - Add merchant to the map
//   - Add merchant to the payment list

// ASSOCIATE COLS
const ID_COL = 2; // Should be the "ID" column
const EMAIL_COL = 3; // Should be the "EMail" column
const BIRTHDAY_COL = 7; // Should be the "Birth date" column

// SHEET NAMES
const ASSOCIATE = "Associate"; // The "Associate" sheet name
const KEY = "Key"; // The "Key" sheet name

// SHOULD RUN ONCE A DAY
function reminderBirthday() {
  // Retrieve associate main data
  const sheet = _getSheet(ASSOCIATE);
  const array = sheet.getSheetValues(FR, FC, -1, -1);

  // Send a reminder for FiMs Associate whose birthday is today
  for (let i = 0; i < array.length; ++i) {
    const birthday = [[array[i][BIRTHDAY_COL - 1]]];

    if (_isCurrentDay(birthday) && _isCurrentMonth(birthday)) {
      const name = array[i][ID_COL - 1];
      const email = array[i][EMAIL_COL - 1];
      const object = name + "'s Birthday (FiMs Associate)";
      _sendMessage(object, "Happy Birthday " + name + " !!!\n\nWish her/him by email at " + email, true);
    }
  }
}

// SHOULD RUN ONCE A DAY
function generateKey() {
  const length = 64;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&~#{}()[]|_<>^@=+-";
  let key = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
      key += charset.charAt(Math.floor(Math.random() * n));
  }
  _insertFirstRow(_getSheet(KEY), [[key]], true, 1);
}
