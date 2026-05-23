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

## Scenario

> We have captured this traffic from P13's computer. Can you help him?

The capture is a single `.pcapng` file with roughly twenty-five thousand packets. Before hunting for anything specific, it helps to understand that two separate stories live inside the file: a plaintext chat session between P13 and another user on the local network, and a file upload sent to an internal web server. Both are needed to answer all six questions.

## Questions

### Question 1

> In network communication, what are the IP addresses of the sender and receiver?

With thousands of packets to sort through, the fastest way to surface a human conversation is to search for a string that a human would type. The user's nickname `P13` is a perfect anchor, so I used the display filter:

```
frame contains P13
```

This keyword filter scans the raw bytes of every frame and keeps only those that contain the literal text `P13`. The result narrows the capture down to a handful of packets, all of which belong to a single TCP exchange between two hosts on the `192.168.235.0/24` segment. Opening one of those frames confirms the content: a plaintext message that reads `P13: Hey Cu7133! It's been a while. How have you been?`.

From the packet headers, **`192.168.235.XXX`** is the host typing as P13, and **`192.168.235.YYY`** is the peer, the user nicknamed `Cu7133`. Because the challenge tells us the capture came from P13's computer, the `.XXX` host is ours and `.YYY` is the remote side.

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776568108/Writeups/Letsdefend/PcapAnalysis/58b2a71c-867b-4c77-bab7-ef663c420ea5.png)

#### Anwser

<spoiler>
192.168.235.137,192.168.235.131
</spoiler>

### Question 2

> P13 uploaded a file to the web server. What is the IP address of the server?

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776569161/Writeups/Letsdefend/PcapAnalysis/c724f3e1-23c9-4fa1-bfe1-08bad105030b.png) 

The chat from the previous question sets up the rest of the analysis: somewhere in the capture, P13 uploads a file. HTTP uploads always travel as `POST` requests, so the right way to isolate them is to combine the method filter with P13's IP as the source:

```
ip.src == 192.168.235.137 && http.request.method == "POST"
```

Only one packet survives the filter, a `POST /panel.php HTTP/1.1` request aimed the server. Two details are worth noticing at this point.

First, the destination lives on a completely different subnet than the chat partner, so this is internal traffic to a server rather than peer-to-peer messaging.

Second, the request carries a `Content-Type: multipart/form-data` header along with a sizeable `Content-Length` of over 100 KB, which is the HTTP pattern used whenever a browser ships a file inside a form submission.

The answer is therefore the destination of that POST.

#### Anwser

<spoiler>
192.168.1.7
</spoiler>

### Question 3

> What is the name of the file that was sent through the network?

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776569451/Writeups/Letsdefend/PcapAnalysis/6568d8d7-495b-41d5-8b9e-29c3f9ecce6b.png)

With the POST request already identified, the filename is just a few scrolls away. Right-clicking the packet and choosing **Follow → TCP Stream** reassembles the full HTTP conversation, including the multipart body. The relevant line reads:

```
Content-Disposition: form-data; name="XXX"; filename="XXX"
```

The `filename=` attribute is what the browser tells the server to record, and in this capture it is the very plain string with no extension, no path, nothing that looks like a real document title.

Below that header, the body itself is a wall of unreadable bytes rather than legible text. That visual mess is the first strong clue that the payload is encrypted or otherwise binary, it does not resemble any normal file format, and none of the usual magic bytes (`PDF`, `PK`, `MZ`, `GIF`, etc.) appear at the start.

The filename confirms what the content suggests: whoever prepared this upload stripped any identifying metadata down to the minimum.

#### Anwser

<spoiler>
file
</spoiler>

### Question 4

> What is the name of the web server where the file was uploaded?

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776569668/Writeups/Letsdefend/PcapAnalysis/f63a829f-f261-4abe-93da-f0fad8fedc66.png)

Identifying the server software is a matter of reading the HTTP response headers, which sit further down in the same TCP stream. After the boundary line that closes the multipart body, the server's reply begins with `HTTP/1.1 200 OK` and includes the following header:

```
Server: XYZ/2.4.54 (Win64) OpenSSL/1.1.1p PHP/8.0.25
```

That string is a small treasure trove on its own. It reveals the web server family along with the exact version, the operating system flavor it runs on (`Win64`), the bundled OpenSSL build, and even the PHP engine version.

Each of those components maps to its own list of published vulnerabilities, so a defender would pull this header into a spreadsheet, cross-reference the versions against CVE databases, and flag anything past its patch window.

Beneath the headers, the HTML body confirms the purpose of the page: a title of `My Corp. Panel` and a heading reading `Upload your files`, with a simple form containing one file input. This is a homebuilt internal upload endpoint, not a commercial product.

#### Anwser

<spoiler>
Apache
</spoiler>

### Question 5

> What directory was the file uploaded to?

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776569959/Writeups/Letsdefend/PcapAnalysis/5a07bb85-d3b4-4e60-aa5b-6fdc1f982187.png)

The endpoint handling the request (`/panel.php`) is not necessarily where the file ends up on disk. Upload handlers typically write somewhere else, and that destination is exactly what we need for any cleanup or forensics work.

Helpfully, the PHP script on the other end prints a confirmation line right above the rendered HTML page:

```
file uploaded at XYZ/file
```

That single line closes the loop on two questions at once: it confirms the filename from Q3 (`file`) and exposes the storage location, which is a relative path under the web root. Anything dropped through this form lands in that folder, which means a responder investigating the host would go straight to it to pull copies of whatever was submitted before it can be accessed or executed.

#### Anwser

<spoiler>
uploads
</spoiler>

### Question 6

> How long did it take the sender to send the encrypted file?

![](https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776570557/Writeups/Letsdefend/PcapAnalysis/3d758ae1-1728-4d66-b4f8-e5fddfe7b1c6.png)

We already know, from Q3, that the uploaded payload looked like random binary, consistent with an encrypted blob rather than a readable document. That single HTTP POST and its response form one TCP stream (in this capture, `tcp.stream eq 22`), and Wireshark can time it precisely without any manual math.

The trick is to keep the same display filter active and then open **Statistics → Conversations**. With the **"Limit to display filter"** checkbox ticked, Wireshark restricts the conversation table to the flows matching the current filter. Only one conversation remains, the full upload between `192.168.235.137` and `192.168.1.7`, and its **Duration**.

That is just few milliseconds. The value is strikingly low, and it tells you something real about the environment: the two hosts are sitting on the same LAN (or the same ESXi host, given the `VMware` OUI visible on the MAC addresses) with essentially zero network latency between them. Transferring roughly 108 KB of multipart data in that window is trivial for a gigabit link.

In other words, from the moment the first SYN left P13's machine until the server finished acknowledging the entire upload, **the encrypted file was on its way and confirmed delivered in few seconds**.

#### Anwser

<spoiler>
0.0073
</spoiler>