---
title: "WinAFL 빌드 가이드"
date: "2022-03-29"
description: "Windows 환경에서 WinAFL과 DynamoRIO를 빌드하고 타겟 바이너리에 퍼징을 적용하는 방법"
tags: ["fuzzing", "winafl", "windows", "dynamorio", "afl"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

Windows 환경에서 WinAFL을 이용한 Fuzzing 환경 구성 방법을 정리한다.

## 준비

1. DynamoRIO Binary 다운로드
2. WinAFL 다운로드

## 빌드

```bash
cmake -G "Visual Studio 17 2022" .. -DDynamoRIO_DIR=<DynamoRIO절대경로>\cmake -A x64
cmake --build . --config Release
```

`-DDynamoRIO_DIR`에 DynamoRIO cmake 디렉토리의 절대 경로를 지정한다.

## 코퍼스 최소화 (winafl-cmin)

```bash
python winafl-cmin.py \
  --working-dir C:\fuzz\winafl\build32\bin\Release \
  -w 3 \
  -i C:\fuzz\samples \
  -o C:\fuzz\irfanview_cmin \
  -t 4000 \
  -D C:\fuzz\dynamorio\build\bin32 \
  -covtype edge \
  -target_module "i_view32.exe" \
  -coverage_module "i_view32.exe" \
  -target_offset 0x082550 \
  -nargs 4 \
  -- C:\fuzz\iview457\i_view32.exe @@ /convert="NUL" /silent
```

주요 옵션:
- `-covtype edge`: 엣지 커버리지 기준으로 최소화
- `-target_offset`: 퍼징 시작 함수의 오프셋
- `@@`: 입력 파일 경로를 자동으로 치환하는 플레이스홀더
