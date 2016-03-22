/*
 * grunt-ssh-deploy
 * https://github.com/dcarlson/grunt-ssh-deploy
 *
 * Copyright (c) 2014 Dustin Carlson
 * Licensed under the MIT license.
 */

'use strict';

var path = require('path');

var getScpOptions = function(options) {
    var scpOptions = {
        port: options.port,
        host: options.host,
        username: options.username,
        readyTimeout: options.readyTimeout
    };

    if (options.privateKey) {
        scpOptions.privateKey = options.privateKey;
        if (options.passphrase) {
            scpOptions.passphrase = options.passphrase;
        }
    }
    else if (options.password) {
        scpOptions.password = options.password;
    }
    else if (options.agent) {
        scpOptions.agent = options.agent;
    } else {
        throw new Error('Agent, Password or private key required for secure copy.');
    }

    return scpOptions;
};

module.exports = function(grunt) {

    grunt.registerTask('ssh_deploy', 'Begin Deployment', function() {
        var done = this.async();
        var Connection = require('ssh2');
        var client = require('scp2');
        var moment = require('moment');
        var timestamp = moment().format('YYYYMMDDHHmmssSSS');
        var async = require('async');
        var childProcessExec = require('child_process').exec;
        var extend = require('extend');
        
        var defaults = {
            current_symlink: 'current',
            port: 22,
            zip_deploy: false,
            max_buffer: 200 * 1024,
            readyTimeout: 20000,
            release_subdir: '/',
            release_root: 'releases',
            tag: timestamp,
            exclude: []
        };

        var options = extend({}, defaults, grunt.config.get('environments').options,
            grunt.config.get('environments')[this.args]['options']);

        var releaseTag = typeof options.tag == 'function' ? options.tag() : options.tag;
        // Just a security check, avoiding empty tags that could mess up the file system
        if (releaseTag == '') {
            releaseTag = defaults.tag;
        }

        var releasePath = path.posix.join(options.deploy_path, options.release_root, options.release_subdir, releaseTag);

        // scp defaults
        client.defaults(getScpOptions(options));

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
            var execLocal = function(cmd, next) {
            	var execOptions = {
            		maxBuffer: options.max_buffer	
            	};
            	
                childProcessExec(cmd, execOptions, function(err, stdout, stderr){
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

            var zipForDeploy = function(callback) {
              if (!options.zip_deploy) return callback();

              childProcessExec('tar --version', function (error, stdout, stderr) {
                if (!error) {
                  var isGnuTar = stdout.match(/GNU tar/);
                  var command = "tar -czvf ./deploy.tgz";
                  
                  if(options.exclude.length) {
                    options.exclude.forEach(function(exclusion) {
                      command += ' --exclude=' + exclusion;
                    });
                  }

                  if (isGnuTar) {
                    command += " --exclude=deploy.tgz --ignore-failed-read --directory=" + options.local_path + " .";
                  } else {
                    command += " --directory=" + options.local_path + " .";
                  }

                  grunt.log.subhead('--------------- ZIPPING FOLDER');
                  grunt.log.subhead('--- ' + command);

                  execLocal(command, callback);
                }
              });
            };

            var onBeforeDeploy = function(callback){
                if (typeof options.before_deploy === "undefined") return callback();
                var command = options.before_deploy;
                grunt.log.subhead("--------------- RUNNING PRE-DEPLOY COMMANDS");
                if (command instanceof Array) {
                    async.eachSeries(command, function(command, callback) {
                        grunt.log.subhead('--- ' + command);
                        execRemote(command, options.debug, callback);
                    }, callback);
                } else {
                    grunt.log.subhead('--- ' + command);
                    execRemote(command, options.debug, callback);
                }
            };

            var createReleases = function(callback) {
                var command = 'mkdir -p ' + releasePath;
                grunt.log.subhead('--------------- CREATING NEW RELEASE');
                grunt.log.subhead('--- ' + command);
                execRemote(command, options.debug, callback);
            };

            var scpBuild = function(callback) {
                var build = (options.zip_deploy) ? 'deploy.tgz' : options.local_path;
                grunt.log.subhead('--------------- UPLOADING NEW BUILD');
                grunt.log.debug('SCP FROM LOCAL: ' + build
                    + '\n TO REMOTE: ' + releasePath);
                client.scp(build, {
                    path: releasePath
                }, function (err) {
                    if (err) {
                        grunt.log.errorlns(err);
                    } else {
                        grunt.log.subhead('--- DONE UPLOADING');
                        callback();
                    }
                });
            };

            var unzipOnRemote = function(callback) {
                if (!options.zip_deploy) return callback();
                var goToCurrent = "cd " + releasePath;
                var untar = "tar -xzvf deploy.tgz";
                var cleanup = "rm " + path.posix.join(releasePath, "deploy.tgz");
                var command = goToCurrent + " && " + untar + " && " + cleanup;
                grunt.log.subhead('--------------- UNZIP ZIPFILE');
                grunt.log.subhead('--- ' + command);
                execRemote(command, options.debug, callback);
            };

            var updateSymlink = function(callback) {
                var delete_symlink = 'rm -rf ' + path.posix.join(options.deploy_path, options.current_symlink);
                var set_symlink = 'ln -s ' + releasePath + ' ' + path.posix.join(options.deploy_path, options.current_symlink);
                var command = delete_symlink + ' && ' + set_symlink;
                grunt.log.subhead('--------------- UPDATING SYM LINK');
                grunt.log.subhead('--- ' + command);
                execRemote(command, options.debug, callback);
            };

            var deleteRelease = function(callback) {
                var command = 'rm -rf ' + releasePath;
                grunt.log.subhead('--------------- DELETING RELEASE');
                grunt.log.subhead('--- ' + command);
                execRemote(command, options.debug, callback);
            };

            var onAfterDeploy = function(callback){
                if (typeof options.after_deploy === "undefined") return callback();
                var command = options.after_deploy;
                grunt.log.subhead("--------------- RUNNING POST-DEPLOY COMMANDS");
                if (command instanceof Array) {
                    async.eachSeries(command, function(command, callback) {
                        grunt.log.subhead('--- ' + command);
                        execRemote(command, options.debug, callback);
                    }, callback);
                } else {
                    grunt.log.subhead('--- ' + command);
                    execRemote(command, options.debug, callback);
                }
            };

            var remoteCleanup = function(callback) {
                if (typeof options.releases_to_keep === 'undefined') return callback();
                if (options.releases_to_keep < 1) options.releases_to_keep = 1;

                var command = "cd " + path.posix.join(options.deploy_path, options.release_root, options.release_subdir) + " && rm -rfv `ls -r " + path.posix.join(options.deploy_path, options.release_root, options.release_subdir) + " | awk 'NR>" + options.releases_to_keep + "'`";
                grunt.log.subhead('--------------- REMOVING OLD BUILDS');
                grunt.log.subhead('--- ' + command);
                execRemote(command, options.debug, callback);
            };

            var deleteZip = function(callback) {
                if (!options.zip_deploy) return callback();
                var command = 'rm deploy.tgz';
                grunt.log.subhead('--------------- LOCAL CLEANUP');
                grunt.log.subhead('--- ' + command);
                execLocal(command, callback);
            };

            // closing connection to remote server
            var closeConnection = function(callback) {
                connection.end();

                client.close();
                client.__sftp = null;
                client.__ssh = null;

                callback();
            };

            async.series([
                onBeforeDeploy,
                zipForDeploy,
                createReleases,
                scpBuild,
                unzipOnRemote,
                updateSymlink,
                onAfterDeploy,
                remoteCleanup,
                deleteZip,
                closeConnection
            ], function () {
                done();
            });
        };
    });
};
