import { Playlist } from "../../core/m3u8.js";
import Storage from "../../core/utils/storage.js";
chrome.runtime.onInstalled.addListener(async () => {
    // 安装后清理存储的历史
    await Storage.clear();
});
let processMessage = async function(message, sender, sendResponse) {
    console.log(message);
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
};
// Chromium
chrome.runtime.onMessageExternal.addListener(processMessage);
// Firefox
chrome.runtime.onMessage.addListener(processMessage);
// 监视页面关闭
const tabToUrl = {};
chrome.tabs.onUpdated.addListener(async function(tabId, changeInfo, tab) {
    tabToUrl[tabId] = tab.url;
    if (changeInfo.status && changeInfo.status === "loading") {
        // 刷新时移除原有数据
        await Storage.removeHistory(tabToUrl[tabId]);
        await Storage.removeHistory(tabToUrl[tabId] + "-key");
        await Storage.removeHistory(tabToUrl[tabId] + "-cookies");
    }
});

chrome.tabs.onRemoved.addListener(async function(tabId, removeInfo) {
    if (tabToUrl[tabId]) {
        await Storage.removeHistory(tabToUrl[tabId]);
        await Storage.removeHistory(tabToUrl[tabId] + "-key");
        await Storage.removeHistory(tabToUrl[tabId] + "-cookies");
        delete tabToUrl[tabId];
    }
});
