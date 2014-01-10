# Stare

Stare is a inter-process node.js module to manage multiple file watchers.

With stare, you could avoid duplicately watching a same file or directory because stare instances could share with each other even if they are in different processes.


## Installation

	npm install stare --save
	
## Usage

```js
var stare = require('stare');
var watcher = stare({
	data_file: 'data.js'
});
```


## Methods

### watcher.watch(patterns, callback)

### watcher.unwatch(patterns, callback)

