import test from "node:test";
import assert from "node:assert";
import { splitSourceLocations } from "./splitSourceLocations";

test("splitSourceLocations - finds OpenSCAD's location in a warning", () => {
  assert.deepStrictEqual(
    splitSourceLocations(
      'Ignoring unknown variable "y" in file main.scad, line 2',
    ),
    [
      { text: 'Ignoring unknown variable "y" in file ' },
      {
        text: "main.scad, line 2",
        location: { file: "main.scad", line: 2 },
      },
    ],
  );
});

test("splitSourceLocations - keeps the text after a location", () => {
  assert.deepStrictEqual(
    splitSourceLocations(
      "Parser error in file lib/part.scad, line 12: syntax error",
    ),
    [
      { text: "Parser error in file " },
      {
        text: "lib/part.scad, line 12",
        location: { file: "lib/part.scad", line: 12 },
      },
      { text: ": syntax error" },
    ],
  );
});

test("splitSourceLocations - allows spaces, commas and drive letters in the file", () => {
  assert.deepStrictEqual(
    splitSourceLocations(
      "called by 'far' in file ../my parts/a, b.scad, line 1",
    )[1],
    {
      text: "../my parts/a, b.scad, line 1",
      location: { file: "../my parts/a, b.scad", line: 1 },
    },
  );
  assert.deepStrictEqual(
    splitSourceLocations("in file C:\\Users\\me\\part.scad, line 5")[1],
    {
      text: "C:\\Users\\me\\part.scad, line 5",
      location: { file: "C:\\Users\\me\\part.scad", line: 5 },
    },
  );
});

test("splitSourceLocations - strips quotes around the file", () => {
  assert.deepStrictEqual(
    splitSourceLocations('Assertion failed in file "main.scad", line 3')[1],
    {
      text: '"main.scad", line 3',
      location: { file: "main.scad", line: 3 },
    },
  );
});

test("splitSourceLocations - finds every location in a line", () => {
  const pieces = splitSourceLocations(
    "in file a.scad, line 1 and in file b.scad, line 2",
  );
  assert.deepStrictEqual(
    pieces.map((piece) => ("location" in piece ? piece.location : piece.text)),
    [
      "in file ",
      { file: "a.scad", line: 1 },
      " and in file ",
      { file: "b.scad", line: 2 },
    ],
  );
});

test("splitSourceLocations - leaves a line without a location alone", () => {
  assert.deepStrictEqual(splitSourceLocations("ECHO: 1, line 2"), [
    { text: "ECHO: 1, line 2" },
  ]);
  assert.deepStrictEqual(splitSourceLocations("Can't parse file 'a.scad'!"), [
    { text: "Can't parse file 'a.scad'!" },
  ]);
  assert.deepStrictEqual(splitSourceLocations(""), []);
});
