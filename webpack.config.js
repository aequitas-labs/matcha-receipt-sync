const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

/** @type {import('webpack').Configuration} */
const config = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: process.env.NODE_ENV === 'production' ? false : 'cheap-source-map',

  entry: {
    'service-worker': './src/background/service-worker.ts',
    'content-amazon': './src/scrapers/amazon/content.ts',
    'content-costco': './src/scrapers/costco/content.ts',
    'content-costco-main': './src/scrapers/costco/content-main.ts',
    'content-walmart': './src/scrapers/walmart/content.ts',
    'content-walmart-main': './src/scrapers/walmart/content-main.ts',
    'content-target': './src/scrapers/target/content.ts',
    'content-target-main': './src/scrapers/target/content-main.ts',
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
