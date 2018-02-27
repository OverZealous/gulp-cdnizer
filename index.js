var through = require("through2");
var gutil = require("gulp-util");
var cdnizer = require('cdnizer');

function pluginError(msg) {
	return new gutil.PluginError("gulp-cdnizer", msg);
}

module.exports = function(opts) {
	"use strict";

	var cdnizerHandler = cdnizer(opts);


	//noinspection JSUnusedLocalSymbols
	function cdnizerStream(file, enc, callback) {

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
			try {
				file.contents = new Buffer(cdnizerHandler(String(file.contents)));
				this.push(file);
			} catch(error) {
				this.emit("error", pluginError(error.toString()))
			}
		}
		return callback();
	}

	return through.obj(cdnizerStream);
};
