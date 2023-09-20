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

  if (path === "/favicon.ico") {
    return new Response("Error got favicon");
  }

  const cacheFirst = pathname !== "/candlesticks";

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
    if (!cacheFirst) {
      return;
    }

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

  if (cacheFirst && await redisGetAlive()) return fetchCached();

  const apiURL = `https://satonomics.shuttleapp.rs/${path}`;

  try {
    console.log(`SHUTTLE: ${path}`);

    const result = await fetch(apiURL);

    const json = await result.json();

    const lastKey = Array.isArray(json)
      ? (json.at(-1).date as string | undefined)
      : Object.keys(json).pop();

    const redisLastKey = await redisGetLastKey();

    if (redisLastKey === lastKey) {
      console.log(`REDIS: Already saved`);

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

    return createJSONResponse(json);
  } catch {
    return fetchCached();
  }
};

export const config: Config = {
  cache: "manual",
  path: "/*",
};
