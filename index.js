const express = require('express')
const bodyParser = require('body-parser')
const app = express()
//const port = 3000
const port = process.env.PORT || 3000
const cors = require('cors');
var path = require('path');
const pgPool = require('./dbConfig');


// Allow CORS for known origins
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'development'
        ? process.env.DEV_ORIGIN
        : process.env.PROD_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })
);

const logger = require('morgan');
const passport = require('passport');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);


//authorisation and routes logic import
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');

//assign public directory
app.use(express.static(path.join(__dirname, 'public')));


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// NOTE: cookie-parser middleware is no longer needed 
// for express-session module to work as of version 1.5.0+
// app.use(cookieParser('keyboard cat'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json())
app.use(
   bodyParser.urlencoded({
     extended: true,
   })
 )

app.use(session({
  store: new pgSession ({
    // connect-pg-simple options:
    pool : pgPool,
    tableName : "session"
  }),
  secret: 'keyboard cat',
  saveUninitialized: true,
  //secret: process.env.FOO_COOKIE_SECRET,
  resave: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
  // Insert express-session options here
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(passport.authenticate('session'));


app.use('/', indexRouter);
app.use('/', authRouter);


  app.listen(port, () => {
    console.log(`App running on port ${port}.`)
  })

  