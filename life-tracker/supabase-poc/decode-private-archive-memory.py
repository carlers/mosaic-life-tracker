#!/usr/bin/env python3
"""Decode selected pg_restore objects from a fully authenticated age archive.

Linux-only: hold the decrypted custom-format archive in an anonymous, seekable
memfd. Never create a plaintext archive on disk, connect to a database or
print archive rows. The private TOC allowlist is supplied by the shell caller.
"""
import os
import subprocess
import sys

MAX_ARCHIVE_BYTES = 256 * 1024 * 1024

def main():
    if (len(sys.argv) != 4 or not hasattr(os, "memfd_create")
            or not os.path.isabs(sys.argv[1])
            or not os.path.isabs(sys.argv[2])
            or not os.path.isabs(sys.argv[3])):
        raise ValueError("Linux and absolute archive, age key and TOC paths are required")
    archive, key, selection = sys.argv[1:]
    fd = os.memfd_create("mosaic-private-archive", flags=os.MFD_CLOEXEC)
    try:
        total = 0
        with subprocess.Popen(
            ["age", "--decrypt", "--identity", key, archive],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        ) as decrypt:
            assert decrypt.stdout is not None
            while True:
                chunk = decrypt.stdout.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_ARCHIVE_BYTES:
                    decrypt.kill()
                    decrypt.wait()
                    raise ValueError("Decrypted archive exceeds offline memory limit")
                view = memoryview(chunk)
                while view:
                    written = os.write(fd, view)
                    view = view[written:]
            if decrypt.wait() != 0 or total == 0:
                raise ValueError("Archive could not be fully authenticated")
        os.lseek(fd, 0, os.SEEK_SET)
        result = subprocess.run(
            ["pg_restore", "--data-only", "--no-owner",
             "--use-list=" + selection, "--file=/dev/null",
             "/proc/self/fd/" + str(fd)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            pass_fds=(fd,),
            check=False,
        )
        if result.returncode:
            # CI has exclusively generated fake records; operator errors
            # remain generic to avoid leaking real backup metadata.
            if (os.environ.get("MOSAIC_SYNTHETIC_RESTORE_LAB") == "1"
                    and os.environ.get("GITHUB_ACTIONS") == "true"):
                sys.stderr.write(result.stderr.decode("utf-8", errors="replace")[:700])
            raise ValueError("pg_restore could not decode selected data blocks")
    finally:
        os.close(fd)

if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as exc:
        if (os.environ.get("MOSAIC_SYNTHETIC_RESTORE_LAB") == "1"
                and os.environ.get("GITHUB_ACTIONS") == "true"):
            print("Synthetic offline decode diagnostic:", type(exc).__name__, file=sys.stderr)
        print("Selected archive DATA-only decode failed; no database touched", file=sys.stderr)
        sys.exit(1)
