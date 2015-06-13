moodle-client
=============

Node.js client for [Moodle](https://moodle.org/) web services API.

## Requirements

* Moodle web services via REST protocol [enabled](https://docs.moodle.org/en/Using_web_services).
* Node module [winston](https://github.com/winstonjs/winston) installed.

## Installation

    $ npm install moodle-client
    $ npm install winston

## Usage

By default, the client authenticates via username and password to use the moodle mobile web services. Call the `init()` method to
initialize and authenticate the client. Then make the web service function call via `call()` method.

    const client = require("moodle-client");
    const logger = require("winston");

    logger.level = "debug";
    logger.cli();

    client.init(logger, "http://localhost/moodle/", "wsuser", "wspasswd", function (error) {
        if (!error) {
            client.call("core_webservice_get_site_info", function(error, info) {
                if (!error) {
                    console.log(">>> Hello %s, welcome to %s", info.fullname, info.sitename);
                    console.log(">>> There are %d functions available for you", info.functions.length);
                }
            });
        }
    });

### Custom web service

If you have created a custom web service in Moodle (such as the _cohort management_ in the following example), provide its
shortname as the fifth parameter of the `init()`, followed by the callback.

    client.init(logger, "http://localhost/moodle/", "wsuser", "wspasswd", "cohort_management", function (error) { ... });

### Passing arguments to web service functions

    client.call("core_cohort_get_cohort_members", {"cohortids[]": [1, 2]}, function(error, members) {
        if (!error && members) {
            for (var i = 0; i < members.length; i++) {
                console.log("cohort id %d has %d members", members[i].cohortid, members[i].userids.length);
            }
        }
    });

### Controlling the HTTP method

By default, the GET method is used. To execute the web service function via POST:

    client.call("core_message_unblock_contacts", {"userids[]": [2,3]}, {method: "POST"}, function (error) { ... });

### Controlling the response data formatting

See [Moodle dev docs](https://docs.moodle.org/dev/Creating_a_web_service_client#Text_formats) for details.

    client.call("local_myplugin_my_function", {answer: 42}, {raw: false, filter: true}, function (error, data) { ... });

### Providing explicit token without authentication

This is not implemented yet. Changes in the API can be expected.

### Uploading files via web service

Not implemented yet.

## Tests

Not implemented yet.

## Changes

* 0.1.0 - Initial release. The API should not be considered stable yet (as the [version number](http://semver.org/) suggests).
