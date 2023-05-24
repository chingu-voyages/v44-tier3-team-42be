/* If it is not important to hide login details, ie during development, the database login details can be included as shown */
/*
module.exports = {
    user: 'thoughtflowadmin',
    host: 'localhost',
    database: 'thoughtflow',
    password: 'p@ssword', 
    port: 5432,
};
*/

/*For production mode, to keep login details out of repo, the below format can be used*/
/*This obtains login details from .env file */

module.exports = {
    user: process.env.USER,
    host: process.env.HOST,
    database: process.env.DATABASE,
    password: process.env.PASSWORD,
    port: process.env.PORT
}