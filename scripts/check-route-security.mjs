#!/usr/bin/env node

/**
 * Fails CI when a Cloud Functions mutation route lacks an explicit identity
 * control. App Check protects every browser mutation globally in apiApp.ts;
 * this scan separately requires route-level Firebase authorization unless the
 * route is an intentionally public form/canary or a signed server integration.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const routesRoot = path.resolve("functions/src/routes");
const apiAppSource = fs.readFileSync(path.resolve("functions/src/apiApp.ts"), "utf8");
const gameAppSource = fs.readFileSync(path.resolve("functions/src/apps/game.ts"), "utf8");
const gameRouteSource = fs.readFileSync(path.resolve("functions/src/routes/buzzello.ts"), "utf8");
const gameBudgetSource = fs.readFileSync(path.resolve("functions/src/lib/gameResourceBudget.ts"), "utf8");
const mutationMethods = new Set(["post", "put", "patch", "delete"]);
const authorizationMiddleware = new Set([
  "ensureAuth",
  "ensureTeamMember",
  "ensureAdmin",
  "ensureAdminOrCoach",
]);

const explicitNonFirebaseRoutes = new Map([
  ["buzzello.ts:POST:/games", {
    rationale: "guest friend-game creation; globally requires App Check and locally requires durable IP/project quotas plus strict validation",
    requiredSource: [/createQuota/u, /validate\(createSchema\)/u, /req\.body\.boardSize === 91 \? largeService : service/u, /\.createFriendGame\(\)/u],
  }],
  ["buzzello.ts:POST:/join", {
    rationale: "guest invite redemption; globally requires App Check and locally requires a bounded invite capability, durable quotas, and strict validation",
    requiredSource: [/joinQuota/u, /validate\(joinSchema\)/u, /service\.joinFriendGame\(code\)/u],
  }],
  ["buzzello.ts:POST:/matchmaking", {
    rationale: "blind guest matchmaking; globally requires App Check and locally requires durable IP/project quotas plus strict validation",
    requiredSource: [/guestMatchmakingQuota/u, /validate\(createSchema\)/u, /req\.body\.boardSize === 91 \? largeService : service/u, /\.matchmake\("guest"\)/u],
  }],
  ["buzzello.ts:POST:/games/:gameId/sync", {
    rationale: "match-scoped guest access authenticated by a random capability whose HMAC is stored server-side, with durable and per-match quotas",
    requiredSource: [/syncQuota/u, /requireGamePlayerToken\(req\)/u, /service\.sync\(/u],
  }],
  ["buzzello.ts:POST:/games/:gameId/moves", {
    rationale: "match-scoped guest action authenticated by a random capability whose HMAC is stored server-side, with durable quotas and optimistic concurrency",
    requiredSource: [/moveQuota/u, /validate\(moveSchema\)/u, /requireGamePlayerToken\(req\)/u, /expectedVersion/u, /service\.action\(/u],
  }],
  ["buzzle.ts:POST:/games", {
    rationale: "guest friend-game creation; globally requires App Check and locally requires durable IP/project quotas plus strict validation",
    requiredSource: [/createQuota/u, /validate\(emptyBodySchema\)/u, /service\.createFriendGame\(\)/u],
  }],
  ["buzzle.ts:POST:/join", {
    rationale: "guest invite redemption; globally requires App Check and locally requires a bounded invite capability, durable quotas, and strict validation",
    requiredSource: [/joinQuota/u, /validate\(joinSchema\)/u, /service\.joinFriendGame\(code\)/u],
  }],
  ["buzzle.ts:POST:/matchmaking", {
    rationale: "blind guest matchmaking; globally requires App Check and locally requires durable IP/project quotas plus strict validation",
    requiredSource: [/guestMatchmakingQuota/u, /validate\(emptyBodySchema\)/u, /service\.matchmake\("guest"\)/u],
  }],
  ["buzzle.ts:POST:/games/:gameId/sync", {
    rationale: "match-scoped guest access authenticated by a random capability whose HMAC is stored server-side, with durable and per-match quotas",
    requiredSource: [/syncQuota/u, /requireGamePlayerToken\(req\)/u, /service\.sync\(/u],
  }],
  ["buzzle.ts:POST:/games/:gameId/actions", {
    rationale: "match-scoped guest action authenticated by a random capability whose HMAC is stored server-side, with durable quotas and optimistic concurrency",
    requiredSource: [/actionQuota/u, /validate\(moveSchema\)/u, /requireGamePlayerToken\(req\)/u, /expectedVersion/u, /service\.action\(/u],
  }],
  ["appCheckCanary.ts:POST:/canary", {
    rationale: "public App Check canary; globally requires a valid App Check token",
    requiredSource: [/res\.status\(204\)/u],
  }],
  ["inquiries.ts:POST:/", {
    rationale: "public inquiry form; globally requires App Check and locally requires rate limiting, validation, and encrypted storage",
    requiredSource: [/inquiryLimiter/u, /validate\(createInquirySchema\)/u, /appCheckObservation/u, /await encrypt\(/u],
  }],
  ["profileSync.ts:POST:/sync", {
    rationale: "server integration authenticated by a Secret Manager shared secret",
    requiredSource: [/x-sync-secret/u, /hasValidSyncSecret/u, /timingSafeEqual/u],
  }],
  ["webhooks.ts:POST:/zulip", {
    rationale: "Zulip webhook authenticated by a Secret Manager shared secret",
    requiredSource: [/ZULIP_WEBHOOK_TOKEN/u, /timingSafeEqual/u, /zulipWebhookSchema/u],
  }],
  ["webhooks.ts:POST:/onshape", {
    rationale: "Onshape webhook authenticated by a Secret Manager shared secret",
    requiredSource: [/ONSHAPE_WEBHOOK_TOKEN/u, /timingSafeEqual/u, /onshapeWebhookSchema/u, /rateLimit/u],
  }],
  ["studioIntegrations.ts:POST:/v1/notebook-drafts", {
    rationale: "Studio installation authenticated by a scoped, salted token hash and durable per-installation quota",
    requiredSource: [
      /assertInstallationAuthorized/u,
      /timingSafeEqual/u,
      /STUDIO_SCOPE_REQUIRED/u,
      /STUDIO_WORKSPACE_FORBIDDEN/u,
      /HOURLY_INSTALLATION_LIMIT/u,
    ],
  }],
]);

const observedExceptions = new Set();
const findings = [];
let mutationCount = 0;

for (const requiredGlobalControl of [
  /app\.use\(observeAppCheck\)/u,
  /app\.use\(enforceAppCheck\)/u,
  /app\.use\("\/api",\s*rateLimit\(/u,
]) {
  if (!requiredGlobalControl.test(apiAppSource)) {
    findings.push(`apiApp.ts no longer contains global mutation control ${requiredGlobalControl}`);
  }
}

for (const [source, requiredControl, label] of [
  [gameAppSource, /globalRequestLimit:\s*\{[\s\S]*max:\s*5_000/u, "service-wide game request ceiling"],
  [gameBudgetSource, /GAME_MONTHLY_RESOURCE_UNITS\s*=\s*500_000/u, "monthly game resource ceiling"],
  [gameRouteSource, /calendarWindow:\s*"month"/u, "calendar-month game quota"],
]) {
  if (!requiredControl.test(source)) findings.push(`Game service is missing ${label}`);
}

for (const file of fs.readdirSync(routesRoot).filter((name) => name.endsWith(".ts")).sort()) {
  const fullPath = path.join(routesRoot, file);
  const content = fs.readFileSync(fullPath, "utf8");
  const source = ts.createSourceFile(
    fullPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const routerIdentifiers = new Set(["router"]);

  function collectRouterIdentifiers(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      (
        (ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text === "Router") ||
        (ts.isPropertyAccessExpression(node.initializer.expression) && node.initializer.expression.name.text === "Router")
      )
    ) {
      routerIdentifiers.add(node.name.text);
    }
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      const typeText = node.type?.getText(source) ?? "";
      if (/(?:^|\.)Router$/u.test(typeText) || /router$/iu.test(node.name.text)) {
        routerIdentifiers.add(node.name.text);
      }
    }
    ts.forEachChild(node, collectRouterIdentifiers);
  }

  collectRouterIdentifiers(source);

  function routeCallDetails(node) {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null;
    const method = node.expression.name.text;
    if (!mutationMethods.has(method)) return null;

    if (
      ts.isIdentifier(node.expression.expression) &&
      (routerIdentifiers.has(node.expression.expression.text) || /router$/iu.test(node.expression.expression.text))
    ) {
      return { method, routeArgument: node.arguments[0], middlewareArguments: node.arguments.slice(1) };
    }

    const routeBuilder = node.expression.expression;
    if (
      ts.isCallExpression(routeBuilder) &&
      ts.isPropertyAccessExpression(routeBuilder.expression) &&
      routeBuilder.expression.name.text === "route" &&
      ts.isIdentifier(routeBuilder.expression.expression) &&
      (routerIdentifiers.has(routeBuilder.expression.expression.text) || /router$/iu.test(routeBuilder.expression.expression.text))
    ) {
      return { method, routeArgument: routeBuilder.arguments[0], middlewareArguments: node.arguments };
    }

    return null;
  }

  function visit(node) {
    const routeCall = routeCallDetails(node);
    if (routeCall) {
      if (!routeCall.routeArgument || !(
        ts.isStringLiteral(routeCall.routeArgument) ||
        ts.isNoSubstitutionTemplateLiteral(routeCall.routeArgument)
      )) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        findings.push(`${file} line ${line} uses a non-literal mutation route path`);
        ts.forEachChild(node, visit);
        return;
      }
      mutationCount += 1;
      const method = routeCall.method.toUpperCase();
      const routePath = routeCall.routeArgument.text;
      const key = `${file}:${method}:${routePath}`;
      const handlerSource = node.getText(source);
      const middlewareNames = new Set(
        routeCall.middlewareArguments
          .filter(ts.isIdentifier)
          .map((argument) => argument.text),
      );
      const hasFirebaseAuthorization = [...authorizationMiddleware].some((name) =>
        middlewareNames.has(name),
      );

      if (!hasFirebaseAuthorization) {
        const exception = explicitNonFirebaseRoutes.get(key);
        if (!exception) {
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          findings.push(`${key} (line ${line}) has no approved identity control`);
        } else {
          observedExceptions.add(key);
          const missing = exception.requiredSource.filter((pattern) => !pattern.test(content) && !pattern.test(handlerSource));
          if (missing.length > 0) {
            findings.push(`${key} no longer contains required controls: ${missing.join(", ")}`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
}

for (const [key, exception] of explicitNonFirebaseRoutes) {
  if (!observedExceptions.has(key)) {
    findings.push(`stale security exception ${key}: ${exception.rationale}`);
  }
}

if (findings.length > 0) {
  console.error("Route security invariant failed:");
  for (const finding of findings) console.error(` - ${finding}`);
  process.exit(1);
}

console.log(
  `Route security invariant passed for ${mutationCount} mutation routes ` +
    `(${mutationCount - explicitNonFirebaseRoutes.size} Firebase-authorized, ` +
    `${explicitNonFirebaseRoutes.size} explicitly controlled exceptions).`,
);
