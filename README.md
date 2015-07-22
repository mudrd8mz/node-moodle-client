moodle-client
=============

node.js client for [moodle](https://moodle.org/) web services API

## Requirements

* moodle web services via REST protocol [enabled](https://docs.moodle.org/en/Using_web_services).

## Installation

    $ npm install moodle-client

## Usage

Call the `create()` function provided by the module to get a new instance of the client.

    const client = require("moodle-client");

    var c = client.create({
        wwwroot: "http://localhost/moodle/",
        token: "d457b5e5b0cc31c05ccf38628e4dfc14"
    });

Alternatively, to obtain the token for the given username and password, use the `authenticate()` method.

    const client = require("moodle-client");

    var c = client.create({
        wwwroot: "http://localhost/moodle/"
    });

    c.authenticate({
        username: "mysystemusername",
        password: "my$y$tem pa33w0rd"
    }, function (error) {
        if (!error) {
            // Client is authenticated and ready to be used.
        }
    });

Use the `call()` method to execute a web service function at the remote moodle site.

    const client = require("moodle-client");

    var c = client.create({
        wwwroot: "http://localhost/moodle/",
        token: "d457b5e5b0cc31c05ccf38628e4dfc14",
    });

    c.call({wsfunction: "core_webservice_get_site_info"}, function(error, info) {
        if (!error) {
            console.log("Hello %s, welcome to %s", info.fullname, info.sitename);
        }
    });

To debug and log the client functionality, install and use the winston logger.

    const client = require("moodle-client");
    const logger = require("winston");

    logger.level = "debug";
    logger.cli();

    var c = client.create({
        wwwroot: "http://localhost/moodle/",
        logger: logger
    });

To use a custom web service, provide its shortname when creating a new instance of the client. If the service is not specified, the
client defaults to using the `moodle_mobile_app` service.

    var c = client.create({
        wwwroot: "http://localhost/moodle/",
        service: "our_cohorts_management"
    });


To pass arguments to the web service function, provide them via the arguments object. Additional settings can be provided via the
settings object.

    client.create({
        wwwroot: "http://localhost/moodle/",
        logger: logger,
        token: "d457b5e5b0cc31c05ccf38628e4dfc14"

    }).call({
        wsfunction: "core_message_unblock_contacts",
        arguments: {
            "userids[]": [1, 2, 3, 4, 5]
        },
        settings: {
            method: "POST"
        }

    }, function(error, data) {
        if (error) throw error;
        logger.info("Done!");
    });

Additional settings can be provided via the settings object, such as the response data formatting.
See [moodle dev docs](https://docs.moodle.org/dev/Creating_a_web_service_client#Text_formats) for details.

    c.call({
        wsfunction: "local_myplugin_my_function",
        arguments: {
            answer: 42
        },
        settings: {
            raw: false,
            filter: true
        }

    }, function (error, data) {
        // handle eventual error and process returned data here
    });

The `call()` method is chainable.

If you are connecting via HTTPS to a Moodle site with self-signed certificate, you may need to set the
`settings.sslverify` to false.

## TODO

* Uploading files via web service

## Changes

* 0.3.0 - Fixed usage over HTTPS (#4). Added support for self-signed SSL certificates (#5).
* 0.2.0 - The initialization and API/signatures improved (#1). Added ability to authenticate by explicitly provided token (#3).
          Added tests.
* 0.1.0 - Initial release. The API should not be considered stable yet (as the [version number](http://semver.org/) suggests).
