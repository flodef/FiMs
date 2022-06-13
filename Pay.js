/* global GLOBAL, $, initCommon, google, getDiv, finishLoading, 
getValue, setValue, displayError, getImage, getDataValue, showLoader, 
getMainTitle, toCurrency, toStringDate, translate, displayElement, 
setTranslationLanguage, indexOf */
/* exported init, onKeyUp, validatePayment, getButtonAction */

GLOBAL.hasTranslation = true;
GLOBAL.displayData = [];
GLOBAL.menuButton = [];
GLOBAL.user = [];

GLOBAL.isForMobile = true;

GLOBAL.merchantInfoFormula = "Check!A:C";
GLOBAL.paymentInfoFormula = "Check!A:H";
GLOBAL.customerAddressFormula = "Check!D";

GLOBAL.solanaAddressPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/i;

GLOBAL.currentStep = 0;
GLOBAL.customerAddress = "";
GLOBAL.merchantAddress = "";
GLOBAL.attempt = 0; // Number of attempt to load payment data
GLOBAL.attemptTimeout = 5; // Duration between each attempt
GLOBAL.retry = 0; // Number of retry with a data reset which force reloading data
GLOBAL.retryTimeout = 30; // Duration between each retry
GLOBAL.retryLimit = 3; // Number of retry after which the payment is cancelled

GLOBAL.messages = {
  invalidAddress: "Invalid Solana Address!",
  invalidPayment:
    "Error: Your payment could not been verified. Try to pay by another mean. We will proceed to a refund shortly.",
  help: "Help",
  duration: "($ ago)",
};

GLOBAL.helpURL = "https://fims.fi?id=Help";

GLOBAL.processStep = [
  {
    index: 1,
    label: "Choose your language:",
    button: "English",
    action: setTranslationLanguage.name,
  },
  {
    index: 2,
    label: "Open your Solana wallet and send the payment to the merchant:",
    button: "Wallet",
    action: openWallet.name,
  },
  {
    index: 3,
    label: "Copy your Solana wallet address from your wallet then verify payment:",
    button: "Verify Payment," + GLOBAL.messages.help,
    action: verifyPayment.name,
  },
];

GLOBAL.wallet = [];
GLOBAL.wallet["Exodus"] = "https://play.google.com/store/apps/details?id=exodusmovement.exodus";
GLOBAL.wallet["Solflare"] = "https://solflare.com/portfolio";
GLOBAL.wallet[GLOBAL.messages.help] = "";

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

$(() => {
  initCommon();
});

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
  const merchantTitle = getMainTitle(company);
  setLanguages();
  setWallet();

  const logo = getImage(GLOBAL.user.ID, "Pay/Merchant", [{ name: "style", value: "margin: 25px;" }]);
  const logoHTML = getDiv("logo", null, "center", logo);
  const processHTML = getDiv("process", null, "center");
  $("#mainContent").html(logoHTML + processHTML);
  setProcess();

  $("body").html(getDiv("merchant", "contentOverlay", "right", merchantTitle) + $("body").html());
  displayElement("#mainContent, #merchant", false, 0);

  setCurrentStep(GLOBAL.processStep[0].index);

  finishLoading();

  displayElement("#mainContent, #merchant, #mainHeading", true, 3000);
}

function setLanguages() {
  const step = GLOBAL.processStep[0];
  setTranslationLanguage(step.button);

  const translation = GLOBAL.data[GLOBAL.translation];
  const index = indexOf(translation, step.label, GLOBAL.translationIndex);

  const label = [];
  translation[index].forEach((x) => label.push(x));
  step.label = label.join("<br>");

  const button = [];
  translation[0].forEach((x) => button.push(x));
  step.button = button.join(",");
}

function setWallet() {
  const step = GLOBAL.processStep[1];
  const wallet = [];
  for (let x in GLOBAL.wallet) {
    wallet.push(x);
  }
  step.button = wallet.join(",");
}

function setProcess() {
  let numberTML = "";
  GLOBAL.processStep.forEach((step) => {
    const stepNumber = "number" + step.index;
    numberTML += getImage(stepNumber, "Button", [
      { name: "id", value: stepNumber },
      { name: "class", value: "stepNumber" },
      { name: "style", value: "margin: 25px; width: 150px; height: 150px; opacity: 0.25; cursor:pointer" },
      { name: "onclick", value: "setCurrentStep(" + step.index + ")" },
    ]);
  });
  numberTML = getDiv("number", null, null, numberTML);
  const stepHTML = getDiv("step");

  $("#process").html(numberTML + "<br>" + stepHTML + "<br>");
  displayElement("#number, #step", false, 0);
}

function getStepContent(index) {
  let stepHTML = "";
  const step = GLOBAL.processStep[index];
  if (step) {
    stepHTML += getMainTitle(step.label);
    step.button.split(",").forEach((button) => (stepHTML += getStepButton(step.index, button, step.action)));
  }

  return stepHTML;
}

function getStepButton(index, label, action) {
  return (
    "<button onclick=\"getButtonAction(" +
    action +
    ",this.innerHTML," +
    index +
    `)" style="
    border-radius: 30px;
    height: 100px;
    width: 500px;
    font-size: 50px;
    line-height: 40px;
    margin: 50px;
    font-weight: bold;
    ">` +
    translate(label) +
    "</button>"
  );
}

async function getButtonAction(action, value, index) {
  const isOk = await action.call(this, value);
  if (isOk || isOk === undefined) {
    setCurrentStep(index + 1);
  }
}

function setCurrentStep(index) {
  if (index !== GLOBAL.currentStep) {
    GLOBAL.currentStep = index;
    $("#step").html(getStepContent(index - 1));
    displayElement("#step", false, 0);
    displayElement("#step", true, 2000);
  
    displayElement("#number", true, 0);
    $(".stepNumber").fadeTo(1000, 0.25);
    $("#number" + index).fadeTo(1000, 1);
  }
}

function openHelp(section) {
  const helpURL = GLOBAL.helpURL + "#" + section;
  window.open(helpURL, "_blank");
}

function openWallet(wallet) {
  navigator.clipboard.writeText(GLOBAL.merchantAddress);
  const url = GLOBAL.wallet[wallet];
  if (url) {
    window.open(url, "_blank");
    return true;
  } else {
    openHelp(arguments.callee.name);
    return false;
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
      setCustomerAddress(GLOBAL.customerAddress, displayPaymentStatus);
      return true;
    } else {
      displayError(GLOBAL.messages.invalidAddress);
      return false;
    }
  } else {
    openHelp(arguments.callee.name);
    return false;
  }
}

function setCustomerAddress(customerAddress, success) {
  GLOBAL.attempt = 0;
  setValue("Check!D" + GLOBAL.user.ID, [[customerAddress]], success);
}

function resetCustomerAddress() {
  setCustomerAddress("", () => setCustomerAddress(GLOBAL.customerAddress, displayPaymentStatus));
}

function loadPaymentStatus() {
  getValue(
    {
      formula: GLOBAL.paymentInfoFormula,
      filter: 0,
    },
    displayPaymentStatus
  );
}

async function displayPaymentStatus(id, contents) {
  let fullStatus = getDataValue(contents, GLOBAL.header.status);
  if (!fullStatus || fullStatus.slice(-3) === "...") {
    // Processing... or Loading...
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
      fullStatus = GLOBAL.invalidPayment;
      sendRefundEmail();
    }
  }

  if (fullStatus) {
    const status = fullStatus.split(":")[0].toLowerCase().trim();
    let html =
      getImage(status === GLOBAL.status.error ? "Cancel" : status === GLOBAL.status.warning ? "Bug" : "Validate", "Button", [
        { name: "style", value: "margin: 50px" },
      ]) + "<br>";
    html += getMainTitle(fullStatus);
    if (status !== GLOBAL.status.error) {
      html += getMainTitle(toCurrency(getDataValue(contents, GLOBAL.header.amount)));
      if (status !== GLOBAL.status.success) {
        const d = getDataValue(contents, GLOBAL.header.duration).split(":");
        const duration = (parseInt(d[0]) > 0 ? d[0] + "h " : "") + (parseInt(d[1]) > 0 ? d[1] + "m " : "") + d[2] + "s";

        html += getMainTitle(getDataValue(contents, GLOBAL.header.time));
        html += getMainTitle(translate(GLOBAL.messages.duration).replace("$", duration));
      }
    } else {
      html += getStepButton(1, "Retry", setProcess.name);
    }
    
    setCustomerAddress("");
    showLoader(false);

    $("#process").html(html);
    displayElement("#process", true);
  }
}

function sendRefundEmail() {
  const subject = "REFUND for [" + GLOBAL.customerAddress + "] / Merchant ID " + GLOBAL.user.ID + " @ " + toStringDate();
  google.script.run.withSuccessHandler().withFailureHandler(displayError).sendRecapEmail(subject);
}
