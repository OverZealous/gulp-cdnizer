/*global describe, it*/
"use strict";

var fs = require("fs"),
	es = require("event-stream"),
	should = require("should");

require("mocha");

delete require.cache[require.resolve("../")];

var gutil = require("gulp-util"),
	cdnizer = require("../"),
	loadFile = function(name) {
		return new gutil.File({
			path: "test/expected/"+name,
			cwd: "test/",
			base: "test/expected",
			contents: fs.readFileSync("test/expected/"+name)
		})
	};

describe("gulp-cdnizer", function () {

	var processInput = function(opts, expectedFileName, done) {
			var stream = cdnizer(opts),
				srcFile = new gutil.File({
					path: "test/fixtures/index.html",
					cwd: "test/",
					base: "test/fixtures",
					contents: fs.readFileSync("test/fixtures/index.html")
				});
	
			stream.on("error", function(err) {
				should.not.exist(err);
				done(err);
			});
	
			stream.on("data", function (newFile) {
	
				should.exist(newFile);
				should.exist(newFile.contents);
	
				String(newFile.contents).should.equal(String(loadFile(expectedFileName).contents));
				done();
			});
	
			stream.write(srcFile);
			stream.end();
		};
	
	it("should not modify a file if no matches", function (done) {
		processInput(['/no/match'], 'index-none.html', done);
	});
	
	it("should modify on basic input", function (done) {
		processInput({
			files: ['css/main.css', 'js/**/*.js'],
			defaultCDNBase: '//examplecdn/'
		}, 'index-generic.html', done);
	});
	
	it("should handle varied input", function (done) {
		processInput({
			files: ['css/*.css', 'js/**/*.js'],
			defaultCDNBase: '//examplecdn'
		}, 'index-generic.html', done);
	});
	
	it("should handle min and fallbacks", function (done) {
		processInput({
			files: [{
				file: 'js/**/angular/angular.js',
				test: 'window.angular'
			}],
			defaultCDNBase: '//examplecdn'
		}, 'index-fallback.html', done);
	});
	
	it("should handle bower versions (.bowerrc)", function (done) {
		processInput({
			files: [{
				file: 'js/**/angular/angular.js',
				package: 'angular',
				cdn: '//ajax.googleapis.com/ajax/libs/angularjs/${ major }.${ minor }.${ patch }/angular.min.js'
			}]
		}, 'index-bowerrc.html', done);
	});
	
	it("should handle bower versions (passed in)", function (done) {
		processInput({
			bowerComponents: './test/bower_components',
			files: [{
				file: 'js/**/angular/angular.js',
				package: 'angular',
				cdn: '//ajax.googleapis.com/ajax/libs/angularjs/${ major }.${ minor }.${ patch }/angular.min.js'
			}]
		}, 'index-bower.html', done);
	});

	it("should error on stream", function (done) {

		var stream = cdnizer(['foo/bar']);
		
		var srcFileStream = new gutil.File({
			path: "test/fixtures/index.html",
			cwd: "test/",
			base: "test/fixtures",
			contents: fs.createReadStream("test/fixtures/index.html")
		});

		stream.on("error", function(err) {
			should.exist(err);
			done();
		});

		stream.on("data", function (newFile) {
			newFile.contents.pipe(es.wait(function(err, data) {
				done(err);
			}));
		});

		stream.write(srcFileStream);
		stream.end();
	});
});
