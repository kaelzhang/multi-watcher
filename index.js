'use strict';

module.exports = stares;

var node_fs     = require('fs');
var node_util   = require('util');
var node_path   = require('path');
var EE          = require('events').EventEmitter;

var replier     = require('replier');

var gaze = require('gaze');


function stares (options) {
    return new Stares(options);
}


// @param {Object} options
// - port: {number}
function Stares (options) {
    if ( !options.port ) {
        throw new Error('');
    }

    this.port = options.port;
    // this.timeout = options.timeout || 5000;
    this.permanent = options.permanent;

    this.watched = [];

    // if the reply socket not responding, create one
    this._init_sockets();
}

node_util.inherits(Stares, EE);


// Methods of rpc
////////////////////////////////////////////////////////////////////////////////

function once (fn, context) {
    var no;
    return function () {
        if ( !no ) {
            no = true;
            return fn && fn.apply(context || null, arguments);
        }
    };
}


Stares.prototype._init_sockets = function() {
    var self = this;

    this._check_reply_socket(function (err) {
        if ( !err ) {
            self._create_request_socket(function (err) {
                if ( !err ) {
                    self.emit('_ready');
                    self.is_ready = true;
                }
            });
        }
    });
};


Stares.prototype._check_reply_socket = function(callback) {
    var self = this;

    // function cb (err) {
    //     if ( err ) {
    //         return callback(err);
    //     }

    //     // emit ready event
    //     self.emit('ready');
    //     self.is_ready = true;

    //     callback(null);
    // }

    replier.check(this.port, function (alive) {
        if ( !alive ) {
            return self._create_reply_socket(callback);
        }

        callback(null);
    });
};


// Create reply(MASTER) socket
Stares.prototype._create_reply_socket = function(callback) {
    var self = this;
    var cb = once(callback);

    this.is_master = true;

    this.reply_sock = replier
    .server()
    .on('error', function (err) {
        self.emit('error', err);
        cb(err);
    })
    .on('listening', function () {
        self.emit('listening');
        cb(null);
    })
    .listen(this.port);

    this._init_messages();
};


// Create request socket
Stares.prototype._create_request_socket = function(callback) {
    var cb = once(callback);
    this.socket = replier.client()
    .on('error', function (err) {
        self.emit('error', err);
        cb(err);
    })
    .on('connect', function () {
        self.emit('connect');
        cb(null);
    })
    .connect(this.port);
};


Stares.prototype._init_messages = function () {
    var self = this;

    this.reply_sock.on('message', function (msg, reply) {
        self.emit('message', msg);

        switch (msg.task) {
            case 'heartbeat':
                reply(null, {
                    alive: true
                });
                break;

            case 'watch':
                self._watch(msg.pid, msg.data, reply);
                break;

            case 'unwatch':
                self._unwatch(msg.pid, msg.data, reply);
                break;

            default:
                reply({
                    code: 'EUNKNOWNTASK',
                    message: 'Stares: unknown task: "' + msg.task + '"',
                    data: msg
                });
        }
    });
};


Stares.prototype._send = function(type, data, callback) {
    var self = this;

    this._ready(function () {
        self.socket.send({
            task: type,
            data: data,
            pid: process.pid

        }, function (err, data) {
            if ( !self.is_master && !self.permanent ) {
                self.socket.end();
            }
            
            callback && callback(err, data);
        });
    });
};


Stares.prototype._ready = function(callback) {
    if ( this.is_ready ) {
        callback();
    } else {
        this.once('_ready', callback);
    }
};


// Tell the master server to watch the files
// Data requested:
// {
//     task: {string} task type
//     data: {Object} data
// }
Stares.prototype._request = function(task, files, callback) {
    this._send(task, files, callback);
};


// Methods about file watching
////////////////////////////////////////////////////////////////////////////////

// The real watch
// @param {Object} data
Stares.prototype._watch = function (request_pid, files, reply) {
    files = this._filter_files(files);

    if ( files.length ) {
        this._add_watch(files);
    }

    self.emit('watch', request_pid, files);

    reply(null, {
        pid: process.pid,
        watched: files,
        watching: this._get_watched()
    });
};


Stares.prototype._unwatch = function (request_pid, files, reply) {
    if ( files.length ) {
        this._remove_watch(files);
        this.watched = this.watched.filter(function (watched) {
            return !~ files.indexOf(watched); 
        });
    }

    self.emit('unwatch', request_pid, files);

    reply(null, {
        pid: process.pid,
        unwatched: files,
        watching: this._get_watched()
    });
};


Stares.prototype._get_watched = function() {
    return [].concat(this.watched);
};


Stares.prototype._filter_files = function(files) {
    var watched = this.watched;

    return files.filter(function (file) {
        if ( !~ watched.indexOf(file) ) {
            watched.push(file);
            return true;
        }
    });
};


Stares.prototype._add_watch = function(files) {
    if ( !this.watcher ) {
        this.watcher = gaze();
        this._bind_watcher_events(this.watcher);
    }

    this.watcher.add(files);
};


Stares.prototype._remove_watch = function(files) {
    var watcher = this.watcher;

    if ( !watcher ) {
        return;
    }

    files.forEach(function (file) {
        watcher.remove(file);
    });
};


Stares.prototype._bind_watcher_events = function(watcher) {
    var self = this;

    // for chokidar
    // ['add', 'addDir', 'change', 'unlink', 'unlinkDir', 'error']

    // gaze events
    ['all', 'added', 'changed', 'deleted', 'renamed', 'error', 'end'].forEach(function (event) {
        watcher.on(event, function () {
            var args = [event];
            args = args.concat.apply(args, arguments);

            self.emit.apply(self, args);
        });
    });
};


// Public methods
////////////////////////////////////////////////////////////////////////////////

// real watch
// @param {function(err, data)} callback
// - data: {
//     pid: {number} the id of the process who accept the request
//     watched: {Array.<path>} new files has been watched just now
//     watching: {Array.<path>} the watching files
// }    
Stares.prototype.watch = function(files, callback) {
    if ( !node_util.isArray(files) ) {
        files = [files];
    }

    this._request('watch', files, callback);

    return this;
};


// @param {function(err, data)} callback
// - data: {
//     pid: {number}
//     unwatched: {Array.<path>}
//     watching: {Array.<path>}
// }
Stares.prototype.unwatch = function(files, callback) {
    if ( !node_util.isArray(files) ) {
        files = [files];
    }

    this._request('unwatch', files, callback);

    return this;
};

