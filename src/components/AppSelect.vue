<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label }] 或基础类型
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'sm' }, // xs | sm | md
  placement: { type: String, default: 'bottom' }, // bottom | top
  minWidth: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const root = ref(null)

const normalized = computed(() => props.options.map(o =>
  (o && typeof o === 'object')
    ? { value: o.value, label: o.label ?? String(o.value) }
    : { value: o, label: String(o) }
))
const selected = computed(() => normalized.value.find(o => String(o.value) === String(props.modelValue)))
const display = computed(() => selected.value ? selected.value.label : props.placeholder)
const isActive = (o) => String(o.value) === String(props.modelValue)

function choose(o) {
  emit('update:modelValue', o.value)
  open.value = false
}
function onDocClick(e) {
  if (root.value && !root.value.contains(e.target)) open.value = false
}
function onKeydown(e) {
  if (e.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="app-select" :class="[size, placement === 'top' ? 'up' : '', { open, disabled }]" :style="minWidth ? { minWidth } : {}">
    <button type="button" class="app-select-trigger" :disabled="disabled" @click="open = !open">
      <span class="app-select-value" :class="{ 'is-placeholder': !selected }">{{ display }}</span>
      <span class="app-select-arrow">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </span>
    </button>
    <transition name="app-sel">
      <div v-if="open" class="app-select-menu">
        <div
          v-for="(o, i) in normalized"
          :key="i"
          class="app-select-option"
          :class="{ active: isActive(o) }"
          @click="choose(o)"
        >
          <span class="app-select-label">{{ o.label }}</span>
          <span v-if="isActive(o)" class="app-select-check">✓</span>
        </div>
        <div v-if="!normalized.length" class="app-select-empty">暂无选项</div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.app-select { position: relative; display: inline-block; min-width: 142px; vertical-align: middle; }
.app-select-trigger {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--ink);
  cursor: pointer; outline: none; text-align: left;
  transition: border-color .18s, box-shadow .18s, background-color .18s;
}
.app-select-trigger:hover:not(:disabled) { border-color: #c7d2fe; background: #fafbff; }
.app-select.open .app-select-trigger { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
.app-select.disabled .app-select-trigger { opacity: .55; cursor: not-allowed; }
.app-select-value { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.app-select-value.is-placeholder { color: #94a3b8; }
.app-select-arrow { flex-shrink: 0; color: #64748b; display: flex; transition: transform .2s; }
.app-select.open .app-select-arrow { transform: rotate(180deg); color: var(--primary); }

.app-select.sm .app-select-trigger { height: 34px; padding: 0 10px; font-size: 12px; }
.app-select.md .app-select-trigger { height: 40px; padding: 0 13px; font-size: 13.5px; border-color: #e2e8f0; border-radius: 9px; }
.app-select.xs { min-width: 0; }
.app-select.xs .app-select-trigger { height: 26px; padding: 0 2px 0 4px; border: none; background: transparent; font-size: 12px; font-weight: 650; box-shadow: none; }
.app-select.xs .app-select-trigger:hover { background: transparent; }
.app-select.xs .app-select-arrow svg { width: 12px; height: 12px; }

.app-select-menu {
  position: absolute; top: calc(100% + 5px); left: 0; right: 0; z-index: 100;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 11px;
  box-shadow: 0 14px 34px rgba(15, 23, 42, .16), 0 2px 8px rgba(15, 23, 42, .06);
  padding: 5px; max-height: 240px; overflow-y: auto;
}
.app-select.up .app-select-menu { top: auto; bottom: calc(100% + 5px); }
.app-select.xs .app-select-menu { min-width: 86px; left: auto; right: 0; }
.app-select-menu::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
.app-select-option {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 9px 10px; border-radius: 7px; cursor: pointer; font-size: 12.5px; color: var(--ink-2);
  transition: background .14s, color .14s;
}
.app-select.md .app-select-option { font-size: 13px; padding: 10px 11px; }
.app-select-option:hover { background: var(--primary-soft); color: var(--primary); }
.app-select-option.active { background: var(--primary-soft); color: var(--primary); font-weight: 600; }
.app-select-label { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.app-select-check { color: var(--primary); font-weight: 700; font-size: 13px; }
.app-select-empty { padding: 14px; text-align: center; color: var(--muted); font-size: 12px; }

.app-sel-enter-active, .app-sel-leave-active { transition: opacity .16s ease, transform .16s ease; }
.app-sel-enter-from, .app-sel-leave-to { opacity: 0; transform: translateY(-4px) scale(.98); }
.app-select.up .app-sel-enter-from, .app-select.up .app-sel-leave-to { transform: translateY(4px) scale(.98); }
</style>
