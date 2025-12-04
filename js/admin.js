(function() {
    const S = window.Storage;
    const U = window.Utils;
    const N = window.Notifications;

    if (!window.Auth.ensureAdminOrRedirect()) return;

    // Gestão de admins
    const adminSearch = document.getElementById('adminSearch');
    const userResults = document.getElementById('userResults');
    adminSearch.addEventListener('input', renderUserResults);
    function renderUserResults() {
        const q = U.normalize(adminSearch.value);
        const users = S.getUsers();
        userResults.innerHTML = users.map(u => {
            const match = U.normalize(u.email).includes(q) || U.normalize(u.name).includes(q);
            if (!match) return '';
            const btn = u.isAdmin
                ? `<button class="secondary" onclick="demote('${u.id}')">Remover admin</button>`
                : `<button class="primary" onclick="promote('${u.id}')">Promover a admin</button>`;
            return `<div class="row"><span>${u.name} (${u.email})</span> ${btn}</div>`;
        }).join('');
    }
    window.promote = (id) => window.Auth.toggleAdmin(id, true);
    window.demote = (id) => window.Auth.toggleAdmin(id, false);

    // Pedidos (produtos)
    const productRequestsEl = document.getElementById('productRequests');
    const reportsEl = document.getElementById('reportsList');
    const loadMoreRequests = document.getElementById('loadMoreRequests');
    const loadMoreReports = document.getElementById('loadMoreReports');

    let reqOffset = 0, repOffset = 0;
    renderRequests();
    renderReports();
    renderAdminLog();
    renderCategories();

    loadMoreRequests.addEventListener('click', () => { reqOffset += 5; renderRequests(); });
    loadMoreReports.addEventListener('click', () => { repOffset += 5; renderReports(); });

    function renderRequests() {
        const reqs = S.getRequests().slice().sort((a,b) => a.date - b.date);
        const page = reqs.slice(0, 3 + reqOffset);
        productRequestsEl.innerHTML = page.map(r => {
            const p = S.getProducts().find(x => x.id === r.productId);
            if (!p) return '';
            return cardRequest(r, p);
        }).join('');
        document.getElementById('loadMoreRequests').style.display = reqs.length > 3 ? 'block' : 'none';
    }

    function cardRequest(r, p) {
        return `
            <div class="card">
                <h3>${p.title} <span class="badge">${r.type}</span></h3>
                <p>${p.description}</p>
                <p><strong>Preço:</strong> ${U.formatPrice(p.price)} • Categoria: ${p.category}</p>
                <div class="row">
                    <button class="primary" onclick="approveReq('${r.id}')">Aprovar</button>
                    <button class="danger" onclick="rejectReqPrompt('${r.id}')">Reprovar</button>
                </div>
            </div>
        `;
    }

    window.approveReq = (reqId) => {
        const u = window.Auth.currentUser();
        const reqs = S.getRequests();
        const idx = reqs.findIndex(x => x.id === reqId);
        if (idx < 0) return;
        const r = reqs[idx];
        async function loadProducts() {
            const res = await fetch('http://localhost:4000/products');
            const products = await res.json();
            renderProducts(products);
        }
        const p = products.find(x => x.id === r.productId);
        if (!p) return;
        p.status = 'aprovado';
        S.setProducts(products);
        reqs.splice(idx, 1);
        S.setRequests(reqs);
        S.addAdminLog(u.id, 'approve_product', p.id, '');
        N.notifyApproval(p, true, '');
        renderRequests();
    };

    window.rejectReqPrompt = (reqId) => {
        const reason = prompt('Motivo da reprovação:');
        if (reason === null) return;
        window.rejectReq(reqId, reason.trim() || 'Sem motivo.');
    };

    window.rejectReq = (reqId, reason) => {
        const u = window.Auth.currentUser();
        const reqs = S.getRequests();
        const idx = reqs.findIndex(x => x.id === reqId);
        if (idx < 0) return;
        const r = reqs[idx];
        async function loadProducts() {
            const res = await fetch('http://localhost:4000/products');
            const products = await res.json();
            renderProducts(products);
        }
        const p = products.find(x => x.id === r.productId);
        if (!p) return;
        p.status = 'rejeitado';
        p.rejectionMessage = reason;
        S.setProducts(products);
        reqs.splice(idx, 1);
        S.setRequests(reqs);
        S.addAdminLog(u.id, 'reject_product', p.id, reason);
        N.notifyApproval(p, false, reason);
        renderRequests();
    };

    function renderReports() {
        const reports = S.getReports().slice().sort((a,b) => a.date - b.date);
        const page = reports.slice(0, 3 + repOffset);
        reportsEl.innerHTML = page.map(r => {
            const p = S.getProducts().find(x => x.id === r.productId);
            const reporter = S.getUsers().find(u => u.id === r.userId);
            return `
                <div class="card">
                    <h3>Denúncia: ${p ? p.title : 'Produto removido'}</h3>
                    <p>${r.text}</p>
                    <p class="helper">Por: ${reporter ? reporter.name : 'Anônimo'} • ${U.formatDate(r.date)}</p>
                    <div class="row">
                        <button class="primary" onclick="approveReport('${r.id}')">Validar denúncia</button>
                        <button class="secondary" onclick="rejectReport('${r.id}')">Rejeitar denúncia</button>
                    </div>
                </div>
            `;
        }).join('');
        // só mostra botão se houver mais de 3
        document.getElementById('loadMoreReports').style.display = reports.length > 3 ? 'block' : 'none';
    }

    window.approveReport = (id) => {
        const u = window.Auth.currentUser();
        const reports = S.getReports();
        const r = reports.find(x => x.id === id);
        if (!r) return;
        r.status = 'aprovado';
        S.setReports(reports);

        // Regra: muitas denúncias → bloquear usuário
        async function loadProducts() {
            const res = await fetch('http://localhost:4000/products');
            const products = await res.json();
            renderProducts(products);
        }
        const p = products.find(x => x.id === r.productId);
        if (p) {
            const aprovadoReportsForProduct = S.getReports().filter(x => x.productId === p.id && x.status === 'aprovado').length;
            if (aprovadoReportsForProduct >= 3) {
                const users = S.getUsers();
                const owner = users.find(x => x.id === p.userId);
                if (owner) {
                    owner.blocked = true;
                    S.setUsers(users);
                    S.setProducts(products);
                    S.addAdminLog(u.id, 'block_user', owner.id, 'Múltiplas denúncias aprovadas no produto.');
                }
            }
        }
        S.addAdminLog(u.id, 'approve_report', id, '');
        renderReports();
    };

    window.rejectReport = (id) => {
        const u = window.Auth.currentUser();
        const reports = S.getReports();
        const r = reports.find(x => x.id === id);
        if (!r) return;
        r.status = 'rejeitado';
        S.setReports(reports);
        S.addAdminLog(u.id, 'reject_report', id, '');
        renderReports();
    };

    function renderAdminLog() {
        const logEl = document.getElementById('adminLog');
        const log = S.getAdminLog().slice().sort((a,b)=> b.date - a.date);
        logEl.innerHTML = log.map(l => {
            const admin = S.getUsers().find(u => u.id === l.actorAdminId);
            return `<li>${U.formatDate(l.date)} — ${admin ? admin.name : 'Admin'}: ${l.action} (alvo: ${l.targetId}) ${l.message ? ' • '+l.message : ''}</li>`;
        }).join('');
    }

    // Categorias
    const newCategoryName = document.getElementById('newCategoryName');
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const categoryListEl = document.getElementById('categoryList');

    addCategoryBtn.addEventListener('click', () => {
        const name = newCategoryName.value.trim();
        if (!name) return;
        const cats = S.getCategories();
        if (cats.includes(name)) return alert('Categoria já existe.');
        cats.push(name);
        S.setCategories(cats);
        renderCategories();
        alert('Categoria adicionada.');
        newCategoryName.value = '';
    });

    function renderCategories() {
        const cats = S.getCategories();
        categoryListEl.innerHTML = cats.map(c => `
            <li class="row"><span>${c}</span>
                <button class="danger" onclick="removeCategory('${c}')">Remover</button>
            </li>
        `).join('');
    }

    window.removeCategory = (name) => {
        const cats = S.getCategories().filter(c => c !== name);
        S.setCategories(cats);
        renderCategories();
    };
})();