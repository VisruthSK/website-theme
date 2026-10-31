declare module "@web-alchemy/fonttools" {
  export type SubsetOptions = Record<string, string | number | boolean>

  export function subset(
    font: Buffer | Uint8Array,
    options?: SubsetOptions,
  ): Promise<Buffer>

  export function instantiateVariableFont(
    font: Buffer | Uint8Array,
    axes: Record<string, number | [number, number] | null>,
  ): Promise<Buffer>
}
