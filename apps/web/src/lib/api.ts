import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// BUG-08 FIX: baca token dari Zustand store (localStorage) bukan sessionStorage
function getStoredTokens(): { accessToken: string | null; refreshToken: string | null } {
  if (typeof window === 'undefined') return { accessToken: null, refreshToken: null };
  try {
    const raw = localStorage.getItem('auth-store');
    if (!raw) return { accessToken: null, refreshToken: null };
    const parsed = JSON.parse(raw) as { state?: { accessToken?: string; refreshToken?: string } };
    return {
      accessToken: parsed.state?.accessToken ?? null,
      refreshToken: parsed.state?.refreshToken ?? null,
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

function setStoredAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('auth-store');
    if (!raw) return;
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    if (parsed.state) {
      parsed.state.accessToken = token;
      localStorage.setItem('auth-store', JSON.stringify(parsed));
    }
  } catch {
    // ignore
  }
}

function clearStoredAuth(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('auth-store');
    if (!raw) return;
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    if (parsed.state) {
      parsed.state.accessToken = null;
      parsed.state.refreshToken = null;
      parsed.state.user = null;
      parsed.state.isAuthenticated = false;
      localStorage.setItem('auth-store', JSON.stringify(parsed));
    }
  } catch {
    // ignore
  }
}

// Request interceptor — tambah token dari store
api.interceptors.request.use((config) => {
  const { accessToken } = getStoredTokens();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Response interceptor — auto refresh token
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { refreshToken } = getStoredTokens();
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        const newToken = data.data.accessToken as string;
        setStoredAccessToken(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        clearStoredAuth();
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
