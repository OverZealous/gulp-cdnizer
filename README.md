# gulp-cdnizer
[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url]

> cdnizer plugin for [gulp](https://github.com/wearefractal/gulp)

This plugin will replace references in HTML and other files with CDN locations.  It's flexible without being overly complicated, and handles private *and* public CDNs.  It can use your bower installation to determine file versions.

It also provides optional fallback scripts for failed file loading.  By default it can only handle failed JavaScript files, but it shouldn't be too difficult to provide a better script.

## Usage

First, install `gulp-cdnizer` as a development dependency:

```shell
npm install --save-dev gulp-cdnizer
```

Then, add it to your `gulpfile.js`:

```javascript
var cdnizer = require("gulp-cdnizer");

gulp.src("./src/index.html")
        .pipe(cdnizer({
            defaultBase: "//my.cdn.host/base",
            allowRev: true,
            allowMin: true,
            files: [
                'js/app.js',
                {
                    file: 'vendor/angular/angular.js',
                    package: 'angular',
                    test: 'angular',
                    cdn: '//ajax.googleapis.com/ajax/libs/angularjs/${ major }.${ minor }.${ patch }/angular.min.js'
                },
                {
                    file: 'vendor/firebase/firebase.js',
                    test: 'Firebase',
                    cdn: '//cdn.firebase.com/v0/firebase.js'
                }
            ]
        })
        .pipe(gulp.dest("./dist"));
        
// Alternatively, just pass in the files array if you don't need to provide any options, and only have custom files:
gulp.src("./src/index.html")
        .pipe(cdnizer([
            {
                file: 'vendor/angular/angular.js',
                package: 'angular',
                test: 'angular',
                cdn: '//ajax.googleapis.com/ajax/libs/angularjs/${ major }.${ minor }.${ patch }/angular.min.js'
            },
            {
                file: 'vendor/firebase/firebase.js',
                test: 'Firebase',
                cdn: '//cdn.firebase.com/v0/firebase.js'
            }
        ])
        .pipe(gulp.dest("./dist"));
```

## API

### cdnizer(options|files)

Note: If options is an array, it is assumed to be the array of files to process, and the rest of the options are left as their default.

#### options.defaultCDNBase

Type: `String`  
Default: `''` (disabled)

Used for a default, custom CDN, usually for your own files.  This will be used in the defaultCDN property to define the default path for a CDN unless overridden.

#### options.defaultCDN

Type: `String`  
Default: `'${ defaultCDNBase }/${ filepathRel }'`

Used for a default, custom CDN, usually for your own files.  This will simply be prepended to the current path for a given file, unless that file has a custom `cdn` property.

#### options.allowRev
Type: `Boolean`  
Default: `true`

Allow for file names with `gulp-rev` appended strings, in the form of `<file>-XXXXXXXX.<ext>`.  If you are using the `gulp-rev` plugin, this will automatically match filenames that have a rev string appeneded to them.  If you are *not* using `gulp-rev`, then you can disable this by setting `allowRev` to `false`, which will prevent possible errors in accidentally matching similar file names.

#### options.allowMin

Type: `Boolean`  
Default: `true`

Allow for file names to have `.min` inserted before the file extension (but after rev, if enabled).  This allows you to use the base name for a file, and have `cndizer` match the minified name.

#### options.fallbackScript

Type: `String`  
Default: 

```html
<script>
function cdnizerLoad(u) {
	document.write('<scr'+'ipt src="'+encodeURIComponent(u)+'"></scr'+'ipt>';
}
</script>
```

Overwrite the default fallback script.  If any of the inputs has a fallback, this script is injected before the first occurence of `<link`, `<script`, or `</head>` in the HTML page.  Ignored for files that don't contain `<head`.

#### options.fallbackTest

Type: `String`  
Default: `'<script>if(!(${ test })) cdnizerLoad("${ filepath }");</script>'`

Overwrite the default fallback test.  Note that all options availble to `options.files[].cdn` below are available to this template as well, along with the `options.files[].test` string.

#### options.bowerComponents

Type: `String`
Default: null

If provided, this is the directory to look for bower components in.  If not provided, cdnizer will attempt to look for the `.bowerrc` file, and if that is not found or does not specify a directory, it falls back to `'./bower_components'`.

Once the directory is determined, the script will look for files in `<bowerComponents>/bower.json` or `<bowerComponents>/.bower.json` to try to determine the version of the installed component.

#### options.files

Type: `Array`  
Default: (none) **required**

Array of sources or objects defining sources to cdnize.  Each item in the array can be one of two types, a simple glob or object hashmap.

Globs are simply matched against found sources, and have the `defaultBase` prepended to them. They will not get fallbacks. 

The object hashmap allows for more fine-tuning of the result, using the following properties:

> ##### options.files[].file

> Type: `String`
> Default: (none) **required**

> Glob to match against for the file to cdnize.  All properties within this object will be applied to all files that match the glob.  Globs are matched in a first-come, first-served basis, where only the first matched object hashmap is applied.

> ##### options.files[].package

> Type: `String`  
> Default: (none)

> Bower package name for this source or set of sources.  By providing the package name, cdnizer will look up the version string of the *currently installed* bower package, and provide it as a property to the `cdn` string.  This is done by looking for either the `bower.json` or `.bower.json` file within your bower components directory.

> ##### options.files[].cdn

> Type: `String`  
> Default: `options.defaultCDN`

> Provides a custom CDN string, which can be a simple static string, or contain one or more underscore/lodash template properties to be injected into the string:

> * `version`: if [`package`](#optionsfilespackage) was provided, this is the currently installed version from bower.
> * `major`: if `package` was provided, this is the major version number.
> * `minor`: if `package` was provided, this is the minor version number.
> * `patch`: if `package` was provided, this is the patch version number.
> * `defaultBase`: the default base provided above.  Note that this will *never* end with a trailing slash.
> * `filepath`: the full path of the source, as it exists currently.  There is no guarantee about the whether this contains a leading slash or not, so be careful.
> * `filepathRel`: the full path of the source, but guaranteed to *never* have a leading slash.
> * `filename`: the name of the file, without any parent directories
> * `filenameMin`: the name of the file, *without* any rev tags (if `allowRev` is true), but *with* a `.min` extension added.  This won't add a min if there is one already. 
> * `package`: the bower package name, as provided above.

> ##### options.files[].test

> Type: `String`  
> Default: (none)

> If provided, this string will be evaluated within a javascript block.  If the result is truthy, then we assume the CDN resource loaded properly.  If it isn't, then the original local file will be loaded.  This is ignored for files that don't get the [fallback script](#optionsfallbackscript).

> See [`options.fallbackScript`](#optionsfallbackscript) and [`options.fallbackTest`](#optionsfallbacktest) for more information.

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)

[npm-url]: https://npmjs.org/package/gulp-cdnizer
[npm-image]: https://badge.fury.io/js/gulp-cdnizer.png

[travis-url]: http://travis-ci.org/OverZealous/gulp-cdnizer
[travis-image]: https://secure.travis-ci.org/OverZealous/gulp-cdnizer.png?branch=master

[coveralls-url]: https://coveralls.io/r/OverZealous/gulp-cdnizer
[coveralls-image]: https://coveralls.io/repos/OverZealous/gulp-cdnizer/badge.png

[depstat-url]: https://david-dm.org/OverZealous/gulp-cdnizer
[depstat-image]: https://david-dm.org/OverZealous/gulp-cdnizer.png
