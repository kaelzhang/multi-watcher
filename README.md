[![NPM version](https://badge.fury.io/js/stares.png)](http://badge.fury.io/js/stares)
[![Build Status](https://travis-ci.org/kaelzhang/node-stares.png?branch=master)](https://travis-ci.org/kaelzhang/node-stares)
[![Dependency Status](https://gemnasium.com/kaelzhang/node-stares.png)](https://gemnasium.com/kaelzhang/node-stares)

# Stares

Stares is a inter-process node.js module to manage multiple file watchers.

With stares, you could avoid duplicately watching a same file or directory because stares instances could share with each other even if they are in different processes.


## Usage

```js
var stares = require('stares');

stares({
    port: 9807

}).on('all', function(){
    console.log('something changes');

}).watch('package.json', function(err, info){
	console.log(info.watched); // ['/path/to/package.json'];
	console.log(info.watching); // There might be other paths.
});
```


## stares(options)



## Class: stares.Stares(options)

- options `Object`
	- port `Number` socket port to handle processes
	- permanent `Boolean=false` 

### .watch(files, callback)

- files `Path|Array.<Path>` the file(s) to be watched
- callback `function(err, info)`
	- err
	- info.pid `Number` The process id who accepts the task to watch the `files`.
	- info.watched `Array.<Path>` The files has been added to the watching list just now. Notice that `stares` won't duplicately watch a certain file, so it might be different between `files` and `info.watched`
	- info.watching `Array.<Path>` The current watching list.


Watch a list of files. If the current process is the master, the instance will watch these files, otherwise, stares will delegate these files to the master instance to do this job.

So, if you use `.watch()` method in a subordinate process, the instance will never actually watch any files, but the master instance do.

### .unwatch(files, callback)

Remove files from the watching list.

The difference of the arguments from `.watch()` is that there's no `info.watched` but a `info.unwatched` to represent the files which has been removed just now.


### Event: 'watch'

Emitted when there comes a watch request

### Event: 'unwatch'

Emitted when there comes a unwatch request

### Event: 'listening'

Emitted if it is a master process and just listened to a port

### Event: 'connect'

Emitted if connected to a master process

### Events of [gaze](https://www.npmjs.org/package/gaze)

- all
- added
- changed
- deleted
- renamed
- error
- end





