window.Utils = (function() {
  function normalize(s = '') { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function formatPrice(v = 0) { try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v)); } catch { return String(v); } }
  function paginate(arr = [], offset = 0, limit = 12) { return arr.slice(offset, offset + limit); }
  return { normalize, formatPrice, paginate };
})();
