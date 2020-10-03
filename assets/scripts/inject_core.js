(async () => {
    // const MINYAMI_EXTENSION_ID = navigator.userAgent.includes('Edg') ? "djgfdgeokfljmadfphgoemldapjilanp" : "cgejkofhdaffiifhcohjdbbheldkiaed";
    // const MINYAMI_EXTENSION_ID = "cgejkofhdaffiifhcohjdbbheldkiaed";
    const MINYAMI_EXTENSION_ID = (await new Promise((res) => {
        window.addEventListener('MinyamiExtId', res, false);
        window.dispatchEvent(new CustomEvent('MinyamiReady'));
    })).detail;
    const notify = window.notifyMinyamiExtractor || ((msg) => // Firefox
        chrome.runtime.sendMessage(MINYAMI_EXTENSION_ID, msg) // Chromium
    );

    let key = "";
    if (window.fetch) {
        const _fetch = fetch;
        fetch = (url, ...fargs) => {
            return new Promise((resolve, reject) => {
                _fetch(url, ...fargs)
                    .then(async (res) => {
                        resolve(res);
                        return res.clone();
                    })
                    .then(async (r) => {
                        if (r.url.includes("m3u8")) {
                            const responseText = await r.text();
                            let title = document.title.replace(
                                /[\/\*\\\:|\?<>]/gi,
                                ""
                            );
                            if (
                                responseText.match(/#EXT-X-STREAM-INF/) !== null
                            ) {
                                notify(
                                    {
                                        type: "playlist",
                                        content: responseText,
                                        url: r.url,
                                        title,
                                    }
                                );
                            } else {
                                notify(
                                    {
                                        type: "chunklist",
                                        content: responseText,
                                        url: r.url,
                                        title,
                                    }
                                );
                            }
                            switch (location.host) {
                                case 'tif.spwn.jp': {
                                    tif();
                                }
                            }
                        }
                    })
                    .catch((e) => {
                        reject(e);
                    });
            });
        };
    }
    XMLHttpRequest.prototype._open = XMLHttpRequest.prototype.open;
    Object.defineProperty(XMLHttpRequest.prototype, "open", {
        get: function() {
            return this._open;
        },
        set: function(f) {
            this._open = new Proxy(f, {
                apply: function(f, instance, fargs) {
                    listen.call(instance, ...fargs);
                    return f.call(instance, ...fargs);
                },
            });
        },
    });
    XMLHttpRequest.prototype.open = XMLHttpRequest.prototype.open;
    const listen = function() {
        this.addEventListener("load", function() {
            if (this.responseURL.includes("m3u8")) {
                console.log(this.responseURL);
            }
            if (
                this.readyState === 4 &&
                new URL(this.responseURL).pathname.endsWith("m3u8")
            ) {
                let title;
                switch (location.host) {
                    case "nogidoga.com": {
                        title = document.querySelector(".EpisodePage__Title")
                            .innerText;
                    }
                }
                if (this.responseText.match(/#EXT-X-STREAM-INF/) !== null) {
                    notify({
                        type: "playlist",
                        content: this.responseText,
                        url: this.responseURL,
                        title:
                            title ||
                            document.title.replace(/[\/\*\\\:|\?<>]/gi, ""),
                    });
                } else {
                    notify({
                        type: "chunklist",
                        content: this.responseText,
                        url: this.responseURL,
                        title:
                            title ||
                            document.title.replace(/[\/\*\\\:|\?<>]/gi, ""),
                    });
                }
                // Execute after m3u8 loads
                switch (location.host) {
                    case "live2.nicovideo.jp": {
                        nico();
                        break;
                    }
                    case "www.dmm.com": {
                        dmm(this);
                        break;
                    }
                    case "www.dmm.co.jp": {
                        dmm_r18(this);
                        break;
                    }
                    case "tif.spwn.jp": {
                        tif(this);
                        break;
                    }
                }
            }
            // Execute when first AJAX request finished
            switch (location.host) {
                case "www.dmm.com": {
                    dmm(this);
                    break;
                }
                case "www.dmm.co.jp": {
                    dmm_r18(this);
                    break;
                }
                case "www.360ch.tv": {
                    ch360(this);
                    break;
                }
                case "cas.nicovideo.jp": {
                    nicocas(this);
                }
                case "hibiki-radio.jp": {
                    hibiki(this);
                }
                case "www.showroom-live.com": {
                    showroom(this);
                }
            }
        });
    };
    /**
     * Site Scripts
     */
    /**
     * Get key for Abema!
     */
    const abema = () => {
        Object.defineProperty(__CLIENT_REGION__, "isAllowed", {
            get: () => true,
        });
        Object.defineProperty(__CLIENT_REGION__, "status", {
            get: () => false,
        });
        const _Uint8Array = Uint8Array;
        Uint8Array = class extends _Uint8Array {
            constructor(...args) {
                super(...args);
                if (this.length === 16) {
                    const key = Array.from(new _Uint8Array(this))
                        .map((i) =>
                            i.toString(16).length === 1
                                ? "0" + i.toString(16)
                                : i.toString(16)
                        )
                        .join("");
                    if (key !== "00000000000000000000000000000000") {
                        notify({
                            type: "key",
                            key: key,
                        });
                    }
                }
                return this;
            }
        };
    };
    const hibiki = (xhr) => {
        if (xhr.readyState === 4 && xhr.responseURL.includes("datakey")) {
            const key = Array.from(new Uint8Array(xhr.response))
                .map((i) =>
                    i.toString(16).length === 1
                        ? "0" + i.toString(16)
                        : i.toString(16)
                )
                .join("");
            notify({
                type: "key",
                key: key,
            });
        }
    };
    const nico = () => {
        try {
            const liveData = JSON.parse(
                document
                    .querySelector("#embedded-data")
                    .getAttribute("data-props")
            );
            const websocketUrl = liveData.site.relive.webSocketUrl;
            if (websocketUrl.match(/audience_token=(.+)/)[1]) {
                key = websocketUrl.match(/audience_token=(.+)/)[1];
            }
            notify({
                type: "key",
                key: key,
            });
        } catch {}
    };

    const nicocas = () => {
        notify({
            type: "cookies",
            cookies:
                "user_session=" +
                document.cookie.match(/user_session\=(.+?)(;|$)/)[1],
        });
        notify({
            type: "key",
            key: `<CAS_MODE, ID=${location.href.match(/(lv\d+)/)[1]}>`,
        });
    };

    const tif = () => {
        notify({
            type: "cookies",
            cookies:
                "CloudFront-Policy=" +
                document.cookie.match(/CloudFront-Policy\=(.+?)(;|$)/)[1] + '; ' +
                "CloudFront-Signature=" + 
                document.cookie.match(/CloudFront-Signature\=(.+?)(;|$)/)[1] + '; ' + 
                "CloudFront-Key-Pair-Id=" + 
                document.cookie.match(/CloudFront-Key-Pair-Id\=(.+?)(;|$)/)[1] + '; '
        });
    }

    const dmm = (xhr) => {
        if (
            xhr.readyState === 4 &&
            xhr.responseURL.startsWith(
                "https://www.dmm.com/service/-/drm_iphone"
            )
        ) {
            const key = Array.from(new Uint8Array(xhr.response))
                .map((i) =>
                    i.toString(16).length === 1
                        ? "0" + i.toString(16)
                        : i.toString(16)
                )
                .join("");
            notify({
                type: "cookies",
                cookies:
                    "licenseUID=" +
                    document.cookie.match(/licenseUID\=(.+?)(;|$)/)[1],
            });
            notify({
                type: "key",
                key: key,
            });
        }
    };

    const dmm_r18 = (xhr) => {
        if (
            xhr.readyState === 4 &&
            xhr.responseURL.startsWith(
                "https://www.dmm.co.jp/service/-/drm_iphone"
            )
        ) {
            const key = Array.from(new Uint8Array(xhr.response))
                .map((i) =>
                    i.toString(16).length === 1
                        ? "0" + i.toString(16)
                        : i.toString(16)
                )
                .join("");
            notify({
                type: "cookies",
                cookies:
                    "licenseUID=" +
                    document.cookie.match(/licenseUID\=(.+?)(;|$)/)[1],
            });
            notify({
                type: "key",
                key: key,
            });
        }
    };

    const ch360 = (xhr) => {
        notify({
            type: "cookies",
            cookies:
                "ch360pt=" + document.cookie.match(/ch360pt\=(.+?)(;|$)/)[1],
        });
    };

    const twicas = async () => {
        const userName = location.href.match(
            /https:\/\/twitcasting.tv\/(.+?)(\/|$)/
        );
        if (userName) {
            await fetch(
                `https://twitcasting.tv/${userName[1]}/metastream.m3u8`
            );
        }
    };

    const youtube = async () => {
        const playerResponse = ytplayer.config.args.player_response;
        if (playerResponse) {
            const HlsManifestUrl = JSON.parse(playerResponse).streamingData
                .hlsManifestUrl;
            await fetch(HlsManifestUrl);
        }
        notify({
            type: "cookies",
            cookies: "PREF=" + document.cookie.match(/PREF\=(.+?)(;|$)/)[1],
        });
    };

    const showroom = (xhr) => {
        if (xhr.responseURL.includes("api/live/streaming_url")) {
            const response = JSON.parse(xhr.responseText);
            if (
                response.streaming_url_list.some((i) =>
                    i.url.endsWith("chunklist.m3u8")
                )
            ) {
                notify({
                    type: "playlist_chunklist",
                    content: xhr.responseText,
                    url: xhr.responseURL,
                    title: document.title.replace(/[\/\*\\\:|\?<>]/gi, ""),
                    chunkLists: response.streaming_url_list
                        .filter((i) => i.url.endsWith("chunklist.m3u8"))
                        .map((i) => {
                            return {
                                type: "video",
                                bandwidth: i.quality * 1024,
                                resolution: {
                                    x: "Unknown",
                                    y: "Unknown",
                                },
                                url: i.url,
                            };
                        }),
                });
            }
        }
    };


    // Execute when load
    switch (location.host) {
        case "abema.tv": {
            abema();
            break;
        }
        case "hibiki-radio.jp": {
            hibiki();
            break;
        }
        case "www.dmm.com": {
            dmm();
            break;
        }
        case "www.dmm.co.jp": {
            dmm_r18();
            break;
        }
        case "twitcasting.tv": {
            twicas();
            break;
        }
        case "www.youtube.com": {
            youtube();
            break;
        }
    }
})();
