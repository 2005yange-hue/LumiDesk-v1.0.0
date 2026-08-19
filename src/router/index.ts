import { createRouter, createWebHashHistory } from 'vue-router'
import { useBootstrapStore } from '@/stores/bootstrap.store'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/init', name: 'init', component: () => import('@/views/InitializationView.vue') },
    { path: '/', name: 'chat', component: () => import('@/views/ChatView.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    { path: '/memory', name: 'memory', component: () => import('@/views/MemoryView.vue') },
    { path: '/emotion', name: 'emotion', component: () => import('@/views/EmotionView.vue') },
    { path: '/pet', name: 'pet', component: () => import('@/views/PetView.vue'), meta: { skipBootstrap: true, petWindow: true } }
  ]
})

router.beforeEach((to) => {
  if (to.meta.skipBootstrap || to.name === 'init') return true
  const bootstrap = useBootstrapStore()
  if (bootstrap.status !== 'success') return { name: 'init' }
  return true
})

export default router
