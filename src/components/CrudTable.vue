<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import * as XLSX from 'xlsx'
import { resource } from '../api'
import { findModule } from '../config/modules'
import AppSelect from './AppSelect.vue'

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

// 详情弹窗
const detailOpen = ref(false)
const detailRow = ref(null)

// Excel 导入
const importOpen = ref(false)
const importStep = ref('select')          // select | result
const importFile = ref(null)
const parsedRows = ref([])                // [{ no, raw, payload, display, errors, apiError }]
const importBusy = ref(false)             // 解析/构建外键映射中
const importing = ref(false)              // 提交中
const importErr = ref('')
const importResult = ref(null)            // { total, ok, failed, errors }
const refLookups = reactive({})           // 字段 key -> Map<文本, id>

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
  for (const f of optionFilterFields.value) filters[f.key] = ''
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

// ---------- Excel 导入 ----------
const validRows = computed(() => parsedRows.value.filter(r => !r.errors.length))
const failedParsedRows = computed(() => parsedRows.value.filter(r => r.errors.length || r.apiError))

function openImport() {
  importOpen.value = true
  importStep.value = 'select'
  importFile.value = null
  parsedRows.value = []
  importResult.value = null
  importErr.value = ''
  importBusy.value = false
  importing.value = false
}
function closeImport() {
  if (importing.value) return
  importOpen.value = false
}

// 中文表头 -> 字段配置；同时允许直接用字段 key 作为表头
const labelToField = computed(() => {
  const m = {}
  for (const f of formFields.value) {
    if (f.label) m[f.label] = f
    if (f.key) m[f.key] = f
  }
  return m
})

// 下载导入模板（表头 = 中文 label，附一行示例）
function downloadTemplate() {
  const sample = {}
  for (const f of formFields.value) {
    let v
    if (f.type === 'select') v = f.options?.[0]?.label ?? ''
    else if (f.type === 'ref') v = `__请填写${f.label}__`
    else if (f.type === 'date') v = '2026-01-01'
    else if (f.type === 'number') v = 0
    else v = f.label
    sample[f.label] = v
  }
  const ws = XLSX.utils.json_to_sheet([sample])
  ws['!cols'] = formFields.value.map(f => ({ wch: Math.max(12, Math.min(40, (f.label || '').length * 2 + 6)) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '导入模板')
  XLSX.writeFile(wb, `${mod.value.name}_导入模板.xlsx`)
}

// 外键文本 -> id 查找表：用显示值、code、orderNo、name、id 作为候选 key
async function buildRefLookups() {
  for (const k of Object.keys(refLookups)) delete refLookups[k]
  const refFields = formFields.value.filter(f => f.type === 'ref')
  await Promise.all(refFields.map(async f => {
    const map = new Map()
    try {
      const { data } = await resource(f.ref).list()
      for (const r of data || []) {
        for (const c of [r[f.refLabel], r.code, r.orderNo, r.name, r.id]) {
          if (c !== undefined && c !== null && c !== '') map.set(String(c).trim(), r.id)
        }
      }
    } catch (e) { /* 忽略单个外键加载失败，导入时按未找到处理 */ }
    refLookups[f.key] = map
  }))
}

// 日期归一：Date / Excel 序列号 / 字符串 -> yyyy-MM-dd
function normDate(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
  const d = new Date(s)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

// 单行转换 + 校验
function parseRow(raw, rowNo) {
  const payload = {}
  const display = {}
  const errors = []
  for (const f of formFields.value) {
    let v = raw[f.label]
    if (v === undefined) v = raw[f.key]
    const empty = v === undefined || v === null || (typeof v === 'string' && v.trim() === '')

    if (empty) {
      if (f.required) errors.push(`${f.label}：必填`)
      payload[f.key] = null
      display[f.label] = ''
      continue
    }

    if (f.type === 'number') {
      const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim())
      if (!Number.isFinite(n)) {
        errors.push(`${f.label}：不是有效数字`)
        payload[f.key] = null
        display[f.label] = String(v)
      } else {
        payload[f.key] = n
        display[f.label] = n
      }
    } else if (f.type === 'date') {
      const d = normDate(v)
      if (!d) {
        errors.push(`${f.label}：日期格式无效`)
        payload[f.key] = null
        display[f.label] = String(v)
      } else {
        payload[f.key] = d
        display[f.label] = d
      }
    } else if (f.type === 'select') {
      const sv = String(v).trim()
      const opts = f.options || []
      const opt = opts.find(o => String(o.label).trim() === sv || String(o.value).trim() === sv)
        || opts.find(o => String(o.label).trim().toLowerCase() === sv.toLowerCase())
      if (!opt) {
        errors.push(`${f.label}：无效选项「${sv}」（可选：${opts.map(o => o.label).join('/') || '无'}）`)
        payload[f.key] = null
        display[f.label] = sv
      } else {
        payload[f.key] = opt.value
        display[f.label] = opt.label
      }
    } else if (f.type === 'ref') {
      const sv = String(v).trim()
      const map = refLookups[f.key]
      let id = map ? map.get(sv) : undefined
      if (id === undefined && /^\d+$/.test(sv)) id = Number(sv)
      if (id === undefined) {
        errors.push(`${f.label}：找不到「${sv}」（请确认对应数据已导入，或填写其ID）`)
        payload[f.key] = null
        display[f.label] = sv
      } else {
        payload[f.key] = id
        display[f.label] = v
      }
    } else {
      const s = typeof v === 'string' ? v.trim() : String(v)
      payload[f.key] = s
      display[f.label] = s
    }
  }
  return { no: rowNo, raw, payload, display, errors, apiError: '' }
}

// 选择文件：读取 -> 解析 -> 预览
async function onImportFile(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // 允许重复选择同一文件
  if (!file) return
  if (!/\.xlsx?$/i.test(file.name)) { importErr.value = '仅支持 .xlsx / .xls 文件'; return }
  importFile.value = file
  importErr.value = ''
  importBusy.value = true
  parsedRows.value = []
  try {
    await buildRefLookups()
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) throw new Error('文件中没有工作表')
    const raws = XLSX.utils.sheet_to_json(ws, { defval: '' })
    if (!raws.length) throw new Error('文件中没有数据行')
    const normalized = raws.map(r => {
      const o = {}
      for (const k of Object.keys(r)) o[String(k).trim()] = r[k]
      return o
    })
    const first = normalized[0]
    const matched = formFields.value.filter(f => first[f.label] !== undefined || first[f.key] !== undefined).length
    if (!matched) throw new Error('表头与模板不匹配，请先点击「下载模板」并按模板表头填写')
    parsedRows.value = normalized.map((r, i) => parseRow(r, i + 2))
  } catch (err) {
    importErr.value = '解析失败：' + (err?.message || err)
  } finally {
    importBusy.value = false
  }
}

// 分批提交，收集成功/失败
async function runImport() {
  if (!validRows.value.length) { importErr.value = '没有可导入的有效数据行'; return }
  importing.value = true
  importErr.value = ''
  const list = validRows.value
  try {
    // 一次请求提交全部有效行，由后端批量落库并逐行返回结果
    const { data } = await api.value.importRows(list.map(r => r.payload))
    // 后端错误行号是提交列表的 1 基序号，映射回 Excel 行号
    for (const e of data.errors || []) {
      const target = list[e.row - 1]
      if (target) target.apiError = e.reason
    }
    const clientErrors = parsedRows.value.filter(r => r.errors.length)
      .map(r => ({ row: r.no, reason: r.errors.join('；') }))
    const serverErrors = (data.errors || []).map(e => ({
      row: list[e.row - 1]?.no ?? e.row,
      reason: e.reason
    }))
    importResult.value = {
      total: parsedRows.value.length,
      ok: data.success,
      failed: parsedRows.value.length - data.success,
      errors: [...clientErrors, ...serverErrors]
    }
    importStep.value = 'result'
    await load()
    await loadRefs()
  } catch (e) {
    importErr.value = '导入失败：' + (e.response?.data?.message || e.message)
  } finally {
    importing.value = false
  }
}

// 下载失败明细（原样列 + 失败原因）
function downloadImportErrors() {
  const data = failedParsedRows.value.map(r => {
    const o = { '行号': r.no, '失败原因': [r.errors.join('；'), r.apiError].filter(Boolean).join('；') }
    for (const f of formFields.value) o[f.label] = r.raw[f.label] ?? r.raw[f.key] ?? ''
    return o
  })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '导入失败明细')
  XLSX.writeFile(wb, `${mod.value.name}_导入失败明细_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

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
function openDetail(row) {
  detailRow.value = row
  detailOpen.value = true
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
onMounted(() => { resetFilters(); load(); loadRefs() })
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
        <button v-if="mod.importable" class="btn btn-import" @click="openImport">⇧ 导入 Excel</button>
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
        <AppSelect
          v-model="filters[f.key]"
          :options="[{ value: '', label: f.label + '：全部' }, ...optionsForFilter(f)]"
          size="sm"
        />
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
                <button class="row-btn" @click="openDetail(row)">详情</button>
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
          <span class="info-icon">≡</span>
          <span>共 <b>{{ filteredRows.length }}</b> 条</span>
          <span class="info-dot">·</span>
          <span>显示 <b>{{ rangeStart }}–{{ rangeEnd }}</b></span>
          <span v-if="filterActive" class="filtered-badge">已筛选 · 总 {{ rows.length }}</span>
        </div>
        <div class="page-controls">
          <label class="page-size">
            <span>每页</span>
            <AppSelect
              v-model="pageSize"
              :options="pageSizes.map(s => ({ value: s, label: String(s) }))"
              size="xs"
              placement="top"
              @update:modelValue="onPageSizeChange"
            />
            <span>条</span>
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
          <div class="dialog-title">
            <span class="dialog-icon">✎</span>
            <div>
              <h2>{{ editingId ? '编辑' : '新增' }}{{ mod.name }}</h2>
              <p>{{ mod.desc }}</p>
            </div>
          </div>
          <button class="close" @click="dialogOpen = false" aria-label="关闭">✕</button>
        </div>
        <form @submit.prevent="submit">
          <div class="form-body">
            <div class="form-grid">
              <label v-for="f in formFields" :key="f.key" :class="{ wide: f.type === 'textarea' }">
                <span>{{ f.label }} <em v-if="f.required">*</em></span>
                <AppSelect v-if="f.type === 'select'" v-model="form[f.key]" :options="f.options" size="md" />
                <AppSelect v-else-if="f.type === 'ref'" v-model="form[f.key]" :options="refOptions[f.key] || []" placeholder="-- 请选择 --" size="md" />
                <textarea v-else-if="f.type === 'textarea'" v-model="form[f.key]" rows="3"></textarea>
                <input v-else :type="f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'"
                       v-model="form[f.key]" :placeholder="f.placeholder || ''" :step="f.type === 'number' ? '0.0001' : undefined" />
              </label>
            </div>
          </div>
          <div class="dialog-foot">
            <button type="button" class="btn btn-ghost" @click="dialogOpen = false">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="submitting">{{ submitting ? '保存中…' : '保存' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 导入 Excel 弹窗 -->
    <div v-if="importOpen" class="overlay" @click.self="closeImport">
      <div class="dialog card import-dialog">
        <div class="dialog-head">
          <div class="dialog-title">
            <span class="dialog-icon import">⇧</span>
            <div>
              <h2>{{ importStep === 'result' ? '导入结果' : `导入${mod.name}` }}</h2>
              <p>{{ importStep === 'result' ? '本次导入的处理情况' : '从 Excel 批量录入数据' }}</p>
            </div>
          </div>
          <button class="close" @click="closeImport" aria-label="关闭">✕</button>
        </div>

        <div class="import-body">
        <template v-if="importStep === 'select'">
          <div class="import-guide">
            <div class="guide-steps">
              <div class="guide-step"><span class="step-no">1</span><span>下载模板</span></div>
              <span class="step-arrow">›</span>
              <div class="guide-step"><span class="step-no">2</span><span>填写并选择文件</span></div>
              <span class="step-arrow">›</span>
              <div class="guide-step"><span class="step-no">3</span><span>开始导入</span></div>
            </div>
            <p class="guide-note">下拉/单选列请填显示文字（如「启用」「塑胶松针」）；外键列请填名称；空行会被跳过。</p>
            <button type="button" class="btn btn-ghost btn-sm" @click="downloadTemplate">⇩ 下载导入模板</button>
          </div>
          <div class="import-file">
            <label class="file-pick" :class="{ 'has-file': importFile }">
              <input type="file" accept=".xlsx,.xls" @change="onImportFile" :disabled="importBusy || importing" />
              <span class="file-pick-icon">{{ importFile ? '✓' : '⇧' }}</span>
              <span class="file-pick-text">
                <b>{{ importFile ? importFile.name : '点击选择 Excel 文件' }}</b>
                <small>{{ importFile ? '文件已就绪，可开始导入' : '支持 .xlsx / .xls 格式' }}</small>
              </span>
            </label>
            <span v-if="importBusy" class="muted">解析中…</span>
          </div>
          <div v-if="importErr" class="msg err">{{ importErr }}</div>
          <div v-if="parsedRows.length" class="import-preview">
            <div class="import-summary">
              共解析 <b>{{ parsedRows.length }}</b> 行，有效 <b class="ok">{{ validRows.length }}</b> 行，
              待修正 <b class="bad">{{ parsedRows.length - validRows.length }}</b> 行（仅展示前 5 行）
            </div>
            <div class="table-scroll">
              <table class="preview-table">
                <thead>
                  <tr><th class="no-col">行号</th><th v-for="f in formFields" :key="f.key" :title="f.label">{{ f.label }}</th><th class="check-col">校验</th></tr>
                </thead>
                <tbody>
                  <tr v-for="r in parsedRows.slice(0, 5)" :key="r.no" :class="{ 'row-bad': r.errors.length }">
                    <td class="no-col">{{ r.no }}</td>
                    <td v-for="f in formFields" :key="f.key" :title="r.display[f.label]">{{ r.display[f.label] }}</td>
                    <td class="check-col" :title="r.errors.join('；')">{{ r.errors.length ? r.errors.join('；') : 'OK' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="dialog-foot">
            <button type="button" class="btn btn-ghost" @click="closeImport">取消</button>
            <button type="button" class="btn btn-primary" :disabled="importing || !validRows.length" @click="runImport">
              {{ importing ? '导入中…' : `开始导入${validRows.length ? `（${validRows.length} 行）` : ''}` }}
            </button>
          </div>
        </template>

        <template v-else>
          <div class="import-result">
            <div class="result-cards">
              <div class="result-card"><span class="result-ico">≡</span><span>总行数</span><b>{{ importResult.total }}</b></div>
              <div class="result-card success"><span class="result-ico">✓</span><span>导入成功</span><b>{{ importResult.ok }}</b></div>
              <div class="result-card fail"><span class="result-ico">!</span><span>失败/跳过</span><b>{{ importResult.failed }}</b></div>
            </div>
            <div v-if="importResult.errors.length" class="error-list">
              <h4>失败明细</h4>
              <ul><li v-for="(e, i) in importResult.errors" :key="i"><span class="err-row">第 {{ e.row }} 行</span>{{ e.reason }}</li></ul>
            </div>
            <div v-else class="all-ok">全部导入成功</div>
          </div>
          <div class="dialog-foot">
            <button v-if="importResult.failed" type="button" class="btn btn-ghost" @click="downloadImportErrors">⇩ 下载失败明细</button>
            <button type="button" class="btn btn-primary" @click="closeImport">完成</button>
          </div>
        </template>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="detailOpen && detailRow" class="overlay" @click.self="detailOpen = false">
      <div class="dialog card detail-dialog">
        <div class="dialog-head">
          <div class="dialog-title">
            <span class="dialog-icon detail">👁</span>
            <div>
              <h2>{{ mod.name }}详情</h2>
              <p>记录 #{{ detailRow.id }}</p>
            </div>
          </div>
          <button class="close" @click="detailOpen = false" aria-label="关闭">✕</button>
        </div>
        <div class="detail-body">
          <div class="detail-grid">
            <div v-for="f in mod.fields" :key="f.key" class="detail-item" :class="{ wide: f.type === 'textarea' }">
              <span class="detail-label">{{ f.label }}</span>
              <span class="detail-value" :class="{ ro: f.type === 'readonly' }">{{ display(detailRow, f) }}</span>
            </div>
          </div>
          <div class="detail-meta">
            <span>创建时间：{{ detailRow.createdAt || '-' }}</span>
            <span>更新时间：{{ detailRow.updatedAt || '-' }}</span>
          </div>
        </div>
        <div class="dialog-foot">
          <button type="button" class="btn btn-ghost" @click="detailOpen = false">关闭</button>
          <button type="button" class="btn btn-primary" @click="detailOpen = false; openEdit(detailRow)">编辑此条</button>
        </div>
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
.filter-item input { height: 34px; padding: 0 11px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); outline: none; font-size: 12px; }
.filter-item input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,.1); }
.filter-item .app-select { width: 142px; }
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
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;
  padding: 14px 18px; border-top: 1px solid var(--line);
  background: linear-gradient(180deg, #fff 0%, var(--surface-2) 100%);
}
.page-info { display: flex; align-items: center; gap: 9px; font-size: 12.5px; color: var(--muted); }
.info-icon {
  width: 26px; height: 26px; border-radius: 8px; background: var(--primary-soft); color: var(--primary);
  display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700;
}
.page-info b { color: var(--ink); font-weight: 650; }
.info-dot { color: #94a3b8; font-weight: 700; }
.filtered-badge {
  margin-left: 2px; font-size: 11px; font-weight: 500; background: #fffbeb; color: #b45309;
  border: 1px solid #fde68a; padding: 3px 10px; border-radius: 20px;
}
.page-controls { display: flex; align-items: center; gap: 6px; }
.page-size {
  display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--muted);
  background: var(--surface); border: 1px solid var(--line); padding: 4px 8px 4px 11px;
  border-radius: 9px; margin-right: 6px;
}
.page-size .app-select { min-width: 0; }
.page-btn {
  min-width: 32px; height: 32px; padding: 0 8px; border: 1px solid var(--line); border-radius: 9px;
  background: var(--surface); color: var(--ink-2); cursor: pointer; font-size: 13px; font-weight: 500;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04); transition: all .15s;
}
.page-btn:hover:not(:disabled) { border-color: #c7d2fe; background: var(--primary-soft); color: var(--primary); }
.page-btn:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }
.page-btn.active {
  background: linear-gradient(135deg, #6366f1, #4f46e5); border-color: transparent; color: #fff;
  font-weight: 600; box-shadow: 0 3px 10px rgba(79, 70, 229, .3);
}
.ellipsis { color: var(--muted-2); padding: 0 3px; }

/* 弹窗通用 */
.overlay {
  position: fixed; inset: 0; background: rgba(15,23,42,.55); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 60; padding: 20px;
}
.dialog {
  width: 680px; max-width: 100%; max-height: 90vh; overflow-y: auto;
  border-radius: 18px; border: 1px solid rgba(255,255,255,.7);
  box-shadow: 0 24px 60px rgba(15,23,42,.24), 0 4px 12px rgba(15,23,42,.08);
  background: #fff;
}
.dialog-head {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
  padding: 22px 26px 20px; border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, #fff 0%, #fafbff 100%);
}
.dialog-title { display: flex; align-items: center; gap: 13px; }
.dialog-icon {
  width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 19px; color: #fff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 4px 12px rgba(99,102,241,.3);
}
.dialog-icon.import { background: linear-gradient(135deg, #0ea5e9, #6366f1); box-shadow: 0 4px 12px rgba(14,165,233,.3); }
.dialog-icon.detail { background: linear-gradient(135deg, #0ea5e9, #14b8a6); box-shadow: 0 4px 12px rgba(20,184,166,.3); }

/* 详情弹窗 */
.detail-dialog { width: 720px; }
.detail-body { padding: 22px 26px; background: #fbfcfe; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 18px; }
.detail-item {
  display: flex; flex-direction: column; gap: 6px; padding: 11px 13px;
  background: #fff; border: 1px solid var(--line); border-radius: 10px;
  box-shadow: 0 1px 2px rgba(15,23,42,.03);
}
.detail-item.wide { grid-column: 1 / -1; }
.detail-label { font-size: 11px; color: var(--muted); font-weight: 600; }
.detail-value { font-size: 13.5px; color: var(--ink); font-weight: 500; word-break: break-all; line-height: 1.5; }
.detail-value.ro { color: var(--success); font-weight: 650; }
.detail-meta {
  display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  margin-top: 16px; padding-top: 14px; border-top: 1px dashed var(--line);
  font-size: 11px; color: var(--muted);
}
.dialog-head h2 { font-size: 18px; font-weight: 700; color: var(--ink); letter-spacing: .2px; }
.dialog-head p { font-size: 12px; color: var(--muted); margin-top: 4px; }
.close {
  width: 32px; height: 32px; border-radius: 9px; border: 1px solid var(--line); background: #fff;
  font-size: 13px; color: var(--muted); cursor: pointer; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; transition: all .15s;
}
.close:hover { background: var(--danger-soft); color: var(--danger); border-color: #fecdd3; }
.dialog-foot {
  display: flex; justify-content: flex-end; align-items: center; gap: 10px;
  padding: 16px 26px; border-top: 1px solid var(--line); background: #f8fafc;
}
.dialog-foot .btn { min-width: 88px; height: 38px; }
.dialog-foot .btn-primary { min-width: 106px; }

/* 表单 */
.form-body { padding: 24px 26px; background: #fbfcfe; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 20px; }
.form-grid label { display: flex; flex-direction: column; gap: 8px; font-size: 12.5px; color: #475569; font-weight: 600; }
.form-grid label.wide { grid-column: 1 / -1; }
.form-grid em { color: var(--danger); font-style: normal; }
.form-grid input, .form-grid textarea {
  height: 40px; padding: 0 13px; border: 1px solid #e2e8f0; border-radius: 9px;
  background: #fff; font-size: 13.5px; color: var(--ink); outline: none;
  transition: border-color .18s, box-shadow .18s;
}
.form-grid .app-select { display: block; width: 100%; }
.form-grid textarea { height: auto; min-height: 84px; padding: 11px 13px; resize: vertical; line-height: 1.6; }
.form-grid input::placeholder, .form-grid textarea::placeholder { color: #b6c0cd; }
.form-grid input:hover, .form-grid textarea:hover { border-color: #cbd5e1; }
.form-grid input:focus, .form-grid textarea:focus {
  border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,.12);
}

/* 导入弹窗 */
.import-dialog { width: 800px; }
.import-body { padding: 22px 26px; background: #fbfcfe; }
.import-guide {
  background: #fff; border: 1px solid var(--line); border-radius: 12px;
  padding: 15px 17px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(15,23,42,.03);
}
.guide-steps { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.guide-step { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: var(--ink-2); }
.step-no {
  width: 21px; height: 21px; border-radius: 50%; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6);
}
.step-arrow { color: #cbd5e1; font-size: 18px; line-height: 1; }
.guide-note { font-size: 12px; color: var(--muted); margin: 11px 0 13px; line-height: 1.7; }
.import-file { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.file-pick {
  display: inline-flex; align-items: center; gap: 12px; min-width: 300px;
  padding: 12px 16px; border: 1px dashed #c7d2fe; border-radius: 11px;
  background: #fff; cursor: pointer; transition: all .16s;
}
.file-pick:hover { border-color: var(--primary); background: var(--primary-soft); }
.file-pick.has-file { border-style: solid; border-color: #a7f3d0; background: var(--success-soft); }
.file-pick input { display: none; }
.file-pick-icon {
  width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 16px;
  background: var(--primary-soft); color: var(--primary);
}
.file-pick.has-file .file-pick-icon { background: #d1fae5; color: var(--success); }
.file-pick-text { display: flex; flex-direction: column; gap: 2px; }
.file-pick-text b { font-size: 13px; color: var(--ink); font-weight: 600; }
.file-pick-text small { font-size: 11px; color: var(--muted); }
.muted { color: var(--muted); font-size: 12px; }
.import-preview { border: 1px solid var(--line); border-radius: 11px; overflow: hidden; background: #fff; }
.import-summary {
  padding: 10px 14px; background: var(--surface-2); font-size: 12px; color: var(--muted);
  border-bottom: 1px solid var(--line);
}
.import-summary b { color: var(--ink); }
.import-summary b.ok { color: var(--success); }
.import-summary b.bad { color: var(--danger); }
.preview-table { font-size: 12px; width: 100%; table-layout: fixed; }
.preview-table th, .preview-table td { padding: 9px 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.preview-table th { background: #fff; }
.preview-table .no-col { width: 52px; }
.preview-table .check-col { width: 230px; color: var(--muted); font-size: 11px; }
.preview-table tr.row-bad { background: var(--danger-soft); }
.preview-table tr.row-bad .check-col { color: var(--danger); }
.import-result { min-height: 140px; }
.result-cards { display: flex; gap: 14px; margin-bottom: 20px; }
.result-card {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 20px 14px;
  background: #fff; border: 1px solid var(--line); border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15,23,42,.03);
}
.result-ico {
  width: 28px; height: 28px; border-radius: 8px; margin-bottom: 3px;
  display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700;
  background: var(--primary-soft); color: var(--primary);
}
.result-card.success .result-ico { background: var(--success-soft); color: var(--success); }
.result-card.fail .result-ico { background: var(--danger-soft); color: var(--danger); }
.result-card span:not(.result-ico) { font-size: 12px; color: var(--muted); }
.result-card b { font-size: 28px; font-weight: 700; color: var(--ink); }
.result-card.success b { color: var(--success); }
.result-card.fail b { color: var(--danger); }
.error-list { background: #fff; border: 1px solid var(--line); border-radius: 11px; padding: 14px 16px; }
.error-list h4 { font-size: 13px; margin-bottom: 10px; color: var(--ink-2); }
.error-list ul { margin: 0; padding: 0; list-style: none; max-height: 220px; overflow-y: auto; }
.error-list li {
  font-size: 12px; color: var(--ink-2); line-height: 1.6; padding: 8px 10px; margin-bottom: 6px;
  background: var(--danger-soft); border-left: 3px solid var(--danger); border-radius: 6px;
}
.err-row { color: var(--danger); font-weight: 700; margin-right: 8px; }
.all-ok {
  text-align: center; padding: 44px; color: var(--success); font-size: 15px; font-weight: 600;
  background: #fff; border: 1px solid var(--line); border-radius: 12px;
}

@media (max-width: 900px) {
  .page-head { flex-direction: column; align-items: flex-start; gap: 14px; }
  .form-grid, .detail-grid { grid-template-columns: 1fr; }
  .result-cards { flex-direction: column; }
}
</style>
