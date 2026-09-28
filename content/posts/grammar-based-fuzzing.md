---
title: 'Grammar-Based Fuzzing: What Random Mutation Misses'
date: 2026-08-13T00:00:00.000Z
excerpt: >-
  Why random-mutation fuzzers lose coverage on structured protocols, and how to
  model a PDU with a grammar to systematically traverse field combinations.
  Covers And/Or combinatorial-explosion control, automatic boundary-value
  generation, automatic Size-field computation, and Lua-based checksum
  recomputation.
tags:
  - fuzzing
  - grammar-fuzzing
  - protocol
  - ics
  - ot
  - vulnerability-research
  - afl
  - boofuzz
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Introduction

[When I designed a PLC protocol fuzzer a while back](/en/blog/ls-electric-fuzzer-design/), I keenly felt the limits of black-box mutation fuzzing. Hammering a file parser with AFL and hammering a stateful binary protocol are different levels of difficulty. A protocol has length fields, has checksums, and has context dependencies like "this field only exists when that field has this value." A fuzzer that randomly flips bytes doesn't understand this structure, and most inputs get filtered out at the first gate of validity checking.

Grammar-based fuzzing tackles this problem head-on. Instead of leaving "what to flip" to randomness, it describes the protocol's PDU structure itself as a language and systematically traverses each field. This post dissects the design of the grammar language used in industrial-protocol robustness testing, organized so that readers who have used tools like AFL and boofuzz can map it over directly.

## Where random fuzzers collapse against structure

The behavior of a random-mutation fuzzer is simple. It takes seed input, flips, truncates, and splices bytes, and throws it back at the target. On input like file formats, where "the parser reads it in as long as it's roughly right," this strategy works surprisingly well. More so with coverage feedback (the AFL family).

The problem shows up against three kinds of structure.

**Length fields.** If there's a field at the head of the packet declaring "the payload after this is N bytes," then the moment you grow the payload by one byte, that value must change too. A random fuzzer doesn't know the relationship between the two, so touching the length field mismatches the payload, and touching the payload mismatches the length. Most get discarded immediately as "malformed."

**Checksums.** Protocols with a CRC or a simple sum checksum are harsher. Change even one bit of the payload and the checksum breaks, and the target discards the packet at the checksum-validation step. **If the vulnerability is in logic after checksum validation, a random fuzzer will never reach that code.**

**Context-dependent fields.** Rules like "an option header follows only when the message type is 0x03." Random mutation leaves this combination to chance. The wider the space of valid combinations, the more sharply the probability of hitting one by chance drops.

In the end, a random fuzzer's coverage is **unmeasurable.** There's no way to know how many field combinations it tried or which paths haven't been hit yet. "I ran it long enough" does not guarantee "I tested enough."

## Grammar: describing the PDU as a language

The grammar-based approach flips the idea. Instead of mutating the input, it **first defines the structure of valid input and generates variations within it.**

Let's start with the key terms.

| Term | Definition |
|------|------|
| Operator | A way to generate something. Takes arguments |
| Expression | A set of operators that generate a PDU |
| Rule | A named Expression |
| Grammar | A set of multiple Expressions and Rules -> generates multiple PDUs |

The simplest example:

```
TestCase{ And(Or("hi", "bye"), " ", Or("Jim", "Mary")) }
-- generates: "hi Jim", "hi Mary", "bye Jim", "bye Mary"
```

`Or` emits one value per argument, and `And` fully combines the sub-values. The expression above yields 2 x 1 x 2 = 4 PDUs. Naming it with rules makes the structure easier to read.

```
TestCase{
  And(R"say", " ", R"to"),
  say = Or("hi", "bye"),
  to  = Or("Jim", "Mary"),
}
```

`R"say"` references the `say` rule. Rules are order-independent, unreferenced rules are ignored, and referencing an undefined rule raises a runtime error. So far this looks like playing with strings, but the key point is that this structure **maps directly onto protocol fields.**

## Three Ands to control combinatorial explosion

`And`'s full combination explodes as fields grow. With 10 fields each holding 5 values, that's 5^10 ≈ 9.76 million PDUs. In practice that's unmanageable. So there are variants that tune the density of the combination.

```
And("a","b"), Or("x","y"), Or("1","2"))
  →  ax1, ax2, ay1, ay2, bx1, bx2, by1, by2   (8, full combination)

And1("a","b","c"), Or("x","y","z"), Or("1","2","3"))
  →  ax1, bx1, cx1, ay1, az1, ax2, ax3   (7, single-value combination)

And2(Or("a","b","c"), Or("x","y","z"), Or("1","2","3"))
  →  ax1, bx1, cx1, ay1   (4, pairwise combination)
```

- **`And`**: all combinations. Sees even field interactions, but expensive.
- **`And1`**: uses every value of each field at least once, but doesn't build cross-field combinations. "Shake one field, hold the rest at their defaults."
- **`And2`**: pairwise combinations. The same idea as the pairwise technique in software testing — it leans on the empirical rule that most bugs come from the interaction of two parameters.

This is the decisive advantage of a grammar over a random fuzzer. **You explicitly choose the coverage strategy.** If the combination is excessive, drop to `And1`; if you suspect field interactions, raise it to `And`. You can compute how many PDUs it will generate before running.

## Value generation: boundary values and encoding

What value to put in a field is the next problem. Enumerating valid values works with `Or`, but bugs usually live at the boundaries.

```
BoundaryFuzz(default, bit_width, [...])
```

`BoundaryFuzz` takes the field's bit width and automatically generates values near the minimum, maximum, and midpoint, plus the default. For an 8-bit field, it produces values around 0, 1, 127, 128, 254, 255 on its own. You get the classic values that target off-by-one mistakes and sign-handling bugs without listing them by hand.

The encoding operators handle text/binary, endianness, and addresses.

| Operator | Purpose |
|--------|------|
| `Nb16/24/32/64(...)` | Big-endian (network byte order) encoding |
| `Le16/24/32/64(...)` | Little-endian encoding |
| `Byte(...)` | 8-bit byte encoding |
| `Addr(...)` | Convert an IP/MAC address to binary |
| `Range(begin, end[, step])` | Generate range values |
| `Hex(...)` | Hex string -> byte stream |

If you've used boofuzz, the `s_word`, `s_dword`, `s_size` block primitives will come to mind. The idea is the same — declare a field as a typed block. The difference is choosing the combination strategy explicitly at the operator level.

## Length fields: Size computes automatically

The first place a random fuzzer collapsed, earlier, was the length field. The grammar solves this with an operator.

```
TestCase{
  And(Size(nb16, 2), R"flag", R"data"),
  flag = Byte(0, 1),
  data = Zeros(Range(0, 4, 2))
}
```

`Size(nb16, 2)` means "encode the total size of the fields after index 2 (flag + data) as nb16 and put it here." Whether `data` is 0 bytes or 4 bytes, the length field always reflects the actual size. Shake the payload and the length follows automatically — the very thing a random fuzzer couldn't do.

And if you want to make the length field itself the attack target:

```
SizeFuzz(width, ...)
```

`SizeFuzz` generates, in addition to the correct size, size−1, size+1, and boundary values based on the bit width. It systematically produces "packets where the declared length and the actual length disagree." A prime spot for buffer overflows and under-reads to hide.

## Checksums: recompute with Lua

The second collapse point, the checksum. The grammar engine handles payload processing with two Lua functions.

| Function | Role |
|------|------|
| `disassemble(payload)` | Extract the part to be corrupted. Return the rest (header, checksum slot) as state |
| `assemble(damaged, state)` | Reassemble the complete packet from the corrupted part + state. Recompute the checksum here |

```lua
function disassemble(payload)
  local hdr = payload:sub(1, 4)              -- exclude the first 4-byte header from corruption
  local part = payload:sub(5, -5)            -- byte 5 through 5-from-end is the corruption target
  return part, hdr                            -- (corruption target, state for reassembly)
end

crc = bcrc.crc32()

function assemble(damaged, state)
  local hdr = state
  local payload = hdr .. damaged
  local chksum = fmt.le32(crc(payload))      -- recompute CRC32 for the corrupted payload
  return payload .. chksum
end
```

The value of this structure is clear. **Corruption is applied only to the payload body, and the checksum is recomputed to match the corrupted result.** The resulting packet passes checksum validation, and only then reaches the parsing logic after validation. The gate a random fuzzer could never cross is crossed by these two functions.

If you've ever tried mutation-fuzzing a protocol with checksum validation and watched the hit rate bottom out, this is the fix. As long as the target immediately discards a bad checksum, recomputing the checksum after corruption is not optional but mandatory.

## In practice: an RPC Port Mapper grammar

Put the pieces together and you get a real protocol. Below is a grammar targeting the RPC Port Mapper on port 111.

```
TestCase{
  And(R"head", R"xid", R"messagetype", R"rpcver",
      R"progid", R"progver", R"procedure",
      R"credflavor", R"credlength",
      R"veriflavor", R"verilength", R"data"),
  head        = Hex("80000028", "8FFFFFFF", "EFFFFFFF", "80000000"),
  xid         = Nb32(0),
  messagetype = Nb32(0),                     -- CALL = 0
  rpcver      = Nb32(2),
  progid      = Nb32(100000, 536871731, 536872005, 536870914, 0, 0xFFFFFFFF),
  progver     = Nb32(2, 1, 0xFFFFFFFF),
  procedure   = Nb32(4, 5, 0, 0xFFFFFFFF),
  credflavor  = R"flavor",
  credlength  = R"length",
  veriflavor  = R"flavor",
  verilength  = R"length",
  flavor      = Nb32(0, 1, 0xFFFFFFFF),
  length      = Nb32(0, 4, 0xFFFF, 0xFFFFFFFF),
  data        = Or("", "\0" * 40, "\255" * 1000)
}
```

Reading it, you can see the field structure of an RPC call directly. `messagetype` is fixed to CALL, `progid` and `procedure` mix valid values with extreme values (`0xFFFFFFFF`), and the `length` field lists normal values alongside overflow candidates (`0xFFFF`, `0xFFFFFFFF`). `data` shakes the length handling with an empty value, 40 bytes of null, and a 1000-byte overrun. Because it's a full combination, `flavor` and `length` cross over on both the credential and verifier sides, producing a substantial number of PDUs.

This grammar keeps a "skeleton valid as RPC" while traversing each field's dangerous values. It sweeps declaratively and exhaustively through the combinations a random fuzzer left to chance.

## Grammar vs Fuzzer, and Grammar vs AFL

Industrial robustness-testing tools split tests into several types. Two with the sharpest contrast:

- **Fuzzer**: generates malformed packets with random header values. Being based on a random number generator, both field selection and value are random. **Being unsystematic, its coverage cannot be measured.**
- **Grammar**: traverses all fields and combinations + intelligent fuzz values targeting common implementation errors. **Achieves quantitative coverage.**

That such tools offer both methods for the same protocol while explicitly stating "Grammar has better coverage than Fuzzer" is no accident. Randomness is cheap but comes with no guarantee; a grammar costs authoring effort but can tell you what it tested.

Here you shouldn't misunderstand the relationship with AFL. AFL's strength is **coverage feedback** — it observes execution paths and keeps alive inputs that open new paths. The grammar's strength is **structural knowledge** — it knows the valid skeleton and varies within it. The two are not opposed but complementary. In fact, the most powerful combination is to build the valid skeleton with a structure-aware generator (grammar/boofuzz-style) and lay coverage feedback on top of it. With source, use AFL's instrumentation; without it, use the target's responses and crashes as signals.

To sum up, the selection criteria are these.

- Input is loose and you have source -> start with **AFL-family mutation + coverage feedback.**
- Input has strict structure, checksums, and state -> stand up the valid skeleton with a **grammar/generation-based** approach and traverse the fields.
- Both -> make seeds with the generator and grow them with coverage.

## Closing

The places a random-mutation fuzzer collapses on structured protocols were three — length fields, checksums, and context-dependent fields. The grammar-based approach breaks through each of these head-on with `Size`/`SizeFuzz`, Lua `disassemble`/`assemble`, and the explicit `And`/`And1`/`And2` combination strategy. The price is the work of describing the protocol structure by hand, but in return you get fuzzing that **can tell you what it tested.**

When you meet a protocol where the hit rate dies at checksum validation, before trying to flip bytes even harder, it's worth first considering the side that describes the structure.

## References

- [Designing a fuzzer for LS Electric PLC protocol analysis](/en/blog/ls-electric-fuzzer-design/) — the black-box protocol fuzzer design that was the starting point of this post
</content>
