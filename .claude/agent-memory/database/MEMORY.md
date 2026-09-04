# Database Agent Memory

- [Language convention](project_language_convention.md) — schema/comments in English; Portuguese enum values (`JOVEM` etc.) and category slugs are persisted data, don't "fix" them.
- [schema.prisma is CRLF](feedback_schema_crlf.md) — never `sed -i` it; you get a 600-line diff that hides the real change.
