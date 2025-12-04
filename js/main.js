(function() {
    const S = window.Storage;
    const U = window.Utils;

    const PRODUCTS_PER_PAGE = 12;
    const SHOW_MORE_COUNT = 12;
    const USE_INFINITE_SCROLL = false; // mude para true se quiser infinite scroll

    const listEl = document.getElementById('productList');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const clearFilters = document.getElementById('clearFilters');
    const createBtn = document.getElementById('createProductBtn');

    window.Auth.requireLoginUI();
    initCategories();
    bindEvents();
    renderPage();

    function initCategories() {
        const cats = S.getCategories();
        categoryFilter.innerHTML = `<option value="">Todas as categorias</option>` +
            cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    function bindEvents() {
        loadMoreBtn.addEventListener('click', () => {
            pageOffset += SHOW_MORE_COUNT;
            renderPage();
        });
        searchInput.addEventListener('input', () => { pageOffset = 0; renderPage(); });
        categoryFilter.addEventListener('change', () => { pageOffset = 0; renderPage(); });
        clearFilters.addEventListener('click', () => {
            searchInput.value = ''; categoryFilter.value = ''; pageOffset = 0; renderPage();
        });
        createBtn.addEventListener('click', () => location.href = 'profile.html');
        if (USE_INFINITE_SCROLL) {
            window.addEventListener('scroll', () => {
                if ((window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 200)) {
                    pageOffset += SHOW_MORE_COUNT;
                    renderPage();
                }
            });
        }
    }

    let pageOffset = 0;
    function renderPage() {
        async function loadProducts() {
            const res = await fetch('http://localhost:4000/products');
            const products = await res.json();
            renderProducts(products);
        }

        const q = U.normalize(searchInput.value);
        const cat = categoryFilter.value;

        let filtered = products.filter(p => U.normalize(p.title).includes(q));
        if (cat) filtered = filtered.filter(p => p.category === cat);

        const pageItems = U.paginate(filtered, 0, PRODUCTS_PER_PAGE + pageOffset);
        listEl.innerHTML = pageItems.map(renderCard).join('');
    }

    function renderCard(p) {
        const cover = p.images?.[0] || '';
        const badge = p.sold ? `<span class="badge status-vendido">Vendido</span>` : '';
        return `
            <div class="product-card">
                <img src="${cover}" alt="${p.title}" />
                <div class="content">
                    <h3>${p.title}</h3>
                    <p>${U.formatPrice(p.price)}</p>
                    <p class="helper">${p.category}</p>
                    ${badge}
                    <a class="secondary" href="product.html?id=${p.id}">Ver detalhes</a>
                </div>
            </div>
        `;
    }
})();
