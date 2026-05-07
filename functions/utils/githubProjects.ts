import { siteConfig } from "./site.config";
import { graphql } from "@octokit/graphql";
import { z } from "zod";

/**
 * GitHub Projects v2 — GraphQL Client Utility
 */

interface GitHubProjectsConfig {
  pat: string;
  projectId: string;
  org: string;
}

// ── Validation Schemas ───────────────────────────────────────────────

const ContentNodeSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  url: z.string().optional(),
}).nullable();

const FieldValueNodeSchema = z.object({
  name: z.string().optional(),
  text: z.string().optional(),
  field: z.object({ name: z.string().optional() }).optional(),
  users: z.object({ nodes: z.array(z.object({ login: z.string() })) }).optional(),
});

const ProjectItemNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["DRAFT_ISSUE", "ISSUE", "PULL_REQUEST"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  content: ContentNodeSchema,
  fieldValues: z.object({ nodes: z.array(FieldValueNodeSchema) }),
});

const ProjectBoardSchema = z.object({
  node: z.object({
    title: z.string(),
    shortDescription: z.string().optional().nullable(),
    items: z.object({
      totalCount: z.number(),
      nodes: z.array(ProjectItemNodeSchema),
    }),
  }),
});

// ── Core GraphQL executor ────────────────────────────────────────────
async function gql<T>(config: GitHubProjectsConfig, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${config.pat}`,
      "user-agent": `${siteConfig.team.name}-Cloudflare-Worker`,
    },
  });

  return await graphqlWithAuth(query, variables) as T;
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

  const rawData = await gql<unknown>(config, query, { projectId: config.projectId });
  const data = ProjectBoardSchema.parse(rawData);
  const project = data.node;

  const items: ProjectItem[] = project.items.nodes.map((item: any) => {
    let status: string | undefined;
    const assignees: string[] = [];

    for (const fv of item.fieldValues.nodes) {
      if (fv.field?.name === "Status" && fv.name) {
        status = fv.name;
      }
      if (fv.users?.nodes) {
        assignees.push(...fv.users.nodes.map((u: any) => u.login));
      }
    }

    return {
      id: item.id,
      title: item.content?.title || "Untitled",
      body: item.content?.body || undefined,
      url: item.content?.url || undefined,
      status,
      assignees,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      type: item.type,
    };
  });

  return {
    title: project.title,
    shortDescription: project.shortDescription || "",
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
  return data.node.fields.nodes.map((f: any) => ({
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
    if (fv.users?.nodes) assignees.push(...fv.users.nodes.map((u: any) => u.login));
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
