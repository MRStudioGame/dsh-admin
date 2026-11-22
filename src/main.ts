import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import { permDirective } from './utils/permDirective'
import { applyDeviceClass } from './utils/device'
import './styles/index.css'

// 先识别设备再挂载，避免手机端首帧按桌面布局渲染后跳动
applyDeviceClass()

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

// 注册全部图标组件
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 按钮级权限指令 v-perm
app.directive('perm', permDirective)

app.mount('#app')
