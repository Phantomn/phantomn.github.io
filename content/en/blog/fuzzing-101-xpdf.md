---
title: "Fuzzing 101: Finding Bugs in xpdf with AFL"
date: 2021-06-01
description: "Introduction to coverage-guided fuzzing with AFL: setting up, instrumenting xpdf, triaging crashes, and reproducing CVE-2019-13288"
tags: ["fuzzing", "AFL", "xpdf", "coverage-guided", "bug-finding", "CVE-2019-13288"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

There were so many things I didn't know "exactly" about fuzzing that I decided to study fuzzing 101.

But this is also difficult. I thought that fuzzing would unconditionally lead to an exploit, but it wasn't that simple.

Let's fuzz the `pdftotext` binary of xpdf.

The `pdftotext` binary converts a PDF file into a plain text file:

```
➜  fuzzing_xpdf ./install/bin/pdftotext pdf_examples/sample.pdf
➜  fuzzing_xpdf ls -l pdf_examples | grep sample
-rw-rw-r-- 2 phantom phantom 3028 Feb 24  2017 sample.pdf
-rw-rw-r-- 1 phantom phantom  922 Mar 11 08:37 sample.txt
```

---

## CVE-2019-13288

In xpdf version 4.01.01, the `Parser::getObj()` function in `Parser.cc` can cause infinite recursion through a specially crafted PDF file.

The AFL setup, instrumentation, and initial fuzzer run steps are omitted here. After running the fuzzer, a crash appeared with a recognizable repeating pattern in the stack trace:

```
#326 0x632cb5 in Object::dictLookup(char*, Object*) Object.h:253:18
#327 0x632cb5 in Parser::makeStream(Object*, unsigned char*, CryptAlgorithm, int, int, int) Parser.cc:156:9
#328 0x631839 in Parser::getObj(Object*, unsigned char*, CryptAlgorithm, int, int, int) Parser.cc:94:18
#329 0x6acb86 in XRef::fetch(int, int, Object*) XRef.cc:823:13
```

This repeating chain exhausts the stack and kills the process.

---

## Dynamic Analysis

### Reading the Full Backtrace

The GDB backtrace showed approximately 76,000 repetitions of the same call chain before the crash:

```
#76677 0x000055555561f0dc in XRef::fetch (this=0x5555558c61d0, num=7, gen=0, obj=0x7fffffffdc20) at XRef.cc:823
#76678 0x00005555555f6d70 in Object::fetch (this=0x5555558c8538, xref=0x5555558c61d0, obj=0x7fffffffdc20) at Object.cc:105
#76679 0x000055555559b11e in Dict::lookup (this=0x5555558ca1f0, key=0x555555647ba4 "Length", obj=0x7fffffffdc20) at Dict.cc:76
#76680 0x00005555555f7969 in Object::dictLookup (this=0x7fffffffdeb0, key=0x555555647ba4 "Length", obj=0x7fffffffdc20) at Object.h:253
#76681 0x00005555555fbd53 in Parser::makeStream (this=0x5555558ca140, dict=0x7fffffffdeb0, ...) at Parser.cc:156
#76682 0x00005555555fb988 in Parser::getObj (this=0x5555558ca140, obj=0x7fffffffdeb0, ...) at Parser.cc:95
```

### Tracing the Call Chain

To understand why this loop starts, let's trace the normal call path from `main` down to the problematic function:

```c
int main(int argc, char *argv[]) {
    // ...
    textOut = new TextOutputDev(textFileName->getCString(), physLayout, rawOrder, htmlMeta);
    if (textOut->isOk()) {
        doc->displayPages(textOut, firstPage, lastPage, 72, 72, 0, gFalse, gTrue, gFalse);
    }
}
```

```c
void PDFDoc::displayPages(OutputDev *out, int firstPage, int lastPage, ...) {
    for (page = firstPage; page <= lastPage; ++page) {
        displayPage(out, page, hDPI, vDPI, rotate, useMediaBox, crop, printing,
                    abortCheckCbk, abortCheckCbkData);
    }
}
```

```c
void PDFDoc::displayPage(OutputDev *out, int page, ...) {
    catalog->getPage(page)->display(out, hDPI, vDPI,
                                    rotate, useMediaBox, crop, printing, catalog,
                                    abortCheckCbk, abortCheckCbkData);
}
```

```c
void Page::display(OutputDev *out, double hDPI, double vDPI, ...) {
    displaySlice(out, hDPI, vDPI, rotate, useMediaBox, crop,
                 -1, -1, -1, -1, printing, catalog,
                 abortCheckCbk, abortCheckCbkData);
}
```

```c
void Page::displaySlice(OutputDev *out, double hDPI, double vDPI, ...) {
    gfx = new Gfx(xref, out, num, attrs->getResourceDict(), hDPI, vDPI, &box, ...);
    contents.fetch(xref, &obj);  // <-- entry point into the recursive chain
    if (!obj.isNull()) {
        gfx->saveState();
        gfx->display(&obj);
        gfx->restoreState();
    }
    obj.free();
}
```

```c
Object *Object::fetch(XRef *xref, Object *obj) {
    return (type == objRef && xref) ?
           xref->fetch(ref.num, ref.gen, obj) : copy(obj);
}
```

The key condition is `ref.gen != 0`. `Object::fetch` is heavily used throughout the codebase, so placing a breakpoint on it directly is impractical.

### Setting the Breakpoint

The correct breakpoint is at the `Object::fetch` call inside `Page::displaySlice`:

```
0x00005555555fa46d <+1005>:  mov    rax,QWORD PTR [rax]
0x00005555555fa470 <+1008>:  lea    rdx,[rbp-0x50]
0x00005555555fa474 <+1012>:  mov    rsi,rax
0x00005555555fa477 <+1015>:  mov    rdi,rcx
0x00005555555fa47a <+1018>:  call   0x5555555f6d2c <Object::fetch(XRef*, Object*)>
0x00005555555fa47f <+1023>:  lea    rax,[rbp-0x50]
...
pwndbg> b *Page::displaySlice+1018
Breakpoint 1 at 0x5555555fa47a: file Page.cc, line 314.
```

Inspecting the second argument at the breakpoint shows `ref.gen = 0`:

```c
pwndbg> p *(struct Object *)$rsi
$3 = {
  type = 1435257760,
  {
    ref = {
      num = 0,
      gen = 0
    },
    ...
  }
}
```

### Attempting a Patch via Debugger

Modifying `gen` to a non-zero value to break the recursion condition:

```c
pwndbg> p (struct Object)obj
$27 = {
  type = objNone,
  {
    ref = {
      num = 0,
      gen = 1   // changed from 0
    },
    ...
  }
}
pwndbg> c
Continuing.

Program received signal SIGSEGV, Segmentation fault.
0x00007ffff7137336 in _int_malloc (av=av@entry=0x7ffff748ec40 <main_arena>, bytes=bytes@entry=7) at malloc.c:3531
```

A SIGSEGV appeared rather than normal termination, so the patch needs to target the actual recursion root.

### Locating the Root Cause

Inside `XRef::fetch`, the call flows into `Parser::getObj`:

```c
Object *XRef::fetch(int num, int gen, Object *obj) {
    XRefEntry *e;
    Parser *parser;
    Object obj1, obj2, obj3;
    // ...
    parser->getObj(obj, encrypted ? fileKey : (Guchar *)NULL,
                   encAlgorithm, keyLength, num, gen);
}
```

Inside `Parser::getObj`, the recursive call is:

```c
Object *Parser::getObj(Object *obj, Guchar *fileKey,
                       CryptAlgorithm encAlgorithm, int keyLength,
                       int objNum, int objGen) {
    // ...
    obj->dictAdd(key, getObj(&obj2, fileKey, encAlgorithm, keyLength, objNum, objGen));
    // ^^^^ self-recursive call
}
```

`getObj` calls itself recursively and adds results to the dict via `dictAdd`, causing unbounded growth.

### Targeting the Actual Recursive Object

```c
pwndbg> p *$141
$142 = {
  type = objRef,
  {
    ref = {
      num = 6,
      gen = 0
    },
    ...
  }
}

pwndbg> p *obj->array->elems
$154 = {
  type = objRef,
  {
    ref = {
      num = 6,
      gen = 0
    },
    ...
  }
}
```

Patching the `gen` field of the element inside the array:

```c
pwndbg> p &obj->array->elems->ref->gen
$158 = (int *) 0x5555558c60bc
pwndbg> set *0x5555558c60bc=0x90909090
```

After the patch:

```c
pwndbg> p *obj->array->elems
$162 = {
  type = objRef,
  {
    ref = {
      num = 6,
      gen = -1869574000
    },
    ...
  }
}
```

```
Error: Kid object (page 1) is wrong type (null)
Error: Page count in top-level pages object is incorrect
Error (3339): Missing 'endstream'
[Inferior 1 (process 8856) exited normally]
```

By redirecting the `gen` reference to a value that breaks the cycle, the binary terminates normally instead of exhausting the stack.

---

## Source Diffing

Comparing the vulnerable version against the patched version reveals that the fix introduces a simple recursion depth limit:

```c
#define recursionLimit 500

Object *Parser::getObj(Object *obj, GBool simpleOnly,
      Guchar *fileKey,
      CryptAlgorithm encAlgorithm, int keyLength,
      int objNum, int objGen, int recursion) {
```

The added `recursion` parameter is incremented at each call and checked against `recursionLimit`. Nothing else changed — the entire vulnerability and its fix amount to adding a depth counter.

![Source diff showing recursion limit](/images/blog/fuzzing-101-xpdf/Untitled.png)

---

## Takeaways

- Coverage-guided fuzzing with AFL can surface stack-overflow crashes caused by unbounded recursion in parsers.
- Triage involves reading the backtrace to identify the repeating call pattern, then tracing the call chain in source to find the recursive site.
- Dynamic patching with a debugger lets you verify the root cause by redirecting the condition that drives the loop without recompiling.
- The upstream fix was minimal: one depth counter parameter guards against the infinite recursion.
