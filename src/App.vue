<script setup>
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import { modules, moduleGroups, findModule } from './config/modules'

const route = useRoute()
const currentKey = computed(() => route.params.key)
const currentModule = computed(() => currentKey.value ? findModule(currentKey.value) : null)
const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">
        <div class="logo">🏭</div>
        <div class="brand-text">
          <div class="brand-title">和谊管理系统</div>
          <div class="brand-sub">Factory Management</div>
        </div>
      </div>

      <nav class="nav">
        <router-link to="/" class="nav-item" :class="{ active: !currentKey }">
          <span class="nav-icon">◫</span><span class="nav-label">经营概览</span>
        </router-link>

        <div v-for="group in moduleGroups" :key="group" class="nav-group">
          <div class="nav-group-title">{{ group }}</div>
          <router-link
            v-for="m in modules.filter(x => x.group === group)"
            :key="m.key"
            :to="`/module/${m.key}`"
            class="nav-item"
            :class="{ active: currentKey === m.key }">
            <span class="nav-icon">{{ m.icon }}</span><span class="nav-label">{{ m.name }}</span>
          </router-link>
        </div>
      </nav>

      <div class="sidebar-foot">
        <span class="status-dot"></span>
        系统运行中 · Vue3 + Spring Boot
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="crumb">
          <span class="crumb-home">首页</span>
          <span class="crumb-sep">/</span>
          <span class="crumb-current">{{ currentModule ? currentModule.name : '经营概览' }}</span>
        </div>
        <div class="topbar-right">
          <span class="today">{{ today }}</span>
          <span class="api-badge"><span class="api-dot"></span>localhost:8080</span>
          <div class="avatar">管</div>
        </div>
      </header>
      <div class="content">
        <router-view />
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }

.sidebar {
  width: 248px; flex-shrink: 0; min-height: 100vh;
  background: linear-gradient(180deg, #111827 0%, #1e293b 100%);
  display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh;
  box-shadow: 2px 0 12px rgba(15, 23, 42, .08);
}
.brand { display: flex; align-items: center; gap: 12px; padding: 22px 20px; border-bottom: 1px solid rgba(255,255,255,.08); }
.brand .logo {
  width: 40px; height: 40px; border-radius: 11px; font-size: 21px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  box-shadow: 0 4px 12px rgba(99, 102, 241, .4);
}
.brand-title { color: #fff; font-size: 15px; font-weight: 650; letter-spacing: .2px; }
.brand-sub { font-size: 10px; color: #64748b; margin-top: 3px; letter-spacing: .6px; }

.nav { flex: 1; overflow-y: auto; padding: 14px 12px; }
.nav::-webkit-scrollbar-thumb { background: #334155; }
.nav-item {
  display: flex; align-items: center; gap: 11px; padding: 10px 12px; margin-bottom: 2px;
  color: #94a3b8; text-decoration: none; font-size: 13px; border-radius: 9px;
  transition: all .16s ease;
}
.nav-item:hover { background: rgba(255,255,255,.06); color: #e2e8f0; }
.nav-item.active {
  background: linear-gradient(90deg, rgba(99,102,241,.28), rgba(99,102,241,.08));
  color: #c7d2fe; font-weight: 600; box-shadow: inset 3px 0 0 #818cf8;
}
.nav-icon { width: 20px; text-align: center; font-size: 15px; flex-shrink: 0; }
.nav-label { flex: 1; }
.nav-group { margin-top: 18px; }
.nav-group-title {
  padding: 0 12px 8px; font-size: 10px; color: #64748b; font-weight: 600;
  text-transform: uppercase; letter-spacing: 1px;
}
.sidebar-foot {
  padding: 16px 20px; font-size: 11px; color: #64748b;
  border-top: 1px solid rgba(255,255,255,.08); display: flex; align-items: center; gap: 8px;
}
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 0 3px rgba(52,211,153,.15); }

.main { flex: 1; min-width: 0; }
.topbar {
  height: 64px; background: rgba(255,255,255,.92); backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line); display: flex; align-items: center;
  justify-content: space-between; padding: 0 28px; position: sticky; top: 0; z-index: 20;
}
.crumb { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.crumb-home { color: var(--muted); }
.crumb-sep { color: #cbd5e1; }
.crumb-current { color: var(--ink); font-weight: 600; }
.topbar-right { display: flex; align-items: center; gap: 16px; }
.today { font-size: 12px; color: var(--muted); }
.api-badge {
  display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted);
  background: var(--surface-2); border: 1px solid var(--line); padding: 5px 10px; border-radius: 20px;
}
.api-dot { width: 6px; height: 6px; border-radius: 50%; background: #34d399; }
.avatar {
  width: 34px; height: 34px; border-radius: 50%; font-size: 13px; font-weight: 600; color: #fff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center;
}
.content { padding: 26px 28px 40px; }
</style>
