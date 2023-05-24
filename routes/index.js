var express = require('express');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var crypto = require('crypto');
var router = express.Router();
var dbAccess = require('../dbConfig');

const Pool = require('pg').Pool
const pool = new Pool(dbAccess);

var journalDivider = require('../journals/journalDivider');


router.get('/', function(req, res, next) {
  if (!req.user) { return res.render('home'); }
  console.log(req.user)
  next();
  res.render('index', { user: req.user });
});

/*Post journal entry */

//deleted ", ensureLoggedIn" from between "'/save-journal'," amd "function(req, res, next)"


router.post('/save-journal', async function(req, res, next) {
  const client = await pool.connect()
  
  const userId = req.user.id;  
  const title = req.body.title;
  //const entry = req.body.journalEntry;
  const url = req.body.url;
  //const numberOfPages = journalDivider.journalDivider(entry).length;
  //const functionText = journalDivider.journalDivider.toString();
  //const firstArray = journalDivider.journalDivider(entry[0]);


  const text = 'INSERT INTO journal_references(user_id, journal_title, cover_image) VALUES($1, $2, $3) RETURNING *'
  const values = [userId, title, url]

  try {
    const res = await client.query(text, values)
    console.log(res.rows[0])
    // { name: 'brianc', email: 'brian.m.carlson@gmail.com' }
  } catch (err) {
    console.log(err.stack)
  }

  //client.query
  //res.locals.messages = [`title entered: ${title}, journal entry: ${entry}, number of pages: ${numberOfPages}`];

  res.locals.messages = [`title entered: ${title}, url: ${url}`];
  res.locals.hasMessages = true;
  //console.log(res.locals)
  //res.redirect('/');
  return res.status(200).json({ message: 'details saved' });
  //.redirect('/')
  //.redirect('/').json({ message: 'details saved' });
  
  //return res.render('index', { user: req.user });
  client.release()
  next();
  //cb({ message: 'Incorrect username or password.' });
  /*db.run('DELETE FROM todos WHERE owner_id = ? AND completed = ?', [
    req.user.id,
    1
  ], function(err) {
    if (err) { return next(err); }
    return { message: 'let\'s see how this goes'};
  });*/
});


module.exports = router;