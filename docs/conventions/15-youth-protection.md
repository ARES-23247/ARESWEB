# Youth Data Protection

> FIRST YPP and COPPA compliance for student data. Read before working with profiles, comments, or public user data.

## NEVER Display Student PII

For `member_type = 'student'`, these fields are **PRIVATE:**
- Email address
- Phone number
- Full legal name (use `nickname` only)
- Date of birth
- Home address/location

## Public Profile Data (Safe for All)

- `nickname` (required)
- `avatar`
- `pronouns`
- `subteams`
- `member_type`
- `bio`
- `favorite_first_thing`, `fun_fact`

## Conditional Visibility

| Field | Student | Alumni | Mentor | Coach |
|---|---|---|---|---|
| Nickname | ✅ | ✅ | ✅ | ✅ |
| Email | ❌ | Optional | Optional | Optional |
| Phone | ❌ | Optional | Optional | Optional |
| Colleges | ❌ | ✅ | ✅ | ✅ |
| Employers | ❌ | ✅ | ✅ | ✅ |

## API Filtering

```typescript
function sanitizeProfileForPublic(profile, memberType) {
  const safe = { nickname, avatar, pronouns, subteams, bio };
  return memberType === 'student' ? safe : { ...safe, email, phone, colleges };
}
```

**Filtering MUST happen server-side.**

## ProfileEditor UX

- Students: NO email/phone toggles, NO college/employer sections
- Show banner: "🛡️ Your contact info is protected per FIRST YPP."
- Adults: Opt-in toggles default to OFF

## Audit Checklist

- [ ] No student emails in public API responses
- [ ] No student phone numbers publicly
- [ ] Public profiles show only nickname + safe fields
- [ ] Comments show nickname + avatar only
- [ ] Server-side sanitization on ALL public endpoints
