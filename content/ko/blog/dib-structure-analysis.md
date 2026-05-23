---
title: "DIB Structure 분석"
date: "2022-02-26"
description: "Windows DIB(Device Independent Bitmap) 파일 구조 분석 — BITMAPFILEHEADER, BITMAPINFOHEADER 필드 정리"
tags: ["windows", "binary", "reversing", "bitmap"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

DIB(Device Independent Bitmap) 파일 포맷을 구성하는 구조체를 분석한다.

## 샘플 헥스 덤프

```
42 4D F6 C6 2D 00 00 00 00 00 36 00 00 00 28 00
00 00 E8 03 00 00 E8 03 00 00 01 00 18 00 00 00
00 00 C0 C6 2D 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F
...
```

## BITMAPFILEHEADER

```c
typedef struct tagBITMAPFILEHEADER
{
   WORD   bfType;
   DWORD  bfsize;
   WORD   bfReserved1;
   WORD   bfReserved2;
   DWORD  bfOffBits;
} BITMAPFILEHEADER;
```

**bfType**

Bitmap 파일의 형식이 기록되는 부분이다. 비트맵 파일은 반드시 `bfType` 값이 `BM`(0x42, 0x4D)이어야 한다.

**bfSize**

비트맵 파일의 크기를 바이트 단위로 나타낸다.

**bfReserved1 / bfReserved2**

항상 0으로 설정한다. 현재 사용되지 않는 예약 필드다.

**bfOffBits**

`BITMAPFILEHEADER`, `BITMAPINFOHEADER`, `RGBQUAD` 세 구조체 크기의 합으로, 실제 이미지 비트의 오프셋을 의미한다.

`BITMAPFILEHEADER`는 비트맵 이미지 자체보다 파일에 대한 정보를 담는다. 따라서 비트맵 파일을 DIB 형식으로 저장할 때만 사용되고, 화면에 출력할 때는 쓰이지 않는다.

## BITMAPINFOHEADER

```c
typedef struct tagBITMAPINFOHEADER
{
   DWORD biSize;
   LONG  biWidth;
   LONG  biHeight;
   WORD  biPlanes;
   WORD  biBitCount;
   DWORD biCompression;
   DWORD biSizeImage;
   LONG  biXPelsPerMeter;
   LONG  biYPelsPerMeter;
   DWORD biClrUsed;
   DWORD biClrImportant;
} BITMAPINFOHEADER;
```

| 필드 | 설명 |
|------|------|
| `biSize` | 구조체 자체의 크기 |
| `biWidth` | 비트맵 가로 픽셀 수 |
| `biHeight` | 비트맵 세로 픽셀 수. 양수면 바텀업, 음수면 탑다운 방식 |
| `biPlanes` | 플래인 개수. 반드시 1로 고정 |
| `biBitCount` | 픽셀 당 비트 수. 1=흑백, 4=16색, 8=256색 |
| `biCompression` | 압축 방식. `BI_RGB`=비압축, `BI_RLE8`=8비트 압축 |
| `biSizeImage` | 이미지 크기(바이트). `BI_RGB`일 때 0 허용 |
| `biXPelsPerMeter` | 가로 해상도(pixels per meter) |
| `biYPelsPerMeter` | 세로 해상도(pixels per meter) |
| `biClrUsed` | 사용된 색상 수. 0이면 모든 색상 사용 |
| `biClrImportant` | 출력에 필수적인 색상 수. 0이면 모든 색상 필수 |
