const pg = require('pg');
const dotenv = require('dotenv').config();

/*accesses database login details from .env file via dbConfig.js to establish new client pool*/

var dbAccess = require('./dbConfig');

const Pool = require('pg').Pool
//let pgPool = new Pool(dbAccess);

let pgPool = new Pool({
    user: process.env.USER,
    host: process.env.HOST,
    database: process.env.DATABASE,
    password: process.env.PASSWORD,
    port: process.env.PORT
})

module.exports = pgPool;