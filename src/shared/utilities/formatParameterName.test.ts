import test from "node:test";
import assert from "node:assert";
import { formatParameterName } from "./formatParameterName";

test("formatParameterName - splits snake_case and camelCase into words", () => {
  assert.strictEqual(
    formatParameterName("wall_thickness", "Parameters"),
    "Wall Thickness",
  );
  assert.strictEqual(
    formatParameterName("wallThickness", "Parameters"),
    "Wall Thickness",
  );
});

test("formatParameterName - drops the group name in front", () => {
  assert.strictEqual(formatParameterName("hole_diameter", "Hole"), "Diameter");
  assert.strictEqual(formatParameterName("holeDiameter", "hole"), "Diameter");
  assert.strictEqual(
    formatParameterName("hole_options_depth", "Hole Options"),
    "Depth",
  );
});

test("formatParameterName - drops only whole words", () => {
  assert.strictEqual(formatParameterName("holes", "Hole"), "Holes");
  assert.strictEqual(formatParameterName("hole_count", "Ho"), "Hole Count");
});

test("formatParameterName - keeps a name that is only the group name", () => {
  assert.strictEqual(formatParameterName("count", "Count"), "Count");
  assert.strictEqual(
    formatParameterName("hole_options", "Hole Options"),
    "Hole Options",
  );
});

test("formatParameterName - handles group names with regex characters", () => {
  assert.strictEqual(formatParameterName("cpp_flags", "C++"), "Cpp Flags");
  assert.strictEqual(formatParameterName("size", "Size (mm)"), "Size");
});
