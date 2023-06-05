var express = require('express');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var crypto = require('crypto');
var router = express.Router();
var dbAccess = require('../dbConfig');

const Pool = require('pg').Pool
const pool = new Pool(dbAccess);
/*
const pool = new Pool({
  user: 'thoughtflowadmin',
  host: 'localhost',
  database: 'thoughtflow',
  password: 'p@ssword',
  port: 5432,
})
*/

//Passport authentication logic

passport.use(new LocalStrategy(function verify(username, password, cb) {
  console.log('I would think this would be first');
  
    pool.query('SELECT * FROM users WHERE email = $1', [ username ], function(error, results) {
      
    if (error) { return cb(error); }
    if (!results.rows[0]) { 
      //console.log('seems like no user found with matching details');
      return cb(null, false, { message: 'Incorrect username or password.' }); }
      

    crypto.pbkdf2(password, results.rows[0].salt, 310000, 32, 'sha256', function(err, hashedPassword) {
      if (error) { return cb(error); }
      if (!crypto.timingSafeEqual(results.rows[0].hashed_password, hashedPassword)) {
        //console.log('seems like password did not match');
        return cb(null, false, { message: 'Incorrect username or password.' });
        
      }
      //console.log(results.rows[0]);
      return cb(null, results.rows[0], { message: 'login successful.' });
      
    });
  });
}));

//Serialise user so they stay logged in during session

passport.serializeUser(function(user, cb) {
  //console.log('serializeUser called');
  //console.log(user);
  process.nextTick(function() {
    //console.log(cb(null, { id: user.id, username: user.username }));
    cb(null, { id: user.id, username: user.username });
  });
});

passport.deserializeUser(function(user, cb) {
  //console.log('deserializeUser called');
  process.nextTick(function() {
    return cb(null, user);
  });
});



// TEMPORARY FIX
/*
Passport is a bit of a black box and it seems that it expects the username rather than the email for login verification
in the verification login above (lines 22 to 40), it expects to be passed a username via req body. If no username is included
with the req body, the api returns a "not found" error message without even calling the verification function.
So what the code below (function testFunction) does is copy the email passed from the front end and creates a username KV pair 
in the req body with the email as the value. Note, in the verification code (lines 22 to 40) I changed the database query to 
check the email instead of the username. Obviously we'll need a better permanent solution, but this is a fix that enables other
work to be done
*/
function testFunction (req, res, next) {
  console.log(req.body);
  //req.body.username = req.body.email;
  console.log(req.body);
  next()
  
}



router.post('/login', function(req, res, next) {
         passport.authenticate('local', {successMessage: true, failureMessage: true}, function(err, user, info) {
          
           if (err) { return next(err) }
           if (!user) { 
            passport.authenticate('allFailed') 
            return res.status(500).json(info)
          
          }
          
          //passport.authenticate.strategy.success();
          req.logIn(user, function(err) {
            if (err) { return next(err); }
            return res.json(info);
          })
                    
         })(req, res, next);
       });



/* Previous login post route
router.post('/login', passport.authenticate('local'));
previous login post route ENDS*/




router.post('/logout', function(req, res, next) {
  
  req.logout(function(err) {
    if (err) { return next(err); }
    
    res.json({message: 'logged out'});
  });
});

router.get('/signup', function(req, res, next) {
  res.render('signup');
});

/* Sign up user*/

router.post('/signup', function(req, res, next){
  const { username, email } = req.body
  var salt = crypto.randomBytes(16);  
  crypto.pbkdf2(req.body.password, salt, 310000, 32, 'sha256', function(err, hashedPassword){    
    if (err){ return next(err); }
    pool.query('INSERT INTO users (username, email, hashed_password, salt) VALUES ($1, $2, $3, $4) RETURNING *', [username, email, hashedPassword, salt], 
    (error, results) => {
      if (error) {
        throw error
      }
      var user = {
        id: this.lastID,
        username: req.body.username,
        email: email
      };
      /*SO THIS WOULD BE A GOOD THING TO RETURN TO, I DON'T GET HOW THERE COULD BE A REQ.LOGIN BECAUSE LOGIN ISN'T PART OF THE
      REQUEST BODY BUT WHO KNOWS, I'LL COME BACK TO THIS
      req.login(user, function(err) {
        if (err) { return next(err); }
        res.redirect('/');
      })*/      
      res.redirect('/');
  })    
  })
})


module.exports = router;