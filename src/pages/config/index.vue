<template>
  <div class="main-container">
    <div>
      <el-button type="text" @click="showConfig = true">设置</el-button>
      <el-card v-if="showConfig" class="config-container" shadow="never">
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
    <el-card v-if="playlists.length === 0" shadow="never">
      <div style="text-align: center">"暂无数据"</div>
    </el-card>
    <el-card v-if="noKey" shadow="never">
      <el-alert title="该站点需要传递 Key 而 Minyami 没有拿到 请刷新重试" type="error"></el-alert>
    </el-card>
    <el-card v-if="noCookies" shadow="never">
      <el-alert title="该站点需要传递 Cookies 而 Minyami 没有拿到 请刷新重试" type="error"></el-alert>
    </el-card>
    <el-card v-if="cookies.length > 0" shadow="never">
      <el-alert title="生成的命令包含您的 Cookies 请不要随意复制给他人" type="warning"></el-alert>
    </el-card>
    <el-card v-if="notSupported" shadow="never">
      <el-alert
        title="Minyami Extrator 可能不支持此站点，但是您可以手工获取 m3u8 地址尝试使用 minyami -d <url> 下载"
        type="error"
      ></el-alert>
    </el-card>
    <el-card class="playlist-item" v-for="playlist in playlists" :key="playlist.url" shadow="never">
      <div>
        <div :title="playlist.url" class="playlist-item-playlist-url">
          <span>{{playlist.url}}</span>
        </div>
        <el-form :inline="true">
          <el-form-item>
            <el-checkbox v-model="form.recoverMode" label="恢复模式"></el-checkbox>
          </el-form-item>
          <el-form-item>
            <el-checkbox v-model="form.live" label="下载直播"></el-checkbox>
          </el-form-item>
        </el-form>
        <template v-for="(chunkList) in playlist.chunkLists">
          <el-form class="playlist-chunklist-item" :key="chunkList.url">
            <el-form-item>
              <div class="playlist-chunklist-item-info">
                <template v-if="chunkList.type === 'video'">
                  <el-tag type="info" size="mini" class="playlist-tag">视频</el-tag>
                  <span
                    v-if="chunkList.resolution"
                  >分辨率：{{chunkList.resolution.x}} × {{chunkList.resolution.y}}</span>
                  <span
                    v-if="chunkList.bandwidth"
                  >码率：{{Math.round(chunkList.bandwidth / 1024)}} kbps</span>
                </template>
                <template v-if="chunkList.type === 'audio'">
                  <el-tag type="info" size="mini" class="playlist-tag">音频</el-tag>
                  <span>{{ chunkList.name && ` 名称：${chunkList.name}` }}</span>
                </template>
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
.playlist-tag {
  margin-right: 1rem;
}
.el-card {
  margin: 10px auto;
}
</style>
<script>
import Storage from "../../core/utils/storage.js";
export default {
  data() {
    return {
      playlists: [],
      keys: [],
      cookies: [],
      noKey: false,
      noCookies: false,
      notSupported: true,
      form: {
        recoverMode: false,
        live: false
      },
      configForm: {
        proxy: "",
        threads: ""
      },
      showConfig: false
    };
  },
  mounted() {
    this.configForm.proxy = Storage.getConfig("proxy");
    this.configForm.threads = Storage.getConfig("threads");
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "update_current") {
        for (const entry of message.detail) {
          // console.log(entry);
          const key = Object.entries(entry)[0][0];
          const value = Object.entries(entry)[0][1];
          this[key] = value;
        }
      }
    });
    this.check();
  },
  methods: {
    check() {
      chrome.runtime.sendMessage({type: "query_current"})
    },
    generateCommand(chunklist, playlist) {
      const prefix = "minyami";
      let command = "";
      if (!this.form.recoverMode) {
        command += `${prefix} -d "${chunklist.url}" --output "${playlist.title}.ts"`;
      } else {
        command += `${prefix} -r "${chunklist.url}"`;
      }
      if (this.keys.length > 0) {
        command += ` --key "${this.keys[0]}"`;
      }
      if (this.cookies.length > 0) {
        command += ` --cookies "${this.cookies[0]}"`;
      }
      if (this.form.live) {
        command += ` --live`;
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
    saveConfig() {
      const proxy = this.configForm.proxy;
      const threads = this.configForm.threads;
      // if (!Number.isInteger(parseInt(threads)) || parseInt(threads) <= 0) {
      //   return this.$message({
      //     type: 'error',
      //     message: '并发数必须是正整数'
      //   })
      // }
      Storage.setConfig("proxy", proxy);
      Storage.setConfig("threads", threads);
      this.showConfig = false;
    }
  }
};
</script>
