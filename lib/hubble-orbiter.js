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
var cluster = require('cluster')
  , orbiter = require('../lib/orbiter/orbiter.js')
  , conf = require('../conf/conf-orbiter.json')
  , _ = require('underscore');

/*
 * As node.js's zookeeper library runs in single-threaded mode,
 * multiple orbiter processes should be forked per zookeeper connection.
 */
if (cluster.isMaster) {
  var map = {};
  var live_map = {};
  var ipport_map = {};
  for (var i in conf.zookeepers) {
    worker = cluster.fork({ hosts : conf.zookeepers[i] });
    worker.on('message', function(msg) {
      if (msg.map) {
        _.extend(map, msg.map);
      }
      if (msg.live_map) {
        _.extend(live_map, msg.live_map);
      }
      if (msg.ipport_map) {
        _.extend(ipport_map, msg.ipport_map);
      }
    });
  }

  // Web
  var express = require('express')
    , http = require('http');

  var web = express()
    , httpServer = http.createServer(web);

  web.configure(function () {
    web.set('views', __dirname + '/views');
    web.set('view engine', 'jade');
    //web.set('json spaces', 0); // in production mode
    web.use(express.bodyParser());
    web.use(express.static(__dirname + '/public'));
  });

  // NEW APIs
  web.get('/api/v1/service_code/get_live', function(req, res) {
    res.jsonp(live_map);
  });

  web.get('/api/v1/service_code/get_live/:service_code', function(req, res) {
    res.jsonp(live_map[req.params.service_code]);
  });

  web.get('/api/v1/service_code/get_static', function(req, res) {
    res.jsonp(map);
  });

  web.get('/api/v1/service_code/get_by_ip', function(req, res) {
    res.jsonp(ipport_map);
  });

  // ---

  web.get('/api/v1/cluster', function(req, res) {
    res.jsonp(map);
  });

  web.get('/api/v1/cluster/:name', function(req, res) {
    res.jsonp(map[req.params.name]);
  });

  web.get('/api/v1/cluster_by_ip', function(req, res) {
    res.jsonp(ipport_map);
  });

  web.get('/api/v1/cluster_by_ip/:ipport', function(req, res) {
    res.jsonp(ipport_map[req.params.ipport]);
  });

  httpServer.on('listening', function() {
    console.log('http server started on ' + conf.port);
  });

  httpServer.listen(conf.port);
} else if (cluster.isWorker) {
  context = {
    hosts : process.env.hosts
  };
  new orbiter().init(context);
}
