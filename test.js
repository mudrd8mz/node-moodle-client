const moodle_client = require("./client");
const http = require("http");
const url = require("url");
const querystring = require("querystring");
const assert = require("assert");

const PORT = 59999;
const TOKEN = "Ex@mpleT0kenThat1s5upposedToB3Returned";
const USERNAME = "wsuser";
const PASSWORD = "wsp@sswd";
const SERVICE = "test-node-client";

var server;

server = http.createServer(function(request, response) {
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
            if (getparams.service === SERVICE && postparams.username === USERNAME && postparams.password === PASSWORD) {
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
            } else if (getparams.wsfunction === "sum_post") {
                response.write(JSON.stringify(parseInt(postparams.a, 10) + parseInt(postparams.b, 10)));
            } else {
                response.write(JSON.stringify({wsfunction: getparams.wsfunction}));
            }
        }

        response.end();
    });
});

describe("moodle-client initialization", function() {
    describe("#create()", function() {

        it("should parse the given wwwroot", function() {
            var client = moodle_client.create({wwwroot: "http://localhost:" + PORT + "/moodle"});
            assert.equal("localhost", client.host.hostname);
            assert.equal(PORT, client.host.port);
            assert.equal("/moodle", client.host.pathname);
        });

        it("should warn if plain http protocol is used", function() {
            var warned = false;
            var client = moodle_client.create({
                wwwroot: "http://localhost",
                logger: {
                    warn: function() {
                        warned = true;
                    }
                }
            });
            assert(warned);
        });

        it("should set explicit service if provided", function() {
            var client = moodle_client.create({service: SERVICE});
            assert.equal(SERVICE, client.service);
        });

        it("should fall back to using moodle_mobile_app service", function() {
            var client = moodle_client.create();
            assert.equal("moodle_mobile_app", client.service);
        });

        it("should set token if provided, without the need to call authenticate()", function() {
            var client = moodle_client.create({token: "BarBar"});
            assert.equal("BarBar", client.token);
        });

    });
});

describe("moodle-client authentication", function() {
    describe("#authenticate()", function() {

        before(function() {
            server.listen(PORT);
        });

        after(function() {
            server.close();
        });

        it("should fail if neither token nor login credentials are provided", function(done) {
            var client = moodle_client.create({wwwroot: "http://localhost"});
            client.authenticate(null, function(error) {
                assert(error);
                done();
            });
        });

        it("should set explicit token if provided", function(done) {
            var client = moodle_client.create();
            client.authenticate({token: "FooBar"}, function(error) {
                assert.ifError(error);
                assert.equal("FooBar", client.token);
                done();
            });
        });

        it("should obtain the token from the server", function(done) {
            var client = moodle_client.create({
                wwwroot: "http://localhost:" + PORT + "/moodle",
                service: SERVICE
            });
            client.authenticate({username: USERNAME, password: PASSWORD}, function(error) {
                assert.ifError(error);
                assert.equal(TOKEN, client.token);
                done();
            });
        });

        it("should throw error on invalid credentials", function(done) {
            var client = moodle_client.create({
                wwwroot: "http://localhost:" + PORT + "/moodle",
                service: SERVICE
            });
            client.authenticate({username: "wrong" + USERNAME, password: PASSWORD}, function(error) {
                assert(error);
                assert.strictEqual(null, client.token);
                done();
            });
        });
    });
});

describe("moodle-client method execution", function() {
    describe("#call()", function() {
        var client;

        before(function() {
            server.listen(PORT);
            client = moodle_client.create({
                wwwroot: "http://localhost:" + PORT + "/moodle",
                service: SERVICE,
                token: TOKEN
            });
        });

        after(function() {
            server.close();
        });

        it("should allow execution of methods without parameters", function(done) {
            client.call({wsfunction: "get_status"}, function(error, data) {
                assert.ifError(error);
                assert.equal(data.wsfunction, "get_status");
                done();
            });
        });

        it("should allow execution of methods returning no data", function(done) {
            client.call({wsfunction: "get_no_data"}, function(error, data) {
                assert.ifError(error);
                assert.strictEqual(data, null);
                done();
            });
        });

        it("should support GET requests", function(done) {
            client.call({wsfunction: "sum_get", arguments: {a: 2, b: 3}, settings: {method: "GET"}}, function(error, data) {
                assert.ifError(error);
                assert.equal(data, 5);
                done();
            });
        });

        it("should support POST requests", function(done) {
            client.call({wsfunction: "sum_post", arguments: {a: 5, b: 4}, settings: {method: "POST"}}, function(error, data) {
                assert.ifError(error);
                assert.equal(data, 9);
                done();
            });
        });
    });
});
