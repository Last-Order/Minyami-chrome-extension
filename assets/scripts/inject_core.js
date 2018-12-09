(async () => {
    console.info(`Minyami Extractor inited.`);
    XMLHttpRequest.prototype._open = XMLHttpRequest.prototype.open;
    Object.defineProperty(XMLHttpRequest.prototype, 'open', {
        get: function () {
            return this._open;
        },
        set: function (f) {
            this._open = new Proxy(f, {
                apply: function(f, instance, fargs) {
                    listen.call(instance, ...fargs);
                    return f.call(instance, ...fargs)
                }
            });
        }
    });
    const listen = function() {
        this.addEventListener('load', function () {
            if (this.responseURL.includes('m3u8')) {
                console.log(this.responseURL);
            }
            if (this.readyState === 4 && new URL(this.responseURL).pathname.endsWith('m3u8')) {
                if (this.responseText.match(/#EXT-X-STREAM-INF/) !== null) {
                    chrome.runtime.sendMessage("jhmfiobhajekkolijmmlmncgmhfajmgp", {
                        "type": "playlist",
                        "content": this.responseText,
                        "url": this.responseURL,
                        "title": document.title
                    })
                } else {
                    chrome.runtime.sendMessage("jhmfiobhajekkolijmmlmncgmhfajmgp", {
                        "type": "chunklist",
                        "content": this.responseText,
                        "url": this.responseURL,
                        "title": document.title
                    })
                }
            }
        });
    }
    const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));
    const sleep = (time) => new Promise(resolve => setTimeout(resolve, time));
})()