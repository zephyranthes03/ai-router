/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GATEWAY_SERVER_URL?: string;
  readonly VITE_LOCAL_API_URL?: string;
  readonly VITE_PROOF_REGISTRY_ADDRESS?: `0x${string}`;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
