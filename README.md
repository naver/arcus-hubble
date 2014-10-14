Hubble
======

Simple dashboard for monitoring Arcus.
<!---
Current dashboard view is quite old so we're working on new dashboard.
(We'll open it soon in the new branch `react`)
--->

## Prerequisite

- `/etc/hosts` file preparation

Hubble needs to get hostname or FQDN(or fully quallified domain name) from cache node IP.
To enable this reverse DNS lookup, you must register < IP, hostname, FQDN > information
into `/etc/hosts` file for all cache nodes.

- `node.js` installation

```
cd ~
mkdir vendor
curl -OL http://nodejs.org/dist/v0.10.28/node-v0.10.28-linux-x64.tar.gz
tar xvf node-v0.10.28-linux-x64.tar.gz
ln -s node-v0.10.28-linux-x64 node

# set environment variable
export NODE_HOME=$HOME/vendor/node
export PATH=$NODE_HOME/bin:$PATH
```

- `rrdtool & collectd` installation

```
cd ~/vendor

# rrdtool
curl -OL http://oss.oetiker.ch/rrdtool/pub/rrdtool-1.4.8.tar.gz
tar xvf rrdtool-1.4.8.tar.gz
pushd rrdtool-1.4.8
./configure --prefix=$HOME/arcus-collectd
make; make install
popd

# collectd
curl -OL https://collectd.org/files/collectd-5.4.1.tar.gz
tar xvf collectd-5.4.1.tar.gz
pushd collectd-5.4.1
./configure --prefix=$HOME/arcus-collectd --enable-python --enable-rrdtool --with-librrd=$HOME/arcus-collectd
make; make install
popd
```

## Build & Deploy

- 1: Get the package

```
git clone http://github.com/naver/arcus-hubble
```

- 2: Modify configurations in `env.sh`

```
# Path to your collectd installation.
export COLLECTD_HOME=$HOME/arcus-collectd

# Path to your hubble installation.
export HUBBLE_HOME=$HOME/arcus-hubble

# Path to store RRD files.
export COLLECTD_RRD_DATADIR=$HOME/hubble_data

# ZooKeeper hosts
export HUBBLE_ZOOKEEPER_HOSTS="10.0.0.1:2181,10.0.0.2:2181,10.0.0.3:2181"

...

```

- 3: Build `arcus-collectd` and `arcus-hubble`

```
./setup.sh
```

- 4: Deploy `arcus-collectd` on all arcus cache machines.

```
# copy arcus-collectd to all arcus cache machines like below.
tar cvfz arcus-collectd.tar.gz arcus-collectd
scp arcus-collectd.tar.gz [[user@]cache-host:]install-path

# untar arcus-collectd at each arcus cache machine.
ssh [user@]cache-host
tar xvfz arcus-collectd.tar.gz
exit
```

## Start

- 1: Start collectd listeners at listener machine.

```
# Common collectd listener with 5 seconds interval.
# This listener collects system and Arcus statistics.
$COLLECTD_HOME/sbin/collectd -C $COLLECTD_HOME/etc/collectd-listener-5s.conf

# Optional collectd listener with 1 minute interval.
# This listener collects Arcus prefix statistics.
$COLLECTD_HOME/sbin/collectd -C $COLLECTD_HOME/etc/collectd-listener-1m.conf
```

- 2: Start collectd agents at all arcus cache machines.

```
$COLLECTD_HOME/sbin/collectd -C $COLLECTD_HOME/etc/collectd-arcus.conf
$COLLECTD_HOME/sbin/collectd -C $COLLECTD_HOME/etc/collectd-arcus-prefix.conf
```

- 3: Edit 'hubble' part of `conf/conf-orbiter.json`

```
# Each service code must be registered in this part like below examples.
# format: <service_code> : <hubble-rrd-server-ip:hubble-rrd-server-port>

  "hubble": {
      "test"   : "10.0.0.4:25832"
    , "test_1" : "10.0.0.4:25832"
    , "test_2" : "10.0.0.5:25832"
  }
```

- 4: Start node processes for viewing

```
./start.sh
```

- 5: View hubble on the web

```
# Enter the hubble IP and port in URL window of web browser. (chrome is recommended)

{hubble-ip}:8080
```

## Notes

- If you could not see `disk` statistics, you should check the collectd's `disk plugin`.

```
$COLLECTD_HOME/conf/collectd-arcus.conf

LoadPlugin disk

<Plugin disk>
  Disk "/^[hs]d[a-f][0-9]?$/"
#  Disk "/^[dev/cciss/c0d0p].*/"
  IgnoreSelected false
</Plugin>
```

## Issues

If you find a bug, please report it via the GitHub issues page.

https://github.com/naver/arcus-hubble/issues

## License

Licensed under the Apache License, Version 2.0: http://www.apache.org/licenses/LICENSE-2.0

