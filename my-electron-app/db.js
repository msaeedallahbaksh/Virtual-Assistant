const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'containers-us-west-56.railway.app',
  user: 'root',
  password: 'DomHmzlyy7FjAdjJLpIE',
  port: 5913,
  database: 'railway',
});

module.exports = pool.promise();
