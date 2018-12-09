import Vue from 'vue';
import Element from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
import index from './index.vue';

Vue.use(Element);
new Vue({
    el: '#app',
    render: h => h(index)
});