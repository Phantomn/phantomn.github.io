---
title: 'Reversing.kr: Easy Series Writeups'
date: 2019-06-01T00:00:00.000Z
excerpt: >-
  Writeups for Reversing.kr's Easy series -- Easy CrackMe, Easy ELF, Easy
  Keygen, Easy Unpack, and Replace -- solved through static and dynamic
  analysis.
tags:
  - wargame
  - writeup
  - reversing
  - reversing-kr
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Easy CrackMe

### Overview

I picked reversing back up to get better at pwn and vulnerability analysis. The first challenge is Easy_CrackMe.

It's a 32-bit Windows PE (C++), compiled without a packer. Running it shows a dialog asking for a key, and prints either "Correct" or "Incorrect".

### Analysis

PEID confirms the binary was written in C++.

Tracing the "Incorrect Password" string in Immunity Debugger leads to the branch instruction. Working backward from the branch condition reveals the comparison values and loop right below the input function.

Breaking down the conditions:
- First comparison: the first byte of the input against `0x45` (`'E'`)
- Second comparison: the next value against `0x61` (`'a'`)
- Third comparison: the following array against `"5y"`
- Fourth comparison: a byte-by-byte loop comparing against `"R3versing"` (EAX and ESI are compared one byte at a time, incrementing by 2 on a match)

Chaining these together in order gives the flag.

Decompiling with IDA Hex-Rays shows a simple if-statement structure.

**Flag:** `Ea5yR3versing`

---

## Easy ELF

### Overview

A 32-bit Linux ELF, stripped, so function names aren't visible directly in GDB. The binary takes input and prints either "Correct" or "Wrong".

### Analysis

I tried debugging with GDB, but the `file` command showed it was stripped, so I analyzed it with IDA instead.

Looking at the main function in IDA, there's an XOR comparison function. The conditions work out to:

```
char data[5];

data[0] = data[0] ^ 0x34
data[1] == '1'
data[2] = data[2] ^ 0x32
data[3] = data[3] ^ 0x88
data[4] == 'X'
data[5] == NULL
data[2] == '|'(0x7C)
data[0] == 'x'  ->  data[3] == 0xDD
```

Assuming the input is `x1|X` + null:

```
data[0] = 0x78 ^ 0x34 = 'L'
data[1] = '1'
data[2] = 0x7C ^ 0x32 = 'N'
data[3] = 0xDD ^ 0x88 = 'U'
data[4] = 'X'
```

Since each XOR key and expected output byte is statically fixed, the input can be recovered by reversing the XOR.

**Flag:** `L1NUX`

---

## Easy Keygen

### Overview

A serial/name matching challenge. Compiled without any packer or obfuscation. Given the serial `5B 13 49 77 13 5E 7D 13`, I need to find the matching name.

### Analysis

Analyzing with IDA shows that the keygen algorithm XORs each character of the name with a rotating key `{0x10, 0x20, 0x30}`:

```
serial[i] = name[i] ^ key[i % 3]
```

where `key = {0x10, 0x20, 0x30}`.

The serial `5B 13 49 77 13 5E 7D 13` is 8 bytes, so the name is also 8 characters. Reversing the XOR:

```
name[i] = serial[i] ^ key[i % 3]
```

| i | serial | key  | name char |
|---|--------|------|-----------|
| 0 | 0x5B   | 0x10 | `K`       |
| 1 | 0x13   | 0x20 | `3`       |
| 2 | 0x49   | 0x30 | `y`       |
| 3 | 0x77   | 0x10 | `g`       |
| 4 | 0x13   | 0x20 | `3`       |
| 5 | 0x5E   | 0x30 | `n`       |
| 6 | 0x7D   | 0x10 | `m`       |
| 7 | 0x13   | 0x20 | `3`       |

**Name:** `K3yg3nm3`

---

## Easy Unpack

### Overview

A challenge to find the OEP (Original Entry Point) of a packed Windows PE. It looks like a custom packer rather than a standard one like UPX.

### Analysis

Opening it in IDA shows the entry point starts with a long, obfuscated stub. Static analysis alone isn't enough -- it requires dynamic analysis with OllyDbg / x64dbg.

**Unpacking loop structure:**

1. **Loop 1** -- A `JMP`-based loop that jumps to `0x40A0C3` once the `JE` condition is satisfied. Set a breakpoint at that address.

2. **Loop 2** -- Resolves API addresses via `VirtualProtect` and `GetProcAddress`. Continue until the `JNZ` condition exits, then set a breakpoint after it.

3. **Loop 3** -- Loads required DLLs via `LoadLibraryA`. The loop ends once the `JE` condition is met. Set a breakpoint at `0x40A13E`.

4. **Loop 4** -- The outermost library-loading loop. A `JNZ` at the bottom repeats until all imports are resolved.

Once all loops complete, it reaches a `JMP` that jumps into an area that looks like raw bytes. Using the debugger's **Analysis -> Analyze Code** feature on that region reveals a function prologue/epilogue, which is the OEP.

**OEP:** `0x00401150`

---

## Replace

### Overview

A 32-bit Windows PE (C++), no packer. The UI only accepts numeric input, and pressing Check with any value crashes the program. The goal is to find the correct numeric input that satisfies the condition.

### Analysis

In IDA, `DialogFunc` reads the numeric input via `GetDlgItemInt` and passes it to `sub_4066F`. This function writes the value `0x619060EB` to address `0x406016` and then jumps to `current_address + 5`. This is runtime self-modifying code.

Following the execution flow leads to the "Correct" message. The input value itself is the flag. Setting a breakpoint at the patching point in Immunity Debugger and analyzing the runtime behavior reveals the numeric value that satisfies the condition.

The patch writes an instruction that makes the subsequent comparison succeed, and that input value is the answer.

**Flag:** `3`
