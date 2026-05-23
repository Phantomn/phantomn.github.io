---
title: "Best of the Best 8th: Kernel Exploit with File System Fuzzer"
date: 2019-07-01
description: "Retrospective on BoB (Best of the Best) 8th generation — building a file system fuzzer, discovering 16 CVEs, and presenting at CodeBlue and HITB"
tags: ["BoB", "fuzzing", "kernel", "CVE", "filesystem", "CodeBlue", "HITB"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## The Road to BoB

When I first heard about Best of the Best (BoB), I was a sophomore in university with minimal security knowledge. The program seemed out of reach at the time—I knew I needed more preparation. So I waited, studied independently for two years, and finally applied to the 8th generation with a clear focus on vulnerability research.

My journey to BoB wasn't linear. After leaving school to pursue security full-time, I attended ITBANK training and explored various domains: system hacking, reverse engineering, and network security. I earned certifications like CCNA and LPIC, but it was self-study with the FTZ (Fake The Zone) book that truly ignited my passion. I worked as a social service worker during mandatory military service, which actually helped me develop discipline—studying with a structured schedule transformed my learning pace compared to self-study at home.

Around that time, I became a session moderator for CodeGate, a prestigious security conference in Korea. That experience broke my shyness and showed me the depth and breadth of the security community. It was humbling to realize how much more there was to learn.

## Why Vulnerability Analysis?

I applied to BoB's vulnerability analysis track for a specific reason. While I was initially fascinated by incident response and forensics, I realized my fundamentals weren't strong enough to pursue those areas effectively. I also considered consulting as a career, but learned that the consultant lifecycle—dispatch, hacking, penetration testing—felt repetitive. More importantly, I discovered that excellent vulnerability analysis skills are foundational to any serious security career.

I believe CTF (Capture The Flag) competitions are a key metric for skill development. People who excel at CTF tend to be strong at analysis and development alike. Both competitive CTF and real-world vulnerability research matter equally—they build the same foundational capabilities from different angles.

The BoB community also drew me in. Unlike university, where finding mentors and collaborators is difficult, BoB offered access to researchers far ahead of me. I wanted to learn from them, work alongside them, and grow as part of a cohesive security research community.

## The Learning Plan

During BoB's intensive two-month program, I committed to several goals:

**Primary focus:** Vulnerability analysis through firmware and embedded device research. I planned to start with small devices like routers, then graduate to larger targets like televisions and smart appliances.

**Secondary focus:** Software-Defined Radio (SDR) and RF security. I wanted to understand signal detection, collection, and analysis—eventually reproducing RF-based attacks similar to those demonstrated by mentors on vehicles and key fobs.

**Broader learning:** Attending lectures across other tracks (forensics, development) to build a complete security foundation.

The one non-negotiable rule I set for myself: maintain sleep and basic health. I'd seen talented researchers burn out, and I knew that sustainable learning required taking care of my body and mind.

## The Biggest Achievement: People and Knowledge

Looking back, my greatest achievement during BoB wasn't a tool or a specific exploit—it was the network of researchers, mentors, and peers I connected with. Attending seminars, conferences, and special lectures, I met students, company representatives, and researchers all passionate about security. These relationships shaped my understanding of which areas interested me most and pushed me to study harder.

One concrete accomplishment was authoring a **System Hacking Guidelines** document during my military service, with guidance from Tiger Team's founder, Seok-hun Hwang. When H4C Team held their hacking camp, I presented material from that document, and the response was overwhelming. Seeing others learn from work I'd compiled was deeply rewarding.

## Deep Dives into System Hacking

Throughout my time in BoB and surrounding years, I studied multiple domains: web crawling, fuzzing, reverse engineering, binary exploitation, and IoT security. But three areas consumed most of my focus:

**Reverse Engineering and Binary Exploitation:** These naturally intertwine. As I solved CTF challenges, I strengthened my reverse engineering skills. Studying ROP (Return-Oriented Programming) took months of effort—especially when dealing with networking functions like `recv` and `send` that add complexity beyond simple `strcpy` overflows. The moment I successfully executed my first ROP chain was exhilarating.

**IoT Security and Firmware Analysis:** This was my most recent passion. I started with firmware extraction and analysis, then moved to hardware-level attacks. ARM and MIPS architectures were initially foreign to me—argument passing conventions and instruction sets differed significantly from x86. But by studying assembly by hand and reproducing classic techniques (BOF, RET-to-libc) on embedded systems, I gradually built confidence.

I also explored SDR (Software-Defined Radio), purchasing equipment to study RF signals. In a KISA-sponsored IoT training program, I gained hands-on hardware knowledge. Later, I built an OTP-based smart door lock with RF signal analysis capabilities—a research project that merged my interests in cryptography and signal analysis.

## Vulnerability Discovery and Public Contribution

The culmination of my BoB journey and subsequent research involved building a **file system fuzzer targeting kernel subsystems**. Through systematic fuzzing and analysis, I discovered **16 CVEs** in various kernel components, contributing to the security of widely-used systems.

This work reached the security research community through presentations at major international conferences:

- **CodeBlue:** Japan's premier security conference, where I shared techniques and findings with researchers from across Asia
- **HITB (Hack In The Box):** One of Asia's largest hacking conferences
- **National Security Research Institute (NSRI):** Korea's government-backed security research organization

Each presentation refined how I communicated complex technical work, forced me to defend my methodology, and exposed me to feedback from world-class security researchers.

## Why This Matters

My BoB experience solidified my path toward offensive vulnerability research. The program gave me access to mentors who had solved these problems before, peers who challenged my thinking, and a structured environment to test my hypotheses. More importantly, it showed me that security research isn't a job—it's a calling that I can sustain long-term because I genuinely enjoy the problem-solving.

The file system fuzzer project exemplified this: discovering vulnerabilities wasn't the only goal; understanding *why* those bugs exist, *how* they could be exploited, and *how* to communicate findings effectively became integral to my identity as a researcher.

As I continue my career in offensive security research, the lessons from BoB remain central: build strong fundamentals, surround yourself with people smarter than you, and never stop learning.
