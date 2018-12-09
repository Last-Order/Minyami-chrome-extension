<template>
  <div class="main-container">
    <el-card v-if="playlists.length === 0">
      <div style="text-align: center">"暂无数据"</div>
    </el-card>
    <template v-else>
      <el-card class="playlist-item" v-for="playlist in playlists" :key="playlist.url">
        <div class="playlist-item-playlist-url">
          <span :title="playlist.url">{{playlist.url}}</span>
          <template v-for="chunkList in playlist.chunkLists">
            <el-form class="playlist-chunklist-item" :key="chunkList.url">
              <el-form-item label="基本信息">
                <div class="playlist-chunklist-item-info">
                  <span
                    v-if="chunkList.resolution"
                  >分辨率：{{chunkList.resolution.x}} × {{chunkList.resolution.y}}</span>
                  <span
                    v-if="chunkList.bandwidth"
                  >码率：{{Math.round(chunkList.bandwidth / 1024)}} kbps</span>
                </div>
              </el-form-item>
              <el-form-item class="playlist-chunklist-command">
                <el-input size="mini" :value="generateCommand(chunkList, playlist)" :ref="chunkList.url"></el-input>
              </el-form-item>
              <el-form-item>
                <div>
                  <el-button size="small" @click="copy(chunkList)">复制</el-button>
                </div>
              </el-form-item>
            </el-form>
          </template>
        </div>
      </el-card>
    </template>
  </div>
</template>
<style>
.main-container {
  min-width: 600px;
  min-height: 600px;
}
.playlist-item {
  margin: 1rem 0;
  max-width: 600px;
}
.playlist-item-playlist-url {
  text-overflow: ellipsis;
  overflow: hidden;
  word-wrap: none;
  white-space: nowrap;
}
.el-form-item {
  margin-bottom: 0 !important;
}
</style>
<script>
import Storage from "../../core/utils/storage.js";
export default {
  data() {
    return {
      playlists: [],
      mode: "download"
    };
  },
  mounted() {
    this.check();
  },
  methods: {
    check() {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]) {
          this.playlists = Storage.getHistory(tabs[0].url);
        }
      });
    },
    generateCommand(chunklist, playlist) {
      if (this.mode === "download") {
        const prefix = "minyami -d";
        return `${prefix} "${chunklist.url}" --output "${playlist.title}.ts"`;
      }
    },
    copy(chunkList) {
      const input = this.$refs[chunkList.url];
      input[0].select();
      document.execCommand('copy');
    }
  }
};
</script>