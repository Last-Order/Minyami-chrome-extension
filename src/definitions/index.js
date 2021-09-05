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
    "www.youtube.com",
    "nogidoga.com",
    "stagecrowd.live",
    "spwn.jp",
    "live.bilibili.com"
];
export const siteAdditionalHeaders = {
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
    "twitcasting.tv": "4.2.10"
};
