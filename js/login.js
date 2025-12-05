window.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("loginBtn");
    if (!btn) {
        console.error("Botão de login não encontrado");
        return;
    }
    if (!window.Auth || typeof window.Auth.login !== "function") {
        console.error("Auth.login não está disponível. Verifique se auth.js foi carregado.");
        return;
    }

    btn.addEventListener("click", () => window.Auth.login());
});
