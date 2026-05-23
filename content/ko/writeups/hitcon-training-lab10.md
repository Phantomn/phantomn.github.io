---
title: "HITCON Training LAB10 — HackNote Use-After-Free"
date: "2023-08-27"
description: "HITCON Training LAB10 HackNote 풀이 — Heap Use-After-Free를 이용한 magic 함수 실행"
tags: ["pwn", "heap", "uaf", "use-after-free", "linux"]
platform: "ctf"
category: "redteam"
difficulty: "Medium"
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

## 바이너리 정보

```
hacknote: ELF 32-bit LSB executable, Intel 80386
Arch:  i386-32-little
RELRO: Partial RELRO
Stack: Canary found
NX:    NX enabled
PIE:   No PIE (0x8047000)
```

## 소스 분析

### add_note

`notelist` 배열에 `note` 구조체 크기만큼 `malloc`하고, 사이즈를 입력받아 `content`를 `malloc`한다. `read`로 `content`에 데이터를 기록하고 카운트를 증가시킨다.

```c
void add_note() {
    int i;
    char buf[8];
    int size;
    if (count > 5) { puts("Full"); return; }
    for (i = 0; i < 5; i++) {
        if (!notelist[i]) {
            notelist[i] = (struct note*)malloc(sizeof(struct note));
            notelist[i]->printnote = print_note_content;
            printf("Note size :");
            read(0, buf, 8);
            size = atoi(buf);
            notelist[i]->content = (char*)malloc(size);
            printf("Content :");
            read(0, notelist[i]->content, size);
            puts("Success !");
            count++;
            break;
        }
    }
}
```

### del_note

인덱스를 입력받아 `content`와 `note` 구조체를 `free`한다. **dangling pointer를 제거하지 않는다.**

```c
void del_note() {
    char buf[4];
    int idx;
    printf("Index :");
    read(0, buf, 4);
    idx = atoi(buf);
    if (idx < 0 || idx >= count) { puts("Out of bound!"); _exit(0); }
    if (notelist[idx]) {
        free(notelist[idx]->content);
        free(notelist[idx]);
        puts("Success");
    }
}
```

### print_note

인덱스를 입력받아 `notelist[idx]->printnote(notelist[idx])`를 호출한다.

```c
void print_note() {
    char buf[4];
    int idx;
    printf("Index :");
    read(0, buf, 4);
    idx = atoi(buf);
    if (notelist[idx]) {
        notelist[idx]->printnote(notelist[idx]);
    }
}
```

## 취약점 — Use-After-Free

`del_note` 후 `notelist[idx]` 포인터가 NULL로 초기화되지 않는다. 이후 `add_note`로 동일 크기의 chunk를 할당하면 해제된 note 구조체 위치에 새 content가 위치할 수 있다.

`note` 구조체의 첫 8바이트는 `printnote` 함수 포인터다. UAF를 이용해 이 포인터를 `magic` 함수 주소로 덮어쓰면 `print_note` 호출 시 `magic`이 실행된다.

## Solve

![exploit 흐름](/images/writeups/hitcon-training-lab10/Untitled.png)

해당 `printnote` 함수 포인터를 `magic` 함수 주소로 덮어써서 flag를 출력한다.
