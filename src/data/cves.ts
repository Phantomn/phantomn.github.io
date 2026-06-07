export type CveSeverity = "critical" | "high" | "medium" | "pending";
export type CveStatus = "published" | "pending";

export interface CveEntry {
  id: string;
  title: string;
  year: number;
  groupKey: string;
  groupLabel: string;
  severity: CveSeverity;
  status: CveStatus;
  href: string;
  nvdHref: string;
  summary: string;
  cvssBaseScore: number;
  cvssVector: string;
  cwe: string;
  published: string;
  lastModified: string;
  nvdStatus: string;
}

export interface CveGroupSummary {
  key: string;
  label: string;
  shortLabel: string;
  count: number;
}

export const CVE_ITEMS: CveEntry[] = [
  {
    "id": "CVE-2019-18885",
    "title": "Linux kernel btrfs NULL pointer dereference",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "medium",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-18885",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-18885",
    "summary": "fs/btrfs/volumes.c in the Linux kernel before 5.1 allows a btrfs_verify_dev_extents NULL pointer dereference via a crafted btrfs image because fs_devices->devices is mishandled within find_device, aka CID-09ba3bc9dd15.",
    "cvssBaseScore": 5.5,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:H",
    "cwe": "CWE-476",
    "published": "2019-11-14",
    "lastModified": "2024-11-21",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2019-19036",
    "title": "Linux kernel btrfs root node NULL pointer dereference",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "medium",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19036",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-19036",
    "summary": "btrfs_root_node in fs/btrfs/ctree.c in the Linux kernel through 5.3.12 allows a NULL pointer dereference because rcu_dereference(root->node) can be zero.",
    "cvssBaseScore": 5.5,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:N/I:N/A:H",
    "cwe": "CWE-476",
    "published": "2019-11-21",
    "lastModified": "2024-11-21",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2019-19037",
    "title": "Linux kernel ext4 NULL pointer dereference",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "medium",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19037",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-19037",
    "summary": "ext4_empty_dir in fs/ext4/namei.c in the Linux kernel through 5.3.12 allows a NULL pointer dereference because ext4_read_dirblock(inode,0,DIRENT_HTREE) can be zero.",
    "cvssBaseScore": 5.5,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:N/I:N/A:H",
    "cwe": "CWE-476",
    "published": "2019-11-21",
    "lastModified": "2024-11-21",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2019-19039",
    "title": "Linux kernel btrfs information disclosure",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "medium",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19039",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-19039",
    "summary": "__btrfs_free_extent in fs/btrfs/extent-tree.c in the Linux kernel through 5.3.12 calls btrfs_print_leaf in a certain ENOENT case, which allows local users to obtain potentially sensitive information about register values via the dmesg program. NOTE: The BTRFS development team disputes this issues as not being a vulnerability because “1) The kernel provide facilities to restrict access to dmesg - dmesg_restrict=1 sysctl option. So it's really up to the system administrator to judge whether dmesg access shall be disallowed or not. 2) WARN/WARN_ON are widely used macros in the linux kernel. If this CVE is considered valid this would mean there are literally thousands CVE lurking in the kernel - something which clearly is not the case.",
    "cvssBaseScore": 5.5,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N",
    "cwe": "CWE-532",
    "published": "2019-11-21",
    "lastModified": "2024-11-21",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2019-19318",
    "title": "Linux kernel btrfs use-after-free",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "medium",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19318",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-19318",
    "summary": "In the Linux kernel 5.3.11, mounting a crafted btrfs image twice can cause an rwsem_down_write_slowpath use-after-free because (in rwsem_can_spin_on_owner in kernel/locking/rwsem.c) rwsem_owner_flags returns an already freed pointer,",
    "cvssBaseScore": 4.4,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:H/UI:N/S:U/C:N/I:N/A:H",
    "cwe": "CWE-416",
    "published": "2019-11-28",
    "lastModified": "2024-11-21",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2019-19319",
    "title": "Linux kernel ext4 slab out-of-bounds write",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "medium",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19319",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-19319",
    "summary": "In the Linux kernel before 5.2, a setxattr operation, after a mount of a crafted ext4 image, can cause a slab-out-of-bounds write access because of an ext4_xattr_set_entry use-after-free in fs/ext4/xattr.c when a large old_size value is used in a memset call, aka CID-345c0dbf3a30.",
    "cvssBaseScore": 6.5,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:H/UI:R/S:U/C:H/I:H/A:H",
    "cwe": "CWE-416",
    "published": "2019-11-27",
    "lastModified": "2024-11-21",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2019-19377",
    "title": "Linux kernel btrfs use-after-free",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "high",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19377",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-19377",
    "summary": "In the Linux kernel 5.0.21, mounting a crafted btrfs filesystem image, performing some operations, and unmounting can lead to a use-after-free in btrfs_queue_work in fs/btrfs/async-thread.c.",
    "cvssBaseScore": 7.8,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H",
    "cwe": "CWE-416",
    "published": "2019-11-29",
    "lastModified": "2024-11-21",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2019-19378",
    "title": "Linux kernel btrfs slab out-of-bounds write",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "high",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19378",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-19378",
    "summary": "In the Linux kernel 5.0.21, mounting a crafted btrfs filesystem image can lead to slab-out-of-bounds write access in index_rbio_pages in fs/btrfs/raid56.c.",
    "cvssBaseScore": 7.8,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H",
    "cwe": "CWE-787",
    "published": "2019-11-29",
    "lastModified": "2026-05-28",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2019-19447",
    "title": "Linux kernel ext4 use-after-free",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "high",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19447",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-19447",
    "summary": "In the Linux kernel 5.0.21, mounting a crafted ext4 filesystem image, performing some operations, and unmounting can lead to a use-after-free in ext4_put_super in fs/ext4/super.c, related to dump_orphan_list in fs/ext4/super.c.",
    "cvssBaseScore": 7.8,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H",
    "cwe": "CWE-416",
    "published": "2019-12-08",
    "lastModified": "2024-11-21",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2019-19448",
    "title": "Linux kernel btrfs use-after-free",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "high",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19448",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-19448",
    "summary": "In the Linux kernel 5.0.21 and 5.3.11, mounting a crafted btrfs filesystem image, performing some operations, and then making a syncfs system call can lead to a use-after-free in try_merge_free_space in fs/btrfs/free-space-cache.c because the pointer to a left data structure can be the same as the pointer to a right data structure.",
    "cvssBaseScore": 7.8,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H",
    "cwe": "CWE-416",
    "published": "2019-12-08",
    "lastModified": "2024-11-21",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2019-19449",
    "title": "Linux kernel f2fs slab out-of-bounds read",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "high",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19449",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-19449",
    "summary": "In the Linux kernel 5.0.21, mounting a crafted f2fs filesystem image can lead to slab-out-of-bounds read access in f2fs_build_segment_manager in fs/f2fs/segment.c, related to init_min_max_mtime in fs/f2fs/segment.c (because the second argument to get_seg_entry is not validated).",
    "cvssBaseScore": 7.8,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H",
    "cwe": "CWE-125",
    "published": "2019-12-08",
    "lastModified": "2024-11-21",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2019-19813",
    "title": "Linux kernel btrfs use-after-free",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "medium",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19813",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-19813",
    "summary": "In the Linux kernel 5.0.21, mounting a crafted btrfs filesystem image, performing some operations, and then making a syncfs system call can lead to a use-after-free in __mutex_lock in kernel/locking/mutex.c. This is related to mutex_can_spin_on_owner in kernel/locking/mutex.c, __btrfs_qgroup_free_meta in fs/btrfs/qgroup.c, and btrfs_insert_delayed_items in fs/btrfs/delayed-inode.c.",
    "cvssBaseScore": 5.5,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:N/I:N/A:H",
    "cwe": "CWE-416",
    "published": "2019-12-17",
    "lastModified": "2024-11-21",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2019-19814",
    "title": "Linux kernel f2fs slab out-of-bounds write",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "high",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19814",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-19814",
    "summary": "In the Linux kernel 5.0.21, mounting a crafted f2fs filesystem image can cause __remove_dirty_segment slab-out-of-bounds write access because an array is bounded by the number of dirty types (8) but the array index can exceed this.",
    "cvssBaseScore": 7.8,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H",
    "cwe": "CWE-787",
    "published": "2019-12-17",
    "lastModified": "2024-11-21",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2019-19815",
    "title": "Linux kernel f2fs NULL pointer dereference",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "medium",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19815",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-19815",
    "summary": "In the Linux kernel 5.0.21, mounting a crafted f2fs filesystem image can cause a NULL pointer dereference in f2fs_recover_fsync_data in fs/f2fs/recovery.c. This is related to F2FS_P_SB in fs/f2fs/f2fs.h.",
    "cvssBaseScore": 5.5,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:N/I:N/A:H",
    "cwe": "CWE-476",
    "published": "2019-12-17",
    "lastModified": "2024-11-21",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2019-19816",
    "title": "Linux kernel btrfs slab out-of-bounds write",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "high",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19816",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-19816",
    "summary": "In the Linux kernel 5.0.21, mounting a crafted btrfs filesystem image and performing some operations can cause slab-out-of-bounds write access in __btrfs_map_block in fs/btrfs/volumes.c, because a value of 1 for the number of data stripes is mishandled.",
    "cvssBaseScore": 7.8,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H",
    "cwe": "CWE-787",
    "published": "2019-12-17",
    "lastModified": "2024-11-21",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2019-19927",
    "title": "Linux kernel ttm slab out-of-bounds read",
    "year": 2019,
    "groupKey": "os-kernel",
    "groupLabel": "Best of the Best 8 - OS Kernel",
    "severity": "medium",
    "status": "published",
    "href": "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19927",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2019-19927",
    "summary": "In the Linux kernel 5.0.0-rc7 (as distributed in ubuntu/linux.git on kernel.ubuntu.com), mounting a crafted f2fs filesystem image and performing some operations can lead to slab-out-of-bounds read access in ttm_put_pages in drivers/gpu/drm/ttm/ttm_page_alloc.c. This is related to the vmwgfx or ttm module.",
    "cvssBaseScore": 6,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:H/UI:N/S:U/C:H/I:N/A:H",
    "cwe": "CWE-125",
    "published": "2019-12-31",
    "lastModified": "2024-11-21",
    "nvdStatus": "Modified"
  },
  {
    "id": "CVE-2024-33788",
    "title": "Linksys E5600 command injection",
    "year": 2024,
    "groupKey": "iot",
    "groupLabel": "Personal research - IoT",
    "severity": "high",
    "status": "published",
    "href": "https://github.com/0x0xxxx/CVE/tree/main/CVE-2024-33788",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2024-33788",
    "summary": "Linksys E5600 v1.1.0.26 was discovered to contain a command injection vulnerability via the PinCode parameter at /API/info form endpoint.",
    "cvssBaseScore": 8,
    "cvssVector": "CVSS:3.1/AV:A/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    "cwe": "CWE-77",
    "published": "2024-05-06",
    "lastModified": "2025-06-11",
    "nvdStatus": "Analyzed"
  },
  {
    "id": "CVE-2024-33789",
    "title": "Linksys E5600 command injection",
    "year": 2024,
    "groupKey": "iot",
    "groupLabel": "Personal research - IoT",
    "severity": "critical",
    "status": "published",
    "href": "https://github.com/0x0xxxx/CVE/tree/main/CVE-2024-33789",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2024-33789",
    "summary": "Linksys E5600 v1.1.0.26 was discovered to contain a command injection vulnerability via the ipurl parameter at /API/info form endpoint.",
    "cvssBaseScore": 9.8,
    "cvssVector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    "cwe": "CWE-77",
    "published": "2024-05-03",
    "lastModified": "2025-06-10",
    "nvdStatus": "Analyzed"
  },
  {
    "id": "CVE-2024-33791",
    "title": "netis-systems MEX605 cross-site scripting",
    "year": 2024,
    "groupKey": "iot",
    "groupLabel": "Personal research - IoT",
    "severity": "medium",
    "status": "published",
    "href": "https://github.com/0x0xxxx/CVE/tree/main/CVE-2024-33791",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2024-33791",
    "summary": "A cross-site scripting (XSS) vulnerability in netis-systems MEX605 v2.00.06 allows attackers to execute arbitrary web scripts or HTML via a crafted payload injected into the getTimeZone function.",
    "cvssBaseScore": 4.6,
    "cvssVector": "CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:U/C:L/I:L/A:N",
    "cwe": "CWE-79",
    "published": "2024-05-03",
    "lastModified": "2025-06-17",
    "nvdStatus": "Analyzed"
  },
  {
    "id": "CVE-2024-33792",
    "title": "netis-systems MEX605 OS command execution",
    "year": 2024,
    "groupKey": "iot",
    "groupLabel": "Personal research - IoT",
    "severity": "critical",
    "status": "published",
    "href": "https://github.com/0x0xxxx/CVE/tree/main/CVE-2024-33792",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2024-33792",
    "summary": "netis-systems MEX605 v2.00.06 allows attackers to execute arbitrary OS commands via a crafted payload to the tracert page.",
    "cvssBaseScore": 9.8,
    "cvssVector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    "cwe": "CWE-78",
    "published": "2024-05-03",
    "lastModified": "2025-06-17",
    "nvdStatus": "Analyzed"
  },
  {
    "id": "CVE-2024-33793",
    "title": "netis-systems MEX605 OS command execution",
    "year": 2024,
    "groupKey": "iot",
    "groupLabel": "Personal research - IoT",
    "severity": "medium",
    "status": "published",
    "href": "https://github.com/0x0xxxx/CVE/tree/main/CVE-2024-33793",
    "nvdHref": "https://nvd.nist.gov/vuln/detail/CVE-2024-33793",
    "summary": "netis-systems MEX605 v2.00.06 allows attackers to execute arbitrary OS commands via a crafted payload to the ping test page.",
    "cvssBaseScore": 5.3,
    "cvssVector": "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:L",
    "cwe": "CWE-78",
    "published": "2024-05-03",
    "lastModified": "2025-06-17",
    "nvdStatus": "Analyzed"
  }
];

export const CVE_COUNT = CVE_ITEMS.length;

export const CVE_GROUPS: CveGroupSummary[] = [
  {
    "key": "os-kernel",
    "label": "Best of the Best 8 - OS Kernel",
    "shortLabel": "OS Kernel",
    "count": 16
  },
  {
    "key": "iot",
    "label": "Personal research - IoT",
    "shortLabel": "IoT",
    "count": 5
  }
];

export function getCveSeverityLabel(severity: CveSeverity) {
  switch (severity) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "pending":
      return "Pending";
  }
}

export function getCveSlug(id: string) {
  return id.toLowerCase();
}

export function getCveBySlug(slug: string) {
  return CVE_ITEMS.find((item) => getCveSlug(item.id) === slug) ?? null;
}
