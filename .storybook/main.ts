import type { StorybookConfig } from '@storybook/react-webpack5';

const config: StorybookConfig = {
  stories: ['../src/popup/**/*.stories.@(ts|tsx)'],
  framework: '@storybook/react-webpack5',
  webpackFinal: async (config) => {
    if (config.module?.rules) {
      config.module.rules = config.module.rules.map((rule) => {
        // Replace default CSS rule with one that includes postcss-loader for Tailwind
        if (
          rule &&
          typeof rule === 'object' &&
          rule.test instanceof RegExp &&
          rule.test.test('.css')
        ) {
          return {
            test: /\.css$/,
            use: ['style-loader', 'css-loader', 'postcss-loader'],
          };
        }
        return rule;
      });

      // Add ts-loader for TypeScript/TSX files (Storybook v10 doesn't include this by default)
      config.module.rules.push({
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: [{ loader: 'ts-loader', options: { transpileOnly: true } }],
      });
    }
    return config;
  },
};

export default config;
