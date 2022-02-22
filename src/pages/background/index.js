import { Playlist } from "../../core/m3u8.js";
import Storage from "../../core/utils/storage.js";
import {
    needCookiesSites,
    needKeySites,
    supportedSites,
    statusFlags
} from "../../definitions";
import zh_CN from "../../messages/zh-cn";
import en from "../../messages/en";

const tabToUrl = {};

const cacheTabUrl = (tabId) => new Promise((resolve) => {
    if (typeof tabId !== "number") return resolve();
    chrome.tabs.sendMessage(tabId, { type: "get_url" }, (response) => {
        if (!chrome.runtime.lastError && response && response.type === "url") {
            tabToUrl[tabId] = response.detail;
        }
        resolve(tabToUrl[tabId]);
    })
});
// 处理注入页面消息
const handleContentScriptMessage = async (message, sender) => {
    if (!sender.tab || message.type === "chunklist") return;
    const tabId = sender.tab.id;
    const url = await cacheTabUrl(tabId); // 必然回复可用值
    // console.log(message);
    if (message.type === "playlist") {
        const playlist = new Playlist({
            content: message.content,
            url: message.url,
            title: message.title,
            streamName: message.streamName
        });
        if (!(await Storage.getHistory(url)).some((p) => p.url === playlist.url)) {
            await Storage.setHistory(url, playlist);
        }
    }
    if (message.type === "playlist_chunklist") {
        const playlist = new Playlist({
            content: message.content,
            url: message.url,
            title: message.title,
            disableAutoParse: true
        });
        playlist.chunkLists = message.chunkLists;
        if (!(await Storage.getHistory(url)).some((p) => p.url === playlist.url)) {
            await Storage.setHistory(url, playlist);
        }
    }
    if (message.type === "key") {
        if (!(await Storage.getHistory(url + "-key")).includes(message.key)) {
            await Storage.setHistory(url + "-key", message.key);
        }
    }
    if (message.type === "cookies") {
        if (!(await Storage.getHistory(url + "-cookies")).includes(message.cookies)) {
            await Storage.setHistory(url + "-cookies", message.cookies);
        }
    }
    // 实时更新浮窗页面数据
    if (sender.tab.active) {
        chrome.runtime.sendMessage({
            type: "update_livedata",
            tabId,
            detail: {
                ...(message.type == "key" ? { keys: await getTabKeys(tabId) } :
                        message.type == "cookies" ? { cookies: await getTabCookies(tabId) } :
                            { playlists: await getTabPlaylists(tabId) }),
                status: await getTabStatusFlags(tabId)
            }
        });
    }
    await doUpdateTabStatus(tabId);
};
// Chromium
chrome.runtime.onMessageExternal.addListener(handleContentScriptMessage);
// Firefox
chrome.runtime.onMessage.addListener(handleContentScriptMessage);
// 处理浮窗页面消息
chrome.runtime.onMessage.addListener(async (message, sender) => {
    if (sender.tab) return;
    // console.log(message);
    if (message.type === "set_language") {
        for (const tab of await chrome.tabs.query({})) {
            await cacheTabUrl(tab.id);
            await updateTabStatus(tab.id, true);
        }
        return;
    }
    if (message.type === "query_livedata") { // 浮窗页面装载
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) return;
        const currentTab = tabs[0].id;
        if (!await cacheTabUrl(currentTab)) return;
        chrome.runtime.sendMessage({
            type: "update_livedata",
            tabId: currentTab,
            detail: {
                playlists: await getTabPlaylists(currentTab),
                keys: await getTabKeys(currentTab),
                cookies: await getTabCookies(currentTab),
                currentUrl: tabToUrl[currentTab],
                currentUrlHost: new URL(tabToUrl[currentTab]).host,
                status: await getTabStatusFlags(currentTab)
            }
        });
    }
});
// 监视新建或刷新标签页
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "loading") return;
    const url = tabToUrl[tabId] = tab.url;
    // 刷新时移除原有数据
    await Storage.removeHistory(url);
    await Storage.removeHistory(url + "-key");
    await Storage.removeHistory(url + "-cookies");
    // 判断是否为任意窗口的活动标签页
    if (tab.active) {
        chrome.runtime.sendMessage({
            type: "update_livedata",
            tabId,
            detail: {
                playlists: [],
                keys: [],
                cookies: [],
                currentUrl: url,
                currentUrlHost: new URL(url).host,
                status: await getTabStatusFlags(tabId),
            }
        });
    }
    await updateTabStatus(tabId, false);
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    if (await cacheTabUrl(tabId)) {
        const url = tabToUrl[tabId];
        await Storage.removeHistory(url);
        await Storage.removeHistory(url + "-key");
        await Storage.removeHistory(url + "-cookies");
        delete tabToUrl[tabId];
    }
});

chrome.runtime.onInstalled.addListener(async () => {
    // 安装后清理存储的历史
    await Storage.clear();
    await initializeTabStatuses(true);
});
// 处理扩展重新启用等需要重新加载状态的情形
const initializeTabStatuses = async (clear) => {
    for (const tab of await chrome.tabs.query({})) {
        if (clear || !(await chrome.action.getBadgeText({ tabId: tab.id }))) {
            tabToUrl[tab.id] = tab.url;
            await cacheTabUrl(tab.id);
            await updateTabStatus(tab.id, !clear);
        }
    }
};
initializeTabStatuses(false);

const updateTabStatus = async (tabId, checkStatusNow) => {
    if (urlNotSupported(tabToUrl[tabId])) {
        await setTabStatus(tabId, "stopped");
        delete tabToUrl[tabId];
    } else {
        if (checkStatusNow) {
            await doUpdateTabStatus(tabId);
        } else {
            await setTabStatus(tabId, "initial");
        }
    }
};
// 被调用时已经确定是支持的网站
const doUpdateTabStatus = async (tabId) => {
    if ((await getTabPlaylists(tabId)).length > 0) {
        if (await getTabStatusFlags(tabId) === statusFlags.supported) {
            await setTabStatus(tabId, "ready");
        } else {
            await setTabStatus(tabId, "waiting");
        }
    } else {
        await setTabStatus(tabId, "initial");
    }
};

const setTabStatus = async (tabId, status) => {
    const streamCount = (await getTabPlaylists(tabId)).length.toString();
    const [color, text] = {
        initial: ["#1966b3", "?"],
        stopped: ["#a9a9a9", "-"],
        waiting: ["orange", streamCount],
        ready: ["green", streamCount]
    }[status];
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
    await chrome.action.setBadgeText({ tabId, text });
    const { tooltip } = { zh_CN, en }[
        await Storage.getConfig("language") || "zh_CN"
    ];
    await chrome.action.setTitle({ tabId, title: `Minyami: ${tooltip[status]}` });
};

const getTabPlaylists = async (tabId) =>
    !(tabId in tabToUrl) && [] ||
        await Storage.getHistory(tabToUrl[tabId]);

const getTabKeys = async (tabId) =>
    !(tabId in tabToUrl) && [] ||
        await Storage.getHistory(tabToUrl[tabId] + "-key");

const getTabCookies = async (tabId) =>
    !(tabId in tabToUrl) && [] ||
        await Storage.getHistory(tabToUrl[tabId] + "-cookies");

const getTabStatusFlags = async (tabId) => {
    const url = tabToUrl[tabId];
    if (urlNotSupported(url)) {
        return ~statusFlags.supported;
    }
    let flags = statusFlags.supported;
    for (const site of needKeySites) {
        if (url.includes(site) && !(await getTabKeys(tabId)).length) {
            flags |= statusFlags.missingKey;
        }
    }
    for (const site of needCookiesSites) {
        if (url.includes(site) && !(await getTabCookies(tabId)).length) {
            flags |= statusFlags.missingCookie;
        }
    }
    return flags;
};

const urlNotSupported = (url) =>
    !url || !supportedSites.includes(new URL(url).host);
