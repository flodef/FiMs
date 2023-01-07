/* global _getSheet, _sendMessage, _toCurrency, _toStringTime, _isCurrentHour,
_setRangeValues, FR, FC, _isMarketOpen, _copySheetFromModel, _updateFormula, 
_isError, _isToday, GmailApp */
/* exported withdraw */

// OPTIONS
const SEND_MAIL_TO_MERCHANT = true;
const WITHDRAW_NOW = false;

// TRANSACTIONS COLS
const DATE_COL = 1; // Should be the "Date" column
const AMOUNT_COL = 2; // Should be the "Amount" column
const MERCHANT_COL = 3; // Should be the "Merchant" column
const TRANS_COL_COUNT = 6; // Should be the number of column

// MERCHANT COLS
const INDEX_COL = 1; // Should be the "Index" column
const COMPANY_COL = 3; // Should be the "Company" column
const FIATWD_COL = 7; // Should be the "Fiat Withdraw" column
const NOTPAID_COL = 9; // Should be the "Not Paid" column
const LASTWD_COL = 11; // Should be the "Last withdraw" column
const NEXTWD_COL = 12; // Should be the "Next withdraw" column
const EMAIL_COL = 13; // Should be the "EMail" column

// SPECIFIC MERCHANT UPDATE CELL
const DATA_COL = 7; // Should be the column after transactions data
const MERCHUPD_ROW = 7; // Should be the empty row to update Json import
const TRANSUPD_ROW = 8; // Should be the row with a boolean to indicate whether to update transactions

// SHEET NAMES
const MERCHANT = "Merchant"; // The "Merchant" sheet name
const TRANSACTIONS = "Transactions"; // The "Transactions" sheet name
const PAIDTRANSACTIONS = "PaidTransactions"; // The "PaidTransactions" sheet name
const MERCHMODEL = "1"; // The model to create a new merchant

function withdraw() {
  if (WITHDRAW_NOW || _isMarketOpen(0, 6, 7, 21)) {
    // Value init
    const msheet = _getSheet(MERCHANT);
    const array = msheet.getSheetValues(FR, FC, -1, -1);
    const date = new Date();
    const updateArray = [];
    const deleteArray = [];
    const paidArray = [];
    const emailArray = [];
    let recapArray = [];
    let transUpd, tsheet;

    // Processing transactions for each merchant (by id)
    for (let i = 0; i < array.length; ++i) {
      // If the sheet does not exist, create a new merchant sheet from the model
      const id = array[i][INDEX_COL - 1];
      const sheet = _copySheetFromModel(id, MERCHMODEL);
      sheet.getRange(FR - 1, DATA_COL).setValue(id);

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

      // Update the transaction search formula
      _updateFormula(sheet, MERCHUPD_ROW, DATA_COL);
    }

    // Update transaction values
    if (updateArray.length != 0) {
      tsheet = _getSheet(TRANSACTIONS, tsheet);
      _setRangeValues(tsheet, FR, FC, updateArray);
    }

    // Processing transactions for each merchant (by id)
    for (let i = 0; i < array.length; ++i) {
      // If the current time matches the next withdraw time, process transactions
      if (WITHDRAW_NOW || (_isToday(array, i, NEXTWD_COL - 1) && _isCurrentHour(array, i, NEXTWD_COL - 1))) {
        tsheet = _getSheet(TRANSACTIONS, tsheet);
        if (tsheet.getLastRow() >= FR) {
          const id = array[i][INDEX_COL - 1];
          const tarray = tsheet.getSheetValues(FR, FC, -1, -1);

          // Store the transaction to pay & to delete
          let transactionArray = [];
          let hasProcessedTransaction;
          array[i][NOTPAID_COL - 1] = 0;
          for (let j = 0; j < tarray.length; ++j) {
            if (tarray[j][MERCHANT_COL - 1] == id) {
              transactionArray.push(tarray[j]);
              paidArray.push(tarray[j]);
              deleteArray.push(j + FR);
              array[i][NOTPAID_COL - 1] += tarray[j][AMOUNT_COL - 1];
              hasProcessedTransaction = true;
            }
          }

          // Generate a message to merchant and recap to process payment
          if (hasProcessedTransaction) {
            recapArray.push(_generateEmail(transactionArray, emailArray, array[i]));
          }

          // Set last withdraw value to today
          msheet.getRange(i + FR, LASTWD_COL).setValue(date);
        }
      }
    }

    // Finalize
    _archiveProcessedTransaction(paidArray);
    _deleteProcessedTransaction(deleteArray, tsheet);
    _sendTransactionMail(recapArray, emailArray);
  }
}

function _generateEmail(paidArray, emailArray, data) {
  // Create a merchant message with transactions recap
  const email = data[EMAIL_COL - 1];
  const company = data[COMPANY_COL - 1];

  const toPayTotal = _toCurrency(data[NOTPAID_COL - 1]);
  const fiatWd = data[FIATWD_COL - 1];

  let recap = "";
  const object = "FiMs Pay - Reçu de paiement de " + toPayTotal;
  let message = fiatWd
    ? "FiMs Pay a effectué un virement d'un montant de " + toPayTotal + " pour l'entreprise " + company + "\n\n"
    : company + " a reçu " + toPayTotal + " en crypto !\n\n";
  recap = fiatWd ? "Company : " + company + "\n" + "Wire Transfer : " + toPayTotal + "<3\n\n" : "";

  // Add all the transactions historic
  message += "Récapitulatif des transactions :\n";
  for (let j = 0; j < paidArray.length; ++j) {
    message += _toStringTime(paidArray[j][DATE_COL - 1]) + " --> " + _toCurrency(paidArray[j][AMOUNT_COL - 1]) + "\n";
  }

  emailArray.push([email, object, message]); // Store email data

  return recap;
}

function _archiveProcessedTransaction(paidArray) {
  if (paidArray.length > 0) {
    // Move processed transaction in an archive sheet
    const sheet = _getSheet(PAIDTRANSACTIONS);
    const numRows = paidArray.length - (sheet.getRange(FR, FC).getValue() != "" ? 0 : 1);
    if (numRows > 0) {
      sheet.insertRowsBefore(FR, numRows);
    }
    _setRangeValues(sheet, FR, FC, paidArray);
  }
}

function _deleteProcessedTransaction(deleteArray, sheet) {
  deleteArray
    .sort((a, b) => b - a)
    .forEach((item) => {
      sheet = _getSheet(TRANSACTIONS, sheet);
      if (item != FR || sheet.getMaxRows() != FR) {
        sheet.deleteRow(item);
      } else {
        sheet.getRange(FR, FC, 1, TRANS_COL_COUNT).clearContent();
      }
    });
}

function _sendTransactionMail(recapArray, emailArray) {
  // Send a recap with all the transactions total to process the paiements
  let recap = "";
  for (let i = 0; i < recapArray.length; ++i) {
    recap += recapArray[i];
  }
  if (recap) {
    _sendMessage(
      "FiMs Pay",
      "/!\\ Don't forget to withdraw crypto from FiMs Pay account /!\\\n\n" +
        (SEND_MAIL_TO_MERCHANT ? "Mail sent to Merchant" : "/!\\ Don't forget to send mail to Merchant /!\\") +
        "\n\n" +
        recap,
      true
    );
  }

  // Send the message to the merchant (copy to myself, just to check)
  for (let i = 0; i < emailArray.length; ++i) {
    const email = emailArray[i][0];
    const object = emailArray[i][1];
    const message = emailArray[i][2];
    _sendMessage(object, message);
    if (SEND_MAIL_TO_MERCHANT) {
      GmailApp.sendEmail(email, object, message);
    }
  }
}
