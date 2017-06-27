/**
 * API client for the moodle web services.
 *
 * This is a thin wrapper around the request-promise module to simplify the
 * common querying Moodle external functions exposed via web services.  The
 * client uses webservice/rest/server.php end-point and supports authentication
 * via permanent tokens (which can be provided explicitly or obtained via login).
 *
 * @module moodle-client
 * @author David Mudrak <david@moodle.com>
 * @license BSD-2-Clause
 */

"use strict";

var request_promise = require("request-promise");
var Promise = require("bluebird");

module.exports = {
    /**
     * Factory method promising an authenticated client instance.
     *
     * @method
     * @returns {Promise}
     */
    init: function (options) {
        options = options || {};
        var c = new client(options);

        if (c.token !== null) {
            // If the token was explicitly provided, there is nothing to wait for - return
            // the promised client.
            return Promise.resolve(c);

        } else {
            // Otherwise return the pending promise of the authenticated client.
            if (!("username" in options)) {
                return Promise.reject("coding error: no username (or token) provided");
            }
            if (!("password" in options)) {
                return Promise.reject("coding error: no password (or token) provided");
            }
            return authenticate_client(c, options.username, options.password);
        }
    }
}

/**
 * Represents a moodle API client.
 *
 * @constructor
 * @param {object} options - Client initialization options.
 * @param {string} options.wwwroot - The moodle hostname to connect to.
 * @param {winston.Logger} [options.logger] - The logger to use, defaults to a dummy non-logger.
 * @param {string} [options.service=moodle_mobile_app] - The web service to use.
 * @param {string} [options.token] - The access token to use.
 * @param {string} [options.username] - The username to use to authenticate us (if no token provided).
 * @param {string} [options.password] - The password to use to authenticate us (if no token provided).
 * @param {bool} [options.strictSSL] - If set to false, SSL certificates do not need to be valid.
 */
function client(options) {
    var self = this;

    self.logger = null;
    self.wwwroot = null;
    self.service = null;
    self.token = null;
    self.strictSSL = true;

    options = options || {};

    if ("logger" in options) {
        self.logger = options.logger;
    } else {
        self.logger = {
            // Set-up a dummy logger doing nothing.
            debug: function() {},
            info: function() {},
            warn: function() {},
            error: function() {}
        };
    }

    if ("wwwroot" in options) {
        self.wwwroot = options.wwwroot;
    } else {
        self.logger.error("[init] wwwroot not defined");
    }

    if ("service" in options) {
        self.service = options.service;
    } else {
        self.logger.debug("[init] using default service moodle_mobile_app");
        self.service = "moodle_mobile_app";
    }

    if ("token" in options) {
        self.logger.debug("[init] setting up explicit token");
        self.token = options.token;
    } else {
        self.logger.debug("[init] no explicit token provided - requires authentication");
    }

    if ("strictSSL" in options) {
        if (!options.strictSSL) {
            self.logger.warn("[warn] ssl certificates not required to be valid");
            self.strictSSL = false;
        }
    }
}

/**
 * Call a web service function.
 *
 * @method
 * @param {object} options - Options affecting the web service function execution.
 * @param {string} options.function - The name of the web service function to call.
 * @param {object} [options.args={}] - Web service function arguments.
 * @param {string} [options.method=GET] - HTTP method to use (GET|POST).
 * @param {object} [options.settings={}] - Additional settings affecting the execution.
 * @param {boolean} [options.settings.raw=false] - Do not apply format_text() on description/summary/textarea.
 * @param {boolean} [options.settings.fileurl=true] - Convert file urls to use the webservice/pluginfile.php.
 * @param {boolean} [options.settings.filter=false] - Apply filters during format_text().
 * @return {Promise}
 */
client.prototype.call = function (options) {
    var self = this;
    var wsfunction;
    var args = {};
    var settings = {};

    if ("wsfunction" in options) {
        wsfunction = options.wsfunction;
    } else {
        self.logger.error("[call] missing function name to execute");
        return Promise.reject("missing function name to execute");
    }

    if ("args" in options) {
        args = options.args;
    }

    if ("settings" in options) {
        settings = options.settings;
    }

    self.logger.debug("[call] calling web service function %s", wsfunction);

    var request_options = {
        uri: self.wwwroot + "/webservice/rest/server.php",
        json: true,
        qs: args,
        qsStringifyOptions: {
            arrayFormat: "indices"
        },
        strictSSL: self.strictSSL,
        method: "GET"
    }

    request_options.qs.wstoken = self.token;
    request_options.qs.wsfunction = wsfunction;
    request_options.qs.moodlewsrestformat = "json";

    if ("raw" in settings) {
        // False by default. If true, the format_text() is not applied to description/summary/textarea.
        // Instead, the raw content from the DB is returned.
        // Requires moodle 2.3 and higher.
        request_options.qs.moodlewssettingraw = settings.raw;
    }

    if ("fileurl" in settings) {
        // True by default. If true, returned file urls are converted to something like
        // http://xxxx/webservice/pluginfile.php/yyyyyyyy.
        // If false, the raw file url content from the DB is returned (e.g. @@PLUGINFILE@@).
        // Requires moodle 2.3 and higher.
        request_options.qs.moodlewssettingfileurl = settings.fileurl;
    }

    if ("filter" in settings) {
        // False by default. If true, the function will apply filter during format_text().
        // Requires moodle 2.3 and higher.
        request_options.qs.moodlewssettingfilter = settings.filter;
    }

    if ("method" in options) {
        if (options.method === "GET" || options.method === "get") {
            // No problem, this is the default defined above.
        } else if (options.method === "POST" || options.method === "post") {
            // Provide the arguments as in URL-encoded forms.
            request_options.method = "POST";
            request_options.form = request_options.qs;
            delete request_options.qs;
        } else {
            self.logger.error("[call] unsupported request method");
            return Promise.reject("unsupported request method");
        }
    }

    return request_promise(request_options);
};

/**
 * Download a file from Moodle.
 *
 * @method
 * @param {object} options - Specifies the file to be downloaded.
 * @param {string} options.filepath - The path to the file within the Moodle filesystem.
 * @param {string} [options.preview=null] - Preview mode for images (tinyicon|thumb|bigthumb), full image otherwise.
 * @param {bool} [options.offline=false] - Download the file from the repository even if it is an external link.
 * @return {Promise}
 */
client.prototype.download = function (options) {
    var self = this;

    if (!("filepath" in options)) {
        self.logger.error("[download] missing file path to download");
        return Promise.reject("missing file path to download");
    }

    var request_options = {
        uri: self.wwwroot + "/webservice/pluginfile.php",
        qs: {
            token: self.token,
            file: options.filepath,
        },
        strictSSL: self.strictSSL,
        method: "GET",
        encoding: null
    }

    if (options.preview) {
        request_options.qs.preview = options.preview;
    }

    if (options.offline) {
        request_options.qs.offline = 1;
    }

    return request_promise(request_options);
}

/**
 * Upload files to the user draft area in the Moodle filesystem.
 *
 * The options.files follows the same rules as the formData object described at
 * https://github.com/request/request#multipartform-data-multipart-form-uploads
 * (Moodle does not seem to support the array variant though).
 *
 * If the itemid is not specified (or it is lesser or equal zero), the Moodle
 * automatically generates a new random item withing the user drafts area.
 *
 * The returned promise fulfills with an array of objects describing the
 * created files.
 *
 * @method
 * @param {object} options - Specifies files to be uploaded and where to.
 * @param {object} options.files - Form data providing the files to be uploaded.
 * @param {number} [options.itemid] - Allows to force uploading to the given area item.
 * @param {string} [options.targetpath=/] - The path to upload files to within the area item.
 * @return {Promise}
 */
client.prototype.upload = function (options) {
    var self = this;

    if (!("files" in options)) {
        self.logger.error("[upload] missing files data");
        return Promise.reject("missing files data");
    }

    var request_options = {
        uri: self.wwwroot + "/webservice/upload.php",
        json: true,
        formData: options.files,
        qs: {
            token: self.token
        },
        strictSSL: self.strictSSL,
        method: "POST",
    }

    if (options.targetpath) {
        request_options.qs.filepath = options.targetpath;
    }

    if (options.itemid) {
        request_options.qs.itemid = options.itemid;
    }

    return request_promise(request_options);
}

/**
 * @param {client} client
 * @param {string} username - The username to use to authenticate us.
 * @param {string} password - The password to use to authenticate us.
 * @returns {Promise}
 */
function authenticate_client(client, username, password) {
    return new Promise(function (resolve, reject) {
        client.logger.debug("[init] requesting %s token from %s", client.service, client.wwwroot);
        var options = {
            uri: client.wwwroot + "/login/token.php",
            method: "POST",
            form: {
                service: client.service,
                username: username,
                password: password
            },
            strictSSL: client.strictSSL,
            json: true
        }

        request_promise(options)
            .then(function(res) {
                if ("token" in res) {
                    client.token = res.token;
                    client.logger.debug("[init] token obtained");
                    resolve(client);
                } else if ("error" in res) {
                    client.logger.error("[init] authentication failed: " + res.error);
                    reject(new Error("authentication failed: " + res.error));
                } else {
                    client.logger.error("[init] authentication failed: unexpected server response");
                    reject(new Error("authentication failed: unexpected server response"));
                }
            })
            .catch(function(err) {
                reject(err);
            });
    });
}
