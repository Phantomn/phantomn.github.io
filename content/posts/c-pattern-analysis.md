---
title: "Simple C Pattern Analysis — if/for/while/do-while in Assembly"
date: "2020-12-09"
excerpt: "Analyzing how C control structures (if-else, for, while, do-while) compile down to x86 assembly"
tags: ["reversing", "x86", "assembly", "c", "pattern", "beginner"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

I wanted to write up an analysis of some simple reversing patterns.

I'll skip over things like scanf and printf for now.

The compile options used are as follows.

gcc -m32 -fno-stack-protector -mpreferred-stack-boundary=2 -z execstack -fno-pie -o

## if / else if / else

![](/images/blog/c-pattern-analysis/untitled.png)

I kept it simple and just handled three cases: if, else-if, else.

![](/images/blog/c-pattern-analysis/untitled%201.png)

After the function prologue, it reads one input with scanf. Then it moves the data at ebp-0x4 into eax and begins the branch.

![](/images/blog/c-pattern-analysis/untitled%202.png)

I set a breakpoint right before the branch and checked the value — it held 0x4b. I accidentally converted it as a character; in decimal that's 75.

![](/images/blog/c-pattern-analysis/untitled%203.png)

It moves 0x4b (75) into eax, compares it against 0x59, and jumps if less than or equal. Since it's smaller, it jumps to main+46.

![](/images/blog/c-pattern-analysis/untitled%204.png)

This time it compares against 0x4f again, and if smaller, jumps to main+77.

![](/images/blog/c-pattern-analysis/untitled%205.png)

It pushes a string, prints it, and the main function ends — this is the else branch.

Without even looking at the else-if branch yet, it appears the branching compares in the order if -> else -> else-if.

![](/images/blog/c-pattern-analysis/untitled%206.png)

In the else-if branch, the comparison against 0x4f in the else check falls through as not-less, so it goes on to compare against 0x59 as well. And when the jg condition also fails to match, it falls through to the puts call below.

Now that I've got a rough feel for if-elseif-else, let's hand-trace the whole source.

![](/images/blog/c-pattern-analysis/untitled%207.png)

We write the comparisons in order, but internally we can see they're processed in the order if -> else -> else-if!

## for

![](/images/blog/c-pattern-analysis/untitled%208.png)

This is a multiplication-table program I wrote back when I was first studying C.

It's a simple program that prints out just one chosen table.

Let's study the pattern of the for loop.

![](/images/blog/c-pattern-analysis/untitled%209.png)

![](/images/blog/c-pattern-analysis/untitled%2010.png)

It reads a variable with scanf, moves the value at ebp-0xc into eax, and then moves it again into ebp-0x4. Then it jumps to main+94.

At main+94, it moves the data at ebp-0xc into eax and compares it against ebp-0x4.

If less than or equal, it jumps to main+44.

![](/images/blog/c-pattern-analysis/untitled%2011.png)

Step 1.

At main+44, it stores 1 into ebp-0x8 and jumps to main+84.

At main+84, it compares the value at ebp-0x8 (1) against 9, and if less than or equal, jumps to main+53.

Step 2.

It multiplies ebp-0x4 by ebp-0x8, stores the result in eax, and then pushes the product, the second argument, the first argument, and the format string before printing.

Step 3.

After printing, it increments the value at ebp-0x8 by 1, compares against 9, and jumps to main+53 if less than or equal. --> increment ebp-0x8, then multiply and print again

![](/images/blog/c-pattern-analysis/untitled%2012.png)

Once the loop of steps 2 and 3 finishes, it increments the value at ebp-0x4 by 1, stores ebp-0xc (the input value) into eax, and compares it against ebp-0x4.

Comparing the input value (2) against ebp-0x4 (2) + 1 = 3, since 3 is larger, eax is set to 0 and the program terminates. `mov eax, 0x0` means `return 0`.

This was a program that prints an N-times table.

Looking at the overall structure, the input argument sits at the very end; ebp-0x4 and ebp-0x8 are each assigned values, the inner loop is processed first, and then the outer loop is processed.

The branch instructions sit in between.

To identify this pattern, it seems best to first look for the spot where `add` and `cmp` appear together during branching, and then determine the loop by examining the comparison value.

Hand-tracing this one too gives the following:

![](/images/blog/c-pattern-analysis/untitled%2013.png)

Since this is pseudocode, it needs to be rewritten. A for loop has three parts: initialization, condition, and increment. Let's rebuild it accordingly.

![](/images/blog/c-pattern-analysis/untitled%2014.png)

## while

Now let's rewrite the program using a while loop.

![](/images/blog/c-pattern-analysis/untitled%2015.png)

![](/images/blog/c-pattern-analysis/untitled%2016.png)

Internally, while doesn't look all that different.

Set the initial value, compare at the very bottom, process the value in the middle section, print, increment, then compare again — nothing dramatically different.

Let's hand-trace this one too and then move on to do-while.

![](/images/blog/c-pattern-analysis/untitled%2017.png)

Here's the pseudocode again, and rewriting it in while-loop form gives this.

![](/images/blog/c-pattern-analysis/untitled%2018.png)

There's not much to fix.

## do-while

Finally, the do-while statement.

![](/images/blog/c-pattern-analysis/untitled%2019.png)

![](/images/blog/c-pattern-analysis/untitled%2020.png)

Written as do-while, the comparison instructions drop down to two. Since it processes once first and only compares at the end, it's an easier flow to debug while stepping through.

Let's do a quick hand-trace and wrap up.

![](/images/blog/c-pattern-analysis/untitled%2021.png)

Here's the pseudocode — process first, then increment, then jump.

This form produces cleaner assembly than the other loop types, but the flow is different, so it's worth remembering them separately.

Let's rewrite it to match the proper form.

![](/images/blog/c-pattern-analysis/untitled%2022.png)

When do-while loops are nested, the branch only goes into the inner loop.

So to determine whether two do-while loops are nested, check whether there's more than one increment operation along with a comparison — if both are present, it's likely a multi-level loop.

It looks simple, but actually tracing it by hand taught me a lot. I covered the four patterns if/for/while/do-while here; I'll cover the remaining patterns like switch-case another time.
