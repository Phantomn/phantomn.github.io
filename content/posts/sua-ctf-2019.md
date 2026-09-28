---
title: 'SUA CTF 2019 Writeup'
date: 2019-10-01T00:00:00.000Z
excerpt: >-
  Writeups for SUA CTF 2019 challenges in the pwn and reversing categories.
tags:
  - ctf
  - writeup
  - pwn
  - sua-ctf-2019
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

I'm skipping the 1-point challenges (warm-up level, very low difficulty) and only recording the rest.

## Welcome (100 pts)

### Overview

A MISC challenge. You need to find the flag by browsing the SUA cafe (the club's community site), with hints pointing to the "board members intro" page and telling you to "find the youngest member".

### Solution

I went through the board members intro page and checked posts from the president and several others. The ones that weren't it, I skipped.

At the very bottom of one member's introduction post, I found `0_5u4}`. At first I tried entering `SUA{0_5u4}`, which was wrong -- turns out the flag didn't start with `{`.

Since there was still a piece missing, I went through every single post, and found another fragment in Handong's post:

```
Flag{h311
```

This was the front half of the flag. Combining the two:

```
Flag{h3110_5u4}
```

**Flag:** `sua{h3110_5u4}`

---

## Enc_msg (100 pts)

### Overview

A crypto challenge. The server hosting this challenge is currently down, so I'm only recording the solution method.

### Solution

I actually solved this using a hint from Crypto_3. Crypto_3's hint was **Caesar cipher**, so I just googled Caesar cipher code right away.

We're given an encrypted file (`Encrypted.txt`) along with four plaintext reference files (`text1` through `text4`).

I wrote a Python script to try every shift value from 1 to 26:

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

The for loop tries every shift value from 1 to 26 to decrypt the ciphertext, and **shift 22** produced readable English text that matched the reference texts.

**Flag:** `sua{SUA CTF Encryption}`

---

## TAXI (300 pts)

### Overview

A reversing challenge. Entering 4 characters into the binary should produce the output `TAXI`.

### Solution

Hints:
- **brute force**
- **4 letter**

As soon as these two hints appeared, since I lacked the dev knowledge, I brute-forced it by hand. I systematically tried 4-character combinations to find an input that produced `TAXI` as output.

The intended solution is to write a script that iterates over every 4-byte combination of printable ASCII characters and checks the output. The binary's transformation function maps input to a 4-character output using a fixed algorithm.

Both the answer I found myself (marked in red) and the intended answer (marked in yellow) produced the same `TAXI` output -- a collision caused by how the transformation function behaves, and an unintended bug in the challenge design. So both answers were accepted for points.

> Note: since both answers matched the expected output, both were accepted during grading. This shows the challenge had more than one valid input.
