/**
 * API client for the moodle web services.
 *
 * @module moodle-api
 * @author David Mudrak <david@moodle.com>
 * @license BSD-2-Clause
 */

const url = require("url");
const http = require("http");
const https = require("https");
const querystring = require("querystring");
const concat = require("concat-stream");

module.exports = {
    create: function (options) {
        return new client(options);
    }
}

/**
 * Represents a moodle API client.
 *
 * The options object supports the following properties.
 *
 * {string} wwwroot - The moodle hostname to connect to.
 * {winston.Logger} [logger] - The logger to use, defaults to a dummy non-logger.
 * {string} [service=moodle_mobile_app] - The web service to use.
 * {string} [token] - The access token to use.
 *
 * @constructor
 * @param {object} options - Client initialization options.
 */
function client(options) {
    var self = this;

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
        self.host = url.parse(options.wwwroot);

        if (self.host.protocol === "https:") {
            self.protocol = https;

        } else {
            self.logger.warn("[init] client using http protocol - credentials are transmitted unencrypted");
            self.protocol = http;
        }

    } else {
        self.logger.error("[init] wwwroot not defined");
    }

    if ("service" in options) {
        self.service = options.service;
    } else {
        self.service = "moodle_mobile_app";
    }

    if ("token" in options) {
        self.token = options.token;
    }
}

/**
 * The callback executed by the authenticate() method.
 *
 * @callback client_authenticated_callback
 * @param error
 */

/**
 * Authenticate the user.
 *
 * The options object supports the following properties.
 *
 * {string} token - The access token to use.
 * {string} username - The username to use to authenticate us.
 * {string} password - The password to use to authenticate us.
 *
 * Either token, or the username and password must be provided.
 *
 * @method
 * @param {object} options
 * @param {client_authenticated_callback} callback
 */
client.prototype.authenticate = function (options, callback) {
    var self = this;

    options = options || {};

    if ("token" in options) {
        self.logger.debug("[auth] token provided");
        self.token = options.token;
        return callback(null);
    } else {
        self.token = null;
    }

    if ("username" in options) {
        self.username = options.username;
    } else {
        self.username = null;
    }

    if ("password" in options) {
        self.password = options.password;
    } else {
        self.password = null;
    }

    if (self.token === null && (self.username === null || self.password === null)) {
        self.logger.error("[auth] either token or login credentials must be provided");
        return callback(new Error("either token or login credentials must be provided"));
    }

    self.logger.debug("[auth] requesting %s token from %s", self.service, self.host.href);

    // Note that we are submitting credentials via POST so that they are not stored in the
    // web server logs by default. On the other hand, we intentionally submit the service
    // name as a part of the query string so that the access logs can be analysed easily.

    var options = {
        hostname: self.host.hostname,
        port: self.host.port,
        method: "POST",
        path: self.host.pathname + "/login/token.php?" + querystring.stringify({
            service: self.service
        }),
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        }
    }

    var request = self.protocol.request(options, function(response) {

        if (response.statusCode != 200) {
            self.logger.error("[auth] unexpected response status code %d", response.statusCode);
            return callback(new Error("unexpected response status code"));
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

            return callback(new Error("unexpected response format"));
        }));
    });

    request.on("error", function (e) {
        self.logger.error("[auth] POST error: %s", e.message);
        return callback(e);
    });

    request.write(querystring.stringify({username: self.username, password: self.password}));
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
 * The options object supports the following properties.
 *
 * {string} function - The name of the web service function to call.
 * {object} [arguments={}] - Web service function arguments.
 * {object} [settings={}] - Additional settings affecting the execution.
 *
 * @method
 * @param {object} options
 * @param {function_executed_callback} callback - The callback to execute.
 * @return {object} - The client instance (to make it chainable).
 */
client.prototype.call = function (options, callback) {
    var self = this;
    var wsfunction;
    var arguments = {};
    var settings = {};
    var reqopt = {
        hostname: self.host.hostname,
        port: self.host.port
    };

    if ("wsfunction" in options) {
        wsfunction = options.wsfunction;
    } else {
        self.logger.error("[call] missing function name to execute");
        return callback(new Error("missing function name to execute"));
    }

    if ("arguments" in options) {
        arguments = options.arguments;
    }

    if ("settings" in options) {
        settings = options.settings;
    }

    self.logger.debug("[call] calling web service function %s", wsfunction);

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
        if (settings.method !== "GET" && settings.method !== "POST") {
            self.logger.error("[call] requested method not supported (only GET and POST supported)");
            return callback(new Error("unsupported protocol method"));
        }
    }

    if ("sslverify" in settings) {
        if (!settings.sslverify) {
            reqopt.rejectUnauthorized = false;
        }
    }

    if (settings.method === "POST") {

        // Note that the called wsfunction is submitted in the query, too. This is done
        // intentionally so that the server logs can be easily parsed for the usage
        // analysis.

        reqopt.method = "POST";
        reqopt.path = self.host.pathname + "/webservice/rest/server.php?" + querystring.stringify({wsfunction: wsfunction});
        reqopt.headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": query.length
        };

        var request = self.protocol.request(reqopt, function(response) {

            if (response.statusCode != 200) {
                self.logger.error("[call] unexpected response status code %d", response.statusCode);
                return callback(new Error("unexpected response status code " + response.statusCode));
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

        reqopt.path = self.host.pathname + "/webservice/rest/server.php?" + query;

        self.protocol.get(reqopt, function(response) {

            if (response.statusCode != 200) {
                self.logger.error("[call] unexpected response status code %d", response.statusCode);
                return callback(new Error("unexpected response status code " + response.statusCode));
            }

            response.pipe(concat({encoding: "string"}, function (data) {
                process_request_response(self.logger, data, callback);
            }));

        }).on("error", function (e) {
            self.logger.error("[call] GET error: %s", e.message);
            return callback(e);
        });
    }

    return self;
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
