/* global GLOBAL, $, initCommon, google, getDiv, finishLoading, 
getValue, setValue, displayError, getImage, getDataValue, showLoader, 
getMainTitle, toCurrency, toStringDate, translate */
/* exported init, onKeyUp, validatePayment */

GLOBAL.hasTranslation = true;
GLOBAL.displayData = [];
GLOBAL.menuButton = [];
GLOBAL.user = [];

GLOBAL.isForMobile = true;

GLOBAL.merchantInfoFormula = "Check!A:C";
GLOBAL.paymentInfoFormula = "Check!A:H";
GLOBAL.customerAddressFormula = "Check!D";

GLOBAL.solanaAddressPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/i;

GLOBAL.customerAddress = "";
GLOBAL.attempt = 0; // Number of attempt to load payment data
GLOBAL.attemptTimeout = 5; // Duration between each attempt
GLOBAL.retry = 0; // Number of retry with a data reset which force reloading data
GLOBAL.retryTimeout = 30; // Duration between each retry
GLOBAL.retryLimit = 3; // Number of retry after which the payment is cancelled

GLOBAL.messages = {
  copyAddress: "Copy your crypto wallet address<br>and click below:",
  verifyPayment: "Verify Payment",
  invalidAddress: "Invalid Solana Address!",
  invalidPayment:
    "Error: Your payment could not been verified. Try to pay by another mean. We will proceed to a refund shortly.",
  duration: "($ ago)",
};

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
  google.script.run
    .withSuccessHandler(setUserId)
    .withFailureHandler(displayError)
    .getProperty("userId");
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
  const company = getDataValue(contents, GLOBAL.header.company);
  const merchantTitle = getMainTitle(company);
  document.body.innerHTML += getDiv("merchant", null, "right", merchantTitle);

  const logo = getImage(GLOBAL.user.ID, "Pay/Merchant", [
    { name: "style", value: "margin: 25px;" },
  ]);
  const logoHTML = getDiv("logo", null, "center", logo);

  let processHTML =
    getMainTitle(GLOBAL.messages.copyAddress) +
    `<button onclick="validatePayment()" style="
        border-radius: 30px;
        height: 100px;
        width: 500px;
        font-size: 50px;
        line-height: 40px;
        margin: 50px;
      ">` +
    translate(GLOBAL.messages.verifyPayment) +
    "</button>";
  processHTML = getDiv("process", null, "center", processHTML);

  $("#mainContent").html(logoHTML + processHTML);
  finishLoading();
}

async function validatePayment() {
  const clipboard = await navigator.clipboard.readText();
  const customerAddress = clipboard.match(GLOBAL.solanaAddressPattern);
  if (customerAddress && customerAddress.length == 1) {
    showLoader(true);
    GLOBAL.retry = 0;
    GLOBAL.customerAddress = customerAddress[0];
    setCustomerAddress(GLOBAL.customerAddress, displayPaymentStatus);
  } else {
    displayError(GLOBAL.messages.invalidAddress);
  }
}

function setCustomerAddress(customerAddress, success) {
  GLOBAL.attempt = 0;
  setValue("Check!D" + GLOBAL.user.ID, [[customerAddress]], success);
}

function resetCustomerAddress() {
  setCustomerAddress("", () =>
    setCustomerAddress(GLOBAL.customerAddress, displayPaymentStatus)
  );
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
      console.log(
        "attempt " +
          GLOBAL.attempt +
          "/" +
          GLOBAL.retryTimeout / GLOBAL.attemptTimeout
      );
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
      getImage(
        status === GLOBAL.status.error
          ? "Cancel"
          : status === GLOBAL.status.warning
            ? "Bug"
            : "Validate",
        "Button",
        [{ name: "style", value: "margin: 50px" }]
      ) + "<br>";
    html += getMainTitle(fullStatus);
    if (status !== GLOBAL.status.error) {
      html += getMainTitle(
        toCurrency(getDataValue(contents, GLOBAL.header.amount))
      );
      if (status !== GLOBAL.status.success) {
        const d = getDataValue(contents, GLOBAL.header.duration).split(":");
        const duration =
          (parseInt(d[0]) > 0 ? d[0] + "h " : "") +
          (parseInt(d[1]) > 0 ? d[1] + "m " : "") +
          d[2] +
          "s";

        html += getMainTitle(getDataValue(contents, GLOBAL.header.time));
        html += getMainTitle(
          translate(GLOBAL.messages.duration).replace("$", duration)
        );
      }
    }

    $("#process").html(html);

    setCustomerAddress("");
    showLoader(false);
  }
}
function sendRefundEmail() {
  const subject =
    "REFUND for [" +
    GLOBAL.customerAddress +
    "] / Merchant ID " +
    GLOBAL.user.ID +
    " @ " +
    toStringDate();
  google.script.run
    .withSuccessHandler()
    .withFailureHandler(displayError)
    .sendRecapEmail(subject);
}
