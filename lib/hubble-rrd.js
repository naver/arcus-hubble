/*
 * arcus-hubble - A dashboard service to monitor Arcus clusters
 * Copyright 2012-2014 NAVER Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var path = require('path');
var HUBBLE_HOME = path.resolve(__dirname + '/..');

var rrd = require('rrd')
  , rrddir = require('./rrd/rrddir.js')
  , async = require('async')
  , fs = require('fs')
  , _ = require('underscore')
  , conf = require('../conf/conf-rrd.json');

var cluster = require('cluster');

if (cluster.isMaster) {
  var cpu_count = require('os').cpus().length;
  for (var i = 0; i < cpu_count; i++) {
    cluster.fork();
  }

  cluster.on('exit', function(worker) {
    console.log('worker ' + worker.id + ' died');
    cluster.fork();
  });
} else {
  var express = require('express')
    , http = require('http');

  var web = express()
    , httpServer = http.createServer(web);

  process.on('uncaughtException', function(err) {
    console.log(err);
    process.exit(1);
  });


  web.configure(function () {
    web.set('views', HUBBLE_HOME + '/views');
    web.set('json spaces', 0); // in production mode
    web.use(express.bodyParser());
    web.use(express.compress());
    web.use(express.static(HUBBLE_HOME + '/public'));
  });

  web.get('/graph', function(req, res) {
    res.sendfile(HUBBLE_HOME + '/views/g.html');
  });


  // API : rrd

  /*
  web.param('host', function(req, res, next, id) {
  });
  */

  function rrd_fetch(result, path, res, size) { 
    var now = Math.ceil((new Date).getTime() / 1000);
    
    var options = {
      cf: 'MAX',
      start: result.from ? result.from : now - 60,
      end: result.until ? result.until : now,
      resolution: result.interval ? result.interval : 5
    };

    var r = [];
    rrd.fetch(conf.rrd_path+'/'+path, options, function (time, data) { 
      // end of data
      if (!time) {
        if (result.value.length > 0 && result.value[0].data.length > 1) {
          result.interval = result.value[0].data[1][0] - result.value[0].data[0][0];
          result.count = result.value[0].data.length;
        }
        result.value = result.value.concat(r);
        result.size += 1;
        if (result.size == size) {
          res.jsonp(result);
        }
        return;
      }
      // no data
      if (!data) {
        if (r.length > 0) {
          var entry = [time, null, null, null];
          for (var j=0; j<r.length; j++) {
            r[j].data.push(entry);
          }
        }
        return;
      }
      var i = 0;
      for (var k in data) {
        if (r.length < i+1) {
          var v = {
            key: path+'/'+k,
            data: []
          };
          r.push(v);
        }
        var entry = [time, data[k], data[k], data[k]]; 
        r[i++].data.push(entry);
      }
    });
  }

  web.get('/api/v1/rrd', function(req, res) {
    var keys = req.query.value.split(',');

    var result = {
      interval: req.query.resolution,
      size: 0,
      count: 0,
      from: req.query.from,
      until: req.query.until,
      value: []
    };

    var rrdkeys = {};
    keys.forEach(function(k, idx) {
      var rrdpath = k.split('/').slice(0, -1).join('/');
      rrdkeys[rrdpath] = 0;
    });

    var rrdarr = Object.keys(rrdkeys);
    // FIXME find the end condition
    var size = 0;
    rrdarr.forEach(function(path, idx) {
      var exists = fs.existsSync(conf.rrd_path + '/' + path);
      if (exists) {
        size += 1;
      }
    });
    if (size == 0) {
      res.jsonp({});
      return;
    }
    rrdarr.forEach(function(path, idx) {
      // FIXME
      // node-rrd has a bug that crashes the application
      // when the given file does not exist.
      fs.exists(conf.rrd_path + '/' + path, function(exists) {
        if (exists) {
          rrd_fetch(result, path, res, size);
        }
      });
    });
  });

  // API : key

  web.get('/api/v1/key', function(req, res) {
    var path = conf.rrd_path; 
    var grouped = req.query.hasOwnProperty('grouped')?true:false;

    rrddir.getKeys(path, grouped, {}, function(result) {
      res.jsonp(result);
    });
  });

  web.get('/api/v1/key/:host', function(req, res) {
    var path = [conf.rrd_path, req.params.host].join('/');
    var grouped = req.query.hasOwnProperty('grouped')?true:false;
    var options = {};
    if (req.query.excludes) {
      options.excludes = req.query.excludes.split(',');
    }
    rrddir.getKeys(path, grouped, options, function(result) {
      res.jsonp(result);
    });
  });

  web.get('/api/v1/key/:host/:plugin', function(req, res) {
    var path = [conf.rrd_path, req.params.host, req.params.plugin].join('/');
    var grouped = req.query.hasOwnProperty('grouped')?true:false;
    rrddir.getKeys(path, grouped, {}, function(result) {
      res.jsonp(result);
    });
  });

  // Server

  httpServer.on('listening', function() {
    console.log('hubble-rrd started on ' + conf.port);
  });

  httpServer.listen(conf.port);
}
