'use strict';

module.exports = stare;

var node_fs     = require('fs');
var node_util   = require('util');
var node_path   = require('path');
var EE          = require('events').EventEmitter;

var lockup      = require('lockup');
var axon        = require('axon');


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

    this.sock.on('message', function (msg, reply) {
        msg = msg || {};

        switch (msg.action) {
            case 'heartbeat':
                reply({
                    alive: true
                });
                break;

            case 'watch':
                self._watch(msg.data, function (err) {
                    reply({
                        error: err
                    });
                });
                break;

            case 'unwatch':
                self._unwatch(msg.data, function (err) {
                    reply({
                        error: err
                    });
                });

                break;

            default:
                reply({
                    error: {
                        code: 'E',
                        message: 'unknown message.'
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


Stare.prototype._heartbeat = function (callback) {
    this.sock.send({
        action: 'heartbeat'

    }, function (res) {
        callback(null, res && res.alive);
    });
};


// Tell the master server to watch the files
Stare.prototype._request_watch = function(files, callback) {
    // body...
};


// The real watch
Stare.prototype._watch = function (data, callback) {
    
};


Stare.prototype._check_reply_socket = function(callback) {
    // body...
};


// real watch
Stare.prototype.watch = function(files, callback) {
    // body...
};


// // Async method
// // @param {Array.<string>|string} files files to be watched,
// //      for better forward compatibility, should not use globule pattern
// Stare.prototype.watch = function (files, callback) {
//     var self = this;

//     function cb (err){
//         callback(err);
//         self.emit('watch', {
//             err: err,
//             files: files
//         });

//         cb = null;
//     };

//     // Use a file lock to prevent write conflict
//     lockup.lock(this.lock_file, function (err) {
//         if(err){
//             lockup.unlock(self.lock_file);
//             return cb(err);
//         }

//         var data = self._get_data();

//         makeArray(files).forEach(function (file) {
//             file = node_path.resolve(self.cwd, file);

//             if(file in data){
//                 var owner_pid = data[file];
//                 if(owner_pid === self.pid){
//                     // If already watched by the current process, continue.
//                     // Notice that there might be dirty data in the data file
//                     return;
//                 }else{

//                     // If already watched by another process, try to notify the process to unwatch it
//                     ambassador.send(owner_pid, 'unwatch', file);
//                 }
//             }

//             self.watcher.add(file, function () {
//             });

//             // {<pattern>: <pid>}
//             data[file] = self.pid;
//         });

//         // Write the data of the files being watched to the exchange file
//         self._save_data(data);

//         cb(null);
//     });

//     return this;
// };


// // Async method
// // Assign unwatch signals to all related processes
// // @param {Array.<string>|string} patterns
// Stare.prototype.unwatch = function (files, callback) {
//     var grouped = this._group_patterns_to_unwatch(files);
//     var pid;

//     for(pid in grouped){

//         // Send 'unwatch' signal to the corresponding process
//         ambassador.send(pid, 'unwatch', grouped[pid]);
//     }

//     lockup.unlock(this.lock_file);
//     callback();

//     return this;
// };


// // Private methods
// //////////////////////////////////////////////////////////////////////////////////////////

// Stare.prototype._init_events = function () {
//     var self = this;

//     // the same event as "gaze"
//     this.watcher.on('all', function (event, filepath) {
//         self.emit(event, filepath);
//         self.emit('all', event, filepath);
//     });
// };


// Stare.prototype._init_cross_process_events = function () {
//     var self = this;

//     ambassador.on('unwatch', function (pid, data) {
//         self._unwatch(pid, data);
//     });
// };


// function makeArray(subject) {
//     return Array.isArray(subject) ?
//         subject : 
//         subject === undefined || subject === null ?
//             [] :
//             [subject];
// }


// Stare.prototype.watched = function () {
//     return this.watcher.watched();
// };





// Stare.prototype._save_data = function (data) {
//     node_fs.writeFileSync(this.data_file, 'module.exports = ' + code(data));
//     lockup.unlock(this.lock_file);
// };


// // @param {Array.<string>|string} files
// Stare.prototype._group_patterns_to_unwatch = function (files) {
//     var data = this._get_data();
//     var grouped = {};
//     var cwd = this.cwd;

//     makeArray(files).forEach(function (file) {
//         file = node_path.resolve(cwd, file);
//         var pid = data[file];

//         if(pid){
//             add_to_group(grouped, pid, file);
//         }
//     });

//     return grouped;
// }


// function add_to_group(groups, key, member){
//     var group = groups[key];

//     if(!group){
//         group = groups[key] = [];
//     }

//     if( ! ~ group.indexOf(member) ){
//         group.push(member);
//     }
// };


// // Private method, no arguments overloading
// // Unwatch patterns
// // @param {Array.<string>} files
// Stare.prototype._unwatch = function (pid, files) {
//     var self = this;
//     lockup.lock(this.lock_file, function (err) {
//         if(err){
//             lockup.unlock(err);
//         }else{
//             var data = self._get_data();
//             var pid = self.pid;

//             // Only unwatch files belongs to the current stare
//             files = makeArray(files).filter(function (pattern) {
//                 return data[pattern] === pid; 
//             });

//             files.forEach(function (file) {
//                 file = node_path.resolve(self.cwd, file);

//                 self.watcher.remove(file);
//                 delete data[file];
//             });
            
//             self._save_data(data);
//         }

//         self.emit('unwatch', {
//             err: err,
//             files: files,
//             from: pid
//         });
//     });
// };


// Stare.prototype._unwatch_all = function () {
//     var data = this._get_data();
//     var file;
//     var pid;

//     for(file in data){
//         pid = data[file];

//         if(pid === this.pid){
//             this.watcher.remove(file);
//             delete data[file];
//         }
//     }

//     this._save_data(data);
// };


