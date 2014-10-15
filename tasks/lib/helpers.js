'use strict';

/*
 * Get an options object containing settings for connecting to an scp host
 * @return [obj] options object
 *
 * @throw Error: If privateKey or password field is not found
 */
exports.getScpOptions = function(options) {
    var scpOptions = {
        port: options.port,
        host: options.host,
        username: options.username
    };

    if(options.privateKey)
        scpOptions.privateKey = options.privateKey;
    else
        scpOptions.password = options.password;
    
    if(!(scpOptions.privateKey || scpOptions.password)) throw new Error('Password or private key required.');

    return scpOptions;
};