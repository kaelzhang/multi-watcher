'use strict';

module.exports = stare;

var node_fs     = require('fs');
var node_util   = require('util');
var node_path   = require('path');
var EE          = require('events').EventEmitter;

var lockup      = require('lockup');
var axon        = require('axon');
var chokidar    = require('chokidar');


function stare (options) {
    return new Stare(options);
}


// @param {Object} options
// - data_file: {path} the file to pass data between each process
//      if options.cache is specified,
// - port: {number}
function Stare (options) {
    if(!options.data_file){
         throw new Error('`options.data_file` must be specified.');
    }

    if ( !options.port ) {
        throw new Error('');
    }

    this.port = options.port;

    this.watchers = {};

    // this.watcher = gaze();
    // this.data_file = node_path.resolve(options.data_file);
    // this.lock_file = this.data_file + '.lock';

    // this.pid = process.pid;
    // this.cwd = options.cwd || process.cwd();

    // this._init_events();
    // this._init_cross_process_events();

    // var self = this;

    // process.on('exit', function () {
    //     // clean all
    //     self._unwatch_all();
    // });
}

util.inherits(Stare, EE);


// Create reply socket
Stare.prototype._create_reply_socket = function() {
    this.sock = axon.socket('rep');
    this.master = true;

    this._init_messages();
};


// Create request socket
Stare.prototype._create_request_socket = function() {
    this.sock = axon.socket('req');
};


Stare.prototype.is_master = function() {
    return !!this.master;
};


Stare.prototype._init_messages = function () {
    var self = this;

    this.sock.on('message', function (action, request_pid, data, reply) {
        switch (action) {
            case 'heartbeat':
                reply({
                    alive: true
                });
                break;

            case 'watch':
                self._watch(data, function (err) {
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


Stare.prototype._get_data = function (callback) {
    var data;

    try {
        data = require(this.data_file);

    // Silently fail
    } catch(e) {
        data = {};
    }

    callback(null, data);
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


Stare.prototype._send = function(type, data, callback) {
    var self = this;

    this.sock.send(type, process.pid, data, function (res) {
        self._decode(res, callback);
    });
};


// The real watch
// @param {Object} data
Stare.prototype._watch = function (files, callback) {
// {
//         files: files,
//         cwd: this.cwd,
//         pid: process.pid

//     }

    var watcher = this._create_watcher(files);

    callback(null);
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


Stare.prototype._check_reply_socket = function(callback) {
    this._heartbeat(callback);
};


Stare.prototype._heartbeat = function (callback) {
    this._send('heartbeat', null, function (res) {
        callback(null, res && res.alive);
    });
};


// real watch
Stare.prototype.watch = function(files, callback) {



    if ( this.is_master() ) {
        this._watch(files, callback);
    } else {
        this._request_watch(files, callback);
    }
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

