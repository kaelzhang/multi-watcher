'use strict';

module.exports = multi_watcher;

var gaze        = require('gaze');
var code        = require('code-this');
var fs          = require('fs-sync');
var lockup      = require('lockup');
var ambassador  = require('ambassador');
// var globule     = require('globule');

var util        = require('util');
var node_path   = require('path');
var EE          = require('events').EventEmitter;


function multi_watcher (options) {
    return new MultiWatcher(options);
}


// @param {Object} options
// - data_file: {path} the file to pass data between each process
//      if options.cache is specified, 
// - no_nested: {boolean} : TODO
function MultiWatcher (options) {
    EE.call(this);

    if(!options.data_file){
        throw new Error('`options.data_file` must be specified.');
    }

    this.watcher = gaze();
    this.data_file = node_path.resolve(options.data_file);
    this.lock_file = this.data_file + '.lock';

    this.pid = process.pid;
    this.cwd = options.cwd || process.cwd();

    this._init_events();
    this._init_cross_process_events();
}

util.inherits(MultiWatcher, EE);


// Async method
// @param {Array.<string>|string} files files to be watched,
//      for better forward compatibility, should not use globule pattern
MultiWatcher.prototype.watch = function (files, callback) {
    var self = this;

    // Use a file lock to prevent write conflict
    lockup.lock(this.lock_file, function (err) {
        if(err){
            lockup.unlock(self.lock_file);
            return callback(err);
        }

        var data = self._get_data();

        makeArray(files).forEach(function (file) {
            file = node_path.resolve(self.cwd, file);

            if( !(file in data) ){
                self.watcher.add(file, function () {
                    
                });

                // {<pattern>: <pid>}
                data[file] = self.pid;
            }
        });

        // Write the data of the files being watched to the exchange file
        self._save_data(data);

        callback(null);
    });

    return this;
};


// Async method
// Assign unwatch signals to all related processes
// @param {Array.<string>|string} patterns
MultiWatcher.prototype.unwatch = function (files, callback) {
    var grouped = this._group_patterns_to_unwatch(files);
    var pid;

    for(pid in grouped){

        // Send 'unwatch' signal to the corresponding process
        ambassador.send(pid, 'unwatch', grouped[pid]);
    }

    lockup.unlock(this.lock_file);
    callback();

    return this;
};


// Private methods
//////////////////////////////////////////////////////////////////////////////////////////

MultiWatcher.prototype._init_events = function () {
    var self = this;

    // the same event as "gaze"
    this.watcher.on('all', function (event, filepath) {
        self.emit(event, filepath);
        self.emit('all', event, filepath);
    });
};


MultiWatcher.prototype._init_cross_process_events = function () {
    var self = this;

    ambassador.on('unwatch', function (pid, data) {
        self._unwatch(pid, data);
    });
};


function makeArray(subject) {
    return Array.isArray(subject) ?
        subject : 
        subject === undefined || subject === null ?
            [] :
            [subject];
}


MultiWatcher.prototype.watched = function () {
    return this.watcher.watched();    
};


MultiWatcher.prototype._get_data = function () {
    var data;

    try {
        data = require(this.data_file);

    // Silently fail
    } catch(e) {
        data = {};
    }

    return data;
};


MultiWatcher.prototype._save_data = function (data) {
    fs.write(this.data_file, 'module.exports = ' + code(data));
    lockup.unlock(this.lock_file);
};


// @param {Array.<string>|string} files
MultiWatcher.prototype._group_patterns_to_unwatch = function (files) {
    var data = this._get_data();
    var grouped = {};
    var cwd = this.cwd;

    makeArray(files).forEach(function (file) {
        file = node_path.resolve(cwd, file);
        var pid = data[file];

        if(pid){
            add_to_group(grouped, pid, file);
        }
    });

    return grouped;
}


function add_to_group(groups, key, member){
    var group = groups[key];

    if(!group){
        group = groups[key] = [];
    }

    if( ! ~ group.indexOf(member) ){
        group.push(member);
    }
};


// Private method, no arguments overloading
// Unwatch patterns
// @param {Array.<string>} files
MultiWatcher.prototype._unwatch = function (pid, files) {
    var self = this;
    lockup.lock(this.lock_file, function (err) {
        if(err){
            lockup.unlock(err);
        }

        var data = self._get_data();
        var pid = self.pid;

        // Only unwatch files belongs to the current multi-watcher
        files = makeArray(files).filter(function (pattern) {
            return data[pattern] === pid; 
        });

        files.forEach(function (file) {
            file = node_path.resolve(self.cwd, file);

            self.watcher.remove(file);
            delete data[file];
        });
        
        self._save_data(data);
    });
};





