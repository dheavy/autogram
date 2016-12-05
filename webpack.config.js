var webpack = require('webpack');
var path = require('path');
var outputFile = libraryName + '.js';
var UglifyJsPlugin = webpack.optimize.UglifyJsPlugin;
var env = process.env.WEBPACK_ENV;
var nodeExternals = require('webpack-node-externals');

var libraryName = 'autogram';
var plugins = [], outputFile;

if (env === 'build') {
  plugins.push(new UglifyJsPlugin({ minimize: true }));
  outputFile = libraryName + '.min.js';
} else {
  outputFile = libraryName + '.js';
}

var config = {
  entry: ['babel-polyfill', __dirname + '/src/autogram.js', , __dirname + '/src/status.js'],
  devtool: 'source-map',
  output: {
    path: __dirname + '/lib',
    filename: outputFile,
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  target: 'node',
  externals: [nodeExternals()],
  module: {
    loaders: [
      {
        test: /(\.jsx|\.js)$/,
        loader: 'eslint-loader',
        exclude: /(node_modules|bower_components)/
      },
      {
        test: /(\.json)$/,
        loader: 'json-loader',
        exclude: /(node_modules|bower_components)/
      },
      {
        test: /(\.jsx|\.js)$/,
        loader: 'babel-loader',
        exclude: /(node_modules|bower_components)/
      }
    ]
  },
  resolve: {
    root: path.resolve('./src'),
    extensions: ['', '.js']
  },
  plugins: plugins
};

module.exports = config;
