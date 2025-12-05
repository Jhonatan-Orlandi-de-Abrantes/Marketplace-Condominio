// js/main.js
(function() {
    try { window.Auth?.requireLoginUI?.(); } catch (e) { console.warn(e); }

    const listEl = document.getElementById('productList');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const clearFilters = document.getElementById('clearFilters');

    // botão "criar anúncio" (pode existir no header ou em outras páginas)
    const createAdBtn = document.getElementById('createAdBtn'); // se você usa outro id, ajuste aqui

    if (createAdBtn) {
        createAdBtn.addEventListener('click', () => {
            const session = JSON.parse(localStorage.getItem('session') || '{}');
            if (!session.userId) {
                if (confirm('Você precisa estar logado para criar um anúncio. Deseja entrar agora?')) location.href = 'login.html';
                return;
            }
            // se estiver logado, ir para profile.html (onde está o formulário de criação)
            location.href = 'profile.html';
        });
    }

    if (!listEl || !searchInput || !categoryFilter) return;

    const U = window.Utils || {};
    const API = 'http://localhost:4000';
    const INITIAL_SHOW = 3;
    let shown = INITIAL_SHOW;
    const PAGE_SIZE = 12;

    (async function init() { bindEvents(); await loadCategories(); await renderPage(); })();

    function bindEvents() {
        searchInput.addEventListener('input', debounce(() => { shown = INITIAL_SHOW; renderPage(); }, 250));
        categoryFilter.addEventListener('change', () => { shown = INITIAL_SHOW; renderPage(); });
        clearFilters?.addEventListener('click', () => { searchInput.value = ''; categoryFilter.value = ''; shown = INITIAL_SHOW; renderPage(); });
        loadMoreBtn?.addEventListener('click', () => { shown += PAGE_SIZE; renderPage(); });
        listEl.addEventListener('click', (e) => {
            const card = e.target.closest('[data-product-id]');
            if (!card) return;
            const id = card.getAttribute('data-product-id');
            if (e.target.matches('.open-product') || e.target.closest('.open-product')) location.href = `product.html?id=${encodeURIComponent(id)}`;
        });
    }

    async function loadCategories() {
        try {
            const res = await fetch(`${API}/categories`);
            if (!res.ok) throw new Error('Erro ao carregar categorias');
            const cats = await res.json();
            categoryFilter.innerHTML = `<option value="">Todas as categorias</option>` + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        } catch (err) { console.error(err); categoryFilter.innerHTML = `<option value="">Todas as categorias</option>`; }
    }

    async function renderPage() {
        try {
            const res = await fetch(`${API}/products`);
            if (!res.ok) throw new Error('Erro ao buscar produtos');
            const products = await res.json();
            const q = searchInput.value ? U.normalize(searchInput.value) : '';
            const cat = categoryFilter.value || '';
            let filtered = products.filter(p => U.normalize(p.title).includes(q));
            if (cat) filtered = filtered.filter(p => p.category === cat);
            const total = filtered.length;
            const pageItems = filtered.slice(0, shown);
            listEl.innerHTML = pageItems.map(renderCard).join('') || '<p>Nenhum produto encontrado.</p>';
            if (loadMoreBtn) { if (total > pageItems.length) loadMoreBtn.classList.remove('hidden'); else loadMoreBtn.classList.add('hidden'); }
        } catch (err) { console.error(err); listEl.innerHTML = '<p>Erro ao carregar produtos.</p>'; }
    }

    function renderCard(p) {
        const img = (p.images && p.images[0]) ? p.images[0] : 'placeholder.png';
        return `<article class="product-card" data-product-id="${escapeHtml(p.id)}"><img src="${escapeHtml(img)}" alt="${escapeHtml(p.title)}" /><div class="card-body"><h3>${escapeHtml(p.title)}</h3><p class="price">${typeof U.formatPrice === 'function' ? U.formatPrice(p.price) : escapeHtml(String(p.price))}</p><p class="category">${escapeHtml(p.category || '')}</p><div class="card-actions"><button class="open-product">Ver detalhes</button></div></div></article>`;
    }

    function debounce(fn, wait) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; }
    function escapeHtml(s = '') { return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
})();
