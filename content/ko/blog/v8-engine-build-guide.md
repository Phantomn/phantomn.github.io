---
title: "V8 Engine 빌드 가이드 (Windows / Linux)"
date: "2022-03-08"
description: "Chrome V8 엔진 소스를 Windows와 Linux에서 빌드하는 방법 — depot_tools, ninja, gm.py 활용"
tags: ["v8", "browser", "build", "windows", "linux", "exploit"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
image: "/images/blog/v8-engine-build-guide/Untitled.png"
---

Chrome V8 엔진 익스플로잇 연구를 위해 특정 커밋으로 빌드 환경을 구성하는 방법을 정리한다.

## Windows 빌드

### 사전 준비

- Visual Studio 2019 16.0.0 이상
- Windows 10 SDK 10.10.17763 이상
- depot_tools

### 크롬 업데이트 비활성화

분석 도중 크롬이 자동 업데이트되면 대상 버전이 바뀔 수 있다.

**업데이트 서비스 비활성화**

```
msconfig.msc → gupdate, gupdatem 옵션 체크 해제
```

![msconfig](/images/blog/v8-engine-build-guide/Untitled.png)

**작업 스케줄러 비활성화**

```
taskschd.msc → GoogleUpdateTaskMachineCore, GoogleUpdateTaskMachineUA 모두 비활성화
```

![taskschd](/images/blog/v8-engine-build-guide/Untitled%201.png)

**업데이트 파일 이름 변경**

```
C:\Program Files (x86)\Google\Update\GoogleUpdate → GoogleUpdate.bak
```

![업데이트 파일](/images/blog/v8-engine-build-guide/Untitled%202.png)

### Visual Studio 설정

설치 후 제어판 → 프로그램 추가/제거 → Windows Software Development Kit → Change 선택

![VS 설정](/images/blog/v8-engine-build-guide/Untitled%203.png)

"Windows Debugging Tools" 체크 후 변경한다.

![Debugging Tools](/images/blog/v8-engine-build-guide/Untitled%204.png)

### depot_tools 설치

```
https://storage.googleapis.com/chrome-infra/depot_tools.zip
```

`C:\v8_engine\depot_tools`에 압축 해제 후 환경 변수 PATH에 추가한다.

![PATH 설정](/images/blog/v8-engine-build-guide/Untitled%206.png)

추가 환경 변수 설정:

![환경 변수](/images/blog/v8-engine-build-guide/Untitled%207.png)

```
DEPOT_TOOLS_WIN_TOOLCHAIN=0
GYP_MSVS_VERSION=2019
```

gclient 실행 확인:

```
C:\v8_engine\depot_tools>gclient
```

![gclient 실행](/images/blog/v8-engine-build-guide/Untitled%208.png)

python 경로 확인 (depot_tools의 python.bat이 최상단이어야 함):

```
C:\v8_engine\depot_tools>where python
```

![python 경로](/images/blog/v8-engine-build-guide/Untitled%209.png)

### Git 기본 설정

```bash
git config --global user.name "[user name]"
git config --global user.email "[email address]"
git config --global core.autocrlf false
git config --global core.filemode false
git config --global branch.autosetuprebase always
```

### V8 소스 다운로드 및 빌드

```
C:\v8_engine\source>fetch v8
```

`fetch` 후 특정 커밋으로 체크아웃이 필요하면 이 시점에 수행해야 한다:

```bash
git checkout <commit-hash>
gclient sync
```

빌드 옵션 생성 (release 또는 debug 선택):

```
C:\v8_engine\source\v8>gn gen --ide=vs out\x64.release --args="is_debug=false is_component_build=true"
```

`is_component_build=true`를 설정하면 `v8.dll`만 동적 라이브러리로 빌드된다.

빌드 실행:

```
ninja -C out.gn/x64.release
```

![빌드 완료](/images/blog/v8-engine-build-guide/Untitled%2012.png)

빌드 완료 후 `v8/out.gn/x64.release` 폴더에서 `icu*` 파일들, `v8.dll`, `v8.dll.lib`을 사용한다.

---

**흔한 오류**: `msdia140.dll` 관련 오류 발생 시 소스를 삭제하고 처음부터 다시 받아야 한다.

---

## Linux 빌드

```bash
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
export PATH=`pwd`/depot_tools:"$PATH"
fetch v8
cd v8
git checkout c895a23
gclient sync
build/install-build-deps.sh  # Linux 전용

# 방법 1: gm.py 사용
tools/dev/gm.py x64.debug

# 방법 2: 수동 옵션 설정
tools/dev/v8gen.py x64.debug -- v8_enable_slow_dchecks=false v8_enable_backtrace=true v8_enable_object_print=true
ninja -C out.gn/x64.debug
```

## References

- [Windows 자동 업데이트 비활성화](https://www.lainyzine.com/ko/article/how-to-disable-windows-automatic-updates-on-windows-10/)
- [Windows 환경에서 V8 빌드](http://www.egocube.pe.kr/lecture/content/html-javascript/202004210001)
- [CVE-2021-30632 RCA (Google Project Zero)](https://googleprojectzero.github.io/0days-in-the-wild//0day-RCAs/2021/CVE-2021-30632.html)
- [윈도 환경에서 V8 빌드](http://rette.iruis.net/2016/09/%EC%9C%88%EB%8F%84-%ED%99%98%EA%B2%BD%EC%97%90%EC%84%9C-v8-%EB%B9%8C%EB%93%9C/)
