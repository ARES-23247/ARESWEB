---
name: aresweb-youth-data-protection
description: Enforces FIRST Youth Protection Program and COPPA-aligned data security rules for all ARESWEB user-facing features. Prevents public exposure of student PII (email, phone, location) and ensures only nickname/avatar are displayed publicly for minors.
---

# ARESWEB Youth Data Protection Enforcement

## Purpose

This skill enforces **absolute compliance** with the FIRST Youth Protection Program (YPP), Children's Online Privacy Protection Act (COPPA), and Scouting America digital safety guidelines as they apply to the ARESWEB portal. All code, components, and API endpoints MUST comply with these rules without exception.

## Core Rules

### 1. NEVER Display Student PII Publicly

The following fields are **PRIVATE** for any user with `member_type = 'student'` and MUST NEVER be rendered in any public-facing component, API response, or page:

- **Email address** — never show on profile cards, About Us, comment threads, or any public page
- **Phone number** — never show publicly; only visible to the student themselves in their own profile editor
- **Full legal name** — use `nickname` exclusively for all public display. If no nickname is set, use "ARES Member" as fallback. NEVER fall back to the `user.name` or `user.email` fields from the auth provider.
- **Date of birth** — never collect or display
- **Home address / location** — never collect; approximate location (city/state) from the team profile is sufficient

### 2. Public Profile Data (Safe to Display)

The following fields are safe to display publicly for ALL member types:

- `nickname` (required for public display)
- `avatar` (DiceBear URL)
- `pronouns`
- `subteams` (array)
- `member_type` (student/alumni/mentor/coach)
- `bio` (user-authored; remind users not to include personal contact info)
- `favorite_first_thing`
- `fun_fact`
- `colleges` (for alumni/mentors only — never for students)
- `employers` (for alumni/mentors only — never for students)

### 3. Conditional Field Visibility by Member Type

| Field | Student | Alumni | Mentor | Coach |
|-------|---------|--------|--------|-------|
| Nickname | ✅ Public | ✅ Public | ✅ Public | ✅ Public |
| Avatar | ✅ Public | ✅ Public | ✅ Public | ✅ Public |
| Email | ❌ Hidden | ⚙️ Optional | ⚙️ Optional | ⚙️ Optional |
| Phone | ❌ Hidden | ⚙️ Optional | ⚙️ Optional | ⚙️ Optional |
| Colleges | ❌ Hidden | ✅ Public | ✅ Public | ✅ Public |
| Employers | ❌ Hidden | ✅ Public | ✅ Public | ✅ Public |
| Bio | ✅ Public | ✅ Public | ✅ Public | ✅ Public |
| Grade/Year | ❌ Hidden | ✅ Public | N/A | N/A |

### 4. API Response Filtering

All API endpoints that return user data MUST apply server-side PII stripping:

```typescript
function sanitizeProfileForPublic(profile: UserProfile, userAuthProfile: { image?: string }, memberType: string) {
  const safe = {
    nickname: profile.nickname || "ARES Member",
    avatar: userAuthProfile.image,
    pronouns: profile.pronouns,
    subteams: profile.subteams,
    member_type: profile.member_type,
    bio: profile.bio,
    favorite_first_thing: profile.favorite_first_thing,
    fun_fact: profile.fun_fact,
  };

  // Students: NEVER expose PII or career/education fields
  if (memberType === 'student') {
    return safe;
  }

  // Adults (alumni/mentor/coach): include optional fields if user opted in
  return {
    ...safe,
    email: profile.show_email ? profile.email : undefined,
    phone: profile.show_phone ? profile.phone : undefined,
    colleges: profile.colleges,
    employers: profile.employers,
    grade_year: profile.grade_year,
  };
}
```

**This filtering MUST happen server-side in the Cloudflare Worker.** Never rely on client-side filtering alone.

### 5. Profile Editor UX Enforcement

When rendering the ProfileEditor component:

- If `member_type === 'student'`:
  - **DO NOT** show email/phone toggle switches (there is no option to make them public)
  - **DO NOT** show college/employer sections
  - Show a banner: "🛡️ Your contact information is protected and never shown publicly per FIRST Youth Protection guidelines."

- If `member_type !== 'student'`:
  - Show email/phone fields with explicit opt-in toggles: "Show on my public profile?"
  - Default these toggles to **OFF**

### 6. Comment Attribution

In the `CommentSection` component, comments from students MUST display:
- Avatar + Nickname only
- NO email, NO full name from OAuth provider

### 7. Photo/Media Rules

- Never auto-tag students in uploaded media
- If implementing a photo gallery with face detection in the future, student faces MUST require parental consent before tagging
- Event photos should use generic captions, not student full names

### 8. COPPA Compliance

- The ARESWEB portal does NOT collect data directly from children under 13
- All user accounts are created via OAuth (GitHub/Google) which have their own age restrictions
- If a user self-identifies as under 13 in the future, their account must be immediately restricted to read-only

### 9. Audit Checklist

Before any PR that touches user profiles, comments, or public-facing user data is merged, verify:

- [ ] No student email addresses appear in any public API response
- [ ] No student phone numbers appear in any public API response  
- [ ] Public profile pages for students show only nickname + avatar + safe fields
- [ ] The About Us page never displays student contact information
- [ ] Comment threads show nickname + avatar only (no email/name leakage)
- [ ] Server-side `sanitizeProfileForPublic()` is applied to ALL public endpoints
- [ ] ProfileEditor hides PII fields for students with a protective banner
- [ ] Alumni/mentor/coach PII fields default to opt-OUT
