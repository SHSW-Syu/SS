const express = require('express');
const mysql = require('mysql2/promise'); // 用 promise 版本
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3003;

// 允许跨域请求
app.use(cors({
    origin: ['http://localhost:3000'],
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type'
}));
app.use(bodyParser.json());

// 创建 MySQL 连接池
const pool = mysql.createPool({
    host: process.env.DB_HOST, 
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 获取商品信息
app.get('/api/products/:projectName', async (req, res) => {
    const { projectName } = req.params;

    const query = `
    SELECT 
        p.id,
        p.product_name,
        p.product_price,
        p.topping_group,
        p.topping_limit,
        JSON_ARRAYAGG(
            JSON_OBJECT(
                'topping_id', t.topping_id,
                'topping_name', t.topping_name,
                'topping_price', t.topping_price
            )
        ) as toppings
    FROM product p
    JOIN project pr ON p.project_id = pr.project_id
    LEFT JOIN topping t ON p.topping_group = t.topping_group
    WHERE pr.project_name = ?
    GROUP BY p.id, p.product_name, p.product_price, p.topping_group`;

    try {
        const [results] = await pool.query(query, [projectName]);
        res.json(results);
    } catch (err) {
        console.error('查询失败:', err);
        res.status(500).json({ message: '获取商品数据失败' });
    }
});

// 处理订单
app.post('/receive', async (req, res) => {
    console.log('🔹 Received request body:', req.body); // 先打印收到的数据

    try {
        const { projectId, userId, totalPrice, items } = req.body;

        // 检查数据是否完整
        if (!projectId || !userId || !items || items.length === 0) {
            console.error('🚨 Missing or invalid data:', req.body);
            return res.status(400).json({ error: 'Invalid order data' });
        }

        console.log('✅ Valid order data:', { projectId, userId, totalPrice, items });

        // 获取数据库连接
        const connection = await pool.getConnection();
        console.log('✅ Database connection established');

        await connection.beginTransaction();

        // 插入订单
        console.log('🔹 Inserting order...');
        const [orderResult] = await connection.execute(
            'INSERT INTO gorder (project_id, user_id, total_price, status, cashier) VALUES (?, ?, ?, ?, ?)',
            [projectId, userId, totalPrice, 0, 1]
        );
        const orderId = orderResult.insertId;
        console.log('✅ Order inserted, orderId:', orderId);

        // 插入订单详情
        for (const item of items) {
            console.log('🔹 Inserting item:', item);
            await connection.execute(
                'INSERT INTO item (order_id, product_id, topping1_id, topping2_id, quantity) VALUES (?, ?, ?, ?, ?)',
                [orderId, item.productId, item.topping1Id || null, item.topping2Id || null, item.quantity]
            );
        }

        await connection.commit();
        console.log('✅ Order committed successfully');
        res.json({ success: true, orderId });

    } catch (error) {
        console.error('🚨 Error processing order:', error);
        res.status(500).json({ error: 'Failed to process order', details: error.message });
    }
});


// 启动服务器
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
});