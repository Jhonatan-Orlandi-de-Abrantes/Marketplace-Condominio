// js/product.js
(async function() {
    const API = 'http://localhost:4000';
    const U = window.Utils || {};

    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const container = document.getElementById('productDetails');

    if (!container) { console.warn('#productDetails não encontrado'); return; }
    if (!id) { container.innerHTML = '<p>Produto não especificado.</p>'; return; }

    async function fetchProduct() {
        const res = await fetch(`${API}/products`);
        if (!res.ok) throw new Error('Erro ao buscar produtos');
        const products = await res.json();
        return products.find(x => x.id === id);
    }

    async function render() {
        try {
            const p = await fetchProduct();
            if (!p) { container.innerHTML = '<p>Produto não encontrado.</p>'; return; }

            const images = Array.isArray(p.images) ? p.images : [];
            const mainImg = images[0] || '';

            // obter sessão (se houver)
            const session = JSON.parse(localStorage.getItem('session') || '{}');
            const meId = session.userId;

            container.innerHTML = `
                <div class="product-detail-card">
                    <div class="gallery">
                        <button class="arrow left" id="prevImg" aria-label="Anterior">&lt;</button>
                        <img id="mainImage" class="main-img" src="${escapeHtml(mainImg)}" alt="${escapeHtml(p.title)}">
                        <button class="arrow right" id="nextImg" aria-label="Próxima">&gt;</button>
                        <div class="thumbs" id="thumbs">${images.map((s,i)=>`<img data-index="${i}" src="${escapeHtml(s)}" class="${i===0?'active':''}" alt="thumb">`).join('')}</div>
                    </div>

                    <div class="info">
                        <h1>${escapeHtml(p.title)}</h1>
                        <p class="price">${typeof U.formatPrice === 'function' ? U.formatPrice(p.price) : escapeHtml(String(p.price))}</p>
                        <p class="category">${escapeHtml(p.category)}</p>
                        <p class="desc">${escapeHtml(p.description)}</p>
                        <div class="actions">
                            <button id="contactSeller" class="primary">Contatar</button>
                        </div>
                        <div class="meta"><small>Publicado em: ${new Date(p.createdAt).toLocaleString()}</small></div>
                    </div>
                </div>
            `;

            // gallery logic
            let current = 0;
            const mainImage = document.getElementById('mainImage');
            const thumbs = Array.from(document.querySelectorAll('#thumbs img'));
            function setImage(idx) {
                if (!images.length) return;
                current = ((idx % images.length) + images.length) % images.length;
                mainImage.src = images[current];
                thumbs.forEach(t => t.classList.remove('active'));
                thumbs[current]?.classList.add('active');
            }
            document.getElementById('prevImg').addEventListener('click', () => setImage(current - 1));
            document.getElementById('nextImg').addEventListener('click', () => setImage(current + 1));
            thumbs.forEach(t => t.addEventListener('click', (e) => setImage(Number(e.target.dataset.index))));

            // contact seller -> WhatsApp
            document.getElementById('contactSeller').addEventListener('click', async () => {
                try {
                    const usersRes = await fetch(`${API}/users`);
                    const users = await usersRes.json();
                    const seller = users.find(u => u.id === p.userId);
                    if (!seller || !seller.phone) return alert('Telefone do vendedor não disponível.');
                    const phone = String(seller.phone).replace(/\D/g,'');
                    const text = encodeURIComponent(`Olá, tenho interesse no produto "${p.title}". Vi o anúncio em: ${location.href}`);
                    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
                } catch {
                    alert('Erro ao buscar telefone do vendedor.');
                }
            });

            // comentários
            const commentFormWrapper = document.getElementById('commentFormWrapper');
            const commentList = document.getElementById('commentList');
            if (meId) commentFormWrapper?.classList.remove('hidden');

            async function loadComments() {
                try {
                    const res = await fetch(`${API}/comments?productId=${id}`);
                    const comments = await res.json();
                    commentList.innerHTML = comments.map(c => {
                        const isMine = meId && c.userId === meId;
                        const actions = [];
                        if (isMine) actions.push(`<button class="small danger" data-delete-comment="${escapeHtml(c.id)}">Excluir</button>`);
                        if (meId && !isMine) actions.push(`<button class="small secondary" data-report-comment="${escapeHtml(c.id)}">Denunciar</button>`);
                        // if not logged, no action buttons shown
                        return `<li data-comment-id="${escapeHtml(c.id)}"><strong>${escapeHtml(c.userName || 'Usuário')}</strong> <small>${new Date(c.createdAt).toLocaleString()}</small><p>${escapeHtml(c.text)}</p><div class="comment-actions">${actions.join(' ')}</div></li>`;
                    }).join('') || '<li>Sem comentários.</li>';
                } catch {
                    commentList.innerHTML = '<li>Erro ao carregar comentários.</li>';
                }
            }
            await loadComments();

            // submit comment
            document.getElementById('submitComment')?.addEventListener('click', async () => {
                const text = document.getElementById('commentText').value.trim();
                if (!text) return alert('Escreva um comentário.');
                if (!meId) {
                    if (confirm('Você precisa estar logado para comentar. Deseja entrar agora?')) location.href = 'login.html';
                    return;
                }
                try {
                    const usersRes = await fetch(`${API}/users`);
                    const users = await usersRes.json();
                    const me = users.find(u => u.id === meId);
                    const res = await fetch(`${API}/comments`, {
                        method: 'POST', headers: {'Content-Type':'application/json'},
                        body: JSON.stringify({ productId: id, userId: meId, userName: me?.name || 'Usuário', text, createdAt: Date.now() })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Erro ao enviar comentário');
                    document.getElementById('commentText').value = '';
                    await loadComments();
                } catch (err) {
                    alert(err.message);
                }
            });

            // delegated actions for comment delete/report
            document.getElementById('commentList').addEventListener('click', async (e) => {
                const delId = e.target.getAttribute('data-delete-comment');
                const reportId = e.target.getAttribute('data-report-comment');

                if (delId) {
                    if (!confirm('Excluir este comentário?')) return;
                    try {
                        const res = await fetch(`${API}/comments/${encodeURIComponent(delId)}`, { method: 'DELETE' });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Erro ao excluir comentário');
                        await loadComments();
                    } catch (err) { alert(err.message); }
                    return;
                }

                if (reportId) {
                    if (!meId) {
                        if (confirm('Você precisa estar logado para denunciar. Deseja entrar agora?')) location.href = 'login.html';
                        return;
                    }
                    const reason = prompt('Explique o motivo da denúncia do comentário (obrigatório):', '');
                    if (!reason || !reason.trim()) return alert('Motivo obrigatório.');
                    try {
                        const res = await fetch(`${API}/comment-reports`, {
                            method: 'POST', headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({ commentId: reportId, userId: meId || null, text: reason.trim(), createdAt: Date.now() })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Erro ao enviar denúncia');
                        alert('Denúncia de comentário enviada. Obrigado.');
                    } catch (err) { alert(err.message || 'Erro ao enviar denúncia.'); }
                    return;
                }
            });

            // denúncias de produto
            const reportText = document.getElementById('reportText');
            document.getElementById('submitReport')?.addEventListener('click', async () => {
                const txt = reportText.value.trim();
                if (!txt) return alert('Explique o motivo da denúncia.');
                if (!meId) {
                    if (confirm('Você precisa estar logado para denunciar. Deseja entrar agora?')) location.href = 'login.html';
                    return;
                }
                try {
                    const res = await fetch(`${API}/reports`, {
                        method: 'POST', headers: {'Content-Type':'application/json'},
                        body: JSON.stringify({ productId: id, userId: meId || null, text: txt, createdAt: Date.now() })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Erro ao enviar denúncia');
                    alert('Denúncia enviada. Obrigado.');
                    reportText.value = '';
                } catch (err) {
                    alert(err.message || 'Erro ao enviar denúncia.');
                }
            });

            // if user not logged, clicking the "Denunciar (faça login)" button redirects to login
            document.getElementById('openReportFormNotLogged')?.addEventListener('click', () => {
                if (confirm('Você precisa estar logado para denunciar. Deseja entrar agora?')) location.href = 'login.html';
            });

            document.getElementById('openReportForm')?.addEventListener('click', () => {
                document.getElementById('reportText')?.focus();
                const reportSection = document.getElementById('reportSection');
                if (reportSection) window.scrollTo({ top: reportSection.offsetTop - 20, behavior: 'smooth' });
            });

        } catch (err) {
            console.error('render product:', err);
            container.innerHTML = `<p>Erro ao carregar produto: ${escapeHtml(err.message || String(err))}</p>`;
        }
    }

    await render();

    function escapeHtml(s = '') { return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
})();
