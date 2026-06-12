export const ModelRouterPlugin = async (ctx) => {
  const pluginModule = await import("../../packages/opencode/src/index.js");
  return pluginModule.default(ctx);
};
export default ModelRouterPlugin;
