moodle-client
=============

node.js client for [moodle](https://moodle.org/) web services API

## Requirements

* moodle web services via REST protocol
  [enabled](https://docs.moodle.org/en/Using_web_services).

## Installation

    $ npm install moodle-client

## Usage

The client exposes promises API via [bluebird](http://bluebirdjs.com/)
implementation.

Call the `init()` function provided by the module to get a promise of a new
instance of the client. The promise fulfills with the instance of the client
ready to use for other requests.

    var moodle_client = require("moodle-client");

    moodle_client.init({
        wwwroot: "http://localhost/moodle/",
        token: "d457b5e5b0cc31c05ccf38628e4dfc14"

    }).then(function(client) {
        do_something(client);

    }).catch(function(err) {
        console.log("Unable to initialize the client: " + err);
    });

Instead of providing the token explicitly, you can let the client authenticate
via provided username and password.

    var moodle_client = require("moodle-client");

    moodle_client.init({
        wwwroot: "http://localhost/moodle/",
        username: "mysystemusername",
        password: "my$y$tem pa33w0rd"

    }).then(function(client) {
        do_something(client);

    }).catch(function(err) {
        console.log("Unable to initialize the client: " + err);
    });

Use the client's `call()` method to execute a web service function at the
remote moodle site. The returned promise fulfills with the data returned by the
remote function.

    var moodle_client = require("moodle-client");

    moodle_client.init({
        wwwroot: "http://localhost/moodle/",
        token: "d457b5e5b0cc31c05ccf38628e4dfc14"

    }).then(function(client) {
        do_something(client);

    }).catch(function(err) {
        console.log("Unable to initialize the client: " + err);
    });

    function do_something(client) {
        client.call({
            wsfunction: "core_webservice_get_site_info",

        }).then(function(info) {
            console.log("Hello %s, welcome to %s", info.fullname, info.sitename);
        });
    }

To debug and/or log the client functionality, install and use the `winston`
logger.

    var moodle_client = require("moodle-client");
    var logger = require("winston");

    logger.level = "debug";
    logger.cli();

    moodle_client.init({
        logger: logger,
        wwwroot: "http://localhost/moodle/",
        token: "d457b5e5b0cc31c05ccf38628e4dfc14"

    }).then(function(client) {
        do_something(client);

    }).catch(function(err) {
        console.log("Unable to initialize the client: " + err);
    });

To use a custom web service, provide its shortname when creating a new instance
of the client. If the `service` is not specified, the client defaults to using
the `moodle_mobile_app` service.

    var init = moodle_client.init({
        wwwroot: "http://localhost/moodle/",
        token: "d457b5e5b0cc31c05ccf38628e4dfc14",
        service: "our_cohorts_management"
    });

    init.then(...);

To pass arguments to the web service function, provide them via the `args`
object. To use POST rather than the default GET request method, set the
`method` property of the call options.

    init.then(function(client) {
        client.call({
            wsfunction: "core_message_unblock_contacts",
            method: "POST",
            args: {
                userids: [1, 2, 3, 4, 5]
            }

        }).then(function() {
            console.log("Done");
        });
    });

The client uses `request-promise` to actually perform the requests. Which in
turn uses `qs` to stringify the args into the query string. Please refer to the
[qs module documentation](https://github.com/hapijs/qs#stringifying) for how to
pass complex data structures. For example, when calling the function
`core_cohort_add_cohort_members` the passed arguments should look something like

    args: {
        members: [
            {
                cohorttype: {
                    type: "id",
                    value: "1"
                },
                usertype: {
                    type: "id",
                    value: "3"
                }
            },
            {
                cohorttype: {
                    type: "id",
                    value: "1"
                },
                usertype: {
                    type: "id",
                    value: "4"
                }
            }
        ]
    }

Additional settings can be provided via the settings object, such as the
response data formatting. See [moodle dev
docs](https://docs.moodle.org/dev/Creating_a_web_service_client#Text_formats)
for details.

    var mycall = client.call({
        wsfunction: "local_myplugin_my_function",
        args: {
            answer: 42
        },
        settings: {
            raw: false,
            filter: true
        }
    );

    mycall.then(...);

If you are connecting via HTTPS to a Moodle site with self-signed certificate,
you may need to set the `strictSSL` option to false.

    var init = moodle_client.init({
        wwwroot: "https://localhost/moodle/",
        token: "d457b5eo5b0cc31c05ccf38628e4dfc14",
        strictSSL: false
    });

    init.then(...);

## TODO

* Uploading files via web service

## Changes

### 0.4.0

* Massive non backwards compatible changes in the API.
* Now uses `request-promise` to actually perform the requests.
* The API changed to return promises (via `bluebird`).
* The eventual authentication happens if needed during the initialization.
* The module does not provide `create()` any more, use `init()` returning the promise now.

### 0.3.0

* Fixed usage over HTTPS (#4). Added support for self-signed SSL certificates (#5).

### 0.2.0

* The initialization and API/signatures improved (#1).
* Added ability to authenticate by explicitly provided token (#3).
* Added tests.

### 0.1.0

* Initial release. The API should not be considered stable yet (as the [version
  number](http://semver.org/) suggests).
