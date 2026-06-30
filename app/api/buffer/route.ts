import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BUFFER_ENDPOINT = "https://api.buffer.com";

async function bufferGraphQL<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(BUFFER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));
  }
  return json.data as T;
}

interface Channel {
  id: string;
  name: string;
  service: string;
}

// GET = discovery: list channels (id, name, service) across your orgs,
// so you can grab your LinkedIn channelId for BUFFER_CHANNEL_ID.
export async function GET() {
  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Brak BUFFER_API_KEY na serwerze." },
      { status: 500 }
    );
  }
  try {
    const acc = await bufferGraphQL<{
      account: { organizations: { id: string; name: string }[] };
    }>(apiKey, `query { account { organizations { id name } } }`);

    const orgs = acc.account?.organizations ?? [];
    const out: { org: string; channels: Channel[] }[] = [];
    for (const org of orgs) {
      const data = await bufferGraphQL<{ channels: Channel[] }>(
        apiKey,
        `query($id: OrganizationId!) { channels(input:{ organizationId:$id }) { id name service } }`,
        { id: org.id }
      );
      out.push({ org: org.name, channels: data.channels ?? [] });
    }
    return NextResponse.json({ organizations: out });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

// POST { text } = create a DRAFT post on the LinkedIn channel.
// Draft = nie publikuje się, dopóki nie zatwierdzisz w Buffer.
export async function POST(req: Request) {
  const apiKey = process.env.BUFFER_API_KEY;
  const channelId = process.env.BUFFER_CHANNEL_ID;
  if (!apiKey || !channelId) {
    return NextResponse.json(
      { error: "Brak BUFFER_API_KEY lub BUFFER_CHANNEL_ID na serwerze." },
      { status: 500 }
    );
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Zły JSON." }, { status: 400 });
  }
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Pusty tekst posta." }, { status: 400 });
  }

  try {
    const data = await bufferGraphQL<{
      createPost:
        | { __typename: "PostActionSuccess"; post: { id: string } }
        | { __typename: "MutationError"; message: string };
    }>(
      apiKey,
      `mutation($text: String!, $channelId: String!) {
        createPost(input:{
          text: $text,
          channelId: $channelId,
          schedulingType: automatic,
          mode: addToQueue,
          saveToDraft: true
        }) {
          __typename
          ... on PostActionSuccess { post { id } }
          ... on MutationError { message }
        }
      }`,
      { text, channelId }
    );

    const r = data.createPost;
    if (r.__typename === "MutationError") {
      return NextResponse.json({ error: r.message }, { status: 502 });
    }
    return NextResponse.json({ ok: true, id: r.post.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
