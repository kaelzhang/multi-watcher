'use strict';

var expect = require('chai').expect;

var stares = require('../');

var action = process.argv[2] || 'watch';

stares({
    port: 9099

}).on('all', function () {
    console.log('changed', arguments)
    
}).on('message', function(){
    console.log('receive message', arguments)

})[action]('package.json', function () {
    console.log(action, arguments)
})