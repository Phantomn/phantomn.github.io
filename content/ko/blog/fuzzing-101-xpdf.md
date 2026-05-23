---
title: "Fuzzing 101: AFL로 xpdf에서 버그 찾기"
date: 2021-06-01
description: "AFL을 이용한 커버리지 가이드 퍼징 입문: xpdf 계측, 크래시 트리아지, CVE-2019-13288 재현까지"
tags: ["fuzzing", "AFL", "xpdf", "coverage-guided", "bug-finding", "CVE-2019-13288"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

fuzzing에 대해 "정확히" 모르는 것들이 너무 많아 fuzzing 101을 통해 공부하자는 결론을 냈다.

근데 이것도 어렵다. 나는 fuzzing을 하면 무조건 exploit으로 결론이 난다고 생각했는데 아니었다.

xpdf의 `pdftotext` 바이너리를 퍼징해보자.

`pdftotext`는 PDF 파일을 텍스트 파일로 변환하는 바이너리다.

```
➜  fuzzing_xpdf ./install/bin/pdftotext pdf_examples/sample.pdf
➜  fuzzing_xpdf ls -l pdf_examples | grep sample
-rw-rw-r-- 2 phantom phantom 3028 Feb 24  2017 sample.pdf
-rw-rw-r-- 1 phantom phantom  922 Mar 11 08:37 sample.txt
```

---

## CVE-2019-13288

xpdf 4.01.01에서 `Parser.cc`의 `Parser::getObj()` 함수는 조작된 파일을 통해 무한 재귀를 일으킬 수 있다.

AFL 환경 구성, 계측, 초기 퍼저 실행 단계는 생략한다. 퍼저를 돌리고 크래시가 나올 때까지 기다렸다가 분석을 시작했다. 크래시가 발생하면 스택 트레이스에서 아래와 같은 패턴이 반복적으로 나타난다.

```
#326 0x632cb5 in Object::dictLookup(char*, Object*) Object.h:253:18
#327 0x632cb5 in Parser::makeStream(Object*, unsigned char*, CryptAlgorithm, int, int, int) Parser.cc:156:9
#328 0x631839 in Parser::getObj(Object*, unsigned char*, CryptAlgorithm, int, int, int) Parser.cc:94:18
#329 0x6acb86 in XRef::fetch(int, int, Object*) XRef.cc:823:13
```

이 반복 체인이 스택을 고갈시키고 프로세스를 종료시킨다. 디버깅으로 재귀하는 부분의 체인을 끊어보려 시도했으나 쉽지 않았다.

---

## 동적 분석

### 전체 백트레이스 읽기

GDB 백트레이스를 보면 크래시 전까지 같은 호출 체인이 약 76,000번 반복되었다.

```
#76677 0x000055555561f0dc in XRef::fetch (this=0x5555558c61d0, num=7, gen=0, obj=0x7fffffffdc20) at XRef.cc:823
#76678 0x00005555555f6d70 in Object::fetch (this=0x5555558c8538, xref=0x5555558c61d0, obj=0x7fffffffdc20) at Object.cc:105
#76679 0x000055555559b11e in Dict::lookup (this=0x5555558ca1f0, key=0x555555647ba4 "Length", obj=0x7fffffffdc20) at Dict.cc:76
#76680 0x00005555555f7969 in Object::dictLookup (this=0x7fffffffdeb0, key=0x555555647ba4 "Length", obj=0x7fffffffdc20) at Object.h:253
#76681 0x00005555555fbd53 in Parser::makeStream (this=0x5555558ca140, dict=0x7fffffffdeb0, ...) at Parser.cc:156
#76682 0x00005555555fb988 in Parser::getObj (this=0x5555558ca140, obj=0x7fffffffdeb0, ...) at Parser.cc:95
```

### 호출 체인 추적

이 루프가 왜 시작되는지 이해하기 위해, `main`에서 문제의 함수까지 정상 호출 경로를 추적해보자.

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
    contents.fetch(xref, &obj);  // <-- 재귀 체인의 진입점
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

여기서 핵심 조건은 `ref.gen != 0`이다. `Object::fetch`는 코드베이스 전반에서 매우 많이 사용되므로, 이 함수에 직접 브레이크포인트를 거는 것은 비실용적이다.

### 브레이크포인트 설정

올바른 브레이크포인트는 `Page::displaySlice` 내부의 `Object::fetch` 호출 지점이다.

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

브레이크포인트에서 두 번째 인자(rsi)를 검사하면 `ref.gen = 0`임을 확인할 수 있다. 2번째 인자이므로 rsi에 struct를 프린트해봤더니 ref.gen이 0이다.

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

### 디버거로 패치 시도

재귀 조건을 깨기 위해 `gen`을 0이 아닌 값으로 수정해보자.

```c
pwndbg> p (struct Object)obj
$27 = {
  type = objNone,
  {
    ref = {
      num = 0,
      gen = 1   // 0에서 변경
    },
    ...
  }
}
pwndbg> c
Continuing.

Program received signal SIGSEGV, Segmentation fault.
0x00007ffff7137336 in _int_malloc (av=av@entry=0x7ffff748ec40 <main_arena>, bytes=bytes@entry=7) at malloc.c:3531
```

어? SIGSEGV가 났다. 정상 종료가 아니라 또 다른 충돌이 발생했다. 더 깊이 들어가 봐야 할 것 같다. 패치가 실제 재귀의 근본을 타깃으로 해야 한다는 의미다.

### 근본 원인 위치 파악

`XRef::fetch` 내부에서 호출이 `Parser::getObj`로 흐른다.

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

`Parser::getObj` 내부의 재귀 호출은 다음과 같다.

```c
Object *Parser::getObj(Object *obj, Guchar *fileKey,
                       CryptAlgorithm encAlgorithm, int keyLength,
                       int objNum, int objGen) {
    // ...
    obj->dictAdd(key, getObj(&obj2, fileKey, encAlgorithm, keyLength, objNum, objGen));
    // ^^^^ 자기 자신을 재귀 호출
}
```

`getObj`가 자기 자신을 재귀 호출하고, 결과를 `dictAdd`를 통해 dict에 계속 추가한다. 취약한 부분을 정확히 찾았다.

### 실제 재귀 오브젝트 타깃팅

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

배열 내부 요소의 `gen` 필드를 디버거로 수정한다.

```c
pwndbg> p &obj->array->elems->ref->gen
$158 = (int *) 0x5555558c60bc
pwndbg> set *0x5555558c60bc=0x90909090
```

수정 후:

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

재귀 없이 다른 방향으로 틀어지면서 바이너리가 정상적으로 종료된다. 사이클을 유발하는 조건을 리다이렉션함으로써, 스택을 고갈시키는 대신 바이너리가 정상 종료되었다.

---

## 소스 코드 비교

취약 버전과 패치 버전을 비교하면, 수정 사항이 단순한 재귀 깊이 제한 추가임을 알 수 있다. 버전이 올라가면서 바뀐 것은 재귀에 대한 Protection 말곤 크게 없다.

```c
#define recursionLimit 500

Object *Parser::getObj(Object *obj, GBool simpleOnly,
      Guchar *fileKey,
      CryptAlgorithm encAlgorithm, int keyLength,
      int objNum, int objGen, int recursion) {
```

추가된 `recursion` 파라미터는 호출마다 증가하고 `recursionLimit`에 대해 검사된다. 그 외에는 변경된 것이 없다. 취약점 전체와 수정 방법이 깊이 카운터 하나를 추가하는 것으로 귀결된다.

![소스 코드 비교 - 재귀 제한 추가](/images/blog/fuzzing-101-xpdf/Untitled.png)

---

## 정리

- AFL을 이용한 커버리지 가이드 퍼징은 파서의 무제한 재귀로 인한 스택 오버플로우 크래시를 발견할 수 있다.
- 트리아지는 백트레이스에서 반복되는 호출 패턴을 식별하고, 소스에서 호출 체인을 추적해 재귀 지점을 찾는 과정을 포함한다.
- 디버거를 통한 동적 패치를 사용하면 재컴파일 없이 루프를 유발하는 조건을 리다이렉션함으로써 근본 원인을 검증할 수 있다.
- 업스트림 수정은 최소한이었다. 단 하나의 깊이 카운터 파라미터가 무한 재귀를 방지한다.
