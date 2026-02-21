/**
 * Hook for accessing the pywebview JS API bridge.
 * Falls back gracefully when not running in pywebview.
 */

declare global {
  interface Window {
    pywebview?: {
      api: {
        get_system_info: () => Promise<Record<string, unknown>>;
        check_ollama: () => Promise<boolean>;
        read_file: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
        write_file: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
        list_directory: (path: string) => Promise<{ success: boolean; entries?: string[]; error?: string }>;
        execute_command: (command: string, timeout?: number) => Promise<{
          success: boolean;
          stdout?: string;
          stderr?: string;
          return_code?: number;
        }>;
        get_settings: () => Promise<Record<string, unknown>>;
        save_settings: (settings: Record<string, unknown>) => Promise<Record<string, unknown>>;
      };
    };
  }
}

export function useBridge() {
  const isAvailable = typeof window !== "undefined" && !!window.pywebview?.api;

  const api = isAvailable ? window.pywebview!.api : null;

  return {
    isAvailable,
    api,
  };
}
