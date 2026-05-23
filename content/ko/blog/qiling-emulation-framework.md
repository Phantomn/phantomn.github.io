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

## Install

```c
sudo pip3 install qiling
```

## Note

펌웨어 압축 해제한 후에 사용 가능

`log_dir` → `log_file` 로변경

Qiling 사용시 `multithread =True` 옵션 사용

### Example

```python
import sys
from qiling import *
from qiling.const import QL_VERBOSE

def my_sandbox(path, rootfs):
    ql = Qiling(path, rootfs, verbose=QL_VERBOSE.DEBUG, multithread=True, profile = 'netgear.ql', log_file='qlog')
    ql.add_fs_mapper('/proc', '/proc')
    ql.run()

if __name__ == "__main__":
    my_sandbox(["squashfs-root/bin/mini_httpd", "-d", "/www.eng", "-r", "NETGEAR R6220", "-c", "**.cgi", "-t", "300"], "squashfs-root")
```
