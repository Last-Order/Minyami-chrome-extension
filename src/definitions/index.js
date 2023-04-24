export const supportedSites = [
    "www.openrec.tv",
    "abema.tv",
    "live2.nicovideo.jp",
    "live.nicovideo.jp",
    "cas.nicovideo.jp",
    "gyao.yahoo.co.jp",
    "www.dmm.com",
    "www.dmm.co.jp",
    "www.360ch.tv",
    "www.sonymusic.co.jp",
    "twitcasting.tv",
    "www.showroom-live.com",
    "hibiki-radio.jp",
    "www.onsen.ag",
    "www.youtube.com",
    "nogidoga.com",
    "stagecrowd.live",
    "spwn.jp",
    "live.bilibili.com",
    "playervspf.channel.or.jp",
    "nicochannel.jp",
    "pizzaradio.jp"
];
export const needCookiesSites = ["360ch.tv"];
export const needKeySites = [
    "abema.tv",
    "live2.nicovideo.jp",
    "live.nicovideo.jp",
    "dmm.com",
    "dmm.co.jp",
    "hibiki-radio.jp",
    "www.onsen.ag",
    "nicochannel.jp",
    "pizzaradio.jp",
];
export const siteAdditionalHeaders = {
    "www.openrec.tv": {
        Referer: "https://www.openrec.tv/"
    },
    "www.onsen.ag": {
        Referer: "https://www.onsen.ag/"
    },
    "twitcasting.tv": {
        Referer: "https://twitcasting.tv/",
        "User-Agent": navigator.userAgent
    }
};
export const siteThreadsSettings = {
    "twitcasting.tv": 3
};
export const minyamiVersionRequirementMap = {
    "live.nicovideo.jp": "4.2.5",
    "live.bilibili.com": "4.2.4",
    "twitcasting.tv": "4.2.10",
    "nicochannel.jp": "4.4.13"
};
export const statusFlags = {
    supported: 0b1,
    missingCookie: 0b10,
    missingKey: 0b100
};
export const parseStatusFlags = (flags) => {
    const status = {};
    for (const flag in statusFlags) {
        status[flag] = Boolean(statusFlags[flag] & flags);
    }
    return Object.freeze(status);
};
