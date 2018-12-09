<template>
  <div class="main-container">
    <el-card v-if="playlists.length === 0">
      <div style="text-align: center">"暂无数据"</div>
    </el-card>
    <el-card v-if="showNoKeyWarning()">
      <el-alert title="该站点需要 Key 而 Minyami 没有拿到 请刷新重试" type="error"></el-alert>
    </el-card>
    <el-card class="playlist-item" v-for="playlist in playlists" :key="playlist.url">
      <div>
        <div :title="playlist.url" class="playlist-item-playlist-url">
          <span>{{playlist.url}}</span>
        </div>
        <el-form>
          <el-form-item>
            <el-switch
              style="display: block"
              v-model="form.recoverMode"
              active-text="恢复模式"
              inactive-text="下载模式"
            ></el-switch>
          </el-form-item>
        </el-form>
        <template v-for="(chunkList, index) in playlist.chunkLists">
          <el-form class="playlist-chunklist-item" :key="chunkList.url">
            <el-form-item :label="'流' + (index + 1) + ' 基本信息'">
              <div class="playlist-chunklist-item-info">
                <span
                  v-if="chunkList.resolution"
                >分辨率：{{chunkList.resolution.x}} × {{chunkList.resolution.y}}</span>
                <span v-if="chunkList.bandwidth">码率：{{Math.round(chunkList.bandwidth / 1024)}} kbps</span>
              </div>
            </el-form-item>
            <el-form-item class="playlist-chunklist-command">
              <el-input
                size="mini"
                :value="generateCommand(chunkList, playlist)"
                :ref="chunkList.url"
              ></el-input>
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
      keys: [],
      form: {
        recoverMode: false
      },
      currentUrl: ""
    };
  },
  mounted() {
    setInterval(this.getKeys, 1000);
    setInterval(this.check, 1000);
    this.check();
    this.getKeys();
  },
  methods: {
    check() {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]) {
          this.playlists = Storage.getHistory(tabs[0].url);
          this.currentUrl = tabs[0].url;
        }
      });
    },
    generateCommand(chunklist, playlist) {
      const prefix = "minyami";
      let command = "";
      if (!this.form.recoverMode) {
        command += `${prefix} -d "${chunklist.url}" --output "${
          playlist.title
        }.ts"`;
      } else {
        command += `${prefix} -r "${chunklist.url}"`;
      }
      if (this.keys.length > 0) {
        command += ` --key ${this.keys[0]}`;
      }
      return command;
    },
    copy(chunkList) {
      const input = this.$refs[chunkList.url];
      input[0].select();
      document.execCommand("copy");
    },
    getKeys() {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]) {
          const keys = Storage.getHistory(tabs[0].url + "-key");
          if (keys && keys.length > 0) {
            this.keys = keys;
          }
        }
      });
    },
    showNoKeyWarning() {
      if (!this.currentUrl) {
        return false;
      }
      if (this.currentUrl.includes("abema.tv") && this.keys.length === 0) {
        return true;
      }
      if (this.currentUrl.includes("live2.nicovideo.jp") && this.keys.length === 0) {
        return true;
      }
      return false;
    }
  }
};
</script>