const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const script = path.resolve(__dirname, "../ops/verify-release-image.sh");
const releaseSha = "a".repeat(40);
const imageRef = `ghcr.io/example/black-carp@sha256:${"b".repeat(64)}`;

function mockEnvironment(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "black-carp-release-image-"));
  const docker = path.join(root, "docker");
  fs.writeFileSync(docker, [
    "#!/bin/sh",
    "set -eu",
    "if [ \"$1\" = image ] && [ \"$2\" = inspect ]; then",
    "  case \"$*\" in",
    "    *RepoDigests*) printf '%s\\n' \"$MOCK_IMAGE_REF\" ;;",
    "    *) printf '%s\\n' \"$MOCK_RELEASE_SHA\" ;;",
    "  esac",
    "elif [ \"$1\" = run ]; then",
    "  printf '%s\\n' \"$MOCK_RELEASE_SHA\"",
    "else",
    "  exit 2",
    "fi"
  ].join("\n"));
  fs.chmodSync(docker, 0o755);
  return {
    root,
    env: {
      ...process.env,
      PATH: `${root}:${process.env.PATH}`,
      MOCK_RELEASE_SHA: releaseSha,
      MOCK_IMAGE_REF: imageRef,
      ...overrides
    }
  };
}

test("release image verifier requires an immutable digest", () => {
  const result = spawnSync(script, [releaseSha, "ghcr.io/example/black-carp:latest"], { encoding: "utf8" });
  assert.equal(result.status, 65);
  assert.match(result.stderr, /pinned by a sha256 digest/);
});

test("release image verifier validates digest, OCI label and embedded revision", (t) => {
  const mock = mockEnvironment();
  t.after(() => fs.rmSync(mock.root, { recursive: true, force: true }));
  const result = spawnSync(script, [releaseSha, imageRef], { env: mock.env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Release image verified/);
});

test("release image verifier rejects a mismatched revision", (t) => {
  const mock = mockEnvironment({ MOCK_RELEASE_SHA: "c".repeat(40) });
  t.after(() => fs.rmSync(mock.root, { recursive: true, force: true }));
  const result = spawnSync(script, [releaseSha, imageRef], { env: mock.env, encoding: "utf8" });
  assert.equal(result.status, 65);
  assert.match(result.stderr, /OCI revision does not match/);
});
