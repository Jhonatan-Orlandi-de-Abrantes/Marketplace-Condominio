// storage.js - Adapter para API em Node.js
// Substitui o uso de localStorage por chamadas HTTP (fetch)

const API_URL = "http://localhost:4000"; // ajuste se rodar em outra porta/servidor

window.Storage = (() => {
    // Helper para requisições
    async function request(path, options = {}) {
        const token = localStorage.getItem("token");
        const headers = {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };
        const res = await fetch(`${API_URL}${path}`, { ...options, headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro na requisição");
        return data;
    }

    // Auth
    async function register(user) {
        const res = await request("/register", {
            method: "POST",
            body: JSON.stringify(user)
        });
        localStorage.setItem("token", res.token);
        return res;
    }

    async function login(email, password) {
        const res = await request("/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });
        localStorage.setItem("token", res.token);
        localStorage.setItem("user", JSON.stringify(res.user));
        return res.user;
    }

    async function me() {
        return await request("/me");
    }

    async function updateProfile(profile) {
        return await request("/me", {
            method: "PATCH",
            body: JSON.stringify(profile)
        });
    }

    async function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
    }

    // Produtos
    async function createProduct(product) {
        return await request("/products", {
            method: "POST",
            body: JSON.stringify(product)
        });
    }

    async function listProducts(query = {}) {
        const params = new URLSearchParams(query).toString();
        return await request(`/products?${params}`);
    }

    async function getProduct(id) {
        return await request(`/products/${id}`);
    }

    async function markSold(id) {
        return await request(`/products/${id}/sold`, { method: "POST" });
    }

    // Comentários
    async function addComment(productId, text) {
        return await request(`/products/${productId}/comments`, {
            method: "POST",
            body: JSON.stringify({ text })
        });
    }

    async function listComments(productId) {
        return await request(`/products/${productId}/comments`);
    }

    // Denúncias
    async function reportProduct(productId, text) {
        return await request(`/products/${productId}/reports`, {
            method: "POST",
            body: JSON.stringify({ text })
        });
    }

    // Categorias
    async function listCategories() {
        return await request("/categories");
    }

    async function addCategory(name) {
        return await request("/categories", {
            method: "POST",
            body: JSON.stringify({ name })
        });
    }

    async function removeCategory(name) {
        return await request(`/categories/${name}`, { method: "DELETE" });
    }

    // Admin
    async function listRequests() {
        return await request("/admin/requests");
    }

    async function approveRequest(id) {
        return await request(`/admin/requests/${id}/approve`, { method: "POST" });
    }

    async function rejectRequest(id, message) {
        return await request(`/admin/requests/${id}/reject`, {
            method: "POST",
            body: JSON.stringify({ message })
        });
    }

    async function listReports() {
        return await request("/admin/reports");
    }

    async function approveReport(id) {
        return await request(`/admin/reports/${id}/approve`, { method: "POST" });
    }

    async function rejectReport(id) {
        return await request(`/admin/reports/${id}/reject`, { method: "POST" });
    }

    async function promoteUser(id) {
        return await request(`/admin/users/${id}/promote`, { method: "POST" });
    }

    async function demoteUser(id) {
        return await request(`/admin/users/${id}/demote`, { method: "POST" });
    }

    async function adminLog() {
        return await request("/admin/log");
    }

    return {
        register,
        login,
        me,
        updateProfile,
        logout,
        createProduct,
        listProducts,
        getProduct,
        markSold,
        addComment,
        listComments,
        reportProduct,
        listCategories,
        addCategory,
        removeCategory,
        listRequests,
        approveRequest,
        rejectRequest,
        listReports,
        approveReport,
        rejectReport,
        promoteUser,
        demoteUser,
        adminLog
    };
})();
