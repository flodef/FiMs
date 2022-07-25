/* global GLOBAL, $, initCommon, getDiv, finishLoading, 
getValue, setValue, getImage, getDataValue, showLoader, 
getMainTitle, toCurrency, toStringDate, translate, displayElement, 
setTranslationLanguage, indexOf, getCurrentLanguage, sendRecapEmail, 
displayErrorFallback, overDisplay */
/* exported init, onKeyUp, validatePayment, getButtonAction, translationLoaded, 
displayError */

GLOBAL.hasTranslation = true;
GLOBAL.language = "Français";
GLOBAL.displayData = [];
GLOBAL.user = [];
GLOBAL.menuButton = [];

GLOBAL.isForMobile = true;

GLOBAL.merchantInfoFormula = "Check!A:C";
GLOBAL.paymentInfoFormula = "Check!A:H";
GLOBAL.customerAddressFormula = "Check!D";

GLOBAL.solanaAddressPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/i;

GLOBAL.customerAddress = "";
GLOBAL.merchantAddress = "";
GLOBAL.attemptTimeout = 3; // Duration between each attempt
GLOBAL.retry = 0; // Number of retry with a data reset which force reloading data
GLOBAL.retryTimeout = 30; // Duration between each retry
GLOBAL.retryLimit = 3; // Number of retry after which the payment is cancelled

GLOBAL.timeoutTimer;
GLOBAL.timeout = false;

GLOBAL.step = {
  executePayment: "Execute payment",
  openWallet: "Open",
  verifyPayment: "Verify payment",
  retry: "Retry",
  abort: "Abort",
  result: "Result",
};
GLOBAL.currentStep = null;

GLOBAL.messages = {
  howto: "How to",
  help: "Help",
  duration: "($ ago)",
  noPayment: "Error: No transaction",
  unknownError: "Unknown error",
  unknownStep: "Unknown step: ",
  invalidPayment: "Invalid / Empty payment status",
};

GLOBAL.helpURL = "https://fims.fi?id=Help";

GLOBAL.wallet = [];
GLOBAL.wallet["Solflare"] = "https://solflare.com/portfolio";
GLOBAL.wallet["Exodus"] = "market://details?id=exodusmovement.exodus";
// GLOBAL.wallet["Exodus"] = "https://play.google.com/store/apps/details?id=exodusmovement.exodus";
// GLOBAL.wallet[GLOBAL.messages.help] = "";

GLOBAL.header = {
  cryptoAddress: "Crypto Address",
  company: "Company",
  customer: "Customer",
  status: "Status",
  amount: "Amount",
  time: "Time",
  duration: "Duration",
};
GLOBAL.status = {
  error: "error",
  warning: "warning",
  success: "success",
};
GLOBAL.statusContent = "";

$(() => {
  initCommon();
});

function translationLoaded() {
  const translation = GLOBAL.data[GLOBAL.translation];
  const button = [];
  translation[0].forEach((x) => button.push({ id: x, fn: selectLanguage }));
  GLOBAL.menuButton = button.filter((x) => x.id);
}

function init(id) {
  GLOBAL.user.ID = id;

  getValue(
    {
      formula: GLOBAL.merchantInfoFormula,
      filter: 0,
    },
    displayContent
  );
}

function displayContent(id, contents) {
  displayElement("mainContent, mainHeading", false, 0);

  GLOBAL.merchantAddress = getDataValue(contents, GLOBAL.header.cryptoAddress);
  const company = getDataValue(contents, GLOBAL.header.company);
  const merchantTitle = getMainTitle(company, 60);
  $("#mainHeading").html(merchantTitle);

  const logo = getImage(GLOBAL.user.ID, "Merchant", [{ name: "style", value: "margin: 25px;" }]);
  const logoHTML = getDiv("logo", null, "center", logo);
  const processHTML = getDiv("process", null, "center");
  $("#mainContent").html(logoHTML + processHTML);

  setProcess(GLOBAL.step.executePayment);

  displayElement("mainContent, merchant, mainHeading, process", true, 2500);
  displayLanguageButton();

  finishLoading();
}

function selectLanguage(language) {
  if (language != getCurrentLanguage()) {
    setTranslationLanguage(language);
    setProcess(GLOBAL.currentStep);
    displayLanguageButton();
  }
}

function displayLanguageButton() {
  $(".actionButton").each((index, element) => {
    const isCurrentLanguage = index == GLOBAL.translationCurrentIndex;
    displayElement(element.id, !isCurrentLanguage, isCurrentLanguage ? 0 : 1000);
  });
}

function setProcess(step) {
  const translation = GLOBAL.data[GLOBAL.translation];
  const index = GLOBAL.translationCurrentIndex;

  let content = "";
  const main = indexOf(translation, GLOBAL.messages.howto, 0) + 1;
  step = step == translate(GLOBAL.step.retry) ? GLOBAL.step.executePayment : step;
  if (step == GLOBAL.step.executePayment) {
    content += getStepButton(GLOBAL.messages.howto, displayHowTo.name);
    content += getDiv(
      GLOBAL.messages.howto,
      "hidden",
      "left",
      getMainTitle(translation[main][index]) + getMainTitle(translation[main + 1][index])
    );
    content += getStepButton(translate(GLOBAL.step.openWallet) + " " + getWallet()[0], openWallet.name);
    content += getStepButton(GLOBAL.step.verifyPayment, verifyPayment.name);
  } else if (step == GLOBAL.step.openWallet) {
    content += getMainTitle(translation[main + 1][index]);
    content += getStepButton(translate(GLOBAL.step.openWallet) + " " + getWallet()[0], openWallet.name);
  } else if (step == GLOBAL.step.verifyPayment) {
    content += getStepButton(GLOBAL.step.verifyPayment, verifyPayment.name);
  } else if (step == GLOBAL.step.result) {
    content += getPaymentStatus();
  } else if (step == translate(GLOBAL.step.abort)) {
    const subject = "REFUND for [" + GLOBAL.customerAddress + "] / Merchant ID " + GLOBAL.user.ID + " @ " + toStringDate();
    sendRecapEmail(subject);

    const invalidPayment = indexOf(translation, GLOBAL.step.abort, 0) + 1;
    content += getMainTitle(translation[invalidPayment][index]) + getStepButton(GLOBAL.step.retry, setProcess.name);
  } else {
    throw new Error(GLOBAL.messages.unknownStep);
  }

  GLOBAL.currentStep = step;

  const id = "#process";
  displayElement(id, false, 0);
  $(id).html(content);
  $(id).css("margin", "0px 0px 0px 30px");
  displayElement(id, true);
}

function getWallet() {
  const wallet = [];
  for (let x in GLOBAL.wallet) {
    wallet.push(x);
  }
  return wallet;
}

function getStepButton(label, action) {
  const buttonHTML =
    "<button id=\"" +
    action +
    "\" onclick=\"" +
    action +
    `(this.innerHTML)" style="
    border-radius: 30px;
    height: 100px;
    width: 500px;
    font-size: 50px;
    line-height: 40px;
    margin: 50px;
    font-weight: bold;
    ">` +
    translate(label) +
    "</button>";

  return getDiv("processButton", null, "center", buttonHTML);
}

function openHelp(section) {
  const helpURL = GLOBAL.helpURL + "#" + section;
  window.open(helpURL, "_blank");
}

function displayHowTo() {
  overDisplay(
    arguments.callee.name + "," + verifyPayment.name + "," + openWallet.name,
    GLOBAL.messages.howto + "," + openWallet.name
  );
}

function openWallet(wallet) {
  navigator.clipboard.writeText(GLOBAL.merchantAddress);
  const url = GLOBAL.wallet[wallet.split(" ")[1]];
  if (url) {
    window.open(url, "_blank");
    setProcess(GLOBAL.step.verifyPayment);
  } else {
    openHelp(arguments.callee.name);
  }
}

async function verifyPayment(option) {
  if (option != translate(GLOBAL.messages.help)) {
    const clipboard = await navigator.clipboard.readText();
    const customerAddress = clipboard.match(GLOBAL.solanaAddressPattern);
    if (customerAddress && customerAddress.length == 1 && customerAddress != GLOBAL.merchantAddress) {
      showLoader(true);
      displayElement("process", false, 0);
      GLOBAL.retry = 0;
      GLOBAL.customerAddress = customerAddress[0];
      setCustomerAddress(GLOBAL.customerAddress, checkPaymentStatus);
    } else {
      setProcess(GLOBAL.step.openWallet);
    }
  } else {
    openHelp(arguments.callee.name);
  }
}

function setCustomerAddress(customerAddress, success) {
  setValue("Check!D" + GLOBAL.user.ID, [[customerAddress]], success);
}

function resetCustomerAddress() {
  setCustomerAddress("", () => setCustomerAddress(GLOBAL.customerAddress, checkPaymentStatus));
}

function loadPaymentStatus() {
  getValue(
    {
      formula: GLOBAL.paymentInfoFormula,
      filter: 0,
    },
    checkPaymentStatus
  );
}

async function checkPaymentStatus(id, contents) {
  let fullStatus = GLOBAL.timeout ? GLOBAL.messages.noPayment : getFullStatus(contents);
  if (!fullStatus) {
    // Value not checked yet (first call)
    setTimeout(loadPaymentStatus, GLOBAL.attemptTimeout * 1000); // First Check the payment status
    if (!GLOBAL.timeoutTimer) {
      GLOBAL.timeout = false;
      GLOBAL.timeoutTimer = setTimeout(() => (GLOBAL.timeout = true), GLOBAL.retryTimeout * 1000);
    }
  } else if (fullStatus.slice(-3) === "...") {
    // No status or Processing... / Loading...
    setTimeout(loadPaymentStatus, GLOBAL.attemptTimeout * 1000); // Loop through loading status
  } else if (getStatus(fullStatus) !== GLOBAL.status.success && GLOBAL.retry < GLOBAL.retryLimit) {
    // Old transaction warning so retry (maybe the transaction is soon to be validated)
    ++GLOBAL.retry;
    console.log("retry " + GLOBAL.retry + "/" + GLOBAL.retryLimit);
    setTimeout(resetCustomerAddress, (GLOBAL.retryTimeout / 6) * 1000); // Loop three times through loading status
  } else {
    clearTimeout(GLOBAL.timeoutTimer);
    GLOBAL.timeoutTimer = null;
    GLOBAL.timeout = false;
    GLOBAL.retry = 0;
    GLOBAL.statusContent = contents;

    setProcess(GLOBAL.step.result);
  }
}

function getPaymentStatus() {
  const content = GLOBAL.statusContent;
  const fullStatus = Array.isArray(content) ? getFullStatus(content) : content;

  showLoader(false);

  let html = "";
  if (fullStatus) {
    const status = getStatus(fullStatus);
    html +=
      getImage(status === GLOBAL.status.error ? "Cancel" : status === GLOBAL.status.warning ? "Bug" : "Validate", "Button", [
        { name: "style", value: "margin: 50px" },
      ]) + "<br>";
    html += status !== GLOBAL.status.success ? getMainTitle(fullStatus, 90) : "";
    html += status !== GLOBAL.status.error ? getMainTitle(toCurrency(getDataValue(content, GLOBAL.header.amount)), 90) : "";
    if (status === GLOBAL.status.warning) {
      const d = getDataValue(content, GLOBAL.header.duration).split(":");
      const duration = (parseInt(d[0]) > 0 ? d[0] + "h " : "") + (parseInt(d[1]) > 0 ? d[1] + "m " : "") + d[2] + "s";

      html += getMainTitle(getDataValue(content, GLOBAL.header.time));
      html += getMainTitle(translate(GLOBAL.messages.duration).replace("$", duration));
    }
    html +=
      status !== GLOBAL.status.success
        ? getStepButton(GLOBAL.step.retry, verifyPayment.name) + getStepButton(GLOBAL.step.abort, setProcess.name)
        : "";

    setCustomerAddress("");
  } else {
    throw new Error(GLOBAL.messages.invalidPayment);
  }

  return html;
}

function getStatus(fullStatus) {
  return fullStatus ? fullStatus.split(":")[0].toLowerCase().trim() : "";
}

function getFullStatus(contents) {
  return getDataValue(contents, GLOBAL.header.status);
}

function displayError(error) {
  if (GLOBAL.currentStep) {
    GLOBAL.statusContent = GLOBAL.status.error + ": " + (error.message ? error.message : GLOBAL.messages.unknownError);
    setProcess(GLOBAL.step.result);
  } else {
    displayErrorFallback();
  }
}
