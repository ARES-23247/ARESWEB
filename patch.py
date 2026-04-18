import os, re
filepath = r'c:\Users\david\dev\robotics\ftc\ARESWEB\functions\api\[[route]].ts'
with open(filepath, 'r') as f:
    text = f.read()

# Replace the middleware
text = re.sub(
    r'app\.use\("/admin/\*", async \(c, next\) => \{.*?\}\);',
    '''app.use("/admin/*", async (c, next) => {
  const url = new URL(c.req.url);
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return c.json({ error: "Strict Context: Unauthorized. Cloudflare Zero Trust authentication required." }, 401);
  }
  await next();
});''',
    text,
    flags=re.DOTALL
)

# Vulnerable block 1
v1_regex = r'  const host = c\.req\.header\("host"\).*?if \(\!email && \!isDashboard && \!host\.includes\("localhost"\)\) \{\s*return c\.json\(\{ error: "Unauthorized" \}, 401\);\s*\}'

# Vulnerable block 2 (POST /posts)
v2_regex = r'  // Validate host header.*?if \(\!email && \!isDashboard && \!host\.includes\("localhost"\)\) \{\s*return c\.json\(\{ error: "Unauthorized" \}, 401\);\s*\}'

# List /media
v3_regex = r'  const host = c\.req\.header\("host"\).*?if \(\!\["aresfirst\.org", "localhost"\]\.some\(\(h\) => host\.includes\(h\)\)\) \{\s*return c\.json\(\{ error: "Forbidden host" \}, 403\);\s*\}'

secure_auth = '''  const url = new URL(c.req.url);
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return c.json({ error: "Strict Context: Unauthorized. Cloudflare Zero Trust authentication required." }, 401);
  }'''

text = re.sub(v1_regex, secure_auth, text, flags=re.DOTALL)
text = re.sub(v2_regex, secure_auth, text, flags=re.DOTALL)

# For /media GET, we only had host check, let's fix it too: 
secure_auth_list = '''  const url = new URL(c.req.url);
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return c.json({ error: "Strict Context: Forbidden" }, 403);
  }'''
text = re.sub(v3_regex, secure_auth_list, text, flags=re.DOTALL)

with open(filepath, 'w') as f:
    f.write(text)
print('Patched [[route]].ts security.')
