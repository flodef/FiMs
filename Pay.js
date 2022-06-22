/* global GLOBAL, $, initCommon, google, getDiv, finishLoading, 
getValue, setValue, displayError, getImage, getDataValue, showLoader, 
getMainTitle, toCurrency, toStringDate, translate, displayElement, 
setTranslationLanguage, indexOf, getCurrentLanguage */
/* exported init, onKeyUp, validatePayment, getButtonAction, translationLoaded */

GLOBAL.hasTranslation = true;
GLOBAL.language = "Français";
GLOBAL.displayData = [];
GLOBAL.user = [];
GLOBAL.menuButton = [];

GLOBAL.mainSection = "Main";
GLOBAL.isForMobile = true;

GLOBAL.merchantInfoFormula = "Check!A:C";
GLOBAL.paymentInfoFormula = "Check!A:H";
GLOBAL.customerAddressFormula = "Check!D";

GLOBAL.solanaAddressPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/i;

GLOBAL.customerAddress = "";
GLOBAL.merchantAddress = "";
GLOBAL.attempt = 0; // Number of attempt to load payment data
GLOBAL.attemptTimeout = 3; // Duration between each attempt
GLOBAL.retry = 0; // Number of retry with a data reset which force reloading data
GLOBAL.retryTimeout = 30; // Duration between each retry
GLOBAL.retryLimit = 3; // Number of retry after which the payment is cancelled

GLOBAL.step = {
  executePayment: "Execute payment",
  openWallet: "Open",
  verifyPayment: "Verify payment",
  retry: "Retry",
  result: "Result",
};
GLOBAL.currentStep = GLOBAL.step.executePayment;

GLOBAL.messages = {
  help: "Help",
  duration: "($ ago)",
  invalidPayment:
    "Error: Your payment could not been verified. Try to pay by another mean. We will proceed to a refund shortly.",
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

function init() {
  google.script.run.withSuccessHandler(setUserId).withFailureHandler(displayError).getProperty("userId");
  displayElement("#mainContent, #mainHeading", false, 0);
}

function setUserId(id) {
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
  GLOBAL.merchantAddress = getDataValue(contents, GLOBAL.header.cryptoAddress);
  const company = getDataValue(contents, GLOBAL.header.company);
  const merchantTitle = getMainTitle(company, 60);
  $("#mainHeading").html(merchantTitle);

  const logo = getImage(GLOBAL.user.ID, "Pay/Merchant", [{ name: "style", value: "margin: 25px;" }]);
  const logoHTML = getDiv("logo", null, "center", logo);
  const processHTML = getDiv("process", null, "center");
  $("#mainContent").html(logoHTML + processHTML);

  finishLoading();

  selectLanguage(GLOBAL.language);
  displayElement("#mainContent, #merchant, #mainHeading, #process", true, 3000);
}

function selectLanguage(language) {
  if (language != getCurrentLanguage()) {
    displayElement(".actionButton", true, 0, () => displayElement("#" + language + "Button", false, 0));
    setTranslationLanguage(language);
    setProcess(GLOBAL.currentStep);
  }
}

function setProcess(step) {
  const translation = GLOBAL.data[GLOBAL.translation];
  const index = GLOBAL.translationCurrentIndex;
  const main = indexOf(translation, GLOBAL.mainSection, 0) + 1;

  let content = "";
  step = step == translate(GLOBAL.step.retry) ? GLOBAL.step.executePayment : step;
  if (step == GLOBAL.step.executePayment || step == GLOBAL.step.openWallet) {
    if (step == GLOBAL.step.executePayment) {
      content += getDiv(null, null, "left", getMainTitle(translation[main][index]));
    }
    const wallet = getWallet();
    content +=
      getMainTitle(translation[main + 1][index]) +
      getStepButton(translate(GLOBAL.step.openWallet) + " " + wallet[0], openWallet.name);
  } else if (step == GLOBAL.step.verifyPayment) {
    content += getStepButton(translate(GLOBAL.step.verifyPayment), verifyPayment.name);
  } else if (step == GLOBAL.step.result) {
    content += getPaymentStatus();
  } else {
    throw "Unknown step: " + step;
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
    "<button onclick=\"" +
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
      displayElement("#process", false, 0);
      GLOBAL.retry = 0;
      GLOBAL.customerAddress = customerAddress[0];
      setCustomerAddress(GLOBAL.customerAddress, loadPaymentStatus);
    } else {
      setProcess(GLOBAL.step.openWallet);
    }
  } else {
    openHelp(arguments.callee.name);
  }
}

function setCustomerAddress(customerAddress, success) {
  GLOBAL.attempt = 0;
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
  let fullStatus = getFullStatus(contents);
  if (
    !fullStatus ||
    fullStatus.slice(-3) === "..." ||
    (getStatus(fullStatus) === GLOBAL.status.warning && GLOBAL.retry === 0)
  ) {
    // No status or Processing... / Loading... or Old transaction warning before one retry (maybe the transaction is soon to be validated)
    fullStatus = null;
    if (GLOBAL.attempt < GLOBAL.retryTimeout / GLOBAL.attemptTimeout) {
      ++GLOBAL.attempt;
      console.log("attempt " + GLOBAL.attempt + "/" + GLOBAL.retryTimeout / GLOBAL.attemptTimeout);
      setTimeout(loadPaymentStatus, GLOBAL.attemptTimeout * 1000); // Loop through loading status
    } else if (GLOBAL.retry < GLOBAL.retryLimit - 1) {
      ++GLOBAL.retry;
      console.log("retry " + GLOBAL.retry + "/" + GLOBAL.retryLimit);
      resetCustomerAddress();
    } else {
      console.log("retry " + GLOBAL.retryLimit + "/" + GLOBAL.retryLimit);
      fullStatus = GLOBAL.messages.invalidPayment;
      sendRefundEmail();
    }
  }

  if (fullStatus) {
    GLOBAL.statusContent = contents;

    setProcess(GLOBAL.step.result);
  }
}

function getPaymentStatus() {
  const content = GLOBAL.statusContent;
  const fullStatus = getFullStatus(content);
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
    html += status !== GLOBAL.status.success ? getStepButton(GLOBAL.step.retry, setProcess.name) : "";

    setCustomerAddress("");
    showLoader(false);
  }

  return html;
}

function getStatus(fullStatus) {
  return fullStatus ? fullStatus.split(":")[0].toLowerCase().trim() : null;
}

function getFullStatus(contents) {
  return getDataValue(contents, GLOBAL.header.status);
}

function sendRefundEmail() {
  const subject = "REFUND for [" + GLOBAL.customerAddress + "] / Merchant ID " + GLOBAL.user.ID + " @ " + toStringDate();
  google.script.run.withSuccessHandler().withFailureHandler(displayError).sendRecapEmail(subject);
}
