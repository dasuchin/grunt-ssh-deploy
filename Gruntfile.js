/*
 * grunt-ssh-deploy
 * https://github.com/dcarlson/grunt-ssh-deploy
 *
 * Copyright (c) 2014 Dustin Carlson
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    jshint: {
      all: [
        'Gruntfile.js',
        'tasks/*.js',
        '<%= nodeunit.tests %>'
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },

    // Before generating any new files, remove any previously-created files.
    clean: {
      tests: ['tmp']
    },

    // Configuration to be run (and then tested).
    secret: grunt.file.readJSON('secret.json'),
    environments: {
        staging: {
            options: {
                host: '<%= secret.staging.host %>',
                username: '<%= secret.staging.username %>',
                password: '<%= secret.staging.password %>',
                port: '<%= secret.staging.port %>',
                deploy_path: '/full/path',
                local_path: 'dist',
                current_symlink: 'current',
                debug: true
            }
        },
        production: {
            options: {
                host: '<%= secret.production.host %>',
                username: '<%= secret.production.username %>',
                password: '<%= secret.production.password %>',
                port: '<%= secret.production.port %>',
                deploy_path: '/full/path',
                local_path: 'dist',
                current_symlink: 'current'
            }
        }
    },

    // Unit tests.
    nodeunit: {
      tests: ['test/*_test.js']
    }

  });

  // Actually load this plugin's task(s).
  grunt.loadTasks('tasks');

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');

  // Whenever the "test" task is run, first clean the "tmp" dir, then run this
  // plugin's task(s), then test the result.
  grunt.registerTask('test', ['clean', 'ssh_deploy', 'ssh_rollback', 'nodeunit']);

  // By default, lint and run all tests.
  grunt.registerTask('default', ['jshint', 'test']);

};
