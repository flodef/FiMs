/* global GLOBAL, $, initCommon, google, getDiv, finishLoading, 
getValue, setValue, displayError, getImage, getDataValue, showLoader, 
getMainTitle, toCurrency */
/* exported init, onKeyUp, validatePayment */

GLOBAL.hasTranslation = false;
GLOBAL.displayData = [];
GLOBAL.menuButton = [];
GLOBAL.user = [];

GLOBAL.merchantInfoFormula = "Check!A:C";
GLOBAL.paymentInfoFormula = "Check!A:H";
GLOBAL.customerAddressFormula = "Check!D";

GLOBAL.solanaAddressPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/i;

GLOBAL.messages = {
  CopyAddress:"Copiez votre adresse de porte-feuille crypto<br><br>puis cliquez ci-dessous :",
  VerifyPayment:"Verifier le paiement",
  InvalidAddress:"Solana Address copied is invalid!"
};

GLOBAL.header = {
  CryptoAddress:"Crypto Address",
  Company:"Company",
  Customer:"Customer",
  Status:"Status",
  Amount:"Amount",
  Time:"Time",
  Duration:"Duration",
};
GLOBAL.status = {
  Error:"Error",
  Warning:"Warning",
  Success:"Success"
};


$(() => {
  initCommon();
});

function init() {
  google.script.run
    .withSuccessHandler(setUserId)
    .withFailureHandler(displayError)
    .getProperty("userId");
}

function setUserId(id) {
  GLOBAL.user.ID = id;

  getValue({
    formula: GLOBAL.merchantInfoFormula,
    filter: 0
  }, displayContent);
}

function displayContent(id, contents) {
  const company = getDataValue(contents, GLOBAL.header.Company);
  const merchantTitle = getMainTitle(company);
  document.body.innerHTML += getDiv("merchant", null, "right", merchantTitle);

  const logo = getImage(GLOBAL.user.ID, "Pay/Merchant");
  const logoHTML = getDiv("logo", null, "center", logo);
  
  let processHTML = getMainTitle(GLOBAL.messages.CopyAddress)
    + `<button onclick="validatePayment()" style="
        border-radius: 20px;
        height: 100px;
        width: 330px;
        font-size: 33px;
        line-height: 40px;
      ">` + GLOBAL.messages.VerifyPayment + "</button>";
  processHTML = getDiv("process", null, "center", processHTML);

  $("#mainContent").html(logoHTML + processHTML);
  finishLoading();
}

async function validatePayment() {
  const clipboard = await navigator.clipboard.readText();
  const customerAdress = clipboard.match(GLOBAL.solanaAddressPattern);
  if (customerAdress && customerAdress.length == 1) {
    showLoader(true);
    setValue("Check!D"+GLOBAL.user.ID, [[customerAdress[0]]], loadPaymentStatus);
  } else {
    displayError(GLOBAL.messages.InvalidAddress);
  }
}

function loadPaymentStatus() {
  getValue({
    formula: GLOBAL.paymentInfoFormula,
    filter: 0
  }, displayPaymentStatus);
}

async function displayPaymentStatus(id, contents) {
  const fullStatus = getDataValue(contents, GLOBAL.header.Status);
  if (fullStatus.slice(-3) === "...") { // Processing... or Loading...
    setTimeout(loadPaymentStatus, 1000);  // Loop through loading status
  } else {
    const status = fullStatus.split(":")[0];
    let html = getImage(status === GLOBAL.status.Error ? "Cancel" : status === GLOBAL.status.Warning ? "Bug" : "Validate", 
      "Button", [{name:"style", value:"margin: 50px"}]);
    html += getMainTitle(fullStatus);
    if (status !== GLOBAL.status.Error) {
      html += getMainTitle(toCurrency(getDataValue(contents, GLOBAL.header.Amount)));
      html += getMainTitle(getDataValue(contents, GLOBAL.header.Time));
      html += getMainTitle("(il y a " + getDataValue(contents, GLOBAL.header.Duration).replace(":", "h ").replace(":", "m ") + "s)");
    }    
    
    $("#process").html(html);

    setValue("Check!D"+GLOBAL.user.ID, [[null]]);
    showLoader(false);
  }  
}
