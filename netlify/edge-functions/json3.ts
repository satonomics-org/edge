import type { Config, Context } from "https://edge.netlify.com";

const FIVE_MINUTES_IN_SECONDS = 300;

export default async (req: Request, context: Context) => {
  console.log("run json3");

  return Response.json({
    e: "f",
  }, {
    headers: {
      "cache-control":
        `public, max-age=${FIVE_MINUTES_IN_SECONDS}, s-maxage=${FIVE_MINUTES_IN_SECONDS}`,
    },
  });
};

export const config: Config = {
  cache: "manual",
  path: "/json3*",
};
