const { execSync } = require('child_process');

try {
  console.log("⚡ Proactive Firebase Hosting preview channel cleanup starting...");
  
  // List channels in JSON format
  const output = execSync('pnpm exec firebase hosting:channel:list --json --project aresfirst-portal').toString();
  const data = JSON.parse(output);
  const channels = data.result?.channels || [];
  
  // Extract and filter preview channels
  const previewChannels = channels.filter(c => {
    const parts = c.name.split('/');
    const channelId = parts[parts.length - 1];
    return channelId !== 'live';
  }).map(c => {
    const parts = c.name.split('/');
    const channelId = parts[parts.length - 1];
    return {
      id: channelId,
      name: c.name,
      expireTime: new Date(c.expireTime || 0).getTime()
    };
  });
  
  console.log(`Found ${previewChannels.length} active preview channels.`);
  
  // Sort by expiration/update time (oldest expiration first)
  previewChannels.sort((a, b) => a.expireTime - b.expireTime);
  
  // Target a maximum of 5 channels to remain within standard Firebase project limits
  const maxAllowedChannels = 5;
  if (previewChannels.length >= maxAllowedChannels) {
    const toDeleteCount = previewChannels.length - maxAllowedChannels + 1;
    console.log(`⚠️ Quota threshold reached. Deleting the oldest ${toDeleteCount} preview channels...`);
    
    for (let i = 0; i < toDeleteCount; i++) {
      const channel = previewChannels[i];
      try {
        console.log(`🗑️ Deleting preview channel: ${channel.id}`);
        execSync(`pnpm exec firebase hosting:channel:delete ${channel.id} -f --project aresfirst-portal`);
        console.log(`✅ Successfully deleted channel ${channel.id}`);
      } catch (delErr) {
        console.error(`❌ Failed to delete channel ${channel.id}:`, delErr.message);
      }
    }
  } else {
    console.log("✅ Preview channels are well within the quota. No cleanup necessary.");
  }
} catch (err) {
  console.error("⚠️ Preview channel cleanup process encountered an error (skipping cleanup):", err.message);
  // Do not fail the CI run if cleanup hits permissions or network issues
}
