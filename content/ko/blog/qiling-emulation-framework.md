---
title: "Qiling 에뮬레이션 프레임워크"
date: "2022-03-14"
description: "IoT 펌웨어 동적 분석을 위한 Qiling 설치 및 사용법 정리"
tags: ["iot", "firmware", "emulation", "qiling", "dynamic-analysis"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

Qiling은 크로스 플랫폼 바이너리 에뮬레이션 프레임워크로, IoT 펌웨어 동적 분석에 활용된다.

## 설치

```bash
sudo pip3 install qiling
```

## 주의사항

- 펌웨어 압축 해제 후 사용 가능
- `log_dir` 파라미터는 `log_file`로 변경 필요 (구버전 API 변경)
- 멀티스레드 펌웨어 분석 시 `multithread=True` 옵션 사용 권장

## 사용 예시 — NETGEAR mini_httpd 에뮬레이션

```python
import sys
from qiling import *
from qiling.const import QL_VERBOSE

def my_sandbox(path, rootfs):
    ql = Qiling(
        path,
        rootfs,
        verbose=QL_VERBOSE.DEBUG,
        multithread=True,
        profile='netgear.ql',
        log_file='qlog'
    )
    ql.add_fs_mapper('/proc', '/proc')
    ql.run()

if __name__ == "__main__":
    my_sandbox(
        [
            "squashfs-root/bin/mini_httpd",
            "-d", "/www.eng",
            "-r", "NETGEAR R6220",
            "-c", "**.cgi",
            "-t", "300"
        ],
        "squashfs-root"
    )
```

`add_fs_mapper`로 `/proc` 경로를 호스트와 연결하면 `/proc/cpuinfo` 등 시스템 정보 접근이 가능하다.
