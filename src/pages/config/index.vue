<template>
  <div class="main-container">
    <div>
      <el-button type="text" @click="showConfig = true">设置</el-button>
      <el-card v-if="showConfig" class="config-container">
        <el-form>
          <el-form-item label="代理">
            <el-input v-model="configForm.proxy"></el-input>
          </el-form-item>
          <el-form-item label="并发数量">
            <el-input v-model="configForm.threads"></el-input>
          </el-form-item>
          <el-form-item>
            <el-button @click="saveConfig">保存</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
    <el-card v-if="playlists.length === 0">
      <div style="text-align: center">"暂无数据"</div>
    </el-card>
    <el-card v-if="showNoKeyWarning()">
      <el-alert title="该站点需要传递 Key 而 Minyami 没有拿到 请刷新重试" type="error"></el-alert>
    </el-card>
    <el-card v-if="showNoCookiesWarning()">
      <el-alert title="该站点需要传递 Cookies 而 Minyami 没有拿到 请刷新重试" type="error"></el-alert>
    </el-card>
    <el-card v-if="showNotSupported()">
      <el-alert title="Minyami Extrator 可能不支持此站点，但是您可以手工获取 m3u8 地址尝试使用 minyami -d <url> 下载" type="error"></el-alert>
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
.config-container {
  margin: 1rem auto;
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
.playlist-item .el-form-item {
  margin-bottom: 0 !important;
}
</style>
<script>
import Storage from "../../core/utils/storage.js";
import { supportedSites } from '../../definitions';
export default {
  data() {
    return {
      playlists: [],
      keys: [],
      cookies: [],
      form: {
        recoverMode: false
      },
      configForm: {
        proxy: "",
        threads: ""
      },
      currentUrl: "",
      showConfig: false
    };
  },
  mounted() {
    this.configForm.proxy = Storage.getConfig("proxy");
    this.configForm.threads = Storage.getConfig("threads");
    setInterval(this.getKeys, 1000);
    setInterval(this.getCookies, 1000);
    setInterval(this.check, 1000);
    this.check();
    this.getKeys();
    this.getCookies();
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
        command += ` --key "${this.keys[0]}"`;
      }
      if (this.cookies.length > 0) {
        command += ` --cookies "${this.cookies[0]}"`;
      }
      if (Storage.getConfig("threads")) {
        command += ` --threads ${Storage.getConfig("threads")}`;
      }
      if (Storage.getConfig("proxy")) {
        command += ` --proxy "${Storage.getConfig("proxy")}"`;
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
    getCookies() {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]) {
          const cookies = Storage.getHistory(tabs[0].url + "-cookies");
          if (cookies && cookies.length > 0) {
            this.cookies = cookies;
          }
        }
      });
    },
    showNoKeyWarning() {
      if (!this.currentUrl) {
        return false;
      }
      const needKeySites = ["abema.tv", "live2.nicovideo.jp", "dmm.com"];
      for (const site of needKeySites) {
        if (this.currentUrl.includes(site) && this.keys.length === 0) {
          return true;
        }
      }
      return false;
    },
    showNoCookiesWarning() {
      if (!this.currentUrl) {
        return false;
      }
      const needCookiesSites = ["360ch.tv"];
      for (const site of needCookiesSites) {
        if (this.currentUrl.includes(site) && this.cookies.length === 0) {
          return true;
        }
      }
      return false;
    },
    showNotSupported() {
      return !this.currentUrl || !supportedSites.includes(new URL(this.currentUrl).host);
    },
    saveConfig() {
      const proxy = this.configForm.proxy;
      const threads = this.configForm.threads;
      // if (!Number.isInteger(parseInt(threads)) || parseInt(threads) <= 0) {
      //   return this.$message({
      //     type: 'error',
      //     message: '并发数必须是正整数'
      //   })
      // }
      if (proxy) {
        Storage.setConfig("proxy", proxy);
      }
      if (threads) {
        Storage.setConfig("threads", threads);
      }
      this.showConfig = false;
    }
  }
};
</script>