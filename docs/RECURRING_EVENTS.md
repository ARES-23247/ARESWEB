# Recurring event instances

ARESWEB stores one parent event for a recurring series and sparse exception
documents under `events/{eventId}/occurrences/{YYYY-MM-DD}`. It does not clone a
full event document for every practice.

## Editing scope

Authorized calendar publishers can choose either scope in the event editor:

- **This session** writes only fields that differ from the generated parent
  occurrence to the exception document's `overrides` map.
- **Entire series** updates the parent event and its recurrence rule.

The editable instance fields are title, start/end time, venue, description,
category, cover image, potluck flag, and volunteer flag. Cancellation remains a
separate flag on the same exception document. Public and managed DTOs validate
stored overrides before applying them, so unknown or malformed fields are not
returned.

Calendar subscriptions receive edited sessions as RFC 5545 recurrence
exceptions using the parent `UID` plus `RECURRENCE-ID`. Cancelled sessions are
published as `EXDATE` values.

## Photos

Event-photo link documents may include an `occurrenceDate`:

- a `YYYY-MM-DD` value associates the photo with that session;
- `null` or an absent field associates the photo with the full series.

An occurrence gallery returns its matching session photos plus series photos.
The parent event gallery returns all active photos. The public Calendar API
continues to strip uploader and operational metadata.

RSVPs are still stored at the parent-event level and therefore apply to the
series rather than an individual recurring session.
