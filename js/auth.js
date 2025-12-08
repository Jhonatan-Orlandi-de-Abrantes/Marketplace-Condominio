window.Auth = (function() {
    const API = 'http://localhost:4000';

    function applyPhoneMask(input) {
        if (!input) return;
        input.addEventListener('input', () => {
            let v = input.value.replace(/\D/g, '').slice(0,11);
            if (v.length <= 2) input.value = v;
            else if (v.length <= 6) input.value = `${v.slice(0,2)} ${v.slice(2)}`;
            else input.value = `${v.slice(0,2)} ${v.slice(2,7)}-${v.slice(7)}`;
        });
    }
    window.applyPhoneMask = applyPhoneMask;

    async function login(email, password) {
        const res = await fetch(`${API}/users`);
        const users = await res.json();
        const user = users.find(u => u.email === email && u.password === password);
        if (!user) throw new Error('Credenciais inválidas');
        localStorage.setItem('session', JSON.stringify({ userId: user.id }));
        requireLoginUI();
        return user;
    }

    async function register(payload) {
        const res = await fetch(`${API}/register`, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro no cadastro');
        return data;
    }

    function requireLoginUI() {
        try {
            const session = JSON.parse(localStorage.getItem('session') || '{}');
            const userId = session.userId;
            if (!userId) return;
            fetch(`${API}/users`).then(r => r.json()).then(users => {
                const user = users.find(u => u.id === userId);
                if (!user) return;
                const loginLink = document.getElementById('loginLink');
                if (loginLink) { loginLink.textContent = user.name; loginLink.href = 'profile.html'; }
                const profileLink = document.getElementById('profileLink');
                if (profileLink) profileLink.classList.add('hidden');
                const adminLink = document.getElementById('adminLink');
                if (user.isAdmin && adminLink) adminLink.classList.remove('hidden');
            }).catch(e => console.warn('requireLoginUI fetch failed', e));
        } catch (err) { console.warn('requireLoginUI failed', err); }
    }

    async function currentUser() {
        const session = JSON.parse(localStorage.getItem('session') || '{}');
        const userId = session.userId;
        if (!userId) return null;
        const res = await fetch(`${API}/users`);
        const users = await res.json();
        return users.find(u => u.id === userId) || null;
    }

    function ensureAdminOrRedirect() {
        const session = JSON.parse(localStorage.getItem('session') || '{}');
        const userId = session.userId;
        if (!userId) { alert('Você precisa estar logado.'); location.href = 'login.html'; return false; }
        fetch(`${API}/users`).then(r => r.json()).then(users => {
            const user = users.find(u => u.id === userId);
            if (!user || !user.isAdmin) { alert('Acesso negado. Redirecionando...'); location.href = 'index.html'; }
        }).catch(() => { location.href = 'index.html'; });
    }

    function logout() {
        localStorage.removeItem('session');
        localStorage.removeItem('sessionUser');
        location.href = 'index.html';
    }

    // Cadastro via formulário (mecanismo único)
    async function registerUserFromForm() {
        const name = document.getElementById('name')?.value?.trim();
        const email = document.getElementById('email')?.value?.trim();
        const password = document.getElementById('password')?.value;
        const phoneRaw = document.getElementById('phone')?.value;
        const block = document.getElementById('block')?.value?.trim();
        const apt = document.getElementById('apt')?.value?.trim();

        if (!name || !email || !password || !phoneRaw || !block || !apt) {
            alert('Preencha todos os campos obrigatórios.');
            return;
        }

        const phone = String(phoneRaw).replace(/\D/g, '');
        if (!/^\d{11}$/.test(phone)) {
            alert('Telefone inválido. Use DDD + número (11 dígitos).');
            return;
        }

        try {
            const res = await fetch(`${API}/register`, {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ name, email, password, phone, block, apt })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const msg = (data && data.error) ? data.error : `Erro no cadastro (HTTP ${res.status})`;
                throw new Error(msg);
            }

            // marca que houve cadastro bem-sucedido e guarda email para sugestão de login
            try {
                localStorage.setItem('justRegistered', JSON.stringify({ email }));
            } catch (e) {
                // se storage falhar, não impede o fluxo
                console.warn('Não foi possível gravar justRegistered:', e);
            }

            // redireciona para login
            location.href = 'login.html';
        } catch (err) {
            alert(err.message || 'Erro ao cadastrar');
            console.error('Erro no cadastro:', err);
        }
    }
    window.registerUserFromForm = registerUserFromForm;

    // binds de UI quando DOM pronto
    document.addEventListener('DOMContentLoaded', () => {
        // máscara de telefone no cadastro (se existir campo)
        const phoneInput = document.getElementById('phone');
        if (phoneInput) applyPhoneMask(phoneInput);

        // botão login
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', async (ev) => {
                ev.preventDefault();
                const email = document.getElementById('loginEmail')?.value?.trim();
                const password = document.getElementById('loginPassword')?.value;
                if (!email || !password) { alert('Preencha email e senha.'); return; }
                try {
                    await login(email, password);
                    alert('Login realizado com sucesso!');
                    location.href = 'index.html';
                } catch (err) {
                    alert(err.message || 'Erro no login');
                }
            });
        }

        // botão cadastrar (bind automático além do onclick)
        const registerBtn = document.getElementById('registerBtn');
        if (registerBtn) {
            registerBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                registerUserFromForm();
            });
        }

        // botão criar anúncio (exige login)
        const createAdBtn = document.getElementById('createAdBtn');
        if (createAdBtn) {
            createAdBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                const session = JSON.parse(localStorage.getItem('session') || '{}');
                if (!session.userId) {
                    if (confirm('Você precisa estar logado para criar um anúncio. Deseja entrar agora?')) {
                        location.href = 'login.html';
                    }
                    return;
                }
                location.href = 'profile.html';
            });
        }
    });

    return { applyPhoneMask, login, register, requireLoginUI, currentUser, ensureAdminOrRedirect, logout };
})();
