import { createApp } from 'vue'
import { createPinia } from 'pinia'
import axios from 'axios'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import App from './App.vue'
import router from './router'
import './styles/global.scss'
import { configureApiBaseUrl, getApiOrigin } from './services/api-base'

async function bootstrap(): Promise<void> {
  await configureApiBaseUrl()
  axios.defaults.baseURL = getApiOrigin() || undefined
  const isPetWindow = window.location.hash === '#/pet'
  const RootComponent = isPetWindow ? (await import('./views/PetView.vue')).default : App
  const app = createApp(RootComponent)

  app.use(createPinia())
  if (!isPetWindow) app.use(router)
  app.use(ElementPlus, { locale: zhCn })
  app.mount('#app')
}

void bootstrap()
