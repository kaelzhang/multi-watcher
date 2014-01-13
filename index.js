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
    this.watched = [];

    this._create_request_socket();
    // if the reply socket not responding, create one
    this._check_reply_socket();
}

node_util.inherits(Stares, EE);


// Create request socket
Stares.prototype._create_request_socket = function(callback) {
    this.sock = axon.socket('req');
    this.sock.format('json');
    this.sock.connect(this.port);
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

    function timeout () {
        timer = null;
        is_timeout = true;
        callback({
            code: 'ETIMEOUT',
            message: 'Request to reply socket timeout. Message: "' + type + '"',
            reason: 'timeout',
            data: {
                message: type,
                data: data
            }
        });
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

    this.sock.send({
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
            self._decode(res, callback);
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
                self._watch(msg.pid, msg.data, function (err) {
                    reply({
                        error       : err,
                        exec_pid    : process.pid,
                        request_pid : msg.pid
                    });
                });
                break;

            case 'unwatch':
                self._unwatch(msg.pid, msg.data, function (err) {
                    reply({
                        error       : err,
                        exec_pid    : process.pid,
                        request_pid : msg.pid
                    });
                });
                break;

            default:
                reply({
                    error: {
                        code: 'E',
                        message: 'unknown message.',
                        data: {

                        }
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
Stares.prototype._request_watch = function(files, callback) {
    this._send('watch', files, callback);
};


// The real watch
// @param {Object} data
Stares.prototype._watch = function (request_pid, files, callback) {
    var watcher = this._create_watcher(files);

    callback(null, {
        request_pid: request_pid,
        exec_pid: process.pid
    });
};


Stares.prototype._filter_files = function(first_argument) {
    
};


Stares.prototype._create_watcher = function(files) {
    var watcher = gaze(files);
    this._bind_watcher_events(watcher);

    return watcher;
};


Stares.prototype._bind_watcher_events = function(watcher) {
    var self = this;

    // for chokidar
    // ['add', 'addDir', 'change', 'unlink', 'unlinkDir', 'error']

    ['all', 'added', 'changed', 'deleted', 'renamed', 'error', 'end'].forEach(function (event) {
        watcher.on(event, function (data) {
            self.emit(event, data);
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

    this._request_watch(files, callback);

    return this;
};

