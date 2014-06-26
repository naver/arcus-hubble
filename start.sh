#!/bin/sh

. ./env.sh

forever stopall
sleep 2;
forever start lib/hubble-orbiter.js
sleep 2;
forever start lib/hubble-rrd.js
sleep 2;
forever start lib/hubble-view.js
