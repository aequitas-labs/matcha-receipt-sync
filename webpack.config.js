const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

require('dotenv').config();

/** @type {import('webpack').Configuration} */
const config = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: process.env.NODE_ENV === 'production' ? false : 'cheap-source-map',

  entry: {
    'service-worker': './src/background/service-worker.ts',
    'content-amazon': './src/scrapers/amazon/bridge.ts',
    'content-amazon-main': './src/scrapers/amazon/page.ts',
    'content-costco': './src/scrapers/costco/bridge.ts',
    'content-costco-main': './src/scrapers/costco/page.ts',
    'content-walmart': './src/scrapers/walmart/bridge.ts',
    'content-walmart-main': './src/scrapers/walmart/page.ts',
    'content-target': './src/scrapers/target/bridge.ts',
    'content-target-main': './src/scrapers/target/page.ts',
    popup: './src/popup/popup.tsx',
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },

  plugins: [
    new webpack.DefinePlugin({
      POSTHOG_API_KEY: JSON.stringify(process.env.POSTHOG_API_KEY || ''),
      POSTHOG_HOST: JSON.stringify(process.env.POSTHOG_HOST || 'https://us.i.posthog.com'),
    }),
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: '.' },
        { from: 'src/popup/index.html', to: 'popup/index.html' },
        { from: 'src/icons', to: 'icons' },
      ],
    }),
  ],

  optimization: {
    splitChunks: false,
  },
};

module.exports = config;
