const express = require('express');
const mysql = require('mysql2/promise'); // 用 promise 版本
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3003;

// 允许跨域请求
app.use(cors({
    origin: '*',
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

app.get('/api/orders', async (req, res) => {
    const query = `
    SELECT 
        g.user_id, 
        p.product_name,
        t1.topping_name AS topping1_name,
        t2.topping_name AS topping2_name,
        i.quantity
    FROM item i
    JOIN gorder g ON i.order_id = g.order_id  -- 通过 order_id 关联 gorder 表
    JOIN product p ON i.product_id = p.id AND g.project_id = p.project_id  -- 通过 product_id 和 project_id 关联 product 表
    LEFT JOIN topping t1 ON i.topping_id_1 = t1.topping_id AND g.project_id = t1.project_id  -- 关联 topping1
    LEFT JOIN topping t2 ON i.topping_id_2 = t2.topping_id AND g.project_id = t2.project_id  -- 关联 topping2
    ORDER BY g.user_id, i.order_id`;

    try {
        const [results] = await pool.query(query);
        res.json(results);
    } catch (error) {
        console.error('获取订单数据失败:', error);
        res.status(500).json({ message: '获取订单数据失败', error: error.stack });
    }
});

// 启动服务器
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
});