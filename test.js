"use strict";

var moodle_client = require("./client");
var assert = require("assert");

var http = require("http");
var url = require("url");
var querystring = require("querystring");

var PORT = 59999;
var TOKEN = "Ex@mpleT0kenThat1s5upposedToB3Returned";
var USERNAME = "wsuser";
var PASSWORD = "wsp@sswd";
var SERVICE = "test-node-client";

var server = http.createServer(function(request, response) {
    var uri = url.parse(request.url);
    var getparams = querystring.parse(uri.query);
    var postbody = "";
    var postparams = {};

    request.on("data", function(chunk) {
        postbody += chunk;
    });

    request.on("end", function() {
        if (request.headers["content-type"] === "application/x-www-form-urlencoded") {
            postparams = querystring.parse(postbody);
        }

        if (uri.pathname === "/moodle/login/token.php") {
            if (postparams.service === SERVICE && postparams.username === USERNAME && postparams.password === PASSWORD) {
                response.write(JSON.stringify({token: TOKEN}));
            } else {
                // Note that Moodle still returns HTTP 200 in case of error.
                response.write(JSON.stringify({error: "The username was not found in the database", stacktrace: "", debuginfo: ""}));
            }
        }

        if (uri.pathname === "/moodle/webservice/rest/server.php") {
            if (getparams.wsfunction === "get_no_data") {
                response.write(JSON.stringify(null));
            } else if (getparams.wsfunction === "sum_get") {
                response.write(JSON.stringify(parseInt(getparams.a, 10) + parseInt(getparams.b, 10)));
            } else if (postparams.wsfunction === "sum_post") {
                response.write(JSON.stringify(parseInt(postparams.a, 10) + parseInt(postparams.b, 10)));
            } else if (getparams.wsfunction === "complex_args") {
                if (getparams["a[0]"] == 0
                    && getparams["a[1]"] == "b"
                    && getparams["a[2]"] == "2"
                    && getparams["c[0][x]"] == "1"
                    && getparams["c[0][y]"] == "2"
                    && getparams["c[1][x]"] == "3"
                    && getparams["c[1][y]"] == "4"
                ) {
                    response.write(JSON.stringify("ok"));
                }
            } else {
                response.write(JSON.stringify({executed: getparams.wsfunction}));
            }
        }

        response.end();
    });
});

describe("moodle-client initialization", function() {
    describe("#init()", function() {

        before(function() {
            server.listen(PORT);
        });

        after(function() {
            server.close();
        });

        it("should reject if neither token nor credentials are provided", function() {
            return moodle_client.init().then(function(client) {
                    assert.ok(false, "This promise should not be fulfilled.");
                }).catch(function(error) {
                    assert.ok(true, "This promise should be rejected.");
                });
        });

        it("should set token if provided", function() {
            return moodle_client.init({token: "BarBar"}).then(function(client) {
                assert.equal("BarBar", client.token);
            });
        });

        it("should set explicit service if provided", function() {
            return moodle_client.init({service: SERVICE, token: ""}).then(function(client) {
                assert.equal(SERVICE, client.service);
            });
        });

        it("should fall back to using moodle_mobile_app service", function() {
            return moodle_client.init({token: ""}).then(function(client) {
                assert.equal("moodle_mobile_app", client.service);
            });
        });

        it("should obtain the token from the server", function() {
            return moodle_client.init({
                wwwroot: "http://localhost:" + PORT + "/moodle",
                service: SERVICE,
                username: USERNAME,
                password: PASSWORD
            }).then(function(client) {
                assert.equal(TOKEN, client.token);
            });
        });

        it("should reject on invalid credentials", function() {
            return moodle_client.init({
                wwwroot: "http://localhost:" + PORT + "/moodle",
                service: SERVICE,
                username: "wrong" + USERNAME,
                password: PASSWORD
            }).then(function(client) {
                assert.ok(false, "This promise should not be fulfilled.");
            }).catch(function(err) {
                assert.ok(true, "This promise should be rejected.");
            });
        });
    });
});

describe("moodle-client method execution", function() {
    describe("#call()", function() {
        var init;

        before(function() {
            server.listen(PORT);
            init = moodle_client.init({wwwroot: "http://localhost:" + PORT + "/moodle", service: SERVICE, token: TOKEN});
        });

        after(function() {
            server.close();
        });

        it("should allow execution of methods without parameters", function() {
            return init.then(function(client) {
                return client.call({wsfunction: "get_status"}).then(function(data) {
                    assert.equal(data.executed, "get_status");
                });
            });
        });

        it("should allow execution of methods returning no data", function() {
            return init.then(function(client) {
                return client.call({wsfunction: "get_no_data"}).then(function(data) {
                    assert.strictEqual(data, null);
                });
            });
        });

        it("should support GET requests", function() {
            return init.then(function(client) {
                return client.call({
                    wsfunction: "sum_get",
                    args: {a: 2, b: 3},
                    method: "GET"
                }).then(function(data) {
                    assert.equal(data, 5);
                });
            });
        });

        it("should use GET requests by default", function() {
            return init.then(function(client) {
                return client.call({
                    wsfunction: "sum_get",
                    args: {a: 2, b: 3}
                }).then(function(data) {
                    assert.equal(data, 5);
                });
            });
        });

        it("should support POST requests", function() {
            return init.then(function(client) {
                return client.call({
                    wsfunction: "sum_post",
                    args: {a: 2, b: 3},
                    method: "POST"
                }).then(function(data) {
                    assert.equal(data, 5);
                });
            });
        });

        it("should handle complex data structures submitted", function() {
            return init.then(function(client) {
                return client.call({
                    wsfunction: "complex_args",
                    args: {
                        a: [0, "b", 2],
                        c: [
                        {
                            x: 1,
                            y: 2
                        },
                        {
                            x: 3,
                            y: 4
                        }
                        ]
                    }

                }).then(function(data) {
                    assert.equal(data, "ok");
                });
            })
        });
    });
});
