import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import App from './App.vue'
import router from './router'
import './styles/global.scss'
import { useConversationStore } from '@/stores/conversation.store'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)

// 应用启动时立即初始化会话列表，确保已有历史会话在 Sidebar 首次渲染即可见，
// 不依赖 ChatView 组件 onMounted 的异步调用链
useConversationStore(pinia).init()

app.use(router)
app.use(ElementPlus, { locale: zhCn })

app.mount('#app')
