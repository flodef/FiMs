window.GLOBAL = {};
GLOBAL.isLocal = document.URL.includes(':8080');                                                  // Whether the app is running in local mode
GLOBAL.serverUrl = GLOBAL.isLocal ? '' : 'https://raw.githubusercontent.com/flodef/FiMS/master/'; // Remove the server URL if in local mode
GLOBAL.scriptUrl = GLOBAL.isLocal ? '' : 'https://flodef.github.io/FiMS/';                        // Remove the server URL if in local mode

initHTML();

function initHTML() {
  const body =
  getDiv('content', 'contentOverlay', null,
    getDiv('mainHeading') +
    getDiv('tabContainer') +
    getDiv('loaderBar', 'loaderBar') +
    getDiv('mainContent') +
    getDiv('footer'))
  + getDiv('scrollDiv', 'contentOverlay', 'center')
  + getDiv('menuDiv', 'contentOverlay', 'right')
  + getOverlayDiv('loader', 'shadeOverlay')
  + getOverlayDiv('popup', 'shadeOverlay')
  + getOverlayDiv('alert')
  + getDiv('snackbar');
  document.body.innerHTML = body;

  document.getElementById('tabContainer').classList.add('hidden');  // Hide the tabContainer as it displays an empty bar

  loadScript(0);    // Load every script one after the other
}

async function loadScript(i) {
  if (javascriptScriptSouce) {
    const src = javascriptScriptSouce[i];
    const length = javascriptScriptSouce.length;

    setLoaderBar((i + 1) / length);

    addScript(src);
    await waitForScript(src);

    // Load next library, and the main app script as last one
    if (++i < length) {
      loadScript(i);
    } else {
      const fn = pageTitle => addScript(pageTitle.replace('FiMs ', ''));
      google.script.run
        .withSuccessHandler(fn)
        .withFailureHandler(alert)
        .getProperty('pageTitle');
    }
  }
}

async function waitForScript(scriptName) {
  const fn = () => { if (scriptName.includes('jquery.min')) { try { return $(); } catch { return false; } }
  else if (scriptName.includes('xlsx')) { try { return XLSX; } catch { return false; } }
  else if (scriptName.includes('Google')) { try { return google; } catch { return false; } }
  else if (scriptName.includes('Common')) { try { return GLOBAL.data; } catch { return false; } }
  else { return true; } };
  while (!fn()) {
    await new Promise(r => setTimeout(r, 100));
  }
}

function addScript(scriptName) {
  var element = document.createElement('script');
  element.src = GLOBAL.scriptUrl + scriptName + '.js';
  document.head.appendChild(element);
}

function setLoaderBar(value) {
  const loader = document.getElementById('loaderBar');
  try {
    const item = $(loader);
    item.html(item.html() || '<span></span>');
    const span = item.children('span');
    span.data('origWidth', value*item.width())
      .width(span.width() || 0)
      .animate({width: span.data('origWidth')}, 3000);
  } catch (e) {
    loader.innerHTML = '<span style="width:' + value*100 + '%"></span>';
  }
}

function getDiv(id, cssClass, align, content = '') {
  return '<div' + addAttr('id', id) + addAttr('align', align)
    + addAttr('class', cssClass ? cssClass + (cssClass.toLowerCase().endsWith('overlay')
      && !cssClass.toLowerCase().includes('content') ? ' hidden' : '') : '') + '>'
    + content + '</div>';
}

function getOverlayDiv(id, cssClass = 'overlay') {
  return getDiv(id + 'Overlay', cssClass, null, getDiv(id));
}

function addAttr(name, value, isSingle) {
  return name && (value || value == 0)
    ? ' ' + name + (!isSingle ? '="' + value.toString().trim() + '"' : '') : '';
}
