const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3003; // 使用 Railway 提供的端口或默认端口

// 使用中间件
app.use(cors({
  origin: '*', // 允许所有来源
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // 允许的请求方法
}));
app.use(bodyParser.json());

// 创建 MySQL 连接
const db = mysql.createConnection({
    host: process.env.DB_HOST, // 从环境变量读取
    user: process.env.DB_USER, // 从环境变量读取
    password: process.env.DB_PASSWORD, // 从环境变量读取
    database: process.env.DB_NAME // 从环境变量读取
});

// 连接到数据库
db.connect((err) => {
    if (err) {
        console.error('Database connection failed: ' + err.stack);
        return;
    }
    console.log('Connected to database.');
});

app.get('/api/products/:projectName', (req, res) => {
  const { projectName } = req.params;
  
  // 构造查询 SQL 语句
const query = `
SELECT 
    p.id,
    p.product_name,
    p.product_price,
    p.topping_price,
    t.topping_id,
    t.topping_name,
    t.topping_price
FROM 
    product p
JOIN 
    project pr 
ON 
    p.project_id = pr.project_id
LEFT JOIN 
    topping t
ON 
    p.topping_group = t.topping_group
WHERE 
    pr.project_name = ?`;

  // 执行查询
  db.execute(query, [projectName], (err, results) => {
      if (err) {
          console.error('查询失败:', err);
          return res.status(500).json({ message: '获取商品数据失败' });
      }

      // 返回查询结果
      res.json(results);
  });
});


// 启动服务器
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
});
