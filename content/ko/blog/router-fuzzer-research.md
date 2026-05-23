---
title: "공유기 Fuzzer 구성 — AFL + ASAN 환경 세팅"
date: "2022-03-07"
description: "공유기 바이너리 Fuzzing을 위한 AFL 빌드 환경 구성 및 Harness 코드 작성 레퍼런스 정리"
tags: ["fuzzing", "afl", "asan", "iot", "router"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

공유기 바이너리에 AFL 기반 Fuzzing을 적용하기 위한 환경 구성 과정을 정리한다.

## AFL + ASAN 환경 구성 (Ubuntu 20.04 기준)

### 의존성 설치

```bash
apt install -y build-essential python3-dev automake git flex bison \
  libglib2.0-dev libpixman-1-dev python3-setuptools \
  lld-11 llvm-11 llvm-11-dev clang-11

apt install -y gcc-$(gcc --version|head -n1|sed 's/.* //'|sed 's/\..*//')-plugin-dev \
  libstdc++-$(gcc --version|head -n1|sed 's/.* //'|sed 's/\..*//')-dev
```

### AFL 설치

```bash
export AFL_USE_ASAN=1
export PATH=/usr/lib/llvm-6.0/bin:$PATH

wget http://lcamtuf.coredump.cx/afl/releases/afl-latest.tgz
tar -xvf afl-latest.tgz
cd afl-2.52b/
make
sudo make install
```

### LLVM 모드 설정

```bash
cd ./llvm_mode
sudo ln -s /usr/bin/llvm-config-12 /usr/local/bin/llvm-config
sudo ln -s /usr/bin/clang-12 /usr/local/bin/clang
sudo ln -s /usr/bin/clang++-12 /usr/local/bin/clang++
```

`Makefile` 내 다음 라인 수정 (stdin 리다이렉션 추가):

```diff
- echo 0 | ../afl-showmap -m none -q -o .test-instr0 ./test-instr
+ echo 0 | ../afl-showmap -m none -q -o .test-instr0 ./test-instr < /dev/null
```

수정 후 `make` 재실행.

## Harness 코드 작성 참고자료

1. [ZDI - The Little Bitmap That Couldn't](https://www.zerodayinitiative.com/blog/2019/10/31/the-little-bitmap-that-couldnt)
2. [Fuzzing capstone using AFL persistent mode](https://snapdragon-papyrus-3d7.notion.site/Fuzzing-capstone-using-AFL-persistent-mode-fbee80a695cb47948f633acc42aba26f)
3. [autoharness](https://github.com/parikhakshat/autoharness)
4. [Starting to fuzz with WinAFL](https://medium.com/csg-govtech/starting-to-fuzz-with-winafl-ecc41661220c)
5. [50 Adobe CVEs in 50 days](https://research.checkpoint.com/2018/50-adobe-cves-in-50-days/)
6. [Fuzzing with WinAFL](https://symeonp.github.io/2017/09/17/fuzzing-winafl.html)
