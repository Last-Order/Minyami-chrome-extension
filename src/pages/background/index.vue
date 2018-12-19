<template>
  <div></div>
</template>
<script>
import { Playlist } from "../../core/m3u8.js";
import Storage from "../../core/utils/storage.js";
export default {
  mounted() {
    chrome.runtime.onMessageExternal.addListener(function(
      message,
      sender,
      sendResponse
    ) {
      if (message.type === 'playlist') {
        const playlist = new Playlist(message.content, message.url, message.title);
        if (!Storage.getHistory(sender.tab.url).some(p => p.url === playlist.url)) {
          Storage.setHistory(sender.tab.url, playlist);
        }
      } 
      if (message.type === 'key') {
        if (!Storage.getHistory(sender.tab.url + '-key').includes(message.key)) {
          Storage.setHistory(sender.tab.url + '-key', message.key);
        }
      }
    });
    // 监视页面关闭
    const tabToUrl = {};
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
      tabToUrl[tabId] = tab.url;
    });

    chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
      if (tabToUrl[tabId]) {
        Storage.removeHistory(tabToUrl[tabId]);
        Storage.removeHistory(tabToUrl[tabId] + '-key');
        delete tabToUrl[tabId];
      }
    });
  }
};
</script>