const API_URL = 'http://localhost:4000';

async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
        const text = await res.text();
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
        try { return JSON.parse(text); } catch { throw new Error('Resposta não é JSON válido'); }
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na requisição');
    return data;
}

const Storage = {
    listUsers: () => request('/users'),
    listProducts: () => request('/products'),
    listCategories: () => request('/categories'),
    addCategory: (name) => request('/categories', { method: 'POST', body: JSON.stringify({ name }) }),
    deleteCategory: (name) => request(`/categories/${encodeURIComponent(name)}`, { method: 'DELETE' }),
    listComments: (productId) => request(`/comments${productId ? '?productId=' + encodeURIComponent(productId) : ''}`),
    postComment: (payload) => request('/comments', { method: 'POST', body: JSON.stringify(payload) }),
    deleteComment: (id) => request(`/comments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    reportComment: (payload) => request('/comment-reports', { method: 'POST', body: JSON.stringify(payload) }),
    listCommentReports: () => request('/comment-reports'),
    listNotifications: () => request('/notifications')
};

window.Storage = Storage;
