(async function() {
    const API = 'http://localhost:4000';
    const I = window.Images;
    const U = window.Utils || {};

    if (!window.Auth) { console.error('Auth não encontrado'); return; }
    const user = await window.Auth.currentUser();
    if (!user) { alert('Faça login.'); location.href = 'login.html'; return; }

    window.Auth.requireLoginUI();
    document.getElementById('adminLink')?.classList.toggle('hidden', !user.isAdmin);

    const editBlock = document.getElementById('editBlock');
    const editApt = document.getElementById('editApt');
    const editPhone = document.getElementById('editPhone');
    const publicProfile = document.getElementById('publicProfile');

    editBlock.value = user.block || '';
    editApt.value = user.apt || '';
    editPhone.value = formatPhoneDisplay(user.phone || '');
    publicProfile.checked = !!user.publicProfile;

    if (typeof window.applyPhoneMask === 'function') window.applyPhoneMask(editPhone);

    document.getElementById('logoutBtn')?.addEventListener('click', () => window.Auth.logout());

    async function loadCategories() {
        try {
            const res = await fetch(`${API}/categories`);
            if (!res.ok) throw new Error('Erro ao carregar categorias');
            const cats = await res.json();
            const prodCategorySelect = document.getElementById('prodCategory');
            if (prodCategorySelect) prodCategorySelect.innerHTML = `<option value="">Selecione</option>` + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        } catch (err) { console.warn('Erro ao carregar categorias:', err); }
    }
    await loadCategories();

    document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
        const block = editBlock.value.trim();
        const apt = editApt.value.trim();
        const phoneRaw = editPhone.value || '';
        const phoneDigits = phoneRaw.replace(/\D/g, '');
        const pub = !!publicProfile.checked;
        if (!block || !apt || !phoneDigits) return alert('Preencha todos os campos obrigatórios.');
        if (!/^\d{11}$/.test(phoneDigits)) return alert('Telefone inválido. Use DDD + número (11 dígitos).');
        try {
            const res = await fetch(`${API}/users/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: user.id, block, apt, phone: phoneDigits, publicProfile: pub }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao atualizar perfil');
            alert('Perfil atualizado.');
        } catch (err) { alert(err.message); }
    });

    document.getElementById('submitProduct')?.addEventListener('click', async () => {
        const session = JSON.parse(localStorage.getItem('session') || '{}');
        if (!session.userId) {
            if (confirm('Você precisa estar logado para criar um anúncio. Deseja entrar agora?')) location.href = 'login.html';
            return;
        }
        try {
            const title = document.getElementById('prodTitle').value.trim();
            const description = document.getElementById('prodDesc').value.trim();
            const price = parseFloat(document.getElementById('prodPrice').value);
            const category = document.getElementById('prodCategory').value;
            const files = document.getElementById('prodImages').files;
            if (!title || !description || Number.isNaN(price) || !category) throw new Error('Título, descrição, preço e categoria são obrigatórios.');
            const images = await I.compressFiles(files, 2, 5);
            const product = { id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`, userId: user.id, title, description, price, category, images, status: 'pendente', sold: false, deleted: false, contactPhone: user.phone, block: user.block, apt: user.apt, comments: [], createdAt: Date.now() };
            const res = await fetch(`${API}/products`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(product) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao criar produto');
            alert('Produto enviado para aprovação!');
            await renderMyProducts();
        } catch (err) { alert(err.message); }
    });

    async function renderMyProducts() {
        const list = document.getElementById('myProducts');
        if (!list) return;
        try {
            const res = await fetch(`${API}/products`);
            const products = await res.json();
            const mine = products.filter(p => p.userId === user.id && !p.deleted);
            list.innerHTML = mine.map(p => {
                const reason = p.rejectionMessage ? ` • Motivo: ${escapeHtml(p.rejectionMessage)}` : '';
                return `<li><strong>${escapeHtml(p.title)}</strong> — <span class="status-${escapeHtml(p.status)}">${escapeHtml(p.status)}</span>${reason} <button class="small danger" data-delete-own="${escapeHtml(p.id)}">Excluir</button></li>`;
            }).join('') || '<li>Você não tem produtos.</li>';
        } catch (err) { list.innerHTML = '<li>Erro ao carregar produtos.</li>'; }
    }

    async function renderMyComments() {
        const list = document.getElementById('myComments');
        if (!list) return;
        try {
            const res = await fetch(`${API}/comments`);
            const comments = await res.json();
            const mine = comments.filter(c => c.userId === user.id);
            list.innerHTML = mine.map(c => `<li><strong>${escapeHtml(c.userName || 'Você')}</strong> em <em>${escapeHtml(c.productId)}</em> — ${escapeHtml(c.text)} <button class="small danger" data-delete-comment="${escapeHtml(c.id)}">Excluir</button></li>`).join('') || '<li>Você não fez comentários.</li>';
        } catch (err) { list.innerHTML = '<li>Erro ao carregar comentários.</li>'; }
    }

    document.addEventListener('click', async (e) => {
        const delOwn = e.target.getAttribute('data-delete-own');
        const delComment = e.target.getAttribute('data-delete-comment');
        if (delOwn) {
            if (!confirm('Excluir este produto? Esta ação não pode ser desfeita.')) return;
            try {
                const res = await fetch(`${API}/products/delete-by-owner`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: delOwn, userId: user.id }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao excluir produto');
                alert('Produto excluído.');
                await renderMyProducts();
            } catch (err) { alert(err.message); }
            return;
        }
        if (delComment) {
            if (!confirm('Excluir este comentário?')) return;
            try {
                const res = await fetch(`${API}/comments/${encodeURIComponent(delComment)}`, { method:'DELETE' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao excluir comentário');
                alert('Comentário excluído.');
                await renderMyComments();
            } catch (err) { alert(err.message); }
            return;
        }
    });

    await Promise.all([renderMyProducts(), renderMyComments()]);

    function escapeHtml(s = '') { return String(s).replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
    function formatPhoneDisplay(digits) { const v = String(digits || '').replace(/\D/g, ''); if (v.length !== 11) return v; return `${v.slice(0,2)} ${v.slice(2,7)}-${v.slice(7)}`; }
})();
