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
var app = angular.module('HubbleApp', ['config', 'controllers', 'services', 'directives', 'ui.select2', 'ui.bootstrap'])
  .config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider){
    $routeProvider
      .when('/main', {
        templateUrl: '/partials/main.html',
        controller: 'MainController'
      })
      .when('/service', {
        templateUrl: '/partials/service.html',
        controller:  'ServiceCodeController'
      })
      .when('/service/:serviceCode', {
        templateUrl: '/partials/service.html',
        controller:  'ServiceCodeController'
      })
      .when('/service/:serviceCode/:server', {
        templateUrl: '/partials/service.html',
        controller:  'ServiceCodeController'
      })
      .when('/service/:serviceCode/:server/:tab', {
        templateUrl: '/partials/service.html',
        controller:  'ServiceCodeController'
      })
      .when('/service/:serviceCode/:server/:tab/:subtab', {
        templateUrl: '/partials/service.html',
        controller:  'ServiceCodeController'
      })
      .when('/dashboard', {
        templateUrl: '/partials/dashboard.html',
        controller: 'DashboardController'
      })

    $routeProvider.otherwise({redirectTo: '/service'});
    //$locationProvider.html5Mode(true);
  }]);

//url 주소만 변경하고 reload하지 않을 수 있도록
//$location 모듈에 flag를 줌
app.run(['$route', '$rootScope', '$location', function ($route, $rootScope, $location) {
  var original = $location.path;
  $location.path = function (path, reload) {
    if (reload === false) {
      var lastRoute = $route.current;
      var un = $rootScope.$on('$locationChangeSuccess', function () {
        $route.current = lastRoute;
        un();
      });
    }
    return original.apply($location, [path]);
  };
}]);