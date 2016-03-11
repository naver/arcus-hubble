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
angular.module("controllers",[])
  .controller("DashboardController", ["$scope", "$location", "$routeParams", "Hubble", function($scope, $location, $routeParams, Hubble) {
  	$scope.sumObject = function(arr, property) {
  		var result = 0;
  		if (! arr) {
  			return;
  		}
  		arr.forEach(function(o) {
  			result += o[property] || 0;
  		});
  		return result;
  	}

  	$scope.onInfo = function() {
  		$scope.loading = true;
	  	Hubble.getServiceCodes(function(data) {
	  		// 데이터 가공
	  	  var arr = [];
	  	  for (var k in data) {
	  	  	var cloud = {
	  	  		name: k,
	  	  		zookeeper: data[k].zookeeper,
	  	  		hosts: [],
	  	  		ports: data[k].ports,
	  	  		hubble: data[k].hubble
	  	  	};

	  	  	for (var hostname in data[k].servers) {
	  	  		var info = data[k].servers[hostname];
	  	  		cloud.hosts.push({ host:hostname, ip:info.ip, ports:info.ports });
	  	  	}
	  	  	cloud.hosts.sort(function(l, r) { return (l.host < r.host) ? -1 : 1; });
					arr.push(cloud);
	  	  }

	  	  arr.sort(function(l, r) { return (l.name < r.name) ? -1 : 1; });
	  		$scope.cloudInfo = arr;
	  		$scope.loading = false;
	  	});
  	};
  }])

  /*
   * PeriodController
   */
  .controller("PeriodController", ["$scope", "$location", "$routeParams", function($scope, $location, $routeParams) {
  	var selector = $routeParams.selector;
  	var period = $routeParams.period;

  	$scope.selectPeriod = function(selector, period) {
	  	$scope.period = period || "30m";
	  	$scope.periodSelector = selector || "now";

	  	var query = $location.search();
	  	if (query.selector != $scope.periodSelector || query.period != $scope.period) {
	  		// 쿼리 스트링이 다를 때만 URL을 변경한다.
	  		query.selector = $scope.periodSelector;
	  		query.period = $scope.period;
	  		$location.path($location.path()).search(query);
	  	}
  	};

  	$scope.selectPeriod(selector, period);
  }])

  /*
   * PrefixController
   */
  .controller("PrefixController", ["$scope", "$location", "$routeParams", "Hubble", function($scope, $location, $routeParams, Hubble) {

  	$scope.selectPrefix = function(prefix) {
	  	$scope.selectedPrefix = prefix;

	  	var query = $location.search();
	  	if (query.prefix != prefix) {
	  		// 쿼리 스트링이 다를 때만 URL을 변경한다.
	  		query.prefix = prefix;
	  		$location.path($location.path()).search(query);
	  	}
  	};

  	if (! $routeParams.prefix) {
  		$scope.selectPrefix("null");
  	} else {
			Hubble.getPrefixes(Hubble.getShared("hubble"), Hubble.getShared("serverlist"), Hubble.getShared("arcusport"), {grouped: true}, function(data) {
				$scope.selectedPrefix = $routeParams.prefix;
				$scope.prefixList = data;
			});
  	}
  }])

  /*
   * ServiceCodeController
   */
  .controller("ServiceCodeController", ["$scope", "$location", "$routeParams", "Hubble", function($scope, $location, $routeParams, Hubble) {
    // Events
	  $scope.serviceCodeSelected = function(serviceCode) {
	  	if ($scope.serviceCodeObject[serviceCode]) {
	  		$scope.selectedServiceCode = serviceCode;
	  	}
	  	var info = $scope.serviceCodeObject[$scope.selectedServiceCode];
	  	if (info) {
	  		$scope.serverList = Object.keys(info.servers).sort();
	  		$scope.hubble = info.hubble;
	  	}
	  	if ($routeParams.serviceCode != $scope.serviceCode) {
	  		//$scope.serverSelected($scope.serverList[0]);
        $scope.serverSelected($routeParams.server || $scope.serverList[0]);
	  	}
	  };
	  $scope.serverSelected = function(server) {
	  	if (server) {
	  		$scope.selectedServer = server;
	  		Hubble.setShared("server", server);
	  	}
	  	// FIXME 이건 진짜 별로다 ㅠ_ㅜ 어떻게 하는게 좋을까?
	  	var urlArray = $location.path().split("/");
	  	var url = {
		  	route: urlArray[1],
		  	serviceCode: urlArray[2],
		  	server: urlArray[3],
		  	tab: urlArray[4] || null,
		  	subtab: urlArray[5] || null
	  	}
			var newUrl = [url.route, $scope.selectedServiceCode, $scope.selectedServer].join("/");
			if (url.tab) {
				newUrl += ("/" + url.tab);
			}
			if (url.subtab) {
				newUrl += ("/" + url.subtab);
			}
			$location.path(newUrl);
	  };

    // Get service code list
    Hubble.getServiceCodes(function(data) {
      $scope.serviceCodeObject = data;
      $scope.serviceCodeList = Object.keys(data).sort();

      if ($routeParams.serviceCode) {
        $scope.serviceCodeSelected($routeParams.serviceCode);
      }
      // if ($routeParams.server) {
      //  $scope.selectedServer = $routeParams.server
      // }
    });
  }])

  /*
   * TabController
   */
  .controller("TabController", [
  "$scope", "$location", "$routeParams", "$templateCache", "Hubble", "SERVICE_NAME", "DEFAULT_TABS", "PLUGINS",
  function($scope, $location, $routeParams, $templateCache, Hubble, SERVICE_NAME, DEFAULT_TABS, PLUGINS) {
		// Events
    $scope.initTabs = function(hubble, server, ptab, psubtab, options) {
	  	Hubble.getKeys(hubble, server, options, function(data) {
	  		$scope.pluginKeys = data.value;

        // 플러그인이 정의 되어 있다면, 탭에 추가한다.
        if (PLUGINS) {
          PLUGINS.forEach(function(p) {
            data.value[p.name] = p.tabs;
          });
        }

	  		// 대분류 탭(cpu, memory, ...)을 만든다.
	  		var tabs = [];
	  		for (var k in data.value) {
	  			var tab = {
	  				title: k,
	  				overviewTemplateUrl: "/partials/tabs/" + k + "_overview.html",
	  				templateUrl: "/partials/tabs/" + k + ".html"
	  			};

				//해당 탭이 선택된 상태라면 active 상태로 만든다.
				if( k==ptab ) {
					tab.active = (k == ptab);
					$scope.selectedTab = tab;
				}
				tabs.push(tab);

	  			// 소분류 탭(eth0, eth1, ...)을 만든다.
	  			var subtabs = [];

				var overview = { key: "overview", title: "overview", active: "overview" == psubtab };

				if (overview.title.split("_").length > 1) {
					overview.trimmedTitle = overview.title.split("_")[1];
				} else {
					overview.trimmedTitle = overview.title;
				}
				subtabs.push(overview);

	  			Object.keys(data.value[k]).sort(Hubble.sortAlphaNumeric).forEach(function(subk) {
	  				// FIXME 콘솔리데이션된 아커스 서비스라면, 특정 포트만 모니터링 한다.
	  				// 썩 좋진 않은데, 이런 건 어떻게 처리하는게 좋을까?
	  				if (subk.indexOf("arcus_stat") == 0) {
	  					var arcusport = $scope.arcusPort;
	  					var p = subk.split("-")[1];
	  					if (arcusport && arcusport.length != 0 && arcusport.indexOf(p) == -1) {
	  						return;
	  					}
	  				}

	  				var subtab = { key: subk, title: subk, active: subk == psubtab };
	  				if (subk.split("_").length > 1) {
	  					subtab.trimmedTitle = subk.split("_")[1];
	  				} else {
	  					subtab.trimmedTitle = subk;
	  				}

	  				subtabs.push(subtab);
	  			});

	  			tab.subtabs = subtabs;
	  		};

				// 탭을 원하는 순서로 정렬한다. preferred에 포함되지 않은 plugin은 표시되지 않으므로 주의.
	  		var preferred = DEFAULT_TABS;
	  		var sortedTabs = [];
	  		for (var i = 0; i < preferred.length; i++) {
	  			for (var j = 0; j < tabs.length; j++) {
	  				if (tabs[j].title.indexOf(preferred[i]) == 0) {
	  					sortedTabs.push(tabs[j]);

			  			// 탭 내용이 될 템플릿을 $templateCache에 캐싱한다.
			  			// ng-include를 이용할 경우, 암묵적으로 캐싱되지 않아 템플릿을 매번 요청해야 하는 문제가 있으므로
			  			// 이렇게 명시적으로 템플릿 캐시에 넣어 주어야 요청 latency를 줄일 수 있다.
			  			Hubble.cacheTemplates(tabs[j].overviewTemplateUrl);
			  			Hubble.cacheTemplates(tabs[j].templateUrl);
	  				}
	  			}
	  		}

	  		// 탭 모델을 갱신한다.
	  		$scope.tabs = sortedTabs;
	  	});
    };

    $scope.onTab = function(tab) {
    	if (! tab || ! tab.active) {
    		return;
    	}

    	if (tab.title == $routeParams.tab) {
    		return;
    	}

    	var path = ["/service", $scope.serviceCode, $scope.server].join("/");

		$scope.selectedTab = tab;
		path += ("/" + tab.title);

		var subtab= { key: "overview", title: "overview", active: true };
		if (subtab.title.split("_").length > 1) {
			subtab.trimmedTitle = subtab.title.split("_")[1];
		} else {
			subtab.trimmedTitle = subtab.title;
		}

		$scope.selectedSubTab = subtab;
		path += ("/overview");

		//이전에 봤던 탭 정보  초기화
		for( var i = 0; i < $scope.tabs.length; i++ ) {
			if($scope.tabs[i].title == tab.title){
				for(var j = 0; j < $scope.tabs[i].subtabs.length; j++ ) {
					if($scope.tabs[i].subtabs[j].title == 'overview') {
						$scope.tabs[i].subtabs[j].active = true;
						continue;
					}
					$scope.tabs[i].subtabs[j].active = false;
				}
			}
		}

		//refresh를 고려한 url 변경. reload는 하지 않는다.
		$location.path(path, false);
    };

    $scope.onSubTab = function(tab, subtab) {
    	if (! tab || ! tab.active) {
    		return;
    	}

    	if (! subtab || ! subtab.active) {
    		return;
    	}

    	if (subtab.title == $routeParams.subtab) {
    		return;
    	}

    	var path = ["/service", $scope.serviceCode, $scope.server].join("/");

  		$scope.selectedTab = tab;
  		path += ("/" + tab.title);

  		$scope.selectedSubTab = subtab;
  		path += ("/" + subtab.title);

		$location.path(path, false);
    };

    $scope.serviceName = SERVICE_NAME;
    $scope.serviceCode = $routeParams.serviceCode;
    $scope.server = $routeParams.server;
    $scope.query = $location.search();
    $scope.loading = false;

    // Get key list
    Hubble.getServiceCodes(function(data) {
      if (! data[$scope.serviceCode]) {
        console.log("invalid service code : " + $scope.serviceCode);
        return;
      }
      $scope.serviceInfo = data[$scope.serviceCode];
      $scope.hubble = $scope.serviceInfo.hubble;
      $scope.arcusPort = $scope.serviceInfo.ports;
      $scope.serverList = Object.keys($scope.serviceInfo.servers).sort();
      $scope.serverListString = $scope.serverList.join(",");

      Hubble.setShared("hubble", $scope.hubble);
      Hubble.setShared("serverlist", $scope.serverList);
      Hubble.setShared("server", $scope.serverList[0]);
      Hubble.setShared("arcusport", $scope.arcusPort);

      //$scope.initTabs($scope.hubble, $scope.server, {excludes: 'arcus_prefixes', grouped: true});
      $scope.initTabs($scope.hubble, $scope.server, $routeParams.tab, $routeParams.subtab, {grouped: true});
    });

  }])
	;
