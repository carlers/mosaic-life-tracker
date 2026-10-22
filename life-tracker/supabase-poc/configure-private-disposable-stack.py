#!/usr/bin/env python3
"""Configure a brand new private, nondefault CLI project; no database access."""
import json
import os
import re
import secrets
import socket
import subprocess
import sys
from pathlib import Path

def choose_port_base():
    for _ in range(120):
        base = 32000 + secrets.randbelow(15000)
        sockets = []
        try:
            for port in range(base, base + 14):
                sk = socket.socket()
                sk.bind(("127.0.0.1", port))
                sockets.append(sk)
            return base
        except OSError:
            pass
        finally:
            for sk in sockets:
                sk.close()
    raise ValueError("No available isolated local port range")

def configure(directory, project):
    if not re.fullmatch(r"mosaic_dr_[a-z0-9]{12}", project):
        raise ValueError("Expected independently generated DR project name")
    p = Path(directory) / "supabase" / "config.toml"
    if not p.is_file():
        raise ValueError("Expected fresh supabase init config")
    text = p.read_text()
    match = re.findall(r'(?m)^project_id\s*=\s*"[^"]+"', text)
    if len(match) != 1:
        raise ValueError("Cannot identify local project ID")
    text = text.replace(match[0], 'project_id = "' + project + '"')
    base = choose_port_base()
    sections = {'api':0, 'db':1, 'studio':3, 'inbucket':4,
                'local_smtp':4, 'analytics':5, 'db.pooler':6}
    section = ""
    seen = set()
    newlines = []
    for line in text.splitlines(keepends=True):
        heading = re.fullmatch(r'\[([^\]]+)\]', line.strip())
        if heading:
            section = heading.group(1)
        match = re.fullmatch(
            r'(\s*)(port|shadow_port)\s*=\s*\d+\s*(?:#.*)?\n?', line)
        if section == 'db' and re.fullmatch(r'\s*major_version\s*=\s*\d+\s*', line):
            line = 'major_version = 17\n'
            seen.add(('db','major_version'))
        if match and section in sections:
            seen.add((section,match.group(2)))
            port = base + (2 if match.group(2) == 'shadow_port' else sections[section])
            line = match.group(1) + match.group(2) + ' = ' + str(port) + '\n'
        newlines.append(line)
    if not {('api','port'),('db','port'),('db','major_version')}.issubset(seen):
        raise ValueError("Local CLI config API or DB port missing")
    p.write_text(''.join(newlines))
    (Path(directory) / "mosaic-disposable-api-port").write_text(str(base))
    return base

def check_local_docker(project):
    names = subprocess.check_output(
        ['docker','ps','--format','{{.Names}}'],text=True).splitlines()
    owned = [n for n in names if n.endswith('_'+project)]
    if not owned or not any(x == 'supabase_db_' + project for x in owned):
        raise ValueError("Expected a unique new local Supabase database container")
    for name in owned:
        ports = json.loads(subprocess.check_output(
            ['docker','inspect','--format','{{json .NetworkSettings.Ports}}',name],
            text=True))
        for bindings in ports.values():
            for bind in bindings or []:
                if bind.get('HostIp') not in ('127.0.0.1','::1'):
                    raise ValueError("A local recovery container is exposed beyond loopback")
    return 'supabase_db_' + project

if __name__ == '__main__':
    try:
        if len(sys.argv) != 4:
            raise ValueError("Invalid private DR configuration arguments")
        _, action, target, project = sys.argv
        if action == 'init':
            configure(target, project)
        elif action == 'check':
            if not Path(target).is_dir():
                raise ValueError("Missing new stack directory")
            check_local_docker(project)
        else:
            raise ValueError("Unknown private DR action")
    except (OSError, ValueError, subprocess.SubprocessError):
        print("Isolated private recovery configuration or bind safety check failed",file=sys.stderr)
        sys.exit(1)
