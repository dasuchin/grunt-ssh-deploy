# grunt-ssh-deploy (Version: 0.2.1)

> SSH Deployment for Grunt using [ssh2](https://github.com/mscdex/ssh2).

## Getting Started
This plugin requires Grunt `~0.4.4`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-ssh-deploy --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-ssh-deploy');
```

## The tasks

### Overview
In your project's Gruntfile, add a section named `environments` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  environments: {
    environment: {
      // Environment specific options here
    }
  },
});
```

This plugin will connect to your remote host, add a directory to releases/ in your `remote_path`, and create a symlink to the latest release.

The symlink by default is `current`, you can change this by setting `current_symlink`. 

### Usage
By setting an environment, you can deploy each specific one with `grunt ssh_deploy:environment` or rolling back with `grunt ssh_rollback:environment`.

### Options

#### options.host
Type: `String`

Remote host to connect to.

#### options.username
Type: `String`

The username to connect as on the remote server.

#### options.password
Type: `String`

Password for the username on the remote server.

#### options.port
Type: `String`
Default value: `'22'`

Port to connect to on the remote server.

#### options.deploy_path
Type: `String`

Full path on the remote server where files will be deployed. No trailing slash needed.

#### options.local_path
Type: `String`

Path on your local for the files you want to be deployed to the remote server. No trailing slash needed.

#### options.current_symlink
Type: `String`
Default value: `'current'`

Password for the username on the remote server.

### Usage Examples

#### Custom Options

```js
grunt.initConfig({
  // do not store credentials in the git repo, store them separately and read from a secret file
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
  }
});
```

## Release History
* 2014/06/23 - v0.2.0 - Added rollback functionality.
* 2014/06/19 - v0.1.7 - Fixed symlink method to cd into deploy_path before setting symlink.
* 2014/05/04 - v0.1.5 - Changing symlink method to not use full path.
* 2014/05/04 - v0.1.0 - Initial release.
