"""File operations for desktop agent capabilities."""

import os
from pathlib import Path


class FileOps:
    """Safe file operations restricted to home directory."""

    ALLOWED_DIRS = [Path.home()]
    BLOCKED_PATTERNS = [".ssh", ".gnupg", ".aws/credentials", ".env"]

    def read(self, path: str) -> dict:
        """Read file contents safely."""
        try:
            p = Path(path).resolve()
            if not self._is_allowed(p):
                return {"success": False, "content": "", "error": "Path not allowed"}
            if not p.exists():
                return {"success": False, "content": "", "error": "File not found"}
            if not p.is_file():
                return {"success": False, "content": "", "error": "Not a file"}
            content = p.read_text(errors="replace")
            return {"success": True, "content": content, "error": None}
        except Exception as e:
            return {"success": False, "content": "", "error": str(e)}

    def write(self, path: str, content: str) -> dict:
        """Write file safely."""
        try:
            p = Path(path).resolve()
            if not self._is_allowed(p):
                return {"success": False, "error": "Path not allowed"}
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content)
            return {"success": True, "error": None}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def list_dir(self, path: str) -> dict:
        """List directory contents."""
        try:
            p = Path(path).resolve()
            if not self._is_allowed(p):
                return {"success": False, "entries": [], "error": "Path not allowed"}
            if not p.is_dir():
                return {"success": False, "entries": [], "error": "Not a directory"}
            entries = []
            for item in sorted(p.iterdir()):
                try:
                    stat = item.stat()
                    entries.append({
                        "name": item.name,
                        "type": "dir" if item.is_dir() else "file",
                        "size": stat.st_size if item.is_file() else 0,
                    })
                except OSError:
                    pass
            return {"success": True, "entries": entries, "error": None}
        except Exception as e:
            return {"success": False, "entries": [], "error": str(e)}

    def _is_allowed(self, path: Path) -> bool:
        """Check if path is within allowed directories and not blocked."""
        resolved = path.resolve()
        in_allowed = any(
            str(resolved).startswith(str(d.resolve())) for d in self.ALLOWED_DIRS
        )
        if not in_allowed:
            return False
        for blocked in self.BLOCKED_PATTERNS:
            if blocked in str(resolved):
                return False
        return True
