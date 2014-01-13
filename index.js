'use strict';

module.exports = stares;

var node_fs     = require('fs');
var node_util   = require('util');
var node_path   = require('path');
var EE          = require('events').EventEmitter;

// var lockup      = require('lockup');
var axon        = require('axon');
axon.codec.define('json', {
    encode: JSON.stringify,
    decode: JSON.parse
});

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
    this.timeout = options.timeout || 3000;
    this.permanent = options.permanent;

    this.watched = [];

    // if the reply socket not responding, create one
    this._check_reply_socket();
}

node_util.inherits(Stares, EE);


Stares.prototype._get_sock = function () {
    if ( !this.sock ) {
        this._create_request_socket();
    }

    return this.sock;
};


// Create request socket
Stares.prototype._create_request_socket = function(callback) {
    var sock = axon.socket('req');
    sock.format('json');
    sock.connect(this.port);

    this.sock = sock;
};


// Create reply(MASTER) socket
Stares.prototype._create_reply_socket = function() {
    this.reply_sock = axon.socket('rep');
    this.reply_sock.format('json');
    this.reply_sock.bind(this.port);

    this._init_messages();
};


Stares.prototype._check_reply_socket = function(callback) {
    var self = this;

    this._heartbeat(function (err, alive) {
        if ( !alive ) {
            self._create_reply_socket();
        }

        // fire the ready 
        self.emit('ready');
        self.is_ready = true;
    });
};


// Try to send heartbeat message, it will be considered as failure if there encounters a timeout
Stares.prototype._heartbeat = function (callback) {
    this._send('heartbeat', null, function (err, res) {
        if ( err && err.reason === 'timeout' ) {
            err = null;
            res = {
                alive: false
            };
        }

        callback(null, res && res.alive);

    }, true);
};


Stares.prototype._send = function(type, data, callback, no_wait ) {
    var self = this;
    var timer;
    var is_timeout;
    var wait;
    var sock = this._get_sock();

    function timeout () {
        timer = null;
        is_timeout = true;
        cb({
            code: 'ETIMEOUT',
            message: 'Request to reply socket timeout. Message: "' + type + '"',
            reason: 'timeout',
            data: {
                message: type,
                data: data
            }
        });
    }

    function cb(err, data) {
        // if is not permanent, close the socket
        if ( !self.permanent ) {
            sock.close();
        }

        callback(err, data);
    }

    function remove_listener () {
        self.removeListener('ready', start_timer);
    }

    function start_timer () {
        timer = setTimeout(timeout, self.timeout);
    }

    if ( no_wait || this.is_ready ) {
        start_timer();
    } else {
        wait = true;
        this.once('ready', start_timer);
    }

    sock.send({
        task: type,
        data: data,
        pid: process.pid

    }, function (res) {
        // if not timeout 
        if ( timer ) {
            clearTimeout(timer);
        }

        if ( wait ) {
            remove_listener();
        }

        if ( !is_timeout ) {
            // `res` will be a buffer
            self._decode(res, cb);
        }
    });
};


// Data will transfer with the form of Stream
Stares.prototype._decode = function(data, callback) {
    var error = null;

    if ( data ){
        if (data.error ) {
            error = data.error;
        }

        delete data.error;
    }

    callback(error, data);
};


Stares.prototype._init_messages = function () {
    var self = this;

    this.reply_sock.on('message', function (msg, reply) {
        self.emit('message', msg);

        switch (msg.task) {
            case 'heartbeat':
                reply({
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
                    error: {
                        code: 'EUNKNOWNTASK',
                        message: 'Stares: unknown task: "' + msg.task + '"',
                        data: msg
                    }
                });
        }
    });
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


// The real watch
// @param {Object} data
Stares.prototype._watch = function (request_pid, files, callback) {
    files = this._filter_files(files);

    if ( files.length ) {
        this._add_watch(files);
    }

    callback({
        error: null,
        pid: process.pid,
        watched: files,
        watching: this._get_watched()
    });
};


Stares.prototype._unwatch = function (request_pid, files, callback) {
    if ( files.length ) {
        this._remove_watch(files);
        this.watched = this.watched.filter(function (watched) {
            return !~ files.indexOf(watched); 
        });
    }

    callback({
        error: null,
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
Stares.prototype.watch = function(files, callback) {
    if ( !node_util.isArray(files) ) {
        files = [files];
    }

    this._request('watch', files, callback);

    return this;
};


Stares.prototype.unwatch = function(files, callback) {
    if ( !node_util.isArray(files) ) {
        files = [files];
    }

    this._request('unwatch', files, callback);

    return this;
};

