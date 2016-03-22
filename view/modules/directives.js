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
var periods = {
  "5m":  { count: (60 *  5 / 5).toFixed(0), interval: 5*1000, tick: "minutes", tick_interval: "2", tick_format: "%H:%M", t: "5s" },
  "30m": { count: (60 * 30 / 5).toFixed(0), interval: 5*1000, tick: "minutes", tick_interval: "10", tick_format: "%H:%M", t: "5s" },
  "1h":  { count: (60 * 60 / 5).toFixed(0), interval: 5*1000, tick: "minutes", tick_interval: "20", tick_format: "%H:%M", t: "5s" },
  "3h":  { count: (60 * 60 * 3/ 5).toFixed(0), interval: 5*1000, tick: "minutes", tick_interval: "60", tick_format: "%H:%M", t: "5s" },
  "6h":  { count: (60 * 60 *  6 / 35).toFixed(0), interval: 35*1000, tick: "hours", tick_interval: "3", tick_format: "%H:%M", t: "5m" },
  "12h": { count: (60 * 60 * 12 / 35).toFixed(0), interval: 35*1000, tick: "hours", tick_interval: "3", tick_format: "%H:%M", t: "5m" },
  "1d":  { count: (60 * 60 * 24 / 35).toFixed(0), interval: 35*1000, tick: "hours", tick_interval: "6", tick_format: "%H:%M", t: "10m" },
  "1w":  { count: (60 * 60 * 24 *  7 / 250).toFixed(0), interval: 250*1000, tick: "days", tick_interval: "2", tick_format: "%m/%d", t: "10m" },
  "1M":  { count: (60 * 60 * 24 * 30 / 1115).toFixed(0), interval: 1115*1000, tick: "weeks", tick_interval: "1", tick_format: "%m/%d", t: "3h" },
  "3M":  { count: (60 * 60 * 24 * 30 * 3 / 13175).toFixed(0), interval: 13175*1000, tick: "months", tick_interval: "2", tick_format: "%m/%d", t: "1d" },
  "6M":  { count: (60 * 60 * 24 * 30 * 6 / 13175).toFixed(0), interval: 13175*1000, tick: "months", tick_interval: "2", tick_format: "%b", t: "1d" },
  "1Y":  { count: (60 * 60 * 24 * 365 / 13175).toFixed(0), interval: 13175*1000, tick: "months", tick_interval: "3", tick_format: "%b", t: "1w" },
};

var periodsPrefix = {
  "5m":  { count: (60 *  5 / 60).toFixed(0), interval: 60*1000, tick: "minutes", tick_interval: "2", tick_format: "%H:%M", t: "5s" },
  "30m": { count: (60 * 30 / 60).toFixed(0), interval: 60*1000, tick: "minutes", tick_interval: "10", tick_format: "%H:%M", t: "5s" },
  "1h":  { count: (60 * 60 / 60).toFixed(0), interval: 60*1000, tick: "minutes", tick_interval: "20", tick_format: "%H:%M", t: "5s" },
  "3h":  { count: (60 * 60 * 3/ 60).toFixed(0), interval: 60*1000, tick: "minutes", tick_interval: "60", tick_format: "%H:%M", t: "5s" },
  "6h":  { count: (60 * 60 *  6 / 420).toFixed(0), interval: 420*1000, tick: "hours", tick_interval: "3", tick_format: "%H:%M", t: "5m" },
  "12h": { count: (60 * 60 * 12 / 420).toFixed(0), interval: 420*1000, tick: "hours", tick_interval: "3", tick_format: "%H:%M", t: "5m" },
  "1d":  { count: (60 * 60 * 24 / 420).toFixed(0), interval: 420*1000, tick: "hours", tick_interval: "6", tick_format: "%H:%M", t: "10m" },
  "1w":  { count: (60 * 60 * 24 *  7 / 3000).toFixed(0), interval: 3000*1000, tick: "days", tick_interval: "2", tick_format: "%m/%d", t: "10m" },
  "1M":  { count: (60 * 60 * 24 * 30 / 13380).toFixed(0), interval: 13380*1000, tick: "weeks", tick_interval: "1", tick_format: "%m/%d", t: "3h" },
  "3M":  { count: (60 * 60 * 24 * 30 * 3 / 158100).toFixed(0), interval: 158100*1000, tick: "months", tick_interval: "2", tick_format: "%m/%d", t: "1d" },
  "6M":  { count: (60 * 60 * 24 * 30 * 6 / 158100).toFixed(0), interval: 158100*1000, tick: "months", tick_interval: "2", tick_format: "%b", t: "1d" },
  "1Y":  { count: (60 * 60 * 24 * 365 / 158100).toFixed(0), interval: 158100*1000, tick: "months", tick_interval: "3", tick_format: "%b", t: "1w" },
}

angular.module("directives",[])
  .directive("aggregatedBy", function() {
    return function(scope, element, attrs) {
      var key = attrs.chartKey;
      var pluginPrefix = attrs.aggregatedBy;
      var arcusport = scope.arcusPort;
      var aggregated = [];

      Object.keys(scope.pluginKeys[pluginPrefix]).sort().forEach(function(k) {
        if (k.indexOf("arcus") == 0) {
          key = element[0].dataset.chartKey.replace("%query.prefix%", prefix);
          // FIXME 콘솔리데이션 처리...
          var p = k.split("-")[1];
          if (arcusport && arcusport.length != 0 && arcusport.indexOf(p) == -1) {
            return;
          }
        }
        aggregated.push([k, key].join("/"));
      });

      element[0].dataset.chartKey = aggregated.join(",");
    };
  }) // end of aggregatedBy

  .directive("aggregatedByServers", function() {
    return function(scope, element, attrs) {
      var key = attrs.chartKey;
      var pluginPrefix = attrs.aggregatedByServers;
      var arcusport = scope.arcusPort;
      var aggregated = [];

      Object.keys(scope.serviceInfo.servers).sort().forEach(function(s) {
        if (scope.pluginKeys[pluginPrefix] == null) {
          return;
        }
        Object.keys(scope.pluginKeys[pluginPrefix]).forEach(function(k) {
          if (k.indexOf("arcus") == 0) {
            key = element[0].dataset.chartKey.replace("%query.prefix%", scope.query.prefix);
            // FIXME 콘솔리데이션 처리...
            var p = k.split("-")[1];
            if (arcusport && arcusport.length != 0 && arcusport.indexOf(p) == -1) {
              return;
            }
          }
          aggregated.push(s + "/" + k + "/" + key);
        });
      });
      element[0].dataset.chartKey = aggregated.join(",");
    }
  }) // end of aggregatedByServers

  .directive("chartgroup", function(Hubble) {
    return function(scope, element, attrs) {
      scope.$watch("selectedSubTab", function(tab) {
        // process only on visible tab
        if (! element.is(":visible")) {
          return;
        }

        //그래프가 이미 존재할 때 그래프들을 지운다.
        //사실 그래프 자체를 새로 그리는 게  가장 좋은 코드라 생각하지만
        //이미 렌더링 된 현재 코드 구조에서 그래프를 지우기 위한 방법이 이것밖에 없다.
        var children = element.children();
        for( var i = 0; i < children.length; i++ ) {
          children[i].innerHTML = "";
        }

        // make keys
        var keys = [];
        var children = element.children();
        for (var i = 0; i < children.length; i++) {
          var chart = children[i];
          chart.dataset.chartKey.split(",").forEach(function(k) {
            if (! chart.getAttribute("aggregated-by-servers") && ! chart.getAttribute("contains-hostname")) {
              keys.push(scope.server + "/" + k);
            } else {
              keys.push(k);
            }
          });
        }

        // request
        // service를 directive에서 사용하는 것은 좋지 않지만,
        // 지금은 딱히 좋은 방법이 떠오르지 않으므로 여기서 사용한다.
        var axis_option;
        if (scope.tab.title == "sum_prefix" || scope.tab.title == "stacked_sum_prefix") {
          axis_option = periodsPrefix[scope.query.period] || periodsPrefix["30m"];
        } else {
          axis_option = periods[scope.query.period] || periods["30m"];
        }

        var options = {
          auth: "arcus",
          interval: axis_option.t,
          from: Math.round(Date.now() / 1000) - (axis_option.count * axis_option.interval / 1000),
          until: Math.round(Date.now() / 1000)
        };

        var master = window.helix.master({
          chart : {
            x : {
              count : axis_option.count,
              interval : axis_option.interval
            }
          },
          query : {
            auth : options.auth,
            value : options.value,
            interval : options.interval,
            until : options.until
          }
        });

        Hubble.getChartDataByRRD(scope.hubble, keys, options, function(data) {
          master.setJSON(data);
          for (var i = 0; i < children.length; i++) {
            var chart = children[i];
            // refine keys (duplicated)
            var keysForChart = chart.dataset.chartKey.split(",").map(function(k) {
              if (! chart.getAttribute("aggregated-by-servers") && ! chart.getAttribute("contains-hostname")) {
                return scope.server + "/" + k;
              } else {
                return k;
              }
            });

            // render it
            window.helix.render({
              target : chart,
              type : chart.dataset.chartType,
              group : chart.dataset.chartGroup,
              data : extractData(master.data, keysForChart),
              chart : {
                width : chart.dataset.chartWidth || 500,
                height : chart.dataset.chartHeight || 250,
                // padding & margin = [ top, right, bottom, left ]
                padding : [50, 200, 50, 80],
                margin : [0, 0, 0, 0],
                x : {
                  count : axis_option.count,
                  interval : axis_option.interval,
                  tick : axis_option.tick,
                  tick_interval : axis_option.tick_interval,
                  tick_format : axis_option.tick_format
                },
                y : {
                  ticks : 5,
                  label : function(v) {
                    if (v >= 1000000000 && v % 1000000000 === 0) { return v/1000000000 + "G" }
                    if (v >= 1000000    && v % 1000000 === 0   ) { return v/1000000 + "M"    }
                    if (v >= 1000       && v % 1000 === 0      ) { return v/1000 + "K"       }
                    return v;
                  }
                },
                desc : {
                  title : chart.dataset.chartTitle,
                  legend : chart.dataset.chartLegend
                }
              },
              query : {
                auth : options.auth,
                value : keysForChart.join(","),
                interval : options.interval,
                until : options.until
              }
            }); // end of master.render()
          } // end of for()
        }); // end of Hubble.getChartDataByRRD()
      });
    };
  }) // end of chart-group

function extractData(master, keys) {
  var ret = { time: master.time, value: []};
  if (! master.value || ! Array.isArray(master.value)) {
    return ret;
  }
  for (j = 0; j < keys.length; j++) {
    for (var k = 0; k < master.value.length; k++) {
      if (master.value[k].key === keys[j]) {
          ret.value.push(master.value[k]);
          break;
      }
    }
  }
  return ret;
}

function isScrolledOnTopOfView(elem){
  var docViewTop = $(window).scrollTop();
  var docViewBottom = docViewTop + $(window).height();

  var elemTop = $(elem).offset().top;
  var elemBottom = elemTop + $(elem).height();

  return (elemTop <= docViewBottom);
}
