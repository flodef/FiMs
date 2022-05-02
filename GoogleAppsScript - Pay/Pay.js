/* global _getSheet, _sendMessage, _toCurrency, _toStringTime, _isCurrentDay,
_setRangeValues, FR, FC, GmailApp */
/* exported withdraw */



// TRANSACTIONS COLS
const DATE_COL = 1;             // Should be the "Date" column
const AMOUNT_COL = 2;           // Should be the "Amount" column
const MERCHANT_COL = 3;         // Should be the "Merchant" column

// MERCHANT COLS
const ID_COL = 1;               // Should be the "ID" column
const EMAIL_COL = 2;            // Should be the "EMail" column
const COMPANY_COL = 3;          // Should be the "Company" column
const IBAN_COL = 4;             // Should be the "IBAN" column
const TRATE_COL = 5;            // Should be the "Rate" column
const CRYPTOADD_COL = 6;        // Should be the "Crypto Address" column
const DRATE_COL = 7;            // Should be the "Rate" column
const NOTPAID_COL = 9;          // Should be the "Not Paid" column

// SHEET NAMES
const MERCHANT = 'Merchant';                  // The "Merchant" sheet name
const TRANSACTIONS = 'Transactions';          // The "Transactions" sheet name
const PAIDTRANSACTIONS = 'PaidTransactions';  // The "PaidTransactions" sheet name



function withdraw() {
  const sheet = _getSheet(MERCHANT);
  const array = sheet.getSheetValues(FR, FC, -1, -1);
  const lc = array[0].length;
  const recapObj = 'FiMs Pay';
  let recap = '';

  // Processing transactions for each merchant (by id)
  for (let i = 0; i < array.length; ++i) {
    if (_isCurrentDay(array, i, lc-1)) {
      const tsheet = _getSheet(TRANSACTIONS);
      if (tsheet.getRange(FR, FC).getValue() != '') {
        const tarray = tsheet.getSheetValues(FR, FC, -1, -1);
        const paidArray = [];
        const deleteArray = [];

        // Store the transaction to pay
        const id = array[i][ID_COL-1];
        for (let j = 0; j < tarray.length; ++j) {
          if (tarray[j][MERCHANT_COL-1] == id) {
            paidArray.push(tarray[j]);
            deleteArray.push(j+FR);
          }
        }

        // Delete processed transactions
        for (let j = deleteArray.length-1; j >= 0; --j) {
          if (deleteArray[j] != FR) {
            tsheet.deleteRow(deleteArray[j]);
          } else {
            tsheet.getRange(FR, FC, 1, paidArray[j].length).clearContent();
          }
        }

        if (paidArray.length > 0) {
          // Store processed transaction in an archive sheet
          const psheet = _getSheet(PAIDTRANSACTIONS);
          const numRows = paidArray.length - (psheet.getRange(FR, FC).getValue() != '' ? 0 : 1);
          if (numRows > 0) {
            psheet.insertRowsBefore(FR, numRows);
          }
          _setRangeValues(psheet, FR, FC, paidArray);

          // Create a merchant message with transactions recap
          const email = array[i][EMAIL_COL-1];
          const company = array[i][COMPANY_COL-1];
          const iban = array[i][IBAN_COL-1];

          const toPayTotal = array[i][NOTPAID_COL-1];
          const trate = array[i][TRATE_COL-1];
          const toPayTrad = _toCurrency(toPayTotal*trate);

          const object = 'FiMs Pay - Reçu de paiement de ' + _toCurrency(toPayTotal);
          let message = 'FiMs Pay a effectué un virement d\'un montant de ' + toPayTrad
          + ' pour l\'entreprise ' + company
          + ' sur le compte IBAN : ' + iban + '\n\n';
          recap += 'Entreprise : ' + company + '\n'
          + 'Virement : ' + toPayTrad + '\n'
          + 'IBAN : ' + iban + '\n\n';

          // Add a message specific to crypto withdraw
          if (trate < 1) {
            const drate = array[i][DRATE_COL-1];
            const toPayCrypto = _toCurrency(toPayTotal*drate);
            const cryptoAdd = array[i][CRYPTOADD_COL-1];

            message += 'Le somme de ' + toPayCrypto + ' a été versée sur le'
            + ' compte crypto à l\'adresse ' + cryptoAdd + '\n\n';
            recap += 'Crypto : ' + toPayCrypto + '\n'
            + 'Adresse : ' + cryptoAdd;
          }

          // Add all the transactions historic
          message += 'Récapitulatif des transactions :\n';
          for (let j = 0; j < paidArray.length; ++j) {
            message += _toStringTime(paidArray[j][DATE_COL-1]) + ' --> '
            + _toCurrency(paidArray[j][AMOUNT_COL-1]) + '\n';
          }

          // Send the message to the merchant (copy to myself, just to check)
          _sendMessage(object, message);
          GmailApp.sendEmail(email, object, message);
        }
      }
    }
  }

  // Send a recap with all the transactions total to process the paiements
  if (recap != '') {
    _sendMessage(recapObj, recap, true);
  }
}
