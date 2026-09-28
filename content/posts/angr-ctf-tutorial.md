---
title: 'Angr for CTF: A Symbolic Execution Tutorial'
date: 2020-01-01T00:00:00.000Z
excerpt: >-
  A practical guide to using angr for CTF binary analysis: symbolic execution basics, find/avoid
  strategies, setting up symbolic registers and stack arguments, and solving crackmes
  automatically
tags:
  - angr
  - symbolic-execution
  - ctf
  - binary-analysis
  - python
  - automation
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## What Is angr?

angr is a Python-based binary analysis framework. It combines static analysis with dynamic (concolic) analysis and can be applied to a variety of reverse-engineering tasks. It is among the most approachable symbolic execution tools, and its surrounding ecosystem is actively developing as well.

The tasks that tools built on top of angr can perform include:

- Control-Flow Graph recovery
- Symbolic execution and constraint solving
- Automatic ROP chain generation with `angrop`
- Automatic binary hardening with `patcherex`
- Automatic exploit generation for DECREE and simple Linux binaries with `rex`

angr itself is composed of several sub-projects, each of which can be used independently:

| Sub-project | Role |
|---|---|
| `CLE` | Binary and library loader |
| `archinfo` | Architecture information library |
| `PyVEX` | A Python wrapper around the VEX IR lifter |
| `Claripy` | An abstraction layer between concrete and symbolic values (Z3 backend) |
| `angr` | The analysis suite itself |

## What Is Symbolic Execution?

In ordinary program execution, every variable has a concrete value. Symbolic execution replaces unknown input values with *symbolic variables* — mathematical unknowns — and tracks the constraints placed on those unknowns at each branch. An SMT solver (angr uses Z3 internally) then computes the concrete input values needed to reach a particular path.

Consider the following example code:

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

Letting `x` be χ and `y` be λ, the engine derives three execution paths:

1. `(χ * 2) ≠ 1000` — exits quietly
2. `(χ * 2) = 1000` and `λ ≤ 1000` — prints "Wrong!"
3. `(χ * 2) = 1000` and `λ > 1000` — prints "Nice!"

To reach "Nice!", angr poses this question to Z3: find χ, λ satisfying `χ * 2 = 1000` and `λ > 1000`. The solver immediately returns `x = 500, y = 1001`.

### Known Limitations

**Path explosion** — the number of execution paths grows exponentially as the number of branches increases. A program with many loops or complex conditions can generate millions of states. Mitigations include heuristic-based exploration, parallel processing of independent paths, and path merging.

**Program-dependent usefulness** — symbolic execution is strong for programs that take different paths depending on the input. If most inputs use the same path, per-input testing may be more economical.

**Interaction with the environment** — if the environment cannot accurately model system calls, signal reception, external I/O, etc., consistency problems can arise.

## Installation

```bash
virtualenv -p python3.6 venv
. venv/bin/activate
pip install angr
```

The binaries used in this tutorial come from the [Angr_Tutorial_For_CTF](https://github.com/Hustcw/Angr_Tutorial_For_CTF) repository:

```bash
git clone https://github.com/Hustcw/Angr_Tutorial_For_CTF.git
```

> Note: the old `path_group` API has been removed. All examples in this tutorial use the current `simgr` (simulation manager) API.

## Claripy: The Solver Engine

Claripy is angr's Z3 SMT solver abstraction layer. It represents both concrete and symbolic values as an Abstract Syntax Tree (AST), so you can manipulate expressions regardless of whether the underlying values are fixed or unknown.

### Bit-Vectors

The Claripy type used most often in CTF is the bit-vector.

```python
import claripy

# Create a 32-bit symbolic bit-vector "x"
x = claripy.BVS('x', 32)
# <BV32 x_1_32>

# Create a 32-bit concrete bit-vector with the value 0xdeadbeef
v = claripy.BVV(0xdeadbeef, 32)
# <BV32 0xdeadbeef>
```

`BVS(name, size)` creates a symbolic variable, and `BVV(value, size)` creates a concrete value. The older `BV()` constructor is deprecated and will be removed soon.

Useful bit-vector operations:

```python
x = claripy.BVS('x', 32)

# Chop into 8-bit units (from the MSB)
x.chop(8)
# [<BV8 x[31:24]>, <BV8 x[23:16]>, <BV8 x[15:8]>, <BV8 x[7:0]>]

# Extract a single byte in big-endian order
x.get_byte(0)   # <BV8 x[31:24]>  (MSB)
x.get_byte(2)   # <BV8 x[15:8]>

# Extract several bytes
x.get_bytes(0, 3)  # <BV24 x[31:8]>
```

The main parameters of `BVS`:

| Parameter | Meaning |
|---|---|
| `name` | Variable label (shown in solver output) |
| `size` | Width in bits |
| `min` / `max` | Optional value-range limits |
| `stride` | Only allow multiples of this value |

### Floating-Point Symbols

```python
# Symbolic float
claripy.FPS('x', claripy.fp.FSORT_FLOAT)
# <FP32 FPS(FP_x_1_32, FLOAT)>

# Concrete double value
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

### Solver

```python
s = claripy.Solver()
x = claripy.BVS('x', 8)

# Add the constraint x < 5 (unsigned)
s.add(claripy.ULT(x, 5))

# Return up to 5 satisfying values
s.eval(x, 5)   # (0, 1, 2, 3, 4)

# Range
s.max(x)  # 4
s.min(x)  # 0

# Conditional expression
y = claripy.BVV(65, 8)
z = claripy.If(x == 1, x, y)
s.eval(z, 10)  # (1, 65)
```

## The Basic angr Workflow

Every angr script follows this structure:

```python
import angr

p = angr.Project("./binary")          # load the binary
state = p.factory.entry_state()       # initial program state
sim = p.factory.simgr(state)          # create the simulation manager
sim.explore(find=GOOD_ADDR, avoid=BAD_ADDR)

if sim.found:
    solution = sim.found[0]
    print(solution.posix.dumps(0))    # the stdin value that reached the success path
```

`posix.dumps(0)` returns the bytes written to file descriptor 0 (stdin) in the success state.

---

## Challenge 00: angr_find

This binary validates a password by scrambling each character with `complex_function`. Working out the inverse of the function by hand is possible, but the whole point of using angr is to avoid doing that.

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

With angr, you only need to find two addresses in the disassembly:

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

Key point: you only need to know the addresses of the success output and the failure output. angr automatically finds the input that heads to the success path while avoiding the failure path.

---

## Challenge 01: angr_avoid

This binary is so large that IDA Pro flatly refuses to analyze it fully — hundreds of duplicate blocks that look as if they were hand-cloned. angr can handle it, but you have to choose the `avoid` set carefully.

### First attempt: a single bad address

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

This code returns `b'HUPBBPHP'`, but the binary rejects it with "Try again." A single `avoid` address is not enough — the binary has a separate `avoid_me` function that leads to a dead end.

### Second attempt: adding avoid_me

```python
good = 0x80485b5
bad  = [0x80485a8, 0x80485f7]
```

Result: `no solution found`. Still not right — the `find` address needs fixing too. The binary checks the password at a different comparison point than initially assumed.

### The working solution

Analyzing more closely with GDB reveals the actual "Good Job" location and all the dead-end paths:

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

### Lesson: an accurate avoid set

The `avoid` parameter takes either a single address or a list of addresses. You must include every address that definitely leads to a failure path. The instant angr reaches an avoided address it discards that state immediately, so on a bloated binary the state space shrinks dramatically and performance improves greatly.

The `find` address must be chosen carefully too. "Good Job" may be printed from multiple locations. You have to select the address of the branch you actually want to reach.

---

## Challenge 02: angr_find_condition

This challenge also prints "Good Job" or "Try again," with a `complex_function` in the middle.

Instead of specifying addresses directly, you can use callback functions that judge success/failure by the output string. Check what has been written to stdout up to the current state with `state.posix.dumps(sys.stdout.fileno())`.

```python
import angr, sys

def main():
    proj = angr.Project('../problems/02_angr_find_condition')
    init_state = proj.factory.entry_state()
    simulation = proj.factory.simgr(init_state)

    simulation.explore(find=is_successful, avoid=should_abort)

    if simulation.found:
        solution = simulation.found[0]
        print('flag: ', solution.posix.dumps(sys.stdin.fileno()))
    else:
        print('no flag')

def is_successful(state):
    return b"Good Job" in state.posix.dumps(sys.stdout.fileno())

def should_abort(state):
    return b"Try again" in state.posix.dumps(sys.stdout.fileno())

if __name__ == '__main__':
    main()
```

This approach is more flexible than specifying addresses directly. Even if the binary version changes or ASLR is applied, string-based judgment does not change.

---

## Challenge 03: angr_symbolic_registers

This challenge takes 3 hex values as input and validates them through 3 `complex_function`s. If any one of the three becomes True, it fails.

You can solve it by simply exploring from the entry_state, but the key to this challenge is the method of starting **right after the input point** and setting symbolic values directly into registers:

```python
import angr
import claripy
import sys

def main():
    p = angr.Project("../problems/03_angr_symbolic_registers")
    start_address = 0x8048980  # the point after scanf

    init_state = p.factory.blank_state(addr=start_address)

    passwd0 = claripy.BVS('p0', 32)  # symbolic bit-vector p0
    passwd1 = claripy.BVS('p1', 32)  # symbolic bit-vector p1
    passwd2 = claripy.BVS('p2', 32)  # symbolic bit-vector p2

    init_state.regs.eax = passwd0
    init_state.regs.ebx = passwd1
    init_state.regs.edx = passwd2

    simulation = p.factory.simgr(init_state)
    simulation.explore(find=is_successful, avoid=should_abort)

    if simulation.found:
        solution_state = simulation.found[0]
        solution0 = solution_state.solver.eval(passwd0)
        solution1 = solution_state.solver.eval(passwd1)
        solution2 = solution_state.solver.eval(passwd2)
        print("flag: ", hex(solution0), hex(solution1), hex(solution2))
    else:
        print("no flag")

def is_successful(state):
    return b"Good Job." in state.posix.dumps(sys.stdout.fileno())

def should_abort(state):
    return b"Try again." in state.posix.dumps(sys.stdout.fileno())

if __name__ == '__main__':
    main()
```

Points:
- Use `blank_state(addr=...)` to skip the stdin-handling process and move the analysis start point forward
- Inject the symbolic variables made with `claripy.BVS` directly into registers
- After reaching the success path, extract the actual values with `solver.eval()`

---

## Challenge 04: angr_symbolic_stack

This challenge stores values on the stack. You cannot use the direct register-injection method and must reproduce the stack layout.

```python
import angr
import claripy
import sys

def is_successful(state):
    return b'Good Job.' in state.posix.dumps(sys.stdout.fileno())

def should_abort(state):
    return b'Try again.' in state.posix.dumps(sys.stdout.fileno())

def main():
    proj = angr.Project('../problems/04_angr_symbolic_stack')

    # After scanf, the point where the stack variables start being used
    start_addr = 0x08048697
    init_state = proj.factory.blank_state(addr=start_addr)

    # Initialize the stack frame with ebp = esp
    init_state.regs.ebp = init_state.regs.esp

    password1 = init_state.solver.BVS('password1', 32)
    password2 = init_state.solver.BVS('password2', 32)

    # Simulate the stack layout
    # password2 is at ebp-0x8, password1 is at ebp-0xc
    padding_len = 0x8
    init_state.regs.esp -= padding_len

    init_state.stack_push(password2)
    init_state.stack_push(password1)

    simulation = proj.factory.simgr(init_state)
    simulation.explore(find=is_successful, avoid=should_abort)

    if simulation.found:
        solution = simulation.found[0]
        solution_password1 = solution.solver.eval(password1)
        solution_password2 = solution.solver.eval(password2)
        print('flag: ', solution_password2, solution_password1)
    else:
        print('no flag')

if __name__ == '__main__':
    main()
```

When dealing with stack-based arguments, you must compute the `start_address` precisely. The key is to check the stack layout after the function prologue with IDA or GDB and reproduce the `esp` offset yourself.

---

## Practical Tips

**Start with entry_state.** For most crackmes, `p.factory.entry_state()` is the answer. Use `blank_state(addr)` only when you want to enter the middle of a specific function with a custom register/memory state.

**Use posix.dumps(0) for stdin-based binaries.** If the binary reads input from a file, you may need to hook the open syscall or use a filesystem plugin.

**Watch the warning output.** Warnings about unconstrained registers or memory are a signal that angr is making assumptions. On simple crackmes they are mostly harmless, but on programs that branch on pointer values they can produce wrong results.

**Specifying multiple avoid addresses improves performance.** The more identified dead-end paths you add to `avoid`, the smaller the state space angr has to explore. On large binaries this can be the difference between seconds and minutes.

**angr can be slow on loop-heavy code.** If exploration continues indefinitely, consider setting a step limit (`sim.run(n=N)`) or explicitly specifying a `DFS`/`BFS` exploration strategy.

**Callback-based find/avoid is more flexible.** If addresses change often or you are in an ASLR environment, prefer passing a function to `find`/`avoid` that inspects the output content via `state.posix.dumps(sys.stdout.fileno())`.
