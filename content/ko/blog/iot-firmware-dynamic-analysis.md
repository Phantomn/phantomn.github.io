---
title: "IoT 펌웨어 동적 분석: FIRMADYNE으로 임베디드 리눅스 펌웨어 에뮬레이션하기"
date: 2021-01-01
description: "리눅스 기반 임베디드 펌웨어의 자동화된 동적 분석 기법을 다루는 연구 정리. FIRMADYNE의 에뮬레이션 전략, 주변장치 모델링, 취약점 발견 방법론을 설명한다."
tags: ["IoT", "firmware", "fuzzing", "dynamic-analysis", "embedded", "router", "research", "QEMU"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 개요

임베디드 펌웨어를 대규모로 분석하는 것은 보안 연구에서 해결하기 어려운 문제 중 하나다. 데스크톱 소프트웨어와 달리, IoT 펌웨어는 이기종 하드웨어에서 실행되고, 독점 주변장치에 의존하며, 디버깅을 고려하지 않고 제작된다. 실제 NVRAM 칩이나 특정 SoC, 제조사 커스텀 커널 없이 라우터 웹 인터페이스를 일반 PC에서 구동하려면 비자명한 에뮬레이션 스택이 필요하다.

이 글은 NDSS 2016에서 발표된 *"Towards Automated Dynamic Analysis for Linux-based Embedded Firmware"* 논문을 정리한 것이다. 이 논문은 42개 제조사의 펌웨어 이미지 23,035개를 대상으로 리눅스 기반 임베디드 펌웨어를 자동으로 에뮬레이션하고 분석하는 시스템인 **FIRMADYNE**을 소개한다. FIRMADYNE은 887개의 도달 가능한 펌웨어 이미지에서 이전에 알려지지 않은 취약점 14개를 발견하고 기존에 알려진 취약점 74개를 확인했다.

---

## 문제 정의: IoT 펌웨어 분석이 어려운 이유

핵심 과제는 **하드웨어 의존성 문제**다. 임베디드 펌웨어는 특정 SoC를 위해 컴파일되고, 특정 주변장치(NVRAM, MTD 파티션, 워치독 타이머)를 기대하며, 제조사가 수정한 커널 위에서 부팅된다. 일반적인 QEMU 인스턴스에서 펌웨어 바이너리를 그대로 실행하면 다음과 같은 이유로 실패한다:

1. 원본 커널이 특정 하드웨어를 타겟으로 하여 일반 플랫폼에서 크래시가 발생한다.
2. 유저스페이스 프로세스가 NVRAM(`nvram_get`, `nvram_set`)을 호출할 때 NULL을 반환받아 부팅 중 크래시가 발생한다.
3. 제조사 특유의 디바이스 노드(`/dev/mtdX`, `/dev/mem` 매핑)가 존재하지 않는다.
4. 실제 하드웨어의 네트워크 인터페이스 이름(`ra0`, `ath0`)과 에뮬레이션 플랫폼의 이름(`eth0`)이 다르다.

IoT 펌웨어 분석의 일반적인 접근 방식을 비교하면 다음과 같다:

| 접근 방식 | 예시 | 한계 |
|---|---|---|
| 정적 분석 | 바이너리 디핑, 테인트 전파 | 런타임 로직 결함 탐지 불가 |
| 심볼릭 실행 | Firmalice (angr 기반) | 수동 보안 정책 필요, 확장성 부족 |
| 에뮬레이터 기반 퍼징 | Avatar, FIRMADYNE | 주변장치 에뮬레이션 갭으로 부팅 실패 |
| 종합 테스팅 | 정적 테인트 + 동적 퍼징 | 하드웨어 의존 이미지 완전 시뮬레이션 불가 |

FIRMADYNE은 전체 시스템 에뮬레이션 방식을 선택하고, 인스트루멘티드 커널과 유저스페이스 shim 라이브러리의 조합으로 주변장치 갭 문제를 해결하려 한다.

---

## 아키텍처 개요

FIRMADYNE은 **크롤링**, **추출**, **에뮬레이션**, **동적 분석**의 네 단계로 구성된 파이프라인이다.

### 1. 펌웨어 크롤링

Scrapy 기반 크롤러가 42개 제조사 지원 페이지에서 펌웨어를 다운로드한다. 동적 웹사이트를 사용하는 제조사(D-Link, ZyXEL)는 FTP 미러를 통해 크롤링했다. 각 이미지에 대해 제품명, 버전, 출시일, 변경 이력, MIB 파일 링크 등의 구조화된 메타데이터를 수집했다. 총 23,035개의 이미지가 수집되었으며, 라우터, NAS, IP 카메라, 케이블 모뎀, 스마트 TV, 액세스 포인트 등이 포함된다.

### 2. 파일시스템 추출

FIRMADYNE은 `binwalk` API를 기반으로 구축된 커스텀 추출 유틸리티를 사용하지만, binwalk의 기본 재귀 추출(Matryoshka) 방식은 사용하지 않는다. 대신 루트 파일시스템을 찾는 즉시 추출을 종료하여 자원 낭비를 방지한다.

일반 binwalk 대비 개선 사항:
- 우선순위 기반 시그니처 매칭: 일반 GZIP 데이터보다 펌웨어 헤더를 먼저 매칭하여 오탐 추출 시도를 줄인다.
- 표준 `jffsdump`/`unsquashfs` 대신 서드파티 도구 `jefferson`(JFFS2)과 `sasquatch`(SquashFS)를 사용한다. 제조사가 수정한 파일시스템은 표준 도구로 처리가 실패하는 경우가 많다.
- PE32, ELF, Universal Binary, PDF, Office 문서 등 펌웨어가 아닌 입력을 블랙리스트로 처리한다.

루트 파일시스템은 최소 4개의 표준 FHS 디렉토리가 존재하는지 확인하여 검증한다.

### 3. 에뮬레이션

논문에서 기술적으로 가장 흥미로운 부분이다.

**커널 교체.** 원본 제조사 커널(특정 하드웨어용으로 컴파일되어 즉시 크래시 발생)을 부팅하는 대신, FIRMADYNE은 ARM little-endian, MIPS little-endian, MIPS big-endian 아키텍처용 커스텀 커널을 빌드한다. 이 세 아키텍처가 데이터셋의 90.8%를 차지한다. 커스텀 커널에는 kprobes를 사용하여 20개 시스템 콜을 후킹하는 커널 모듈이 포함되어 있어, 네트워크 인터페이스 할당, 브릿지 생성, MAC 주소 변경, 프로그램 실행 등을 모니터링할 수 있다.

**NVRAM 에뮬레이션.** 펌웨어 이미지의 최소 52.6%가 하드웨어 NVRAM에 접근하기 위해 `libnvram.so`를 사용한다. NVRAM은 네트워크 설정, 자격 증명, 장치 구성 등을 저장하는 키-값 저장소다. 이 없이는 `nvram_get()` 호출이 NULL을 반환하여 부팅 프로세스가 크래시된다.

FIRMADYNE은 `LD_PRELOAD`를 통해 NVRAM 호출을 가로채어 init이 시작되기 전에 커스텀 유저스페이스 라이브러리를 주입한다. 이렇게 하면 모든 자식 프로세스가 이를 상속받는다. 라이브러리는 `-nostdlib` 컴파일과 ELF 지연 바인딩 메커니즘을 사용하여 데이터셋의 다양한 툴체인과 호환성을 보장한다.

**네트워크 추론("학습" 단계).** 실제 분석 실행 전, 각 펌웨어 이미지가 60초 동안 "학습" 모드로 부팅된다. 인스트루멘티드 커널이 어떤 IP 주소가 어떤 네트워크 인터페이스에 할당되는지, 802.1d 브릿지나 802.1Q VLAN이 구성되는지를 기록한다. 이를 통해 호스트 측에서 올바른 IP와 VLAN 구성으로 TAP 인터페이스를 설정하여 에뮬레이션된 펌웨어와 실제로 통신할 수 있다.

**플랫폼별 특이사항.** MIPS 타겟은 Malta 개발 플랫폼(커널 2.6.32.68)을 사용한다. ARM은 Cortex-A9(ARMv7-A)의 Versatile Express 플랫폼을 사용하는데, 표준 ARM926이 일부 펌웨어에 있는 새로운 ARM 명령어를 지원하지 않기 때문이다. 알려진 한계: ARM 플랫폼은 에뮬레이션된 이더넷 장치를 하나만 지원하여(PCI 버스 없음) 일부 멀티 인터페이스 펌웨어가 동작하지 않는다.

`alphafs` 웹 서버를 사용하는 138개 펌웨어 이미지의 경우 QEMU 소스에서 16바이트를 패치하여 알려진 VendorID/ProductID 값을 반환하도록 처리했다.

### 4. 동적 분석

성공적으로 에뮬레이션된 각 이미지에 대해 세 가지 자동화된 분석이 실행된다:

**웹페이지 접근성.** Python 하네스가 펌웨어 파일시스템에서 `/www/` 하위 파일을 검색하고, 정적 리소스(`.png`, `.css`, `.js`)를 필터링한 후 각 URL에 직접 HTTP 접근을 시도한다. 2xx가 아닌 응답 코드는 제외한다. 결과를 집계하여 URL별 접근성 순위를 매긴다.

**SNMP 열거.** `snmpwalk`를 "Public"과 "Private" 커뮤니티 문자열로 실행하여 인증 없이 접근 가능한 모든 SNMP 데이터를 덤프한다. 크롤링 중 수집된 MIB 파일을 활용하여 OID를 해석한다. 네트워크 구성, 자격 증명, 장치 식별자 등 민감한 정보가 드러난다.

**알려진 취약점 및 신규 취약점 탐지.** 60개의 알려진 익스플로잇(주로 Metasploit)이 각 이미지에 순차적으로 실행된다. 신규 취약점의 경우, 팀은 `0xDEADBEEF`와 `0x41414141` 같은 포이즌 값을 사용하여 수동으로 PoC 익스플로잇을 개발한 후, 인스트루멘티드 커널 로그에서 해당 값이 예상치 못한 위치(포이즌 주소에서의 세그폴트, 시스템 콜에 포이즌 값 전달)에 나타나는지 확인했다.

---

## 주요 결과

수집된 23,035개 이미지로부터:

- **96.6%**(8,591개)가 초기 에뮬레이션 단계에 진입했다.
- **32.3%**(2,797개)가 네트워크 구성을 성공적으로 추론했다.
- **70.8%**(1,971개)가 ping을 통해 도달 가능했다.
- 도달 가능한 이미지의 **45%**(887개)가 최소 하나의 익스플로잇에 취약했다.

네트워크 추론 단계에서 8,591개에서 2,797개로의 급격한 감소는 주로 NVRAM 에뮬레이션 문제에 기인한다: 기본값 누락, 호환되지 않는 NVRAM 시맨틱, 또는 `libnvram.so`를 우회하여 MTD 파티션에 직접 쓰는 펌웨어.

취약점 분석 결과:
- **이전에 알려지지 않은 취약점 14개** (69개 펌웨어 이미지에 영향)
- **알려진 취약점 74개** (887개 이미지에서 확인)

도달 가능한 이미지의 네트워크 서비스 현황:
- 47.3%가 웹 기반 설정 인터페이스(HTTP 또는 HTTPS)를 노출
- 그 중 HTTPS를 사용하는 것은 9.5%에 불과 (HTTP 지원 장치의 19.8%)
- 27.2%가 라우터로 판단됨 (DNS 프록시 서비스 감지)
- 16.4%가 UPnP를 기본적으로 활성화하여 LAN 장치가 WAN 포트 포워딩을 자동으로 구성 가능

---

## 관련 접근 방식 비교

**Firmalice** (angr 기반 심볼릭 실행)는 인증 우회를 타겟으로 한다: 하드코딩된 자격 증명, 숨겨진 인증 인터페이스, 보호되지 않은 접근 지점. 인스트루멘테이션 없이 바이너리 수준에서 동작하지만, 장치별로 보안 정책을 수동으로 지정해야 하며 수천 개의 이미지에 확장하기 어렵다.

**Avatar**는 물리적 장치를 보조 프로세서로 사용한다: 펌웨어 코드는 에뮬레이터에서 실행되지만 I/O 작업은 실제 하드웨어로 전달된다. 높은 정확도를 달성하지만 각 장치 유형에 물리적 접근이 필요하다.

**FIRMADYNE**은 정확도보다 규모를 선택한다. 23,000개 이미지를 자동으로 실행할 수 있지만, NVRAM 기본값 근사, 트리 외 커널 모듈 미로드, 일부 이미지의 부팅 실패 등의 비용이 따른다.

---

## 분석 노트

**32% 네트워크 추론 성공률이 실질적인 병목이다.** FIRMADYNE은 대부분의 펌웨어를 부팅시키지만, 1/3만이 네트워크 구성에 성공한다. 논문은 이를 주로 NVRAM 실패로 추적한다. NVRAM 기본값이 파일시스템 텍스트 파일이나 공유 라이브러리의 내보낸 심볼에 저장되어 있다는 통찰은 영리하지만 본질적으로 취약하다.

**커스텀 커널은 강점이자 한계다.** kprobes로 커널을 인스트루멘트하는 것은 유저스페이스 바이너리를 수정하지 않고도 시스템 수준의 관찰 가능성을 제공한다. 하지만 이는 FIRMADYNE이 제조사 원본 커널이나 트리 외 커널 모듈의 취약점을 탐지할 수 없음을 의미한다.

**도달 가능한 이미지의 45% 취약점 비율은 놀랍다.** 네트워크를 통해 도달 가능한 펌웨어 이미지 중 거의 절반이 최소 하나의 익스플로잇 가능한 취약점을 가지고 있었다. 이는 당시 임베디드 펌웨어 보안 상태에 대한 심각한 통계다.

**PoC 검증 접근 방식은 과소평가된다.** `0xDEADBEEF` 같은 포이즌 값을 사용하고 인스트루멘티드 커널 로그에서 이를 확인하는 것은 각 취약점에 대해 "성공"이 어떻게 보이는지 알 필요 없이 익스플로잇 성공을 확인하는 깔끔하고 범용적인 메커니즘이다.

**FIRMADYNE이 다루지 않는 것:** FIRMADYNE은 명시적으로 전체 시스템 분석 도구로, 커버리지 가이드 퍼징을 수행하는 것이 아니라 고정된 익스플로잇 스크립트를 실행한다. 후속 도구들(FIRM-AFL, FIRM-COV, FirmAE)은 이 에뮬레이션 기반 위에 그레이박스 퍼징을 추가한다.

---

## FIRMADYNE 실습 가이드

### 설치 (Ubuntu 18.04 LTS)

```bash
sudo apt update && sudo apt upgrade
sudo apt-get install busybox-static fakeroot git dmsetup kpartx netcat-openbsd nmap \
  python3-psycopg2 snmp uml-utilities util-linux vlan python3-pip python3-magic

sudo update-alternatives --install /usr/bin/python python /usr/bin/python3 10

git clone --recursive https://github.com/firmadyne/firmadyne.git

git clone https://github.com/ReFirmLabs/binwalk.git
cd binwalk
sudo ./deps.sh
sudo python ./setup.py install
cd ..

sudo apt-get install postgresql
sudo -u postgres createuser -P firmadyne   # 비밀번호: firmadyne
sudo -u postgres createdb -O firmadyne firmware
sudo -u postgres psql -d firmware < ./firmadyne/database/schema

cd firmadyne
./download.sh

sudo apt-get install qemu-system-arm qemu-system-mips qemu-system-x86 qemu-utils
```

`firmadyne.config` 파일에서 `FIRMWARE_DIR`의 주석을 해제하고 firmadyne 폴더 경로를 설정한다.

### 에뮬레이션 실행

분석할 펌웨어를 다운로드한다:

```bash
wget http://www.downloads.netgear.com/files/GDC/WNAP320/WNAP320%20Firmware%20Version%202.0.3.zip
```

펌웨어 컴포넌트를 추출한다:

```bash
sudo ./sources/extractor/extractor.py -b Netgear -sql 127.0.0.1 -np -nk \
  "WNAP320 Firmware Version 2.0.3.zip" images
```

추출 중 생성된 ID를 확인한다(예: 1). 이후 단계에서 이 ID를 사용한다:

```bash
./scripts/getArch.sh ./images/1.tar.gz
./scripts/tar2db.py -i 1 -f ./images/1.tar.gz
sudo ./scripts/makeImage.sh 1
./scripts/inferNetwork.sh 1
```

인터페이스 IP가 표시된다(예: 192.168.0.100). 에뮬레이션을 시작한다:

```bash
./scratch/1/run.sh
```

콘솔에는 `admin/password` 자격 증명으로 로그인한다. 동일한 자격 증명으로 `192.168.0.100`의 웹 UI에 접근할 수 있다.

파일시스템 마운트:

```bash
sudo ./scripts/mount.sh 1
```

### 분석 실행

**SNMP 분석:**
```bash
./analyses/snmpwalk.sh 192.168.0.100
less snmp.public.txt
less snmp.private.txt
```

**웹 접근성:**
```bash
./analyses/webAccess.py 1 192.168.0.100 log.txt
less log.txt
```

**포트 스캔:**
```bash
sudo nmap -O -sV 192.168.0.100
```

**익스플로잇 실행:**
```bash
sudo apt install curl
curl https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb > msfinstall
chmod 755 msfinstall && ./msfinstall

msfconsole   # 초기 설정 완료 후 종료

mkdir exploits
python ./analyses/runExploits.py -t 192.168.0.100 -o exploits/exploit -e x
less exploits/exploit.metasploit.log
```

---

## 관련 연구

FIRMADYNE 이후의 연구 흐름:

- **FirmAE** — FIRMADYNE의 에뮬레이션을 더 공격적인 호환성 휴리스틱으로 확장하여 네트워크 추론 성공률을 향상시킨다.
- **Firm-AFL** — 더 높은 처리량을 위해 AFL 그레이박스 퍼징을 프로세스 에뮬레이션에 결합한다.
- **FIRM-COV** — 더 높은 코드 커버리지를 목표로 하는 최적화된 프로세스 에뮬레이션.
- **IOTFUZZER** — 에뮬레이션을 완전히 배제하고 companion 모바일 앱을 통해 펌웨어를 퍼징한다.
- **Snipuzz** — 소스나 에뮬레이션 없이 메시지 스니펫 추론을 통한 블랙박스 퍼징.

---

## 참고 문헌

Chen, D., Woo, M., Brumley, D., & Egele, M. (2016). Towards Automated Dynamic Analysis for Linux-based Embedded Firmware. *Proceedings of the 2016 Network and Distributed System Security Symposium (NDSS)*.

[보충 비디오 워크스루](https://www.youtube.com/watch?v=Zdoef_4LSHA)
