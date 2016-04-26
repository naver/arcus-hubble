import re
import os
import time
import socket
import collectd
import traceback

MEMCACHED_HOST = 'localhost'
MEMCACHED_PORTS = []
COLLECTION_MODE = 'stat'

TYPE_COMMENTS_RE = '^[#\\s]'
TYPE_CUT_RE = '^([^\s]+)\s+(.*)'

TYPES_DB = {}

TYPES_CONV = {
  'kv_get' : 'get',
  'kv_hit' : 'hit',
  'kv_set' : 'set',
  'kv_del' : 'del',
  'lop_create' : 'lcs',
  'lop_insert' : 'lis',
  'lop_insert_hit' : 'lih',
  'lop_delete' : 'lds',
  'lop_delete_hit' : 'ldh',
  'lop_get' : 'lgs',
  'lop_get_hit' : 'lgh',
  'sop_create' : 'scs',
  'sop_insert' : 'sis',
  'sop_insert_hit' : 'sih',
  'sop_delete' : 'sds',
  'sop_delete_hit' : 'sdh',
  'sop_get' : 'sgs',
  'sop_get_hit' : 'sgh',
  'sop_exist' : 'ses',
  'sop_exist_hit' : 'seh',
  'bop_create' : 'bcs',
  'bop_insert' : 'bis',
  'bop_insert_hit' : 'bih',
  'bop_update' : 'bus',
  'bop_update_hit' : 'buh',
  'bop_incr' : 'bps',
  'bop_incr_hit' : 'bph',
  'bop_decr' : 'bms',
  'bop_decr_hit' : 'bmh',
  'bop_delete' : 'bds',
  'bop_delete_hit' : 'bdh',
  'bop_get' : 'bgs',
  'bop_get_hit' : 'bgh',
  'bop_count' : 'bns',
  'bop_count_hit' : 'bnh',
  'getattr' : 'gas',
  'setattr' : 'sas'
}

QOS_OPS = {
  'qos_kv_set' : 'set arcus:qos-kv 0 3 4\r\nDATA\r\n',
  'qos_kv_get' : 'get arcus:qos-kv\r\n',
  'qos_lop_insert' : 'lop insert arcus:qos-lop 0 4 create 0 3 10\r\nDATA\r\n',
  'qos_lop_get' : 'lop get arcus:qos-lop 0..10\r\n',
  'qos_lop_delete' : 'lop delete arcus:qos-lop 0..10 drop\r\n',
  'qos_sop_insert' : 'sop insert arcus:qos-sop 4 create 0 3 10\r\nDATA\r\n',
  'qos_sop_exist' : 'sop exist arcus:qos-sop 4\r\nDATA\r\n',
  'qos_sop_delete' : 'sop delete arcus:qos-sop 4 drop\r\nDATA\r\n',
  'qos_bop_insert' : 'bop insert arcus:qos-bop 1 4 create 0 3 10\r\nDATA\r\n',
  'qos_bop_get' : 'bop get arcus:qos-bop 1..10\r\n',
  'qos_bop_delete' : 'bop delete arcus:qos-bop 1..10 10 drop\r\n'
}

QOS_RES = {
  'qos_kv_set' : 'STORED\r\n',
  'qos_kv_get' : 'END\r\n',
  'qos_lop_insert' : 'CREATED_STORED\r\n',
  'qos_lop_get' : 'END\r\n',
  'qos_lop_delete' : 'DELETED_DROPPED\r\n',
  'qos_sop_insert' : 'CREATED_STORED\r\n',
  'qos_sop_exist' : 'EXIST\r\n',
  'qos_sop_delete' : 'DELETED_DROPPED\r\n',
  'qos_bop_insert' : 'CREATED_STORED\r\n',
  'qos_bop_get' : 'END\r\n',
  'qos_bop_delete' : 'DELETED_DROPPED\r\n'
}

def str_to_num(s):
  try:
    n = float(s)
  except ValueError:
    n = 0
  return n

def get_memcached_ports():
  result = []
  pids = [pid for pid in os.listdir('/proc') if pid.isdigit()]

  for pid in pids:
    try:
      cmd = open(os.path.join('/proc', pid, 'cmdline'), 'r').read()
      if 'memcached' in cmd and 'default_engine.so' in cmd:
        port = re.findall('-p\x00([\d]+)', cmd)
        if len(port) > 0:
          result.append(int(port[0]))
    except Exception, e:
      continue

  return result

def get_type_instances(dbfile):
  result = {}
  types = []
  types_file = file(dbfile, 'r')
  for line in types_file.readlines():
    types.append(line.replace('\r\n', ''))
  types_file.close()

  for type in types:
    if not re.search(TYPE_COMMENTS_RE, type):
      typeobj = re.findall(TYPE_CUT_RE, type)[0]
      typename = typeobj[0]
      result[typename] = {}
      result[typename]['dsnames'] = []
      eachtype = typeobj[1].split(', ')
      for each in eachtype:
        # lop_get:COUNTER:0:U
        props = each.split(':')

        if typename.startswith('arcus_stats'):
          # FIXME fix for rrdtool's dsname character limit(=19 chars)
          props[0] = props[0].replace('ins', 'insert').replace('upd', 'update').replace('del', 'delete')
        elif typename.startswith('arcus_prefixes'):
          # FIXME make 'stats detail dump' metrics readable
          for fr, to in TYPES_CONV.iteritems():
            if props[0] == fr: props[0] = to
        
        result[typename][props[0]] = { 'type' : props[1].lower(), 'min' : props[2], 'max' : props[3] }
        result[typename]['dsnames'].append(props[0])
        
  return result

#def get_latency_ms(sock, operation):
#  begin = time.time()
#  sock.sendall(operation)
#  return (time.time() - begin) * 1000

def get_latency_ms(sock, file, qos_key):
  begin = time.time()
  sock.sendall(QOS_OPS[qos_key])

  while (1):
    line = file.readline()
    if not line or QOS_RES[qos_key] == line or 'NOT_FOUND\r\n' == line:
      break

  return (time.time() - begin) * 1000

def fetch_stat(host, port):
  result_stats = {}
  result_stats_detail = {}

  try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.3)
    s.connect((host, port))
  except:
    collectd.error('memcached_stat plugin: error connecting to %s:%d'%(MEMCACHED_HOST, port))
    return None

  fp = s.makefile('r')

  try:
    # stats
    s.sendall('stats\r\n')

    while (1):
      line = fp.readline()
      if not line or 'END\r\n' == line:
        break
      stat = line.replace('\r\n', '').split(' ')
      result_stats[stat[1]] = stat[2]

    # stats slabs
    s.sendall('stats slabs\r\n')

    while (1):
      line = fp.readline()
      if not line or 'END\r\n' == line:
        break
      stat = line.replace('\r\n', '').split(' ')
      result_stats[stat[1]] = stat[2]

    # stats detail dump
    s.sendall('stats detail dump\r\n')

    while (1):
      line = fp.readline()
      if not line or 'END\r\n' == line:
        break
      stat = line.replace('\r\n', '').split(' ')
      prefix_name = stat[1]
      prefix_stats = stat[2:]
      result_stats_detail[prefix_name] = {}

      for i in range(0, len(prefix_stats), 2):
        prefix_stat_name = prefix_stats[i]
        result_stats_detail[prefix_name][prefix_stat_name] = prefix_stats[i+1]

    # QoS (get operation latencies)
    result_stats['qos_kv_set']     = get_latency_ms(s, fp, 'qos_kv_set')
    result_stats['qos_kv_get']     = get_latency_ms(s, fp, 'qos_kv_get')
    result_stats['qos_lop_insert'] = get_latency_ms(s, fp, 'qos_lop_insert')
    result_stats['qos_lop_get']    = get_latency_ms(s, fp, 'qos_lop_get')
    result_stats['qos_lop_delete'] = get_latency_ms(s, fp, 'qos_lop_delete')
    result_stats['qos_sop_insert'] = get_latency_ms(s, fp, 'qos_sop_insert')
    result_stats['qos_sop_exist']  = get_latency_ms(s, fp, 'qos_sop_exist')
    result_stats['qos_sop_delete'] = get_latency_ms(s, fp, 'qos_sop_delete')
    result_stats['qos_bop_insert'] = get_latency_ms(s, fp, 'qos_bop_insert')
    result_stats['qos_bop_get']    = get_latency_ms(s, fp, 'qos_bop_get')
    result_stats['qos_bop_delete'] = get_latency_ms(s, fp, 'qos_bop_delete')

  except socket.timeout:
    collectd.error('memcached_stat plugin: socket timeout')
    return result_stats, result_stats_detail

  s.close()

  return result_stats, result_stats_detail

def config_callback(conf):
  global MEMCACHED_HOST, TYPES_DB, MEMCACHED_PORTS, COLLECTION_MODE
  for node in conf.children:
    if node.key == 'Host':
      MEMCACHED_HOST = node.values[0]
    elif node.key == 'Port':
      if node.values[0] == 'DETECT':
        MEMCACHED_PORTS = get_memcached_ports()
      else:
        MEMCACHED_PORTS.append(str_to_num(node.values[0]))
    elif node.key == 'TypesDB':
      TYPES_DB = get_type_instances(node.values[0])
    elif node.key == 'Mode':
      COLLECTION_MODE = node.values[0]
    else:
      collectd.warning('arcus_stat plugin: Unknown config key: %s'%node.key)

def read_callback():
  global MEMCACHED_HOST, TYPES_DB, MEMCACHED_PORTS, COLLECTION_MODE
  # FIXME always check available arcus ports
  MEMCACHED_PORTS = get_memcached_ports()
  for port in MEMCACHED_PORTS:
    try:
      stats, stats_detail = fetch_stat(MEMCACHED_HOST, port)

      if COLLECTION_MODE == 'stat':
        # stats
        for type, entries in TYPES_DB.iteritems():
          if not type.startswith('arcus_stats'): continue
          varray = []
          stat_failed = False
          for dsname in entries['dsnames']:
            if stats.has_key(dsname):
              varray.append(str_to_num(stats[dsname]))
            else:
              collectd.warning('memcached_stat plugin: stats dont\'t have %s'%dsname)
              stat_failed = True
              break
          if stat_failed: continue
          value = collectd.Values(plugin='arcus_stat-%d'%port)
          value.type = type
          value.values = varray
          value.dispatch()
      elif COLLECTION_MODE == 'prefix':
        # stats detail dump
        for prefix, props in stats_detail.iteritems():
          # TODO refine prefix
          for type, entries in TYPES_DB.iteritems():
            if not type.startswith('arcus_prefixes'): continue
            if type.startswith('arcus_prefixes_meta'): continue
            varray = []
            stat_failed = False
            for dsname in entries['dsnames']:
              if props.has_key(dsname):
                varray.append(str_to_num(props[dsname]))
              else:
                collectd.warning('memcached_stat plugin: prefix dont\'t have %s' % dsname)
                stat_failed = True
                break
            if stat_failed: continue
            value = collectd.Values(plugin='arcus_prefix-%d'%port)
            value.type_instance = prefix
            value.type = type
            value.values = varray
            value.dispatch()
        # number of prefixes 
        nprefixes = len(stats_detail)
        value = collectd.Values(plugin='arcus_prefix-%d'%port)
        value.type_instance = 'arcus_prefixes_meta'
        value.type = 'arcus_prefixes_meta'
        value.values = [nprefixes]
        value.dispatch()
      else:
        collectd.warning('invalid mode : '%COLLECTION_MODE)

    except Exception, e:
      #collectd.warning('arcus_stat plugin: %s : type=%s, entries=%s'%(e, type, entries))
      collectd.error('arcus_stat plugin: %s'%(traceback.format_exc()))


if __name__ == '__main__':
  read_callback()

collectd.register_config(config_callback)
collectd.register_read(read_callback)

