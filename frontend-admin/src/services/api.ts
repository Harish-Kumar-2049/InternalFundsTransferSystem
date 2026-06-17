import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
};

export const auditAPI = {
  getByUser: (userId: string) =>
    api.get(`/audit/user/${userId}`),

  getByTransaction: (transactionId: string) =>
    api.get(`/audit/transaction/${transactionId}`),
};

export const adminAPI = {
  deposit: (walletId: string, amount: number) =>
    api.post(`/admin/wallets/${walletId}/deposit?amount=${amount}`),

  lookupUserWallets: (query: string) =>
    api.get(`/admin/users/lookup?query=${query}`),
};

export const ledgerAPI = {
  getByWallet: (walletId: string) =>
    api.get(`/admin/ledger/wallet/${walletId}`),

  getByTransaction: (transactionId: string) =>
    api.get(`/admin/ledger/transaction/${transactionId}`),
};

export const reconcileAPI = {
  runAll: () =>
    api.post('/admin/reconcile'),

  verifyTransaction: (transactionId: string) =>
    api.get(`/admin/transactions/${transactionId}/verify`),
};

export const transactionHistoryAPI = {
  getAll: () =>
    api.get('/admin/transactions'),
};

export const allAuditAPI = {
  getAll: () =>
    api.get('/admin/audit'),
};

export default api;
