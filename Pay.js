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

GLOBAL.Header = {
  CryptoAddress:"Crypto Address",
  Company:"Company",
  Customer:"Customer",
  Status:"Status",
  Amount:"Amount",
  Time:"Time",
  Duration:"Duration",
};
GLOBAL.Status = {
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
  const company = getDataValue(contents, GLOBAL.Header.Company);
  const merchantTitle = getMainTitle(company);
  document.body.innerHTML += getDiv("merchant", null, "right", merchantTitle);

  const logo = getImage(GLOBAL.user.ID, "Pay/Merchant");
  const logoHTML = getDiv("logo", null, "center", logo);
  
  let processHTML = getMainTitle("Copiez votre adresse de porte-feuille crypto"
    + "<br><br>puis cliquez ci-dessous :")
    + `<button onclick="validatePayment()" style="
        border-radius: 20px;
        height: 100px;
        width: 330px;
        font-size: 33px;
        line-height: 40px;
      ">Verifier le paiement</button>`;
  processHTML = getDiv("process", null, "center", processHTML);

  $("#mainContent").html(logoHTML + processHTML);
  finishLoading();
}

async function validatePayment() {
  const customerAdress = await navigator.clipboard.readText();
  showLoader(true);
  setValue("Check!D"+GLOBAL.user.ID, customerAdress, loadPaymentStatus);
}

function loadPaymentStatus() {
  getValue({
    formula: GLOBAL.paymentInfoFormula,
    filter: 0
  }, displayPaymentStatus);
}

async function displayPaymentStatus(id, contents) {
  const fullStatus = getDataValue(contents, GLOBAL.Header.Status);
  if (fullStatus.slice(-3) === "...") { // Processing... or Loading...
    setTimeout(loadPaymentStatus, 1000);  // Loop through loading status
  } else {
    const status = fullStatus.split(":")[0];
    let html = getImage(status === GLOBAL.Status.Error ? "Cancel" : status === GLOBAL.Status.Warning ? "Bug" : "Validate", 
      "Button", [{name:"style", value:"margin: 50px"}]);
    html += getMainTitle(fullStatus);
    if (status !== GLOBAL.Status.Error) {
      html += getMainTitle(toCurrency(getDataValue(contents, GLOBAL.Header.Amount)));
      html += getMainTitle(getDataValue(contents, GLOBAL.Header.Time));
      html += getMainTitle("(il y a " + getDataValue(contents, GLOBAL.Header.Duration).replace(":", "h ").replace(":", "m ") + "s)");
    }    
    
    $("#process").html(html);

    setValue("Check!D"+GLOBAL.user.ID);
    showLoader(false);
  }  
}
