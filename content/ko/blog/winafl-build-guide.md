---
title: "WinAFL Build"
date: "2022-03-29"
description: "Windows 환경에서 WinAFL과 DynamoRIO를 빌드하고 퍼징을 적용하는 방법"
tags: ["fuzzing", "winafl", "windows", "dynamorio", "afl"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

1. DynamoRIO Binary Download
2. WinAFL Download

```diff
cmake -G "Visual Studio 17 2022" .. -DDynamoRIO_DIR=절대경로\cmake -A x64
cmake --build . --config Release
```

```diff
ython C:\Users\moshe\Desktop\fuzz\winafl\winafl-cmin.py 
--working-dir C:\Users\moshe\Desktop\fuzz\winafl\build32\bin\Release -w 3 
-i C:\Users\moshe\Desktop\fuzz\samples 
-o C:\Users\moshe\Desktop\fuzz\irfanview_cmin -t 4000 
-D C:\Users\moshe\Desktop\fuzz\dynamorio\build\bin32 -covtype edge 
-target_module "i_view32.exe" -coverage_module "i_view32.exe" -target_offset 0x082550 -nargs 4
-- C:\Users\moshe\Desktop\fuzz\iview457\i_view32.exe @@ /convert="NUL" /silent
```
