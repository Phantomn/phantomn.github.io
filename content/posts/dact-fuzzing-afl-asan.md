---
title: 'Fuzzing dact 0.8.42 with AFL + ASan: a stack buffer overflow in dact_process_file'
date: 2022-03-13T00:00:00.000Z
excerpt: >-
  How a stack buffer overflow was found in the compression utility dact using
  AFL and AddressSanitizer. Root-cause analysis of a file_extd_urls array
  overflow triggered by a crafted DACT header.
tags:
  - fuzzing
  - afl
  - asan
  - stack-buffer-overflow
  - vulnerability-research
  - c
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

**Target**: dact 0.8.42 (`dact_common.c`)  
**Tools**: AFL (American Fuzzy Lop), AddressSanitizer (ASan)  
**Finding**: a stack buffer overflow in the `dact_process_file` function at `dact_common.c:478`

---

## Overview

dact is an open-source compression utility. During fuzzing with AFL and ASan instrumentation, a **stack buffer overflow** was found in the file-header parsing routine. Using a crafted `.dact` file, you can make the `dact_process_file` function write past the bounds of the stack-allocated `file_extd_urls[256]` array and overwrite adjacent stack variables.

---

## ASan crash report

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

The overflow occurs at frame offset 2304. That is the location right after the end of `file_extd_urls[256]`. 256 pointers x 8 bytes = 2048 bytes, starting at offset 256 and ending at offset 2304.

---

## Root-cause analysis

### Vulnerable variable declaration

```c
// dact_common.c:249
static int dact_process_file(int src, int dest, int mode, ...)
{
    struct stat      filestats;
    char            *file_extd_urls[256];   // stack array -- 256 pointer slots
    unsigned char    algo;
    char             ch;
    char            *hdr_buf, *keybuf = NULL;
    // ...
    uint32_t         file_extd_urlcnt = 0;  // counter -- no bounds check
    uint32_t         file_extd_size   = 0;
    // ...
}
```

`file_extd_urls` is a **fixed-size array of 256 pointers allocated on the stack**. `file_extd_urlcnt` is used as the write index but **has no check against 256 whatsoever**.

### Vulnerable loop

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
            // vulnerability: file_extd_urlcnt is never compared against 256
            file_extd_urls[file_extd_urlcnt++] =
                parse_url_subst(hdr_buf, filename);
            free(hdr_buf);
            break;
        // ...
    }
    file_extd_read += (x + 3);
}
```

Each time a `DACT_HDR_URL` entry appears in the header, `file_extd_urlcnt` increments. If the header contains more than 255 URL entries, the write to `file_extd_urls[file_extd_urlcnt++]` crosses the array boundary.

### DACT header format

```
| magic[4] | version[3] | filesize[8] | blk_cnt[4] | blksize_uncomp[4] |
| file_opts[1] | file_extd_size[4] | <extended header entries...> |
```

The `file_extd_size` field controls how much of the extended header gets parsed. By crafting a large `file_extd_size` value containing many `DACT_HDR_URL` (type `0x07`) entries, an attacker can trigger an unbounded write to the stack.

---

## Step-by-step crash trace analysis

### Step 1 — CRC entry

```
file_extd_read = 0
ch = 0x0  (DACT_HDR_CRC0)
x  = 0x4
→ crcs[2] = read(0x12010004)
file_extd_read = 0 + (4 + 3) = 7
```

### Step 2 — first URL entry

```
file_extd_read = 7 < 0x2e747874
ch = 0x7  (DACT_HDR_URL)
x  = 0xe602
→ hdr_buf = malloc(0xe603)
→ read_f(src, hdr_buf, 0xe602)  -- read from the dact_crash file
→ file_extd_urls[0] = parse_url_subst(hdr_buf, filename)
file_extd_read = 7 + (0xe602 + 3) = 0xe60c
```

### Step 3 — repeated zero-length URL entries

```
ch = 0x7  (DACT_HDR_URL)
x  = 0x0
→ file_extd_urls[1] = parse_url_subst("", filename)
file_extd_read += 3   (x=0, so += 3 every iteration)
```

The loop keeps going — each iteration writes to `file_extd_urls[file_extd_urlcnt++]` — and once `file_extd_urlcnt` exceeds 255, an out-of-bounds write occurs.

---

## Crash PoC file structure

```
00000000  44 43 54 c3 00 08 2a 00  00 00 03 6f 2e 74 78 e6  |DCT...*....o.tx.|
          [magic(4)] [ver(3)]      [filesize(8)]
00000010  02 1f 01 00 00 00 00 6f  2e 74 78 74 00 00 04 12  |.......o.txt....|
          [blk_cnt(4)]             [blksize_uncomp(4)] [opts] [file_extd_size(4)]
00000020  01 00 04 07 e6 02 1f 00  ...
          [ch=CRC0] [x=4] [crc_val] [ch=URL] [x=0xe602] ...
```

`file_extd_size = 0x2e747874` — a large value derived from the ASCII bytes of the filename field (`o.txt`), interpreted as a little-endian integer due to parsing ambiguity. This value drives the loop far past the array boundary.

---

## Impact assessment

| Item | Details |
|------|------|
| Vulnerability type | Stack buffer overflow (out-of-bounds write) |
| Vulnerable function | `dact_process_file` in `dact_common.c` |
| Trigger | A crafted `.dact` file containing >255 URL header entries |
| Write primitive | 8-byte pointer write past the end of the array |
| Adjacent data corruption | `algo`, `ch`, `hdr_buf`, `version`, `file_opts`, ... |
| Exploitability | Likely to lead to code execution on platforms with an executable stack |

---

## Fix

The fix is simple. Add a bounds check before writing to `file_extd_urls`.

```c
case DACT_HDR_URL:
    hdr_buf = malloc(x + 1);
    read_f(src, hdr_buf, x);
    hdr_buf[x] = 0;
    // fix: prevent array overflow
    if (file_extd_urlcnt < 256) {
        file_extd_urls[file_extd_urlcnt++] =
            parse_url_subst(hdr_buf, filename);
    }
    free(hdr_buf);
    break;
```

Alternatively, you could allocate `file_extd_urls` dynamically with `realloc` each time an entry is added.

---

## Fuzzing setup summary

```bash
# build dact with ASan + AFL instrumentation
CC=afl-clang-fast CFLAGS="-fsanitize=address -g" ./configure --prefix=$PWD/install
make && make install

# seed corpus: a valid .dact file
mkdir seeds && cp sample.dact seeds/

# run AFL
afl-fuzz -i seeds/ -o output/ -- ./install/bin/dact -d @@ /dev/null
```

AFL found the crash within minutes. The ASan report pinpoints the overflowing variable (`file_extd_urls`, frame offset 256~2304) and the write location (offset 2304) precisely.
</content>
