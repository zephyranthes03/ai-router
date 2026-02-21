"""Shell command execution for desktop agent."""

import subprocess
import shlex


class ShellExecutor:
    """Safe shell command execution with timeout and blocklist."""

    BLOCKED_COMMANDS = [
        "rm -rf /",
        "rm -rf /*",
        "mkfs",
        "dd if=",
        ":(){",
        "fork bomb",
        "> /dev/sda",
        "chmod -R 777 /",
    ]

    def execute(self, command: str, timeout: int = 30) -> dict:
        """Execute shell command safely."""
        # Check blocked commands
        cmd_lower = command.lower().strip()
        for blocked in self.BLOCKED_COMMANDS:
            if blocked in cmd_lower:
                return {
                    "success": False,
                    "stdout": "",
                    "stderr": f"Blocked command: {blocked}",
                    "return_code": -1,
                }

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=None,
            )
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout[:10000],  # Limit output
                "stderr": result.stderr[:5000],
                "return_code": result.returncode,
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "stdout": "",
                "stderr": f"Command timed out after {timeout}s",
                "return_code": -1,
            }
        except Exception as e:
            return {
                "success": False,
                "stdout": "",
                "stderr": str(e),
                "return_code": -1,
            }
