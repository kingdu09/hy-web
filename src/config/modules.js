// 13 个业务模块的字段配置，驱动通用 CRUD 页面
// type: text | number | date | textarea | select | ref | readonly
// list: 是否在表格显示；form: 是否在表单显示；ref: 外键关联的资源 key
// importable: 是否显示「导入 Excel」按钮（按业务模块开关）

const status01 = [
  { value: 1, label: '启用' },
  { value: 0, label: '停用' }
]

export const modules = [
  {
    key: 'product-specs', name: '产品型号', icon: '📦', group: '基础资料', importable: true,
    desc: '松针/布料的规格型号定义',
    fields: [
      { key: 'code', label: '型号编码', type: 'text', list: true, form: true, required: true },
      { key: 'name', label: '型号名称', type: 'text', list: true, form: true, required: true },
      { key: 'category', label: '类别', type: 'select', list: true, form: true, options: [{ value: 'NEEDLE', label: '塑胶松针' }, { value: 'FABRIC', label: '塑胶布料' }] },
      { key: 'unit', label: '单位', type: 'text', list: false, form: true, default: 'kg' },
      { key: 'salePrice', label: '销售单价(元/kg)', type: 'number', list: true, form: true },
      { key: 'description', label: '备注', type: 'text', list: false, form: true },
      { key: 'status', label: '状态', type: 'select', list: true, form: true, options: status01, default: 1 }
    ]
  },
  {
    key: 'raw-materials', name: '原料管理', icon: '🧪', group: '基础资料', importable: true,
    desc: '生产所需塑胶原料及库存',
    fields: [
      { key: 'name', label: '原料名称', type: 'text', list: true, form: true, required: true },
      { key: 'unit', label: '单位', type: 'text', list: false, form: true, default: 'kg' },
      { key: 'purchasePrice', label: '采购单价(元/kg)', type: 'number', list: true, form: true },
      { key: 'stockKg', label: '当前库存(kg)', type: 'number', list: true, form: true },
      { key: 'description', label: '备注', type: 'text', list: false, form: true },
      { key: 'status', label: '状态', type: 'select', list: true, form: true, options: status01, default: 1 }
    ]
  },
  {
    key: 'suppliers', name: '供应商', icon: '🚚', group: '基础资料', importable: true,
    desc: '原料供应商信息',
    fields: [
      { key: 'name', label: '供应商名称', type: 'text', list: true, form: true, required: true },
      { key: 'contactPerson', label: '联系人', type: 'text', list: true, form: true },
      { key: 'phone', label: '联系电话', type: 'text', list: true, form: true },
      { key: 'address', label: '地址', type: 'text', list: false, form: true },
      { key: 'status', label: '状态', type: 'select', list: true, form: true, options: status01, default: 1 }
    ]
  },
  {
    key: 'customers', name: '客户管理', icon: '🏢', group: '基础资料', importable: true,
    desc: '购买松针/布料的客户',
    fields: [
      { key: 'name', label: '客户名称', type: 'text', list: true, form: true, required: true },
      { key: 'contactPerson', label: '联系人', type: 'text', list: true, form: true },
      { key: 'phone', label: '联系电话', type: 'text', list: true, form: true },
      { key: 'address', label: '地址', type: 'text', list: false, form: true },
      { key: 'status', label: '状态', type: 'select', list: true, form: true, options: status01, default: 1 }
    ]
  },
  {
    key: 'employees', name: '员工管理', icon: '👷', group: '基础资料', importable: true,
    desc: '工厂员工基本信息',
    fields: [
      { key: 'name', label: '姓名', type: 'text', list: true, form: true, required: true },
      { key: 'phone', label: '手机号', type: 'text', list: true, form: true },
      { key: 'position', label: '职位/工种', type: 'text', list: true, form: true },
      { key: 'baseSalary', label: '基本工资(元/月)', type: 'number', list: true, form: true },
      { key: 'hireDate', label: '入职日期', type: 'date', list: true, form: true },
      { key: 'status', label: '状态', type: 'select', list: true, form: true, options: [{ value: 1, label: '在职' }, { value: 0, label: '离职' }], default: 1 }
    ]
  },
  {
    key: 'production-orders', name: '生产工单', icon: '🏭', group: '生产管理', importable: true,
    desc: '每天安排的生产任务',
    fields: [
      { key: 'orderNo', label: '工单编号', type: 'text', list: true, form: true, required: true },
      { key: 'specId', label: '产品型号', type: 'ref', ref: 'product-specs', refLabel: 'name', list: true, form: true, required: true },
      { key: 'planQuantityKg', label: '计划产量(kg)', type: 'number', list: true, form: true },
      { key: 'actualQuantityKg', label: '实际产量(kg)', type: 'number', list: true, form: true },
      { key: 'productionDate', label: '生产日期', type: 'date', list: true, form: true },
      { key: 'status', label: '状态', type: 'select', list: true, form: true, options: [{ value: 'PLANNED', label: '计划' }, { value: 'IN_PROGRESS', label: '生产中' }, { value: 'COMPLETED', label: '已完成' }], default: 'PLANNED' },
      { key: 'remark', label: '备注', type: 'text', list: false, form: true }
    ]
  },
  {
    key: 'work-reports', name: '报工记录', icon: '📝', group: '生产管理', importable: true,
    desc: '工人每天的产量（计件工资依据）',
    fields: [
      { key: 'orderId', label: '生产工单', type: 'ref', ref: 'production-orders', refLabel: 'orderNo', list: true, form: true, required: true },
      { key: 'employeeId', label: '员工', type: 'ref', ref: 'employees', refLabel: 'name', list: true, form: true, required: true },
      { key: 'reportDate', label: '报工日期', type: 'date', list: true, form: true },
      { key: 'outputKg', label: '产出重量(kg)', type: 'number', list: true, form: true },
      { key: 'remark', label: '备注', type: 'text', list: false, form: true }
    ]
  },
  {
    key: 'purchase-orders', name: '采购入库', icon: '🛒', group: '采购管理', importable: true,
    desc: '原料进货的重量和价格',
    fields: [
      { key: 'materialId', label: '原料', type: 'ref', ref: 'raw-materials', refLabel: 'name', list: true, form: true, required: true },
      { key: 'supplierId', label: '供应商', type: 'ref', ref: 'suppliers', refLabel: 'name', list: false, form: true },
      { key: 'quantityKg', label: '采购重量(kg)', type: 'number', list: true, form: true },
      { key: 'unitPrice', label: '采购单价(元/kg)', type: 'number', list: true, form: true },
      { key: 'totalAmount', label: '总金额', type: 'readonly', list: true, form: false },
      { key: 'purchaseDate', label: '采购日期', type: 'date', list: true, form: true },
      { key: 'remark', label: '备注', type: 'text', list: false, form: true }
    ]
  },
  {
    key: 'sales-orders', name: '销售订单', icon: '💰', group: '销售管理', importable: true,
    desc: '客户订购松针/布料的订单',
    fields: [
      { key: 'customerId', label: '客户', type: 'ref', ref: 'customers', refLabel: 'name', list: true, form: true, required: true },
      { key: 'specId', label: '产品型号', type: 'ref', ref: 'product-specs', refLabel: 'name', list: true, form: true, required: true },
      { key: 'quantityKg', label: '订购数量(kg)', type: 'number', list: true, form: true },
      { key: 'unitPrice', label: '销售单价(元/kg)', type: 'number', list: true, form: true },
      { key: 'totalAmount', label: '总金额', type: 'readonly', list: true, form: false },
      { key: 'orderDate', label: '下单日期', type: 'date', list: true, form: true },
      { key: 'deliveryDate', label: '交货日期', type: 'date', list: false, form: true },
      { key: 'status', label: '状态', type: 'select', list: true, form: true, options: [{ value: 'PENDING', label: '待处理' }, { value: 'CONFIRMED', label: '已确认' }, { value: 'SHIPPED', label: '已发货' }, { value: 'COMPLETED', label: '已完成' }], default: 'PENDING' },
      { key: 'remark', label: '备注', type: 'text', list: false, form: true }
    ]
  },
  {
    key: 'delivery-notes', name: '出货单', icon: '📤', group: '销售管理', importable: true,
    desc: '实际发给客户的货物记录',
    fields: [
      { key: 'salesOrderId', label: '销售订单', type: 'ref', ref: 'sales-orders', refLabel: 'id', list: true, form: true, required: true },
      { key: 'deliveryDate', label: '出货日期', type: 'date', list: true, form: true },
      { key: 'quantityKg', label: '出货重量(kg)', type: 'number', list: true, form: true },
      { key: 'unitPrice', label: '出货单价(元/kg)', type: 'number', list: true, form: true },
      { key: 'totalAmount', label: '总金额', type: 'readonly', list: true, form: false },
      { key: 'remark', label: '备注', type: 'text', list: false, form: true }
    ]
  },
  {
    key: 'shift-schedules', name: '排班管理', icon: '🗓️', group: '人事薪酬', importable: true,
    desc: '每天谁上什么班',
    fields: [
      { key: 'employeeId', label: '员工', type: 'ref', ref: 'employees', refLabel: 'name', list: true, form: true, required: true },
      { key: 'scheduleDate', label: '排班日期', type: 'date', list: true, form: true },
      { key: 'shiftType', label: '班次', type: 'select', list: true, form: true, options: [{ value: 'MORNING', label: '早班' }, { value: 'AFTERNOON', label: '中班' }, { value: 'NIGHT', label: '晚班' }] },
      { key: 'workHours', label: '工作时长(h)', type: 'number', list: true, form: true, default: 8 },
      { key: 'overtimeHours', label: '加班时长(h)', type: 'number', list: true, form: true, default: 0 },
      { key: 'remark', label: '备注', type: 'text', list: false, form: true }
    ]
  },
  {
    key: 'piece-rates', name: '计件单价', icon: '💵', group: '人事薪酬', importable: true,
    desc: '每种产品各工序的计件工资单价',
    fields: [
      { key: 'specId', label: '产品型号', type: 'ref', ref: 'product-specs', refLabel: 'name', list: true, form: true, required: true },
      { key: 'processName', label: '工序名称', type: 'text', list: true, form: true, required: true },
      { key: 'unitPrice', label: '计件单价(元/kg)', type: 'number', list: true, form: true },
      { key: 'effectiveDate', label: '生效日期', type: 'date', list: false, form: true },
      { key: 'status', label: '状态', type: 'select', list: true, form: true, options: status01, default: 1 }
    ]
  },
  {
    key: 'payrolls', name: '工资月报', icon: '🧾', group: '人事薪酬', importable: true,
    desc: '每月员工工资汇总',
    fields: [
      { key: 'employeeId', label: '员工', type: 'ref', ref: 'employees', refLabel: 'name', list: true, form: true, required: true },
      { key: 'salaryMonth', label: '工资月份', type: 'text', list: true, form: true, required: true, placeholder: '如 2026-11' },
      { key: 'pieceWage', label: '计件工资', type: 'number', list: true, form: true },
      { key: 'overtimePay', label: '加班费', type: 'number', list: true, form: true },
      { key: 'deductions', label: '扣款', type: 'number', list: true, form: true },
      { key: 'netPay', label: '实发工资', type: 'readonly', list: true, form: false },
      { key: 'status', label: '状态', type: 'select', list: true, form: true, options: [{ value: 'UNPAID', label: '未发放' }, { value: 'PAID', label: '已发放' }], default: 'UNPAID' },
      { key: 'remark', label: '备注', type: 'text', list: false, form: true }
    ]
  }
]

export const moduleGroups = ['基础资料', '生产管理', '采购管理', '销售管理', '人事薪酬']

export function findModule(key) {
  return modules.find(m => m.key === key)
}
