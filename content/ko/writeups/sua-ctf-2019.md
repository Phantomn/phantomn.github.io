---
title: "SUA CTF 2019 Writeup"
date: 2019-10-01
description: "SUA CTF 2019 challenge solutions covering pwn and reversing categories"
tags: ["SUA", "CTF", "pwn", "reversing"]
platform: "ctf"
category: "pwn"
difficulty: "medium"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Welcome (100 pts)

### Overview

A MISC challenge. The hint pointed to the SUA club community page and asked participants to find the "youngest member."

### Solution

Browsing the member introduction posts on the SUA community (cafe), scrolling to the bottom of the youngest member's post revealed the string `0_5u4}`. Another member (한동) had a post containing `Flag{h311` — the beginning of the flag.

Combining both fragments:

```
Flag{h311  +  0_5u4}  =  Flag{h3110_5u4}
```

**Flag:** `sua{h3110_5u4}`

---

## Enc_msg (100 pts)

### Overview

A cryptography challenge. The server providing the original problem files was offline at the time of writing, so only the solution method is documented here.

### Solution

The hint for a separate `Crypto_3` challenge mentioned Caesar cipher, which provided the key insight. The encrypted file (`Encrypted.txt`) was accompanied by four plaintext reference files (`text1` through `text4`).

A Python brute-force script tried all 26 possible rotation values:

```python
def caesar_decrypt(ciphertext, shift):
    result = ""
    for char in ciphertext:
        if char.isalpha():
            base = ord('A') if char.isupper() else ord('a')
            result += chr((ord(char) - base - shift) % 26 + base)
        else:
            result += char
    return result

with open("Encrypted.txt") as f:
    ciphertext = f.read()

for shift in range(1, 27):
    print(f"Shift {shift}: {caesar_decrypt(ciphertext, shift)}")
```

Running the loop, shift value `22` produced a readable English sentence matching the reference texts.

**Flag:** `sua{SUA CTF Encryption}`

---

## TAXI (300 pts)

### Overview

A reversing challenge. The binary accepts a 4-letter input and must produce the output string `TAXI`.

### Solution

The hints were:
- **brute force**
- **4 letter**

Without scripting experience at the time, a manual brute-force approach was used: systematically trying 4-character combinations until one produced `TAXI` as output.

The intended solution was to write a script that iterates over all combinations of printable ASCII characters for a 4-byte input and checks the output. The binary's transformation function maps the input through a fixed algorithm to produce the 4-character output.

The manually discovered answer and the "official" intended answer both produced the same `TAXI` output — a collision due to the way the transformation function worked, which was acknowledged as an unintended bug in the challenge design.

> Note: Both answers were accepted since the output matched, demonstrating that the challenge had multiple valid inputs.
