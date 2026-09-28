---
title: 'Kongju National University Gifted Center pwnable2 Writeup'
date: 2023-08-27T00:00:00.000Z
excerpt: >-
  Kongju National University Gifted Center pwnable2 challenge — patching a Sleep NOP to print the flag instantly.
tags:
  - ctf
  - writeup
  - pwn
  - konjuuni
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

![](/images/writeups/konjuuni-gifted-pwnable2/untitled.png)

It says to wait 12 hours.

![](/images/writeups/konjuuni-gifted-pwnable2/untitled%201.png)

Checking the file info, it's a 32-bit ELF binary with NX enabled.

Looking at the file in a debugger:

![](/images/writeups/konjuuni-gifted-pwnable2/untitled%202.png)

There's a Sleep call with argument 0x67d, which is 1661 in decimal. That's a long time to wait... The ASCII visible above looked like it might be the flag, but it wasn't.

![](/images/writeups/konjuuni-gifted-pwnable2/untitled%203.png)

A simple decode is also possible, but overwriting it with 0x90 in the debugger

lets it print the flag without waiting.
