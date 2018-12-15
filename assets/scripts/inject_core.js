(async () => {
    console.info(`Minyami Extractor inited.`);
    let key = '';
    XMLHttpRequest.prototype._open = XMLHttpRequest.prototype.open;
    Object.defineProperty(XMLHttpRequest.prototype, 'open', {
        get: function () {
            return this._open;
        },
        set: function (f) {
            this._open = new Proxy(f, {
                apply: function (f, instance, fargs) {
                    listen.call(instance, ...fargs);
                    return f.call(instance, ...fargs)
                }
            });
        }
    });
    XMLHttpRequest.prototype.open = XMLHttpRequest.prototype.open;
    const listen = function () {
        this.addEventListener('load', function () {
            if (this.responseURL.includes('m3u8')) {
                console.log(this.responseURL);
            }
            if (this.readyState === 4 && new URL(this.responseURL).pathname.endsWith('m3u8')) {
                if (this.responseText.match(/#EXT-X-STREAM-INF/) !== null) {
                    chrome.runtime.sendMessage("cgejkofhdaffiifhcohjdbbheldkiaed", {
                        "type": "playlist",
                        "content": this.responseText,
                        "url": this.responseURL,
                        "title": document.title
                    })
                } else {
                    chrome.runtime.sendMessage("cgejkofhdaffiifhcohjdbbheldkiaed", {
                        "type": "chunklist",
                        "content": this.responseText,
                        "url": this.responseURL,
                        "title": document.title
                    })
                }
                switch (location.host) {
                    case 'abema.tv': {
                        abema(this);
                        break;
                    }
                    case 'live2.nicovideo.jp': {
                        nico();
                        break;
                    }
                }
            }
        });
    }
    /**
     * Site Scripts
     */
    /**
     * Get key for Abema!
     */
    const abema = (xhr) => {
        if (xhr.readyState === 4) {
            XMLHttpRequest.prototype = new Proxy(XMLHttpRequest.prototype, {
                set: async function (obj, prop, value) {
                    if (arguments[3].proxy) {
                        while (!arguments[3].proxy.response) {
                            await sleep(100);
                        }
                        const aKey = Array.from(new Uint8Array(arguments[3].proxy.response)).map(i => i.toString(16).length === 1 ? '0' + i.toString(16) : i.toString(16)).join('');
                        key = aKey;
                        chrome.runtime.sendMessage("cgejkofhdaffiifhcohjdbbheldkiaed", {
                            "type": "key",
                            "key": key
                        });
                    }
                    return Reflect.set(...arguments);
                }
            });
        }
    }
    const nico = () => {
        try {
            const liveData = JSON.parse(document.querySelector('#embedded-data').getAttribute('data-props'));
            key = liveData.player.audienceToken;
            chrome.runtime.sendMessage("cgejkofhdaffiifhcohjdbbheldkiaed", {
                "type": "key",
                "key": key
            });
        } catch {

        }
    }

    const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));
    const sleep = (time) => new Promise(resolve => setTimeout(resolve, time));
})()