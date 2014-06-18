var through = require("through2"),
	gutil = require("gulp-util"),
	cdnizer = require('cdnizer'),
    Magic = require('mmmagic').Magic;

function pluginError(msg) {
	return new gutil.PluginError("gulp-cdnizer", msg);
}

module.exports = function(opts) {
	"use strict";
	
	var cdnizerHandler = cdnizer(opts);


	//noinspection JSUnusedLocalSymbols
	function cdnizerStream(file, enc, callback) {
        var magic = new Magic();
		// Do nothing if no contents
		if(file.isNull()) {
			this.push(file);
			return callback();
		}

		if(file.isStream()) {
			this.emit("error", pluginError("Stream content is not supported"));
			return callback();
		}

		// check if file.contents is a `Buffer`
		if(file.isBuffer()) {
            var self = this;
			try {
                magic.detect(file.contents, function(err, detectedType) {
                    if (err) throw err;
                    if (detectedType.indexOf('text') > -1) {
                        file.contents = new Buffer(cdnizerHandler(String(file.contents)));
                        self.push(file);
                        return callback();
                    }
                    else {
                        return callback(err, file);
                    }
                });
			} catch(error) {
				this.emit("error", pluginError(error.toString()))
			}
		}

	}

	return through.obj(cdnizerStream);
};
