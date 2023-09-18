import type { Config, Context } from "https://edge.netlify.com";

export default async (req: Request, context: Context) => {
  console.log("run hello");

  return new Response("Hello world", {
    headers: {
      "cache-control": "public, s-maxage=3600",
    },
  });
};

export const config: Config = {
  cache: "manual",
  path: "/hello",
};
