---
title: "Simple Program Analysis — An Introduction to x86 Assembly"
date: "2020-12-09"
excerpt: "Understanding x86 assembly patterns by debugging Hello World, addition, and calculator programs with GDB"
tags: ["reversing", "x86", "assembly", "gdb", "beginner"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

The compile options are as follows

gcc -m32 -fno-stack-protector -mpreferred-stack-boundary=2 -z execstack -fno-pie -o

![](/images/blog/simple-program-analysis/untitled.png)

This is the Hello World program. Since the structure is simple, let's debug this one first.

![](/images/blog/simple-program-analysis/untitled%201.png)

First, the function prologue saves ebp and stores esp into ebp.

Then the address 0x80484b0 is pushed as an argument to printf and the printf function is called. When there is only one argument, it appears to be replaced with the puts function.

After the function ends, the add instruction cleans up the stack, and the mov eax, 0x0 below appears to correspond to the return 0 in the C code above.

In the function epilogue

pop ebp

mov esp, ebp restores the SFP, and then the ret instruction terminates the function.

![](/images/blog/simple-program-analysis/untitled%202.png)

This is the addition program. Let's debug it as well.

![](/images/blog/simple-program-analysis/untitled%203.png)

After the function prologue, it allocates 0x8 of space and receives two variables.

It stores the value 0x5 at ebp-0x4 and 0xa (10) at ebp-0x8.

After storing the values, it copies them into two registers, then performs the addition with the add operation, storing the result in the first operand (usually eax).

It pushes the result value eax, then pushes ebp-0x8 and ebp-0x4, and finally pushes the string and calls the printf function.

When passing arguments to a function, the outer arguments are pushed first. Translating this into C, it becomes

printf("%d + %d = %d\n", ebp-0x4, ebp-0x8, eax), where eax is the result of the add operation as mentioned above.

After the function ends, the add instruction shrinks the stack by 0x10, the space that was used. Since there were 4 push instructions, it reduces the stack by 0x10 (16).

Then, after the function epilogue, the ret instruction ends the main function.

![](/images/blog/simple-program-analysis/untitled%204.png)

This is the last, the calculator program. Let's debug it.

![](/images/blog/simple-program-analysis/untitled%205.png)

It allocates 0xC (12) of space, pushes the addresses of 0x8, 0x9, 0x4 and a string, then executes the scanf function.

The reason it allocates 0xC is that on x86, pointers move in 4-byte units, so it allocates 0xC for efficient access.

After executing scanf, it cleans up 0x10 of space. This is because the string was also pushed at the end, so a total of 0x10 of space was used.

After that, it moves the values at 0x8 and 0x9 into their respective registers, moves what was stored in eax into edx, and then moves the value at 0x4 into eax again.

In the same way, it pushes the registers again and calls the calc function.

![](/images/blog/simple-program-analysis/untitled%206.png)

After the function prologue, it moves the value at ebp+0xc into eax.

I set a breakpoint at calc+6 and ran it.

![](/images/blog/simple-program-analysis/untitled%207.png)

![](/images/blog/simple-program-analysis/untitled%208.png)

The value 0x2b was stored at ebp+0xc. Converting this to ASCII gives the character '+'.

That value is stored in eax and it branches accordingly.

![](/images/blog/simple-program-analysis/untitled%209.png)

I reorganized this screenshot to make it easier to understand.

![](/images/blog/simple-program-analysis/untitled%2010.png)

Once the branching ends like this, each operation proceeds as follows.

![](/images/blog/simple-program-analysis/untitled%2011.png)

First, each variable is loaded into eax, and for the multiplication operation, the imul instruction is used.

0x8 holds 1 and 0x10 holds 2; the two are multiplied and the result is stored in eax.

For the division operation, the cdq instruction appears in between, which stands for Convert DoubleWord to QuadWord.

It is an instruction that sign-extends a doubleword to a quadword, i.e., from 32 bits to 64 bits. It appears to be used because the dividend needs to be extended to 64 bits before the division (idiv).

After each operation finishes, the used space is cleaned up, and then it jumps to calc+160, the end of the function, to terminate the function and return to the main function.

![](/images/blog/simple-program-analysis/untitled%2012.png)

After returning, it cleans up the space used for the 3 arguments and the main function terminates.
