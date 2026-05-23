---
title: "Ryuk 랜섬웨어 샘플 정적 분석 (Hermes 변종)"
date: 2022-03-04
description: "Ryuk 랜섬웨어(Hermes 변종)로 식별된 32-bit PE 바이너리 두 개의 정적 리버스 엔지니어링. 드로퍼/로더와 암호화 페이로드를 분석하고 지속성 확보, 프로세스 인젝션, VSS 삭제 동작을 다룬다."
tags: ["malware", "ransomware", "Ryuk", "Hermes", "reverse-engineering", "PE32", "static-analysis", "Windows"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

**샘플**: 32-bit PE 바이너리 두 개 (Sample1, Sample2)  
**도구**: IDA Pro, x32dbg, HxD  
**식별**: Ryuk 랜섬웨어 — Hermes 변종 (ESTsecurity 블로그 참조)

---

## 개요

두 개의 32-bit PE 바이너리를 받아 분석했다. Sample1은 **드로퍼/로더** 역할로, 실행 환경을 확인하고 내장 페이로드를 디스크에 드롭한 뒤 지속성을 확보한다. Sample2는 **메인 랜섬웨어** 바이너리로, 파일 암호화, 섀도우 카피 삭제, 랜섬 노트 생성을 수행한다.

악성코드 분석보다 리버싱 경험이 더 많은 편이라, WinMain 함수부터 narrow down 방식으로 분석했다.

---

## Sample 1: 드로퍼 / 로더

### 실행 흐름

**1. 실행 환경 확인**

```cpp
GetModuleFileName(NULL, Filename, MAX_PATH);
// → C:\Users\Phantom\Desktop\Samples\sample1

memset(&VersionInformation, 0, sizeof(OSVERSIONINFO));
VersionInformation.dwOSVersionInfoSize = 276;
GetVersionEx(&VersionInformation);
GetWindowsDirectory(Buffer, MAX_PATH);
// → C:\Windows
```

`GetVersionEx`로 OS 메이저 버전을 가져온다. `dwMajorVersion == 5`(Windows XP/2003)이면 페이로드를 Windows 디렉토리에 드롭하고, 그 외(Vista 이상)이면 `C:\Users\Public\`을 타겟으로 삼는다.

**2. 랜덤 파일명 생성**

```cpp
srand(GetTickCount());
// 5자리 알파벳 난수 문자 생성
for (i = 0; i < 5; i++) {
    name[i] = 'A' + (rand() % 26);
}
strcat(name, ".exe");
// 결과: 예) "RSmEa.exe"
// 전체 경로: "C:\Users\Public\RSmEa.exe"
CreateFile(full_path, GENERIC_WRITE, ...);
```

실행마다 파일명이 달라지기 때문에 파일명 패턴 기반 정적 탐지를 무력화한다.

**3. 아키텍처 감지**

```cpp
HMODULE k32 = LoadLibrary("kernel32.dll");
FARPROC isWow64 = GetProcAddress(k32, "IsWow64Process");
IsWow64Process(GetCurrentProcess(), &isWow64Result);
FreeLibrary(k32);
```

WOW64(64-bit OS에서 32-bit 프로세스) 여부를 확인하여 내장된 PE 포맷을 선택한다. 32-bit 환경이면 PE32, 64-bit 환경이면 PE32+를 드롭한다.

**4. 내장 페이로드 드롭**

선택한 PE 헤더 바이트를 `WriteFile`로 랜덤 이름 파일에 기록한다. PE 안에 PE를 내장하고 런타임에 꺼내 쓰는 이 패턴은 다단계 드로퍼의 전형적 특징이다.

**5. 페이로드 실행**

```cpp
ShellExecute(NULL, "open", "C:\\Users\\Public\\RSmEa.exe", NULL, NULL, SW_SHOW);
```

Sample1 실행 후 다음 아티팩트가 확인되었다:
- 데스크탑에 `RukeREADME.txt` 생성
- 작업 디렉토리 내 파일 암호화

---

## Sample 1 (내장 페이로드): 지속성 모듈

Sample1이 드롭한 내장 바이너리는 **지속성 확보**와 **프로세스 인젝션**을 담당한다.

### 레지스트리 Run 키 지속성

```
C:\Windows\System32\cmd.exe /C REG ADD 
"HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
/v "svchos" /t REG_SZ
/d "C:\Users\phantom\Desktop\Samples\sample1_part.exe"
/f
```

`svchos`라는 이름으로 Run 키에 자신을 등록한다. 정상 프로세스 `svchost.exe`와 유사하게 보이도록 이름을 위장한 것이다.

### 프로세스 인젝션 패턴

```cpp
// 실행 중인 모든 프로세스를 열거
// sample_part 프로세스를 프로세스 목록에서 검색
// 일치하는 프로세스마다: Alloc → Write → Execute → Free
// 제외 대상: csrss.exe, explorer.exe, lsass.exe
```

`VirtualAllocEx` / `WriteProcessMemory` / `CreateRemoteThread`를 이용한 표준 프로세스 인젝션 방식이다. 암호화가 완료되기 전 시스템이 크래시되는 것을 방지하기 위해 핵심 시스템 프로세스를 예외 처리하는 것은 랜섬웨어에서 흔히 보이는 패턴이다.

**최종 동작**: `C:\Users\Public\`에 `.sys` 파일을 생성하고 종료한다.

---

## Sample 2: Ryuk 랜섬웨어 (메인 바이너리)

Sample2가 실제 랜섬웨어 컴포넌트다. 바이너리 내에 IP 주소가 노출되어 있었고, 위협 인텔리전스와 대조한 결과 **Ryuk**로 확인되었다. ESTsecurity는 이를 **Hermes 랜섬웨어 변종**으로 분류했다.

### 초기화

```cpp
// sub_403FB0: 동적 임포트 해석
// 필요한 DLL을 로드하고 GetProcAddress로 함수 포인터를 캐싱
// 정적 임포트 테이블에 항목을 남기지 않아 AV 탐지를 회피
```

초기화 루틴에서 API 주소를 동적으로 해석한다. 정적 분석을 어렵게 만드는 일반적인 안티-분석 기법이다.

### 조기 종료를 통한 분석 방해

```cpp
// 배치 파일과 winlogon.exe 아티팩트 생성
// exit() 호출 — 첫 실행에서 강제 조기 종료
```

첫 실행 시 설정을 마치고 바로 종료한다. 실제 암호화 로직은 이후 재실행 또는 프로세스 인젝션을 통해 동작하기 때문에, 브레이크포인트 없이 동적 분석을 하면 암호화 동작을 확인하기 어렵다. 이 부분에서 동적 분석에 상당히 애를 먹었다.

### 암호화 루틴

```cpp
// XOR 기반 바이트 생성:
for (i = 0; i < length; i++) {
    output[i] = input[i] ^ key[i % key_len];
}
```

파일 데이터를 처리하는 두 번째 암호화 함수가 존재한다. 정확히 어디에 이것을 사용하는지는 이 분석 단계에서 완전히 파악하지 못했다. XOR 레이어는 키 래핑(key-wrapping) 단계일 가능성이 높으며, 실제 파일 내용 암호화에는 RSA 또는 AES가 사용될 것으로 보인다(Hermes/Ryuk의 알려진 동작과 일치한다).

### 섀도우 카피 삭제

```cpp
ShellExecute(NULL, "open", "cmd.exe",
    "/C vssadmin Delete Shadows /all /quiet",
    NULL, SW_HIDE);
```

`vssadmin Delete Shadows /all /quiet`로 볼륨 섀도우 카피를 전부 삭제한다. Windows 백업을 통한 파일 복구를 차단하는 것이 목적이다. 이 명령어를 검색하면서 알게 되었는데, 실행 시 백업 파일이 전부 삭제된다. Ryuk/Hermes를 비롯한 많은 랜섬웨어 패밀리의 시그니처 동작이다.

### 랜섬 노트 드롭

```cpp
// RukeREADME.txt를 가리키는 바로가기/링크 생성
// 사용자 데스크탑에 README 표시
```

---

## 요약

| | Sample 1 | Sample 1 (내장) | Sample 2 |
|--|----------|-----------------|----------|
| 역할 | 드로퍼 | 지속성 확보 | 랜섬웨어 |
| 핵심 동작 | 랜덤 파일명, 아키텍처 감지, PE 드롭 | 레지스트리 Run 키, 프로세스 인젝션 | 암호화, VSS 삭제, 랜섬 노트 |
| 안티-분석 | PE-in-PE 내장 | csrss/explorer/lsass 예외 처리 | 동적 임포트, 조기 종료 |

두 샘플은 협력 구조로 동작한다. Sample1이 환경을 준비하고 페이로드를 드롭하며, Sample2가 실제 암호화와 데이터 파괴를 수행한다. Sample1에 바이너리 안에 또 다른 바이너리가 내장되어 있다는 점이 흥미로웠다.

**주요 침해 지표(IoC):**
- 레지스트리 키 `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` → `svchos`
- 파일 `C:\Users\Public\<5자리 랜덤>.exe`
- `vssadmin Delete Shadows /all /quiet` 실행
- `.RYK` 확장자 파일 및 `RukeREADME.txt` 랜섬 노트

---

## 참고 자료

- [ESTsecurity — Hermes 랜섬웨어 분석](https://blog.alyac.co.kr/)
- [FireEye — RYUK Ransomware Technical Analysis](https://www.fireeye.com/blog/threat-research/2019/01/a-nasty-trick-from-credential-theft-malware-to-business-disruption.html)
