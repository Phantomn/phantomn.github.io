---
platform: "letsdefend"
title: "PCAP Analysis"
category: "Network Forensics"
difficulty: "Easy"
date: 2026-04-19
tags:
  - Wireshark
  - HTTP Analysis
  - File Upload
---

# PCAP Analysis

_Lab URL: https://app.letsdefend.io/challenge/pcap-analysis_

## 시나리오

> P13의 컴퓨터에서 캡처된 트래픽이다. P13을 도와줄 수 있는가?

캡처 파일은 약 2만 5천 개의 패킷을 담은 단일 `.pcapng` 파일이다. 무언가를 구체적으로 찾기 전에, 이 파일 안에 두 개의 독립적인 이야기가 공존한다는 것을 파악하는 것이 도움이 된다: 로컬 네트워크에서 P13과 다른 사용자 사이의 평문 채팅 세션, 그리고 내부 웹 서버로 전송된 파일 업로드. 여섯 개의 질문에 모두 답하려면 두 가지 모두 필요하다.

## 질문

### 질문 1

> 네트워크 통신에서 송신자와 수신자의 IP 주소는 무엇인가?

수만 개의 패킷을 분류하는 가장 빠른 방법은 사람이 입력했을 법한 문자열을 검색하는 것이다. 사용자의 닉네임 `P13`이 완벽한 앵커이므로, 다음 표시 필터를 사용했다:

```
frame contains P13
```

이 키워드 필터는 모든 프레임의 원시 바이트를 스캔하여 리터럴 텍스트 `P13`을 포함하는 것만 남긴다. 결과는 `192.168.235.0/24` 세그먼트의 두 호스트 사이의 단일 TCP 교환에 속하는 소수의 패킷으로 좁혀진다. 해당 프레임 중 하나를 열면 내용이 확인된다: `P13: Hey Cu7133! It's been a while. How have you been?`라는 평문 메시지다.

패킷 헤더에서 **`192.168.235.XXX`**는 P13으로 입력하는 호스트이고, **`192.168.235.YYY`**는 상대방, 즉 `Cu7133`이라는 닉네임의 사용자다. 캡처가 P13의 컴퓨터에서 온 것이므로, `.XXX` 호스트가 우리 쪽이고 `.YYY`가 원격 쪽이다.

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776568108/Writeups/Letsdefend/PcapAnalysis/58b2a71c-867b-4c77-bab7-ef663c420ea5.png)

#### 정답

<spoiler>
192.168.235.137,192.168.235.131
</spoiler>

### 질문 2

> P13이 웹 서버에 파일을 업로드했다. 서버의 IP 주소는 무엇인가?

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776569161/Writeups/Letsdefend/PcapAnalysis/c724f3e1-23c9-4fa1-bfe1-08bad105030b.png)

이전 질문의 채팅이 나머지 분석의 맥락을 잡아준다: 캡처 어딘가에서 P13이 파일을 업로드한다. HTTP 업로드는 항상 `POST` 요청으로 전송되므로, P13의 IP를 소스로 하여 메서드 필터와 결합한다:

```
ip.src == 192.168.235.137 && http.request.method == "POST"
```

단 한 개의 패킷만 남는다 — 서버를 향한 `POST /panel.php HTTP/1.1` 요청이다. 이 시점에서 주목할 두 가지 세부 사항이 있다.

첫째, 목적지는 채팅 상대방과 완전히 다른 서브넷에 있다. 이것은 동료 간 메시지가 아닌 서버로의 내부 트래픽이다.

둘째, 요청은 `Content-Type: multipart/form-data` 헤더와 100KB를 초과하는 상당한 `Content-Length`를 담고 있다 — 이것은 브라우저가 폼 제출 안에 파일을 담을 때 사용하는 HTTP 패턴이다.

따라서 답은 해당 POST의 목적지다.

#### 정답

<spoiler>
192.168.1.7
</spoiler>

### 질문 3

> 네트워크를 통해 전송된 파일의 이름은 무엇인가?

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776569451/Writeups/Letsdefend/PcapAnalysis/6568d8d7-495b-41d5-8b9e-29c3f9ecce6b.png)

POST 요청이 이미 확인되었으므로, 파일명은 몇 번 스크롤하면 찾을 수 있다. 패킷을 우클릭하고 **Follow → TCP Stream**을 선택하면 multipart 본문을 포함한 전체 HTTP 대화가 재조립된다. 관련 줄은 다음과 같다:

```
Content-Disposition: form-data; name="XXX"; filename="XXX"
```

`filename=` 속성이 브라우저가 서버에 기록하도록 알려주는 이름이다. 이 캡처에서는 확장자도 경로도 없는, 진짜 문서 이름처럼 보이지 않는 매우 단순한 문자열이다.

그 헤더 아래, 본문 자체는 읽을 수 없는 바이트의 나열이지 알아볼 수 있는 텍스트가 아니다. 이 시각적 혼란이 페이로드가 암호화되었거나 이진 데이터라는 첫 번째 강한 단서다 — 어떤 일반적인 파일 형식(`PDF`, `PK`, `MZ`, `GIF` 등)의 매직 바이트도 처음에 나타나지 않는다.

파일명은 내용이 시사하는 바를 확인해준다: 이 업로드를 준비한 누군가가 식별 메타데이터를 최소한으로 줄였다.

#### 정답

<spoiler>
file
</spoiler>

### 질문 4

> 파일이 업로드된 웹 서버의 이름은 무엇인가?

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776569668/Writeups/Letsdefend/PcapAnalysis/f63a829f-f261-4abe-93da-f0fad8fedc66.png)

서버 소프트웨어를 식별하는 것은 같은 TCP 스트림 더 아래에 있는 HTTP 응답 헤더를 읽는 문제다. multipart 본문을 닫는 경계 줄 다음에 서버의 응답이 `HTTP/1.1 200 OK`로 시작하고 다음 헤더를 포함한다:

```
Server: XYZ/2.4.54 (Win64) OpenSSL/1.1.1p PHP/8.0.25
```

이 문자열 하나에 많은 정보가 담겨 있다. 웹 서버 계열과 정확한 버전, 실행 운영체제 종류(`Win64`), 함께 묶인 OpenSSL 빌드, 심지어 PHP 엔진 버전까지 드러난다.

방어자라면 이 헤더를 스프레드시트에 넣고, 버전들을 CVE 데이터베이스와 대조하여 패치 기한이 지난 것들을 표시할 것이다.

헤더 아래의 HTML 본문은 페이지의 목적을 확인해준다: `My Corp. Panel`이라는 제목과 `Upload your files`라는 제목, 파일 입력 하나가 있는 간단한 폼이 있다. 이것은 상용 제품이 아닌 자체 제작 내부 업로드 엔드포인트다.

#### 정답

<spoiler>
Apache
</spoiler>

### 질문 5

> 파일이 업로드된 디렉토리는 어디인가?

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776569959/Writeups/Letsdefend/PcapAnalysis/5a07bb85-d3b4-4e60-aa5b-6fdc1f982187.png)

요청을 처리하는 엔드포인트(`/panel.php`)가 반드시 파일이 디스크에 저장되는 곳은 아니다. 업로드 핸들러는 보통 다른 곳에 쓰며, 그 목적지가 정확히 정리 작업이나 포렌식 작업에 필요한 정보다.

다행히 서버 측의 PHP 스크립트가 렌더링된 HTML 페이지 바로 위에 확인 줄을 출력한다:

```
file uploaded at XYZ/file
```

이 단 한 줄이 두 가지 질문을 동시에 해결한다: Q3의 파일명(`file`)을 확인하고, 저장 위치를 노출한다 — 웹 루트 아래의 상대 경로다. 이 폼을 통해 전송된 모든 것은 그 폴더에 저장되며, 이는 호스트를 조사하는 대응자가 제출된 파일의 사본을 접근하거나 실행되기 전에 바로 찾아볼 위치를 의미한다.

#### 정답

<spoiler>
uploads
</spoiler>

### 질문 6

> 송신자가 암호화된 파일을 전송하는 데 얼마나 걸렸는가?

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776570557/Writeups/Letsdefend/PcapAnalysis/3d758ae1-1728-4d66-b4f8-e5fddfe7b1c6.png)

Q3에서 이미 업로드된 페이로드가 무작위 이진 데이터처럼 보인다는 것을 알았다 — 읽을 수 있는 문서가 아닌 암호화된 블롭과 일치한다. 단일 HTTP POST와 응답은 하나의 TCP 스트림을 구성하며(이 캡처에서 `tcp.stream eq 22`), Wireshark는 수동 계산 없이 정확하게 시간을 측정할 수 있다.

현재 표시 필터를 활성화한 상태에서 **Statistics → Conversations**를 열면 된다. **"Limit to display filter"** 체크박스를 선택하면 Wireshark가 현재 필터와 일치하는 흐름으로 대화 테이블을 제한한다. 단 하나의 대화만 남는다 — `192.168.235.137`과 `192.168.1.7` 사이의 전체 업로드 — 그리고 그 **Duration**을 확인한다.

이 값은 불과 몇 밀리초에 불과하다. 이 놀랍도록 낮은 값은 환경에 대한 실제 정보를 알려준다: 두 호스트는 동일한 LAN(또는 MAC 주소에서 보이는 `VMware` OUI를 감안하면 동일한 ESXi 호스트)에 있어 사실상 네트워크 레이턴시가 없다. 기가비트 링크에서 약 108KB의 multipart 데이터를 그 시간 안에 전송하는 것은 사소한 일이다.

다시 말해, P13의 머신에서 첫 번째 SYN이 전송된 순간부터 서버가 전체 업로드를 확인 응답할 때까지, **암호화된 파일이 전송되고 수초 안에 전달 완료가 확인됐다**.

#### 정답

<spoiler>
0.0073
</spoiler>
