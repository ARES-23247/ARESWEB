process.env.ENCRYPTION_SECRET = "temporary_deploy_secret_that_is_at_least_32_chars";
try {
  require("./lib/index.js");
  console.log("SUCCESS_LOAD");
} catch (e) {
  console.error("FAILED_LOAD", e);
}
