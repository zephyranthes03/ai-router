declare module "circomlibjs" {
  interface PoseidonFunction {
    (inputs: bigint[]): Uint8Array;
    F: {
      toString(val: Uint8Array): string;
      toObject(val: Uint8Array): bigint;
    };
  }

  export function buildPoseidon(): Promise<PoseidonFunction>;
}
