import { siteConfig } from "./site.config";

/**
 * GitHub Projects v2 — GraphQL Client Utility
 * Provides CRUD operations against the GitHub Projects v2 API
 * for the ${siteConfig.urls.githubOrg} organization project board.
 */

interface GitHubProjectsConfig {
  pat: string;
  projectId: string;
  org: string;
}

interface GQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

// ── Core GraphQL executor ────────────────────────────────────────────
async function gql<T>(config: GitHubProjectsConfig, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("https://api.github.com/graphql", { signal: AbortSignal.timeout(10000),
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.pat}`,
      "Content-Type": "application/json",
      "User-Agent": `${siteConfig.team.name}-Cloudflare-Worker`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub GraphQL HTTP ${res.status}: ${text}`);
  }

  const json = await res.json() as GQLResponse<T>;
  if (json.errors && json.errors.length > 0) {
    throw new Error(`GitHub GraphQL Error: ${json.errors.map(e => e.message).join(", ")}`);
  }
  if (!json.data) {
    throw new Error("GitHub GraphQL returned no data");
  }
  return json.data;
}

// ── Types ────────────────────────────────────────────────────────────
export interface ProjectField {
  id: string;
  name: string;
  dataType: string;
  options?: { id: string; name: string }[];
}

export interface ProjectItem {
  id: string;
  title: string;
  body?: string;
  status?: string;
  assignees: string[];
  createdAt: string;
  updatedAt: string;
  url?: string;
  type: "DRAFT_ISSUE" | "ISSUE" | "PULL_REQUEST";
}

export interface ProjectBoard {
  title: string;
  shortDescription: string;
  items: ProjectItem[];
  totalCount: number;
}

// ── Fetch project board items ────────────────────────────────────────
export async function fetchProjectBoard(config: GitHubProjectsConfig): Promise<ProjectBoard> {
  const query = `
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          title
          shortDescription
          items(first: 100, orderBy: {field: POSITION, direction: ASC}) {
            totalCount
            nodes {
              id
              type
              createdAt
              updatedAt
              content {
                ... on DraftIssue { title body }
                ... on Issue { title body url }
                ... on PullRequest { title body url }
              }
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field { ... on ProjectV2SingleSelectField { name } }
                  }
                  ... on ProjectV2ItemFieldTextValue {
                    text
                    field { ... on ProjectV2Field { name } }
                  }
                  ... on ProjectV2ItemFieldUserValue {
                    users(first: 5) { nodes { login } }
                    field { ... on ProjectV2Field { name } }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  interface ContentNode {
    title?: string;
    body?: string;
    url?: string;
  }

  interface FieldValueNode {
    name?: string;
    text?: string;
    field?: { name?: string };
    users?: { nodes: { login: string }[] };
  }

  interface ItemNode {
    id: string;
    type: string;
    createdAt: string;
    updatedAt: string;
    content: ContentNode | null;
    fieldValues: { nodes: FieldValueNode[] };
  }

  interface ProjectData {
    node: {
      title: string;
      shortDescription: string;
      items: { totalCount: number; nodes: ItemNode[] };
    };
  }

  const data = await gql<ProjectData>(config, query, { projectId: config.projectId });
  const project = data.node;

  const items: ProjectItem[] = project.items.nodes.map((item) => {
    let status: string | undefined;
    const assignees: string[] = [];

    for (const fv of item.fieldValues.nodes) {
      if (fv.field?.name === "Status" && fv.name) {
        status = fv.name;
      }
      if (fv.users?.nodes) {
        assignees.push(...fv.users.nodes.map(u => u.login));
      }
    }

    return {
      id: item.id,
      title: item.content?.title || "Untitled",
      body: item.content?.body || undefined,
      url: (item.content as ContentNode)?.url || undefined,
      status,
      assignees,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      type: item.type as ProjectItem["type"],
    };
  });

  return {
    title: project.title,
    shortDescription: project.shortDescription,
    items,
    totalCount: project.items.totalCount,
  };
}

// ── Fetch project fields (status options, etc.) ──────────────────────
export async function fetchProjectFields(config: GitHubProjectsConfig): Promise<ProjectField[]> {
  const query = `
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 30) {
            nodes {
              ... on ProjectV2Field {
                id
                name
                dataType
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                dataType
                options { id name }
              }
              ... on ProjectV2IterationField {
                id
                name
                dataType
              }
            }
          }
        }
      }
    }
  `;

  interface FieldNode {
    id: string;
    name: string;
    dataType: string;
    options?: { id: string; name: string }[];
  }

  interface FieldsData {
    node: { fields: { nodes: FieldNode[] } };
  }

  const data = await gql<FieldsData>(config, query, { projectId: config.projectId });
  return data.node.fields.nodes.map((f) => ({
    id: f.id,
    name: f.name,
    dataType: f.dataType,
    options: f.options,
  }));
}

// ── Create a draft item on the project ───────────────────────────────
export async function createProjectItem(
  config: GitHubProjectsConfig,
  title: string,
  body?: string
): Promise<string> {
  const mutation = `
    mutation($projectId: ID!, $title: String!, $body: String) {
      addProjectV2DraftIssue(input: {
        projectId: $projectId,
        title: $title,
        body: $body
      }) {
        projectItem { id }
      }
    }
  `;

  interface CreateResult {
    addProjectV2DraftIssue: { projectItem: { id: string } };
  }

  const data = await gql<CreateResult>(config, mutation, {
    projectId: config.projectId,
    title,
    body: body || null,
  });

  return data.addProjectV2DraftIssue.projectItem.id;
}

// ── Update a project item's status field ─────────────────────────────
export async function updateProjectItemStatus(
  config: GitHubProjectsConfig,
  itemId: string,
  statusFieldId: string,
  statusOptionId: string
): Promise<boolean> {
  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId,
        itemId: $itemId,
        fieldId: $fieldId,
        value: { singleSelectOptionId: $optionId }
      }) {
        projectV2Item { id }
      }
    }
  `;

  await gql(config, mutation, {
    projectId: config.projectId,
    itemId,
    fieldId: statusFieldId,
    optionId: statusOptionId,
  });

  return true;
}

// ── Query a single project item ──────────────────────────────────────
export async function queryProjectItem(
  config: GitHubProjectsConfig,
  itemId: string
): Promise<ProjectItem | null> {
  const query = `
    query($itemId: ID!) {
      node(id: $itemId) {
        ... on ProjectV2Item {
          id
          type
          createdAt
          updatedAt
          content {
            ... on DraftIssue { title body }
            ... on Issue { title body url }
            ... on PullRequest { title body url }
          }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
              ... on ProjectV2ItemFieldUserValue {
                users(first: 5) { nodes { login } }
                field { ... on ProjectV2Field { name } }
              }
            }
          }
        }
      }
    }
  `;

  interface ContentNode { title?: string; body?: string; url?: string; }
  interface FieldValueNode { name?: string; field?: { name?: string }; users?: { nodes: { login: string }[] }; }
  interface ItemData {
    node: {
      id: string; type: string; createdAt: string; updatedAt: string;
      content: ContentNode | null;
      fieldValues: { nodes: FieldValueNode[] };
    } | null;
  }

  const data = await gql<ItemData>(config, query, { itemId });
  if (!data.node) return null;

  const item = data.node;
  let status: string | undefined;
  const assignees: string[] = [];
  for (const fv of item.fieldValues.nodes) {
    if (fv.field?.name === "Status" && fv.name) status = fv.name;
    if (fv.users?.nodes) assignees.push(...fv.users.nodes.map(u => u.login));
  }

  return {
    id: item.id,
    title: item.content?.title || "Untitled",
    body: item.content?.body || undefined,
    url: (item.content as ContentNode)?.url || undefined,
    status,
    assignees,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    type: item.type as ProjectItem["type"],
  };
}

// ── Helper: Build config from env/settings ───────────────────────────
export function buildGitHubConfig(settings: Record<string, string | undefined>): GitHubProjectsConfig | null {
  const pat = settings["GITHUB_PAT"];
  const projectId = settings["GITHUB_PROJECT_ID"];
  const org = settings["GITHUB_ORG"] || siteConfig.urls.githubOrg;

  if (!pat || !projectId) return null;
  return { pat, projectId, org };
}
