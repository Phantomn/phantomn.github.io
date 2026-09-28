---
title: 'SMBGhost & SMBleed: Analysis of CVE-2020-0796 + CVE-2020-1206'
date: 2020-06-20T00:00:00.000Z
excerpt: >-
  Analysis of an Integer Overflow (SMBGhost) and an uninitialized kernel
  memory leak (SMBleed) in the SMBv3.1.1 decompression routine, and a
  Pre-Auth RCE achieved by chaining the two bugs
tags:
  - cve
  - smb
  - windows
  - kernel
  - buffer-overflow
  - memory-leak
  - rce
  - exploitation
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

# SMBGhost (CVE-2020-0796) Analysis

## Vulnerability Overview

This vulnerability in SMBv3 is a potentially wormable vulnerability that can propagate across network shares via the latest version of the protocol (SMB 3.1.1).

Microsoft released a patch for CVE-2020-0796 on the morning of March 12, 2020. The bug occurs in the **decompression routine** for the SMBv3 data payload, and was introduced in the Windows 10 1903 (April 2019) and 1909 (November 2019) releases.

The vulnerability occurs while processing a crafted compressed message. The message header follows the MS-SMB2 spec.

![SMB Compression Transform Header structure](/images/blog/smbleed-smbghost/smbghost-header.png)

Key vulnerable points:

- The header has two key parameters: `OriginalCompressedSegmentSize` and `Offset/Length`.
- `Srv2DecompressData` (srv2.sys) allocates a buffer of size `OriginalCompressedSegmentSize + Offset/Length`.
- There is **no sign check** on the addition of these two values — an attacker can intentionally cause a small buffer to be allocated.
- Data from `packet + 0x10 + offset` is decompressed into `buffer + offset`.
- `OriginalCompressedSegmentSize` is passed as the `UncompressedBufferSize` parameter to `SmbCompressionDecompression` (a wrapper around `RtlDecompressBufferEx2`).
- This routine treats the decompression buffer size as an `unsigned long` — **a negative value gets cast to a large unsigned number**, causing the decompression routine to assume the buffer is far larger than its actual size, resulting in an OOB Write.

Below is a disassembly of the vulnerable function on the server side:

![Srv2DecompressData disassembly 1](/images/blog/smbleed-smbghost/smbghost-disasm1.png)

![Srv2DecompressData disassembly 2](/images/blog/smbleed-smbghost/smbghost-disasm2.png)

This vulnerability affects a compressed message sent after the `Negotiate` protocol response, so it **affects both client and server**. The server-side vulnerability lives in `srv2.sys`, and the client-side vulnerability in `mrxsmb.sys`; both call `SmbCompressionDecompress`.

Client-side disassembly:

![Client-side disassembly](/images/blog/smbleed-smbghost/smbghost-disasm3.png)

`OriginalCompressedSegmentSize` is bounds-checked, but the result of adding it to `Offset/Length` is not checked before being passed to `ExAllocatePoolWithTag`.

## Compression Negotiation Flow

If inbound SMB3 traffic over port 445 is allowed, compression is supported by default. The client and server perform compression negotiation before exchanging compressed payloads.

![SMB compression negotiation flow](/images/blog/smbleed-smbghost/smbghost-compress-nego.png)

The vulnerability exists in the SMB compression transform header at every pre-authentication stage.

![Pre-auth vulnerable point](/images/blog/smbleed-smbghost/smbghost-payload.png)

Below you can see an attacker-controlled, very large `OriginalSize` (`0xFFFFFFFF`, i.e. -1 as a signed long). This gets copied into a small fixed buffer, causing a classic BOF. The `\xfcSMB` magic bytes are the `ProtocolID` indicating that the message requires decompression.

![Attacker-controlled data](/images/blog/smbleed-smbghost/smbghost-attacker-data.png)

Not just the server, but the **client is also vulnerable**. If a client connects to a malicious SMB server, the server can respond in the same way to trigger a client-side overflow.

## Exposure

Shodan.io search results just before the patch was released:

```
port:445 os:"Windows" + os:"18362"
```

More than 35,000 vulnerable Windows PCs were found in the search.

![Shodan search results 1](/images/blog/smbleed-smbghost/smbghost-shodan1.png)

![Shodan search results 2](/images/blog/smbleed-smbghost/smbghost-shodan2.png)

![Shodan search results 3](/images/blog/smbleed-smbghost/smbghost-shodan3.png)

## Patch Analysis

In the patched version, `RtlULongAdd` is used to perform the `OriginalCompressedSegmentSize + Offset/Length` addition. Additional logic was also added to check that the size does not exceed the total packet size + 0x134. `RtlULongSub` is also used when computing the compression buffer size that accounts for the `Offset` field.

![Patch comparison](/images/blog/smbleed-smbghost/smbghost-patch.png)

## Impact: BSOD vs RCE

Causing a BSOD is straightforward. Achieving full RCE is harder, requiring bypasses of Windows mitigations such as KASLR. For this bug, the attacker has a basic primitive for allocating data and can control the overflow size. However, objects allocated in memory tend to be freed relatively quickly, which makes exploitation more difficult.

![BSOD vs RCE analysis](/images/blog/smbleed-smbghost/smbghost-bsod-rce.png)

---

# SMBleed (CVE-2020-1206) Analysis

## Summary

- While analyzing the vulnerable SMBGhost function, another vulnerability was discovered -> **SMBleed (CVE-2020-1206)**
- SMBleed: **remotely** leaks kernel memory
- Chaining SMBGhost (patched) + SMBleed -> **Pre-Auth RCE**
- POC #1 (SMBleed remote kernel memory leak): [ZecOps/CVE-2020-1206-POC](https://github.com/ZecOps/CVE-2020-1206-POC)
- POC #2 (SMBleed + SMBGhost Pre-Auth RCE): [ZecOps/CVE-2020-0796-RCE-POC](https://github.com/ZecOps/CVE-2020-0796-RCE-POC)

## Analysis of the Vulnerable Function

SMBleed occurs in the same function as SMBGhost (`Srv2DecompressData` in `srv2.sys`).

```c
typedef struct _COMPRESSION_TRANSFORM_HEADER {
    ULONG ProtocolId;
    ULONG OriginalCompressedSegmentSize;
    USHORT CompressionAlgorithm;
    USHORT Flags;
    ULONG Offset;
} COMPRESSION_TRANSFORM_HEADER, *PCOMPRESSION_TRANSFORM_HEADER;

typedef struct _ALLOCATION_HEADER {
    // ...
    PVOID UserBuffer;
    // ...
} ALLOCATION_HEADER, *PALLOCATION_HEADER;

NTSTATUS Srv2DecompressData(PCOMPRESSION_TRANSFORM_HEADER Header, SIZE_T TotalSize)
{
    PALLOCATION_HEADER Alloc = SrvNetAllocateBuffer(
        (ULONG)(Header->OriginalCompressedSegmentSize + Header->Offset),
        NULL); // allocate a buffer of size OriginalCompressedSegmentSize + Offset
    if (!Alloc) {
        return STATUS_INSUFFICIENT_RESOURCES;
    }

    ULONG FinalCompressedSize = 0;

    NTSTATUS Status = SmbCompressionDecompress(
        Header->CompressionAlgorithm,
        (PUCHAR)Header + sizeof(COMPRESSION_TRANSFORM_HEADER) + Header->Offset,
        (ULONG)(TotalSize - sizeof(COMPRESSION_TRANSFORM_HEADER) - Header->Offset),
        (PUCHAR)Alloc->UserBuffer + Header->Offset,
        Header->OriginalCompressedSegmentSize,
        &FinalCompressedSize);
    if (Status < 0 || FinalCompressedSize != Header->OriginalCompressedSegmentSize) {
        SrvNetFreeBuffer(Alloc);
        return STATUS_BAD_DATA;
    }

    if (Header->Offset > 0) {
        memcpy(
            Alloc->UserBuffer,
            (PUCHAR)Header + sizeof(COMPRESSION_TRANSFORM_HEADER),
            Header->Offset); // memcpy of Offset bytes
    }

    Srv2ReplaceReceiveBuffer(some_session_handle, Alloc);
    return STATUS_SUCCESS;
}
```

![SmbCompressionDecompress flow](/images/blog/smbleed-smbghost/smbleed-func.png)

Processing flow:
1. `Srv2DecompressData` receives the client's compressed message
2. Allocates the required memory and decompresses the data
3. If the `Offset` field is non-zero, `memcpy`s the data preceding the compressed data to the start of the allocated buffer

## The Core Bug

Assume that after the SMBGhost patch, an Integer Overflow check has been added. A serious bug still remains.

What happens if we set `OriginalCompressedSegmentSize` to a value **slightly larger** than the actual decompressed data size?

For example, if the decompressed size is `x`, set `OriginalCompressedSegmentSize` to `x + 0x1000`.

![Uninitialized kernel memory treated as part of the message](/images/blog/smbleed-smbghost/smbleed-uninit.png)

Uninitialized kernel data gets treated as, and read as, part of the message.

**Why does the check pass?** Looking at the implementation of `SmbCompressionDecompress`:

```c
NTSTATUS SmbCompressionDecompress(
    USHORT CompressionAlgorithm,
    PUCHAR UncompressedBuffer,
    ULONG UncompressedBufferSize,
    PUCHAR CompressedBuffer,
    PULONG FinalCompressedSize)
{
    // ...
    NTSTATUS Status = RtlDecompressBufferEx2(
        ...,
        FinalUncompressedSize,
        ...);
    if (Status >= 0) {
        *FinalUncompressedSize = CompressedBufferSize; // overwritten with CompressedBufferSize
    }
    // ...
    return Status;
}
```

On successful decompression, `FinalCompressedSize` is updated to `CompressedBufferSize` (i.e. `x + 0x1000`, which is `OriginalCompressedSegmentSize`). As a result, the check `FinalCompressedSize != Header->OriginalCompressedSegmentSize` **passes**, and `0x1000` bytes of uninitialized kernel memory are leaked.

## Exploit Overview

The SMB message used to demonstrate the vulnerability: [SMB2 WRITE message](https://docs.microsoft.com/ko-kr/openspecs/windows_protocols/ms-smb2/e7046961-3318-4350-be2a-a8d69bb59ce8)

```c
// HACK: fake size
if (((Smb2SinglePacket)packet).Header.Command == Smb2Command.WRITE) {
    ((Smb2WriteRequestPacket)packet).Payload.Length += 0x1000;
    compressedPacket.Header.OriginalCompressedSegmentSize += 0x1000;
}
```

The leaked memory comes from a previous allocation in the `NonPagedPoolNx` pool, and the leaked data can be controlled to some extent by controlling the allocation size.

![SMBleed POC demo](/images/blog/smbleed-smbghost/smbleed-poc-demo.gif)

## Affected Versions

Affects Windows 10 Version 1903, 1909, 2004.

Early builds of Windows 10 1903 also had an additional **Null Dereference bug** while processing a valid compressed SMB packet:

Before the patch (Null Dereference occurs):

![Before the patch — Null Dereference](/images/blog/smbleed-smbghost/smbleed-nullderef-unpatched.png)

After the patch (Null Dereference check added):

![After the patch — Null Dereference check](/images/blog/smbleed-smbghost/smbleed-nullderef-patched.png)

---

# SMBleedingGhost: Chaining SMBleed + SMBGhost -> Pre-Auth RCE

By leaking kernel memory with SMBleed to bypass KASLR, and combining it with the Write-What-Where primitive from SMBGhost, unauthenticated RCE becomes achievable.

![SMBleedingGhost RCE demo](/images/blog/smbleed-smbghost/smbleedghost-rce-demo.gif)

POC: [ZecOps/CVE-2020-0796-RCE-POC](https://github.com/ZecOps/CVE-2020-0796-RCE-POC)

---

# Mitigations

One or more of the following resolves both SMBleed and SMBGhost:

1. **Apply the Windows update** (recommended) — fully resolves the issue
2. **Block port 445** — prevents lateral movement
3. **Isolate the host**
4. **Disable SMB 3.1.1 compression** (not recommended)

---

**References**
- [Microsoft CVE-2020-0796](https://portal.msrc.microsoft.com/en-US/security-guidance/advisory/CVE-2020-0796)
- [ZecOps SMBleed Blog](https://blog.zecops.com/vulnerabilities/smbleed-a-new-critical-vulnerability-in-smbv3/)
- [POC: SMBleed](https://github.com/ZecOps/CVE-2020-1206-POC)
- [POC: SMBGhost RCE](https://github.com/ZecOps/CVE-2020-0796-RCE-POC)