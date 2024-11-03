const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/',(req,res)=>{
    db.query('SELECT * FROM products', (err, results) => {
        if (err) {
            console.error('Error fetching products:', err);
            res.status(500).send('Server Error');
            return;
        }
        res.render('index', { products: results }  );
    });
});

router.get('/product/:id', (req, res) => {
    const productId = req.params.id;
    db.query('SELECT * FROM products WHERE id = ?', [productId], (err, result) => {
        if (err) {
            console.error('Error fetching product details:', err);
            res.status(500).send('Server Error');
            return;
        }
        const productname = result[0].name; // เอาชื่อสินค้ามาแสดงผลบน title
        res.render('product', { product: result[0], productname });
    });
});

router.post('/chart', (req, res) => {
    const { productId, quantity } = req.body;

    db.query('SELECT * FROM products WHERE id = ?', [productId], (err, result) => {
        if (err) {
            console.error('Error fetching product details:', err);
            res.status(500).send('Server Error');
            return;
        }
            const product = result[0];
            const totalPrice = parseInt(product.price) * quantity;

        // ตรวจสอบว่ามีเซสชันสำหรับตะกร้าสินค้าอยู่หรือไม่ หากไม่มีให้สร้างใหม่
        if (!req.session.cart) {
            req.session.cart = [];
        }

        // เพิ่มสินค้าลงในเซสชัน
        req.session.cart.push({
            product_id: productId,
            name: product.name,
            image: product.image,
            price: product.price,
            quantity: quantity,
            total: totalPrice
        });

         // ส่งข้อมูลเพื่อแสดงในหน้า chart
        res.render('chart', { 
            products: req.session.cart,
            totalPrice: req.session.cart.reduce((sum, item) => sum + item.total, 0), // คำนวณราคารวมใหม่
        });   
    });
});

router.get('/getchart', (req, res) => {
    const products = req.session.cart || [];

    //การคำนวณราคารวมทั้งหมดของสินค้าในตะกร้า
    const totalPrice = products.reduce((sum, product) => {
        return sum + (product.price * product.quantity);
    }, 0);

    res.render('chart', { products: products, totalPrice: totalPrice });
});

router.post('/delete-from-cart', (req, res) => {
    const { productId } = req.body;

    // ตรวจสอบว่ามี cart อยู่ในเซสชันหรือไม่
    if (!req.session.cart) {
        req.session.cart = [];
    }

    // ลบสินค้าออกจาก cart
    req.session.cart = req.session.cart.filter(item => item.product_id != productId);

    // รีเฟรชหน้า chart หลังจากลบสินค้า
    res.redirect('/getchart');
});

router.post('/order', (req, res) => {
    // ดึงข้อมูลจาก session
    const customerId = req.session.user.id;
    const products = req.session.cart || []; // ดึงข้อมูลสินค้าจาก session
    const currentDate = new Date();

    // console.log(products);
    
    // คำนวณราคารวม
    const totalPrice = products.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 1. สร้าง order ใหม่
    const sql = `INSERT INTO orders (customer_id, totalprice, date) VALUES (?, ?, ?)`;
    
    db.query(sql, [customerId, totalPrice, currentDate], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }

        const orderId = result.insertId;

        // console.log(orderId);

        // 2. เพิ่มสินค้าในตาราง order_items
        const orderItemsSql = `INSERT INTO order_items (order_id, products_id, quantity, price) VALUES ?`;
        const orderItemsValues = products.map(item => [orderId, item.product_id, item.quantity, item.price]);

        db.query(orderItemsSql, [orderItemsValues], (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

            // 3. อัปเดตสต็อกสินค้าในตาราง products
            products.forEach(item => {
                const updateStockSql = `UPDATE products SET stock = stock - ? WHERE id = ?`; // ตรวจสอบชื่อคอลัมน์ให้ถูกต้อง
                db.query(updateStockSql, [item.quantity, item.product_id], (err, result) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: err.message });
                    }
                });
            });
            
            // 4. ล้างตะกร้าใน session
            req.session.cart = [];
            
            res.redirect('/');
        });
    });
});

//แสดงหน้า login
router.get('/login',(req,res)=>{
    res.render('login')
});

// บันทึกผู้ใช้ที่ login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Query ฐานข้อมูลเพื่อตรวจสอบผู้ใช้
    db.query('SELECT * FROM customer WHERE username = ?', [username], (err, results) => {
        if (err) {
            console.error('Error fetching user:', err);
            res.status(500).send('Server Error');
            return;
        }
        
        if (results.length > 0) {
            const user = results[0];

            // ตรวจสอบรหัสผ่าน
            if (password === user.password) {
                // บันทึกข้อมูลผู้ใช้ใน session
                req.session.user = {
                    id: user.id, // เพิ่ม customer_id เข้าไป
                    username: user.username,
                };
                // เปลี่ยนเส้นทางไปยังหน้าแรก
                res.redirect('/');
            } else {
                res.status(401).send('Invalid username or password');
            }
        } else {
            res.status(401).send('Invalid username or password');
        }
    });
});

//logout เพื่อล้าง session 
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Logout Error');
        }
        res.clearCookie('connect.sid'); // ลบ cookie ที่เก็บ session ID
        res.redirect('/');
    });
});

module.exports = router;