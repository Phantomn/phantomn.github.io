---
title: 'Reversing Non-Standard Architectures: Building PPC-VLE and TriCore Disassemblers from Scratch'
date: 2026-08-12T00:00:00.000Z
excerpt: >-
  How to analyze automotive ECU architectures (PPC-VLE, TriCore) that IDA, Ghidra, and Binary Ninja
  don't support out of the box. The IR-as-common-language structure of RE tools, the formula for
  implementing an architecture plugin, and how non-standard calling conventions poison data-flow
  analysis, with the fix.
tags:
  - reversing
  - ppc-vle
  - tricore
  - binary-ninja
  - ida
  - ir
  - automotive
  - ecu
  - embedded
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Introduction

x86 and ARM disassemble instantly in any reversing tool you fire up. The problem lies outside that comfort zone. Pull apart automotive ECU firmware and you'll run into architectures that **neither IDA, Ghidra, nor Binary Ninja can read a single line of out of the box**. The VLE variant of PowerPC and Infineon's TriCore are prime examples. Often there isn't even a symbol or a string in sight — just a few megabytes of raw code.

This post lays out what to do when a tool doesn't support an architecture. Two things matter here: **(1) understanding the IR-as-common-language structure of RE tools, so you see that "write one architecture plugin and the rest of the analysis infrastructure comes along for free," and (2) how a non-standard calling convention can break data-flow analysis entirely, and how to fix it.** The case studies lean on a public talk (HackingCamp, @d0now_kim / PetoWorks) and open-source implementations.

## IR: the common language of every RE tool

You might think supporting a new architecture means rewriting the disassembler, decompiler, and symbolic execution engine from scratch — but modern RE frameworks don't work that way, because there's an **Intermediate Representation (IR)** layer in between.

```
Per-architecture code (x86, ARM, RISC-V, PPC, MIPS, TriCore, ...)
        v  [architecture-specific disassembler — handles conversion to IR]
    IR (platform-specific)
        v
  +-----------------------------------+
  |  Pseudo-C generator                |
  |  Symbolic execution engine         |
  |  Program analysis platform         |
  |  RE automation (LLM agents, etc.)  |
  +-----------------------------------+
```

Only the layer that converts machine code into IR knows anything about the architecture. Everything above it only ever talks to IR. **So supporting a new architecture means writing only an IR converter (a disassembler).** The pseudo-C generator, the data-flow analyzer — all of it gets reused as-is. This is what makes reversing non-standard architectures economically viable.

Each platform has its own IR, and that choice is effectively a choice of tool ecosystem.

| Platform | IR | Notes |
|--------|-----|------|
| Ghidra | P-code | Built by the NSA, architectures defined in the SLEIGH language |
| Binary Ninja | BNIL | Three-tier hierarchy: LLIL -> MLIL -> HLIL |
| angr | VEX (PyVEX) | valgrind's VEX IR, Python API |
| IDA Pro | Microcode | Hex-Rays proprietary, directly affected by `set_type` |

Binary Ninja's BNIL climbs through three tiers.

```
Machine code
    v  Architecture Plugin
LLIL (Low Level IL)   — close 1:1 mapping to assembly, registers explicit
    v  Data-flow Analysis
MLIL (Mid Level IL)   — SSA form, variable inference
    v  Type Propagation
HLIL (High Level IL)  — close to C pseudocode, types reflected
```

An architecture plugin is only responsible for the bottom tier: machine code -> LLIL. Binary Ninja takes care of MLIL and HLIL above it automatically. That's where the value of a single plugin comes from.

## The formula for reversing a non-standard architecture

There's a fairly standardized order of operations when you hit an unsupported architecture.

1. **Get the datasheet / reference manual.** Search the manufacturer's site or the web for "Reference Manual" or "Architecture Specification". Instruction encoding, register lists, and the memory model all live here.
2. **Analyze the registers.** Distinguish general-purpose (GPR) from special-purpose (SPR) and figure out what each is used for.
3. **Analyze instruction size.** Fixed-length or variable-length? This decides the skeleton of your parser.
4. **Parse instruction structure.** Work out the bit positions of the opcode and operands as rules.
5. **Express instruction semantics.** Turn each instruction's effect on registers and memory into IR operations.
6. **Implement the IR converter.** Either bolt on Capstone or write a bit-level parser by hand, and generate IR through the platform's API.

Let's apply this formula to two architectures.

## Case 1: the PPC-VLE disassembler

**PPC-VLE (Power Architecture Variable Length Encoding)** is a PowerPC derivative common in automotive ECUs. As the name says, it mixes 16-bit and 32-bit instructions to boost code density. The problem is that IDA's and Ghidra's default PPC support can't decode this variable-length encoding.

Getting your hands on ECU firmware in the first place is physical work — desoldering the ECU, bypassing firmware protection (case by case), extracting from flash, and identifying the architecture. Once identification comes back as PowerPC (VLE), the formula above kicks in.

The **registers** follow the PowerPC lineage.

| Category | Examples | Role |
|------|------|------|
| General-purpose (GPR) | r0-r31 | Data/addresses |
| Special-purpose (SPR) | LR, CTR, XER, CR | Link register, counter, condition codes |
| FPR | f0-f31 | Floating point |

**Instruction size** is the crux of VLE. You have to determine whether an instruction is 16-bit or 32-bit from the high bit pattern first, before you know where the next instruction begins. That's a problem fixed-length architectures never have.

**Structure parsing** is bit-field decomposition.

```
Instruction [31..0]:
  [31..26] = opcode (6 bits)
  [25..21] = rD (destination register)
  [20..16] = rA (source register)
  [15..0]  = immediate or additional fields
```

**Semantic expression** means translating each instruction into Binary Ninja LLIL. For example, an instruction that moves from SPR to GPR:

```python
class MoveFromSPR:
    def get_llil(self, il, instr):
        # LLIL: rD = SPR
        il.append(
            il.set_reg(4, instr.rD,
                il.reg(4, instr.spr_name))
        )
```

Describe each instruction's effect using LLIL operations like `set_reg`, `load`, `store`, and `goto`, and Binary Ninja builds MLIL and HLIL on top. What was "an unrecognized byte sequence" before the plugin becomes full assembly plus pseudo-C after.

There are already several open-source references in this space.

- [Martyx00/PowerPC-VLE-Extension](https://github.com/Martyx00/PowerPC-VLE-Extension) — an early implementation
- [PetoWorks/binaryninja-power-vle](https://github.com/PetoWorks/binaryninja-power-vle) — built by the speaker himself
- [Vector35's official PPC support](https://github.com/Vector35/binaryninja-api/tree/dev/arch/powerpc) — later folded into Binary Ninja proper

Binary Ninja's official guide ([part1](https://binary.ninja/2020/01/08/guide-to-architecture-plugins-part1.html), [part2](https://binary.ninja/2021/12/09/guide-to-architecture-plugins-part2.html)) covers how to write an architecture plugin in detail.

## Case 2: TriCore Fast Function Calls

The second case isn't about disassembly at all — it's a problem of **analysis accuracy**. Infineon's **TriCore** is a 32-bit RISC chip for automotive ECUs that supports a calling mechanism ordinary RISC chips don't have: **Fast Function Call (fcall)**. If the tool doesn't know about it, the entire data-flow analysis gets poisoned.

First, contrast this with a normal calling convention. Here's an ARM example:

```
caller():
    r0 = arg1, r1 = arg2    // set up arguments
    PUSH {r4-r11, lr}       // back up callee-saved registers
    BL callee               // call
    POP {r4-r11, pc}        // restore context
    // r0 = return value
```

The callee gets its own independent context, and the caller's registers are protected by convention. The tool knows this convention, so it can assume "r4 through r11 are preserved after this function call."

Fast Function Call breaks that assumption.

```
fastcall_fn:
    // no stack frame, no context backup
    // reads and writes the caller's registers directly
    D6 = D4 + D5            // uses the caller's D4, D5 as source
    RET                     // D6 "returns" to the caller (since the context is shared)
```

There's no separate context. It shares the register space entirely with the caller. That's exactly where things break.

```
caller():
    D4 = 0xdeadbeef          // set D4
    fcall fastcall_fn        // <- tool: "where is D4 used?"
    result = D6              // <- tool: "D6 was never defined" -> dead code
```

Since the tool doesn't know which registers a fastcall reads (use) and writes (set), all the code related to the return value gets flagged as unreachable/dead code. **Analysis confidence drops to zero.**

The fix is to explicitly declare two properties for every fastcall function.

- **Clobbered Registers**: the registers the fastcall writes (set). The caller shouldn't expect their values to be preserved.
- **Return Registers**: the registers the fastcall uses to return values.

Via the Binary Ninja API:

```python
fn = bv.get_function_at(fastcall_addr)
fn.clobbered_regs = ['D4', 'D5', 'D6']  # registers this writes
fn.return_regs    = ['D6']              # D6 is the return value
```

Once this information is in place, the data-flow engine tracks set/use relationships correctly, and code that had been wrongly marked as dead comes back to life. The same principle applies in IDA Pro — declaring the clobbered registers via `__spoils` or similar in a function's type declaration makes the Hex-Rays microcode reflect it and recompute the data flow.

## Recovering structure from firmware with no symbols

The TriCore case has one more useful observation. Fastcall functions **aren't scattered randomly in memory.**

```
0x0000 [start of section A]
    fastcall_fn_1   <- fastcall functions clustered at the start
    fastcall_fn_2
    fastcall_fn_3
    regular_fn_1    <- regular functions that call the fastcalls
    regular_fn_2
0x1000 [start of section B]
    fastcall_fn_4   <- the next section follows the same pattern
    ...
```

This layout happens because compilation units (.o files) tend to stay contiguous even after linking. **This means the boundary of a fastcall cluster = a section (compilation unit) boundary.** In firmware with no symbols and no strings, the calling-convention pattern becomes almost the only clue you have for tracing back file boundaries.

You can automate this too.

```python
for func in bv.functions:
    if is_fastcall(func):
        func.name = f"fastcall_{func.start:08x}"
# infer contiguous fastcall blocks as a single file/section unit
```

To borrow the speaker's phrasing: "this firmware has no strings, no symbols, only code." In situations like this, **code pattern -> file/section boundary -> functional unit inference** is essentially the only way to extend the analysis.

## Explicit typing changes decompilation quality

There's one lesson that runs through both cases. In IR-based tools, **the type and register information you give as the analyst propagates straight up through every layer above it.**

IDA Pro internally uses Hex-Rays microcode as its IR.

- Specifying a function signature via `set_type` gets reflected in the parameter types when microcode is generated.
- `infer_types` works backward from the microcode to infer local variable types.
- Defining a struct via `declare_type` turns field access from `*(a1 + 0x10)` into `request->method`.

Binary Ninja works the same way — types declared at the LLIL level propagate up into MLIL and HLIL. TriCore's clobbered/return register declarations are exactly this mechanism at work — give accurate information at a lower layer, and analysis quality leaps forward at the higher layers. Whether the architecture is standard or not, when decompilation output looks like a mess, the first thing to fix is types and calling convention.

## Closing

An unsupported architecture looks like a wall, but the actual amount of work is confined to a single layer: the IR converter. PPC-VLE was a disassembler problem — determine the variable-length encoding and translate it into LLIL. TriCore was an annotation problem — tell the tool about a non-standard calling convention to bring data-flow analysis back to life. Both take full advantage of the IR structure's benefit: give accurate information at the bottom layer, and the tools above climb up on their own.

As symbol-less embedded targets like automotive ECUs become more common, stepping outside standard architectures is only going to happen more often. Instead of stopping because the tool can't read it, opening the datasheet and writing a plugin turns out to be the faster path in the end.

## References

- HackingCamp talk — @d0now_kim (PetoWorks), "Reverse Engineering TriCore and PPC-VLE"
- [PetoWorks/binaryninja-power-vle](https://github.com/PetoWorks/binaryninja-power-vle)
- [Binary Ninja Architecture Plugin Guide part1](https://binary.ninja/2020/01/08/guide-to-architecture-plugins-part1.html) . [part2](https://binary.ninja/2021/12/09/guide-to-architecture-plugins-part2.html)
</content>
