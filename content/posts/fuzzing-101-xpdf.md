---
title: 'Fuzzing 101: Finding Bugs in xpdf with AFL'
date: 2021-06-01T00:00:00.000Z
excerpt: 'An introduction to coverage-guided fuzzing with AFL: instrumenting xpdf, triaging crashes, and reproducing CVE-2019-13288'
tags:
  - fuzzing
  - afl
  - xpdf
  - coverage-guided
  - bug-finding
  - cve-2019-13288
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

There were too many things I didn't "exactly" know about fuzzing, so I concluded I should study it through fuzzing 101.

But this is hard too. I used to think that fuzzing always ended in an exploit, but that wasn't the case.

Let's fuzz xpdf's `pdftotext` binary.

`pdftotext` is a binary that converts a PDF file into a text file.

```
➜  fuzzing_xpdf ./install/bin/pdftotext pdf_examples/sample.pdf
➜  fuzzing_xpdf ls -l pdf_examples | grep sample
-rw-rw-r-- 2 phantom phantom 3028 Feb 24  2017 sample.pdf
-rw-rw-r-- 1 phantom phantom  922 Mar 11 08:37 sample.txt
```

---

## CVE-2019-13288

In xpdf 4.01.01, the `Parser::getObj()` function in `Parser.cc` can be driven into infinite recursion by a crafted file.

I'll skip the AFL environment setup, instrumentation, and initial fuzzer run steps. I ran the fuzzer, waited until a crash appeared, and started the analysis. When a crash occurs, the following pattern appears repeatedly in the stack trace.

```
#326 0x632cb5 in Object::dictLookup(char*, Object*) Object.h:253:18
#327 0x632cb5 in Parser::makeStream(Object*, unsigned char*, CryptAlgorithm, int, int, int) Parser.cc:156:9
#328 0x631839 in Parser::getObj(Object*, unsigned char*, CryptAlgorithm, int, int, int) Parser.cc:94:18
#329 0x6acb86 in XRef::fetch(int, int, Object*) XRef.cc:823:13
```

This repeating chain exhausts the stack and terminates the process. I tried to break the recursion chain through debugging, but it wasn't easy.

---

## Dynamic analysis

### Reading the full backtrace

Looking at the GDB backtrace, the same call chain repeated about 76,000 times before the crash.

```
#76677 0x000055555561f0dc in XRef::fetch (this=0x5555558c61d0, num=7, gen=0, obj=0x7fffffffdc20) at XRef.cc:823
#76678 0x00005555555f6d70 in Object::fetch (this=0x5555558c8538, xref=0x5555558c61d0, obj=0x7fffffffdc20) at Object.cc:105
#76679 0x000055555559b11e in Dict::lookup (this=0x5555558ca1f0, key=0x555555647ba4 "Length", obj=0x7fffffffdc20) at Dict.cc:76
#76680 0x00005555555f7969 in Object::dictLookup (this=0x7fffffffdeb0, key=0x555555647ba4 "Length", obj=0x7fffffffdc20) at Object.h:253
#76681 0x00005555555fbd53 in Parser::makeStream (this=0x5555558ca140, dict=0x7fffffffdeb0, ...) at Parser.cc:156
#76682 0x00005555555fb988 in Parser::getObj (this=0x5555558ca140, obj=0x7fffffffdeb0, ...) at Parser.cc:95
```

### Tracing the call chain

To understand why this loop starts, let's trace the normal call path from `main` to the function in question.

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
    contents.fetch(xref, &obj);  // <-- entry point of the recursion chain
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

The key condition here is `ref.gen != 0`. `Object::fetch` is used extremely heavily throughout the codebase, so setting a breakpoint directly on this function is impractical.

### Setting the breakpoint

The right breakpoint is at the `Object::fetch` call site inside `Page::displaySlice`.

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

Inspecting the second argument (rsi) at the breakpoint confirms `ref.gen = 0`. Since it's the 2nd argument, I printed the struct at rsi and found ref.gen is 0.

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

### Trying to patch in the debugger

To break the recursion condition, let's modify `gen` to a nonzero value.

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

Huh? A SIGSEGV. Not a clean exit, but yet another crash. Looks like I need to go deeper. It means the patch has to target the actual root of the recursion.

### Locating the root cause

Inside `XRef::fetch`, the call flows to `Parser::getObj`.

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

The recursive call inside `Parser::getObj` is as follows.

```c
Object *Parser::getObj(Object *obj, Guchar *fileKey,
                       CryptAlgorithm encAlgorithm, int keyLength,
                       int objNum, int objGen) {
    // ...
    obj->dictAdd(key, getObj(&obj2, fileKey, encAlgorithm, keyLength, objNum, objGen));
    // ^^^^ recursively calls itself
}
```

`getObj` recursively calls itself and keeps adding the results to the dict via `dictAdd`. I've found the vulnerable spot precisely.

### Targeting the actual recursing object

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

I modify the `gen` field of the array's inner element in the debugger.

```c
pwndbg> p &obj->array->elems->ref->gen
$158 = (int *) 0x5555558c60bc
pwndbg> set *0x5555558c60bc=0x90909090
```

After the modification:

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

Diverting to a different path without recursion, the binary exits normally. By redirecting the condition that induces the cycle, the binary terminated normally instead of exhausting the stack.

---

## Source code comparison

Comparing the vulnerable version with the patched version shows the fix is simply the addition of a recursion depth limit. Across versions, essentially nothing changed except the protection against recursion.

```c
#define recursionLimit 500

Object *Parser::getObj(Object *obj, GBool simpleOnly,
      Guchar *fileKey,
      CryptAlgorithm encAlgorithm, int keyLength,
      int objNum, int objGen, int recursion) {
```

The added `recursion` parameter increments on each call and is checked against `recursionLimit`. Nothing else changed. The entire vulnerability and its fix come down to adding a single depth counter.

![source code comparison - recursion limit added](/images/blog/fuzzing-101-xpdf/Untitled.png)

---

## Summary

- Coverage-guided fuzzing with AFL can find stack-overflow crashes caused by unbounded recursion in a parser.
- Triage involves identifying the repeating call pattern in the backtrace and tracing the call chain in the source to find the recursion point.
- Dynamic patching through a debugger lets you verify the root cause by redirecting the loop-inducing condition without recompiling.
- The upstream fix was minimal. A single depth-counter parameter prevents the infinite recursion.
</content>
