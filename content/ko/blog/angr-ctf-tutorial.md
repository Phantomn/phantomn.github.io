---
title: "Angr for CTF: Symbolic Execution Tutorial"
date: 2020-01-01
description: "Practical guide to using angr for CTF binary analysis: symbolic execution fundamentals, find/avoid strategies, symbolic register and stack arguments, solving crackmes automatically"
tags: ["angr", "symbolic-execution", "CTF", "binary-analysis", "Python", "automation"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## What is angr?

angr is a Python-based binary analysis framework that combines static and dynamic (concolic) analysis to automate complex reverse engineering tasks. It is one of the most approachable symbolic execution tools available, with an active ecosystem of companion projects.

Core capabilities built on top of angr:

- Control-flow graph recovery
- Symbolic execution and constraint solving
- Automatic ROP chain construction via `angrop`
- Automatic binary hardening via `patcherex`
- Automatic exploit generation for DECREE and simple Linux binaries via `rex`

angr itself is composed of several independently usable subprojects:

| Subproject | Role |
|---|---|
| `CLE` | Binary and library loader |
| `archinfo` | Architecture description library |
| `PyVEX` | Python wrapper around the VEX IR lifter |
| `Claripy` | Solver abstraction layer (concrete and symbolic) |
| `angr` | The analysis suite itself |

## What is Symbolic Execution?

In ordinary execution, every variable holds a concrete value. Symbolic execution replaces unknown inputs with *symbolic* variables — mathematical unknowns — and then tracks the constraints that each branch places on those unknowns. A constraint solver (angr uses Z3 internally) can then determine what concrete values satisfy a chosen path.

Consider this example:

```c
#include <stdio.h>

void main() {
    int x, y, z;
    scanf("%d %d", &x, &y);
    z = x * 2;
    if (z == 1000) {
        if (y > z)
            printf("Nice!\n");
        else
            printf("Wrong!\n");
    }
}
```

Treating `x` as χ and `y` as λ, the engine derives three reachable paths:

1. `(χ * 2) ≠ 1000` — falls through silently
2. `(χ * 2) = 1000` and `λ ≤ 1000` — prints "Wrong!"
3. `(χ * 2) = 1000` and `λ > 1000` — prints "Nice!"

To reach "Nice!", angr asks Z3: find values of χ and λ satisfying `χ * 2 = 1000` and `λ > 1000`. The solver returns `x = 500, y = 1001` instantly.

### Known Limitations

**Path explosion** — The number of execution paths grows exponentially with branching. A program with many loops or conditionals can generate millions of states. Mitigations include heuristic-guided exploration, parallel state processing, and path merging.

**Program-dependent efficacy** — Symbolic execution shines when different inputs lead through different paths. If many inputs share the same path, per-input testing is cheaper.

**Environment interactions** — System calls, signals, and external I/O can cause consistency problems when the engine cannot model the environment precisely.

## Installation

```bash
virtualenv -p python3.6 venv
. venv/bin/activate
pip install angr
```

The tutorial binaries used here come from the [Angr_Tutorial_For_CTF](https://github.com/Hustcw/Angr_Tutorial_For_CTF) repository:

```bash
git clone https://github.com/Hustcw/Angr_Tutorial_For_CTF.git
```

> Note: the older `path_group` API has been removed. All examples below use the current `simgr` (simulation manager) API.

## Claripy: The Solver Engine

Claripy is angr's abstraction over the Z3 SMT solver. It represents both concrete and symbolic values as Abstract Syntax Trees (ASTs), allowing you to build and manipulate expressions without knowing whether the underlying values are fixed or unknown.

### Bit-Vectors

The most common Claripy type in CTF use is the bit-vector.

```python
import claripy

# 32-bit symbolic bitvector named "x"
x = claripy.BVS('x', 32)
# <BV32 x_1_32>

# 32-bit concrete bitvector with value 0xdeadbeef
v = claripy.BVV(0xdeadbeef, 32)
# <BV32 0xdeadbeef>
```

`BVS(name, size)` creates a symbolic variable; `BVV(value, size)` creates a concrete value. The old `BV()` constructor is deprecated.

Useful bit-vector operations:

```python
x = claripy.BVS('x', 32)

# Chop into 4 bytes (most-significant first)
x.chop(8)
# [<BV8 x[31:24]>, <BV8 x[23:16]>, <BV8 x[15:8]>, <BV8 x[7:0]>]

# Extract a single byte by big-endian index
x.get_byte(0)   # <BV8 x[31:24]>  (MSB)
x.get_byte(2)   # <BV8 x[15:8]>

# Extract multiple bytes
x.get_bytes(0, 3)  # <BV24 x[31:8]>
```

`BVS` parameters of interest:

| Parameter | Meaning |
|---|---|
| `name` | Variable label (used in solver output) |
| `size` | Width in bits |
| `min` / `max` | Optional value bounds |
| `stride` | Constrains values to multiples of this number |

### Floating-Point Symbols

```python
# Symbolic float
claripy.FPS('x', claripy.fp.FSORT_FLOAT)
# <FP32 FPS(FP_x_1_32, FLOAT)>

# Concrete double
claripy.FPV(3.2, claripy.fp.FSORT_DOUBLE)
# <FP64 FPV(3.2, DOUBLE)>
```

### Boolean Operations

```python
x = claripy.BVS('x', 32)
y = claripy.BVS('y', 32)

cmp = x == y
# <Bool x_2_32 == y_3_32>
```

### The Solver

```python
s = claripy.Solver()
x = claripy.BVS('x', 8)

# Add a constraint: x < 5 (unsigned)
s.add(claripy.ULT(x, 5))

# Ask for up to 5 satisfying values
s.eval(x, 5)   # (0, 1, 2, 3, 4)

# Range
s.max(x)  # 4
s.min(x)  # 0

# Conditional expression
y = claripy.BVV(65, 8)
z = claripy.If(x == 1, x, y)
s.eval(z, 10)  # (1, 65)
```

## Core angr Workflow

Every angr script follows the same skeleton:

```python
import angr

p = angr.Project("./binary")          # load the binary
state = p.factory.entry_state()       # initial program state
sim = p.factory.simgr(state)          # simulation manager
sim.explore(find=GOOD_ADDR, avoid=BAD_ADDR)

if sim.found:
    solution = sim.found[0]
    print(solution.posix.dumps(0))    # stdin that reached GOOD_ADDR
```

`posix.dumps(0)` returns the bytes written to file descriptor 0 (stdin) for the winning state.

## Challenge 00: angr_find

The binary validates a password through a `complex_function` that scrambles each character. Because the function is not trivially reversible by inspection, we let angr explore instead.

```python
# Manual solution for reference
string = "JACEJGCS"

def complex_function(a1, a2):
    return (3 * a2 + a1 - 65) % 26 + 65

data = ""
for i in range(len(string)):
    for j in range(0x40, 0x5a):
        if chr(complex_function(j, i)) == string[i]:
            data += chr(j)
            break
print(data)
```

With angr the same result requires only identifying two addresses in the disassembly:

- `0x804867d` — the "Good Job" branch
- `0x804866b` — the "Try again" branch

```python
import angr

def main():
    p = angr.Project("../problems/00_angr_find")
    init_state = p.factory.entry_state()
    sim = p.factory.simgr(init_state)

    good = 0x804867d
    bad  = 0x804866b

    sim.explore(find=good, avoid=bad)

    if sim.found:
        solution = sim.found[0]
        print('flag:', solution.posix.dumps(0))
    else:
        print('no solution found')

if __name__ == '__main__':
    main()
```

Output:

```
flag: b'JXWVXRKX'
```

Verification:

```bash
./00_angr_find
Enter the password: JXWVXRKX
Good Job.
```

The key insight: you only need the addresses of the success and failure output sites. angr finds the input that steers execution to success while staying away from failure.

## Challenge 01: angr_avoid

This binary is large enough that IDA Pro refuses to fully analyze it — it contains what appears to be hundreds of hand-duplicated blocks. angr still handles it, but care is needed when choosing the `avoid` set.

### First Attempt: Single Bad Address

```python
import angr

def main():
    p = angr.Project("../problems/01_angr_avoid")
    init_state = p.factory.entry_state()
    sim = p.factory.simgr(init_state)

    good = 0x80485b5
    bad  = 0x80485ef

    sim.explore(find=good, avoid=bad)

    if sim.found:
        solution = sim.found[0]
        print('flag:', solution.posix.dumps(0))
    else:
        print('no solution found')

if __name__ == '__main__':
    main()
```

This produces `b'HUPBBPHP'`, which the binary rejects with "Try again." The single `avoid` address is insufficient because the binary also contains an `avoid_me` function that leads to dead ends.

### Second Attempt: Adding avoid_me

```python
good = 0x80485b5
bad  = [0x80485a8, 0x80485f7]
```

Result: `no solution found`. Still not right — the `find` address also needs adjustment. The binary checks the password at a different comparison site than initially assumed.

### Working Solution

Closer inspection with GDB reveals the actual "Good Job" site and the full set of dead-end paths:

```python
import angr

def main():
    p = angr.Project("../problems/01_angr_avoid")
    init_state = p.factory.entry_state()
    sim = p.factory.simgr(init_state)

    good = 0x80485e5
    bad  = [0x80485a8, 0x804852b, 0x80485f7]

    sim.explore(find=good, avoid=bad)

    if sim.found:
        solution = sim.found[0]
        print('flag:', solution.posix.dumps(0))
    else:
        print('no solution found')

if __name__ == '__main__':
    main()
```

Output:

```
flag: b'HUJOZMYS'
```

Verification:

```bash
./01_angr_avoid
Enter the password: HUJOZMYS
Good Job.
```

### Lesson: Precise avoid Sets

The `avoid` parameter accepts either a single address or a list of addresses. Every address that represents a confirmed failure path should be included. When angr reaches an avoided address, it discards that state immediately instead of continuing to explore it — this prunes the state space and dramatically improves performance in bloated binaries.

The `find` address must also be chosen carefully. "Good Job" may be printed from more than one location; pick the address that corresponds to the branch you actually want to reach, not just any print statement.

## Practical Tips

**Start with entry_state.** For most crackmes, `p.factory.entry_state()` is correct. Use `blank_state(addr)` only when you want to drop into the middle of a function with a custom register/memory setup.

**Use posix.dumps(0) for stdin-driven binaries.** If the binary reads from a file instead, you may need to hook the open syscall or use a filesystem plugin.

**Watch the warning output.** Warnings about unconstrained registers or memory indicate that angr is making assumptions. They are usually harmless for basic crackmes but can cause incorrect results in programs that branch on pointer values.

**Multiple avoid addresses improve performance.** Every dead-end path you identify and add to `avoid` reduces the state space angr must explore. In large binaries this can mean the difference between a solution in seconds versus minutes.

**angr may be slow on loop-heavy code.** If exploration runs indefinitely, consider setting a step limit (`sim.run(n=N)`) or switching to the `DFS` or `BFS` exploration strategies explicitly.
