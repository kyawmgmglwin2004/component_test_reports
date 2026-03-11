// src/services/api.ts
export {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiPostBlob,
  HttpError,
} from './http';

// (Optional) add domain-specific wrappers later, e.g.:
// export const getDashboard = () => apiGet<DashboardDTO>('/dashboard');
