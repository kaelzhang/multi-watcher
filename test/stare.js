'use strict';

var expect = require('chai').expect;

var stares = require('../');

stares({
    port: 9099

}).on('all', function () {
    console.log('changed', arguments)
    
}).watch('package.json', function () {
    console.log('watched', arguments)
})