(function() {
    const S = window.Storage;
    const U = window.Utils;
    const I = window.Images;

    const user = window.Auth.currentUser();
    if (!user) { alert('Faça login.'); location.href = 'login.html'; }
    window.Auth.requireLoginUI();

    const adminLink = document.getElementById('adminLink');
    if (user.isAdmin) adminLink.classList.remove('hidden');

    document.getElementById('publicProfile').checked = !!user.publicProfile;
    document.getElementById('editBlock').value = user.block || '';
    document.getElementById('editApt').value = user.apt || '';

    document.getElementById('saveProfileBtn').addEventListener('click', () => {
        const users = S.getUsers();
        const u = users.find(x => x.id === user.id);

        const block = document.getElementById('editBlock').value.trim();
        const apt = document.getElementById('editApt').value.trim();
        const publicProfile = document.getElementById('publicProfile').checked;
        const phone = document.getElementById('editPhone').value.trim();

        if (!block || !apt || !phone) return alert('Bloco, apartamento e telefone são obrigatórios!');

        u.block = block;
        u.apt = apt;
        u.publicProfile = publicProfile;
        u.phone = phone;
            
        const photoInput = document.getElementById('profilePhoto');
        if (photoInput.files[0]) {
            I.compressFiles([photoInput.files[0]], 1, 1).then(res => {
            u.photo = res[0];
            S.setUsers(users);
            alert('Perfil atualizado.');
            }).catch(err => alert(err.message));
        } else {
            S.setUsers(users);
            alert('Perfil atualizado.');
        }
    });


    const prodCategorySelect = document.getElementById('prodCategory');
    const cats = S.getCategories();
    prodCategorySelect.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');

    document.getElementById('submitProduct').addEventListener('click', async () => {
        try {
            enforceDailyLimit(user);
            const title = document.getElementById('prodTitle').value.trim();
            const description = document.getElementById('prodDesc').value.trim();
            const price = parseFloat(document.getElementById('prodPrice').value);
            const category = document.getElementById('prodCategory').value;
            const files = document.getElementById('prodImages').files;

            if (!title || !description || isNaN(price)) throw new Error('Título, descrição e preço são obrigatórios.');
            // Anti-repetição básica
            if (isDuplicateProduct(user.id, title, description)) throw new Error('Produto repetido detectado.');

            const images = await I.compressFiles(files, 3, 5);

            const products = S.getProducts();
            const id = crypto.randomUUID();
            const product = {
                id, userId: user.id, title, description, price, category,
                images, status: 'pendente', sold: false, deleted: false,
                contactPhone: user.phone, block: user.block, apt: user.apt,
                comments: [],
                lastEditAt: null,
                createdAt: Date.now(),
            };
            async function createProduct(product) {
                const token = localStorage.getItem('token');
                const res = await fetch('http://localhost:4000/products', {
                    method: 'POST',
                    headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(product)
                });
                const data = await res.json();
                if (!res.ok) {
                    alert(data.error || 'Erro ao criar produto');
                    return;
                }
            alert('Produto enviado para aprovação!');
            }

            const reqs = S.getRequests();
            reqs.push({ id: crypto.randomUUID(), productId: id, type: 'create', date: Date.now() });
            S.setRequests(reqs);

            incDailyCount(user);
            alert('Produto enviado para aprovação.');
            renderMyProducts();
        } catch (err) {
            alert(err.message);
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        window.Auth.logout();
    });


    function renderMyProducts() {
        const list = document.getElementById('myProducts');
        const products = S.getProducts().filter(p => p.userId === user.id && !p.deleted);
        list.innerHTML = products.map(p => {
            const statusClass = `status-${p.status}`;
            const reason = p.rejectionMessage ? ` • Motivo: ${p.rejectionMessage}` : '';
            const controls = `
                <div class="row">
                    <button class="secondary" onclick="editProduct('${p.id}')">Editar</button>
                    <button class="secondary" onclick="markSold('${p.id}')">Marcar como vendido</button>
                </div>`;
            return `<li>
                <strong>${p.title}</strong> — <span class="${statusClass}">${p.status}</span>${reason}
                ${controls}
            </li>`;
        }).join('');
    }

    window.editProduct = (id) => {
        const products = S.getProducts();
        const p = products.find(x => x.id === id);
        if (!p) return;
        const newTitle = prompt('Novo título:', p.title) || p.title;
        const newDesc = prompt('Nova descrição:', p.description) || p.description;
        const newPrice = parseFloat(prompt('Novo preço:', p.price)) || p.price;
        p.title = newTitle; p.description = newDesc; p.price = newPrice;
        p.status = 'pendente';
        p.lastEditAt = Date.now();
        S.setProducts(products);
        const reqs = S.getRequests();
        reqs.push({ id: crypto.randomUUID(), productId: p.id, type: 'edit', date: Date.now() });
        S.setRequests(reqs);
        alert('Edição enviada para aprovação.');
        renderMyProducts();
    };

    window.markSold = (id) => {
        const products = S.getProducts();
        const p = products.find(x => x.id === id);
        if (!p) return;
        p.sold = true;
        S.setProducts(products);
        alert('Produto marcado como vendido.');
        renderMyProducts();
    };

    function enforceDailyLimit(u) {
        const today = U.todayKey();
        if (u.lastCreateDay !== today) {
            u.lastCreateDay = today; u.createdTodayCount = 0;
            const users = S.getUsers(); const me = users.find(x => x.id === u.id);
            me.lastCreateDay = today; me.createdTodayCount = 0; S.setUsers(users);
        }
        if (u.createdTodayCount >= 3) throw new Error('Limite de 3 produtos por dia atingido.');
    }
    function incDailyCount(u) {
        const users = S.getUsers(); const me = users.find(x => x.id === u.id);
        me.createdTodayCount = (me.createdTodayCount || 0) + 1;
        S.setUsers(users);
    }
    function isDuplicateProduct(userId, title, description) {
        async function loadProducts() {
            const res = await fetch('http://localhost:4000/products');
            const products = await res.json();
            renderProducts(products);
        }
        return products.some(p => p.title.trim() === title.trim() && p.description.trim() === description.trim());
    }

    renderMyProducts();
})();
