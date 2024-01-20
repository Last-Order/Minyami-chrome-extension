import { Playlist } from "../../core/m3u8.js";
import Storage from "../../core/utils/storage.js";
import { needCookiesSites, needKeySites, supportedSites, statusFlags } from "../../definitions";
import zh_CN from "../../messages/zh-cn";
import en from "../../messages/en";

const tabToUrl = {};

const evalOnTab = (tabId, func, ...args) =>
    new Promise((resolve) => {
        if (typeof tabId !== "number") return resolve();
        chrome.scripting.executeScript({
            target: { tabId },
            func,
            args
        }, resolve);
    });

const getCachedTabUrl = async (tabId) => {
    const url = (await evalOnTab(tabId, () => {
        let url;
        window.addEventListener(
            "MinyamiPageUrl",
            (event) => {
                url = event.detail;
            },
            { capture: false, once: true }
        );
        window.dispatchEvent(new CustomEvent("MinyamiGetPageUrl"));
        return url;
    }))[0].result;
    if (url) {
        tabToUrl[tabId] = url;
        for (const site of needCookiesSites) {
            if (url.includes(site.domain)) {
                evalOnTab(tabId, (detail) => {
                    window.dispatchEvent(new CustomEvent("MinyamiPageCookies", { detail }));
                }, await chrome.cookies.getAll({ domain: site.cookieDomain }));
                break;
            }
        }
    }
    return tabToUrl[tabId];
};

let currentExtTab;
// 处理注入页面消息
const handleContentScriptMessage = async (message, sender) => {
    if (!sender.tab) return;
    console.log(message);
    if (message.type === "query_livedata") {
        // /* 移动端浏览器弹窗标签页
        currentExtTab = sender.tab.id;
        return handleLiveDataQuery(message, sender);
    }
    if (message.type === "save_config" || message.type === "set_language") {
        for (const tab of await chrome.tabs.query({ url: sender.tab.url })) {
            if (tab.id === sender.tab.id) {
                continue;
            }
            chrome.tabs.sendMessage(tab.id, message);
        }
    } // */
    const tabId = sender.tab.id;
    if (message.type === "page_url") {
        // window.onunload
        tabToUrl[tabId] = message.url;
        return;
    }
    const url = await getCachedTabUrl(tabId); // 必然回复可用值
    if (message.type === "playlist") {
        const playlist = new Playlist({
            content: message.content,
            url: message.url,
            title: message.title,
            streamName: message.streamName
        });
        if (url.includes("abema.tv")) {
            for (const chunklist of playlist.chunkLists) {
                chunklist.fileExt = "ts";
                chunklist.keyUrl = "abematv-license:";
            }
        }
        await Storage.addHistory(url, playlist, (p) => p.url === playlist.url);
    }
    updateChunklist: if (message.type === "chunklist") {
        for (const playlist of await Storage.getHistory(url)) {
            const chunklist = playlist.chunkLists.find((c) => c.url.includes(message.url.split(/\?|$/)[0]));
            if (!chunklist) continue;
            if (chunklist.keyUrl !== message.keyUrl || chunklist.fileExt !== message.fileExt) {
                chunklist.keyUrl = message.keyUrl;
                chunklist.fileExt = message.fileExt;
                await Storage.modHistory(url, playlist, (p) => p.url === playlist.url);
            }
            break updateChunklist;
        }
        return; // 循环结束时没有变动，则跳过消息传递
    }
    if (message.type === "playlist_chunklist") {
        const playlist = new Playlist({
            content: message.content,
            url: message.url,
            title: message.title,
            disableAutoParse: true
        });
        playlist.chunkLists = message.chunkLists;
        await Storage.addHistory(url, playlist, (p) => p.url === playlist.url);
    }
    if (message.type === "key") {
        const { key, url: keyUrl } = message;
        const added = await Storage.addHistory(url + "-key", [keyUrl, key], (k) => k[0] === keyUrl);
        if (!added) return;
    }
    if (message.type === "cookies") {
        await Storage.addHistory(url + "-cookies", message.cookies);
    }
    // 实时更新浮窗页面数据
    const sendMessage = sender.tab.active
        ? chrome.runtime.sendMessage
        : currentExtTab && ((msg) => chrome.tabs.sendMessage(currentExtTab, msg));
    if (sendMessage) {
        sendMessage({
            type: "update_livedata",
            tabId,
            detail: {
                ...(message.type === "key" && { keys: await getTabKeys(tabId) }),
                ...(message.type === "cookies" && { cookies: await getTabCookies(tabId) }),
                ...(message.type !== "cookies" && { playlists: await getTabPlaylists(tabId) }),
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
const handleLiveDataQuery = async (message, sender) => {
    // console.log(message, sender);
    const sendMessage = sender.tab ? (msg) => chrome.tabs.sendMessage(sender.tab.id, msg) : chrome.runtime.sendMessage;
    const tab = await chrome.tabs.get(message.tabId);
    if (!tab || urlNotSupported(tab.url)) {
        return;
    }
    if (tab.status !== "loading" && !(await getCachedTabUrl(tab.id))) {
        return sendMessage({
            type: "update_livedata",
            tabId: tab.id,
            detail: {
                status: statusFlags.supported
            }
        });
    }
    sendMessage({
        type: "update_livedata",
        tabId: tab.id,
        detail: {
            playlists: await getTabPlaylists(tab.id),
            keys: await getTabKeys(tab.id),
            cookies: await getTabCookies(tab.id),
            currentUrl: tabToUrl[tab.id],
            currentUrlHost: new URL(tabToUrl[tab.id]).host,
            status: await getTabStatusFlags(tab.id)
        }
    });
};

chrome.runtime.onMessage.addListener(async (message, sender) => {
    if (sender.tab) {
        return;
    }
    if (message.type === "set_language") {
        for (const tab of await chrome.tabs.query({})) {
            if (!urlNotSupported(tab.url)) await getCachedTabUrl(tab.id);
            await updateTabStatus(tab.id, true);
        }
        return;
    }
    if (message.type === "query_livedata" && message.tabId) {
        // 浮窗页面装载
        await handleLiveDataQuery(message, sender);
    }
});
// 监视新建或刷新标签页
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "loading") {
        return;
    }
    const url = (tabToUrl[tabId] = tab.url);
    // 刷新时移除原有数据
    await Storage.removeHistory(url);
    await Storage.removeHistory(url + "-key");
    await Storage.removeHistory(url + "-cookies");
    // 判断是否为任意窗口的活动标签页
    if (tab.active) {
        let currentUrlHost = "";
        try {
            currentUrlHost = new URL(url).host;
        } catch {
            // 不支持的 URL scheme
            return;
        }
        chrome.runtime.sendMessage({
            type: "update_livedata",
            tabId,
            detail: {
                playlists: [],
                keys: [],
                cookies: [],
                currentUrl: url,
                currentUrlHost,
                status: await getTabStatusFlags(tabId)
            }
        });
    }
    await updateTabStatus(tabId, false);
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    if (tabId === currentExtTab) {
        currentExtTab = undefined;
        return;
    }
    const url = tabToUrl[tabId];
    if (url) {
        await Storage.removeHistory(url);
        await Storage.removeHistory(url + "-key");
        await Storage.removeHistory(url + "-cookies");
    }
    delete tabToUrl[tabId];
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
            if (clear) tabToUrl[tab.id] = tab.url;
            if (!urlNotSupported(tab.url)) await getCachedTabUrl(tab.id);
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
        if ((await getTabStatusFlags(tabId)) === statusFlags.allReady) {
            await setTabStatus(tabId, "ready");
        } else {
            await setTabStatus(tabId, "waiting");
        }
    } else {
        await setTabStatus(tabId, "initial");
    }
};

const setTabStatus = async (tabId, status) => {
    const playlists = await getTabPlaylists(tabId);
    const keys = await getTabKeys(tabId);
    const total = playlists.length;
    const done = playlists.filter((p) => p.chunkLists.some((c) => "keyUrl" in c && c.keyIndex in keys)).length;
    const streamCount = (done && done !== total ? `${done}/` : "") + `${total}`;
    const [color, text] = {
        initial: ["#1966b3", "?"],
        stopped: ["#a9a9a9", "-"],
        waiting: ["orange", streamCount],
        ready: ["green", streamCount]
    }[status];
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
    await chrome.action.setBadgeText({ tabId, text });
    const { tooltip } = { zh_CN, en }[(await Storage.getConfig("language")) || "zh_CN"];
    await chrome.action.setTitle({ tabId, title: `Minyami: ${tooltip[status]}` });
};

const getTabPlaylists = async (tabId) => (!(tabId in tabToUrl) && []) || (await Storage.getHistory(tabToUrl[tabId]));

const getTabKeys = async (tabId) =>
    (!(tabId in tabToUrl) && {}) || Object.fromEntries(await Storage.getHistory(tabToUrl[tabId] + "-key"));

const getTabCookies = async (tabId) =>
    (!(tabId in tabToUrl) && []) || (await Storage.getHistory(tabToUrl[tabId] + "-cookies"));

const getTabStatusFlags = async (tabId) => {
    const url = tabToUrl[tabId];
    if (urlNotSupported(url)) {
        return ~statusFlags.supported;
    }
    let flags = statusFlags.supported;
    for (const site of needKeySites) {
        if (url.includes(site) && !Object.keys(await getTabKeys(tabId)).length) {
            flags |= statusFlags.missingKey;
            break;
        }
    }
    for (const site of needCookiesSites) {
        if (url.includes(site.domain) && !(await getTabCookies(tabId)).length) {
            flags |= statusFlags.missingCookie;
            break;
        }
    }
    return flags;
};

const urlNotSupported = (url) => {
    if (!url) {
        return true;
    }
    try {
        return !supportedSites.includes(new URL(url).host);
    } catch {
        return true;
    }
};
