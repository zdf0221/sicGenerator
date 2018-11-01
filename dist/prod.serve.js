/**
 * Created by adminpc on 10/31/18.
 */
var express = require('express')
var config = require('../config/index')

var port = process.env.PORT || config.build.port
var app = express()

var router = express.Router()

router.get('/', function (req, res, next) {
  req.url = '/index.html'
  next();
})

app.use(express.static('../dist'))

module.exports = app.listen(port, function (err) {
  if(err){
    console.log(err)
    return
  }
  console.log('start listen')
})
