(async () => {
    const MINYAMI_EXTENSION_ID = (
        await new Promise((res) => {
            window.addEventListener("MinyamiExtId", res, { capture: false, once: true });
            window.dispatchEvent(new CustomEvent("MinyamiReady"));
        })
    ).detail;
    const notify =
        window.notifyMinyamiExtractor /* Firefox */ || ((msg) => chrome.runtime.sendMessage(MINYAMI_EXTENSION_ID, msg));
    window.addEventListener(
        "MinyamiGetPageUrl",
        () => {
            window.dispatchEvent(new CustomEvent("MinyamiPageUrl", { detail: window.location.href }));
        },
        false
    );
    window.addEventListener("unload", notify({ type: "page_url", url: window.location.href }), false);
    const escapeFilename = (filename) => {
        return filename.replace(/[\/\*\\\:|\?<>"!]/gi, "");
    };
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
                        if (r.url.match(/\.m3u8(\?|$)/)) {
                            const responseText = await r.text();
                            let title = escapeFilename(document.title);
                            let streamName;
                            switch (location.host) {
                                case "abema.tv": {
                                    if (document.querySelector(".c-tv-SwitchAngleButton-current-angle-name")) {
                                        streamName = document.querySelector(
                                            ".c-tv-SwitchAngleButton-current-angle-name"
                                        ).innerText;
                                    }
                                }
                            }
                            if (responseText.match(/#EXT-X-STREAM-INF/) !== null) {
                                notify({
                                    type: "playlist",
                                    content: responseText,
                                    url: r.url,
                                    title,
                                    streamName
                                });
                            } else {
                                const keyUrlMatch = responseText.match(/#EXT-X-KEY:.*URI="(.*)"/);
                                notify({
                                    type: "chunklist",
                                    content: responseText,
                                    url: r.url,
                                    title,
                                    ...(keyUrlMatch && { keyUrl: keyUrlMatch[1] })
                                });
                            }
                            switch (location.host) {
                                case "spwn.jp": {
                                    spwn();
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
        get: function () {
            return this._open;
        },
        set: function (f) {
            this._open = new Proxy(f, {
                apply: function (f, instance, fargs) {
                    listen.call(instance, ...fargs);
                    return f.call(instance, ...fargs);
                }
            });
        }
    });
    XMLHttpRequest.prototype.open = XMLHttpRequest.prototype.open;
    const listen = function () {
        this.addEventListener("load", function () {
            if (this.responseURL.match(/\.m3u8(\?|$)/)) {
                console.log(this.responseURL);
            }
            if (this.readyState === 4 && new URL(this.responseURL).pathname.endsWith("m3u8")) {
                let title;
                switch (location.host) {
                    case "nogidoga.com": {
                        title = escapeFilename(document.querySelector(".EpisodePage__Title").innerText);
                        break;
                    }
                    case "www.dmm.co.jp": {
                        title = escapeFilename(document.querySelector(".title")?.innerText);
                        break;
                    }
                }
                if (this.responseText.match(/#EXT-X-STREAM-INF/) !== null) {
                    notify({
                        type: "playlist",
                        content: this.responseText,
                        url: this.responseURL,
                        title: title || escapeFilename(document.title)
                    });
                } else {
                    const keyUrlMatch = this.responseText.match(/#EXT-X-KEY:.*URI="(.*)"/);
                    notify({
                        type: "chunklist",
                        content: this.responseText,
                        url: this.responseURL,
                        title: title || escapeFilename(document.title),
                        ...(keyUrlMatch && { keyUrl: keyUrlMatch[1] })
                    });
                }
                // Execute after m3u8 loads
                switch (location.host) {
                    case "live2.nicovideo.jp": case "live.nicovideo.jp": {
                        nico();
                        break;
                    }
                    case "www.dmm.com": case "www.dmm.co.jp": {
                        dmm(this);
                        break;
                    }
                    case "spwn.jp": {
                        spwn(this);
                        break;
                    }
                }
            }
            // Execute when first AJAX request finished
            switch (location.host) {
                case "www.dmm.com": case "www.dmm.co.jp": {
                    dmm(this);
                    break;
                }
                case "www.360ch.tv": {
                    ch360(this);
                    break;
                }
                case "hibiki-radio.jp": {
                    matchurl(this, "datakey");
                    break;
                }
                case "www.onsen.ag": {
                    matchurl(this, "key.m3u8key");
                    break;
                }
                case "www.showroom-live.com": {
                    showroom(this);
                    break;
                }
                case "nicochannel.jp": case "pizzaradio.jp": {
                    matchurl(this, "https://hls-auth.cloud.stream.co.jp/key");
                    break;
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
            get: () => true
        });
        Object.defineProperty(__CLIENT_REGION__, "status", {
            get: () => false
        });
        const _Uint8Array = Uint8Array;
        Uint8Array = class extends _Uint8Array {
            constructor(...args) {
                super(...args);
                if (this.length === 16) {
                    const key = Array.from(new _Uint8Array(this))
                        .map((i) => (i.toString(16).length === 1 ? "0" + i.toString(16) : i.toString(16)))
                        .join("");
                    if (key !== "00000000000000000000000000000000") {
                        notify({
                            type: "key",
                            key: key
                        });
                    }
                }
                return this;
            }
        };
    };

    const matchurl = (xhr, keyword) => {
        if (xhr.readyState === 4 && xhr.responseURL.includes(keyword)) {
            const key = Array.from(new Uint8Array(xhr.response))
                .map((i) => (i.toString(16).length === 1 ? "0" + i.toString(16) : i.toString(16)))
                .join("");
            notify({
                type: "key",
                key: key,
                url: xhr.responseURL
            });
        }
    };

    const nico = () => {
        try {
            const liveData = JSON.parse(document.querySelector("#embedded-data").getAttribute("data-props"));
            const websocketUrl = liveData.site.relive.webSocketUrl;
            if (websocketUrl.match(/audience_token=(.+)/)[1]) {
                key = websocketUrl.match(/audience_token=(.+)/)[1];
            }
            if (liveData.program?.stream?.maxQuality) {
                key += `,${liveData.program.stream.maxQuality}`;
            }
            notify({
                type: "key",
                key: key
            });
        } catch {}
    };

    const spwn = () => {
        notify({
            type: "cookies",
            cookies:
                "CloudFront-Policy=" +
                document.cookie.match(/CloudFront-Policy\=(.+?)(;|$)/)[1] +
                "; " +
                "CloudFront-Signature=" +
                document.cookie.match(/CloudFront-Signature\=(.+?)(;|$)/)[1] +
                "; " +
                "CloudFront-Key-Pair-Id=" +
                document.cookie.match(/CloudFront-Key-Pair-Id\=(.+?)(;|$)/)[1] +
                "; "
        });
    };

    const dmm = (xhr) => {
        if (
            xhr.readyState === 4 &&
            (xhr.responseURL.match(new RegExp("https://www.dmm.(com|co.jp)/service/-/drm_iphone")) ||
                xhr.responseURL.startsWith("https://mlic.dmm.co.jp/drm/hlsaes/key/"))
        ) {
            const key = Array.from(new Uint8Array(xhr.response))
                .map((i) => (i.toString(16).length === 1 ? "0" + i.toString(16) : i.toString(16)))
                .join("");
            notify({
                type: "cookies",
                cookies: "licenseUID=" + document.cookie.match(/licenseUID\=(.+?)(;|$)/)[1]
            });
            notify({
                type: "key",
                key: key
            });
        }
    };

    const ch360 = (xhr) => {
        notify({
            type: "cookies",
            cookies: "ch360pt=" + document.cookie.match(/ch360pt\=(.+?)(;|$)/)[1]
        });
    };

    const twicas = async () => {
        const userName = location.href.match(/https:\/\/twitcasting.tv\/(.+?)(\/|$)/);
        if (userName && !location.href.includes("/movie/")) {
            await fetch(`https://twitcasting.tv/${userName[1]}/metastream.m3u8`);
        }
        if (location.href.includes("/movie/")) {
            const playlistInfo = document.querySelector("video").getAttribute("data-movie-playlist");
            if (playlistInfo) {
                const parsedPlaylistInfo = JSON.parse(playlistInfo)[2][0];
                const url = parsedPlaylistInfo.source.url;
                const title = escapeFilename(document.querySelector("#movie_title_content").innerText);
                notify({
                    type: "playlist_chunklist",
                    content: "",
                    url,
                    title,
                    chunkLists: [
                        {
                            type: "video",
                            resolution: {
                                x: "Unknown",
                                y: "Unknown"
                            },
                            url
                        }
                    ]
                });
            }
        }
    };

    const youtube = async () => {
        const playerResponse = ytplayer.config.args.raw_player_response;
        if (playerResponse) {
            const HlsManifestUrl = playerResponse.streamingData.hlsManifestUrl;
            await fetch(HlsManifestUrl);
        }
        notify({
            type: "cookies",
            cookies: "PREF=" + document.cookie.match(/PREF\=(.+?)(;|$)/)[1]
        });
    };

    const showroom = (xhr) => {
        if (xhr.responseURL.includes("api/live/streaming_url")) {
            const response = JSON.parse(xhr.responseText);
            if (response.streaming_url_list.some((i) => i.url.endsWith("chunklist.m3u8"))) {
                notify({
                    type: "playlist_chunklist",
                    content: xhr.responseText,
                    url: xhr.responseURL,
                    title: escapeFilename(document.title),
                    chunkLists: response.streaming_url_list
                        .filter((i) => i.url.endsWith("chunklist.m3u8"))
                        .map((i) => {
                            return {
                                type: "video",
                                bandwidth: i.quality * 1024,
                                resolution: {
                                    x: "Unknown",
                                    y: "Unknown"
                                },
                                url: i.url
                            };
                        })
                });
            }
        }
    };

    const bilibili = async () => {
        if (!location.href.match(/live\.bilibili\.com\/(?:blanc\/)*(\d+)/)) {
            return;
        }
        const roomId = location.href.match(/live\.bilibili\.com\/(?:blanc\/)*(\d+)/)[1];
        const api = `https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo?room_id=${roomId}&protocol=0,1&format=0,1,2&codec=0,1,2&qn=10000&platform=web&ptype=16`;
        const roomLiveInfo = await (await fetch(api)).json();
        if (!roomLiveInfo?.data?.playurl_info?.playurl?.stream) {
            return;
        }
        const hlsInfo = roomLiveInfo.data.playurl_info.playurl.stream.find((i) => i.protocol_name === "http_hls");
        const streamFormats = hlsInfo.format;
        const chunkLists = [];
        for (const format of streamFormats) {
            const codec = format.codec[0];
            if (codec.url_info[0].host && codec.base_url) {
                const chunkListUrl = codec.url_info[0].host + codec.base_url + (codec.url_info[0].extra || "");
                fetch(chunkListUrl);
            }
        }
    };

    const asobistore = () => {
        const url = document.querySelector("#embed_placeholder source").getAttribute("src");
        fetch(url);
    };

    // Execute when load
    switch (location.host) {
        case "abema.tv": {
            abema();
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
        case "live.bilibili.com": {
            bilibili();
            break;
        }
        case "playervspf.channel.or.jp": {
            asobistore();
            break;
        }
    }
})();
