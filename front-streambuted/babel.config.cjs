const transformImportMetaForJest = ({ types: t }) => ({
  visitor: {
    MetaProperty(path) {
      if (path.node.meta.name === "import" && path.node.property.name === "meta") {
        path.replaceWith(t.identifier("__importMeta"));
      }
    },
  },
});

module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    ["@babel/preset-react", { runtime: "automatic" }],
    "@babel/preset-typescript",
  ],
  plugins: [transformImportMetaForJest],
};
