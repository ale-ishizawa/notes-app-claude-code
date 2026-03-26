# REVIEW.md — Review Documentation

## What Was Reviewed Deeply
*(Updated throughout the build)*

## What Was Sampled
*(Updated throughout the build)*

## Risky Areas
- RLS policies — tenant isolation is the highest-risk area
- Search query construction — must not leak across orgs
- File storage policies — must prevent unauthorized access
- AI summary API route — must verify permissions before sending data to OpenAI
- Seed script — must generate correct org/user/role associations

## What Is Still Untrusted
*(Updated throughout the build)*

## What Would Be Reviewed Next With More Time
*(Updated throughout the build)*
