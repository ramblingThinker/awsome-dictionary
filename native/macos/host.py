#!/usr/bin/env python3
import json
import os
import struct
import subprocess
import sys


def read_message():
  raw_len = sys.stdin.buffer.read(4)
  if not raw_len:
    return None
  msg_len = struct.unpack("@I", raw_len)[0]
  payload = sys.stdin.buffer.read(msg_len)
  if not payload:
    return None
  return json.loads(payload.decode("utf-8"))


def write_message(message):
  encoded = json.dumps(message).encode("utf-8")
  sys.stdout.buffer.write(struct.pack("@I", len(encoded)))
  sys.stdout.buffer.write(encoded)
  sys.stdout.buffer.flush()


def lookup(word):
  helper = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dictionary_lookup")
  try:
    result = subprocess.run(
      [helper, word],
      capture_output=True,
      text=True,
      timeout=3,
      check=False
    )
  except Exception:
    return {"ok": False, "error": "lookup_failed"}

  text = (result.stdout or "").strip()
  if result.returncode == 0 and text:
    return {"ok": True, "word": word, "definition": text}
  if result.returncode == 2:
    return {"ok": False, "error": "not_found"}
  return {"ok": False, "error": "lookup_failed"}


def handle(message):
  if not isinstance(message, dict):
    return {"ok": False, "error": "invalid_message"}
  if message.get("action") != "define":
    return {"ok": False, "error": "unsupported_action"}

  word = str(message.get("word", "")).strip()
  if not word:
    return {"ok": False, "error": "empty_word"}
  return lookup(word)


def main():
  while True:
    message = read_message()
    if message is None:
      break
    write_message(handle(message))


if __name__ == "__main__":
  main()
