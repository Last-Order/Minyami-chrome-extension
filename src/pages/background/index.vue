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
      if (message.type === "playlist") {
        const playlist = new Playlist(message.content, message.url, message.title);
        if (!Storage.getHistory(sender.url).some(p => p.url === playlist.url)) {
          Storage.setHistory(sender.url, playlist);
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
        delete tabToUrl[tabId];
      }
    });
  }
};
</script>