var through = require("through2"),
	gutil = require("gulp-util"),
	minimatch = require('minimatch'),
	merge = require('deepmerge'),
	fs = require('fs'),
	path = require('path'),
	_ = require('lodash');

var error = function(msg) {
		return new gutil.PluginError("gulp-cdnizer", msg);
	},
	
	parseOptions = function(opts) {
		if(!opts || (typeof opts !== 'object' && !Array.isArray(opts))) {
			throw error("No options or invalid options supplied");
		}
		if(Array.isArray(opts)) {
			opts = {files: opts};
		}
		if(!Array.isArray(opts.files) || opts.files.length === 0) {
			throw error("Invalid or empty files list supplied");
		}
		opts = merge({
			defaultCDNBase: '',
			defaultCDN: '<%= defaultCDNBase %>/<%= filepathRel %>',
			allowRev: true,
			allowMin: true,
			bowerComponents: null,
			// escaped to prevent IntelliJ from being too smart
			fallbackScript: '<scr'+'ipt>function cdnizerLoad(u) {document.write(\'<scr\'+\'ipt src="\'+encodeURIComponent(u)+\'"></scr\'+\'ipt>\');}</script>',
			fallbackTest: '<scr'+'ipt>if(!(${ test })) cdnizerLoad("${ filepath }");</script>',
			shouldAddFallback: false
		}, opts);
		
		opts.files = opts.files.map(function(fileInfo) {
			if(typeof fileInfo === 'string' && fileInfo.length > 0) {
				fileInfo = { file: fileInfo };
			}
			if(!fileInfo.file || typeof fileInfo.file !== 'string') {
				throw error('File declaration is invalid');
			}
			if(fileInfo.test) {
				opts.shouldAddFallback = true;
			}
			if(opts.allowMin && fileInfo.file.indexOf('.min') === -1) {
				fileInfo.file = fileInfo.file.replace(/\.(.*)$/, '.?(min.)$1');
			}
			if(opts.allowRev) {
				fileInfo.file = fileInfo.file.replace(/(\..*)$/, '?(-????????)$1');
			}
			return fileInfo;
		});
		
		opts.defaultCDNBase = opts.defaultCDNBase.replace(/\/$/, '');
		return opts;
	},
	
	matchers = [
		{ pattern: /(<script\s.*?src=["'])(.+?)(["'].*?>\s*<\/script>)/gi, fallback: true },
		{ pattern: /(<link\s.*?href=["'])(.+?)(["'].*?>\s*<\/link>)/gi, fallback: true },
		{ pattern: /(<link\s.*?href=["'])(.+?)(["'].*?\/?>)/gi, fallback: true },
		{ pattern: /(<img\s.*?src=["'])(.+?)(["'])/gi, fallback: false },
		{ pattern: /(url\()(.+?)(\))/gi, fallback: false }
	];

module.exports = function(opts) {
	"use strict";

	opts = parseOptions(opts);
	
	function findFileInfo(url) {
		url = decodeURIComponent(url);
		return _.find(opts.files, function(fileInfo) {
			return minimatch(url, fileInfo.file);
		});
	}
	
	var bowerRoot = './bower_components',
		bowerrc;
	if(opts.bowerComponents) {
		bowerRoot = opts.bowerComponents;
	} else if(fs.existsSync('./.bowerrc')) {
		bowerrc = JSON.parse(require('fs').readFileSync('./.bowerrc', {encoding: 'utf8'}));
		if(bowerrc && bowerrc.directory) {
			bowerRoot = path.join('.', bowerrc.directory);
		}
	}
	
	var versionInfoCache = {};
	function getVersionInfo(pkg) {
		if(!pkg) return {};
		if(!versionInfoCache[pkg]) {
			var packageInfo, version, packageRoot = path.join(process.cwd(), bowerRoot, pkg);
			if(fs.existsSync(path.join(packageRoot, 'bower.json'))) {
				packageInfo = require(path.join(packageRoot, 'bower.json'));
			} else if(fs.existsSync(path.join(packageRoot, '.bower.json'))) {
				packageInfo = require(path.join(packageRoot, '.bower.json'));
			} else {
				throw error('Unable to load bower.json for package "'+pkg+'".  Looked under "'+packageRoot+'"');
			}
			version = (packageInfo.version || '0.0.0').match(/(\d+)?\.(\d+)?\.(\d+)?/);
			versionInfoCache[pkg] = {
				version: packageInfo.version || '0.0.0',
				major: version[1] || 0,
				minor: version[2] || 0,
				patch: version[3] || 0
			}
		}
		return versionInfoCache[pkg];
	}
	
	function getFilenameMin(url) {
		url = path.basename(url);
		if(opts.allowRev) {
			url = url.replace(/-\w{8}(\..+)$/, '$1');
		}
		url = url.replace(/\.(min\.)?(\..+)$/, '.min.$2');
		return url;
	}


	function cdnizer(file, enc, callback) {

		// Do nothing if no contents
		if(file.isNull()) {
			this.push(file);
			return callback();
		}

		if(file.isStream()) {
			this.emit("error", error("Stream content is not supported"));
			return callback();
		}

		// check if file.contents is a `Buffer`
		if(file.isBuffer()) {
			
			var contents = String(file.contents),
				canAddFallback = opts.shouldAddFallback && contents.indexOf('<head') !== -1,
				didAddFallback = false;
			
			matchers.forEach(function(m) {
				contents = contents.replace(m.pattern, function(match, pre, url, post) {
					var fileInfo = findFileInfo(url), result, params;
					if(fileInfo) {
						result = pre;
						params = merge(getVersionInfo(fileInfo.package), {
							defaultCDNBase: opts.defaultCDNBase,
							filepath: url,
							filepathRel: url.replace(/^\//, ''),
							filename: path.basename(url),
							filenameMin: getFilenameMin(url),
							package: fileInfo.package,
							test: fileInfo.test
						});
						result += _.template(fileInfo.cdn || opts.defaultCDN, params);
						result += post;
						if(canAddFallback && m.fallback && fileInfo.test) {
							result += _.template(opts.fallbackTest, params);
							didAddFallback = true;
						}
						return result;
					} else {
						// do nothing
						return match;
					}
				});
			});
			
			if(didAddFallback) {
				contents = contents.replace(/<link|<script|<\/head/i, function(m) {
					return opts.fallbackScript + m;
				});
			}
			
			file.contents = new Buffer(contents);

			this.push(file);

		}
		return callback();
	}

	return through.obj(cdnizer);
};
