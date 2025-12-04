window.Auth = (() => {
    const S = window.Storage;

    function register() {
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim().toLowerCase();
        const password = document.getElementById('regPassword').value;
        const phone = document.getElementById('regPhone').value.trim();
        const block = document.getElementById('regBlock').value.trim();
        const apt = document.getElementById('regApt').value.trim();

        if (!name || !email || !password || !phone || !block || !apt) {
            alert('Preencha nome, email, senha, telefone, bloco e apartamento.');
            return;
        }
        const users = S.getUsers();
        if (users.find(u => u.email === email)) {
            alert('Email já cadastrado.');
            return;
        }
        const user = {
            id: crypto.randomUUID(),
            name, email, password, phone, block, apt,
            isAdmin: false,
            publicProfile: false,
            photo: null,
            blocked: false,
            createdAt: Date.now(),
            createdTodayCount: 0,
            lastCreateDay: null,
        };
        users.push(user);
        S.setUsers(users);
        S.setSession({ userId: user.id });
        location.href = 'index.html';
    }

    async function login() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        const res = await fetch('http://localhost:4000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Erro ao logar');
            return;
        }

        // guarda token para usar nas próximas requisições
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        location.href = 'index.html';
    }

    function recoverPassword() {
        const email = document.getElementById('recoverEmail').value.trim().toLowerCase();
        const users = S.getUsers();
        const user = users.find(u => u.email === email);
        if (!user) {
            alert('Email não encontrado.');
            return;
        }
        S.addNotification(user.id, 'recover', 'Solicitação de recuperação de senha registrada. Procure o admin.');
        alert('Solicitação registrada. Você receberá instruções via admin/local.');
    }

    function currentUser() {
        const session = S.getSession();
        if (!session) return null;
        const users = S.getUsers();
        return users.find(u => u.id === session.userId) || null;
    }

    function requireLoginUI() {
        const u = currentUser();
        const loginLink = document.getElementById('loginLink');
        const profileLink = document.getElementById('profileLink');
        const adminLink = document.getElementById('adminLink');

        if (u) {
            loginLink.textContent = u.name; 
            loginLink.href = 'profile.html';
            if (profileLink) profileLink.classList.add('hidden');
            if (u.isAdmin && adminLink) adminLink.classList.remove('hidden');
        }
    }

    function ensureAdminOrRedirect() {
        const u = currentUser();
        if (!u || !u.isAdmin) {
            alert('Acesso negado. Redirecionando...');
            location.href = 'index.html';
            return false;
        }
        return true;
    }

    function toggleAdmin(targetUserId, makeAdmin) {
        const actor = currentUser();
        if (!actor || !actor.isAdmin) return alert('Apenas admins podem alterar.');
        if (actor.id === targetUserId) return alert('Você não pode alterar sua própria permissão.');
        const users = S.getUsers();
        const target = users.find(u => u.id === targetUserId);
        if (!target) return;
        target.isAdmin = !!makeAdmin;
        S.setUsers(users);
        S.addAdminLog(actor.id, makeAdmin ? 'promote' : 'demote', targetUserId, '');
        alert(makeAdmin ? 'Usuário promovido a admin.' : 'Usuário removido de admin.');
    }

    function logout() {
        S.setSession(null);
        location.href = 'index.html';
    }

    return { register, login, recoverPassword, currentUser, requireLoginUI, ensureAdminOrRedirect, toggleAdmin, logout };
})();
