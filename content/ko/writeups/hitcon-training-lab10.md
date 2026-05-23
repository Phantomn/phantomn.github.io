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

# HackNote

## Source

```c
➜  lab10 git:(master) ✗ file hacknote
hacknote: ELF 32-bit LSB executable, Intel 80386, version 1 (SYSV), dynamically linked, interpreter /glibc/2.23/32/lib/ld-2.23.so, for GNU/Linux 2.6.32, BuildID[sha1]=b7cd347eef976fbccc3014a5a14c5a739e514d09, not stripped
➜  lab10 git:(master) ✗ checksec --file hacknote
[*] '/root/HITCON-Training/LAB/lab10/hacknote'
    Arch:     i386-32-little
    RELRO:    Partial RELRO
    Stack:    Canary found
    NX:       NX enabled
    PIE:      No PIE (0x8047000)
```

add_note 함수는 notelist 배열에 note 구조체의 사이즈 만큼 malloc 할 수 있으며, 사이즈를 입력 받아 content를 malloc한다.

그 후 read함수로 content에 size만큼 데이터를 읽고 카운트를 증가시킨다.

```c
void add_note(){
	int i ;
	char buf[8];
	int size ;
	if(count > 5){
		puts("Full");
		return ;
	}
	for(i = 0 ; i < 5 ; i ++){
		if(!notelist[i]){
			notelist[i] = (struct note*)malloc(sizeof(struct note));
			if(!notelist[i]){
				puts("Alloca Error");
				exit(-1);
			}
			notelist[i]->printnote = print_note_content;
			printf("Note size :");
			read(0,buf,8);
			size = atoi(buf);
			notelist[i]->content = (char *)malloc(size);
			if(!notelist[i]->content){
				puts("Alloca Error");
				exit(-1);
			}
			printf("Content :");
			read(0,notelist[i]->content,size);
			puts("Success !");
			count++;
			break;
		}
	}
}
```

del_note는 count 이하의 인덱스를 입력 받아 content와 note 구조체를 free한다.

```c
void del_note(){
	char buf[4];
	int idx ;
	printf("Index :");
	read(0,buf,4);
	idx = atoi(buf);
	if(idx < 0 || idx >= count){
		puts("Out of bound!");
		_exit(0);
	}
	if(notelist[idx]){
		free(notelist[idx]->content);
		free(notelist[idx]);
		puts("Success");
	}
}
```

print_note 함수는 count 이하의 인덱스를 입력 받아 printnote함수로 note 구조체를 출력시킨다.

```c
void print_note(){
	char buf[4];
	int idx ;
	printf("Index :");
	read(0,buf,4);
	idx = atoi(buf);
	if(idx < 0 || idx >= count){
		puts("Out of bound!");
		_exit(0);
	}
	if(notelist[idx]){
		notelist[idx]->printnote(notelist[idx]);
	}
}
```

## Solve

해당 함수를 통해 `magic` 함수를 실행시켜 flag를 출력시켜야 한다.

![Untitled](/images/writeups/hitcon-training-lab10/Untitled.png)
