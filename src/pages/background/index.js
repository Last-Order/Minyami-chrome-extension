import { Playlist } from "../../core/m3u8.js";
import Storage from "../../core/utils/storage.js";
import { needCookiesSites, needKeySites, supportedSites } from "../../definitions";
import zh_CN from "../../messages/zh-cn";
import en from "../../messages/en";

const tabToUrl = {};
let currentTab;
const processMessage = async (message, sender) => {
    // console.log(message);
    if (message.type === "set_language") {
        return await updateCurrentTabStatus(true);
    }
    if (["query_current", "chunklist"].includes(message.type)) {
        return;
    }
    if (message.type === "playlist") {
        const playlist = new Playlist({
            content: message.content,
            url: message.url,
            title: message.title,
            streamName: message.streamName
        });
        if (!(await Storage.getHistory(sender.tab.url)).some((p) => p.url === playlist.url)) {
            await Storage.setHistory(sender.tab.url, playlist);
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
        if (!(await Storage.getHistory(sender.tab.url)).some((p) => p.url === playlist.url)) {
            await Storage.setHistory(sender.tab.url, playlist);
        }
    }
    if (message.type === "key") {
        if (!(await Storage.getHistory(sender.tab.url + "-key")).includes(message.key)) {
            await Storage.setHistory(sender.tab.url + "-key", message.key);
        }
    }
    if (message.type === "cookies") {
        if (!(await Storage.getHistory(sender.tab.url + "-cookies")).includes(message.cookies)) {
            await Storage.setHistory(sender.tab.url + "-cookies", message.cookies);
        }
    }
    if (sender.tab && sender.tab.id === currentTab) {
        chrome.runtime.sendMessage({
            type: "update_current",
            tabId: currentTab,
            detail: {
                ...(message.type == "key" ? { keys: await getCurrentKeys() } :
                        message.type == "cookies" ? { cookies: await getCurrentCookies() } :
                            { playlists: await getCurrentPlaylists() }),
                status: {
                    noKeyWarning: await showNoKeyWarning(),
                    noCookiesWarning: await showNoCookiesWarning(),
                    notSupported: false
                }
            }
        });
        await doUpdateCurrentTabStatus();
    }
};
// Chromium
chrome.runtime.onMessageExternal.addListener(processMessage);
// Firefox
chrome.runtime.onMessage.addListener(processMessage);
// 处理浮窗页面消息
chrome.runtime.onMessage.addListener(async message => {
    if (message.type === "query_current") {
        chrome.runtime.sendMessage({
            type: "update_current",
            tabId: currentTab,
            detail: {
                playlists: await getCurrentPlaylists(),
                keys: await getCurrentKeys(),
                cookies: await getCurrentCookies(),
                currentUrl: tabToUrl[currentTab],
                currentUrlHost: getCurrentUrlHost(),
                status: {
                    noKey: await showNoKeyWarning(),
                    noCookies: await showNoCookiesWarning(),
                    notSupported: showNotSupported()
                },
            }
        });
    }
});
// 处理窗口切换等需要重新定位活动标签的情况
const handleWindowFocusChanged = async () => {
    const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });
    if (tabs[0]) {
        currentTab = tabs[0].id;
        if (tabs[0].url) {
            tabToUrl[currentTab] = tabs[0].url;
            await updateCurrentTabStatus(true);
        } else {
            tabToUrl[currentTab] = "";
            await setCurrentStatus("initial");
        }
    }
};
// 处理在新标签中打开页面、手动切换标签等监视目标已知的情况
const handleTabFocusChanged = async (tab) => {
    if (tab) {
        if (tab.url) {
            tabToUrl[currentTab] = tab.url;
            await updateCurrentTabStatus(tab.status !== "loading");
        } else {
            tabToUrl[currentTab] = "";
            await setCurrentStatus("initial");
        }
    }
};
// 监视页面关闭
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const url = tabToUrl[tabId] = tab.url;
    if (changeInfo.status && changeInfo.status === "loading") {
        // 刷新时移除原有数据
        await Storage.removeHistory(url);
        await Storage.removeHistory(url + "-key");
        await Storage.removeHistory(url + "-cookies");
        if (tabId === currentTab) {
            chrome.runtime.sendMessage({
                type: "update_current",
                tabId,
                detail: {
                    playlists: [],
                    keys: [],
                    cookies: [],
                    currentUrl: "",
                    currentUrlHost: "",
                    status: {
                        notSupported: showNotSupported()
                    },
                }
            });
            updateCurrentTabStatus(false);
        }
    }
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

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    currentTab = activeInfo.tabId;
    if (tabToUrl[currentTab]) {
        await updateCurrentTabStatus(true);
    } else {
        chrome.tabs.get(currentTab, handleTabFocusChanged);
    }
});

chrome.windows.onFocusChanged.addListener(handleWindowFocusChanged);

chrome.runtime.onInstalled.addListener(async () => {
    // 安装后清理存储的历史
    await Storage.clear();
    handleWindowFocusChanged();
});

const updateCurrentTabStatus = async (checkStatusNow) => {
    // console.log(tabToUrl[currentTab]);
    if (showNotSupported()) {
        await setCurrentStatus("stopped");
    } else {
        if (checkStatusNow) {
            await doUpdateCurrentTabStatus();
        } else {
            await setCurrentStatus("initial");
        }
    }
};
// 被调用时已经确定是支持的网站
const doUpdateCurrentTabStatus = async () => {
    if ((await getCurrentPlaylists()).length > 0) {
        if (await showNoKeyWarning() || await showNoCookiesWarning()) {
            await setCurrentStatus("waiting");
        } else {
            await setCurrentStatus("ready");
        }
    } else {
        await setCurrentStatus("initial");
    }
};

const setCurrentStatus = async (status) => {
    const streamCount = (await getCurrentPlaylists()).length.toString();
    const [color, text] = {
        initial: ["#a9a9a9", " "],
        stopped: ["red", "-"],
        waiting: ["orange", streamCount],
        ready: ["green", streamCount]
    }[status];
    await chrome.action.setBadgeBackgroundColor({
        tabId: currentTab,
        color
    });
    await chrome.action.setBadgeText({
        tabId: currentTab,
        text
    });
    const { tooltip } = { zh_CN, en }[
        await Storage.getConfig("language") || "zh_CN"
    ];
    await chrome.action.setTitle({
        tabId: currentTab,
        title: `Minyami: ${tooltip[status]}`
    });
};

const getCurrentPlaylists = async () =>
    !(currentTab in tabToUrl) && [] ||
        await Storage.getHistory(tabToUrl[currentTab]);

const getCurrentKeys = async () =>
    !(currentTab in tabToUrl) && [] ||
        await Storage.getHistory(tabToUrl[currentTab] + "-key");

const getCurrentCookies = async () =>
    !(currentTab in tabToUrl) && [] ||
        await Storage.getHistory(tabToUrl[currentTab] + "-cookies");

const getCurrentUrlHost = () =>
    tabToUrl[currentTab] && new URL(tabToUrl[currentTab]).host;

const showNoKeyWarning = async () => {
    if (currentTab in tabToUrl) for (const site of needKeySites) {
        if (tabToUrl[currentTab].includes(site) && !(await getCurrentKeys()).length) {
            return true;
        }
    }
    return false;
};

const showNoCookiesWarning = async () => {
    if (currentTab in tabToUrl) for (const site of needCookiesSites) {
        if (tabToUrl[currentTab].includes(site) && !(await getCurrentCookies()).length) {
            return true;
        }
    }
    return false;
};

const showNotSupported = () => !supportedSites.includes(getCurrentUrlHost());
