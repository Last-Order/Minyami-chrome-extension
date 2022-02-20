import Vue from "vue";
import VueI18n from "vue-i18n";
import Element from "element-ui";
import zh_CN from "../../messages/zh-cn";
import en from "../../messages/en";
import Storage from "../../core/utils/storage.js";
import "element-ui/lib/theme-chalk/index.css";
import index from "./index.vue";

Vue.use(Element);
Vue.use(VueI18n);

(async () => {
    const i18n = new VueI18n({
        locale: await Storage.getConfig("language") || "zh_CN",
        messages: {
            en,
            zh_CN
        }
    });

    window.vm = new Vue({
        el: "#app",
        i18n,
        render: (h) => h(index)
    });
})();
