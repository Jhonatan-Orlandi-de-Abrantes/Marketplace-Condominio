async function loadProducts() {
    try {
        const products = await Storage.listProducts();
        renderProducts(products); 
    } catch (err) {
        alert(err.message);
    }
}
