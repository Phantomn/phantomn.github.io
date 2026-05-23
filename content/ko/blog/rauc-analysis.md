---
title: "RAUC: 임베디드 리눅스 펌웨어 업데이트 프레임워크 분석"
date: 2021-01-01
description: "임베디드 리눅스 시스템에서 사용되는 견고한 자동 업데이트 메커니즘 RAUC의 보안 분석. 업데이트 체인 무결성과 공격 표면에 초점을 맞춘다."
tags: ["embedded", "RAUC", "firmware-update", "Linux", "IoT", "security-analysis"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 개요

RAUC(Robust Auto-Update Controller)는 임베디드 리눅스 시스템에서 널리 사용되는 펌웨어 업데이트 프레임워크다. A/B 파티션 전환 메커니즘, 암호화 번들 서명, 부트로더 통합을 제공한다. 이 글은 Xilinx Zynq ZC7000 보드를 타겟으로 하는 Petalinux 빌드에 RAUC를 통합하는 과정과, 해당 통합을 통해 노출되는 보안 관련 구성 표면을 문서화한다.

---

## RAUC 레이어 추가

1. Petalinux 프로젝트 디렉토리로 이동한다.
2. `dunfell` 릴리스에 고정된 RAUC 메타 레이어를 클론한다:

```bash
git clone -b dunfell https://github.com/rauc/meta-rauc.git
```

3. `bblayers.conf`에 레이어를 등록한다:

```bash
petalinux-config
```

**Yocto Settings → User Layers** 항목에서 `meta-rauc` 경로를 추가한다.

---

## RAUC 구성

### local.conf

```
IMAGE_INSTALL_append = " rauc"
EXTRA_IMAGE_FEATURES += "package-management"
```

### system.conf

`project-spec/meta-user/recipes-core/rauc/files/system.conf` 파일을 생성한다:

```ini
[system]
compatible=Zynq-ZC7000-RAUC
bootloader=uboot

[keyring]
path=/etc/rauc/ca.cert.pem

[slot.rootfs.0]
device=/dev/mmcblk0p2
type=ext4
bootname=A

[slot.rootfs.1]
device=/dev/mmcblk0p3
type=ext4
bootname=B
```

`compatible` 문자열은 설치 시 번들의 매니페스트와 비교된다. 불일치하면 RAUC가 번들을 완전히 거부한다. 이는 크로스 디바이스 번들 리플레이에 대한 첫 번째 방어선이다.

`[keyring]` 섹션은 번들 서명을 검증하는 데 사용되는 CA 인증서를 가리킨다. **전체 업데이트 체인의 보안은 이 파일의 무결성 보호에 의존한다.**

### bbappend 레시피

`project-spec/meta-user/recipes-core/rauc/rauc_%.bbappend` 파일을 생성한다:

```
FILESEXTRAPATHS_prepend := "${THISDIR}/files:"
SRC_URI += "file://system.conf"

do_install_append() {
    install -m 0644 ${WORKDIR}/system.conf ${D}${sysconfdir}/rauc/system.conf
}
```

---

## U-Boot 통합

`project-spec/meta-user/recipes-bsp/u-boot/files/platform-top.h`를 수정한다:

```c
#define CONFIG_BOOTCOMMAND
    "setenv bootargs console=ttyPS0,115200 root=/dev/mmcblk0p2 rw rootwait;"
    "fatload mmc 0 ${kernel_addr_r} uImage;"
    "fatload mmc 0 ${fdt_addr_r} devicetree.dtb;"
    "bootm ${kernel_addr_r} - ${fdt_addr_r}"
```

`system.conf`의 `bootname=A`와 `bootname=B` 슬롯 이름은 U-Boot가 활성 파티션을 추적하는 데 사용하는 환경 변수 이름과 일치해야 한다. RAUC는 성공적인 업데이트 시 DBus를 통해 이 변수들을 기록한다.

---

## 빌드 및 문제 해결

### 빌드

```bash
petalinux-build
```

### 자주 발생하는 문제

**문제: RAUC 의존성 오류**

`local.conf`에 누락된 패키지를 추가한다:

```
IMAGE_INSTALL_append = " openssl libgcc"
```

**문제: U-Boot 환경 변수 적용 안 됨**

U-Boot 소스를 직접 수정하고 재빌드한다:

```bash
petalinux-config -c u-boot
```

**문제: RAUC 슬롯 인식 실패**

커널이 올바른 블록 디바이스를 RAUC에 노출할 수 있도록 디바이스 트리 파일에 파티션 정보를 추가한다.

---

## 번들 생성 및 설치

### 서명된 번들 생성

```bash
rauc bundle \
    --cert=/path/to/cert.pem \
    --key=/path/to/key.pem \
    update-bundle.raucb \
    rootfs.img
```

번들은 rootfs 이미지와 서명된 매니페스트를 포함하는 SquashFS 아카이브다. 매니페스트는 `compatible` 문자열과 슬롯별 체크섬을 기록한다.

### 타겟에서 설치

```bash
rauc install update-bundle.raucb
```

RAUC는 온디바이스 키링에 대해 번들 서명을 검증하고, `compatible` 문자열을 확인하며, 슬롯 체크섬을 검증하고, 비활성 파티션에 이미지를 쓰고, 다음 부팅 시 새 슬롯으로 전환하기 위해 부트로더 환경을 업데이트한다.

---

## 보안 표면 분석

| 컴포넌트 | 공격 표면 |
|---|---|
| CA 인증서 (`ca.cert.pem`) | 쓰기 가능하거나 교체 가능하면 번들 서명 검증이 무력화됨 |
| `system.conf` | `compatible` 문자열이 조작될 수 있으면 다른 장치용 번들이 수용될 수 있음 |
| U-Boot 환경 | 유저스페이스에서 쓰기 가능하면 공격자가 부트로더를 잘못된 슬롯으로 리디렉션하거나 임의의 부팅 인자를 주입할 수 있음 |
| 번들 전송 | 암호화되지 않은 채널로 전달되는 번들은 전송 중 교체될 수 있음 (서명 검증은 적용되지만 번들 손상으로 DoS는 가능) |
| DBus 인터페이스 | RAUC는 DBus 서비스를 노출함; 이 소켓에 대한 접근 제어가 권한 없는 프로세스가 설치를 트리거할 수 있는지를 결정함 |

가장 중요한 불변 조건은 **키링과 `system.conf`의 무결성**이다. 두 파일 모두 활성 루트 파일시스템에 존재한다. 실행 중인 시스템이 침해되면, 지속적인 공격자가 CA 인증서를 자신의 것으로 교체하고 이후 검증을 통과하는 악성 번들에 서명할 수 있다.

RAUC는 실행 중인 시스템을 보호하는 자체 메커니즘을 제공하지 않는다. 그 신뢰 경계는 플랫폼에 의해 강제되어야 한다. 예를 들어 읽기 전용 루트 파일시스템 파티션, TPM 증명을 통한 측정 부팅, 또는 검증된 커널과 initramfs를 사용하는 시큐어 부팅 등을 통해서다.

---

## 보안 고려사항 요약

RAUC를 임베디드 시스템에 통합할 때 다음 사항을 반드시 고려해야 한다:

**키 관리**
- CA 개인 키는 HSM(Hardware Security Module) 또는 오프라인 환경에서 관리한다
- 번들 서명에 사용하는 키와 디바이스에 저장되는 CA 인증서를 명확히 구분한다
- 키 유출 시 대응 절차(인증서 폐기, 새 CA 배포)를 사전에 수립한다

**파일시스템 보호**
- `/etc/rauc/ca.cert.pem`이 포함된 루트 파일시스템을 읽기 전용으로 마운트하는 것을 고려한다
- dm-verity 또는 IMA(Integrity Measurement Architecture)를 통해 파일시스템 무결성을 보장한다

**부트로더 보안**
- U-Boot 환경 변수 파티션에 대한 유저스페이스 쓰기 접근을 제한한다
- 시큐어 부팅을 활성화하여 서명되지 않은 이미지의 실행을 방지한다

**DBus 접근 제어**
- polkit 또는 유사한 메커니즘을 통해 RAUC DBus 인터페이스에 대한 접근을 제한한다
- 권한 없는 사용자가 업데이트를 트리거할 수 없도록 한다

**업데이트 채널 보안**
- 번들 전송 채널에 TLS를 적용하여 전송 중 번들 교체(DoS)를 방지한다
- 번들 다운로드 전 서버 인증서를 검증한다
