moodle-client
=============

[![Build Status](https://travis-ci.org/mudrd8mz/node-moodle-client.svg?branch=master)](https://travis-ci.org/mudrd8mz/node-moodle-client)

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

## Downloading Moodle files

Call the `download()` method of the client to download a file from the Moodle
file system. The returned promise fulfills with the buffer object with the file
contents.

    client.download({
        filepath: "/62/user/private/demo/remote.png",
        preview: "bigthumb",
        offline: true

    }).then(function(filebuffer) {
        fs.writeFile("/tmp/local.png", filebuffer, "binary");

    }).catch(function(err) {
        console.log("Error downloading the file: " + err);
        return;
    });

## Uploading files to Moodle

The client can be used to upload files into the user's draft files area within
the Moodle file system. Supported are both files with dynamically generated
contents as well as files already stored in the local file system. See
https://github.com/request/request#multipartform-data-multipart-form-uploads
for details on how to specify the data in both cases.

    var files = {
        myfile1: {
            value: "This text was uploaded by a client",
            options: {
                filename: "helloworld.txt",
                contentType: "text/plain"
            }
        },
        myfile2: fs.createReadStream("/tmp/upload.png"),
    };

Once you have such a list of files prepared, call the `upload()` method to
upload them to the user's draft files area. The returned promise fulfills
with an array of objects describing the created files.

    client.upload({
        files: files

    }).then(function(draftfiles) {
        console.log(draftfiles);
        return;

    }).catch(function(err) {
        console.log("Error uploading the file: " + err);
        return;
    });

The method allows you to hard-code the itemid within the user's draft area to
upload files to and eventually the target path for uploaded files, too.

To make use of uploaded files in Moodle, you typically call a webservice
function that accepts the id of draft item containing the uploaded files. For
example, to copy files from the temporary draft files area to the persistent
private files area, use the function `core_user_add_user_private_files`:

    client.upload({
        files: files

    }).then(function(draftfiles) {

        // Copy files from the draft area to the persistent private files area.
        client.call({
            wsfunction: "core_user_add_user_private_files",
            args: {
                draftid: draftfiles[0].itemid
            }

        }).then(function() {
            console.log("Total of %d files uploaded to your private files area!", draftfiles.length);
            return;
        });

        return;

    }).catch(function(err) {
        console.log("Error uploading the file: " + err);
        return;
    });

## Changes

### 0.5.0

* Added support for downloading files from Moodle. Credit goes to @MayaLekova
  for the initial implementation of the feature.
* Added support for uploading files to Moodle.
* Added basic support for travis-co prechecks.

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
