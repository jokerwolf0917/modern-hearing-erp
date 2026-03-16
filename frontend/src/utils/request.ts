import { message } from 'antd';
import axios, { AxiosError } from 'axios';

const ACCESS_TOKEN_KEY = 'erp_access_token';
const EMPLOYEE_KEY = 'erp_employee';

export interface ApiValidationErrorItem {
  type?: string;
  loc?: Array<string | number>;
  msg?: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  detail?: string | ApiValidationErrorItem[];
  message?: string;
}

function isValidationErrorArray(value: unknown): value is ApiValidationErrorItem[] {
  return Array.isArray(value);
}

export function normalizeApiErrorMessage(payload: ApiErrorResponse | undefined, fallback: string): string {
  const detail = payload?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (isValidationErrorArray(detail) && detail.length > 0) {
    return detail
      .map((item) => item.msg?.trim())
      .filter((msg): msg is string => Boolean(msg))
      .join('；');
  }

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  return fallback;
}

export const request = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  timeout: 60_000,
});

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  async (error: AxiosError) => Promise.reject(error),
);

request.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const status = error.response?.status;

    if (status === 401) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(EMPLOYEE_KEY);
      message.error('登录状态已失效，请重新登录。');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else {
      message.error(normalizeApiErrorMessage(error.response?.data, '请求失败，请稍后重试。'));
    }

    return Promise.reject(error);
  },
);
