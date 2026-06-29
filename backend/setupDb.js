const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function setup() {
  // Open database connection
  const db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  console.log('Database connected.');

  // Create tables
  await db.exec(`
    DROP TABLE IF EXISTS sales_data;
    CREATE TABLE sales_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      category TEXT,
      revenue REAL,
      profit REAL
    );

    DROP TABLE IF EXISTS user_metrics;
    CREATE TABLE user_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      active_users INTEGER,
      new_users INTEGER,
      retention_rate REAL
    );
  `);

  console.log('Tables created.');

  // Generate 30 days of mock data
  const categories = ['Electronics', 'Clothing', 'Home', 'Books'];
  const stmtSales = await db.prepare('INSERT INTO sales_data (date, category, revenue, profit) VALUES (?, ?, ?, ?)');
  const stmtUsers = await db.prepare('INSERT INTO user_metrics (date, active_users, new_users, retention_rate) VALUES (?, ?, ?, ?)');

  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // Sales data
    for (const cat of categories) {
      const revenue = Math.floor(Math.random() * 5000) + 1000;
      const profit = revenue * (0.1 + Math.random() * 0.3);
      await stmtSales.run(dateStr, cat, revenue, profit);
    }

    // User metrics
    const active_users = Math.floor(Math.random() * 10000) + 5000;
    const new_users = Math.floor(active_users * (0.05 + Math.random() * 0.1));
    const retention_rate = 0.6 + Math.random() * 0.3;
    await stmtUsers.run(dateStr, active_users, new_users, retention_rate);
  }

  await stmtSales.finalize();
  await stmtUsers.finalize();

  console.log('Mock data inserted successfully.');
  await db.close();
}

setup().catch(err => {
  console.error('Error setting up DB:', err);
});
