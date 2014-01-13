# Stares [![NPM version](https://badge.fury.io/js/stares.png)](http://badge.fury.io/js/stares) [![Build Status](https://travis-ci.org/kaelzhang/node-stares.png?branch=master)](https://travis-ci.org/kaelzhang/node-stares) [![Dependency Status](https://gemnasium.com/kaelzhang/node-stares.png)](https://gemnasium.com/kaelzhang/node-stares)

Stares is a inter-process node.js module to manage multiple file watchers.

With stares, you could avoid duplicately watching a same file or directory because stares instances could share with each other even if they are in different processes.


## Installation

	npm install stares --save
	
## Usage

```js
var stares = require('stares');

stares({
    port: 9807

}).on('all', function(){
    console.log('something changes');

}).watch('package.json', function(err, msg){
});
```


## Instance Methods

### .watch(files, callback)
### .unwatch(files, callback)

