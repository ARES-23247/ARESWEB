export function collectEmbeddedAcademyInteractionFolders(markdownDocuments, simulations) {
  const approvedInteractionFolders = new Map(
    simulations
      .filter((simulation) => simulation.academyApproved)
      .map((simulation) => [simulation.id.toLowerCase(), simulation.path.replace(/^\.\//, "")]),
  );
  const folders = new Set();

  for (const markdown of markdownDocuments) {
    for (const match of markdown.matchAll(/<([a-z][a-z0-9]*)\s*\/>/g)) {
      const folder = approvedInteractionFolders.get(match[1]);
      if (folder) folders.add(folder);
    }
  }

  return [...folders].sort();
}
