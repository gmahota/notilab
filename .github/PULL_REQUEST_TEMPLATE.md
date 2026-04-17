## Description
<!-- Describe what this PR changes and why -->


## Type of Change
- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that changes existing behaviour)
- [ ] 🔧 Refactor / chore (no functional changes)
- [ ] 📚 Documentation update
- [ ] 🔒 Security fix

## Related Issues
<!-- Link issues: Closes #123 -->
Closes #

## Changes Made
<!-- Bullet points of the key changes -->
- 

## How to Test
<!-- Steps to verify this works correctly -->
1. 
2. 

## Checklist
- [ ] My code follows the project's TypeScript strict conventions (no `any`)
- [ ] I have not added `console.log` statements to production code
- [ ] All database access goes through `lib/` service files
- [ ] API routes delegate logic to `lib/`, not inline
- [ ] Admin routes validate JWT via `lib/admin-auth.ts`
- [ ] User input is validated/sanitized at API boundaries
- [ ] No secrets or tokens are hardcoded
- [ ] The PR is focused (single concern — consider splitting if > 20 files)
- [ ] I have updated relevant documentation if needed

## Screenshots / Demo
<!-- If this is a UI change, include before/after screenshots -->
