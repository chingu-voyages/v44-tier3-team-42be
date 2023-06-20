const pg = require('pg');
const dotenv = require('dotenv').config();
const Pool = require('pg').Pool

/*accesses database login details from .env file to establish new client pool*/


let pgPool = new Pool({
    user: process.env.USER,
    host: process.env.HOST,
    database: process.env.DATABASE,
    password: process.env.PASSWORD,
    port: process.env.PORT
})

//console.log(pgPool.options);

module.exports = pgPool;

