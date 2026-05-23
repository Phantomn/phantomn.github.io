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

```c
42 4D F6 C6 2D 00 00 00 00 00 36 00 00 00 28 00 
00 00 E8 03 00 00 E8 03 00 00 01 00 18 00 00 00 
00 00 C0 C6 2D 00 00 00 00 00 00 00 00 00 00 00 
00 00 00 00 00 00 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 
7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 
7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 
7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F 7F
```

### BITMAPFILEHEADER

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

Bitmap 파일의 형식이 기록되는 부분입니다.비트맵 파일은 반드시 bfType의 값이 BM(0x42, 0x4d)이어야 합니다.

**bfSize**

비트맵 파일의 크기를 바이트 단위로 나타냅니다.

**bfReserved1**

항상 0으로 설정해주면 됩니다. 현재 사용되지 않는 비트입니다.

**bfReserved2**

마찬가지로 0으로 설정해주시면 됩니다.

**bfOffBits**

이 값은 BITMAPFILEHEADER, BITMAPINFOHEADER, RGBQUAD 3개 구조체의 크기를 더한 값으로 실제 이미지 비트의 OffSet을 의미합니다.

BITMAPFILEHEADER은 구조체명에서도 알수 있듯이, 비트맵 이미지 그 자체에 대한 정보보다는, 비트맵 파일에 대한 정보를 주로 가지고 있습니다. 따라서 비트맵 파일을 DIB 형식으로 저장할 때에만 쓰이고, 화면에 출력할때에는 쓰이지 않는 구조체입니다.

### **BITMAPINFOHEADER**

```c
typedef struct tagBITMAPINFOHEADER
{
   DWORD biSize;
   LONG biWidth;
   LONG biHeight;
   WORD biPlanes;
   WORD biBitCount;
   DWORD biCompression;
   DWORD biSizeImage;
   LONG biXPelsPerMeter;
   LONG biYPelsPerMeter;
   DWORD biClrUsed;
   DWORD biClrImportant;
} BITMAPINFOHEADER;
```

**biSize**

이 구조체의 크기를 나타냅니다.

**biWidth**

비트맵의 가로 픽셀수.

**biHeight**

비트맵의 세로 픽셀수.이 값이 양수이면, 바텀업 방식이라고 하며, 출력시, 아래쪽 부터 출력을 해야 합니다.또 이 값이 음수이면, 탑다운 방식이라고 하며, 출력시, 위쪽부터 차례로 출력 합니다.

**biPlanes**

비트맵의 플래인 개수를 나타내는데 이 값은 반드시 1로 고정되어야 합니다.

**biBitCount**

한 픽셀이 몇개의 비트로 이루어지는가를 나타내며 이 값에 따라 픽샐이 가질수 있는 색상수가 결정됩니다.1이면 흑백, 4이면 16색, 8이면 256색... 과 같이, 2의 제곱승으로 계산됩니다.

**biCompression**

압축 방식을 나타내는데요. 반드시 바텀업 방식일때만 압축이 가능하며,이 값이 BI_RGB이면 압축되지 않았다는 것을 의미하고,BI_RLE8이면 8비트 압축, BI_RLE4이면 4비트 압축으로 압축되어 있는 것입니다.

**biSizeImage**

이미지의 크기를 바이트 단위로 나타내며 BI_RGB(압축이 안된 상태) 비트맵에서의 이 값은 0입니다.

**biXPelsPerMeter**

가로 해상도를 의미합니다.

**biYPelsPerMeter**

세로 해상도를 의미합니다.

**biClrUsed**

비트맵에 사용된 색상수를 의미하며, 이값에 따라 RGBQUAD의 배열을 메모리 할당하여서 읽어오시면 됩니다.이 값이 0이면 모든 색깔을 다 사용한다는 의미입니다.

**biClrImportant**

비트맵을 출력하는데 필수적인 색상수를 나타내며, 이 값이 0이면 모든 색상을 다 사용한다는 의미입니다.
