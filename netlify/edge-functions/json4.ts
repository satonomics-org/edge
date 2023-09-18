import type { Config, Context } from "https://edge.netlify.com";

export default async (req: Request, context: Context) => {
  console.log("run json4");

  return Response.json({
    g: "h",
  });
};

export const config: Config = {
  path: "/json4*",
};
