<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import * as XLSX from 'xlsx'
import { resource } from '../api'
import { findModule } from '../config/modules'

const props = defineProps({ moduleKey: { type: String, required: true } })
const mod = computed(() => findModule(props.moduleKey))
const api = computed(() => resource(props.moduleKey))

const rows = ref([])
const loading = ref(false)
const errMsg = ref('')
const okMsg = ref('')

// 外键下拉选项：key -> [{value, label}]
const refOptions = reactive({})

// 筛选条件
const filters = reactive({ keyword: '' })

// 分页
const currentPage = ref(1)
const pageSize = ref(5)
const pageSizes = [5, 10, 20, 50, 100]

// 表单弹窗
const dialogOpen = ref(false)
const editingId = ref(null)
const form = reactive({})
const submitting = ref(false)

const listFields = computed(() => mod.value.fields.filter(f => f.list))
const formFields = computed(() => mod.value.fields.filter(f => f.form))
const dateFilterFields = computed(() => mod.value.fields.filter(f => f.type === 'date'))
const optionFilterFields = computed(() => mod.value.fields.filter(f => f.type === 'select' || f.type === 'ref'))
const hasFilters = computed(() => dateFilterFields.value.length > 0 || optionFilterFields.value.length > 0)

function display(row, field) {
  if (field.type === 'readonly') return row[field.key] ?? '-'
  if (field.type === 'select' && field.options) {
    const opt = field.options.find(o => String(o.value) === String(row[field.key]))
    return opt ? opt.label : (row[field.key] ?? '-')
  }
  if (field.type === 'ref' && refOptions[field.key]) {
    const opt = refOptions[field.key].find(o => o.value === row[field.key])
    return opt ? opt.label : `#${row[field.key]}`
  }
  return row[field.key] ?? '-'
}

// ---------- 筛选 ----------
function inDateRange(row, f) {
  const v = row[f.key]
  const from = filters[f.key + '_from']
  const to = filters[f.key + '_to']
  if (!v) return !from && !to
  const d = String(v).slice(0, 10)
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

const filteredRows = computed(() => {
  const kw = (filters.keyword || '').trim().toLowerCase()
  return rows.value.filter(row => {
    for (const f of dateFilterFields.value) if (!inDateRange(row, f)) return false
    for (const f of optionFilterFields.value) {
      const val = filters[f.key]
      if (val !== '' && val !== undefined && val !== null && String(row[f.key]) !== String(val)) return false
    }
    if (kw) {
      const hay = listFields.value.map(f => String(display(row, f) ?? '')).join(' ').toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
})

// ---------- 分页 ----------
const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize.value)))
const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})
const rangeStart = computed(() => filteredRows.value.length ? (currentPage.value - 1) * pageSize.value + 1 : 0)
const rangeEnd = computed(() => Math.min(currentPage.value * pageSize.value, filteredRows.value.length))

// 页码列表（带省略号）：1 … 4 5 6 … 20
const pageList = computed(() => {
  const total = totalPages.value, cur = currentPage.value
  const list = []
  if (total <= 7) {
    for (let i = 1; i <= total; i++) list.push(i)
    return list
  }
  list.push(1)
  if (cur > 3) list.push('…')
  const start = Math.max(2, cur - 1)
  const end = Math.min(total - 1, cur + 1)
  for (let i = start; i <= end; i++) list.push(i)
  if (cur < total - 2) list.push('…')
  list.push(total)
  return list
})

function goPage(p) {
  if (typeof p !== 'number') return
  if (p < 1 || p > totalPages.value) return
  currentPage.value = p
}
function prevPage() { goPage(currentPage.value - 1) }
function nextPage() { goPage(currentPage.value + 1) }
function onPageSizeChange() { currentPage.value = 1 }

// 筛选变化时回到第一页
watch(filteredRows, () => { currentPage.value = 1 })

const filterActive = computed(() =>
  !!filters.keyword || optionFilterFields.value.some(f => filters[f.key] !== '' && filters[f.key] != null) ||
  dateFilterFields.value.some(f => filters[f.key + '_from'] || filters[f.key + '_to']))

function resetFilters() {
  filters.keyword = ''
  for (const f of optionFilterFields.value) delete filters[f.key]
  for (const f of dateFilterFields.value) { delete filters[f.key + '_from']; delete filters[f.key + '_to'] }
}
function optionsForFilter(f) { return f.type === 'select' ? (f.options || []) : (refOptions[f.key] || []) }

// ---------- 导出 Excel（导出全部筛选结果，不受分页影响）----------
function exportExcel() {
  const data = filteredRows.value.map(row => {
    const o = { 'ID': row.id }
    for (const f of listFields.value) o[f.label] = display(row, f)
    return o
  })
  const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ '提示': '当前筛选结果为空' }])
  ws['!cols'] = Object.keys(data[0] || {}).map(k => ({ wch: Math.max(10, Math.min(40, k.length * 2 + 4)) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, mod.value.name)
  XLSX.writeFile(wb, `${mod.value.name}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  flashOk(`已导出 ${data.length} 条记录`)
}

function flashOk(msg) { okMsg.value = msg; setTimeout(() => okMsg.value = '', 2600) }

async function load() {
  loading.value = true; errMsg.value = ''
  try { const { data } = await api.value.list(); rows.value = data }
  catch (e) { errMsg.value = '加载失败：' + (e.response?.status || e.message) }
  finally { loading.value = false }
}

async function loadRefs() {
  for (const f of mod.value.fields.filter(f => f.type === 'ref')) {
    try {
      const { data } = await resource(f.ref).list()
      refOptions[f.key] = data.map(r => ({ value: r.id, label: r[f.refLabel] ?? r.id }))
    } catch (e) { refOptions[f.key] = [] }
  }
}

function openCreate() {
  editingId.value = null
  for (const k of Object.keys(form)) delete form[k]
  for (const f of formFields.value) form[f.key] = f.default ?? (f.type === 'number' ? null : '')
  dialogOpen.value = true
}
function openEdit(row) {
  editingId.value = row.id
  for (const k of Object.keys(form)) delete form[k]
  for (const f of formFields.value) form[f.key] = row[f.key] ?? ''
  dialogOpen.value = true
}
function buildPayload() {
  const payload = {}
  for (const f of formFields.value) {
    let v = form[f.key]
    if (f.type === 'number' || f.type === 'ref') v = (v === '' || v === null) ? null : Number(v)
    payload[f.key] = v
  }
  return payload
}
async function submit() {
  submitting.value = true; errMsg.value = ''
  try {
    const payload = buildPayload()
    if (editingId.value) await api.value.update(editingId.value, payload)
    else await api.value.create(payload)
    dialogOpen.value = false
    flashOk(editingId.value ? '修改成功' : '新增成功')
    await load()
  } catch (e) {
    errMsg.value = '提交失败：' + (e.response?.data?.message || e.message)
  } finally { submitting.value = false }
}
async function remove(row) {
  if (!confirm(`确定删除 ${mod.value.name} #${row.id}？`)) return
  try { await api.value.remove(row.id); flashOk('删除成功'); await load() }
  catch (e) { errMsg.value = '删除失败：' + e.message }
}

watch(() => props.moduleKey, () => {
  rows.value = []; resetFilters(); currentPage.value = 1; load(); loadRefs()
}, { immediate: false })
onMounted(() => { load(); loadRefs() })
</script>

<template>
  <div class="module-page">
    <div class="page-head">
      <div class="title-wrap">
        <div class="title-icon">{{ mod.icon }}</div>
        <div>
          <h1>{{ mod.name }}</h1>
          <p>{{ mod.desc }}</p>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-ghost" @click="load" :disabled="loading"><span :class="{ spin: loading }">⟳</span> 刷新</button>
        <button class="btn btn-export" @click="exportExcel">⇩ 导出 Excel</button>
        <button class="btn btn-primary" @click="openCreate">＋ 新增</button>
      </div>
    </div>

    <div v-if="okMsg" class="msg ok">{{ okMsg }}</div>
    <div v-if="errMsg" class="msg err">{{ errMsg }} <button class="text-btn" @click="load">重试</button></div>

    <!-- 筛选栏 -->
    <div class="card filter-bar" v-if="hasFilters">
      <div class="filter-item search">
        <span class="filter-ico">⌕</span>
        <input v-model="filters.keyword" placeholder="搜索关键字…" />
      </div>
      <div class="filter-item" v-for="f in optionFilterFields" :key="f.key">
        <select v-model="filters[f.key]">
          <option value="">{{ f.label }}：全部</option>
          <option v-for="o in optionsForFilter(f)" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
      <div class="filter-item date-range" v-for="f in dateFilterFields" :key="f.key + '_r'">
        <span class="date-label">{{ f.label }}</span>
        <input type="date" v-model="filters[f.key + '_from']" />
        <span class="tilde">~</span>
        <input type="date" v-model="filters[f.key + '_to']" />
      </div>
      <button v-if="filterActive" class="text-btn reset" @click="resetFilters">清除筛选</button>
    </div>

    <!-- 表格 -->
    <div class="card table-card">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th class="idx-col">#</th>
              <th v-for="f in listFields" :key="f.key">{{ f.label }}</th>
              <th class="op-col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in pagedRows" :key="row.id">
              <td class="idx-col">{{ (currentPage - 1) * pageSize + i + 1 }}</td>
              <td v-for="f in listFields" :key="f.key">
                <span v-if="f.type === 'readonly'" class="ro">{{ display(row, f) }}</span>
                <span v-else>{{ display(row, f) }}</span>
              </td>
              <td class="op-col">
                <button class="row-btn" @click="openEdit(row)">编辑</button>
                <button class="row-btn danger" @click="remove(row)">删除</button>
              </td>
            </tr>
            <tr v-if="!pagedRows.length">
              <td :colspan="listFields.length + 2" class="empty">
                {{ rows.length ? '当前筛选无匹配数据' : '暂无数据，点击右上角「新增」添加' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
      <div class="pagination">
        <div class="page-info">
          显示 <b>{{ rangeStart }}–{{ rangeEnd }}</b> 条，共 <b>{{ filteredRows.length }}</b> 条
          <span v-if="filterActive" class="filtered-badge">已筛选（总 {{ rows.length }}）</span>
        </div>
        <div class="page-controls">
          <label class="page-size">
            每页
            <select v-model.number="pageSize" @change="onPageSizeChange">
              <option v-for="s in pageSizes" :key="s" :value="s">{{ s }}</option>
            </select>
            条
          </label>
          <button class="page-btn" :disabled="currentPage <= 1" @click="prevPage">‹</button>
          <template v-for="(p, i) in pageList" :key="i">
            <span v-if="p === '…'" class="ellipsis">…</span>
            <button v-else class="page-btn" :class="{ active: p === currentPage }" @click="goPage(p)">{{ p }}</button>
          </template>
          <button class="page-btn" :disabled="currentPage >= totalPages" @click="nextPage">›</button>
        </div>
      </div>
    </div>

    <!-- 弹窗 -->
    <div v-if="dialogOpen" class="overlay" @click.self="dialogOpen = false">
      <div class="dialog card">
        <div class="dialog-head">
          <h2>{{ editingId ? '编辑' : '新增' }}{{ mod.name }}</h2>
          <button class="close" @click="dialogOpen = false">✕</button>
        </div>
        <form @submit.prevent="submit">
          <div class="form-grid">
            <label v-for="f in formFields" :key="f.key" :class="{ wide: f.type === 'textarea' }">
              <span>{{ f.label }} <em v-if="f.required">*</em></span>
              <select v-if="f.type === 'select'" v-model="form[f.key]">
                <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <select v-else-if="f.type === 'ref'" v-model="form[f.key]">
                <option value="">-- 请选择 --</option>
                <option v-for="o in refOptions[f.key]" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <textarea v-else-if="f.type === 'textarea'" v-model="form[f.key]" rows="3"></textarea>
              <input v-else :type="f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'"
                     v-model="form[f.key]" :placeholder="f.placeholder || ''" :step="f.type === 'number' ? '0.0001' : undefined" />
            </label>
          </div>
          <div class="dialog-foot">
            <button type="button" class="btn btn-ghost" @click="dialogOpen = false">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="submitting">{{ submitting ? '保存中…' : '保存' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spin { display: inline-block; animation: rot 1s linear infinite; }
@keyframes rot { to { transform: rotate(360deg); } }

.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.title-wrap { display: flex; align-items: center; gap: 13px; }
.title-icon {
  width: 46px; height: 46px; border-radius: 12px; font-size: 22px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
}
.page-head h1 { font-size: 22px; font-weight: 700; }
.page-head p { color: var(--muted); font-size: 12px; margin-top: 4px; }
.actions { display: flex; gap: 10px; }

.text-btn { background: none; border: none; color: var(--primary); cursor: pointer; font-size: 12px; padding: 0; }
.text-btn.reset { margin-left: auto; }
.row-btn { background: none; border: none; color: var(--primary); cursor: pointer; font-size: 12px; padding: 4px 7px; border-radius: 5px; }
.row-btn:hover { background: var(--primary-soft); }
.row-btn.danger { color: var(--danger); }
.row-btn.danger:hover { background: var(--danger-soft); }

/* 筛选栏 */
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 13px 16px; margin-bottom: 14px; }
.filter-item { position: relative; }
.filter-item.search { flex: 1; min-width: 200px; }
.filter-item.search .filter-ico { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted-2); font-size: 16px; }
.filter-item.search input { width: 100%; padding-left: 32px; }
.filter-item select, .filter-item input { height: 34px; padding: 0 11px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); color: var(--ink); outline: none; font-size: 12px; }
.filter-item select:focus, .filter-item input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,.1); }
.date-range { display: flex; align-items: center; gap: 6px; }
.date-range input { width: 132px; }
.date-label { font-size: 12px; color: var(--muted); }
.tilde { color: var(--muted-2); }

/* 表格 */
.table-card { overflow: hidden; }
.table-scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th {
  text-align: left; padding: 12px 14px; background: var(--surface-2); color: var(--muted);
  font-weight: 600; font-size: 11px; letter-spacing: .3px; border-bottom: 1px solid var(--line); white-space: nowrap;
}
td { padding: 12px 14px; border-bottom: 1px solid var(--line-2); color: var(--ink-2); white-space: nowrap; }
tbody tr { transition: background .14s; }
tbody tr:hover { background: #fafbff; }
tbody tr:last-child td { border-bottom: none; }
.idx-col { color: var(--muted-2); font-size: 11px; width: 44px; }
.op-col { text-align: right; }
.ro { color: var(--success); font-weight: 650; }
.empty { text-align: center; color: var(--muted-2); padding: 48px 20px; font-size: 13px; }

/* 分页 */
.pagination {
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
  padding: 13px 16px; border-top: 1px solid var(--line); background: var(--surface-2);
}
.page-info { font-size: 12px; color: var(--muted); }
.page-info b { color: var(--ink); font-weight: 600; }
.filtered-badge { margin-left: 8px; font-size: 10px; background: var(--primary-soft); color: var(--primary); padding: 2px 8px; border-radius: 10px; }
.page-controls { display: flex; align-items: center; gap: 5px; }
.page-size { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); margin-right: 8px; }
.page-size select { height: 30px; padding: 0 6px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink); font-size: 12px; }
.page-btn {
  min-width: 30px; height: 30px; padding: 0 8px; border: 1px solid var(--line); border-radius: 6px;
  background: var(--surface); color: var(--ink-2); cursor: pointer; font-size: 12px; transition: all .15s;
}
.page-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.page-btn:disabled { opacity: .4; cursor: not-allowed; }
.page-btn.active { background: var(--primary); border-color: var(--primary); color: #fff; font-weight: 600; }
.ellipsis { color: var(--muted-2); padding: 0 4px; }

/* 弹窗 */
.overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 60; }
.dialog { width: 660px; max-width: 92vw; max-height: 88vh; overflow-y: auto; padding: 24px 26px; box-shadow: var(--shadow-lg); }
.dialog-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.dialog-head h2 { font-size: 17px; font-weight: 650; }
.close { border: none; background: none; font-size: 18px; cursor: pointer; color: var(--muted); }
.close:hover { color: var(--danger); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.form-grid label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--ink-2); font-weight: 500; }
.form-grid label.wide { grid-column: 1 / -1; }
.form-grid em { color: var(--danger); font-style: normal; }
.form-grid input, .form-grid select, .form-grid textarea {
  height: 36px; padding: 0 11px; border: 1px solid var(--line); border-radius: var(--radius-sm);
  font-size: 13px; outline: none; transition: border-color .18s, box-shadow .18s;
}
.form-grid textarea { height: auto; padding: 9px 11px; resize: vertical; }
.form-grid input:focus, .form-grid select:focus, .form-grid textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
.dialog-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--line-2); }

@media (max-width: 900px) {
  .page-head { flex-direction: column; align-items: flex-start; gap: 14px; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
