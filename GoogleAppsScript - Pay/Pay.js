/* global _getSheet, _sendMessage, _toCurrency, _toStringTime, _isCurrentDay,
_setRangeValues, FR, FC, GmailApp */
/* exported withdraw */



// TRANSACTIONS COLS
const DATE_COL = 1;             // Should be the "Date" column
const AMOUNT_COL = 2;           // Should be the "Amount" column
const MERCHANT_COL = 3;         // Should be the "Merchant" column
const TRANS_COL_COUNT = 6;      // Should be the number of column

// MERCHANT COLS
const ID_COL = 1;               // Should be the "ID" column
const EMAIL_COL = 2;            // Should be the "EMail" column
const COMPANY_COL = 3;          // Should be the "Company" column
const IBAN_COL = 4;             // Should be the "IBAN" column
const TRATE_COL = 5;            // Should be the "Rate" column
const CRYPTOADD_COL = 6;        // Should be the "Crypto Address" column
const DRATE_COL = 7;            // Should be the "Rate" column
const NOTPAID_COL = 10;         // Should be the "Not Paid" column
const LASTWD_COL = 12;          // Should be the "Last withdraw" column
const NEXTWD_COL = 13;          // Should be the "Next withdraw" column

// SPECIFIC MERCHANT UPDATE CELL
const DATA_COL = 7;             // Should be the column after transactions data
const MERCHUPD_ROW = 7;         // Should be the empty row to update Json import
const TRANSUPD_ROW = 8;         // Should be the row with a boolean to indicate whether to update transactions

// SHEET NAMES
const MERCHANT = 'Merchant';                  // The "Merchant" sheet name
const TRANSACTIONS = 'Transactions';          // The "Transactions" sheet name
const PAIDTRANSACTIONS = 'PaidTransactions';  // The "PaidTransactions" sheet name
const MERCHMODEL = "1";                       // The model to create a new merchant 


function withdraw() {
  if (_isMarketOpen(0, 6, 7, 20)) {
    // Value init
    const msheet = _getSheet(MERCHANT);
    const array = msheet.getSheetValues(FR, FC, -1, -1);
    const date = new Date();
    const updateArray = [];
    const deleteArray = [];
    const paidArray = [];
    const emailArray = [];
    let recap = '';
    let transUpd, tsheet;

    // Processing transactions for each merchant (by id)
    for (let i = 0; i < array.length; ++i) {
      // If the sheet does not exist, create a new merchant sheet from the model
      const id = array[i][ID_COL-1];
      const sheet = _copySheetFromModel(id, MERCHMODEL);
      sheet.getRange(FR-1, DATA_COL).setValue(id);
      _updateFormula(sheet, MERCHUPD_ROW, DATA_COL);

      // Store the transactions to update
      transUpd |= sheet.getRange(TRANSUPD_ROW, DATA_COL).getValue();
      if (transUpd) {
        const tlr = sheet.getLastColumn();
        const data = sheet.getRange(FR, FC, tlr, TRANS_COL_COUNT).getValues();
        for (let x = 0; x < data.length; ++x) {
          const a = data[x][0];
          if (a && !_isError(a)) {
            updateArray.push(data[x]);
          }
        }
      }

      // If the current time matches the next withdraw time, process transactions
      if (_isToday(array, i, NEXTWD_COL-1) && _isCurrentHour(array, i, NEXTWD_COL-1)) {
        tsheet = _getSheet(TRANSACTIONS, tsheet);
        if (tsheet.getLastRow() >= FR) {
          const tarray = tsheet.getSheetValues(FR, FC, -1, -1);

          // Store the transaction to pay & to delete
          let hasProcessedTransaction;
          for (let j = 0; j < tarray.length; ++j) {
            if (tarray[j][MERCHANT_COL-1] == id) {
              paidArray.push(tarray[j]);
              deleteArray.push(j+FR);
              hasProcessedTransaction = true;
            }
          }

          // Generate a message to merchant and recap to process payment
          if (hasProcessedTransaction) {
            recap += _generateEmail(paidArray, emailArray, recap, array[i]);
          }

          // Set last withdraw value to today
          msheet.getRange(i + FR, LASTWD_COL).setValue(date);
        }
      }
    }

    // Finalize
    tsheet = _getSheet(TRANSACTIONS, tsheet);
    _archiveProcessedTransaction(paidArray);
    _deleteProcessedTransaction(deleteArray, tsheet)
    _setRangeValues(tsheet, FR, FC, updateArray);
    _sendTransactionMail(recap, emailArray);
  }
}

function _generateEmail(paidArray, emailArray, recap, data) {
  // Create a merchant message with transactions recap
  const email = data[EMAIL_COL-1];
  const company = data[COMPANY_COL-1];
  const iban = data[IBAN_COL-1];

  const toPayTotal = data[NOTPAID_COL-1];
  const trate = data[TRATE_COL-1];
  const toPayTrad = _toCurrency(toPayTotal*trate);

  const object = 'FiMs Pay - Reçu de paiement de ' + _toCurrency(toPayTotal);
  let message = 'FiMs Pay a effectué un virement d\'un montant de ' + toPayTrad
  + ' pour l\'entreprise ' + company
  + ' sur le compte IBAN : ' + iban + '\n\n';
  recap += 'Company : ' + company + '\n'
  + 'Wire Transfer : ' + toPayTrad + '\n'
  + 'IBAN : ' + iban + '\n\n';

  // Add a message specific to crypto withdraw
  if (trate < 1) {
    const drate = data[DRATE_COL-1];
    const toPayCrypto = _toCurrency(toPayTotal*drate);
    const cryptoAdd = data[CRYPTOADD_COL-1];

    message += 'Le somme de ' + toPayCrypto + ' a été versée sur le'
    + ' compte crypto à l\'adresse ' + cryptoAdd + '\n\n';
    recap += 'Crypto Transfer : ' + toPayCrypto + '\n'
    + 'Address : ' + cryptoAdd + '\n\n';
  }

  // Add all the transactions historic
  message += 'Récapitulatif des transactions :\n';
  for (let j = 0; j < paidArray.length; ++j) {
    message += _toStringTime(paidArray[j][DATE_COL-1]) + ' --> '
    + _toCurrency(paidArray[j][AMOUNT_COL-1]) + '\n';
  }

  emailArray.push([email, object, message]);     // Store email data

  return recap;
}

function _archiveProcessedTransaction(paidArray) {
  if (paidArray.length > 0) {
    // Move processed transaction in an archive sheet
    const sheet = _getSheet(PAIDTRANSACTIONS);
    const numRows = paidArray.length - (sheet.getRange(FR, FC).getValue() != '' ? 0 : 1);
    if (numRows > 0) {
      sheet.insertRowsBefore(FR, numRows);
    }
    _setRangeValues(sheet, FR, FC, paidArray);
  }
}

function _deleteProcessedTransaction(deleteArray, sheet) {
  for (let j = deleteArray.length-1; j >= 0; --j) {
    sheet = _getSheet(TRANSACTIONS, sheet);
    if (deleteArray[j] != FR || sheet.getMaxRows() != FR) {
      sheet.deleteRow(deleteArray[j]);
    } else {
      sheet.getRange(FR, FC, 1, TRANS_COL_COUNT).clearContent();
    }
  }
}

function _sendTransactionMail(recap, emailArray) {
  // Send a recap with all the transactions total to process the paiements
  if (recap != '') {
    recap += '/!\\ Don\'t forget to withdraw crypto from FiMs Pay account /!\\';
    _sendMessage('FiMs Pay', recap, true);

    // Send the message to the merchant (copy to myself, just to check)
    for (let i = 0; i < emailArray.length; ++i) {
      const email = emailArray[i][0];
      const object = emailArray[i][1];
      const message = emailArray[i][2];
      _sendMessage(object, message);
      GmailApp.sendEmail(email, object, message);
    }
  }
}