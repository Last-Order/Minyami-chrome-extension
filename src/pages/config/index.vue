<template>
    <div class="main-container">
        <div>
            <div class="buttons">
                <el-button type="text" @click="showConfig = true">{{ $t("message.settings") }}</el-button>
                <el-button type="text" @click="changeLanguage">
                    {{ $i18n.locale === "en" ? "中文" : "English" }}
                </el-button>
            </div>
            <el-card v-if="showConfig" class="config-container" shadow="never">
                <el-form>
                    <el-form-item :label="$t('message.threads')">
                        <el-input v-model="configForm.threads"></el-input>
                    </el-form-item>
                    <el-form-item :label="$t('message.useNPX')">
                        <el-checkbox v-model="configForm.useNPX"></el-checkbox>
                    </el-form-item>
                    <el-form-item>
                        <el-button @click="saveConfig">{{ $t("message.save") }}</el-button>
                    </el-form-item>
                </el-form>
            </el-card>
        </div>
        <el-card style="text-align: center" v-if="playlists.length === 0" shadow="never">
            <div style="font-size: larger">{{ $t("message.noData") }}</div>
            <div style="margin-top: 10px; opacity: .5">{{ $t('message.noDataTip') }}</div>
        </el-card>
        <el-card v-if="status.missingKey" shadow="never">
            <el-alert :title="$t('message.noKeyWarning')" type="error"></el-alert>
        </el-card>
        <el-card v-if="status.missingCookie" shadow="never">
            <el-alert :title="$t('message.noCookieWarning')" type="error"></el-alert>
        </el-card>
        <el-card v-if="cookies.length > 0" shadow="never">
            <el-alert :title="$t('message.cookieWarning')" type="warning"></el-alert>
        </el-card>
        <el-card v-if="showMinyamiVersionRequirementTip" shadow="never">
            <el-alert
                :title="$t('message.minyamiVersionRequirementTip', { version: showMinyamiVersionRequirementTip })"
                type="info"
            ></el-alert>
        </el-card>
        <el-card v-if="!status.supported" shadow="never">
            <el-alert :title="$t('message.unsupportedTip')" type="error"></el-alert>
        </el-card>
        <el-card class="playlist-item" v-for="(playlist, index) in playlists" :key="playlist.url" shadow="never">
            <div>
                <div :title="playlist.url" class="playlist-item-playlist-url">
                    <span>{{ playlist.url }}</span>
                </div>
                <div v-if="playlist.streamName" class="playlist-item-playlist-streamName">
                    {{ playlist.streamName }}
                </div>
                <el-form :inline="true">
                    <el-form-item>
                        <el-checkbox v-model="form.recoverMode" :label="$t('message.resumeMode')"></el-checkbox>
                    </el-form-item>
                    <el-form-item>
                        <el-checkbox v-model="form.live" :label="$t('message.liveMode')"></el-checkbox>
                    </el-form-item>
                </el-form>
                <template v-for="chunkList in playlist.chunkLists">
                    <el-form class="playlist-chunklist-item" :key="chunkList.url">
                        <el-form-item>
                            <div class="playlist-chunklist-item-info">
                                <template v-if="chunkList.minimumMinyamiVersion">
                                    <el-tag type="info" size="mini" class="playlist-tag">
                                        {{ $t("message.require") }} Minyami >= {{ chunkList.minimumMinyamiVersion }}
                                    </el-tag>
                                </template>
                                <template v-if="chunkList.type === 'video'">
                                    <el-tag type="info" size="mini" class="playlist-tag">
                                        {{ $t("message.video") }}
                                    </el-tag>
                                    <span v-if="chunkList.resolution">
                                        {{ $t("message.resolution") }}: {{ chunkList.resolution.x }} ×
                                        {{ chunkList.resolution.y }}
                                    </span>
                                    <span v-if="chunkList.bandwidth">
                                        {{ $t("message.bitrate") }}:
                                        {{ Math.round(chunkList.bandwidth / 1024) }}
                                        kbps
                                    </span>
                                </template>
                                <template v-if="chunkList.type === 'audio'">
                                    <el-tag type="info" size="mini" class="playlist-tag">
                                        {{ $t("message.audio") }}
                                    </el-tag>
                                    <span>
                                        {{ chunkList.name && ` ${$t("message.trackName")}: ${chunkList.name}` }}
                                    </span>
                                </template>
                            </div>
                        </el-form-item>
                        <el-form-item class="playlist-chunklist-command">
                            <el-input
                                size="mini"
                                :value="generateCommand(chunkList, playlist, index)"
                                :ref="chunkList.url"
                            ></el-input>
                        </el-form-item>
                        <el-form-item>
                            <div>
                                <el-button size="small" @click="copy(chunkList)">{{ $t("message.copy") }}</el-button>
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
.buttons {
    display: flex;
    justify-content: space-between;
}
.config-container {
    margin: 1rem auto;
}
.playlist-item {
    margin: 1rem 0;
    max-width: 600px;
}
.playlist-item-playlist-streamName {
    margin: 8px 0;
    color: #aaa;
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
import {
    minyamiVersionRequirementMap,
    siteAdditionalHeaders,
    siteThreadsSettings,
    parseStatusFlags
} from "../../definitions";
const dataFields = ["playlists", "keys", "cookies", "currentUrl", "currentUrlHost", "status"];
export default {
    data() {
        return {
            playlists: [],
            keys: [],
            cookies: [],
            form: {
                recoverMode: false,
                live: false
            },
            configForm: {
                threads: "",
                useNPX: false
            },
            currentTab: undefined,
            currentUrl: "",
            currentUrlHost: "",
            showConfig: false,
            statusFlags: 0
        };
    },
    computed: {
        showMinyamiVersionRequirementTip: function() {
            return minyamiVersionRequirementMap[this.currentUrlHost];
        },
        status: {
            set: function(flags) {
                this.statusFlags = flags;
            },
            get: function() {
                return parseStatusFlags(this.statusFlags);
            }
        }
    },
    async mounted() {
        this.configForm.threads = await Storage.getConfig("threads");
        this.configForm.useNPX = await Storage.getConfig("useNPX");
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) return;
        this.currentTab = tabs[0].id;
        chrome.runtime.onMessage.addListener(this.handleDataUpdate);
        chrome.runtime.sendMessage({ type: "query_livedata" });
    },
    unmounted() {
        if (!this.currentTab) return;
        chrome.runtime.onMessage.removeListener(this.handleDataUpdate);
    },
    methods: {
        async handleDataUpdate(message) {
            // console.log(message);
            if (message.type === "set_language") {
                this.$i18n.locale = await Storage.getConfig("language");
            }
            if (message.type === "save_config") {
                this.configForm.threads = await Storage.getConfig("threads");
                this.configForm.useNPX = await Storage.getConfig("useNPX");
            }
            if (message.type === "update_livedata") {
                if (message.tabId !== this.currentTab) return;
                for (const field of dataFields) {
                    if (field in message.detail) {
                        this[field] = message.detail[field];
                    }
                }
            }
        },
        generateCommand(chunklist, playlist, index) {
            const prefix = this.configForm.useNPX ? "npx minyami" : "minyami";
            let command = "";
            if (!this.form.recoverMode) {
                command += `${prefix} -d "${chunklist.url}" --output "${playlist.title.replace(/\"/g, `\\"`)}.ts"`;
            } else {
                command += `${prefix} -r "${chunklist.url}"`;
            }
            if (this.keys.length > 0) {
                command += ` --key "${this.keys[index] || this.keys[0]}"`;
            }
            if (this.cookies.length > 0) {
                command += ` --headers "Cookie: ${this.cookies[index] || this.cookies[0]}"`;
            }
            if (siteAdditionalHeaders[this.currentUrlHost]) {
                for (const header of Object.keys(siteAdditionalHeaders[this.currentUrlHost])) {
                    command += ` --headers "${header}: ${siteAdditionalHeaders[this.currentUrlHost][header]}"`;
                }
            }
            if (this.form.live) {
                command += ` --live`;
            }
            if (siteThreadsSettings[this.currentUrlHost]) {
                command += ` --threads ${siteThreadsSettings[this.currentUrlHost]}`;
            } else if (this.configForm.threads) {
                command += ` --threads ${this.configForm.threads}`;
            }
            return command;
        },
        copy(chunkList) {
            const input = this.$refs[chunkList.url];
            input[0].select();
            document.execCommand("copy");
        },
        async saveConfig() {
            const threads = this.configForm.threads;
            const useNPX = this.configForm.useNPX;
            await Storage.setConfig("threads", threads);
            await Storage.setConfig("useNPX", useNPX);
            this.showConfig = false;
            chrome.runtime.sendMessage({ type: "save_config" });
        },
        async changeLanguage() {
            const targetLanguage = this.$i18n.locale === "en" ? "zh_CN" : "en";
            await Storage.setConfig("language", targetLanguage);
            this.$i18n.locale = targetLanguage;
            chrome.runtime.sendMessage({ type: "set_language" });
        }
    }
};
</script>
