---
title: "codeql xpdf"
date: "2023-11-04"
description: "CodeQL을 이용한 xpdf 데이터베이스 생성"
tags: ["codeql", "static-analysis", "xpdf", "vulnerability"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

```jsx
build git:(main) ✗ codeql database create xpdf --language=cpp -c "cmake -DCMAKE_BUILD_TYPE=Debug -DCMAKE_INSTALL_PREFIX=. .."
```
