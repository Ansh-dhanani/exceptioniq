export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const BASE_URL = API_BASE_URL.replace(/\/+$/, '');

export const client = {
  async get(path: string) {
    const res = await fetch(`${BASE_URL}${path}`, { credentials: 'include' });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.statusText}`);
    return res.json();
  },

  async post(path: string, body: any) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.detail || `POST ${path} failed`);
    }
    return res.json();
  },

  async delete(path: string) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error(`DELETE ${path} failed`);
    return res;
  },

  async patch(path: string, body: any) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.detail || `PATCH ${path} failed`);
    }
    return res.json();
  }
};
