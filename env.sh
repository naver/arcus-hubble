#!/bin/bash

# Path to your collectd installation.
export COLLECTD_HOME=$HOME/arcus-collectd

# Path to your hubble installation.
export HUBBLE_HOME=$HOME/arcus-hubble

# Path to store RRD files.
export COLLECTD_RRD_DATADIR=$HOME/hubble_data

# Identify current IP automatically. Change it if you want to specify IP.
export COLLECTD_LISTENER_IP=`/sbin/ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n 1`

# Collectd listener port for interval 5 sec.
export COLLECTD_LISTENER_5S_PORT="25828"

# Collectd listener port for interval 1 min. (for Arcus prefix statistics)
export COLLECTD_LISTENER_1M_PORT="25829"

# ZooKeeper hosts
export HUBBLE_ZOOKEEPER_HOSTS="10.0.0.1:2181,10.0.0.2:2181,10.0.0.3:2181"

# Hubble Orbiter Port
# - Orbiter watches Arcus directories in ZooKeeper.
# - And serves informations for every cache cluster in the ZooKeeper.
export HUBBLE_ORBITER_PORT=3000

# Hubble RRD Server Port
# - RRD Server serves chart data in RRD files.
export HUBBLE_RRD_SERVER_PORT=25832

# Hubble Web Port
# - Serves interactive chart dashboard.
export HUBBLE_WEB_PORT=8080


export LD_LIBRARY_PATH=$COLLECTD_HOME/lib
