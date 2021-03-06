/*!
 * File:        ./gulpfile.js
 * Copyright(c) 2016-nowdays tbaltrushaitis@gmail.com
 * License:     MIT
 */

'use strict';

//  ------------------------------------------------------------------------  //
//  -----------------------------  DEPENDENCIES  ---------------------------  //
//  ------------------------------------------------------------------------  //

const _ = require('lodash');

const fs    = require('fs');
const del   = require('del');
const path  = require('path');
const util  = require('util');
const merge = require('merge-stream');
const utin  = util.inspect;

const argv           = require('yargs').argv;
const parseArgs      = require('minimist');
const vinylPaths     = require('vinyl-paths');
const dateFormat     = require('dateformat');

const gulp          = require('gulp');
const gulpTasks     = require('gulp-require-tasks');
const gulpSequence  = require('gulp-sequence').use(gulp);
const changed       = require('gulp-changed');
const gulpif        = require('gulp-if');
const jscs          = require('gulp-jscs');
const jshint        = require('gulp-jshint');
const stylish       = require('jshint-stylish');
const replace       = require('gulp-token-replace');

//  ------------------------------------------------------------------------  //
//  ----------------------------  CONFIGURATION  ---------------------------  //
//  ------------------------------------------------------------------------  //

global.ME = {};
let now = new Date();

const pkg = require('./package.json');
ME.pkg = Object.assign({}, pkg || {});
ME.version  = ME.pkg.version;
ME.pkg.built = `${dateFormat(now, 'yyyy-mm-dd')}T${dateFormat(now, 'HH:MM:ss')}`;
ME.pkg.year = `${dateFormat(now, 'yyyy')}`;
utin.defaultOptions = Object.assign({}, ME.pkg.options.iopts);

ME.NODE_ENV = argv.env
                ? argv.env
                : fs.existsSync('./NODE_ENV')
                  ? fs.readFileSync('./NODE_ENV', {encoding: 'utf8'}).split('\n')[0].trim()
                  : fs.existsSync('config/.NODE_ENV')
                    ? fs.readFileSync('config/.NODE_ENV', {encoding: 'utf8'}).split('\n')[0].trim()
                    : ME.NODE_ENV || 'test';

process.env.NODE_ENV = ME.NODE_ENV;
// console.log(`ME.NODE_ENV (${typeof ME.NODE_ENV}) = [${utin(ME.NODE_ENV)}]`);

ME.VERSION = fs.existsSync('./VERSION') ? fs.readFileSync('./VERSION', ME.pkg.options.file).trim() : 'VERSION_UNKNOWN';
ME.COMMIT  = fs.existsSync('./COMMIT') ? fs.readFileSync('./COMMIT', ME.pkg.options.file).trim() : 'COMMIT_UNKNOWN';

const appPath  = __dirname;
const modsPath = path.join(appPath, 'modules');
const confPath = path.join(appPath, 'config');
const confBase = path.join(confPath, ME.NODE_ENV + '.json');

console.log(`confPath (${typeof confPath}) = [${utin(confPath)}]`);
console.log(`confBase (${typeof confBase}) = [${utin(confBase)}]`);

const config = require('read-config')(confBase);

ME.Config = config;

ME.DIR = {};
ME.WD  = path.join(__dirname, path.sep);
ME.DOC = path.join('docs',    path.sep);

ME.TMP    = path.join('tmp',                  path.sep);
ME.SRC    = path.join('src',                  path.sep);
ME.BUILD  = path.join(`build-${ME.VERSION}`,  path.sep);
ME.DIST   = path.join(`dist-${ME.VERSION}`,   path.sep);
ME.WEB    = path.join(`webroot`,              path.sep);
ME.CURDIR = path.join(process.cwd(),          path.sep);
ME.BOWER  = JSON.parse(fs.existsSync('.bowerrc') ? fs.readFileSync('.bowerrc') : {directory: "bower_modules"}).directory;

let headTplName = path.join(confPath, 'header.tpl');
let footTplName = path.join(confPath, 'footer.tpl');
let headTplCtx = fs.existsSync( headTplName )
                      ? fs.readFileSync( headTplName )
                      : `
/*!
 * APP_HEAD:\t\t <%= pkg.title %>
 * Package:\t\t <%= pkg.name %>@<%= pkg.version %>
 * Built:\t\t ${dateFormat(now, 'yyyy-mm-dd')}T${dateFormat(now, 'HH:MM:ss')}
 * Description:\t <%= pkg.description %>
 * Purpose:\t\t <%= ME.NODE_ENV %>
 * Version:\t\t <%= ME.VERSION %>
 * Created:\t <<%= pkg.author.email %>>
 * License:\t\t <%= pkg.license %>
 * Visit:\t\t <%= pkg.homepage %>
 */
`;
let footTplCtx = fs.existsSync( footTplName )
                      ? fs.readFileSync( footTplName )
                      : `
/*!
 * Purpose:\t <%= ME.NODE_ENV %>
 * Version:\t <%= ME.VERSION %>
 * Built:\t ${dateFormat(now, 'yyyy-mm-dd')}T${dateFormat(now, 'HH:MM:ss')}
 * Commit:\t <%= ME.COMMIT %>
 * APP_FOOT:\t\t <%= pkg.name %>@<%= pkg.version %> - <%= pkg.title %>
 * =========================================================================== *
 */
`;

let headTpl = _.template(`${headTplCtx}`);
let footTpl = _.template(`${footTplCtx}`);

const Banner = {
    header: headTpl({pkg: ME.pkg, ME: ME})
  , footer: footTpl({pkg: ME.pkg, ME: ME})
};

console.log('\n');
console.log(`ME.Config = [${utin(ME.Config)}]`);
console.log('\n');

ME.Banner = Banner;

//  ------------------------------------------------------------------------  //
//  -------------------------------  TASKS  --------------------------------  //
//  ------------------------------------------------------------------------  //

gulpTasks({
    path:      process.cwd() + '/gulp-tasks'
  , separator: ':'
  , passGulp:  true
});

//  ENV ROUTER
gulp.task('default', function () {

  //  DEFAULT Scenario Route
  (function () {
    switch (ME.NODE_ENV) {
      case 'test': {
        gulp.start('test');
        break;
      }
      case ('dev' || 'development'): {
        gulp.start('dev');
        break;
      }
      case 'production': {
        gulp.start('prod');
        break;
      }
      default: {
        gulp.start('usage');
        break;
      }
    }
  })();

});

gulp.task('lint',         ['jscs', 'jshint']);
gulp.task('test',         ['lint', 'usage', 'show:config', 'show:src']);
gulp.task('dev',          ['build:dev']);
gulp.task('clean',        ['clean:build', 'clean:dist']);
gulp.task('build:assets', ['build:css', 'build:js', 'build:img']);

gulp.task('prod', [
    'build'
], function () {
  gulp.start('deploy');
});

gulp.task('build:dev', [
    'bower'
  , 'sync:src2build'
], function () {
  gulp.start('build:assets');
});

gulp.task('build', [
    'bower'
  , 'sync:src2build'
], function () {
  gulp.start('build:assets');
});

gulp.task('dist',   ['clean:dist'], function () {
  gulp.start('sync:build2dist');
});
gulp.task('deploy', ['sync:build2web']);
gulp.task('watch',  ['watch:src:css', 'watch:src:js']);


//  WATCHERS
gulp.task('watch:src:css', function () {
  var wCSS = gulp.watch([
      path.join(ME.SRC, 'assets/css', '**/*.css')
    ]
  , pkg.options.watch
  , function () {
      return  gulpSequence('sync:src2build', 'build:css', 'deploy')((err) => {
                if (err) {
                  console.log('ERROR OCCURED:', utin(err));
                }
              });
  });
  wCSS.on('change', function (event) {
    console.log('CSS', utin(event.path), 'was', utin(event.type), ', running tasks...');
  });
});

gulp.task('watch:src:js', function () {
  var wScripts = gulp.watch([
      path.join(ME.SRC, 'assets/js', '**/*.js')
    ]
  , pkg.options.watch
  , function () {
      return  gulpSequence('populate', 'sync:src2build', 'build:js', 'deploy')((err) => {
                if (err) {
                  console.log('ERROR OCCURED:', utin(err));
                }
              });
  });
  wScripts.on('change', function (event) {
    console.log('JS', utin(event.path), 'was', utin(event.type), ', running tasks...');
  });
});

//  LINTERS
gulp.task('jscs', function () {
  return gulp.src([
        path.join(ME.SRC, 'assets/js/front', '**/*.js')
      , path.join(ME.SRC, 'assets/js/app', '**/*.js')
    ])
    .pipe(jscs({configPath: 'config/.jscsrc'}))
    .pipe(jscs.reporter());
});
gulp.task('jshint', function () {
  let jshintConfig = JSON.parse(fs.existsSync('./config/.jshintrc') ? fs.readFileSync('./config/.jshintrc') : {});
  jshintConfig.lookup = false;
  return gulp.src([
        path.join(ME.SRC, 'assets/js/front', '**/*.js')
      , path.join(ME.SRC, 'assets/js/app', '**/*.js')
    ])
    .pipe(jshint(jshintConfig))
    .pipe(gulpif('production' === ME.NODE_ENV
      , jshint.reporter('jshint-stylish',   {verbose: true})
      , jshint.reporter('default',          {verbose: true})
    ));
    //  , jshint.reporter('fail',           {verbose: true})
});


//  Log file paths in the stream
gulp.task('show:src', function () {
  return gulp.src([
      path.join(ME.SRC, '**/*')
    , path.join(ME.SRC, '**/*.*')
    , path.join(ME.SRC, '**/.*')
  ])
  .pipe(changed(ME.BUILD))
  .pipe(vinylPaths(function (paths) {
    console.info('Changed:', paths);
    return Promise.resolve(paths);
  }));
});


//  Print environment configuration
gulp.task('show:config', function () {

  console.log('\n');
  console.log(`ME.Config = [${utin(ME.Config)}]`);
  console.log('\n');

  console.log('\n');
  console.log(`process.env = [${utin(process.env)}]`);
  console.log('\n');

});

/*  EOF: ROOT/gulpfile.js  */
