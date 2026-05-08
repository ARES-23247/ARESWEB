const { readFileSync, writeFileSync } = require('fs');
const { globSync } = require('glob');

const fixes = [
  // communications.ts
  { file: 'functions/api/routes/communications.ts', pattern: /import\s*{\s*([^}]*logSystemError[^}]*)}\s*from/g, replacement: 'import { $1'.replace('logSystemError, ', '').replace(', logSystemError', '') },
  
  // docs.ts - unused errorResponses
  { file: 'functions/api/routes/docs.ts', pattern: /const errorResponses\s*=[^;]+;/g, replacement: '' },
  
  // events/index.ts - multiple unused
  { file: 'functions/api/routes/events/index.ts', replacements: [
    { from: "const errorResponses = {\n  400: { error: 'Bad request' },\n  401: { error: 'Unauthorized' },\n  403: { error: 'Forbidden' },\n  404: { error: 'Not found' },\n  500: { error: 'Internal server error' },\n};\n", to: '' },
    { from: 'GetEventsQuery', to: '_GetEventsQuery' },
    { from: 'GetAdminEventsQuery', to: '_GetAdminEventsQuery' },
    { from: 'GetAdminEventParams', to: '_GetAdminEventParams' },
    { from: 'GetAdminEventSuccess', to: '_GetAdminEventSuccess' },
    { from: 'SaveEventBody', to: '_SaveEventBody' },
    { from: 'GetEventParams', to: '_GetEventParams' },
    { from: 'GetEventSuccess', to: '_GetEventSuccess' },
    { from: 'UpdateEventParams', to: '_UpdateEventParams' },
    { from: 'UpdateEventBody', to: '_UpdateEventBody' },
    { from: 'DeleteEventParams', to: '_DeleteEventParams' },
    { from: 'ApproveEventParams', to: '_ApproveEventParams' },
    { from: 'RejectEventParams', to: '_RejectEventParams' },
    { from: 'RejectEventBody', to: '_RejectEventBody' },
    { from: 'UndeleteEventParams', to: '_UndeleteEventParams' },
    { from: 'PurgeEventParams', to: '_PurgeEventParams' },
    { from: 'RepushEventParams', to: '_RepushEventParams' },
    { from: 'RepushEventBody', to: '_RepushEventBody' },
    { from: 'GetSignupsParams', to: '_GetSignupsParams' },
    { from: 'SubmitSignupParams', to: '_SubmitSignupParams' },
    { from: 'SubmitSignupBody', to: '_SubmitSignupBody' },
    { from: 'DeleteMySignupParams', to: '_DeleteMySignupParams' },
    { from: 'UpdateMyAttendanceParams', to: '_UpdateMyAttendanceParams' },
    { from: 'UpdateMyAttendanceBody', to: '_UpdateMyAttendanceBody' },
    { from: 'UpdateUserAttendanceParams', to: '_UpdateUserAttendanceParams' },
    { from: 'UpdateUserAttendanceBody', to: '_UpdateUserAttendanceBody' },
    { from: 'GetEventHistoryParams', to: '_GetEventHistoryParams' },
    { from: 'GetEventHistorySuccess', to: '_GetEventHistorySuccess' },
    { from: 'RestoreEventHistoryParams', to: '_RestoreEventHistoryParams' },
  ]},

  // Similar patterns for other files...
];

// Simple approach: run eslint fix for auto-fixable, then list remaining
console.log('Running eslint auto-fix...');
const { execSync } = require('child_process');
try {
  execSync('npx eslint . --ext .ts,.tsx --fix', { stdio: 'inherit' });
  console.log('✅ Auto-fix complete');
} catch (e) {
  console.log('⚠️  Some issues remain');
}

console.log('\nRemaining unused vars need manual _ prefix or removal');
