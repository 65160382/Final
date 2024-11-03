const mysql = require('mysql2'); // ใช้ promise wrapper

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "test",
});

module.exports = db;