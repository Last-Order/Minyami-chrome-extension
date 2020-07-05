(() => {
    window.addEventListener('MinyamiReady', () => {
        console.info(`Minyami Extractor inited.`);
        window.dispatchEvent(new CustomEvent('MinyamiExtId', {
            detail: chrome.runtime.id
        }));
    }, false);
    if (typeof exportFunction === "function") { // Firefox
        exportFunction(msg => {
            chrome.runtime.sendMessage(msg);
        }, window, {
            defineAs: 'notifyMinyamiExtractor'
        });
    }
    const injectNode = document.createElement('script');
    injectNode.src = chrome.extension.getURL('/assets/scripts/inject_core.js');
    document.getElementsByTagName('head')[0].prepend(injectNode);
})();
