module.exports = {
  rules: {
    // Disable import resolution errors for CLI package
    // These are caused by ESM/CJS interop with chalk and ora
    'import/default': 'off',
    'import/no-named-as-default': 'off',
    'import/no-named-as-default-member': 'off',
  },
};
