/*
* grunt-ssh-deploy
* https://github.com/dcarlson/grunt-ssh-deploy
*
* Copyright (c) 2014 Dustin Carlson
* Licensed under the MIT license.
*/

'use strict';

module.exports = function(grunt) {

	grunt.registerTask('ssh_deploy', 'Begin Deployment', function() {
		this.async();
        var Connection = require('ssh2');
        var moment = require('moment');
        var timestamp = moment().format('YYYYMMDDHHmmssSSS');
        var async = require('async');
        var done = this.async();

        var options = grunt.config.get('environments')[this.args]['options'];

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
            done();

			return true;
		});
		c.connect(options);

        var setVariables = function(command) {
            command = command.replace('#{current_path}', options.deploy_path + '/' + options.current_symlink);
            return command;
        };

		var execCommands = function(options, connection){
            var childProcessExec = require('child_process').exec;

            var execLocal = function(cmd, next) {
                var nextFun = next;
                childProcessExec(cmd, function(err, stdout, stderr){
                    grunt.log.debug(cmd); 
                    grunt.log.debug('stdout: ' + stdout);
                    grunt.log.debug('stderr: ' + stderr);
                    if (err !== null) {
                        grunt.log.errorlns('exec error: ' + err);
                        grunt.log.subhead('Error deploying. Closing connection.');

                        deleteRelease(closeConnection);
                    } else {
                        next();
                    }
                });
            };

            // executes a remote command via ssh
            var execRemote = function(cmd, showLog, next){
                connection.exec(cmd, function(err, stream) {
                    if (err) {
                        grunt.log.errorlns(err);
                        grunt.log.subhead('ERROR DEPLOYING. CLOSING CONNECTION AND DELETING RELEASE.');

                        deleteRelease(closeConnection);
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

            var runBefore = function(callback) {
                if (options.run_before) {
                    var command = options.run_before;
                    command = setVariables(command);
                    grunt.log.subhead('--------------- PREPEARE ');
                    grunt.log.subhead('--- ' + command);
                    execRemote(command, options.debug, callback);
                } else {
                    callback();
                }
            };

            var createReleases = function(callback) {
                var command = 'mkdir -p ' + options.deploy_path + '/releases && cd ' + options.deploy_path + '/releases && mkdir ' + timestamp;
                grunt.log.subhead('--------------- CREATING NEW RELEASE');
                grunt.log.subhead('--- ' + command);
                execRemote(command, options.debug, callback);
            };

            var scpBuild = function(callback) {
                var remote_string = options.username + '@' + options.host + ':' + options.deploy_path + '/releases/' + timestamp + '/';
                var command = 'scp -P ' + options.port + ' -r ' + options.local_path + '/. ' + remote_string;
                grunt.log.subhead('--------------- UPLOADING NEW BUILD');
                grunt.log.subhead('--- ' + command);
                execLocal(command, callback);
            };

            var updateSymlink = function(callback) {
                var delete_symlink = 'rm -rf ' + options.deploy_path + '/' + options.current_symlink;
                var set_symlink = 'cd ' + options.deploy_path + ' && ln -s releases/' + timestamp + ' ' + options.current_symlink;
                var command = delete_symlink + ' && ' + set_symlink;
                grunt.log.subhead('--------------- UPDATING SYM LINK');
                grunt.log.subhead('--- ' + command);
                execRemote(command, options.debug, callback);
            };

            var runAfter = function(callback) {
                if (options.run_after) {
                    var command = options.run_after;
                    command = setVariables(command);
                    grunt.log.subhead('--------------- PREPEARE SYSTEM FOR RELEASE ');
                    grunt.log.subhead('--- ' + command);
                    execRemote(command, options.debug, callback);
                } else {
                    callback();
                }
            };

            var deleteRelease = function(callback) {
                var command = 'rm -rf ' + options.deploy_path + '/releases/' + timestamp + '/';
                grunt.log.subhead('--------------- DELETING RELEASE');
                grunt.log.subhead('--- ' + command);
                execRemote(command, options.debug, callback);
            };

            // closing connection to remote server
            var closeConnection = function(callback) {
                connection.end();

                return true;
            };
    
            async.series([
                runBefore,
                createReleases,
                scpBuild,
                updateSymlink,
                runAfter,
                closeConnection
            ]);
        };
    });
};