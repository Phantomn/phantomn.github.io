---
title: 'Suninatas Wargame Writeup'
date: 2023-08-27T00:00:00.000Z
excerpt: >-
  A collection of Suninatas wargame writeups covering Forensics 14, 15, 18,
  and Simple Login.
tags:
  - wargame
  - writeup
  - redteam
  - suninatas
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Suninatas Forensics 14

![](/images/writeups/suninatas-challenges/forensics14-untitled.png)

Downloading the file gives an evidence.tar file, and extracting it produces passwd and shadow files.

![](/images/writeups/suninatas-challenges/forensics14-untitled%201.png)

This clearly looks like a password-cracking challenge, so I ran john the ripper.

Let's take a look at the passwd and shadow files first.

![](/images/writeups/suninatas-challenges/forensics14-untitled%202.png)

Looking at the passwd contents, the fields are separated by ":", explained as follows:

suninatas:x:1001:1001::/home/suninatas:/bin/sh

Field 1: username

Field 2: password (encrypted, stored in /etc/shadow)

Field 3: user account uid

Field 4: user account gid

Field 5: user account name (info)

Field 6: user account home directory

Field 7: user account login shell

Source: [https://webdir.tistory.com/129](https://webdir.tistory.com/129) [WEBDIR]

The password is encrypted and stored in the shadow file, so let's look at that too.

![](/images/writeups/suninatas-challenges/forensics14-untitled%203.png)

suninatas:$6$QlRlqGhj$BZoS9PuMMRHZZXz1Gde99W01u3kD9nP/zYtl8O2dsshdnwsJT/1lZXsLar8asQZpqTAioiey4rKVpsLm/bqrX/:15427:0:99999:7:::

Field 1: username

Field 2: password

Field 3: date of last password change

Field 4: minimum password age

Field 5: maximum password age

Field 6: password expiration warning period

Field 7: password inactivity period (days after expiration before the account is disabled)

Field 8: account expiration date

Field 9: reserved field

Source: [https://webdir.tistory.com/129](https://webdir.tistory.com/129) [WEBDIR]

We can see the password is encrypted.

The `$6$` prefix means SHA-512 was used for encryption. The number between the `$` signs varies by encryption algorithm.

Running john the ripper on these two files extracts the password.

![](/images/writeups/suninatas-challenges/forensics14-untitled%204.png)

---

## Suninatas Forensics 15

![](/images/writeups/suninatas-challenges/forensics15-untitled.png)

Clicking the link below lets you download an mp3 file.

At first I assumed a file was hidden inside the mp3 via steganography, but that was jumping ahead without doing the basic analysis first.

Just checking the file properties revealed the flag right away.

---

## Suninatas Forensics 18

![](/images/writeups/suninatas-challenges/forensics18-untitled.png)

An encryption challenge. Since the numbers don't exceed 127, it looks like ASCII values, and since there's no A-F, it looks like base 10.

It seems like printing the ASCII values as characters should solve it.

![](/images/writeups/suninatas-challenges/forensics18-untitled%201.png)

I wrote a simple script and printed the output, and got some text -- but it looked like it was still encrypted somehow.

![](/images/writeups/suninatas-challenges/forensics18-untitled%202.png)

Let me try decoding the text with every scheme I can think of.

![](/images/writeups/suninatas-challenges/forensics18-untitled%203.png)

Running it through base64 revealed the flag!!

---

## Simple Login

![](/images/writeups/suninatas-challenges/simple-login-untitled.png)

It's a 32-bit binary, and supposedly has a canary and NX. But IDA doesn't detect a canary.

![](/images/writeups/suninatas-challenges/simple-login-untitled%201.png)

There doesn't seem to be a canary. Whether IDA just failed to detect it or it's actually missing needs more checking.

Looking at the source, first v6 is zero-initialized for 30 bytes.

Then 30 bytes of input are read into v6.

input is a global variable, it seems, and it's zero-initialized for 12 bytes.

If the length of v6 after base64-decoding is greater than 12 bytes, the program exits; otherwise it's copied into input, auth is run, and if the return value is 1, correct is executed and the program ends.

So... let's analyze the auth and correct functions.

![](/images/writeups/suninatas-challenges/simple-login-untitled%202.png)

In main, the v7 variable is passed in as an argument, which is the length after base64 decoding. So a1 is 12.

In the auth function, input is copied into v4, and if the calc_md5 result matches the hash f87cd601aa7fedca99018a8be88eda34, it returns correct.

![](/images/writeups/suninatas-challenges/simple-login-untitled%203.png)

In the correct function, if input is 0xdeadbeef, you get a shell.

Summary:

1. The 30-byte input, after base64 decoding, must be 12 bytes long, and its MD5 hash must match f87cd601aa7fedca99018a8be88eda34.
2. The input value must be 0xdeadbeef.

Alright, let's get started.

---

At first I approached this wrong -- this challenge requires 0xdeadbeef to end up in input.

And since the function needs the base64-decoded value to be deadbeef, that means the encoded value has to go in.

Since the input variable is 12 bytes, I base64-encode `AAAABBBBCCCC` and enter that value.

![](/images/writeups/suninatas-challenges/simple-login-untitled%204.png)

![](/images/writeups/suninatas-challenges/simple-login-untitled%205.png)

![](/images/writeups/suninatas-challenges/simple-login-untitled%206.png)

ebp got corrupted with CCCC. That's CCCC after decoding. Adjusting the third part lets me control ebp through the function epilogue. If that's the case,

what if I put an address value in the second part -- then the corrupted value would load into ebp at leave, and the ret instruction would let me jump wherever I want?

Wherever I want would be the correct function. Corruption happens in auth, and all I need is for correct to run.

![](/images/writeups/suninatas-challenges/simple-login-untitled%207.png)

Now it seems I just need to know the address where the correct address is placed.

But this variable is the input variable, so I just need to add +4 to it.

![](/images/writeups/suninatas-challenges/simple-login-untitled%208.png)

![](/images/writeups/suninatas-challenges/simple-login-untitled%209.png)

An error occurs. The reason is that the leave instruction moves ebp into esp and then adds 4.

So if I put in 40, the original address of input, the exploit works.

![](/images/writeups/suninatas-challenges/simple-login-untitled%2010.png)
