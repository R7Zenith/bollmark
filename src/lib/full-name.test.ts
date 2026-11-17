import { test } from "node:test";
import assert from "node:assert/strict";
import { FULL_NAME_PATTERN, hasFullName } from "./full-name";

// Tarayici `pattern` niteligini tum degere ve `v` bayragiyla uygular.
const browserPattern = new RegExp(`^(?:${FULL_NAME_PATTERN})$`, "v");

test("hasFullName ve tarayici deseni ayni sonucu verir", () => {
  const cases: [string, boolean][] = [
    ["Busra", false],
    ["  Busra  ", false],
    ["", false],
    ["Busra Meşeoğlu", true],
    [" Ayşe  Nur Yılmaz ", true]
  ];
  for (const [input, expected] of cases) {
    assert.equal(hasFullName(input), expected, input);
    assert.equal(browserPattern.test(input), expected, `desen: ${input}`);
  }
});
