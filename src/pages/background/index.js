import { Playlist } from "../../core/m3u8.js";
import Storage from "../../core/utils/storage.js";
import Icon from "../../core/utils/icon.js";
import { needCookiesSites, needKeySites } from "../../definitions";
const tabToUrl = {};
let currentTab;
const icon = new Icon(document.getElementById("logo"));
chrome.runtime.onInstalled.addListener(async () => {
    // 安装后清理存储的历史
    await Storage.clear();
});
const processMessage = async (message, sender, sendResponse) => {
    console.log(message);
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
    if (sender.tab.id === currentTab) {
        chrome.runtime.sendMessage({
            type: "update_current",
            detail: {
                ...(message.type == "key" ? { keys: await getCurrentKeys() } :
                        message.type == "cookies" ? { cookies: await getCurrentCookies() } :
                            { playlists: await getCurrentPlaylists() }),
                status: {
                    noKeyWarning: showNoKeyWarning(),
                    noCookiesWarning: showNoCookiesWarning(),
                    notSupported: false
                }
            }
        });
        check();
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
            detail: {
                playlists: await getCurrentPlaylists(),
                keys: await getCurrentKeys(),
                cookies: await getCurrentCookies(),
                currentUrl: tabToUrl[currentTab],
                currentUrlHost: getCurrentUrlHost(),
                status: {
                    noKey: showNoKeyWarning(),
                    noCookies: showNoCookiesWarning(),
                    notSupported: showNotSupported()
                },
            }
        });
    }
});
// 处理窗口切换等需要重新定位活动标签的情况
let handleWindowFocusChanged = () =>
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]) {
            currentTab = tabs[0].id;
            if (tabs[0].url) {
                tabToUrl[currentTab] = tabs[0].url;
                checkCurrentURL(true);
            } else {
                tabToUrl[currentTab] = "";
                icon.reset();
            }
        }
    });
// 处理在新标签中打开页面、手动切换标签等监视目标已知的情况
let handleTabFocusChanged = tab => {
    if (tab) {
        if (tab.url) {
            tabToUrl[currentTab] = tab.url;
            checkCurrentURL(tab.status === "loading");
        } else {
            tabToUrl[currentTab] = "";
            icon.reset();
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
            checkCurrentURL(false);
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

chrome.tabs.onActivated.addListener(activeInfo => {
    currentTab = activeInfo.tabId;
    if (tabToUrl[currentTab]) {
        checkCurrentURL(true);
    } else {
        chrome.tabs.get(currentTab, handleTabFocusChanged);
    }
});

chrome.windows.onFocusChanged.addListener(handleWindowFocusChanged);

chrome.runtime.onInstalled.addListener(details => {
    localStorage.removeItem("history");
    console.info("Minyami has been installed.");
    handleWindowFocusChanged();
});

const checkCurrentURL = (checkStatusNow) => {
    console.log(tabToUrl[currentTab]);
    if (showNotSupported()) {
        icon.setStopped();
    } else {
        if (checkStatusNow) {
            check();
        } else {
            icon.reset();
        }
    }
};

const check = () => {
    if (getCurrentPlaylists().length > 0) {
        if (showNoKeyWarning() || showNoCookiesWarning()) {
            icon.setWaiting();
        } else {
            icon.setReady();
        }
    } else {
        icon.reset();
    }
};

const getCurrentPlaylists = async () =>
    await Storage.getHistory(tabToUrl[currentTab]);

const getCurrentKeys = async () =>
    await Storage.getHistory(tabToUrl[currentTab] + "-key");

const getCurrentCookies = async () =>
    await Storage.getHistory(tabToUrl[currentTab] + "-cookies");

const getCurrentUrlHost = () => new URL(tabToUrl[currentTab]).host;

const showNoKeyWarning = () => {
    for (const site of needKeySites) {
        if (tabToUrl[currentTab].includes(site) && !getCurrentKeys().length) {
            return true;
        }
    }
    return false;
};

const showNoCookiesWarning = () => {
    for (const site of needCookiesSites) {
        if (tabToUrl[currentTab].includes(site) && !getCurrentCookies().length) {
            return true;
        }
    }
    return false;
};

const showNotSupported = () => !supportedSites.includes(getCurrentUrlHost);
