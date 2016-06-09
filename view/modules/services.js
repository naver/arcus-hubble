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
angular.module("services", [])
  /*
   * Hubble Services
   */
  .factory("Hubble", ["$http", "$q", "$templateCache", "SERVICE_NAME", "SERVER_LIST", "HUBBLE_ADDRESS", function($http, $q, $templateCache, SERVICE_NAME, SERVER_LIST, HUBBLE_ADDRESS) {
    return {
      name: "Hubble Service",
      sharedObject: {},
      getShared: function(key) {
          return this.sharedObject[key];  
      },
      setShared: function(key, value) {
        this.sharedObject[key] = value;
      },
      getServiceCodes: function(callback) {
        // FIXME config.js에서 $http를 직접 사용하는 방법을 찾기 전 까지는 이렇게 하자..
        if (SERVICE_NAME == "ARCUS") {
          var config = { cache: true };
          var url = "http://" + HUBBLE_ADDRESS + "/api/v1/cluster?callback=JSON_CALLBACK";
          $http.jsonp(url, config).success(function(data, status) {
            callback(data);
          }).error(function(data, status) {
            console.log(data, status);
          });
        } else {
          callback(SERVER_LIST);
        }
      },
      getKeys: function(hubble, server, options, callback) {
        if (! hubble) {
          console.log("getKeys", "missing parameter : hubble");
          callback(null);
        }
        if (! server) {
          console.log("getKeys", "missing parameter : server");
          callback(null);
        }
        var config = { params: options, cache: true };
        var url = ["http://", hubble, "/api/v1/key/", server, "?callback=JSON_CALLBACK"].join("");
        $http.jsonp(url, config).success(function(data, status) {
          callback(data);
        }).error(function(data, status) {
          console.log(data, status);
        });
      },
      getPrefixes: function(hubble, servers, arcusport, options, callback) {
        if (! hubble) {
          console.log("getPrefixes", "missing parameter : hubble");
          callback(null);
        }
        if (! servers) {
          console.log("getPrefixes", "missing parameter : servers");
          callback(null);
        }
        // FIXME 성능 때문에 일단 하나의 서버에서만 프리픽스를 가져온다.
        var config = { params: options, cache: true };
        var promises = [];

        servers.forEach(function(s) {
          var url = ["http://", hubble, "/api/v1/key/", s, "?callback=JSON_CALLBACK"].join("");
          promises.push($http.jsonp(url, config));
        });

        $q.all(promises).then(function(responses) {
          var set = {}; 
          for (var i = 0; i < responses.length; i++) {
            var data = responses[i].data;
            for (var instance in data.value.arcus_prefix) {
              var p = instance.split("-")[1];
              if (arcusport == null || arcusport.length == 0 || arcusport.indexOf(p) != -1) {
                data.value.arcus_prefix[instance].forEach(function(rrd) {
                  // RRD 파일 형식에 따라 prefix를 추출한다. 좀 거시기 함 ㅠ_ㅜ
                  var arr = rrd.split('-');
                  arr = arr.splice(1, arr.length);
                  var p = arr.join('-').replace('.rrd', '');
                  set[p] = "";
                });
              }
            }
          }
          callback(Object.keys(set).sort());
        });
      },
      /*
       * @param hubble 허블 주소
       * @param options Object 타입으로 다음과 같은 key를 포함해야 한다.
       *    auth : 인증 코드 (optional)
       *    value : 콤마로 구분된 키 값의 리스트
       *    interval : 원하는 시간 간격
       *    from : timestamp
       *    until : timestamp
       * @param callback 콜백 함수
       */
      getChartDataByRRD: function(hubble, keys, options, callback) {
        // HTTP GET 요청의 길이가 브라우저마다 제한되어 있으므로, 작은 단위로 쪼개어 보낸다.
        var result = { size: 0, value: [] };
        var splitFactor = 40;
        var promises = [];

        // 성능 개선을 위해 키를 정렬한다.
        keys = keys.sort();

        // 요청을 여러 개 만든다.
        for (var i = 0; i < keys.length / splitFactor; i++) {
          var splited = keys.slice(splitFactor*i, splitFactor*(i+1));          
          options.value = splited.join(",");

          var config = { params: options, cache: true };
          var url = ["http://", hubble, "/api/v1/rrd", "?callback=JSON_CALLBACK"].join("");
          promises.push($http.jsonp(url, config));
        }

        // 한번에 실행!
        $q.all(promises).then(function(responses) {
          for (var i = 0; i < responses.length; i++) {
            result.count = responses[i].data.count;
            result.from = responses[i].data.from;
            result.until = responses[i].data.until;
            result.size += responses[i].data.size;
            result.value = result.value.concat(responses[i].data.value);
          }
          callback(result);
        });
      },
      sortAlphaNumeric: function(a, b) {
        var reA = /[^a-zA-Z]/g;
        var reN = /[^0-9]/g;
        var aA = a.replace(reA, "");
        var bA = b.replace(reA, "");
        if (aA === bA) {
          var aN = parseInt(a.replace(reN, ""), 10);
          var bN = parseInt(b.replace(reN, ""), 10);
          return aN === bN ? 0 : aN > bN ? 1 : -1;
        } else {
            return aA > bA ? 1 : -1;
        }
      },
      cacheTemplates: function(partial) {
        if ($templateCache.get(partial)) {
          return;
        }
        $http.get(partial, { cache: $templateCache }).then(function(result) {
          //console.log(partial + " loaded and cached");
        })
      },
      getPorts: function(serviceCode, server, callback) {
        var config = { cache: true };
        var url = ["http://", HUBBLE_ADDRESS, "/api/v1/cluster_by_ip", "?callback=JSON_CALLBACK"].join("");
        $http.jsonp(url, config).success(function(data, status) {
          var result = [];
          for (var k in data) {
            var host = k.split(":")[0];
            if (host == server) {
              if (data[k].includes(serviceCode)) {
                var port = k.split(":")[1];
                if (port) {
                  result.push(port);
                }
              }
            }
          }
          callback(result);
        }).error(function(data, status) {
          console.log(data, status);
        });
      }
    };
  }])
  ;
