// google.script.run
//              .withSuccessHandler(function(contents) {
//                updateDashboardTable(contents);
//
//                updateInvestmentValues();  // Next step
//              })
//              .withFailureHandler(displayError)
//              .getSheetValues("Dashboard!A:B");


class google {
  static get script() {
    return new Script();
  }
}

class Script {
  get run() {
    return new Run();
  }
}

class Run {
  // get contents() {
  //   return [["Banana", "Orange", "Apple", "Mango"],["Banana", "Orange", "Apple", "Mango"]];
  // }
  withSuccessHandler(func) {
    this.sh = func;
    return this;
  }
  withFailureHandler(func) {
    this.fh = func;
    return this;
  }
  getSheetValues(formulae) {
    this.contents = this.getData(formulae);
    this.errMsg = "";
    if (!this.errMsg) {
      this.sh(this.contents);
    } else {
      this.fh(this.errMsg);
    }
    return this;
  }
  getData(formulae) {
    switch (formulae) {
      case "Settings!A:F":
        return [["Savings", "24", "25", "26", "5", "19"],
        ["Expenses", "17", "3", "18", "23", "54"],
        ["Account", "42", "43", "44", "29", "28"],
        ["Performances", "32", "33", "34", "35", "36"],
        ["Allocations", "45", "46", "47", "48", "53"],
        ["Total portfolio", "Stock value", "Cash Fund", "Daily result", "Cumulated result", "Margin"],
        ["34", "32", "33", "57", "35", "46"]];
        break;
      case "Dashboard!A:B":
        return [["Yield", "-37.43%"],
        ["Monthly income", "2,297.81 €"],
        ["Monthly expenses", "442.25 €"],
        ["Year of retrieval", "41"],
        ["Cumulated saving", "184,153.67 €"],
        ["Cumulated profit", "-28,660.77 €"],
        ["Cumulated profit rate", "-4.85%"],
        ["Cumulated dividend", "12,358.01 €"],
        ["Cumulated dividend rate", "2.09%"],
        ["Saving duration", "7.718001369"],
        ["Average investment", "76,563.44 €"],
        ["Saving duration", "93 months (7.8 years)"],
        ["Working free duration", "417 months (34.8 years)"],
        ["Before independance duration", "55 months (4.6 years)"],
        ["Before independance gap", "100,802.73 €"],
        ["Income use", "19.25%"],
        ["Current expense", "325.25 €"],
        ["Expense gap ", "-79.35 €"],
        ["Debt", "-28,442.82 €"],
        ["Owing", "11,500.00 €"],
        ["Loan", "-23,863.40 €"],
        ["Client", "-16,079.42 €"],
        ["Monthly payment", "-426.17 €"],
        ["Saving available", "57.26 €"],
        ["Boursorama", "0.24 €"],
        ["N26", "57.02 €"],
        ["Current monthly dividend / thousand", "3.03 €"],
        ["Current monthly dividend", "680.41 €"],
        ["Last year monthly dividend ", "362.90 €"],
        ["Current portfolio duration", "3.162217659"],
        ["Current portfolio duration", "38 months (3.2 years)"],
        ["Current portfolio stock", "724,758.08 €"],
        ["Current portfolio cash", "-512,218.85 €"],
        ["Current portfolio value", "212,539.23 €"],
        ["Current portfolio total profit", "-12,077.31 €"],
        ["Current portfolio total profit rate", "-4.99%"],
        ["Current portfolio profit", "-16,586.35 €"],
        ["Current portfolio profit rate", "-6.85%"],
        ["Current portfolio dividend", "8,955.92 €"],
        ["Current portfolio dividend rate", "3.70%"],
        ["Current portfolio cost", "-4,446.88 €"],
        ["Total Approvisionnement", "241,200.00 €"],
        ["Previous profit", "-16,583.46 €"],
        ["Current Approvisionnement", "224,616.54 €"],
        ["Current Allocation", "531,000.00 €"],
        ["Margin", "-4,888.20 €"],
        ["Next Allocation", "503,000.00 €"],
        ["Allocation percentage", "250%"],
        ["Real dividend rate", "1.862%"],
        ["Year dividend rate", "2.121%"],
        ["Livret A", "0.750%"],
        ["EONIA", "-0.367%"],
        ["Interest rate (EONIA+1.25%)", "1.250%"],
        ["Monthly interest", "-534.69 €"],
        ["Provision", "-8,754.59 €"],
        ["Stock to rebalance", "3"],
        ["Daily result", "-4,713.83 €"],
        ["Last updated", "0:59:38"],
        ["App link", "https://goo.gl/amjmSv"]];
        break;
      case "Investment!D:AD":
        return [["Name", "Type", "Target Dist", "Cost", "Market", "Symbol", "Shares", "Price", "Price (€)", "Buy", "Sell", "Estimation", "Monthly trade", "Rank", "Rebalance", "Provision", "Rest", "Tendency", "Tendency", "Daily result", "Rate", "Dividend", "Rate", "Stock", "Rate", "Total", "Rate"],
        ["iShares USD Treasury Bond 20+yr UCITS ETF", "Long term US bonds (20-25 year)", "40.0%", "0.20%", "LON", "LN", "73,288", "$4.54", "3.9755 €", "280,330.24 €", "291,355.10 €", "285,831.35 €", "-15,328.90 €", "4", "-1390", "-5,525.92 €", "-3.98 €", "0.27%", "SELL (0.27%)", "2,438.65 €", "0.84%", "2,086.02 €", "0.74%", "11,024.86 €", "3.93%", "13,110.88 €", "4.68%"],
        ["Vanguard S&P 500 UCITS ETF", "Stocks", "30.0%", "0.07%", "AMS", "NA", "5,365", "", "39.954 €", "237,279.71 €", "214,353.21 €", "214,373.51 €", "18,849.26 €", "0", "0", "0.00 €", "-39.95 €", "-2.26%", "MID (-2.26%)", "-7,344.69 €", "-3.31%", "2,027.24 €", "0.85%", "-22,926.50 €", "-9.66%", "-20,899.26 €", "-8.81%"],
        ["iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist", "Intermediate US bonds (7-10 year)", "15.0%", "0.20%", "AMS", "NA", "655", "", "166.99 €", "104,617.95 €", "109,378.45 €", "107,186.76 €", "-4,160.00 €", "3", "-13", "-2,170.87 €", "0.00 €", "0.17%", "SELL (0.17%)", "366.80 €", "0.34%", "1,860.88 €", "1.78%", "4,760.50 €", "4.55%", "6,621.38 €", "6.33%"],
        ["ETFS All Commodities", "Commodities", "7.5%", "0.49%", "EPA", "FP", "7,901", "", "6.959 €", "58,421.84 €", "54,983.06 €", "53,593.38 €", "1,876.04 €", "2", "0", "0.00 €", "0.00 €", "-0.61%", "MID (-0.61%)", "-355.54 €", "-0.64%", "0.00 €", "0.00%", "-3,438.78 €", "-5.89%", "-3,438.78 €", "-5.89%"],
        ["ETFS Physical Gold", "Gold", "7.5%", "0.39%", "AMS", "NA", "517", "", "105.78 €", "53,354.68 €", "54,688.26 €", "53,593.38 €", "-2,104.80 €", "1", "-10", "-1,057.80 €", "0.00 €", "0.25%", "SELL (0.25%)", "180.95 €", "0.33%", "0.00 €", "0.00%", "1,333.58 €", "2.50%", "1,333.58 €", "2.50%"],
        ["TOTAL", "TOTAL", "100.00%", "0.20%", "", "", "", "1.142 €", "1.142 €", "734,004.42 €", "724,758.08 €", "714,578.37 €", "-868.40 €", "", "", "-8,754.59 €", "-44.25 €", "", "", "-4,713.83 €", "-0.64%", "5,974.14 €", "0.81%", "-9,246.34 €", "-1.26%", "-3,272.20 €", "-0.45%"]];
        break;
      case "Historic!A:I":
        return [["Date", "Type", "Label", "Transaction", "Quantity", "Price", "Value", "ID", "Profit"],
["21/12/2018", "Gold", "ETFS Physical Gold", "SELL", "-10", "105.65 €", "1,056.50€", "ETFS Physical Gold@SELL@-10@1056.5", "-1.30 €"],
["21/12/2018", "Intermediate US bonds (7-10 year)", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist", "SELL", "-10", "166.55 €", "1,665.50€", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist@SELL@-10@1665.5", "-4.40 €"],
["20/12/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "BUY", "100", "41.63 €", "-4,163.00€", "Vanguard S&P 500 UCITS ETF@BUY@100@-4163", "-167.60 €"],
["20/12/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "COST", "", "", "-2.83€", "Vanguard S&P 500 UCITS ETF@COST@@-2.83"],
["20/12/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-2.43€", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-2.43"],
["20/12/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "SELL", "-544", "3.971 €", "2,160.24€", "iShares USD Treasury Bond 20+yr UCITS ETF@SELL@-544@2160.24", "-2.42 €"],
["20/12/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-3.41€", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-3.41"],
["20/12/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "SELL", "-1,760", "3.985 €", "7,013.08€", "iShares USD Treasury Bond 20+yr UCITS ETF@SELL@-1760@7013.08", "16.23 €"],
["19/12/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-2.92€", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-2.92"],
["19/12/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "SELL", "-1,177", "3.919 €", "4,613.00€", "iShares USD Treasury Bond 20+yr UCITS ETF@SELL@-1177@4613", "-66.14 €"],
["18/12/2018", "Intermediate US bonds (7-10 year)", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist", "SELL", "-15", "166.30 €", "2,494.50€", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist@SELL@-15@2494.5", "-10.35 €"],
["18/12/2018", "Gold", "ETFS Physical Gold", "SELL", "-10", "104.83 €", "1,048.30€", "ETFS Physical Gold@SELL@-10@1048.3", "-9.50 €"],
["17/12/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "BUY", "48", "43.36 €", "-2,081.28 €", "Vanguard S&P 500 UCITS ETF@BUY@48@-2081.28", "-163.49 €"],
["17/12/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "COST", "", "", "-2.42 €", "Vanguard S&P 500 UCITS ETF@COST@@-2.42"],
["17/12/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "BUY", "60", "43.37 €", "-2,602.20 €", "Vanguard S&P 500 UCITS ETF@BUY@60@-2602.2", "-204.96 €"],
["17/12/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "COST", "", "", "-2.52 €", "Vanguard S&P 500 UCITS ETF@COST@@-2.52"],
["17/12/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "BUY", "88", "43.70 €", "-3,845.60 €", "Vanguard S&P 500 UCITS ETF@BUY@88@-3845.6", "-329.65 €"],
["17/12/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "COST", "", "", "-2.77 €", "Vanguard S&P 500 UCITS ETF@COST@@-2.77"],
["14/12/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "SELL", "-190", "44.39 €", "8,434.10 €", "Vanguard S&P 500 UCITS ETF@SELL@-190@8434.1", "842.84 €"],
["14/12/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "COST", "", "", "-3.69 €", "Vanguard S&P 500 UCITS ETF@COST@@-3.69"],
["07/12/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "BUY", "91", "44.735 €", "-4,070.88 €", "Vanguard S&P 500 UCITS ETF@BUY@91@-4070.88", "-435.07 €"],
["07/12/2018", "Commodities", "ETFS All Commodities", "BUY", "255", "7.357 €", "-1,876.04 €", "ETFS All Commodities@BUY@255@-1876.04", "-101.50 €"],
["06/12/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-2.31 €", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-2.31"],
["06/12/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "SELL", "-392", "3.935 €", "1,542.58 €", "iShares USD Treasury Bond 20+yr UCITS ETF@SELL@-392@1542.58", "-15.81 €"],
["06/12/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "BUY", "236", "44.578 €", "-10,520.40 €", "Vanguard S&P 500 UCITS ETF@BUY@236@-10520.41", "-1,091.26 €"],
["04/12/2018", "", "", "APPROVISIONNEMENT", "", "", "-1,500.00 €", "@APPROVISIONNEMENT@@-1500"],
["04/12/2018", "", "", "COST", "", "", "-579.07 €", "@COST@@-579.07"],
["06/04/2029", "", "", "COST", "", "", "-8.04 €"],
["01/12/2018", "", "", "COST", "", "", "0.22 €", "@COST@@-0.04"],
["30/11/2018", "Intermediate US bonds (7-10 year)", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist", "DIVIDEND", "", "", "-204.87 €", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist@DIVIDEND@@-204.87"],
["29/11/2018", "Intermediate US bonds (7-10 year)", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist", "DIVIDEND", "", "", "1,663.14 €", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist@DIVIDEND@@1663.14"],
["29/11/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "SELL", "-25", "45.70 €", "1,142.50 €", "Vanguard S&P 500 UCITS ETF@SELL@-25@1142.5", "143.65 €"],
["29/11/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "COST", "", "", "-2.23 €", "Vanguard S&P 500 UCITS ETF@COST@@-2.23"],
["26/11/2018", "Commodities", "ETFS All Commodities", "BUY", "214", "7.25 €", "-1,551.50 €", "ETFS All Commodities@BUY@214@-1551.5", "-62.27 €"],
["26/11/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-2.23 €", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-2.23"],
["26/11/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "SELL", "-300", "3.819 €", "1,145.66 €", "iShares USD Treasury Bond 20+yr UCITS ETF@SELL@-300@1145.66", "-46.98 €"],
["23/11/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-0.01 €", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-0.01"],
["22/11/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-3.37 €", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-3.37"],
["22/11/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "SELL", "-1,798", "3.797 €", "6,827.20 €", "iShares USD Treasury Bond 20+yr UCITS ETF@SELL@-1798@6827.2", "-320.72 €"],
["22/11/2018", "Intermediate US bonds (7-10 year)", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist", "SELL", "-7", "162.69 €", "1,138.83 €", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist@SELL@-7@1138.83", "-30.10 €"],
["22/11/2018", "Intermediate US bonds (7-10 year)", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist", "COST", "", "", "-2.23 €", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist@COST@@-2.23"],
["22/11/2018", "Gold", "ETFS Physical Gold", "SELL", "-1", "102.84 €", "102.84 €", "ETFS Physical Gold@SELL@-1@102.84", "-2.94 €"],
["15/11/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "BUY", "60", "45.362 €", "-2,721.72 €", "Vanguard S&P 500 UCITS ETF@BUY@60@-2721.72", "-324.48 €"],
["15/11/2018", "Intermediate US bonds (7-10 year)", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist", "BUY", "7", "163.75 €", "-1,146.25 €", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist@BUY@7@-1146.25", "22.68 €"],
["13/11/2018", "", "", "APPROVISIONNEMENT", "", "", "-300.00 €", "@APPROVISIONNEMENT@@-300"],
["02/11/2018", "", "", "COST", "", "", "-555.00 €", "@COST@@-555"],
["01/11/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "BUY", "239", "45.493 €", "-10,872.83 €", "Vanguard S&P 500 UCITS ETF@BUY@239@-10872.83", "-1,323.82 €"],
["01/11/2018", "Commodities", "ETFS All Commodities", "BUY", "326", "7.482 €", "-2,439.13 €", "ETFS All Commodities@BUY@326@-2439.13", "-170.50 €"],
["01/11/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-4.09 €", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-4.09"],
["01/11/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "BUY", "2,786", "3.756 €", "-10,463.08 €", "iShares USD Treasury Bond 20+yr UCITS ETF@BUY@2786@-10463.08", "612.61 €"],
["01/11/2018", "Intermediate US bonds (7-10 year)", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist", "BUY", "16", "163.81 €", "-2,620.96 €", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist@BUY@16@-2620.96", "50.88 €"],
["25/10/2018", "", "", "APPROVISIONNEMENT", "", "", "6,060.00€", "@APPROVISIONNEMENT@@6060"],
["12/10/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-2.82€", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-2.82"],
["12/10/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "SELL", "-1,106", "3.708 €", "4,101.58€", "iShares USD Treasury Bond 20+yr UCITS ETF@SELL@-1106@4101.58", "-295.30 €"],
["12/10/2018", "Intermediate US bonds (7-10 year)", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist", "SELL", "-11", "160.47 €", "1,765.17€", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist@SELL@-11@1765.17", "-71.72 €"],
["12/10/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "BUY", "55", "45.353 €", "-2,494.42€", "Vanguard S&P 500 UCITS ETF@BUY@55@-2494.42", "-296.95 €"],
["12/10/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-4.42€", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-4.42"],
["12/10/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "SELL", "-3,258", "3.707 €", "12,076.62€", "iShares USD Treasury Bond 20+yr UCITS ETF@SELL@-3258@12076.62", "-875.50 €"],
["12/10/2018", "Gold", "ETFS Physical Gold", "SELL", "-10", "100.61 €", "1,006.10€", "ETFS Physical Gold@SELL@-10@1006.1", "-51.70 €"],
["12/10/2018", "Intermediate US bonds (7-10 year)", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist", "SELL", "-13", "160.39 €", "2,085.07€", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist@SELL@-13@2085.07", "-85.80 €"],
["12/10/2018", "Commodities", "ETFS All Commodities", "SELL", "-32", "7.607 €", "243.42€", "ETFS All Commodities@SELL@-32@243.42", "20.73 €"],
["12/10/2018", "Commodities", "ETFS All Commodities", "COST", "", "", "-2.05€", "ETFS All Commodities@COST@@-2.05"],
["11/10/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "DIVIDEND", "", "", "-136.05€", "Vanguard S&P 500 UCITS ETF@DIVIDEND@@-136.05"],
["10/10/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "DIVIDEND", "", "", "1,024.70€", "Vanguard S&P 500 UCITS ETF@DIVIDEND@@1024.7"],
["05/10/2018", "Gold", "ETFS Physical Gold", "SELL", "-9", "99.89 €", "899.01€", "ETFS Physical Gold@SELL@-9@899.01", "-53.01 €"],
["04/10/2018", "Commodities", "ETFS All Commodities", "SELL", "-238", "7.784 €", "1,852.59€", "ETFS All Commodities@SELL@-238@1852.59", "196.35 €"],
["04/10/2018", "Intermediate US bonds (7-10 year)", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist", "SELL", "-5", "161.06 €", "805.30€", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist@SELL@-5@805.3", "-29.65 €"],
["04/10/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-3.76€", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-3.76"],
["04/10/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "BUY", "2,361", "3.731 €", "-8,808.53€", "iShares USD Treasury Bond 20+yr UCITS ETF@BUY@2361@-8808.53", "577.58 €"],
["02/10/2018", "", "", "COST", "", "", "-501.62€", "@COST@@-501.62"],
["26/09/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "SELL", "-30", "47.288 €", "1,418.64€", "Vanguard S&P 500 UCITS ETF@SELL@-30@1418.64", "220.02 €"],
["26/09/2018", "Commodities", "ETFS All Commodities", "SELL", "-225", "7.373 €", "1,658.92€", "ETFS All Commodities@SELL@-225@1658.92", "93.15 €"],
["26/09/2018", "Gold", "ETFS Physical Gold", "SELL", "-12", "97.53 €", "1,170.36€", "ETFS Physical Gold@SELL@-12@1170.36", "-99.00 €"],
["24/09/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "SELL", "-30", "47.385 €", "1,421.55€", "Vanguard S&P 500 UCITS ETF@SELL@-30@1421.55", "222.93 €"],
["20/09/2018", "Commodities", "ETFS All Commodities", "SELL", "-250", "7.261 €", "1,815.25€", "ETFS All Commodities@SELL@-250@1815.25", "75.50 €"],
["20/09/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "SELL", "-45", "47.386 €", "2,132.37€", "Vanguard S&P 500 UCITS ETF@SELL@-45@2132.37", "334.44 €"],
["20/09/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-2.54€", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-2.54"],
["20/09/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "BUY", "717", "3.757 €", "-2,693.88€", "iShares USD Treasury Bond 20+yr UCITS ETF@BUY@717@-2693.88", "156.54 €"],
["18/09/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-2.40€", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-2.4"],
["18/09/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "BUY", "525", "3.811 €", "-2,000.72€", "iShares USD Treasury Bond 20+yr UCITS ETF@BUY@525@-2000.72", "86.41 €"],
["14/09/2018", "", "", "APPROVISIONNEMENT", "", "", "440.00€", "@APPROVISIONNEMENT@@440"],
["11/09/2018", "", "", "APPROVISIONNEMENT", "", "", "-500.00€", "@APPROVISIONNEMENT@@-500"],
["07/09/2018", "Long term US bonds (20-25 year)", "Vanguard Extended Duration Treasury ETF", "DIVIDEND", "", "", "-12.85€", "Vanguard Extended Duration Treasury ETF@DIVIDEND@@-12.85"],
["06/09/2018", "Long term US bonds (20-25 year)", "Vanguard Extended Duration Treasury ETF", "DIVIDEND", "", "", "91.39€", "Vanguard Extended Duration Treasury ETF@DIVIDEND@@91.39"],
["06/09/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-2.26€", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-2.26"],
["06/09/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "BUY", "336", "3.874 €", "-1,301.59€", "iShares USD Treasury Bond 20+yr UCITS ETF@BUY@336@-1301.59", "34.17 €"],
["03/09/2018", "", "", "COST", "", "", "-573.99€", "@COST@@-573.99"],
["30/08/2018", "Gold", "ETFS Physical Gold", "BUY", "12", "98.34 €", "-1,180.08€", "ETFS Physical Gold@BUY@12@-1180.08", "89.28 €"],
["29/08/2018", "Commodities", "ETFS All Commodities", "BUY", "305", "7.26 €", "-2,214.30€", "ETFS All Commodities@BUY@305@-2214.3", "-91.81 €"],
["29/08/2018", "Intermediate US bonds (7-10 year)", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist", "BUY", "8", "162.34 €", "-1,298.72€", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist@BUY@8@-1298.72", "37.20 €"],
["29/08/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-2.39€", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-2.39"],
["29/08/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "BUY", "500", "3.891 €", "-1,945.61€", "iShares USD Treasury Bond 20+yr UCITS ETF@BUY@500@-1945.61", "42.13 €"],
["29/08/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-3.15€", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-3.15"],
["29/08/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "BUY", "1,478", "3.885 €", "-5,742.57€", "iShares USD Treasury Bond 20+yr UCITS ETF@BUY@1478@-5742.57", "133.19 €"],
["29/08/2018", "Intermediate US bonds (7-10 year)", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist", "BUY", "8", "162.14 €", "-1,297.12€", "iShares USD Treasury Bond 7-10yr UCITS ETF USD Dist@BUY@8@-1297.12", "38.80 €"],
["28/08/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "COST", "", "", "-2.90€", "iShares USD Treasury Bond 20+yr UCITS ETF@COST@@-2.9"],
["28/08/2018", "Long term US bonds (20-25 year)", "iShares USD Treasury Bond 20+yr UCITS ETF", "BUY", "1,154", "3.90 €", "-4,500.42€", "iShares USD Treasury Bond 20+yr UCITS ETF@BUY@1154@-4500.42", "87.29 €"],
["27/08/2018", "Stocks", "Vanguard S&P 500 UCITS ETF", "BUY", "84", "47.252 €", "-3,969.17€", "Vanguard S&P 500 UCITS ETF@BUY@84@-3969.17", "-613.03 €"],
["27/08/2018", "Commodities", "ETFS All Commodities", "BUY", "443", "7.358 €", "-3,259.59€", "ETFS All Commodities@BUY@443@-3259.59", "-176.75 €"]];
        break;
      default:
        throw("Unknown Formulae :" + formulae);
    }
    // [["Banana", "Orange", "Apple", "Mango"],["Banana", "Orange", "Apple", "Mango"]];
  }
}
