import { Redis } from "https://deno.land/x/upstash_redis/mod.ts";

import type { Config } from "https://edge.netlify.com";

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

  const { pathname, search } = new URL(request.url);

  const path = `${pathname}${search}`;

  const canBeCached = pathname !== "/candlesticks";

  console.log("path", path);

  const redisGetAlive = () => {
    console.log("REDIS: GET: Alive");
    return redis.get(pathAliveKey);
  };

  const redisGetLastKey = () => {
    console.log("REDIS: GET: Last key");
    return redis.get(pathLastKey);
  };

  const redisSetAlive = () => {
    console.log("REDIS: SET: Alive");
    redis.set(pathAliveKey, true, {
      ex: FIVE_MINUTES_IN_SECONDS,
    });
  };

  const redisSetAll = (
    json: any,
    lastKey: string | undefined,
  ) => {
    console.log(`REDIS: SET: Cache`);
    redis.set(path, json);

    console.log(`REDIS: SET: Last key`);
    redis.set(pathLastKey, lastKey);

    redisSetAlive();
  };

  if (!path || path === "/") return new Response("Missing path");

  const fetchCached = async () => {
    console.log(`REDIS: GET: Cache`);
    return createJSONResponse(await redis.get(path));
  };

  const pathAliveKey = `${path}-alive`;
  const pathLastKey = `${path}-last`;

  if (canBeCached && await redisGetAlive()) return fetchCached();

  const apiURL = `https://satonomics.shuttleapp.rs/${path}`;

  try {
    console.log(`SHUTTLE: ${path}`);

    const result = await fetch(apiURL);

    const json = await result.json();

    const lastKey = Object.keys(json).pop();

    if (canBeCached) {
      if (await redisGetLastKey() === lastKey) {
        console.log(`DATA: Old`);
        redisSetAlive();
        return createJSONResponse(json);
      }

      if (
        typeof json === "object" && !Array.isArray(json) &&
        (("message" in json) || ("status_code" in json))
      ) {
        console.log(`ERROR: Shuttle issue`);
        return fetchCached();
      }

      redisSetAll(json, lastKey);
    }

    return createJSONResponse(json);
  } catch {
    if (canBeCached) {
      return fetchCached();
    }

    return new Response("Candlesticks shuttle error");
  }
};

export const config: Config = {
  cache: "manual",
  path: "/*",
};
