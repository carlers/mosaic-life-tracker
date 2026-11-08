import {OWNER,PROJECT} from './config.js';
export const SNAPSHOT_QUERY = `query ProjectConfig($login: String!, $number: Int!) {
  viewer { login }
  user(login:$login) {
    projectV2(number:$number) {
      id title public closed
      fields(first:100) {
        pageInfo { hasNextPage }
        nodes {
          __typename
          ... on ProjectV2Field { id name dataType }
          ... on ProjectV2SingleSelectField { id name options { id name color description } }
        }
      }
      items(first:100) {
        pageInfo { hasNextPage }
        totalCount
        nodes {
          id
          content { __typename ... on Issue { number repository { nameWithOwner } } }
          fieldValues(first:30) {
            pageInfo { hasNextPage }
            nodes {
              __typename
              ... on ProjectV2ItemFieldSingleSelectValue {
                field { ... on ProjectV2SingleSelectField { id name } }
                optionId name
              }
            }
          }
        }
      }
      workflows(first:50) {
        pageInfo { hasNextPage }
        nodes { id name enabled }
      }
    }
  }
}`;
export async function graphql(token,query,variables={},fetcher=fetch) {
  if (typeof token !== 'string' || !token) throw Error('Missing GitHub grant');
  const response = await fetcher('https://api.github.com/graphql',{
    method:'POST',headers:{'Authorization':'Bearer '+token,
      'Accept':'application/vnd.github+json','Content-Type':'application/json',
      'User-Agent':'mosaic-gh-projects-admin-mcp'},
    body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw Error('GitHub GraphQL failed: HTTP '+response.status);
  const body=await response.json();
  if (body.errors?.length || !body.data) throw Error('GitHub GraphQL operation rejected');
  return body.data;
}
export async function snapshot(token,fetcher=fetch) {
  const data=await graphql(token,SNAPSHOT_QUERY,{login:OWNER,number:PROJECT},fetcher);
  if (data.viewer?.login !== OWNER) throw Error('GitHub user does not match allowed owner');
  const project=data.user?.projectV2;
  if (!project || project.closed || project.public || !project.id) throw Error('Private pilot project unavailable');
  if (project.fields?.pageInfo?.hasNextPage || project.items?.pageInfo?.hasNextPage ||
      project.workflows?.pageInfo?.hasNextPage ||
      (project.items?.nodes??[]).some(x=>x.fieldValues?.pageInfo?.hasNextPage))
    throw Error('Project configuration exceeds safe snapshot bounds');
  if (!Array.isArray(project.fields?.nodes) || !Array.isArray(project.items?.nodes) ||
      !Array.isArray(project.workflows?.nodes)) throw Error('Incomplete GitHub configuration');
  return {id:project.id,title:project.title,public:project.public,
    fields:project.fields.nodes,items:project.items.nodes,workflows:project.workflows.nodes};
}
export const CREATE_FIELD = `mutation Create($input:CreateProjectV2FieldInput!) {
  createProjectV2Field(input:$input) {
    projectV2Field { ... on ProjectV2SingleSelectField { id name options {id name color description} } }
  }
}`;
export const UPDATE_FIELD = `mutation Update($input:UpdateProjectV2FieldInput!) {
  updateProjectV2Field(input:$input) {
    projectV2Field { ... on ProjectV2SingleSelectField { id name options {id name color description} } }
  }
}`;
