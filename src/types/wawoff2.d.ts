declare module 'wawoff2' {
  const wawoff2: {
    compress(data: Uint8Array): Promise<Uint8Array>
    decompress(data: Uint8Array): Promise<Uint8Array>
  }
  export default wawoff2
}
