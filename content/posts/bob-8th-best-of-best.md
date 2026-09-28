---
title: 'Best of the Best Cohort 8: Kernel Exploitation and a Filesystem Fuzzer'
date: 2019-07-01T00:00:00.000Z
excerpt: 'A retrospective on my time in Best of the Best (BoB) Cohort 8 — building a filesystem fuzzer, finding 16 CVEs, and speaking at CodeBlue and HITB'
tags:
  - bob
  - fuzzing
  - kernel
  - cve
  - filesystem
  - codeblue
  - hitb
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## The Road to BoB

When I first learned about Best of the Best (BoB), I was a sophomore with almost no security knowledge. At the time, the program felt like it was on a pedestal far above me. I knew I needed more preparation, so I decided to wait — I spent two years building my skills on my own before applying to Cohort 8 on the vulnerability analysis track.

My interest in security started simply. Back when the only thing I knew was C, I happened to come across a book, *Learning System Hacking Through Problem Solving on FTZ*. That single book became the starting point of my security study. Debuggers, assembly, all kinds of programming techniques — a flood of things I was seeing for the first time, and things I had to relearn. That was also when I first realized that reverse engineering goes hand in hand with system hacking. I remember arriving at the study room at 9 a.m. and solving problems until midnight, taking only an hour off to eat. The thrill of the moment I popped a shell is still vivid.

## Why the Vulnerability Analysis Track

I had a clear reason for applying to BoB's vulnerability analysis track. At first I was interested in incident response and forensics, but I had to admit my fundamentals weren't strong enough yet. I also considered consulting, but I worried the cycle of dispatch-then-penetration-test would eventually get repetitive and boring.

There was a more important realization behind my choice: strong vulnerability analysis skills are foundational no matter which security career path you take. I saw CTF (Capture The Flag) competitions as a measure of skill, and I noticed that people who were good at CTF tended to be strong in both analysis and development. Competitive CTF and real-world vulnerability research build the same underlying capabilities from different angles.

The BoB community itself was also part of the draw. Finding mentors or peers at university wasn't easy, but BoB had researchers who were far ahead of me. I wanted to learn, work, and grow alongside them.

## My Study Plan

I focused on two main directions during BoB.

**Primary focus: vulnerability analysis — firmware and embedded devices**

My plan was to start with small devices (routers) and gradually move to bigger targets (TVs, refrigerators). Router vulnerabilities were fascinating to me at first. What began as diving headfirst into bug hunting turned into the field I now want to dig into the deepest.

**Secondary focus: SDR and RF security**

Software-Defined Radio (SDR) was an area where I didn't even know how to detect, capture, or analyze signals. One of my goals was to get advice from mentors and actually demonstrate an RF replay attack myself. I ended up buying equipment somewhat impulsively — and went through plenty of trial and error, including antenna performance that wasn't good enough to properly pick up signals.

I also set myself one rule: **never sacrifice sleep.** The body has to hold up for the mind to function. I watched talented researchers burn out and leave, and I learned that sustainable learning depends on physical and mental health.

## Technical Journey

### System Hacking and Binary Exploitation

Solving CTF challenges grew my reverse engineering skills alongside everything else. Understanding ROP (Return-Oriented Programming) in particular took a long time, because environments using networking functions like `recv` and `send` were far more complex than a simple `strcpy` stack overflow. I still can't forget the sense of achievement the first time I successfully ran a ROP chain.

### IoT Security and Firmware Analysis

This is the field I've been most absorbed in most recently. It started with firmware extraction and analysis and grew into hardware-level attacks. ARM and MIPS architectures felt unfamiliar at first, since their argument-passing conventions and instruction sets differ from x86. I gradually built confidence by writing assembly by hand and reproducing classic techniques (buffer overflows, ret-to-libc) in embedded environments.

I built up hardware knowledge through an IoT training program run by KISA, and that's where I first learned about SDR. Afterward, I built an OTP-based smart door lock with RF signal analysis capabilities of its own. Unlike conventional door locks, it was a research project that emitted both the door-open signal and the OTP signal together, making RF signal analysis harder.

Even while serving as a social service agent, I never stopped studying. With help from Seokhoon Hwang, founder of Tiger Team, I wrote a **System Hacking Guidelines** document. When I presented it at H4C Team's hacking camp, the response was much better than I expected. It was rewarding to know that something I had put together myself contributed to other people's learning.

## Major Research Outcome: A Filesystem Fuzzer and 16 CVEs

The core outcome of my research during and after BoB was building a **filesystem fuzzer targeting kernel subsystems**. Through systematic fuzzing and analysis, I discovered **16 CVEs** across various kernel components, contributing to the security of widely used systems.

This research was shared through talks at major international security conferences:

- **CodeBlue**: Japan's top-tier security conference. I shared techniques and findings with researchers from across Asia
- **HITB (Hack In The Box)**: one of the largest hacking conferences in Asia
- **National Security Research Institute (NSRI)**: a government-run security research institute

Each talk was practice in refining how I communicate complex technical work. I had to defend my methodology and take feedback from world-class researchers.

## Why This Experience Matters

The BoB experience firmly cemented my path toward offensive vulnerability research. The program gave me three things: mentors who had already walked the path, peers who challenged my thinking, and a structured environment to test hypotheses.

More importantly, it proved that security research is a calling, not just a job. The filesystem fuzzer project is a good example. Finding vulnerabilities wasn't the only goal. Understanding **why** those bugs exist, **how** they can be exploited, and **how** to communicate the findings effectively became part of my identity as a researcher.

As I continue offensive security research, the lessons I learned at BoB still remain central: **build a strong foundation, work alongside people better than you, and keep learning.**
