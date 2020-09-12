const webpack = require('webpack');
const path = require('path');
const UglifyJSPlugin = require('uglify-es-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  context: path.join(__dirname, 'src'),
  entry: {
    OverPassLayer: './OverPassLayer',
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].bundle.js',
  },
  externals: {
    leaflet: 'L',
  },
  plugins: [
    new webpack.NamedModulesPlugin(),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
    new UglifyJSPlugin({
      compress: {
        drop_console: true,
      },
    }),
    new CopyWebpackPlugin([
      {
        from: '*.css*',
      },
    ]),
  ],
  mode: 'production',

  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
      { test: /\.css$/, use: 'raw-loader' },
    ],
  },
};
