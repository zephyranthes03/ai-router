declare module "snarkjs" {
  export namespace groth16 {
    function fullProve(
      input: Record<string, unknown>,
      wasmPath: string,
      zkeyPath: string
    ): Promise<{ proof: Record<string, unknown>; publicSignals: string[] }>;

    function exportSolidityCallData(
      proof: Record<string, unknown>,
      publicSignals: string[]
    ): Promise<string>;

    function verify(
      vkey: Record<string, unknown>,
      publicSignals: string[],
      proof: Record<string, unknown>
    ): Promise<boolean>;
  }
}
