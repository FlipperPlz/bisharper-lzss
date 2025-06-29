// TypeScript wrapper for bisharper-lzss WebAssembly module


export enum LzssErrorCode {
  Success = 0,
  OutOfMemory = -1,
  BufferTooLong = -2,
  DataTooLarge = -3,
  ExtraData = -4,
  ChecksumMismatch = -5,
  LZSSOverflow = -6,
  InputTooShort = -7,
  InvalidInput = -8,
}

export interface LzssResult {
  data?: Uint8Array,
  error: LzssErrorCode,
}

interface WasmLzssResult {
  ptr: number;
  len: number;
  error_code: number;
}

export interface BiSharperLzssModule extends WebAssembly.Module {
  instance: WebAssembly.Instance & {
    exports: {
      memory: WebAssembly.Memory,
      wasmAlloc(size: number): number;
      wasmFree(ptr: number, size: number): void;
      wasmEncode(input_ptr: number, input_len: number, signed_checksum: boolean): WasmLzssResult;
      wasmDecode(input_ptr: number, input_len: number, expected_len: number, signed_checksum: boolean): WasmLzssResult;
      wasmRandom(expected_output_size: number, signed_checksum: boolean, seed: number): WasmLzssResult;
    }
  }
}

export class BiSharperLzss {
  private module: BiSharperLzssModule;
  private memory: WebAssembly.Memory;

  constructor(module: BiSharperLzssModule) {
    this.module = module;
    this.memory = module.instance.exports.memory;
  }

  /**
   * Encodes data using LZSS compression
   */
  /**
   * Encode data using LZSS compression
   * @param input - Data to compress
   * @param signedChecksum - Whether to use signed checksum
   * @returns Compressed data or error information
   */
  encode(input: Uint8Array, signedChecksum = false): LzssResult {
    if (input.length === 0) {
      return {
        error: LzssErrorCode.InvalidInput,
      };
    }

    let inputPtr = 0;
    try {
      inputPtr = this.copyToWasm(input);
      const result = this.module.instance.exports.wasmEncode(inputPtr, input.length, signedChecksum);

      if (result.error_code !== LzssErrorCode.Success) {
        return {
          error: result.error_code,
        };
      }

      const outputData = this.copyFromWasm(result.ptr, result.len);

      this.module.instance.exports.wasmFree(result.ptr, result.len);

      return {
        data: outputData,
        error: LzssErrorCode.Success,
      };
    } finally {
      if (inputPtr !== 0) {
        this.module.instance.exports.wasmFree(inputPtr, input.length);
      }
    }
  }

  /**
   * Decode LZSS compressed data
   * @param input - Compressed data to decompress
   * @param expectedLength - Expected length of decompressed data
   * @param signedChecksum - Whether to use signed checksum
   * @returns Decompressed data or error information
   */
  decode(input: Uint8Array, expectedLength: number, signedChecksum = false): LzssResult {

    if (input.length === 0 || expectedLength === 0) {
      return {
        error: LzssErrorCode.InvalidInput,
      };
    }

    let inputPtr = 0;
    try {
      inputPtr = this.copyToWasm(input);
      const result = this.module.instance.exports.wasmDecode(inputPtr, input.length, expectedLength, signedChecksum);

      if (result.error_code !== LzssErrorCode.Success) {
        return {
          error: result.error_code,
        };
      }

      const outputData = this.copyFromWasm(result.ptr, result.len);
      this.module.instance.exports.wasmFree(result.ptr, result.len);

      return {
        data: outputData,
        error: LzssErrorCode.Success,
      };
    } finally {
      // Free input memory
      if (inputPtr !== 0) {
        this.module.instance.exports.wasmFree(inputPtr, input.length);
      }
    }
  }

  /**
   * Generates random LZSS compressed data
   */
  generateRandom(expectedOutputSize: number, signedChecksum: boolean = false, seed: number = Date.now()): LzssResult {
    const wasmResult = this.module.instance.exports.wasmRandom(
        expectedOutputSize,
        signedChecksum,
        seed
    );

    if (wasmResult.error_code !== LzssErrorCode.Success) {
      return {
        error: wasmResult.error_code as LzssErrorCode
      };
    }

    const resultData = this.copyFromWasm(wasmResult.ptr, wasmResult.len);
    this.module.instance.exports.wasmFree(wasmResult.ptr, wasmResult.len);

    return {
      data: resultData,
      error: LzssErrorCode.Success
    };
  }

  private copyToWasm(data: Uint8Array): number {
    const ptr = this.module.instance.exports.wasmAlloc(data.length);
    if (ptr === 0) {
      throw new Error('Failed to allocate WASM memory');
    }

    const wasmMemory = new Uint8Array(this.module.instance.exports.memory.buffer);
    wasmMemory.set(data, ptr);
    return ptr;
  }

  private copyFromWasm(ptr: number, length: number): Uint8Array {
    const wasmMemory = new Uint8Array(this.module.instance.exports.memory.buffer);
    return wasmMemory.slice(ptr, ptr + length);
  }

  private getErrorMessage(errorCode: number): string {
    switch (errorCode) {
      case LzssErrorCode.Success: return "Success";
      case LzssErrorCode.OutOfMemory: return "Out of memory";
      case LzssErrorCode.BufferTooLong: return "Buffer too long";
      case LzssErrorCode.DataTooLarge: return "Data too large";
      case LzssErrorCode.ExtraData: return "Extra data";
      case LzssErrorCode.ChecksumMismatch: return "Checksum mismatch";
      case LzssErrorCode.LZSSOverflow: return "LZSS overflow";
      case LzssErrorCode.InputTooShort: return "Input too short";
      case LzssErrorCode.InvalidInput: return "Invalid input";
      default: return `Unknown error: ${errorCode}`;
    }
  }
}