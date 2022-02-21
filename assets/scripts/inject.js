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
    injectNode.src = chrome.runtime.getURL('/assets/scripts/inject_core.js');
    document.getElementsByTagName('head')[0].prepend(injectNode);
    const cachedUrl = location.href;
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!sender.tab && message.type === 'get_url') {
            sendResponse({type: 'url', detail: cachedUrl });
            return true;
        }
    });
})();
