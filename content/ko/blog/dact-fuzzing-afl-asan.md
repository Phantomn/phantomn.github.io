---
title: "AFL + ASan으로 dact 0.8.42 퍼징: dact_process_file의 스택 버퍼 오버플로우"
date: 2022-03-13
description: "AFL과 AddressSanitizer를 활용해 압축 유틸리티 dact에서 스택 버퍼 오버플로우를 발견한 과정. 조작된 DACT 헤더를 통한 file_extd_urls 배열 오버플로우의 근본 원인 분석."
tags: ["fuzzing", "AFL", "ASan", "stack-buffer-overflow", "vulnerability-research", "C"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

**대상**: dact 0.8.42 (`dact_common.c`)  
**도구**: AFL (American Fuzzy Lop), AddressSanitizer (ASan)  
**발견 내용**: `dact_common.c:478`의 `dact_process_file` 함수에서 스택 버퍼 오버플로우

---

## 개요

dact는 오픈소스 압축 유틸리티다. AFL과 ASan 계측을 이용한 퍼징 과정에서 파일 헤더 파싱 루틴에서 **스택 버퍼 오버플로우**가 발견되었다. 조작된 `.dact` 파일을 이용하면 `dact_process_file` 함수가 스택에 할당된 `file_extd_urls[256]` 배열의 경계를 넘어 인접한 스택 변수들을 덮어쓰게 만들 수 있다.

---

## ASan 크래시 리포트

```
==11449==ERROR: AddressSanitizer: stack-buffer-overflow on address 0x7ffe0bef3060
    at pc 0x0000004ccd0a bp 0x7ffe0bef2750 sp 0x7ffe0bef2748
WRITE of size 8 at 0x7ffe0bef3060 thread T0
    #0 0x4ccd09 in dact_process_file dact_common.c:478:40
    #1 0x4d33b8 in main dact.c:689:8

Address is in stack of thread T0 at offset 2304 in frame:
    #0 0x4c74ef in dact_process_file dact_common.c:249

  This frame has 16 object(s):
    [32, 36)    'cipher.addr'
    [48, 192)   'filestats'          (line 250)
    [256, 2304) 'file_extd_urls'     (line 252) <== overflows here
    [2432, 2433) 'algo'
    ...
SUMMARY: AddressSanitizer: stack-buffer-overflow dact_common.c:478:40
```

오버플로우는 프레임 오프셋 2304 위치에서 발생한다. 이는 `file_extd_urls[256]`의 끝 바로 다음 지점이다. 256개 포인터 × 8바이트 = 2048바이트가 오프셋 256에서 시작해 오프셋 2304에서 끝난다.

---

## 근본 원인 분석

### 취약한 변수 선언

```c
// dact_common.c:249
static int dact_process_file(int src, int dest, int mode, ...)
{
    struct stat      filestats;
    char            *file_extd_urls[256];   // 스택 배열 — 256개 포인터 슬롯
    unsigned char    algo;
    char             ch;
    char            *hdr_buf, *keybuf = NULL;
    // ...
    uint32_t         file_extd_urlcnt = 0;  // 카운터 — 범위 검사 없음
    uint32_t         file_extd_size   = 0;
    // ...
}
```

`file_extd_urls`는 **스택에 고정 크기로 할당된 256개 포인터 배열**이다. `file_extd_urlcnt`는 쓰기 인덱스로 사용되지만 **256에 대한 검사가 전혀 없다**.

### 취약한 루프

```c
while (file_extd_read < file_extd_size) {
    x = 0;
    read(src, &ch, 1);
    if (ch != DACT_HDR_NOP) read_de(src, &x, 2, sizeof(x));

    switch (ch) {
        case DACT_HDR_URL:
            hdr_buf = malloc(x + 1);
            read_f(src, hdr_buf, x);
            hdr_buf[x] = 0;
            // 취약점: file_extd_urlcnt를 256과 비교하지 않음
            file_extd_urls[file_extd_urlcnt++] =
                parse_url_subst(hdr_buf, filename);
            free(hdr_buf);
            break;
        // ...
    }
    file_extd_read += (x + 3);
}
```

헤더에 `DACT_HDR_URL` 항목이 하나씩 나올 때마다 `file_extd_urlcnt`가 증가한다. 헤더에 255개를 초과하는 URL 항목이 존재하면, `file_extd_urls[file_extd_urlcnt++]`에 대한 쓰기가 배열 경계를 넘어간다.

### DACT 헤더 형식

```
| magic[4] | version[3] | filesize[8] | blk_cnt[4] | blksize_uncomp[4] |
| file_opts[1] | file_extd_size[4] | <확장 헤더 항목들...> |
```

`file_extd_size` 필드는 확장 헤더를 얼마나 파싱할지를 제어한다. 많은 `DACT_HDR_URL` (타입 `0x07`) 항목을 포함한 큰 `file_extd_size` 값을 조작하면, 공격자는 스택에 대한 무제한 쓰기를 유발할 수 있다.

---

## 크래시 트레이스 단계별 분석

### Step 1 — CRC 항목

```
file_extd_read = 0
ch = 0x0  (DACT_HDR_CRC0)
x  = 0x4
→ crcs[2] = read(0x12010004)
file_extd_read = 0 + (4 + 3) = 7
```

### Step 2 — 첫 번째 URL 항목

```
file_extd_read = 7 < 0x2e747874
ch = 0x7  (DACT_HDR_URL)
x  = 0xe602
→ hdr_buf = malloc(0xe603)
→ read_f(src, hdr_buf, 0xe602)  — dact_crash 파일에서 읽음
→ file_extd_urls[0] = parse_url_subst(hdr_buf, filename)
file_extd_read = 7 + (0xe602 + 3) = 0xe60c
```

### Step 3 — 반복되는 길이 0 URL 항목들

```
ch = 0x7  (DACT_HDR_URL)
x  = 0x0
→ file_extd_urls[1] = parse_url_subst("", filename)
file_extd_read += 3   (x=0이므로 매 반복마다 +=3)
```

루프가 계속 이어지며 — 매 반복마다 `file_extd_urls[file_extd_urlcnt++]`에 쓰기가 발생한다 — `file_extd_urlcnt`가 255를 넘으면 배열 경계를 벗어난 쓰기가 발생한다.

---

## 크래시 PoC 파일 구조

```
00000000  44 43 54 c3 00 08 2a 00  00 00 03 6f 2e 74 78 e6  |DCT...*....o.tx.|
          [magic(4)] [ver(3)]      [filesize(8)]
00000010  02 1f 01 00 00 00 00 6f  2e 74 78 74 00 00 04 12  |.......o.txt....|
          [blk_cnt(4)]             [blksize_uncomp(4)] [opts] [file_extd_size(4)]
00000020  01 00 04 07 e6 02 1f 00  ...
          [ch=CRC0] [x=4] [crc_val] [ch=URL] [x=0xe602] ...
```

`file_extd_size = 0x2e747874` — 파일명 필드의 ASCII 바이트(`o.txt`)에서 파생된 큰 값으로, 파싱 모호성으로 인해 리틀 엔디언 정수로 해석된다. 이 값이 루프를 배열 경계를 훨씬 넘어서까지 실행되도록 만든다.

---

## 영향 평가

| 항목 | 내용 |
|------|------|
| 취약점 유형 | 스택 버퍼 오버플로우 (경계 밖 쓰기) |
| 취약 함수 | `dact_common.c`의 `dact_process_file` |
| 트리거 | >255개의 URL 헤더 항목이 포함된 조작된 `.dact` 파일 |
| 쓰기 프리미티브 | 배열 끝을 넘어선 8바이트 포인터 쓰기 |
| 인접 데이터 손상 | `algo`, `ch`, `hdr_buf`, `version`, `file_opts`, ... |
| 악용 가능성 | 스택 실행 가능 플랫폼에서 코드 실행으로 이어질 가능성 높음 |

---

## 수정 방법

수정은 간단하다. `file_extd_urls`에 쓰기 전에 경계 검사를 추가하면 된다.

```c
case DACT_HDR_URL:
    hdr_buf = malloc(x + 1);
    read_f(src, hdr_buf, x);
    hdr_buf[x] = 0;
    // 수정: 배열 오버플로우 방지
    if (file_extd_urlcnt < 256) {
        file_extd_urls[file_extd_urlcnt++] =
            parse_url_subst(hdr_buf, filename);
    }
    free(hdr_buf);
    break;
```

또는 항목이 추가될 때마다 `realloc`을 사용해 `file_extd_urls`를 동적으로 할당하는 방식도 있다.

---

## 퍼징 환경 요약

```bash
# ASan + AFL 계측으로 dact 빌드
CC=afl-clang-fast CFLAGS="-fsanitize=address -g" ./configure --prefix=$PWD/install
make && make install

# 시드 코퍼스: 유효한 .dact 파일
mkdir seeds && cp sample.dact seeds/

# AFL 실행
afl-fuzz -i seeds/ -o output/ -- ./install/bin/dact -d @@ /dev/null
```

AFL은 몇 분 안에 크래시를 발견했다. ASan 리포트는 오버플로우되는 변수(`file_extd_urls`, 프레임 오프셋 256~2304)와 쓰기 위치(오프셋 2304)를 정확하게 식별해 준다.
