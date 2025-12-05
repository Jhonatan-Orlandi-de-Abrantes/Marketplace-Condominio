const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

// inicializa arquivo
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
        users: [],
        products: [],
        categories: ["Eletrodomésticos", "Móveis", "Serviços", "Diversos"]
    }, null, 2));
}

function readDB() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function addUser(user) {
    const db = readDB();
    if (db.users.find(u => u.email === user.email)) {
        throw new Error("Email já cadastrado");
    }
    user.id = Date.now();
    db.users.push(user);
    writeDB(db);
    return user;
}

function getUsers() {
    return readDB().users;
}

function addProduct(product) {
    const db = readDB();
    product.id = Date.now();
    product.status = "pending";
    db.products.push(product);
    writeDB(db);
    return product;
}

function getProducts() {
    return readDB().products;
}

function getCategories() {
    return readDB().categories;
}

module.exports = {
    addUser,
    getUsers,
    addProduct,
    getProducts,
    getCategories
};
