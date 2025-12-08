(async function() {
    const U = window.Utils || {};
    const API = 'http://localhost:4000';    function showSiteAlert(message, type = 'info', duration = 4000) {
        const existing = document.querySelector('.site-toast');
        if (existing) existing.remove();
        const el = document.createElement('div');
        el.className = `site-toast ${type}`;
        el.textContent = message;
        Object.assign(el.style, {
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 9999,
            padding: '10px 14px',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '0.95rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            opacity: '0',
            transform: 'translateY(-8px)',
            transition: 'opacity .22s ease, transform .22s ease'
        });
        if (type === 'success') el.style.background = '#0b6b3a';
        else if (type === 'error') el.style.background = '#b91c1c';
        else el.style.background = '#111827';
        document.body.appendChild(el);

        requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-8px)';
            setTimeout(() => el.remove(), 300);
        }, duration);
    }    
    function getCurrentUserId() {
        try {
            const session = JSON.parse(localStorage.getItem('session') || '{}');
            return session.userId || null;
        } catch (e) {
            return null;
        }
    }

    if (!window.Auth) { console.error('Auth não encontrado'); return; }
    try { window.Auth.ensureAdminOrRedirect(); } catch (e) { console.warn(e); }

    document.getElementById("logoutBtn")?.addEventListener("click", () => window.Auth.logout());    let adminSearchInput = null;
    let userResultsEl = null;    let requestsShown = 3;
    let reportsShown = 3;
    let commentReportsShown = 3;
    const REQUESTS_STEP = 5;
    const REPORTS_STEP = 5;
    const COMMENT_REPORTS_STEP = 5;    let usersCache = [];    adminSearchInput = document.getElementById('adminSearch');
    userResultsEl = document.getElementById('userResults');    await Promise.allSettled([loadCategories(), loadAdminLog(), loadPending(), loadReports(), loadCommentReports(), loadUsers()]);

    async function loadUsers() {
        try {
            const res = await fetch(`${API}/users`);
            if (!res.ok) throw new Error(`Erro ao carregar usuários (HTTP ${res.status})`);
            usersCache = await res.json();
            console.debug('[admin] usersCache carregado, total:', usersCache.length);
            if (userResultsEl) renderUserResults(usersCache);
        } catch (err) {
            console.error('loadUsers:', err);
            usersCache = [];
            if (userResultsEl) userResultsEl.innerHTML = '<p>Erro ao carregar usuários.</p>';
        }
    }

    function renderUserResults(list = []) {
        if (!userResultsEl) return;
        if (!Array.isArray(list) || list.length === 0) {
            if (usersCache && usersCache.length > 0) {
                console.debug('[admin] renderUserResults: lista filtrada vazia; usersCache tem', usersCache.length, 'itens. Exemplo:', usersCache[0]);
            } else {
                console.debug('[admin] renderUserResults: usersCache vazio');
            }
            userResultsEl.innerHTML = '<p>Nenhum usuário encontrado.</p>';
            return;
        }

        const currentUserId = getCurrentUserId();

        userResultsEl.innerHTML = list.map(u => {
            const isAdmin = !!u.isAdmin;
            const displayName = escapeHtml(u.name || u.username || u.login || u.email || u.id || '—');
            const email = escapeHtml(u.email || u.username || u.login || '');
            const badge = isAdmin ? '<span class="badge" style="background:#eef9ff;border:1px solid #cfe9ff;color:#0b6b3a">Admin</span>' : '';
            const isSelf = String(u.id) === String(currentUserId);
            const removeBtn = isAdmin
                ? `<button class="secondary ${isSelf ? 'self-disabled' : ''}" data-remove-admin="${escapeHtml(u.id)}" data-self="${isSelf ? 'true' : 'false'}" title="${isSelf ? 'Você não pode remover seus próprios privilégios' : 'Remover admin'}">Remover admin</button>`
                : `<button class="primary" data-make-admin="${escapeHtml(u.id)}">Tornar admin</button>`;

            return `<div class="row" style="justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
                <div style="display:flex;flex-direction:column;min-width:0">
                    <strong style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:420px">${displayName} ${badge}</strong>
                    <small style="color:var(--muted);overflow:hidden;text-overflow:ellipsis;max-width:420px">${email}</small>
                </div>
                <div style="display:flex;gap:8px;flex-shrink:0">
                    ${removeBtn}
                    <button class="secondary" data-view-user="${escapeHtml(u.id)}">Ver</button>
                </div>
            </div>`;
        }).join('');
    }

    function debounce(fn, wait = 250) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; }

    if (adminSearchInput) {
        adminSearchInput.addEventListener('input', debounce(() => {
            const qRaw = String(adminSearchInput.value || '').trim();
            const q = qRaw.toLowerCase();
            if (!q) {
                renderUserResults(usersCache);
                return;
            }

            const filtered = usersCache.filter(u => {
                const fields = [
                    String(u.name || '').toLowerCase(),
                    String(u.email || '').toLowerCase(),
                    String(u.username || '').toLowerCase(),
                    String(u.login || '').toLowerCase(),
                    String(u.id || '').toLowerCase()
                ];
                return fields.some(f => f.includes(q));
            });

            console.debug('[admin] busca:', qRaw, '-> resultados:', filtered.length);
            renderUserResults(filtered);
        }, 200));
    }

    document.addEventListener('click', async (e) => {
        const target = e.target.closest('button') || e.target;
        const delCat = target?.getAttribute('data-del-cat');
        const approveId = target?.getAttribute('data-approve');
        const rejectId = target?.getAttribute('data-reject');
        const viewId = target?.getAttribute('data-view');
        const sellerId = target?.getAttribute('data-seller');
        const deleteProductId = target?.getAttribute('data-delete-product');
        const reportIdForDelete = target?.getAttribute('data-report-id');
        const resolveReportId = target?.getAttribute('data-resolve-report');
        const resolveCommentReport = target?.getAttribute('data-resolve-comment-report');
        const deleteCommentId = target?.getAttribute('data-delete-comment');
        const makeAdminId = target?.getAttribute('data-make-admin');
        const removeAdminId = target?.getAttribute('data-remove-admin');
        const viewUserId = target?.getAttribute('data-view-user');

        try {
            if (delCat) {
                const decoded = decodeURIComponent(delCat);
                if (!confirm(`Excluir categoria "${decoded}"?`)) return;
                const res = await fetch(`${API}/categories/${encodeURIComponent(decoded)}`, { method: 'DELETE' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao excluir categoria');
                if (data.reassigned && data.reassigned > 0) {
                    showSiteAlert(`Categoria excluída. ${data.reassigned} produto(s) reatribuídos.`, 'success');
                } else {
                    showSiteAlert('Categoria excluída.', 'success');
                }
                await loadCategories();
                await loadPending();
                await loadAdminLog();
                return;
            }

            if (approveId) {
                const res = await fetch(`${API}/products/approve`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: approveId }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao aprovar');
                showSiteAlert('Produto aprovado.', 'success');
                await Promise.all([loadPending(), loadAdminLog()]);
                return;
            }

            if (rejectId) {
                const reason = prompt('Motivo da rejeição (opcional):', 'Rejeitado pelo admin.') || 'Rejeitado pelo admin.';
                const res = await fetch(`${API}/products/reject`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: rejectId, reason }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao rejeitar');
                showSiteAlert('Produto rejeitado.', 'success');
                await Promise.all([loadPending(), loadAdminLog()]);
                return;
            }

            if (viewId) {
                const res = await fetch(`${API}/products`);
                const products = await res.json();
                const p = products.find(x => x.id === viewId);
                if (!p) return showSiteAlert('Produto não encontrado.', 'error');
                const html = `<div style="padding:12px;font-family:Arial,Helvetica,sans-serif"><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.description)}</p><div style="display:flex;gap:8px;flex-wrap:wrap;">${(p.images||[]).map(s=>`<img src="${escapeHtml(s)}" style="width:240px;height:160px;object-fit:cover;border-radius:6px">`).join('')}</div></div>`;
                const w = window.open('', '_blank', 'width=900,height=700');
                w.document.write(html);
                return;
            }

            if (sellerId) {
                const res = await fetch(`${API}/users`);
                const users = await res.json();
                const u = users.find(x => x.id === sellerId);
                if (!u) return showSiteAlert('Vendedor não encontrado.', 'error');
                alert(`Vendedor: ${u.name}\nTelefone: ${u.phone || '—'}\nBloco: ${u.block || '—'}\nApt: ${u.apt || '—'}\nEmail: ${u.email || '—'}`);
                return;
            }

            if (deleteProductId && reportIdForDelete) {
                const reason = prompt('Motivo da exclusão (será enviado ao autor):', 'Removido por violar regras.');
                if (!reason) return;
                const res = await fetch(`${API}/products/delete`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: deleteProductId, reason }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao excluir produto');
                await fetch(`${API}/reports/resolve`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reportId: reportIdForDelete, action: 'deleted', note: reason }) });
                showSiteAlert('Produto excluído e denúncia resolvida.', 'success');
                await Promise.all([loadPending(), loadReports(), loadAdminLog()]);
                return;
            }

            if (resolveReportId) {
                const note = prompt('Observação sobre a resolução (opcional):', 'Resolvido pelo admin.');
                const res = await fetch(`${API}/reports/resolve`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reportId: resolveReportId, action: 'resolved', note }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao resolver denúncia');
                showSiteAlert('Denúncia marcada como resolvida.', 'success');
                await loadReports();
                return;
            }

            if (resolveCommentReport) {
                const note = prompt('Observação sobre a resolução (opcional):', 'Resolvido pelo admin.');
                const res = await fetch(`${API}/comment-reports/resolve`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reportId: resolveCommentReport, action: 'resolved', note }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao resolver denúncia de comentário');
                showSiteAlert('Denúncia de comentário resolvida.', 'success');
                await loadCommentReports();
                return;
            }

            if (deleteCommentId) {
                if (!confirm('Excluir este comentário?')) return;
                const res = await fetch(`${API}/comments/${encodeURIComponent(deleteCommentId)}`, { method:'DELETE' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao excluir comentário');
                showSiteAlert('Comentário excluído.', 'success');
                await Promise.all([loadCommentReports(), loadPending(), loadReports(), loadAdminLog()]);
                return;
            }
            if (makeAdminId) {
        
                const currentUserId = getCurrentUserId();
                if (String(makeAdminId) === String(currentUserId)) {
                    showSiteAlert('Você já é administrador.', 'info');
                    return;
                }
                if (!confirm('Tornar este usuário administrador?')) return;
                await toggleAdmin(makeAdminId, true);
                return;
            }

            if (removeAdminId) {
        
                const isSelf = target?.getAttribute('data-self') === 'true';
                if (isSelf) {
                    showSiteAlert('Você não pode remover seus próprios privilégios de administrador.', 'error');
                    return;
                }
                if (!confirm('Remover privilégios de administrador deste usuário?')) return;
                await toggleAdmin(removeAdminId, false);
                return;
            }

            if (viewUserId) {
                const res = await fetch(`${API}/users`);
                const users = await res.json();
                const u = users.find(x => x.id === viewUserId);
                if (!u) return showSiteAlert('Usuário não encontrado.', 'error');
                alert(`Usuário: ${u.name}\nEmail: ${u.email}\nTelefone: ${u.phone || '—'}\nBloco: ${u.block || '—'}\nApt: ${u.apt || '—'}\nAdmin: ${u.isAdmin ? 'Sim' : 'Não'}`);
                return;
            }

        } catch (err) {
            console.error('Erro no handler de clique:', err);
            showSiteAlert(err.message || 'Erro inesperado', 'error');
        }
    });    async function toggleAdmin(userId, makeAdmin = true) {
        try {
            const session = JSON.parse(localStorage.getItem('session') || '{}');
            const currentUserId = session.userId || null;
            if (String(userId) === String(currentUserId)) {
                showSiteAlert('Você não pode alterar seus próprios privilégios de administrador.', 'error');
                return;
            }
            let userObj = null;
            try {
                const resGet = await fetch(`${API}/users/${encodeURIComponent(userId)}`);
                if (resGet.ok) {
                    userObj = await resGet.json();
                } else {
                    const resAll = await fetch(`${API}/users`);
                    if (!resAll.ok) throw new Error(`Erro ao buscar usuário (HTTP ${resAll.status})`);
                    const all = await resAll.json();
                    userObj = all.find(u => String(u.id) === String(userId));
                }
            } catch (err) {
                console.warn('[admin] não foi possível GET /users/:id, tentando listar todos', err);
                const resAll = await fetch(`${API}/users`);
                if (!resAll.ok) throw new Error(`Erro ao buscar usuários (HTTP ${resAll.status})`);
                const all = await resAll.json();
                userObj = all.find(u => String(u.id) === String(userId));
            }

            if (!userObj) {
                showSiteAlert('Usuário não encontrado no servidor.', 'error');
                return;
            }
            userObj.isAdmin = !!makeAdmin;
            try {
                const putRes = await fetch(`${API}/users/${encodeURIComponent(userId)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userObj)
                });
                if (putRes.ok) {
                    showSiteAlert(makeAdmin ? 'Usuário promovido a admin!' : 'Privilégios de admin removidos.', 'success');
                    await loadUsers();
                    await loadAdminLog();
                    return;
                } else {
                    const text = await putRes.text();
                    console.warn('[admin] PUT falhou', putRes.status, text);
                }
            } catch (err) {
                console.warn('[admin] erro no PUT:', err);
            }

            try {
                const patchRes = await fetch(`${API}/users/${encodeURIComponent(userId)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isAdmin: !!makeAdmin })
                });
                if (patchRes.ok) {
                    showSiteAlert(makeAdmin ? 'Usuário promovido a admin!' : 'Privilégios de admin removidos.', 'success');
                    await loadUsers();
                    await loadAdminLog();
                    return;
                } else {
                    const text = await patchRes.text();
                    console.warn('[admin] PATCH falhou', patchRes.status, text);
                }
            } catch (err) {
                console.warn('[admin] erro no PATCH:', err);
            }

            console.error('[admin] não foi possível atualizar usuário. Verifique o backend e as rotas disponíveis.');
            showSiteAlert('A ação não é suportada pelo servidor. Verifique o backend (veja console).', 'error');
        } catch (err) {
            console.error('toggleAdmin erro inesperado:', err);
            showSiteAlert(err.message || 'Erro ao atualizar privilégios de admin.', 'error');
        }
    }

    async function loadCategories() {
        const listEl = document.getElementById('categoryList');
        if (!listEl) return;
        try {
            const res = await fetch(`${API}/categories`);
            if (!res.ok) throw new Error('Erro ao carregar categorias');
            const cats = await res.json();
            listEl.innerHTML = cats.map(c => `<li>${escapeHtml(c)} <button class="small danger" data-del-cat="${encodeURIComponent(c)}">Excluir</button></li>`).join('') || '<li>Sem categorias.</li>';
        } catch (err) { console.error(err); listEl.innerHTML = '<li>Erro ao carregar categorias.</li>'; }
    }

    document.getElementById('addCategoryBtn')?.addEventListener('click', async () => {
        const nameInput = document.getElementById('newCategoryName');
        if (!nameInput) return;
        const name = nameInput.value.trim();
        if (!name) return showSiteAlert('Informe o nome da categoria.', 'error');
        try {
            const res = await fetch(`${API}/categories`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao criar categoria');
            nameInput.value = '';
            await loadCategories();
            showSiteAlert('Categoria adicionada.', 'success');
        } catch (err) { showSiteAlert(err.message || 'Erro ao adicionar categoria', 'error'); }
    });

    async function loadPending() {
        const el = document.getElementById('productRequests');
        const loadMoreBtn = document.getElementById('loadMoreRequests');
        if (!el) return;
        try {
            const [prodRes, usersRes] = await Promise.all([fetch(`${API}/products`), fetch(`${API}/users`)]);
            if (!prodRes.ok) throw new Error('Erro produtos'); if (!usersRes.ok) throw new Error('Erro usuários');
            const products = await prodRes.json(); const users = await usersRes.json();
            const pendentes = products.filter(p => p.status === 'pendente');
            const total = pendentes.length;
            const items = pendentes.slice(0, requestsShown);
            el.innerHTML = items.map(p => {
                const seller = users.find(u => u.id === p.userId) || {};
                return `<div class="request-card" data-id="${escapeHtml(p.id)}"><div class="row"><strong>${escapeHtml(p.title)}</strong><span class="helper">${escapeHtml(p.category)} • ${typeof U.formatPrice === 'function' ? U.formatPrice(p.price) : escapeHtml(String(p.price))}</span></div><div style="margin-top:8px;"><button class="primary" data-approve="${escapeHtml(p.id)}">Aprovar</button><button class="danger" data-reject="${escapeHtml(p.id)}">Rejeitar</button><button class="secondary" data-view="${escapeHtml(p.id)}">Ver detalhes</button><button class="secondary" data-seller="${escapeHtml(p.userId)}">Ver vendedor</button></div><div style="margin-top:8px;">${(p.images||[]).slice(0,4).map(s=>`<img src="${escapeHtml(s)}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;margin-right:6px">`).join('')}</div></div>`;
            }).join('') || '<p>Nenhum pedido pendente.</p>';
            if (loadMoreBtn) { if (total > items.length) loadMoreBtn.classList.remove('hidden'); else loadMoreBtn.classList.add('hidden'); }
        } catch (err) { console.error(err); el.innerHTML = '<p>Erro ao carregar pedidos.</p>'; if (document.getElementById('loadMoreRequests')) document.getElementById('loadMoreRequests').classList.add('hidden'); }
    }

    document.getElementById('loadMoreRequests')?.addEventListener('click', async () => {
        requestsShown += REQUESTS_STEP;
        await loadPending();
    });

    async function loadReports() {
        const el = document.getElementById('reportsList');
        const loadMoreBtn = document.getElementById('loadMoreReports');
        if (!el) return;
        try {
            const [reportsRes, productsRes, usersRes] = await Promise.all([fetch(`${API}/reports`), fetch(`${API}/products`), fetch(`${API}/users`)]);
            if (!reportsRes.ok) throw new Error('Erro ao carregar denúncias');
            const reports = await reportsRes.json();
            const products = await productsRes.json();
            const users = await usersRes.json();
            const total = reports.length;
            const items = reports.slice(0, reportsShown);
            el.innerHTML = items.map(r => {
                const prod = products.find(p => p.id === r.productId) || {};
                const reporter = users.find(u => u.id === r.userId) || {};
                return `<div class="report-card" data-report-id="${escapeHtml(r.id)}"><strong>Produto:</strong> <a href="product.html?id=${escapeHtml(prod.id)}" target="_blank">${escapeHtml(prod.title || r.productId)}</a><p>${escapeHtml(r.text)}</p><small>Denunciado por: ${escapeHtml(reporter.name || 'Anônimo')} • ${new Date(r.createdAt).toLocaleString()}</small><div style="margin-top:8px;"><button class="danger" data-delete-product="${escapeHtml(prod.id)}" data-report-id="${escapeHtml(r.id)}">Excluir produto (com motivo)</button><button class="secondary" data-resolve-report="${escapeHtml(r.id)}">Marcar como resolvida</button></div></div>`;
            }).join('') || '<p>Sem denúncias.</p>';
            if (loadMoreBtn) { if (total > items.length) loadMoreBtn.classList.remove('hidden'); else loadMoreBtn.classList.add('hidden'); }
        } catch (err) { console.error(err); el.innerHTML = '<p>Erro ao carregar denúncias.</p>'; if (document.getElementById('loadMoreReports')) document.getElementById('loadMoreReports').classList.add('hidden'); }
    }

    document.getElementById('loadMoreReports')?.addEventListener('click', async () => {
        reportsShown += REPORTS_STEP;
        await loadReports();
    });

    async function loadCommentReports() {
        const el = document.getElementById('commentReportsList');
        const loadMoreBtn = document.getElementById('loadMoreCommentReports');
        if (!el) return;
        try {
            const [reportsRes, commentsRes, usersRes] = await Promise.all([fetch(`${API}/comment-reports`), fetch(`${API}/comments`), fetch(`${API}/users`)]);
            if (!reportsRes.ok) throw new Error('Erro ao carregar denúncias de comentários');
            const reports = await reportsRes.json();
            const comments = await commentsRes.json();
            const users = await usersRes.json();
            const total = reports.length;
            const items = reports.slice(0, commentReportsShown);
            el.innerHTML = items.map(r => {
                const comment = comments.find(c => c.id === r.commentId) || {};
                const reporter = users.find(u => u.id === r.userId) || {};
                return `<div class="report-card" data-report-id="${escapeHtml(r.id)}"><strong>Comentário:</strong> <em>${escapeHtml(comment.text || r.commentId)}</em><p>${escapeHtml(r.text)}</p><small>Denunciado por: ${escapeHtml(reporter.name || 'Anônimo')} • ${new Date(r.createdAt).toLocaleString()}</small><div style="margin-top:8px;"><button class="danger" data-delete-comment="${escapeHtml(comment.id)}">Excluir comentário</button><button class="secondary" data-resolve-comment-report="${escapeHtml(r.id)}">Marcar como resolvida</button></div></div>`;
            }).join('') || '<p>Sem denúncias de comentários.</p>';
            if (loadMoreBtn) { if (total > items.length) loadMoreBtn.classList.remove('hidden'); else loadMoreBtn.classList.add('hidden'); }
        } catch (err) { console.error(err); if (el) el.innerHTML = '<p>Erro ao carregar denúncias de comentários.</p>'; if (loadMoreBtn) loadMoreBtn.classList.add('hidden'); }
    }

    document.getElementById('loadMoreCommentReports')?.addEventListener('click', async () => {
        commentReportsShown += COMMENT_REPORTS_STEP;
        await loadCommentReports();
    });

    async function loadAdminLog() {
        const el = document.getElementById('adminLog');
        if (!el) return;
        try {
            const res = await fetch(`${API}/admin/log`);
            if (!res.ok) throw new Error('Erro ao carregar histórico');
            const log = await res.json();
            el.innerHTML = log.map(l => `<li>${new Date(l.date).toLocaleString()} — ${escapeHtml(l.action)} ${escapeHtml(l.productId || '')} ${escapeHtml(l.category || '')}</li>`).join('') || '<li>Sem histórico.</li>';
        } catch (err) { console.error(err); el.innerHTML = '<li>Erro ao carregar histórico.</li>'; }
    }

    function escapeHtml(s = '') { return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

})();
