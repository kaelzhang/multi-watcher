# Multi-watcher

Multi-watcher is a inter-process node.js module to manage multiple file watchers.

With multi-watcher, you could avoid duplicately watching a same file or directory because multi-watcher instances could share with each other even if they are in different processes.


## Installation

	npm install multi-watcher --save
	
## Usage

```js
var multi_watcher = require('multi-watcher');
var watcher = multi_watcher({
	data_file: 'data.js'
});
```


## Methods

### watcher.watch(patterns, callback)

### watcher.unwatch(patterns, callback)

