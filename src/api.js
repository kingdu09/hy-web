import axios from 'axios'

// 后端 hy-server 地址；Vite dev server 运行在 5173，由后端 CORS 放行
const api = axios.create({
  baseURL: 'http://localhost:8080/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

// 通用资源 API：传入模块 key 即可获得该资源的 CRUD 方法
export function resource(key) {
  return {
    list: () => api.get(`/${key}`),
    get: (id) => api.get(`/${key}/${id}`),
    create: (data) => api.post(`/${key}`, data),
    importRows: (rows) => api.post(`/${key}/import`, rows),
    update: (id, data) => api.put(`/${key}/${id}`, data),
    remove: (id) => api.delete(`/${key}/${id}`)
  }
}

export default api
