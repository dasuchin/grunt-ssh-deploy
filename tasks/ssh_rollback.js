/*
* grunt-ssh-deploy
* https://github.com/dcarlson/grunt-ssh-deploy
*
* Copyright (c) 2014 Dustin Carlson
* Licensed under the MIT license.
*/

'use strict';

var path = require('path');

module.exports = function(grunt) {

	grunt.registerTask('ssh_rollback', 'Begin Rollback', function() {
		var done = this.async();
        var Connection = require('ssh2');
        var async = require('async');
	var extend = require('extend');

        var defaults = {
            current_symlink: 'current',
            port: 22,
            max_buffer: 400 * 1024,
            release_root: 'releases',
            release_subdir: '/'
        };

        var options = extend({}, defaults, grunt.config.get('environments').options,
            grunt.config.get('environments')[this.args]['options']);

		var c = new Connection();
		c.on('connect', function() {
			grunt.log.subhead('Connecting :: ' + options.host);
		});
		c.on('ready', function() {
			grunt.log.subhead('Connected :: ' + options.host);
			// execution of tasks
			execCommands(options,c);
		});
		c.on('error', function(err) {
			grunt.log.subhead("Error :: " + options.host);
			grunt.log.errorlns(err);
			if (err) {throw err;}
		});
		c.on('close', function(had_error) {
			grunt.log.subhead("Closed :: " + options.host);

			return true;
		});
		c.connect(options);

		var execCommands = function(options, connection){

            // executes a remote command via ssh
            var execRemote = function(cmd, showLog, next){
                connection.exec(cmd, function(err, stream) {
                    if (err) {
                        grunt.log.errorlns(err);
                        grunt.log.subhead('ERROR ROLLING BACK. CLOSING CONNECTION.');
                    }
                    stream.on('data', function(data, extended) {
                        grunt.log.debug((extended === 'stderr' ? 'STDERR: ' : 'STDOUT: ') + data);
                    });
                    stream.on('end', function() {
                        grunt.log.debug('REMOTE: ' + cmd);
                        if(!err) {
                            next();
                        }
                    });
                });
            };

            var updateSymlink = function(callback) {
                var delete_symlink = 'rm -rf ' + path.posix.join(options.deploy_path, options.current_symlink);
                var set_symlink = 'cd ' + options.deploy_path + ' && t=`ls -t1 ' + path.posix.join(options.deploy_path, options.release_root, options.release_subdir) + ' | sed -n 2p` && ln -s ' + path.posix.join(options.deploy_path, options.release_root, options.release_subdir) + '$t ' + options.current_symlink;
                var command = delete_symlink + ' && ' + set_symlink;
                grunt.log.subhead('--------------- UPDATING SYM LINK');
                grunt.log.subhead('--- ' + command);
                execRemote(command, options.debug, callback);
            };

            var deleteRelease = function(callback) {
                var command = 't=`ls -t1 ' + path.posix.join(options.deploy_path, options.release_root, options.release_subdir) + ' | sed -n 1p` && rm -rf ' + path.posix.join(options.deploy_path, options.release_root, options.release_subdir) + '$t/';
                grunt.log.subhead('--------------- DELETING RELEASE');
                grunt.log.subhead('--- ' + command);
                execRemote(command, options.debug, callback);
            };

            // closing connection to remote server
            var closeConnection = function(callback) {
                connection.end();

                callback();
            };
    
            async.series([
                updateSymlink,
                deleteRelease,
                closeConnection
            ], done);
        };
    });
};
