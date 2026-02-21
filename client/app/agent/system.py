"""System information for desktop agent."""

import os
import platform
import sys
import shutil


class SystemInfo:
    """System information gathering."""

    def info(self) -> dict:
        """Get system information."""
        disk = shutil.disk_usage("/")
        return {
            "os": platform.system(),
            "os_version": platform.version(),
            "platform": platform.platform(),
            "python_version": sys.version,
            "architecture": platform.machine(),
            "hostname": platform.node(),
            "cpu_count": os.cpu_count(),
            "disk_total_gb": round(disk.total / (1024**3), 1),
            "disk_free_gb": round(disk.free / (1024**3), 1),
            "home_dir": str(os.path.expanduser("~")),
        }

    def processes(self) -> list[dict]:
        """List running processes (basic)."""
        try:
            import subprocess
            result = subprocess.run(
                ["ps", "aux", "--sort=-rss"],
                capture_output=True, text=True, timeout=5
            )
            lines = result.stdout.strip().split("\n")[:20]  # Top 20
            return [{"line": line} for line in lines]
        except Exception:
            return []
