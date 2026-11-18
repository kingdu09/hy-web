import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import ModuleView from '../views/ModuleView.vue'

const routes = [
  { path: '/', name: 'dashboard', component: Dashboard },
  { path: '/module/:key', name: 'module', component: ModuleView, props: true },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
