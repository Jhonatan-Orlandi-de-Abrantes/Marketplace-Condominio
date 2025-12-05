// js/admin.js
(async function() {
    const U = window.Utils || {};
    const API = 'http://localhost:4000';

    if (!window.Auth) { console.error('Auth não encontrado'); return; }
    try { window.Auth.ensureAdminOrRedirect(); } catch (e) { console.warn(e); }

    document.getElementById("logoutBtn")?.addEventListener("click", () => window.Auth.logout());

    // controls for "ver mais" in admin lists
    let requestsShown = 3;
    let reportsShown = 3;
    let commentReportsShown = 3;
    const REQUESTS_STEP = 5;
    const REPORTS_STEP = 5;
    const COMMENT_REPORTS_STEP = 5;

    await Promise.allSettled([loadCategories(), loadAdminLog(), loadPending(), loadReports(), loadCommentReports()]);

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
        if (!name) return alert('Informe o nome da categoria.');
        try {
            const res = await fetch(`${API}/categories`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao criar categoria');
            nameInput.value = '';
            await loadCategories();
            alert('Categoria adicionada.');
        } catch (err) { alert(err.message); }
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

    document.addEventListener('click', async (e) => {
        const delCat = e.target.getAttribute('data-del-cat');
        const approveId = e.target.getAttribute('data-approve');
        const rejectId = e.target.getAttribute('data-reject');
        const viewId = e.target.getAttribute('data-view');
        const sellerId = e.target.getAttribute('data-seller');
        const deleteProductId = e.target.getAttribute('data-delete-product');
        const reportIdForDelete = e.target.getAttribute('data-report-id');
        const resolveReportId = e.target.getAttribute('data-resolve-report');
        const resolveCommentReport = e.target.getAttribute('data-resolve-comment-report');
        const deleteCommentId = e.target.getAttribute('data-delete-comment');

        try {
            if (delCat) {
                const decoded = decodeURIComponent(delCat);
                if (!confirm(`Excluir categoria "${decoded}"?`)) return;

                // call server delete which will reassign products and notify owners
                const res = await fetch(`${API}/categories/${encodeURIComponent(decoded)}`, { method: 'DELETE' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao excluir categoria');

                // feedback ao admin
                if (data.reassigned && data.reassigned > 0) {
                    alert(`Categoria excluída. ${data.reassigned} produto(s) foram reatribuídos para "${data.fallback}" e os donos foram notificados.`);
                } else {
                    alert('Categoria excluída.');
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
                alert('Produto aprovado.');
                await Promise.all([loadPending(), loadAdminLog()]);
                return;
            }

            if (rejectId) {
                const reason = prompt('Motivo da rejeição (opcional):', 'Rejeitado pelo admin.') || 'Rejeitado pelo admin.';
                const res = await fetch(`${API}/products/reject`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: rejectId, reason }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao rejeitar');
                alert('Produto rejeitado.');
                await Promise.all([loadPending(), loadAdminLog()]);
                return;
            }

            if (viewId) {
                const res = await fetch(`${API}/products`);
                const products = await res.json();
                const p = products.find(x => x.id === viewId);
                if (!p) return alert('Produto não encontrado.');
                const html = `<div style="padding:12px;font-family:Arial,Helvetica,sans-serif"><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.description)}</p><div style="display:flex;gap:8px;flex-wrap:wrap;">${(p.images||[]).map(s=>`<img src="${escapeHtml(s)}" style="width:240px;height:160px;object-fit:cover;border-radius:6px">`).join('')}</div></div>`;
                const w = window.open('', '_blank', 'width=900,height=700');
                w.document.write(html);
                return;
            }

            if (sellerId) {
                const res = await fetch(`${API}/users`);
                const users = await res.json();
                const u = users.find(x => x.id === sellerId);
                if (!u) return alert('Vendedor não encontrado.');
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
                alert('Produto excluído e denúncia resolvida.');
                await Promise.all([loadPending(), loadReports(), loadAdminLog()]);
                return;
            }

            if (resolveReportId) {
                const note = prompt('Observação sobre a resolução (opcional):', 'Resolvido pelo admin.');
                const res = await fetch(`${API}/reports/resolve`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reportId: resolveReportId, action: 'resolved', note }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao resolver denúncia');
                alert('Denúncia marcada como resolvida.');
                await loadReports();
                return;
            }

            if (resolveCommentReport) {
                const note = prompt('Observação sobre a resolução (opcional):', 'Resolvido pelo admin.');
                const res = await fetch(`${API}/comment-reports/resolve`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reportId: resolveCommentReport, action: 'resolved', note }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao resolver denúncia de comentário');
                alert('Denúncia de comentário resolvida.');
                await loadCommentReports();
                return;
            }

            if (deleteCommentId) {
                if (!confirm('Excluir este comentário?')) return;
                const res = await fetch(`${API}/comments/${encodeURIComponent(deleteCommentId)}`, { method:'DELETE' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao excluir comentário');
                alert('Comentário excluído.');
                await Promise.all([loadCommentReports(), loadPending(), loadReports(), loadAdminLog()]);
                return;
            }

        } catch (err) { alert(err.message || 'Erro inesperado'); }
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
