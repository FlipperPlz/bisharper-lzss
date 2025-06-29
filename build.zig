const std = @import("std");

pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{});

    const wasm_target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });

    const wasm_lib = b.addExecutable(.{
        .name = "bisharper",
        .root_source_file = b.path("src/root.zig"),
        .target = wasm_target,
        .optimize = optimize,
        .strip = optimize != .Debug,
    });

    wasm_lib.entry = .disabled;
    wasm_lib.rdynamic = true;
    wasm_lib.stack_size = 1024 * 1024;
    wasm_lib.initial_memory = 65536 * 64;
    wasm_lib.max_memory = 65536 * 512;

    const wasm_install = b.addInstallArtifact(wasm_lib, .{
        .dest_dir = .{ .override = .{ .custom = "../dist" } },
    });

    const wasm_step = b.step("wasm", "Build WASM library");
    wasm_step.dependOn(&wasm_install.step);

    // Native Tests (for running tests)
    const native_tests = b.addTest(.{
        .name = "tests",
        .root_source_file = b.path("src/tests.zig"),
        .target = b.standardTargetOptions(.{}),
        .optimize = optimize,
    });

    const test_step = b.step("test", "Run tests");
    test_step.dependOn(&b.addRunArtifact(native_tests).step);

    // WASM Tests (optional - for building WASM test binary)
    const wasm_tests = b.addTest(.{
        .name = "wasm-tests",
        .root_source_file = b.path("src/tests.zig"),
        .target = wasm_target,
        .optimize = optimize,
    });

    wasm_tests.entry = .disabled;
    wasm_tests.rdynamic = true;
    wasm_tests.stack_size = 1024 * 1024;
    wasm_tests.initial_memory = 65536 * 64;
    wasm_tests.max_memory = 65536 * 512;

    const wasm_test_install = b.addInstallArtifact(wasm_tests, .{
        .dest_dir = .{ .override = .{ .custom = "../dist" } },
    });

    const wasm_test_step = b.step("test-wasm", "Build WASM tests");
    wasm_test_step.dependOn(&wasm_test_install.step);

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
