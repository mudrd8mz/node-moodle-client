/**
 * API client for the moodle web services.
 *
 * @module moodle-api
 * @author David Mudrak <david@moodle.com>
 * @license 3-clause BSD license
 */

const url = require("url");
const http = require("http");
const https = require("https");
const querystring = require("querystring");
const concat = require("concat-stream");

module.exports = new client();


/**
 * Represents a moodle API client.
 *
 * @constructor
 */
function client() {};


/**
 * The callback executed by the init() method.
 *
 * @callback client_initialized_callback
 * @param error
 */


/**
 * Initializes the moodle API client.
 *
 * @param {winston.Logger} logger - The logger to use.
 * @param {string} wwwroot - The moodle hostname to connect to.
 * @param {string} username - The username to use to authenticate us.
 * @param {string} password - The password to use to authenticate us.
 * @param {string} [service=moodle_mobile_app] - The web service to use.
 * @param {client_initialized_callback} callback - Executed once the client is ready.
 */
client.prototype.init = function (logger, wwwroot, username, password, service, callback) {

    this.logger = logger;
    this.host = url.parse(wwwroot);
    this.username = username;
    this.password = password;

    if (this.host.protocol === "https:") {
        this.protocol = https;
    } else {
        this.logger.warn("[init] client using http protocol - credentials are transmitted unencrypted");
        this.protocol = http;
    }

    if (typeof callback === "undefined") {
        // Only 5 arguments passed.
        callback = service;
        service = null;
    }

    if (!service) {
        this.service = "moodle_mobile_app";
    } else {
        this.service = service;
    }

    this.token = null;

    // Authenticate and execute the callback once ready.
    this.authenticate(callback);
}


/**
 * Authenticate the user.
 *
 * @method
 * @param {client_initialized_callback} callback
 */
client.prototype.authenticate = function (callback) {
    var self = this;
    self.logger.debug("[auth] requesting %s token from %s", self.service, self.host.href);

    var query = querystring.stringify({
        username: self.username,
        password: self.password,
        service: self.service
    });

    // Note that we are submitting the password via POST so that it is not stored in the
    // web server logs by default. On the other hand, we intentionally submit the username
    // and the service name as a part of the query string so that the access logs can be
    // analysed more easily.

    var options = {
        hostname: self.host.hostname,
        port: self.host.port,
        method: "POST",
        path: self.host.pathname + "/login/token.php?" + querystring.stringify({
            username: self.username,
            service: self.service
        }),
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        }
    }

    var request = self.protocol.request(options, function(response) {

        if (response.statusCode != 200) {
            self.logger.error("[auth] unexpected response status code %d", response.statusCode);
            return callback("unexpected response status code");
        }

        response.pipe(concat({encoding: "string"}, function (data) {

            try {
                data = JSON.parse(data);
            } catch (e) {
                self.logger.error("[auth] unable to parse server response");
                return callback(e);
            }

            if (data.error) {
                self.logger.error("[auth] authentication failed: %s", data.error);
                return callback(data.error);
            }

            if (data.token) {
                self.logger.debug("[auth] token obtained");
                self.token = data.token;
                return callback(null);
            }

            return callback("unexpected response format");
        }));
    });

    request.on("error", function (e) {
        self.logger.error("[auth] POST error: %s", e.message);
        return callback(e);
    });

    request.write(querystring.stringify({password: self.password}));
    request.end();
};


/**
 * The callback executed by the call() method.
 *
 * @callback function_executed_callback
 * @param {null|object|string} error - Thrown exception or error, if any.
 * @param {null|object} data - Returned data structure, if any.
 */

/**
 * Execute a web service function.
 *
 * @param {string} wsfunction - The name of the web service function to call.
 * @param {object} [arguments={}] - Web service function arguments.
 * @param {object} [settings={}] - Additional settings affecting the execution.
 * @param {function_executed_callback} callback - The callback to execute.
 */
client.prototype.call = function (wsfunction, arguments, settings, callback) {
    var self = this;
    self.logger.debug("[call] calling web service function %s", wsfunction);

    if (typeof settings === "undefined") {
        // Only two arguments provided.
        callback = arguments;
        arguments = null;
        settings = null;
    }

    if (typeof callback === "undefined") {
        // Only three arguments provided.
        callback = settings;
        settings = null;
    }

    arguments = arguments || {};
    settings = settings || {};

    var query = JSON.parse(JSON.stringify(arguments));

    query.wstoken = self.token;
    query.wsfunction = wsfunction;
    query.moodlewsrestformat = "json";

    if ("raw" in settings) {
        // False by default. If true, the format_text() is not applied to description/summary/textarea.
        // Instead, the raw content from the DB is returned.
        // Requires moodle 2.3 and higher.
        query.moodlewssettingraw = settings.raw;
    }

    if ("fileurl" in settings) {
        // True by default. If true, returned file urls are converted to something like
        // http://xxxx/webservice/pluginfile.php/yyyyyyyy.
        // If false, the raw file url content from the DB is returned (e.g. @@PLUGINFILE@@).
        // Requires moodle 2.3 and higher.
        query.moodlewssettingfileurl = settings.fileurl;
    }

    if ("filter" in settings) {
        // False by default. If true, the function will apply filter during format_text().
        // Requires moodle 2.3 and higher.
        query.moodlewssettingfilter = settings.filter;
    }

    query = querystring.stringify(query);

    if ("method" in settings) {
        if (!(settings.method === "GET" || settings.method === "POST")
                || self.protocol.METHODS.indexOf(settings.method) == -1) {
            self.logger.error("[call] requested method not supported (only GET and POST supported)");
            return callback("unsupported protocol method");
        }
    }

    if (settings.method === "POST") {

        // Note that the called wsfunction is submitted in the query, too. This is done
        // intentionally so that the server logs can be easily parsed for the usage
        // analysis.

        var options = {
            hostname: self.host.hostname,
            port: self.host.port,
            method: "POST",
            path: self.host.pathname + "/webservice/rest/server.php?" + querystring.stringify({wsfunction: wsfunction}),
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": query.length
            }
        }

        var request = self.protocol.request(options, function(response) {

            if (response.statusCode != 200) {
                self.logger.error("[call] unexpected response status code %d", response.statusCode);
                return callback("unexpected response status code " + response.statusCode);
            }

            response.pipe(concat({encoding: "string"}, function (data) {
                process_request_response(self.logger, data, callback);
            }));
        });

        request.on("error", function (e) {
            self.logger.error("[call] POST error: %s", e.message);
            return callback(e);
        });

        request.write(query);
        request.end();

    } else {

        var options = {
            hostname: self.host.hostname,
            port: self.host.port,
            path: self.host.pathname + "/webservice/rest/server.php?" + query
        }

        self.protocol.get(options, function(response) {

            if (response.statusCode != 200) {
                self.logger.error("[call] unexpected response status code %d", response.statusCode);
                return callback("unexpected response status code " + response.statusCode);
            }

            response.pipe(concat({encoding: "string"}, function (data) {
                process_request_response(self.logger, data, callback);
            }));

        }).on("error", function (e) {
            self.logger.error("[call] GET error: %s", e.message);
            return callback(e);
        });
    }
};


/**
 * Helper for processing the response for our GET or POST requests.
 *
 * @param {winston.Logger} logger - The logger to use.
 * @param {string} data - The response body.
 * @param {function_executed_callback} callback - The callback to execute.
 */
function process_request_response(logger, data, callback) {
    try {
        data = JSON.parse(data);
    } catch (e) {
        logger.error("[call] unable to parse server response");
        return callback(e);
    }

    if (data === null) {
        // Some moodle web service functions do not return any data.
        logger.debug("[call] null data returned");
        return callback(null, null);
    }

    if (data.exception) {
        logger.error("%s: %s [%s]", data.exception, data.message, data.errorcode);
        logger.debug(data.debuginfo);
        return callback(data);
    }

    logger.debug("[call] data returned");

    return callback(null, data);
}
