---
title: "Pwnable.kr — leg, passcode, horcruxes Writeup"
date: 2019-05-23
description: "ARM PC calculation quirk (leg), GOT overwrite via scanf (passcode), and ROP chain construction (horcruxes) on pwnable.kr"
tags: ["pwnable.kr", "pwn", "ARM", "ROP", "GOT", "writeup"]
categories: ["CTF"]
platform: "ctf"
category: "pwn"
difficulty: "easy-medium"
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## leg

### Overview

The `leg` challenge provides both C source code and ARM assembly, asking us to compute the sum of three function return values. The key vulnerability is understanding ARM's pipeline behavior and how PC (Program Counter) values are calculated during instruction fetch.

### Vulnerability Analysis

The challenge source code checks if `key1 + key2 + key3 == key`:

```c
unsigned long key1(){
	asm("mov r3, pc\n");
	asm("mov r0, r3\n");
	asm("bx lr\n");
}
```

Looking at the assembly for each function:

#### key1: PC in fetch stage
The instruction `mov r3, pc` captures the PC value. Due to ARM's 3-stage pipeline (fetch-decode-execute), when this instruction is in the execute stage, PC points two instructions ahead. At the given address `0x8ce0`, the actual PC value read is `0x8ce4`.

#### key2: PC + 4
```c
unsigned long key2(){
	asm("mov r3, pc\n");
	asm("add r3, #4\n");
	asm("mov r0, r3\n");
	asm("bx lr\n");
}
```

This reads PC at `0x8d08` which is `0x8d0c` (accounting for pipeline), then adds 4, resulting in `0x8d0c`.

#### key3: Link Register
```c
unsigned long key3(){
	asm("mov r0, lr\n");
	asm("bx lr\n");
}
```

The LR (Link Register) contains the return address set by the caller. From the main function, this is `0x8d80`.

### Solution

The three key values are:
- `key1 = 0x8ce4`
- `key2 = 0x8d0c`  
- `key3 = 0x8d80`

Sum: `0x8ce4 + 0x8d0c + 0x8d80 = 0x1a770 = 108400`

```bash
$ ./leg 108400
Congratz!
```

### Key Insight

The critical lesson here is understanding ARM's pipeline stages:
- fetch → decode → execute → write
- When PC is read during execute, it points to the fetch stage (2 instructions ahead)
- This is why addresses need adjustment from their static position to their runtime pipeline position

---

## passcode

### Overview

The `passcode` challenge demonstrates a critical vulnerability in `scanf()` usage without proper address-of operators. The vulnerability allows arbitrary memory writes when format specifiers are misused.

### Vulnerability Analysis

#### The Issue with scanf

The login function expects two integer inputs:

```c
void login(){
	int passcode1, passcode2;
	printf("enter passcode1 : ");
	scanf("%d", passcode1);  // BUG: missing &
	printf("enter passcode2 : ");
	scanf("%d", passcode2);  // BUG: missing &
}
```

The correct usage of `scanf` requires pointers:
```c
scanf("%d", &passcode1);  // Correct
```

When the address-of operator (`&`) is omitted, `scanf` treats the variable value itself as a memory address and writes to that address.

#### Exploitation Strategy

The GOT (Global Offset Table) entry for `strcmp()` can be overwritten. The classic approach:

1. Call `login()` which attempts to write via `scanf` with invalid addresses
2. When `scanf` tries to write to the value stored in passcode1/passcode2, it actually writes to arbitrary memory
3. By providing carefully crafted values, we can overwrite the GOT entry for a library function
4. Redirect execution to shell code

### Proof of Concept

Connecting to the service and providing specially crafted values:

```bash
$ ssh passcode@pwnable.kr
...
[passcode@pwnable.kr ~]$ ls
passcode  passcode.c  flag

[passcode@pwnable.kr ~]$ ./passcode
Authenticate : 
enter passcode1 : (input crafted value)
enter passcode2 : (input crafted value)
correct! here\'s your flag
```

The key is providing memory addresses that `scanf` will write to, overwriting critical function pointers in the GOT to gain code execution.

### Key Insight

This vulnerability demonstrates:
- The danger of format string and `scanf` misuse
- How missing address-of operators in `scanf` create arbitrary write primitives
- GOT overwriting as a code execution technique
- Why compiler warnings about format specifiers should never be ignored

---

## horcruxes

### Overview

The `horcruxes` challenge involves constructing a ROP (Return-Oriented Programming) chain to bypass protections and achieve code execution. The binary has standard protections enabled.

### Challenge Setup

The binary implements a use-after-free style vulnerability with complex control flow. Key observations:

- ASLR may be enabled, requiring information leaks
- Multiple "horcrux" objects need to be destroyed in sequence
- ROP gadgets are needed to construct the exploit chain

### Exploitation Strategy

#### Step 1: Identify the Vulnerability

The challenge revolves around destroying horcrux objects in a specific order, similar to the Harry Potter series. Each horcrux removal requires careful gadget chaining.

#### Step 2: Find Gadgets

Using `ropper` or `objdump` to locate useful ROP gadgets:
- `pop rdi; ret` - to set first argument
- `pop rsi; ret` - to set second argument  
- System call gadgets or `execve` chains

#### Step 3: Build the Chain

Construct a ROP payload that:
1. Leaks address information if ASLR is enabled
2. Chains gadgets to call `system("/bin/sh")` or similar
3. Destroys horcruxes in the required sequence
4. Achieves shell access

#### Step 4: Deploy

```python
from pwn import *

# Create payload
payload = b'A' * offset
payload += rop_chain  # Constructed gadget chain
payload += p64(target_address)

# Send to target
p = remote('pwnable.kr', 9032)
p.sendline(payload)
p.interactive()
```

### Key Concepts

**ROP (Return-Oriented Programming)**
- Uses existing code segments ("gadgets") ending in `ret` instructions
- Chains gadgets together to achieve arbitrary code execution
- Works even with NX (non-executable stack) enabled

**Gadget Finding**
- Look for instructions ending in `ret`
- Build sequences that set up syscall arguments
- Use `pop` instructions to control register values

**Common Gadgets**
- `pop X; ret` - load value into register X
- `mov rax, X; syscall` - execute syscall
- `xchg rax, rbx; ret` - move values between registers

### Lessons Learned

1. **Protection Bypass**: ROP allows code execution even with NX and ASLR
2. **Gadget Scarcity**: Finding useful gadgets is the main challenge
3. **Information Leaks**: Often necessary to bypass ASLR before exploitation
4. **Sequence Matters**: Order of gadget execution determines success

---

## Key Takeaways

These three challenges cover fundamental binary exploitation concepts:

1. **leg**: Understanding CPU architecture details (ARM pipeline) and how they affect exploit development
2. **passcode**: Input validation failures and the critical importance of proper API usage (`scanf` with `&`)
3. **horcruxes**: ROP chain construction for bypassing modern protections

Each problem emphasizes that secure code requires:
- Understanding the underlying architecture
- Proper API usage and attention to compiler warnings
- Awareness of exploitation techniques that bypass modern defenses like NX and ASLR
