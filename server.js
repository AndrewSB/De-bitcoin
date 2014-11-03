// includes
var express = require('express') ;
var bodyParser = require('body-parser') ;
var morgan = require('morgan') ;
var app = express() ;
var parseString = require('xml2js').parseString;
var request = require('request');
var Firebase = require('firebase');
var config = require('./config');
var mongoose = require('mongoose'),
	Schema = mongoose.Schema;

var balanceRef = new Firebase('https://debitcoin.firebaseio.com/balances');
var bitcoinRef = new Firebase('https://debitcoin.firebaseio.com/bitcoins');
var bitcoinAmountRef = new Firebase('https://debitcoin.firebaseio.com/bitcoinAmount');

mongoose.connect(config.db);

var balanceSchema = new Schema({
	balance: Number,
	versionKey: false
});
var balanceTransaction = mongoose.model('Balance', balanceSchema);

var bitcoinSchema = new Schema({
	bitcoin: Number,
	versionKey: false
});
var bitcoinTransaction = mongoose.model('Bitcoin', bitcoinSchema);


// Logging Crap
app.use(morgan('dev')) ;
// Parse JSON, URL, ETC.
app.use(bodyParser.urlencoded({extended: true})) ;
app.use(bodyParser.json()) ;

//Routes
var currentBitcoin = 0;

var updateFirebase = setInterval(function() {
	balanceTransaction.find({}, function(err, result) {
		balanceRef.set(JSON.parse(JSON.stringify(result)));
		bitcoinTransaction.find({}, function(err, result) {
			bitcoinRef.set(JSON.parse(JSON.stringify(result)));
			request.get('https://blockchain.info/merchant/'+config.guid+'/balance?password='+config.bcpass+'', function(err, resp) {
				if (err){
					console.log("error: " + err);
					updateFirebase;
					return;
				}
				currentBitcoin = JSON.parse(resp.body).balance / 100000000;
				console.log(currentBitcoin);
				bitcoinAmountRef.set(currentBitcoin);
				updateFirebase;
			});
		});
	});
}, 2000);
updateFirebase;

var intervalFunction = setInterval(function(){
	request.post({
		url: "https://financialdatafeed.platform.intuit.com/v1/institutions/26115/logins",
		oauth: config.oauth,
		json:  config.credentials
		}, function(err,response, body) {
			if (err || response.statusCode != "201") {
				console.log("Error: " + JSON.stringify(response));
				intervalFunction;
				return;
			}
			var accountID = response.body.accounts[0].accountId;
			request.get({
				url: "https://financialdatafeed.platform.intuit.com/v1/accounts/" + accountID,
				headers: {"Content-Type": "application/json"},
				oauth: config.oauth
			}, function(err, response, body){
				if (err || response.statusCode > 300) {
					console.log("Error: " + JSON.stringify(response));
					intervalFunction;
					return;
				}
				parseString(body, function(err, result){
					if (result == null) {
						console.log("Error: " + JSON.stringify(response));
						intervalFunction;
						return;
					}
					var currentBalance = result["ns8:AccountList"]["ns2:BankingAccount"][0].balanceAmount[0];
					balanceTransaction.findOne({}, {}, {sort: {'_id': -1}}, function(err, prevBalance){
						if (prevBalance == null || Math.abs(currentBalance - prevBalance.balance) > 0) {
							var newBalance = new balanceTransaction({balance: currentBalance});
							newBalance.save(function(err, newBalance){
								if (err){
									console.log("Error: " + err);
								}
								else {
									console.log("New Balance: " + newBalance.balance);
								}
								if (prevBalance != null && (newBalance.balance - prevBalance.balance) < 0) {
									request.get("https://blockchain.info/ticker", function(err, response, body){
										var bitChange = JSON.parse(body)["USD"]["15m"];
										var bitToTransfer = Math.abs(newBalance.balance - prevBalance.balance) / bitChange;
										if (bitToTransfer < currentBitcoin) {
											var newBitcoin = new bitcoinTransaction({bitcoin: bitToTransfer});
											newBitcoin.save(function(err, newBitcoin) {
												console.log("New Bitcoin Transfer: " + bitToTransfer);
												//Transfer Bitcoin here
												request.get("https://blockchain.info/merchant/"+config.guid+"/payment?password="+config.bcpass+"&to="+config.toguid+"&amount="+Math.round(bitToTransfer * 100000000), function(err, resp){
													console.log(resp);
													intervalFunction;
													return;
												});
											});
										}
									});
								};
								intervalFunction;
								return;
							});
						}
						intervalFunction;
						return;
					});
					intervalFunction;
					return;
				})
			})
	});
}, 20000);

intervalFunction;

app.use(express.static(__dirname + "/public"));

// Edit the global listen env var so heroku knows where to put the server
app.listen(process.env.PORT || 5000) ;
