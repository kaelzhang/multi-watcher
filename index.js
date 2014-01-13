'use strict';

module.exports = stare;

var node_fs     = require('fs');
var node_util   = require('util');
var node_path   = require('path');
var EE          = require('events').EventEmitter;

// var lockup      = require('lockup');
var axon        = require('axon');
var chokidar    = require('chokidar');


function stare (options) {
    return new Stare(options);
}


// @param {Object} options
// - port: {number}
function Stare (options) {
    if ( !options.port ) {
        throw new Error('');
    }

    this.port = options.port;
    this.timeout = options.timeout || 1000;

    this._create_request_socket();
    // if the reply socket not responding, create one
    this._check_reply_socket();
}

node_util.inherits(Stare, EE);


// Create request socket
Stare.prototype._create_request_socket = function(callback) {
    this.sock = axon.socket('req');
};


Stare.prototype._check_reply_socket = function(callback) {
    var self = this;

    this._heartbeat(function (err, alive) {
        if ( !alive ) {
            self._create_reply_socket();
        }
    });
};


// Try to send heartbeat message, it will be considered as failure if there encounters a timeout
Stare.prototype._heartbeat = function (callback) {
    this._send('heartbeat', null, function (err, res) {
        if ( err && err.reason === 'timeout' ) {
            err = null;
            res = {
                alive: false
            };
        }

        callback(null, res && res.alive);
    });
};


Stare.prototype._send = function(type, data, callback) {
    var self = this;

    var timer = setTimeout(function () {
        timer = null;
        callback({
            code: 'ETIMEOUT',
            message: 'Request to reply socket timeout.',
            reason: 'timeout'
        });

    }, this.timeout);

    this.sock.send(
        type, 
        process.pid, 
        // Axon will send the data as a Buffer,
        // so all object-type variables must be stringified first
        this._encode(data), 
        function (res) {

            // if not timeout 
            if ( timer ) {
                clearTimeout(timer);

                // `res` will be a buffer
                self._decode(res, callback);
            }
        }
    );
};


//
Stare.prototype._encode = function(object) {
    return JSON.stringify(object);
};


// Data will transfer with the form of Stream
Stare.prototype._decode = function(data, callback) {
    if ( Buffer.isBuffer(data) ) {
        data = data.toString(data);
    }

    try {
        data = JSON.parse(data);
    } catch(e) {
        return callback({
            code: 'E',
            message: 'Error parse json'
        });
    }

    var error = null;

    if ( data && data.error ) {
        error = data.error;
    }

    callback(error, data);
};


// Create reply(MASTER) socket
Stare.prototype._create_reply_socket = function() {
    this.reply_sock = axon.socket('rep');
    this._init_messages();
};


Stare.prototype._init_messages = function () {
    var self = this;

    this.reply_sock.on('message', function (action, request_pid, data, reply) {
        switch (action) {
            case 'heartbeat':
                reply({
                    alive: true
                });
                break;

            case 'watch':
                self._watch(request_pid, data, function (err) {
                    reply({
                        error       : err,
                        exec_pid    : process.pid,
                        request_pid : request_pid
                    });
                });
                break;

            case 'unwatch':
                self._unwatch(data, function (err) {
                    reply({
                        error       : err,
                        exec_pid    : process.pid,
                        request_pid : request_pid
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
//     action: {string} action type
//     data: {Object} data
// }
Stare.prototype._request_watch = function(files, callback) {
    this._send('watch', files, callback);
};


// The real watch
// @param {Object} data
Stare.prototype._watch = function (request_pid, files, callback) {
    var watcher = this._create_watcher(files);

    callback(null, {
        request_pid: request_pid,
        exec_pid: process.pid
    });
};


Stare.prototype._create_watcher = function(files) {
    var watcher = chokidar.watch(files);
    this._bind_watcher_events(watcher);

    return watcher;
};


Stare.prototype._bind_watcher_events = function(watcher) {
    var self = this;

    ['add', 'addDir', 'change', 'unlink', 'unlinkDir', 'error'].forEach(function (event) {
        watcher.on(event, function (data) {
            self.emit(event, data);
        });
    });
};


// real watch
Stare.prototype.watch = function(files, callback) {
    if ( !node_util.isArray(files) ) {
        files = [files];
    }

    this._request_watch(files, callback);
};


// prepare
Stare.prototype._load = function(callback) {
    this._check_reply_socket(function (err, alive) {
        
    });
};

