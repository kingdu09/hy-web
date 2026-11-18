<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import CrudTable from '../components/CrudTable.vue'
import { findModule } from '../config/modules'

const route = useRoute()
const moduleKey = computed(() => route.params.key)
</script>

<template>
  <CrudTable v-if="moduleKey && findModule(moduleKey)" :key="moduleKey" :module-key="moduleKey" />
  <div v-else class="notfound">模块不存在：<code>{{ moduleKey }}</code></div>
</template>

<style scoped>
.notfound { padding: 40px; color: #c0392b; }
</style>
