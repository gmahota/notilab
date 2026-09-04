---
name: schema-crlf-edits
description: prisma/schema.prisma is CRLF — never edit it with plain `sed -i`, which rewrites the whole file to LF and buries the real change.
metadata:
  type: feedback
---

`prisma/schema.prisma` is CRLF (repo is Windows, `core.autocrlf=true`). Plain `sed -i`
rewrites it to LF, so a 1-line change produces a ~600-line diff.

**Why:** a diff that touches every line makes it impossible for a reviewer to verify that
a schema edit changed *only* what was intended — which matters more here than usual, since
an unnoticed token change in this file becomes a migration.

**How to apply:** use the Edit tool, or `perl -i -pe 'BEGIN{binmode(STDIN);binmode(STDOUT)} s{...}{...}'`
which leaves the `\r` terminators alone. Either way, confirm afterward with
`file prisma/schema.prisma` (expect "CRLF line terminators") and check that
`git diff --stat` shows the line count you expect and nothing more.
