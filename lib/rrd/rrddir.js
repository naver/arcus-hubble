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
var walk = require('walk');
var rrd = require('rrd');

exports.getKeys = getKeys;

function defaults(o, key, value) {
  if (o && !o.hasOwnProperty(key)) {
    o[key] = value;
  }
}

function getKeys(path, grouped, options, callback) {
  var result = {};
  result.meta = {};
  result.keys = [];

  if (grouped) {
    result.value = {};
  } else {
    result.value = [];
  }

  var walker_opts = {
    followLinks: false
  };

console.log(path)
  walker = walk.walk(path, walker_opts); 

  walker.on('names', function(root, nodeNames) {
  });

  walker.on('directories', function(root, dirStats, next) {
    next();
  });

  walker.on('file', function(root, fileStats, next) {
    var filename = root + '/' + fileStats.name;
    var cutlen = path.split('/').length;
    var arr = filename.split('/').splice(cutlen);

    if (fileStats.name.indexOf('.rrd', fileStats.name.length - 4) == -1) {
      next();
      return;
    }

    if (options.excludes) {
      var stop = false;
      options.excludes.forEach(function(e) {
        if (fileStats.name.indexOf(e) >= 0) {
          stop = true;
        }
      });
      if (stop) {
        next();
        return;
      }
    }

/*
    // rrd info
    rrd.info(filename, function(info) {
      var rrd_arr = arr.slice(0, arr.length);
      var ds = {};
      var j = JSON.stringify(info);
      j.replace(/ds\[([0-9a-zA-Z_]+)\]/g, function(m, m1) {
        ds[m1] = 0;
      });
      result.meta[rrd_arr.join('/')] = Object.keys(ds);
      Object.keys(ds).forEach(function(e) {
        result.keys.push(rrd_arr.join('/') + '/' + e);
      });
*/

      if (grouped) {
        var curr = result.value;
        arr.forEach(function(elem, index, list) {
          var g = elem.split('-');
          if (index == arr.length-2) {
            defaults(curr, g[0], {});
            curr = curr[g[0]];
          }
          if (index == arr.length-2) {
            defaults(curr, elem, []);
          } else if (index == arr.length-1) {
            curr.push(elem);
          } else {
            defaults(curr, elem, {});
          }
          curr = curr[elem];
        });
      } else {
        var str = arr.join('.');
        result.value.push(str);
      }

      next();
/*
    }); // end of rrd info
*/

/*
    if (arr.length < 2) {
      next();
      return;
    }
*/
  });

  walker.on('errors', function(root, nodeStats, next) {
    next();
  });

  walker.on('end', function() {
    callback(result);
  });
}

