// includes 
var express = require('express') ;
var bodyParser = require('body-parser') ;
var bank = require('./bank');
var morgan = require('morgan') ;
var request = require('request') ;
var braintree = require('braintree') ;
var gateway = braintree.connect({
    environment:  braintree.Environment.Sandbox,
    merchantId:   'jx8xk4dn3gp33qds',
    publicKey:    'w39hrsjzwtqqgkp7',
    privateKey:   '9b468951ac4a708266c975be7c039e1d'
});

var app = express() ;
// Logging Crap
app.use(morgan('dev')) ;
// Parse JSON, URL, ETC.
app.use(bodyParser.urlencoded({extended: true})) ;
app.use(bodyParser.json()) ;

//Routes


// Edit the global listen env var so heroku knows where to put the server
app.listen(process.env.PORT || 5000) ;


