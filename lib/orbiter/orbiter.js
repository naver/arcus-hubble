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
var _ = require('underscore')
  , dns = require('dns')
  , util = require('util')
  , async = require('async')
  , zookeeper = require('zookeeper')
  , LOG = require('./log.js').LOG;

// FIXME
var hubble = require('../../conf/conf-orbiter.json').hubble;

/*
 * Some constants
 */
var CACHE_SERVER_MAPPING = '/arcus/cache_server_mapping';
var CACHE_LIST = '/arcus/cache_list'; 

/*
 * Orbiter class
 *
 * Orbiter sets a connection to the given zookeeper server,
 * and watches /arcus/cache_list
 *
 * Usage
 *   var o = new Orbiter();
 *   o.init({hosts : '127.0.0.1:2181'});
 */
exports = module.exports = Orbiter;

function Orbiter() {
  this.context = {};
  this.context.live_map = {};
}

Orbiter.prototype.init = function(context) {
  var self = this;
  self.context = context ? _.defaults(self.context, context) : self.context;

  // initialize zookeeper connection
  self.context.zk = new zookeeper();
  self.context.zk.init({
      connect: self.context.hosts
    , timeout: 10000
    , debug_level: zookeeper.ZOO_LOG_LEVEL_WARNING
    , host_order_deterministic: false
  });

  // on connect
  self.context.zk.on('connect', function(zk) {
    msg = 'ZK session[' + zk.client_id + '] established on ' + self.context.hosts;
    LOG.info(msg);
    if (!_.isEmpty(self.context.live_map)) {
      MEX.send_sms(msg);
    }
    self.get_mapping();
    self.start_to_watch();
  });

  // on close
  self.context.zk.on('close', function(zk) {
    msg = 'ZK session[' + zk.client_id + '] closed, trying to reconnect to ' + self.context.hosts;
    LOG.info(msg);
    MEX.send_sms(msg);
    self.init();
  });
}

Orbiter.prototype.start_to_watch = function() {
  var self = this;
  self.context.live_map = {};
  tasks = [];

  // FIXME zookeeper watcher function
  var watcher = function(type, state, path) {
    LOG.debug(util.format('event received : type=%d, state=%d, path=%s', type, state, path));

    self.context.zk.aw_get_children(path, watcher, function(rc, err, children) {
      code = path.split('/')[3];
      orig = self.context.live_map[code];
      curr = children.map(function(e) { return e.split('-')[0] });
      self.context.live_map[code] = curr;

      // find differences
      deleted = _.difference(orig, curr);
      created = _.difference(curr, orig);
      LOG.debug('orig="' + orig + '", curr="' + curr + '", deleted="' + deleted + '", created="' + created + '"');

      // do something with this event
      deleted.forEach(function(e) {
        message = util.format('%s was deleted on %s@%s', e, code, self.context.hosts);
        // do something with the message
      });

      created.forEach(function(e) {
        message = util.format('%s was created on %s@%s', e, code, self.context.hosts);
        // do something with the message
      });
    });
  }

  // get live service code list
  self.context.zk.a_get_children(CACHE_LIST, false, function(rc, err, path) {
    // tasks : set watches
    path.forEach(function(code) {
      tasks.push(function(cb) {
        self.context.zk.aw_get_children(CACHE_LIST + '/' + code, watcher, function(rc, err, children) {
            self.context.live_map[code] = children.map(function(e) { return e.split('-')[0] });
            cb(null, 'ok');
          }
        );
      });
    });
    // run tasks in parallel
    async.parallel(tasks, function(err, result) {
      if (err) LOG.error('error : ' + err);
      process.send({live_map:self.context.live_map});
    });
  });
}

Orbiter.prototype.get_mapping = function() {
  var self = this;
  var static_map = {};
  var static_ipport_map = {};
  self.context.zk.a_get_children(CACHE_SERVER_MAPPING, false, function(rc, err, path) {
    var tasks = [];
    path.forEach(function(e) {
      tasks.push(function(cb) {
        self.context.zk.a_get_children(CACHE_SERVER_MAPPING+'/'+e, false, function(rc, err, path) {
          if (static_map[path] == null) {
            static_map[path] = {};
          }
          var ipport = e.split(':');
          var ip = ipport[0];
          var port = ipport.length > 1 ? ipport[1] : null;
          dns.reverse(ip, function(err, domains) {
            if (err) {
              _.defaults(static_map[path], {"servers":{}, "hubble":hubble[path], "port":port});
              // if there's an service code with a port, it should be a private cloud.
              if (static_map[path].servers[ip]) {
                port = null;
              }
              static_map[path].servers[ip] = {ip:ip, port:port};
              static_ipport_map[port ? ip+':'+port : ip] = path;
            } else {
              _.defaults(static_map[path], {"servers":{}, "hubble":hubble[path], "port":port});
              // if there's an service code with a port, it should be a private cloud.
              if (static_map[path].servers[domains[0]]) {
                port = null;
              }
              static_map[path].servers[domains[0]] = {ip:ip, port:port};
              static_ipport_map[port ? ip+':'+port : ip] = path;
              static_ipport_map[port ? domains[0]+':'+port : domains[0]] = path;
            }
            cb(null, 'OK');
          });
        });
      });
    });
    async.series(tasks, function(err, result) {
      this.context.static_map = static_map;
      process.send({map:static_map, ipport_map:static_ipport_map});
    });
  });
}
