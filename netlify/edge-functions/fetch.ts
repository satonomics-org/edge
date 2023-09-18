import { Redis } from "https://deno.land/x/upstash_redis/mod.ts";

import type { Config, Context } from "https://edge.netlify.com";

const FIVE_MINUTES_IN_SECONDS = 300;

const createJSONResponse = (data: unknown) =>
  Response.json(data, {
    headers: {
      "Access-Control-Allow-Origin": "https://satonomics.xyz",
      "cache-control":
        `public, max-age=${FIVE_MINUTES_IN_SECONDS}, s-maxage=${FIVE_MINUTES_IN_SECONDS}`,
    },
  });

export default async (request: Request) => {
  const config = {
    url: Netlify.env.get("UPSTASH_REDIS_REST_URL") || "",
    token: Netlify.env.get("UPSTASH_REDIS_REST_TOKEN") || "",
  };

  if (!config.url) return new Response("URL missing from Upstash config");
  if (!config.token) return new Response("Token missing from Upstash config");

  const redis = new Redis(config);

  const path = request.url.split("/").pop();
  if (!path) return new Response("Missing path");

  const fetchCached = async () => {
    console.log(`fetch ${path} from upstash`);
    return createJSONResponse(await redis.get(path));
  };

  const pathAliveKey = `${path}-alive`;

  if (await redis.get(pathAliveKey)) return fetchCached();

  const apiURL = `https://satonomics.shuttleapp.rs/${path}`;

  try {
    console.log(`fetch ${path} from shuttle`);

    const result = await fetch(apiURL);

    const json = await result.json();

    if (
      typeof json === "object" && !Array.isArray(json) &&
      (("message" in json) || ("status_code" in json))
    ) {
      console.log(`ERROR: shuttle issue`);
      return fetchCached();
    }

    redis.set(path, json);
    redis.set(pathAliveKey, true, {
      ex: FIVE_MINUTES_IN_SECONDS,
    });

    return createJSONResponse(json);
  } catch {
    return fetchCached();
  }
};

export const config: Config = {
  cache: "manual",
  path: "/fetch/*",
};
