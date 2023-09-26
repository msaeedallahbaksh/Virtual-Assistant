const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'containers-us-west-56.railway.app',
  user: 'root',
  password: '',
  port: 3306,
  database: 'railway',
});

module.exports = pool.promise();
