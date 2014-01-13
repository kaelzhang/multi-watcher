# Stares

Stares is a inter-process node.js module to manage multiple file watchers.

With stares, you could avoid duplicately watching a same file or directory because stares instances could share with each other even if they are in different processes.


## Installation

	npm install stares --save
	
## Usage

```js
var stares = require('stares');
var watcher = stares({
	data_file: 'data.js'
});
```


## Methods

### watcher.watch(patterns, callback)

### watcher.unwatch(patterns, callback)

