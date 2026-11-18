<script setup>
import { ref, computed, onMounted } from 'vue'
import { resource } from '../api'
import { modules } from '../config/modules'

const counts = ref({})
const sales = ref([])
const payrolls = ref([])
const purchases = ref([])
const specs = ref([])
const employees = ref([])
const loading = ref(true)
const errMsg = ref('')

async function load() {
  loading.value = true; errMsg.value = ''
  try {
    const results = await Promise.all(modules.map(m => resource(m.key).list().catch(() => ({ data: [] }))))
    modules.forEach((m, i) => { counts.value[m.key] = results[i].data.length })
    const byKey = k => results.find((_, i) => modules[i].key === k)?.data || []
    sales.value = byKey('sales-orders')
    payrolls.value = byKey('payrolls')
    purchases.value = byKey('purchase-orders')
    specs.value = byKey('product-specs')
    employees.value = byKey('employees')
  } catch (e) { errMsg.value = '加载概览失败：' + e.message }
  finally { loading.value = false }
}

const sum = (arr, key) => arr.reduce((a, r) => a + (Number(r[key]) || 0), 0)
const salesTotal = computed(() => sum(sales.value, 'totalAmount'))
const purchaseTotal = computed(() => sum(purchases.value, 'totalAmount'))
const wageTotal = computed(() => sum(payrolls.value, 'netPay'))
const grossProfit = computed(() => salesTotal.value - purchaseTotal.value - wageTotal.value)

const kpis = computed(() => [
  { label: '产品型号', value: specs.value.length, icon: '📦', from: '#6366f1', to: '#818cf8', hint: '已定义规格' },
  { label: '在职员工', value: employees.value.length, icon: '👷', from: '#0ea5e9', to: '#38bdf8', hint: '生产人员' },
  { label: '销售订单', value: sales.value.length, icon: '🧾', from: '#10b981', to: '#34d399', hint: '累计订单' },
  { label: '采购入库', value: purchases.value.length, icon: '🚚', from: '#f59e0b', to: '#fbbf24', hint: '入库批次' }
])

const recentSales = computed(() => [...sales.value].slice(0, 6))
const statusMap = { PENDING: ['待处理', 'tag-amber'], CONFIRMED: ['已确认', 'tag'], SHIPPED: ['已发货', 'tag-green'], COMPLETED: ['已完成', 'tag-green'] }
function statusOf(s) { return statusMap[s] || [s, 'tag-gray'] }
function fmt(n) { return Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

onMounted(load)
</script>

<template>
  <div class="dash">
    <div class="welcome">
      <div>
        <h1>经营概览</h1>
        <p>工厂生产与经营数据总览 · 前后端实时联通</p>
      </div>
      <button class="btn btn-ghost" @click="load" :disabled="loading">
        <span :class="{ spin: loading }">⟳</span> {{ loading ? '加载中' : '刷新数据' }}
      </button>
    </div>

    <div v-if="errMsg" class="msg err">{{ errMsg }}</div>

    <!-- KPI -->
    <div class="kpi-grid">
      <div v-for="k in kpis" :key="k.label" class="card kpi">
        <div class="kpi-icon" :style="{ background: `linear-gradient(135deg, ${k.from}, ${k.to})` }">{{ k.icon }}</div>
        <div class="kpi-info">
          <div class="kpi-label">{{ k.label }}</div>
          <div class="kpi-value">{{ k.value }}</div>
          <div class="kpi-hint">{{ k.hint }}</div>
        </div>
        <div class="kpi-glow" :style="{ background: k.from }"></div>
      </div>
    </div>

    <!-- 财务 -->
    <div class="section-title">经营指标 <span>金额单位：元</span></div>
    <div class="finance">
      <div class="card fin-card">
        <div class="fin-top"><span class="fin-ico income">¥</span><span>销售总额</span></div>
        <div class="fin-value up">¥ {{ fmt(salesTotal) }}</div>
        <div class="fin-bar"><i style="width:88%;background:#10b981"></i></div>
      </div>
      <div class="card fin-card">
        <div class="fin-top"><span class="fin-ico cost">↓</span><span>采购成本</span></div>
        <div class="fin-value">¥ {{ fmt(purchaseTotal) }}</div>
        <div class="fin-bar"><i style="width:62%;background:#f59e0b"></i></div>
      </div>
      <div class="card fin-card">
        <div class="fin-top"><span class="fin-ico wage">↗</span><span>人工成本</span></div>
        <div class="fin-value">¥ {{ fmt(wageTotal) }}</div>
        <div class="fin-bar"><i style="width:44%;background:#0ea5e9"></i></div>
      </div>
      <div class="card fin-card profit">
        <div class="fin-top"><span class="fin-ico">Σ</span><span>粗略毛利</span></div>
        <div class="fin-value">¥ {{ fmt(grossProfit) }}</div>
        <div class="fin-bar"><i style="width:70%;background:rgba(255,255,255,.55)"></i></div>
      </div>
    </div>
    <p class="note">* 毛利为演示口径：销售总额 − 采购总额 − 实发工资；精确分摊需业务规则确认。</p>

    <!-- 明细 -->
    <div class="panels">
      <div class="card panel">
        <div class="panel-head"><h2>模块数据量</h2><span class="panel-sub">点击进入管理</span></div>
        <div class="module-counts">
          <router-link v-for="m in modules" :key="m.key" :to="`/module/${m.key}`" class="mc">
            <span class="mc-icon">{{ m.icon }}</span>
            <span class="mc-name">{{ m.name }}</span>
            <b class="mc-num">{{ counts[m.key] ?? '-' }}</b>
          </router-link>
        </div>
      </div>

      <div class="card panel">
        <div class="panel-head"><h2>最近销售订单</h2><router-link to="/module/sales-orders" class="panel-sub link">查看全部 →</router-link></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>单号</th><th>客户</th><th>型号</th><th>数量</th><th>金额</th><th>状态</th></tr></thead>
            <tbody>
              <tr v-for="s in recentSales" :key="s.id">
                <td class="mono">#{{ s.id }}</td>
                <td>客户 #{{ s.customerId }}</td>
                <td>型号 #{{ s.specId }}</td>
                <td>{{ s.quantityKg }} kg</td>
                <td class="money">¥{{ fmt(s.totalAmount) }}</td>
                <td><span class="tag" :class="statusOf(s.status)[1]">{{ statusOf(s.status)[0] }}</span></td>
              </tr>
              <tr v-if="!recentSales.length"><td colspan="6" class="empty">暂无销售订单</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
.welcome h1 { font-size: 24px; font-weight: 700; letter-spacing: -.3px; }
.welcome p { color: var(--muted); font-size: 13px; margin-top: 5px; }
.spin { display: inline-block; animation: rot 1s linear infinite; }
@keyframes rot { to { transform: rotate(360deg); } }

.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 26px; }
.kpi { padding: 20px; display: flex; align-items: flex-start; gap: 15px; position: relative; overflow: hidden; }
.kpi-icon { width: 50px; height: 50px; border-radius: 13px; display: flex; align-items: center; justify-content: center; font-size: 23px; flex-shrink: 0; box-shadow: 0 6px 14px rgba(15,23,42,.12); }
.kpi-info { position: relative; z-index: 1; }
.kpi-label { color: var(--muted); font-size: 12px; font-weight: 500; }
.kpi-value { font-size: 30px; font-weight: 750; line-height: 1.15; margin-top: 3px; letter-spacing: -.5px; }
.kpi-hint { color: var(--muted-2); font-size: 11px; margin-top: 3px; }
.kpi-glow { position: absolute; right: -22px; top: -22px; width: 90px; height: 90px; border-radius: 50%; opacity: .06; filter: blur(2px); }

.section-title { font-size: 15px; font-weight: 650; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; }
.section-title span { font-size: 11px; color: var(--muted-2); font-weight: 400; }
.finance { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.fin-card { padding: 18px 20px; }
.fin-top { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
.fin-ico { width: 22px; height: 22px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; background: var(--surface-2); }
.fin-ico.income { color: var(--success); background: var(--success-soft); }
.fin-ico.cost { color: var(--warning); background: #fffbeb; }
.fin-ico.wage { color: #0284c7; background: #f0f9ff; }
.fin-value { font-size: 21px; font-weight: 700; margin: 10px 0 12px; letter-spacing: -.3px; }
.fin-value.up { color: var(--success); }
.fin-bar { height: 4px; border-radius: 4px; background: var(--line-2); overflow: hidden; }
.fin-bar i { display: block; height: 100%; border-radius: 4px; }
.fin-card.profit { background: linear-gradient(135deg, #4f46e5, #7c3aed); border-color: transparent; }
.fin-card.profit .fin-top, .fin-card.profit .fin-ico { color: rgba(255,255,255,.85); }
.fin-card.profit .fin-ico { background: rgba(255,255,255,.15); }
.fin-card.profit .fin-value { color: #fff; }
.fin-card.profit .fin-bar { background: rgba(255,255,255,.2); }
.note { color: var(--muted-2); font-size: 11px; margin: 10px 2px 24px; }

.panels { display: grid; grid-template-columns: 1fr 1.45fr; gap: 16px; }
.panel { padding: 20px; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.panel-head h2 { font-size: 15px; font-weight: 650; }
.panel-sub { font-size: 11px; color: var(--muted-2); }
.panel-sub.link { color: var(--primary); font-weight: 500; }
.module-counts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.mc { display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-radius: 9px; background: var(--surface-2); border: 1px solid transparent; transition: all .16s; }
.mc:hover { background: var(--primary-soft); border-color: #dfe4ff; transform: translateY(-1px); }
.mc-icon { width: 18px; text-align: center; font-size: 14px; }
.mc-name { flex: 1; font-size: 12px; color: var(--ink-2); }
.mc-num { font-size: 13px; color: var(--primary); font-weight: 700; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { text-align: left; padding: 9px 10px; color: var(--muted); font-size: 11px; font-weight: 500; background: var(--surface-2); border-radius: 6px; }
td { padding: 10px; border-bottom: 1px solid var(--line-2); color: var(--ink-2); }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover td { background: #fafbff; }
.mono { font-family: ui-monospace, monospace; color: var(--muted); }
.money { color: var(--success); font-weight: 600; }
.empty { text-align: center; color: var(--muted-2); padding: 30px; }

@media (max-width: 1100px) {
  .kpi-grid, .finance { grid-template-columns: repeat(2, 1fr); }
  .panels { grid-template-columns: 1fr; }
}
</style>
