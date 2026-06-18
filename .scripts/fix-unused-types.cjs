const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const fixes = [
  // events/index.ts - prefix unused types with _
  {
    file: 'functions/api/routes/events/index.ts',
    replacements: [
      ['errorResponses', '_errorResponses'],
      ['GetEventsQuery', '_GetEventsQuery'],
      ['GetAdminEventsQuery', '_GetAdminEventsQuery'],
      ['GetAdminEventParams', '_GetAdminEventParams'],
      ['GetAdminEventSuccess', '_GetAdminEventSuccess'],
      ['SaveEventBody', '_SaveEventBody'],
      ['GetEventParams', '_GetEventParams'],
      ['GetEventSuccess', '_GetEventSuccess'],
      ['UpdateEventParams', '_UpdateEventParams'],
      ['UpdateEventBody', '_UpdateEventBody'],
      ['DeleteEventParams', '_DeleteEventParams'],
      ['ApproveEventParams', '_ApproveEventParams'],
      ['RejectEventParams', '_RejectEventParams'],
      ['RejectEventBody', '_RejectEventBody'],
      ['UndeleteEventParams', '_UndeleteEventParams'],
      ['PurgeEventParams', '_PurgeEventParams'],
      ['RepushEventParams', '_RepushEventParams'],
      ['RepushEventBody', '_RepushEventBody'],
      ['GetSignupsParams', '_GetSignupsParams'],
      ['SubmitSignupParams', '_SubmitSignupParams'],
      ['SubmitSignupBody', '_SubmitSignupBody'],
      ['DeleteMySignupParams', '_DeleteMySignupParams'],
      ['UpdateMyAttendanceParams', '_UpdateMyAttendanceParams'],
      ['UpdateMyAttendanceBody', '_UpdateMyAttendanceBody'],
      ['UpdateUserAttendanceParams', '_UpdateUserAttendanceParams'],
      ['UpdateUserAttendanceBody', '_UpdateUserAttendanceBody'],
      ['GetEventHistoryParams', '_GetEventHistoryParams'],
      ['GetEventHistorySuccess', '_GetEventHistorySuccess'],
      ['RestoreEventHistoryParams', '_RestoreEventHistoryParams'],
    ]
  },
  // finance.ts
  {
    file: 'functions/api/routes/finance.ts',
    replacements: [
      ['errorResponses', '_errorResponses'],
      ['GetSummaryQuery', '_GetSummaryQuery'],
      ['ListPipelineQuery', '_ListPipelineQuery'],
      ['SavePipelineBody', '_SavePipelineBody'],
      ['DeletePipelineParams', '_DeletePipelineParams'],
      ['ListTransactionsQuery', '_ListTransactionsQuery'],
      ['SaveTransactionBody', '_SaveTransactionBody'],
      ['DeleteTransactionParams', '_DeleteTransactionParams'],
      ['FinanceSummaryItem', '_FinanceSummaryItem'],
    ]
  },
  // judges.ts
  {
    file: 'functions/api/routes/judges.ts',
    replacements: [
      ['errorResponses', '_errorResponses'],
      ['ErrorCode', '_ErrorCode'],
      ['AwardResult', '_AwardResult'],
      ['ErrorResponse', '_ErrorResponse'],
      ['JudgeLoginSuccessResponse', '_JudgeLoginSuccessResponse'],
      ['JudgeCodesResponse', '_JudgeCodesResponse'],
      ['CreateJudgeCodeResponse', '_CreateJudgeCodeResponse'],
      ['SuccessResponse', '_SuccessResponse'],
    ]
  },
  // sponsors.ts
  {
    file: 'functions/api/routes/sponsors.ts',
    replacements: [
      ['errorResponses', '_errorResponses'],
      ['GetRoiResponse', '_GetRoiResponse'],
      ['AdminListSponsorsResponse', '_AdminListSponsorsResponse'],
      ['SaveSponsorResponse', '_SaveSponsorResponse'],
      ['DeleteSponsorResponse', '_DeleteSponsorResponse'],
      ['GetAdminTokensResponse', '_GetAdminTokensResponse'],
      ['GenerateTokenResponse', '_GenerateTokenResponse'],
    ]
  },
  // communications.ts
  {
    file: 'functions/api/routes/communications.ts',
    replacements: [
      ['logSystemError', '_logSystemError'],
    ]
  },
  // docs.ts
  {
    file: 'functions/api/routes/docs.ts',
    replacements: [
      ['errorResponses', '_errorResponses'],
    ]
  },
  // githubWebhook.ts
  {
    file: 'functions/api/routes/githubWebhook.ts',
    replacements: [
      ['typedHandler', '_typedHandler'],
      ['GitHubWebhookPayload', '_GitHubWebhookPayload'],
    ]
  },
  // inquiries/handlers.ts
  {
    file: 'functions/api/routes/inquiries/handlers.ts',
    replacements: [
      ['InquiryQueryResult', '_InquiryQueryResult'],
    ]
  },
  // outreach/list.ts
  {
    file: 'functions/api/routes/outreach/list.ts',
    replacements: [
      ['OutreachQueryResult', '_OutreachQueryResult'],
    ]
  },
  // posts.ts
  {
    file: 'functions/api/routes/posts.ts',
    replacements: [
      ['errorResponses', '_errorResponses'],
    ]
  },
  // seasons.ts
  {
    file: 'functions/api/routes/seasons.ts',
    replacements: [
      ['errorResponses', '_errorResponses'],
    ]
  },
  // dbMock.ts
  {
    file: 'functions/test/dbMock.ts',
    replacements: [
      ['DbRows', '_DbRows'],
    ]
  },
  // EventCard.tsx
  {
    file: 'src/components/EventCard.tsx',
    replacements: [
      ['Users', '_Users'],
    ]
  },
];

let fixed = 0;
let skipped = 0;

for (const fix of fixes) {
  const filePath = join(__dirname, '..', fix.file);
  try {
    let content = readFileSync(filePath, 'utf8');
    let modified = false;
    
    for (const [from, to] of fix.replacements) {
      // Only replace type aliases and import names, not usage
      // Use word boundaries and handle both `type X =` and `X` in imports
      const patterns = [
        new RegExp(`\btype\s+${from}\s*=`, 'g'),
        new RegExp(`\btype\s+${from}\s+`, 'g'),
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          content = content.replace(pattern, `type ${to} =`);
          modified = true;
        }
      }
      
      // Handle import renaming: `import { X }` → `import { X as _X }`
      // This is trickier, so skip for now
    }
    
    if (modified) {
      writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${fix.file}`);
      fixed++;
    } else {
      console.log(`⏭️  Skipped: ${fix.file} (no matches found)`);
      skipped++;
    }
  } catch (err) {
    console.log(`❌ Error: ${fix.file} - ${err.message}`);
  }
}

console.log(`\n📊 Results: ${fixed} fixed, ${skipped} skipped`);
