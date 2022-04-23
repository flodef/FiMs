function IMPORTURL(url, str, isMulti) {

  //var url = "https://www.xe.com/en/currencyconverter/convert/?Amount=1&From=USD&To=EUR";
  //var str = "//p[@class='result__BigRate-sc-1bsijpp-1 iGrAod']";        //input
  //var format = 'class="result__BigRate-sc-1bsijpp-1 iGrAod">(.{4})';  //output
  //var url = "https://www.coingecko.com/en/coins/solana/usd";
  //var str = "//span[@class='no-wrap']";           //input
  //var format = <span class='no-wrap'.*>(.*)<.*</" //output
  //var url = "https://www.zonebourse.com/cours/etf/ISHARES-TREASURY-BOND-2-24002505/";
  //var str = "//td[@id='zbjsfv_dr']";          //input
  //var str = '<td.*id="zbjsfv_dr".*>\n*(.*)';  //output
  //var isMulti = true;
  let content = '';
  const format = str
    .replaceAll('\'','"')
    .replaceAll('//','<')
    .replaceAll('[@','.*')
    .replaceAll(']',(isMulti ? '.*>\\n*(.*)' : '.*>(.*)<.*</'));
  const regex = new RegExp(format);
  var response = UrlFetchApp.fetch(url);
  if (response) {
    const html = response.getContentText();
    if (html) {
      content = regex.exec(html)[1].trim();
    }
  }
  return content;
}
