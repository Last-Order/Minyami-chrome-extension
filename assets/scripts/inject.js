(() => {
    const injectNode = document.createElement('script');
    injectNode.src = chrome.extension.getURL("/assets/scripts/inject_core.js");
    document.getElementsByTagName('head')[0].prepend(injectNode);
})();