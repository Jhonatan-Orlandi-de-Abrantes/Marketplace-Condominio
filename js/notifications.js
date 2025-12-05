window.Notifications = (() => {
    const S = window.Storage;
    function notifyApproval(product, aprovado, message) {
        Storage.listUsers().then(users => {
            const u = users.find(x => x.id === user.id);
            });

        const owner = users.find(u => u.id === product.userId);
        if (owner) {
            S.addNotification(owner.id, aprovado ? 'aprovado' : 'rejeitado',
                aprovado ? `Seu produto "${product.title}" foi aprovado.` :
                                     `Seu produto "${product.title}" foi reprovado: ${message}`);
        }
    }
    function notifyComment(product, commenterName) {
        Storage.listUsers().then(users => {
            const u = users.find(x => x.id === user.id);
            });
        const owner = users.find(u => u.id === product.userId);
        if (owner) {
            S.addNotification(owner.id, 'comment', `Seu produto "${product.title}" recebeu um comentário de ${commenterName}.`);
        }
    }
    return { notifyApproval, notifyComment };
})();
