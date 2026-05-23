---
title: "Reversing.kr: Easy Series Writeups"
date: 2019-06-01
description: "Reversing.kr easy series solutions: Easy CrackMe, Easy ELF, Easy Keygen, Easy Unpack, and Replace challenges using static/dynamic analysis"
tags: ["reversing", "Reversing.kr", "crackme", "IDA", "GDB", "wargame"]
platform: "wargame"
category: "reversing"
difficulty: "easy"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Easy CrackMe

### Overview

A 32-bit Windows PE (C++) with no packer. Running the binary shows a dialog that accepts a key and responds with "Correct" or "Incorrect".

### Analysis

Opening in IDA Pro, the entry point calls `DialogBoxParamA`, which creates the dialog window. The third argument points to `DialogFunc`. Inside `DialogFunc` there is a comparison routine that checks the input string against a hardcoded key.

Tracing through the conditions:

- `String[0]` must equal `0x45` → `'E'`
- `String[v3]` must equal `0x61` → `'a'`
- `String[v4]` must equal `"5y"` (the `a` prefix is the ASCII abbreviation)
- `String[v5]` must equal `"R3versing"`

Concatenating these in order yields the flag.

**Flag:** `Ea5yR3versing`

---

## Easy ELF

### Overview

A 32-bit Linux ELF, stripped (symbols removed), so GDB cannot resolve function names directly. The binary accepts input and prints "Correct" or "Wrong".

### Analysis

In IDA, the main comparison function returns `1` on success. The check compares user input against values stored at `byte_20` through `byte_25`. Each byte is validated through XOR operations.

Since the XOR keys and expected output bytes are static, the input can be recovered by reversing the XOR: for each byte position `i`, `input[i] = expected[i] ^ key[i]`.

Writing a short script to compute the XOR of each pair yields the correct input string.

**Flag:** `L1NUX`

---

## Easy Keygen

### Overview

A serial/name pair challenge. The binary is not packed and compiled without obfuscation. The task is: given the serial `5B 13 49 77 13 5E 7D 13`, find the corresponding name.

### Analysis

Opening in IDA reveals that the keygen algorithm XORs each character of the name with a cycling key `{0x10, 0x20, 0x30}`:

```
serial[i] = name[i] ^ key[i % 3]
```

where `key = {0x10, 0x20, 0x30}`.

The serial `5B 13 49 77 13 5E 7D 13` is 8 bytes, so the name is 8 characters long. Reversing the XOR:

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

The goal is to find the OEP (Original Entry Point) of a packed Windows PE. The packer is not a standard one like UPX — it appears to be custom.

### Analysis

Opening in IDA shows the entry is a long, obfuscated stub. Static analysis alone is insufficient; dynamic analysis with a debugger (OllyDbg / x64dbg) is needed.

**Unpacking loop structure:**

1. **Loop 1** — A `JMP`-based loop that iterates until a `JE` condition is met, then jumps to `0x40A0C3`. Set a breakpoint at `0x40A0C3`.

2. **Loop 2** — Uses `VirtualProtect` and `GetProcAddress` to resolve API addresses. Continue until the `JNZ` condition falls through; set a breakpoint after it.

3. **Loop 3** — Calls `LoadLibraryA` to load required DLLs. When the `JE` condition is satisfied it exits the loop. Set a breakpoint at `0x40A13E`.

4. **Loop 4** — The outermost library-loading loop. The `JNZ` at the bottom keeps looping until all imports are resolved.

After all loops complete, execution reaches a `JMP` that transfers control to what appears to be raw bytes. Using the debugger's **Analysis → Analyze Code** function on that region converts the bytes into recognizable instructions, revealing the function prologue/epilogue — this is the OEP.

**OEP:** `0x00401150`

---

## Replace

### Overview

A 32-bit Windows PE (C++), no packer. The UI only accepts numeric input; entering a value and clicking Check causes the program to crash. The goal is to find the correct numeric input that satisfies the check.

### Analysis

In IDA, `DialogFunc` calls `GetDlgItemInt` to read the numeric input, then passes it to `sub_4066F`. This function writes the value `0x619060EB` to address `0x406016` and then jumps to `current_address + 5`, effectively patching its own code at runtime (self-modifying code).

Following execution down leads to the "Correct" message. The input value that is accepted becomes the flag. Analyzing the runtime behavior with Immunity Debugger (setting a breakpoint at the patching site) reveals the numeric value that satisfies the condition.

The patch writes an instruction that makes the subsequent comparison succeed, and the numeric input itself is the answer.

**Flag:** `3`
