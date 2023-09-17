import { Redis } from "https://deno.land/x/upstash_redis/mod.ts";

export default async (request: Request) => {
  const FIVE_MINUTES_IN_SECONDS = 300;

  const config = {
    url: Netlify.env.get("UPSTASH_REDIS_REST_URL") || "",
    token: Netlify.env.get("UPSTASH_REDIS_REST_TOKEN") || "",
  };

  if (!config.url) return new Response("URL missing from Upstash config");
  if (!config.token) return new Response("Token missing from Upstash config");

  const redis = new Redis(config);

  const path = request.url.split("/").pop();
  if (!path) return new Response("Missing path");

  const createJSONResponse = (data: unknown) =>
    Response.json(data, {
      headers: {
        "Access-Control-Allow-Origin": "https://satonomics.xyz",
        "cache-control": `public, s-maxage=${FIVE_MINUTES_IN_SECONDS}`,
      },
    });

  const fetchCached = async () => createJSONResponse(await redis.get(path));

  const pathAliveKey = `${path}-alive`;

  if (await redis.get(pathAliveKey)) return fetchCached();

  const apiURL = `https://satonomics.shuttleapp.rs/${path}`;

  try {
    const result = await fetch(apiURL);

    const json = await result.json();

    redis.set(path, json);
    redis.set(pathAliveKey, true, {
      ex: FIVE_MINUTES_IN_SECONDS,
    });

    return createJSONResponse(json);
  } catch {
    return fetchCached();
  }
};
