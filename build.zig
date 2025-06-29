const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const wasm_target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });

    const wasm_lib = b.addExecutable(.{
        .name = "bisharper",
        .root_source_file = b.path("src/wasm/bindings.zig"),
        .target = wasm_target,
        .optimize = optimize,
        .strip = optimize != .Debug,
    });

    wasm_lib.entry = .disabled;
    wasm_lib.rdynamic = true;
    wasm_lib.import_memory = true;
    wasm_lib.stack_size = 1024 * 1024;
    wasm_lib.initial_memory = 65536 * 32;
    wasm_lib.max_memory = 65536 * 256;

    const wasm_install = b.addInstallArtifact(wasm_lib, .{
        .dest_dir = .{ .override = .{ .custom = "../dist" } },
    });

    const native_lib = b.addStaticLibrary(.{
        .name = "bisharper-native",
        .root_source_file = b.path("src/root.zig"),
        .target = target,
        .optimize = optimize,
    });

    const wasm_step = b.step("wasm", "Build WASM library");
    wasm_step.dependOn(&wasm_install.step);

    const native_step = b.step("native", "Build native library and CLI");
    native_step.dependOn(&b.addInstallArtifact(native_lib, .{}).step);

    const lib_tests = b.addTest(.{
        .root_source_file = b.path("src/root.zig"),
        .target = target,
        .optimize = optimize,
    });

    const wasm_tests = b.addTest(.{
        .root_source_file = b.path("src/wasm/bindings.zig"),
        .target = target,
        .optimize = optimize,
    });

    const test_step = b.step("test", "Run all tests");
    test_step.dependOn(&b.addRunArtifact(lib_tests).step);
    test_step.dependOn(&b.addRunArtifact(wasm_tests).step);

    // Benchmark
    // const benchmark = b.addExecutable(.{
    //     .name = "benchmark",
    //     .root_source_file = b.path("src/benchmark.zig"),
    //     .target = target,
    //     .optimize = .ReleaseFast,
    // });
    // benchmark.linkLibrary(native_lib);
    //
    // const benchmark_step = b.step("benchmark", "Run benchmarks");
    // benchmark_step.dependOn(&b.addRunArtifact(benchmark).step);

    // Default build step
    b.getInstallStep().dependOn(&wasm_install.step);
}