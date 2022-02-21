import { Playlist } from "../../core/m3u8.js";
import Storage from "../../core/utils/storage.js";
import { needCookiesSites, needKeySites, supportedSites } from "../../definitions";
import zh_CN from "../../messages/zh-cn";
import en from "../../messages/en";

const tabToUrl = {};
let currentTab;
// 处理注入页面消息
const handleContentScriptMessage = async (message, sender) => {
    if (!sender.tab || message.type === "chunklist") return;
    const { id: tabId, url } = sender.tab;
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
            type: "update_current",
            tabId,
            detail: {
                ...(message.type == "key" ? { keys: await getTabKeys(tabId) } :
                        message.type == "cookies" ? { cookies: await getTabCookies(tabId) } :
                            { playlists: await getTabPlaylists(tabId) }),
                status: {
                    missingKey: await tabMissingKey(tabId),
                    missingCookie: await tabMissingCookie(tabId),
                    notSupported: false
                }
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
        return await updateTabStatus(currentTab, true);
    }
    if (message.type === "query_current") { // 浮窗页面装载
        chrome.runtime.sendMessage({
            type: "update_current",
            tabId: currentTab,
            detail: {
                playlists: await getTabPlaylists(currentTab),
                keys: await getTabKeys(currentTab),
                cookies: await getTabCookies(currentTab),
                currentUrl: tabToUrl[currentTab],
                currentUrlHost: getTabUrlHost(currentTab),
                status: {
                    missingKey: await tabMissingKey(currentTab),
                    missingCookie: await tabMissingCookie(currentTab),
                    notSupported: tabNotSupported(currentTab)
                },
            }
        });
    }
});
// 处理窗口切换等需要重新定位活动标签的情况
const handleWindowFocusChanged = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
        currentTab = tabs[0].id;
    }
};
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
            type: "update_current",
            tabId,
            detail: {
                playlists: [],
                keys: [],
                cookies: [],
                currentUrl: url,
                currentUrlHost: getTabUrlHost(tabId),
                status: {
                    notSupported: tabNotSupported(tabId)
                },
            }
        });
    }
    await updateTabStatus(tabId, false);
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    if (tabToUrl[tabId]) {
        const url = tabToUrl[tabId];
        await Storage.removeHistory(url);
        await Storage.removeHistory(url + "-key");
        await Storage.removeHistory(url + "-cookies");
        delete tabToUrl[tabId];
    }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    currentTab = activeInfo.tabId;
});

chrome.windows.onFocusChanged.addListener(handleWindowFocusChanged);

chrome.runtime.onInstalled.addListener(async () => {
    // 安装后清理存储的历史
    await Storage.clear();
    for (const tab of await chrome.tabs.query({})) {
        if (tab.url) {
            tabToUrl[tab.id] = tab.url;
        }
        await updateTabStatus(tab.id, false);
    }
    await handleWindowFocusChanged();
});

const updateTabStatus = async (tabId, checkStatusNow) => {
    if (tabNotSupported(tabId)) {
        await setTabStatus(tabId, "stopped");
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
        if (await tabMissingKey(tabId) || await tabMissingCookie(tabId)) {
            await setTabStatus(tabId, "waiting");
        } else {
            await setTabStatus(tabId, "ready");
        }
    } else {
        await setTabStatus(tabId, "initial");
    }
};

const setTabStatus = async (tabId, status) => {
    const streamCount = (await getTabPlaylists(tabId)).length.toString();
    const [color, text] = {
        initial: ["#a9a9a9", " "],
        stopped: ["red", "-"],
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

const getTabUrlHost = (tabId) =>
    tabToUrl[tabId] && new URL(tabToUrl[tabId]).host;

const tabMissingKey = async (tabId) => {
    if (tabId in tabToUrl) for (const site of needKeySites) {
        if (tabToUrl[tabId].includes(site) && !(await getTabKeys(tabId)).length) {
            return true;
        }
    }
    return false;
};

const tabMissingCookie = async (tabId) => {
    if (tabId in tabToUrl) for (const site of needCookiesSites) {
        if (tabToUrl[tabId].includes(site) && !(await getTabCookies(tabId)).length) {
            return true;
        }
    }
    return false;
};

const tabNotSupported = (tabId) => !supportedSites.includes(getTabUrlHost(tabId));
