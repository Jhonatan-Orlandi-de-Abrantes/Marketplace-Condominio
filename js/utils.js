window.Utils = (() => {
    function formatPrice(n) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0));
    }
    function formatDate(ts) {
        const d = new Date(ts);
        return d.toLocaleString('pt-BR');
    }
    function todayKey() {
        const d = new Date();
        return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
    }
    function paginate(items, start, count) {
        return items.slice(start, start + count);
    }
    function normalize(str) {
        return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return { formatPrice, formatDate, todayKey, paginate, normalize };
})();
