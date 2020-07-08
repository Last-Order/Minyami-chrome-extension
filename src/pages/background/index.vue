<template>
  <div></div>
</template>
<script>
import { Playlist } from "../../core/m3u8.js";
import Storage from "../../core/utils/storage.js";
import Icon from "../../core/utils/icon.js";
import { supportedSites } from "../../definitions";
const needCookiesSites = ["360ch.tv"];
const needKeySites = [
  "abema.tv",
  "live2.nicovideo.jp",
  "dmm.com",
  "dmm.co.jp",
  "hibiki-radio.jp"
];
export default {
  data() {
    return {
      icon: new Icon(document.getElementById("logo")),
      currentTab: "",
      tabToUrl: {}
    }
  },
  mounted() {
    let processMessage = (message, sender, sendResponse) => {
      // console.log(message);
      if (["query_current", "chunklist"].includes(message.type)) {
        return;
      }
      if (message.type === "playlist") {
        const playlist = new Playlist(
          message.content,
          message.url,
          message.title
        );
        if (
          !Storage.getHistory(sender.tab.url).some(p => p.url === playlist.url)
        ) {
          Storage.setHistory(sender.tab.url, playlist);
        }
      }
      if (message.type === "playlist_chunklist") {
        console.log(message);
        const playlist = new Playlist(
          message.content,
          message.url,
          message.title,
          true
        );
        playlist.chunkLists = message.chunkLists;
        console.log(playlist);
        if (
          !Storage.getHistory(sender.tab.url).some(p => p.url === playlist.url)
        ) {
          Storage.setHistory(sender.tab.url, playlist);
        }
      }
      if (message.type === "key") {
        if (
          !Storage.getHistory(sender.tab.url + "-key").includes(message.key)
        ) {
          Storage.setHistory(sender.tab.url + "-key", message.key);
        }
      }
      if (message.type === "cookies") {
        if (
          !Storage.getHistory(sender.tab.url + "-cookies").includes(
            message.cookies
          )
        ) {
          Storage.setHistory(sender.tab.url + "-cookies", message.cookies);
        }
      }
      if (sender.tab.id === this.currentTab) {
        chrome.runtime.sendMessage({
          type: "update_current",
          detail: [
            message.type == "key" ? {keys: this.getCurrentKeys()} :
              message.type == "cookies" ? {cookies: this.getCurrentCookies()} :
                {playlists: this.getCurrentPlaylists()},
            {noKey: this.showNoKeyWarning()},
            {noCookies: this.showNoCookiesWarning()},
            {notSupported: false}
          ]
        });
        this.check();
      }
    };
    // Chromium
    chrome.runtime.onMessageExternal.addListener(processMessage);
    // Firefox
    chrome.runtime.onMessage.addListener(processMessage);
    // 处理浮窗页面消息
    chrome.runtime.onMessage.addListener(message => {
      if (message.type === "query_current") {
        chrome.runtime.sendMessage({
          type: "update_current",
          detail: [
            {playlists: this.getCurrentPlaylists()},
            {keys: this.getCurrentKeys()},
            {cookies: this.getCurrentCookies()},
            {noKey: this.showNoKeyWarning()},
            {noCookies: this.showNoCookiesWarning()},
            {notSupported: this.showNotSupported()}
          ]
        });
      }
    });
    // 处理窗口切换等需要重新定位活动标签的情况
    let handleWindowFocusChanged = () =>
      chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        if (tabs[0]) {
          this.currentTab = tabs[0].id;
          if (tabs[0].url) {
            this.tabToUrl[this.currentTab] = tabs[0].url;
            this.checkCurrentURL(true);
          } else {
            this.tabToUrl[this.currentTab] = "";
            this.icon.reset();
          }
        }
      });
    // 处理在新标签中打开页面、手动切换标签等监视目标已知的情况
    let handleTabFocusChanged = tab => {
      if (tab) {
        if (tab.url) {
          this.tabToUrl[this.currentTab] = tab.url;
          this.checkCurrentURL(tab.status === "loading");
        } else {
          this.tabToUrl[this.currentTab] = "";
          this.icon.reset();
        }
      }
    };
    // 监视页面关闭
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      const url = this.tabToUrl[tabId] = tab.url;
      if (changeInfo.status && changeInfo.status === "loading") {
        // 刷新时移除原有数据
        Storage.removeHistory(url);
        Storage.removeHistory(url + "-key");
        Storage.removeHistory(url + "-cookies");
        if (tabId === this.currentTab) {
          this.checkCurrentURL(false);
        }
      }
    });

    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
      if (this.tabToUrl[tabId]) {
        const url = this.tabToUrl[tabId];
        Storage.removeHistory(url);
        Storage.removeHistory(url + "-key");
        Storage.removeHistory(url + "-cookies");
        delete this.tabToUrl[tabId];
      }
    });

    chrome.tabs.onActivated.addListener(activeInfo => {
      this.currentTab = activeInfo.tabId;
      if (this.tabToUrl[this.currentTab]) {
        this.checkCurrentURL(true);
      } else {
        chrome.tabs.get(this.currentTab, handleTabFocusChanged);
      }
    });

    chrome.windows.onFocusChanged.addListener(handleWindowFocusChanged);

    chrome.runtime.onInstalled.addListener(details => {
      localStorage.removeItem("history");
      console.info("Minyami has been installed.");
      handleWindowFocusChanged();
    });
  },
  methods: {
    checkCurrentURL(checkStatusNow) {
      console.log(this.tabToUrl[this.currentTab]);
      if (this.showNotSupported()) {
        this.icon.setStopped();
      } else {
        if (checkStatusNow) {
          this.check();
        } else {
          this.icon.reset();
        }
      }
    },
    check() {
      if (this.getCurrentPlaylists().length > 0) {
        if (this.showNoKeyWarning() || this.showNoCookiesWarning()) {
          this.icon.setWaiting();
        } else {
          this.icon.setReady();
        }
      } else {
        this.icon.reset();
      }
    },
    getCurrentPlaylists() {
      return Storage.getHistory(this.tabToUrl[this.currentTab]);
    },
    getCurrentKeys() {
      return Storage.getHistory(this.tabToUrl[this.currentTab] + "-key");
    },
    getCurrentCookies() {
      return Storage.getHistory(this.tabToUrl[this.currentTab] + "-cookies");
    },
    showNoKeyWarning() {
      for (const site of needKeySites) {
        if (this.tabToUrl[this.currentTab].includes(site) && !this.getCurrentKeys().length) {
          return true;
        }
      }
      return false;
    },
    showNoCookiesWarning() {
      for (const site of needCookiesSites) {
        if (this.tabToUrl[this.currentTab].includes(site) && !this.getCurrentCookies().length) {
          return true;
        }
      }
      return false;
    },
    showNotSupported() {
      return !supportedSites.includes(new URL(this.tabToUrl[this.currentTab]).host);
    }
  }
};
</script>
